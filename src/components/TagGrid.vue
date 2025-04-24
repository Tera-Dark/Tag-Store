<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick, onUnmounted } from 'vue';
import { NGrid, NGi, NText, NEmpty, useMessage, useDialog, NButton, NSpace, NCheckbox, NFlex, NButtonGroup, NSpin } from 'naive-ui';
import { useTagStore } from '../stores/tagStore';
import TagCard from './TagCard.vue';
import TagDialog from './dialogs/TagDialog.vue';
import BatchMoveDialog from './dialogs/BatchMoveDialog.vue';
import type { Tag } from '../types/data';

const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

const allFilteredTags = computed(() => tagStore.filteredTags);
const isLoading = computed(() => tagStore.isLoading);

// 每次显示的标签数量
const PAGE_SIZE = 20;
// 已加载的标签数量
const displayCount = ref(PAGE_SIZE);
// 是否正在加载更多
const loadingMore = ref(false);

// 当前显示的标签
const displayedTags = computed(() => {
  return allFilteredTags.value.slice(0, displayCount.value);
});

// 是否还有更多标签可加载
const hasMoreTags = computed(() => {
  return displayCount.value < allFilteredTags.value.length;
});

// 加载更多标签
const loadMoreTags = async () => {
  if (loadingMore.value || !hasMoreTags.value) return;
  
  loadingMore.value = true;
  console.log('加载更多标签，当前显示:', displayCount.value, '总数:', allFilteredTags.value.length);
  
  // 使用较短的延迟以提高响应速度
  setTimeout(() => {
    displayCount.value += PAGE_SIZE;
    loadingMore.value = false;
    console.log('加载完成，现在显示:', displayCount.value, '总数:', allFilteredTags.value.length);
  }, 200);
};

// 获取父容器元素（.content-body）
const getScrollContainer = (): HTMLElement => {
  // 尝试获取.content-body容器
  const container = document.querySelector('.content-body') as HTMLElement;
  if (container) {
    console.log('找到滚动容器: .content-body');
    return container;
  }
  console.warn('未找到.content-body容器，将使用document.documentElement');
  return document.documentElement;
};

// 使用IntersectionObserver API检测底部元素是否可见
const loaderRef = ref<HTMLElement | null>(null);
const gridContainerRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const setupIntersectionObserver = () => {
  // 如果浏览器支持IntersectionObserver
  if ('IntersectionObserver' in window) {
    // 获取滚动容器
    const scrollContainer = getScrollContainer();
    
    // 创建一个新的观察器实例，指定root为滚动容器
    observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      // 如果底部元素进入视口，且有更多标签可加载
      if (entry.isIntersecting && hasMoreTags.value && !loadingMore.value) {
        console.log('底部元素可见，触发加载');
        loadMoreTags();
      }
    }, {
      // root设置为滚动容器
      root: scrollContainer === document.documentElement ? null : scrollContainer,
      // 提前200px触发
      rootMargin: '200px 0px',
      // threshold: 0 表示目标元素的任何部分进入视口就触发
      threshold: 0
    });

    // 确保DOM元素已经渲染
    nextTick(() => {
      // 如果ref引用的元素存在，开始观察它
      if (loaderRef.value && observer) {
        observer.observe(loaderRef.value);
        console.log('开始观察底部加载元素', loaderRef.value);
      } else {
        console.warn('未找到loader元素或observer未初始化');
      }
    });
  } else {
    // 如果浏览器不支持IntersectionObserver，回退到传统的滚动监听方法
    console.log('浏览器不支持IntersectionObserver，使用传统的滚动监听');
    setupScrollListener();
  }
};

// 传统的滚动监听方法(作为备用)
const setupScrollListener = () => {
  // 获取滚动容器
  const scrollContainer = getScrollContainer();
  
  const handleScroll = () => {
    if (!hasMoreTags.value || loadingMore.value) return;
    
    // 获取容器的滚动信息
    const scrollHeight = scrollContainer.scrollHeight;
    const scrollTop = scrollContainer.scrollTop;
    const clientHeight = scrollContainer.clientHeight;
    
    // 当滚动到距离底部50px时就开始加载更多
    if (scrollHeight - scrollTop - clientHeight < 50) {
      console.log('检测到滚动到底部，触发加载', {
        scrollHeight,
        scrollTop,
        clientHeight,
        distance: scrollHeight - scrollTop - clientHeight
      });
      loadMoreTags();
    }
  };
  
  // 添加滚动事件监听到容器
  scrollContainer.addEventListener('scroll', handleScroll);
  
  // 组件卸载时移除监听器
  onUnmounted(() => {
    scrollContainer.removeEventListener('scroll', handleScroll);
  });
};

