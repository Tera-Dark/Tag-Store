import { db } from './TagDatabase';
import type { Library, Category, Tag } from '../types/data';
import { liveQuery } from 'dexie';

// --- Type Definitions for Updates --- 
// (To avoid complex Partial<Omit<...>> issues)
type UpdatableLibraryData = Partial<Pick<Library, 'name'>>; // Only name is updatable for now
type UpdatableCategoryData = Partial<Pick<Category, 'name' | 'color' | 'icon'> >; 
type UpdatableTagData = Partial<Pick<Tag, 'categoryId' | 'name' | 'subtitles' | 'keyword' | 'weight' | 'color'> >;

// === Library Operations ===

export const getAllLibraries = (): Promise<Library[]> => {
  return db.libraries.toArray();
};

export const addLibrary = (libraryData: Omit<Library, 'id'>): Promise<string> => {
  const newId = crypto.randomUUID();
  const newLibrary: Library = { ...libraryData, id: newId, createdAt: new Date().toISOString() };
  return db.libraries.add(newLibrary).then(() => newId); // Return the new ID
};

export const getLibraryById = (id: string): Promise<Library | undefined> => {
    return db.libraries.get(id);
};

export const updateLibrary = (id: string, changes: UpdatableLibraryData): Promise<number> => {
    return db.libraries.update(id, changes);
};

export const deleteLibrary = async (libraryId: string): Promise<void> => {
    // Transaction to delete library and all its contents
    return db.transaction('rw', db.libraries, db.categories, db.tags, async () => {
        // 1. Delete tags of the library
        await db.tags.where('libraryId').equals(libraryId).delete();
        // 2. Delete categories of the library
        await db.categories.where('libraryId').equals(libraryId).delete();
        // 3. Delete the library itself
        await db.libraries.delete(libraryId);
    });
};

// === Category Operations ===

export const getAllCategories = (libraryId: string): Promise<Category[]> => {
  if (!libraryId) return Promise.resolve([]); // Return empty if no library specified
  return db.categories.where('libraryId').equals(libraryId).sortBy('name');
};

export const getCategoryById = (id: string): Promise<Category | undefined> => {
    // Note: We don't filter by libraryId here, assuming ID is globally unique.
    // If needed, libraryId could be passed and added to the query.
    return db.categories.get(id);
};

export const addCategory = (categoryData: Omit<Category, 'id' | 'libraryId'>, libraryId: string): Promise<string> => {
  if (!libraryId) return Promise.reject(new Error("Library ID is required to add a category."));
  const newId = crypto.randomUUID();
  const newCategory: Category = { ...categoryData, id: newId, libraryId };
  return db.categories.add(newCategory).then(() => newId);
};

export const updateCategory = (id: string, changes: UpdatableCategoryData): Promise<number> => {
    return db.categories.update(id, changes);
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
    const category = await db.categories.get(categoryId);
    if (!category) return; // Category doesn't exist

    const libraryId = category.libraryId; // Get the libraryId

    return db.transaction('rw', db.categories, db.tags, async () => {
        // Delete tags belonging to this category AND this library
        await db.tags.where({ categoryId: categoryId, libraryId: libraryId }).delete();
        // Delete the category itself
        await db.categories.delete(categoryId);
    });
};

// === Tag Operations ===

export const getAllTags = (libraryId: string): Promise<Tag[]> => {
    if (!libraryId) return Promise.resolve([]);
    return db.tags.where('libraryId').equals(libraryId).toArray();
    // Optional: Add sorting .sortBy('name') ?
};

export const getTagById = (id: string): Promise<Tag | undefined> => {
    // Again, assuming ID is globally unique
    return db.tags.get(id);
};

export const addTag = (tagData: Omit<Tag, 'id' | 'libraryId'>, libraryId: string): Promise<string> => {
    if (!libraryId) return Promise.reject(new Error("Library ID is required to add a tag."));
    const newId = crypto.randomUUID();
    const newTag: Tag = { ...tagData, id: newId, libraryId };
    return db.tags.add(newTag).then(() => newId);
};

export const updateTag = (id: string, changes: UpdatableTagData): Promise<number> => {
    return db.tags.update(id, changes);
};

export const deleteTag = (tagId: string): Promise<void> => {
    return db.tags.delete(tagId);
};

export const batchDeleteTags = (tagIds: string[]): Promise<void> => {
    // Dexie's bulkDelete handles arrays of primary keys directly
    return db.tags.bulkDelete(tagIds);
};

export const batchMoveTags = (tagIds: string[], targetCategoryId: string): Promise<number> => {
    // We don't need libraryId here because update doesn't change it,
    // but the calling logic in the store MUST ensure targetCategoryId belongs to the same library.
    return db.tags.where('id').anyOf(tagIds).modify({ categoryId: targetCategoryId });
};

// === Bulk Operations ===

export const clearLibraryData = async (libraryId: string): Promise<void> => {
   return db.transaction('rw', db.categories, db.tags, async () => {
        await db.tags.where('libraryId').equals(libraryId).delete();
        await db.categories.where('libraryId').equals(libraryId).delete();
        // Optionally also delete the library entry itself? Depends on use case.
        // await db.libraries.delete(libraryId); 
    });
};

export const clearAllData = async (): Promise<void> => {
    // This is dangerous in a multi-library context. Consider removing or restricting.
    console.warn("Clearing ALL data from the database!");
    return db.transaction('rw', db.libraries, db.categories, db.tags, async () => {
        await db.tags.clear();
        await db.categories.clear();
        await db.libraries.clear();
    });
};

// Add multiple categories, ensuring name uniqueness
export const bulkAddCategories = (categories: Category[]): Promise<string[]> => {
    // Assumes categories array already has correct libraryId set
    return db.categories.bulkAdd(categories, { allKeys: true }) as Promise<string[]>;
};

// Add multiple tags
export const bulkAddTags = (tags: Tag[]): Promise<string[]> => {
    // Assumes tags array already has correct libraryId set
    return db.tags.bulkAdd(tags, { allKeys: true }) as Promise<string[]>;
};

// === Live Queries (Example) ===
// Use liveQuery to create observables that update automatically when data changes

export const liveCategories = liveQuery(() => getAllCategories(''));
export const liveTags = liveQuery(() => getAllTags('')); 