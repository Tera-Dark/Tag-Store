<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, computed } from 'vue';
import { NModal, /* NCard, */ NButton, NSpin, useMessage } from 'naive-ui';
import TagForm from '../forms/TagForm.vue'; // Import the TagForm
import type { Tag } from '../../types/data';

// --- Types ---
// Use Omit<Tag, 'id'> matching the form's data structure and emit event
type TagFormData = Omit<Tag, 'id'>;

// --- Props ---
interface Props {
  show: boolean;
  mode: 'add' | 'edit';
  tagToEdit?: Tag | null; // Pass the whole tag for editing
  // Optional: pre-select category when adding from a specific category view
  preSelectedCategoryId?: string | null;
}
const props = defineProps<Props>();

// --- Emits ---
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submit', data: { mode: 'add' | 'edit'; formData: TagFormData; tagId?: string }): void;
}>();

// --- Refs & State ---
const formRef = ref<InstanceType<typeof TagForm> | null>(null);
const isProcessing = ref(false);
const message = useMessage();

// --- Computed ---
const title = computed(() => (props.mode === 'add' ? '添加新标签' : '编辑标签'));

// Prepare initial data for the form, handling pre-selected category for 'add' mode
const initialFormData = computed(() => {
  if (props.mode === 'edit' && props.tagToEdit) {
    // For editing, return the relevant fields from tagToEdit
    const { id, ...rest } = props.tagToEdit; // Exclude id
    return rest;
  } else if (props.mode === 'add' && props.preSelectedCategoryId) {
    // For adding, if a category is pre-selected, include it
    return { categoryId: props.preSelectedCategoryId };
  }
  // Default for adding with no pre-selection, or if data is missing
  return undefined;
});


// --- Methods ---
const handleClose = () => {
  if (isProcessing.value) return;
  emit('update:show', false);
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  isProcessing.value = true;
  try {
    await formRef.value.validate();
    const formData = formRef.value.getFormData(); // getFormData returns Omit<Tag, 'id'>
    emit('submit', {
      mode: props.mode,
      formData: formData, // Already Omit<Tag, 'id'>
      tagId: props.mode === 'edit' ? props.tagToEdit?.id : undefined,
    });
    // Optional: Close dialog immediately after emitting submit
    // handleClose();
  } catch (validationErrors) {
    console.log('Tag validation failed, not submitting.');
    message.error('请检查输入内容');
  } finally {
    isProcessing.value = false;
  }
};

// Watch for the dialog becoming visible to reset state
watch(() => props.show, (isVisible) => {
  if (isVisible) {
    isProcessing.value = false;
    // Form data reset/update is handled by the watch inside TagForm based on initialFormData
  }
});

</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    :title="title"
    :bordered="false"
    size="medium"  
    style="max-width: 600px" 
    :mask-closable="!isProcessing"
    :close-on-esc="!isProcessing"
    @update:show="handleClose"
  >
    <n-spin :show="isProcessing">
      <TagForm
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