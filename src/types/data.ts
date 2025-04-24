/**
 * Represents a distinct tag library.
 */
export interface Library {
  id: string; 
  name: string; 
  description?: string;
  createdAt?: string; 
}

/**
 * Represents a group for organizing categories within a specific library.
 */
export interface Group {
  id: string;        // Unique identifier (UUID)
  libraryId: string; // ID of the library it belongs to
  name: string;        // Group name (unique within the library?)
  color?: string;     // Optional color
  icon?: string;      // Optional icon
  order?: number;     // Optional display order
}

/**
 * Represents a category for organizing tags within a specific group.
 */
export interface Category {
  id: string; 
  // libraryId: string; // Removed: Belongs to a group now
  groupId: string;   // Added: ID of the group it belongs to
  name: string; 
  color?: string; 
  icon?: string; 
}

/**
 * Represents a tag within a specific category.
 */
export interface Tag {
  id: string; 
  // libraryId: string; // Removed: Implicitly belongs to library via category -> group
  categoryId: string; 
  name: string; 
  subtitles?: string[]; 
  keyword?: string; 
  weight?: number; 
  color?: string; 
}

// --- Template/Import/Export Structures ---

// Represents a tag within a category in the template file
export interface TemplateTagData {
    // categoryName: string; // Replaced by nesting under category
    name: string;         
    subtitles?: string[];
    keyword?: string;
    weight?: number;
    color?: string;
}

// Represents a category within a group in the template file
export interface TemplateCategoryData {
    // groupName: string; // Replaced by nesting under group
    name: string;
    color?: string;
    icon?: string;
    tags: TemplateTagData[]; // Tags nested under category
}

// Represents a group within a library in the template file
export interface TemplateGroupData {
    // libraryName: string; // Replaced by nesting under library
    name: string;
    color?: string;
    icon?: string;
    order?: number;
    categories: TemplateCategoryData[]; // Categories nested under group
}

/**
 * NEW Structure for importing/exporting data for a SINGLE tag library
 * Reflecting the Group -> Category -> Tag hierarchy.
 */
export interface TagStoreTemplate {
  $schema?: string; 
  version?: string; 
  library: { // Top-level library info
    name: string; // Library name is required for import context
    description?: string; // ADDED optional description field
    exportedAt?: string; // Optional export timestamp
  };
  // Groups belonging to this library (IDs generated on import)
  groups: TemplateGroupData[]; 
  // categories: Omit<Category, 'id' | 'libraryId' | 'groupId'>[]; // Removed - now nested
  // tags: TemplateTagData[]; // Removed - now nested
}

// --- Other existing types (might need review later) ---

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
    categoryIds: string[]; // Might need update if category selection changes
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
  categories: string[]; // Store category names or IDs? Review needed.
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
  tags: Tag[]; // Using basic Tag
  settings: HistorySettings;
} 