import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as StorageService from '../services/StorageService';
import type { Library } from '../types/data';
import { useTagStore } from './tagStore'; // Needed to re-initialize tagStore on library change

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

  // --- Actions ---

  // 加载可用模板列表
  const loadAvailableTemplates = async () => {
    try {
      availableTemplates.value = await StorageService.scanTemplateFiles();
      console.log("可用模板:", availableTemplates.value);
    } catch (error) {
      console.error("加载可用模板失败:", error);
      availableTemplates.value = [];
    }
  };

  // 加载用户库列表
  const loadUserLibraries = async (forceRefresh: boolean = false) => {
    try {
      console.log("开始加载用户库列表...");
      
      // 清除缓存，强制浏览器重新请求文件
      if (forceRefresh) {
        console.log("强制刷新模式，添加时间戳绕过缓存");
      }
      
      // 获取用户库列表
      userLibraries.value = await StorageService.scanUserLibraries();
      
      if (userLibraries.value.length === 0) {
        console.warn("⚠️ 未找到任何用户库文件，请检查public/user_libraries目录");
      } else {
        console.log(`✅ 用户库列表加载完成，共找到${userLibraries.value.length}个用户库:`);
        userLibraries.value.forEach((lib, index) => {
          console.log(`  ${index + 1}. ${lib.name} - ${lib.path}${lib.description ? ` (${lib.description})` : ''}`);
        });
      }
    } catch (error) {
      console.error("❌ 加载用户库失败:", error);
      userLibraries.value = [];
    }
  };

  // Load libraries from DB, set active library (create default if none exist)
  const initializeLibraries = async (): Promise<boolean> => {
    console.log("初始化库存储...");
    isLoading.value = true;
    let defaultCreated = false;
    let createdFromUserLibs = false; // 标记是否从用户库创建了新库

    // 1. 加载用户库文件列表 (强制刷新)
    console.log("步骤 1: 加载用户库文件列表...");
    try {
      await loadUserLibraries(true);
    } catch (error) {
      console.error("加载用户库文件列表失败:", error);
      // 即使加载失败，也继续尝试初始化
    }

    try {
      // 2. 加载数据库中已存在的库
      console.log("步骤 2: 加载数据库中已存在的库...");
      let loadedLibraries = await StorageService.getAllLibraries();
      console.log(`数据库中找到 ${loadedLibraries.length} 个库`);

      // 3. 检查用户库文件，如果数据库中不存在则创建
      console.log(`步骤 3: 检查 ${userLibraries.value.length} 个用户库文件是否需要创建...`);
      const existingLibraryNamesLower = loadedLibraries.map(lib => lib.name.toLowerCase());
      
      for (const userLib of userLibraries.value) {
        const userLibNameLower = userLib.name.toLowerCase();
        if (!existingLibraryNamesLower.includes(userLibNameLower)) {
          console.log(`  发现新库 "${userLib.name}"，准备从文件 ${userLib.path} 创建...`);
          try {
            // 创建库但不立即切换
            await createLibraryFromUserLib(userLib.name, userLib.path); 
            createdFromUserLibs = true;
            console.log(`  ✅ 成功创建库 "${userLib.name}"`);
            // 添加到检查列表，防止因大小写不同而重复创建
            existingLibraryNamesLower.push(userLibNameLower); 
          } catch (creationError) {
            console.error(`  ❌ 创建库 "${userLib.name}" 失败:`, creationError);
          }
        } else {
          console.log(`  库 "${userLib.name}" 已存在于数据库中，跳过创建`);
        }
      }

      // 4. 如果从用户库创建了新库，则重新加载数据库列表
      if (createdFromUserLibs) {
        console.log("步骤 4: 因创建了新库，重新从数据库加载库列表...");
        loadedLibraries = await StorageService.getAllLibraries();
        console.log(`重新加载后，数据库中有 ${loadedLibraries.length} 个库`);
      }
      libraries.value = loadedLibraries;

      // 5. 确定要激活的库 ID
      console.log("步骤 5: 确定活动库...");
      let targetLibraryId: string | null = null;

      // 5a. 尝试从 localStorage 加载
      try {
        targetLibraryId = localStorage.getItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
        console.log(`  从localStorage加载活动库ID: ${targetLibraryId}`);
        // 验证 ID 是否有效
        if (targetLibraryId && !libraries.value.some(lib => lib.id === targetLibraryId)) {
          console.log(`  localStorage 中的库ID无效，重置`);
          targetLibraryId = null;
          localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
        }
      } catch (e) { 
        console.error("  从localStorage加载活动库ID失败", e);
      }

      // 5b. 如果没有有效的 localStorage ID，使用第一个库
      if (!targetLibraryId && libraries.value.length > 0) {
        targetLibraryId = libraries.value[0].id;
        console.log(`  使用第一个库作为活动库: ${libraries.value[0].name} (${targetLibraryId})`);
      }

      // 6. 如果仍然没有库（数据库为空且用户库也为空或创建失败），则创建默认库
      if (libraries.value.length === 0) {
        console.log("步骤 6: 数据库和用户库均无有效库，创建默认库...");
        try {
          const defaultLibId = await createLibrary({ name: DEFAULT_LIBRARY_NAME }, false);
          targetLibraryId = defaultLibId;
          defaultCreated = true;
          // 重新获取库列表，现在应该包含默认库
          libraries.value = await StorageService.getAllLibraries(); 
          console.log(`  已创建默认库: ${DEFAULT_LIBRARY_NAME} (${defaultLibId})`);
        } catch (defaultCreationError) {
           console.error("  ❌ 创建默认库失败:", defaultCreationError);
           // 如果默认库创建失败，targetLibraryId 仍然是 null
        }
      }
      
      // 7. 设置活动库
      console.log(`步骤 7: 设置最终活动库 ID: ${targetLibraryId}`);
      await switchLibrary(targetLibraryId); // switchLibrary 会处理 null 的情况

    } catch (error) {
      console.error("初始化库存储时发生意外错误:", error);
    } finally {
      isLoading.value = false;
      console.log(`库存储初始化完成。活动库: ${activeLibrary.value?.name ?? '无'}`);
    }
    return defaultCreated; // 返回是否创建了默认库
  };

  // Create a new library
  const createLibrary = async (libraryData: Omit<Library, 'id'>, switchToNew: boolean = true): Promise<string> => {
     isLoading.value = true;
     try {
         // Check for duplicate name? Maybe add later or rely on DB constraints if set
         const newId = await StorageService.addLibrary(libraryData);
         const newLibrary = await StorageService.getLibraryById(newId);
         if (newLibrary) {
             libraries.value.push(newLibrary);
             libraries.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
             if (switchToNew) {
                 await switchLibrary(newId);
             }
         }
         return newId;
     } catch (error) {
          console.error("Failed to create library:", error);
          throw error; // Re-throw for component level handling
     } finally {
        isLoading.value = false;
     }
  };

  // 从模板创建新库
  const createLibraryFromTemplate = async (name: string, templatePath: string, switchToNew: boolean = true): Promise<string> => {
    isLoading.value = true;
    try {
      // 1. 创建新库
      const newId = await createLibrary({ name }, false);
      
      // 2. 加载模板数据
      const templateData = await StorageService.loadTemplateFile(templatePath);
      if (!templateData) {
        throw new Error(`无法加载模板：${templatePath}`);
      }
      
      // 3. 切换到新库
      if (switchToNew) {
        await switchLibrary(newId);
      }
      
      // 4. 让tagStore导入模板数据
      const tagStore = useTagStore();
      await tagStore.importData(templateData, false);
      
      return newId;
    } catch (error) {
      console.error("从模板创建库失败:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  // 从用户库文件创建新库
  const createLibraryFromUserLib = async (name: string, userLibPath: string): Promise<string> => {
    isLoading.value = true;
    let newId: string | null = null;
    try {
      console.log(`正在从用户库创建新标签库: 名称=${name}, 路径=${userLibPath}`);
      
      // 1. 创建新库（但不切换）
      newId = await createLibrary({ name }, false);
      console.log(`已创建空库，ID=${newId}`);
      
      // --- 关键修改：先切换到新库 --- 
      console.log(`准备导入数据，先切换到新库: ${newId}`);
      await switchLibrary(newId); 
      // 确保 switchLibrary 完成了 tagStore 的初始化（虽然是空的）
      // 这样后续的 importData 就会操作当前（新）的活动库
      //--------------------------------

      // 2. 加载用户库数据
      console.log(`正在加载用户库文件: ${userLibPath}`);
      const libData = await StorageService.loadUserLibraryContent(userLibPath);
      if (!libData) {
        // 如果加载失败，删除刚刚创建的空库？(可选)
        // await deleteLibrary(newId);
        throw new Error(`无法加载用户库内容：${userLibPath}`);
      }
      
      // 检测文件格式
      console.log(`用户库文件加载成功，检测数据格式...`);
      
      // 准备导入数据...
      let importData: any = {
        library: { name: name },
        categories: [],
        tags: []
      };
      // (格式处理逻辑保持不变)
      if (libData.metadata && libData.categories && libData.tags) {
        console.log(`检测到metadata格式的用户库`);
        importData.library.name = libData.metadata.name || name;
        importData.categories = libData.categories || [];
        importData.tags = libData.tags || [];
      } else if (libData.library && libData.categories && libData.tags) {
        console.log(`检测到library格式的用户库`);
        importData = libData;
      } else if (Array.isArray(libData.categories) && Array.isArray(libData.tags)) {
        console.log(`检测到简化格式的用户库`);
        importData.categories = libData.categories;
        importData.tags = libData.tags;
      } else if (Array.isArray(libData)) {
        console.log(`检测到极简格式的用户库（仅标签列表）`);
        importData.tags = libData;
      } else {
        console.warn(`未知格式的用户库文件:`, libData);
        throw new Error("不支持的用户库文件格式");
      }
      
      console.log(`准备导入数据: ${importData.categories.length}个分类, ${importData.tags.length}个标签`);
      
      // 3. 让tagStore导入用户库数据到 *当前已激活* 的新库
      console.log(`导入用户库数据到新库 ${newId}`);
      const tagStore = useTagStore();
      // importData 会调用 initializeStore() 重新加载数据
      await tagStore.importData(importData, false); 
      
      // 4. 如果外部要求创建后不切换，则切换回之前的库
      // (这个逻辑可能需要根据实际需求调整，但现在是创建后默认切换)
      // if (!switchToNew) { ... 切换回之前的 activeId ... }
      
      console.log(`✅ 从用户库创建标签库成功: "${name}"`);
      return newId; // 返回新库ID

    } catch (error) {
      console.error("❌ 从用户库创建失败:", error);
      // 如果出错，并且已经创建了库，可能需要删除它
      if (newId) {
        console.log(`创建过程中出错，尝试删除已创建的空库: ${newId}`);
        try {
          await deleteLibrary(newId);
        } catch (deleteError) {
          console.error(`删除失败的库 ${newId} 时出错:`, deleteError);
        }
      }
      throw error; // 将错误抛出给调用者
    } finally {
      isLoading.value = false;
    }
  };

  // 导出当前库到用户库文件
  const exportLibraryToUserLib = async (): Promise<boolean> => {
    isLoading.value = true;
    try {
      console.log("开始导出当前库到用户库文件...");
      const activeLib = activeLibrary.value;
      if (!activeLib) {
        throw new Error("没有选中的活动库");
      }
      
      console.log(`正在导出库: ${activeLib.name}(${activeLib.id})`);
      
      // 使用tagStore导出数据
      const tagStore = useTagStore();
      const jsonData = await tagStore.exportDataAsJson();
      const exportData = JSON.parse(jsonData);
      
      // 转换为用户库格式
      const userLibData = {
        version: "1.0",
        metadata: {
          name: activeLib.name,
          description: `从 TagStore 导出的标签库`,
          exported_at: new Date().toISOString()
        },
        categories: exportData.categories || [],
        tags: exportData.tags || []
      };
      
      // 保存到用户库文件
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `${activeLib.name.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.json`;
      console.log(`正在保存用户库文件: ${fileName}`);
      
      const success = await StorageService.saveUserLibrary(userLibData, fileName);
      
      // 刷新用户库列表
      if (success) {
        console.log("文件保存成功，刷新用户库列表");
        await loadUserLibraries(true); // 强制刷新
        console.log(`✅ 成功导出 "${activeLib.name}" 到用户库文件`);
      } else {
        console.error("❌ 保存用户库文件失败");
      }
      
      return success;
    } catch (error) {
      console.error("❌ 导出库到用户库文件失败:", error);
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  // Switch the active library
  const switchLibrary = async (libraryId: string | null) => {
     if (libraryId && libraries.value.some(lib => lib.id === libraryId)) {
         activeLibraryId.value = libraryId;
         try {
            localStorage.setItem(ACTIVE_LIBRARY_ID_STORAGE_KEY, libraryId);
         } catch (e) { console.error("Failed to save active library ID", e); }
         console.log(`Switched active library to: ${libraryId}`);
         // IMPORTANT: Trigger re-initialization of tagStore for the new library
         const tagStore = useTagStore();
         await tagStore.initializeStore(); 
     } else if (libraryId === null) {
         // Handle switching to "no library" state if applicable
         activeLibraryId.value = null;
          try { localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY); } catch(e) {}
          const tagStore = useTagStore();
          await tagStore.clearLocalState(); // Add method to clear tagStore state
     } else {
         console.warn(`Attempted to switch to invalid library ID: ${libraryId}`);
         // Optionally switch to a default or the first available library
         if (libraries.value.length > 0) {
             await switchLibrary(libraries.value[0].id);
         } else {
             await switchLibrary(null); // No libraries left
         }
     }
  };

   // Delete a library
  const deleteLibrary = async (libraryId: string) => {
      if (!libraryId) return;
      // Prevent deleting the last library? Maybe not necessary, allow empty state.
      // if (libraries.value.length <= 1) { throw new Error("Cannot delete the last library."); }

      isLoading.value = true;
      try {
          await StorageService.deleteLibrary(libraryId);
          libraries.value = libraries.value.filter(lib => lib.id !== libraryId); // Update local state

          // If the deleted library was the active one, switch to another
          if (activeLibraryId.value === libraryId) {
              const nextLibraryId = libraries.value.length > 0 ? libraries.value[0].id : null;
              await switchLibrary(nextLibraryId);
          }
      } catch (error) {
           console.error(`Failed to delete library ${libraryId}:`, error);
           throw error;
      } finally {
          isLoading.value = false;
      }
  };

  // Rename library (Example - might need more update methods later)
   const renameLibrary = async (libraryId: string, newName: string) => {
       if (!libraryId || !newName.trim()) return;
       isLoading.value = true;
       try {
           await StorageService.updateLibrary(libraryId, { name: newName.trim() });
           // Update local state
           const index = libraries.value.findIndex(lib => lib.id === libraryId);
           if (index !== -1) {
               libraries.value[index].name = newName.trim();
               libraries.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
           }
       } catch(error) {
            console.error(`Failed to rename library ${libraryId}:`, error);
            throw error;
       } finally {
            isLoading.value = false;
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
    initializeLibraries,
    loadAvailableTemplates,
    loadUserLibraries,
    createLibrary,
    createLibraryFromTemplate,
    createLibraryFromUserLib,
    exportLibraryToUserLib,
    switchLibrary,
    deleteLibrary,
    renameLibrary,
  };
}); 