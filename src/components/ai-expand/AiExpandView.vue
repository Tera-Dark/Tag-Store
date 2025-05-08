<script setup lang="ts">
import { onMounted, computed } from 'vue';
import type { ServiceProvider, AdvancedOptions, Model, PromptTemplate } from '../../types/aiExpand';
import {
  useMessage,
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NModal,
  NIcon,
  NPopover,
  NInput,
  NButton,
  NPageHeader,
  NCard,
  NSpace,
  NText,
  NSpin,
  NAlert,
  NGlobalStyle
} from 'naive-ui';
import { useRouter } from 'vue-router';
import { 
  ArrowBackOutline as BackIcon,
  HelpCircleOutline as HelpIcon,
  SettingsOutline as SettingsIcon,
  SendOutline as SendIcon,
} from '@vicons/ionicons5';

// 导入Store
import { useAiExpandStore } from '../../stores/aiExpandStore';

// 导入子组件
import SidebarContainer from './SidebarContainer.vue';
import SettingsDrawer from './SettingsDrawer.vue';
import PromptTemplateManager from './PromptTemplateManager.vue';

// 获取路由
const router = useRouter();

// 消息提示
const message = useMessage();

// 使用Store
const aiExpandStore = useAiExpandStore();

// 新增：计算属性，用于显示选择的服务商、模型、模板名称
const currentProviderName = computed(() => {
  return aiExpandStore.serviceProviders[aiExpandStore.selectedProvider]?.name || '未选择';
});

const currentModelName = computed(() => {
  const provider = aiExpandStore.serviceProviders[aiExpandStore.selectedProvider];
  if (provider && provider.modelGroups) {
    for (const group of provider.modelGroups) {
      const model = group.models.find(m => m.id === aiExpandStore.selectedModel);
      if (model) return model.name;
    }
  }
  return aiExpandStore.selectedModel || '未选择';
});

const currentTemplateName = computed(() => {
  if (!aiExpandStore.selectedTemplate) return '无';
  const template = aiExpandStore.templates.find(t => t.value === aiExpandStore.selectedTemplate);
  return template?.label || '自定义/未知模板';
});

// 初始化
onMounted(async () => {
  try {
    console.log('初始化AI扩写工具...');
    
    // 初始化Store
    await aiExpandStore.initialize();
    
    // 检查是否首次使用
    const firstUse = localStorage.getItem('aiExpand_firstUse') !== 'false';
    if (firstUse) {
      // 显示帮助提示
      aiExpandStore.showHelpModal = true;
      localStorage.setItem('aiExpand_firstUse', 'false');
    }
    
    console.log('AI扩写工具初始化完成!');
  } catch (error) {
    console.error('初始化AI扩写工具失败:', error);
    message.error('初始化失败，请尝试刷新页面或重置应用');
  }
});

// 返回工具箱
const handleBack = () => {
  router.push('/toolbox');
};

// 发送请求到AI
const handleSendToAI = async () => {
  if (!aiExpandStore.inputContent) {
    message.warning('请输入内容后再请求AI');
    return;
  }
  
  if (aiExpandStore.isProcessing) {
    message.warning('正在处理请求，请稍候');
    return;
  }
  
  try {
    await aiExpandStore.sendToAI();
    message.success('AI处理完成');
  } catch (error: any) {
    message.error(error.message || '请求失败，请稍后重试');
  }
};

// 取消请求
const handleCancelRequest = () => {
  // 调用 store 中的取消请求方法
  aiExpandStore.cancelRequest();
  message.info('已取消请求');
};

// 清空输入
const handleClearInput = () => {
  aiExpandStore.inputContent = '';
};

// 清空输出
const handleClearOutput = () => {
  aiExpandStore.outputContent = '';
};

