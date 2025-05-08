<script setup lang="ts">
import { computed, h } from 'vue';
import { NMenu, NIcon, NScrollbar } from 'naive-ui';
import { PricetagsOutline as CategoryIcon, FolderOpenOutline as GroupIcon, Star as StarIconFilled } from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import type { Group, Category } from '../../types/data';
import { safeCompare } from '../../utils/sortHelpers';

const tagStore = useTagStore();

const props = defineProps<{
  modelValue: string | undefined;
  favoritesKey: string;
  allTagsKey: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
}>();

// 菜单选项
const categoryMenuOptions = computed(() => {
    // Find groups and their categories from the store
    const groupMap = new Map<string, { group: Group; categories: Category[] }>();
    tagStore.groups.forEach(g => groupMap.set(g.id, { group: g, categories: [] }));
    tagStore.categories.forEach(c => {
        const groupData = groupMap.get(c.groupId);
        if (groupData) {
            groupData.categories.push(c);
        } else {
            console.warn(`Category ${c.name} belongs to unknown group ${c.groupId}`);
        }
    });

    // Sort categories within groups - 使用安全排序函数
    groupMap.forEach(gData => gData.categories.sort(safeCompare));

    // Sort groups - 使用安全排序函数
    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || safeCompare(a.group, b.group));

    // Build menu options with groups as expandable items
    const menuItems: any[] = sortedGroups.map(gData => ({
        label: gData.group.name,
        key: `group-${gData.group.id}`,
        icon: () => h(NIcon, null, { default: () => h(GroupIcon) }),
        children: gData.categories.map(cat => ({
            label: cat.name,
            key: cat.id, 
            icon: () => h(NIcon, null, { default: () => h(CategoryIcon) })
        }))
    }));

    const favOption = { 
      label: '收藏夹', 
      key: props.favoritesKey, 
      icon: () => h(NIcon, null, { default: () => h(StarIconFilled) })
    };
    
    const allTagsOption = { 
      label: '所有分类', 
      key: props.allTagsKey, 
      icon: () => h(NIcon, null, { default: () => h(CategoryIcon) })
    };

    return [favOption, allTagsOption, ...menuItems];
});

// 双向绑定
const selectedCategoryId = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});
</script>

<template>
  <div class="category-sidebar">
    <div class="sidebar-header">分类导航</div>
    <n-scrollbar class="sidebar-scrollbar">
      <n-menu
        v-model:value="selectedCategoryId"
        :options="categoryMenuOptions"
        :indent="12"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        class="category-menu"
      />
    </n-scrollbar>
    <slot name="actions"></slot>
  </div>
</template>

<style scoped>
/* 侧边栏样式 */
.category-sidebar {
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--n-divider-color);
  padding-right: 8px;
  background-color: var(--n-color);
  border-radius: 8px;
}

.sidebar-header {
  font-size: 16px;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid var(--n-divider-color);
  color: var(--n-text-color-1);
}

.sidebar-scrollbar {
  flex-grow: 1;
  height: calc(100% - 100px);
}

.category-menu {
  height: 100%;
}
</style> 