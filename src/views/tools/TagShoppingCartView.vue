<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue';
import { 
    NPageHeader, 
    NInput, 
    NButton, 
    NIcon, 
    NSpace, 
    NTag, 
    NFlex,
    useMessage, 
    NLayout,
    NLayoutSider,
    NLayoutContent,
    NMenu,
    NScrollbar,
    NEmpty,
    NDivider,
    NCard,
} from 'naive-ui';
import { CopyOutline as CopyIcon, CloseCircleOutline as ClearIcon, StarOutline as StarIconOutline, Star as StarIconFilled, AddCircleOutline as AddIcon, PricetagsOutline as CategoryIcon, FolderOpenOutline as GroupIcon, RemoveCircleOutline as RemoveIcon } from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Tag, Group, Category } from '../../types/data';
import { useRouter } from 'vue-router';

const tagStore = useTagStore();
const router = useRouter();
const message = useMessage();
const settingsStore = useSettingsStore();

// --- Constants ---
const FAVORITES_KEY = '__FAVORITES__';
const FAVORITES_STORAGE_KEY = 'tagShoppingCartFavorites';

// --- State ---
const selectedTags = ref<Tag[]>([]);
const selectedCategoryId = ref<string | undefined>(undefined);
const editablePromptText = ref<string>('');
const favoriteTagIds = ref<Set<string>>(new Set());
const tagSearchTerm = ref<string>('');

// --- Computed Properties ---

// Computed style for action bar
const actionBarStyle = computed(() => ({
  left: settingsStore.isSidebarCollapsed ? '64px' : '240px' 
}));

// Options for the sidebar menu, including Favorites
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

    // Sort categories within groups
    groupMap.forEach(gData => gData.categories.sort((a, b) => a.name.localeCompare(b.name)));

    // Sort groups
    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || a.group.name.localeCompare(b.group.name));

    // Build menu options with groups as expandable items
    const menuItems: any[] = sortedGroups.map(gData => ({
        label: gData.group.name,
        key: `group-${gData.group.id}`, // Keep group key distinct
        icon: () => h(NIcon, null, { default: () => h(GroupIcon) }), // Add group icon
        children: gData.categories.map(cat => ({
            label: cat.name,
            key: cat.id, 
            icon: () => h(NIcon, null, { default: () => h(CategoryIcon) })
        }))
    }));

    const favOption = { label: '收藏夹', key: FAVORITES_KEY, icon: () => h(NIcon, null, { default: () => h(StarIconFilled) }) };

    return [favOption, ...menuItems];
});

// Get favorited tags from the main store
const favoritedTags = computed((): Tag[] => {
    // Optimization: Could be expensive if tagStore.tags is huge.
    // Consider caching or only calculating when needed.
    return tagStore.tags.filter(tag => favoriteTagIds.value.has(tag.id));
});

// Tags to show (Simplified: handles search, favorites, or selected category)
const currentTagsToShow = computed((): Tag[] => {
    const searchTerm = tagSearchTerm.value.toLowerCase().trim();

    // --- Global Search Logic ---
    if (searchTerm) {
        return tagStore.tags.filter(tag => 
            tag.name.toLowerCase().includes(searchTerm) || 
            (tag.keyword && tag.keyword.toLowerCase().includes(searchTerm))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }

    // --- Favorite/Category Logic (Only if search term is empty) ---
    if (selectedCategoryId.value === FAVORITES_KEY) {
        return favoritedTags.value.sort((a, b) => a.name.localeCompare(b.name)); // Sort favorites
    }
    
    if (selectedCategoryId.value && !selectedCategoryId.value.startsWith('group-')) {
         // Valid category selected
         return tagStore.tags.filter(tag => tag.categoryId === selectedCategoryId.value)
                             .sort((a, b) => a.name.localeCompare(b.name)); // Sort category tags
    }

    // Otherwise (no selection, group selected, etc.), show nothing
    return []; 
});

// --- New Computed Property for Grouped Display ---
const groupedSelectedTagsForDisplay = computed(() => {
    const groupMap = new Map<string, { group: Group; categories: Map<string, { category: Category; tags: Tag[] }> }>();

    // Create maps for faster lookups
    const categoryLookup = new Map(tagStore.categories.map(cat => [cat.id, cat]));
    const groupLookup = new Map(tagStore.groups.map(grp => [grp.id, grp]));

    for (const tag of selectedTags.value) {
        const category = categoryLookup.get(tag.categoryId);
        if (!category) {
            console.warn(`Category not found for tag: ${tag.name} (categoryId: ${tag.categoryId})`);
            continue;
        }

        const group = groupLookup.get(category.groupId);
        if (!group) {
            console.warn(`Group not found for category: ${category.name} (groupId: ${category.groupId})`);
            continue;
        }

        if (!groupMap.has(group.id)) {
            groupMap.set(group.id, { group: group, categories: new Map() });
        }
        const groupData = groupMap.get(group.id)!; 

        if (!groupData.categories.has(category.id)) {
            groupData.categories.set(category.id, { category: category, tags: [] });
        }
        const categoryData = groupData.categories.get(category.id)!; 

        categoryData.tags.push(tag);
    }

    // Sort tags within categories and categories within groups
    groupMap.forEach(groupData => {
        groupData.categories.forEach(categoryData => {
            categoryData.tags.sort((a, b) => a.name.localeCompare(b.name)); 
        });
        const sortedCategoriesArray = Array.from(groupData.categories.values())
            .sort((a, b) => a.category.name.localeCompare(b.category.name));
        // Store sorted categories as an array for easier template iteration
        groupData.categories = new Map(sortedCategoriesArray.map(catData => [catData.category.id, catData])); 
    });

    // Sort groups 
    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || a.group.name.localeCompare(b.group.name));

    // Add sorted categories array to each group object for template
    sortedGroups.forEach(groupData => {
         (groupData as any).sortedCategories = Array.from(groupData.categories.values())
            .sort((a, b) => a.category.name.localeCompare(b.category.name));
    });

    return sortedGroups; 
});

