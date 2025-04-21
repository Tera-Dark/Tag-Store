import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useOsTheme, darkTheme } from 'naive-ui';
import type { GlobalThemeOverrides } from 'naive-ui';

// Define possible theme modes
type ThemeMode = 'light' | 'dark' | 'system';

// LocalStorage key
const THEME_STORAGE_KEY = 'tagstore_theme_mode';

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
  const settings = ref<{ themeMode: ThemeMode }>({ themeMode: 'system' });
  const osTheme = useOsTheme(); // 'light' | 'dark' | null

  // --- Computed ---
  const themeMode = computed(() => settings.value.themeMode);

  // Computed property to get the actual Naive UI theme object
  const naiveTheme = computed(() => {
    if (settings.value.themeMode === 'dark' || (settings.value.themeMode === 'system' && osTheme.value === 'dark')) {
      return darkTheme; // Return Naive's base dark theme
    } else {
      return null; // Use Naive's default light theme
    }
  });

  // Computed property for theme overrides
  const naiveThemeOverrides = computed(() => {
    if (settings.value.themeMode === 'dark' || (settings.value.themeMode === 'system' && osTheme.value === 'dark')) {
      // 对暗色主题做一些调整
      const updatedDarkOverrides = { ...darkThemeOverrides };
      updatedDarkOverrides.common = {
        ...updatedDarkOverrides.common,
        borderRadius: '8px', // 更新暗色主题的圆角
      };
      updatedDarkOverrides.Card = {
        ...updatedDarkOverrides.Card,
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      };
      return updatedDarkOverrides;
    } else {
      return lightThemeOverrides; // 使用新的亮色主题配置
    }
  });

  // --- Actions ---
  const setThemeMode = (mode: ThemeMode) => {
    if (['light', 'dark', 'system'].includes(mode)) {
      settings.value.themeMode = mode;
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
    if (settings.value.themeMode === 'system') {
      // Simple re-assignment to trigger computed update
      settings.value.themeMode = 'system'; 
    }
  };

  const updateSystemThemeListener = () => {
    if (settings.value.themeMode === 'system' && mediaQuery) {
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
    settings.value.themeMode = savedTheme; // Set initial value *before* calling setThemeMode
    setThemeMode(savedTheme); // Call action to save (redundant save but ensures listener logic runs)
  };

  // Save settings to local storage
  const saveSettings = () => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, settings.value.themeMode);
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  };

  // Watch for OS theme changes when mode is 'system'
  watch([osTheme, themeMode], () => {
    // This watch is mainly to trigger reactivity updates 
    // if components rely directly on `naiveTheme` computed prop.
    // The computed prop itself handles the logic.
    console.log(`Theme recalculated: OS=${osTheme.value}, Mode=${themeMode.value}, Resulting Theme=${naiveTheme.value ? 'dark' : 'light'}`);
  }, { immediate: true });

  // --- Return (Ensure all needed parts are returned) ---
  return {
    settings,
    themeMode, // state
    naiveTheme, // computed getter
    naiveThemeOverrides, // computed getter
    setThemeMode, // action
    initializeSettings, // action
    saveSettings, // action
  };
}); 