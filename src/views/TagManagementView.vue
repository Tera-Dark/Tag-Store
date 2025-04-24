<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue';
import { NLayout, NLayoutSider, NLayoutContent, NSelect, NButton, NIcon, NSpace, NTooltip, NInput, NDropdown, NText, NFlex } from 'naive-ui';
import { 
  SettingsOutline as SettingsIcon,
  AddOutline as AddIcon, 
  SearchOutline as SearchIcon,
  AlbumsOutline as CategoryIcon,
  PricetagsOutline as TagIcon,
  ListOutline as ManageGroupsIcon,
  MenuOutline as MenuIcon
} from '@vicons/ionicons5';
import CategoryList from '../components/CategoryList.vue';
import TagGrid from '../components/TagGrid.vue';
import LibraryManagerDialog from '../components/dialogs/LibraryManagerDialog.vue';
import CategoryDialog from '../components/dialogs/CategoryDialog.vue';
import TagDialog from '../components/dialogs/TagDialog.vue';
import GroupDialog from '../components/dialogs/GroupDialog.vue';
import GroupManagerDialog from '../components/dialogs/GroupManagerDialog.vue';
import { useLibraryStore } from '../stores/libraryStore';
import { useTagStore } from '../stores/tagStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { Group } from '../types/data';

const libraryStore = useLibraryStore();
const tagStore = useTagStore();
const settingsStore = useSettingsStore();

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

// State for Tag Add Dialog
const showTagDialog = ref(false);

// State for Group Dialog
const showGroupDialog = ref(false);
const groupDialogMode = ref<'add' | 'edit'>('add');
const groupToEdit = ref<Group | null>(null);

// State for Group Manager Dialog
const showGroupManagerDialog = ref(false);

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

// --- Responsive State ---
const screenWidth = ref(window.innerWidth);
const isSmallScreen = computed(() => screenWidth.value < 768);

// --- Sider State ---
const categorySiderCollapsed = ref(isSmallScreen.value); 

// Watch screen size to auto-collapse/expand sider
watch(isSmallScreen, (small) => {
    categorySiderCollapsed.value = small;
});

const updateScreenWidth = () => {
  screenWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', updateScreenWidth);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth);
});

// Open Add Category Dialog 
const handleOpenAddCategoryDialog = () => {
    showCategoryDialog.value = true;
};

// Open Tag Dialog
const handleOpenAddTagDialog = () => {
    if (!tagStore.filterCategoryId) return;
    showTagDialog.value = true;
};

// Open Group Manager Dialog (replaces open add group)
const handleOpenGroupManagerDialog = () => {
    showGroupManagerDialog.value = true;
};

// Handle Category Dialog Submission
const handleCategoryDialogSubmit = () => {
  showCategoryDialog.value = false; 
};

// Handle Tag Dialog Submission
const handleTagDialogSubmit = () => {
  showTagDialog.value = false;
};

// Determine the current context title for the content header
const contentTitle = computed(() => {
    if (tagStore.filterGroupId) {
        const group = tagStore.groups.find(g => g.id === tagStore.filterGroupId);
        return group ? `分组: ${group.name}` : '标签管理';
    } else if (tagStore.filterCategoryId) {
        const category = tagStore.categories.find(c => c.id === tagStore.filterCategoryId);
        return category ? `分类: ${category.name}` : '标签管理';
    } else {
        return '标签管理 (所有分类)';
    }
});

// Check if a specific category is selected to enable Add Tag button
const isCategorySelected = computed(() => !!tagStore.filterCategoryId);

// Add Button Options for Dropdown on small screens
const addOptions = computed(() => [
  {
    label: '添加分类',
    key: 'add-category',
    icon: () => h(NIcon, { component: CategoryIcon }),
    props: { onClick: handleOpenAddCategoryDialog }
  },
  {
    label: '添加标签',
    key: 'add-tag',
    icon: () => h(NIcon, { component: TagIcon }),
    disabled: !isCategorySelected.value, // Keep disabled state
    props: { onClick: handleOpenAddTagDialog }
  }
]);

// Toggle sider function for small screens
const toggleSider = () => {
    categorySiderCollapsed.value = !categorySiderCollapsed.value;
};

</script>

