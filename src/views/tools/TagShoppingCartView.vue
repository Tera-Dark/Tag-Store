<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue';
import { 
    NPageHeader, 
    NTabs, 
    NTabPane, 
    NGrid, 
    NGi, 
    NCard, 
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
    NEmpty
} from 'naive-ui';
import { CopyOutline as CopyIcon, CloseCircleOutline as ClearIcon, CloseOutline as CloseIcon, StarOutline as StarIconOutline, Star as StarIconFilled, AddCircleOutline as AddAllIcon, PricetagsOutline as CategoryIcon } from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import type { Category, Tag } from '../../types/data';
import { useRouter } from 'vue-router';

const tagStore = useTagStore();
const router = useRouter();
const message = useMessage();

// --- Constants ---
const FAVORITES_KEY = '__FAVORITES__';
const FAVORITES_STORAGE_KEY = 'tagShoppingCartFavorites';
const NO_SUBTITLE_KEY = '(无副标题)';

// --- State ---
const selectedTags = ref<Tag[]>([]);
const selectedCategoryId = ref<string | undefined>(undefined);
const selectedSubtitle = ref<string | undefined>(undefined);
const editablePromptText = ref<string>('');
const favoriteTagIds = ref<Set<string>>(new Set());
const tagSearchTerm = ref<string>('');

// --- Main Category Definition (Placeholder - Needs actual IDs) ---
// Remove this section entirely
// interface MainCategoryGroup { ... }
// const mainCategoryGroups: MainCategoryGroup[] = [ ... ];

// --- Computed Properties ---

// Options for the sidebar menu, including Favorites
const categoryMenuOptions = computed(() => {
    const favOption = { label: '收藏夹', key: FAVORITES_KEY, icon: () => h(NIcon, null, { default: () => h(StarIconFilled) }) };
    const categoryOptions = tagStore.categories.map(cat => ({
        label: cat.name,
        key: cat.id,
        icon: () => h(NIcon, null, { default: () => h(CategoryIcon) })
    }));
    return [favOption, ...categoryOptions];
});

// Get favorited tags from the main store
const favoritedTags = computed((): Tag[] => {
    // Optimization: Could be expensive if tagStore.tags is huge.
    // Consider caching or only calculating when needed.
    return tagStore.tags.filter(tag => favoriteTagIds.value.has(tag.id));
});

// Get tags for the currently selected main category (excluding favorites view)
const currentTagsInSelectedCategory = computed((): Tag[] => {
    if (!selectedCategoryId.value || selectedCategoryId.value === FAVORITES_KEY) return [];
    return tagStore.tags.filter(tag => tag.categoryId === selectedCategoryId.value);
});

// Group tags by subtitle (only for regular categories)
const currentTagsGroupedBySubtitle = computed((): Map<string, Tag[]> => {
    const groups = new Map<string, Tag[]>();
    for (const tag of currentTagsInSelectedCategory.value) {
        const subtitle = tag.subtitles && tag.subtitles.length > 0 && tag.subtitles[0]?.trim()
                         ? tag.subtitles[0].trim()
                         : NO_SUBTITLE_KEY;
        if (!groups.has(subtitle)) {
            groups.set(subtitle, []);
        }
        groups.get(subtitle)?.push(tag);
    }
    return groups;
});

// Subtitle groups (only for regular categories)
const currentSubtitleGroups = computed((): string[] => {
    if (selectedCategoryId.value === FAVORITES_KEY) return [];
    return Array.from(currentTagsGroupedBySubtitle.value.keys());
});

// Tags to show (handles both favorites and regular categories, AND global search)
const currentTagsToShow = computed((): Tag[] => {
    const searchTerm = tagSearchTerm.value.toLowerCase().trim();

    // --- Global Search Logic ---
    if (searchTerm) {
        return tagStore.tags.filter(tag => 
            tag.name.toLowerCase().includes(searchTerm) || 
            (tag.keyword && tag.keyword.toLowerCase().includes(searchTerm))
        );
    }

    // --- Category/Subtitle/Favorite Logic (Only if search term is empty) ---
    let tags: Tag[] = [];
    if (selectedCategoryId.value === FAVORITES_KEY) {
        tags = favoritedTags.value; // Show favorited tags
    }
    else if (selectedSubtitle.value) { // If regular category and subtitle selected
        tags = currentTagsGroupedBySubtitle.value.get(selectedSubtitle.value) || [];
    }
    // If no subtitle selected or other cases, tags remains empty or as assigned above
    
    return tags; // Return category/favorite tags if search is inactive
});

