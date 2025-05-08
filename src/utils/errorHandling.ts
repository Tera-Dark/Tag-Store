/**
 * 自定义API错误类
 */
export class ApiError extends Error {
  code: string;
  details: string;
  userMessage: string;

  constructor(message: string, code: string = 'unknown', details: string = '') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.userMessage = getUserFriendlyMessage(code, message);
  }
}

/**
 * 错误响应接口
 */
export interface ErrorResponse {
  message: string;
  details?: string;
  code?: string;
}

/**
 * 获取用户友好的错误消息
 */
function getUserFriendlyMessage(errorCode: string, originalMessage: string): string {
  const errorMessages: Record<string, string> = {
    'auth': 'API密钥无效或已过期，请检查你的API设置',
    'rate_limit': '请求过于频繁，请稍后再试',
    'invalid_request': '请求格式无效，请修改你的输入',
    'server_error': '服务器内部错误，请稍后再试',
    'timeout': '请求超时，服务器响应时间过长',
    'network': '网络连接错误，请检查你的网络连接',
    'content_filter': '内容被过滤，请修改输入内容',
    'model_not_available': '所选模型暂时不可用，请选择其他模型'
  };

  return errorMessages[errorCode] || originalMessage || '发生未知错误，请稍后重试';
}

/**
 * 处理API错误
 */
export function handleApiError(error: any): ErrorResponse {
  // 如果已经是我们的标准错误格式，直接返回
  if (error instanceof ApiError) {
    return {
      message: error.userMessage,
      details: error.details,
      code: error.code
    };
  }

  // 处理网络错误
  if (error.name === 'AbortError') {
    return {
      message: '请求被取消或超时',
      code: 'timeout',
      details: '请求超过了设定的超时时间'
    };
  }

  if (!navigator.onLine) {
    return {
      message: '无法连接到服务器，请检查网络连接',
      code: 'network',
      details: '网络连接已断开'
    };
  }

  // 处理HTTP错误
  if (error.response) {
    const status = error.response.status;
    
    // 解析响应体
    let responseData: any = {};
    try {
      responseData = error.responseData || {};
    } catch (e) {
      // 忽略解析错误
    }

    // 根据状态码返回相应错误
    switch (status) {
      case 400:
        return {
          message: '请求格式错误',
          code: 'invalid_request',
          details: responseData.error?.message || '服务器无法理解请求的格式'
        };
      case 401:
        return {
          message: 'API密钥无效',
          code: 'auth',
          details: '认证失败，请检查你的API密钥'
        };
      case 403:
        return {
          message: '请求被拒绝',
          code: 'forbidden',
          details: '服务器拒绝了你的请求，可能是权限不足'
        };
      case 404:
        return {
          message: '资源不存在',
          code: 'not_found',
          details: '请求的资源不存在，请检查API端点'
        };
      case 429:
        return {
          message: '请求过于频繁，请稍后再试',
          code: 'rate_limit',
          details: responseData.error?.message || '已超过API调用限制'
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          message: '服务器错误，请稍后再试',
          code: 'server_error',
          details: responseData.error?.message || '服务器内部发生错误'
        };
      default:
        return {
          message: `HTTP错误: ${status}`,
          code: 'http_error',
          details: responseData.error?.message || '发生未预期的HTTP错误'
        };
    }
  }

  // 未知错误
  return {
    message: error.message || '发生未知错误',
    code: 'unknown',
    details: error.stack ? error.stack.split('\n')[0] : '无错误详情'
  };
} 