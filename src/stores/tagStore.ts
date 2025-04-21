import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Category, Tag, TagStoreTemplate } from '../types/data';
import * as StorageService from '../services/StorageService'; // Import our service
import { db } from '../services/TagDatabase'; // Import db instance directly for transaction usage

export const useTagStore = defineStore('tagStore', () => {
  // --- State ---
  const categories = ref<Category[]>([]);
  const tags = ref<Tag[]>([]);
  const isLoading = ref<boolean>(false);
  const currentError = ref<string | null>(null);
  const currentLibraryInfo = ref<{ id: string; name: string } | null>(null); // Basic info about loaded lib
  const searchTerm = ref<string>('');
  const filterCategoryId = ref<string | null>(null); // null means show all categories

  // --- Getters (Computed) ---
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
    return (id: string): string | undefined => {
      return categories.value.find((cat) => cat.id === id)?.name;
    };
  });

  // --- Actions ---

  // Helper to handle errors consistently
  const _handleError = (error: any, message: string) => {
    console.error(`${message}:`, error);
    currentError.value = error?.message || message;
    throw error; // Re-throw for component-level handling if needed
  };

  // Load initial data from IndexedDB or default template
  const initializeStore = async () => {
    isLoading.value = true;
    currentError.value = null;
    try {
      let loadedCategories = await StorageService.getAllCategories();
      let loadedTags = await StorageService.getAllTags();

      // If DB is empty, try loading the default template
      if (loadedCategories.length === 0 && loadedTags.length === 0) {
        console.log('Local database is empty, attempting to load default template...');
        try {
          await loadTemplateFromJson('/templates/default.json', false); // Load default, don't clear existing (already empty)
          // Re-fetch after loading default
          loadedCategories = await StorageService.getAllCategories();
          loadedTags = await StorageService.getAllTags();
        } catch (loadError) {
          _handleError(loadError, 'Failed to load default template');
          // Proceed with empty state if default loading fails
        }
      }

      categories.value = loadedCategories;
      tags.value = loadedTags;
      categories.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted after load
      // TODO: Set currentLibraryInfo
    } catch (error) {
      _handleError(error, 'Failed to initialize tag store');
      categories.value = [];
      tags.value = [];
    } finally {
      isLoading.value = false;
    }
  };

   // Load and process data from a JSON template URL
  const loadTemplateFromJson = async (url: string, clearExisting: boolean = true) => {
    isLoading.value = true;
    currentError.value = null;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }
      const templateData: TagStoreTemplate = await response.json();

      // --- Processing --- 
      const categoriesToAdd: Category[] = [];
      const categoryNameMap = new Map<string, string>(); // Map name to new ID
      const existingCategoriesLower = new Map(categories.value.map(c => [c.name.toLowerCase(), c]));

      // 1. Process categories
      for (const cat of templateData.categories) {
        const existing = existingCategoriesLower.get(cat.name.toLowerCase());
        if (!existing || !clearExisting) { // Only add if not exists or not clearing
            const id = crypto.randomUUID();
            categoriesToAdd.push({ ...cat, id });
            categoryNameMap.set(cat.name, id);
        } else {
            categoryNameMap.set(existing.name, existing.id); // Use existing ID
        }
      }

      // 2. Process tags
      const tagsToAdd: Tag[] = [];
      const existingTags = new Map(tags.value.map(t => [`${t.categoryId}-${t.name.toLowerCase()}`, t]));

      for (const tagData of templateData.tags) {
          // Destructure to help TS infer types and access properties correctly
          const { categoryName, name, subtitles, keyword, ...rest } = tagData;
          const categoryId = categoryNameMap.get(categoryName);

          if (categoryId && name) { // Also check if name exists
              const tagKey = `${categoryId}-${name.toLowerCase()}`;
              const alreadyExistsInBatch = tagsToAdd.some(t => t.categoryId === categoryId && t.name.toLowerCase() === name.toLowerCase());
              const alreadyExistsInStore = !clearExisting && existingTags.has(tagKey);
              
              if (!alreadyExistsInBatch && !alreadyExistsInStore) {
                   const id = crypto.randomUUID();
                   // Construct the full Tag object
                   const newTag: Tag = {
                       id,
                       categoryId,
                       name,
                       subtitles,
                       keyword,
                       ...rest // Include any other properties like weight, color if they exist
                   };
                   tagsToAdd.push(newTag);
              } else {
                  console.warn(`Skipping duplicate tag "${name}" in category "${categoryName}" during import.`);
              }
          } else if (!categoryId) {
              console.warn(`Category "${categoryName}" not found for tag "${name || '[Unnamed Tag]'}". Skipping tag.`);
          } else {
              console.warn(`Skipping tag without a name in category "${categoryName}".`);
          }
      }

      // --- Persistence --- 
      await db.transaction('rw', db.categories, db.tags, async () => {
          if (clearExisting) {
              await StorageService.clearAllData(); // Still use service for clear logic if preferred
          }
          if (categoriesToAdd.length > 0) {
              await StorageService.bulkAddCategories(categoriesToAdd);
          }
          if (tagsToAdd.length > 0) {
              await StorageService.bulkAddTags(tagsToAdd);
          }
      });

      // --- Update State --- 
      const [finalCategories, finalTags] = await Promise.all([
          StorageService.getAllCategories(),
          StorageService.getAllTags(),
      ]);
      categories.value = finalCategories;
      tags.value = finalTags;
      categories.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
      currentLibraryInfo.value = { id: url, name: templateData.metadata?.name || url };

    } catch (error) {
      _handleError(error, `Failed to load template from ${url}`);
    } finally {
      isLoading.value = false;
    }
  };

  // Add a new category
  const addCategory = async (categoryData: Omit<Category, 'id'>) => {
    currentError.value = null;
    try {
      const newId = await StorageService.addCategory(categoryData);
      const newCategory = await StorageService.getCategoryById(newId);
      if (newCategory) {
        categories.value.push(newCategory);
        categories.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
      }
      return newId;
    } catch (error) {
      _handleError(error, 'Failed to add category');
    }
  };

  // Update an existing category
  const updateCategory = async (id: string, changes: Partial<Omit<Category, 'id'>>) => {
    currentError.value = null;
    try {
      await StorageService.updateCategory(id, changes);
      const index = categories.value.findIndex((cat) => cat.id === id);
      if (index !== -1) {
        categories.value[index] = { ...categories.value[index], ...changes };
        categories.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
      }
    } catch (error) {
        _handleError(error, 'Failed to update category');
    }
  };

  // Delete a category (and its tags)
  const deleteCategory = async (id: string) => {
    currentError.value = null;
    try {
      await StorageService.deleteCategory(id);
      categories.value = categories.value.filter((cat) => cat.id !== id);
      tags.value = tags.value.filter((tag) => tag.categoryId !== id);
    } catch (error) {
       _handleError(error, 'Failed to delete category');
    }
  };

  // Add a new tag
  const addTag = async (tagData: Omit<Tag, 'id'>) => {
    currentError.value = null;
    try {
      const newId = await StorageService.addTag(tagData);
      const newTag = await StorageService.getTagById(newId);
      if (newTag) {
        tags.value.push(newTag);
        // Keep tags sorted? Maybe by name within category? Requires more complex sorting.
      }
      return newId;
    } catch (error) {
        _handleError(error, 'Failed to add tag');
    }
  };

  // Update an existing tag
   const updateTag = async (id: string, changes: Partial<Omit<Tag, 'id'>>) => {
    currentError.value = null;
    try {
      await StorageService.updateTag(id, changes);
      const index = tags.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        tags.value[index] = { ...tags.value[index], ...changes };
      }
    } catch (error) {
       _handleError(error, 'Failed to update tag');
    }
  };

  // Delete a tag
  const deleteTag = async (id: string) => {
    currentError.value = null;
    try {
      await StorageService.deleteTag(id);
      tags.value = tags.value.filter((tag) => tag.id !== id);
    } catch (error) {
        _handleError(error, 'Failed to delete tag');
    }
  };

  // Delete multiple tags
  const batchDeleteTags = async (ids: string[]) => {
      currentError.value = null;
      try {
          await StorageService.batchDeleteTags(ids);
          tags.value = tags.value.filter((tag) => !ids.includes(tag.id));
      } catch (error) {
         _handleError(error, 'Failed to batch delete tags');
      }
  };

  // Move multiple tags to a different category
  const batchMoveTags = async (ids: string[], targetCategoryId: string) => {
      currentError.value = null;
      try {
          await StorageService.batchMoveTags(ids, targetCategoryId);
          tags.value.forEach((tag) => {
              if (ids.includes(tag.id)) {
                  tag.categoryId = targetCategoryId;
              }
          });
      } catch (error) {
         _handleError(error, 'Failed to batch move tags');
      }
  };

  // Update search term
  const updateSearchTerm = (term: string) => {
    searchTerm.value = term;
  };

  // Set category filter
  const setFilterCategory = (categoryId: string | null) => {
    filterCategoryId.value = categoryId;
  };

  // TODO: Add actions for updateCategory, updateTag, batch operations, import/export, etc.

  // --- Return state, getters, and actions ---
  return {
    // State
    categories,
    tags,
    isLoading,
    currentError,
    currentLibraryInfo,
    searchTerm,
    filterCategoryId,
    // Getters
    allCategories,
    allTags,
    filteredTags,
    getCategoryNameById,
    // Actions
    initializeStore,
    loadTemplateFromJson,
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
  };
}); 