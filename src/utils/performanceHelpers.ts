/**
 * 性能助手工具包，提供性能优化和监控功能
 */

/**
 * 防抖函数
 * 将在最后一次调用后等待指定时间再执行回调
 * 
 * @param func 要执行的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖处理后的函数
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait = 300
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(context, args);
      timeoutId = null;
    }, wait);
  };
};

/**
 * 节流函数
 * 确保函数在指定时间内最多执行一次
 * 
 * @param func 要执行的函数
 * @param limit 时间限制（毫秒）
 * @returns 节流处理后的函数
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit = 300
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
};

/**
 * 批量处理函数
 * 将多个操作分批处理，避免阻塞UI
 * 
 * @param items 要处理的项目数组
 * @param processItem 处理单个项目的函数
 * @param batchSize 每批处理的项目数量
 * @param delay 批次间延迟（毫秒）
 * @returns Promise，处理完成后解析
 */
export const batchProcess = <T, R>(
  items: T[],
  processItem: (item: T, index: number) => R,
  batchSize = 100,
  delay = 10
): Promise<R[]> => {
  return new Promise((resolve) => {
    const results: R[] = [];
    const totalItems = items.length;
    let currentIndex = 0;
    
    const processBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, totalItems);
      
      // 处理当前批次
      for (let i = currentIndex; i < endIndex; i++) {
        results[i] = processItem(items[i], i);
      }
      
      currentIndex = endIndex;
      
      // 检查是否所有批次都已处理
      if (currentIndex < totalItems) {
        // 延迟处理下一批次，给UI渲染留出时间
        setTimeout(processBatch, delay);
      } else {
        // 所有批次都已处理
        resolve(results);
      }
    };
    
    // 开始处理第一批次
    processBatch();
  });
};

/**
 * 延迟加载函数
 * 延迟执行函数，但不阻塞UI
 * 
 * @param func 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns Promise，函数执行完成后解析
 */
export const deferExecution = <T>(
  func: () => T,
  delay = 0
): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = func();
      resolve(result);
    }, delay);
  });
};

/**
 * 简单的性能计时器
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;
  
  /**
   * 开始计时
   */
  start(): void {
    this.startTime = performance.now();
  }
  
  /**
   * 结束计时
   * @returns 经过的时间（毫秒）
   */
  end(): number {
    this.endTime = performance.now();
    return this.duration();
  }
  
  /**
   * 获取计时器持续时间
   * @returns 持续时间（毫秒）
   */
  duration(): number {
    return this.endTime - this.startTime;
  }
  
  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
  }
} 