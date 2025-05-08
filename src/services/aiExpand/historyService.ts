import type { HistoryItem, Conversation } from '../../types/aiExpand';
import { v4 as uuidv4 } from 'uuid';

// 存储键名
const HISTORY_STORAGE_KEY = 'aiExpand_history';
const CONVERSATIONS_STORAGE_KEY = 'aiExpand_conversations';
const MAX_HISTORY_ITEMS = 100; // 最大历史记录数

/**
 * 加载历史记录
 * @returns 历史记录数组
 */
export function loadHistory(): HistoryItem[] {
  try {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!savedHistory) return [];
    
    const parsed = JSON.parse(savedHistory) as HistoryItem[];
    
    // 验证数据结构
    return parsed.filter(item => 
      item && 
      typeof item === 'object' &&
      typeof item.input === 'string' &&
      typeof item.output === 'string' &&
      typeof item.timestamp === 'string'
    );
  } catch (error) {
    console.error('加载AI历史记录失败:', error);
    return [];
  }
}

/**
 * 保存历史记录
 * @param history 历史记录数组
 */
export function saveHistory(history: HistoryItem[]): void {
  try {
    // 限制最大历史记录数量
    const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('保存AI历史记录失败:', error);
  }
}

/**
 * 添加历史记录项
 * @param item 新的历史记录项
 * @param history 现有历史记录数组（如果未提供则从存储加载）
 * @returns 更新后的历史记录数组
 */
export function addHistoryItem(item: HistoryItem, history?: HistoryItem[]): HistoryItem[] {
  try {
    if (!item.timestamp) {
      item.timestamp = new Date().toISOString();
    }
    
    // 如果未提供历史记录，则从存储加载
    const currentHistory = history || loadHistory();
    
    // 添加新记录到历史数组的开头
    const updatedHistory = [item, ...currentHistory];
    
    // 保存更新后的历史记录
    saveHistory(updatedHistory);
    
    return updatedHistory;
  } catch (error) {
    console.error('添加历史记录项失败:', error);
    throw error;
  }
}

/**
 * 清空历史记录
 */
export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('清空历史记录失败:', error);
  }
}

/**
 * 加载对话列表
 * @returns 对话数组
 */
export function loadConversations(): Conversation[] {
  try {
    const savedConversations = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!savedConversations) return [];
    
    const parsed = JSON.parse(savedConversations) as Conversation[];
    
    // 验证数据结构
    return parsed.filter(conversation => 
      conversation && 
      typeof conversation === 'object' &&
      typeof conversation.id === 'string' &&
      typeof conversation.title === 'string' &&
      Array.isArray(conversation.items)
    );
  } catch (error) {
    console.error('加载对话列表失败:', error);
    return [];
  }
}

/**
 * 保存对话列表
 * @param conversations 对话数组
 */
export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('保存对话列表失败:', error);
  }
}

/**
 * 创建新对话
 * @param title 对话标题
 * @param provider 服务提供商ID
 * @param conversations 现有对话数组（如果未提供则从存储加载）
 * @returns 新创建的对话和更新后的对话数组
 */
export function createConversation(
  title: string = '新对话',
  provider: string = 'openrouter',
  conversations?: Conversation[]
): { conversation: Conversation; allConversations: Conversation[] } {
  try {
    // 创建新对话
    const newConversation: Conversation = {
      id: uuidv4(),
      title,
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider
    };
    
    // 如果未提供对话数组，则从存储加载
    const currentConversations = conversations || loadConversations();
    
    // 添加新对话到数组
    const updatedConversations = [newConversation, ...currentConversations];
    
    // 保存更新后的对话数组
    saveConversations(updatedConversations);
    
    return {
      conversation: newConversation,
      allConversations: updatedConversations
    };
  } catch (error) {
    console.error('创建新对话失败:', error);
    throw error;
  }
}

/**
 * 获取对话
 * @param conversationId 对话ID
 * @param conversations 现有对话数组（如果未提供则从存储加载）
 * @returns 对话或null
 */
