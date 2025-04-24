import { db } from './TagDatabase';
import type { Library, Category, Tag, Group } from '../types/data';

// --- Type Definitions for Updates --- 
// (To avoid complex Partial<Omit<...>> issues)
type UpdatableLibraryData = Partial<Pick<Library, 'name'>>; // Only name is updatable for now
type UpdatableCategoryData = Partial<Pick<Category, 'name' | 'color' | 'icon'> >; 
type UpdatableTagData = Partial<Pick<Tag, 'categoryId' | 'name' | 'subtitles' | 'keyword' | 'weight' | 'color'> >;

// 模板相关接口
export interface TemplateInfo {
  name: string;      // 模板名称
  path: string;      // 模板路径 (相对路径 in /public)
  description?: string; // 模板描述
}

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
    // Transaction to delete library and all its groups, categories, and tags
    return db.transaction('rw', db.libraries, db.groups, db.categories, db.tags, async () => {
        // 1. Find groups belonging to the library
        const groupsToDelete = await db.groups.where('libraryId').equals(libraryId).toArray();
        const groupIdsToDelete = groupsToDelete.map(g => g.id);
        console.log(`Found ${groupIdsToDelete.length} groups to delete for library ${libraryId}`);

        // 2. Find categories belonging to these groups
        let categoryIdsToDelete: string[] = [];
        if (groupIdsToDelete.length > 0) {
            const categoriesToDelete = await db.categories.where('groupId').anyOf(groupIdsToDelete).toArray();
            categoryIdsToDelete = categoriesToDelete.map(c => c.id);
            console.log(`Found ${categoryIdsToDelete.length} categories to delete for library ${libraryId}`);
        }

        // 3. Delete tags belonging to these categories
        if (categoryIdsToDelete.length > 0) {
            const deletedTagsCount = await db.tags.where('categoryId').anyOf(categoryIdsToDelete).delete();
            console.log(`Deleted ${deletedTagsCount} tags for library ${libraryId}`);
        }

        // 4. Delete the categories themselves
        if (categoryIdsToDelete.length > 0) {
            await db.categories.bulkDelete(categoryIdsToDelete);
            console.log(`Deleted ${categoryIdsToDelete.length} categories for library ${libraryId}`);
        }

        // 5. Delete the groups themselves
        if (groupIdsToDelete.length > 0) {
            await db.groups.bulkDelete(groupIdsToDelete);
             console.log(`Deleted ${groupIdsToDelete.length} groups for library ${libraryId}`);
        }

        // 6. Delete the library itself
        await db.libraries.delete(libraryId);
         console.log(`Deleted library ${libraryId}`);
    });
};

// === Group Operations ===

export const getAllGroups = (libraryId: string): Promise<Group[]> => {
  if (!libraryId) return Promise.resolve([]);
  return db.groups.where('libraryId').equals(libraryId).sortBy('order'); // Sort by order
};

export const getGroupById = (id: string): Promise<Group | undefined> => {
  return db.groups.get(id);
};

export const addGroup = (groupData: Omit<Group, 'id' | 'libraryId'>, libraryId: string): Promise<string> => {
  if (!libraryId) return Promise.reject(new Error("Library ID is required to add a group."));
  const newId = crypto.randomUUID();
  // Ensure order is set if not provided
  const order = typeof groupData.order === 'number' ? groupData.order : Date.now(); 
  const newGroup: Group = { ...groupData, id: newId, libraryId, order };
  return db.groups.add(newGroup).then(() => newId);
};

export const updateGroup = (id: string, changes: Partial<Omit<Group, 'id' | 'libraryId'>>): Promise<number> => {
  return db.groups.update(id, changes);
};

