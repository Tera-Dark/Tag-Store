<script setup lang="ts">
import { NTooltip, NIcon, NButton } from 'naive-ui';
import { StarOutline as StarIconOutline, Star as StarIconFilled } from '@vicons/ionicons5';
import type { Tag } from '../../types/data';

const props = defineProps<{
  tag: Tag;
  isSelected: boolean;
  isFavorite: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'toggleFavorite'): void;
}>();
</script>

<template>
  <div 
    class="tag-item-card" 
    @click="emit('toggle')" 
    :class="{'tag-item-selected': isSelected}"
  >
    <div class="tag-card-header">
      <n-button 
        text 
        circle 
        size="tiny" 
        @click.stop="emit('toggleFavorite')" 
        class="favorite-button" 
        :title="isFavorite ? '取消收藏' : '收藏'"
      >
        <n-icon :component="isFavorite ? StarIconFilled : StarIconOutline" />
      </n-button>
    </div>
    <div class="tag-card-body">
      <n-tooltip trigger="hover" placement="top">
        <template #trigger>
          <div class="tag-name">{{ tag.name }}</div>
        </template>
        {{ tag.name }}
      </n-tooltip>
      <n-tooltip trigger="hover" placement="top" v-if="tag.keyword">
        <template #trigger>
          <div class="tag-keyword">{{ tag.keyword }}</div>
        </template>
        {{ tag.keyword }}
      </n-tooltip>
    </div>
  </div>
</template>

<style scoped>
/* 标签卡片样式 */
.tag-item-card {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 8px 0 8px 0;
  display: flex;
  flex-direction: column;
  background-color: var(--n-color);
  transition: all 0.2s ease;
  position: relative;
  cursor: pointer;
  height: 100px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.tag-item-card:hover {
  border-color: var(--n-primary-color-hover);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.tag-card-header {
  display: flex;
  justify-content: flex-end;
  padding: 4px;
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  z-index: 2;
}

.tag-item-card:hover .tag-card-header {
  opacity: 1;
}

.tag-card-body {
  padding: 24px 6px 8px;
  text-align: center;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.tag-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--n-text-color-1);
  margin-bottom: 3px;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-keyword {
  font-size: 12px;
  font-style: italic;
  color: var(--n-text-color-3);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.03);
  padding: 2px 4px;
  border-radius: 4px;
  margin-top: 4px;
}

/* 已选标签样式 */
.tag-item-selected {
  border-color: var(--n-primary-color);
  background-color: var(--n-primary-color-suppl);
  box-shadow: 0 0 0 1px var(--n-primary-color);
}
</style> 