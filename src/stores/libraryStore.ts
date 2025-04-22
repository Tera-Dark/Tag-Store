import { defineStore } from 'pinia';
import { ref, computed /* watch */ } from 'vue';
import * as StorageService from '../services/StorageService';
import type { Library } from '../types/data';
import { useTagStore } from './tagStore'; // Needed to re-initialize tagStore on library change

const ACTIVE_LIBRARY_ID_STORAGE_KEY = 'tagstore_active_library_id';
const DEFAULT_LIBRARY_NAME = "默认标签库";

export const useLibraryStore = defineStore('libraryStore', () => {
  // --- State ---
  const libraries = ref<Library[]>([]);
  const activeLibraryId = ref<string | null>(null);
  const isLoading = ref<boolean>(false); // Loading state for library operations

  // --- Getters ---
  const activeLibrary = computed<Library | null>(() => {
    if (!activeLibraryId.value) return null;
    return libraries.value.find(lib => lib.id === activeLibraryId.value) || null;
  });

  // --- Actions ---

  // Load libraries from DB, set active library (create default if none exist)
  const initializeLibraries = async (): Promise<boolean> => { // Return boolean: true if default library was created
    console.log("Initializing library store...");
    isLoading.value = true;
    let defaultCreated = false; // Flag for default creation
    try {
      const loadedLibraries = await StorageService.getAllLibraries();
      libraries.value = loadedLibraries;

      let targetLibraryId: string | null = null;

      // 1. Try loading saved active ID from localStorage
      try {
        targetLibraryId = localStorage.getItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
        // Validate if the saved ID still exists
        if (targetLibraryId && !libraries.value.some(lib => lib.id === targetLibraryId)) {
          targetLibraryId = null; // Invalid ID, reset
          localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY);
        }
      } catch (e) { console.error("Failed to load active library ID from localStorage", e); }

      // 2. If no valid saved ID, use the first library
      if (!targetLibraryId && libraries.value.length > 0) {
        targetLibraryId = libraries.value[0].id;
      }

      // 3. If still no library, create a default one
      if (!targetLibraryId) {
        console.log("No libraries found, creating default library...");
        const defaultLibId = await createLibrary({ name: DEFAULT_LIBRARY_NAME }, false); // Create without switching yet
        targetLibraryId = defaultLibId;
        defaultCreated = true; // Set flag
        // We need to fetch libraries again after creation
        libraries.value = await StorageService.getAllLibraries();
      }
      
      // Set the active library ID
      await switchLibrary(targetLibraryId); // Use switchLibrary to save and trigger effects

    } catch (error) {
      console.error("Failed to initialize libraries:", error);
      // Handle error state if needed
    } finally {
      isLoading.value = false;
       console.log("Library store initialized. Active ID:", activeLibraryId.value);
    }
    return defaultCreated; // Return the flag
  };

  // Create a new library
  const createLibrary = async (libraryData: Omit<Library, 'id'>, switchToNew: boolean = true): Promise<string> => {
     isLoading.value = true;
     try {
         // Check for duplicate name? Maybe add later or rely on DB constraints if set
         const newId = await StorageService.addLibrary(libraryData);
         const newLibrary = await StorageService.getLibraryById(newId);
         if (newLibrary) {
             libraries.value.push(newLibrary);
             libraries.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
             if (switchToNew) {
                 await switchLibrary(newId);
             }
         }
         return newId;
     } catch (error) {
          console.error("Failed to create library:", error);
          throw error; // Re-throw for component level handling
     } finally {
        isLoading.value = false;
     }
  };

  // Switch the active library
  const switchLibrary = async (libraryId: string | null) => {
     if (libraryId && libraries.value.some(lib => lib.id === libraryId)) {
         activeLibraryId.value = libraryId;
         try {
            localStorage.setItem(ACTIVE_LIBRARY_ID_STORAGE_KEY, libraryId);
         } catch (e) { console.error("Failed to save active library ID", e); }
         console.log(`Switched active library to: ${libraryId}`);
         // IMPORTANT: Trigger re-initialization of tagStore for the new library
         const tagStore = useTagStore();
         await tagStore.initializeStore(); 
     } else if (libraryId === null) {
         // Handle switching to "no library" state if applicable
         activeLibraryId.value = null;
          try { localStorage.removeItem(ACTIVE_LIBRARY_ID_STORAGE_KEY); } catch(e) {}
          const tagStore = useTagStore();
          await tagStore.clearLocalState(); // Add method to clear tagStore state
     } else {
         console.warn(`Attempted to switch to invalid library ID: ${libraryId}`);
         // Optionally switch to a default or the first available library
         if (libraries.value.length > 0) {
             await switchLibrary(libraries.value[0].id);
         } else {
             await switchLibrary(null); // No libraries left
         }
     }
  };

   // Delete a library
  const deleteLibrary = async (libraryId: string) => {
      if (!libraryId) return;
      // Prevent deleting the last library? Maybe not necessary, allow empty state.
      // if (libraries.value.length <= 1) { throw new Error("Cannot delete the last library."); }

      isLoading.value = true;
      try {
          await StorageService.deleteLibrary(libraryId);
          libraries.value = libraries.value.filter(lib => lib.id !== libraryId); // Update local state

          // If the deleted library was the active one, switch to another
          if (activeLibraryId.value === libraryId) {
              const nextLibraryId = libraries.value.length > 0 ? libraries.value[0].id : null;
              await switchLibrary(nextLibraryId);
          }
      } catch (error) {
           console.error(`Failed to delete library ${libraryId}:`, error);
           throw error;
      } finally {
          isLoading.value = false;
      }
  };

  // Rename library (Example - might need more update methods later)
   const renameLibrary = async (libraryId: string, newName: string) => {
       if (!libraryId || !newName.trim()) return;
       isLoading.value = true;
       try {
           await StorageService.updateLibrary(libraryId, { name: newName.trim() });
           // Update local state
           const index = libraries.value.findIndex(lib => lib.id === libraryId);
           if (index !== -1) {
               libraries.value[index].name = newName.trim();
               libraries.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
           }
       } catch(error) {
            console.error(`Failed to rename library ${libraryId}:`, error);
            throw error;
       } finally {
            isLoading.value = false;
       }
   };


  // --- Return ---
  return {
    libraries,
    activeLibraryId,
    isLoading,
    activeLibrary,
    initializeLibraries,
    createLibrary,
    switchLibrary,
    deleteLibrary,
    renameLibrary,
  };
}); 