/**
 * Represents a category for organizing tags.
 */
export interface Category {
  id: string; // Unique identifier (UUID)
  name: string; // Category name (unique within the library)
  // Optional: Add a keyword/tooltip for categories too if needed
  // keyword?: string;
  color?: string; // #RRGGBB
  icon?: string; // Icon identifier (e.g., from an icon library)
}

/**
 * Represents a tag.
 */
export interface Tag {
  id: string; // Unique identifier (UUID)
  categoryId: string; // ID of the category it belongs to
  name: string; // Main name/content of the tag (e.g., "人工智能")
  subtitles?: string[]; // Aliases, descriptions, or additional info (e.g., ["计算机领域", "AI"])
  keyword?: string; // Supplementary keyword/tooltip (e.g., "Artificial Intelligence" or "ai")
  // Optional attributes
  weight?: number; // Sorting weight
  color?: string; // Tag-specific color
}

// Define the structure of a tag as it appears in the template file
interface TemplateTagData {
    categoryName: string; // Category name for association
    name: string;         // Required tag name
    subtitles?: string[];
    keyword?: string;
    weight?: number;
    color?: string;
    // Add any other optional Tag properties here
}

/**
 * Structure for importing/exporting tag library data.
 */
export interface TagStoreTemplate {
  $schema?: string; // Optional schema reference
  version?: string; // Optional template version
  metadata?: {
    name?: string; // Template name
    description?: string;
    // Other metadata
  };
  // During import, IDs are generated. Use name for matching.
  categories: Omit<Category, 'id'>[]; // Category definitions without IDs
  tags: TemplateTagData[]; // Use the explicit interface here
} 