<template>
  <n-modal v-model:show="show" preset="dialog" title="权重模板管理">
    <div>模板内容</div>
  </n-modal>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { NModal } from 'naive-ui';
import type { WeightTemplate } from '../../types/config';

defineProps<{
  show: boolean;
  templates: WeightTemplate[];
}>();

const emit = defineEmits(['update:show', 'save-templates']);
</script>

<style scoped>
</style> 
 