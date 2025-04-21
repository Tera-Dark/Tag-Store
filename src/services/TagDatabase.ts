// src/services/TagDatabase.ts

import Dexie, { type Table } from 'dexie';
import type { Category, Tag } from '../types/data';

// Define the entity types, potentially identical to the main types for now
export interface CategoryEntity extends Category {}
export interface TagEntity extends Tag {}

/**
 * Dexie database class definition for TagStore.
 */
export class TagDatabase extends Dexie {
  // Declare tables (property names match store names)
  categories!: Table<CategoryEntity, string>; // string is the type of the primary key (id)
  tags!: Table<TagEntity, string>; // string is the type of the primary key (id)

  constructor() {
    super('TagStoreDB'); // Database name
    this.version(1).stores({
      // Schema definition for version 1
      categories: 'id, name', // Primary key 'id', index 'name' for uniqueness checks/lookups
      tags: 'id, categoryId, name', // Primary key 'id', index 'categoryId', index 'name'
                                  // Compound index [categoryId, name] might be useful for uniqueness checks within a category
    });
    // Add more versions here if the schema evolves in the future
    // this.version(2).stores({...}).upgrade(...) 
  }
}

// Create and export a singleton instance of the database
export const db = new TagDatabase(); 