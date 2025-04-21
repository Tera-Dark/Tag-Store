<script setup lang="ts">
import { h, ref, defineProps, computed, watch } from 'vue';
import { NMenu, NIcon, NTooltip, NDivider } from 'naive-ui';
import type { MenuOption } from 'naive-ui';
import { 
  GridOutline as DashboardIcon,
  HomeOutline as TagIcon, 
  BuildOutline as ToolboxIcon, 
  SettingsOutline as SettingsIcon, 
  InformationCircleOutline as AboutIcon,
  ChevronBackOutline as CollapseIcon,
  ChevronForwardOutline as ExpandIcon
} from '@vicons/ionicons5';
import { useRouter } from 'vue-router';

// Define props
const props = defineProps<{ collapsed: boolean }>();

// 定义事件
const emit = defineEmits(['toggle-sidebar']);

const router = useRouter();

// Helper function to render icons
function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

// Define menu options
const menuOptions: MenuOption[] = [
  {
    label: '仪表盘',
    key: 'dashboard',
    icon: renderIcon(DashboardIcon),
    path: '/'
  },
  {
    label: '标签管理',
    key: 'tag-management',
    icon: renderIcon(TagIcon),
    path: '/tags'
  },
  {
    label: '扩展工具箱',
    key: 'toolbox',
    icon: renderIcon(ToolboxIcon),
    path: '/toolbox'
  },
  {
    label: '设置',
    key: 'settings',
    icon: renderIcon(SettingsIcon),
    path: '/settings'
  },
  {
    label: '关于',
    key: 'about',
    icon: renderIcon(AboutIcon),
    path: '/about'
  }
];

// Update active key based on current route
const activeKey = ref<string>('dashboard');

watch(() => router.currentRoute.value.path, (path) => {
  if (path === '/') {
    activeKey.value = 'dashboard';
  } else if (path === '/tags') {
    activeKey.value = 'tag-management';
  } else if (path === '/toolbox') {
    activeKey.value = 'toolbox';
  } else if (path === '/settings') {
    activeKey.value = 'settings';
  } else if (path === '/about') {
    activeKey.value = 'about';
  }
}, { immediate: true });

// Handle menu item selection
const handleMenuSelect = (key: string, item: MenuOption) => {
  if (typeof item !== 'string' && 'path' in item && item.path) { 
    router.push(item.path);
  }
};

// Toggle sidebar
const toggleSidebar = () => {
  emit('toggle-sidebar');
};
</script>

<template>
  <div class="sidebar">
    <!-- 顶部Logo -->
    <div class="logo">
      <h1 v-if="!collapsed">TagStore</h1>
      <span v-else>TS</span>
    </div>
    
    <!-- 菜单区域 -->
    <div class="menu-area">
      <n-menu
        v-model:value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :indent="16"
        @update:value="handleMenuSelect"
        inverted
      />
    </div>
    
    <!-- 底部填充空间 -->
    <div class="flex-spacer"></div>
    
    <!-- 底部收起按钮 -->
    <div class="collapse-area">
      <n-divider style="margin: 0;" />
      <div class="collapse-button" @click="toggleSidebar">
        <n-icon :component="collapsed ? ExpandIcon : CollapseIcon" size="18" />
        <span v-if="!collapsed">收起侧栏</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #151515;
  color: #fff;
  overflow: hidden;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo h1 {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: #fff;
  text-align: center;
}

.logo span {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.menu-area {
  flex: 0 0 auto;
  overflow-y: auto;
  padding-top: 8px;
}

/* 弹性填充空间 */
.flex-spacer {
  flex: 1 1 auto;
  min-height: 20px;
}

/* 自定义菜单样式 */
:deep(.n-menu) {
  background-color: transparent !important;
}

:deep(.n-menu-item) {
  margin: 4px 8px;
  border-radius: 4px;
}

:deep(.n-menu-item--selected) {
  background-color: #18a058 !important; /* 使用绿色作为选中背景 */
}

:deep(.n-menu-item--selected::before) {
  display: none; /* 移除默认的左侧指示条 */
}

:deep(.n-menu-item-content) {
  padding: 12px 16px !important;
}

:deep(.n-menu-item-content__icon) {
  margin-right: 10px !important;
}

/* 收起按钮样式 */
.collapse-area {
  flex: 0 0 auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.collapse-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: rgba(255, 255, 255, 0.6);
}

.collapse-button:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.collapse-button span {
  margin-left: 8px;
  font-size: 14px;
}

/* 滚动条美化 */
.menu-area::-webkit-scrollbar {
  width: 0; /* 隐藏滚动条 */
}
</style> 