<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, h } from 'vue';
import { 
    NSelect, 
    NInputNumber, 
    NInput, 
    NButton, 
    NSpace, 
    NList, 
    NListItem, 
    NThing, 
    NIcon,
    NPageHeader,
    NDivider,
    NCard,
    NGrid,
    NGi,
    NTag,
    NTooltip,
    NSwitch,
    NCheckbox,
    NRadioGroup,
    NRadio,
    NStatistic,
    NTabs,
    NTabPane,
    NBadge,
    useMessage,
    NModal,
    NPopconfirm,
    NInputGroup,
    NPopover,
    NEmpty,
    NScrollbar,
    NAlert,
    NSlider,
    NCollapse,
    NCollapseItem
} from 'naive-ui';
import { 
    CopyOutline as CopyIcon,
    ShuffleOutline as ShuffleIcon,
    ReloadOutline as ResetIcon,
    PricetagsOutline as TagIcon,
    SettingsOutline as SettingsIcon,
    SaveOutline as SaveIcon,
    TimeOutline as HistoryIcon,
    FlashOutline as LeastUsedIcon,
    ScaleOutline as BalanceIcon,
    TrendingUpOutline as MostUsedIcon,
    LockClosedOutline as LockIcon,
    LockOpenOutline as UnlockIcon,
    SyncOutline as RedrawIcon,
    TrashOutline as DeleteIcon,
    CloudDownloadOutline as LoadPresetIcon,
    CloudUploadOutline as SavePresetIcon,
    ChevronDownOutline as CollapseIconPreset,
    ChevronForwardOutline as ExpandIconPreset,
    CheckmarkCircleOutline as SuccessIcon,
    CloseCircleOutline as ErrorIcon,
    HelpCircleOutline as HelpIcon,
    AddOutline as AddPresetIcon,
    ColorPaletteOutline as ColorIcon,
    ColorWandOutline as DrawIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Tag, WeightedTag, Preset, DrawHistoryEntry, HistorySettings, PresetSettings /* Category */ } from '../../types/data';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '../../stores/settingsStore';
import TagGroupDisplay from '../../components/TagGroupDisplay.vue';

const tagStore = useTagStore();
const libraryStore = useLibraryStore();
const message = useMessage();
const router = useRouter();
const settingsStore = useSettingsStore();

// --- 基本组件状态 ---
const selectedCategoryIds = ref<string[]>([]);
const numTagsToDraw = ref<number>(5);
const minTagsToDraw = ref<number>(1);
const maxTagsToDraw = ref<number>(20);
const exclusionKeywords = ref<string>('');
const drawnTags = ref<Tag[]>([]);
const isDrawing = ref<boolean>(false);
const ALL_CATEGORIES_KEY = '__ALL__';
const lockedTagIds = ref<Set<string>>(new Set());

// --- 抽取预设状态 ---
interface DrawingPreset {
    name: string;
    settings: PresetSettings;
}

const presets = ref<DrawingPreset[]>([]);
const selectedPresetName = ref<string | null>(null);
const showSavePresetModal = ref<boolean>(false);
const newPresetName = ref<string>('');
const PRESETS_STORAGE_KEY = 'tagDrawerPresets';

// --- 高级功能状态 ---
const useMultiCategoryMode = ref<boolean>(false);
const ensureEachCategory = ref<boolean>(false);
const noDuplicates = ref<boolean>(true);
const drawMethod = ref<string>('random');
const saveHistory = ref<boolean>(true);
const currentTab = ref<string>('basic');

// --- 标签使用统计 ---
const tagUsageCounts = ref<Record<string, number>>({});

// --- 历史记录 ---
const historyItems = ref<DrawHistoryEntry[]>([]);

// --- 动画控制 ---
const showResults = ref(false);

// --- 计算属性 ---
const categoryOptions = computed(() => {
    const options = tagStore.categories.map(cat => ({
        label: cat.name,
        value: cat.id
    }));
    options.unshift({ label: '所有分类', value: ALL_CATEGORIES_KEY });
    return options;
});

const currentLibraryName = computed(() => {
    return libraryStore.activeLibrary?.name || '无活动库';
});

const categoryCount = computed(() => {
    return tagStore.categories.length;
});

const tagCount = computed(() => {
    return tagStore.tags.length;
});

const isMultiCategoryActive = computed(() => {
    return useMultiCategoryMode.value && selectedCategoryIds.value.length > 1;
});

const canRedraw = computed(() => {
    return drawnTags.value.length > 0 && lockedTagIds.value.size < drawnTags.value.length;
});

// Load presets from local storage
const loadPresetsFromStorage = () => {
    try {
        const savedPresets = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (savedPresets) {
            presets.value = JSON.parse(savedPresets);
        }
    } catch (error) {
        console.error('加载预设失败:', error);
        message.error('加载预设失败');
    }
};

// Save presets to local storage
const savePresetsToStorage = () => {
    try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets.value));
    } catch (error) {
        console.error('保存预设失败:', error);
        message.error('保存预设失败');
    }
};

