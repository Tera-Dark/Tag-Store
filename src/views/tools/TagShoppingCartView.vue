<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from 'vue';
import { 
    NPageHeader, 
    NCard, 
    NIcon, 
    NButton, 
    NSpace, 
    NEmpty, 
    NDivider,
    NScrollbar,
    useMessage,
    NTreeSelect,
    NSelect,
    NSpin,
    NButtonGroup,
    NMenu,
    NTag,
    NTooltip
} from 'naive-ui';
import { CopyOutline as CopyIcon, CloseCircleOutline as ClearIcon, StarOutline as StarIconOutline, Star as StarIconFilled, AddCircleOutline as AddIcon, PricetagsOutline as CategoryIcon, FolderOpenOutline as GroupIcon, RemoveCircleOutline as RemoveIcon, ArrowBackOutline as ArrowBackIcon, ListOutline as ListIcon } from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Tag, Group, Category } from '../../types/data';
import { useRouter } from 'vue-router';
import _ from 'lodash';
import { safeCompare, filterValidTags } from '../../utils/sortHelpers';
import { useErrorHandler, ErrorType as ErrorServiceType } from '../../services/ErrorService';
import TagShoppingCartCard from '../../components/tools/TagShoppingCartCard.vue';
import CategoryNavMenu from '../../components/tools/CategoryNavMenu.vue';
import VirtualTagList from '../../components/global/VirtualTagList.vue';

const tagStore = useTagStore();
const router = useRouter();
const message = useMessage();
const settingsStore = useSettingsStore();
const { handleError } = useErrorHandler();

// --- Constants ---
const FAVORITES_KEY = '__FAVORITES__';
const FAVORITES_STORAGE_KEY = 'tagShoppingCartFavorites';
const ALL_TAGS_KEY = '__ALL_TAGS__';

// --- State ---
const selectedTags = ref<Tag[]>([]);
const selectedCategoryId = ref<string | undefined>(undefined);
const editablePromptText = ref<string>('');
const favoriteTagIds = ref<Set<string>>(new Set());
const tagSearchTerm = ref<string>('');
const cartTags = ref<Tag[]>([]);
const cartTagWeights = ref<{[id: string]: number}>({});
const cartTagNotes = ref<{[id: string]: string}>({});
const cartResultText = ref('');

// 添加分页相关变量
const currentPage = ref(1);
const pageSize = ref(50);
const isLoadingMoreTags = ref(false);
const hasMoreTags = computed(() => {
  return paginatedTags.value.length < currentTagsToShow.value.length;
});

// 显示当前分页下的标签
const paginatedTags = computed(() => {
  const start = 0;
  const end = currentPage.value * pageSize.value;
  return currentTagsToShow.value.slice(start, end);
});

// 添加购物车排序功能和显示模式控制
const cartSortMode = ref<'category' | 'alpha' | 'added'>('category');
const cartDisplayMode = ref<'grouped' | 'flat'>('grouped');

// 平铺显示的已选择标签列表（按字母顺序或添加顺序排序）
const sortedSelectedTags = computed(() => {
  let sorted = [...selectedTags.value];
  
  if (cartSortMode.value === 'alpha') {
    sorted.sort(safeCompare);
  }
  // 'added' 模式不需要排序，保持原始添加顺序
  
  return sorted;
});

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
    groupMap.forEach(gData => gData.categories.sort(safeCompare));

    // Sort groups
    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || safeCompare(a.group, b.group));

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
    const allTagsOption = { label: '所有分类', key: ALL_TAGS_KEY, icon: () => h(NIcon, null, { default: () => h(CategoryIcon) }) };

    return [favOption, allTagsOption, ...menuItems];
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
    
    console.log('当前选择的分类ID：', selectedCategoryId.value);
    console.log('标签总数：', tagStore.tags.length);

    // --- Global Search Logic ---
    if (searchTerm) {
        const filteredTags = filterValidTags(tagStore.tags.filter(tag => 
            tag.name?.toLowerCase().includes(searchTerm) || 
            (tag.keyword && tag.keyword.toLowerCase().includes(searchTerm))
        ));
        return filteredTags.sort(safeCompare);
    }

    // --- All Tags option ---
    if (selectedCategoryId.value === ALL_TAGS_KEY) {
        console.log('显示所有分类标签，标签总数：', tagStore.tags.length);
        const validTags = filterValidTags(tagStore.tags);
        return validTags.sort(safeCompare);
    }

    // --- Favorite/Category Logic (Only if search term is empty) ---
    if (selectedCategoryId.value === FAVORITES_KEY) {
        const validFavoriteTags = filterValidTags(favoritedTags.value);
        return validFavoriteTags.sort(safeCompare); // Sort favorites
    }
    
    if (selectedCategoryId.value && !selectedCategoryId.value.startsWith('group-')) {
         // Valid category selected
         const filteredTags = filterValidTags(tagStore.tags.filter(tag => tag.categoryId === selectedCategoryId.value));
         return filteredTags.sort(safeCompare); // Sort category tags
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
            categoryData.tags.sort(safeCompare); 
        });
        const sortedCategoriesArray = Array.from(groupData.categories.values())
            .sort((a, b) => safeCompare(a.category, b.category));
        // Store sorted categories as an array for easier template iteration
        groupData.categories = new Map(sortedCategoriesArray.map(catData => [catData.category.id, catData])); 
    });

    // Sort groups 
    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || safeCompare(a.group, b.group));

    // Add sorted categories array to each group object for template
    sortedGroups.forEach(groupData => {
         (groupData as any).sortedCategories = Array.from(groupData.categories.values())
            .sort((a, b) => safeCompare(a.category, b.category));
    });

    return sortedGroups; 
});

