<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
  NCard, 
  NSelect, 
  NInput,
  NButton,
  NDivider,
  NIcon,
  NTooltip
} from 'naive-ui';
import { RefreshOutline as RefreshIcon } from '@vicons/ionicons5';
import type { ServiceProvider, ServiceProviders } from '../../types/aiExpand';
// import { getModelOptions } from '../../services/aiExpand/apiService'; // Removed incorrect import

// 定义组件属性
const props = defineProps<{
  selectedProvider: string;                     // 选中的服务商ID
  selectedModel?: string;                       // 选中的模型ID
  providers: ServiceProviders;                  // 所有服务商
  providerOptions: { label: string; value: string }[]; // 服务商选项（下拉菜单用）
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'provider-change', provider: string): void;
  (e: 'model-change', modelId: string): void;
  (e: 'update-provider', providerId: string, updates: Partial<ServiceProvider>): void;
}>();

// 本地状态
const apiKey = ref('');
const currentProvider = computed(() => props.providers[props.selectedProvider] || null);

// 添加调试输出
watch(() => props.selectedProvider, (newProvider) => {
  console.log('[Selector] 选中的服务商变更为:', newProvider);
  console.log('[Selector] 服务商数据:', JSON.stringify(props.providers[newProvider]));
  console.log('[Selector] 所有服务商:', Object.keys(props.providers));
  // 检查modelGroups结构
  if (props.providers[newProvider]) {
    console.log('[Selector] modelGroups存在?', 'modelGroups' in props.providers[newProvider]);
    console.log('[Selector] modelGroups类型:', typeof props.providers[newProvider].modelGroups);
    console.log('[Selector] modelGroups内容:', JSON.stringify(props.providers[newProvider].modelGroups));
  }
  console.log('[Selector] 服务商options:', props.providerOptions);
}, { immediate: true });

const modelOptions = computed(() => {
  console.log('[Selector] 开始生成模型选项');
  console.log('[Selector] 选中的服务商:', props.selectedProvider);
  if (!currentProvider.value) {
    console.warn(`[Selector] 当前服务商不存在: ${props.selectedProvider}`);
    return [];
  }
  console.log('[Selector] 当前服务商数据:', JSON.stringify(currentProvider.value));
  // 详细检查modelGroups
  console.log('[Selector] currentProvider.modelGroups存在?', 'modelGroups' in currentProvider.value);
  console.log('[Selector] currentProvider.modelGroups类型:', typeof currentProvider.value.modelGroups);
  
  // 只依赖真实的 modelGroups
  if (!Array.isArray(currentProvider.value.modelGroups) || currentProvider.value.modelGroups.length === 0) {
    console.warn(`[Selector] 服务商 ${props.selectedProvider} 的modelGroups字段不存在或为空`);
    return [];
  }
  const options: any[] = [];
  currentProvider.value.modelGroups.forEach(group => {
    if (!group || typeof group !== 'object' || !group.id || !group.name || !Array.isArray(group.models)) {
      console.warn(`服务商 ${props.selectedProvider} 的模型分组格式不正确`, group);
      return;
    }
    options.push({
      label: group.name,
      value: `group-${group.id}`,
      type: 'group'
    });
    group.models.forEach(model => {
      if (!model || typeof model !== 'object' || !model.id || !model.name) {
        console.warn(`服务商 ${props.selectedProvider} 的模型格式不正确`, model);
        return;
      }
      options.push({
        label: model.name,
        value: model.id,
        type: 'item'
      });
    });
  });
  if (options.length === 0) {
    // 不再返回默认模型，直接为空
    return [];
  }
  console.log('[DEBUG] 生成的模型选项:', options);
  return options;
});

// 当前选中的模型ID
const selectedModelId = ref(props.selectedModel || (currentProvider.value?.defaultModel) || '');

// 计算是否需要显示API密钥输入
const needsApiKey = computed(() => {
  return props.selectedProvider !== 'custom' || !currentProvider.value?.apiKey;
});