// --- Update selectedTagsString for comma-separated keywords/names only ---
const selectedTagsString = computed(() => {
    return selectedTags.value
        .map(tag => tag.keyword || tag.name) // Get keyword or name
        .join(', '); // Join with comma and space
});

// --- Methods ---

// Load favorites from localStorage
const loadFavorites = () => {
    try {
        const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (saved) {
            const ids = JSON.parse(saved);
            if (Array.isArray(ids)) { // Basic check for array format
                 favoriteTagIds.value = new Set(ids);
            }
        }
    } catch (error) {
        console.error('加载收藏夹失败:', error);
        message.error('加载收藏夹失败');
    }
};

// Save favorites to localStorage
const saveFavorites = () => {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteTagIds.value)));
    } catch (error) {
        console.error('保存收藏夹失败:', error);
        message.error('保存收藏夹失败');
    }
};

// Toggle favorite status for a tag
const toggleFavorite = (tagId: string) => {
    if (favoriteTagIds.value.has(tagId)) {
        favoriteTagIds.value.delete(tagId);
    } else {
        favoriteTagIds.value.add(tagId);
    }
    saveFavorites(); // Save after modification
};

const copySelectedTags = () => {
    if (!selectedTagsString.value) {
        message.warning('购物车是空的！');
        return;
    }
    navigator.clipboard.writeText(selectedTagsString.value)
        .then(() => message.success('标签已复制到剪贴板'))
        .catch(() => message.error('复制失败'));
};

const clearSelectedTags = () => {
    if (selectedTags.value.length === 0) {
        message.warning('购物车已经是空的！');
        return;
    }
    selectedTags.value = [];
    message.success('购物车已清空');
};

const handleBack = () => {
    router.push('/toolbox'); // Assuming toolbox route exists
};

// Handle main category/favorites selection from sidebar menu
const handleCategorySelect = (key: string) => {
    // Only update selectedCategoryId if it's NOT a group key
    if (!key.startsWith('group-')) {
        selectedCategoryId.value = key;
    }
    // If it IS a group key, do nothing here, let n-menu handle expand/collapse
};

// Select first category on initial load if none selected
watch(selectedCategoryId, (newVal, _oldVal) => {
    if (newVal === undefined && categoryMenuOptions.value.length > 0) {
        const firstCategoryOption = categoryMenuOptions.value.flatMap(group => group.children || [group]).find(item => !item.type && item.key !== FAVORITES_KEY);
        if (firstCategoryOption) {
            selectedCategoryId.value = firstCategoryOption.key;
        } else if (categoryMenuOptions.value.length > 0) {
             selectedCategoryId.value = categoryMenuOptions.value[0].key; 
        }
    }
}, { immediate: true });

// Restore copyEditablePrompt method
const copyEditablePrompt = () => {
    if (!editablePromptText.value) {
        message.warning('编辑区是空的！');
        return;
    }
    navigator.clipboard.writeText(editablePromptText.value)
        .then(() => message.success('编辑区内容已复制到剪贴板'))
        .catch(() => message.error('复制失败'));
};

// Restore watcher for selectedTags updating editablePromptText
watch(selectedTags, (newTags) => {
    editablePromptText.value = newTags.map(tag => tag.name).join(', ');
}, { deep: true });

