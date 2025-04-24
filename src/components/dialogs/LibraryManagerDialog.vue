<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, computed, onMounted } from 'vue';
import {
    NModal,
    NButton,
    NList,
    NListItem,
    NThing,
    NInput,
    NIcon,
    NSpace,
    useMessage,
    useDialog,
    NSelect,
    NCheckbox,
    NText
} from 'naive-ui';
import { 
    CreateOutline as AddIcon, 
    PencilOutline as RenameIcon, 
    TrashOutline as DeleteIcon, 
    CheckmarkOutline as SaveIcon, 
    CloseOutline as CancelIcon,
    AppsOutline as TemplateIcon,
    FolderOutline as UserLibIcon,
    CloudDownloadOutline as ExportIcon,
    TrashBinOutline as DeleteSelectedIcon
} from '@vicons/ionicons5';
import { useLibraryStore } from '../../stores/libraryStore';
import { useTagStore } from '../../stores/tagStore';
import type { Library } from '../../types/data';

// Props & Emits for v-model:show
const props = defineProps<{ show: boolean }>();
const emit = defineEmits(['update:show']);

// Store and UI Hooks
const libraryStore = useLibraryStore();
const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

// Component State
const isAdding = ref(false);
const isAddingFromTemplate = ref(false);
const isAddingFromUserLib = ref(false);
const newLibraryName = ref('');
const editingLibraryId = ref<string | null>(null);
const editingName = ref('');
const selectedTemplate = ref<string | null>(null);
const selectedUserLib = ref<string | null>(null);
const templates = computed(() => libraryStore.availableTemplates);
const userLibraries = computed(() => libraryStore.userLibraries);

// --- 新增状态：用于选择库 ---
const selectedLibraryIds = ref<string[]>([]); // 存储选中的库ID

// 在组件挂载时加载模板列表和用户库列表
onMounted(async () => {
  console.log("LibraryManagerDialog组件已挂载，开始加载模板和用户库...");
  try {
    await loadResourcesData();
  } catch (error) {
    console.error("加载资源数据失败:", error);
  }
});

// 集中的资源加载函数
const loadResourcesData = async () => {
  console.log("开始加载模板和用户库数据...");
  
  // 无论之前是否有数据，都重新加载
  try {
    await libraryStore.loadAvailableTemplates();
    console.log(`模板加载完成，共${templates.value.length}个模板`);
  } catch (error) {
    console.error("加载模板列表失败:", error);
  }
  
  try {
    await libraryStore.loadUserLibraries();
    console.log(`用户库加载完成，共${userLibraries.value.length}个用户库`);
  } catch (error) {
    console.error("加载用户库列表失败:", error);
  }
};

// 模板选项
const templateOptions = computed(() => {
  return templates.value.map(template => ({
    label: template.name,
    value: template.path
  }));
});

// 用户库选项
const userLibOptions = computed(() => {
  return userLibraries.value.map(lib => ({
    label: lib.name,
    value: lib.path
  }));
});

// Computed property for libraries
const libraries = computed(() => libraryStore.libraries);

// --- 选择相关计算属性 ---

// 获取所有可以被选择/删除的库ID（不能删除最后一个）
const selectableLibraryIds = computed(() => {
  return libraries.value.length <= 1 ? [] : libraries.value.map(lib => lib.id);
});

// 是否所有可选择的库都被选中了？
const isAllSelected = computed(() => {
  return selectableLibraryIds.value.length > 0 && 
         selectableLibraryIds.value.every(id => selectedLibraryIds.value.includes(id));
});

// 是否处于半选状态（有选中但未全选）？
const isIndeterminate = computed(() => {
  return selectedLibraryIds.value.length > 0 && !isAllSelected.value;
});

// --- Event Handlers ---

// Close modal logic
const handleClose = () => {
    resetEditState();
    resetAddState();
    selectedLibraryIds.value = []; // 关闭时清空选择
    emit('update:show', false);
};

// Add New Library
const handleStartAdd = (type: 'empty' | 'template' | 'userlib' = 'empty') => {
    resetEditState(); // Cancel any ongoing edit
    selectedLibraryIds.value = []; // 开始添加时清空选择
    isAdding.value = true;
    isAddingFromTemplate.value = type === 'template';
    isAddingFromUserLib.value = type === 'userlib';
    newLibraryName.value = '';
    selectedTemplate.value = null;
    selectedUserLib.value = null;
};

const handleCancelAdd = () => {
    resetAddState();
};

