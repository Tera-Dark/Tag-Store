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

// Define a specific type for the form state
interface TagFormData {
  categoryId: string | null;
  name: string;
  subtitles: string[];
  keyword: string;
  // Add other optional fields from Tag if needed, e.g., color?: string, weight?: number
}

// --- Store & State ---
const tagStore = useTagStore();
const formRef = ref<FormInst | null>(null);

// Use the specific form data type
const formData = reactive<TagFormData>({
  categoryId: null,
  name: '',
  subtitles: [],
  keyword: '',
});

// --- Computed ---
// Prepare categories for the select dropdown
const categoryOptions = computed<SelectOption[]>(() =>
  tagStore.categories.map((cat: Category) => ({
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
      // Use nullish coalescing for potentially undefined categoryId from partial initialData
      formData.categoryId = newData.categoryId ?? null;
      formData.name = newData.name || '';
      formData.subtitles = newData.subtitles ? [...newData.subtitles] : []; // Copy array
      formData.keyword = newData.keyword || '';
      // Update other fields if they exist
    } else {
      // Reset form if initialData becomes null/undefined (e.g., switching from edit to add)
      formData.categoryId = null;
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
  // Validation should ensure categoryId is not null here
  if (formData.categoryId === null) {
    // This should ideally not happen if validation runs first
    console.error("Validation failed to ensure categoryId is set in TagForm.");
    // Consider throwing an error or returning a specific value indicating failure
    // For now, let's throw an error to make the issue explicit if validation is bypassed.
    throw new Error("所属分类为必填项 (Category is required).");
  }
  const cleanedSubtitles = formData.subtitles?.filter(sub => typeof sub === 'string' && sub.trim() !== '') || [];

  // Now we know categoryId is a string, construct the final object matching Omit<Tag, 'id'>
  return {
    name: formData.name,
    categoryId: formData.categoryId, // Known to be string here
    subtitles: cleanedSubtitles,
    keyword: formData.keyword,
    // Add other properties from formData if they exist in Tag type
  };
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