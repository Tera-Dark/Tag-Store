import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Group, Category, Tag, TagStoreTemplate, TemplateGroupData, TemplateCategoryData, TemplateTagData } from '../types/data';
import * as StorageService from '../services/StorageService'; // Import our service
import { db } from '../services/TagDatabase'; // Import db instance directly for transaction usage

export const useTagStore = defineStore('tagStore', () => {
  // --- State ---
  const currentLibraryId = ref<string | null>(null); // ID of the currently loaded library
  const groups = ref<Group[]>([]);
  const categories = ref<Category[]>([]);
  const tags = ref<Tag[]>([]);
  
  const isLoading = ref<boolean>(false); 
  const currentError = ref<string | null>(null);
  
  // Filtering state (example, might need adjustments for hierarchy)
  const searchTerm = ref<string>('');
  const filterGroupId = ref<string | null>(null); // Example: filter by group
  const filterCategoryId = ref<string | null>(null); // Example: filter by category

  // --- Helper Functions (Defined First) ---
  const _handleError = (error: any, message: string) => {
    console.error(`${message}:`, error);
    currentError.value = error?.message || message;
    isLoading.value = false; // Ensure loading state is reset on error
  };

  const clearLocalState = () => {
    console.log("Clearing local tag store state.");
    currentLibraryId.value = null;
    groups.value = [];
    categories.value = [];
    tags.value = [];
    currentError.value = null;
    searchTerm.value = '';
    filterGroupId.value = null;
    filterCategoryId.value = null;
  };

  // --- Actions (Define core actions like load before others use them) ---

  /**
   * Loads all groups, categories, and tags for a specific library ID.
   */
  const loadDataForLibrary = async (libraryId: string | null) => {
    if (libraryId === null) {
      console.log("loadDataForLibrary called with null ID. Clearing state.");
      clearLocalState();
      return;
    }
    if (isLoading.value && libraryId === currentLibraryId.value) {
      console.warn(`Already loading data for library ${libraryId}, skipping.`);
      return;
    }

    console.log(`Loading data for library: ${libraryId}`);
    isLoading.value = true;
    currentError.value = null;
    // Clear previous data before loading new library
    groups.value = [];
    categories.value = [];
    tags.value = [];

    try {
      currentLibraryId.value = libraryId; 
      const loadedGroups = await StorageService.getAllGroups(libraryId);
      groups.value = loadedGroups;
      console.log(`Loaded ${groups.value.length} groups.`);

      if (groups.value.length > 0) {
        const groupIds = groups.value.map(g => g.id);
        const loadedCategories = await StorageService.getCategoriesByGroupIds(groupIds);
        categories.value = loadedCategories;
        console.log(`Loaded ${categories.value.length} categories.`);

        if (categories.value.length > 0) {
          const categoryIds = categories.value.map(c => c.id);
          const loadedTags = await StorageService.getTagsByCategoryIds(categoryIds);
          tags.value = loadedTags;
           console.log(`Loaded ${tags.value.length} tags.`);
        } else {
           tags.value = []; 
           console.log("No categories found, tags set to empty.");
        }
      } else {
         categories.value = []; 
         tags.value = [];
         console.log("No groups found, categories and tags set to empty.");
      }
      console.log(`Successfully loaded data for library ${libraryId}`);
    } catch (error) {
      _handleError(error, `Failed to load data for library ${libraryId}`);
      clearLocalState(); // Clear state on error
    } finally {
      isLoading.value = false;
    }
  };

   // --- Group CRUD (Restored logic using StorageService) ---
  const addGroup = async (groupData: Omit<Group, 'id' | 'libraryId' | 'order'>): Promise<string | null> => {
    if (!currentLibraryId.value) {
      _handleError(null, "Cannot add group: No active library selected.");
      return null;
    }
    isLoading.value = true;
    try {
      // Use StorageService to add the group, it handles ID and libraryId association
      const newId = await StorageService.addGroup(groupData, currentLibraryId.value);
      const newGroup = await StorageService.getGroupById(newId); // Fetch the complete group data
      if (newGroup) {
        groups.value.push(newGroup);
        // Ensure list is sorted after adding (by order, then name)
        groups.value.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
        console.log(`Added group: ${newGroup.name}`);
        currentError.value = null;
        return newId; // Return the new ID
      } else {
         throw new Error("Failed to retrieve the newly added group.");
      }
    } catch (error) {
      _handleError(error, "Failed to add group");
      return null; // Indicate failure
    } finally {
      isLoading.value = false;
    }
  };

  const updateGroup = async (id: string, changes: Partial<Omit<Group, 'id' | 'libraryId'>>) => {
    isLoading.value = true;
    try {
      // Use StorageService to persist the update
      await StorageService.updateGroup(id, changes);
      // Update the local state
      const index = groups.value.findIndex(g => g.id === id);
      if (index !== -1) {
        groups.value[index] = { ...groups.value[index], ...changes };
        // Re-sort if name or order changed
        if ('order' in changes || 'name' in changes) {
           groups.value.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
          }
        console.log(`Updated group: ${groups.value[index].name}`);
        currentError.value = null;
      } else {
        console.warn(`Group ${id} not found in local state after update attempt.`);
      }
    } catch (error) {
      _handleError(error, `Failed to update group ${id}`);
    } finally {
        isLoading.value = false;
    }
  };

  const deleteGroup = async (id: string) => {
      isLoading.value = true;
      try {
          const groupIndex = groups.value.findIndex(g => g.id === id);
          if (groupIndex === -1) {
              console.warn(`Group ${id} not found for deletion.`);
              return; // Group doesn't exist locally
          }

          const categoriesToDelete = categories.value.filter(c => c.groupId === id);
          const categoryIdsToDelete = categoriesToDelete.map(c => c.id);

          // Use StorageService to delete the group and its children (assuming cascade or transaction)
          await StorageService.deleteGroup(id); 

          // Update local state after successful deletion
          groups.value.splice(groupIndex, 1);
          categories.value = categories.value.filter(c => c.groupId !== id);
          if (categoryIdsToDelete.length > 0) {
              tags.value = tags.value.filter(t => !categoryIdsToDelete.includes(t.categoryId));
          }
          console.log(`Deleted group ${id} and its children from local state.`);
          currentError.value = null;

      } catch (error) {
          _handleError(error, `Failed to delete group ${id}`);
      } finally {
          isLoading.value = false;
      }
  };

  // --- Category CRUD ---
  const addCategory = async (categoryData: Omit<Category, 'id'>): Promise<string | null> => {
    if (!currentLibraryId.value) {
      _handleError(null, "Cannot add category: No active library selected.");
      return null;
    }
    const groupId = categoryData.groupId;
    if (!groupId) {
        _handleError(null, "Cannot add category: Group ID is missing.");
        return null;
    }
    if (!groups.value.some(g => g.id === groupId)) {
       _handleError(null, `Cannot add category: Group ${groupId} not found in current library.`);
       return null;
    }
    isLoading.value = true;
    try {
      const newId = await StorageService.addCategory({ name: categoryData.name }, groupId);
      const newCategory = await StorageService.getCategoryById(newId);
      if (newCategory) {
        categories.value.push(newCategory);
        categories.value.sort((a, b) => a.name.localeCompare(b.name)); 
        console.log(`Added category: ${newCategory.name} to group ${groupId}`);
        currentError.value = null;
        return newId;
      } else {
         throw new Error("Failed to retrieve the newly added category.");
      }
    } catch (error) {
      _handleError(error, "Failed to add category");
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  const updateCategory = async (id: string, changes: Partial<Omit<Category, 'id'>>) => {
     isLoading.value = true;
    try {
      if (changes.groupId && !groups.value.some(g => g.id === changes.groupId)) {
          throw new Error(`Target group ${changes.groupId} not found.`);
      }
      await StorageService.updateCategory(id, changes);
      const index = categories.value.findIndex(c => c.id === id);
      if (index !== -1) {
        categories.value[index] = { ...categories.value[index], ...changes };
        if ('name' in changes) {
             categories.value.sort((a, b) => a.name.localeCompare(b.name)); 
        }
         console.log(`Updated category: ${categories.value[index].name}`);
        currentError.value = null;
      }
    } catch (error) {
      _handleError(error, `Failed to update category ${id}`);
    } finally {
      isLoading.value = false;
    }
  };

  const deleteCategory = async (id: string) => {
    isLoading.value = true;
    try {
      const categoryIndex = categories.value.findIndex(c => c.id === id);
      if (categoryIndex === -1) return;
      await StorageService.deleteCategory(id);
      categories.value.splice(categoryIndex, 1);
      tags.value = tags.value.filter(t => t.categoryId !== id);
      console.log(`Deleted category ${id} and its tags from local state.`);
      currentError.value = null;
    } catch (error) {
      _handleError(error, `Failed to delete category ${id}`);
    } finally {
      isLoading.value = false;
    }
  };

  // --- Tag CRUD ---
  const addTag = async (tagData: Omit<Tag, 'id'>): Promise<string | null> => {
    if (!currentLibraryId.value) {
      _handleError(null, "Cannot add tag: No active library selected.");
      return null;
    }
    // Ensure categoryId exists within tagData before calling StorageService
    const categoryId = tagData.categoryId;
    if (!categoryId) {
        _handleError(null, "Cannot add tag: Category ID is missing in tagData.");
        return null;
    }
    if (!categories.value.some(c => c.id === categoryId)) {
       _handleError(null, `Cannot add tag: Category ${categoryId} not found in current library.`);
       return null;
    }

    isLoading.value = true;
    try {
      // Attempt 3: Pass only tagData, assuming it contains categoryId and other needed fields
      const newId = await StorageService.addTag(tagData);
      
      const newTag = await StorageService.getTagById(newId);
       if (newTag) {
        tags.value.push(newTag);
        tags.value.sort((a, b) => a.name.localeCompare(b.name));
        // Use newTag.categoryId if needed, as tagData might be modified
        console.log(`Added tag: ${newTag.name} to category ${newTag.categoryId}`); 
        currentError.value = null;
        return newId;
      } else {
         throw new Error("Failed to retrieve the newly added tag.");
      }
    } catch (error) {
      _handleError(error, "Failed to add tag");
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  const updateTag = async (id: string, changes: Partial<Omit<Tag, 'id'>>) => {
     isLoading.value = true;
    try {
      if (changes.categoryId && !categories.value.some(c => c.id === changes.categoryId)) {
          throw new Error(`Target category ${changes.categoryId} not found.`);
      }
      await StorageService.updateTag(id, changes);
      const index = tags.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tags.value[index] = { ...tags.value[index], ...changes };
        if ('name' in changes) {
             tags.value.sort((a, b) => a.name.localeCompare(b.name));
        }
         console.log(`Updated tag: ${tags.value[index].name}`);
        currentError.value = null;
      }
    } catch (error) {
      _handleError(error, `Failed to update tag ${id}`);
    } finally {
      isLoading.value = false;
    }
  };

  const deleteTag = async (id: string) => {
    isLoading.value = true;
    try {
      const tagIndex = tags.value.findIndex(t => t.id === id);
      if (tagIndex === -1) return;
      await StorageService.deleteTag(id);
      tags.value.splice(tagIndex, 1);
      console.log(`Deleted tag ${id} from local state.`);
      currentError.value = null;
    } catch (error) {
      _handleError(error, `Failed to delete tag ${id}`);
    } finally {
      isLoading.value = false;
    }
  };

  // --- Batch Operations ---
  const batchDeleteTags = async (ids: string[]) => {
     if (ids.length === 0) return;
     isLoading.value = true;
      try {
          await StorageService.batchDeleteTags(ids);
         tags.value = tags.value.filter(t => !ids.includes(t.id));
         console.log(`Batch deleted ${ids.length} tags.`); currentError.value = null;
     } catch (error) { _handleError(error, "Failed to batch delete tags"); } 
     finally { isLoading.value = false; }
  };
  const batchMoveTags = async (ids: string[], targetCategoryId: string) => {
    if (ids.length === 0) return;
    if (!categories.value.some(c => c.id === targetCategoryId)) { _handleError(null, `Cannot move tags: Target category ${targetCategoryId} not found.`); return; }
    isLoading.value = true;
    try {
        await StorageService.batchMoveTags(ids, targetCategoryId);
        tags.value.forEach(tag => { if (ids.includes(tag.id)) { tag.categoryId = targetCategoryId; } });
        console.log(`Batch moved ${ids.length} tags to category ${targetCategoryId}.`); currentError.value = null;
    } catch (error) { _handleError(error, "Failed to batch move tags"); } 
    finally { isLoading.value = false; }
  };

  // --- Import/Export ---
  const importData = async (templateData: TagStoreTemplate, targetLibraryId: string) => {
    if (!targetLibraryId) { _handleError(null, "Import failed: Target library ID is required."); return; }
    if (!templateData?.groups || !Array.isArray(templateData.groups)) { _handleError(null, "Import failed: Invalid template data format."); return; }
    console.log(`Starting import into library ${targetLibraryId}...`); isLoading.value = true; currentError.value = null;
    try {
      console.log(`Clearing existing data for library ${targetLibraryId}...`);
      await StorageService.clearLibraryData(targetLibraryId);
      console.log(`Existing data cleared.`);
      const groupsToAdd: Group[] = []; const categoriesToAdd: Category[] = []; const tagsToAdd: Tag[] = [];
      console.log(`Processing ${templateData.groups.length} groups...`);
      for (const groupTemplate of templateData.groups) {
          const newGroupId = crypto.randomUUID();
          groupsToAdd.push({ id: newGroupId, libraryId: targetLibraryId, name: groupTemplate.name, color: groupTemplate.color, icon: groupTemplate.icon, order: groupTemplate.order ?? Date.now() });
          if (groupTemplate.categories?.length) {
              console.log(`  Processing ${groupTemplate.categories.length} categories for ${groupTemplate.name}...`);
              for (const categoryTemplate of groupTemplate.categories) {
                  const newCategoryId = crypto.randomUUID();
                  categoriesToAdd.push({ id: newCategoryId, groupId: newGroupId, name: categoryTemplate.name, color: categoryTemplate.color, icon: categoryTemplate.icon });
                  if (categoryTemplate.tags?.length){
                      console.log(`    Processing ${categoryTemplate.tags.length} tags for ${categoryTemplate.name}...`);
                      for (const tagTemplate of categoryTemplate.tags) {
                           tagsToAdd.push({ id: crypto.randomUUID(), categoryId: newCategoryId, name: tagTemplate.name, subtitles: tagTemplate.subtitles?.filter(s => typeof s === 'string'), keyword: tagTemplate.keyword, weight: tagTemplate.weight, color: tagTemplate.color });
                      }
                  }
              }
          }
      }
      console.log(`Bulk adding: ${groupsToAdd.length} groups, ${categoriesToAdd.length} categories, ${tagsToAdd.length} tags.`);
      await db.transaction('rw', db.groups, db.categories, db.tags, async () => {
          if (groupsToAdd.length > 0) await StorageService.bulkAddGroups(groupsToAdd);
          if (categoriesToAdd.length > 0) await StorageService.bulkAddCategories(categoriesToAdd);
          if (tagsToAdd.length > 0) await StorageService.bulkAddTags(tagsToAdd);
      });
      console.log("Bulk add complete.");
      if (targetLibraryId === currentLibraryId.value) { console.log("Reloading active library data..."); await loadDataForLibrary(targetLibraryId); } 
      else { console.log("Imported to inactive library."); }
      console.log(`✅ Import successful.`);
    } catch (error) { _handleError(error, `Import failed`); await loadDataForLibrary(currentLibraryId.value); } 
    finally { isLoading.value = false; }
  };
  const exportLibraryData = async (): Promise<TagStoreTemplate | null> => {
      if (!currentLibraryId.value || isLoading.value) { console.warn("Cannot export: No active library or store is busy."); return null; }
      console.log(`Exporting data for library ${currentLibraryId.value}...`);
      const libraryName = "Exported Library"; // Placeholder
      try {
          const exportedGroups: TemplateGroupData[] = [];
          const currentGroups = groups.value; const currentCategories = categories.value; const currentTags = tags.value; 
          for (const group of currentGroups) { 
              const groupCategories = currentCategories.filter(c => c.groupId === group.id);
              const exportedCategories: TemplateCategoryData[] = [];
              for (const category of groupCategories) {
                   const categoryTags = currentTags.filter(t => t.categoryId === category.id);
                   const exportedTags: TemplateTagData[] = categoryTags.map(tag => ({ name: tag.name, subtitles: tag.subtitles, keyword: tag.keyword, weight: tag.weight, color: tag.color }));
                   exportedCategories.push({ name: category.name, color: category.color, icon: category.icon, tags: exportedTags });
              }
              exportedGroups.push({ name: group.name, color: group.color, icon: group.icon, order: group.order, categories: exportedCategories });
          }
          const template: TagStoreTemplate = { $schema: "./tagstore_schema.json", version: "3.0", library: { name: libraryName, exportedAt: new Date().toISOString() }, groups: exportedGroups };
          console.log(`Export prepared with ${exportedGroups.length} groups.`); return template;
      } catch (error) { _handleError(error, "Failed to prepare export data"); return null; }
  };

  // --- Filtering Actions ---
  const updateSearchTerm = (term: string) => { searchTerm.value = term; };
  const setFilter = (groupId: string | null, categoryId: string | null) => {
      filterGroupId.value = groupId;
      filterCategoryId.value = categoryId;
      console.log(`Filter set: Group=${groupId}, Category=${categoryId}`);
  };

  // --- Getters ---
  const getGroups = computed(() => groups.value);
  const getCategories = computed(() => categories.value);
  const getTags = computed(() => tags.value);
  const getGroupById = computed(() => (id: string): Group | undefined => groups.value.find(g => g.id === id));
  const getCategoryById = computed(() => (id: string): Category | undefined => categories.value.find(c => c.id === id));
  const getTagById = computed(() => (id: string): Tag | undefined => tags.value.find(t => t.id === id));
  const getCategoriesByGroupId = computed(() => (groupId: string): Category[] => categories.value.filter(c => c.groupId === groupId));
  const getTagsByCategoryId = computed(() => (categoryId: string): Tag[] => tags.value.filter(t => t.categoryId === categoryId));
  const getTagsByGroupId = computed(() => (groupId: string): Tag[] => {
      const categoryIdsInGroup = categories.value.filter(c => c.groupId === groupId).map(c => c.id);
      return tags.value.filter(t => categoryIdsInGroup.includes(t.categoryId));
  });
  const filteredTags = computed(() => {
    let result = [...tags.value]; 
    if (filterGroupId.value) { const categoryIdsInGroup = categories.value.filter(c => c.groupId === filterGroupId.value).map(c => c.id); result = result.filter(t => categoryIdsInGroup.includes(t.categoryId)); }
    if (filterCategoryId.value && (!filterGroupId.value || categories.value.find(c => c.id === filterCategoryId.value)?.groupId === filterGroupId.value) ) { result = result.filter(t => t.categoryId === filterCategoryId.value); }
    if (searchTerm.value.trim()) {
      const lowerSearchTerm = searchTerm.value.trim().toLowerCase();
      result = result.filter((tag) => (tag.name.toLowerCase().includes(lowerSearchTerm) || tag.subtitles?.some((sub) => sub.toLowerCase().includes(lowerSearchTerm)) || tag.keyword?.toLowerCase().includes(lowerSearchTerm)));
    }
    return result;
  });
  const hierarchyData = computed(() => {
      const categoryMap = new Map<string, Category & { tags: Tag[] }>();
      categories.value.forEach(cat => { categoryMap.set(cat.id, { ...cat, tags: [] }); });
      tags.value.forEach(tag => { const category = categoryMap.get(tag.categoryId); if (category) { category.tags.push(tag); } });
      categoryMap.forEach(category => { category.tags.sort((a, b) => a.name.localeCompare(b.name)); });
      const groupMap = new Map<string, Group & { categories: (Category & { tags: Tag[] })[] }>();
      groups.value.forEach(group => { groupMap.set(group.id, { ...group, categories: [] }); });
      categoryMap.forEach(category => { const group = groupMap.get(category.groupId); if (group) { group.categories.push(category); } });
      groupMap.forEach(group => { group.categories.sort((a, b) => a.name.localeCompare(b.name)); });
      return Array.from(groupMap.values()).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
  });

  // --- Return ---
  return {
    // State
    currentLibraryId, groups, categories, tags, isLoading, currentError, searchTerm, filterGroupId, filterCategoryId, 
    // Getters
    getGroups, getCategories, getTags, getGroupById, getCategoryById, getTagById, getCategoriesByGroupId, getTagsByCategoryId, getTagsByGroupId, filteredTags, hierarchyData, 
    // Actions
    loadDataForLibrary, clearLocalState, addGroup, updateGroup, deleteGroup, addCategory, updateCategory, deleteCategory, addTag, updateTag, deleteTag, batchDeleteTags, batchMoveTags, importData, exportLibraryData, updateSearchTerm, setFilter, 
  };
}); 