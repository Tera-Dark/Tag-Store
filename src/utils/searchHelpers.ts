/**
 * 搜索助手工具包，提供高级搜索功能和搜索索引优化
 */

import type { Tag } from '../types/data';

// 搜索索引项接口
export interface SearchIndexItem {
  id: string;
  searchText: string; // 预处理的搜索文本
}

/**
 * 创建标签的搜索索引
 * @param tags 标签列表
 * @returns 搜索索引
 */
export const createSearchIndex = (tags: Tag[]): SearchIndexItem[] => {
  return tags.map(tag => {
    // 将所有可搜索字段连接为一个字符串，并转换为小写
    const searchText = [
      tag.name || '',
      tag.keyword || '',
      ...(tag.subtitles || [])
    ].join(' ').toLowerCase();
    
    return {
      id: tag.id,
      searchText
    };
  });
};

/**
 * 从搜索索引中过滤匹配的标签ID
 * @param searchIndex 搜索索引
 * @param searchTerm 搜索关键词
 * @returns 匹配的标签ID集合
 */
export const filterBySearchTerm = (searchIndex: SearchIndexItem[], searchTerm: string): Set<string> => {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  
  if (!normalizedTerm) {
    return new Set(); // 返回空集合，表示不过滤
  }
  
  // 支持多关键词搜索 (用空格分隔)
  const terms = normalizedTerm.split(/\s+/).filter(term => term.length > 0);
  
  if (terms.length === 0) {
    return new Set(); // 没有有效关键词
  }
  
  // 单一关键词搜索
  if (terms.length === 1) {
    return new Set(
      searchIndex
        .filter(item => item.searchText.includes(terms[0]))
        .map(item => item.id)
    );
  }
  
  // 多关键词搜索 (AND 逻辑)
  return new Set(
    searchIndex
      .filter(item => terms.every(term => item.searchText.includes(term)))
      .map(item => item.id)
  );
};

/**
 * 执行高级搜索
 * @param tags 标签列表
 * @param searchTerm 搜索关键词
 * @param searchIndex 可选的预建索引
 * @returns 匹配的标签列表
 */
export const performAdvancedSearch = (
  tags: Tag[],
  searchTerm: string,
  searchIndex?: SearchIndexItem[]
): Tag[] => {
  const normalizedTerm = searchTerm.trim();
  
  if (!normalizedTerm) {
    return tags; // 没有搜索词时返回所有标签
  }
  
  // 如果提供了预建索引，使用它进行搜索
  if (searchIndex && searchIndex.length > 0) {
    const matchedIds = filterBySearchTerm(searchIndex, normalizedTerm);
    
    // 如果没有匹配项，返回空数组
    if (matchedIds.size === 0) {
      return [];
    }
    
    // 否则返回匹配的标签
    return tags.filter(tag => matchedIds.has(tag.id));
  }
  
  // 如果没有预建索引，临时建立索引
  const tempIndex = createSearchIndex(tags);
  const matchedIds = filterBySearchTerm(tempIndex, normalizedTerm);
  
  // 返回匹配的标签
  return tags.filter(tag => matchedIds.has(tag.id));
}; 