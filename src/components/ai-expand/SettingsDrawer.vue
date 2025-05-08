<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { 
  NDrawer, 
  NDrawerContent, 
  NButton, 
  NSwitch,
  NSpace,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDivider,
  NIcon,
  NCard,
  NTag,
} from 'naive-ui';
import { 
  TrashOutline as DeleteIcon,
  AddCircleOutline as AddIcon,
  CreateOutline as EditIcon
} from '@vicons/ionicons5';
import type { 
  ServiceProvider, 
  ServiceProviders,
  CustomHeader,
  ProviderListItem
} from '../../types/aiExpand';

// 定义组件属性
const props = defineProps<{
  providers: ServiceProviders;
  selectedProvider: string;
  show: boolean;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update', provider: string, updates: Partial<ServiceProvider>): void;
  (e: 'select', provider: string): void;
  (e: 'update:show', value: boolean): void;
}>();

// 本地状态
const currentEditProvider = ref<ProviderListItem | null>(null);
const showAdvancedSettings = ref(false);
// 添加内部状态以存储启用状态，用于即时UI更新
const localProviderStates = ref<Record<string, boolean>>({});

// 初始化本地状态
onMounted(() => {
  // 初始化localProviderStates为当前providers的enabled状态
  Object.entries(props.providers).forEach(([id, provider]) => {
    localProviderStates.value[id] = provider.enabled;
  });
});

// 监听providers变化，更新本地状态
watch(() => props.providers, (newProviders) => {
  Object.entries(newProviders).forEach(([id, provider]) => {
    localProviderStates.value[id] = provider.enabled;
  });
}, { deep: true });

// 使用计算属性代理show prop
const localShow = computed({
  get: () => props.show,
  set: (value) => {
    emit('update:show', value);
  }
});

// 将 providers 转换为数组，方便管理
const providersList = computed<ProviderListItem[]>(() => {
  return Object.entries(props.providers).map(([key, provider]) => {
    return {
      id: key,
      name: provider.name,
      enabled: localProviderStates.value[key] !== undefined 
        ? localProviderStates.value[key] 
        : provider.enabled,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      defaultModel: provider.defaultModel,
      customHeaders: provider.customHeaders || {},
      modelGroups: provider.modelGroups,
      description: provider.description
    };
  });
});

// 编辑提供商
const editProvider = (provider: ProviderListItem) => {
  // 深拷贝以避免直接修改原始数据
  const providerCopy = JSON.parse(JSON.stringify(provider));
  
  // 将customHeaders转换为数组形式，方便编辑
  providerCopy.headersArray = formatHeadersToArray(providerCopy.customHeaders || {});
  
  currentEditProvider.value = providerCopy;
};

// 将对象形式的customHeaders转换为数组形式
const formatHeadersToArray = (headers: Record<string, string>): CustomHeader[] => {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
};

// 将数组形式的headers转换回对象形式
const formatHeadersToObject = (headers: CustomHeader[]): Record<string, string> => {
  const result: Record<string, string> = {};
  headers.forEach(item => {
    if (item.key.trim()) {
      result[item.key] = item.value;
    }
  });
  return result;
};

// 保存服务商配置
const saveProviderSettings = () => {
  if (!currentEditProvider.value) return;
  
  const { id, apiKey, baseUrl, defaultModel, headersArray, modelGroups } = currentEditProvider.value;
  
  // 转换headers格式
  const customHeaders = formatHeadersToObject(headersArray || []);
  
  // 更新配置
  const updates: Partial<ServiceProvider> = {
    apiKey,
    baseUrl,
    defaultModel,
    customHeaders,
    modelGroups
  };
  
  // 发出事件
  emit('update', id, updates);
  
  // 如果开启状态，设为当前选中
  if (currentEditProvider.value.enabled) {
    emit('select', id);
  }
  
  // 关闭编辑
  currentEditProvider.value = null;
};

// 取消编辑
const cancelEdit = () => {
  currentEditProvider.value = null;
};

