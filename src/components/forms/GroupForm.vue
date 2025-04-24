<script setup lang="ts">
import { ref, reactive, watch, defineProps } from 'vue';
import { NForm, NFormItem, NInput } from 'naive-ui';
import type { FormInst, FormRules } from 'naive-ui';
import type { Group } from '../../types/data';

// --- Props ---
interface Props {
  initialData?: Partial<Group>; 
}
const props = defineProps<Props>();

// --- Form State & Rules ---
interface GroupFormData {
    name: string;
    // Add color, order later if needed
}

const formRef = ref<FormInst | null>(null);
const formData = reactive<GroupFormData>({
  name: '',
});

const rules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入分组名称',
      trigger: ['input', 'blur'],
    },
  ],
};

// --- Watchers ---
watch(
  () => props.initialData,
  (newData) => {
    formData.name = newData?.name || '';
  },
  { immediate: true }
);

// --- Methods ---
const validate = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    formRef.value?.validate((errors) => {
      if (!errors) {
        resolve();
      } else {
        reject(errors);
      }
    });
  });
};

const getFormData = (): GroupFormData => {
    return { ...formData };
};

defineExpose({ validate, getFormData });

</script>

<template>
  <n-form ref="formRef" :model="formData" :rules="rules" label-placement="top">
    <n-form-item label="分组名称" path="name">
      <n-input v-model:value="formData.name" placeholder="输入分组名称" />
    </n-form-item>
    <!-- Add Color Picker / Order Input later -->
  </n-form>
</template>

<style scoped>
/* Add specific form styles if needed */
</style> 