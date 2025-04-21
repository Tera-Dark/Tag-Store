import { db } from './TagDatabase';
import type { Category, Tag } from '../types/data';
import { liveQuery } from 'dexie';

// === Category Operations ===

export const getAllCategories = () => {
  return db.categories.toArray();
};

export const getCategoryById = (id: string) => {
  return db.categories.get(id);
};

export const addCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
  // Simple validation (can be expanded)
  if (!category.name) throw new Error('Category name cannot be empty.');
  // Check for existing name (Dexie handles unique index errors too, but good to check)
  const existing = await db.categories.where('name').equalsIgnoreCase(category.name).first();
  if (existing) {
    throw new Error(`Category with name "${category.name}" already exists.`);
  }
  // Generate ID (using crypto.randomUUID for modern browsers)
  const id = crypto.randomUUID();
  const newCategory: Category = { ...category, id };
  await db.categories.add(newCategory);
  return id;
};

export const updateCategory = (id: string, changes: Partial<Omit<Category, 'id'>>) => {
  if (changes.name === '') throw new Error('Category name cannot be empty.');
  // TODO: Add check for name uniqueness if name is being changed
  return db.categories.update(id, changes);
};

export const deleteCategory = async (id: string) => {
  // IMPORTANT: Also delete all tags associated with this category
  // Dexie transactions ensure atomicity
  return db.transaction('rw', db.categories, db.tags, async () => {
    await db.tags.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  });
};

// === Tag Operations ===

export const getAllTags = () => {
  return db.tags.toArray();
};

export const getTagsByCategoryId = (categoryId: string) => {
  return db.tags.where('categoryId').equals(categoryId).toArray();
};

export const getTagById = (id: string) => {
  return db.tags.get(id);
};

export const addTag = async (tag: Omit<Tag, 'id'>): Promise<string> => {
  if (!tag.name) throw new Error('Tag name cannot be empty.');
  if (!tag.categoryId) throw new Error('Tag must belong to a category.');

  // Check for uniqueness within the category
  const existing = await db.tags
    .where({ categoryId: tag.categoryId, name: tag.name })
    .first(); // Dexie doesn't directly support compound ignoreCase, check manually if needed
  if (existing) {
    // Find category name for better error message
    const category = await getCategoryById(tag.categoryId);
    const categoryName = category ? category.name : tag.categoryId;
    throw new Error(`Tag "${tag.name}" already exists in category "${categoryName}".`);
  }

  const id = crypto.randomUUID();
  const newTag: Tag = { ...tag, id };
  await db.tags.add(newTag);
  return id;
};

export const updateTag = (id: string, changes: Partial<Omit<Tag, 'id'>>) => {
  if (changes.name === '') throw new Error('Tag name cannot be empty.');
  // TODO: Add check for name uniqueness within category if name or categoryId is changing
  return db.tags.update(id, changes);
};

export const deleteTag = (id: string) => {
  return db.tags.delete(id);
};

export const batchDeleteTags = (ids: string[]) => {
    return db.tags.bulkDelete(ids);
};

export const batchMoveTags = (ids: string[], targetCategoryId: string) => {
    return db.tags.where('id').anyOf(ids).modify({ categoryId: targetCategoryId });
};


// === Bulk Operations ===

export const clearAllData = () => {
    return db.transaction('rw', db.categories, db.tags, async () => {
        await db.tags.clear();
        await db.categories.clear();
    });
};

// Add multiple categories, ensuring name uniqueness
export const bulkAddCategories = (categoriesToAdd: Category[]) => {
    // Dexie's bulkAdd doesn't automatically handle conflicts based on secondary indexes before adding.
    // We might need to check names manually first or handle potential ConstraintErrors.
    // For simplicity here, we assume names are pre-validated or ConstraintError is handled upstream.
    return db.categories.bulkAdd(categoriesToAdd);
};

// Add multiple tags
export const bulkAddTags = (tagsToAdd: Tag[]) => {
    // Similar to categories, uniqueness checks ([categoryId, name]) are complex for bulkAdd.
    // Assuming pre-validation or upstream error handling.
    return db.tags.bulkAdd(tagsToAdd);
};

// === Live Queries (Example) ===
// Use liveQuery to create observables that update automatically when data changes

export const liveCategories = liveQuery(() => getAllCategories());
export const liveTags = liveQuery(() => getAllTags()); 