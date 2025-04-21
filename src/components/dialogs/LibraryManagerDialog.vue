<script setup lang="ts">
import { ref, defineProps, defineEmits, watch, computed } from 'vue';
import {
    NModal,
    NCard,
    NList,
    NListItem,
    NThing,
    NInput,
    NButton,
    NIcon,
    NSpace,
    useMessage,
    useDialog
} from 'naive-ui';
import { 
    CreateOutline as AddIcon, 
    PencilOutline as RenameIcon, 
    TrashOutline as DeleteIcon, 
    CheckmarkOutline as SaveIcon, 
    CloseOutline as CancelIcon
} from '@vicons/ionicons5';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Library } from '../../types/data';

// Props & Emits for v-model:show
const props = defineProps<{ show: boolean }>();
const emit = defineEmits(['update:show']);

// Store and UI Hooks
const libraryStore = useLibraryStore();
const message = useMessage();
const dialog = useDialog();

// Component State
const isAdding = ref(false);
const newLibraryName = ref('');
const editingLibraryId = ref<string | null>(null);
const editingName = ref('');

// Computed property for libraries
const libraries = computed(() => libraryStore.libraries);

// --- Event Handlers ---

// Close modal logic
const handleClose = () => {
    resetEditState();
    resetAddState();
    emit('update:show', false);
};

// Add New Library
const handleStartAdd = () => {
    resetEditState(); // Cancel any ongoing edit
    isAdding.value = true;
    newLibraryName.value = '';
};

const handleCancelAdd = () => {
    resetAddState();
};

const handleSaveAdd = async () => {
    const name = newLibraryName.value.trim();
    if (!name) {
        message.error('标签库名称不能为空');
        return;
    }
    try {
        await libraryStore.createLibrary({ name }, true); // Create and switch
        message.success(`标签库 "${name}" 创建成功`);
        resetAddState();
    } catch (error: any) {
        message.error(`创建失败: ${error.message}`);
    }
};

// Rename Library
const handleStartEdit = (library: Library) => {
    resetAddState(); // Cancel any ongoing add
    editingLibraryId.value = library.id;
    editingName.value = library.name;
};

const handleCancelEdit = () => {
    resetEditState();
};

const handleSaveEdit = async () => {
    if (!editingLibraryId.value) return;
    const name = editingName.value.trim();
    if (!name) {
        message.error('标签库名称不能为空');
        return;
    }
    // Check if name is unchanged?
    const originalLibrary = libraries.value.find(lib => lib.id === editingLibraryId.value);
    if (originalLibrary && originalLibrary.name === name) {
        resetEditState();
        return; // No change needed
    }

    try {
        await libraryStore.renameLibrary(editingLibraryId.value, name);
        message.success(`标签库已重命名为 "${name}"`);
        resetEditState();
    } catch (error: any) {
        message.error(`重命名失败: ${error.message}`);
    }
};

// Delete Library
const handleDelete = (library: Library) => {
    dialog.warning({
        title: '确认删除标签库',
        content: `确定要删除标签库 "${library.name}" 吗？\n这将删除该库及其包含的所有分类和标签！\n此操作无法撤销。`,
        positiveText: '确认删除',
        negativeText: '取消',
        onPositiveClick: async () => {
            try {
                await libraryStore.deleteLibrary(library.id);
                message.success(`标签库 "${library.name}" 已删除`);
                // If the deleted library was being edited, reset state
                if (editingLibraryId.value === library.id) {
                    resetEditState();
                }
            } catch (error: any) {
                message.error(`删除失败: ${error.message}`);
            }
        },
    });
};

// --- Utility Functions ---
const resetAddState = () => {
    isAdding.value = false;
    newLibraryName.value = '';
};

const resetEditState = () => {
    editingLibraryId.value = null;
    editingName.value = '';
};

// Watch for prop changes to close/reset state if modal is closed externally
watch(() => props.show, (newValue) => {
    if (!newValue) {
        resetEditState();
        resetAddState();
    }
});

</script>

