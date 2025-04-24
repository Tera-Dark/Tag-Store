<script setup lang="ts">
import { h, ref, computed, defineProps } from 'vue';
import type { VNodeChild } from 'vue';
import { useTagStore } from '../stores/tagStore';
import { NMenu, NIcon, NButton, NDropdown, useMessage, useDialog } from 'naive-ui';
import type { MenuOption, DropdownOption } from 'naive-ui';
import CategoryDialog from './dialogs/CategoryDialog.vue';
import GroupDialog from './dialogs/GroupDialog.vue';
import MoveCategoryDialog from './dialogs/MoveCategoryDialog.vue';
import type { Category, Group } from '../types/data';
// Import icons
import { 
    ListOutline as ListIcon, 
    AlbumsOutline as CategoryIcon, 
    EllipsisVertical as MoreIcon,
    FolderOpenOutline as GroupIcon,
    CreateOutline as EditIcon,
    TrashBinOutline as DeleteIcon,
    MoveOutline as MoveIcon
} from '@vicons/ionicons5';

// --- Props --- Define and type the collapsed prop
interface Props {
  collapsed: boolean;
}
const props = defineProps<Props>(); // Define props

const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

// Dialog state for EDIT/DELETE 
const showDialog = ref(false);
const dialogMode = ref<'add' | 'edit'>('edit'); // Default to edit as Add is external
const categoryToEdit = ref<Category | null>(null);

// Dialog state for Group ADD/EDIT
const showGroupDialog = ref(false);
const groupDialogMode = ref<'add' | 'edit'>('add');
const groupToEdit = ref<Group | null>(null);

// Dialog state for Category MOVE
const showMoveDialog = ref(false);
const categoryToMove = ref<Category | null>(null);

// Icon rendering function
function renderVIcon(icon: any): () => VNodeChild {
  return () => h(NIcon, null, { default: () => h(icon) });
}

// Render appropriate icon based on type
function renderMenuIcon(option: MenuOption) {
  if (option.key === 'all') return renderVIcon(ListIcon)();
  if (option.type === 'group') return renderVIcon(GroupIcon)();
  return renderVIcon(CategoryIcon)(); 
}

// Render label with dropdown for BOTH categories and groups
function renderMenuLabel(option: MenuOption) {
  const isAll = option.key === 'all';
  const isGroup = option.type === 'group';

  if (!isAll) { // Add dropdown for groups and categories
    const dropdownOptions: DropdownOption[] = [];
    if (isGroup) {
        dropdownOptions.push({ label: '编辑分组', key: 'edit-group', icon: renderVIcon(EditIcon) });
        dropdownOptions.push({ label: '删除分组', key: 'delete-group', icon: renderVIcon(DeleteIcon), props: { style: 'color: red;' } });
    } else {
        dropdownOptions.push({ label: '编辑分类', key: 'edit-category', icon: renderVIcon(EditIcon) });
        dropdownOptions.push({ label: '移动分类', key: 'move-category', icon: renderVIcon(MoveIcon) });
        dropdownOptions.push({ label: '删除分类', key: 'delete-category', icon: renderVIcon(DeleteIcon), props: { style: 'color: red;' } });
    }

    return h('div', { style: 'display: flex; justify-content: space-between; align-items: center; width: 100%;' }, [
      h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, option.label as string),
      h(NDropdown, {
        trigger: 'click',
        options: dropdownOptions,
        placement: 'right-start',
        onClickoutside: (e: MouseEvent) => { e.stopPropagation(); }, 
        onSelect: (key) => handleActionSelect(key as string, option.key as string),
        style: 'margin-left: 8px;'
      }, {
        default: () => h(NButton, { text: true, size: 'tiny', style: 'opacity: 0.6;' , onClick: (e) => e.stopPropagation() }, 
          { icon: renderVIcon(MoreIcon) })
      })
    ]);
  } else {
    return option.label as string; // Label for "All"
  }
}

// Generate menu options with GROUPS
const menuOptions = computed<MenuOption[]>(() => {
  const groupMap = new Map<string, { group: Group; categories: Category[] }>();
  tagStore.groups.forEach(g => groupMap.set(g.id, { group: g, categories: [] }));
  tagStore.categories.forEach(c => {
    const groupData = groupMap.get(c.groupId);
    if (groupData) {
        groupData.categories.push(c);
    } else {
        // Handle categories without a group (optional, maybe add to a default group)
        console.warn(`Category ${c.name} (${c.id}) has invalid or missing groupId: ${c.groupId}`);
        // Maybe create an 'Uncategorized' virtual group if needed
    }
  });
  // Sort categories within groups
  groupMap.forEach(gData => gData.categories.sort((a, b) => a.name.localeCompare(b.name)));
  // Sort groups
  const sortedGroups = Array.from(groupMap.values())
      .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || a.group.name.localeCompare(b.group.name));

  const options: MenuOption[] = [
    {
      label: '所有分类',
      key: 'all', 
      icon: renderVIcon(ListIcon),
    },
  ];

  // Build nested menu structure
  sortedGroups.forEach(gData => {
      options.push({
          label: gData.group.name,
          key: `group-${gData.group.id}`, // Use prefix to identify group keys
          type: 'group', // <<< Add type identifier
          icon: renderVIcon(GroupIcon),
          children: gData.categories.map(cat => ({
              label: cat.name,
              key: cat.id,
              icon: renderVIcon(CategoryIcon),
              // Add render functions if needed for children, or inherit
          }))
      });
  });

  return options;
});

