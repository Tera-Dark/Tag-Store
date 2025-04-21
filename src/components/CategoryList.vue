<script setup lang="ts">
import { h, ref, computed } from 'vue';
import type { VNodeChild } from 'vue';
import { useTagStore } from '../stores/tagStore';
import { NMenu, NIcon, NButton, NDropdown, useMessage, useDialog, NSpace } from 'naive-ui';
import type { MenuOption, DropdownOption } from 'naive-ui';
import CategoryDialog from './dialogs/CategoryDialog.vue';
import type { Category } from '../types/data';
// Import icons
import { 
    ListOutline as ListIcon, 
    AlbumsOutline as CategoryIcon, 
    EllipsisVertical as MoreIcon
} from '@vicons/ionicons5';

const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

// Dialog state for EDIT/DELETE 
const showDialog = ref(false);
const dialogMode = ref<'add' | 'edit'>('edit'); // Default to edit as Add is external
const categoryToEdit = ref<Category | null>(null);

// Icon rendering function - now using imported icons
function renderVIcon(icon: any): () => VNodeChild {
  return () => h(NIcon, null, { default: () => h(icon) });
}

function renderMenuIcon(option: MenuOption) {
  // Use the icon component passed in the option or a default
  return option.icon ? option.icon() : renderVIcon(CategoryIcon)(); 
}

function renderMenuLabel(option: MenuOption) {
  // If it's a category (not "all"), add dropdown for actions
  if (option.key !== 'all') {
    const dropdownOptions: DropdownOption[] = [
      { label: '编辑分类', key: 'edit' },
      { label: '删除分类', key: 'delete', props: { style: 'color: red;' } },
    ];
    return h('div', { style: 'display: flex; justify-content: space-between; align-items: center; width: 100%;' }, [
      h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, option.label as string),
      h(NDropdown, {
        trigger: 'click',
        options: dropdownOptions,
        placement: 'right-start',
        onClickoutside: (e: MouseEvent) => { e.stopPropagation(); }, // Prevent closing menu
        onSelect: (key) => handleActionSelect(key as 'edit' | 'delete', option.key as string),
        style: 'margin-left: 8px;'
      }, {
        default: () => h(NButton, { 
            text: true, 
            size: 'tiny', 
            style: 'opacity: 0.6;' , 
            onClick: (e) => e.stopPropagation() 
          }, { 
            icon: renderVIcon(MoreIcon) // Use More icon
          })
      })
    ]);
  } else {
    return option.label as string; // Just the label for "All Categories"
  }
}

// Generate menu options from categories
const menuOptions = computed<MenuOption[]>(() => {
  const options: MenuOption[] = [
    {
      label: '所有分类',
      key: 'all', 
      icon: renderVIcon(ListIcon), // Use List icon
    },
  ];

  tagStore.allCategories.forEach((category) => {
    options.push({
      label: category.name,
      key: category.id,
      icon: renderVIcon(CategoryIcon), // Use Category icon
    });
  });

  return options;
});

// Determine the currently selected menu key
const selectedKey = computed(() => {
  return tagStore.filterCategoryId === null ? 'all' : tagStore.filterCategoryId;
});

// Handle menu item selection
const handleUpdateValue = (key: string) => {
  const categoryId = key === 'all' ? null : key;
  tagStore.setFilterCategory(categoryId);
};

// Handle actions from the dropdown
const handleActionSelect = (action: 'edit' | 'delete', categoryId: string) => {
    const category = tagStore.allCategories.find(c => c.id === categoryId);
    if (!category) return;
    if (action === 'edit') {
        handleEditCategory(category);
    } else if (action === 'delete') {
        handleDeleteCategory(category);
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
        content: `确定要删除分类 "${category.name}" 吗？其下的所有标签也将被删除。此操作不可撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            try {
                await tagStore.deleteCategory(category.id);
                message.success(`分类 "${category.name}" 已删除`);
            } catch (error: any) {
                message.error(`删除失败: ${error.message}`);
            }
        },
    });
};

// Handle Dialog Submission
const handleDialogSubmit = async (data: { mode: 'add' | 'edit'; formData: { name: string }; categoryId?: string }) => {
  try {
    if (data.mode === 'edit' && data.categoryId) {
      await tagStore.updateCategory(data.categoryId, { name: data.formData.name });
      message.success('分类更新成功');
    } 
    showDialog.value = false; 
  } catch (error: any) {
    message.error(`操作失败: ${error.message}`);
  }
};

</script>

<template>
  <div class="category-menu-container">
    <n-menu
      :options="menuOptions"
      :collapsed-width="64" 
      :collapsed-icon-size="22"
      :indent="18"
      :value="selectedKey"
      :render-label="renderMenuLabel" 
      :render-icon="renderMenuIcon"
      @update:value="handleUpdateValue"
      style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; border: none;" 
    />
  
    <!-- Category Dialog (Only for Edit/Delete initiated from this component) -->
    <CategoryDialog
      v-if="dialogMode !== 'add'" 
      v-model:show="showDialog"
      :mode="dialogMode"
      :category-to-edit="categoryToEdit"
      @submit="handleDialogSubmit"
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