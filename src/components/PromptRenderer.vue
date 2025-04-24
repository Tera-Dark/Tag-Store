<template>
  <div class="prompt-renderer">
    <div v-for="(segment, index) in segments" :key="index" class="segment">
      {{ segment.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import type { PromptSegment } from '../utils/promptParser';

defineProps<{
  segments: PromptSegment[];
}>();
</script>

<style scoped>
.prompt-renderer {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.segment {
  padding: 2px 4px;
}
</style> 