const handleSaveAdd = async () => {
    const name = newLibraryName.value.trim();
    if (!name) {
        message.error('标签库名称不能为空');
        return;
    }
    
    let newLibraryId: string | null = null; // To hold the ID for potential cleanup
    try {
        if (isAddingFromTemplate.value && selectedTemplate.value) {
            // 1. Create empty library first, DO NOT switch
            newLibraryId = await libraryStore.createLibrary({ name }, false); // Use createLibrary, get ID
            if (!newLibraryId) { // Check if ID was returned
                 throw new Error("创建新库记录失败，未返回 ID");
            }
            // 2. Fetch template data (assuming libraryStore provides this)
            // TODO: Implement or verify libraryStore.getTemplateData(path)
            const templateData = await libraryStore.getTemplateData(selectedTemplate.value);
            if (!templateData) {
                 throw new Error(`无法加载模板文件: ${selectedTemplate.value}`);
            }

            // 3. Import data into the new library (Ensure ID is non-null)
            if (newLibraryId) { // Add null check for TS
                 await tagStore.importData(templateData, newLibraryId);
            } else {
                 // This case should ideally not happen if createLibrary succeeded
                 throw new Error("无法导入数据：新库 ID 无效");
            }
            message.success(`已从模板创建标签库 \"${name}\"`)

        } else if (isAddingFromUserLib.value && selectedUserLib.value) {
            // Similar logic for user libraries
            // 1. Create empty library, DO NOT switch
            newLibraryId = await libraryStore.createLibrary({ name }, false); // Use createLibrary, get ID
            if (!newLibraryId) { // Check if ID was returned
                 throw new Error("创建新库记录失败，未返回 ID");
            }
            // 2. Fetch user library data (assuming similar method)
             // TODO: Implement or verify libraryStore.getUserLibraryData(path)
            const userLibData = await libraryStore.getUserLibraryData(selectedUserLib.value); // Hypothetical function
            if (!userLibData) {
                 throw new Error(`无法加载用户库文件: ${selectedUserLib.value}`);
            }

            // 3. Import data (Ensure ID is non-null)
            if (newLibraryId) { // Add null check for TS
                 await tagStore.importData(userLibData, newLibraryId);
            } else {
                throw new Error("无法导入数据：新库 ID 无效");
            }
            message.success(`已从用户库创建标签库 \"${name}\"`);

        } else {
            // Create empty library (This call likely switches automatically if second param is true or default)
             await libraryStore.createLibrary({ name }, true); 
            message.success(`标签库 \"${name}\" 创建成功`);
        }
        resetAddState();
        // Optionally switch to the newly created library
        // ... (optional switch logic) ...

    } catch (error: any) {
        message.error(`创建失败: ${error.message}`);
        // Clean up partially created library if import fails
        if (newLibraryId && (isAddingFromTemplate.value || isAddingFromUserLib.value)) {
            console.warn(`Import failed for library ${newLibraryId}, attempting cleanup...`);
            try {
                await libraryStore.deleteLibrary(newLibraryId);
                console.log(`Cleaned up partially created library ${newLibraryId}.`);
            } catch (cleanupError: any) {
                console.error(`Failed to cleanup library ${newLibraryId}:`, cleanupError);
                message.error(`创建失败且无法自动清理部分创建的库 (${newLibraryId})`);
            }
        }
    }
};

// 导出当前库到用户库文件 (Temporarily comment out implementation)
const handleExportToUserLib = async (/* library: Library */) => {
    message.info('导出到用户库功能正在开发中...'); // Placeholder message
    /*
    try {
        // 切换到要导出的库
        if (library.id !== libraryStore.activeLibraryId) {
            await libraryStore.switchLibrary(library.id);
        }
        
        // 旧的导出逻辑 (已移除)
        // const success = await libraryStore.exportLibraryToUserLib(); 
        // TODO: Replace with new export logic:
        // 1. Call tagStore.exportLibraryData()
        // 2. Get TagStoreTemplate object
        // 3. Convert to JSON string
        // 4. Save the JSON string to a file (e.g., in public/user_libraries/)
        //    - Need a way to trigger file save/download or use backend if needed

        // if (success) { // Update based on new logic
        //     message.success(`已将 \"${library.name}\" 导出到用户库文件`);
        // } else {
        //     message.error('导出用户库失败');
        // }
    } catch (error: any) {
        message.error(`导出失败: ${error.message}`);
    }
    */
};

// Rename Library
const handleStartEdit = (library: Library) => {
    resetAddState(); // Cancel any ongoing add
    selectedLibraryIds.value = []; // 开始编辑时清空选择
    editingLibraryId.value = library.id;
    editingName.value = library.name;
};

