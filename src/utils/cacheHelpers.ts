/**
 * 缓存助手工具包，提供通用缓存管理功能
 */

/**
 * 缓存项定义
 */
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt?: number; // 可选的过期时间戳
}

/**
 * 内存缓存实现
 */
export class MemoryCache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private defaultTTL: number; // 默认过期时间（毫秒）
  
  /**
   * 创建内存缓存
   * @param defaultTTL 默认缓存时间（毫秒），默认为5分钟
   */
  constructor(defaultTTL = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * 设置缓存项
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 可选的自定义过期时间（毫秒）
   */
  set(key: string, data: T, ttl?: number): void {
    const timestamp = Date.now();
    const expiresAt = ttl ? timestamp + ttl : timestamp + this.defaultTTL;
    
    this.cache.set(key, {
      data,
      timestamp,
      expiresAt
    });
  }
  
  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存数据，如果不存在或已过期则返回null
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 检查是否过期
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * 删除缓存项
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * 清理过期缓存
   * @returns 清理的缓存项数量
   */
  cleanup(): number {
    const now = Date.now();
    let cleanupCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        this.cache.delete(key);
        cleanupCount++;
      }
    }
    
    return cleanupCount;
  }
  
  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * 创建一个基于LRU（最近最少使用）策略的缓存
 * 在到达最大容量时，自动清除最久未使用的项
 */
export class LRUCache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private maxSize: number; // 最大缓存条目数
  private defaultTTL: number; // 默认过期时间（毫秒）
  
  /**
   * 创建LRU缓存
   * @param maxSize 最大缓存条目数，默认为100
   * @param defaultTTL 默认缓存时间（毫秒），默认为5分钟
   */
  constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * 设置缓存项
   * @param key 缓存键
   * @param data 缓存数据
   * @param ttl 可选的自定义过期时间（毫秒）
   */
  set(key: string, data: T, ttl?: number): void {
    // 如果键已存在，先删除它（以更新其位置）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // 如果缓存已满，删除最早的条目
    else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    
    const timestamp = Date.now();
    const expiresAt = ttl ? timestamp + ttl : timestamp + this.defaultTTL;
    
    // 将新条目添加到缓存末尾（最近使用）
    this.cache.set(key, {
      data,
      timestamp,
      expiresAt
    });
  }
  
  /**
   * 获取缓存项（同时会更新其位置）
   * @param key 缓存键
   * @returns 缓存数据，如果不存在或已过期则返回null
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 检查是否过期
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.delete(key);
      return null;
    }
    
    // 更新位置（删除并重新添加到末尾）
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.data;
  }
  
  /**
   * 删除缓存项
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
} 