<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { NScrollbar, NButton, NIcon, NInput, NModal, NSpace, NDivider, NBadge } from 'naive-ui';
import { 
  TrashOutline as DeleteIcon, 
  AddCircleOutline as AddIcon,
  PencilOutline as EditIcon,
  ChatbubbleOutline as ChatIcon,
  TimeOutline as HistoryIcon,
  InformationCircleOutline as InfoIcon
} from '@vicons/ionicons5';
import type { HistoryItem, Conversation } from '../../types/aiExpand';
import { 
  loadConversations,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
  deleteConversation as apiDeleteConversation,
  addMessageToConversation as apiAddMessageToConversation
} from '../../services/aiExpand/historyService';
import { useMessage } from 'naive-ui';
import { useAiExpandStore } from '../../stores/aiExpandStore';

// Simple local implementation for formatTime
const formatTime = (isoString: string) => {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString();
  } catch (e) {
    return isoString; // fallback to original string if parsing fails
  }
};

const aiExpandStore = useAiExpandStore();
const message = useMessage();

// 定义组件属性
const props = defineProps<{
  history: HistoryItem[];
  currentProvider: string;
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'select', item: HistoryItem): void;
  (e: 'clear'): void;
  (e: 'switch-conversation', items: HistoryItem[]): void;
  (e: 'new-conversation'): void;
}>();

// 组件状态
const conversations = ref<Conversation[]>([]);
const currentConversationId = ref<string | null>(null);
const showEditModal = ref(false);
const editingConversation = ref<Conversation | null>(null);
const confirmDeleteId = ref<string | null>(null);
const showHelpTips = ref(true);

// 加载所有会话
onMounted(() => {
  // 加载会话列表
  conversations.value = loadConversations();
  
  // 获取当前会话ID
  if (aiExpandStore.activeConversationId) {
    currentConversationId.value = aiExpandStore.activeConversationId;
  } else if (conversations.value.length > 0) {
    currentConversationId.value = conversations.value[0].id;
    aiExpandStore.activeConversationId = conversations.value[0].id;
  } else {
    // No conversations, create one if needed or handle empty state
    // Potentially create an initial conversation if none exist and auto-select it
    // createLocalConversation(); // Example: Call if you want to auto-create one
  }
});

watch(currentConversationId, (newId, oldId) => {
  if (newId) {
    aiExpandStore.activeConversationId = newId;
    const conv = conversations.value.find(c => c.id === newId);
    if (conv) {
      if (conv.items.length === 0 && newId !== oldId) { // Switched to an empty, new conversation
        emit('new-conversation');
      } else if (newId !== oldId) { // Switched to an existing conversation with items
        emit('switch-conversation', conv.items);
      }
    }
  }
});

// 处理历史记录选择
const handleHistorySelect = (item: HistoryItem) => {
  emit('select', item);
};

// 处理清除历史记录
const handleClearHistory = () => {
  emit('clear');
};

// 创建新会话
const createLocalConversation = () => {
  if (!props.currentProvider) {
    message.error('无法创建新对话：未选择服务提供商。');
    return;
  }
  const { conversation: newConv, allConversations: updatedConversations } = apiCreateConversation(
    '新对话', // Title for new conversation
    props.currentProvider,
    conversations.value
  );
  conversations.value = updatedConversations;
  currentConversationId.value = newConv.id; // This will trigger the watcher above
  message.success('新对话已创建');
  // Watcher for currentConversationId will emit 'new-conversation' or 'switch-conversation'
};

// 编辑会话
const editConversation = (conversation: Conversation) => {
  editingConversation.value = { ...conversation };
  showEditModal.value = true;
};

// 保存会话编辑
const saveConversationEdit = async () => {
  if (!editingConversation.value) return;
  
  if (editingConversation.value && editingConversation.value.id) {
    try {
      const updatedConversations = await apiUpdateConversation(editingConversation.value.id, { title: editingConversation.value.title }, conversations.value);
      conversations.value = updatedConversations;
      message.success('对话标题已更新');
      editingConversation.value = null;
      showEditModal.value = false;
    } catch (error) {
      message.error('更新对话标题失败');
      console.error('Failed to update conversation title:', error);
    }
  } else {
    message.error('无法更新对话：无效的编辑数据。');
  }
};

// 确认删除会话
const confirmDelete = (id: string) => {
  confirmDeleteId.value = id;
};

// 执行删除会话
const executeDelete = async () => {
  if (!confirmDeleteId.value) return;
  
  try {
    const updatedConversations = await apiDeleteConversation(confirmDeleteId.value, conversations.value);
    conversations.value = updatedConversations;
    message.success('对话已删除');
    if (confirmDeleteId.value === currentConversationId.value) {
      const nextConversation = conversations.value.length > 0 ? conversations.value[0] : null;
      if (nextConversation) {
        currentConversationId.value = nextConversation.id;
        // Watcher will handle emit
      } else {
        currentConversationId.value = null;
        emit('new-conversation'); // Explicitly emit if no conversations left
      }
    }
  } catch (error) {
    message.error('删除对话失败');
    console.error('Failed to delete conversation:', error);
  }
  
  confirmDeleteId.value = null;
};