<template>
  <n-layout has-sider style="height: 100%; position: relative;">
    <!-- 侧边栏 -->
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      :collapsed="categorySiderCollapsed"
      show-trigger="arrow-circle"
      :style="{ 
          height: '100%', 
          backgroundColor: settingsStore.naiveThemeOverrides.Layout?.siderColor || 'var(--card-color)', 
          borderRight: `1px solid ${settingsStore.naiveThemeOverrides.Layout?.siderBorderColor || 'var(--n-border-color)'}`,
          position: isSmallScreen ? 'fixed' : 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: isSmallScreen ? 1000 : 1,
          transition: 'transform 0.3s ease-in-out, width 0.3s ease-in-out'
      }"
      :native-scrollbar="false"
      content-style="padding-top: 0; display: flex; flex-direction: column;"
      @collapse="categorySiderCollapsed = true"
      @expand="categorySiderCollapsed = false"
    >
      <div class="sider-content-wrapper">
        <div class="sider-header">
          <n-space vertical size="small" v-if="!categorySiderCollapsed">
            <n-select 
                :value="libraryStore.activeLibraryId" 
                :options="libraryOptions"
                :disabled="libraryStore.isLoading || libraryStore.libraries.length === 0" 
                @update:value="handleLibrarySwitch"
                placeholder="选择标签库"
                size="small" 
            />
            <n-button block secondary size="small" @click="handleOpenGroupManagerDialog">
                <template #icon><n-icon :component="ManageGroupsIcon" /></template>
                管理分组
            </n-button>
            <n-button block secondary size="small" @click="showLibraryManager = true" :disabled="libraryStore.isLoading">
                <template #icon><n-icon :component="SettingsIcon" /></template>
                管理标签库
            </n-button>
          </n-space>
          
          <n-space vertical size="small" v-else>
            <n-tooltip placement="right" trigger="hover">
              <template #trigger>
                <n-button circle secondary ghost size="small" @click="handleOpenGroupManagerDialog">
                  <template #icon><n-icon :component="ManageGroupsIcon" /></template>
                </n-button>
              </template>
              管理分组
            </n-tooltip>
            <n-tooltip placement="right" trigger="hover">
              <template #trigger>
                <n-button circle secondary ghost size="small" @click="showLibraryManager = true" :disabled="libraryStore.isLoading">
                  <template #icon><n-icon :component="SettingsIcon" /></template>
                </n-button>
              </template>
              管理标签库
            </n-tooltip>
          </n-space>
        </div>

        <div class="category-list-container">
          <CategoryList :collapsed="categorySiderCollapsed" />
        </div>
      </div>
    </n-layout-sider>

    <div v-if="isSmallScreen && !categorySiderCollapsed" class="sider-overlay" @click="toggleSider"></div>

    <n-layout-content 
        :native-scrollbar="true"
        content-style="height: 100%; display: flex; flex-direction: column;" 
        :style="{ 
            paddingLeft: isSmallScreen ? '0' : (categorySiderCollapsed ? '64px' : '240px'), 
            transition: 'padding-left 0.3s ease-in-out' 
        }"
    >
      <n-flex class="content-header" justify="space-between" align="center" :wrap="false"> 
          <n-space align="center" :wrap="false" :size="8">
              <n-button v-if="isSmallScreen" text @click="toggleSider" style="margin-right: 4px;">
                  <template #icon><n-icon :component="MenuIcon" :size="22" /></template>
              </n-button>
              <n-tooltip :disabled="!isSmallScreen">
                <template #trigger>
                    <n-text class="header-title">
                        {{ contentTitle }}
                    </n-text>
                </template>
                 {{ contentTitle }}
              </n-tooltip>
          </n-space>

          <n-space class="header-actions" align="center" :wrap="false" :size="isSmallScreen ? 6 : 10">
              <n-dropdown 
                  trigger="click"
                  :options="addOptions"
              >
                  <n-button type="primary" ghost size="small">
                      <template #icon><n-icon :component="AddIcon"/></template> 添加
                  </n-button>
              </n-dropdown>
              
              <n-input
                  v-model:value="searchValue"
                  placeholder="搜索..."
                  clearable
                  @update:value="handleSearchInput"
                  @clear="clearSearch"
                  size="small"
                  class="header-search"
              >
                  <template #prefix>
                  <n-icon :component="SearchIcon" class="search-icon" />
                  </template>
              </n-input>
          </n-space>
      </n-flex>
      
      <div class="content-body">
        <TagGrid />
      </div>
    </n-layout-content>

    <LibraryManagerDialog v-model:show="showLibraryManager" />
    <CategoryDialog
      v-model:show="showCategoryDialog"
      mode="add" 
      @submit="handleCategoryDialogSubmit" 
    />
    <TagDialog 
      v-model:show="showTagDialog"
      mode="add"
      :initial-category-id="tagStore.filterCategoryId" 
      @submit="handleTagDialogSubmit"
    />
    <GroupDialog 
      v-model:show="showGroupDialog"
      :mode="groupDialogMode"
      :group-to-edit="groupToEdit"
    />
    <GroupManagerDialog v-model:show="showGroupManagerDialog" />

  </n-layout>
</template>

<style scoped>
.n-layout {
    overflow: hidden;
}

.n-layout-sider {
    transition: width 0.3s var(--n-bezier), background-color 0.3s var(--n-bezier);
    height: 100%;
    display: flex;
    flex-direction: column;
}

.n-layout-sider[style*="width: 0px"] {
    border-right: none;
}

.sider-content-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
  display: flex;
}

.sider-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
}

.content-header {
  padding: 10px 16px;
  border-bottom: 1px solid var(--n-divider-color);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--n-text-color-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
  display: inline-block;
}

@media (max-width: 768px) {
  .header-title {
    max-width: 150px;
  }
}

.header-actions {
    flex-shrink: 1;
}

.header-search {
    min-width: 120px;
    max-width: 250px;
    width: 180px;
}

.search-icon {
  color: var(--n-text-color-3);
}

.content-body {
  flex-grow: 1;
  padding: 16px;
  overflow-y: auto;
}

:global(.n-theme-dark) .sider-header,
:global(.n-theme-dark) .sider-footer {
  border-color: rgba(255, 255, 255, 0.09);
}

:global(.n-theme-dark) .content-header {
  border-color: rgba(255, 255, 255, 0.09);
}

:deep(.category-menu-container) {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
}

:deep(.category-menu-container > .n-menu) {
    flex-grow: 1 !important;
}

/* Ensure sider header content fits when collapsed */
.n-layout-sider[style*="width: 64px"] .sider-header .n-space {
    /* Maybe adjust spacing or alignment if needed */
    /* align-items: center; */ 
}
</style> 