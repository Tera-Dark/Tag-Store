<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  NTabs, 
  NTabPane,
  NSelect,
  NDivider,
  NButton,
  NSpace,
  NInput,
  NSwitch,
  NList,
  NListItem,
  NEmpty,
  NIcon,
  NTag,
  useMessage,
  useDialog,
  NModal
} from 'naive-ui';
import { 
  AddCircleOutline as AddIcon,
  TrashOutline as DeleteIcon,
  CreateOutline as EditIcon,
  SettingsOutline as SettingsIcon,
  CodeOutline as TemplateIcon,
  DocumentTextOutline as PromptIcon,
  CloudUploadOutline as ImportIcon,
  CloudDownloadOutline as ExportIcon,
} from '@vicons/ionicons5';

// 导入Store
import { useAiExpandStore } from '../../stores/aiExpandStore';
import { ref as vRef } from 'vue';
import type { PromptTemplate, HistoryItem } from '../../types/aiExpand';

// 使用Store
const aiExpandStore = useAiExpandStore();

// 消息提示
const message = useMessage();
// 对话框服务
const dialog = useDialog();

// 本地UI状态
const activeTab = ref('templates');
const showTemplateEditor = ref(false);
const showTemplateManager = ref(false);
const editingTemplate = ref<PromptTemplate | null>(null);
const fileInputRef = vRef<HTMLInputElement | null>(null);

// 计算属性
const providerOptions = computed(() => {
  try {
    const provOptions = aiExpandStore.providerOptions;
    if (Array.isArray(provOptions)) {
      return provOptions
        .filter(opt => opt && typeof opt === 'object' && 'label' in opt && 'value' in opt)
        .map(opt => ({
          label: String(opt.label || '未命名服务商'),
          value: String(opt.value || '')
        }));
    }
    return [];
  } catch (error) {
    console.error('计算服务商选项失败:', error);
    return [];
  }
});

const modelOptions = computed(() => {
  try {
    // Assuming aiExpandStore.modelOptions is reactive to the selected provider
    // and provides options in a format compatible with NSelect.
    const modOptions = aiExpandStore.modelOptions;
    if (Array.isArray(modOptions)) {
      return modOptions
        .filter(opt => opt && typeof opt === 'object' && 'label' in opt && 'value' in opt)
        .map(opt => ({
          label: String(opt.label || '未命名模型'),
          value: String(opt.value || ''),
          disabled: opt.type === 'group' // Disable options if they are marked as 'group' type
        }));
    }
    return [];
  } catch (error) {
    console.error('计算模型选项失败:', error);
    return [];
  }
});

// 处理模型选择 - simplified as v-model will handle store update via setter
const handleModelSelect = (modelId: string) => {
  if (modelId && !modelId.startsWith('group-')) {
    console.log('Model selected:', modelId);
    aiExpandStore.selectedModel = modelId; // Direct assignment
    // aiExpandStore.setSelectedModel(modelId); // Ensure store has this setter - Removed
  }
};

// 处理提供商选择 - simplified
const handleProviderSelect = (providerId: string) => {
  console.log('Provider selected:', providerId);
  aiExpandStore.selectedProvider = providerId; // Direct assignment
  // aiExpandStore.setSelectedProvider(providerId); // Ensure store has this setter - Removed
};

// 格式化时间戳
const formatTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch (e) {
    return timestamp; // Return original if parsing fails
  }
};

