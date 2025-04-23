import { db } from './TagDatabase';
import type { Library, Category, Tag } from '../types/data';
import { liveQuery } from 'dexie';

// --- Type Definitions for Updates --- 
// (To avoid complex Partial<Omit<...>> issues)
type UpdatableLibraryData = Partial<Pick<Library, 'name'>>; // Only name is updatable for now
type UpdatableCategoryData = Partial<Pick<Category, 'name' | 'color' | 'icon'> >; 
type UpdatableTagData = Partial<Pick<Tag, 'categoryId' | 'name' | 'subtitles' | 'keyword' | 'weight' | 'color'> >;

// 模板相关接口
export interface TemplateInfo {
  name: string;      // 模板名称
  path: string;      // 模板路径
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

/**
 * 扫描模板目录并返回所有可用的JSON模板文件
 */
export const scanTemplateFiles = async (): Promise<TemplateInfo[]> => {
  console.log("开始扫描模板文件...");
  try {
    const baseUrl = import.meta.env.BASE_URL; // 通常是 / 或 /Tag-Store/
    console.log(`  当前 BASE_URL: ${baseUrl}`);
    // 构建绝对基础路径
    const templatesBasePath = `${baseUrl}templates/`;
    console.log(`  模板基础路径: ${templatesBasePath}`);
    
    let templates: TemplateInfo[] = [];
    let indexFound = false;

    // 1. 尝试加载 templates/index.json
    console.log("  步骤 1: 尝试加载模板索引文件 (index.json)...", { baseUrl });
    try {
      const cacheBuster = `?_t=${Date.now()}`;
      const indexUrl = `${templatesBasePath}index.json${cacheBuster}`;
      console.log(`    尝试绝对路径: ${indexUrl}`);
      
      const options = {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };
      const response = await fetch(indexUrl, options);
      console.log(`    Fetch ${indexUrl} 状态: ${response.status}`); 

      if (response.ok) {
        try {
          const indexData: TemplateInfo[] = await response.json();
          console.log(`    ✅ 成功加载并解析模板索引: ${indexUrl}`, JSON.stringify(indexData)); 
          
          if (Array.isArray(indexData)) {
            const loadedTemplatesFromIndex: TemplateInfo[] = [];
            for (const item of indexData) {
              if (item.name && item.path) {
                 // index.json 中的 path 是相对于 templates/ 目录的
                 const fullPath = `${templatesBasePath}${item.path}`; // 直接拼接基础路径
                loadedTemplatesFromIndex.push({
                  name: item.name,
                  path: fullPath, 
                  description: item.description || `模板: ${item.name}`
                });
              } else {
                console.warn(`    🟡 索引项格式错误，缺少 name 或 path:`, item);
              }
            }
            if (loadedTemplatesFromIndex.length > 0) {
              templates = loadedTemplatesFromIndex;
              indexFound = true;
              console.log(`    从索引加载了 ${templates.length} 个模板`);
            } else {
               console.warn(`    🟡 索引文件 ${indexUrl} 内容为空或格式不正确`);
            }
          } else {
            console.warn(`    🟡 解析后的索引数据不是数组:`, indexData);
          }
        } catch(parseError) {
          console.error(`    ❌ 解析索引 JSON ${indexUrl} 失败:`, parseError);
        }
      }
    } catch (fetchError) {
      console.log(`    尝试加载索引 ${templatesBasePath}index.json 失败:`, fetchError);
    }

    // 2. 回退到加载 default.json (如果需要)
    if (!indexFound) {
      console.warn("  🟡 步骤 2: 未找到或无法解析模板索引，回退到加载 default.json...");
      const defaultUrl = `${templatesBasePath}default.json`;
      const cacheBuster = `?_t=${Date.now()}`;
      const urlWithCache = `${defaultUrl}${cacheBuster}`;
      console.log(`    尝试加载默认模板: ${urlWithCache}`);
      try {
        const options = { method: 'HEAD', /* ... cache headers ... */ };
        const response = await fetch(urlWithCache, options);
        if (response.ok) {
          console.log(`    ✅ 找到默认模板: ${defaultUrl}`);
          templates.push({
            name: 'Default',
            path: urlWithCache, 
            description: '默认模板'
          });
        }
      } catch (error) {
        console.log(`    检查默认模板 ${defaultUrl} 失败:`, error);
      }
    }
    
    console.log(`模板扫描完成，最终可用模板 ${templates.length} 个:`, templates.map(t => t.name));
    return templates;

  } catch (error) {
    console.error('❌ 扫描模板文件时发生严重错误:', error);
    return [];
  }
};

// 修改 scanUserLibraries 类似逻辑
export const scanUserLibraries = async (): Promise<TemplateInfo[]> => {
  console.log("开始扫描用户库文件...");
  try {
    const baseUrl = import.meta.env.BASE_URL;
    console.log(`  当前 BASE_URL: ${baseUrl}`);
    const userLibsBasePath = `${baseUrl}user_libraries/`;
    console.log(`  用户库基础路径: ${userLibsBasePath}`);

    const userLibs: TemplateInfo[] = [];
    let indexFound = false;

    // 1. 尝试加载 user_libraries/index.json
    console.log("  步骤 1: 尝试加载用户库索引文件 (index.json)...");
    try {
      const cacheBuster = `?_t=${Date.now()}`;
      const indexUrl = `${userLibsBasePath}index.json${cacheBuster}`;
      console.log(`    尝试绝对路径: ${indexUrl}`);
      const options = { /* ... cache headers ... */ };
      const response = await fetch(indexUrl, options);
      console.log(`    Fetch ${indexUrl} 状态: ${response.status}`);

      if (response.ok) {
        try {
          const indexData = await response.json();
          console.log(`    ✅ 成功加载并解析用户库索引: ${indexUrl}`, JSON.stringify(indexData));

          if (indexData.libraries && Array.isArray(indexData.libraries)) {
            const loadedLibsFromIndex: TemplateInfo[] = [];
            for (const lib of indexData.libraries) {
              if (lib.name && lib.path) {
                 // index.json 中的 path 是相对于 user_libraries/ 目录的
                const fullPath = lib.path.startsWith('http')
                                 ? lib.path
                                 : `${userLibsBasePath}${lib.path}`; // 直接拼接基础路径
                loadedLibsFromIndex.push({
                  name: lib.name,
                  path: fullPath,
                  description: lib.description || `共有${lib.tags_count || 0}个标签，${lib.categories_count || 0}个分类`
                });
              } else {
                 console.warn(`    🟡 用户库索引项格式错误，缺少 name 或 path:`, lib);
              }
            }
             if (loadedLibsFromIndex.length > 0) {
                userLibs.push(...loadedLibsFromIndex); // 使用 push(...)
                indexFound = true;
                console.log(`    从索引加载了 ${loadedLibsFromIndex.length} 个用户库`);
              } else {
                 console.warn(`    🟡 用户库索引文件 ${indexUrl} 内容为空或格式不正确`);
              }
          } else {
            console.warn(`    🟡 解析后的用户库索引数据格式错误 (缺少 libraries 数组):`, indexData);
          }
        } catch(parseError) {
          console.error(`    ❌ 解析用户库索引 JSON ${indexUrl} 失败:`, parseError);
        }
      }
    } catch (fetchError) {
      console.log(`    尝试加载用户库索引 ${userLibsBasePath}index.json 失败:`, fetchError);
    }

    // 2. 如果没有找到索引文件，尝试直接扫描（这部分逻辑在部署环境几乎不会成功，可以考虑移除或简化）
    if (!indexFound) {
      console.warn("  🟡 步骤 2: 未找到用户库索引，将不尝试直接扫描文件名。依赖 index.json 文件。");
    }
    
    console.log(`用户库扫描完成，最终找到 ${userLibs.length} 个:`, userLibs.map(l => l.name));
    return userLibs;
  } catch (error) {
    console.error('❌ 扫描用户库时发生严重错误:', error);
    return [];
  }
};

/**
 * 加载指定用户库文件的内容
 * @param userLibraryPath 完整的 URL 或相对路径
 * @returns Promise<any | null> 用户库数据或null（如果加载失败）
 */
export const loadUserLibraryContent = async (userLibraryPath: string): Promise<any | null> => {
  if (!userLibraryPath) return null;
  console.log(`尝试加载用户库内容: ${userLibraryPath}`);
  try {
    // Ensure cache busting
    const cacheBuster = `?_t=${Date.now()}`;
    const url = userLibraryPath.includes('?') 
                ? `${userLibraryPath}&_t=${Date.now()}` 
                : `${userLibraryPath}${cacheBuster}`;

    const options = {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    
    const response = await fetch(url, options);
    console.log(`  Fetch ${url} 状态: ${response.status}`);
    
    if (!response.ok) {
       // Check if the server returned HTML (SPA fallback)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
         console.error(`  ❌ Fetch 成功但服务器返回了 HTML (SPA fallback?) 而不是 JSON: ${url}`);
         throw new Error(`Server returned HTML instead of JSON for ${url}`);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`  ✅ 成功加载并解析用户库内容: ${url}`);
    return data;
    
  } catch (error) {
    console.error(`❌ 加载或解析用户库文件失败 ${userLibraryPath}:`, error);
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
  try {
    console.log(`尝试加载模板: ${templatePath}`);
    
    // 添加时间戳参数以避免浏览器缓存
    const cacheBuster = `?_t=${Date.now()}`;
    const url = templatePath.includes('?') ? `${templatePath}&_t=${Date.now()}` : `${templatePath}${cacheBuster}`;
    
    // 设置请求选项以禁用缓存
    const options = {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`模板加载成功: ${url}`);
    return data;
  } catch (error) {
    console.error(`加载模板文件失败 ${templatePath}:`, error);
    return null;
  }
}; 