const handleCancelEdit = () => {
    resetEditState();
};

const handleSaveEdit = async () => {
    if (!editingLibraryId.value) return;
    const name = editingName.value.trim();
    if (!name) {
        message.error('标签库名称不能为空');
        return;
    }
    // Check if name is unchanged?
    const originalLibrary = libraries.value.find(lib => lib.id === editingLibraryId.value);
    if (originalLibrary && originalLibrary.name === name) {
        resetEditState();
        return; // No change needed
    }

    try {
        await libraryStore.renameLibrary(editingLibraryId.value, name);
        message.success(`标签库已重命名为 "${name}"`);
        resetEditState();
    } catch (error: any) {
        message.error(`重命名失败: ${error.message}`);
    }
};

// Delete Library
const handleDelete = (library: Library) => {
    dialog.warning({
        title: '确认删除标签库',
        content: `确定要删除标签库 "${library.name}" 吗？\n这将删除该库及其包含的所有分类和标签！\n此操作无法撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            try {
                await libraryStore.deleteLibrary(library.id);
                message.success(`标签库 "${library.name}" 已删除`);
                // If the deleted library was being edited, reset state
                if (editingLibraryId.value === library.id) {
                    resetEditState();
                }
            } catch (error: any) {
                message.error(`删除失败: ${error.message}`);
            }
        },
    });
};

// --- 新增：批量删除选中的库 ---
const handleDeleteSelected = () => {
    const count = selectedLibraryIds.value.length;
    if (count === 0) {
        message.warning('请先选择要删除的标签库');
        return;
    }
    
    // 检查是否试图删除所有库
    if (count >= libraries.value.length) {
         message.error('不能删除所有的标签库');
        return;
    }

    const selectedNames = libraries.value
        .filter(lib => selectedLibraryIds.value.includes(lib.id))
        .map(lib => `"${lib.name}"`);

    dialog.warning({
        title: '确认删除选中的标签库',
        content: `确定要删除 ${count} 个选中的标签库吗？\n(${selectedNames.join(', ')})\n这将删除这些库及其所有内容！\n此操作无法撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            const idsToDelete = [...selectedLibraryIds.value]; // 复制一份，因为状态可能改变
            let deletedCount = 0;
            let failedCount = 0;
            libraryStore.isLoading = true;
            try {
                for (const id of idsToDelete) {
                    try {
                        await libraryStore.deleteLibrary(id);
                        deletedCount++;
                    } catch (error: any) {
                        failedCount++;
                        console.error(`删除库 ${id} 失败:`, error);
                        message.error(`删除库 ${id} 失败: ${error.message}`);
                    }
                }
                if (deletedCount > 0) {
                    message.success(`成功删除了 ${deletedCount} 个标签库`);
                }
                if (failedCount > 0) {
                    message.warning(`有 ${failedCount} 个标签库删除失败`);
                }
                selectedLibraryIds.value = []; // 清空选择
            } finally {
                 libraryStore.isLoading = false;
            }
        },
    });
};

// --- 新增：处理全选/单个选择 ---
const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    // 全选：选择所有可选择的库
    selectedLibraryIds.value = [...selectableLibraryIds.value];
  } else {
    // 取消全选
    selectedLibraryIds.value = [];
  }
  console.log("Selected IDs after toggle all:", selectedLibraryIds.value);
};

// 处理单个库的选中状态变化
const handleLibrarySelect = (libraryId: string, checked: boolean) => {
  if (checked) {
    // 添加选择
    if (!selectedLibraryIds.value.includes(libraryId)) {
      selectedLibraryIds.value.push(libraryId);
    }
  } else {
    // 移除选择
    const index = selectedLibraryIds.value.indexOf(libraryId);
    if (index > -1) {
      selectedLibraryIds.value.splice(index, 1);
    }
  }
  console.log("Selected IDs after individual select:", selectedLibraryIds.value);
};

// 刷新用户库列表
const handleRefreshUserLibs = async () => {
    try {
        console.log("手动刷新用户库列表");
        await libraryStore.loadUserLibraries(); 
        message.success('用户库列表已刷新');
    } catch (error: any) {
        message.error(`刷新失败: ${error.message}`);
    }
};

// --- Utility Functions ---
const resetAddState = () => {
    isAdding.value = false;
    isAddingFromTemplate.value = false;
    isAddingFromUserLib.value = false;
    newLibraryName.value = '';
    selectedTemplate.value = null;
    selectedUserLib.value = null;
};

