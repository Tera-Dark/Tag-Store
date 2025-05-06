/**
 * 安全的字符串比较函数，处理可能的非字符串或空值
 */
export const safeCompare = (a: any, b: any) => {
  // 检查对象和属性是否存在
  if (!a || !b) return 0;
  
  // 检查a.name是否是字符串
  const aName = a.name && typeof a.name === 'string' ? a.name : '';
  // 检查b.name是否是字符串
  const bName = b.name && typeof b.name === 'string' ? b.name : '';
  
  // 使用localeCompare进行比较
  return aName.localeCompare(bName);
};

/**
 * 过滤无效的标签对象
 */
export const filterValidTags = (tags: any[]) => {
  return tags.filter(tag => tag && typeof tag === 'object' && tag.name && typeof tag.name === 'string');
}; 