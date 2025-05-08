/**
 * 防抖函数
 * @param fn 要防抖的函数
 * @param wait 等待时间(毫秒)
 * @returns 防抖处理后的函数
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      fn.apply(context, args);
      timeout = null;
    }, wait);
  };
}

/**
 * 节流函数
 * @param fn 要节流的函数
 * @param limit 限制时间(毫秒)
 * @returns 节流处理后的函数
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastRan = 0;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    if (!inThrottle) {
      fn.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          fn.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * 请求管理类
 */
export class RequestManager {
  private activeRequests: Map<string, AbortController> = new Map();
  private queue: Array<{
    id: string;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = [];
  private processing = false;
  private maxConcurrent: number;
  
  /**
   * 构造函数
   * @param maxConcurrent 最大并发请求数
   */
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
  }
  
  /**
   * 添加请求到队列
   * @param id 请求唯一标识
   * @param requestFn 请求函数
   * @param options 请求选项
   * @returns Promise
   */
  enqueue<T>(id: string, requestFn: () => Promise<T>, options: {
    timeout?: number;
    priority?: number;
    cancelPrevious?: boolean;
  } = {}): Promise<T> {
    // 如果设置了取消之前的同名请求
    if (options.cancelPrevious && this.activeRequests.has(id)) {
      this.cancel(id);
    }
    
    return new Promise<T>((resolve, reject) => {
      // 包装执行函数
      const execute = async (): Promise<T> => {
        // 创建AbortController用于取消请求
        const controller = new AbortController();
        this.activeRequests.set(id, controller);
        
        // 如果设置了超时
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        if (options.timeout) {
          timeoutId = setTimeout(() => {
            this.cancel(id);
            reject(new Error('请求超时'));
          }, options.timeout);
        }
        
        try {
          const result = await requestFn();
          
          // 清除超时计时器
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          
          return result;
        } catch (error) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          throw error;
        } finally {
          this.activeRequests.delete(id);
          this.processQueue();
        }
      };
      
      // 添加到队列
      this.queue.push({
        id,
        execute,
        resolve,
        reject
      });
      
      // 尝试处理队列
      this.processQueue();
    });
  }
  
  /**
   * 处理队列
   */
  private processQueue(): void {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    // 计算可处理的请求数
    const availableSlots = this.maxConcurrent - this.activeRequests.size;
    
    if (availableSlots <= 0) {
      this.processing = false;
      return;
    }
    
    // 处理队列中的请求
    const toProcess = this.queue.splice(0, availableSlots);
    
    toProcess.forEach(async ({ execute, resolve, reject }) => {
      try {
        const result = await execute();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    this.processing = false;
    
    // 如果队列中还有请求，继续处理
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
  
  /**
   * 取消请求
   * @param id 请求ID
   */
  cancel(id: string): void {
    // 取消活动请求
    if (this.activeRequests.has(id)) {
      const controller = this.activeRequests.get(id)!;
      controller.abort();
      this.activeRequests.delete(id);
    }
    
    // 从队列中移除
    this.queue = this.queue.filter(item => item.id !== id);
  }
  
  /**
   * 取消所有请求
   */
  cancelAll(): void {
    // 取消所有活动请求
    this.activeRequests.forEach(controller => {
      controller.abort();
    });
    
    this.activeRequests.clear();
    this.queue = [];
  }
  
  /**
   * 创建请求ID
   * @param base 基础名称
   * @returns 唯一ID
   */
  static createRequestId(base: string): string {
    return `${base}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 带重试机制的fetch
 * @param url 请求URL
 * @param options fetch选项
 * @param retries 重试次数
 * @param retryDelay 重试延迟(毫秒)
 * @returns Promise
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  retryDelay = 1000
): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries <= 0) {
      throw err;
    }
    
    // 等待指定时间
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    
    // 递归重试，减少重试次数
    return fetchWithRetry(url, options, retries - 1, retryDelay);
  }
} 