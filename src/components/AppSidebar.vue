<script setup lang="ts">
import { h, ref, defineProps, watch } from 'vue';
import { NMenu, NIcon, NTooltip } from 'naive-ui';
import type { MenuOption } from 'naive-ui';
import { 
  GridOutline as DashboardIcon,
  HomeOutline as TagIcon, 
  BuildOutline as ToolboxIcon, 
  SettingsOutline as SettingsIcon, 
  InformationCircleOutline as AboutIcon,
  ChevronBackOutline as CollapseIcon,
  ChevronForwardOutline as ExpandIcon,
  AppsOutline as LibraryManagerIcon
} from '@vicons/ionicons5';
import { useRouter } from 'vue-router';
import LibraryManagerDialog from './dialogs/LibraryManagerDialog.vue';

// Define props
defineProps<{ collapsed: boolean }>();

// 定义事件
const emit = defineEmits(['toggle-sidebar']);

const router = useRouter();

// 展示标签库管理对话框
const showLibraryManager = ref(false);

// 打开库管理对话框
const openLibraryManager = () => {
  console.log("侧边栏中点击了管理标签库按钮");
  showLibraryManager.value = true;
};

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
const handleMenuSelect = (key: string) => {
  const item = menuOptions.find(i => i.key === key);
  if (item && typeof item !== 'string' && 'path' in item && item.path) {
    router.push(item.path);
  }
};

// Toggle sidebar
const toggleSidebar = () => {
  emit('toggle-sidebar');
};
</script>

<template>
  <nav class="sidebar-pro" :class="{ collapsed }">
    <!-- 顶部Logo区 -->
    <div class="sidebar-pro-logo">
      <div class="logo-gradient"></div>
      <transition name="fade">
        <div v-if="!collapsed" class="logo-full">
          <span class="logo-icon">🟢</span>
          <span class="logo-title">TagStore</span>
        </div>
        <div v-else class="logo-mini">T</div>
      </transition>
    </div>
    <!-- 菜单区 -->
    <div class="sidebar-pro-menu">
      <n-menu
        v-model:value="activeKey"
        :options="menuOptions"
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="28"
        :indent="16"
        @update:value="handleMenuSelect"
        inverted
        :render-label="collapsed ? (() => '') : undefined"
      />
    </div>
    <div class="sidebar-pro-spacer"></div>
    <!-- 底部功能区 -->
    <div class="sidebar-pro-bottom">
      <n-tooltip v-if="collapsed" placement="right">
        <template #trigger>
          <div class="bottom-icon-btn" @click="openLibraryManager">
            <n-icon :component="LibraryManagerIcon" size="22" />
          </div>
        </template>
        管理标签库
      </n-tooltip>
      <div v-else class="bottom-card-btn" @click="openLibraryManager">
        <n-icon :component="LibraryManagerIcon" size="20" />
        <span>管理标签库</span>
      </div>
      <n-tooltip v-if="collapsed" placement="right">
        <template #trigger>
          <div class="bottom-icon-btn" @click="toggleSidebar">
            <n-icon :component="ExpandIcon" size="22" v-if="collapsed" />
            <n-icon :component="CollapseIcon" size="22" v-else />
    </div>
        </template>
        {{ collapsed ? '展开侧栏' : '收起侧栏' }}
      </n-tooltip>
      <div v-else class="bottom-card-btn" @click="toggleSidebar">
        <n-icon :component="CollapseIcon" size="20" />
        <span>收起侧栏</span>
      </div>
    </div>
    <LibraryManagerDialog v-model:show="showLibraryManager" />
  </nav>
</template>

<style scoped>
.sidebar-pro {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #191c1f;
  color: #fff;
  width: 230px;
  min-width: 64px;
  max-width: 260px;
  transition: width 0.3s cubic-bezier(.4,0,.2,1), background 0.3s;
  box-shadow: 2px 0 8px rgba(0,0,0,0.08);
  border-right: 1.5px solid #23272e;
}
.sidebar-pro.collapsed {
  width: 64px !important;
  min-width: 64px !important;
  max-width: 64px !important;
}
.sidebar-pro-logo {
  position: relative;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1.5px solid #23272e;
  background: transparent;
  font-family: 'Montserrat', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 1px;
}
.logo-gradient {
  position: absolute;
  left: 0; top: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #18a058 0%, #5ad8a6 100%);
  border-radius: 0 0 8px 8px;
}
.logo-full {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-icon {
  font-size: 26px;
}
.logo-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
}
.logo-mini {
  font-size: 22px;
  font-weight: 700;
  color: #18a058;
}
.sidebar-pro-menu {
  flex: 0 0 auto;
  margin-top: 18px;
}
.sidebar-pro-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.sidebar-pro-menu-item {
  margin: 10px 12px;
  border-radius: 16px;
  transition: background 0.2s, box-shadow 0.2s;
  cursor: pointer;
  position: relative;
}
.menu-icon-btn, .menu-card-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 100%;
  height: 48px;
  border-radius: 16px;
  font-size: 22px;
  transition: background 0.2s, color 0.2s;
}
.menu-icon-btn:hover, .menu-card-btn:hover {
  background: #18a05822;
  color: #18a058;
}
.menu-card-btn {
  justify-content: flex-start;
  gap: 14px;
  padding-left: 18px;
}
.menu-label {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  letter-spacing: 0.5px;
}
.sidebar-pro-menu-item.selected .menu-card-btn,
.sidebar-pro-menu-item.selected .menu-icon-btn {
  background: linear-gradient(90deg, #18a058 60%, #5ad8a6 100%);
  color: #fff;
  box-shadow: 0 2px 12px rgba(24,160,88,0.10);
}
.sidebar-pro-spacer {
  flex: 1 1 auto;
  min-height: 20px;
}
.sidebar-pro-bottom {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding: 12px 0 10px 0;
  border-top: 1.5px solid #23272e;
  background: transparent;
}
.bottom-icon-btn, .bottom-card-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 10px 0;
  margin: 0 10px;
  font-size: 18px;
  color: #b7eacb;
  transition: background 0.2s, color 0.2s;
  cursor: pointer;
}
.bottom-icon-btn:hover, .bottom-card-btn:hover {
  background: #18a05822;
  color: #18a058;
}
.bottom-card-btn {
  justify-content: flex-start;
  gap: 10px;
  padding-left: 18px;
  font-size: 15px;
  color: #fff;
}
.sidebar-pro-bottom .n-tooltip {
  width: 100%;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.sidebar-pro-menu::-webkit-scrollbar {
  width: 0;
}
</style> 