// 添加自定义请求头
const addCustomHeader = () => {
  if (!currentEditProvider.value) return;
  if (!currentEditProvider.value.headersArray) {
    currentEditProvider.value.headersArray = [];
  }
  currentEditProvider.value.headersArray.push({ key: '', value: '' });
};

// 删除自定义请求头
const removeCustomHeader = (index: number) => {
  if (!currentEditProvider.value || !currentEditProvider.value.headersArray) return;
  currentEditProvider.value.headersArray.splice(index, 1);
};

// 获取当前提供商的可用模型选项
const currentProviderModels = computed(() => {
  if (!currentEditProvider.value || !currentEditProvider.value.modelGroups) return [];
  
  const options: {label: string; value: string; group: string}[] = [];
  
  currentEditProvider.value.modelGroups.forEach(group => {
    group.models.forEach(model => {
      options.push({
        label: model.name,
        value: model.id,
        group: group.name
      });
    });
  });
  
  return options;
});

// 处理关闭事件
const handleClose = () => {
  console.log('抽屉内部关闭事件，通知父组件');
  localShow.value = false;
};

// 添加一个工具函数，根据服务商ID返回显示的服务商类型
const getProviderType = (providerId: string): string => {
  const typeMap: Record<string, string> = {
    'openai': 'openai_chat_completion',
    'claude': 'anthropic_chat_completion',
    'gemini': 'google_chat_completion',
    'mistral': 'openai_chat_completion',
    'zhipu': 'openai_chat_completion',
    'baidu': 'openai_chat_completion',
    'volcano': 'openai_chat_completion',
    'moonshot': 'openai_chat_completion',
    'deepseek': 'openai_chat_completion',
    'guiji': 'openai_chat_completion',
    'openrouter': 'openai_chat_completion'
  };
  
  return typeMap[providerId] || 'openai_chat_completion';
};

// 处理启用状态切换的函数
const handleProviderEnabledChange = (providerId: string, enabled: boolean) => {
  console.log(`[Provider] 切换 ${providerId} 启用状态为: ${enabled}`);
  
  // 立即更新本地状态，确保UI即时刷新
  localProviderStates.value[providerId] = enabled;
  
  // 如果是启用操作，则选择该服务商为当前使用的服务商
  if (enabled) {
    emit('select', providerId);
  }
  
  // 无论启用还是禁用，都更新服务商状态
  emit('update', providerId, { enabled });
};
</script>