// Determine the currently selected menu key (prioritize category selection)
const selectedKey = computed(() => {
    if (tagStore.filterCategoryId) {
        // If a specific category is selected, highlight it
        return tagStore.filterCategoryId;
    } else if (tagStore.filterGroupId) {
        // If no specific category, but a group is selected, highlight the group
        return `group-${tagStore.filterGroupId}`;
    } else {
        // Otherwise, highlight "All"
        return 'all';
    }
});

// Handle menu item selection (distinguish group vs category)
const handleUpdateValue = (key: string) => {
    if (key === 'all') {
        tagStore.setFilter(null, null); // Clear both group and category
    } else if (key.startsWith('group-')) {
        const groupId = key.substring('group-'.length);
        tagStore.setFilter(groupId, null); // Set group, clear category
    } else {
        const categoryId = key;
        const category = tagStore.categories.find(c => c.id === categoryId);
        if (category) {
             tagStore.setFilter(category.groupId, categoryId); // Set both group and category
        } else {
             tagStore.setFilter(null, null); // Fallback if category not found (should not happen)
        }
    }
};

// Handle actions from the dropdown (distinguish group/category actions)
const handleActionSelect = (actionKey: string, itemKey: string) => {
    if (actionKey === 'edit-category') {
        const category = tagStore.categories.find(c => c.id === itemKey);
        if (category) handleEditCategory(category);
    } else if (actionKey === 'delete-category') {
        const category = tagStore.categories.find(c => c.id === itemKey);
        if (category) handleDeleteCategory(category);
    } else if (actionKey === 'move-category') {
        const category = tagStore.categories.find(c => c.id === itemKey);
        if (category) handleMoveCategory(category);
    } else if (actionKey === 'edit-group') {
        const groupId = itemKey.substring('group-'.length);
        const group = tagStore.groups.find(g => g.id === groupId);
        if (group) handleEditGroup(group);
    } else if (actionKey === 'delete-group') {
        const groupId = itemKey.substring('group-'.length);
        const group = tagStore.groups.find(g => g.id === groupId);
        if (group) handleDeleteGroup(group);
    }
};

// Open Edit Dialog
const handleEditCategory = (category: Category) => {
    dialogMode.value = 'edit';
    categoryToEdit.value = category;
    showDialog.value = true;
};

// Handle Delete Confirmation and Action
const handleDeleteCategory = (category: Category) => {
    dialog.warning({
        title: '确认删除',
        content: `确定要删除分类 "${category.name}" 及其下的所有标签吗？此操作不可撤销。`,
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            try {
                await tagStore.deleteCategory(category.id);
                message.success(`分类 "${category.name}" 已删除`);
                // If the deleted category was selected, clear filter
                if (tagStore.filterCategoryId === category.id) {
                    tagStore.setFilter(null, null);
                }
            } catch (error: any) { 
                message.error(`删除分类失败: ${error.message}`);
            }
        },
    });
};

// Open Move Dialog
const handleMoveCategory = (category: Category) => {
    categoryToMove.value = category;
    showMoveDialog.value = true;
};