const loadSettings = () => {
    try {
        const savedSettings = localStorage.getItem('tagDrawerSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            numTagsToDraw.value = settings.numTagsToDraw || 5;
            noDuplicates.value = settings.noDuplicates !== undefined ? settings.noDuplicates : true;
            useMultiCategoryMode.value = settings.useMultiCategoryMode || false;
            ensureEachCategory.value = settings.ensureEachCategory || false;
            drawMethod.value = settings.drawMethod || 'random';
            saveHistory.value = settings.saveHistory !== undefined ? settings.saveHistory : true;
        }
        
        // 加载使用统计
        const savedUsage = localStorage.getItem('tagUsageCounts');
        if (savedUsage) {
            tagUsageCounts.value = JSON.parse(savedUsage);
        }
        
        // 加载历史记录
        const savedHistory = localStorage.getItem('tagDrawerHistory');
        if (savedHistory) {
            historyItems.value = JSON.parse(savedHistory);
        }
        loadPresetsFromStorage(); // Load presets as well
    } catch (error) {
        console.error('加载设置或预设失败:', error);
    }
};

const saveSettings = () => {
    try {
        const settings = {
            numTagsToDraw: numTagsToDraw.value,
            noDuplicates: noDuplicates.value,
            useMultiCategoryMode: useMultiCategoryMode.value,
            ensureEachCategory: ensureEachCategory.value,
            drawMethod: drawMethod.value,
            saveHistory: saveHistory.value
        };
        localStorage.setItem('tagDrawerSettings', JSON.stringify(settings));
        message.success('设置已保存');
    } catch (error) {
        console.error('保存设置失败:', error);
        message.error('保存设置失败');
    }
};

// --- 方法 ---

// Toggle tag lock state
const toggleLock = (tagId: string) => {
    if (lockedTagIds.value.has(tagId)) {
        lockedTagIds.value.delete(tagId);
    } else {
        lockedTagIds.value.add(tagId);
    }
};

// Function to perform the actual tag selection based on method and count
const selectTags = (tags: Tag[], count: number): Tag[] => {
    if (count <= 0) return [];
    
    let selected: Tag[] = [];
    const available = [...tags]; // Work with a copy

    if (drawMethod.value === 'leastUsed') {
        const sorted = available.sort((a, b) => (tagUsageCounts.value[a.id] || 0) - (tagUsageCounts.value[b.id] || 0));
        selected = sorted.slice(0, count);
    } else if (drawMethod.value === 'mostUsed') {
        const sorted = available.sort((a, b) => (tagUsageCounts.value[b.id] || 0) - (tagUsageCounts.value[a.id] || 0));
        selected = sorted.slice(0, count);
    } else { // 'random'
        const shuffled = available.sort(() => 0.5 - Math.random());
        selected = shuffled.slice(0, count);
    }
    return selected;
};

const drawTags = async () => {
    if (isDrawing.value) return;
    
    try {
        isDrawing.value = true;
        showResults.value = false;
        lockedTagIds.value.clear(); // Clear locks on a full redraw
        
        let availableTags: Tag[] = [];
        const useAllCategories = selectedCategoryIds.value.includes(ALL_CATEGORIES_KEY) || 
                                selectedCategoryIds.value.length === 0;

        if (useAllCategories) {
            availableTags = [...tagStore.tags];
        } else {
            availableTags = tagStore.tags.filter(tag => selectedCategoryIds.value.includes(tag.categoryId));
        }

        // 排除关键词
        const keywords = exclusionKeywords.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (keywords.length > 0) {
            availableTags = availableTags.filter(tag => 
                !keywords.some(keyword => 
                    tag.name.toLowerCase().includes(keyword) || 
                    (tag.subtitles && tag.subtitles.some(sub => sub.toLowerCase().includes(keyword)))
                )
            );
        }

        if (availableTags.length === 0) {
            drawnTags.value = [];
            message.warning('没有符合条件的标签可供抽取');
            return;
        }

        // Ensure category balance (if enabled)
        if (ensureEachCategory.value && isMultiCategoryActive.value) {
            const result: Tag[] = [];
            const drawnInCategory = new Set<string>();

            // First pass: ensure each category gets one tag if possible
            for (const categoryId of selectedCategoryIds.value) {
                if (categoryId === ALL_CATEGORIES_KEY || result.length >= numTagsToDraw.value) continue;
                
                const tagsInCategory = availableTags.filter(t => t.categoryId === categoryId);
                if (tagsInCategory.length > 0) {
                     // Apply selection method within the category for the first pick
                     const chosen = selectTags(tagsInCategory, 1);
                     if(chosen.length > 0 && !drawnInCategory.has(chosen[0].id)) {
                         result.push(chosen[0]);
                         drawnInCategory.add(chosen[0].id);
                     }
                }
            }

            // Second pass: fill remaining slots
            const remainingCount = numTagsToDraw.value - result.length;
            if (remainingCount > 0) {
                const remainingAvailableTags = availableTags.filter(t => !drawnInCategory.has(t.id));
                const additionalTags = selectTags(remainingAvailableTags, remainingCount);
                result.push(...additionalTags);
            }
            
            drawnTags.value = result;
        } else {
            // Standard draw without balance
            drawnTags.value = selectTags(availableTags, numTagsToDraw.value);
        }

        // Update result state
        if (drawnTags.value.length < numTagsToDraw.value && drawnTags.value.length > 0) {
            message.info(`符合条件的标签不足 ${numTagsToDraw.value} 个，已抽取所有 ${drawnTags.value.length} 个。`);
        } else if (drawnTags.value.length === 0 && availableTags.length > 0) {
            message.warning('没有符合条件的标签可供抽取（可能被关键词排除了）');
        } else {
            message.success(`成功抽取 ${drawnTags.value.length} 个标签`);
        }
        
        // Update usage statistics
        updateTagUsage(drawnTags.value);
        
        // Save to history
        if (saveHistory.value && drawnTags.value.length > 0) {
            addToHistory(drawnTags.value);
        }
        
        // Show results
        showResults.value = true;
    } catch (error) {
        console.error('抽取标签时出错:', error);
        message.error('抽取标签失败');
    } finally {
        isDrawing.value = false;
    }
};