<template>
    <n-modal
        :show="props.show"
        @update:show="handleClose" 
        preset="card"
        title="管理标签库"
        style="width: 600px;"
        :mask-closable="false" 
        :closable="true" 
        @close="handleClose"
    >
        <n-list bordered hoverable clickable>
            <!-- Add New Library Section -->
            <n-list-item v-if="isAdding">
                 <n-thing title="创建新标签库">
                     <n-space justify="space-between">
                         <n-input 
                            v-model:value="newLibraryName"
                            placeholder="输入新标签库名称"
                            :loading="libraryStore.isLoading"
                            @keyup.enter="handleSaveAdd"
                            clearable
                         />
                         <n-space>
                             <n-button type="primary" size="small" @click="handleSaveAdd" :loading="libraryStore.isLoading">
                                <template #icon><n-icon :component="SaveIcon" /></template>
                                保存
                            </n-button>
                            <n-button size="small" @click="handleCancelAdd" :disabled="libraryStore.isLoading">
                                 <template #icon><n-icon :component="CancelIcon" /></template>
                                取消
                            </n-button>
                         </n-space>
                     </n-space>
                 </n-thing>
            </n-list-item>
            <n-list-item v-else>
                 <n-button block type="primary" dashed @click="handleStartAdd" :disabled="editingLibraryId !== null || libraryStore.isLoading">
                     <template #icon><n-icon :component="AddIcon" /></template>
                     创建新标签库
                 </n-button>
            </n-list-item>

            <!-- Existing Libraries List -->
            <template v-if="libraries.length > 0">
                 <n-list-item v-for="library in libraries" :key="library.id">
                     <n-thing>
                        <template #header>
                           <n-space justify="space-between" align="center">
                                <!-- Editing State -->
                                <template v-if="editingLibraryId === library.id">
                                     <n-input 
                                        v-model:value="editingName"
                                        size="small" 
                                        :loading="libraryStore.isLoading"
                                        @keyup.enter="handleSaveEdit"
                                        />
                                </template>
                                <!-- Display State -->
                                <template v-else>
                                    <span :style="{ fontWeight: library.id === libraryStore.activeLibraryId ? 'bold' : 'normal' }">
                                        {{ library.name }}
                                        <span v-if="library.id === libraryStore.activeLibraryId" style="font-size: 0.8em; color: var(--n-success-color); margin-left: 5px;">(当前)</span>
                                    </span>
                                </template>

                                <!-- Action Buttons -->
                                <n-space size="small">
                                    <!-- Editing Actions -->
                                    <template v-if="editingLibraryId === library.id">
                                        <n-button text type="primary" size="small" @click="handleSaveEdit" :loading="libraryStore.isLoading">
                                            <template #icon><n-icon :component="SaveIcon" /></template>
                                        </n-button>
                                        <n-button text size="small" @click="handleCancelEdit" :disabled="libraryStore.isLoading">
                                            <template #icon><n-icon :component="CancelIcon" /></template>
                                        </n-button>
                                    </template>
                                    <!-- Display Actions -->
                                    <template v-else>
                                        <n-button text size="small" @click="handleStartEdit(library)" :disabled="isAdding || editingLibraryId !== null || libraryStore.isLoading">
                                            <template #icon><n-icon :component="RenameIcon" /></template>
                                        </n-button>
                                        <n-button 
                                            text type="error" size="small" 
                                            @click="handleDelete(library)" 
                                            :disabled="isAdding || editingLibraryId !== null || libraryStore.isLoading || libraries.length <= 1" 
                                            :title="libraries.length <= 1 ? '无法删除唯一的标签库' : '删除标签库'"
                                        >
                                            <template #icon><n-icon :component="DeleteIcon" /></template>
                                        </n-button>
                                    </template>
                                </n-space>
                            </n-space>
                        </template>
                    </n-thing>
                 </n-list-item>
             </template>
            <n-list-item v-else-if="!isAdding"> 
                 <span style="color: grey; font-style: italic;">还没有标签库，创建一个吧！</span>
             </n-list-item>
        </n-list>

        <!-- Optional: Footer for close button -->
        <template #footer>
             <n-space justify="end">
                <n-button @click="handleClose">关闭</n-button>
            </n-space>
        </template>
    </n-modal>
</template>

<style scoped>
/* Add component-specific styles if needed */
</style> 