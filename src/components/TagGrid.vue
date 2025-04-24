<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NGrid, NGi, NText, NEmpty, useMessage, useDialog, NButton, NSpace, NCheckbox, NFlex, NButtonGroup } from 'naive-ui';
import { useTagStore } from '../stores/tagStore';
import TagCard from './TagCard.vue';
import TagDialog from './dialogs/TagDialog.vue';
import BatchMoveDialog from './dialogs/BatchMoveDialog.vue';
import type { Tag } from '../types/data';

const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

const filteredTags = computed(() => tagStore.filteredTags);
const isLoading = computed(() => tagStore.isLoading);

// --- Selection State ---
const selectedTagIds = ref<Set<string>>(new Set());

// Computed property to check if any tag is selected
const hasSelection = computed(() => selectedTagIds.value.size > 0);

// --- Computed properties for Select All checkbox state ---
const isAllSelected = computed(() => {
    const currentTagIds = filteredTags.value.map(tag => tag.id);
    return currentTagIds.length > 0 && currentTagIds.every(id => selectedTagIds.value.has(id));
});

const isIndeterminate = computed(() => {
    return hasSelection.value && !isAllSelected.value;
});

// --- Handle Selection Change from TagCard ---
const handleSelectionChange = (payload: { id: string; selected: boolean }) => {
    const newSet = new Set(selectedTagIds.value); // Clone to ensure reactivity
    if (payload.selected) {
        newSet.add(payload.id);
    } else {
        newSet.delete(payload.id);
    }
    selectedTagIds.value = newSet;
};

const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
        // Select all currently filtered tags
        const currentTagIds = filteredTags.value.map(tag => tag.id);
        selectedTagIds.value = new Set(currentTagIds);
    } else {
        // Deselect all
        selectedTagIds.value.clear();
    }
};

// Watch for changes in filteredTags or filterCategoryId to potentially clear selection
watch(() => tagStore.filterCategoryId, () => {
    selectedTagIds.value.clear(); // Clear selection when category changes
});
watch(filteredTags, () => {
    // Optional: More complex logic could try to preserve selection 
    // if the same tags are still present after search term change, but clearing is simpler.
    if (tagStore.searchTerm) { // Clear selection if search term is active causing filter changes
       // We might not always want to clear on search, depends on UX preference.
       // Let's clear for now for simplicity.
        selectedTagIds.value.clear();
    }
}, { deep: true }); // Deep watch might be needed if tag properties change affecting filter

// --- Dialog State (Add/Edit) ---
const showTagDialog = ref(false);
const tagDialogMode = ref<'add' | 'edit'>('add');
const tagToEdit = ref<Tag | null>(null);
const initialCategoryId = ref<string | null>(null); // For adding tag to specific category

// --- Dialog Actions (Add/Edit) ---
const handleOpenEditDialog = (tag: Tag) => {
  tagDialogMode.value = 'edit';
  tagToEdit.value = tag;
  initialCategoryId.value = tag.categoryId || null;
  showTagDialog.value = true;
};

const handleDialogSubmit = async (data: { mode: 'add' | 'edit'; formData: Omit<Tag, 'id'>; tagId?: string }) => {
  try {
    if (data.mode === 'add') {
      await tagStore.addTag(data.formData);
      message.success('标签添加成功');
    } else if (data.mode === 'edit' && data.tagId) {
      await tagStore.updateTag(data.tagId, data.formData);
      message.success('标签更新成功');
    }
    showTagDialog.value = false; // Close dialog on success
  } catch (error: any) {
    message.error(`操作失败: ${error.message}`);
  }
};

// --- Single Delete Action ---
const handleDeleteTag = (tag: Tag) => {
   // Ensure tag is not selected before deleting individually
   selectedTagIds.value.delete(tag.id);
   dialog.warning({
    title: '确认删除',
    content: `确定要删除标签 "${tag.name}" 吗？此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tagStore.deleteTag(tag.id);
        message.success(`标签 "${tag.name}" 已删除`);
      } catch (error: any) { 
        message.error(`删除失败: ${error.message}`);
      }
    },
  });
};

// --- Loading state for batch ops ---
const isBatchProcessing = ref(false);

// --- Batch Actions ---
const handleBatchDelete = () => {
    if (!hasSelection.value) return;
    const idsToDelete = Array.from(selectedTagIds.value);
    dialog.warning({
        title: '确认批量删除',
        content: `确定要删除选中的 ${idsToDelete.length} 个标签吗？此操作不可撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            isBatchProcessing.value = true; // Start loading
            try {
                await tagStore.batchDeleteTags(idsToDelete);
                message.success(`已删除 ${idsToDelete.length} 个标签`);
                selectedTagIds.value.clear(); // Clear selection after successful delete
            } catch (error: any) {
                message.error(`批量删除失败: ${error.message}`);
            } finally {
                isBatchProcessing.value = false; // Stop loading
            }
        },
    });
};

// --- Batch Move State & Actions ---
const showBatchMoveDialog = ref(false);

