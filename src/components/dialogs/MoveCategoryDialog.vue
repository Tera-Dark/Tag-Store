<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NButton, NSelect, NForm, NFormItem, NSpace, useMessage } from 'naive-ui';
import type { SelectOption } from 'naive-ui';
import type { Category, Group } from '../../types/data';

// --- Props ---
interface Props {
  show: boolean;
  categoryToMove: Category | null;
  availableGroups: Group[];
}
const props = defineProps<Props>();

// --- Emits ---
const emit = defineEmits<{ 
  (e: 'update:show', value: boolean): void;
  (e: 'submit', targetGroupId: string): void; 
}>();

// --- Refs & State ---
const selectedGroupId = ref<string | null>(null);
const isProcessing = ref(false); // Basic processing state
const message = useMessage();

// --- Computed ---
const dialogTitle = computed(() => {
  return props.categoryToMove ? `移动分类 "${props.categoryToMove.name}"` : '移动分类';
});

const groupOptions = computed<SelectOption[]>(() => {
  return props.availableGroups.map(group => ({
    label: group.name,
    value: group.id,
    // Disable the current group of the category being moved
    disabled: group.id === props.categoryToMove?.groupId 
  }));
});

// --- Methods ---
const handleClose = () => {
  if (isProcessing.value) return;
  emit('update:show', false);
};

const handleSubmit = () => {
  if (!selectedGroupId.value) {
    message.error('请选择一个目标分组');
    return;
  }
  // Basic processing indicator, can be enhanced if submission involves async ops
  isProcessing.value = true; 
  try {
      emit('submit', selectedGroupId.value);
      // Optionally close dialog immediately or wait for parent confirmation
      // handleClose(); // Let parent close after successful update in store
  } catch (error) { 
      message.error('移动操作失败'); // Should not happen with current simple emit
  } finally {
      isProcessing.value = false; // Reset processing state
  }
};

// Reset selection when dialog opens
watch(() => props.show, (isVisible) => {
  if (isVisible) {
    selectedGroupId.value = null; 
    isProcessing.value = false;
  }
});

</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    :title="dialogTitle"
    :bordered="false"
    size="small"
    style="max-width: 450px"
    :mask-closable="!isProcessing"
    :close-on-esc="!isProcessing"
    @update:show="handleClose"
  >
    <n-form @submit.prevent="handleSubmit">
      <n-form-item label="选择目标分组" :required="true">
        <n-select
          v-model:value="selectedGroupId"
          :options="groupOptions"
          placeholder="请选择要移动到的分组"
          filterable
          clearable
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose" :disabled="isProcessing">取消</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="isProcessing" :disabled="!selectedGroupId || isProcessing">
          移动
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
/* Add specific styles if needed */
</style> 