// Redraw unlocked tags
const redrawUnlockedTags = async () => {
    if (isDrawing.value || !canRedraw.value) return;
    
    try {
        isDrawing.value = true;
        // Don't hide results immediately, maybe animate the change?

        const lockedTags = drawnTags.value.filter(tag => lockedTagIds.value.has(tag.id));
        const numToRedraw = numTagsToDraw.value - lockedTags.length;

        if (numToRedraw <= 0) {
             message.info('All tags are locked.');
             return;
        }

        // Prepare available tags for redraw (similar logic to drawTags but exclude *all* currently drawn tags initially)
        let baseAvailableTags: Tag[] = [];
        const useAllCategories = selectedCategoryIds.value.includes(ALL_CATEGORIES_KEY) || selectedCategoryIds.value.length === 0;
        if (useAllCategories) {
            baseAvailableTags = [...tagStore.tags];
        } else {
            baseAvailableTags = tagStore.tags.filter(tag => selectedCategoryIds.value.includes(tag.categoryId));
        }

        // Apply exclusion keywords
        const keywords = exclusionKeywords.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
        if (keywords.length > 0) {
            baseAvailableTags = baseAvailableTags.filter(tag => 
                !keywords.some(keyword => 
                    tag.name.toLowerCase().includes(keyword) || 
                    (tag.subtitles && tag.subtitles.some(sub => sub.toLowerCase().includes(keyword)))
                )
            );
        }
        
        // Exclude *all* currently drawn tags (locked and unlocked) from the pool for redraw selection
        const currentDrawnIds = new Set(drawnTags.value.map(t => t.id));
        const availableForRedraw = baseAvailableTags.filter(tag => !currentDrawnIds.has(tag.id));

        if (availableForRedraw.length === 0) {
            message.warning('No more unique tags available to redraw with current filters.');
            return;
        }

        // Select new tags using the current method
        const newlyDrawnTags = selectTags(availableForRedraw, numToRedraw);

        if (newlyDrawnTags.length < numToRedraw) {
             message.info(`Could only redraw ${newlyDrawnTags.length} tags. Available pool limited.`);
        }
        
        // Combine locked and newly drawn tags
        // Ensure the order is somewhat preserved or logical (e.g., locked first)
        drawnTags.value = [...lockedTags, ...newlyDrawnTags];

        // Update usage counts ONLY for the newly drawn tags
        updateTagUsage(newlyDrawnTags);

        // Add a new history entry for the redraw result
        if (saveHistory.value && drawnTags.value.length > 0) {
            addToHistory(drawnTags.value, true); // Pass a flag indicating it's a redraw maybe?
        }

    } catch (error) {
        console.error('Error redrawing tags:', error);
        message.error('Failed to redraw tags');
    } finally {
        isDrawing.value = false;
    }
};

// Update usage statistics
const updateTagUsage = (tags: Tag[]) => {
    if (!tags.length) return;
    
    tags.forEach(tag => {
        if (!tagUsageCounts.value[tag.id]) {
            tagUsageCounts.value[tag.id] = 0;
        }
        tagUsageCounts.value[tag.id]++;
    });
    
    // 保存到本地存储
    localStorage.setItem('tagUsageCounts', JSON.stringify(tagUsageCounts.value));
};

