<script setup lang="ts">
import { ref, computed, onMounted, watch, h, nextTick, onUnmounted } from 'vue';
import { 
    NSelect, 
    NTreeSelect,
    NInputNumber, 
    NInput, 
    NButton, 
    NSpace, 
    NIcon,
    NCheckbox,
    NRadioGroup,
    NRadio,
    useMessage,
    NModal,
    NPopconfirm,
    NCard,
    NScrollbar,
    NTag,
    NEmpty,
    NTooltip
} from 'naive-ui';
import { 
    PricetagsOutline as TagIcon,
    LockClosedOutline as LockIcon,
    LockOpenOutline as UnlockIcon,
    FolderOpenOutline as GroupIcon,
    FolderOpenOutline,
    ArrowBackOutline as ArrowBackIcon,
    SaveOutline as SaveIcon,
    CloseCircleOutline as ClearIcon,
    ShuffleOutline as RandomIcon,
    CopyOutline as CopyIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Tag, Group, Category, DrawHistoryEntry, HistorySettings, PresetSettings } from '../../types/data';
import { useRouter } from 'vue-router';
import { filterValidTags } from '../../utils/sortHelpers';
import { useErrorHandler } from '../../services/ErrorService';
import _ from 'lodash';

const tagStore = useTagStore();
const message = useMessage();
const router = useRouter();
const settingsStore = useSettingsStore();
const { handleError } = useErrorHandler();

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

// --- 标签使用统计 ---
const tagUsageCounts = ref<Record<string, number>>({});

// --- 历史记录 ---
const historyItems = ref<DrawHistoryEntry[]>([]);

