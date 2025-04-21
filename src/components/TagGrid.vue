<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NGrid, NGi, NEmpty, useMessage, useDialog, NButton, NSpace, NCheckbox } from 'naive-ui';
import { useTagStore } from '../stores/tagStore';
import TagCard from './TagCard.vue';
import TagDialog from './dialogs/TagDialog.vue';
import BatchMoveDialog from './dialogs/BatchMoveDialog.vue';
import type { Tag } from '../types/data';

const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

// Get filtered tags from the store
const filteredTags = computed(() => tagStore.filteredTags);

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
watch(filteredTags, (newTags, oldTags) => {
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

// --- Dialog Actions (Add/Edit) ---
const handleOpenAddDialog = () => {
  tagDialogMode.value = 'add';
  tagToEdit.value = null;
  showTagDialog.value = true;
};

const handleOpenEditDialog = (tag: Tag) => {
  tagDialogMode.value = 'edit';
  tagToEdit.value = tag;
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
            try {
                await tagStore.batchDeleteTags(idsToDelete);
                message.success(`已删除 ${idsToDelete.length} 个标签`);
                selectedTagIds.value.clear(); // Clear selection after successful delete
            } catch (error: any) {
                message.error(`批量删除失败: ${error.message}`);
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

const handleBatchMoveSubmit = async (targetCategoryId: string) => {
    const idsToMove = Array.from(selectedTagIds.value);
    if (idsToMove.length === 0) return;

    showBatchMoveDialog.value = false;
    try {
        await tagStore.batchMoveTags(idsToMove, targetCategoryId);
        message.success(`已将 ${idsToMove.length} 个标签移动到目标分类`);
        selectedTagIds.value.clear();
    } catch (error: any) {
        message.error(`批量移动失败: ${error.message}`);
    }
};

// TODO: Implement Select All / Deselect All functionality

</script>

<template>
  <div class="tag-grid-container">
     <n-space justify="space-between" align="center" style="margin-bottom: 16px;">
        <!-- Left side: Batch Actions -->
        <n-space align="center">
            <n-checkbox 
                :checked="isAllSelected"
                :indeterminate="isIndeterminate"
                @update:checked="handleSelectAllChange"
                :disabled="filteredTags.length === 0" 
             >
                全选
            </n-checkbox>
            <n-button type="error" ghost :disabled="!hasSelection" @click="handleBatchDelete">
                批量删除 ({{ selectedTagIds.size }})
            </n-button>
            <n-button :disabled="!hasSelection" @click="handleBatchMove">
                批量移动 ({{ selectedTagIds.size }})
            </n-button>
        </n-space>
        
        <!-- Right side: Add Tag button -->
        <n-button type="primary" @click="handleOpenAddDialog">
            添加标签
        </n-button>
     </n-space>

    <n-empty v-if="filteredTags.length === 0" description="没有找到标签" style="margin-top: 40px;">
      <template #extra>
        <n-button size="small" @click="handleOpenAddDialog">创建第一个标签</n-button>
      </template>
    </n-empty>

    <n-grid v-else :x-gap="12" :y-gap="12" cols="1 s:2 m:3 l:4 xl:5 2xl:6" responsive="screen">
      <n-gi v-for="tag in filteredTags" :key="tag.id">
        <TagCard 
           :tag="tag" 
           :selected="selectedTagIds.has(tag.id)" 
           @selection-change="handleSelectionChange" 
           @edit="handleOpenEditDialog(tag)" 
           @delete="handleDeleteTag(tag)" 
         />
      
      </n-gi>
    </n-grid>

     <!-- Tag Add/Edit Dialog -->
    <TagDialog
      v-model:show="showTagDialog"
      :mode="tagDialogMode"
      :tag-to-edit="tagToEdit"
      :pre-selected-category-id="tagStore.filterCategoryId" 
      @submit="handleDialogSubmit"
    />
    
    <!-- Batch Move Dialog -->
    <BatchMoveDialog 
        v-model:show="showBatchMoveDialog" 
        :tag-count="selectedTagIds.size"
        @submit="handleBatchMoveSubmit"
    />

  </div>
</template>

<style scoped>
.tag-grid-container {
  padding: 20px;
  height: 100%; 
  overflow-y: auto; 
  display: flex; 
  flex-direction: column; 
}

.n-grid, .n-empty {
  flex-grow: 1; 
}
</style> 