// 新增：复制输出结果
const handleCopyOutput = async () => {
  if (!aiExpandStore.outputContent) {
    message.warning('没有可复制的内容');
    return;
  }
  try {
    await navigator.clipboard.writeText(aiExpandStore.outputContent);
    message.success('结果已复制到剪贴板');
  } catch (err) {
    console.error('无法复制文本: ', err);
    message.error('复制失败，请检查浏览器权限或手动复制');
  }
};

// 显示设置抽屉
const showSettings = () => {
  aiExpandStore.showSettingsDrawer = true;
};

// 显示帮助
const showHelp = () => {
  aiExpandStore.showHelpModal = true;
};

// --- SettingsDrawer Event Handlers ---
const handleSettingsDrawerUpdateShow = (value: boolean) => {
  aiExpandStore.showSettingsDrawer = value;
};

const handleSettingsDrawerSelectProvider = (providerId: string) => {
  aiExpandStore.$patch({
    selectedProvider: providerId,
    selectedModel: aiExpandStore.serviceProviders[providerId]?.defaultModel || ''
  });
};

const handleSettingsDrawerUpdateProviderApiKey = (payload: { id: string; apiKey: string }) => {
  aiExpandStore.updateProvider(payload.id, { apiKey: payload.apiKey });
};

const handleSettingsDrawerAddCustomProvider = (providerData: ServiceProvider) => {
  const newCustomProvider = { ...providerData, isCustom: true };
  aiExpandStore.updateProvider(newCustomProvider.id, newCustomProvider);
};

const handleSettingsDrawerDeleteCustomProvider = (providerId: string) => {
  aiExpandStore.deleteProvider(providerId);
};

const handleSettingsDrawerUpdateAdvancedOption = (payload: { key: keyof AdvancedOptions; value: any }) => {
  aiExpandStore.$patch(state => {
    if (!state.advancedOptions) {
      state.advancedOptions = {} as AdvancedOptions;
    }
    (state.advancedOptions as any)[payload.key] = payload.value;
  });
};

const handleSettingsDrawerUpdateModelConfig = (config: { providerId: string; modelId: string; updates: Partial<Model> }) => {
  console.warn('Updating model config from AiExpandView is not fully implemented. Store action needed.', config);
};

// --- PromptTemplateManager Event Handlers ---
const handleTemplateManagerUpdateShow = (value: boolean) => {
  aiExpandStore.showTemplateManager = value;
};

const handleTemplateManagerSelectTemplate = (templateValue: string) => {
  aiExpandStore.$patch({ selectedTemplate: templateValue });
};

const handleTemplateManagerSaveNewTemplate = (template: PromptTemplate) => {
  aiExpandStore.saveNewTemplate(template);
};

const handleTemplateManagerDeleteTemplate = (templateValue: string) => {
  aiExpandStore.deleteTemplate(templateValue);
};

const handleTemplateManagerUpdateTemplate = (template: PromptTemplate) => {
  aiExpandStore.updateTemplate(template);
};

const handleTemplateManagerUpdateCustomPrompt = (prompt: string) => {
  aiExpandStore.customPrompt = prompt;
};

