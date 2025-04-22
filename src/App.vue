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
  const defaultCreated = await libraryStore.initializeLibraries(); // Initialize libraries FIRST and wait, get flag
  // Now that libraryStore is ready (and activeLibraryId should be set),
  // initialize the tag store for the active library.
  await tagStore.initializeStore(); // Wait for tagStore initialization too
  
  // If the default library was just created, load the default template
  if (defaultCreated) {
    console.log("First default library created, loading default template...");
    // Use try-catch here as loadDefaultTemplateIfEmpty handles its own errors but good practice
    try {
        await tagStore.loadDefaultTemplateIfEmpty(); 
    } catch (error) { 
        console.error("Error attempting to load default template after initial library creation:", error);
        // Optionally show a message to the user via useMessage if available/needed
    }
  }

  settingsStore.initializeSettings(); // Initialize settings AFTER stores are ready
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
