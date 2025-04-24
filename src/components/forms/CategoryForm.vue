<script setup lang="ts">
import { ref, reactive, watch, defineProps, computed } from 'vue';
import { NForm, NFormItem, NInput, NSelect } from 'naive-ui';
import type { FormInst, FormRules } from 'naive-ui';
import type { Category, Group } from '../../types/data';
import { useTagStore } from '../../stores/tagStore';

// --- Props --- 
interface Props {
  initialData?: Partial<Category>; // For editing existing category
  mode: 'add' | 'edit'; // <<< Add mode to distinguish
}
const props = defineProps<Props>();

const tagStore = useTagStore(); // <<< Use tagStore

// --- Form State & Rules --- 
// Define a specific type for the form data managed by this component
interface CategoryFormData {
    name: string;
    groupId: string | null; // <<< Add groupId
}

const formRef = ref<FormInst | null>(null);
// Use the specific form data type
const formData = reactive<CategoryFormData>({
  name: '',
  groupId: null, // <<< Initialize groupId
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
  groupId: [ // <<< Add rules for groupId
      {
          required: true,
          message: '请选择所属分组',
          trigger: ['change', 'blur'], // Check on change and blur
          // Use type: 'string' if NSelect value is guaranteed string, otherwise adjust rule
          type: 'string', 
      }
  ]
};

// --- Computed --- 
const groupOptions = computed(() => { // <<< Compute group options
    return tagStore.groups.map(group => ({
        label: group.name,
        value: group.id
    }));
});

// --- Watchers --- 
// Update form data when initialData prop changes (for editing)
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      formData.name = newData.name || '';
      formData.groupId = newData.groupId || null; // <<< Update groupId
    } else {
      // Reset form if initialData becomes null/undefined (e.g., switching from edit to add)
      formData.name = '';
      formData.groupId = null; // <<< Reset groupId
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

// Update getFormData to return the specific type managed by this form
const getFormData = (): CategoryFormData => { 
    return { ...formData }; // Return the fields managed by this form
};

// Expose the validate method to the parent component
defineExpose({ validate, getFormData });

</script>

<template>
  <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="auto">
    <n-form-item label="分类名称" path="name">
      <n-input v-model:value="formData.name" placeholder="输入分类名称" />
    </n-form-item>
    <!-- Add Group Selector only in 'add' mode -->
    <n-form-item v-if="props.mode === 'add'" label="所属分组" path="groupId">
      <n-select 
        v-model:value="formData.groupId"
        :options="groupOptions" 
        placeholder="选择分组"
        clearable
      />
    </n-form-item>
    <!-- Add fields for color, icon, keyword etc. here -->
  </n-form>
</template>

<style scoped>
/* Add specific form styles if needed */
</style> 