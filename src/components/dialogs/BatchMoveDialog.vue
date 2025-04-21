<script setup lang="ts">
import { ref, computed, defineProps, defineEmits, watch } from 'vue';
import { NModal, NCard, NButton, NSelect, NSpin, NText, useMessage } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import { useTagStore } from '../../stores/tagStore';
import type { Category } from '../../types/data';

// --- Props ---
interface Props {
  show: boolean;
  tagCount: number; // Number of tags being moved, for display
  // Optional: Could pass current category ID to exclude it from options
  // currentCategoryId?: string | null; 
}
const props = defineProps<Props>();

// --- Emits ---
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submit', targetCategoryId: string): void;
}>();

// --- Store & State ---
const tagStore = useTagStore();
const selectedCategoryId = ref<string | null>(null);
const isProcessing = ref(false); // Although move might be quick, good practice
const message = useMessage();

// --- Computed ---
// Prepare categories for the select dropdown
// Exclude the current category if needed (logic depends on requirements)
const categoryOptions = computed<SelectOption[]>(() =>
  tagStore.allCategories
    // Optional filter: .filter(cat => cat.id !== props.currentCategoryId) 
    .map((cat: Category) => ({
      label: cat.name,
      value: cat.id,
    }))
);

// --- Methods ---
const handleClose = () => {
  if (isProcessing.value) return;
  emit('update:show', false);
};

const handleSubmit = () => {
  if (!selectedCategoryId.value) {
      message.warning('请选择目标分类');
      return;
  }
  // No async processing needed here, just emit the event
  emit('submit', selectedCategoryId.value);
  // Optionally close dialog after emitting
  // handleClose(); 
};

// Reset selection when dialog opens
watch(() => props.show, (isVisible) => {
  if (isVisible) {
    selectedCategoryId.value = null; // Reset selection
    isProcessing.value = false;
  }
});

</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    title="批量移动标签"
    :bordered="false"
    size="small"
    style="max-width: 400px"
    :mask-closable="!isProcessing"
    :close-on-esc="!isProcessing"
    @update:show="handleClose"
  >
    <n-spin :show="isProcessing">
       <n-text>
           选择要将选中的 {{ props.tagCount }} 个标签移动到的目标分类：
       </n-text>
       <n-select
            v-model:value="selectedCategoryId"
            placeholder="选择目标分类"
            :options="categoryOptions"
            filterable
            clearable 
            style="margin-top: 16px;"
       />
    </n-spin>
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose" :disabled="isProcessing">取消</n-button>
        <n-button 
            type="primary" 
            @click="handleSubmit" 
            :loading="isProcessing" 
            :disabled="isProcessing || !selectedCategoryId"
        >
          确认移动
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
/* Add dialog specific styles if needed */
</style> 