// 保存当前提示词为模板
const saveAsTemplate = (): void => {
  if (!aiExpandStore.customPrompt) {
    message.error('请先输入自定义提示词');
    return;
  }
  
  const timestamp = Date.now();
  const templateValue = `custom_${timestamp}`;
  // Ensure label is unique or informative
  const templateLabel = `自定义模板 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  
  const newTemplate: PromptTemplate = {
    label: templateLabel,
    value: templateValue,
    content: aiExpandStore.customPrompt
  };
  
  aiExpandStore.saveNewTemplate(newTemplate); // Ensure store has this method
  message.success('模板保存成功');
};

// 处理模板编辑
const handleEditTemplate = (template: PromptTemplate): void => {
  editingTemplate.value = JSON.parse(JSON.stringify(template)); // Deep copy for editing
  showTemplateEditor.value = true;
};

// 处理模板删除
const handleDeleteTemplate = (templateValue: string): void => {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这个模板吗？此操作不可撤销。',
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: () => {
      aiExpandStore.deleteTemplate(templateValue); // Ensure store has this method
      message.success('模板已删除');
      // If the deleted template was being edited, close editor
      if (editingTemplate.value && editingTemplate.value.value === templateValue) {
        showTemplateEditor.value = false;
        editingTemplate.value = null;
      }
    }
  });
};

// 打开模板管理器
const openTemplateManager = (): void => {
  showTemplateManager.value = true;
};

// 导出模板
const exportTemplates = (): void => {
  try {
    const templatesToExport = aiExpandStore.templates;
    if (!templatesToExport || templatesToExport.length === 0) {
      message.info('没有模板可导出');
      return;
    }
    const jsonStr = JSON.stringify(templatesToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_expand_templates.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('模板导出成功');
  } catch (error: any) {
    console.error('导出模板失败:', error);
    message.error('模板导出失败: ' + (error.message || '未知错误'));
  }
};

// 处理导入点击
const handleImportClick = (): void => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

// 处理文件导入
const handleFileInput = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    try {
      const content = e.target?.result as string;
      const importedTemplates = JSON.parse(content) as PromptTemplate[];
      // Basic validation for imported templates
      if (!Array.isArray(importedTemplates) || !importedTemplates.every(t => t.label && t.value && t.content !== undefined)) {
        throw new Error('文件内容格式不正确，不是有效的模板数组。');
      }
      // aiExpandStore.importTemplates(importedTemplates); // TODO: Ensure store has this method to handle array of PromptTemplate
      message.success(`成功导入 ${importedTemplates.length} 个模板 (功能待Store实现)`);
    } catch (error: any) {
      console.error('模板导入失败:', error);
      message.error('模板导入失败: ' + (error.message || '未知错误'));
    } finally {
      if (target) target.value = ''; // Reset file input
    }
  };
  reader.onerror = () => {
    message.error('读取文件失败');
    if (target) target.value = ''; // Reset file input
  };
  reader.readAsText(file);
};

// 处理历史记录点击
const handleHistoryItemClick = (item: HistoryItem): void => {
  aiExpandStore.inputContent = item.input;
  aiExpandStore.outputContent = item.output;
};

// 清空历史记录
const clearHistory = (): void => {
  dialog.warning({
    title: '确认清空',
    content: '确定要清空所有历史记录吗？此操作不可撤销。',
    positiveText: '确定清空',
    negativeText: '取消',
    onPositiveClick: () => {
      aiExpandStore.clearAllHistory(); // Ensure store has this method
      message.success('历史记录已清空');
    }
  });
};

// 创建新对话
const createNewConversation = (): void => {
  aiExpandStore.createNewConversation(); // Ensure store has this method
  message.success('已创建新对话');
};

// 处理设置抽屉
const handleOpenSettingsDrawer = (): void => {
  try {
    aiExpandStore.showSettingsDrawer = true;
  } catch (error) {
    console.error('打开设置抽屉失败:', error);
    // message.error('打开设置失败'); // Optionally add user message
  }
};

// 新增：保存模板更改
const saveTemplateChanges = (): void => {
  if (!editingTemplate.value) {
    message.error('没有正在编辑的模板');
    return;
  }
  if (!editingTemplate.value.label.trim()) {
    message.error('模板名称不能为空');
    return;
  }
  if (!editingTemplate.value.content.trim()) {
    message.error('模板内容不能为空');
    return;
  }

  // TODO: Implement aiExpandStore.updateTemplate(editingTemplate.value) in the store
  // For now, let's assume it exists and works or simulate the update for UI purposes.
  // aiExpandStore.updateTemplate(editingTemplate.value);
  const index = aiExpandStore.templates.findIndex(t => t.value === editingTemplate.value!.value);
  if (index !== -1) {
    // This is a temporary direct mutation for demonstration if store action is not yet available.
    // Replace with store action call: aiExpandStore.updateTemplate(editingTemplate.value);
    aiExpandStore.templates[index] = { ...editingTemplate.value }; 
    message.success('模板更新成功 (请在Store中实现updateTemplate)');
  } else {
    message.error('未找到要更新的模板，请检查');
  }

  showTemplateEditor.value = false;
  editingTemplate.value = null;
};
</script>

<template>
  <div class="sidebar-container">
    <NTabs v-model:value="activeTab" type="segment" size="large">
      <!-- 模板标签页 -->
      <NTabPane name="templates" tab="提示词模板">
        <div class="tab-content">
          <!-- 模板选择 -->
          <div class="section-title">选择模板</div>
          <NSelect
            v-model:value="aiExpandStore.selectedTemplate"
            :options="aiExpandStore.templates"
            placeholder="选择提示词模板"
            clearable 
          />
          
          <!-- 自定义提示词 -->
          <div class="section-toggle">
            <div class="toggle-label">自定义提示词</div>
            <NSwitch 
              v-model:value="aiExpandStore.useCustomPrompt"
            />
          </div>
          
          <div v-if="aiExpandStore.useCustomPrompt" class="custom-prompt-section">
            <NInput
              v-model:value="aiExpandStore.customPrompt"
              type="textarea"
              placeholder="输入自定义提示词，使用{content}作为占位符"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
            <NSpace justify="end" class="action-space">
              <NButton size="small" @click="saveAsTemplate">
                保存为模板
              </NButton>
            </NSpace>
          </div>
          
          <!-- 模板管理 -->
          <NDivider dashed>模板管理</NDivider>
          <NSpace vertical>
            <NButton block @click="openTemplateManager">
              <template #icon>
                <NIcon><TemplateIcon /></NIcon>
              </template>
              管理模板
            </NButton>
            <NSpace justify="space-between">
              <NButton @click="exportTemplates">
                <template #icon>
                  <NIcon><ExportIcon /></NIcon>
                </template>
                导出模板
              </NButton>
              <NButton @click="handleImportClick">
                <template #icon>
                  <NIcon><ImportIcon /></NIcon>
                </template>
                导入模板
              </NButton>
              <input
                type="file"
                ref="fileInputRef"
                style="display: none"
                accept=".json,application/json"
                @change="handleFileInput"
              />
            </NSpace>
          </NSpace>
        </div>
      </NTabPane>
      
      <!-- 历史记录标签页 -->
      <NTabPane name="history" tab="历史记录">
        <div class="tab-content">
          <div class="section-header">
            <div class="section-title">最近记录</div>
            <div class="section-actions">
              <NButton size="small" type="error" @click="clearHistory">
                清空
              </NButton>
              <NButton size="small" type="primary" @click="createNewConversation">
                <template #icon>
                  <NIcon><AddIcon /></NIcon>
                </template>
                新对话
              </NButton>
            </div>
          </div>
          
          <div class="history-list">
            <template v-if="aiExpandStore.history && aiExpandStore.history.length > 0">
              <div
                v-for="(item, index) in aiExpandStore.history"
                :key="index"
                class="history-item"
                @click="handleHistoryItemClick(item)"
              >
                <div class="history-item-content">
                  {{ item.input.length > 30 ? item.input.substring(0, 30) + '...' : item.input }}
                </div>
                <div class="history-item-meta">
                  <div class="history-item-time">{{ formatTime(item.timestamp) }}</div>
                  <NTag size="small" :bordered="false" :color="{ color: '#e9f5fe', textColor: '#4b9cf5' }">
                    {{ item.provider }} <!-- Assuming provider is a string label -->
                  </NTag>
                </div>
              </div>
            </template>
            <NEmpty v-else description="暂无历史记录" />
          </div>
        </div>
      </NTabPane>
      
      <!-- 服务商标签页 -->
      <NTabPane name="providers" tab="AI服务商">
        <div class="tab-content">
          <!-- 服务提供商选择 -->
          <div class="section-title">选择服务提供商</div>
          <NSelect
            v-if="providerOptions.length > 0"
            v-model:value="aiExpandStore.selectedProvider"
            :options="providerOptions"
            placeholder="选择服务提供商"
            clearable
            @update:value="handleProviderSelect" 
          />
          <NEmpty v-else description="没有可用的服务提供商" size="small" />
          
          <!-- 模型选择 -->
          <div class="section-title" style="margin-top: 16px;">选择模型</div>
          <NSelect
            v-if="modelOptions.length > 0"
            v-model:value="aiExpandStore.selectedModel"
            :options="modelOptions"
            placeholder="选择模型"
            clearable
            @update:value="handleModelSelect"
          />
          <NEmpty v-else description="当前服务商没有可用的模型或未选择服务商" size="small" />
          
          <!-- 设置按钮 -->
          <NButton
            block
            type="primary"
            class="settings-button"
            @click="handleOpenSettingsDrawer"
          >
            <template #icon>
              <NIcon><SettingsIcon /></NIcon>
            </template>
            服务商设置
          </NButton>
      </div>
      </NTabPane>
    </NTabs>

    <!-- 模板管理模态框 -->
    <NModal
      v-model:show="showTemplateManager"
      preset="card"
      style="width: 600px;"
      title="管理提示词模板"
      class="template-management-modal"
    >
      <NList bordered class="template-list-container" v-if="aiExpandStore.templates && aiExpandStore.templates.length > 0">
        <NListItem 
            v-for="template_item in aiExpandStore.templates" 
            :key="template_item.value" 
            class="template-list-item"
        >
          <template #prefix>
            <NIcon><PromptIcon /></NIcon>
          </template>
          <span class="template-item-label">{{ template_item.label }}</span>
          <template #suffix>
            <NSpace align="center">
              <NButton size="small" type="default" text @click="handleEditTemplate(template_item)">
                <template #icon><NIcon><EditIcon /></NIcon></template>
                编辑
              </NButton>
              <NButton size="small" type="error" text @click="handleDeleteTemplate(template_item.value)">
                <template #icon><NIcon><DeleteIcon /></NIcon></template>
                删除
              </NButton>
            </NSpace>
          </template>
        </NListItem>
      </NList>
      <NEmpty v-else description="没有可管理的模板。您可以先保存一些自定义提示词作为模板。" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showTemplateManager = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 编辑模板模态框 -->
    <NModal
      v-model:show="showTemplateEditor"
      preset="card"
      style="width: 500px;"
      title="编辑模板"
      :closable="true"
      @after-leave="editingTemplate = null"
    >
      <div v-if="editingTemplate">
        <NSpace vertical>
          <div>
            <label class="modal-label">模板名称:</label>
            <NInput v-model:value="editingTemplate.label" placeholder="请输入模板名称" />
          </div>
          <div>
            <label class="modal-label">模板内容:</label>
            <NInput
              v-model:value="editingTemplate.content"
              type="textarea"
              placeholder="请输入模板内容，使用{content}作为占位符"
              :autosize="{ minRows: 5, maxRows: 10 }"
            />
          </div>
        </NSpace>
      </div>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showTemplateEditor = false">取消</NButton>
          <NButton type="primary" @click="saveTemplateChanges">保存更改</NButton>
        </NSpace>
      </template>
    </NModal>

  </div>
</template>

<style scoped>
.sidebar-container {
  height: 100%;
  overflow-y: auto;
  padding: 0; /* Remove padding here, will be handled by NTabs or tab-content */
  box-sizing: border-box;
  background-color: var(--n-card-color); /* Match AiExpandView's control-panel */
}

:deep(.n-tabs .n-tabs-nav.n-tabs-nav--top.n-tabs-nav--segment-type) {
  padding: 12px 12px 0 12px; /* Padding around the tab buttons */
  margin-bottom: 0; /* Remove default bottom margin if any */
  background-color: transparent;
}

:deep(.n-tabs .n-tabs-nav--segment-type .n-tabs-tab) {
  font-size: 13.5px; /* Slightly smaller tab font */
  font-weight: 500;
  padding: 6px 12px; /* Adjust tab button padding */
  border-radius: 6px !important; /* Consistent rounded corners for tabs */
}

:deep(.n-tabs .n-tabs-pane) {
  padding: 0; /* Remove default padding from tab pane wrapper */
}

.tab-content {
  padding: 16px; /* Padding for the content within each tab pane */
  display: flex;
  flex-direction: column;
  gap: 20px; /* Increased gap for better separation of sections */
}

.section-title {
  font-weight: 600; /* Bolder section titles */
  margin-bottom: 10px; /* Space below title */
  margin-top: 8px; /* Space above title, if not first */
  color: var(--n-text-color-1);
  font-size: 14px; /* Slightly larger section title */
  border-left: 3px solid var(--n-primary-color-hover); /* Accent border */
  padding-left: 10px;
}
.section-title:first-child {
  margin-top: 0;
}

.section-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px 0; /* Adjusted margin */
  padding: 8px 4px; /* Added padding for better touch area if needed */
  /* background-color: var(--n-action-color); */ /* Optional subtle background */
  /* border-radius: 6px; */
}

.toggle-label {
  font-weight: 500;
  font-size: 13.5px;
  color: var(--n-text-color-2);
  margin-right: 8px;
}

.custom-prompt-section {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px; /* Space between textarea and button */
}

.action-space {
  margin-top: 4px; /* Reduced top margin */
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.history-list {
  margin-top: 8px; /* Reduced margin */
  max-height: 320px; /* Slightly more max height */
  overflow-y: auto;
  padding-right: 4px; /* Space for scrollbar if it appears */
}

.history-item {
  padding: 10px 12px;
  border-radius: 6px; /* Softer radius */
  background-color: var(--n-action-color); /* Subtle background */
  border: 1px solid transparent; /* Placeholder for hover border */
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.history-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.06);
  border-color: var(--n-primary-color-hover);
  background-color: var(--n-card-color);
}

.history-item-content {
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--n-text-color-1);
  word-break: break-all;
}

.history-item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px; /* Smaller meta text */
  color: var(--n-text-color-3);
}
.history-item-time {
  margin-right: 8px;
}

.settings-button {
  margin-top: 20px;
}

/* General Naive UI component tweaks within sidebar */
:deep(.n-select .n-base-selection) {
  border-radius: 6px !important;
}

:deep(.n-input .n-input__input-el, .n-input .n-input__textarea-el) {
  font-size: 13.5px;
}

:deep(.n-button) {
  border-radius: 6px !important;
  font-size: 13.5px;
}

:deep(.n-divider) {
  margin: 20px 0 16px 0;
}

/* Modal styles (remain largely controlled by Naive UI, but minor tweaks if needed) */
.template-list-container {
  margin-bottom: 16px;
  max-height: 40vh;
  overflow-y: auto;
}

.template-list-item {
  display: flex;
  align-items: center;
  padding-top: 10px !important; /* Consistent padding */
  padding-bottom: 10px !important;
  transition: background-color 0.2s ease-in-out;
  border-radius: 4px;
}

.template-list-item:hover {
  background-color: var(--n-action-color);
}

.template-item-label {
  flex-grow: 1;
  margin-left: 10px;
  margin-right: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13.5px;
}

:deep(.template-list-item .n-list-item__prefix) {
  display: flex;
  align-items: center;
}

:deep(.template-list-item .n-list-item__suffix) {
  display: flex;
  align-items: center;
}

.modal-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 14px;
}

/* No specific responsive styles needed here if AiExpandView handles sidebar visibility */

</style> 