// Handle Category Edit/Add Dialog Submission
const handleCategoryDialogSubmit = async (data: { 
    mode: 'add' | 'edit'; 
    formData: { name: string, groupId?: string | null }; // Allow null for groupId from form
    categoryId?: string 
}) => {
  try {
    if (data.mode === 'add') {
        // Add Category logic (handled by TagManagementView now)
        message.warning('Add category logic should be handled in parent view.'); 
    } else if (data.mode === 'edit' && data.categoryId) {
        // Construct the changes object carefully
        const changes: Partial<Omit<Category, 'id'>> = {
            name: data.formData.name,
        };

        // --- Get the original category to compare groupId ---
        const originalCategory = tagStore.categories.find(c => c.id === data.categoryId);

        // --- Only include groupId in changes if it's provided AND different from original ---
        // Check if groupId is provided (not null or undefined) in the form data
        const formGroupId = data.formData.groupId === null ? undefined : data.formData.groupId;
        if (formGroupId !== undefined && originalCategory && formGroupId !== originalCategory.groupId) {
             // Add groupId to changes only if it has actually changed
            changes.groupId = formGroupId;
        } else if (formGroupId === undefined && originalCategory && originalCategory.groupId === undefined) {
            // edge case: if formGroupId is undefined, and originalCategory.groupId was already undefined, do nothing
        } else if (formGroupId === undefined && originalCategory && originalCategory.groupId !== undefined) {
           // edge case: formGroupId is undefined but originalCategory.groupId was defined. This implies clearing the group.
           // Depending on desired behavior, you might set changes.groupId = undefined or throw an error if clearing is not allowed.
           // For now, we assume the dialog prevents this or it's not intended.
           console.warn('Attempting to clear groupId during category edit. Ignoring.');
        }


        // Only proceed if there are actual changes (at least name changed)
        if (Object.keys(changes).length > 0) {
            await tagStore.updateCategory(data.categoryId, changes);
            message.success('分类更新成功');
        } else {
            message.info('未检测到更改');
        }
    } 
    showDialog.value = false; 
  } catch (error: any) {
    message.error(`分类操作失败: ${error.message}`);
    // Keep dialog open on error?
  }
};

// Handle Move Category Dialog Submission
const handleMoveDialogSubmit = async (targetGroupId: string) => {
    if (!categoryToMove.value) return;
    const categoryId = categoryToMove.value.id;
    try {
        await tagStore.updateCategory(categoryId, { groupId: targetGroupId });
        message.success(`分类 "${categoryToMove.value.name}" 已移动`);
        showMoveDialog.value = false;
        // Optional: Update filter if the moved category was selected
        // tagStore.setFilter(targetGroupId, categoryId); 
    } catch (error: any) {
        message.error(`移动分类失败: ${error.message}`);
        // Keep dialog open on error?
    }
};

// --- Group Actions ---
const handleEditGroup = (group: Group) => {
    groupToEdit.value = group;
    groupDialogMode.value = 'edit';
    showGroupDialog.value = true;
};

const handleDeleteGroup = (group: Group) => {
    dialog.warning({
        title: '确认删除分组',
        content: `确定要删除分组 "${group.name}" 及其下的所有分类和标签吗？此操作不可撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            try {
                await tagStore.deleteGroup(group.id);
                message.success(`分组 "${group.name}" 已删除`);
                // If the deleted group was selected, clear filter
                if (tagStore.filterGroupId === group.id) {
                     tagStore.setFilter(null, null);
                }
            } catch (error: any) { 
                message.error(`删除分组失败: ${error.message}`);
            }
        },
    });
};

// Handle Group Add/Edit Dialog Submission (called from GroupDialog emit)
const handleGroupDialogSubmit = async (data: { mode: 'add' | 'edit'; formData: { name: string }; groupId?: string }) => {
  try {
    let resultId: string | null = null;
    if (data.mode === 'add') {
        resultId = await tagStore.addGroup({ name: data.formData.name });
        if (resultId) message.success('分组添加成功');
    } else if (data.mode === 'edit' && data.groupId) {
      await tagStore.updateGroup(data.groupId, { name: data.formData.name });
      message.success('分组更新成功');
    } 
    if (resultId !== null || data.mode === 'edit') { // Close only on success or edit
        showGroupDialog.value = false; 
    }
  } catch (error: any) {
    // Error is handled by tagStore, message already shown likely
    // message.error(`分组操作失败: ${error.message}`);
  }
};

</script>

<template>
  <div class="category-menu-container">
    <n-menu
      :options="menuOptions"
      :collapsed="props.collapsed"
      :collapsed-width="64"
      :collapsed-icon-size="22"
      :indent="18"
      :value="selectedKey"
      :render-label="renderMenuLabel"
      :render-icon="renderMenuIcon"
      @update:value="handleUpdateValue"
      style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; border: none;" 
      key-field="key"
      label-field="label"
      children-field="children"
    />
  
    <!-- Category Edit Dialog -->
    <CategoryDialog
      v-model:show="showDialog"
      mode="edit" 
      :category-to-edit="categoryToEdit"
      @submit="handleCategoryDialogSubmit"
    />

    <!-- Group Add/Edit Dialog -->
    <GroupDialog 
      v-model:show="showGroupDialog"
      :mode="groupDialogMode"
      :group-to-edit="groupToEdit"
      @submit="handleGroupDialogSubmit"
    />

    <!-- Move Category Dialog -->
    <MoveCategoryDialog 
      v-model:show="showMoveDialog" 
      :category-to-move="categoryToMove" 
      :available-groups="tagStore.groups" 
      @submit="handleMoveDialogSubmit"
    />

  </div>
</template>

<style scoped>
.category-menu-container {
  height: 100%; 
  display: flex;
  flex-direction: column;
}
</style> 