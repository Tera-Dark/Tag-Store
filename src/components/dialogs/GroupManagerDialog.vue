<script setup lang="ts">
import { ref, computed, defineProps, defineEmits, h } from 'vue';
import { 
    NModal, 
    NDataTable, 
    NButton, 
    NSpace, 
    useMessage, 
    useDialog, 
    NIcon,
    NTooltip
} from 'naive-ui';
import type { DataTableColumns, DataTableRowKey } from 'naive-ui';
import { useTagStore } from '../../stores/tagStore';
import type { Group } from '../../types/data';
import GroupDialog from './GroupDialog.vue'; // To add/edit groups

// Import icons
import { 
    AddOutline as AddIcon, 
    CreateOutline as EditIcon, 
    TrashBinOutline as DeleteIcon 
} from '@vicons/ionicons5';

// --- Props & Emits ---
interface Props {
  show: boolean;
}
const props = defineProps<Props>();

const emit = defineEmits<{ 
  (e: 'update:show', value: boolean): void;
}>();

// --- Store & Utils ---
const tagStore = useTagStore();
const message = useMessage();
const dialog = useDialog();

// --- State ---
const isLoading = ref(false);
const checkedRowKeys = ref<DataTableRowKey[]>([]); // For selecting rows in the table

// State for the embedded GroupDialog (for Add/Edit)
const showGroupDialog = ref(false);
const groupDialogMode = ref<'add' | 'edit'>('add');
const groupToEdit = ref<Group | null>(null);

// --- Computed ---
const groups = computed(() => tagStore.groups);

// Derived state for button disabling
const canEdit = computed(() => checkedRowKeys.value.length === 1);
const canDelete = computed(() => checkedRowKeys.value.length > 0);

// --- Table Setup ---
const createColumns = ({ edit, del }: { 
    edit: (row: Group) => void, 
    del: (row: Group) => void 
}): DataTableColumns<Group> => {
  return [
    {
      type: 'selection',
    },
    {
      title: '分组名称',
      key: 'name',
      sorter: 'default',
    },
    {
        title: '分类数量',
        key: 'categoryCount',
        sorter: (rowA, rowB) => (tagStore.categories.filter(c => c.groupId === rowA.id).length) - (tagStore.categories.filter(c => c.groupId === rowB.id).length),
        render: (row) => {
            return h('span', tagStore.categories.filter(c => c.groupId === row.id).length);
        }
    },
    {
      title: '操作',
      key: 'actions',
      render(row) {
        return h(NSpace, null, { 
          default: () => [
              h(NTooltip, null, {
                  trigger: () => h(NButton, { size: 'small', circle: true, type: 'default', ghost: true, onClick: () => edit(row) }, { icon: () => h(NIcon, { component: EditIcon }) }),
                  default: () => '编辑'
              }),
              h(NTooltip, null, {
                  trigger: () => h(NButton, { size: 'small', circle: true, type: 'error', ghost: true, onClick: () => del(row) }, { icon: () => h(NIcon, { component: DeleteIcon })}),
                  default: () => '删除'
              })
          ]
        });
      }
    }
  ];
};

const columns = computed(() => createColumns({ edit: handleEdit, del: handleDeleteSingle }));

// --- Methods ---
const handleClose = () => {
  emit('update:show', false);
};

// Open Add Dialog
const handleAdd = () => {
    groupToEdit.value = null; // Ensure no initial data
    groupDialogMode.value = 'add';
    showGroupDialog.value = true;
};

// Open Edit Dialog (using inline button or main Edit button)
const handleEdit = (group?: Group) => {
    const groupToEditData = group ?? tagStore.groups.find(g => g.id === checkedRowKeys.value[0]);
    if (!groupToEditData) {
        message.error('未找到要编辑的分组');
        return;
    }
    groupToEdit.value = groupToEditData;
    groupDialogMode.value = 'edit';
    showGroupDialog.value = true;
};

