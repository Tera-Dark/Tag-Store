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
    NDivider,
    NCheckbox,
    NRadioGroup,
    NRadio,
    useMessage,
    NModal,
    NPopconfirm,
    NCollapse,
    NCollapseItem
} from 'naive-ui';
import { 
    PricetagsOutline as TagIcon,
    LockClosedOutline as LockIcon,
    LockOpenOutline as UnlockIcon,
    FolderOpenOutline as GroupIcon,
    FolderOpenOutline,
    ArrowBackOutline as ArrowBackIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import type { Tag, Group, Category, DrawHistoryEntry, HistorySettings, PresetSettings } from '../../types/data';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '../../stores/settingsStore';

const tagStore = useTagStore();
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
  <div class="tag-drawer-minimal">
    <h2 class="drawer-h2">标签抽取器</h2>
    <n-divider style="margin-bottom: 24px; margin-top: 8px;" />
    <!-- 主操作区 -->
    <div class="main-controls">
      <n-tree-select
        v-model:value="selectedNodeKeys"
        :options="treeData"
        placeholder="选择分类（可多选）"
        multiple
        clearable
        style="width: 100%;"
      />
      <n-input-number
        v-model:value="numTagsToDraw"
        :min="minTagsToDraw"
        :max="maxTagsToDraw"
        placeholder="抽取数量"
        style="width: 100%;"
      />
      <n-button
        type="primary"
        size="large"
        block
        :loading="isDrawing"
        @click="drawTags"
        style="margin-top: 12px;"
      >
        {{ isDrawing ? '抽取中...' : '开始抽取' }}
      </n-button>
    </div>

    <!-- 结果区 -->
    <div v-if="drawnTags.length" class="result-area">
      <div class="result-tags">
        <div v-for="tag in drawnTags" :key="tag.id" class="result-tag-card">
          <div class="tag-main-row">
            <span class="tag-main-text">{{ tag.name }}</span>
            <n-button text circle size="tiny" @click="() => toggleLock(tag.id)" style="margin-left:4px;">
              <n-icon :component="lockedTagIds.has(tag.id) ? LockIcon : UnlockIcon" />
            </n-button>
          </div>
          <div v-if="tag.keyword" class="tag-keyword">{{ tag.keyword }}</div>
        </div>
      </div>
      <n-space justify="center" style="margin-top: 8px;">
        <n-button size="small" @click="() => copyResults()">复制全部</n-button>
        <n-button size="small" @click="() => copyResults(true)">仅复制标签名</n-button>
        <n-button size="small" @click="redrawUnlockedTags" v-if="canRedraw && !isDrawing">重抽未锁定</n-button>
      </n-space>
    </div>

    <!-- 辅助功能区：极简折叠面板 -->
    <n-collapse class="minimal-collapse" :default-expanded-names="[]" style="margin-top:32px;">
      <n-collapse-item title="高级设置" name="settings">
        <n-space vertical size="large">
          <n-input v-model:value="exclusionKeywords" placeholder="排除关键词（逗号分隔）" clearable style="max-width: 300px;" />
          <n-radio-group v-model:value="drawMethod" name="drawMethod">
            <n-space>
              <n-radio value="random">完全随机</n-radio>
              <n-radio value="leastUsed">最少使用优先</n-radio>
              <n-radio value="mostUsed">最常用优先</n-radio>
            </n-space>
          </n-radio-group>
          <n-space>
            <n-checkbox v-model:checked="noDuplicates">禁止重复标签</n-checkbox>
            <n-checkbox v-model:checked="ensureEachSelectedCategory" :disabled="disableEnsureEachSelected">平衡模式（每分类至少一个）</n-checkbox>
          </n-space>
        </n-space>
      </n-collapse-item>
      <n-collapse-item title="预设管理" name="presets">
        <n-space vertical size="large">
          <n-select
            v-model:value="selectedPresetName"
            :options="presetOptions"
            placeholder="选择预设"
            clearable
            @update:value="handlePresetSelectionChange"
            style="max-width: 200px;"
          />
          <n-space>
            <n-button @click="openSavePresetModal" size="small">保存当前设置为预设</n-button>
            <n-popconfirm v-if="selectedPresetName" @positive-click="deleteSelectedPreset" positive-text="确认" negative-text="取消">
              <template #trigger>
                <n-button size="small" type="error">删除当前预设</n-button>
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
      </n-collapse-item>
      <n-collapse-item title="历史记录" name="history">
        <n-space vertical size="large">
          <n-button @click="clearHistory" size="small" type="error" v-if="historyItems.length > 0">清空历史</n-button>
          <div v-if="historyItems.length === 0" style="color:#888;">暂无抽取历史记录</div>
          <div v-else>
            <div v-for="item in historyItems" :key="item.id" style="margin-bottom:12px;">
              <div style="font-size:13px;color:#888;">{{ formatTime(item.timestamp) }}</div>
              <n-space>
                <n-button text size="tiny" @click="() => copyHistoryItemTags(item)">复制标签</n-button>
                <n-button text size="tiny" @click="() => reloadFromHistory(item)">重新加载</n-button>
              </n-space>
              <div style="margin-top:4px;">
                <n-tag v-for="tag in item.tags" :key="tag.id" size="small" type="info">{{ tag.name }}</n-tag>
              </div>
            </div>
          </div>
        </n-space>
      </n-collapse-item>
      <n-collapse-item title="统计与重置" name="stats">
        <n-space vertical size="large">
          <div>标签总数：{{ tagCount }}，分类总数：{{ categoryCount }}</div>
          <n-button @click="resetUsageCounts" size="small" type="warning">重置标签使用统计</n-button>
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<style scoped>
.tag-drawer-minimal {
  max-width: 420px;
  margin: 48px auto 0 auto;
  padding: 32px 12px 64px 12px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.04);
}
.tag-drawer-minimal h2 {
  text-align: center;
  font-weight: 600;
  margin-bottom: 28px;
  letter-spacing: 1px;
}
.main-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.result-area {
  margin-top: 32px;
  text-align: center;
}
.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-bottom: 8px;
}
.result-tag-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 10px;
  padding: 10px 18px 6px 18px;
  min-width: 90px;
  margin-bottom: 0;
}
.tag-main-row {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #389e0d;
}
.tag-main-text {
  margin-right: 2px;
}
.tag-keyword {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
  word-break: break-all;
}
</style> 