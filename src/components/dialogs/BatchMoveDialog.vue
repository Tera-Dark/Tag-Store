<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NCard, NSelect, NButton, NSpace, useMessage } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { useTagStore } from '../../stores/tagStore';
import type { Category } from '../../types/data';

// --- Props ---
const props = defineProps<{ 
  show: boolean;
  tagIds: string[]; // IDs of tags to move
}>();

// --- Emits ---
const emit = defineEmits(['update:show', 'close']);

// --- Store & State ---
const tagStore = useTagStore();
const message = useMessage();

const targetCategoryId = ref<string | null>(null);
const isProcessing = ref(false);

// --- Computed ---
// Prepare categories for the select dropdown
const categoryOptions = computed<SelectOption[]>(() => {
  return tagStore.categories 
    .map((cat: Category) => ({
      label: cat.name,
      value: cat.id,
    }))
    .sort((a: SelectOption, b: SelectOption) => (a.label as string).localeCompare(b.label as string));
});

// --- Methods ---
const handleMove = async () => {
  if (!targetCategoryId.value) {
    message.warning('请选择目标分类');
    return;
  }
  if (props.tagIds.length === 0) {
    message.warning('没有选中任何标签');
    closeModal();
    return;
  }

  isProcessing.value = true;
  try {
    await tagStore.batchMoveTags(props.tagIds, targetCategoryId.value);
    message.success(`成功移动 ${props.tagIds.length} 个标签`);
    closeModal();
  } catch (error: any) { 
    console.error("Error moving tags:", error);
    message.error(`移动标签失败: ${error.message || '未知错误'}`);
  } finally {
    isProcessing.value = false;
  }
};

const closeModal = () => {
  emit('update:show', false);
  emit('close');
  targetCategoryId.value = null; // Reset selection on close
};

// Watch for the dialog becoming visible to potentially focus the select
watch(() => props.show, (newValue) => {
  if (newValue) {
    // Reset selection when dialog opens
    targetCategoryId.value = null;
  }
});

</script>

<template>
  <NModal
    :show="props.show"
    @update:show="closeModal"
    preset="card"
    style="width: 400px"
    title="批量移动标签"
    :mask-closable="false"
    :closable="!isProcessing"
  >
    <NCard :bordered="false" size="huge" role="dialog" aria-modal="true">
      <p>选择要将 {{ props.tagIds.length }} 个标签移动到的目标分类：</p>
      <NSelect
        v-model:value="targetCategoryId"
        :options="categoryOptions"
        placeholder="选择目标分类"
        filterable
        clearable
        :disabled="isProcessing"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeModal" :disabled="isProcessing">取消</NButton>
          <NButton type="primary" @click="handleMove" :loading="isProcessing" :disabled="!targetCategoryId">
            确认移动
          </NButton>
        </NSpace>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
/* Add dialog specific styles if needed */
</style> 