// Add call to load favorites on mount
onMounted(() => {
    loadFavorites();
});

// Copy single tag (adjust format as needed)
const copySingleTag = (tag: Tag) => {
    const textToCopy = tag.keyword || tag.name;
    navigator.clipboard.writeText(textToCopy)
        .then(() => message.success(`标签 [${tag.name}] 已复制`))
        .catch(() => message.error('复制失败'));
};

// Add method to add all currently visible tags
const addAllVisibleTags = () => {
    const tagsToAdd = currentTagsToShow.value.filter(tag => 
        !selectedTags.value.some(selected => selected.id === tag.id)
    );
    if (tagsToAdd.length > 0) {
        selectedTags.value.push(...tagsToAdd);
        message.success(`已添加 ${tagsToAdd.length} 个标签`);
    } else {
        message.info('当前视图下的所有标签均已在购物车中');
    }
};

// Modified: Add Tag to Cart (used by toggle function)
const addTagToCart = (tag: Tag) => {
    const index = selectedTags.value.findIndex(t => t.id === tag.id);
    if (index === -1) {
        selectedTags.value.push(tag);
    }
};

// Renamed for clarity, same functionality
const removeTagFromCart = (tagToRemove: Tag) => {
    const index = selectedTags.value.findIndex(tag => tag.id === tagToRemove.id);
    if (index !== -1) {
        selectedTags.value.splice(index, 1);
    }
};

// NEW: Toggle tag selection in cart
const toggleTagInCart = (tag: Tag) => {
    const index = selectedTags.value.findIndex(t => t.id === tag.id);
    if (index !== -1) {
        // Already selected, remove it
        removeTagFromCart(tag);
    } else {
        // Not selected, add it
        addTagToCart(tag);
    }
};

</script>