// Deleting a group also deletes its categories and their tags
export const deleteGroup = async (groupId: string): Promise<void> => {
    return db.transaction('rw', db.groups, db.categories, db.tags, async () => {
        // 1. Find categories belonging to the group
        const categoriesToDelete = await db.categories.where('groupId').equals(groupId).toArray();
        const categoryIdsToDelete = categoriesToDelete.map(cat => cat.id);
        
        // 2. Delete tags belonging to these categories
        if (categoryIdsToDelete.length > 0) {
            await db.tags.where('categoryId').anyOf(categoryIdsToDelete).delete();
            console.log(`Deleted tags for ${categoryIdsToDelete.length} categories in group ${groupId}`);
        }
        
        // 3. Delete the categories themselves
        if (categoryIdsToDelete.length > 0) {
            await db.categories.bulkDelete(categoryIdsToDelete);
            console.log(`Deleted ${categoryIdsToDelete.length} categories in group ${groupId}`);
        }
        
        // 4. Delete the group itself
        await db.groups.delete(groupId);
        console.log(`Deleted group ${groupId}`);
    });
};

// === Category Operations ===

export const getAllCategories = (groupId: string): Promise<Category[]> => {
  if (!groupId) return Promise.resolve([]);
  // Use the groupId index
  return db.categories.where('groupId').equals(groupId).sortBy('name'); 
};

export const getCategoriesByGroupIds = (groupIds: string[]): Promise<Category[]> => {
  if (!groupIds || groupIds.length === 0) return Promise.resolve([]);
  // Use the groupId index with anyOf for efficiency
  return db.categories.where('groupId').anyOf(groupIds).sortBy('name');
};

export const getCategoryById = (id: string): Promise<Category | undefined> => {
    // Unchanged: assumes ID is globally unique
    return db.categories.get(id);
};

export const addCategory = (categoryData: Omit<Category, 'id' | 'groupId'>, groupId: string): Promise<string> => {
  if (!groupId) return Promise.reject(new Error("Group ID is required to add a category."));
  const newId = crypto.randomUUID();
  const newCategory: Category = { ...categoryData, id: newId, groupId }; // Add groupId
  return db.categories.add(newCategory).then(() => newId);
};

export const updateCategory = (id: string, changes: UpdatableCategoryData): Promise<number> => {
    return db.categories.update(id, changes);
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
    // const category = await db.categories.get(categoryId);
    // if (!category) return; // Category doesn't exist
    // const groupId = category.groupId; // No longer needed for deletion logic here

    return db.transaction('rw', db.categories, db.tags, async () => {
        // Delete tags belonging to this category
        await db.tags.where({ categoryId: categoryId }).delete();
        // Delete the category itself
        await db.categories.delete(categoryId);
    });
};

// === Tag Operations ===

export const getAllTags = (categoryId: string): Promise<Tag[]> => {
    if (!categoryId) return Promise.resolve([]);
    return db.tags.where('categoryId').equals(categoryId).toArray();
    // Optional: Add sorting .sortBy('name') ?
};

export const getTagsByCategoryIds = (categoryIds: string[]): Promise<Tag[]> => {
    if (!categoryIds || categoryIds.length === 0) return Promise.resolve([]);
    // Use the categoryId index with anyOf for efficiency
    return db.tags.where('categoryId').anyOf(categoryIds).sortBy('name'); 
};

export const getTagById = (id: string): Promise<Tag | undefined> => {
    // Unchanged: assumes ID is globally unique
    return db.tags.get(id);
};

export const addTag = (tagData: Omit<Tag, 'id'>): Promise<string> => {
    // Removed libraryId check
    // Category ID check should happen in the store based on loaded categories
    const newId = crypto.randomUUID();
    const newTag: Tag = { ...tagData, id: newId }; // No libraryId needed
    return db.tags.add(newTag).then(() => newId);
};

export const updateTag = (id: string, changes: UpdatableTagData): Promise<number> => {
    return db.tags.update(id, changes);
};

export const deleteTag = (tagId: string): Promise<void> => {
    return db.tags.delete(tagId);
};