// 关闭帮助提示
const closeHelpTips = () => {
  showHelpTips.value = false;
  localStorage.setItem('aiExpandHelpTipsClosed', 'true');
};

const addMessageToCurrentConversation = async (input: string, output: string, provider: string) => {
  if (!currentConversationId.value) {
    message.error('无法保存消息：当前没有选中的对话。');
    return;
  }
  try {
    const updatedConversations = await apiAddMessageToConversation(
      currentConversationId.value,
      input,
      output,
      provider,
      conversations.value
    );
    conversations.value = updatedConversations;
    // Find the updated current conversation and emit its items to refresh the parent view
    const currentConv = conversations.value.find(c => c.id === currentConversationId.value);
    if (currentConv) {
      emit('switch-conversation', currentConv.items);
    }

  } catch (error) {
    message.error('保存消息到对话失败');
    console.error('Failed to add message to conversation:', error);
  }
};

// Expose necessary functions to be called from parent or used in template
defineExpose({
  addMessageToCurrentConversation,
  getCurrentConversationId: () => currentConversationId.value
});

// 切换会话
const switchConversation = (conversation: Conversation) => {
  if (!conversation || conversation.id === currentConversationId.value) return;
  currentConversationId.value = conversation.id;
  // The watcher for currentConversationId will handle emitting events
  // and updating the store.
};
</script>

<template>
  <div class="history-manager">
    <div class="history-header">
      <h3 class="history-title">历史与会话</h3>
      <NSpace class="history-actions">
        <NButton 
          secondary
          size="small" 
          @click="createLocalConversation" 
          class="action-button create-button"
        >
          <template #icon><NIcon :component="AddIcon" /></template>
          新建会话
        </NButton>
        <NButton 
          secondary
          size="small" 
          @click="handleClearHistory" 
          class="action-button clear-button"
        >
          <template #icon><NIcon :component="DeleteIcon" /></template>
          清空
        </NButton>
      </NSpace>
    </div>
    
    <!-- 会话模块 -->
    <div class="module-container">
      <div class="module-header">
        <div class="module-title">
          <NIcon :component="ChatIcon" class="module-icon" />
          <span>会话记录</span>
        </div>
      </div>
      
      <div v-if="conversations.length === 0" class="empty-state">
        <div class="empty-icon">
          <NIcon :component="ChatIcon" size="48" />
        </div>
        <div class="empty-text">暂无会话记录</div>
        <NButton 
          type="primary" 
          size="small" 
          class="empty-action" 
          @click="createLocalConversation"
        >
          <template #icon><NIcon :component="AddIcon" /></template>
          创建新会话
        </NButton>
      </div>
      
      <NScrollbar v-else style="max-height: 180px; padding: 4px 0;">
        <div class="conversation-list">
          <div 
            v-for="conv in conversations" 
            :key="conv.id" 
            class="conversation-card"
            :class="{ 'active': conv.id === currentConversationId }"
            @click="switchConversation(conv)"
          >
            <div class="conversation-header">
              <div class="conversation-title-wrapper">
                <div class="conversation-title">{{ conv.title }}</div>
                <NBadge 
                  :value="conv.items.length" 
                  :show="conv.items.length > 0"
                  :max="99"
                  class="message-badge"
                />
              </div>
              <div class="conversation-provider">{{ conv.provider }}</div>
            </div>
            
            <div class="conversation-preview">
              {{ conv.items.length > 0 
                ? (conv.items[0].input.slice(0, 60) + (conv.items[0].input.length > 60 ? '...' : '')) 
                : '空会话' }}
            </div>
            
            <div class="conversation-footer">
              <span class="conversation-time">{{ formatTime(conv.updatedAt) }}</span>
              <div class="conversation-actions">
                <NButton
                  text
                  size="tiny"
                  class="conv-action-btn edit-btn"
                  @click.stop="editConversation(conv)"
                  title="编辑会话"
                >
                  <template #icon><NIcon :component="EditIcon" /></template>
                </NButton>
                <NButton
                  text
                  class="conv-action-btn delete-btn"
                  size="tiny"
                  @click.stop="confirmDelete(conv.id)"
                  title="删除会话"
                >
                  <template #icon><NIcon :component="DeleteIcon" /></template>
                </NButton>
              </div>
            </div>
          </div>
        </div>
      </NScrollbar>
    </div>
    
    <NDivider class="module-divider" />
    
    <!-- 历史记录模块 -->
    <div class="module-container">
      <div class="module-header">
        <div class="module-title">
          <NIcon :component="HistoryIcon" class="module-icon" />
          <span>历史记录</span>
        </div>
      </div>
      
      <div v-if="history.length === 0" class="empty-state">
        <div class="empty-icon">
          <NIcon :component="HistoryIcon" size="48" />
        </div>
        <div class="empty-text">暂无历史记录</div>
        <div class="empty-description">使用AI扩写功能后将自动保存记录</div>
      </div>
      
      <NScrollbar v-else style="max-height: 180px; padding: 4px 0;">
        <div class="history-list">
          <div 
            v-for="(item, index) in history" 
            :key="index" 
            class="history-card"
            @click="handleHistorySelect(item)"
          >
            <div class="history-content">
              {{ item.input.slice(0, 60) }}{{ item.input.length > 60 ? '...' : '' }}
            </div>
            <div class="history-meta">
              <span class="history-provider">{{ item.provider }}</span>
              <span class="history-time">{{ formatTime(item.timestamp) }}</span>
            </div>
          </div>
        </div>
      </NScrollbar>
    </div>
    
    <div class="help-tips" v-if="showHelpTips">
      <div class="tips-header">
        <NIcon :component="InfoIcon" class="tips-icon" />
        <span class="tips-title">使用提示</span>
        <NButton text size="tiny" class="close-tips" @click="closeHelpTips">
          关闭
        </NButton>
      </div>
      <ul class="tips-list">
        <li class="tip-item">点击 <NIcon :component="AddIcon" size="14" /> 创建新会话</li>
        <li class="tip-item">点击会话切换到该会话</li>
        <li class="tip-item">使用侧边栏选择模型和提示词模板</li>
        <li class="tip-item">历史记录将自动保存</li>
      </ul>
    </div>
    
    <!-- 编辑会话对话框 -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      title="编辑会话"
      class="edit-dialog"
    >
      <NInput 
        v-if="editingConversation" 
        v-model:value="editingConversation.title" 
        placeholder="会话标题"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">取消</NButton>
          <NButton type="primary" @click="saveConversationEdit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
    
    <!-- 删除确认对话框 -->
    <NModal
      :show="!!confirmDeleteId"
      preset="dialog"
      title="确认删除"
      content="确定要删除这个会话吗？此操作不可恢复。"
      positive-text="确认"
      negative-text="取消"
      @positive-click="executeDelete"
      @negative-click="confirmDeleteId = null"
      @close="confirmDeleteId = null"
    />
  </div>