const resetEditState = () => {
    editingLibraryId.value = null;
    editingName.value = '';
};

// Watch for prop changes
watch(() => props.show, (newValue) => {
    if (!newValue) {
        resetEditState();
        resetAddState();
        selectedLibraryIds.value = []; // 关闭时清空选择
    } else {
        console.log("对话框被打开，刷新用户库和模板列表");
        loadResourcesData();
        selectedLibraryIds.value = []; // 打开时也清空选择
    }
});
</script>

<template>
    <n-modal
        :show="props.show"
        @update:show="handleClose" 
        preset="card"
        title="管理标签库"
        style="width: 600px;"
        :mask-closable="false" 
        :closable="true" 
        @close="handleClose"
    >
        <n-list bordered hoverable clickable style="max-height: 60vh; overflow-y: auto;">
            <!-- Add New Library Section -->
            <n-list-item v-if="isAdding">
                <n-thing :title="isAddingFromTemplate ? '从模板创建标签库' : isAddingFromUserLib ? '从用户库创建标签库' : '创建新标签库'">
                    <n-space vertical>
                        <n-input 
                            v-model:value="newLibraryName"
                            placeholder="输入新标签库名称"
                            :loading="libraryStore.isLoading"
                            @keyup.enter="handleSaveAdd"
                            clearable
                        />
                        
                        <n-select 
                            v-if="isAddingFromTemplate"
                            v-model:value="selectedTemplate"
                            :options="templateOptions"
                            placeholder="选择模板"
                            :loading="libraryStore.isLoading"
                            :disabled="templateOptions.length === 0"
                        />
                        
                        <div v-if="isAddingFromTemplate && templateOptions.length === 0" style="color: #d03050; font-size: 0.9em;">
                            没有可用的模板文件
                        </div>
                        
                        <n-select 
                            v-if="isAddingFromUserLib"
                            v-model:value="selectedUserLib"
                            :options="userLibOptions"
                            placeholder="选择用户库"
                            :loading="libraryStore.isLoading"
                            :disabled="userLibOptions.length === 0"
                        />
                        
                        <div v-if="isAddingFromUserLib && userLibOptions.length === 0" style="color: #d03050; font-size: 0.9em;">
                            没有可用的用户库文件
                            <n-button text size="small" @click="handleRefreshUserLibs" :loading="libraryStore.isLoading">
                                刷新列表
                            </n-button>
                        </div>

                        <n-space justify="end">
                            <n-button type="primary" size="small" @click="handleSaveAdd" :loading="libraryStore.isLoading"
                                    :disabled="(isAddingFromTemplate && (!selectedTemplate || templateOptions.length === 0)) || 
                                                (isAddingFromUserLib && (!selectedUserLib || userLibOptions.length === 0))">
                                <template #icon><n-icon :component="SaveIcon" /></template>
                                保存
                            </n-button>
                            <n-button size="small" @click="handleCancelAdd" :disabled="libraryStore.isLoading">
                                <template #icon><n-icon :component="CancelIcon" /></template>
                                取消
                            </n-button>
                        </n-space>
                    </n-space>
                </n-thing>
            </n-list-item>
            <n-list-item v-else>
                <n-space vertical :size="12" style="width: 100%">
                    <n-space :size="12">
                        <n-button style="flex: 1" type="primary" :disabled="editingLibraryId !== null || libraryStore.isLoading" @click="() => handleStartAdd('empty')">
                            <template #icon><n-icon :component="AddIcon" /></template>
                            创建空标签库
                        </n-button>
                        
                        <n-button style="flex: 1" type="info" :disabled="editingLibraryId !== null || libraryStore.isLoading" @click="() => handleStartAdd('template')">
                            <template #icon><n-icon :component="TemplateIcon" /></template>
                            从模板创建
                        </n-button>
                    </n-space>
                    
                    <n-button block type="success" :disabled="editingLibraryId !== null || libraryStore.isLoading || userLibOptions.length === 0" @click="() => handleStartAdd('userlib')">
                        <template #icon><n-icon :component="UserLibIcon" /></template>
                        从用户库创建
                    </n-button>
                </n-space>
            </n-list-item>

            <!-- Existing Libraries List Header (添加全选) -->
            <n-list-item v-if="libraries.length > 1">
              <n-space justify="space-between" align="center">
                <n-checkbox
                  :checked="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @update:checked="toggleSelectAll"
                  :disabled="editingLibraryId !== null || isAdding"
                >
                  全选 ({{ selectedLibraryIds.length }} / {{ selectableLibraryIds.length }})
                </n-checkbox>
                <n-button 
                  type="error" 
                  size="small" 
                  @click="handleDeleteSelected"
                  :disabled="selectedLibraryIds.length === 0 || editingLibraryId !== null || isAdding"
                  :loading="libraryStore.isLoading"
                >
                  <template #icon><n-icon :component="DeleteSelectedIcon" /></template>
                  删除选中
                </n-button>
              </n-space>
            </n-list-item>

            <!-- Existing Libraries List Items (添加选择框) -->
            <template v-if="libraries.length > 0">
                <n-list-item 
                  v-for="library in libraries" 
                  :key="library.id" 
                  :class="{ 'selected-item': selectedLibraryIds.includes(library.id) }"
                >
                    <n-thing>
                        <template #header>
                            <n-space justify="space-between" align="center">
                                <!-- 左侧：选择框和库名 -->
                                <n-space align="center">
                                    <n-checkbox 
                                        v-if="libraries.length > 1" 
                                        :checked="selectedLibraryIds.includes(library.id)"
                                        @update:checked="(checked) => handleLibrarySelect(library.id, checked)"
                                        :disabled="editingLibraryId !== null || isAdding"
                                        style="margin-right: 8px;"
                                    />
                                    <!-- 编辑状态 -->
                                    <template v-if="editingLibraryId === library.id">
                                        <n-input 
                                            v-model:value="editingName"
                                            size="small" 
                                            :loading="libraryStore.isLoading"
                                            @keyup.enter="handleSaveEdit"
                                        />
                                    </template>
                                    <!-- 显示状态 -->
                                    <template v-else>
                                        <n-text :strong="library.id === libraryStore.activeLibraryId">
                                            {{ library.name }}
                                            <span v-if="library.id === libraryStore.activeLibraryId" style="font-size: 0.8em; color: var(--n-success-color); margin-left: 5px;">(当前)</span>
                                        </n-text>
                                    </template>
                                </n-space>

                                <!-- 右侧：操作按钮 -->
                                <n-space size="small">
                                    <!-- Editing Actions -->
                                    <template v-if="editingLibraryId === library.id">
                                        <n-button text type="primary" size="small" @click="handleSaveEdit" :loading="libraryStore.isLoading">
                                            <template #icon><n-icon :component="SaveIcon" /></template>
                                        </n-button>
                                        <n-button text size="small" @click="handleCancelEdit" :disabled="libraryStore.isLoading">
                                            <template #icon><n-icon :component="CancelIcon" /></template>
                                        </n-button>
                                    </template>
                                    <!-- Display Actions -->
                                    <template v-else>
                                        <n-button text size="small" @click="() => handleExportToUserLib(/* library: Library */)" 
                                                :disabled="isAdding || editingLibraryId !== null || libraryStore.isLoading" 
                                                title="导出到用户库">
                                            <template #icon><n-icon :component="ExportIcon" /></template>
                                        </n-button>
                                        <n-button text size="small" @click="handleStartEdit(library)" 
                                                :disabled="isAdding || editingLibraryId !== null || libraryStore.isLoading" 
                                                title="重命名">
                                            <template #icon><n-icon :component="RenameIcon" /></template>
                                        </n-button>
                                        <n-button 
                                            text type="error" size="small" 
                                            @click="handleDelete(library)" 
                                            :disabled="isAdding || editingLibraryId !== null || libraryStore.isLoading || libraries.length <= 1" 
                                            :title="libraries.length <= 1 ? '无法删除唯一的标签库' : '删除标签库'"
                                        >
                                            <template #icon><n-icon :component="DeleteIcon" /></template>
                                        </n-button>
                                    </template>
                                </n-space>
                            </n-space>
                        </template>
                    </n-thing>
                </n-list-item>
            </template>
            <n-list-item v-else-if="!isAdding"> 
                <span style="color: grey; font-style: italic;">还没有标签库，创建一个吧！</span>
            </n-list-item>
        </n-list>

        <!-- Optional: Footer for close button -->
        <template #footer>
            <n-space justify="space-between">
                <n-button size="small" @click="handleRefreshUserLibs" :loading="libraryStore.isLoading">
                    刷新用户库列表
                </n-button>
                <n-button @click="handleClose">关闭</n-button>
            </n-space>
        </template>
    </n-modal>
</template>

<style scoped>
.selected-item {
  background-color: rgba(var(--n-primary-color-rgb), 0.08);
}
/* Add component-specific styles if needed */
</style> 