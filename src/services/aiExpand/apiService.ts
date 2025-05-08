// apiService.ts - 集成所有AI扩写服务接口
// 导出其他服务
export * from './providerService';
export * from './templateService';
export * from './historyService';
export * from './aiCallService';

/**
 * 验证API密钥格式
 * @param apiKey API密钥
 * @param provider 服务提供商ID
 * @returns 验证结果
 */
export function validateApiKey(apiKey: string, provider: string): { valid: boolean; message?: string } {
  if (!apiKey) {
    return { valid: false, message: 'API密钥不能为空' };
  }
  
  // 不同服务商的API密钥格式验证
  switch (provider) {
    case 'openai':
      // OpenAI的API密钥通常以sk-开头
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, message: 'OpenAI API密钥通常以sk-开头' };
      }
      
      if (apiKey.length < 30) {
        return { valid: false, message: 'OpenAI API密钥长度不足' };
      }
      
      return { valid: true };
      
    case 'openrouter':
      // OpenRouter的API密钥通常较长
      if (apiKey.length < 20) {
        return { valid: false, message: 'OpenRouter API密钥长度不足' };
      }
      
      return { valid: true };
      
    case 'azure':
      // Azure OpenAI的API密钥通常是32个字符的字母数字组合
      if (!/^[a-zA-Z0-9]{32,}$/.test(apiKey)) {
        return { valid: false, message: 'Azure API密钥格式不正确' };
      }
      
      return { valid: true };
      
    default:
      // 对于其他服务商，只进行长度检查
      if (apiKey.length < 10) {
        return { valid: false, message: 'API密钥太短，请检查是否正确' };
      }
      
      return { valid: true };
  }
}

/**
 * 检查API基础URL是否有效
 * @param baseUrl API基础URL
 * @returns 验证结果
 */
export function validateBaseUrl(baseUrl: string): { valid: boolean; message?: string } {
  if (!baseUrl) {
    return { valid: false, message: 'API基础URL不能为空' };
  }
  
  try {
    // 尝试解析URL
    new URL(baseUrl);
    
    // 检查URL是否使用https
    if (!baseUrl.startsWith('https://')) {
      return { valid: false, message: '建议使用HTTPS协议的URL以确保安全' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, message: 'URL格式不正确' };
  }
}

/**
 * 检查自定义请求头格式
 * @param headers 自定义请求头对象
 * @returns 验证结果
 */
export function validateCustomHeaders(headers: Record<string, string>): { valid: boolean; message?: string } {
  if (!headers || typeof headers !== 'object') {
    return { valid: false, message: '自定义请求头格式不正确' };
  }
  
  for (const [key, value] of Object.entries(headers)) {
    // 请求头名称不能包含特殊字符
    if (!/^[\w-]+$/.test(key)) {
      return { valid: false, message: `请求头名称 ${key} 包含无效字符` };
    }
    
    // 请求头值不能包含某些控制字符
    if (typeof value !== 'string' || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value)) {
      return { valid: false, message: `请求头 ${key} 的值格式不正确` };
    }
  }
  
  return { valid: true };
}

/**
 * 格式化文本为有效的系统提示
 * @param text 原始文本
 * @returns 格式化后的系统提示
 */
export function formatSystemPrompt(text: string): string {
  if (!text) {
    return '你是一个擅长扩写内容的AI助手。';
  }
  
  // 移除可能的HTML标签
  const sanitized = text.replace(/<[^>]*>/g, '');
  
  // 确保长度合理
  return sanitized.length > 500 ? sanitized.substring(0, 500) + '...' : sanitized;
}

/**
 * 格式化用户输入
 * @param text 用户输入文本
 * @returns 格式化后的用户输入
 */
export function formatUserInput(text: string): string {
  if (!text) {
    return '';
  }
  
  // 移除可能的不安全内容
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
} 