<script setup lang="ts">
import { onMounted } from 'vue';
// Import Naive UI components needed for providers
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, NLoadingBarProvider } from 'naive-ui';
// Import the main layout
import DefaultLayout from './layouts/DefaultLayout.vue';
// Import the stores
import { useTagStore } from './stores/tagStore';
import { useSettingsStore } from './stores/settingsStore'; // Import settings store
import { useLibraryStore } from './stores/libraryStore'; // Import library store

// Get the store instances
const tagStore = useTagStore();
const settingsStore = useSettingsStore(); // Get settings store instance
const libraryStore = useLibraryStore(); // Get library store instance

// Load data and settings when the component is mounted
onMounted(async () => { // Make onMounted async
  console.log("应用程序启动，开始初始化...");
  
  // 1. 首先初始化设置，确保主题等配置正确
  settingsStore.initializeSettings();
  
  // 2. 初始化库存储，这会加载所有标签库并设置活动库
  const defaultCreated = await libraryStore.initializeLibraries();
  
  // 3. 确保tagStore也初始化
  await tagStore.initializeStore();
  
  // 4. 如果是第一次启动（刚刚创建了默认库），加载默认模板
  if (defaultCreated) {
    console.log("首次创建默认库，尝试加载默认模板...");
    try {
      await tagStore.loadDefaultTemplateIfEmpty();
    } catch (error) {
      console.error("加载默认模板失败:", error);
    }
  }
  
  console.log("应用程序初始化完成");
});

// TODO: Implement theme switching based on settings store later
</script>

<template>
  <n-config-provider :theme="settingsStore.naiveTheme" :theme-overrides="settingsStore.naiveThemeOverrides">
    <n-loading-bar-provider>
      <n-message-provider>
        <n-notification-provider>
          <n-dialog-provider>
            <!-- Render the main application layout -->
            <DefaultLayout />
          </n-dialog-provider>
        </n-notification-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<style scoped>
/* App-specific styles can go here - usually minimal as styles are in layout/components */
</style>
