<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, nextTick, computed } from 'vue';
import { NModal, NCard, NButton, NSpin, useMessage } from 'naive-ui';
import CategoryForm from '../forms/CategoryForm.vue';
import type { Category } from '../../types/data';

// --- Types --- 
interface CategoryFormData {
  name: string;
  // Add other fields if needed
}

// --- Props --- 
interface Props {
  show: boolean;
  mode: 'add' | 'edit';
  categoryToEdit?: Category | null; // Pass the whole category for editing
}
const props = defineProps<Props>();

// --- Emits --- 
const emit = defineEmits<{ 
  (e: 'update:show', value: boolean): void;
  (e: 'submit', data: { mode: 'add' | 'edit'; formData: CategoryFormData; categoryId?: string }): void; 
}>();

// --- Refs & State --- 
const formRef = ref<InstanceType<typeof CategoryForm> | null>(null);
const isProcessing = ref(false);
const message = useMessage(); // For showing success/error messages

// --- Computed --- 
const title = computed(() => (props.mode === 'add' ? '添加新分类' : '编辑分类'));
const initialFormData = computed(() => {
  return props.mode === 'edit' && props.categoryToEdit ? { name: props.categoryToEdit.name } : undefined;
});

// --- Methods --- 
const handleClose = () => {
  if (isProcessing.value) return; // Prevent closing while processing
  emit('update:show', false);
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  isProcessing.value = true;
  try {
    await formRef.value.validate();
    const formData = formRef.value.getFormData();
    emit('submit', { 
      mode: props.mode,
      formData: formData as CategoryFormData, // Cast here, ensure form aligns
      categoryId: props.mode === 'edit' ? props.categoryToEdit?.id : undefined,
    });
    // Optionally close dialog on successful submit emit (parent handles actual success/failure)
    // handleClose(); 
  } catch (validationErrors) {
    console.log('Validation failed, not submitting.');
    message.error('请检查输入内容');
  } finally {
    isProcessing.value = false;
  }
};

// Ensure form is ready when dialog becomes visible, especially for editing
watch(() => props.show, (isVisible) => {
  if (isVisible) {
    // Reset processing state when shown
    isProcessing.value = false; 
    // We might not need to explicitly reset form here if CategoryForm's watcher works correctly
    // nextTick(() => {
    //   formRef.value?.resetFields(); // Or update based on initialFormData
    // });
  }
});

</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    :title="title"
    :bordered="false"
    size="small"
    style="max-width: 500px"
    :mask-closable="!isProcessing"
    :close-on-esc="!isProcessing"
    @update:show="handleClose"
  >
    <n-spin :show="isProcessing">
      <CategoryForm 
        ref="formRef" 
        :initial-data="initialFormData" 
       />
    </n-spin>
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose" :disabled="isProcessing">取消</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="isProcessing" :disabled="isProcessing">
          {{ mode === 'add' ? '创建' : '保存' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
/* Add dialog specific styles if needed */
</style> 