const selectedTagsString = computed(() => {
    return selectedTags.value.map(tag => tag.keyword || tag.name).join(', ');
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

// Toggle tag selection
const toggleTagSelection = (tag: Tag) => {
    const index = selectedTags.value.findIndex(t => t.id === tag.id);
    if (index !== -1) {
        // Tag exists, remove it
        selectedTags.value.splice(index, 1);
    } else {
        // Tag doesn't exist, add it
        selectedTags.value.push(tag);
    }
};

// removeTag method remains the same for direct removal from NTag close button
const removeTag = (tagToRemove: Tag) => {
    const index = selectedTags.value.findIndex(tag => tag.id === tagToRemove.id);
    if (index !== -1) {
        // Optimization: Use splice for targeted removal
        selectedTags.value.splice(index, 1);
    }
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
    selectedTags.value = [];
    message.info('购物车已清空');
};

const handleBack = () => {
    router.push('/toolbox'); // Assuming toolbox route exists
};

// Handle main category/favorites selection from sidebar menu
const handleCategorySelect = (key: string) => {
    selectedCategoryId.value = key;
    // Reset subtitle only if it's not the favorites view
    if (key !== FAVORITES_KEY) {
        selectedSubtitle.value = undefined; 
    }
    // Auto-selection of first subtitle is handled by the watcher
};

// Watch for subtitle groups changing (due to category change) to select the first one
watch(currentSubtitleGroups, (newGroups) => {
    if (newGroups && newGroups.length > 0 && selectedSubtitle.value === undefined) {
        selectedSubtitle.value = newGroups[0];
    }
    // Handle case where category changes and new category has NO subtitle groups
    else if ((!newGroups || newGroups.length === 0) && selectedCategoryId.value) {
         selectedSubtitle.value = undefined;
    }
}, { immediate: true });

// Select first category on initial load if none selected
watch(selectedCategoryId, (newVal, _oldVal) => {
    if (newVal === undefined && categoryMenuOptions.value.length > 0) {
        selectedCategoryId.value = categoryMenuOptions.value[0].key;
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
        message.info('当前分组下的所有标签均已在购物车中');
    }
};

</script>

<template>
  <div class="tag-shopping-cart-view">
    <n-page-header title="标签购物车" @back="handleBack">
      <template #subtitle>
        组合挑选标签，构建你的提示词
      </template>
    </n-page-header>

    <n-layout has-sider class="main-layout">
      <!-- Sidebar for Main Categories -->
      <n-layout-sider 
        bordered 
        collapse-mode="width"
        :collapsed-width="64"
        :width="200"
        show-trigger
        content-style="padding: 10px 5px;"
        class="main-sider"
      >
        <n-scrollbar style="max-height: calc(100vh - 150px)">
          <n-menu
            :options="categoryMenuOptions"
            :value="selectedCategoryId"
            @update:value="handleCategorySelect"
          />
        </n-scrollbar>
      </n-layout-sider>

      <!-- Main Content Area -->
      <n-layout-content class="main-content">
        
        <!-- Editable Text Area with Copy Button -->
        <div class="editable-prompt-section">
          <n-input 
            type="textarea"
            v-model:value="editablePromptText"
            placeholder="在此编辑或组合提示词... (此区域内容会随下方标签选择自动更新)"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
          <n-button 
            class="copy-prompt-button" 
            @click="copyEditablePrompt" 
            :disabled="!editablePromptText" 
            secondary 
            circle 
            size="small" 
          >
            <template #icon><n-icon :component="CopyIcon" /></template>
          </n-button>
        </div>

        <!-- Selected Tags Area -->
        <div class="selected-tags-section">
          <n-space justify="space-between" align="center" class="selected-tags-header">
              <span class="section-title">当前选择</span>
               <n-space>
                <n-button text size="small" @click="copySelectedTags" :disabled="selectedTags.length === 0">
                  <template #icon><n-icon :component="CopyIcon" /></template>
                  复制
                </n-button>
                <n-button text type="error" size="small" @click="clearSelectedTags" :disabled="selectedTags.length === 0">
                  <template #icon><n-icon :component="ClearIcon" /></template>
                  清空
                </n-button>
              </n-space>
          </n-space>
          <div class="selected-tags-container">
               <n-scrollbar style="max-height: 100px;" x-scrollable>
                   <n-flex :size="[6, 6]" style="padding: 8px 5px;">
                        <n-tag 
                            v-for="tag in selectedTags" 
                            :key="tag.id" 
                            closable 
                            @close="removeTag(tag)" 
                            type="info" 
                            size="small"
                            class="selected-tag-item"
                        >
                            {{ tag.name }}
                            <span v-if="tag.keyword" class="selected-tag-keyword"> [{{ tag.keyword }}]</span>
                        </n-tag>
                        <span v-if="selectedTags.length === 0" class="placeholder-text">
                            点击下方标签添加到此处...
                        </span>
                   </n-flex>
                </n-scrollbar>
            </div>
        </div>

        <!-- Subtitle Navigation and Tag Display Area -->
        <div class="selection-area">
            <!-- Subtitle Tabs/Navigation -->
            <div 
                class="subtitle-navigation-wrapper" 
                v-if="currentSubtitleGroups.length > 0 && selectedCategoryId !== FAVORITES_KEY" 
            >
                 <n-tabs 
                    type="line"
                    size="small" 
                    v-model:value="selectedSubtitle"
                    class="sub-tabs"
                    justify-content="start" 
                >
                    <n-tab-pane
                        v-for="subtitle in currentSubtitleGroups" 
                        :key="subtitle"
                        :name="subtitle" 
                        :tab="subtitle"
                    />
                </n-tabs>
                <!-- Add All Button aligned with tabs -->
                <n-button 
                    v-if="selectedSubtitle && !tagSearchTerm"
                    @click="addAllVisibleTags"
                    size="small"
                    quaternary 
                    class="add-all-button"
                    title="添加当前副标题下的所有标签"
                >
                    <template #icon><n-icon :component="AddAllIcon" /></template>
                    添加全部
                </n-button>
            </div>
             <n-empty 
                v-else-if="selectedCategoryId && currentTagsInSelectedCategory.length > 0 && !tagSearchTerm"
                description="此分类下的标签均无副标题分组"
                size="small"
                class="empty-state"
             />
             <n-empty 
                v-else-if="selectedCategoryId && !tagSearchTerm"
                description="请先选择主分类或此分类下无标签"
                size="small"
                class="empty-state"
             />
               

            <!-- Tag Search Input -->
            <n-input 
                v-model:value="tagSearchTerm"
                placeholder="搜索整个标签库..."
                size="small"
                clearable
                class="tag-search-input"
                style="margin-bottom: 10px; flex-shrink: 0;"
            >
                 <template #prefix>
                    <n-icon :component="CategoryIcon" />
                </template>
            </n-input>

            <!-- Tag Display -->
            <div class="tags-area" v-if="(selectedCategoryId === FAVORITES_KEY || selectedSubtitle) || tagSearchTerm">
                 <n-scrollbar style="max-height: calc(100vh - 280px); padding-right: 10px;">
                    <n-flex wrap :size="[8, 8]">
                    <!-- Render differently based on context (Fav vs Category vs Search Results) -->
                    <!-- NOTE: The v-if/v-else logic inside might need adjustment if we want distinct rendering for search results vs favs vs category -->
                    <!-- Current logic will render search results using the 'v-else' block's style -->
                    <template v-if="selectedCategoryId === FAVORITES_KEY && !tagSearchTerm">
                         <n-button 
                            v-for="tag in currentTagsToShow" 
                            :key="tag.id"
                            size="small"
                            @click="toggleTagSelection(tag)"
                            :type="selectedTags.some(t => t.id === tag.id) ? 'primary' : 'default'"
                            class="tag-button fav-tag-button"
                            :focusable="false" 
                        >
                             <div class="tag-button-content">
                                <div class="tag-name-section">{{ tag.name }}</div>
                                <div class="tag-keyword-section">{{ tag.keyword || '&nbsp;' }}</div>
                            </div>
                            <!-- Hover Toolbar -->
                            <div class="tag-hover-toolbar">
                                <n-button text circle size="tiny" @click.stop="copySingleTag(tag)" title="复制">
                                    <template #icon><n-icon :component="CopyIcon" /></template>
                                </n-button>
                                <n-button text circle size="tiny" @click.stop="toggleFavorite(tag.id)" :title="favoriteTagIds.has(tag.id) ? '取消收藏' : '收藏标签'">
                                    <template #icon>
                                        <n-icon :component="favoriteTagIds.has(tag.id) ? StarIconFilled : StarIconOutline" :color="favoriteTagIds.has(tag.id) ? '#ffc107' : undefined" />
                                    </template>
                                </n-button>
                            </div>
                        </n-button>
                        <n-empty v-if="favoritedTags.length === 0 && !tagSearchTerm" description="还没有收藏任何标签" class="empty-state-inline" />
                    </template>
                    <template v-else> <!-- Regular Category View OR Global Search Results View -->
                        <n-button 
                            v-for="tag in currentTagsToShow" 
                            :key="tag.id"
                            size="small"
                            @click="toggleTagSelection(tag)"
                            :type="selectedTags.some(t => t.id === tag.id) ? 'primary' : 'default'"
                            class="tag-button"
                            :focusable="false" 
                        >
                            <!-- Add Favorite Indicator -->
                            <n-icon 
                                v-if="favoriteTagIds.has(tag.id)" 
                                :component="StarIconFilled" 
                                size="12" 
                                color="#ffc107" 
                                class="absolute-fav-indicator"
                                title="已收藏"
                            />
                             <div class="tag-button-content">
                                <div class="tag-name-section">{{ tag.name }}</div>
                                <div class="tag-keyword-section">{{ tag.keyword || '&nbsp;' }}</div>
                            </div>
                            <!-- Hover Toolbar -->
                            <div class="tag-hover-toolbar">
                                <n-button text circle size="tiny" @click.stop="copySingleTag(tag)" title="复制">
                                    <template #icon><n-icon :component="CopyIcon" /></template>
                                </n-button>
                                <n-button text circle size="tiny" @click.stop="toggleFavorite(tag.id)" :title="favoriteTagIds.has(tag.id) ? '取消收藏' : '收藏标签'">
                                    <template #icon>
                                        <n-icon :component="favoriteTagIds.has(tag.id) ? StarIconFilled : StarIconOutline" :color="favoriteTagIds.has(tag.id) ? '#ffc107' : undefined" />
                                    </template>
                                </n-button>
                            </div>
                        </n-button>
                        <span v-if="currentTagsToShow.length === 0 && selectedSubtitle && !tagSearchTerm" class="placeholder-text">
                            此副标题分组下暂无标签。
                        </span>
                        <span v-else-if="currentTagsToShow.length === 0 && tagSearchTerm" class="placeholder-text">
                            未找到匹配的标签。
                        </span>
                    </template>
                    </n-flex>
                </n-scrollbar>
            </div>
            <n-empty 
                v-else-if="selectedCategoryId && selectedCategoryId !== FAVORITES_KEY && currentSubtitleGroups.length > 0 && !selectedSubtitle && !tagSearchTerm"
                description="请选择一个副标题分组"
                size="small"
                class="empty-state tags-area"
             />
              <!-- Other empty states handled above -->

        </div> 
      </n-layout-content>
    </n-layout>

  </div>
</template>

<style scoped>
.tag-shopping-cart-view {
  /* Remove padding here if main-layout handles it */
  /* padding: 20px; */ 
  height: calc(100vh - 60px); /* Adjust based on header/nav height */
  display: flex;
  flex-direction: column;
}

.main-layout {
    flex-grow: 1; 
    background-color: var(--n-color); 
}

.main-sider {
    background-color: var(--n-color); 
}

.main-content {
    background-color: var(--body-color); 
    padding: 10px 15px; /* Adjust padding */
    display: flex;
    flex-direction: column;
}

.selected-tags-section {
    margin-bottom: 10px; /* Reduced margin */
    flex-shrink: 0; 
}

.selected-tags-header {
    margin-bottom: 8px;
}

.section-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--n-text-color-1);
}

.selected-tags-container {
    border: 1px solid var(--n-border-color);
    border-radius: 6px; /* Match button radius */
    background-color: var(--n-color-embedded); /* Use embedded color */
    min-height: 40px; /* Adjust min height */
}

.selected-tag-item {
    /* Optional: Add styles for selected tags if needed */
    background-color: var(--n-tag-color-info); /* Use info color from theme */
    /* color: var(--n-text-color-base); */
}

.placeholder-text {
    color: var(--n-text-color-disabled);
    font-size: 13px;
    padding: 5px;
}

.sub-tabs {
    margin-bottom: 10px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--n-border-color); /* Add subtle bottom border */
}

