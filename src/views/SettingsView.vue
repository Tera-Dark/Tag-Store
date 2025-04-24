<script setup lang="ts">
import { ref } from 'vue';
import { 
    NPageHeader, 
    NCard, 
    NSpace, 
    NDivider, 
    NRadioGroup, 
    NRadioButton, 
    NButton,
    NIcon,
    NUpload,
    useMessage,
    useDialog,
    NInputNumber,
    NSlider
} from 'naive-ui';
import { useRouter } from 'vue-router';
import { CloudUploadOutline as ImportIcon, CloudDownloadOutline as ExportIcon } from '@vicons/ionicons5';
import { useSettingsStore } from '../stores/settingsStore';
import { useTagStore } from '../stores/tagStore';
import { useLibraryStore } from '../stores/libraryStore';
import type { TagStoreTemplate } from '../types/data'; // Restored TagStoreTemplate
import type { ThemeMode } from '@/types/settings'; // Import ThemeMode for type assertion

const router = useRouter();
const settingsStore = useSettingsStore();
const tagStore = useTagStore();
const libraryStore = useLibraryStore();
const message = useMessage();
const dialog = useDialog();

const parsedImportData = ref<TagStoreTemplate | null>(null);
const uploadRef = ref<InstanceType<typeof NUpload> | null>(null);
const isExporting = ref(false);
const isImporting = ref(false);

const handleBack = () => {
  router.push('/');
};

const handleThemeChange = (value: string | number | boolean) => {
    if (typeof value === 'string' && (value === 'light' || value === 'dark' || value === 'system')) {
        settingsStore.updateSetting('themeMode', value as ThemeMode);
    }
};

const handleGlobalFontSizeChange = (value: number | null) => {
  if (value !== null) {
    settingsStore.updateSetting('globalFontSize', value);
  }
};

const handleHistorySizeChange = (value: number | null) => {
  if (value !== null) {
    settingsStore.updateSetting('tagDrawerHistorySize', value);
  }
};

