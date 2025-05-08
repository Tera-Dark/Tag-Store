<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';
import { 
  NPopover, 
  NForm, 
  NFormItem, 
  NSlider, 
  NInputNumber,
  NSelect,
  NButton,
  NIcon
} from 'naive-ui';
import { SettingsOutline as SettingsIcon } from '@vicons/ionicons5';
import type { AdvancedOptions } from '../../types/aiExpand';

// 定义组件属性
const props = defineProps<{
  options: AdvancedOptions;
  timeout: number;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'update', options: AdvancedOptions, timeout: number): void;
}>();

// 本地状态
const localOptions = ref<AdvancedOptions>({ ...props.options });
const timeoutSeconds = ref(Math.floor(props.timeout / 1000));

// 保存高级选项
const saveAdvancedOptions = () => {
  emit('update', localOptions.value, timeoutSeconds.value * 1000);
};
</script>

<template>
  <NPopover trigger="click" placement="bottom">
    <template #trigger>
      <NButton quaternary circle class="settings-button">
        <NIcon size="20" :component="SettingsIcon" />
      </NButton>
    </template>
    
    <div class="settings-popover">
      <h3>高级设置</h3>
      <NForm size="small">
        <NFormItem label="创造性" size="small">
          <NSlider 
            v-model:value="localOptions.temperature" 
            :min="0" 
            :max="2" 
            :step="0.1" 
          />
          <div class="temperature-labels">
            <span>保守</span>
            <span>平衡</span>
            <span>创意</span>
          </div>
        </NFormItem>
        
        <NFormItem label="最大输出长度 (Max Tokens)" size="small">
          <NInputNumber 
            v-model:value="localOptions.max_tokens" 
            :min="1" 
            :max="32000" 
            :step="100"
            size="small"
          />
        </NFormItem>
        
        <NFormItem label="响应格式" size="small">
          <NSelect 
            v-model:value="localOptions.responseFormat" 
            :options="[
              { label: '文本', value: 'text' },
              { label: 'Markdown', value: 'markdown' },
              { label: 'JSON', value: 'json' }
            ]"
            size="small"
          />
        </NFormItem>
        
        <NFormItem label="请求超时 (秒)" size="small">
          <NInputNumber 
            v-model:value="timeoutSeconds" 
            :min="10" 
            :max="300" 
            :step="5"
            size="small"
          />
        </NFormItem>
        
        <NButton type="primary" size="small" block @click="saveAdvancedOptions">
          保存设置
        </NButton>
      </NForm>
    </div>
  </NPopover>
</template>

<style scoped>
.settings-popover {
  padding: 12px;
  width: 280px;
}

.settings-popover h3 {
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
}

.temperature-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}
</style>