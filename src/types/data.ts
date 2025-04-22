/**
 * Represents a distinct tag library.
 */
export interface Library {
  id: string; // Unique identifier (UUID)
  name: string; // Library name (unique)
  createdAt?: string; // Optional creation timestamp (ISO string)
  // description?: string; // Optional description
}

/**
 * Represents a category for organizing tags within a specific library.
 */
export interface Category {
  id: string; 
  libraryId: string; // Added: ID of the library it belongs to
  name: string; 
  color?: string; 
  icon?: string; 
}

/**
 * Represents a tag within a specific library and category.
 */
export interface Tag {
  id: string; 
  libraryId: string; // Added: ID of the library it belongs to
  categoryId: string; 
  name: string; 
  subtitles?: string[]; 
  keyword?: string; 
  weight?: number; 
  color?: string; 
}

// Define the structure of a tag as it appears in the template file
export interface TemplateTagData {
    categoryName: string; 
    name: string;         
    subtitles?: string[];
    keyword?: string;
    weight?: number;
    color?: string;
    // Add any other optional Tag properties here
}

/**
 * Structure for importing/exporting data for a SINGLE tag library.
 */
export interface TagStoreTemplate {
  $schema?: string; 
  version?: string; 
  library: { // Top-level library info
    name: string; // Library name is required for import context
    // description?: string;
    exportedAt?: string; // Optional export timestamp
  };
  // Categories belonging to this library (IDs will be generated on import)
  categories: Omit<Category, 'id' | 'libraryId'>[]; // Exclude libraryId as it's implicit
  // Tags belonging to this library (IDs will be generated on import)
  tags: TemplateTagData[]; 
}

/**
 * Represents a tag with an explicit weight, often used in results.
 */
export interface WeightedTag extends Tag {
  weight: number; // Explicit weight
}

/**
 * Represents settings saved within a Tag Drawer preset.
 */
export interface PresetSettings {
    numTags: number;
    categoryIds: string[];
    method: string;
    exclusions: string;
    multiCategory: boolean;
    ensureBalance: boolean;
}

/**
 * Represents a Tag Drawer preset.
 */
export interface Preset {
    name: string;
    settings: PresetSettings;
}

/**
 * Represents settings captured for a Tag Drawer history entry.
 */
export interface HistorySettings {
  numTags: number;
  categories: string[]; // Store category names or IDs
  method: string;
  exclusions: string;
  multiCategory: boolean;
  ensureBalance: boolean;
}

/**
 * Represents an entry in the Tag Drawer history.
 */
export interface DrawHistoryEntry {
  id: number;
  timestamp: string;
  tags: Tag[]; // Using basic Tag, weight is usually handled separately or implied by method
  settings: HistorySettings;
} 