// 手动触发检查是否需要加载更多内容
const checkIfNeedMoreContent = () => {
  if (!hasMoreTags.value || loadingMore.value) return;
  
  // 获取滚动容器
  const scrollContainer = getScrollContainer();
  
  // 检查内容高度是否足够填满滚动容器
  const scrollHeight = scrollContainer.scrollHeight;
  const clientHeight = scrollContainer.clientHeight;
  
  console.log('检查是否需要更多内容:', {
    scrollHeight,
    clientHeight,
    hasMoreTags: hasMoreTags.value
  });
  
  // 如果内容高度小于等于容器高度，且还有更多内容可加载，则加载更多
  if (scrollHeight <= clientHeight && hasMoreTags.value) {
    console.log('内容不足以填满容器，自动加载更多');
    loadMoreTags();
  }
};

// 组件挂载后设置观察器
onMounted(() => {
  console.log('TagGrid组件已挂载');
  setupIntersectionObserver();
  
  // 延迟一点，等待布局稳定后检查是否需要加载更多
  setTimeout(() => {
    checkIfNeedMoreContent();
  }, 300);
});

// 组件卸载时清理观察器
onUnmounted(() => {
  if (observer) {
    observer.disconnect();
    console.log('断开观察器连接');
  }
});

// 监听标签过滤条件变化，重置加载计数并重新设置观察器
watch([() => tagStore.filterCategoryId, () => tagStore.searchTerm], () => {
  displayCount.value = PAGE_SIZE;
  
  // 重新连接观察器
  nextTick(() => {
    if (observer) {
      observer.disconnect();
      if (loaderRef.value) {
        observer.observe(loaderRef.value);
        console.log('过滤条件变化，重新连接观察器');
      }
    }
    
    // 延迟一点检查内容是否足够
    setTimeout(() => {
      checkIfNeedMoreContent();
    }, 300);
  });
}, { immediate: true });

// --- Selection State ---
const selectedTagIds = ref<Set<string>>(new Set());

// Computed property to check if any tag is selected
const hasSelection = computed(() => selectedTagIds.value.size > 0);

// --- Computed properties for Select All checkbox state ---
const isAllSelected = computed(() => {
    const currentTagIds = displayedTags.value.map(tag => tag.id);
    return currentTagIds.length > 0 && currentTagIds.every(id => selectedTagIds.value.has(id));
});

const isIndeterminate = computed(() => {
    return hasSelection.value && !isAllSelected.value;
});

// --- Handle Selection Change from TagCard ---
const handleSelectionChange = (payload: { id: string; selected: boolean }) => {
    const newSet = new Set(selectedTagIds.value); // Clone to ensure reactivity
    if (payload.selected) {
        newSet.add(payload.id);
    } else {
        newSet.delete(payload.id);
    }
    selectedTagIds.value = newSet;
};

const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
        // Select all currently displayed tags
        const currentTagIds = displayedTags.value.map(tag => tag.id);
        selectedTagIds.value = new Set(currentTagIds);
    } else {
        // Deselect all
        selectedTagIds.value.clear();
    }
};

// Watch for changes in filteredTags or filterCategoryId to potentially clear selection
watch(() => tagStore.filterCategoryId, () => {
    selectedTagIds.value.clear(); // Clear selection when category changes
});
watch(displayedTags, () => {
    // Optional: More complex logic could try to preserve selection 
    // if the same tags are still present after search term change, but clearing is simpler.
    if (tagStore.searchTerm) { // Clear selection if search term is active causing filter changes
       // We might not always want to clear on search, depends on UX preference.
       // Let's clear for now for simplicity.
        selectedTagIds.value.clear();
    }
}, { deep: true }); // Deep watch might be needed if tag properties change affecting filter

// --- Dialog State (Add/Edit) ---
const showTagDialog = ref(false);
const tagDialogMode = ref<'add' | 'edit'>('add');
const tagToEdit = ref<Tag | null>(null);
const initialCategoryId = ref<string | null>(null); // For adding tag to specific category

// --- Dialog Actions (Add/Edit) ---
const handleOpenEditDialog = (tag: Tag) => {
  tagDialogMode.value = 'edit';
  tagToEdit.value = tag;
  initialCategoryId.value = tag.categoryId || null;
  showTagDialog.value = true;
};