// Handle Deletion (using inline button or main Delete button)
const handleDelete = async () => {
    if (!canDelete.value) return;
    const groupsToDelete = tagStore.groups.filter(g => checkedRowKeys.value.includes(g.id));
    
    // Check if any selected group contains categories
    const nonEmptGroups = groupsToDelete.filter(g => tagStore.categories.some(c => c.groupId === g.id));
    if (nonEmptGroups.length > 0) {
        message.warning(`以下分组包含分类，无法删除：${nonEmptGroups.map(g => g.name).join(', ')}。请先移动或删除这些分类。`);
        return;
    }
    
    dialog.warning({
        title: '确认删除',
        content: `确定要删除选中的 ${groupsToDelete.length} 个分组吗？此操作不可撤销。`,
        positiveText: '删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            isLoading.value = true;
            try {
                // Attempt to delete all selected groups
                // Assuming deleteGroup handles errors individually if needed
                for (const group of groupsToDelete) {
                    await tagStore.deleteGroup(group.id); 
                }
                message.success(`成功删除了 ${groupsToDelete.length} 个分组`);
                checkedRowKeys.value = []; // Clear selection
            } catch (error: any) {
                message.error(`删除分组时出错: ${error.message}`);
                // Partial success might have occurred, state should reflect actual store data
            } finally {
                isLoading.value = false;
            }
        },
    });
};

// Helper for inline delete button
const handleDeleteSingle = (group: Group) => {
    checkedRowKeys.value = [group.id]; // Select the row to enable delete logic
    handleDelete(); // Call the main delete handler
}

// Handle submission from the GroupDialog (Add/Edit)
const handleGroupDialogSubmit = async (data: { mode: 'add' | 'edit'; formData: { name: string, order?: number }; groupId?: string }) => {
    isLoading.value = true;
    try {
        if (data.mode === 'add') {
            const newId = await tagStore.addGroup({ name: data.formData.name });
            if (newId) {
                message.success('分组添加成功');
                showGroupDialog.value = false; // Close inner dialog
            } 
        } else if (data.mode === 'edit' && data.groupId) {
            await tagStore.updateGroup(data.groupId, { name: data.formData.name, order: data.formData.order });
            message.success('分组更新成功');
            showGroupDialog.value = false; // Close inner dialog
        }
    } catch (error: any) {
        // Error message is likely shown by the store
        console.error("Error submitting group dialog:", error);
    } finally {
        isLoading.value = false;
    }
};

</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    title="管理分组"
    :bordered="false"
    style="max-width: 700px;"
    :mask-closable="!isLoading"
    :close-on-esc="!isLoading"
    @update:show="handleClose"
  >
    <n-spin :show="isLoading">
      <n-space vertical>
        <n-space justify="end">
          <n-button type="primary" ghost @click="handleAdd">
            <template #icon><n-icon :component="AddIcon" /></template>
            添加分组
          </n-button>
          <n-button 
            type="default" 
            ghost 
            @click="() => handleEdit()" 
            :disabled="!canEdit || isLoading"
          >
             <template #icon><n-icon :component="EditIcon" /></template>
            编辑选中
          </n-button>
          <n-button 
            type="error" 
            ghost 
            @click="handleDelete" 
            :disabled="!canDelete || isLoading"
          >
             <template #icon><n-icon :component="DeleteIcon" /></template>
            删除选中
          </n-button>
        </n-space>
        
        <n-data-table
          :columns="columns"
          :data="groups"
          :pagination="false" 
          :bordered="true"
          :row-key="(row: Group) => row.id"
          size="small"
          max-height="400"
          v-model:checked-row-keys="checkedRowKeys"
        />
      </n-space>
    </n-spin>
    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose">关闭</n-button>
      </n-space>
    </template>

    <!-- Embedded Dialog for Adding/Editing Groups -->
    <GroupDialog 
        v-model:show="showGroupDialog"
        :mode="groupDialogMode"
        :group-to-edit="groupToEdit"
        @submit="handleGroupDialogSubmit"
    />

  </n-modal>
</template>

<style scoped>
/* Add specific styles if needed */
</style> 