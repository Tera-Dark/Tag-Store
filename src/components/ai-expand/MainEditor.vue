<script setup lang="ts">
import { ref, computed, watch, defineProps, defineEmits } from 'vue';
import { 
  NInput, 
  NButton, 
  NIcon, 
  NSpin, 
  NPopover,
  NCollapse,
  NCollapseItem,
  useMessage
} from 'naive-ui';
import { 
  SendOutline as SendIcon, 
  AddCircleOutline as AddIcon, 
  CopyOutline as CopyIcon,
  RefreshOutline as RefreshIcon,
  InformationCircleOutline as InfoIcon
} from '@vicons/ionicons5';

// 定义组件属性
const props = defineProps<{
  inputContent: string;
  outputContent: string;
  isProcessing: boolean;
  errorDetails: string;
  showErrorDetails: boolean;
  promptPreview: string;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'input-change', content: string): void;
  (e: 'output-change', content: string): void;
  (e: 'send'): void;
  (e: 'new-conversation'): void;
  (e: 'copy-output'): void;
  (e: 'toggle-error-details'): void;
  (e: 'cancel-request'): void;
}>();

// 结果标签页
const activeTab = ref('result');

// 获取消息实例
const message = useMessage();

// 处理输入内容变更，进行安全处理
const handleInputChange = (value: string) => {
  // 检查输入中的潜在恶意代码
  const sanitizedValue = value
    // 移除可执行的JavaScript URL
    .replace(/javascript:/gi, 'blocked-js:')
    // 移除data: URL (可能用于绕过限制)
    .replace(/data:/gi, 'blocked-data:')
    // 移除可疑的HTML事件属性
    .replace(/on\w+=/gi, 'blocked=');
  
  // 如果内容被修改，提醒用户
  if (sanitizedValue !== value) {
    console.warn('输入内容中包含潜在的恶意代码，已自动移除');
  }
  
  emit('input-change', sanitizedValue);
};

// 处理输出内容变更
const handleOutputChange = (value: string) => {
  emit('output-change', value);
};

// 发送到AI前进行安全检查
const handleSend = () => {
  // 检查输入内容是否为空
  if (!props.inputContent.trim()) {
    // 使用naive-ui的消息提示
    message.warning('请输入内容后再发送');
    return;
  }
  
  // 检查内容长度是否合理
  if (props.inputContent.length > 50000) {
    message.warning('输入内容过长，请减少内容后再发送');
    return;
  }
  
  emit('send');
};

// 新对话
const handleNewConversation = () => {
  emit('new-conversation');
};

// 复制输出内容
const handleCopyOutput = () => {
  emit('copy-output');
};

// 取消当前请求
const cancelRequest = () => {
  emit('cancel-request');
};

// 检查是否有错误
const hasError = computed(() => {
  return !!props.errorDetails;
});

// 当发送请求成功时自动切换到结果标签页
watch(() => props.outputContent, (newValue: string) => {
  if (newValue && !props.isProcessing && !hasError.value) {
    activeTab.value = 'result';
  }
});
</script>

