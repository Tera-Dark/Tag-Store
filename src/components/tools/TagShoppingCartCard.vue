<script setup lang="ts">
import { defineProps, defineEmits, onMounted } from 'vue';
import type { Tag } from '../../types/data';
import { StarOutline as StarIconOutline, Star as StarIconFilled } from '@vicons/ionicons5';
import { NTooltip, NIcon, NButton } from 'naive-ui';

// Keep props definition as it's used in the template
const props = defineProps<{
  tag: Tag;
  isSelected: boolean;
  isFavorite: boolean;
}>();

// 增加一个 onMounted 钩子来象征性地使用 props
onMounted(() => {
  if (props.tag) {
    // console.log('TagShoppingCartCard.vue props.tag exists');
  }
});

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
      <n-tooltip trigger="hover" placement="bottom" v-if="tag.keyword">
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
  height: 120px; /* 增加卡片高度以容纳更多内容 */
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
  padding: 24px 8px 8px; /* 增加左右内边距 */
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
  margin-bottom: 6px; /* 增加与关键词的间距 */
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2; /* 限制名称为2行 */
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.tag-keyword {
  font-size: 12px;
  font-style: italic;
  color: var(--n-text-color-3);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4; /* 增加行数至4行，允许显示更多关键词内容 */
  -webkit-box-orient: vertical;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.03);
  padding: 4px 6px; /* 增加内边距使文本更易读 */
  border-radius: 4px;
  margin-top: 4px;
  line-height: 1.2; /* 减小行高以在有限空间显示更多文本 */
  max-height: 60px; /* 设置最大高度 */
  text-align: left; /* 左对齐更易阅读长文本 */
}

/* 已选标签样式 */
.tag-item-selected {
  border-color: var(--n-primary-color);
  background-color: var(--n-primary-color-suppl);
  box-shadow: 0 0 0 1px var(--n-primary-color);
}

/* 收藏按钮样式 */
.favorite-button {
  color: #f0a020; /* 更明显的收藏按钮颜色 */
}
</style> 