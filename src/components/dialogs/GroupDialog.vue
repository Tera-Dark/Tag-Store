<script setup lang="ts">
import { ref, watch, defineProps, defineEmits, computed } from 'vue';
import { NModal, NButton, NSpin, useMessage } from 'naive-ui';
import GroupForm from '../forms/GroupForm.vue';
import type { Group } from '../../types/data';

// --- Types ---
interface GroupFormData {
  name: string;
}

// --- Props ---
interface Props {
  show: boolean;
  mode: 'add' | 'edit';
  groupToEdit?: Group | null;
}
const props = defineProps<Props>();

// --- Emits ---
interface EmittedData {
  mode: 'add' | 'edit';
  formData: GroupFormData;
  groupId?: string;
}
const emit = defineEmits<{ 
  (e: 'update:show', value: boolean): void;
  (e: 'submit', data: EmittedData): void; 
}>();

// --- Refs & State ---
const formRef = ref<InstanceType<typeof GroupForm> | null>(null);
const isProcessing = ref(false);
const message = useMessage();

// --- Computed ---
const title = computed(() => (props.mode === 'add' ? '添加新分组' : '编辑分组'));
const initialFormData = computed(() => {
  return props.mode === 'edit' && props.groupToEdit ? { name: props.groupToEdit.name } : undefined;
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
    const formData = formRef.value.getFormData();
    emit('submit', { 
      mode: props.mode,
      formData: formData,
      groupId: props.mode === 'edit' ? props.groupToEdit?.id : undefined,
    });
  } catch (validationErrors) {
    message.error('请检查输入内容');
  } finally {
    isProcessing.value = false;
  }
};

watch(() => props.show, (isVisible) => {
  if (isVisible) {
    isProcessing.value = false; 
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
      <GroupForm 
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