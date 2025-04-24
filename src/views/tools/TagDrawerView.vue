<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { 
    NSelect, 
    NTreeSelect,
    NInputNumber, 
    NInput, 
    NButton, 
    NSpace, 
    NIcon,
    NPageHeader,
    NDivider,
    NCard,
    NGrid,
    NGi,
    NTag,
    NTooltip,
    NCheckbox,
    NRadioGroup,
    NRadio,
    NTabs,
    NTabPane,
    useMessage,
    NModal,
    NPopconfirm
} from 'naive-ui';
import { 
    CopyOutline as CopyIcon,
    ShuffleOutline as ShuffleIcon,
    ReloadOutline as ResetIcon,
    PricetagsOutline as TagIcon,
    TimeOutline as HistoryIcon,
    FlashOutline as LeastUsedIcon,
    TrendingUpOutline as MostUsedIcon,
    LockClosedOutline as LockIcon,
    LockOpenOutline as UnlockIcon,
    SyncOutline as RedrawIcon,
    TrashOutline as DeleteIcon,
    CloudUploadOutline as SavePresetIcon,
    FolderOpenOutline as GroupIcon,
    FolderOpenOutline,
    RefreshOutline as RefreshIcon,
    ImageOutline as ImageIcon,
    ChevronDownOutline as CollapseIcon,
    AddCircleOutline as AddIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Tag, Group, Category, DrawHistoryEntry, HistorySettings, PresetSettings } from '../../types/data';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '../../stores/settingsStore';

const tagStore = useTagStore();
const libraryStore = useLibraryStore();
const message = useMessage();
const router = useRouter();
const settingsStore = useSettingsStore();

// --- 基本组件状态 ---
const selectedNodeKeys = ref<string[]>([]);
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

// --- 高级功能状态 (Renamed ensureEachCategory) ---
const useMultiCategoryMode = ref<boolean>(false);
const ensureEachSelectedCategory = ref<boolean>(false);
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

// --- Computed style for action bar ---
const actionBarStyle = computed(() => ({
  left: settingsStore.isSidebarCollapsed ? '64px' : '240px'
}));

// --- 计算属性 ---
const treeData = computed(() => {
    const groupMap = new Map<string, { group: Group; categories: Category[] }>();
    tagStore.groups.forEach(g => groupMap.set(g.id, { group: g, categories: [] }));
    tagStore.categories.forEach(c => {
        const groupData = groupMap.get(c.groupId);
        if (groupData) {
            groupData.categories.push(c);
        }
    });
    groupMap.forEach(gData => gData.categories.sort((a, b) => a.name.localeCompare(b.name)));
    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || a.group.name.localeCompare(b.group.name));

    const groupOptions = sortedGroups.map(gData => ({
        label: gData.group.name,
        key: `group-${gData.group.id}`,
        icon: () => h(NIcon, null, { default: () => h(GroupIcon) }),
        children: gData.categories.map(cat => ({
            label: cat.name,
            key: cat.id,
            icon: () => h(NIcon, null, { default: () => h(TagIcon) })
        }))
    }));

    const options: Array<any> = [
        {
            label: '所有分类',
            key: ALL_CATEGORIES_KEY,
            icon: () => h(NIcon, null, { default: () => h(FolderOpenOutline) })
        },
        ...groupOptions
    ];

    return options;
});

const finalSelectedCategoryIds = computed((): string[] => {
    const keys = selectedNodeKeys.value;
    if (!keys || keys.length === 0 || keys.includes(ALL_CATEGORIES_KEY)) {
        return tagStore.categories.map(cat => cat.id);
    }

    const finalIds = new Set<string>();

    keys.forEach(key => {
        if (key.startsWith('group-')) {
            const groupId = key.substring('group-'.length);
            tagStore.categories.forEach(cat => {
                if (cat.groupId === groupId) {
                    finalIds.add(cat.id);
                }
            });
        } else if (key !== ALL_CATEGORIES_KEY) {
            finalIds.add(key);
        }
    });

    return Array.from(finalIds);
});

