<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
  NCard, 
  NSelect, 
  NCheckbox, 
  NInput, 
  NButton, 
  NButtonGroup,
  NIcon,
} from 'naive-ui';
import { 
  SaveOutline as SaveIcon, 
  AddCircleOutline as AddIcon, 
  SettingsOutline as SettingsIcon
} from '@vicons/ionicons5';
import type { PromptTemplate } from '../../types/aiExpand';

// 定义组件属性
const props = defineProps<{
  selectedTemplate: string;
  templates: PromptTemplate[];
  customPrompt: string;
  useCustomPrompt: boolean;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'template-change', template: string): void;
  (e: 'custom-prompt-toggle', value: boolean): void;
  (e: 'custom-prompt-change', value: string): void;
  (e: 'save-template'): void;
  (e: 'edit-template', template: PromptTemplate): void;
  (e: 'manage-templates'): void;
  (e: 'export-templates'): void;
  (e: 'import-templates', file: File): void;
}>();

// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null);

// 处理模板变更
const handleTemplateChange = (value: string) => {
  console.log('模板变更为:', value);
  // 检查是否选择了有效模板
  if (props.templates.some(t => t.value === value)) {
    emit('template-change', value);
  } else {
    console.warn(`尝试选择无效的模板ID: ${value}`);
    if (props.templates.length > 0) {
      // 选择第一个有效模板
      emit('template-change', props.templates[0].value);
    }
  }
};

// 处理自定义提示词切换
const handleCustomPromptToggle = (value: boolean) => {
  emit('custom-prompt-toggle', value);
};

// 处理自定义提示词变更
const handleCustomPromptChange = (value: string) => {
  emit('custom-prompt-change', value);
};

// 保存当前提示词为模板
const saveCurrentPrompt = () => {
  emit('save-template');
};

// 编辑当前模板
const editCurrentTemplate = () => {
  const template = props.templates.find(t => t.value === effectiveSelectedTemplate.value);
  if (template) {
    emit('edit-template', template);
  }
};

// 打开模板管理器
const openPromptManager = () => {
  emit('manage-templates');
};

// 导出模板
const exportPromptTemplates = () => {
  emit('export-templates');
};

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    emit('import-templates', file);
    
    // 重置文件输入，允许再次选择同一文件
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
};

// 触发文件输入点击
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

// 将PromptTemplate转换为SelectOption
const templateOptions = computed(() => {
  console.log('生成提示词模板选项，templates:', props.templates);
  if (!props.templates || props.templates.length === 0) {
    console.warn('没有可用的提示词模板');
    return [{ label: '默认', value: 'general' }];
  }
  
  const options = props.templates.map(template => ({
    label: template.label,
    value: template.value
  }));
  
  console.log('生成的提示词选项:', options);
  return options;
});

// 监视props.templates变化
watch(() => props.templates, (newTemplates) => {
  console.log('提示词模板已更新，数量:', newTemplates.length);
}, { immediate: true });

// 确保selectedTemplate有效
const effectiveSelectedTemplate = computed(() => {
  if (!props.selectedTemplate || 
      !props.templates.some(t => t.value === props.selectedTemplate)) {
    console.warn(`选中的模板 ${props.selectedTemplate} 不存在，使用默认模板`);
    return props.templates.length > 0 ? props.templates[0].value : 'general';
  }
  return props.selectedTemplate;
});
</script>

<template>
  <NCard title="提示词模板" class="template-card" size="small">
    <div class="template-card-content">
      <div class="dropdown-with-action">
        <NSelect 
          :value="effectiveSelectedTemplate" 
          :options="templateOptions"
          :disabled="useCustomPrompt"
          placeholder="选择提示词模板"
          size="medium"
          @update:value="handleTemplateChange"
        />
        <NButton 
          circle
          quaternary
          class="template-action-button" 
          @click="editCurrentTemplate" 
          :disabled="useCustomPrompt"
          title="编辑当前模板"
        >
          <NIcon :component="SettingsIcon" />
        </NButton>
      </div>
      
      <NCheckbox :checked="useCustomPrompt" @update:checked="handleCustomPromptToggle">
        使用自定义提示词
      </NCheckbox>
      
      <div class="custom-prompt-section" v-if="useCustomPrompt">
        <NInput 
          :value="customPrompt" 
          type="textarea" 
          placeholder="输入自定义提示词，使用{content}作为占位符" 
          :autosize="{ minRows: 3, maxRows: 6 }"
          size="small"
          @update:value="handleCustomPromptChange"
        />
        <div class="prompt-actions">
          <NButton size="small" @click="saveCurrentPrompt">
            <template #icon><NIcon :component="SaveIcon" /></template>
            保存为模板
          </NButton>
        </div>
      </div>
      
      <div class="template-tools">
        <NButtonGroup size="small">
          <NButton @click="exportPromptTemplates">
            <template #icon><NIcon :component="SaveIcon" /></template>
            导出
          </NButton>
          
          <NButton @click="triggerFileInput">
            <template #icon><NIcon :component="AddIcon" /></template>
            导入
          </NButton>
          
          <NButton @click="openPromptManager">
            <template #icon><NIcon :component="SettingsIcon" /></template>
            管理
          </NButton>
        </NButtonGroup>
        <input 
          ref="fileInputRef"
          type="file" 
          accept=".json" 
          style="display: none;" 
          @change="handleFileSelect"
        />
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.template-card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dropdown-with-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-prompt-section {
  margin-top: 8px;
}

.prompt-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.template-tools {
  display: flex;
  justify-content: flex-start;
  margin-top: 8px;
}
</style> 