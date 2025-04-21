<script setup lang="ts">
import { NLayout, NLayoutSider, NLayoutHeader, NLayoutContent } from 'naive-ui';
import { ref } from 'vue';
import AppSidebar from '../components/AppSidebar.vue';
import LibrarySwitcher from '../components/global/LibrarySwitcher.vue';
import { useSettingsStore } from '../stores/settingsStore';

const settingsStore = useSettingsStore();

// --- Sidebar State ---
const sidebarCollapsed = ref(false);

// --- Sidebar Toggle Handler ---
const handleToggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};
</script>

<template>
  <n-layout style="height: 100vh" has-sider>
    <!-- 侧边栏 -->
    <n-layout-sider
      bordered
      :width="240"
      :collapsed-width="64"
      :collapsed="sidebarCollapsed"
      collapse-mode="width"
      :show-trigger="false"
      :native-scrollbar="false"
      style="height: 100%; position: relative; z-index: 1000;"
      :style="{ backgroundColor: '#151515' }"
    >
      <!-- 侧边栏组件 -->
      <AppSidebar 
        :collapsed="sidebarCollapsed"
        @toggle-sidebar="handleToggleSidebar"
      />
    </n-layout-sider>

    <!-- 主内容区域 -->
    <n-layout :style="{ backgroundColor: settingsStore.naiveThemeOverrides.common?.bodyColor || '#ffffff' }">
      <!-- 顶部导航栏 -->
      <n-layout-header 
        style="height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between;"
        :style="{ 
            backgroundColor: settingsStore.naiveThemeOverrides.Layout?.headerColor || '#ffffff',
            borderBottom: `1px solid ${settingsStore.naiveThemeOverrides.Layout?.headerBorderColor || 'var(--n-border-color)'}`
        }"
        bordered
      >
        <LibrarySwitcher />
      </n-layout-header>
      
      <!-- 内容区域 -->
      <n-layout-content 
        :native-scrollbar="false" 
        :content-style="{
            padding: '24px',
            height: 'calc(100vh - 64px)',
            backgroundColor: settingsStore.naiveThemeOverrides.common?.bodyColor || 'var(--body-color)'
        }"
      >
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
/* Global styles */
:deep(body) {
  margin: 0;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style> 