<template>
  <div class="tag-cart-view" style="padding-bottom: 80px;">
    <n-page-header title="标签购物车" @back="handleBack">
      <template #subtitle>选择、组合并复制标签</template>
      <!-- Header actions removed, moved to action bar -->
    </n-page-header>
    <n-divider />

    <n-layout has-sider class="main-layout">
      <n-layout-sider 
        bordered 
        collapse-mode="width" 
        :collapsed-width="64" 
        :width="240" 
        show-trigger 
        class="sidebar"
      >
        <n-menu
          v-model:value="selectedCategoryId"
          :options="categoryMenuOptions"
          :indent="18"
        />
      </n-layout-sider>

      <n-layout-content class="content-area">
        <div class="content-grid">
          <!-- Left Panel: Available Tags (Updated Click Handler & Class) -->
          <n-card title="可用标签" size="small" class="available-tags-panel">
            <template #header-extra>
              <n-input 
                v-model:value="tagSearchTerm" 
                placeholder="搜索标签名或关键词..." 
                clearable 
                size="small"
              />
            </template>
            <n-scrollbar style="max-height: calc(100vh - 220px);">
              <n-flex v-if="currentTagsToShow.length > 0" class="tag-list" :size="[8, 12]">
                <div 
                  v-for="tag in currentTagsToShow" 
                  :key="tag.id"
                  class="tag-item-card" 
                  @click="toggleTagInCart(tag)" 
                  :class="{'tag-item-selected': selectedTags.some(selected => selected.id === tag.id)}"
                >
                  <div class="tag-card-header">
                    <n-button text circle size="tiny" @click.stop="toggleFavorite(tag.id)" class="favorite-button" :title="favoriteTagIds.has(tag.id) ? '取消收藏' : '收藏'">
                      <n-icon :component="favoriteTagIds.has(tag.id) ? StarIconFilled : StarIconOutline" />
                    </n-button>
                    <n-button text circle size="tiny" class="add-button" title="添加/移除购物车">
                      <n-icon :component="AddIcon" />
                    </n-button>
                  </div>
                  <div class="tag-card-body">
                    <div class="tag-name">{{ tag.name }}</div>
                    <div class="tag-keyword">{{ tag.keyword || '&nbsp;' }}</div>
                  </div>
                </div>
              </n-flex>
              <n-empty v-else description="选择分类或搜索查看标签" style="margin-top: 40px;" />
            </n-scrollbar>
          </n-card>

          <!-- Right Panel: Selected Tags (Cart - Updated Item Layout) -->
          <n-card title="购物车" size="small" class="cart-panel">
             <template #header-extra>
                 <n-tag v-if="selectedTags.length > 0" type="success" size="small">
                     总计: {{ selectedTags.length }}
                 </n-tag>
             </template>
            <n-scrollbar style="max-height: calc(100vh - 260px);">
              <div v-if="selectedTags.length > 0" class="cart-content">
                 <!-- Grouped Display -->
                 <n-space vertical>
                    <n-card 
                        v-for="groupData in groupedSelectedTagsForDisplay" 
                        :key="groupData.group.id" 
                        :title="groupData.group.name" 
                        size="small" 
                        hoverable
                        class="cart-group-card"
                     >
                       <template #header-extra>
                           <n-icon :component="GroupIcon" />
                       </template>
                        <n-space vertical size="small">
                            <div v-for="categoryData in (groupData as any).sortedCategories" :key="categoryData.category.id" class="cart-category-section">
                                <div class="cart-category-header">{{ categoryData.category.name }}</div>
                                <div class="cart-items-container">
                                    <!-- Updated cart item structure -->
                                    <div 
                                        v-for="tag in categoryData.tags" 
                                        :key="tag.id" 
                                        class="cart-item-card"
                                    >
                                        <div class="cart-item-content">
                                            <div class="cart-item-name">{{ tag.name }}</div>
                                            <div class="cart-item-keyword">{{ tag.keyword || '' }}</div>
                                        </div>
                                        <n-button 
                                            text 
                                            circle 
                                            size="tiny" 
                                            @click="removeTagFromCart(tag)" 
                                            class="cart-item-remove-button"
                                            title="从购物车移除"
                                        >
                                            <template #icon><n-icon :component="RemoveIcon" /></template>
                                        </n-button>
                                    </div>
                                </div>
                            </div>
                        </n-space>
                    </n-card>
                 </n-space>

                 <n-divider title-placement="left" style="margin-top: 20px;">复制内容预览 (逗号分隔)</n-divider>
                 <n-input
                    v-model:value="selectedTagsString"
                    type="textarea"
                    readonly
                    placeholder="购物车为空"
                    :autosize="{ minRows: 2, maxRows: 5 }"
                  />
              </div>
              <n-empty v-else description="从左侧选择标签添加到购物车" style="margin-top: 40px;"/>
            </n-scrollbar>
          </n-card>
        </div>
      </n-layout-content>
    </n-layout>

    <!-- Fixed Action Bar -->
    <div class="fixed-action-bar" :style="actionBarStyle">
         <n-button 
            type="primary" 
            @click="copySelectedTags" 
            :disabled="selectedTags.length === 0"
            size="large"
            style="margin-right: 12px;"
          >
              <template #icon><n-icon :component="CopyIcon" /></template>
              复制购物车内容
          </n-button>
          <n-popconfirm @positive-click="clearSelectedTags">
              <template #trigger>
                  <n-button 
                    type="error" 
                    secondary 
                    :disabled="selectedTags.length === 0"
                    size="large"
                   >
                      <template #icon><n-icon :component="ClearIcon" /></template>
                      清空购物车
                  </n-button>
              </template>
              确定要清空购物车中的所有标签吗？
          </n-popconfirm>
    </div>
  </div>
</template>


<style scoped>
.tag-cart-view {
  height: calc(100vh - 65px - 50px); /* Adjust based on header/footer heights */
  display: flex;
  flex-direction: column;
}

.main-layout {
  flex-grow: 1;
  /* overflow: hidden; Prevent double scrollbars */
}

.sidebar {
  height: 100%;
}
:deep(.sidebar .n-layout-sider-scroll-container) {
     overflow-x: hidden; /* Hide horizontal scrollbar */
}


.content-area {
  padding: 15px;
  height: 100%;
  overflow: hidden; /* Prevent layout content from scrolling */
}

.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); /* Responsive columns */
  gap: 15px;
  height: 100%; /* Fill content area height */
}

.available-tags-panel,
.cart-panel {
  display: flex;
  flex-direction: column;
  height: 100%; /* Make panels fill grid cell height */
  overflow: hidden; /* Prevent panel content overflow */
}

.available-tags-panel :deep(.n-card__content),
.cart-panel :deep(.n-card__content) {
  flex-grow: 1;
  overflow: hidden; /* Prevent card content overflow */
  padding: 5px 10px !important; /* Adjust padding */
}

.available-tags-panel .n-scrollbar,
.cart-panel .n-scrollbar {
  flex-grow: 1;
}

/* --- Available Tags List - Updated Item Card Style --- */
.tag-list {
  padding: 5px;
  display: flex; /* Ensure flex wrap works */
  flex-wrap: wrap;
}

