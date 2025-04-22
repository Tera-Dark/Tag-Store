<script setup lang="ts">
import { ref, reactive, watch, computed, defineProps } from 'vue';
import { NForm, NFormItem, NInput, NSelect, NDynamicInput } from 'naive-ui';
import type { FormInst, FormRules, SelectOption } from 'naive-ui';
import { useTagStore } from '../../stores/tagStore';
import type { Tag, Category } from '../../types/data';

// --- Props ---
interface Props {
  initialData?: Partial<Tag>; // For editing existing tag
}
const props = defineProps<Props>();

// --- Store & State ---
const tagStore = useTagStore();
const formRef = ref<FormInst | null>(null);

// Use Omit<Tag, 'id'> for the reactive form data
const formData = reactive<Omit<Tag, 'id'>>({
  categoryId: '', // Required
  name: '',       // Required
  libraryId: '', // Initialize with empty string to fix type error
  subtitles: [],
  keyword: '',
  // color: undefined, // Optional fields
  // weight: undefined,
});

// --- Computed ---
// Prepare categories for the select dropdown
const categoryOptions = computed<SelectOption[]>(() =>
  tagStore.allCategories.map((cat: Category) => ({
    label: cat.name,
    value: cat.id,
  }))
);

// --- Rules ---
const rules: FormRules = {
  categoryId: [
    { required: true, message: '请选择所属分类', trigger: 'change' }
  ],
  name: [
    { required: true, message: '请输入标签名称', trigger: ['input', 'blur'] },
    // TODO: Add rule for checking name uniqueness within the selected category (might require async validation)
  ],
  keyword: {
    // Rule for keyword (optional)
  },
};

// --- Watchers ---
// Update form data when initialData prop changes (for editing)
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      formData.categoryId = newData.categoryId || '';
      formData.name = newData.name || '';
      formData.subtitles = newData.subtitles ? [...newData.subtitles] : []; // Copy array
      formData.keyword = newData.keyword || '';
      // Update other fields if they exist
    } else {
      // Reset form if initialData becomes null/undefined (e.g., switching from edit to add)
      formData.categoryId = '';
      formData.name = '';
      formData.subtitles = [];
      formData.keyword = '';
    }
  },
  { immediate: true, deep: true } // immediate to run on mount, deep for subtitles array
);

// --- Methods ---
// Expose validate method for parent component (Dialog)
const validate = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    formRef.value?.validate((errors) => {
      if (!errors) {
        resolve();
      } else {
        console.log('Tag Form validation failed:', errors);
        reject(errors);
      }
    });
  });
};

// Expose getFormData method
const getFormData = (): Omit<Tag, 'id'> => {
  // Ensure subtitles is an array of strings, filter out empty ones if needed
  const cleanedSubtitles = formData.subtitles?.filter(sub => typeof sub === 'string' && sub.trim() !== '') || [];
  return { ...formData, subtitles: cleanedSubtitles };
};

// Expose methods to parent
defineExpose({ validate, getFormData });

</script>

<template>
  <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="auto">
    <n-form-item label="所属分类" path="categoryId">
      <n-select
        v-model:value="formData.categoryId"
        placeholder="选择分类"
        :options="categoryOptions"
        filterable
      />
    </n-form-item>
    <n-form-item label="标签名称" path="name">
      <n-input v-model:value="formData.name" placeholder="输入标签名称" />
    </n-form-item>
    <n-form-item label="副标题" path="subtitles">
       <n-dynamic-input
          v-model:value="formData.subtitles"
          placeholder="输入副标题/别名"
          :min="0"
        >
         <!-- Optional: Customize the input within dynamic input if needed -->
         <!-- <n-input :value="value" @update:value="v => { if(formData.subtitles) formData.subtitles[index] = v }" placeholder="副标题/别名" /> -->
       </n-dynamic-input>
    </n-form-item>
     <n-form-item label="关键词" path="keyword">
      <n-input v-model:value="formData.keyword" placeholder="输入关键词 (用于提示或搜索)" />
    </n-form-item>
    <!-- TODO: Add fields for color, weight etc. -->
  </n-form>
</template>

<style scoped>
/* Add specific form styles if needed */
</style> 