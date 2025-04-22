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
    NInput,
    NList,
    NListItem
} from 'naive-ui';
import { useRouter } from 'vue-router';
import { CloudUploadOutline as ImportIcon, CloudDownloadOutline as ExportIcon } from '@vicons/ionicons5';
import { useSettingsStore } from '../stores/settingsStore';
import { useTagStore } from '../stores/tagStore';
import { useLibraryStore } from '../stores/libraryStore';
import type { TagStoreTemplate /* Library */ } from '../types/data'; // Restored TagStoreTemplate, Library remains removed

const router = useRouter();
const settingsStore = useSettingsStore();
const tagStore = useTagStore();
const libraryStore = useLibraryStore();
const message = useMessage();
const dialog = useDialog();

const parsedImportData = ref<TagStoreTemplate | null>(null);
const uploadRef = ref<InstanceType<typeof NUpload> | null>(null);

const handleBack = () => {
  router.push('/');
};

const handleThemeChange = (value: string | number | boolean) => {
    if (typeof value === 'string' && (value === 'light' || value === 'dark' || value === 'system')) {
        settingsStore.setThemeMode(value);
    }
};

const handleExport = async () => {
    console.log('Exporting data from settings...');
    try {
        const jsonString = await tagStore.exportDataAsJson();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const activeLibraryName = libraryStore.activeLibrary?.name || 'current-library';
        link.download = `tag-store-export-${activeLibraryName.replace(/\s+/g, '_')}-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        message.success('当前标签库数据导出成功！');
    } catch (error: any) {
        console.error('Export failed:', error);
        message.error(`导出失败: ${error.message || '未知错误'}`);
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
    const categoryCount = parsedImportData.value.categories.length;
    const tagCount = parsedImportData.value.tags.length;
    const libraryName = parsedImportData.value.library?.name || '未知库';
    dialog.warning({
        title: '确认导入数据',
        content: `即将向当前活动标签库导入 ${categoryCount} 个分类和 ${tagCount} 个标签 (来自文件中的库 "${libraryName}")。请选择导入模式：`,
        positiveText: '合并 (保留当前库数据)',
        negativeText: '替换 (清空当前库数据)',
        maskClosable: false,
        onPositiveClick: () => { handleImportConfirm(false); },
        onNegativeClick: () => { handleImportConfirm(true); },
        onClose: () => { parsedImportData.value = null; }
    });
};

const handleImportConfirm = async (clearExisting: boolean) => {
    if (!parsedImportData.value) return;
    const dataToImport = parsedImportData.value;
    parsedImportData.value = null; 
    message.info('开始导入数据...');
    await tagStore.importData(dataToImport, clearExisting); 
    if (tagStore.currentError) {
        message.error(`导入失败: ${tagStore.currentError}`);
        tagStore.currentError = null; 
    } else {
        message.success('数据导入成功！');
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

    <n-space vertical>
      <n-card title="外观">
        <n-space align="center">
           <span>主题模式:</span>
           <n-radio-group 
             :value="settingsStore.themeMode" 
             @update:value="handleThemeChange"
             name="theme-mode"
            >
             <n-radio-button value="light">浅色</n-radio-button>
             <n-radio-button value="dark">深色</n-radio-button>
             <n-radio-button value="system">跟随系统</n-radio-button>
           </n-radio-group>
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
                 <n-button ghost @click="handleExport">
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
</style> 