<template>
  <NDrawer v-model:show="localShow" width="600" placement="right">
    <NDrawerContent 
      title="服务提供商管理" 
      closable
      :native-scrollbar="false"
      @close="handleClose"
    >
      <div v-if="!currentEditProvider">
        <div class="providers-card-grid">
          <NCard 
            v-for="provider in providersList" 
            :key="provider.id" 
            class="provider-card"
            :bordered="false"
            size="small"
          >
            <div class="provider-card-header">
              <div class="provider-info">
                <div class="provider-name">{{ provider.name }}</div>
                <div class="provider-id">ID: {{ provider.id }}</div>
              </div>
              <NSwitch 
                :value="provider.enabled" 
                @update:value="v => handleProviderEnabledChange(provider.id, v)"
              />
            </div>
            
            <div class="provider-tag-row">
              <NTag type="info" size="small">
                {{ getProviderType(provider.id) }}
              </NTag>
            </div>
            
            <div class="provider-api-url">
              <div class="url-label">API Base:</div>
              <div class="url-value">{{ provider.baseUrl }}</div>
            </div>
            
            <div class="provider-card-footer">
              <NButton 
                type="primary" 
                text 
                size="small"
                @click="editProvider(provider)"
              >
                <template #icon>
                  <NIcon :component="EditIcon" />
                </template>
                编辑
              </NButton>
            </div>
          </NCard>
        </div>
      </div>
      
      <div v-else class="provider-editor">
        <div class="editor-title">
          编辑服务提供商
        </div>
        
        <div class="drawer-header-extra">
          <NButton tertiary size="small" @click="showAdvancedSettings = !showAdvancedSettings">
            {{ showAdvancedSettings ? '基础设置' : '高级设置' }}
          </NButton>
        </div>
        
        <NForm 
          label-placement="left" 
          label-width="120px"
          :model="currentEditProvider"
        >
          <NFormItem label="ID" path="id">
            <NInput 
              v-model:value="currentEditProvider.id" 
              :disabled="true"
              placeholder="服务提供商ID"
            />
          </NFormItem>
          
          <NFormItem label="启用" path="enabled">
            <NSwitch v-model:value="currentEditProvider.enabled" />
            <span class="form-hint">是否启用该服务提供商</span>
          </NFormItem>
          
          <NFormItem label="API密钥" path="apiKey">
            <NInput 
              v-model:value="currentEditProvider.apiKey" 
              type="password"
              show-password-on="click"
              placeholder="输入API密钥"
            />
            <div class="api-key-hint" v-if="currentEditProvider.id === 'baidu'">
              格式: API_KEY:SECRET_KEY
            </div>
            <div class="api-key-hint" v-if="currentEditProvider.id === 'openrouter'">
              输入OpenRouter API Key
            </div>
          </NFormItem>
          
          <NFormItem label="API基础URL" path="baseUrl">
            <NInput 
              v-model:value="currentEditProvider.baseUrl" 
              placeholder="API基础URL"
            />
            <span class="form-hint">API请求的基础URL地址</span>
          </NFormItem>
          
          <NFormItem label="默认模型" path="defaultModel">
            <NSelect
              v-model:value="currentEditProvider.defaultModel"
              placeholder="选择默认模型"
              :options="currentProviderModels"
              :clearable="false"
            />
          </NFormItem>
          
          <div class="advanced-settings" v-if="showAdvancedSettings">
            <NDivider>高级设置</NDivider>
            
            <NFormItem label="自定义请求头" path="headersArray">
              <div class="custom-headers">
                <div 
                  v-for="(header, index) in currentEditProvider.headersArray" 
                  :key="index" 
                  class="header-item"
                >
                  <NInput placeholder="Header名称" v-model:value="header.key" />
                  <NInput placeholder="Header值" v-model:value="header.value" />
                  <NButton 
                    circle 
                    quaternary 
                    size="small"
                    @click="() => removeCustomHeader(index)"
                  >
                    <NIcon :component="DeleteIcon" />
                  </NButton>
                </div>
                
                <NButton 
                  size="small" 
                  @click="addCustomHeader"
                >
                  <template #icon><NIcon :component="AddIcon" /></template>
                  添加请求头
                </NButton>
              </div>
            </NFormItem>
          </div>
          
          <div class="form-footer">
            <NSpace justify="end">
              <NButton @click="cancelEdit">取消</NButton>
              <NButton type="primary" @click="saveProviderSettings">保存</NButton>
            </NSpace>
          </div>
        </NForm>
      </div>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.providers-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.provider-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.provider-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.provider-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.provider-info {
  display: flex;
  flex-direction: column;
}

.provider-name {
  font-weight: 600;
  font-size: 16px;
}

.provider-id {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.provider-tag-row {
  margin-bottom: 12px;
}

.provider-api-url {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.url-label {
  font-weight: 500;
  color: var(--n-text-color-2);
}

.url-value {
  color: var(--n-text-color);
  word-break: break-all;
}

.provider-card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--n-divider-color);
  padding-top: 12px;
}

.api-key-mask {
  font-family: monospace;
  color: var(--n-text-color-2);
}

.api-key-empty {
  color: var(--n-text-color-3);
  font-style: italic;
}

.provider-editor {
  padding: 16px 0;
  position: relative;
}

.editor-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 20px;
}

.drawer-header-extra {
  position: absolute;
  top: 0;
  right: 0;
}

.form-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-left: 8px;
}

.api-key-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

.form-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid var(--n-divider-color);
}

.custom-headers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.advanced-settings {
  margin-top: 16px;
}
</style> 