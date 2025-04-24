import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as StorageService from '../services/StorageService';
import type { Library, Group, Category, Tag, TagStoreTemplate } from '../types/data';
import { useTagStore } from './tagStore'; // Needed to load data on library change
import { db } from '../services/TagDatabase'; // Import db instance for transaction

const ACTIVE_LIBRARY_ID_STORAGE_KEY = 'tagstore_active_library_id';
const DEFAULT_LIBRARY_NAME = "默认标签库";

export const useLibraryStore = defineStore('libraryStore', () => {
  // --- State ---
  const libraries = ref<Library[]>([]);
  const activeLibraryId = ref<string | null>(null);
  const isLoading = ref<boolean>(false); // Loading state for library operations
  const availableTemplates = ref<StorageService.TemplateInfo[]>([]); // 可用模板列表
  const userLibraries = ref<StorageService.TemplateInfo[]>([]); // 用户库列表

  // --- Getters ---
  const activeLibrary = computed<Library | null>(() => {
    if (!activeLibraryId.value) return null;
    return libraries.value.find(lib => lib.id === activeLibraryId.value) || null;
  });

  // Getter to check if any libraries exist
  const hasLibraries = computed(() => libraries.value.length > 0);

  // --- Actions ---

  // Load libraries from DB, set active library (create default if none exist)
  const initializeLibraries = async (): Promise<boolean> => {
    console.log("初始化库存储...");
    isLoading.value = true;
    let defaultCreatedOrSynced = false; // Renamed variable

    try {
      // 1. 加载数据库中已存在的库
      console.log("步骤 1: 加载数据库中已存在的库...");
      let dbLibs = await StorageService.getAllLibraries();
      console.log(`数据库中找到 ${dbLibs.length} 个库`);
      const initialDbLibNames = dbLibs.map(lib => lib.name);

      // --- NEW: Sync with user_libraries/index.json --- 
      console.log("步骤 1.5: 扫描 user_libraries/index.json 并同步新库...");
      let librariesAddedOrSynced = false; // Moved declaration outside the try block

      try {
        const indexedLibs = await StorageService.scanUserLibraries();
        console.log(`  扫描到 ${indexedLibs.length} 个用户库文件:`, indexedLibs.map(l => ({name: l.name, path: l.path})));
        console.log(`  同步前数据库中的库名:`, initialDbLibNames);

        const existingDbNames = new Set(initialDbLibNames);

        for (const indexedLib of indexedLibs) {
          console.log(`  [Sync Check] 处理扫描到的库: name='${indexedLib.name}', path='${indexedLib.path}'`);

          // 1. Load content first
          let finalName: string | null = null;
          let finalDescription: string | undefined = undefined; // Variable for description
          let content: any = null; // Use 'any' temporarily to handle different structures

          try {
              content = await StorageService.loadUserLibraryContent(indexedLib.path);

              // Try reading from new structure (content.library) first
              if (content && content.library && content.library.name) {
                  finalName = content.library.name;
                  finalDescription = content.library.description;
                  console.log(`    - 加载内容成功 (新格式). 最终库名: '${finalName}'`);
              }
              // Fallback to old structure (content.metadata)
              else if (content && content.metadata && content.metadata.name) {
                  finalName = content.metadata.name;
                  finalDescription = content.metadata.description;
                  console.log(`    - 加载内容成功 (旧格式). 最终库名: '${finalName}'`);
              }
              // If neither structure provides a name, use the name from index.json as last resort
              else if (indexedLib.name) {
                   finalName = indexedLib.name;
                   finalDescription = indexedLib.description;
                   console.warn(`    - 🟡 库文件内容无效或缺少名称，将使用扫描到的信息: '${finalName}'`);
              } else {
                  console.error(`    - ❌ 库文件内容无效且扫描信息中也无名称: ${indexedLib.path}`);
                  continue;
              }

          } catch (loadError) {
              console.error(`    - ❌ 加载库内容失败: '${indexedLib.path}':`, loadError);
              continue;
          }

          // 2. Check existence using the determined FINAL name
          if (finalName && !existingDbNames.has(finalName)) {
            console.log(`    -> 数据库中尚无此库 ('${finalName}')，尝试添加...`);
            // Check if content has groups (essential for adding)
            if (content && Array.isArray(content.groups)) {
                try {
                    const newLibId = crypto.randomUUID();
                    const libraryToAdd: Library = {
                        id: newLibId,
                        name: finalName,
                        // Use the determined description, fallback to index.json description if needed
                        description: finalDescription || indexedLib.description,
                        createdAt: new Date().toISOString(),
                    };
                    console.log(`      - 准备添加的库数据:`, libraryToAdd);
                    
                    const groupsToAdd: Group[] = [];
                    const categoriesToAdd: Category[] = [];
                    const tagsToAdd: Tag[] = [];

                    content.groups.forEach((groupData: any, groupIndex: number) => {
                        const newGroupId = crypto.randomUUID();
                        groupsToAdd.push({ id: newGroupId, libraryId: newLibId, name: groupData.name || `Group ${groupIndex + 1}`, order: groupData.order ?? groupIndex });
                        if (Array.isArray(groupData.categories)) {
                            groupData.categories.forEach((categoryData: any, catIndex: number) => {
                                const newCatId = crypto.randomUUID();
                                categoriesToAdd.push({ id: newCatId, groupId: newGroupId, name: categoryData.name || `Category ${catIndex + 1}`, color: categoryData.color, icon: categoryData.icon });
                                if (Array.isArray(categoryData.tags)) {
                                    categoryData.tags.forEach((tagData: any) => {
                                        tagsToAdd.push({ id: crypto.randomUUID(), categoryId: newCatId, name: tagData.name, subtitles: tagData.subtitles || [], keyword: tagData.keyword || tagData.name, weight: tagData.weight ?? 1.0, color: tagData.color });
                                    });
                                }
                            });
                        }
                    });
                    console.log(`      - 准备添加 ${groupsToAdd.length} 个组, ${categoriesToAdd.length} 个分类, ${tagsToAdd.length} 个标签`);
                    
                    await db.transaction('rw', db.libraries, db.groups, db.categories, db.tags, async () => {
                        console.log(`        - 开始数据库事务...`);
                        await db.libraries.add(libraryToAdd);
                        if (groupsToAdd.length > 0) await db.groups.bulkAdd(groupsToAdd);
                        if (categoriesToAdd.length > 0) await db.categories.bulkAdd(categoriesToAdd);
                        if (tagsToAdd.length > 0) await db.tags.bulkAdd(tagsToAdd);
                        console.log(`        - 数据库事务完成.`);
                    });

                    console.log(`  ✅ 成功添加新库 '${finalName}' 到数据库 (ID: ${newLibId})`);
                    librariesAddedOrSynced = true;
                    existingDbNames.add(finalName);

                } catch (addError) {
                    console.error(`    - ❌ 添加库 '${finalName}' (${indexedLib.path}) 时出错:`, addError);
                }
            } else {
                 console.warn(`    - 🟡 内容有效但缺少 groups 数组，无法添加库 '${finalName}' (${indexedLib.path})`);
            }
          } else if (finalName) {
             console.log(`    -> 库 '${finalName}' 已存在于数据库中 (或即将被添加)，跳过添加。`);
          } else {
              // Should not be reached due to earlier continue statement, but defensive check
              console.log(`    -> 无法确定最终库名，跳过此条目: ${indexedLib.path}`);
          }
        }

        // --- Re-fetch libraries from DB AFTER sync loop ---
        console.log("步骤 1.6: 同步循环结束，重新从数据库加载库列表...");
        dbLibs = await StorageService.getAllLibraries(); // Re-fetch the complete list
        libraries.value = dbLibs.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`库同步和重载完成，当前数据库中有 ${libraries.value.length} 个库:`, libraries.value.map(l => l.name));
        // --- End Re-fetch ---

      } catch(scanError) {
         console.error("  ❌ 扫描用户库文件或处理时出错:", scanError);
      }
      // --- End NEW Sync Logic ---

      // --- Continue with original logic using potentially updated libraries.value --- 

      // 2. 确定要激活的库 ID
      console.log("步骤 2: 确定活动库...");
      let targetLibraryId: string | null = null;

      // 2a. 尝试从 localStorage 加载
      try {
        targetLibraryId = localStorage.getItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
        console.log(`  从localStorage加载活动库ID: ${targetLibraryId}`);
        // Validate ID against the *now finalized* libraries.value
        if (targetLibraryId && !libraries.value.some(lib => lib.id === targetLibraryId)) {
          console.log(`  localStorage 中的库ID '${targetLibraryId}' 无效，重置`);
          targetLibraryId = null;
          localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
        }
      } catch (e) { 
        console.error("  从localStorage加载活动库ID失败", e);
        targetLibraryId = null; 
      }

      // 2b. 如果没有有效的 localStorage ID，并且有库存在，则使用第一个库
      if (!targetLibraryId && libraries.value.length > 0) {
        targetLibraryId = libraries.value[0].id;
        console.log(`  使用第一个库作为活动库: ${libraries.value[0].name} (${targetLibraryId})`);
      }

      // 3. 如果仍然没有库（数据库为空，且同步后也为空），则创建默认库
      if (libraries.value.length === 0 && !librariesAddedOrSynced) { 
        console.log("步骤 3: 数据库和同步后均为空，创建默认库...");
        try {
          const defaultTemplatePath = `${import.meta.env.BASE_URL}templates/default.json`;
          const defaultContent = await StorageService.loadTemplateFile(defaultTemplatePath);
          
          if (defaultContent && defaultContent.metadata && Array.isArray(defaultContent.groups)) {
              const newLibId = crypto.randomUUID();
              const libraryToAdd: Library = {
                  id: newLibId,
                  name: defaultContent.metadata.name || DEFAULT_LIBRARY_NAME,
                  description: defaultContent.metadata.description,
                  createdAt: new Date().toISOString(),
              };
              const groupsToAdd: Group[] = [];
              const categoriesToAdd: Category[] = [];
              const tagsToAdd: Tag[] = [];
              
              defaultContent.groups.forEach((groupData: any, groupIndex: number) => {
                  const newGroupId = crypto.randomUUID();
                  groupsToAdd.push({ id: newGroupId, libraryId: newLibId, name: groupData.name || `Group ${groupIndex + 1}`, order: groupData.order ?? groupIndex });
                  if (Array.isArray(groupData.categories)) {
                      groupData.categories.forEach((categoryData: any, catIndex: number) => {
                          const newCatId = crypto.randomUUID();
                          categoriesToAdd.push({ id: newCatId, groupId: newGroupId, name: categoryData.name || `Category ${catIndex + 1}`, color: categoryData.color, icon: categoryData.icon });
                          if (Array.isArray(categoryData.tags)) {
                              categoryData.tags.forEach((tagData: any) => {
                                  tagsToAdd.push({ id: crypto.randomUUID(), categoryId: newCatId, name: tagData.name, subtitles: tagData.subtitles || [], keyword: tagData.keyword || tagData.name, weight: tagData.weight ?? 1.0, color: tagData.color });
                              });
                          }
                      });
                  }
              });
              
              await db.transaction('rw', db.libraries, db.groups, db.categories, db.tags, async () => {
                  await db.libraries.add(libraryToAdd);
                  if (groupsToAdd.length > 0) await db.groups.bulkAdd(groupsToAdd);
                  if (categoriesToAdd.length > 0) await db.categories.bulkAdd(categoriesToAdd);
                  if (tagsToAdd.length > 0) await db.tags.bulkAdd(tagsToAdd);
              });
              console.log(`  ✅ 已从模板创建默认库: ${libraryToAdd.name} (${newLibId})`);
              libraries.value.push(libraryToAdd); // Add to local state
              targetLibraryId = newLibId;
              // defaultCreatedOrSynced = true; // Flag not needed here anymore
          } else {
              console.warn("  🟡 加载默认模板失败或格式无效，将创建完全空的库");
              const emptyLibId = await createLibrary({ name: DEFAULT_LIBRARY_NAME, description: '' }, false); // Added empty description
              targetLibraryId = emptyLibId;
              // defaultCreatedOrSynced = true;
          }
        } catch (defaultCreationError) {
           console.error("  ❌ 创建默认库失败:", defaultCreationError);
        }
      } else if (libraries.value.length === 0 && librariesAddedOrSynced) {
        console.log("步骤 3: 数据库为空，但已从 index.json 同步了库，跳过创建默认库。");
      }
      
      // 4. 设置活动库 (switchLibrary handles null)
      console.log(`步骤 4: 设置最终活动库 ID: ${targetLibraryId}`);
      await switchLibrary(targetLibraryId);

    } catch (error) {
      console.error("初始化库存储时发生意外错误:", error);
      // Ensure state consistency on error
      libraries.value = [];
      await switchLibrary(null); 
    } finally {
      isLoading.value = false;
      console.log(`库存储初始化完成。活动库: ${activeLibrary.value?.name ?? '无'}`);
    }
    return defaultCreatedOrSynced; // Return if a default was created or synced
  };

  // Create a new library
  const createLibrary = async (libraryData: Omit<Library, 'id'>, switchToNew: boolean = true): Promise<string> => {
     isLoading.value = true;
     let newId = '';
     try {
         // Future: Add check for duplicate name before calling storage?
         console.log(`Creating library: ${libraryData.name}, switch? ${switchToNew}`);
         newId = await StorageService.addLibrary(libraryData);
         const newLibrary = await StorageService.getLibraryById(newId);
         if (newLibrary) {
             libraries.value.push(newLibrary);
             libraries.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
             console.log(`Library '${newLibrary.name}' created with ID: ${newId}`);
             if (switchToNew) {
                 await switchLibrary(newId);
             } else {
                console.log(`Library created but not switched to.`);
             }
         } else {
            throw new Error("Failed to retrieve newly created library from DB");
         }
         return newId;
     } catch (error) {
          console.error(`Failed to create library '${libraryData.name}':`, error);
          // Clean up potentially inconsistent state if needed?
          throw error; // Re-throw for component level handling
     } finally {
        isLoading.value = false;
     }
  };

  // Switch the active library and trigger data loading in tagStore
  const switchLibrary = async (libraryId: string | null) => {
    console.log(`Attempting to switch library to ID: ${libraryId}`);
    const tagStore = useTagStore();
    
    // 1. Update active library ID state
    activeLibraryId.value = libraryId;

    // 2. Persist to localStorage
    try {
        if (libraryId) {
            localStorage.setItem(ACTIVE_LIBRARY_ID_STORAGE_KEY, libraryId);
            console.log(`Saved active library ID ${libraryId} to localStorage`);
        } else {
            localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
            console.log(`Removed active library ID from localStorage`);
        }
    } catch (e) {
        console.error("Failed to save active library ID to localStorage", e);
    }

    // 3. Load data for the new library in tagStore
    // This should handle clearing data if libraryId is null
    try {
      console.log(`Triggering data load in tagStore for library ID: ${libraryId}`);
      await tagStore.loadDataForLibrary(libraryId);
      console.log(`Data load triggered for library ID: ${libraryId}`);
    } catch (error) {
       console.error(`Error loading data for library ${libraryId} in tagStore:`, error);
       // Handle error - maybe clear tagStore state or show notification?
       activeLibraryId.value = null; // Rollback active library on error? Maybe too drastic.
       localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
    }

    console.log(`Library switch complete. Active ID: ${activeLibraryId.value}`);
  };

  // Delete a library and all its associated data
  const deleteLibrary = async (libraryId: string) => {
    console.log(`Attempting to delete library ID: ${libraryId}`);
    isLoading.value = true;
    try {
      // Find the index before deleting
      const indexToDelete = libraries.value.findIndex(lib => lib.id === libraryId);
      if (indexToDelete === -1) {
          console.warn(`Library with ID ${libraryId} not found for deletion.`);
          return;
      }
      
      // Call storage service to delete library and all its data
      await StorageService.deleteLibrary(libraryId);
      console.log(`Successfully deleted library ${libraryId} from storage.`);

      // Remove from local state
      libraries.value.splice(indexToDelete, 1);
      console.log(`Removed library ${libraryId} from local state.`);

      // Check if the deleted library was the active one
      if (activeLibraryId.value === libraryId) {
        console.log(`Deleted library was active. Switching library...`);
        // Switch to the first available library, or null if none remain
        const nextLibraryId = libraries.value.length > 0 ? libraries.value[0].id : null;
        await switchLibrary(nextLibraryId);
      } else {
         console.log(`Deleted library was not active. Active library remains: ${activeLibraryId.value}`);
      }

    } catch (error) {
      console.error(`Failed to delete library ${libraryId}:`, error);
      // Reload libraries from DB to ensure consistency on error?
      await initializeLibraries(); // Or just reload libraries list
      throw error; // Re-throw
    } finally {
      isLoading.value = false;
    }
  };

   // Rename a library
   const renameLibrary = async (libraryId: string, newName: string) => {
    console.log(`Renaming library ${libraryId} to "${newName}"`);
    // Basic validation
    if (!newName.trim()) {
      console.error("New library name cannot be empty.");
      throw new Error("Library name cannot be empty.");
    }
    // Optional: Check if name already exists among other libraries?

    isLoading.value = true;
    try {
        await StorageService.updateLibrary(libraryId, { name: newName });
        // Update local state
        const library = libraries.value.find(lib => lib.id === libraryId);
        if (library) {
            library.name = newName;
            libraries.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
            console.log(`Library ${libraryId} renamed to "${newName}" in local state.`);
        } else {
             console.warn(`Library ${libraryId} not found in local state after renaming.`);
             // Reload from DB to be safe?
             await initializeLibraries(); // Or just reload libraries list
        }
    } catch (error) {
        console.error(`Failed to rename library ${libraryId}:`, error);
        throw error;
    } finally {
        isLoading.value = false;
    }
   };

  // Load available templates
  const loadAvailableTemplates = async () => {
    try {
      availableTemplates.value = await StorageService.scanTemplateFiles();
      console.log("可用模板:", availableTemplates.value);
    } catch (error) {
      console.error("加载可用模板失败:", error);
      availableTemplates.value = [];
    }
  };

  // Load user libraries (called by LibraryManagerDialog)
  const loadUserLibraries = async () => {
    try {
        // Corrected: scanUserLibraries doesn't accept arguments
        userLibraries.value = await StorageService.scanUserLibraries(); 
        console.log("用户库:", userLibraries.value);
    } catch (error) {
        console.error("加载用户库失败:", error);
        userLibraries.value = [];
    }
  };

  // NEW: Get data for a specific template file
  const getTemplateData = async (templatePath: string): Promise<TagStoreTemplate | null> => {
      console.log(`Fetching template data for path: ${templatePath}`);
      try {
          // Corrected based on linter suggestion
          const data = await StorageService.loadTemplateFile(templatePath);
          return data;
      } catch (error) {
          console.error(`Failed to get template data for ${templatePath}:`, error);
          return null;
      }
  };

  // NEW: Get data for a specific user library file
  const getUserLibraryData = async (libraryPath: string): Promise<TagStoreTemplate | null> => {
      console.log(`Fetching user library data for path: ${libraryPath}`);
       try {
           // Using loadTemplateFile as a placeholder, assuming similar loading
           // TODO: Verify if a specific user library loading method exists in StorageService
           const data = await StorageService.loadTemplateFile(libraryPath);
           return data;
       } catch (error) {
           console.error(`Failed to get user library data for ${libraryPath}:`, error);
           return null;
       }
  };

  // --- Return ---
  return {
    libraries,
    activeLibraryId,
    isLoading,
    activeLibrary,
    availableTemplates,
    userLibraries,
    hasLibraries,
    initializeLibraries,
    createLibrary,
    switchLibrary,
    deleteLibrary,
    renameLibrary,
    loadAvailableTemplates,
    loadUserLibraries,
    getTemplateData,
    getUserLibraryData,
  };
}); 