const handleExportTemplates = () => {
  try {
    const templatesJson = JSON.stringify(aiExpandStore.templates, null, 2);
    const blob = new window.Blob([templatesJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `ai_templates_${new Date().toISOString().split('T')[0]}.json`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    message.success('模板导出成功');
  } catch (error) {
    console.error('导出模板失败:', error);
    message.error('导出失败');
  }
};

const handleImportTemplates = (file: File) => {
  if (!file) {
    message.warning('未选择文件');
    return;
  }
  const reader = new window.FileReader();
  reader.onload = (event: ProgressEvent<FileReader>) => {
    try {
      const content = event.target?.result as string;
      const importedTemplates = JSON.parse(content);
      if (Array.isArray(importedTemplates) && importedTemplates.every((t: any) => t.label && t.value && t.content)) {
        aiExpandStore.importTemplates(importedTemplates);
        message.success(`成功导入 ${importedTemplates.length} 个模板`);
      } else {
        message.error('无效的模板格式');
      }
    } catch (error) {
      console.error('导入模板失败:', error);
      message.error('导入失败');
    }
  };
  reader.onerror = () => message.error('读取文件失败');
  reader.readAsText(file);
};

const handleUseOutputAsInput = () => {
  if (aiExpandStore.outputContent) {
    aiExpandStore.inputContent = aiExpandStore.outputContent;
    message.info('输出内容已填充到输入框');
  } else {
    message.warning('输出内容为空');
  }
};
</script>

<template>
  <n-global-style />
  <n-layout class="ai-expand-view" style="height: 100vh;">
    <n-page-header class="page-header-sticky">
      <template #header>
        <n-space align="center">
          <n-button text @click="handleBack">
            <n-icon :component="BackIcon" size="24" />
          </n-button>
          <n-text strong style="font-size: 18px;">AI 扩写工具</n-text>
        </n-space>
      </template>
      <template #subtitle>
        <n-text depth="3">智能辅助，拓展您的文本内容</n-text>
      </template>
      <template #extra>
        <n-space>
          <n-popover trigger="hover">
            <template #trigger>
              <n-button text @click="showHelp">
                <n-icon :component="HelpIcon" size="24" />
              </n-button>
            </template>
            <span>查看帮助</span>
          </n-popover>
          <n-popover trigger="hover">
            <template #trigger>
              <n-button text @click="showSettings">
                <n-icon :component="SettingsIcon" size="24" />
              </n-button>
            </template>
            <span>AI服务设置</span>
          </n-popover>
        </n-space>
      </template>
    </n-page-header>

    <n-layout has-sider style="flex-grow: 1; overflow: hidden;">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="280"
        show-trigger="arrow-circle"
        content-style="padding: 12px;"
      >
        <SidebarContainer /> 
      </n-layout-sider>

      <n-layout-content content-style="padding: 15px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto;">
        
        <n-card size="small">
          <n-space justify="space-around" align="center">
            <n-text size="small">服务: <n-text strong>{{ currentProviderName }}</n-text></n-text>
            <n-text size="small">模型: <n-text strong>{{ currentModelName }}</n-text></n-text>
            <n-text size="small">模板: <n-text strong>{{ currentTemplateName }}</n-text></n-text>
          </n-space>
        </n-card>

        <n-card title="输入内容" :bordered="false" segmented class="content-card" style="flex: 1; display: flex; flex-direction: column;">
          <n-input
            v-model:value="aiExpandStore.inputContent"
            type="textarea"
            placeholder="在此输入您想要扩写或转换的文本..."
            clearable
            style="flex-grow: 1; min-height: 150px;"
            :autosize="{ minRows: 5 }"
          />
          <template #action>
            <n-space justify="end">
              <n-button @click="handleClearInput" size="small">清空输入</n-button>
              <n-button @click="() => handleTemplateManagerUpdateShow(true)" size="small">管理模板</n-button> 
            </n-space>
          </template>
        </n-card>

        <n-space justify="center" align="center" style="margin: 5px 0;">
          <n-button 
            type="primary" 
            @click="handleSendToAI" 
            :loading="aiExpandStore.isProcessing" 
            :disabled="aiExpandStore.isProcessing || !aiExpandStore.inputContent"
            style="min-width: 150px; height: 40px; font-size: 16px;"
          >
            <template #icon>
              <n-icon :component="SendIcon" />
            </template>
            {{ aiExpandStore.isProcessing ? '处理中...' : '开始扩写' }}
          </n-button>
          <n-button 
            v-if="aiExpandStore.isProcessing" 
            @click="handleCancelRequest" 
            type="warning" 
            ghost 
            size="small"
          >
            取消
          </n-button>
        </n-space>

        <n-card title="扩写结果" :bordered="false" segmented class="content-card" style="flex: 1; display: flex; flex-direction: column;">
          <n-spin :show="aiExpandStore.isProcessing" style="width: 100%; flex-grow: 1;">
            <n-input
              v-model:value="aiExpandStore.outputContent"
              type="textarea"
              placeholder="AI处理结果将显示在这里..."
              readonly
              style="flex-grow: 1; min-height: 150px;"
              :autosize="{ minRows: 5 }"
            />
          </n-spin>
          <template #action>
            <n-space justify="end">
              <n-button @click="handleCopyOutput" size="small" :disabled="!aiExpandStore.outputContent">复制结果</n-button>
              <n-button @click="handleUseOutputAsInput" size="small" :disabled="!aiExpandStore.outputContent">用作输入</n-button>
              <n-button @click="handleClearOutput" size="small" :disabled="!aiExpandStore.outputContent">清空结果</n-button>
            </n-space>
          </template>
        </n-card>

        <n-alert v-if="aiExpandStore.errorDetails" title="处理出错" type="error" closable @close="aiExpandStore.errorDetails = ''">
          <n-text code style="white-space: pre-wrap;">{{ aiExpandStore.errorDetails }}</n-text>
        </n-alert>

      </n-layout-content>
    </n-layout>

    <!-- Modals and Drawers -->
    <SettingsDrawer 
      v-if="aiExpandStore.showSettingsDrawer" 
      v-model:show="aiExpandStore.showSettingsDrawer"
      :providers="aiExpandStore.serviceProviders"
      :selected-provider="aiExpandStore.selectedProvider"
      :advanced-options="aiExpandStore.advancedOptions"
      @update:show="handleSettingsDrawerUpdateShow"
      @select-provider="handleSettingsDrawerSelectProvider"
      @update-provider-api-key="handleSettingsDrawerUpdateProviderApiKey"
      @add-custom-provider="handleSettingsDrawerAddCustomProvider"
      @delete-custom-provider="handleSettingsDrawerDeleteCustomProvider"
      @update-advanced-option="handleSettingsDrawerUpdateAdvancedOption"
      @update-model-config="handleSettingsDrawerUpdateModelConfig"
    />
    <PromptTemplateManager 
      v-if="aiExpandStore.showTemplateManager" 
      v-model:show="aiExpandStore.showTemplateManager"
      :templates="aiExpandStore.templates"
      :selected-template="aiExpandStore.selectedTemplate" 
      :custom-prompt="aiExpandStore.customPrompt" 
      :use-custom-prompt="aiExpandStore.useCustomPrompt"
      @update:show="handleTemplateManagerUpdateShow"
      @select-template="handleTemplateManagerSelectTemplate"
      @save-new-template="handleTemplateManagerSaveNewTemplate"
      @delete-template="handleTemplateManagerDeleteTemplate"
      @update-template="handleTemplateManagerUpdateTemplate"
      @update-custom-prompt="handleTemplateManagerUpdateCustomPrompt" 
      @export-templates="handleExportTemplates" 
      @import-templates="handleImportTemplates"
    />

    <n-modal v-model:show="aiExpandStore.showHelpModal" preset="card" style="width: 600px" title="帮助信息">
      <p>这里是AI扩写工具的帮助说明...</p>
      <p>1. 在"输入内容"框中输入文本。</p>
      <p>2. 点击"开始扩写"按钮。</p>
      <p>3. 在"扩写结果"框中查看结果。</p>
      <p>4. 您可以通过顶部的设置图标配置AI服务商和模型。</p>
      <p>5. 左侧边栏提供历史记录和模板管理功能。</p>
    </n-modal>

  </n-layout>
</template>

<style scoped>
.ai-expand-view {
  display: flex;
  flex-direction: column;
}

.page-header-sticky {
  border-bottom: 1px solid var(--n-border-color);
  padding-bottom: 10px; /* Add some padding */
}

.n-layout-content {
  background-color: var(--n-body-color);
}

.content-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.content-card .n-input {
  flex-grow: 1;
}

:deep(.n-layout-sider-scroll-container) {
  overflow-y: auto;
}
</style> 