const exportToJson = async () => {
  if (!libraryStore.activeLibraryId) {
      message.error('没有活动的库，无法导出');
      return;
  }
  isExporting.value = true;
  try {
    // Use the new export method from tagStore
    const dataToExport = await tagStore.exportLibraryData(); 

    if (!dataToExport) {
      message.error('导出数据失败，未获取到数据');
      return;
    }

    // Add library name to the export data if it exists in libraryStore
    if (libraryStore.activeLibrary?.name) {
        dataToExport.library.name = libraryStore.activeLibrary.name;
    }

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const libraryName = libraryStore.activeLibrary?.name || 'exported_library';
    const filename = `${libraryName}_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.download = filename; // Use library name and date for filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('数据已导出为 JSON 文件');
  } catch (error: any) {
    console.error('Export failed:', error);
    message.error(`导出失败: ${error.message}`);
  } finally {
    isExporting.value = false;
  }
};

const handleImportClick = () => {
    uploadRef.value?.openOpenFileDialog();
};

const handleFileChange = (options: { file: { file: File | null } }) => {
    const file = options.file.file;
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
        message.error('请选择有效的 JSON 文件 (.json)');
        uploadRef.value?.clear();
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result;
            if (typeof content !== 'string') throw new Error('无法读取文件内容');
            const data = JSON.parse(content);
            if (!data || typeof data !== 'object' || !Array.isArray(data.categories) || !Array.isArray(data.tags)) {
                 throw new Error('JSON 文件格式无效，缺少 categories 或 tags 数组');
            }
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

const showImportConfirmation = () => {
    if (!parsedImportData.value) return;
    const libraryName = parsedImportData.value.library?.name || '未知库';
    let categoryCount = 0;
    let tagCount = 0;
    if (parsedImportData.value.groups) {
        for (const group of parsedImportData.value.groups) {
            if (group.categories) {
                categoryCount += group.categories.length;
                for (const category of group.categories) {
                    if (category.tags) {
                        tagCount += category.tags.length;
                    }
                }
            }
        }
    }

    dialog.warning({
        title: '确认导入数据',
        content: `即将向当前活动标签库导入 ${categoryCount} 个分类和 ${tagCount} 个标签 (来自文件中的库 "${libraryName}")。注意：此操作将替换当前库的所有内容。`,
        positiveText: '确认替换并导入', 
        negativeText: '取消',
        maskClosable: false,
        onPositiveClick: () => { handleImportConfirm(); }, 
        onNegativeClick: () => { parsedImportData.value = null; uploadRef.value?.clear(); },
        onClose: () => { parsedImportData.value = null; uploadRef.value?.clear(); }
    });
};

const handleImportConfirm = async () => { 
    if (!parsedImportData.value) return;
    if (!libraryStore.activeLibraryId) { 
        message.error('没有选中的库作为导入目标');
        return;
    }
    const dataToImport = parsedImportData.value;
    const targetLibraryId = libraryStore.activeLibraryId;
    
    parsedImportData.value = null; 
    message.info('开始导入数据...');
    isImporting.value = true;
    try {
      await tagStore.importData(dataToImport, targetLibraryId); 
      if (tagStore.currentError) {
          message.error(`导入失败: ${tagStore.currentError}`);
          tagStore.currentError = null; 
      } else {
          message.success('数据导入成功！');
          uploadRef.value?.clear();
      }
    } catch (error: any) {
        console.error("Import confirmation failed:", error);
        message.error(`导入操作失败: ${error.message}`);
    } finally {
       isImporting.value = false;
    }
};

</script>

<template>
  <div class="settings-view">
    <n-page-header title="设置" @back="handleBack">
      <template #subtitle>
        管理应用配置
      </template>
    </n-page-header>

    <n-divider />

    <n-space vertical size="large">
      <n-card title="外观">
        <n-space vertical>
          <n-space align="center">
             <span style="width: 100px; flex-shrink: 0;">主题模式:</span>
             <n-radio-group 
               :value="settingsStore.settings.themeMode" 
               @update:value="handleThemeChange"
               name="theme-mode"
              >
               <n-radio-button value="light">浅色</n-radio-button>
               <n-radio-button value="dark">深色</n-radio-button>
               <n-radio-button value="system">跟随系统</n-radio-button>
             </n-radio-group>
          </n-space>
          
          <n-space align="center" justify="space-between" style="flex-wrap: nowrap;">
             <span style="width: 100px; flex-shrink: 0;">全局字号 (px):</span>
             <n-space align="center" :wrap="false" style="flex-grow: 1;">
               <n-slider 
                  :value="settingsStore.settings.globalFontSize" 
                  @update:value="handleGlobalFontSizeChange"
                  :min="12" 
                  :max="22"
                  :step="1" 
                  style="flex-grow: 1; margin: 0 10px; min-width: 150px;"
                />
                <n-input-number
                  :value="settingsStore.settings.globalFontSize"
                  @update:value="handleGlobalFontSizeChange"
                  size="small"
                  :min="12"
                  :max="22"
                  style="width: 80px; flex-shrink: 0;"
                />
             </n-space>
          </n-space>
        </n-space>
      </n-card>
      
      <n-card title="工具设置">
        <n-space vertical>
          <n-space align="center">
            <span style="width: 150px; flex-shrink: 0;">标签抽取历史数量:</span>
            <n-input-number
              :value="settingsStore.settings.tagDrawerHistorySize"
              @update:value="handleHistorySizeChange"
              size="small"
              :min="5" 
              :max="100"
              :step="5"
              style="width: 100px;"
            />
          </n-space>
        </n-space>
      </n-card>
      
      <n-card title="数据管理">
         <n-space vertical>
            <p>管理当前活动标签库的数据导入和导出。</p>
            <n-upload 
               ref="uploadRef"
               :show-file-list="false" 
               accept=".json" 
               :custom-request="() => {}"  
               @change="handleFileChange"
               style="display: none;" 
             />
            <n-space>
                 <n-button ghost @click="handleImportClick">
                   <template #icon>
                     <n-icon :component="ImportIcon" />
                   </template>
                   导入 JSON
                 </n-button>
                 <n-button ghost @click="exportToJson">
                   <template #icon>
                     <n-icon :component="ExportIcon" />
                   </template>
                   导出当前库为 JSON
                 </n-button>
            </n-space>
             <p style="font-size: 0.9em; color: grey;">导入功能会将文件内容合并或替换到您当前选中的标签库中。导出功能仅导出当前选中的标签库。</p>
         </n-space>
      </n-card>
      
       <!-- Add more setting categories as needed -->

    </n-space>
  </div>
</template>

<style scoped>
.settings-view {
  max-width: 800px; /* Limit width for readability */
  margin: 0 auto; /* Center the content */
  padding: 20px;
}
.n-card {
  margin-bottom: 16px; /* Add space between cards */
}
</style> 