// Add to history
const addToHistory = (tags: Tag[], isRedraw: boolean = false) => {
    // Capture current settings
    const currentSettings: HistorySettings = {
        numTags: numTagsToDraw.value,
        categories: selectedCategoryIds.value.includes(ALL_CATEGORIES_KEY) || selectedCategoryIds.value.length === 0 
                    ? ['所有分类'] 
                    : selectedCategoryIds.value.map(id => tagStore.categories.find(c => c.id === id)?.name || '未知分类'), // Store names for display
        method: drawMethod.value,
        exclusions: exclusionKeywords.value,
        multiCategory: useMultiCategoryMode.value,
        ensureBalance: ensureEachCategory.value
    };
    
    const historyItem: DrawHistoryEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        tags: [...tags],
        settings: currentSettings // Save captured settings
    };

    historyItems.value.unshift(historyItem);
    
    // 限制历史记录数量
    if (historyItems.value.length > 20) { // Keep limit consistent
        historyItems.value.pop(); // Use pop for better performance than slice
    }
    
    // 保存到本地存储
    localStorage.setItem('tagDrawerHistory', JSON.stringify(historyItems.value));
};

// 从历史记录中重新加载 (Update type)
const reloadFromHistory = (item: typeof historyItems.value[0]) => {
    drawnTags.value = [...item.tags];
    // Optional: Restore settings as well?
    // numTagsToDraw.value = item.settings.numTags;
    // selectedCategoryIds.value = item.settings.categories; // Need to map names back to IDs if storing names
    // drawMethod.value = item.settings.method;
    // exclusionKeywords.value = item.settings.exclusions;
    // useMultiCategoryMode.value = item.settings.multiCategory;
    // ensureEachCategory.value = item.settings.ensureBalance;
    showResults.value = true;
    message.success('已从历史记录加载标签');
};

// 清空历史记录
const clearHistory = () => {
    historyItems.value = [];
    localStorage.removeItem('tagDrawerHistory');
    message.success('历史记录已清空');
};

// 重置使用统计
const resetUsageCounts = () => {
    tagUsageCounts.value = {};
    localStorage.removeItem('tagUsageCounts');
    message.success('使用统计已重置');
};

// 基本控制方法
const resetForm = () => {
    selectedCategoryIds.value = [];
    numTagsToDraw.value = 5;
    exclusionKeywords.value = '';
    message.info('设置已重置');
};

const increaseCount = () => {
    if (numTagsToDraw.value < maxTagsToDraw.value) {
        numTagsToDraw.value++;
    }
};

const decreaseCount = () => {
    if (numTagsToDraw.value > minTagsToDraw.value) {
        numTagsToDraw.value--;
    }
};

const toggleMultiCategoryMode = () => {
    useMultiCategoryMode.value = !useMultiCategoryMode.value;
    if (!useMultiCategoryMode.value) {
        selectedCategoryIds.value = [];
    }
};

// 复制结果
const copyResults = (contentOnly = false) => {
    if (drawnTags.value.length === 0) {
        message.warning('没有结果可以复制');
        return;
    }
    
    let textToCopy = '';
    
    if (contentOnly) {
        textToCopy = drawnTags.value.map(tag => tag.name).join(', ');
    } else {
        textToCopy = drawnTags.value.map(tag => {
            const category = tagStore.categories.find(c => c.id === tag.categoryId)?.name || '未分类';
            let text = `【${category}】${tag.name}`;
            if (tag.subtitles && tag.subtitles.length > 0) {
                text += ` (${tag.subtitles.join(' / ')})`;
            }
            return text;
        }).join('\n');
    }
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            message.success(contentOnly ? '已复制标签名称到剪贴板' : '已复制完整结果到剪贴板');
        })
        .catch(err => {
            console.error('无法复制文本: ', err);
            message.error('复制失败');
        });
};

const handleBack = () => {
    router.push('/toolbox');
};

// 格式化时间
const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
};

// 获取标签使用次数
const getTagUsageCount = (tagId: string) => {
    return tagUsageCounts.value[tagId] || 0;
};

// 初始化
onMounted(() => {
    loadSettings();
    
    if (tagStore.tags.length === 0) {
        message.warning('当前标签库为空，请先添加标签');
    }
});

// 监听分类模式变化
watch(useMultiCategoryMode, (newValue) => {
    if (!newValue) {
        ensureEachCategory.value = false;
    }
});

// --- 计算属性 (补充) ---
const presetOptions = computed(() => {
    return presets.value.map(p => ({ label: p.name, value: p.name }));
});

// --- 预设管理方法 ---

// Gather current settings into a preset structure
const gatherCurrentSettingsForPreset = (): PresetSettings => {
    // Ensure selectedCategoryIds doesn't include ALL_CATEGORIES_KEY when saving
    const categoryIdsToSave = selectedCategoryIds.value.filter(id => id !== ALL_CATEGORIES_KEY);
    return {
        numTags: numTagsToDraw.value,
        // If 'All Categories' was implicitly selected (empty array or contains ALL_KEY), save an empty array
        categoryIds: categoryIdsToSave.length === 0 && selectedCategoryIds.value.length <= 1 ? [] : categoryIdsToSave,
        method: drawMethod.value,
        exclusions: exclusionKeywords.value,
        multiCategory: useMultiCategoryMode.value,
        ensureBalance: ensureEachCategory.value,
    };
};

