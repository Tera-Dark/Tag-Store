<script setup lang="ts">
import { onMounted, watch } from 'vue';
// Import Naive UI components needed for providers
import { NConfigProvider, NMessageProvider, NDialogProvider, NGlobalStyle } from 'naive-ui';
// Import the main layout
import DefaultLayout from './layouts/DefaultLayout.vue';
// Import the stores
import { useLibraryStore } from './stores/libraryStore'; // Import library store
import { useSettingsStore } from './stores/settingsStore'; // Import settings store

// Get the store instances
const libraryStore = useLibraryStore();
const settingsStore = useSettingsStore(); // Get settings store instance

// Introduce function to apply font size
const applyGlobalFontSize = (size: number) => {
  // Ensure size is within reasonable bounds
  const safeSize = Math.max(10, Math.min(22, size)); // Example bounds 10px-22px
  document.documentElement.style.fontSize = `${safeSize}px`;
  console.log(`Applied global font size: ${safeSize}px (requested: ${size}px)`);
};

// Load data and settings when the component is mounted
onMounted(async () => {
  console.log("App mounted");

  // Initialize settings first to load theme preference
  try {
    console.log("Initializing settings...");
    settingsStore.initializeSettings();
    console.log("Settings initialization complete.");
    // Apply initial font size after settings are loaded
    applyGlobalFontSize(settingsStore.settings.globalFontSize);
  } catch (error) { 
    console.error("Error initializing settings:", error);
  }

  // Initialize libraries (this will handle active library and trigger tagStore loading)
  try {
    console.log("Initializing libraries...");
    await libraryStore.initializeLibraries();
    console.log("Library initialization complete.");

    // Removed tagStore initialization calls, libraryStore.initializeLibraries handles it
    // console.log("Initializing tag store...");
    // await tagStore.initializeStore();
    // console.log("Tag store initialization complete.");

    // Removed default template loading call, should be handled differently (e.g., on empty library)
    // console.log("Checking if default template needs loading...");
    // await tagStore.loadDefaultTemplateIfEmpty(); 
    // console.log("Default template check complete.");

  } catch (error) {
    console.error("Error during app initialization:", error);
    // Handle critical initialization errors if needed
  }
});

// Introduce watcher for font size changes
watch(() => settingsStore.settings.globalFontSize, (newSize) => { 
  if (typeof newSize === 'number') {
    applyGlobalFontSize(newSize);
  } else {
     console.warn('Global font size changed to non-number:', newSize);
     // Optionally apply default size as fallback
     // applyGlobalFontSize(defaultSettings.globalFontSize);
  }
}, { immediate: false }); // Don't run immediately, onMounted handles initial

// TODO: Implement theme switching based on settings store later
</script>

<template>
  <NConfigProvider :theme="settingsStore.naiveTheme" :theme-overrides="settingsStore.naiveThemeOverrides">
    <NGlobalStyle />
    <NMessageProvider>
      <NDialogProvider>
            <DefaultLayout />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
/* App-specific styles can go here - usually minimal as styles are in layout/components */
</style>