// --- 动画控制 ---
const showResults = ref(false);

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
            availableTags = filterValidTags([...tagStore.tags]);
        } else {
            availableTags = filterValidTags(tagStore.tags.filter(tag => categoryIdsToDrawFrom.includes(tag.categoryId)));
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
        handleError(error, '抽取标签');
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
        handleError(error, '重新抽取标签');
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

// 初始化
onMounted(() => {
    loadSettings();
    
    if (tagStore.tags.length === 0) {
        message.warning('当前标签库为空，请先添加标签');
    }
    
    // 添加resize监听器，用于检查文本溢出
    window.addEventListener('resize', checkForTruncatedText);
});

onUnmounted(() => {
    // 移除resize监听器
    window.removeEventListener('resize', checkForTruncatedText);
});

// 检查文本是否被截断需要在DOM渲染后进行
const checkForTruncatedText = () => {
    nextTick(() => {
        // 添加延时确保DOM完全渲染
        setTimeout(() => {
            // 对每个标签卡片进行检查
            document.querySelectorAll('.result-tag-card').forEach(card => {
                const tagId = card.getAttribute('data-tag-id');
                if (!tagId) return;
                
                // 检查名称是否截断
                const nameEl = card.querySelector('.tag-main-text');
                if (nameEl) {
                    if (nameEl.scrollHeight > nameEl.clientHeight) {
                        nameEl.classList.add('truncated');
                    } else {
                        nameEl.classList.remove('truncated');
                    }
                }
                
                // 检查副标题是否截断
                const subtitleEl = card.querySelector('.tag-subtitle');
                if (subtitleEl) {
                    if (subtitleEl.scrollHeight > subtitleEl.clientHeight) {
                        subtitleEl.classList.add('truncated');
                    } else {
                        subtitleEl.classList.remove('truncated');
                    }
                }
                
                // 检查关键词是否截断
                const keywordEl = card.querySelector('.tag-keyword');
                if (keywordEl) {
                    if (keywordEl.scrollWidth > keywordEl.clientWidth || keywordEl.scrollHeight > keywordEl.clientHeight) {
                        keywordEl.classList.add('truncated');
                    } else {
                        keywordEl.classList.remove('truncated');
                    }
                }
            });
        }, 100);
    });
};

// 当抽取的标签变化时检查文本溢出
watch(drawnTags, () => {
    nextTick(checkForTruncatedText);
}, { deep: true });

// 当显示结果变化时检查文本溢出
watch(showResults, (newVal) => {
    if (newVal) {
        nextTick(checkForTruncatedText);
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
  <div class="drawer-page-header">
    <n-button text circle size="large" class="back-btn" @click="handleBack">
      <n-icon size="24" :component="ArrowBackIcon" />
    </n-button>
  </div>
  <div class="tag-extractor-container">
    <h1 class="page-title">标签抽取器</h1>
    
    <div class="main-layout">
      <!-- 左侧面板：主操作区和设置 -->
      <div class="left-panel">
        <!-- 主操作区 -->
        <n-card title="基本设置" class="control-card">
          <n-space vertical size="large">
            <div class="input-group">
              <div class="input-label">选择分类</div>
              <n-tree-select
                v-model:value="selectedNodeKeys"
                :options="treeData"
                placeholder="选择分类（可多选）"
                multiple
                clearable
                class="full-width"
              />
            </div>
            
            <div class="input-group">
              <div class="input-label">抽取数量</div>
              <n-input-number
                v-model:value="numTagsToDraw"
                :min="minTagsToDraw"
                :max="maxTagsToDraw"
                class="number-input"
              />
            </div>
              
            <div class="input-group">
              <div class="input-label">排除关键词</div>
              <n-input 
                v-model:value="exclusionKeywords" 
                placeholder="逗号分隔，如：test,demo,忽略" 
                clearable
                class="full-width"
              />
            </div>
            
            <div class="input-group">
              <div class="input-label">抽取方式</div>
              <n-radio-group v-model:value="drawMethod" name="drawMethod" class="radio-group">
                <n-space>
                  <n-radio value="random">完全随机</n-radio>
                  <n-radio value="leastUsed">最少使用优先</n-radio>
                  <n-radio value="mostUsed">最常用优先</n-radio>
                </n-space>
              </n-radio-group>
            </div>
            
            <div class="input-group">
              <n-space>
                <n-checkbox v-model:checked="noDuplicates">禁止重复标签</n-checkbox>
                <n-checkbox v-model:checked="ensureEachSelectedCategory" :disabled="disableEnsureEachSelected">
                  平衡模式（每分类至少一个）
                </n-checkbox>
              </n-space>
            </div>
            
            <div class="action-buttons">
              <n-button
                type="primary"
                size="large"
                :loading="isDrawing"
                @click="drawTags"
                class="main-action-button"
              >
                {{ isDrawing ? '抽取中...' : '开始抽取' }}
              </n-button>
            </div>
          </n-space>
        </n-card>
        
        <!-- 预设管理 -->
        <n-card title="预设管理" class="control-card">
          <n-space vertical size="medium">
            <div class="preset-selection">
              <n-select
                v-model:value="selectedPresetName"
                :options="presetOptions"
                placeholder="选择预设"
                clearable
                @update:value="handlePresetSelectionChange"
                class="full-width"
              />
            </div>
            <n-space>
              <n-button @click="openSavePresetModal" type="info">
                <template #icon>
                  <n-icon :component="SaveIcon" />
                </template>
                保存为预设
              </n-button>
              <n-popconfirm v-if="selectedPresetName" @positive-click="deleteSelectedPreset" positive-text="确认" negative-text="取消">
                <template #trigger>
                  <n-button type="error">
                    <template #icon>
                      <n-icon :component="ClearIcon" />
                    </template>
                    删除预设
                  </n-button>
                </template>
                确认删除当前预设？
              </n-popconfirm>
            </n-space>
          </n-space>
          
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
        </n-card>
        
        <!-- 统计与重置 -->
        <n-card title="数据统计" class="control-card">
          <n-space vertical size="medium">
            <div class="stats-info">
              <div class="stat-item">
                <span class="stat-label">标签总数:</span> 
                <span class="stat-value">{{ tagCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">分类总数:</span> 
                <span class="stat-value">{{ categoryCount }}</span>
              </div>
            </div>
            <n-button @click="resetUsageCounts" type="warning">
              <template #icon>
                <n-icon :component="RandomIcon" />
              </template>
              重置标签使用统计
            </n-button>
          </n-space>
        </n-card>
      </div>
      
      <!-- 右侧面板：结果显示和历史 -->
      <div class="right-panel">
        <!-- 结果区 -->
        <n-card title="抽取结果" class="result-card">
          <template #header-extra>
            <span v-if="drawnTags.length" class="result-count">
              共 {{ drawnTags.length }} 个结果
            </span>
          </template>
          <div v-if="drawnTags.length" class="result-area">
            <n-scrollbar style="max-height: 400px">
              <div class="result-tags-grid">
                <div v-for="tag in drawnTags" :key="tag.id" class="result-tag-card" :data-tag-id="tag.id">
                  <div class="tag-main-row">
                    <n-tooltip trigger="hover" placement="top">
                      <template #trigger>
                        <span class="tag-main-text">{{ tag.name }}</span>
                      </template>
                      {{ tag.name }}
                    </n-tooltip>
                    <n-button text circle @click="() => toggleLock(tag.id)" class="lock-button">
                      <n-icon :component="lockedTagIds.has(tag.id) ? LockIcon : UnlockIcon" :size="18" />
                    </n-button>
                  </div>
                  <div v-if="tag.subtitles && tag.subtitles.length > 0" class="tag-subtitle">
                    <n-tooltip trigger="hover" placement="top">
                      <template #trigger>
                        <span>{{ tag.subtitles.join(' / ') }}</span>
                      </template>
                      {{ tag.subtitles.join(' / ') }}
                    </n-tooltip>
                  </div>
                  <div v-if="tag.keyword" class="tag-keyword">
                    <n-tooltip trigger="hover" placement="top">
                      <template #trigger>
                        <span>{{ tag.keyword }}</span>
                      </template>
                      {{ tag.keyword }}
                    </n-tooltip>
                  </div>
                </div>
              </div>
            </n-scrollbar>
            <div class="result-actions">
              <div class="action-group">
                <n-button @click="() => copyResults()" type="primary">
                  <template #icon>
                    <n-icon :component="CopyIcon" />
                  </template>
                  复制全部
                </n-button>
                <n-button @click="() => copyResults(true)">复制标签名</n-button>
              </div>
              <div class="action-group">
                <n-button @click="redrawUnlockedTags" v-if="canRedraw && !isDrawing" type="info">
                  <template #icon>
                    <n-icon :component="RandomIcon" />
                  </template>
                  重抽未锁定
                </n-button>
              </div>
            </div>
          </div>
          <n-empty v-else description="暂无抽取结果" />
        </n-card>
        
        <!-- 历史记录 -->
        <n-card title="历史记录" class="history-card">
          <template #header-extra>
            <n-button 
              @click="clearHistory" 
              size="small" 
              type="error" 
              v-if="historyItems.length > 0"
            >
              清空历史
            </n-button>
          </template>
          
          <div v-if="historyItems.length === 0" class="empty-history">暂无抽取历史记录</div>
          <n-scrollbar style="max-height: 400px" v-else>
            <div class="history-list">
              <div v-for="item in historyItems" :key="item.id" class="history-item">
                <div class="history-item-header">
                  <div class="history-timestamp">{{ formatTime(item.timestamp) }}</div>
                  <div class="history-actions">
                    <n-button text size="small" @click="() => copyHistoryItemTags(item)">
                      <template #icon>
                        <n-icon :component="CopyIcon" :size="16" />
                      </template>
                      复制
                    </n-button>
                    <n-button text size="small" @click="() => reloadFromHistory(item)" type="primary">
                      加载
                    </n-button>
                  </div>
                </div>
                <div class="history-tags">
                  <n-tag 
                    v-for="tag in item.tags" 
                    :key="tag.id" 
                    size="small" 
                    type="info" 
                    class="history-tag"
                  >
                    {{ tag.name }}
                  </n-tag>
                </div>
              </div>
            </div>
          </n-scrollbar>
        </n-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局容器样式 */
.tag-extractor-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-title {
  text-align: center;
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--n-text-color-1);
}

.drawer-page-header {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

/* 主布局 */
.main-layout {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr; /* 让左侧面板更宽 */
  gap: 24px;
}

/* 左侧面板 */
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0; /* 确保不溢出 */
}

.control-card {
  border-radius: 8px;
  width: 100%; /* 确保卡片充满容器 */
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-weight: 500;
  color: var(--n-text-color-1);
}

.full-width {
  width: 100%;
}

.number-input {
  width: 120px;
}

.radio-group {
  margin-top: 4px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.main-action-button {
  min-width: 180px;
  font-weight: 500;
}

/* 右侧面板 */
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0; /* 确保不溢出 */
}

.result-card {
  border-radius: 8px;
}

.result-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
  padding: 8px 4px;
}

.result-tag-card {
  display: flex;
  flex-direction: column;
  background: var(--n-primary-color-suppl);
  border: 1px solid var(--n-primary-color);
  border-radius: 8px;
  padding: 12px 12px 12px 14px; /* 调整内边距 */
  position: relative;
  transition: all 0.2s ease;
  height: auto; /* 自适应高度 */
  min-height: 100px; /* 最小高度 */
  max-height: 140px; /* 最大高度 */
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.result-tag-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: var(--n-primary-color-hover);
}

.tag-main-row {
  display: flex;
  align-items: flex-start; /* 改为靠上对齐 */
  justify-content: space-between;
  margin-bottom: 4px; /* 添加底部间距 */
}

.tag-main-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--n-primary-color);
  word-break: break-word;
  max-height: 63px; /* 三行高度 */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3; /* 3行 */
  -webkit-box-orient: vertical;
  padding-right: 24px;
  position: relative;
}

/* 添加淡出效果 */
.tag-main-text.truncated::after {
  content: "...";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40%; /* 更窄一些 */
  height: 22px;
  background: linear-gradient(to right, transparent, var(--n-primary-color-suppl) 80%);
  pointer-events: none;
  text-align: right;
  padding-right: 5px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.lock-button {
  color: var(--n-primary-color);
  position: absolute;
  top: 8px;
  right: 4px;
}

.tag-subtitle {
  font-size: 13px;
  color: var(--n-text-color-2);
  margin-top: 6px;
  word-break: break-word;
  max-height: 54px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  background-color: rgba(0, 0, 0, 0.02);
  padding: 3px 5px;
  border-radius: 4px;
  position: relative;
}

/* 添加淡出效果 */
.tag-subtitle.truncated::after {
  content: "...";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40%; /* 更窄一些 */
  height: 22px;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.02) 80%);
  pointer-events: none;
  text-align: right;
  padding-right: 5px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}

.tag-keyword {
  font-size: 12px;
  font-style: italic; /* 斜体显示 */
  color: var(--n-text-color-3);
  margin-top: 8px;
  word-break: break-all;
  max-height: 26px; /* 增加高度，允许两行 */
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1; /* 保持一行 */
  -webkit-box-orient: vertical;
  background-color: rgba(0, 0, 0, 0.03);
  padding: 3px 8px 3px 12px; /* 右侧留更多空间 */
  border-radius: 4px;
  position: relative;
  border-left: 2px solid var(--n-primary-color-suppl); /* 添加左侧边框 */
}

/* 添加淡出效果 */
.tag-keyword.truncated::after {
  content: "...";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 60px; /* 固定宽度 */
  height: 100%;
  background: linear-gradient(to right, transparent, rgba(0, 0, 0, 0.03) 80%);
  pointer-events: none;
  text-align: right;
  padding-right: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.result-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--n-border-color);
}

.action-group {
  display: flex;
  gap: 8px;
}

/* 历史记录 */
.history-card {
  border-radius: 8px;
}

.empty-history {
  color: var(--n-text-color-3);
  text-align: center;
  padding: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 12px;
  background-color: var(--n-color);
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-timestamp {
  font-size: 13px;
  color: var(--n-text-color-3);
}

.history-actions {
  display: flex;
  gap: 8px;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.history-tag {
  margin-right: 0;
}

/* 统计 */
.stats-info {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  color: var(--n-text-color-2);
}

.stat-value {
  font-weight: 600;
  color: var(--n-text-color-1);
}

/* 预设 */
.preset-selection {
  margin-bottom: 8px;
}

/* 结果区样式 */
.result-count {
  font-size: 14px;
  color: var(--n-text-color-2);
}
</style> 