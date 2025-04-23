<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  NSelect, 
  NSpace, 
  NIcon, 
  NButton, 
  NBadge, 
  NDivider,
  NTooltip, 
  useMessage
} from 'naive-ui';
import { useTagStore } from '../../stores/tagStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { 
  AlbumsOutline as CategoryIcon, 
  PricetagOutline as TagIcon, 
  LibraryOutline as LibraryIcon,
  AppsOutline as SwitcherIcon,
  EllipsisHorizontalOutline as MoreIcon
} from '@vicons/ionicons5';
import LibraryManagerDialog from '../dialogs/LibraryManagerDialog.vue';

const tagStore = useTagStore();
const libraryStore = useLibraryStore();
const settingsStore = useSettingsStore();
const message = useMessage();
const isHovering = ref(false);
const isCompact = ref(false);
const isSwitching = ref(false);
const showLibraryManager = ref(false); // 显示标签库管理对话框

// 自动检测是否需要使用紧凑模式
const checkCompactMode = () => {
  // 如果窗口宽度较小或有其他条件需要紧凑显示
  isCompact.value = window.innerWidth < 768;
};

// 监听窗口大小变化
onMounted(() => {
  checkCompactMode();
  window.addEventListener('resize', checkCompactMode);
  
  // 不再由此组件负责加载和创建用户库
  // loadUserLibraries(); 
});

// Compute display data
const categoryCount = computed(() => tagStore.categories.length);
const tagCount = computed(() => tagStore.tags.length);

// 计算库的总数
const libraryCount = computed(() => libraryStore.libraries.length);

// 美化库选项的显示
const libraryOptions = computed(() => {
    return libraryStore.libraries.map(lib => ({
        label: lib.name,
        value: lib.id,
        // 可以添加更多元数据
    }));
});

// 主题相关变量 - 从主题中获取强调色
const isDarkTheme = computed(() => {
  return settingsStore.themeMode === 'dark' || 
    (settingsStore.themeMode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
});

// Handler for switching libraries
const handleLibraryChange = async (value: string) => {
    console.log('Switching library to:', value);
    if (!value) return;
    
    try {
        isSwitching.value = true;
        await libraryStore.switchLibrary(value);
        message.success(`已切换到 ${libraryStore.activeLibrary?.name || ''}`);
    } catch (error) {
        console.error("Failed to switch library:", error);
        message.error('切换标签库失败');
    } finally {
        isSwitching.value = false;
    }
};

// 管理库按钮功能
const showManageButton = true; // 启用管理按钮

const handleManageLibrary = () => {
  // 打开标签库管理对话框
  showLibraryManager.value = true;
};

</script>

<template>
  <n-space 
    align="center" 
    :wrap-item="false" 
    :size="isCompact ? 6 : 10"
    class="library-switcher"
    :class="{ 
      'compact-mode': isCompact, 
      'dark-theme': isDarkTheme,
      'hovering': isHovering,
      'switching': isSwitching
    }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
  > 
    <!-- 库切换图标和选择器 -->
    <n-tooltip trigger="hover" placement="bottom" :delay="500">
      <template #trigger>
        <div class="icon-container">
          <n-icon 
            :component="SwitcherIcon" 
            size="18" 
            class="switcher-icon" 
            :class="{ 'icon-active': isHovering }"
          />
        </div>
      </template>
      切换标签库
    </n-tooltip>
    
    <div class="select-wrapper">
      <n-select 
          :value="libraryStore.activeLibraryId" 
          :options="libraryOptions" 
          size="small" 
          filterable
          clearable
          :consistent-menu-width="false"
          @update:value="handleLibraryChange"
          class="library-select"
          :class="{ 'compact-select': isCompact }"
          placeholder="选择标签库"
          title="切换标签库"
          :loading="isSwitching"
      >
        <template #empty>
          <div class="empty-select">暂无标签库</div>
        </template>
      </n-select>
    </div>

    <!-- 分隔线 -->
    <n-divider vertical class="divider" />

    <!-- 统计区域 -->
    <n-space align="center" :size="8" :wrap-item="false" class="info-section">
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <div class="stat-item">
            <n-badge :value="libraryCount" :max="99" :show-zero="true" type="info" class="stat-badge library-badge">
              <n-icon :component="LibraryIcon" size="16" class="stat-icon" />
            </n-badge>
          </div>
        </template>
        标签库总数
      </n-tooltip>
      
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <div class="stat-item">
            <n-badge :value="categoryCount" :max="99" :show-zero="true" class="stat-badge">
              <n-icon :component="CategoryIcon" size="16" class="stat-icon" />
            </n-badge>
          </div>
        </template>
        分类数量
      </n-tooltip>
      
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <div class="stat-item">
            <n-badge :value="tagCount" :max="999" :show-zero="true" class="stat-badge">
              <n-icon :component="TagIcon" size="16" class="stat-icon" />
            </n-badge>
          </div>
        </template>
        标签数量
      </n-tooltip>
    </n-space>

    <!-- 管理按钮 -->
    <template v-if="showManageButton">
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <div class="manage-btn-container">
            <n-button text size="small" class="manage-btn" @click="handleManageLibrary">
              <template #icon>
                <n-icon :component="MoreIcon" size="18" />
              </template>
            </n-button>
          </div>
        </template>
        管理标签库
      </n-tooltip>
    </template>

  </n-space>
  
  <!-- 标签库管理对话框 -->
  <LibraryManagerDialog v-model:show="showLibraryManager" />
