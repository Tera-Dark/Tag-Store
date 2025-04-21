<script setup lang="ts">
import { NLayout, NLayoutHeader, NLayoutSider, NLayoutContent, NInput, NSpace, NButton, NIcon, NUpload, useMessage, useDialog, NSelect } from 'naive-ui';
import { ref, computed, nextTick, onMounted } from 'vue';
import { CloudUploadOutline as ImportIcon, CloudDownloadOutline as ExportIcon, InformationCircleOutline as AboutIcon, SettingsOutline as SettingsIcon, MenuOutline, ListOutline, AddOutline, SearchOutline } from '@vicons/ionicons5';
import CategoryList from '../components/CategoryList.vue';
import AboutDialog from '../components/dialogs/AboutDialog.vue';
import LibraryManagerDialog from '../components/dialogs/LibraryManagerDialog.vue';
import { useTagStore } from '../stores/tagStore';
import type { TagStoreTemplate } from '../types/data';
import { useRouter } from 'vue-router';
import { useLibraryStore } from '../stores/libraryStore';

const collapsed = ref(false);
const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();
const router = useRouter();
const parsedImportData = ref<TagStoreTemplate | null>(null);
const libraryStore = useLibraryStore();

// --- About Dialog State ---
const showAboutDialog = ref(false);
const showLibraryManager = ref(false);

// --- Search Input State ---
const isSearchVisible = ref(false);
const searchInputRef = ref<InstanceType<typeof NInput> | null>(null);

// Prepare options for NSelect from libraries
const libraryOptions = computed(() => 
  libraryStore.libraries.map(lib => ({ label: lib.name, value: lib.id }))
);

// Handle library switching
const handleLibrarySwitch = (libraryId: string | null) => {
  if (libraryId) {
    libraryStore.switchLibrary(libraryId);
  }
  // Handle null case? Maybe prevent selecting null if a library must always be active
};

// --- Import/Export Handlers ---
const handleNavigateToSettings = () => {
    router.push('/settings');
};

const handleExport = async () => {
    console.log('Exporting data...');
    try {
        const jsonString = await tagStore.exportDataAsJson();
        
        // Create a Blob from the JSON string
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        
        // Suggest a filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `tag-store-export-${timestamp}.json`; 
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Revoke the Blob URL to free up resources
        URL.revokeObjectURL(url);
        
        message.success('数据导出成功！');

    } catch (error: any) {
        console.error('Export failed:', error);
        message.error(`导出失败: ${error.message || '未知错误'}`);
    }
};

// Ref for the upload component (needed for manual trigger)
const uploadRef = ref<InstanceType<typeof NUpload> | null>(null);

const handleImportClick = () => {
    console.log('Import button clicked');
    // Manually trigger the hidden file input inside n-upload
    uploadRef.value?.openOpenFileDialog();
};

const handleFileChange = (options: { file: { file: File | null } }) => {
    const file = options.file.file;
    if (!file) {
        return;
    }
    if (!file.name.toLowerCase().endsWith('.json')) {
        message.error('请选择有效的 JSON 文件 (.json)');
        uploadRef.value?.clear();
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const content = e.target?.result;
            if (typeof content !== 'string') {
                throw new Error('无法读取文件内容');
            }
            const data = JSON.parse(content);

            // Basic validation
            if (!data || typeof data !== 'object' || !Array.isArray(data.categories) || !Array.isArray(data.tags)) {
                 throw new Error('JSON 文件格式无效，缺少 categories 或 tags 数组');
            }
            
            // Validation passed, store data and ask for confirmation
            parsedImportData.value = data as TagStoreTemplate;
            showImportConfirmation();

        } catch (error: any) {
            console.error("Error reading or parsing file:", error);
            message.error(`处理文件失败: ${error.message}`);
            parsedImportData.value = null;
        } finally {
            uploadRef.value?.clear();
        }
    };

    reader.onerror = (e) => {
        console.error("FileReader error:", e);
        message.error('读取文件时发生错误');
        uploadRef.value?.clear();
    };

    reader.readAsText(file);
};

// --- Import Confirmation Dialog --- 
const showImportConfirmation = () => {
    if (!parsedImportData.value) return;

    const categoryCount = parsedImportData.value.categories.length;
    const tagCount = parsedImportData.value.tags.length;
    const libraryName = parsedImportData.value.library?.name || '未知库'; // Get library name from file if available

    dialog.warning({
        title: '确认导入数据',
        content: `即将向当前活动标签库导入 ${categoryCount} 个分类和 ${tagCount} 个标签 (来自文件中的库 "${libraryName}")。请选择导入模式：`,
        positiveText: '合并 (保留当前库数据)',
        negativeText: '替换 (清空当前库数据)',
        maskClosable: false,
        onPositiveClick: () => {
             handleImportConfirm(false);
        },
        onNegativeClick: () => {
             handleImportConfirm(true);
        },
        onClose: () => {
            parsedImportData.value = null; 
        }
    });
};