export const batchDeleteTags = (tagIds: string[]): Promise<void> => {
    return db.tags.bulkDelete(tagIds);
};

export const batchMoveTags = (tagIds: string[], targetCategoryId: string): Promise<number> => {
    return db.tags.where('id').anyOf(tagIds).modify({ categoryId: targetCategoryId });
};

// === Bulk Operations ===

export const clearLibraryData = async (libraryId: string): Promise<void> => {
   return db.transaction('rw', db.groups, db.categories, db.tags, async () => {
        // 1. Find groups belonging to the library
        const groupsToDelete = await db.groups.where('libraryId').equals(libraryId).toArray();
        const groupIdsToDelete = groupsToDelete.map(g => g.id);
        console.log(`Found ${groupIdsToDelete.length} groups to clear data from for library ${libraryId}`);

        // 2. Find categories belonging to these groups
        let categoryIdsToDelete: string[] = [];
        if (groupIdsToDelete.length > 0) {
            const categoriesToDelete = await db.categories.where('groupId').anyOf(groupIdsToDelete).toArray();
            categoryIdsToDelete = categoriesToDelete.map(c => c.id);
             console.log(`Found ${categoryIdsToDelete.length} categories to clear data from for library ${libraryId}`);
        }

        // 3. Delete tags belonging to these categories
        if (categoryIdsToDelete.length > 0) {
            const deletedTagsCount = await db.tags.where('categoryId').anyOf(categoryIdsToDelete).delete();
            console.log(`Cleared ${deletedTagsCount} tags for library ${libraryId}`);
        }

        // 4. Delete the categories themselves
        if (categoryIdsToDelete.length > 0) {
            await db.categories.bulkDelete(categoryIdsToDelete);
            console.log(`Cleared ${categoryIdsToDelete.length} categories for library ${libraryId}`);
        }

        // 5. Delete the groups themselves
        if (groupIdsToDelete.length > 0) {
            await db.groups.bulkDelete(groupIdsToDelete);
             console.log(`Cleared ${groupIdsToDelete.length} groups for library ${libraryId}`);
        }
         console.log(`Cleared data for library ${libraryId}`);
    });
};

export const clearAllData = async (): Promise<void> => {
    // This is dangerous, use with caution.
    console.warn("Clearing ALL data from the database!");
    return db.transaction('rw', db.libraries, db.groups, db.categories, db.tags, async () => {
        await db.tags.clear();
        await db.categories.clear();
        await db.groups.clear(); // Added group clearing
        await db.libraries.clear();
        console.log("All database tables cleared.");
    });
};

// Add multiple groups (unchanged conceptually)
export const bulkAddGroups = (groups: Group[]): Promise<string[]> => {
    // Assumes groups array already has correct libraryId set
    // Also assumes IDs are pre-generated if needed, otherwise Dexie generates them if primary key is '++id'
    // Since our ID is string (UUID), they MUST be provided in the 'groups' array
    console.log(`Bulk adding ${groups.length} groups...`);
    return db.groups.bulkAdd(groups, { allKeys: true }) as Promise<string[]>;
};

// Changed: Add multiple categories (requires groupId)
export const bulkAddCategories = (categories: Category[]): Promise<string[]> => {
    // Assumes categories array already has correct groupId set
    // Assumes IDs are pre-generated (UUIDs)
    console.log(`Bulk adding ${categories.length} categories...`);
    return db.categories.bulkAdd(categories, { allKeys: true }) as Promise<string[]>;
};

// Changed: Add multiple tags (requires categoryId)
export const bulkAddTags = (tags: Tag[]): Promise<string[]> => {
    // Assumes tags array already has correct categoryId set
    // Assumes IDs are pre-generated (UUIDs)
     console.log(`Bulk adding ${tags.length} tags...`);
    return db.tags.bulkAdd(tags, { allKeys: true }) as Promise<string[]>;
};

// --- 模板和用户库扫描 ---