.tag-item-card {
    border: 1px solid var(--n-border-color);
    border-radius: 4px;
    margin: 4px;
    padding: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--n-color);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
    position: relative;
    overflow: hidden;
    min-width: 100px; /* Adjust min width */
    cursor: pointer; /* Indicate the whole card is clickable */
}

.tag-item-card:hover {
    border-color: var(--n-primary-color-hover);
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.tag-card-header {
    display: flex;
    justify-content: flex-end; /* Buttons to the right */
    padding: 2px 4px;
    background-color: var(--n-action-color); /* Subtle header background */
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    opacity: 0; /* Hide initially */
    transition: opacity 0.2s ease;
}

.tag-item-card:hover .tag-card-header {
    opacity: 1;
}

.tag-card-header .favorite-button {
    position: absolute; /* Position fav button independently */
    left: 4px;
    top: 2px;
}

.tag-card-header .add-button {
   /* Styling for add button if needed, but click is on card now */
   pointer-events: none; /* Prevent clicks directly on this button icon */
}

.tag-card-body {
    padding: 22px 8px 6px 8px; /* Top padding to clear header */
    text-align: center;
}

.tag-card-body .tag-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--n-text-color-1);
    margin-bottom: 2px;
    word-break: break-word;
}

.tag-card-body .tag-keyword {
    font-size: 11px;
    color: var(--n-text-color-3);
    word-break: break-word;
    min-height: 15px; /* Ensure space even if empty */
}


/* --- Cart Display - Updated Item Layout --- */
.cart-items-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
}

.cart-item-card {
    background-color: var(--n-color);
    border: 1px solid var(--n-divider-color);
    border-radius: 4px;
    padding: 6px 28px 6px 10px; /* Adjust padding for remove button */
    display: flex;
    align-items: center;
    position: relative;
    transition: background-color 0.2s ease;
    flex-grow: 1; /* Allow items to grow if needed */
    min-width: 120px; /* Minimum width for better layout */
}

.cart-item-card:hover {
    background-color: var(--n-color-hover);
}

/* NEW: Container for name and keyword */
.cart-item-content {
    flex-grow: 1; /* Allow content to take available space */
    margin-right: 8px; /* Space between content and button area */
    overflow: hidden; /* Prevent content from overflowing card */
}

.cart-item-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--n-text-color-1);
    padding-right: 0; /* Remove previous padding */
    overflow-wrap: break-word; /* Allow long words to wrap */
    word-break: break-word; /* Ensure wrapping */
    line-height: 1.3;
}

.cart-item-keyword {
    font-size: 12px;
    color: var(--n-text-color-3);
    margin-left: 8px;
    font-style: italic;
    flex-shrink: 0; /* Prevent keyword from shrinking too much */
    overflow-wrap: break-word; 
    word-break: break-word; 
    line-height: 1.2;
}

.cart-item-remove-button {
    position: absolute;
    top: 50%;
    right: 6px; /* Adjust position slightly */
    transform: translateY(-50%);
    opacity: 0.6;
    color: var(--n-error-color);
}

.cart-item-card:hover .cart-item-remove-button {
    opacity: 1;
}

/* NEW: Style for selected tag cards in the available list */
.tag-item-card.tag-item-selected {
    border-color: var(--n-primary-color-pressed);
    box-shadow: 0 0 0 1px var(--n-primary-color-pressed);
    background-color: var(--n-item-color-active-hover);
}

/* --- Fixed Action Bar --- */
.fixed-action-bar {
  position: fixed;
  bottom: 0;
  right: 0;
  height: 64px; 
  background-color: var(--n-card-color);
  border-top: 1px solid var(--n-border-color);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 24px;
  z-index: 10;
  transition: left 0.3s var(--n-bezier), background-color 0.3s var(--n-bezier), border-color 0.3s var(--n-bezier);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .tag-cart-view {
     height: calc(100vh - 60px - 50px); /* Adjust if header is smaller */
     padding-bottom: 70px; /* Ensure space for action bar */
  }
  
  .content-grid {
     grid-template-columns: 1fr; /* Stack columns on smaller screens */
  }
  
  .available-tags-panel,
  .cart-panel {
      height: auto; /* Allow content to determine height */
      min-height: 250px; /* Ensure some minimum height */
  }
   .available-tags-panel .n-scrollbar,
   .cart-panel .n-scrollbar {
      max-height: 35vh; /* Limit scroll height on small screens */
   }


  .fixed-action-bar {
    height: 56px; 
    padding: 0 16px;
    left: 0 !important; 
  }

  .fixed-action-bar .n-button {
     padding-left: 10px;
     padding-right: 10px;
  }
  .fixed-action-bar .n-button--large {
      height: 40px;
      font-size: 14px;
  }
}

</style> 