<template>
  <div class="main-editor-container">
    <!-- 输入区域 -->
    <div class="input-section">
      <div class="section-header">
        <div class="header-title">
          <h2 class="section-title">输入内容</h2>
          <NPopover trigger="hover" placement="right">
            <template #trigger>
              <NIcon class="info-icon" :component="InfoIcon" />
            </template>
            <div class="info-content">
              <p>在此处输入需要扩写的内容</p>
              <p>点击"发送"按钮将内容发送给AI进行处理</p>
              <p><strong>注意:</strong> 请勿输入包含敏感信息或恶意代码的内容</p>
            </div>
          </NPopover>
        </div>
        <NButton 
          text 
          @click="handleNewConversation" 
          class="new-chat-button"
        >
          <template #icon><NIcon :component="AddIcon" /></template>
          新对话
        </NButton>
      </div>
      
      <NInput 
        :value="inputContent" 
        type="textarea" 
        placeholder="输入需要AI扩写的内容..." 
        :autosize="{ minRows: 10, maxRows: 15 }"
        class="content-editor"
        @update:value="handleInputChange"
        :maxlength="50000"
        show-count
      />
      
      <NCollapse>
        <NCollapseItem title="提示词预览" name="prompt">
          <div class="preview-content">{{ promptPreview }}</div>
        </NCollapseItem>
      </NCollapse>
    </div>
    
    <!-- 发送按钮 -->
    <div class="action-bar">
      <NButton 
        type="primary" 
        size="large" 
        @click="handleSend" 
        :loading="isProcessing" 
        :disabled="isProcessing || !inputContent.trim()"
        class="send-button"
        v-if="!isProcessing"
      >
        <template #icon><NIcon :component="SendIcon" /></template>
        发送到AI
      </NButton>
      
      <NButton 
        type="warning" 
        size="large" 
        @click="cancelRequest" 
        class="cancel-button"
        v-if="isProcessing"
      >
        <template #icon><NIcon :component="RefreshIcon" /></template>
        取消处理
      </NButton>
    </div>
    
    <!-- 输出区域 -->
    <div class="output-section" v-show="outputContent || isProcessing || errorDetails">
      <NTabs v-model:value="activeTab" type="card" class="output-tabs">
        <NTab name="result">
          <template #tab>
            <div class="tab-label">
              <span>结果</span>
              <NBadge v-if="hasError" type="error" dot />
            </div>
          </template>
          
          <div class="tab-content">
            <div v-if="isProcessing" class="processing-indicator">
              <NSpin size="medium" />
              <p>AI正在处理...</p>
            </div>
            
            <template v-else-if="outputContent">
              <NInput 
                :value="outputContent" 
                type="textarea" 
                placeholder="AI扩写结果将显示在这里..." 
                :autosize="{ minRows: 8, maxRows: 15 }"
                readonly
                class="content-editor result-editor"
                @update:value="handleOutputChange"
              />
              
              <div class="output-actions">
                <NButton tertiary @click="handleCopyOutput" class="copy-button">
                  <template #icon><NIcon :component="CopyIcon" /></template>
                  复制结果
                </NButton>
              </div>
            </template>
            
            <NEmpty v-else description="还没有结果" />
          </div>
        </NTab>
        
        <NTab name="details" :disabled="!errorDetails">
          <template #tab>
            <div class="tab-label">
              <span>错误详情</span>
              <NBadge v-if="errorDetails" type="error" dot />
            </div>
          </template>
          
          <div class="tab-content error-tab" v-if="errorDetails">
            <div class="error-title">处理过程中发生错误</div>
            <div class="error-content">{{ errorDetails }}</div>
          </div>
        </NTab>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.main-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--n-card-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.info-icon {
  font-size: 16px;
  color: var(--n-text-color-3);
  cursor: pointer;
}

.info-content {
  max-width: 250px;
  font-size: 14px;
}

.info-content p {
  margin: 6px 0;
}

.content-editor {
  font-size: 15px;
  line-height: 1.6;
  border-radius: 8px;
}

.preview-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 13px;
  color: var(--n-text-color-3);
  padding: 8px;
  background-color: var(--n-color-light);
  border-radius: 6px;
}

.action-bar {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.send-button, .cancel-button {
  min-width: 140px;
}

.output-section {
  background-color: var(--n-card-color);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.output-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-content {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.result-editor {
  background-color: var(--n-color-light);
}

.output-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.processing-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  color: var(--n-text-color-2);
}

.error-tab {
  color: var(--n-error-color);
}

.error-title {
  font-weight: 500;
  margin-bottom: 16px;
}

.error-content {
  background-color: var(--n-error-color-suppl);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.error-content pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 13px;
}
</style> 