/**
 * Scans built-in template files (e.g., in /public/templates) using Vite's glob import.
 * Returns metadata about each found template.
 */
export const scanTemplateFiles = async (): Promise<TemplateInfo[]> => {
    console.log("Scanning for built-in template files...");
    const templates: TemplateInfo[] = [];
    const modules = import.meta.glob('/public/templates/*.json');
    const indexJsonPath = '/public/templates/index.json'; // Define path to exclude

    for (const path in modules) {
        // Explicitly skip the index.json file if it exists
        if (path === indexJsonPath) {
             console.log(`  Skipping index file: ${path}`);
             continue;
        }

        try {
            // Dynamically import the module to access its content
            const importer = modules[path];
            const content: any = await importer(); // Use 'any' to handle potential structure variations initially

            let name = 'Unknown Template';
            let description = undefined;

            // Determine name and description based on file structure
            if (content && content.library && content.library.name) { // New format
                name = content.library.name;
                description = content.library.description;
            } else if (content && content.metadata && content.metadata.name) { // Old format
                name = content.metadata.name;
                description = content.metadata.description;
            } else {
                 // Fallback: derive name from path if no name found in content
                 name = path.split('/').pop()?.replace('.json', '') || path;
                 console.warn(`Template file ${path} has no name in library or metadata, using filename.`);
            }

            templates.push({
                name: name,
                path: path, // Store the full path as used by glob import
                description: description
            });
             console.log(`  Found template: ${name} at ${path}`);
        } catch (error) {
            console.error(`Error processing template file ${path}:`, error);
            // Optionally add a placeholder or skip the template
            templates.push({
                name: path.split('/').pop()?.replace('.json', '') || `Error Loading ${path}`,
                path: path,
                description: `Error loading or parsing this template.`
            });
        }
    }
    console.log(`Finished scanning templates. Found ${templates.length}.`);
    return templates.sort((a, b) => a.name.localeCompare(b.name));
};


/**
 * NEW: Scans user library files (in /public/user_libraries) using Vite's glob import.
 * Returns metadata about each found library file.
 * This replaces the need for index.json.
 */
export const scanUserLibraries = async (): Promise<TemplateInfo[]> => {
    console.log("Scanning for user library files using Vite glob import...");
    const userLibs: TemplateInfo[] = [];
    // Adjust the glob pattern for the user_libraries directory
    // We still import lazily
    const modules = import.meta.glob('/public/user_libraries/*.json');
    const indexJsonPath = '/public/user_libraries/index.json'; // Define path to exclude

    for (const path in modules) {
        // Explicitly skip the index.json file if it exists
        if (path === indexJsonPath) {
            console.log(`  Skipping index file: ${path}`);
            continue;
        }

        try {
            const importer = modules[path];
            const content: any = await importer(); // Use 'any'

            let name = 'Unknown Library';
            let description = undefined;

            // Determine name and description (handle both structures)
            if (content && content.library && content.library.name) { // New format
                name = content.library.name;
                description = content.library.description;
            } else if (content && content.metadata && content.metadata.name) { // Old format
                name = content.metadata.name;
                description = content.metadata.description;
            } else {
                 // Fallback to filename
                 name = path.split('/').pop()?.replace('.json', '') || path;
                 console.warn(`User library file ${path} has no name in library or metadata, using filename.`);
            }

            userLibs.push({
                name: name,
                // Store the path relative to /public for consistency if needed elsewhere,
                // or keep the full path as returned by glob. Let's keep full path for now.
                path: path,
                description: description
            });
            console.log(`  Found user library: ${name} at ${path}`);

        } catch (error) {
            console.error(`Error processing user library file ${path}:`, error);
            userLibs.push({
                name: path.split('/').pop()?.replace('.json', '') || `Error Loading ${path}`,
                path: path,
                description: `Error loading or parsing this library file.`
            });
        }
    }
    console.log(`Finished scanning user libraries. Found ${userLibs.length}.`);
    return userLibs.sort((a, b) => a.name.localeCompare(b.name));
};


