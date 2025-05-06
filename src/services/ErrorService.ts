import { useMessage } from 'naive-ui';

// 错误类型
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  DATA = 'data',
  UNKNOWN = 'unknown'
}

// 错误处理配置
interface ErrorHandlerConfig {
  showNotification?: boolean;
  logToConsole?: boolean;
}

const defaultConfig: ErrorHandlerConfig = {
  showNotification: true,
  logToConsole: true
};

/**
 * 统一的错误处理服务
 */
export const useErrorHandler = () => {
  const message = useMessage();
  
  /**
   * 处理错误
   * @param error 错误对象
   * @param context 错误发生的上下文
   * @param type 错误类型
   * @param config 配置选项
   */
  const handleError = (
    error: any,
    context: string,
    type: ErrorType = ErrorType.UNKNOWN,
    config: ErrorHandlerConfig = {}
  ) => {
    const finalConfig = { ...defaultConfig, ...config };
    const errorMessage = error?.message || '未知错误';
    
    // 控制台日志
    if (finalConfig.logToConsole) {
      console.error(`[${type.toUpperCase()}] Error in ${context}:`, error);
    }
    
    // 通知
    if (finalConfig.showNotification) {
      switch (type) {
        case ErrorType.NETWORK:
          message.error(`网络错误: ${errorMessage}`);
          break;
        case ErrorType.VALIDATION:
          message.warning(`验证错误: ${errorMessage}`);
          break;
        case ErrorType.DATA:
          message.error(`数据错误: ${errorMessage}`);
          break;
        default:
          message.error(`操作失败: ${errorMessage}`);
      }
    }
    
    // 可以在这里添加更多处理，如上报错误等
  };
  
  return { handleError, ErrorType };
}; 