// src/services/TagDatabase.ts

import Dexie, { type Table } from 'dexie';
import type { Library, Group, Category, Tag } from '../types/data';

// Define the entity types, potentially identical to the main types for now
export interface GroupEntity extends Group {}
export interface CategoryEntity extends Category {}
export interface TagEntity extends Tag {}

/**
 * Dexie database class definition for TagStore.
 */
export class TagDatabase extends Dexie {
  // Declare tables with their types
  libraries!: Table<Library, string>; // Added libraries table (ID is string UUID)
  groups!:    Table<Group, string>;    // Added groups table
  categories!: Table<Category, string>; // ID is string UUID
  tags!:       Table<Tag, string>;       

  constructor() {
    super('TagDatabase'); // Database name
    this.version(1).stores({
      // Initial schema (kept for potential upgrades, but new structure is in v2)
      categories: 'id, name', 
      tags: 'id, categoryId, name, keyword',
    });
    // Define version 2 with the new structure including libraries and libraryId
    this.version(2).stores({
        libraries: 'id, name', // Primary key: id, Index on: name (for uniqueness? maybe later)
        categories: 'id, libraryId, name', // Primary key: id, Index on: libraryId, name
        tags: 'id, libraryId, categoryId, name, keyword' // Primary key: id, Index on: libraryId, categoryId, name, keyword
    });
    // Define version 3 with the new structure including groups, hierarchical structure
    this.version(3).stores({
        libraries: 'id, name', // Unchanged
        groups:    'id, libraryId, name, order', // New table: PK id, Index libraryId, name, order
        categories:'id, groupId, name', // Changed: PK id, Index groupId, name (removed libraryId)
        tags:      'id, categoryId, name, keyword' // Changed: PK id, Index categoryId, name, keyword (removed libraryId)
    });

    // Could add upgrade logic here if migrating data from v1 to v2 was necessary
    // this.version(2).upgrade(tx => { ... });
  }
}

// Create a singleton instance of the database
export const db = new TagDatabase(); 