/**
 * Loads and parses the content of a specific user library file.
 * Uses fetch API.
 * @param userLibraryPath - The full path relative to the public directory (e.g., /user_libraries/mylib.json)
 */
export const loadUserLibraryContent = async (userLibraryPath: string): Promise<any | null> => {
    let relativePath = userLibraryPath;
    if (relativePath.startsWith('/public/')) {
        relativePath = relativePath.substring('/public'.length); // -> /user_libraries/xxx.json
    }

    // Combine BASE_URL with the relative path correctly
    const baseUrl = import.meta.env.BASE_URL; // e.g., '/' or '/Tag-Store/'
    // Ensure no double slashes if base ends with / and relative starts with /
    const finalUrlPath = baseUrl.endsWith('/')
                         ? `${baseUrl.slice(0, -1)}${relativePath}`
                         : `${baseUrl}${relativePath}`;

    const url = `${finalUrlPath}?_t=${Date.now()}`; // Use the combined path
    console.log(`尝试加载用户库内容 (via fetch, base adjusted): ${url}`); // Updated log

    try {
        const response = await fetch(url); // Fetch the corrected URL
        console.log(`  Fetch ${url} 状态: ${response.status}`); // Log fetch status
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const data = await response.json();
        console.log(`  ✅ 成功加载并解析用户库内容 (via fetch): ${url}`);
        return data;
    } catch (error) {
        console.error(`❌ 加载或解析用户库文件失败 ${url}:`, error);
        return null;
    } 
};

/**
 * 保存用户库到文件
 * @param data 要保存的数据
 * @param fileName 文件名或路径
 * @returns Promise<boolean> 保存成功返回true，否则返回false
 */
export const saveUserLibrary = async (data: any, fileName?: string): Promise<boolean> => {
  // 在真实环境中，这里需要使用服务器端API来保存文件
  // 在简单的开发环境中，我们可以尝试使用downloadjs或类似库让用户下载文件
  try {
    // 在浏览器中无法直接写入文件系统
    // 我们可以创建一个Blob并触发下载
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 创建一个临时链接元素并点击它来下载文件
    const link = document.createElement('a');
    link.href = url;
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const libName = data.library?.name || 'user-library';
    const sanitizedName = libName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const defaultFileName = fileName || `userlib_${sanitizedName}_${timestamp}.json`;
    
    link.download = defaultFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`已保存用户库: ${defaultFileName}`);
    return true;
  } catch (error) {
    console.error(`保存用户库失败:`, error);
    return false;
  }
};

/**
 * 加载指定模板文件的内容
 * @param templatePath 模板文件路径
 * @returns Promise<TagStoreTemplate | null> 模板数据或null（如果加载失败）
 */
export const loadTemplateFile = async (templatePath: string): Promise<any | null> => {
    let relativePath = templatePath;
    if (relativePath.startsWith('/public/')) {
        relativePath = relativePath.substring('/public'.length); // -> /templates/xxx.json
    }

    // Combine BASE_URL with the relative path correctly
    const baseUrl = import.meta.env.BASE_URL;
    const finalUrlPath = baseUrl.endsWith('/')
                         ? `${baseUrl.slice(0, -1)}${relativePath}`
                         : `${baseUrl}${relativePath}`;

    const url = `${finalUrlPath}?_t=${Date.now()}`;
    console.log(`尝试加载模板 (via fetch, base adjusted): ${url}`); // Updated log

    try {
       const response = await fetch(url);
       console.log(`  Fetch ${url} 状态: ${response.status}`); // Log fetch status
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        const data = await response.json();
        console.log(`模板加载成功 (via fetch): ${url}`); // Updated log message
        return data;
    } catch (error) {
       console.error(`加载模板文件失败 ${url}:`, error); // Updated log message
       return null;
    }
}; 