// --- Update selectedTagsString for comma-separated标签内容 only ---
const selectedTagsString = computed(() => {
    return selectedTags.value
        .map(tag => tag.name) // 只显示标签内容
        .join(', ');
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

// 选择中第一个类别的默认初始加载
watch(selectedCategoryId, (newVal, _oldVal) => {
    console.log('监听到 selectedCategoryId 变化:', newVal);
    
    // 如果当前选择为空，选择默认分类
    if (newVal === undefined && categoryMenuOptions.value.length > 0) {
        // 首先选择"所有分类"
        selectedCategoryId.value = ALL_TAGS_KEY;
        console.log('设置默认分类为"所有分类":', ALL_TAGS_KEY);
        return;
    }
    
    // 如果选择了"所有分类"，确认是否有标签数据
    if (newVal === ALL_TAGS_KEY) {
        console.log('选择了"所有分类"，当前标签总数:', tagStore.tags.length);
    }
}, { immediate: true });

// Restore watcher for selectedTags updating editablePromptText
watch(selectedTags, (newTags) => {
    editablePromptText.value = newTags.map(tag => tag.name).join(', ');
}, { deep: true });

// Add call to load favorites on mount
onMounted(() => {
    loadFavorites();
    
    // 移除这里的默认选择，全部由 watch 处理
    
    // 添加滚动加载
    const handleScroll = _.debounce((e) => {
        const scrollbar = document.querySelector('.tags-list-card .n-scrollbar');
        if (!scrollbar || isLoadingMoreTags.value || !hasMoreTags.value) return;
        
        const { scrollTop, scrollHeight, clientHeight } = scrollbar;
        if (scrollHeight - scrollTop - clientHeight < 100) {
            loadMoreTags();
        }
    }, 200);
    
    const scrollbar = document.querySelector('.tags-list-card .n-scrollbar');
    if (scrollbar) {
        scrollbar.addEventListener('scroll', handleScroll);
    }
});

// 添加对标签数据的监听，确保数据加载后重新评估分类选择
watch(() => tagStore.tags.length, (newLength) => {
    console.log('标签数据更新，新的标签总数:', newLength);
    
    // 如果已经选择了"所有分类"但当前没有显示标签，可以尝试重新触发计算
    if (selectedCategoryId.value === ALL_TAGS_KEY && currentTagsToShow.value.length === 0 && newLength > 0) {
        // 尝试重新触发计算
        const currentSelection = selectedCategoryId.value;
        selectedCategoryId.value = undefined;
        setTimeout(() => {
            selectedCategoryId.value = currentSelection;
        }, 0);
    }
});

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

// Function to handle category selection (if needed for filtering/display)
/* // Removed unused handleCategorySelect
const handleCategorySelect = (key: string) => {
  console.log("Category selected:", key);
  // Potentially set a filter or update display based on category
};
*/

// Copy the editable prompt to clipboard
/* // Removed unused copyEditablePrompt
const copyEditablePrompt = () => {
  if (finalPromptTextareaRef.value) {
      navigator.clipboard.writeText(finalPromptTextareaRef.value.textareaElRef.value || '')
          .then(() => message.success('提示词已复制到剪贴板'))
          .catch(err => message.error('复制失败: ' + err));
  } else {
       navigator.clipboard.writeText(promptSegmentsString.value)
          .then(() => message.success('提示词已复制到剪贴板'))
          .catch(err => message.error('复制失败: ' + err));
  }
};
*/

// Copy single tag (e.g., for quick use elsewhere)
/* // Removed unused copySingleTag
const copySingleTag = (tag: Tag) => {
  const textToCopy = tag.keyword || tag.name;
  navigator.clipboard.writeText(textToCopy)
      .then(() => message.success(`标签 "${tag.name}" 已复制`))
      .catch(err => message.error('复制失败: ' + err));
};
*/

// Add all visible tags in the current category/view to the cart
const addAllVisibleTags = () => {
  if (paginatedTags.value.length === 0) {
    message.warning('当前没有可见标签');
    return;
  }

  let addedCount = 0;
  paginatedTags.value.forEach(tag => {
    // 检查标签是否已在购物车中
    if (!selectedTags.value.some(t => t.id === tag.id)) {
      selectedTags.value.push(tag);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    message.success(`已添加 ${addedCount} 个标签到购物车`);
  } else {
    message.info('所有标签已在购物车中');
  }
};

// 添加一个新函数，用于添加当前分类的所有标签
const addAllCategoryTags = () => {
  if (!selectedCategoryId.value || selectedCategoryId.value === FAVORITES_KEY) {
    message.warning('请先选择一个分类');
    return;
  }
  
  // 获取当前分类的所有标签（不只是当前页的）
  const categoryTags = selectedCategoryId.value.startsWith('group-')
    ? [] // 不支持整个组的添加，这会导致添加太多标签
    : tagStore.tags.filter(tag => tag.categoryId === selectedCategoryId.value);
  
  if (categoryTags.length === 0) {
    message.warning('当前分类没有标签');
    return;
  }

  let addedCount = 0;
  categoryTags.forEach(tag => {
    if (!selectedTags.value.some(t => t.id === tag.id)) {
      selectedTags.value.push(tag);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    message.success(`已添加当前分类的 ${addedCount} 个标签到购物车`);
  } else {
    message.info('当前分类的所有标签已在购物车中');
  }
};

// 4. 结果区（支持多种导出格式、自动刷新）
watch([cartTags, cartTagWeights, cartTagNotes], () => {
  // 自动生成结果文本，只显示标签内容
  cartResultText.value = cartTags.value.map(tag => tag.name).join(', ');
}, {deep: true});

// 加载更多标签
const loadMoreTags = async () => {
    isLoadingMoreTags.value = true;
    // 模拟延迟加载，给UI时间刷新
    await new Promise(resolve => setTimeout(resolve, 100));
    currentPage.value++;
    isLoadingMoreTags.value = false;
};

// 监听标签搜索和分类变化，重置分页
watch([tagSearchTerm, selectedCategoryId], () => {
    currentPage.value = 1;
}, { immediate: true });

// 更新购物车排序方式
const updateCartSortMode = (mode: 'category' | 'alpha' | 'added') => {
  cartSortMode.value = mode;
};

// 更新购物车显示模式
const toggleCartDisplayMode = () => {
  cartDisplayMode.value = cartDisplayMode.value === 'grouped' ? 'flat' : 'grouped';
};

</script>

<template>
  <div class="cart-page-header">
    <n-button text circle size="large" class="back-btn" @click="handleBack">
      <n-icon size="24" :component="ArrowBackIcon" />
    </n-button>
  </div>
  <div class="tag-cart-container">
    <h1 class="page-title">标签购物车</h1>
    
    <div class="main-layout">
      <!-- 左侧侧边栏：分类导航 -->
      <category-nav-menu
        v-model:modelValue="selectedCategoryId"
        :favorites-key="FAVORITES_KEY"
        :all-tags-key="ALL_TAGS_KEY"
      >
        <template #actions>
          <div class="category-actions" v-if="selectedCategoryId && !selectedCategoryId.startsWith('group-') && selectedCategoryId !== ALL_TAGS_KEY && selectedCategoryId !== FAVORITES_KEY">
            <n-button size="small" @click="addAllCategoryTags" type="primary" ghost>
              <template #icon><n-icon :component="AddIcon" /></template>
              添加此分类全部
            </n-button>
          </div>
        </template>
      </category-nav-menu>
      
      <!-- 中间面板：可用标签展示 -->
      <div class="middle-panel">
        <!-- 可用标签 -->
        <n-card title="可用标签" class="control-card tags-list-card">
          <template #header-extra>
            <span v-if="currentTagsToShow.length" class="tags-count">
              {{ currentTagsToShow.length }} 个标签
            </span>
          </template>
          
          <!-- 搜索框 -->
          <div class="tags-search-container">
            <n-input 
              v-model:value="tagSearchTerm" 
              placeholder="搜索标签名或关键词..." 
              clearable
              class="search-input"
            />
          </div>
          
          <!-- 虚拟滚动列表 -->
          <virtual-tag-list
            :tags="currentTagsToShow"
            :page-size="pageSize"
            container-selector=".tags-list-card .n-scrollbar"
            @select="toggleTagInCart"
            @load-more="loadMoreTags"
          >
            <template #tags="{ displayedTags, onSelect }">
              <div class="tags-grid">
                <tag-shopping-cart-card
                  v-for="tag in displayedTags"
                  :key="tag.id"
                  :tag="tag"
                  :is-selected="selectedTags.some(selected => selected.id === tag.id)"
                  :is-favorite="favoriteTagIds.has(tag.id)"
                  @toggle="onSelect(tag)"
                  @toggle-favorite="toggleFavorite(tag.id)"
                />
              </div>
            </template>
            
            <template #loader="{ loading }">
              <n-button 
                size="small" 
                @click="loadMoreTags" 
                :loading="loading"
                :disabled="loading"
              >
                {{ loading ? '加载中...' : `加载更多 (${paginatedTags.length}/${currentTagsToShow.length})` }}
              </n-button>
            </template>
          </virtual-tag-list>
        </n-card>
      </div>
      
      <!-- 右侧面板：购物车与结果 -->
      <div class="right-panel">
        <!-- 购物车内容 -->
        <n-card title="购物车内容" class="result-card">
          <template #header-extra>
            <n-space>
              <n-tag v-if="selectedTags.length > 0" type="success" size="small">
                总计: {{ selectedTags.length }}
              </n-tag>
              <n-button size="tiny" @click="addAllVisibleTags" v-if="paginatedTags.length > 0 && !isLoadingMoreTags">
                <template #icon><n-icon :component="AddIcon" /></template>
                添加所有
              </n-button>
            </n-space>
          </template>
          
          <div v-if="selectedTags.length === 0" class="empty-state">
            <n-empty description="从左侧选择标签添加到购物车" style="margin-top: 40px;" />
          </div>
          
          <div v-else>
            <!-- 视图控制和排序选项 -->
            <div class="cart-view-controls">
              <n-space align="center">
                <span class="control-label">显示方式:</span>
                <n-button-group size="small">
                  <n-button 
                    :type="cartDisplayMode === 'grouped' ? 'primary' : 'default'"
                    @click="cartDisplayMode = 'grouped'"
                    size="small"
                  >
                    <template #icon><n-icon :component="GroupIcon" /></template>
                    分组
                  </n-button>
                  <n-button 
                    :type="cartDisplayMode === 'flat' ? 'primary' : 'default'"
                    @click="cartDisplayMode = 'flat'"
                    size="small"
                  >
                    <template #icon><n-icon :component="ListIcon" /></template>
                    平铺
                  </n-button>
                </n-button-group>
              </n-space>
              
              <n-space align="center" v-if="cartDisplayMode === 'flat'">
                <span class="control-label">排序:</span>
                <n-select
                  v-model:value="cartSortMode"
                  :options="[
                    { label: '按添加顺序', value: 'added' },
                    { label: '按字母顺序', value: 'alpha' }
                  ]"
                  size="small"
                  style="width: 110px"
                />
              </n-space>
            </div>
            
            <n-scrollbar style="max-height: min(calc(60vh - 160px), 500px); min-height: 250px;">
              <!-- 分组视图 -->
              <div class="cart-content" v-if="cartDisplayMode === 'grouped'">
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
                        <div class="cart-category-header">
                          {{ categoryData.category.name }}
                          <span class="category-tag-count">({{ categoryData.tags.length }})</span>
                        </div>
                        <div class="cart-items-container">
                          <!-- 购物车标签项 -->
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
              </div>
              
              <!-- 平铺视图 -->
              <div class="flat-cart-content" v-else>
                <div class="cart-items-container">
                  <div 
                    v-for="tag in sortedSelectedTags" 
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
            </n-scrollbar>
            
            <!-- 操作按钮 -->
            <div class="cart-actions">
              <n-space justify="space-between">
                <n-popconfirm @positive-click="clearSelectedTags">
                  <template #trigger>
                    <n-button type="error" secondary>
                      <template #icon><n-icon :component="ClearIcon" /></template>
                      清空购物车
                    </n-button>
                  </template>
                  确定要清空购物车中的所有标签吗？
                </n-popconfirm>
                
                <n-button type="primary" @click="copySelectedTags">
                  <template #icon><n-icon :component="CopyIcon" /></template>
                  复制内容
                </n-button>
              </n-space>
            </div>
          </div>
        </n-card>
        
        <!-- 复制预览 -->
        <n-card title="复制预览" class="result-card" v-if="selectedTags.length > 0">
          <n-input
            v-model:value="selectedTagsString"
            type="textarea"
            readonly
            placeholder="购物车为空"
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
          <div class="preview-actions">
            <n-button type="primary" size="small" @click="copySelectedTags">
              <template #icon><n-icon :component="CopyIcon" /></template>
              复制内容
            </n-button>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局容器样式 */
.tag-cart-container {
  max-width: 1600px; /* 增加最大宽度以适应三栏布局 */
  margin: 0 auto;
  padding: 20px;
}

.page-title {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--n-text-color-1);
}

.cart-page-header {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

/* 主布局 - 三栏结构 */
.main-layout {
  display: grid;
  grid-template-columns: 220px minmax(300px, 1fr) minmax(380px, 1.1fr);
  gap: 16px;
}

/* 左侧侧边栏 */
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

.category-actions {
  padding: 12px 0;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--n-divider-color);
}

/* 中间面板 */
.middle-panel {
  min-width: 0; /* 确保不溢出 */
  display: flex;
  flex-direction: column;
}

.tags-list-card {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.tags-search-container {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
}

/* 右侧面板 */
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0; /* 确保不溢出 */
}

.result-card {
  border-radius: 8px;
}

/* 标签网格 */
.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
  padding: 8px 4px;
}

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

/* 购物车内容样式 */
.cart-category-header {
  font-weight: 500;
  color: var(--n-text-color-2);
  margin-bottom: 8px;
  padding-left: 6px;
  border-left: 3px solid var(--n-primary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-tag-count {
  font-size: 12px;
  color: var(--n-text-color-3);
  font-weight: normal;
}

.cart-items-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.cart-item-card {
  background-color: var(--n-color);
  border: 1px solid var(--n-divider-color);
  border-radius: 8px;
  padding: 6px 28px 6px 8px;
  display: flex;
  align-items: center;
  position: relative;
  transition: background-color 0.2s ease;
  flex: 0 0 calc(33.333% - 6px);
  max-width: calc(33.333% - 6px);
  min-width: 100px;
  box-sizing: border-box;
  overflow: hidden;
}

.cart-item-card:hover {
  background-color: var(--n-color-hover);
}

.cart-item-content {
  width: calc(100% - 20px);
  overflow: hidden;
}

.cart-item-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--n-text-color-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.cart-item-keyword {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.cart-item-remove-button {
  position: absolute;
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
  opacity: 0.6;
  color: var(--n-error-color);
}

.cart-item-card:hover .cart-item-remove-button {
  opacity: 1;
}

.cart-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--n-divider-color);
}

/* 空状态 */
.empty-state {
  height: 300px; 
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 加载提示样式 */
.load-more-container {
  display: flex;
  justify-content: center;
  margin: 16px 0;
  padding: 8px;
}

.tags-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--n-scrollbar-color) transparent;
}

.cart-view-controls {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.control-label {
  font-size: 13px;
  color: var(--n-text-color-2);
}

.flat-cart-content {
  margin-bottom: 16px;
}

.preview-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

/* 响应式布局调整 */
@media (max-width: 1400px) {
  .main-layout {
    grid-template-columns: 200px minmax(280px, 1fr) minmax(350px, 1fr);
  }
}

@media (max-width: 1100px) {
  .main-layout {
    grid-template-columns: 180px 1fr 1fr;
    gap: 12px;
  }
  
  .tags-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .cart-item-card {
    flex: 0 0 calc(50% - 6px);
    max-width: calc(50% - 6px);
  }
}

@media (max-width: 900px) {
  .main-layout {
    grid-template-columns: 160px minmax(250px, 1fr) minmax(250px, 1fr);
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .category-sidebar {
    height: auto;
    max-height: 300px;
    border-right: none;
    padding-right: 0;
    margin-bottom: 16px;
  }
  
  .sidebar-scrollbar {
    height: 220px;
  }
  
  .tags-list-card, 
  .result-card {
    height: auto;
  }
}

@media (max-width: 480px) {
  .cart-item-card {
    flex: 0 0 100%;
    max-width: 100%;
  }
  
  .tag-item-card {
    height: 70px;
  }
}
</style> 