/* Make line tabs less prominent */
:deep(.sub-tabs .n-tabs-nav--line-type) {
  margin-bottom: -1px; /* Overlap border */
}
:deep(.sub-tabs .n-tabs-nav-scroll-content) {
    border-bottom: none;
}
:deep(.sub-tabs .n-tabs-tab) {
    font-size: 13px;
    padding: 8px 0;
    margin-right: 16px;
}

.tags-area {
    margin-top: 0; /* Remove top margin */
    padding: 0; /* Remove padding, scrollbar handles it */
    background-color: transparent; /* Area itself is transparent */
    border-radius: 0;
    min-height: 100px;
    flex-grow: 1; /* Allow area to grow */
    overflow: hidden; /* Needed for scrollbar */
}

.empty-state {
    margin-top: 20px;
    flex-grow: 1; /* Center empty state */
    display: flex;
    align-items: center;
    justify-content: center;
}
.empty-state.tags-area {
     background-color: var(--body-color);
}

/* Keep tag button styles */
.tag-button {
    position: relative; /* Needed for hover toolbar */
    padding: 0 !important; 
    height: auto; 
    border: 1px solid #f0f0f0; /* Light grey border as in reference */
    border-radius: 6px; 
    overflow: hidden; 
    background-color: transparent; 
    vertical-align: top; 
    max-width: none; /* Let flexbox handle width */
    transition: border-color 0.3s;
    box-shadow: none;
}

