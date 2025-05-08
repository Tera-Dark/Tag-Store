/**
 * 标签索引服务
 * 提供标签数据的缓存和高效搜索功能
 */

import type { Tag } from '../types/data';
import { LRUCache } from '../utils/cacheHelpers';
import type { SearchIndexItem } from '../utils/searchHelpers';
import { createSearchIndex, performAdvancedSearch } from '../utils/searchHelpers';

// 默认缓存大小
const DEFAULT_INDEX_CACHE_SIZE = 10;
// 默认缓存过期时间（毫秒）- 5分钟
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * 标签索引服务类
 * 提供标签搜索和缓存功能
 */
export class TagIndexService {
  // 搜索索引缓存
  private searchIndex: SearchIndexItem[] = [];
  // 搜索结果缓存
  private searchResultCache: LRUCache<Tag[]>;
  // 最后更新时间
  private lastUpdated: number = 0;
  
  /**
   * 创建标签索引服务
   * @param cacheSize 搜索结果缓存大小
   * @param cacheTTL 缓存过期时间（毫秒）
   */
  constructor(cacheSize = DEFAULT_INDEX_CACHE_SIZE, cacheTTL = DEFAULT_CACHE_TTL) {
    this.searchResultCache = new LRUCache<Tag[]>(cacheSize, cacheTTL);
  }
  
  /**
   * 更新搜索索引
   * @param tags 标签列表
   */
  public updateIndex(tags: Tag[]): void {
    this.searchIndex = createSearchIndex(tags);
    this.lastUpdated = Date.now();
    this.searchResultCache.clear(); // 清空结果缓存
    console.log(`TagIndexService: 索引已更新，共 ${this.searchIndex.length} 个标签`);
  }
  
  /**
   * 搜索标签
   * @param tags 标签列表
   * @param searchTerm 搜索关键词
   * @param useCache 是否使用缓存
   * @returns 匹配的标签列表
   */
  public search(tags: Tag[], searchTerm: string, useCache = true): Tag[] {
    const normalizedTerm = searchTerm.trim();
    
    if (!normalizedTerm) {
      return tags; // 没有搜索词直接返回全部标签
    }
    
    // 生成缓存键
    const cacheKey = `${normalizedTerm}:${this.lastUpdated}:${tags.length}`;
    
    // 检查缓存
    if (useCache) {
      const cachedResult = this.searchResultCache.get(cacheKey);
      if (cachedResult) {
        console.log(`TagIndexService: 使用缓存的搜索结果 (${normalizedTerm})`);
        return cachedResult;
      }
    }
    
    // 执行搜索
    const result = performAdvancedSearch(tags, normalizedTerm, this.searchIndex);
    
    // 缓存结果
    if (useCache) {
      this.searchResultCache.set(cacheKey, result);
    }
    
    return result;
  }
  
  /**
   * 获取缓存大小
   * @returns 缓存中的项目数量
   */
  public getCacheSize(): number {
    return this.searchResultCache.size();
  }
  
  /**
   * 清除搜索结果缓存
   */
  public clearCache(): void {
    this.searchResultCache.clear();
    console.log('TagIndexService: 搜索结果缓存已清空');
  }
  
  /**
   * 获取索引大小
   * @returns 索引中的项目数量
   */
  public getIndexSize(): number {
    return this.searchIndex.length;
  }
  
  /**
   * 获取索引最后更新时间
   * @returns 最后更新时间戳
   */
  public getLastUpdated(): number {
    return this.lastUpdated;
  }
}

// 创建并导出单例实例
export const tagIndexService = new TagIndexService(); 