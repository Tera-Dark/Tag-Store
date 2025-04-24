import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useOsTheme, darkTheme } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';

// Define AppSettings type directly here if file doesn't exist
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  themeMode: ThemeMode;
  // Tag Drawer specific settings (could be moved to its own store/section later)
  tagDrawerColumns: number;
  tagDrawerShowTagCount: boolean;
  tagDrawerDisplayMode: 'text' | 'image'; // Assuming these are the modes
  tagDrawerExcludeTags: string[];
  tagDrawerFontSize: number; // Kept for potential specific drawer font size
  tagDrawerHistorySize: number; // Renamed to be more specific
  tagDrawerShowCategory: boolean;
  tagDrawerShowGroup: boolean;
  tagDrawerNumTagsToDraw: number;
  tagDrawerUseMultiCategoryMode: boolean;
  tagDrawerEnsureEachCategory: boolean;
  tagDrawerDrawMethod: string; // Consider using specific literal types like 'random' | 'leastUsed'
  tagDrawerSaveHistory: boolean;
  // --- NEW GLOBAL SETTINGS ---
  globalFontSize: number; // New global font size
}

// LocalStorage key
const SETTINGS_STORAGE_KEY = 'tagstore_app_settings';

// --- Default Settings ---
const defaultSettings: AppSettings = {
  themeMode: 'system',
  tagDrawerColumns: 3,
  tagDrawerShowTagCount: true,
  tagDrawerDisplayMode: 'text', 
  tagDrawerExcludeTags: [],
  tagDrawerFontSize: 14, // Keep this specific setting? Or remove if global is enough?
  tagDrawerHistorySize: 20, // <<< Default history size
  tagDrawerShowCategory: true,
  tagDrawerShowGroup: true,
  tagDrawerNumTagsToDraw: 5,
  tagDrawerUseMultiCategoryMode: false,
  tagDrawerEnsureEachCategory: false,
  tagDrawerDrawMethod: 'random',
  tagDrawerSaveHistory: true,
  // --- NEW DEFAULTS ---
  globalFontSize: 14, // <<< Default global font size
};

// Theme Overrides for Dark Mode (Based on Dribbble Reference)
const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily: '\'Inter\', sans-serif',
    primaryColor: '#4C9283', 
    primaryColorHover: '#5DB0A0',
    primaryColorPressed: '#3E7A6D',
    primaryColorSuppl: '#4C9283', 
    bodyColor: '#0F0F0F', 
    cardColor: '#1A1A1A', 
    modalColor: '#1A1A1A',
    popoverColor: '#1A1A1A',
    inputColor: '#2a2a2a',
    borderColor: '#333333',
    textColorBase: '#E0E0E0', 
    textColor1: '#CCCCCC',
    textColor2: '#B0B0B0', 
    textColor3: '#909090',
    errorColor: '#EC6049', 
    errorColorHover: '#FF7A66',
    errorColorPressed: '#D04C37',
    successColor: '#4C9283', 
    successColorHover: '#5DB0A0',
    successColorPressed: '#3E7A6D',
  },
  Button: {
    colorSecondary: '#2C2C2C',
    colorSecondaryHover: '#3C3C3C',
    colorSecondaryPressed: '#252525',
    borderSecondary: '1px solid #444',
    borderSecondaryHover: '1px solid #555',
    borderSecondaryPressed: '1px solid #333',
    textColorSecondary: '#CCCCCC',
    textColorSecondaryHover: '#E0E0E0',
    textColorSecondaryPressed: '#B0B0B0',
  },
  Card: {
    borderColor: 'transparent',
    titleTextColor: '#E0E0E0',
  },
  Input: {
      borderHover: '1px solid #4C9283',
      borderFocus: '1px solid #4C9283',
      caretColor: '#4C9283',
  },
  Select: {
      peers: {
          InternalSelection: {
              borderHover: '1px solid #4C9283',
              borderFocus: '1px solid #4C9283',
              caretColor: '#4C9283',
          }
      }
  },
  Layout: {
      siderColor: '#1A1A1A', 
      headerColor: '#1A1A1A', 
      footerColor: '#1A1A1A',
      headerBorderColor: '#333333',
      siderBorderColor: '#333333',
      footerBorderColor: '#333333',
  },
  Menu: {
     itemTextColorInverted: '#B0B0B0',
     itemIconColorInverted: '#B0B0B0',
     itemTextColorHoverInverted: '#E0E0E0',
     itemIconColorHoverInverted: '#E0E0E0',
     itemTextColorActiveInverted: '#FFFFFF', 
     itemIconColorActiveInverted: '#FFFFFF',
     itemTextColorActiveHoverInverted: '#FFFFFF',
     itemIconColorActiveHoverInverted: '#FFFFFF',
     itemColorActiveInverted: 'rgba(76, 146, 131, 0.3)', 
     arrowColorInverted: '#B0B0B0',
  }
};