.tag-button:hover {
    border-color: #e0e0e0; /* Slightly darker grey border */
    background-color: transparent;
}

.tag-button.n-button--primary-type {
    border-color: var(--n-success-color, #4caf50); /* Green border when selected */
    background-color: transparent; /* Keep outer button background transparent */
}

/* Modify background of inner sections when selected */
.tag-button.n-button--primary-type .tag-name-section {
    background-color: var(--n-success-color-pressed, #388e3c); /* Use a darker green for selected name section */
    color: white; /* Ensure text remains readable */
}

.tag-button.n-button--primary-type .tag-keyword-section {
     background-color: #f8f8f8; /* Slightly off-white for selected keyword section */
     color: var(--n-success-color-pressed, #388e3c); /* Darker green text for keyword */
}

.tag-button.n-button--primary-type:hover {
     border-color: var(--n-success-color-hover, #45a049);
     background-color: transparent; /* Keep outer button background transparent on hover */
}

/* Restore two-tone content styles */
.tag-button-content {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.tag-name-section {
    padding: 5px 8px;
    background-color: #e6f4ea; /* Light Green */
    color: var(--n-success-color, darkgreen); /* Dark Green Text */
    text-align: center;
    font-size: 13px;
    font-weight: 500;
    border-radius: 5px 5px 0 0; /* Match outer radius */
    position: relative; 
}

.tag-keyword-section {
    padding: 4px 8px;
    background-color: white; 
    color: var(--n-success-color, darkgreen); /* Dark Green Text */
    text-align: center;
    font-size: 11px; 
    min-height: 20px; 
    line-height: 1.3;
    word-break: break-all; 
    white-space: normal; 
    border-radius: 0 0 5px 5px; /* Match outer radius */
}

/* Remove old inline keyword and fav button styles */
/* .tag-keyword-inline { ... } */
/* .fav-toggle-button { ... } */
/* .fav-toggle-button.inner-fav-button { ... } */
/* .tag-button.n-button--primary-type .inner-fav-button { ... } */

.empty-state-inline {
    width: 100%;
    padding: 20px;
}

/* Restore editable prompt section style */
.editable-prompt-section {
    margin-bottom: 15px; 
    flex-shrink: 0;
    position: relative; /* Add relative positioning */
}

.copy-prompt-button {
    position: absolute;
    top: 8px; /* Adjust as needed */
    right: 8px; /* Adjust as needed */
    z-index: 1; /* Ensure button is above textarea */
}

.tag-hover-toolbar {
    position: absolute;
    top: 2px;
    right: 2px;
    background-color: rgba(255, 255, 255, 0.85); /* Semi-transparent white */
    border-radius: 4px;
    padding: 2px 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    display: flex;
    gap: 4px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
    z-index: 10; /* Ensure it's above content */
}

.tag-button:hover .tag-hover-toolbar {
    opacity: 1;
    visibility: visible;
}

.tag-hover-toolbar .n-button .n-icon {
    vertical-align: middle; /* Align icons nicely */
}

.absolute-fav-indicator {
    position: absolute;
    top: 3px;
    left: 3px;
    z-index: 5; /* Below toolbar, above content */
    filter: drop-shadow(0 0 1px rgba(0,0,0,0.5)); /* Add subtle shadow */
}

.subtitle-navigation-wrapper {
    display: flex;
    align-items: flex-end; /* Align button with bottom of tabs */
    margin-bottom: 10px;
    flex-shrink: 0;
}

.sub-tabs {
    margin-bottom: 0; /* Remove margin as wrapper handles it */
    border-bottom: 1px solid var(--n-border-color); 
    flex-grow: 1; /* Allow tabs to take available space */
}

.add-all-button {
    margin-left: 10px;
    margin-bottom: 1px; /* Align with tab baseline */
    flex-shrink: 0;
}

.tag-search-input {
  /* Optional: Add specific styles if needed */
}

</style> 