const handleDialogSubmit = async (data: { mode: 'add' | 'edit'; formData: Omit<Tag, 'id'>; tagId?: string }) => {
  try {
    if (data.mode === 'add') {
      await tagStore.addTag(data.formData);
      message.success('标签添加成功');
    } else if (data.mode === 'edit' && data.tagId) {
      await tagStore.updateTag(data.tagId, data.formData);
      message.success('标签更新成功');
    }
    showTagDialog.value = false; // Close dialog on success
  } catch (error: any) {
    message.error(`操作失败: ${error.message}`);
  }
};

// --- Single Delete Action ---
const handleDeleteTag = (tag: Tag) => {
   // Ensure tag is not selected before deleting individually
   selectedTagIds.value.delete(tag.id);
   dialog.warning({
    title: '确认删除',
    content: `确定要删除标签 "${tag.name}" 吗？此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await tagStore.deleteTag(tag.id);
        message.success(`标签 "${tag.name}" 已删除`);
      } catch (error: any) { 
        message.error(`删除失败: ${error.message}`);
      }
    },
  });
};

// --- Loading state for batch ops ---
const isBatchProcessing = ref(false);

// --- Batch Actions ---
const handleBatchDelete = () => {
    if (!hasSelection.value) return;
    const idsToDelete = Array.from(selectedTagIds.value);
    dialog.warning({
        title: '确认批量删除',
        content: `确定要删除选中的 ${idsToDelete.length} 个标签吗？此操作不可撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            isBatchProcessing.value = true; // Start loading
            try {
                await tagStore.batchDeleteTags(idsToDelete);
                message.success(`已删除 ${idsToDelete.length} 个标签`);
                selectedTagIds.value.clear(); // Clear selection after successful delete
            } catch (error: any) {
                message.error(`批量删除失败: ${error.message}`);
            } finally {
                isBatchProcessing.value = false; // Stop loading
            }
        },
    });
};

// --- Batch Move State & Actions ---
const showBatchMoveDialog = ref(false);

const handleBatchMove = () => {
    if (!hasSelection.value) return;
    showBatchMoveDialog.value = true;
};

// 手动加载更多标签
const manualLoadMore = () => {
  if (loadingMore.value || !hasMoreTags.value) return;
  console.log('手动加载更多标签');
  loadMoreTags();
};

const copySelectedTagNames = async () => {
  const names = displayedTags.value
    .filter(tag => selectedTagIds.value.has(tag.id))
    .map(tag => tag.name);
  if (names.length === 0) {
    message.warning('请先选择要复制的标签');
    return;
  }
  const text = names.join(',');
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制: ' + text);
  } catch {
    message.error('复制失败');
  }
};

</script>

