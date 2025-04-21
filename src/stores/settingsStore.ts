import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { lightTheme, darkTheme } from 'naive-ui';
import type { GlobalTheme } from 'naive-ui';

// Define possible theme modes
type ThemeMode = 'light' | 'dark' | 'system';

// LocalStorage key
const THEME_STORAGE_KEY = 'tagstore_theme_mode';

export const useSettingsStore = defineStore('settingsStore', () => {
  // --- State ---
  const themeMode = ref<ThemeMode>('light'); 

  // --- Computed ---
  const naiveTheme = computed<GlobalTheme | null>(() => {
    if (themeMode.value === 'light') return lightTheme;
    if (themeMode.value === 'dark') return darkTheme;
    // System theme logic
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return darkTheme;
    }
    return lightTheme; // Default system
  });

  // --- Actions ---
  const setThemeMode = (mode: ThemeMode) => {
    if (['light', 'dark', 'system'].includes(mode)) {
        themeMode.value = mode;
        try {
            localStorage.setItem(THEME_STORAGE_KEY, mode);
        } catch (error) { console.error("Failed to save theme:", error); }
        // Add/remove system listener based on new mode
        updateSystemThemeListener();
    }
  };

  // System theme listener logic
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
      // Only trigger re-evaluation if mode is currently 'system'
      if (themeMode.value === 'system') {
         // Simple re-assignment to trigger computed update
         themeMode.value = 'system'; 
      }
  };

  const updateSystemThemeListener = () => {
      if (themeMode.value === 'system' && mediaQuery) {
          mediaQuery.addEventListener('change', handleSystemChange);
      } else if (mediaQuery) {
          mediaQuery.removeEventListener('change', handleSystemChange);
      }
  }

  // Initial load
  const initializeSettings = () => {
    let savedTheme: ThemeMode = 'system'; 
    try {
      const storedValue = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedValue && ['light', 'dark', 'system'].includes(storedValue)) {
        savedTheme = storedValue as ThemeMode;
      }
    } catch (error) { console.error("Failed to load theme:", error); }
    themeMode.value = savedTheme; // Set initial value *before* calling setThemeMode
    setThemeMode(savedTheme); // Call action to save (redundant save but ensures listener logic runs)
  };

  // --- Return (Ensure all needed parts are returned) ---
  return {
    themeMode, // state
    naiveTheme, // computed getter
    setThemeMode, // action
    initializeSettings, // action
  };
}); 