// Apply settings from a chosen preset
const applyPreset = (presetName: string) => {
    const preset = presets.value.find(p => p.name === presetName);
    if (!preset) {
        message.error(`未找到预设 "${presetName}"`);
        selectedPresetName.value = null; // Deselect if not found
        return;
    }
    
    const settings = preset.settings;
    numTagsToDraw.value = settings.numTags;
    // If saved categoryIds is empty, it means 'All Categories' was intended
    selectedCategoryIds.value = settings.categoryIds.length === 0 ? [ALL_CATEGORIES_KEY] : settings.categoryIds;
    drawMethod.value = settings.method;
    exclusionKeywords.value = settings.exclusions;
    useMultiCategoryMode.value = settings.multiCategory;
    ensureEachCategory.value = settings.ensureBalance;
    
    message.success(`已加载预设 "${presetName}"`);
};

// Handle the change event from the preset NSelect
const handlePresetSelectionChange = (value: string | null) => {
    if (value) {
        applyPreset(value);
    } else {
        // Optional: Reset settings when preset is cleared?
        // resetForm(); // Or just leave settings as they are
        message.info('预设已取消选择');
    }
    // selectedPresetName is already updated by v-model
};

// Open the modal to save a new preset
const openSavePresetModal = () => {
    newPresetName.value = ''; // Clear previous input
    showSavePresetModal.value = true;
};

// Confirm saving the preset from the modal
const handleSavePresetConfirm = () => {
    const name = newPresetName.value.trim();
    if (!name) {
        message.error('预设名称不能为空');
        return; // Keep modal open
    }

    const existingPresetIndex = presets.value.findIndex(p => p.name === name);
    const currentSettings = gatherCurrentSettingsForPreset();
    
    if (existingPresetIndex !== -1) {
        // Preset exists, overwrite it
        presets.value[existingPresetIndex].settings = currentSettings;
        message.success(`预设 "${name}" 已更新`);
    } else {
        // Preset doesn't exist, add new one
        presets.value.push({ name, settings: currentSettings });
        presets.value.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
        message.success(`预设 "${name}" 已保存`);
    }
    
    savePresetsToStorage();
    selectedPresetName.value = name; // Select the newly saved/updated preset
    showSavePresetModal.value = false; // Close modal
};

// Cancel saving from the modal
const cancelSavePreset = () => {
    showSavePresetModal.value = false;
};

// Delete the currently selected preset
const deleteSelectedPreset = () => {
    if (!selectedPresetName.value) {
        message.warning('没有选择要删除的预设');
        return;
    }
    
    const nameToDelete = selectedPresetName.value;
    presets.value = presets.value.filter(p => p.name !== nameToDelete);
    savePresetsToStorage();
    message.success(`预设 "${nameToDelete}" 已删除`);
    selectedPresetName.value = null; // Deselect after deletion
};

// Copy tags from a specific history item
const copyHistoryItemTags = (item: typeof historyItems.value[0]) => {
    if (!item || !item.tags || item.tags.length === 0) {
        message.warning('此历史记录没有标签可复制');
        return;
    }
    
    // Format as comma-separated names
    const textToCopy = item.tags.map(tag => tag.name).join(', ');
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            message.success('已复制历史标签名称到剪贴板');
        })
        .catch(err => {
            console.error('无法复制历史标签: ', err);
            message.error('复制失败');
        });
};

// Watch for changes in settings that affect drawing
watch([() => settingsStore.settings.bracketType, () => settingsStore.settings.weightSeparator], () => {
    // Optionally trigger redraw or update display if needed
    // Example: redrawTags(false); // Ensure redrawTags exists if uncommented
}, { deep: true });

</script>