<template>
  <div class="tag-grid-container" ref="gridContainerRef">
    <!-- Action area - Use NFlex for better responsive controls -->
    <n-flex class="controls-section" justify="space-between" align="center" :wrap="true">
      <!-- Left side controls -->
      <n-space align="center" :size="12" :wrap-item="false" style="flex-shrink: 0;">
        <div class="select-all-checkbox">
          <n-checkbox 
            :checked="isAllSelected" 
            :indeterminate="isIndeterminate"
            @update:checked="handleSelectAllChange" 
          />
        </div>
        <n-text v-if="!hasSelection" class="tags-count">
            {{ allFilteredTags.length }} 个标签 (已显示 {{ displayedTags.length }} 个)
        </n-text>
        <n-text v-else class="tags-count selected-text">
            已选择 {{ selectedTagIds.size }} 个标签
        </n-text>
      </n-space>
      
      <!-- Right side controls -->
      <n-space align="center" :size="8" :wrap-item="false" style="flex-shrink: 0; margin-top: 4px;">
        <n-button v-if="hasSelection" size="small" type="primary" @click="copySelectedTagNames">复制所选标签名</n-button>
        <n-button-group v-if="hasSelection" size="small">
          <n-button type="warning" 
              @click="handleBatchDelete" 
              :loading="isBatchProcessing"
              :disabled="!hasSelection">
            删除选中
          </n-button>
          <n-button type="primary" 
              @click="handleBatchMove"  
              :loading="isBatchProcessing"
              :disabled="!hasSelection">
            移动选中
          </n-button>
        </n-button-group>
      </n-space>
    </n-flex>

    <div class="grid-wrapper" :class="{'has-more': hasMoreTags}">
      <!-- Wrap Grid/Empty state in NSpin -->
      <n-spin :show="isLoading">
        <n-empty v-if="!isLoading && allFilteredTags.length === 0" description="没有找到标签" style="margin-top: 40px;">
          <template #extra>
            <n-button size="small" @click="() => { /* TODO: Signal parent or handle context */ }" :disabled="!tagStore.filterCategoryId">
              在此分类下创建标签
            </n-button>
          </template>
        </n-empty>
      
        <!-- 使用更均匀的网格布局 -->
        <n-grid 
          v-if="!isLoading && displayedTags.length > 0" 
          :x-gap="16" 
          :y-gap="16" 
          cols="1 s:2 m:3 l:4 xl:5 2xl:6"
          responsive="screen"
        >
          <n-gi v-for="tag in displayedTags" :key="tag.id">
            <TagCard 
              :tag="tag" 
              :selected="selectedTagIds.has(tag.id)"
              @edit="handleOpenEditDialog"
              @delete="handleDeleteTag"
              @selection-change="handleSelectionChange"
            />
          </n-gi>
        </n-grid>
        
        <!-- Optional: Placeholder or slightly different view while loading -->
        <div v-if="isLoading" style="min-height: 200px; display: flex; align-items: center; justify-content: center;">
          <!-- 提供足够高度确保加载动画显示美观 -->
        </div>
      </n-spin>
    </div>

    <!-- 分页区域 (滚动加载更多) -->
    <div ref="loaderRef" class="loader-area" v-show="displayedTags.length > 0">
      <n-space vertical size="small" style="align-items: center;">
        <n-spin size="small" :show="loadingMore">
          <div class="loading-indicator" v-if="hasMoreTags">
            <n-text class="more-tags" v-if="!loadingMore">
              {{ displayedTags.length }}/{{ allFilteredTags.length }}
            </n-text>
            <n-text class="more-tags" v-else>
              正在加载中...
            </n-text>
          </div>
          <n-text v-else class="all-loaded">
            已加载全部 {{ allFilteredTags.length }} 个标签
          </n-text>
        </n-spin>
        <n-button 
          v-if="hasMoreTags" 
          @click="manualLoadMore" 
          size="small" 
          type="primary"
          ghost
          :loading="loadingMore">
          点击加载更多
        </n-button>
      </n-space>
    </div>

     <!-- Tag Add/Edit Dialog -->
    <TagDialog
      v-model:show="showTagDialog"
      :mode="tagDialogMode"
      :tag-to-edit="tagToEdit"
      :initial-category-id="initialCategoryId"
      @submit="handleDialogSubmit"
    />
    
    <!-- Batch Move Dialog -->
    <BatchMoveDialog 
        v-model:show="showBatchMoveDialog" 
      :tag-ids="Array.from(selectedTagIds)" 
      @close="showBatchMoveDialog = false"
    />

  </div>
</template>

<style scoped>
.tag-grid-container {
  padding: 20px;
  height: 100%; 
  display: flex; 
  flex-direction: column;
}

.controls-section {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color);
  margin-bottom: 16px;
  flex-wrap: wrap;
  /* NFlex handles layout now */
}

.grid-wrapper {
  /* flex: 1;  // 移除flex:1，避免内部自滚动 */
  /* overflow: auto; // 移除overflow，交由外部.content-body滚动 */
  position: relative;
  padding-bottom: 16px;
}

.n-grid {
  width: 100%;
}

.tags-count {
  font-size: 0.85rem;
  color: var(--n-text-color-2);
}

.selected-text {
  color: var(--primary-color);
  font-weight: 500;
}

.select-all-checkbox {
  margin-right: 8px;
}

.loader-area {
  margin-top: 0px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0px 0 8px 0;
  text-align: center;
  min-height: 36px;
  width: 100%;
}

.loading-indicator {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 12px;
  background: var(--n-color-hover);
  transition: all 0.3s ease;
}

.more-tags, .all-loaded {
  color: var(--n-text-color-3);
  font-size: 0.9rem;
}

/* 确保在暗色模式下的适配 */
:global(.n-theme-dark) .controls-section {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 添加平滑滚动效果 */
.grid-wrapper {
  scroll-behavior: smooth;
}

/* 响应式处理 */
@media (max-width: 768px) {
  .controls-section {
    padding-bottom: 8px;
    margin-bottom: 12px;
    flex-direction: column;
    gap: 8px;
  }
}

/* 添加一个渐入效果 */
.n-gi {
  animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 添加一个渐变指示器在底部，提示用户继续滚动 */
.grid-wrapper::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(to top, var(--n-color), transparent);
  opacity: 0.2;
  pointer-events: none;
  display: none;
}

.grid-wrapper.has-more::after {
  display: block;
}
</style> 