<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue';
import type { Tag } from '../../types/data';

const props = defineProps<{
  tags: Tag[];                 // 要显示的标签数组
  pageSize?: number;           // 每页显示数量
  loadThreshold?: number;      // 触发加载的阈值
  containerSelector?: string;  // 滚动容器选择器
}>();

const emit = defineEmits<{
  (e: 'select', tag: Tag): void;
  (e: 'loadMore'): void;
}>();

// 默认值
const PAGE_SIZE = props.pageSize || 50;
const LOAD_THRESHOLD = props.loadThreshold || 100;

// 状态
const displayCount = ref(PAGE_SIZE);
const loadingMore = ref(false);
const observer = ref<IntersectionObserver | null>(null);
const loaderRef = ref<HTMLElement | null>(null);

// 计算显示的标签
const displayedTags = computed(() => {
  return props.tags.slice(0, displayCount.value);
});

// 是否还有更多标签
const hasMoreTags = computed(() => {
  return displayCount.value < props.tags.length;
});

// 设置交叉观察器观察加载触发元素
const setupIntersectionObserver = () => {
  if ('IntersectionObserver' in window) {
    observer.value = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMoreTags.value && !loadingMore.value) {
        loadMoreTags();
      }
    }, { 
      threshold: 0.1,
      rootMargin: '100px' 
    });
    
    if (loaderRef.value) {
      observer.value.observe(loaderRef.value);
    }
  }
};

// 加载更多标签
const loadMoreTags = async () => {
  if (loadingMore.value || !hasMoreTags.value) return;
  
  loadingMore.value = true;
  
  // 模拟异步加载
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 增加显示数量
  displayCount.value = Math.min(
    displayCount.value + PAGE_SIZE,
    props.tags.length
  );
  
  loadingMore.value = false;
  emit('loadMore');
};

// 检查是否需要更多内容填充容器
const checkIfNeedMoreContent = () => {
  if (!hasMoreTags.value || loadingMore.value) return;
  
  // 获取滚动容器
  const container = document.querySelector(props.containerSelector || '.virtual-tag-list-container');
  if (!container) return;
  
  // 如果内容高度小于容器高度，自动加载更多
  if (container.scrollHeight <= container.clientHeight && hasMoreTags.value) {
    loadMoreTags();
  }
};

// 重置显示
const resetDisplay = () => {
  displayCount.value = PAGE_SIZE;
  
  // 重新连接观察器
  nextTick(() => {
    if (observer.value) {
      observer.value.disconnect();
      if (loaderRef.value) {
        observer.value.observe(loaderRef.value);
      }
    }
    
    // 检查内容是否足够
    setTimeout(checkIfNeedMoreContent, 300);
  });
};

// 生命周期钩子
onMounted(() => {
  setupIntersectionObserver();
  setTimeout(checkIfNeedMoreContent, 300);
});

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
});

// 当标签列表改变时重置
watch(() => props.tags, resetDisplay, { deep: true });

// 选择标签
const handleTagSelect = (tag: Tag) => {
  emit('select', tag);
};
</script>

<template>
  <div class="virtual-tag-list-container">
    <slot
      name="tags"
      :displayed-tags="displayedTags"
      :on-select="handleTagSelect"
    ></slot>
    
    <div 
      v-if="hasMoreTags"
      ref="loaderRef"
      class="loader-trigger"
    >
      <slot name="loader" :loading="loadingMore">
        <div class="default-loader">
          {{ loadingMore ? '加载中...' : '滚动加载更多' }}
        </div>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.virtual-tag-list-container {
  overflow: auto;
  min-height: 200px;
}

.loader-trigger {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px 0;
}

.default-loader {
  color: var(--n-text-color-3);
  font-size: 14px;
}
</style> 