<template>
  <div class="tag-drawer-view">
    <n-page-header title="标签抽取器" @back="handleBack">
      <template #subtitle>
        从当前库中随机抽取标签组合，激发创作灵感
      </template>
      <template #extra>
        <n-space>
          <n-tag type="info">
            当前库: {{ currentLibraryName }}
          </n-tag>
          <n-tag type="success">
            分类: {{ categoryCount }}
          </n-tag>
          <n-tag type="warning">
            标签: {{ tagCount }}
          </n-tag>
        </n-space>
      </template>
    </n-page-header>
    <n-divider />

    <n-tabs v-model:value="currentTab" type="line" animated>
      <n-tab-pane name="basic" tab="基本设置">
        <n-grid x-gap="24" cols="1 m:2" responsive="screen">
          <!-- 左侧设置面板 -->
          <n-gi>
            <n-card title="抽取设置" class="settings-card">
              <n-space vertical size="large">

                <!-- 预设管理 -->
                <div class="setting-group preset-management">
                  <div class="setting-label">抽取预设</div>
                  <n-space align="center">
                    <n-select
                      v-model:value="selectedPresetName"
                      :options="presetOptions"
                      placeholder="加载或管理预设"
                      clearable
                      @update:value="handlePresetSelectionChange" 
                      style="flex-grow: 1; min-width: 150px;"
                    />
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <n-button @click="openSavePresetModal" circle secondary>
                          <template #icon><n-icon :component="SavePresetIcon" /></template>
                        </n-button>
                      </template>
                      保存当前设置为新预设
                    </n-tooltip>
                    <n-popconfirm
                      v-if="selectedPresetName"
                      @positive-click="deleteSelectedPreset"
                      positive-text="确认删除"
                      negative-text="取消"
                    >
                      <template #trigger>
                         <n-tooltip trigger="hover">
                            <template #trigger>
                                <n-button type="error" circle secondary>
                                <template #icon><n-icon :component="DeleteIcon" /></template>
                                </n-button>
                            </template>
                            删除选中的预设
                        </n-tooltip>
                      </template>
                      确认删除预设 "{{ selectedPresetName }}" 吗？此操作无法撤销。
                    </n-popconfirm>
                  </n-space>
                </div>
                <n-divider /> 
                <!-- 预设管理结束 -->

                <!-- 抽取数量控制 -->
                <div class="setting-group">
                  <div class="setting-label">抽取数量</div>
                  <div class="number-control">
                    <n-button secondary circle size="small" @click="decreaseCount" :disabled="numTagsToDraw <= minTagsToDraw">
                      -
                    </n-button>
                    <n-input-number
                      v-model:value="numTagsToDraw"
                      :min="minTagsToDraw"
                      :max="maxTagsToDraw"
                      class="count-input"
                    />
                    <n-button secondary circle size="small" @click="increaseCount" :disabled="numTagsToDraw >= maxTagsToDraw">
                      +
                    </n-button>
                  </div>
                </div>
                
                <!-- 分类选择模式 -->
                <div class="setting-group">
                  <n-space justify="space-between" align="center">
                    <div class="setting-label">分类选择模式</div>
                    <n-switch v-model:value="useMultiCategoryMode">
                      <template #checked>多分类</template>
                      <template #unchecked>单分类</template>
                    </n-switch>
                  </n-space>
                  
                  <!-- 分类选择 -->
                  <n-select
                    v-model:value="selectedCategoryIds"
                    :multiple="useMultiCategoryMode"
                    :options="categoryOptions"
                    placeholder="选择分类 (默认所有)"
                    clearable
                    class="mt-2"
                  />
                  
                  <!-- 分类平衡选项 -->
                  <div v-if="isMultiCategoryActive" class="balance-option mt-2">
                    <n-checkbox v-model:checked="ensureEachCategory">
                      <n-space align="center" :size="4">
                        <n-icon :component="BalanceIcon" />
                        <span>分类平衡模式（确保每个分类至少抽取一个标签）</span>
                      </n-space>
                    </n-checkbox>
                  </div>
                </div>
                
                <!-- 排除关键词 -->
                <div class="setting-group">
                  <div class="setting-label">排除关键词</div>
                  <n-input
                    v-model:value="exclusionKeywords"
                    type="text"
                    placeholder="排除关键词 (用逗号分隔)"
                    clearable
                  />
                </div>
                
                <!-- 操作按钮 -->
                <n-space justify="space-between">
                  <n-button 
                    type="primary" 
                    size="large" 
                    @click="drawTags" 
                    :loading="isDrawing"
                    :disabled="tagCount === 0"
                    style="flex: 1;"
                  >
                    <template #icon>
                      <n-icon :component="ShuffleIcon" />
                    </template>
                    {{ isDrawing ? '抽取中...' : '开始抽取' }}
                  </n-button>
                  <n-button 
                    type="default" 
                    size="large" 
                    @click="resetForm" 
                    :disabled="isDrawing"
                    secondary
                  >
                    <template #icon>
                      <n-icon :component="ResetIcon" />
                    </template>
                    重置
                  </n-button>
                </n-space>
              </n-space>
            </n-card>
          </n-gi>
          
          <!-- 右侧结果面板 -->
          <n-gi>
            <n-card 
              title="抽取结果" 
              class="results-card"
              :bordered="false"
              :segmented="{ content: true }"
            >
              <template #header-extra>
                <n-space v-if="drawnTags.length > 0">
                  <n-tooltip trigger="hover" placement="top">
                    <template #trigger>
                      <n-button text @click="redrawUnlockedTags" size="small" :disabled="!canRedraw || isDrawing"> 
                        <template #icon>
                          <n-icon :component="RedrawIcon" />
                        </template>
                        重抽未锁定
                      </n-button>
                    </template>
                    重新抽取未锁定的标签位
                  </n-tooltip>
                  <n-tooltip trigger="hover" placement="top">
                    <template #trigger>
                      <n-button text @click="copyResults(true)" size="small">
                        <template #icon>
                          <n-icon :component="CopyIcon" />
                        </template>
                        复制标签
                      </n-button>
                    </template>
                    只复制标签名称
                  </n-tooltip>
                  <n-tooltip trigger="hover" placement="top">
                    <template #trigger>
                      <n-button text @click="copyResults(false)" size="small">
                        <template #icon>
                          <n-icon :component="CopyIcon" />
                        </template>
                        复制完整
                      </n-button>
                    </template>
                    复制完整结果（包含分类和子标题）
                  </n-tooltip>
                </n-space>
              </template>
              
              <div v-if="drawnTags.length === 0" class="empty-result">
                <n-icon :component="TagIcon" size="48" class="empty-icon" />
                <div class="empty-text">点击"开始抽取"按钮随机抽取标签</div>
              </div>
              
              <transition-group 
                name="result-item" 
                tag="div" 
                class="results-list"
                v-else
              >
                <div 
                  v-for="(tag, index) in drawnTags" 
                  :key="tag.id"
                  class="result-item"
                  :style="{ animationDelay: `${index * 0.1}s` }"
                >
                  <div class="result-tag">
                    <div class="result-tag-header">
                      <div class="result-category">
                        {{ tagStore.categories.find(c => c.id === tag.categoryId)?.name || '未分类' }}
                      </div>
                      <n-button text circle size="small" @click="toggleLock(tag.id)" class="lock-button">
                        <template #icon>
                          <n-icon :component="lockedTagIds.has(tag.id) ? LockIcon : UnlockIcon" />
                        </template>
                      </n-button>
                    </div>
                    <div class="result-content">{{ tag.name }}</div>
                    <div v-if="tag.subtitles && tag.subtitles.length > 0" class="result-subtitle">
                      {{ tag.subtitles.join(' / ') }}
                    </div>
                    <div class="result-usage" v-if="getTagUsageCount(tag.id) > 0">
                      <n-tag size="small" type="info">
                        已使用 {{ getTagUsageCount(tag.id) }} 次
                      </n-tag>
                    </div>
                  </div>
                </div>
              </transition-group>
            </n-card>
          </n-gi>
        </n-grid>
      </n-tab-pane>
      
      <!-- 高级设置 -->
      <n-tab-pane name="advanced" tab="高级设置">
        <n-card title="高级设置">
          <n-space vertical size="large">
            <!-- 抽取方法 -->
            <div class="setting-group">
              <div class="setting-label">抽取方法</div>
              <n-radio-group v-model:value="drawMethod" name="drawMethod">
                <n-space>
                  <n-radio value="random">
                    <n-space :size="4" align="center">
                      <n-icon :component="ShuffleIcon" />
                      <span>完全随机</span>
                    </n-space>
                  </n-radio>
                  <n-radio value="leastUsed">
                    <n-space :size="4" align="center">
                      <n-icon :component="LeastUsedIcon" />
                      <span>最少使用优先</span>
                    </n-space>
                  </n-radio>
                  <n-radio value="mostUsed">
                    <n-space :size="4" align="center">
                      <n-icon :component="MostUsedIcon" />
                      <span>最常用优先</span>
                    </n-space>
                  </n-radio>
                </n-space>
              </n-radio-group>
            </div>
            
            <!-- 重复处理 -->
            <div class="setting-group">
              <div class="setting-label">重复标签处理</div>
              <n-checkbox v-model:checked="noDuplicates">禁止重复标签</n-checkbox>
            </div>
            
            <!-- 历史记录 -->
            <div class="setting-group">
              <div class="setting-label">历史记录</div>
              <n-checkbox v-model:checked="saveHistory">保存抽取历史</n-checkbox>
            </div>
            
            <!-- 重置统计 -->
            <div class="setting-group">
              <div class="setting-label">使用统计</div>
              <n-button @click="resetUsageCounts" type="warning" secondary size="small">
                重置所有标签使用统计
              </n-button>
            </div>
            
            <!-- 保存按钮 -->
            <n-button type="primary" @click="saveSettings">
              <template #icon>
                <n-icon :component="SaveIcon" />
              </template>
              保存设置
            </n-button>
          </n-space>
        </n-card>
      </n-tab-pane>
      
      <!-- 历史记录 -->
      <n-tab-pane name="history" tab="历史记录">
        <n-card title="抽取历史">
          <template #header-extra>
            <n-button @click="clearHistory" size="small" type="error" secondary v-if="historyItems.length > 0">
              清空历史
            </n-button>
          </template>
          
          <div v-if="historyItems.length === 0" class="empty-result">
            <n-icon :component="HistoryIcon" size="48" class="empty-icon" />
            <div class="empty-text">暂无抽取历史记录</div>
          </div>
          
          <div v-else class="history-list">
            <div v-for="item in historyItems" :key="item.id" class="history-item">
              <div class="history-header">
                <div class="history-time">{{ formatTime(item.timestamp) }}</div>
                <n-space align="center">
                  <n-button text size="small" @click="copyHistoryItemTags(item)">
                    <template #icon><n-icon :component="CopyIcon" /></template>
                    复制标签
                  </n-button>
                  <n-button text size="small" @click="reloadFromHistory(item)">
                    <template #icon><n-icon :component="RedrawIcon" /></template>
                    重新加载
                  </n-button>
                </n-space>
              </div>
              <div v-if="item.settings" class="history-settings">
                  <span>设置: {{ item.settings.numTags }}个, 方法: {{ item.settings.method || '未知' }}</span>
                  <span v-if="item.settings.categories && item.settings.categories.length > 0">, 分类: [{{ item.settings.categories.join(', ') }}]</span>
                  <span v-if="item.settings.exclusions">, 排除: "{{ item.settings.exclusions }}"</span>
                  <span v-if="item.settings.multiCategory && item.settings.ensureBalance">, 平衡模式</span>
                  <span v-else-if="item.settings.multiCategory">, 多分类</span>
              </div>
              <div v-else class="history-settings-missing">
                  <span>(旧记录，无详细设置信息)</span>
              </div>
              <div class="history-tags">
                <n-tag v-for="tag in item.tags" :key="tag.id" class="history-tag" type="info">
                  {{ tag.name }}
                </n-tag>
              </div>
            </div>
          </div>
        </n-card>
      </n-tab-pane>
    </n-tabs>

    <!-- 保存预设 Modal -->
    <n-modal 
      v-model:show="showSavePresetModal"
      preset="dialog"
      title="保存预设"
      positive-text="保存"
      negative-text="取消"
      @positive-click="handleSavePresetConfirm"
      @negative-click="cancelSavePreset"
    >
      <n-input 
        v-model:value="newPresetName"
        placeholder="输入预设名称"
        @keydown.enter.prevent="handleSavePresetConfirm" 
      />
    </n-modal>

  </div>
