import type { ServiceProvider, AdvancedOptions } from '../../types/aiExpand';
import { ApiError } from '../../utils/errorHandling';
import { RequestManager, fetchWithRetry } from '../../utils/requestUtils';

// 请求管理器实例 - 限制最多2个并发请求
const requestManager = new RequestManager(2);

// 默认高级选项
export const defaultAdvancedOptions: AdvancedOptions = {
  temperature: 0.7,
  max_tokens: 2000,
  top_p: 1,
  top_k: 50,
  responseFormat: 'text',
  streaming: false
};

/**
 * 调用AI服务
 * @param prompt 提示词
 * @param provider 服务提供商
 * @param modelId 模型ID
 * @param advancedOptions 高级选项
 * @param signal AbortSignal用于取消请求
 * @returns AI响应内容
 */
export async function callAI(
  prompt: string,
  provider: ServiceProvider,
  modelId: string,
  advancedOptions: AdvancedOptions = defaultAdvancedOptions,
  signal?: AbortSignal
): Promise<string> {
  if (!prompt) {
    throw new ApiError('提示词不能为空', 'invalid_input');
  }
  
  if (!provider) {
    throw new ApiError('服务提供商不能为空', 'invalid_provider');
  }
  
  if (!provider.apiKey) {
    throw new ApiError('API密钥未设置', 'missing_api_key');
  }
  
  if (!modelId) {
    modelId = provider.defaultModel;
  }
  
  const options = {
    ...defaultAdvancedOptions,
    ...advancedOptions
  };
  
  // 创建唯一请求ID
  const requestId = RequestManager.createRequestId(`${provider.id}-${modelId}`);
  
  // 通过请求管理器发送请求
  return requestManager.enqueue(
    requestId,
    async () => {
      try {
        switch (provider.id) {
          case 'openai':
          case 'azure':
            return await callOpenAI(prompt, provider, modelId, options, signal);
          case 'openrouter':
            return await callOpenRouter(prompt, provider, modelId, options, signal);
          default:
            return await callGenericAPI(prompt, provider, modelId, options, signal);
        }
      } catch (error) {
        console.error('AI调用失败:', error);
        throw error; // 重新抛出错误以便上层处理
      }
    },
    {
      timeout: 60000, // 默认60秒超时
      cancelPrevious: true
    }
  );
}

/**
 * 调用OpenAI API
 */
async function callOpenAI(
  prompt: string,
  provider: ServiceProvider,
  modelId: string,
  options: AdvancedOptions,
  signal?: AbortSignal
): Promise<string> {
  const isAzure = provider.id === 'azure';
  const endpoint = isAzure ? 
    `${provider.baseUrl}/chat/completions?api-version=2023-05-15` : 
    `${provider.baseUrl}/chat/completions`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...provider.customHeaders
  };
  
  // OpenAI和Azure有不同的认证方式
  if (isAzure) {
    if (!headers['api-key']) {
      headers['api-key'] = provider.apiKey;
    }
  } else {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }
  
  const requestBody: any = {
    model: modelId,
    messages: [
      { role: 'system', content: '你是一个擅长扩写内容的AI助手。' },
      { role: 'user', content: prompt }
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens
  };
  
  // 响应格式处理
  if (options.responseFormat !== 'text') {
    requestBody.response_format = { type: options.responseFormat };
  }
  
  try {
    // 使用重试机制发送请求
    const response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal
      },
      2 // 重试次数
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        `HTTP error! Status: ${response.status}`,
        `http_${response.status}`,
        errorData.error?.message || JSON.stringify(errorData)
      );
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    // 如果是我们自己的ApiError，直接抛出
    if (error instanceof ApiError) {
      throw error;
    }
    
    // 否则包装为ApiError
    throw new ApiError(
      (error as Error).message || '调用OpenAI API失败',
      'api_call_failed',
      (error as any).stack || ''
    );
  }
}

/**
 * 调用OpenRouter API
 */
async function callOpenRouter(
  prompt: string,
  provider: ServiceProvider,
  modelId: string,
  options: AdvancedOptions,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = `${provider.baseUrl}/chat/completions`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...provider.customHeaders
  };
  
  // OpenRouter需要标记应用
  if (!headers['HTTP-Referer']) {
    headers['HTTP-Referer'] = 'https://tagstore.app'; 
  }
  
  if (!headers['X-Title']) {
    headers['X-Title'] = 'TagStore AI Expand';
  }
  
  const requestBody: any = {
    model: modelId,
    messages: [
      { role: 'system', content: '你是一个擅长扩写内容的AI助手。' },
      { role: 'user', content: prompt }
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens
  };
  
  try {
    // 使用重试机制发送请求
    const response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal
      },
      2 // 重试次数
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        `HTTP error! Status: ${response.status}`,
        `http_${response.status}`,
        errorData.error?.message || JSON.stringify(errorData)
      );
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    // 如果是我们自己的ApiError，直接抛出
    if (error instanceof ApiError) {
      throw error;
    }
    
    // 否则包装为ApiError
    throw new ApiError(
      (error as Error).message || '调用OpenRouter API失败',
      'api_call_failed',
      (error as any).stack || ''
    );
  }
}

/**
 * 调用通用API（其他服务提供商）
 */
async function callGenericAPI(
  prompt: string,
  provider: ServiceProvider,
  modelId: string,
  options: AdvancedOptions,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = `${provider.baseUrl}/chat/completions`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${provider.apiKey}`,
    ...provider.customHeaders
  };
  
  const requestBody: any = {
    model: modelId,
    messages: [
      { role: 'system', content: '你是一个擅长扩写内容的AI助手。' },
      { role: 'user', content: prompt }
    ],
    temperature: options.temperature,
    max_tokens: options.max_tokens
  };
  
  try {
    // 使用重试机制发送请求
    const response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal
      },
      2 // 重试次数
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        `HTTP error! Status: ${response.status}`,
        `http_${response.status}`,
        errorData.error?.message || JSON.stringify(errorData)
      );
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    // 如果是我们自己的ApiError，直接抛出
    if (error instanceof ApiError) {
      throw error;
    }
    
    // 否则包装为ApiError
    throw new ApiError(
      (error as Error).message || '调用API失败',
      'api_call_failed',
      (error as any).stack || ''
    );
  }
}

/**
 * 加载高级选项
 */
export function loadAdvancedOptions(): AdvancedOptions {
  try {
    const savedOptions = localStorage.getItem('aiExpand_advancedOptions');
    if (!savedOptions) return defaultAdvancedOptions;
    
    const parsed = JSON.parse(savedOptions);
    return {
      ...defaultAdvancedOptions,
      ...parsed
    };
  } catch (error) {
    console.error('加载高级选项失败:', error);
    return defaultAdvancedOptions;
  }
}

/**
 * 保存高级选项
 */
export function saveAdvancedOptions(options: AdvancedOptions): void {
  try {
    localStorage.setItem('aiExpand_advancedOptions', JSON.stringify(options));
  } catch (error) {
    console.error('保存高级选项失败:', error);
  }
} 