const handleBatchMove = () => {
    if (!hasSelection.value) return;
    showBatchMoveDialog.value = true;
};

</script>

<template>
  <div class="tag-grid-container">
    <!-- Action area - Use NFlex for better responsive controls -->
    <n-flex class="controls-section" justify="space-between" align="center" :wrap="true">
      <!-- Left side controls -->
      <n-space align="center" :size="12" :wrap-item="false" style="flex-shrink: 0;">
        <div class="select-all-checkbox">
          <n-checkbox 
            :checked="isAllSelected" 
            :indeterminate="isIndeterminate"
            @update:checked="handleSelectAllChange" 
          />
        </div>
        <n-text v-if="!hasSelection" class="tags-count">
            {{ filteredTags.length }} 个标签
        </n-text>
        <n-text v-else class="tags-count selected-text">
            已选择 {{ selectedTagIds.size }} 个标签
        </n-text>
      </n-space>
      
      <!-- Right side controls -->
      <n-space align="center" :size="8" :wrap-item="false" style="flex-shrink: 0; margin-top: 4px;"> <!-- Add margin-top for wrap spacing -->
        <n-button-group v-if="hasSelection" size="small">
          <n-button type="warning" 
              @click="handleBatchDelete" 
              :loading="isBatchProcessing"
              :disabled="!hasSelection">
            删除选中
          </n-button>
          <n-button type="primary" 
              @click="handleBatchMove"  
              :loading="isBatchProcessing"
              :disabled="!hasSelection">
            移动选中
          </n-button>
        </n-button-group>
      </n-space>
    </n-flex>

    <div class="grid-wrapper">
      <!-- Wrap Grid/Empty state in NSpin -->
      <n-spin :show="isLoading">
        <n-empty v-if="!isLoading && filteredTags.length === 0" description="没有找到标签" style="margin-top: 40px;">
          <template #extra>
            <n-button size="small" @click="() => { /* TODO: Signal parent or handle context */ }" :disabled="!tagStore.filterCategoryId">
              在此分类下创建标签
            </n-button>
          </template>
        </n-empty>
      
        <!-- 使用更均匀的网格布局 -->
        <n-grid 
          v-if="!isLoading && filteredTags.length > 0" 
          :x-gap="16" 
          :y-gap="16" 
          cols="1 s:2 m:3 l:4 xl:5 2xl:6"
          responsive="screen"
        >
          <n-gi v-for="tag in filteredTags" :key="tag.id">
            <TagCard 
              :tag="tag" 
              :selected="selectedTagIds.has(tag.id)"
              @edit="handleOpenEditDialog"
              @delete="handleDeleteTag"
              @selection-change="handleSelectionChange"
            />
          </n-gi>
        </n-grid>
        
        <!-- Optional: Placeholder or slightly different view while loading -->
        <div v-if="isLoading" style="min-height: 200px; display: flex; align-items: center; justify-content: center;">
          <!-- 提供足够高度确保加载动画显示美观 -->
        </div>
      </n-spin>
    </div>

    <!-- 分页区域 (未来实现分页) -->
    <div v-if="filteredTags.length > 0" class="pagination-area">
      <n-text class="all-loaded">已加载全部标签</n-text>
    </div>

     <!-- Tag Add/Edit Dialog -->
    <TagDialog
      v-model:show="showTagDialog"
      :mode="tagDialogMode"
      :tag-to-edit="tagToEdit"
      :initial-category-id="initialCategoryId"
      @submit="handleDialogSubmit"
    />
    
    <!-- Batch Move Dialog -->
    <BatchMoveDialog 
        v-model:show="showBatchMoveDialog" 
      :tag-ids="Array.from(selectedTagIds)" 
      @close="showBatchMoveDialog = false"
    />

  </div>
</template>

<style scoped>
.tag-grid-container {
  padding: 20px;
  height: 100%; 
  display: flex; 
  flex-direction: column;
}

.controls-section {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color);
  margin-bottom: 16px;
  /* NFlex handles layout now */
}

.grid-wrapper {
  flex: 1;
  overflow: auto;
  position: relative;
  padding-bottom: 16px;
}

.n-grid {
  width: 100%;
}

.tags-count {
  font-size: 0.85rem;
  color: var(--n-text-color-2);
}

.selected-text {
  color: var(--primary-color);
  font-weight: 500;
}

.select-all-checkbox {
  margin-right: 8px;
}

.pagination-area {
  text-align: center;
  padding: 16px 0;
  color: var(--n-text-color-disabled);
}

.all-loaded {
  display: block;
  padding: 10px;
  color: var(--n-text-color-3);
  font-size: 14px;
}

/* 确保在暗色模式下的适配 */
:global(.n-theme-dark) .controls-section {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 添加平滑滚动效果 */
.grid-wrapper {
  scroll-behavior: smooth;
}

/* 响应式处理 */
@media (max-width: 768px) {
  .controls-section {
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
}
</style> 