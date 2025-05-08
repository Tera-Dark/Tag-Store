<script setup lang="ts">
import { defineProps, defineEmits, onMounted } from 'vue';
import { 
  NInput, 
  NButton, 
  NIcon,
  NSpin
} from 'naive-ui';
import { 
  SendOutline as SendIcon, 
  AddCircleOutline as AddIcon, 
  SaveOutline as SaveIcon,
} from '@vicons/ionicons5';

// 定义组件属性
const props = defineProps<{
  content: string;
  placeholder: string;
  isOutput?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  errorDetails?: string | null;
  showCopy?: boolean;
  showClear?: boolean;
  showSpeak?: boolean;
  showStop?: boolean;
  readOnly?: boolean;
  showErrorToggle?: boolean;
}>();

// 增加一个 onMounted 钩子来象征性地使用 props
onMounted(() => {
  if (props.content) {
    // console.log('Editor.vue props.content exists');
  }
});

// 定义事件
const emit = defineEmits<{
  (e: 'input-change', content: string): void;
  (e: 'output-change', content: string): void;
  (e: 'send'): void;
  (e: 'new-conversation'): void;
  (e: 'copy-output'): void;
  (e: 'toggle-error-details'): void;
}>();

// 处理输入内容变更
const handleInputChange = (value: string) => {
  emit('input-change', value);
};

// 处理输出内容变更
const handleOutputChange = (value: string) => {
  emit('output-change', value);
};

// 发送到AI
const handleSend = () => {
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

// 切换错误详情
const toggleErrorDetails = () => {
  emit('toggle-error-details');
};
</script>

<template>
  <div class="editor-container">
    <!-- 输入区域 -->
    <div class="editor-section">
      <div class="section-header">
        <h2 class="section-title">输入内容</h2>
        <NButton text @click="handleNewConversation" class="new-chat-button">
          <template #icon><NIcon :component="AddIcon" /></template>
          新对话
        </NButton>
      </div>
      
      <NInput 
        :value="content" 
        type="textarea" 
        placeholder="输入需要AI扩写的内容..." 
        :autosize="{ minRows: 8, maxRows: 15 }"
        class="content-editor"
        @update:value="handleInputChange"
      />
      
      <div class="prompt-preview">
        <span class="preview-label">提示词预览:</span>
        <div class="preview-content">{{ placeholder }}</div>
      </div>
    </div>
    
    <!-- 处理按钮 -->
    <div class="action-bar">
      <NButton 
        type="primary" 
        size="large" 
        @click="handleSend" 
        :loading="isLoading" 
        :disabled="isLoading"
        block
      >
        <template #icon><NIcon :component="SendIcon" /></template>
        {{ isLoading ? '处理中...' : '发送到AI' }}
      </NButton>
    </div>
    
    <!-- 结果区域 -->
    <div class="result-section" v-if="isOutput">
      <div class="section-header">
        <h2 class="section-title">扩写结果</h2>
        <NButton text @click="handleCopyOutput" v-if="content">
          <template #icon><NIcon :component="SaveIcon" /></template>
          复制结果
        </NButton>
      </div>
      
      <div v-if="isLoading" class="processing-indicator">
        <NSpin size="medium" />
        <p>AI正在处理...</p>
      </div>
      
      <template v-else-if="content">
        <!-- 错误详情展示 -->
        <div class="error-details" v-if="errorDetails && showErrorToggle">
          <div class="error-title">
            <span>错误详情</span>
            <NButton size="tiny" text @click="toggleErrorDetails">
              关闭
            </NButton>
          </div>
          <div class="error-content">
            <pre>{{ errorDetails }}</pre>
          </div>
        </div>
        
        <NInput 
          :value="content" 
          type="textarea" 
          placeholder="AI扩写结果将显示在这里..." 
          :autosize="{ minRows: 8, maxRows: 15 }"
          readonly
          class="content-editor result-editor"
          @update:value="handleOutputChange"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 4px;
}

.editor-section,
.result-section {
  padding: 16px;
  border-radius: 8px;
  background-color: var(--n-card-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.content-editor {
  font-size: 15px;
  line-height: 1.6;
}

.result-editor {
  background-color: rgba(0, 0, 0, 0.01);
}

.prompt-preview {
  margin-top: 12px;
  font-size: 13px;
  color: var(--n-text-color-3);
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 12px;
}

.preview-label {
  font-weight: 500;
  margin-right: 8px;
}

.preview-content {
  white-space: pre-wrap;
  max-height: 80px;
  overflow-y: auto;
  margin-top: 8px;
  font-family: monospace;
}

.action-bar {
  padding: 0 8px;
}

.processing-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  color: var(--n-text-color-2);
}

.error-details {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(255, 59, 48, 0.05);
  border: 1px solid rgba(255, 59, 48, 0.2);
}

.error-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  color: #d03050;
  margin-bottom: 8px;
}

.error-content {
  max-height: 120px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
  padding: 8px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
}
</style> 