import type { ServiceProviders, ServiceProvider } from '../../types/aiExpand';
import { secureStore } from '../../utils/secureStorage';

// 存储键名
const STORAGE_KEY = 'aiExpand_providers';

/**
 * 默认服务提供商配置
 */
export const defaultServiceProviders: ServiceProviders = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '连接多种AI模型的开放路由服务',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3-opus-20240229',
    customHeaders: {},
    apiType: 'openai_compatible',
    modelGroups: [
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: [
          { id: 'anthropic/claude-3-opus-20240229', name: 'Claude 3 Opus' },
          { id: 'anthropic/claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
          { id: 'anthropic/claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
          { id: 'anthropic/claude-2.1', name: 'Claude 2.1' }
        ]
      },
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'openai/gpt-4', name: 'GPT-4' },
          { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ]
      },
      {
        id: 'google',
        name: 'Google',
        models: [
          { id: 'google/gemini-pro', name: 'Gemini Pro' },
          { id: 'google/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' }
        ]
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        models: [
          { id: 'mistral/mistral-large-latest', name: 'Mistral Large' },
          { id: 'mistral/mistral-medium', name: 'Mistral Medium' },
          { id: 'mistral/mistral-small-latest', name: 'Mistral Small' }
        ]
      }
    ],
    enabled: true
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI官方API服务',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-3.5-turbo',
    customHeaders: {},
    apiType: 'openai_compatible',
    modelGroups: [
      {
        id: 'gpt4',
        name: 'GPT-4系列',
        models: [
          { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo' },
          { id: 'gpt-4-vision-preview', name: 'GPT-4 Vision' },
          { id: 'gpt-4', name: 'GPT-4' }
        ]
      },
      {
        id: 'gpt35',
        name: 'GPT-3.5系列',
        models: [
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ]
      }
    ],
    enabled: true
  },
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    description: '微软Azure的OpenAI服务',
    apiKey: '',
    baseUrl: 'https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name',
    defaultModel: 'gpt-35-turbo',
    customHeaders: {
      'api-key': ''
    },
    apiType: 'openai_compatible',
    modelGroups: [
      {
        id: 'azure-models',
        name: 'Azure部署模型',
        models: [
          { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo' },
          { id: 'gpt-4', name: 'GPT-4' }
        ]
      }
    ],
    enabled: false
  },
  custom: {
    id: 'custom',
    name: '自定义服务',
    description: '自定义API服务设置',
    apiKey: '',
    baseUrl: '',
    defaultModel: 'custom-model',
    customHeaders: {},
    apiType: 'openai_compatible',
    modelGroups: [
      {
        id: 'custom-models',
        name: '自定义模型组',
        models: [
          { id: 'custom-model', name: '自定义模型' }
        ]
      }
    ],
    enabled: false
  }
};

/**
 * 加载服务提供商配置
 * @returns 服务提供商配置
 */
export function loadServiceProviders(): ServiceProviders {
  try {
    // 尝试从安全存储加载
    const providers = secureStore.getObject<ServiceProviders>(STORAGE_KEY, defaultServiceProviders);
    
    // 验证加载的数据是否为有效对象
    if (!providers || typeof providers !== 'object' || Object.keys(providers).length === 0) {
      console.warn('加载的服务提供商配置无效，使用默认配置');
      return { ...defaultServiceProviders };
    }
    
    // 检查至少有一个启用的服务提供商
    const hasEnabledProvider = Object.values(providers).some(provider => provider.enabled);
    if (!hasEnabledProvider) {
      // 确保至少有一个默认启用的服务提供商
      providers.openrouter = {
        ...defaultServiceProviders.openrouter,
        ...providers.openrouter,
        enabled: true
      };
      console.warn('无启用的服务提供商，默认启用OpenRouter');
    }
    
    // 合并默认配置，确保结构完整
    return mergeWithDefaults(providers);
  } catch (error) {
    console.error('加载服务提供商配置失败:', error);
    return { ...defaultServiceProviders };
  }
}

/**
 * 保存服务提供商配置
 * @param providers 服务提供商配置
 */
export function saveServiceProviders(providers: ServiceProviders): void {
  try {
    secureStore.setObject(STORAGE_KEY, providers);
  } catch (error) {
    console.error('保存服务提供商配置失败:', error);
  }
}

/**
 * 更新服务提供商配置
 * @param providerId 服务提供商ID
 * @param updates 更新内容
 */
export function updateServiceProvider(
  providerId: string,
  updates: Partial<ServiceProvider>
): ServiceProviders {
  const providers = loadServiceProviders();
  
  if (!providers[providerId]) {
    throw new Error(`服务提供商不存在: ${providerId}`);
  }
  
  // 更新配置
  providers[providerId] = {
    ...providers[providerId],
    ...updates
  };
  
  // 保存
  saveServiceProviders(providers);
  
  return providers;
}

/**
 * 获取服务提供商选项（用于下拉菜单）
 * @param providers 服务提供商配置
 * @returns 选项数组
 */
export function getServiceProviderOptions(providers: ServiceProviders): Array<{ label: string; value: string }> {
  return Object.entries(providers)
    .filter(([, provider]) => provider.enabled)
    .map(([id, provider]) => ({
      label: provider.name,
      value: id
    }));
}

/**
 * 将加载的配置与默认配置合并，确保结构完整
 * @param loadedProviders 加载的服务提供商配置
 * @returns 合并后的配置
 */
function mergeWithDefaults(loadedProviders: ServiceProviders): ServiceProviders {
  const result: ServiceProviders = { ...defaultServiceProviders };
  
  // 合并已加载的配置
  Object.entries(loadedProviders).forEach(([id, provider]) => {
    if (result[id]) {
      // 如果是预设的服务商，保留基本结构，仅更新用户配置的部分
      result[id] = {
        ...result[id],
        apiKey: provider.apiKey || result[id].apiKey,
        baseUrl: provider.baseUrl || result[id].baseUrl,
        defaultModel: provider.defaultModel || result[id].defaultModel,
        customHeaders: { ...result[id].customHeaders, ...provider.customHeaders },
        enabled: provider.enabled !== undefined ? provider.enabled : result[id].enabled
      };
      
      // 如果加载的配置有自定义modelGroups，使用加载的
      if (provider.modelGroups && Array.isArray(provider.modelGroups) && provider.modelGroups.length > 0) {
        result[id].modelGroups = [...provider.modelGroups];
      }
    } else {
      // 如果是用户自己添加的服务商，直接使用
      result[id] = provider;
    }
  });
  
  return result;
}

/**
 * 添加新的服务提供商
 * @param provider 服务提供商配置
 */
export function addServiceProvider(provider: ServiceProvider): ServiceProviders {
  const providers = loadServiceProviders();
  
  if (providers[provider.id]) {
    throw new Error(`服务提供商ID已存在: ${provider.id}`);
  }
  
  // 添加新服务商
  providers[provider.id] = provider;
  
  // 保存
  saveServiceProviders(providers);
  
  return providers;
}

/**
 * 删除服务提供商
 * @param providerId 服务提供商ID
 */
export function deleteServiceProvider(providerId: string): ServiceProviders {
  const providers = loadServiceProviders();
  
  // 检查是否是默认预设的服务商
  if (defaultServiceProviders[providerId]) {
    throw new Error(`无法删除预设服务提供商: ${providerId}`);
  }
  
  if (!providers[providerId]) {
    throw new Error(`服务提供商不存在: ${providerId}`);
  }
  
  // 删除服务商
  delete providers[providerId];
  
  // 保存
  saveServiceProviders(providers);
  
  return providers;
} 