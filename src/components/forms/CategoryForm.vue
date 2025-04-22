<script setup lang="ts">
import { ref, reactive, watch, defineProps, defineEmits } from 'vue';
import { NForm, NFormItem, NInput } from 'naive-ui';
import type { FormInst, FormRules /*, FormItemRule*/ } from 'naive-ui';
import type { Category } from '../../types/data';

// --- Props --- 
interface Props {
  initialData?: Partial<Category>; // For editing existing category
}
const props = defineProps<Props>();

// --- Emits --- 
// Removed unused emit declaration
// const emit = defineEmits<{ (e: 'submit', formData: Omit<Category, 'id'>): void }>(); 

// --- Form State & Rules --- 
const formRef = ref<FormInst | null>(null);
const formData = reactive<Omit<Category, 'id'>>({
  name: '',
  libraryId: '' // Initialize with empty string to fix type error
  // Add other category fields here if needed (color, icon, keyword)
});

const rules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入分类名称',
      trigger: ['input', 'blur'],
    },
    // TODO: Add rule for checking name uniqueness (might require async validation or check in parent)
  ],
};

// --- Watchers --- 
// Update form data when initialData prop changes (for editing)
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      formData.name = newData.name || '';
      // Update other fields if they exist
    } else {
      // Reset form if initialData becomes null/undefined (e.g., switching from edit to add)
      formData.name = '';
    }
  },
  { immediate: true } // Run the watcher immediately on component mount
);

// --- Methods --- 
// Expose validate method for parent component to call
const validate = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    formRef.value?.validate((errors) => {
      if (!errors) {
        resolve();
      } else {
        console.log('Form validation failed:', errors);
        reject(errors);
      }
    });
  });
};

// Expose getFormData method (though formData is reactive, this can be explicit)
const getFormData = () => {
    return { ...formData }; // Return a copy
};

// Expose the validate method to the parent component
defineExpose({ validate, getFormData });

</script>

<template>
  <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="auto">
    <n-form-item label="分类名称" path="name">
      <n-input v-model:value="formData.name" placeholder="输入分类名称" />
    </n-form-item>
    <!-- Add fields for color, icon, keyword etc. here -->
  </n-form>
</template>

<style scoped>
/* Add specific form styles if needed */
</style> 