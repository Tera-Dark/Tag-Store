<script setup lang="ts">
import { defineProps, computed, defineEmits } from 'vue';
import { NCard, NTag, NSpace, NTooltip, NDropdown, NButton, NIcon, NCheckbox } from 'naive-ui';
import type { DropdownOption } from 'naive-ui';
import { useTagStore } from '../stores/tagStore';
import type { Tag } from '../types/data';
// Placeholder for icons
// import { CreateOutline as EditIcon, TrashOutline as DeleteIcon, EllipsisVertical } from '@vicons/ionicons5';

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
const categoryName = computed(() => tagStore.getCategoryNameById(props.tag.categoryId) || '未知分类');

// Format subtitles for display
const displaySubtitles = computed(() => props.tag.subtitles?.join(' / ') || '');

// --- Dropdown Actions ---
const dropdownOptions: DropdownOption[] = [
  { label: '编辑标签', key: 'edit' },
  { label: '删除标签', key: 'delete', props: { style: 'color: red;' } },
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
  <n-card :title="tag.name" size="small" hoverable class="tag-card" :class="{ 'is-selected': selected }">
    <n-checkbox 
        :checked="selected"
        @update:checked="handleCheckboxUpdate"
        class="selection-checkbox"
        @click.stop="() => {} /* Prevent card click propagation */"
    />

    <template #header-extra>
        <n-dropdown 
            trigger="click" 
            :options="dropdownOptions" 
            placement="bottom-end" 
            @select="handleActionSelect"
            @click.stop="() => {} /* Prevent card click when clicking dropdown */"
           >
            <n-button text size="tiny" style="opacity: 0.6;" @click.stop="() => {} /* Also prevent click on button */">
               <!-- Use actual icon later -->
               <!-- <template #icon><n-icon><EllipsisVertical /></n-icon></template> -->
                ...
            </n-button>
        </n-dropdown>
    </template>

    <!-- Display Subtitles -->
    <n-text v-if="displaySubtitles" depth="3" style="font-size: 0.9em; margin-bottom: 8px; display: block;">
        {{ displaySubtitles }}
    </n-text>

    <!-- Display Keyword with Tooltip -->
     <n-tooltip v-if="tag.keyword" trigger="hover">
        <template #trigger>
            <n-tag type="info" size="small" :bordered="false" style="cursor: help;">
                关键词
            </n-tag>
        </template>
        {{ tag.keyword }}
    </n-tooltip>

    <!-- TODO: Add more tag details if needed (e.g., color, weight) -->

    <template #footer>
        <n-tag type="default" size="small" :bordered="false">
           {{ categoryName }}
        </n-tag>
    </template>
  </n-card>
</template>

<style scoped>
.tag-card {
  position: relative; /* Needed for absolute positioning */
  transition: border-color 0.2s ease;
}

.tag-card.is-selected {
   border-color: var(--n-color-target);
   /* Or use box-shadow or background */
   /* background-color: rgba(var(--n-color-target-rgb), 0.1); */
}

.selection-checkbox {
    position: absolute;
    top: 8px; /* Adjust position as needed */
    left: 8px;
    z-index: 1; /* Ensure it's above other content if needed */
}

/* Adjust title padding if checkbox overlaps */
:deep(.n-card-header__main) {
    padding-left: 28px; /* Add padding to prevent title overlap */
}

/* Adjust dropdown position if needed */
.n-dropdown {
    /* styles */
}

.n-card__footer {
    padding-top: 8px !important; /* Adjust spacing */
}
.n-card__header {
    padding-bottom: 8px !important; /* Adjust spacing */
}
</style> 