// API密钥提示文本
const apiKeyHint = computed(() => {
  if (props.selectedProvider === 'baidu') {
    return '格式: API_KEY:SECRET_KEY';
  } else if (props.selectedProvider === 'openrouter') {
    return '输入OpenRouter API Key';
  }
  return '';
});

// 监听提供商变化
watch(() => props.selectedProvider, (newProvider) => {
  const provider = props.providers[newProvider];
  if (provider) {
    apiKey.value = provider.apiKey || '';
    // 更新选中的模型为该服务商的默认模型
    selectedModelId.value = provider.defaultModel;
    // 通知父组件模型已更改
    emit('model-change', selectedModelId.value);
  }
}, { immediate: true });

// 处理服务商选择变化
const handleProviderChange = (value: string) => {
  emit('provider-change', value);
};

// 处理模型选择变化
const handleModelChange = (value: string) => {
  // 检查是否选择了分组标题而不是实际模型
  if (value && value.startsWith('group-')) {
    console.log('[DEBUG] 用户选择了分组标题，不执行任何操作');
    return; // 不执行任何操作，或者可以选择该分组的第一个模型
  }
  
  console.log('[DEBUG] 模型选择变更为:', value);
  selectedModelId.value = value;
  emit('model-change', value);
};

// 处理API密钥变化
const handleApiKeyChange = (value: string) => {
  apiKey.value = value;
};

// 保存API配置
const saveApiConfig = () => {
  if (!currentProvider.value) return;
  
  // 更新服务商配置
  emit('update-provider', props.selectedProvider, {
    apiKey: apiKey.value
  });
};

// 刷新模型列表
const refreshModelList = () => {
  console.log('[DEBUG] 手动刷新模型列表');
  // 强制重新计算modelOptions
  const provider = props.providers[props.selectedProvider];
  if (provider) {
    // 重新设置选择的模型为默认模型
    selectedModelId.value = provider.defaultModel;
    emit('model-change', selectedModelId.value);
  }
};
</script>

<template>
  <NCard title="AI模型选择" class="model-card" size="small">
    <div class="ai-model-card-content">
      <!-- 服务商选择 -->
      <div class="selector-section">
        <div class="section-title">选择服务提供商</div>
        <NSelect 
          :value="selectedProvider" 
          :options="providerOptions" 
          placeholder="选择AI服务提供商"
          size="medium"
          @update:value="handleProviderChange"
        />
      </div>
      
      <!-- 模型选择 -->
      <div class="selector-section">
        <div class="section-title">
          选择AI模型
          <NTooltip trigger="hover" placement="top">
            <template #trigger>
              <NButton text circle size="tiny" @click="refreshModelList" class="refresh-btn">
                <NIcon :component="RefreshIcon" size="16" />
              </NButton>
            </template>
            刷新模型列表
          </NTooltip>
        </div>
        <!-- 添加一个警告信息 -->
        <div v-if="modelOptions.length === 0" class="warning-message">
          未找到可用的模型，请检查服务商配置
        </div>
        <NSelect 
          :value="selectedModelId"
          :options="modelOptions" 
          placeholder="选择AI模型"
          size="medium"
          @update:value="handleModelChange"
          filterable
        />
      </div>
      
      <!-- API密钥配置 -->
      <div class="api-key-section" v-if="needsApiKey && currentProvider">
        <NDivider>API配置</NDivider>
        <NInput 
          :value="apiKey" 
          type="password" 
          placeholder="输入API密钥" 
          show-password-on="click"
          size="small"
          @update:value="handleApiKeyChange"
        />
        <div class="api-key-hint" v-if="apiKeyHint">
          {{ apiKeyHint }}
        </div>
        
        <NButton type="primary" size="small" block @click="saveApiConfig" style="margin-top: 12px;">
          保存API配置
        </NButton>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.ai-model-card-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selector-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--n-text-color);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.refresh-btn {
  margin-left: 4px;
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.refresh-btn:hover {
  opacity: 1;
}

.api-key-section {
  margin-top: 8px;
}

.api-key-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.warning-message {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-bottom: 8px;
}
</style> 