</template>

<style scoped>
.history-manager {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--n-card-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
}

.history-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--n-title-text-color);
}

.history-actions {
  display: flex;
  gap: 8px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.create-button {
  color: var(--primary-color);
}

.clear-button {
  color: var(--n-error-color);
}

.module-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.module-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 14px;
  color: var(--n-text-color);
}

.module-icon {
  font-size: 16px;
  color: var(--primary-color);
}

.module-divider {
  margin: 8px 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  color: var(--n-text-color-3);
  background-color: var(--n-color-light);
  border-radius: 8px;
  margin: 0;
}

.empty-icon {
  margin-bottom: 12px;
  color: var(--n-text-color-disabled);
}

.empty-text {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 6px;
}

.empty-description {
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--n-text-color-3);
}

.empty-action {
  margin-top: 8px;
}

.conversation-list,
.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px;
}

.conversation-card,
.history-card {
  padding: 12px;
  border-radius: 8px;
  background-color: var(--n-color-light);
  transition: all 0.2s;
  cursor: pointer;
  border: 1px solid transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.conversation-card:hover,
.history-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
  background-color: var(--n-color-light-hover);
}

.conversation-card.active {
  border-color: var(--primary-color);
  background-color: rgba(var(--primary-color-rgb), 0.05);
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.conversation-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.conversation-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--n-title-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.message-badge {
  margin-top: -2px;
}

.conversation-provider {
  font-size: 12px;
  color: var(--n-text-color-3);
  background-color: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: 4px;
}

.conversation-preview {
  font-size: 13px;
  color: var(--n-text-color-2);
  margin-bottom: 10px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 36px;
}

.conversation-footer,
.history-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.conversation-time,
.history-time {
  font-size: 12px;
}

.conversation-actions {
  display: flex;
  gap: 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.conversation-card:hover .conversation-actions {
  opacity: 1;
}

.conv-action-btn {
  padding: 2px 4px;
  border-radius: 4px;
}

.edit-btn:hover {
  color: var(--primary-color);
  background-color: rgba(var(--primary-color-rgb), 0.1);
}

.delete-btn:hover {
  color: var(--n-error-color);
  background-color: rgba(var(--error-color-rgb), 0.1);
}

.history-content {
  font-size: 13px;
  color: var(--n-text-color);
  margin-bottom: 8px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 36px;
}

.history-meta {
  font-size: 12px;
}

.history-provider {
  padding: 2px 6px;
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
}

.help-tips {
  margin-top: 8px;
  padding: 12px;
  border-radius: 8px;
  background-color: rgba(var(--primary-color-rgb), 0.05);
  border: 1px solid rgba(var(--primary-color-rgb), 0.1);
}

.tips-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.tips-icon {
  font-size: 16px;
  color: var(--primary-color);
  margin-right: 6px;
}

.tips-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary-color);
  flex: 1;
}

.close-tips {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.tips-list {
  list-style: none;
  padding-left: 6px;
  margin: 6px 0 0;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--n-text-color-2);
  margin-bottom: 6px;
  line-height: 1.4;
}

.tip-item::before {
  content: "•";
  color: var(--primary-color);
}

.edit-dialog {
  width: 400px;
}
</style> 