// Theme Overrides for Light Mode
const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily: '\'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    primaryColor: '#3fa36d', // 更鲜明的绿色作为主色调
    primaryColorHover: '#4db87e',
    primaryColorPressed: '#2d8c59',
    primaryColorSuppl: '#3fa36d',
    borderRadius: '8px', // 更大的圆角
    bodyColor: '#f5f7f9', // 柔和的背景色
    cardColor: '#ffffff',
    textColorBase: '#333333',
    textColor1: '#333333',
    textColor2: '#666666',
    textColor3: '#999999',
    borderColor: '#e0e0e0',
  },
  Card: {
    borderRadius: '12px',
    borderColor: 'transparent',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', // 更轻柔的阴影
  },
  Button: {
    borderRadiusMedium: '8px',
    borderRadiusSmall: '6px',
    textColorPrimary: '#ffffff',
    colorSecondary: '#f0f2f5',
    textColorSecondary: '#666666',
  },
  Input: {
    borderRadius: '8px',
    borderHover: '1px solid #3fa36d',
    borderFocus: '1px solid #3fa36d',
    boxShadowFocus: '0 0 0 2px rgba(63, 163, 109, 0.2)',
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '8px',
        borderHover: '1px solid #3fa36d',
        borderFocus: '1px solid #3fa36d',
        boxShadowFocus: '0 0 0 2px rgba(63, 163, 109, 0.2)',
      }
    }
  },
  Menu: {
    borderRadius: '8px',
    itemColorActive: 'rgba(63, 163, 109, 0.1)',
    itemTextColorActive: '#3fa36d',
    itemTextColorActiveHover: '#3fa36d',
    itemIconColorActive: '#3fa36d',
    itemIconColorActiveHover: '#3fa36d',
  },
  Divider: {
    color: '#eeeeee',
  },
  Layout: {
    color: '#f5f7f9', // 背景色
    headerColor: '#ffffff',
    headerBorderColor: '#eeeeee',
  },
};

export const useSettingsStore = defineStore('settingsStore', () => {
  // --- State ---
  const settings = ref<AppSettings>({ ...defaultSettings });
  const osTheme = useOsTheme();
  const isSidebarCollapsed = ref(false);

  // ThemeOverrides computed property that INCLUDES dynamic font size
  const naiveThemeOverrides = computed((): GlobalThemeOverrides => {
    const baseOverrides = (settings.value.themeMode === 'dark' || (settings.value.themeMode === 'system' && osTheme.value === 'dark')) 
      ? darkThemeOverrides 
      : lightThemeOverrides;
    
    // Create a deep copy or merge carefully to avoid modifying originals
    // and ensure all necessary levels are present
    const dynamicOverrides: GlobalThemeOverrides = {
        ...baseOverrides, // Copy top-level keys like Button, Card, etc.
        common: { // Deep merge common properties
            ...baseOverrides.common, // Copy base common properties
            fontSize: `${settings.value.globalFontSize}px` // Apply dynamic font size
        }
    };
    
    // console.log("Applied Font Size:", dynamicOverrides.common?.fontSize);
    return dynamicOverrides;
  });

  // --- Computed ---
  const themeMode = computed(() => settings.value.themeMode);

  const naiveTheme = computed(() => {
    if (settings.value.themeMode === 'dark' || (settings.value.themeMode === 'system' && osTheme.value === 'dark')) {
      return darkTheme; 
    } else {
      return null; 
    }
  });
  
  // --- Actions ---
  const setThemeMode = (mode: ThemeMode) => {
    if (['light', 'dark', 'system'].includes(mode)) {
      settings.value.themeMode = mode;
      // <<< Need to update listener logic if kept >>>
      updateSystemThemeListener(); 
      saveSettings(); 
    }
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    settings.value[key] = value;
    saveSettings();
    if (key === 'themeMode') { 
      updateSystemThemeListener();
    }
    // No need for specific action if font size change is handled by computed themeOverrides
  };

  const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  };
  
  // System theme listener logic 
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  const handleSystemChange = () => {
    if (settings.value.themeMode === 'system') {
      // Trigger reactivity by re-evaluating computed props
      // Force update - might need a more robust way if this isn't enough
      settings.value.themeMode = 'system'; 
      console.log("System theme changed, recalculating...")
    }
  };

  const updateSystemThemeListener = () => {
    if (mediaQuery) {
        mediaQuery.removeEventListener('change', handleSystemChange);
        if (settings.value.themeMode === 'system') {
            mediaQuery.addEventListener('change', handleSystemChange);
        }
    }
  };

  const initializeSettings = () => {
    let loadedSettings: Partial<AppSettings> = {};
    try {
      const storedValue = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedValue) {
        loadedSettings = JSON.parse(storedValue);
      }
    } catch (error) { 
      console.error("Failed to load settings:", error); 
      localStorage.removeItem(SETTINGS_STORAGE_KEY); 
    }
    // Merge loaded settings with defaults
    settings.value = { ...defaultSettings, ...loadedSettings }; 
    // Ensure theme mode is valid after loading
    if (!['light', 'dark', 'system'].includes(settings.value.themeMode)) {
        settings.value.themeMode = defaultSettings.themeMode;
    }
    updateSystemThemeListener(); // Call after loading/validating settings
    // Save potentially merged settings after initialization and listener setup
    saveSettings(); 
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings.value));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  };

  // Watch for OS theme changes when mode is 'system'
  watch([osTheme, () => settings.value.themeMode], () => { // Watch the themeMode within settings
    // This watch is mainly to trigger reactivity updates 
    // if components rely directly on `naiveTheme` computed prop.
    // The computed prop itself handles the logic.
    console.log(`Theme recalculated: OS=${osTheme.value}, Mode=${settings.value.themeMode}, Resulting Theme=${naiveTheme.value ? 'dark' : 'light'}`);
  }, { immediate: true });

  // Initialize on store creation
  initializeSettings();
  updateSystemThemeListener();

  // --- Return (Ensure all needed parts are returned) ---
  return {
    settings, // Return the entire settings object
    themeMode, // state
    naiveTheme, // computed getter
    naiveThemeOverrides, // Return the computed overrides
    setThemeMode, // action
    initializeSettings, // action
    updateSetting, // Expose generic update function
    isSidebarCollapsed,
    toggleSidebar
  };
}); 