<script setup lang="ts">
import { ref, computed } from 'vue';
import { NLayout, NLayoutSider, NLayoutContent, NSelect, NButton, NIcon, NSpace, useDialog, NTooltip, NInput } from 'naive-ui';
import { 
  SettingsOutline as ManageIcon, 
  AddOutline as AddIcon, 
  SearchOutline as SearchIcon,
  ChevronBackOutline as CollapseIcon
} from '@vicons/ionicons5';
import CategoryList from '../components/CategoryList.vue';
import TagGrid from '../components/TagGrid.vue';
import LibraryManagerDialog from '../components/dialogs/LibraryManagerDialog.vue';
import CategoryDialog from '../components/dialogs/CategoryDialog.vue';
import { useLibraryStore } from '../stores/libraryStore';
import { useTagStore } from '../stores/tagStore';
import { useSettingsStore } from '../stores/settingsStore';

const libraryStore = useLibraryStore();
const tagStore = useTagStore();
const settingsStore = useSettingsStore();
const dialog = useDialog();

// 搜索相关状态
const searchValue = ref(tagStore.searchTerm);

// 处理搜索输入
const handleSearchInput = (value: string) => {
  searchValue.value = value;
  tagStore.updateSearchTerm(value);
};

// 清除搜索
const clearSearch = () => {
  searchValue.value = '';
  tagStore.updateSearchTerm('');
};

// State for library management
const showLibraryManager = ref(false);

// State for Category Add Dialog
const showCategoryDialog = ref(false);

// Library options
const libraryOptions = computed(() => 
  libraryStore.libraries.map(lib => ({ label: lib.name, value: lib.id }))
);

// Library switch handler
const handleLibrarySwitch = (libraryId: string | null) => {
  if (libraryId) {
    libraryStore.switchLibrary(libraryId);
  }
};

// State for the inner sider (Category List)
const categorySiderCollapsed = ref(false);

// Open Add Category Dialog 
const handleOpenAddCategoryDialog = () => {
    showCategoryDialog.value = true;
};

// Handle Category Dialog Submission
const handleCategoryDialogSubmit = () => {
  showCategoryDialog.value = false; 
};

</script>

<template>
  <n-layout has-sider style="height: 100%;">
    <!-- 侧边栏 -->
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      :collapsed="categorySiderCollapsed"
      :show-trigger="false"
      content-style="display: flex; flex-direction: column; height: 100%; padding: 0; overflow: hidden;" 
      :style="{ 
          height: '100%', 
          backgroundColor: settingsStore.naiveThemeOverrides.Layout?.siderColor || 'var(--card-color)', 
          borderRight: `1px solid ${settingsStore.naiveThemeOverrides.Layout?.siderBorderColor || 'var(--n-border-color)'}` 
      }" 
    >
      <!-- 顶部区域 - 库选择和操作按钮 -->
      <div class="sider-header">
        <!-- 展开时显示的内容 -->
        <n-space vertical size="small" v-if="!categorySiderCollapsed">
          <n-select 
              :value="libraryStore.activeLibraryId" 
              :options="libraryOptions"
              :disabled="libraryStore.isLoading || libraryStore.libraries.length === 0" 
              @update:value="handleLibrarySwitch"
              placeholder="选择标签库"
              size="small" 
          />
          <n-button block type="primary" size="small" @click="handleOpenAddCategoryDialog">
              <template #icon><n-icon :component="AddIcon" /></template>
              添加分类
          </n-button>
          <n-button block secondary size="small" @click="showLibraryManager = true" :disabled="libraryStore.isLoading">
              <template #icon><n-icon :component="ManageIcon" /></template>
              管理标签库
          </n-button>
        </n-space>
        
        <!-- 收起时显示的图标 -->
        <n-space vertical size="small" v-else>
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <n-button circle type="primary" ghost size="small" @click="handleOpenAddCategoryDialog">
                <template #icon><n-icon :component="AddIcon" /></template>
              </n-button>
            </template>
            添加分类
          </n-tooltip>
          <n-tooltip placement="right" trigger="hover">
            <template #trigger>
              <n-button circle secondary ghost size="small" @click="showLibraryManager = true" :disabled="libraryStore.isLoading">
                <template #icon><n-icon :component="ManageIcon" /></template>
              </n-button>
            </template>
            管理标签库
          </n-tooltip>
        </n-space>
      </div>

      <!-- 分类列表区域 - 中间部分 -->
      <div class="category-list-container">
        <CategoryList />
      </div>
      
      <!-- 底部收起/展开按钮 -->
      <div class="sider-footer">
        <n-button
          circle
          quaternary
          size="small"
          @click="categorySiderCollapsed = !categorySiderCollapsed"
          class="collapse-button"
          :class="{ 'is-collapsed': categorySiderCollapsed }"
        >
          <template #icon>
            <n-icon :component="CollapseIcon" />
          </template>
        </n-button>
      </div>
    </n-layout-sider>

    <!-- 主内容区域 -->
    <n-layout-content content-style="height: 100%;">
      <!-- 顶部搜索栏 -->
      <div class="content-header">
        <div class="header-title">标签管理</div>
        <div class="search-container">
          <n-input
            v-model:value="searchValue"
            placeholder="搜索标签..."
            clearable
            @update:value="handleSearchInput"
            @clear="clearSearch"
            class="search-input"
          >
            <template #prefix>
              <n-icon :component="SearchIcon" class="search-icon" />
            </template>
          </n-input>
        </div>
      </div>
      
      <!-- 标签网格 -->
      <div class="content-body">
        <TagGrid />
      </div>
    </n-layout-content>

    <!-- 对话框 -->
    <LibraryManagerDialog v-model:show="showLibraryManager" />
    <CategoryDialog
      v-model:show="showCategoryDialog"
      mode="add" 
      @submit="handleCategoryDialogSubmit" 
    />

  </n-layout>
</template>

<style scoped>
.n-layout-sider {
  transition: background-color 0.3s var(--n-bezier);
  position: relative;
}

.sider-header {
  padding: 12px;
  border-bottom: 1px solid var(--n-divider-color);
  flex-shrink: 0;
}

.category-list-container {
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.sider-footer {
  padding: 12px;
  border-top: 1px solid var(--n-divider-color);
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.collapse-button {
  transition: transform 0.3s var(--n-bezier);
}

.collapse-button.is-collapsed {
  transform: rotate(180deg);
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--n-divider-color);
}

.header-title {
  font-size: 18px;
  font-weight: 500;
  color: var(--n-text-color);
}

.search-container {
  width: 300px;
}

.search-input {
  transition: all 0.3s;
}

.search-input:hover {
  box-shadow: 0 0 0 2px rgba(var(--n-primary-color-rgb), 0.1);
}

.search-icon {
  color: var(--n-text-color-3);
}

.content-body {
  height: calc(100% - 65px);
  overflow: hidden;
}

/* 暗色主题适配 */
:global(.n-theme-dark) .sider-header,
:global(.n-theme-dark) .sider-footer {
  border-color: rgba(255, 255, 255, 0.09);
}

:global(.n-theme-dark) .content-header {
  border-color: rgba(255, 255, 255, 0.09);
}
</style> 