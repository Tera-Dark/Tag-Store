<script setup lang="ts">
import { onMounted } from 'vue';
// Import Naive UI components needed for providers
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, NLoadingBarProvider } from 'naive-ui';
// Import the main layout
import DefaultLayout from './layouts/DefaultLayout.vue';
// Import the tag store
import { useTagStore } from './stores/tagStore';

// Get the store instance
const tagStore = useTagStore();

// Load data when the component is mounted
onMounted(() => {
  tagStore.initializeStore();
});

// Theme configuration (example: start with light theme)
// import { lightTheme } from 'naive-ui'
// const theme = ref(lightTheme)

// TODO: Implement theme switching based on settings store later
</script>

<template>
  <n-config-provider>
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
