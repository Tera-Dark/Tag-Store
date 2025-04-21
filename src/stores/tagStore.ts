import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Category, Tag, TagStoreTemplate, TemplateTagData, Library } from '../types/data';
import * as StorageService from '../services/StorageService'; // Import our service
import { db } from '../services/TagDatabase'; // Import db instance directly for transaction usage
import { useLibraryStore } from './libraryStore'; // Import library store

export const useTagStore = defineStore('tagStore', () => {
  // Inject Library Store
  const libraryStore = useLibraryStore();

  // --- State (Now specific to the active library) ---
  const categories = ref<Category[]>([]);
  const tags = ref<Tag[]>([]);
  const isLoading = ref<boolean>(false); // Loading state for tags/categories
  const currentError = ref<string | null>(null);
  const searchTerm = ref<string>('');
  const filterCategoryId = ref<string | null>(null); // null means show all categories

  // --- Getters (Computed - Implicitly filtered by state which is library-specific) ---
  const allCategories = computed(() => categories.value);
  const allTags = computed(() => tags.value);

  // Filtered tags based on search term and selected category
  const filteredTags = computed(() => {
    let result = tags.value;

    // Filter by category if one is selected
    if (filterCategoryId.value) {
      result = result.filter((tag) => tag.categoryId === filterCategoryId.value);
    }

    // Filter by search term (case-insensitive search in name, subtitles, and keyword)
    if (searchTerm.value.trim()) {
      const lowerSearchTerm = searchTerm.value.trim().toLowerCase();
      result = result.filter((tag) => {
        const nameMatch = tag.name.toLowerCase().includes(lowerSearchTerm);
        const subtitleMatch = tag.subtitles?.some((sub) =>
          sub.toLowerCase().includes(lowerSearchTerm)
        );
        // Add keyword check (optional chaining ?. because keyword is optional)
        const keywordMatch = tag.keyword?.toLowerCase().includes(lowerSearchTerm);
        return nameMatch || subtitleMatch || keywordMatch; // Include keywordMatch here
      });
    }

    return result;
  });

  // Get category name by ID (useful for display)
  const getCategoryNameById = computed(() => {
    // Operates on the current library's categories
    return (id: string): string | undefined => {
      return categories.value.find((cat) => cat.id === id)?.name;
    };
  });

  // --- Actions (Now library-aware) ---

  // Helper to handle errors consistently
  const _handleError = (error: any, message: string) => {
    console.error(`${message}:`, error);
    currentError.value = error?.message || message;
    // No throw here
  };

  // Initialize store FOR THE CURRENT ACTIVE LIBRARY
  const initializeStore = async () => {
    const activeLibId = libraryStore.activeLibraryId;
    if (!activeLibId) {
      console.warn('initializeStore called with no active library.');
      clearLocalState();
      return;
    }
    console.log(`Initializing tag store for library: ${activeLibId}`);
    isLoading.value = true;
    currentError.value = null;
    let isEmptyLibrary = false; // Flag to check if library is empty
    try {
      // Fetch data for the specific library
      const [loadedCategories, loadedTags] = await Promise.all([
        StorageService.getAllCategories(activeLibId),
        StorageService.getAllTags(activeLibId)
      ]);
      categories.value = loadedCategories;
      tags.value = loadedTags;

      // Sorting is already done in StorageService for categories
    } catch (error) {
      _handleError(error, `Failed to initialize tag store for library ${activeLibId}`);
      clearLocalState();
    } finally {
      isLoading.value = false;
    }
  };

   // Load default template - This might need rethinking. 
   // Should it load into the *current* library? Or only if DB is totally empty?
   // Let's make it load into the current library if it's empty.
  const loadDefaultTemplateIfEmpty = async () => {
      const activeLibId = libraryStore.activeLibraryId;
      if (!activeLibId) return;

      // Check if the *current* library is empty
       if (categories.value.length === 0 && tags.value.length === 0) {
            console.log(`Library ${activeLibId} is empty, attempting to load default template...`);
            try {
                const response = await fetch('/templates/default.json');
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const templateData: TagStoreTemplate = await response.json();
                // Import into the current library, merging (shouldn't conflict if empty)
                await importData(templateData, false); 
            } catch (loadError) {
                 _handleError(loadError, '加载默认模板失败');
            }
       }
  };

  // --- Import Action (Imports into the *active* library) ---
  const importData = async (templateData: TagStoreTemplate, clearExisting: boolean) => {
    const activeLibId = libraryStore.activeLibraryId;
    if (!activeLibId) {
       _handleError(new Error("No active library selected"), "Import failed");
       return;
    }
    // Optional: Check if templateData.library.name matches active library name?

    isLoading.value = true;
    currentError.value = null;
    try {
      const categoriesToAdd: Category[] = [];
      const categoryNameMap = new Map<string, string>();
      
      // Get existing data for the *active* library if merging
      const existingCategories = clearExisting ? [] : await StorageService.getAllCategories(activeLibId);
      const existingTags = clearExisting ? [] : await StorageService.getAllTags(activeLibId);
      const existingCategoriesLower = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]));
      const existingTagsMap = new Map(existingTags.map(t => [`${t.categoryId}-${t.name.toLowerCase()}`, t]));

      // 1. Process categories
      for (const catData of templateData.categories) {
        const existing = existingCategoriesLower.get(catData.name.toLowerCase());
        if (!existing) {
            const id = crypto.randomUUID();
            // Add libraryId when creating the object for the DB
            const newCategory: Category = { ...catData, id, libraryId: activeLibId }; 
            categoriesToAdd.push(newCategory);
            categoryNameMap.set(catData.name, id); 
        } else if (!clearExisting) {
            categoryNameMap.set(existing.name, existing.id); 
        } else { // Replacing
             const id = crypto.randomUUID();
             // Add libraryId here too
             const newCategory: Category = { ...catData, id, libraryId: activeLibId }; 
             categoriesToAdd.push(newCategory);
             categoryNameMap.set(catData.name, id); 
        }
      }

      // 2. Process tags
      const tagsToAdd: Tag[] = [];
      for (const tagData of templateData.tags) {
          const { categoryName, name, subtitles, keyword, weight, color } = tagData;
          const categoryId = categoryNameMap.get(categoryName);

          if (categoryId && name) {
              const tagKey = `${categoryId}-${name.toLowerCase()}`;
              const alreadyExistsInBatch = tagsToAdd.some(t => t.categoryId === categoryId && t.name.toLowerCase() === name.toLowerCase());
              const alreadyExistsInStore = !clearExisting && existingTagsMap.has(tagKey);
              
              if (!alreadyExistsInBatch && !alreadyExistsInStore) {
                   const id = crypto.randomUUID();
                   const cleanedSubtitles = Array.isArray(subtitles) ? subtitles.filter(s => typeof s === 'string') : undefined;
                   // Add libraryId when creating the object
                   const newTag: Tag = {
                       id,
                       libraryId: activeLibId, // Add libraryId
                       categoryId,
                       name,
                       subtitles: cleanedSubtitles,
                       keyword: typeof keyword === 'string' ? keyword : undefined,
                       weight: typeof weight === 'number' ? weight : undefined,
                       color: typeof color === 'string' ? color : undefined,
                   };
                   tagsToAdd.push(newTag);
              }
          }
      }

      // --- Persistence ---
      await db.transaction('rw', db.categories, db.tags, async () => {
          if (clearExisting) {
              // Clear only the active library's data
              await StorageService.clearLibraryData(activeLibId); 
          }
          if (categoriesToAdd.length > 0) {
              await StorageService.bulkAddCategories(categoriesToAdd);
          }
          if (tagsToAdd.length > 0) {
              await StorageService.bulkAddTags(tagsToAdd);
          }
      });

      // --- Update State by re-fetching for the active library ---
      await initializeStore(); // Re-initialize to load fresh data

    } catch (error) {
      _handleError(error, 'Failed to import data');
    } finally {
      isLoading.value = false;
    }
  };

  // --- Export Action (Exports the *active* library) ---
  const exportDataAsJson = async (): Promise<string> => {
    const activeLibId = libraryStore.activeLibraryId;
    const activeLib = libraryStore.activeLibrary;
    if (!activeLibId || !activeLib) {
         _handleError(new Error("No active library to export"), "Export failed");
         throw new Error("No active library to export"); // Throw to stop download trigger
    }

    try {
        const currentCategories = await StorageService.getAllCategories(activeLibId);
        const currentTags = await StorageService.getAllTags(activeLibId);
        const categoryMap = new Map(currentCategories.map(cat => [cat.id, cat]));

        const exportData: TagStoreTemplate = {
            library: { // Use new structure
                name: activeLib.name,
                exportedAt: new Date().toISOString(),
            },
            // Omit id AND libraryId for categories
            categories: currentCategories.map(({ id, libraryId, ...rest }) => rest), 
            tags: currentTags.map(tag => {
                const category = categoryMap.get(tag.categoryId);
                // Omit id and libraryId, add categoryName
                const { id, libraryId, categoryId, ...rest } = tag; 
                const templateTag: TemplateTagData = {
                    ...rest,
                    categoryName: category?.name || "Unknown Category",
                };
                return templateTag;
            })
        };
        return JSON.stringify(exportData, null, 2);
    } catch (error) {
         _handleError(error, 'Failed to prepare data for export');
         throw error; 
    }
  };

  // --- CRUD Actions (Now operate on the active library) ---

  const addCategory = async (categoryData: Omit<Category, 'id' | 'libraryId'>) => {
    const activeLibId = libraryStore.activeLibraryId;
    if (!activeLibId) return _handleError(new Error("No active library"), "Add Category failed");
    currentError.value = null;
    try {
      // Pass libraryId to storage service
      const newId = await StorageService.addCategory(categoryData, activeLibId);
      // Re-fetch to update local state (or push manually)
      await initializeStore(); 
      return newId;
    } catch (error) { _handleError(error, 'Failed to add category'); }
  };

  const updateCategory = async (id: string, changes: Partial<Omit<Category, 'id' | 'libraryId'>>) => {
     // libraryId check might be needed if changes could include it, but our type prevents it.
    currentError.value = null;
    try {
      await StorageService.updateCategory(id, changes); // ID is unique, no libraryId needed for update itself
      await initializeStore(); 
    } catch (error) { _handleError(error, 'Failed to update category'); }
  };

  const deleteCategory = async (id: string) => {
    currentError.value = null;
    try {
      await StorageService.deleteCategory(id); // deleteCategory in service handles associated tags
      await initializeStore(); 
    } catch (error) { _handleError(error, 'Failed to delete category'); }
  };

  const addTag = async (tagData: Omit<Tag, 'id' | 'libraryId'>) => {
    const activeLibId = libraryStore.activeLibraryId;
    if (!activeLibId) return _handleError(new Error("No active library"), "Add Tag failed");
    // Ensure categoryId belongs to the active library (optional, but good practice)
    if (tagData.categoryId && !categories.value.some(c => c.id === tagData.categoryId)){
        return _handleError(new Error(`Category ID ${tagData.categoryId} not found in active library`), "Add Tag failed");
    }
    currentError.value = null;
    try {
      const newId = await StorageService.addTag(tagData, activeLibId);
      await initializeStore(); 
      return newId;
    } catch (error) { _handleError(error, 'Failed to add tag'); }
  };

  const updateTag = async (id: string, changes: Partial<Omit<Tag, 'id' | 'libraryId'>>) => {
    // Ensure target categoryId (if changed) belongs to the active library
     if (changes.categoryId && !categories.value.some(c => c.id === changes.categoryId)){
        return _handleError(new Error(`Target Category ID ${changes.categoryId} not found in active library`), "Update Tag failed");
    }
    currentError.value = null;
    try {
      await StorageService.updateTag(id, changes);
      await initializeStore();
    } catch (error) { _handleError(error, 'Failed to update tag'); }
  };

  const deleteTag = async (id: string) => {
    currentError.value = null;
    try {
      await StorageService.deleteTag(id);
      await initializeStore();
    } catch (error) { _handleError(error, 'Failed to delete tag'); }
  };

  const batchDeleteTags = async (ids: string[]) => {
      currentError.value = null;
      try {
          await StorageService.batchDeleteTags(ids);
          await initializeStore();
      } catch (error) { _handleError(error, 'Failed to batch delete tags'); }
  };

  const batchMoveTags = async (ids: string[], targetCategoryId: string) => {
      // Ensure target category belongs to the active library
       if (!categories.value.some(c => c.id === targetCategoryId)){
          return _handleError(new Error(`Target Category ID ${targetCategoryId} not found in active library`), "Batch Move failed");
      }
      currentError.value = null;
      try {
          await StorageService.batchMoveTags(ids, targetCategoryId);
          await initializeStore();
      } catch (error) { _handleError(error, 'Failed to batch move tags'); }
  };

  // --- Other Actions ---
  const updateSearchTerm = (term: string) => { searchTerm.value = term; };
  const setFilterCategory = (categoryId: string | null) => { filterCategoryId.value = categoryId; };

  // Clear local state (used when switching to no library)
  const clearLocalState = () => {
      console.log("Clearing local tag store state...");
      categories.value = [];
      tags.value = [];
      filterCategoryId.value = null;
      searchTerm.value = '';
      currentError.value = null;
  };

  // --- Return ---
  return {
    // State
    categories,
    tags,
    isLoading,
    currentError,
    searchTerm,
    filterCategoryId,
    // Getters
    allCategories,
    allTags,
    filteredTags,
    getCategoryNameById,
    // Actions
    initializeStore,
    loadDefaultTemplateIfEmpty, // Renamed from loadTemplateFromJson for clarity
    addCategory,
    updateCategory,
    deleteCategory,
    addTag,
    updateTag,
    deleteTag,
    batchDeleteTags,
    batchMoveTags,
    updateSearchTerm,
    setFilterCategory,
    exportDataAsJson, 
    importData, 
    clearLocalState, 
  };
}); 