const explicitlySelectedCategoryIds = computed((): string[] => {
    const keys = selectedNodeKeys.value;
    if (!keys || keys.length === 0 || keys.includes(ALL_CATEGORIES_KEY)) {
        return [];
    }

    const finalIds = new Set<string>();
    keys.forEach(key => {
        if (!key.startsWith('group-') && key !== ALL_CATEGORIES_KEY) {
            finalIds.add(key);
        }
    });
    return Array.from(finalIds);
});

const disableEnsureEachSelected = computed(() => {
    const keys = selectedNodeKeys.value;
    return !keys || keys.length === 0 || keys.includes(ALL_CATEGORIES_KEY) || explicitlySelectedCategoryIds.value.length === 0;
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
            ensureEachSelectedCategory.value = settings.ensureEachSelectedCategory || false;
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

// Watch settings changes and save automatically to localStorage
watch([numTagsToDraw, noDuplicates, useMultiCategoryMode, ensureEachSelectedCategory, drawMethod, saveHistory], () => {
    try {
        const settings = {
            numTagsToDraw: numTagsToDraw.value,
            noDuplicates: noDuplicates.value,
            useMultiCategoryMode: useMultiCategoryMode.value,
            ensureEachSelectedCategory: ensureEachSelectedCategory.value,
            drawMethod: drawMethod.value,
            saveHistory: saveHistory.value
        };
        localStorage.setItem('tagDrawerSettings', JSON.stringify(settings));
        // Optional: Add a subtle saving indicator or remove success message for auto-save
        // message.success('设置已自动保存'); 
    } catch (error) {
        console.error('自动保存设置失败:', error);
        // message.error('自动保存设置失败'); // Avoid spamming errors
    }
}, { deep: true });

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
        lockedTagIds.value.clear();
        
        let availableTags: Tag[] = [];
        const categoryIdsToDrawFrom = finalSelectedCategoryIds.value;
        const useAllCategories = categoryIdsToDrawFrom.length === tagStore.categories.length && tagStore.categories.length > 0;

        if (useAllCategories) {
            availableTags = [...tagStore.tags];
        } else {
            availableTags = tagStore.tags.filter(tag => categoryIdsToDrawFrom.includes(tag.categoryId));
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
            isDrawing.value = false;
            return;
        }

        let finalDrawnTags: Tag[] = [];
        const specificCategoryIds = explicitlySelectedCategoryIds.value;

        if (ensureEachSelectedCategory.value && specificCategoryIds.length > 0) {
            const result: Tag[] = [];
            const drawnTagIds = new Set<string>();
            const availableTagsForBalancing = [...availableTags];

            for (const categoryId of specificCategoryIds) {
                if (result.length >= numTagsToDraw.value) break;
                
                const tagsInCategory = availableTagsForBalancing.filter(t => t.categoryId === categoryId && !drawnTagIds.has(t.id));
                if (tagsInCategory.length > 0) {
                     const chosen = selectTags(tagsInCategory, 1);
                     if(chosen.length > 0) {
                         result.push(chosen[0]);
                         drawnTagIds.add(chosen[0].id);
                     }
                }
            }

            const remainingCount = numTagsToDraw.value - result.length;
            if (remainingCount > 0) {
                const remainingAvailableTags = availableTags.filter(t => !drawnTagIds.has(t.id));
                if (remainingAvailableTags.length > 0) {
                    const additionalTags = selectTags(remainingAvailableTags, remainingCount);
                    result.push(...additionalTags);
                    additionalTags.forEach(t => drawnTagIds.add(t.id)); 
                }
            }
            
            finalDrawnTags = result;
        } else {
            finalDrawnTags = selectTags(availableTags, numTagsToDraw.value);
        }

        drawnTags.value = finalDrawnTags;

        if (drawnTags.value.length < numTagsToDraw.value && drawnTags.value.length > 0) {
            message.info(`符合条件的标签不足 ${numTagsToDraw.value} 个，已抽取所有 ${drawnTags.value.length} 个。`);
        } else if (drawnTags.value.length === 0 && availableTags.length > 0) {
            message.warning('没有符合条件的标签可供抽取（可能被关键词或平衡条件排除了）');
        } else if (drawnTags.value.length > 0) {
            message.success(`成功抽取 ${drawnTags.value.length} 个标签`);
        }
        
        updateTagUsage(drawnTags.value);
        
        if (saveHistory.value && drawnTags.value.length > 0) {
            addToHistory(drawnTags.value);
        }
        
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
        const categoryIdsToUse = finalSelectedCategoryIds.value;
        const useAllCategories = categoryIdsToUse.length === tagStore.categories.length && tagStore.categories.length > 0;
        if (useAllCategories) {
            baseAvailableTags = [...tagStore.tags];
        } else {
            baseAvailableTags = tagStore.tags.filter(tag => categoryIdsToUse.includes(tag.categoryId));
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
            addToHistory(drawnTags.value);
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
const addToHistory = (tags: Tag[]) => {
    // Capture current settings
    const currentSettings: HistorySettings = {
        numTags: numTagsToDraw.value,
        categories: finalSelectedCategoryIds.value,
        method: drawMethod.value,
        exclusions: exclusionKeywords.value,
        multiCategory: useMultiCategoryMode.value,
        ensureBalance: ensureEachSelectedCategory.value
    };
    
    const historyItem: DrawHistoryEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        tags: [...tags],
        settings: currentSettings // Save captured settings
    };

    historyItems.value.unshift(historyItem);
    
    // <<< Use history size from store >>>
    const maxHistory = settingsStore.settings.tagDrawerHistorySize || 20; // Use default if store value invalid
    if (historyItems.value.length > maxHistory) { 
        historyItems.value.length = maxHistory; // More efficient than pop in loop
    }
    
    // 保存到本地存储
    localStorage.setItem('tagDrawerHistory', JSON.stringify(historyItems.value));
};

// 从历史记录中重新加载 (Update type)
const reloadFromHistory = (item: typeof historyItems.value[0]) => {
    drawnTags.value = [...item.tags];
    selectedNodeKeys.value = [];
    exclusionKeywords.value = item.settings.exclusions;
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
    selectedNodeKeys.value = [];
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
        ensureEachSelectedCategory.value = false;
    }
});