export function getConversation(
  conversationId: string,
  conversations?: Conversation[]
): Conversation | null {
  try {
    // 如果未提供对话数组，则从存储加载
    const currentConversations = conversations || loadConversations();
    
    // 查找对话
    return currentConversations.find(conv => conv.id === conversationId) || null;
  } catch (error) {
    console.error('获取对话失败:', error);
    return null;
  }
}

/**
 * 更新对话
 * @param conversationId 对话ID
 * @param updates 更新内容
 * @param conversations 现有对话数组（如果未提供则从存储加载）
 * @returns 更新后的对话数组
 */
export function updateConversation(
  conversationId: string,
  updates: Partial<Conversation>,
  conversations?: Conversation[]
): Conversation[] {
  try {
    // 如果未提供对话数组，则从存储加载
    const currentConversations = conversations || loadConversations();
    
    // 找到要更新的对话
    const index = currentConversations.findIndex(conv => conv.id === conversationId);
    
    if (index === -1) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    // 更新对话
    currentConversations[index] = {
      ...currentConversations[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // 保存更新后的对话数组
    saveConversations(currentConversations);
    
    return currentConversations;
  } catch (error) {
    console.error('更新对话失败:', error);
    throw error;
  }
}

/**
 * 删除对话
 * @param conversationId 对话ID
 * @param conversations 现有对话数组（如果未提供则从存储加载）
 * @returns 更新后的对话数组
 */
export function deleteConversation(
  conversationId: string,
  conversations?: Conversation[]
): Conversation[] {
  try {
    // 如果未提供对话数组，则从存储加载
    const currentConversations = conversations || loadConversations();
    
    // 过滤掉要删除的对话
    const updatedConversations = currentConversations.filter(conv => conv.id !== conversationId);
    
    // 保存更新后的对话数组
    saveConversations(updatedConversations);
    
    return updatedConversations;
  } catch (error) {
    console.error('删除对话失败:', error);
    throw error;
  }
}

/**
 * 添加消息到对话
 * @param conversationId 对话ID
 * @param input 用户输入
 * @param output AI输出
 * @param provider 服务提供商ID（可选，如不提供则使用对话中的默认值）
 * @param conversations 现有对话数组（如果未提供则从存储加载）
 * @returns 更新后的对话数组
 */
export function addMessageToConversation(
  conversationId: string,
  input: string,
  output: string,
  provider?: string,
  conversations?: Conversation[]
): Conversation[] {
  try {
    // 如果未提供对话数组，则从存储加载
    const currentConversations = conversations || loadConversations();
    
    // 找到目标对话
    const index = currentConversations.findIndex(conv => conv.id === conversationId);
    
    if (index === -1) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    // 创建消息
    const message: HistoryItem = {
      input,
      output,
      timestamp: new Date().toISOString(),
      provider: provider || currentConversations[index].provider
    };
    
    // 添加消息到对话
    currentConversations[index].items.push(message);
    
    // 更新对话的更新时间
    currentConversations[index].updatedAt = new Date().toISOString();
    
    // 保存更新后的对话数组
    saveConversations(currentConversations);
    
    return currentConversations;
  } catch (error) {
    console.error('添加消息到对话失败:', error);
    throw error;
  }
}

/**
 * 清空对话历史
 * @param conversationId 对话ID
 * @param conversations 现有对话数组（如果未提供则从存储加载）
 * @returns 更新后的对话数组
 */
export function clearConversationHistory(
  conversationId: string,
  conversations?: Conversation[]
): Conversation[] {
  try {
    // 如果未提供对话数组，则从存储加载
    const currentConversations = conversations || loadConversations();
    
    // 找到目标对话
    const index = currentConversations.findIndex(conv => conv.id === conversationId);
    
    if (index === -1) {
      throw new Error(`对话不存在: ${conversationId}`);
    }
    
    // 清空对话的消息
    currentConversations[index].items = [];
    
    // 更新对话的更新时间
    currentConversations[index].updatedAt = new Date().toISOString();
    
    // 保存更新后的对话数组
    saveConversations(currentConversations);
    
    return currentConversations;
  } catch (error) {
    console.error('清空对话历史失败:', error);
    throw error;
  }
} 