</template>

<style scoped>
.tag-drawer-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.settings-card, .results-card {
  height: 100%;
  min-height: 480px;
}

.settings-card {
  background-color: var(--n-card-color);
  transition: box-shadow 0.3s ease;
}

.setting-group {
  margin-bottom: 16px;
}

.setting-label {
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--n-text-color-2);
}

.number-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-input {
  flex: 1;
  text-align: center;
  width: 100px;
}

.mt-2 {
  margin-top: 8px;
}

.empty-result {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--n-text-color-3);
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  text-align: center;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 500px;
  overflow-y: auto;
  padding: 8px 4px;
}

.result-item {
  animation: slide-in 0.3s ease-out forwards;
  opacity: 0;
  transform: translateY(20px);
}

@keyframes slide-in {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-item-enter-active,
.result-item-leave-active {
  transition: all 0.3s ease;
}

.result-item-enter-from,
.result-item-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.result-tag {
  background-color: var(--n-color-hover);
  border-radius: 8px;
  padding: 12px 16px;
  transition: all 0.2s ease;
  border: 1px solid var(--n-border-color);
  position: relative;
}

.result-tag:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.result-tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.lock-button {
  margin-left: 8px;
}

.result-category {
  font-size: 13px;
  color: var(--n-primary-color);
  margin-bottom: 6px;
  font-weight: 500;
}

.result-content {
  font-size: 16px;
  color: var(--n-text-color);
  margin-bottom: 6px;
  font-weight: 500;
}

.result-subtitle {
  font-size: 13px;
  color: var(--n-text-color-3);
  font-style: italic;
  margin-bottom: 6px;
}

.result-usage {
  margin-top: 6px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.history-item {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-time {
  font-size: 13px;
  color: var(--n-text-color-3);
}

.history-settings {
    font-size: 12px;
    color: var(--n-text-color-3);
    margin-bottom: 8px;
    word-break: break-all; /* Prevent long settings from overflowing */
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-tag {
  margin-right: 0;
}

.balance-option {
  padding: 8px;
  background-color: rgba(var(--n-primary-color-rgb), 0.08);
  border-radius: 6px;
}

/* 滚动条美化 */
.results-list::-webkit-scrollbar,
.history-list::-webkit-scrollbar {
  width: 6px;
}

.results-list::-webkit-scrollbar-track,
.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.results-list::-webkit-scrollbar-thumb,
.history-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.results-list::-webkit-scrollbar-thumb:hover,
.history-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

/* 深色模式适配 */
:deep(.n-theme-dark) .results-list::-webkit-scrollbar-thumb,
:deep(.n-theme-dark) .history-list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.n-theme-dark) .results-list::-webkit-scrollbar-thumb:hover,
:deep(.n-theme-dark) .history-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tag-drawer-view {
    padding: 16px;
  }
  
  .settings-card, .results-card {
    min-height: 360px;
  }
  
  .results-card {
    margin-top: 16px;
  }
}

.preset-management {
  /* Optional: Add specific styles */
  margin-bottom: 0; /* Align with divider */
}

.history-settings-missing {
    font-size: 12px;
    color: var(--n-text-color-disabled);
    font-style: italic;
    margin-bottom: 8px;
}
</style> 