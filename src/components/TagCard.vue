<script setup lang="ts">
import { defineProps, computed, defineEmits } from 'vue';
import { NCard, NTag, NSpace, NTooltip, NDropdown, NButton, NIcon, NCheckbox, NText, NEllipsis } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import { useTagStore } from '../stores/tagStore';
import type { Tag } from '../types/data';
// Import icons
import { EllipsisVertical as MoreIcon, PricetagOutline as KeywordIcon } from '@vicons/ionicons5';

// --- Props ---
const props = defineProps<{ 
  tag: Tag;
  selected: boolean;
 }>();

// --- Emits ---
const emit = defineEmits<{ 
  (e: 'edit', tag: Tag): void;
  (e: 'delete', tag: Tag): void;
  (e: 'selection-change', payload: { id: string; selected: boolean }): void;
 }>();

const tagStore = useTagStore();

// --- Computed ---
// Get the category name for display
const categoryName = computed(() => {
  const category = tagStore.getCategoryById(props.tag.categoryId);
  return category ? category.name : '未知分类'; // Get name or default
});

// Format subtitles for display
const displaySubtitles = computed(() => props.tag.subtitles?.join(' / ') || '');

// 动态计算标签卡片的样式，包括边框颜色
const cardStyle = computed(() => {
  const style: Record<string, string> = {};
  
  // 如果标签有自定义颜色，添加左侧边框
  if (props.tag.color) {
    style.borderLeft = `3px solid ${props.tag.color}`;
  }
  
  return style;
});

// --- Dropdown Actions ---
const dropdownOptions: DropdownOption[] = [
  { label: '编辑标签', key: 'edit' },
  { label: '删除标签', key: 'delete', props: { style: 'color: var(--n-error-color);' } },
];

const handleActionSelect = (key: 'edit' | 'delete') => {
  if (key === 'edit') {
    emit('edit', props.tag);
  } else if (key === 'delete') {
    emit('delete', props.tag);
  }
};

// --- Handle Checkbox Change ---
const handleCheckboxUpdate = (checked: boolean) => {
    emit('selection-change', { id: props.tag.id, selected: checked });
};

</script>

<template>
  <n-card 
    :title="tag.name" 
    size="small" 
    hoverable 
    class="tag-card" 
    :class="{ 'is-selected': selected }"
    :style="cardStyle"
  >
    <n-checkbox 
        :checked="selected"
        @update:checked="handleCheckboxUpdate"
        class="selection-checkbox"
        @click.stop="() => {}"
    />

    <template #header-extra>
        <n-dropdown 
            trigger="click" 
            :options="dropdownOptions" 
            placement="bottom-end" 
            @select="handleActionSelect"
            @click.stop="() => {}"
        >
            <n-button text size="tiny" class="action-btn" @click.stop="() => {}">
               <template #icon>
                    <n-icon :component="MoreIcon" />
               </template>
            </n-button>
        </n-dropdown>
    </template>

    <!-- 内容区域带有截断 -->
    <div class="tag-content">
        <!-- 子标题显示 -->
        <div v-if="displaySubtitles" class="tag-subtitles">
            <n-ellipsis :line-clamp="2" tooltip>
                {{ displaySubtitles }}
            </n-ellipsis>
        </div>

        <!-- 关键词显示 -->
        <div v-if="tag.keyword" class="tag-keyword">
            <n-tooltip placement="top">
                <template #trigger>
                    <n-space :size="4" align="center">
                        <n-icon :component="KeywordIcon" size="14" class="keyword-icon" />
                        <n-ellipsis style="max-width: 100%;">
                            {{ tag.keyword }}
                        </n-ellipsis>
                    </n-space>
                </template>
                {{ tag.keyword }}
            </n-tooltip>
        </div>

        <!-- 权重显示 -->
        <div v-if="tag.weight" class="tag-weight">
            <n-text depth="3">权重: {{ tag.weight }}</n-text>
        </div>
    </div>

    <template #footer>
        <n-space justify="space-between" align="center">
            <n-tag type="default" size="small" class="category-tag">
                {{ categoryName }}
            </n-tag>
            
            <!-- 如果有其他元数据，可以在这里添加额外的标签 -->
        </n-space>
    </template>
  </n-card>
</template>

<style scoped>
.tag-card {
  position: relative;
  transition: all 0.2s ease-in-out;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tag-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.09);
  z-index: 1; /* 确保悬停时在上层 */
}

.tag-card.is-selected {
   border-color: var(--n-color-target);
   background-color: rgba(var(--n-primary-color-rgb), 0.05);
}

/* 修复选择框定位问题 */
.selection-checkbox {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2;
}

/* 调整标题和内容区域的边距，避免与选择框重叠 */
:deep(.n-card-header__main) {
    padding-left: 28px;
    font-weight: 500;
}

.tag-content {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    overflow: hidden;
}

.tag-subtitles {
    font-size: 0.9em;
    color: var(--n-text-color-2);
    line-height: 1.4;
}

.tag-keyword {
    font-size: 0.85em;
    border-radius: 4px;
    padding: 3px 0;
    color: var(--n-text-color-3);
}

.keyword-icon {
    color: var(--n-info-color);
}

.tag-weight {
    font-size: 0.85em;
}

.category-tag {
    font-size: 0.8em;
    border-radius: 4px;
    opacity: 0.8;
}

.action-btn {
    opacity: 0.6;
    transition: opacity 0.2s ease;
}

.action-btn:hover {
    opacity: 1;
}

/* 调整卡片底部样式 */
:deep(.n-card__footer) {
    padding-top: 10px;
    padding-bottom: 8px;
    border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

/* 暗色主题适配 */
:global(.n-theme-dark) .tag-card.is-selected {
    background-color: rgba(var(--n-primary-color-rgb), 0.15);
}

:global(.n-theme-dark) :deep(.n-card__footer) {
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

:global(.n-theme-dark) .tag-card:hover {
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
}
</style> 