export type ThemeMode = 'light' | 'dark' | 'system';
export type TagDisplayMode = 'text' | 'card';
export type TagDrawerDrawMethod = 'random' | 'leastUsed' | 'mostUsed';

export interface AppSettings {
  themeMode: ThemeMode;
  // Settings for Tag DrawerView
  tagDrawerColumns: number;
  tagDrawerDisplayMode: TagDisplayMode;
  tagDrawerShowTagCount: boolean;
  tagDrawerExcludeTags: string[]; // Store IDs of tags to exclude
  tagDrawerFontSize: number;
  tagDrawerHistorySize: number;
  tagDrawerShowCategory: boolean;
  tagDrawerShowGroup: boolean;
  tagDrawerNumTagsToDraw: number;
  tagDrawerUseMultiCategoryMode: boolean;
  tagDrawerEnsureEachCategory: boolean;
  tagDrawerDrawMethod: TagDrawerDrawMethod;
  tagDrawerSaveHistory: boolean;

  // Add other application-wide settings here
} 