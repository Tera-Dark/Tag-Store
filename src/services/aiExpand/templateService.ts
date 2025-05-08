import type { PromptTemplate } from '../../types/aiExpand';

// 存储键名
const STORAGE_KEY = 'aiExpand_templates';

/**
 * 默认提示词模板
 */
export const defaultTemplates: PromptTemplate[] = [
  { label: '通用扩写', value: 'general', content: '请将以下内容扩写成更加丰富和详细的描述：\n\n{content}' },
  { label: '创意写作', value: 'creative', content: '请基于以下内容，创造性地扩展并丰富故事情节：\n\n{content}' },
  { label: '学术风格', value: 'academic', content: '请将以下内容以学术风格扩写，增加专业术语和引用：\n\n{content}' },
  { label: '营销文案', value: 'marketing', content: '请将以下内容改写为吸引人的营销文案，突出其价值和吸引力：\n\n{content}' },
  { label: '技术文档', value: 'technical', content: '请将以下内容改写为技术文档风格，增加专业术语和清晰的结构：\n\n{content}' },
  { label: '产品描述', value: 'product', content: '请将以下内容改写为产品描述，突出其特点、优势和使用场景：\n\n{content}' },
  { label: '新闻报道', value: 'news', content: '请将以下内容改写为新闻报道风格，客观、准确地扩展内容：\n\n{content}' },
  { label: '英文翻译扩写', value: 'english', content: '请将以下中文内容翻译成英文并进行适当扩写，使其更加流畅自然：\n\n{content}' },
];

/**
 * 加载提示词模板
 * @param defaultTemplates 默认模板，当本地没有保存时使用
 * @returns 模板数组
 */
export function loadTemplates(defaultTemplates: PromptTemplate[]): PromptTemplate[] {
  try {
    const savedTemplates = localStorage.getItem(STORAGE_KEY);
    if (!savedTemplates) return [...defaultTemplates];
    
    const parsed = JSON.parse(savedTemplates) as PromptTemplate[];
    
    // 确保从存储中加载的模板有效
    const validTemplates = parsed.filter(template => 
      template && 
      typeof template === 'object' &&
      typeof template.label === 'string' && 
      typeof template.value === 'string' && 
      typeof template.content === 'string'
    );
    
    return validTemplates.length > 0 ? validTemplates : [...defaultTemplates];
  } catch (error) {
    console.error('加载提示词模板失败:', error);
    return [...defaultTemplates];
  }
}

/**
 * 保存提示词模板
 * @param templates 要保存的模板数组
 */
export function saveTemplate(templates: PromptTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('保存提示词模板失败:', error);
  }
}

/**
 * 保存单个提示词模板
 * @param template 要保存的模板
 * @param templates 现有模板数组（如果未提供则从存储加载）
 */
export function saveSingleTemplate(template: PromptTemplate, templates?: PromptTemplate[]): PromptTemplate[] {
  if (!template || !template.value || !template.label || !template.content) {
    throw new Error('提示词模板无效');
  }
  
  try {
    // 如果未提供现有模板，则从存储加载
    const existingTemplates = templates || loadTemplates(defaultTemplates);
    
    // 查找是否已存在同名模板
    const index = existingTemplates.findIndex(t => t.value === template.value);
    
    if (index >= 0) {
      // 更新现有模板
      existingTemplates[index] = template;
    } else {
      // 添加新模板
      existingTemplates.push(template);
    }
    
    // 保存更新后的模板
    saveTemplate(existingTemplates);
    
    return existingTemplates;
  } catch (error) {
    console.error('保存单个提示词模板失败:', error);
    throw error;
  }
}

/**
 * 删除提示词模板
 * @param templateValue 要删除的模板的value
 * @param templates 现有模板数组（如果未提供则从存储加载）
 */
export function deleteTemplate(templateValue: string, templates?: PromptTemplate[]): PromptTemplate[] {
  if (!templateValue) {
    throw new Error('模板值无效');
  }
  
  try {
    // 如果未提供现有模板，则从存储加载
    const existingTemplates = templates || loadTemplates(defaultTemplates);
    
    // 过滤掉要删除的模板
    const updatedTemplates = existingTemplates.filter(t => t.value !== templateValue);
    
    // 保存更新后的模板
    saveTemplate(updatedTemplates);
    
    return updatedTemplates;
  } catch (error) {
    console.error('删除提示词模板失败:', error);
    throw error;
  }
}

/**
 * 导出模板为JSON文件
 * @param templates 要导出的模板数组（如果未提供则从存储加载）
 */
export function exportTemplates(templates?: PromptTemplate[]): void {
  try {
    // 如果未提供模板，则从存储加载
    const templatesData = templates || loadTemplates(defaultTemplates);
    
    // 创建Blob对象
    const blob = new Blob([JSON.stringify(templatesData, null, 2)], { type: 'application/json' });
    
    // 创建URL
    const url = URL.createObjectURL(blob);
    
    // 创建a标签并触发下载
    const link = document.createElement('a');
    link.href = url;
    link.download = `aiexpand_templates_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    // 释放URL
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('导出提示词模板失败:', error);
    throw error;
  }
}

/**
 * 导入模板
 * @param jsonString JSON字符串或文件内容
 * @param replace 是否替换现有模板（默认合并）
 */
export function importTemplates(jsonString: string, replace: boolean = false): PromptTemplate[] {
  if (!jsonString) {
    throw new Error('导入内容为空');
  }
  
  try {
    // 解析JSON
    const importedData = JSON.parse(jsonString);
    
    // 验证数据格式
    if (!Array.isArray(importedData)) {
      throw new Error('导入数据格式无效，应为数组');
    }
    
    // 验证每个模板对象
    const validTemplates = importedData.filter(template => 
      template && 
      typeof template === 'object' &&
      typeof template.label === 'string' && 
      typeof template.value === 'string' && 
      typeof template.content === 'string'
    );
    
    if (validTemplates.length === 0) {
      throw new Error('导入数据不包含有效的模板');
    }
    
    // 如果选择替换，直接保存导入的模板
    if (replace) {
      saveTemplate(validTemplates);
      return validTemplates;
    }
    
    // 否则合并现有模板
    const existingTemplates = loadTemplates(defaultTemplates);
    
    // 合并策略：如果导入模板中有同名模板，替换现有模板
    validTemplates.forEach(importedTemplate => {
      const index = existingTemplates.findIndex(t => t.value === importedTemplate.value);
      
      if (index >= 0) {
        existingTemplates[index] = importedTemplate;
      } else {
        existingTemplates.push(importedTemplate);
      }
    });
    
    // 保存合并后的模板
    saveTemplate(existingTemplates);
    
    return existingTemplates;
  } catch (error) {
    console.error('导入提示词模板失败:', error);
    throw error;
  }
} 