// --- Handle Import Confirmation ---
const handleImportConfirm = async (clearExisting: boolean) => {
    if (!parsedImportData.value) return;
    
    const dataToImport = parsedImportData.value;
    parsedImportData.value = null; // Clear stored data

    message.info('开始导入数据...');
    await tagStore.importData(dataToImport, clearExisting); // Call store action

    // Check for errors from the store action
    if (tagStore.currentError) {
        message.error(`导入失败: ${tagStore.currentError}`);
        // Clear the error state in the store after displaying
        tagStore.currentError = null; 
    } else {
        message.success('数据导入成功！');
    }
};

// --- Search Input Handlers ---
const showSearchInput = () => {
  isSearchVisible.value = true;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
};

const handleSearchBlur = () => {
  // Only hide if the search term is empty
  if (!tagStore.searchTerm.trim()) {
    isSearchVisible.value = false;
  }
};

// Check initial search state on mount
onMounted(() => {
    if (tagStore.searchTerm.trim()) {
        isSearchVisible.value = true;
    }
});

</script>

<template>
  <n-layout style="height: 100vh">
    <n-layout-header style="height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--n-border-color);" bordered>
      <n-space align="center">
        <h2 style="margin: 0; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);">TagStore</h2>
      </n-space>
      <n-space align="center" style="flex-grow: 1; justify-content: center;">
        <!-- Search Input Area -->
         <n-input 
           v-if="isSearchVisible"
           ref="searchInputRef" 
           v-model:value="tagStore.searchTerm" 
           placeholder="搜索名称、副标题或关键词..."
           clearable
           style="width: 300px;" 
           @blur="handleSearchBlur"
         />
         <n-button v-else text @click="showSearchInput" title="搜索">
            <template #icon>
              <n-icon :component="SearchOutline" size="20" />
            </template>
         </n-button>
      </n-space>
      <n-space align="center">
        <!-- Hidden Upload Component for Import -->
        <n-upload 
          ref="uploadRef"
          :show-file-list="false" 
          accept=".json" 
          :custom-request="() => {}"  
          @change="handleFileChange"
          style="display: none;" 
        />
        <n-button ghost @click="handleImportClick">
          <template #icon>
            <n-icon :component="ImportIcon" />
          </template>
          导入
        </n-button>
        <n-button ghost @click="handleExport">
          <template #icon>
            <n-icon :component="ExportIcon" />
          </template>
          导出
        </n-button>
        <!-- About Button -->
        <n-button text @click="showAboutDialog = true" title="关于">
          <template #icon>
            <n-icon :component="AboutIcon" size="20" />
          </template>
        </n-button>
        <!-- Settings Button -->
        <n-button text @click="handleNavigateToSettings" title="设置">
          <template #icon>
            <n-icon :component="SettingsIcon" size="20" />
          </template>
        </n-button>
      </n-space>
    </n-layout-header>
    <n-layout has-sider style="height: calc(100vh - 64px)">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="240"
        :collapsed="collapsed"
        show-trigger
        @collapse="collapsed = true"
        @expand="collapsed = false"
        style="display: flex; flex-direction: column;"
      >
        <!-- Library Selector Area -->
        <div style="padding: 12px; border-bottom: 1px solid var(--n-border-color);">
          <n-space vertical size="small">
            <n-select 
              :value="libraryStore.activeLibraryId" 
              :options="libraryOptions"
              :disabled="libraryStore.isLoading || libraryStore.libraries.length === 0" 
              @update:value="handleLibrarySwitch"
              placeholder="选择标签库"
              size="small" 
            />
            <n-button block secondary strong size="small" @click="showLibraryManager = true" :disabled="libraryStore.isLoading">
               <template #icon>
                  <n-icon :component="SettingsIcon" />
               </template>
              管理标签库
            </n-button>
          </n-space>
        </div>

        <!-- Use the CategoryList component, passing collapsed state -->
        <CategoryList :collapsed="collapsed" />
      </n-layout-sider>
      <n-layout-content style="padding: 24px; background-color: var(--n-color);">
        <!-- Router view will render the main content here -->
        <router-view />
      </n-layout-content>
    </n-layout>

    <!-- About Dialog Component -->
    <AboutDialog v-model:show="showAboutDialog" />
    
    <!-- Library Manager Dialog Component -->
    <LibraryManagerDialog v-model:show="showLibraryManager" />

  </n-layout>
</template>

<style scoped>
/* Add layout-specific styles if needed */
.n-layout-header,
.n-layout-sider,
.n-layout-content {
  /* Optional: add transitions for smoother collapsing */
  transition: background-color 0.3s var(--n-bezier), color 0.3s var(--n-bezier);
}

/* Add styles if needed */
.n-layout-sider {
  /* Ensure the layout calculation works well */
  height: 100%; 
}
</style> 