// --- 计算属性 (补充) ---
const presetOptions = computed(() => {
    return presets.value.map(p => ({ label: p.name, value: p.name }));
});

// --- 预设管理方法 ---

// Gather current settings into a preset structure
const gatherCurrentSettingsForPreset = (): PresetSettings => {
    return {
        numTags: numTagsToDraw.value,
        categoryIds: finalSelectedCategoryIds.value,
        method: drawMethod.value,
        exclusions: exclusionKeywords.value,
        multiCategory: useMultiCategoryMode.value,
        ensureBalance: ensureEachSelectedCategory.value,
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
    selectedNodeKeys.value = [];
    message.info("应用预设：分类选择已重置");
    drawMethod.value = settings.method;
    exclusionKeywords.value = settings.exclusions;
    useMultiCategoryMode.value = settings.multiCategory;
    ensureEachSelectedCategory.value = settings.ensureBalance;
    
    message.success(`已加载预设 "${presetName}"`);
};

// Handle the change event from the preset NSelect
const handlePresetSelectionChange = (value: string | null) => {
    if (value) {
        applyPreset(value);
    } else {
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
// @ts-ignore - Suppressing error due to potential incomplete type inference for settingsStore.settings
watch([() => settingsStore.settings.bracketType, () => settingsStore.settings.weightSeparator], () => {
    // Optionally trigger redraw or update display if needed
    // Example: redrawTags(false);
}, { deep: true });

</script>

<template>
  <div class="tag-drawer-view" style="padding-bottom: 80px;">
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
      <n-tab-pane name="basic" tab="抽取设置">
        <n-grid x-gap="24" cols="1 m:2" responsive="screen">
          <!-- 左侧设置面板 -->
          <n-gi>
            <n-card title="设置" class="settings-card">
              <n-scrollbar style="max-height: calc(100vh - 250px);" trigger="hover">
                <n-space vertical size="large" style="padding-right: 10px;"> 
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

                  <!-- 抽取数量控制 (Enhanced) -->
                  <div class="setting-group number-control-group">
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
                  
                  <!-- 分类选择 -->
                  <div class="setting-group">
                      <div class="setting-label">抽取范围</div>
                      <n-tree-select
                          v-model:value="selectedNodeKeys"
                          :options="treeData"
                          multiple
                          cascade
                          checkable
                          clearable
                          placeholder="选择分组或分类 (默认全部)"
                          size="small" 
                          style="width: 100%;" 
                          max-tag-count="responsive"
                          fallback-option-value="__FALLBACK__" 
                      />
                      <!-- NEW Checkbox -->
                      <n-checkbox 
                        v-model:checked="ensureEachSelectedCategory"
                        :disabled="disableEnsureEachSelected"
                        class="mt-2"
                      >
                        确保每个选中分类至少一个
                      </n-checkbox>
                      <n-tooltip trigger="hover" v-if="disableEnsureEachSelected">
                        <template #trigger>
                          <span style="margin-left: 4px; color: var(--n-text-color-disabled); cursor: help;">(?)</span>
                        </template>
                        选择"所有分类"或未选择具体分类时禁用此选项。
                      </n-tooltip>
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

                  <n-divider />
                  
                  <!-- MOVED FROM ADVANCED: 抽取方法 -->
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
                  
                  <!-- MOVED FROM ADVANCED: 重复处理 & 历史记录 -->
                  <div class="setting-group">
                    <div class="setting-label">其他选项</div>
                    <n-space>
                      <n-checkbox v-model:checked="noDuplicates">禁止重复标签</n-checkbox>
                      <n-checkbox v-model:checked="saveHistory">保存抽取历史</n-checkbox>
                    </n-space>
                  </div>
                </n-space>
              </n-scrollbar>
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
                  :style="{ transitionDelay: `${index * 0.07}s` }"
                >
                  <div class="result-tag">
                    <div class="result-tag-header">
                      <n-space align="center" :wrap-item="false" :size="4">
                        <div class="result-category">
                          {{ tagStore.categories.find(c => c.id === tag.categoryId)?.name || '未分类' }}
                        </div>
                        <n-tag 
                          v-for="subtitle in (tag.subtitles || [])" 
                          :key="subtitle"
                          type="default" 
                          size="tiny" 
                          round
                          class="subtitle-tag"
                        >
                          {{ subtitle }}
                        </n-tag>
                      </n-space>
                      <n-button text circle size="small" @click="toggleLock(tag.id)" class="lock-button">
                        <template #icon>
                          <n-icon :component="lockedTagIds.has(tag.id) ? LockIcon : UnlockIcon" />
                        </template>
                      </n-button>
                    </div>
                    <div class="result-content">{{ tag.name }}</div>
                    <div class="result-subtitle">
                      {{ tag.keyword || '' }} 
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
      
      <!-- 高级设置 (Content adjusted) -->
      <n-tab-pane name="advanced" tab="数据管理">
        <n-card title="数据管理">
          <n-space vertical size="large">
            <!-- 重置统计 -->
            <div class="setting-group">
              <div class="setting-label">使用统计</div>
              <n-popconfirm @positive-click="resetUsageCounts">
                <template #trigger>
                  <n-button type="warning" secondary size="small">
                    重置所有标签使用统计
                  </n-button>
                </template>
                确认要重置所有标签的使用次数统计吗？此操作不可逆。
              </n-popconfirm>
            </div>
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

    <!-- Fixed Action Bar -->
    <div class="fixed-action-bar" :style="actionBarStyle">
      <n-button 
        type="primary" 
        size="large" 
        @click="drawTags" 
        :loading="isDrawing"
        :disabled="tagCount === 0"
        style="min-width: 150px; margin-right: 12px;"
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
        quaternary
        style="margin-right: 24px;"
      >
        <template #icon>
          <n-icon :component="ResetIcon" />
        </template>
        重置设置
      </n-button>

      <n-tooltip trigger="hover" placement="top">
        <template #trigger>
          <n-button 
            text 
            @click="copyResults(true)" 
            size="large"
            :disabled="drawnTags.length === 0"
            style="margin-left: 24px;"
          >
            <template #icon>
              <n-icon :component="CopyIcon" />
            </template>
            复制标签
          </n-button>
        </template>
        只复制标签名称 (逗号分隔)
      </n-tooltip>

      <n-tooltip trigger="hover" placement="top">
        <template #trigger>
          <n-button 
            text 
            @click="copyResults(false)" 
            size="large"
            :disabled="drawnTags.length === 0"
            style="margin-left: 12px;"
          >
            <template #icon>
              <n-icon :component="CopyIcon" />
            </template>
            复制完整
          </n-button>
        </template>
        复制完整结果 (含分类/子标题)
      </n-tooltip>
    </div>

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
  min-height: calc(100vh - 220px); 
}

.settings-card .n-scrollbar-content {
  padding-right: 10px;
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

.number-control-group {
  padding: 10px;
  background-color: var(--n-action-color);
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-divider-color);
}

.number-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-input {
  flex-grow: 1;
  text-align: center;
  min-width: 80px;
}

.number-control .count-input :deep(input) {
  font-size: 1.4em;
  font-weight: bold;
  text-align: center;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.number-control .n-button--small {
  width: 30px;
  height: 30px;
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
  transition: opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.result-item-enter-from,
.result-item-leave-to {
  opacity: 0;
  transform: translateY(25px) scale(0.9);
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
  align-items: flex-start;
  margin-bottom: 6px;
}

.result-category {
  font-size: 13px;
  color: var(--n-primary-color);
  font-weight: 500;
  white-space: normal;
  line-height: 1.3;
}

.subtitle-tag {
  background-color: var(--n-action-color);
  color: var(--n-text-color-3);
}

.lock-button {
  margin-left: 8px;
  flex-shrink: 0;
}

.result-content {
  font-size: 16px;
  margin-bottom: 4px;
  font-weight: 500;
}

.result-subtitle {
  font-size: 13px;
  color: var(--n-text-color-3);
  font-style: normal;
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
    word-break: break-all;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-tag {
  margin-right: 0;
}

.history-settings-missing {
    font-size: 12px;
    color: var(--n-text-color-disabled);
    font-style: italic;
    margin-bottom: 8px;
}

.results-card .n-card-header__extra {
  flex-shrink: 0;
}

/* Fixed Action Bar */
.fixed-action-bar {
  position: fixed;
  bottom: 0;
  right: 0;
  height: 64px;
  background-color: var(--n-card-color);
  border-top: 1px solid var(--n-border-color);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 24px;
  z-index: 10;
  transition: left 0.3s var(--n-bezier), background-color 0.3s var(--n-bezier), border-color 0.3s var(--n-bezier);
}

@media (max-width: 768px) {
  .tag-drawer-view {
    padding: 16px;
    padding-bottom: 80px;
  }
  
  .settings-card, .results-card {
    min-height: auto;
  }
  
  .results-card {
    margin-top: 16px;
  }

  .fixed-action-bar {
    height: auto;
    min-height: 56px;
    padding: 8px 16px;
    left: 0 !important;
  }

  .fixed-action-bar .n-button {
     padding-left: 10px;
     padding-right: 10px;
     margin-bottom: 4px;
  }
  .fixed-action-bar .n-button--large {
      height: 40px;
      font-size: 14px;
  }
  .fixed-action-bar .n-divider--vertical {
      display: none;
  }
}
</style> 