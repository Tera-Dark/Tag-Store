<template>
  <div class="tag-selector">
    <n-select
      v-model:value="selectedValue"
      :options="tagOptions"
      filterable
      clearable
      @update:value="handleSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits } from 'vue';
import { NSelect } from 'naive-ui';
import type { Tag } from '../types/data';

const props = defineProps<{
  tags: Tag[];
}>();

const emit = defineEmits(['select']);
const selectedValue = ref<string | null>(null);

const tagOptions = computed(() => {
  return props.tags.map(tag => ({
    label: tag.name,
    value: tag.id
  }));
});

const handleSelect = (value: string | null) => {
  if (value) {
    const selectedTag = props.tags.find(tag => tag.id === value);
    if (selectedTag) {
      emit('select', selectedTag);
    }
    selectedValue.value = null; // 重置选择
  }
};
</script>

<style scoped>
.tag-selector {
  width: 100%;
}
</style> 