</template>

<style scoped>
.library-switcher {
  background-color: var(--n-card-color);
  border-radius: 8px;
  padding: 6px 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  width: auto;
  max-width: 100%;
  overflow: hidden;
  position: relative;
  border: 1px solid transparent;
}

.library-switcher.hovering {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
  border-color: var(--n-border-color);
}

.dark-theme.library-switcher.hovering {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.library-switcher.switching {
  background-image: linear-gradient(90deg, 
    var(--n-card-color) 0%, 
    rgba(var(--n-primary-color-rgb), 0.05) 50%, 
    var(--n-card-color) 100%);
  background-size: 200% 100%;
  animation: shine 1.5s infinite;
}

@keyframes shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.select-wrapper {
  flex: 1;
  min-width: 0; /* 重要：允许子元素缩小到小于内容大小 */
  max-width: 300px;
}

.library-select {
  min-width: 140px;
  width: 100%;
  transition: all 0.2s ease;
}

.compact-mode {
  padding: 4px 8px;
}

.compact-select {
  min-width: 100px;
}

.icon-container, .stat-item, .manage-btn-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.icon-container:hover, .stat-item:hover, .manage-btn-container:hover {
  background-color: rgba(var(--n-primary-color-rgb), 0.08);
}

.stat-badge {
  margin: 0;
}

.library-badge :deep(.n-badge-sup) {
  background-color: var(--n-info-color);
}

.stat-badge :deep(.n-badge-sup) {
  font-size: 10px;
  padding: 0 4px;
  height: 16px;
  line-height: 16px;
  border-radius: 8px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-item:hover .stat-badge :deep(.n-badge-sup) {
  transform: scale(1.1);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
}

.dark-theme .stat-badge :deep(.n-badge-sup) {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.stat-icon {
  transition: transform 0.2s ease, color 0.2s ease;
}

.stat-item:hover .stat-icon {
  transform: scale(1.15);
  color: var(--n-primary-color);
}

.info-section {
  margin-left: 4px;
  flex-shrink: 0;
}

.switcher-icon {
  color: var(--n-text-color-disabled);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.icon-active {
  color: var(--n-primary-color);
  transform: rotate(180deg);
}

.manage-btn {
  opacity: 0.7;
  transition: opacity 0.2s ease, transform 0.2s ease;
  flex-shrink: 0;
}

.manage-btn:hover {
  opacity: 1;
  transform: rotate(90deg);
}

.divider {
  height: 18px;
  flex-shrink: 0;
  opacity: 0.6;
}

.empty-select {
  padding: 8px;
  text-align: center;
  color: var(--n-text-color-disabled);
  font-style: italic;
}

/* 媒体查询 - 为小屏幕提供更紧凑的布局 */
@media (max-width: 768px) {
  .library-switcher {
    padding: 4px 8px;
  }
  
  .library-select {
    min-width: 100px;
  }
  
  .divider {
    height: 16px;
    margin: 0 4px;
  }
}
</style> 