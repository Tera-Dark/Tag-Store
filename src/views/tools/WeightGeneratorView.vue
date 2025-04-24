<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
    NCheckbox,
    NCollapse,
    NCollapseItem,
    NSlider,
    useMessage
} from 'naive-ui';
import { 
    CopyOutline as CopyIcon,
    AddOutline as AddIcon,
    ReloadOutline as ResetIcon,
    PricetagsOutline as TagIcon,
    SaveOutline as SaveIcon,
    TrashOutline as ClearIcon,
    ScaleOutline as WeightIcon,
    ListOutline as ListIcon,
    ShuffleOutline as RandomIcon,
    TextOutline as InputIcon,
    SettingsOutline as SettingsIcon,
    RefreshOutline as ResetAllIcon,
    DocumentTextOutline as TemplateIcon,
    ChevronDownOutline as CollapseIcon,
    InformationCircleOutline as InfoIcon,
    TimeOutline as HistoryIcon,
    FolderOpenOutline as GroupIcon,
    Star as StarIconFilled,
    StarOutline as StarIconOutline,
    AddCircleOutline as IncreaseIcon,
    RemoveCircleOutline as DecreaseIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Tag, Group, Category } from '../../types/data';
import { useRouter } from 'vue-router';

type TemplateType = 'sd' | 'mj' | 'cn' | 'comfy' | 'custom';
type TemplateConfig = {
    name: string;
    template: string;
    tagFormat: string;
    separator: string;
    description: string;
};

const tagStore = useTagStore();
const message = useMessage();
const router = useRouter();
const settingsStore = useSettingsStore();

// --- 基本组件状态 ---
const selectedCategoryId = ref<string | null>(null);
const searchTerm = ref<string>('');
const selectedTags = ref<Tag[]>([]);
const generatedPrompt = ref<string>('');
const tagLayout = ref<'vertical' | 'grid'>('grid'); // 标签布局：垂直列表或网格
const isReady = ref(false);

// --- 文本输入模式 ---
const inputText = ref<string>('');
const customTagsHolder = ref<Array<{id: string; name: string; keyword?: string; isFromLibrary?: boolean}>>([]);

// --- 新增：文本转换高级设置状态 ---
const extractionSettings = ref({
  delimiters: ',\n\t',
  trimWhitespace: true,    // 默认去除首尾空格
  removeEmpty: true,       // 默认移除空标签
  caseSensitiveMatch: false, // 默认不区分大小写匹配库
  duplicateHandling: 'keepFirst' as 'keepFirst' | 'keepAll' | 'mergeWeights' // 默认去重（保留第一个）
});
const showExtractionSettings = ref(false); // 控制高级设置显隐
const showHistory = ref(false); // Control history visibility

// --- 新增：历史记录状态 ---
const extractionHistory = ref<string[]>([]); // 只存储原始输入文本
const MAX_HISTORY_ITEMS = 10;

// --- 括号设置 ---
type BracketType = 'none' | 'round' | 'square' | 'curly' | 'angle';
const bracketTypes = [
  { label: '无', value: 'none', example: 'tag' },
  { label: '( )', value: 'round', example: '()' },
  { label: '[ ]', value: 'square', example: '[]' },
  { label: '{ }', value: 'curly', example: '{}' },
  { label: '< >', value: 'angle', example: '<>' }
];
const tagBrackets = ref<{[key: string]: BracketType}>({});
const defaultBracket = ref<BracketType>('none');
// 添加括号嵌套次数
const bracketNesting = ref<{[key: string]: number}>({});
const defaultNesting = ref<number>(0);

// --- 权重设置 ---
const defaultWeight = ref<number>(1.0);
const minWeight = ref<number>(0.5);
const maxWeight = ref<number>(1.5);
const decimalPlaces = ref<number>(1); // 添加小数位数设置
const weightPresets = ref<{[key: string]: number}>({
    '加强': 1.2,
    '标准': 1.0,
    '减弱': 0.8,
    '隐含': 0.5
});
const tagWeights = ref<{[key: string]: number}>({});
const activeTemplate = ref<TemplateType>('sd');

// --- 模板设置 ---
const templates = ref<Record<TemplateType, TemplateConfig>>({
    'sd': {
        name: 'Stable Diffusion',
        template: '{{tags}}',
        tagFormat: '({{name}}:{{weight}})',
        separator: ', ',
        description: '适用于 Stable Diffusion 的格式，如: (tag1:1.2), tag2, (tag3:0.8)'
    },
    'mj': {
        name: 'Midjourney',
        template: '{{tags}}',
        tagFormat: '{{name}} --w {{weight}}',
        separator: ' ',
        description: 'Midjourney 格式，如: tag1 --w 1.2 tag2 tag3 --w 0.8'
    },
    'cn': {
        name: 'ControlNet',
        template: '{{tags}}',
        tagFormat: '({{name}}:{{weight}})',
        separator: ', ',
        description: 'ControlNet 格式，类似 Stable Diffusion'
    },
    'comfy': {
        name: 'ComfyUI',
        template: '{{tags}}',
        tagFormat: '({{name}}:{{weight}})',
        separator: ', ',
        description: 'ComfyUI 格式，类似 Stable Diffusion'
    },
    'custom': {
        name: '自定义',
        template: '{{tags}}',
        tagFormat: '{{name}}:{{weight}}',
        separator: ', ',
        description: '自定义格式，可以根据需要修改'
    }
});

// --- 本地存储状态 (扩展以包含新设置和历史) ---
const globalNestingCount = ref<number>(0);

const favoriteTagIds = ref<Set<string>>(new Set());

const defaultExpandedNames = ref<string[]>([]);

const saveSettings = () => {
    try {
        // 格式化所有要保存的权重值
        const formattedDefaultWeight = formatNumberByDecimalPlaces(defaultWeight.value, decimalPlaces.value);
        const formattedMinWeight = formatNumberByDecimalPlaces(minWeight.value, decimalPlaces.value);
        const formattedMaxWeight = formatNumberByDecimalPlaces(maxWeight.value, decimalPlaces.value);
        
        // 格式化权重预设
        const formattedPresets: {[key: string]: number} = {};
        for (const preset in weightPresets.value) {
            formattedPresets[preset] = formatNumberByDecimalPlaces(weightPresets.value[preset], decimalPlaces.value);
        }
        
        const settings = {
            defaultWeight: formattedDefaultWeight,
            minWeight: formattedMinWeight,
            maxWeight: formattedMaxWeight,
            decimalPlaces: decimalPlaces.value,
            weightPresets: formattedPresets,
            activeTemplate: activeTemplate.value,
            templates: templates.value,
            defaultBracket: defaultBracket.value,
            defaultNesting: defaultNesting.value,
            tagLayout: tagLayout.value,
            // 保存文本转换设置
            extractionSettings: extractionSettings.value,
            extractionHistory: extractionHistory.value, // 保存历史记录
            globalNestingCount: globalNestingCount.value,
            selectedCategoryId: selectedCategoryId.value
        };
        localStorage.setItem('weightGeneratorSettings', JSON.stringify(settings));
        message.success('设置已保存');
    } catch (error) {
        console.error('保存设置失败:', error);
        message.error('保存设置失败');
    }
};

const loadSettings = () => {
    try {
        const savedSettings = localStorage.getItem('weightGeneratorSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            defaultWeight.value = settings.defaultWeight || 1.0;
            minWeight.value = settings.minWeight || 0.5;
            maxWeight.value = settings.maxWeight || 1.5;
            decimalPlaces.value = settings.decimalPlaces || 1; // 加载小数位数设置
            weightPresets.value = settings.weightPresets || {
                '加强': 1.2,
                '标准': 1.0,
                '减弱': 0.8,
                '隐含': 0.5
            };
            activeTemplate.value = settings.activeTemplate || 'sd';
            defaultBracket.value = settings.defaultBracket || 'none';
            defaultNesting.value = settings.defaultNesting || 0;
            tagLayout.value = settings.tagLayout || 'grid';
            
            // 加载文本转换设置
            if (settings.extractionSettings) {
                extractionSettings.value = { ...extractionSettings.value, ...settings.extractionSettings };
            }
            // 加载历史记录
            if (settings.extractionHistory && Array.isArray(settings.extractionHistory)) {
                 extractionHistory.value = settings.extractionHistory.slice(0, MAX_HISTORY_ITEMS);
            }
            
            // 合并模板设置，保留默认的同时更新自定义设置
            if (settings.templates && settings.templates.custom) {
                templates.value.custom = settings.templates.custom;
            }
            globalNestingCount.value = settings.globalNestingCount || 0;
            selectedCategoryId.value = settings.selectedCategoryId === null ? '' : (settings.selectedCategoryId || '');
        }
    } catch (error) {
        console.error('加载设置失败:', error);
        // 不提示错误，避免干扰
    }
};

// Auto-save settings on change
watch(
  [
    defaultWeight, minWeight, maxWeight, decimalPlaces, weightPresets,
    activeTemplate, templates, defaultBracket, defaultNesting,
    tagLayout, extractionSettings, globalNestingCount
  ],
  saveSettings,
  { deep: true }
);

// --- 计算属性 ---
const categoryOptions = computed(() => {
    return tagStore.categories.map(cat => ({
        label: cat.name,
        value: cat.id
    }));
});

const tagsViewMode = ref<'grid' | 'list'>('grid'); // Restore view mode state

// Modify filteredTags to group by Group -> Category
const groupedFilteredTags = computed(() => {
    // Start with tags filtered by category selection and search term
    const baseFilteredTags = tagStore.tags.filter(t => {
        // Category Filter: Handle null/empty string for 'All Categories'
        const categoryMatch = !selectedCategoryId.value || t.categoryId === selectedCategoryId.value;
        // Search Term Filter
        const searchMatch = !searchTerm.value || 
                            t.name.toLowerCase().includes(searchTerm.value.toLowerCase()) || 
                            t.subtitles?.some(s => s.toLowerCase().includes(searchTerm.value.toLowerCase())) || 
                            t.keyword?.toLowerCase().includes(searchTerm.value.toLowerCase());
        return categoryMatch && searchMatch;
    });

    // Grouping logic (similar to TagShoppingCartView)
    const groupMap = new Map<string, { group: Group; categories: Map<string, { category: Category; tags: Tag[] }> }>();
    const categoryLookup = new Map(tagStore.categories.map(cat => [cat.id, cat]));
    const groupLookup = new Map(tagStore.groups.map(grp => [grp.id, grp]));

    for (const tag of baseFilteredTags) {
        const category = categoryLookup.get(tag.categoryId);
        if (!category) continue; // Skip tags with unknown category
        const group = groupLookup.get(category.groupId);
        if (!group) continue; // Skip categories with unknown group

        if (!groupMap.has(group.id)) {
            groupMap.set(group.id, { group: group, categories: new Map() });
        }
        const groupData = groupMap.get(group.id)!;

        if (!groupData.categories.has(category.id)) {
            groupData.categories.set(category.id, { category: category, tags: [] });
        }
        const categoryData = groupData.categories.get(category.id)!;
        categoryData.tags.push(tag);
    }

    // Sort tags, categories, and groups
    groupMap.forEach(groupData => {
        groupData.categories.forEach(categoryData => {
            categoryData.tags.sort((a, b) => a.name.localeCompare(b.name));
        });
         // Convert categories map to sorted array for the template
        (groupData as any).sortedCategories = Array.from(groupData.categories.values())
            .sort((a, b) => a.category.name.localeCompare(b.category.name));
    });

    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || a.group.name.localeCompare(b.group.name));

    return sortedGroups;
});

const currentTemplate = computed(() => {
    return templates.value[activeTemplate.value];
});

// 确保最小权重不超过最大权重
watch(minWeight, (newVal) => {
    if (newVal > maxWeight.value) {
        maxWeight.value = newVal;
    }
});

// 确保最大权重不小于最小权重
watch(maxWeight, (newVal) => {
    if (newVal < minWeight.value) {
        minWeight.value = newVal;
    }
});

// --- 方法 ---
const handleBack = () => {
    if (window.history.length > 1) {
        router.go(-1);
    } else {
        router.push('/toolbox');
    }
};

const addTag = (tag: Tag) => {
    if (selectedTags.value.some(t => t.id === tag.id)) {
        message.info(`标签 "${tag.name}" 已在列表中`);
        return; 
    }
    selectedTags.value.push(tag);
    tagWeights.value[tag.id] = defaultWeight.value; // Set initial weight
    tagBrackets.value[tag.id] = defaultBracket.value;
    // No need to call generatePrompt here, watcher will handle it
};

const removeTag = (index: number) => {
    const tag = selectedTags.value[index];
    if (!tag) return; // Safety check
    selectedTags.value.splice(index, 1);
    delete tagWeights.value[tag.id];
    delete tagBrackets.value[tag.id];
    // Remove potential stale individual nesting state if bracketNesting ref is kept
    delete bracketNesting.value?.[tag.id]; 
    // No need to call generatePrompt, watcher handles it
};

const clearTags = () => {
    selectedTags.value = [];
    tagWeights.value = {};
    tagBrackets.value = {};
    bracketNesting.value = {}; // Clear individual nesting state if kept
    // No need to call generatePrompt, watcher handles it
};

const updateTagWeight = (tagId: string, value: string | number | null) => {
    if (value !== null) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        tagWeights.value[tagId] = formatNumberByDecimalPlaces(numValue, decimalPlaces.value);
        generatePrompt();
    }
};

// Refactor to return parsed tags and handle adding separately
const parseTagsFromText = (text: string): Array<{id: string; name: string; keyword?: string; isFromLibrary?: boolean}> => {
    const delimiters = extractionSettings.value.delimiters.split('').map(d => d === 'n' ? '\\n' : d === 't' ? '\\t' : d).join('|');
    const regex = new RegExp(`[${delimiters}]+`);
    let potentialTags = text.split(regex);

    if (extractionSettings.value.trimWhitespace) {
        potentialTags = potentialTags.map(tag => tag.trim());
    }
    if (extractionSettings.value.removeEmpty) {
        potentialTags = potentialTags.filter(tag => tag !== '');
    }
    
    // Deduplication logic
    if (extractionSettings.value.duplicateHandling !== 'keepAll') {
        const seen = new Set<string>();
        potentialTags = potentialTags.filter(tag => {
            const key = extractionSettings.value.caseSensitiveMatch ? tag : tag.toLowerCase();
            if (seen.has(key)) {
                return false; // Remove duplicate
            } else {
                seen.add(key);
                return true; // Keep first occurrence
            }
        });
    }

    return potentialTags.map((name, index) => {
            const searchName = extractionSettings.value.caseSensitiveMatch ? name : name.toLowerCase();
            const existingTag = tagStore.tags.find(t => 
                (extractionSettings.value.caseSensitiveMatch ? t.name : t.name.toLowerCase()) === searchName
            );
            
            if (existingTag) {
            return { ...existingTag, isFromLibrary: true };
            } else {
                return {
                    id: `parsed-${Date.now()}-${index}`,
                name: name,
                keyword: name,
                isFromLibrary: false
                };
            }
        });
}

const handleParseAndAdd = () => {
    if (!inputText.value.trim()) {
        message.warning('请输入要解析的文本');
        return;
    }
    const parsed = parseTagsFromText(inputText.value);
    
    // Add to history if not already the most recent entry
    if (!extractionHistory.value.length || extractionHistory.value[0] !== inputText.value) {
        extractionHistory.value.unshift(inputText.value);
        if (extractionHistory.value.length > MAX_HISTORY_ITEMS) {
            extractionHistory.value.pop();
        }
    }

    // Clear existing selections before adding parsed
    selectedTags.value = []; 
    tagWeights.value = {};
    tagBrackets.value = {};
    bracketNesting.value = {}; // Clear this too

    parsed.forEach(pt => {
        const tagToAdd: Omit<Tag, 'libraryId' | 'categoryId' | 'subtitles' | 'color'> & { isFromLibrary?: boolean, id: string } = {
            id: pt.id,
            name: pt.name,
            keyword: pt.keyword,
            weight: defaultWeight.value, 
            isFromLibrary: pt.isFromLibrary 
        };
         // We only push the core properties needed for display and interaction here.
         // Full Tag type might require fetching categoryId etc. if needed later.
        addTag(tagToAdd as Tag); // Use addTag, casting for now
    });

    message.success(`已解析并添加 ${parsed.length} 个标签`);
    // inputText.value = ''; // Optionally clear input after parsing
};

const loadFromHistory = (text: string) => {
    inputText.value = text;
    handleParseAndAdd(); // Parse and add immediately
    showHistory.value = false; // Close history overlay
};

// 添加重置所有标签（移除权重和括号）的功能
const resetAllTags = () => {
    if (selectedTags.value.length === 0) {
        message.warning('请先选择或输入标签');
        return;
    }
    selectedTags.value.forEach(tag => {
        tagWeights.value[tag.id] = defaultWeight.value;
        tagBrackets.value[tag.id] = defaultBracket.value;
        // Do not reset individual nesting if it's removed
        // bracketNesting.value[tag.id] = defaultNesting.value;
    });
    message.success('已重置所有标签的权重和括号类型');
};

// 添加一个用于格式化数字的辅助函数
const formatNumberByDecimalPlaces = (num: number, places: number): number => {
  if (places < 0) places = 0;
  const factor = Math.pow(10, places);
  return Math.round(num * factor) / factor;
};

// 修改滑块和输入框绑定，使用计算属性来格式化数值
const formattedMinWeight = computed({
  get: () => formatNumberByDecimalPlaces(minWeight.value, decimalPlaces.value),
  set: (val) => { minWeight.value = val; }
});

const formattedMaxWeight = computed({
  get: () => formatNumberByDecimalPlaces(maxWeight.value, decimalPlaces.value),
  set: (val) => { maxWeight.value = val; }
});

// 监听小数位数变化，重新格式化所有权重值
watch(decimalPlaces, (newPlaces) => {
  // 调整最小/最大权重的精度
  minWeight.value = formatNumberByDecimalPlaces(minWeight.value, newPlaces);
  maxWeight.value = formatNumberByDecimalPlaces(maxWeight.value, newPlaces);
  
  // 调整所有标签权重的精度
  for (const tagId in tagWeights.value) {
    tagWeights.value[tagId] = formatNumberByDecimalPlaces(tagWeights.value[tagId], newPlaces);
  }
  
  // 调整权重预设的精度
  for (const preset in weightPresets.value) {
    weightPresets.value[preset] = formatNumberByDecimalPlaces(weightPresets.value[preset], newPlaces);
  }
  
  // 更新生成的提示词
  generatePrompt();
});

// 修改随机权重函数，确保按照设置的小数位数生成随机权重
const randomizeTagWeight = (tagId: string) => {
  const randomWeight = minWeight.value + Math.random() * (maxWeight.value - minWeight.value);
  tagWeights.value[tagId] = formatNumberByDecimalPlaces(randomWeight, decimalPlaces.value);
  generatePrompt();
};

// 应用随机权重
const applyRandomWeights = () => {
    if (selectedTags.value.length === 0) {
        message.warning('请先选择或输入标签');
        return;
    }
    
    selectedTags.value.forEach(tag => {
        // 在最小和最大权重之间生成随机值
        randomizeTagWeight(tag.id);
    });
    
    message.success('已应用随机权重');
};

// 应用括号类型到所有标签
const applyBracketToAll = (bracketType: BracketType) => {
    if (selectedTags.value.length === 0) return;
    selectedTags.value.forEach(tag => {
        tagBrackets.value[tag.id] = bracketType;
    });
    message.success(`已为所有标签应用 ${bracketTypes.find(b => b.value === bracketType)?.label || '无括号'}`);
    generatePrompt();
};

// Simplified toggleBracket - just sets the type
const toggleBracket = (tagId: string, bracketType: BracketType) => {
    tagBrackets.value[tagId] = tagBrackets.value[tagId] === bracketType ? defaultBracket.value : bracketType;
    generatePrompt();
};

// 重构 generatePrompt 函数以实现新的括号和格式化逻辑
const generatePrompt = () => {
    if (!selectedTags.value || selectedTags.value.length === 0) { // Check if selectedTags exists
        generatedPrompt.value = '';
        return;
    }
    const templateConfig = templates.value?.[activeTemplate.value]; // Optional chaining
    if (!templateConfig) {
        console.error('未找到激活的模板配置:', activeTemplate.value);
        generatedPrompt.value = '错误：模板配置无效';
        return;
    }

    const formattedTags = selectedTags.value.map(tag => {
        // Use nullish coalescing for safety
        const weight = tagWeights.value?.[tag.id] ?? defaultWeight.value;
        const formattedWeight = formatNumberByDecimalPlaces(weight, decimalPlaces.value);
        const selectedBracketType = tagBrackets.value?.[tag.id] ?? defaultBracket.value;
        const tagNameRaw = tag.keyword || tag.name;
        let contentToWrap = tagNameRaw;
        let effectiveBracketType = selectedBracketType;
        let finalNesting = globalNestingCount.value ?? 0; // Use nullish coalescing

        if (Math.abs(Number(formattedWeight) - 1.0) >= 0.001) {
             contentToWrap = templateConfig.tagFormat
                               .replace('{{name}}', tagNameRaw)
                .replace('{{weight}}', formattedWeight.toString());
             if (selectedBracketType === 'none' && !/^[\(\[\{<].*[\)\]\}>]$/.test(templateConfig.tagFormat)) { 
                effectiveBracketType = 'round';
             }
        } 

        if (effectiveBracketType !== 'none') {
            const brackets = bracketTypes.find(b => b.value === effectiveBracketType)?.example || '()';
            for (let i = 0; i <= finalNesting; i++) {
                contentToWrap = brackets.charAt(0) + contentToWrap + brackets.charAt(1);
            }
        }
        return contentToWrap;
    });

    generatedPrompt.value = templateConfig.template.replace(
        '{{tags}}', 
        formattedTags.join(templateConfig.separator)
    );
};

const copyToClipboard = () => {
    if (!generatedPrompt.value) {
        message.warning('没有可复制的内容');
        return;
    }
    
    navigator.clipboard.writeText(generatedPrompt.value)
        .then(() => {
            message.success('已复制到剪贴板');
        })
        .catch(err => {
            console.error('复制失败:', err);
            message.error('复制失败');
        });
};

const applyWeightPreset = (presetKey: string | number) => { 
    const preset = String(presetKey); 
    selectedTags.value.forEach(tag => {
        if (Object.prototype.hasOwnProperty.call(weightPresets.value, preset)) {
            const presetTypedKey = preset as keyof typeof weightPresets.value;
            const presetWeight = weightPresets.value[presetTypedKey] ?? defaultWeight.value;
            const formattedValue = formatNumberByDecimalPlaces(presetWeight, decimalPlaces.value);
            tagWeights.value[tag.id] = formattedValue;
        } else {
             console.warn(`Invalid preset key used: ${preset}`);
        }
    });
    generatePrompt();
};

const resetWeights = () => {
    selectedTags.value.forEach(tag => {
        tagWeights.value[tag.id] = defaultWeight.value;
    });
    generatePrompt();
};

// --- 生命周期钩子 ---
onMounted(() => {
    loadSettings();
    loadFavorites();
    isReady.value = true; // Assume ready since libraryStore handles loading
    tagStore.setFilterCategoryId(selectedCategoryId.value); // Apply initial filter if any
    // Default expansion is now handled by the watcher
});

// --- 监听器 ---
watch(selectedCategoryId, (newVal) => {
  tagStore.setFilterCategoryId(newVal === '' ? null : newVal); // Now expects string | null
});

// NEW: Watch groupedFilteredTags to set default expansion when data is ready
watch(groupedFilteredTags, (newGroups) => {
    if (newGroups.length > 0 && defaultExpandedNames.value.length === 0) {
        // Set the first group to be expanded by default
        defaultExpandedNames.value = [`group-${newGroups[0].group.id}`];
    }
}, { deep: true }); // Use deep watch if necessary, though watching the computed length might be enough

// 获取已选标签区域高度的方法
const getSelectedTagsHeight = () => {
  if (selectedTags.value.length === 0) return '100px';
  if (selectedTags.value.length <= 8) return '250px';
  if (selectedTags.value.length <= 16) return '400px';
  return '500px';
};

// 获取标签的嵌套次数辅助函数
const getTagNesting = (tagId: string): number => {
    return (typeof bracketNesting.value[tagId] === 'number') ? bracketNesting.value[tagId] : 0;
};

// 添加截断文本的工具函数
const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

// 修改全局嵌套控制函数，增加和减少全局嵌套次数
const increaseGlobalNesting = () => {
    if (globalNestingCount.value < 5) { // Limit max nesting
    globalNestingCount.value++;
        // generatePrompt(); // Watcher handles update
    }
};

const decreaseGlobalNesting = () => {
    if (globalNestingCount.value > 0) {
        globalNestingCount.value--;
        // generatePrompt(); // Watcher handles update
    }
};

// 添加 watch 来监控 tagStore.categories 的变化
watch(() => tagStore.categories, (newCategories) => {
  console.log('Watcher: tagStore.categories changed:', newCategories);
}, { deep: true });

const toggleFavorite = (tagId: string) => {
    if (favoriteTagIds.value.has(tagId)) {
        favoriteTagIds.value.delete(tagId);
    } else {
        favoriteTagIds.value.add(tagId);
    }
    // saveFavorites(); // Watcher handles saving
};

// --- Load/Save Favorites (Ensure these exist if needed) ---
const FAVORITES_STORAGE_KEY = 'weightGenFavorites'; // Example key

const loadFavorites = () => {
    try {
        const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (saved) {
            const ids = JSON.parse(saved);
            if (Array.isArray(ids)) { 
                 favoriteTagIds.value = new Set(ids);
            }
        }
    } catch (error) {
        console.error('加载收藏夹失败:', error);
        // Avoid showing error to user on load
    }
};

const saveFavorites = () => {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteTagIds.value)));
    } catch (error) {
        console.error('保存收藏夹失败:', error);
        // Avoid showing error to user on auto-save
    }
};

// Watch favorites for saving
watch(favoriteTagIds, saveFavorites, { deep: true });

// NEW: Toggle Tag Selection for Library Tags
const toggleSelectionFromLibrary = (tag: Tag) => {
    const index = selectedTags.value.findIndex(t => t.id === tag.id);
    if (index !== -1) {
        // Tag is already selected, remove it
        removeTag(index); 
    } else {
        // Tag is not selected, add it
        addTag(tag);
    }
};

// --- Computed style for action bar ---
const actionBarStyle = computed(() => ({
  left: settingsStore.isSidebarCollapsed ? '64px' : '240px' 
}));
</script>

<template>
  <div class="weight-generator-view" style="padding-bottom: 80px;"> <!-- Add padding for action bar -->
    <n-page-header title="权重添加器" @back="handleBack">
      <template #subtitle>为标签添加权重和括号，生成不同格式的提示词</template>
      <!-- Removed extra copy button -->
    </n-page-header>
    <n-divider />
    
    <n-grid :cols="24" :x-gap="16" :y-gap="16">
      <!-- Left Column: Input & Tag Selection -->
      <n-gi :span="24" :md="10">
        <n-space vertical size="large">
          <!-- Text Input Area -->
          <n-card title="输入/解析文本" size="small">
            <template #header-extra>
              <n-space size="small">
                <n-button text size="tiny" @click="showHistory = !showHistory" title="解析历史">
                   <template #icon><n-icon :component="HistoryIcon"/></template>
                </n-button>
                 <n-button text size="tiny" @click="showExtractionSettings = !showExtractionSettings" title="解析设置">
                   <template #icon><n-icon :component="SettingsIcon"/></template>
                 </n-button>
              </n-space>
            </template>
            <n-input
              v-model:value="inputText"
              type="textarea"
              :rows="4"
              placeholder="在此输入或粘贴标签文本，用逗号、换行符或Tab分隔..."
            />
            <!-- History Overlay -->
            <n-collapse-transition :show="showHistory">
                 <n-list hoverable clickable size="small" bordered style="margin-top: 10px; max-height: 150px; overflow-y: auto;">
                     <template #header><div style="font-size: 12px; color: var(--n-text-color-3);">解析历史 (点击加载)</div></template>
                     <n-list-item v-if="!extractionHistory.length">
                         <n-empty size="small" description="暂无历史记录" />
                     </n-list-item>
                     <n-list-item v-for="(text, index) in extractionHistory" :key="index" @click="loadFromHistory(text)">
                         {{ text.length > 50 ? text.slice(0, 50) + '...' : text }}
                     </n-list-item>
                 </n-list>
            </n-collapse-transition>
            <!-- Extraction Settings -->
            <n-collapse-transition :show="showExtractionSettings">
                 <n-card size="small" title="解析设置" :bordered="false" style="margin-top: 10px; background-color: var(--n-action-color);">
                    <n-space vertical size="small">
                      <n-space align="center">
                         <span style="font-size: 12px; width: 80px;">分隔符:</span> 
                         <n-input size="tiny" v-model:value="extractionSettings.delimiters" placeholder=",\n\t"/>
                          </n-space>
                       <n-checkbox size="small" v-model:checked="extractionSettings.trimWhitespace">去除首尾空格</n-checkbox>
                       <n-checkbox size="small" v-model:checked="extractionSettings.removeEmpty">移除空标签</n-checkbox>
                       <n-checkbox size="small" v-model:checked="extractionSettings.caseSensitiveMatch">匹配库时区分大小写</n-checkbox>
                       <!-- Duplicate Handling Option -->
                    </n-space>
              </n-card>
            </n-collapse-transition>
            <template #action>
              <n-button type="primary" @click="handleParseAndAdd" block>
                <template #icon><n-icon :component="InputIcon" /></template>
                解析并添加标签
              </n-button>
            </template>
        </n-card>

          <!-- Tag Library Selection -->
          <n-card title="从库选择标签" size="small">
              <template #header-extra>
                 <n-space align="center">
                     <!-- Category Filter -->
                     <n-select
                        v-model:value="selectedCategoryId"
                        :options="[{ label: '所有分类', value: '' }, ...categoryOptions]"
                        placeholder="筛选分类"
                        clearable
                        size="small"
                        style="min-width: 120px; margin-right: 8px;"
                     />
                      <!-- View Toggle Button -->
                     <n-tooltip trigger="hover">
                        <template #trigger>
                            <n-button text circle size="small" @click="tagsViewMode = tagsViewMode === 'grid' ? 'list' : 'grid'">
                    <template #icon>
                                    <n-icon :component="tagsViewMode === 'grid' ? ListIcon : TagIcon" />
                    </template>
                  </n-button>
                        </template>
                        切换{{ tagsViewMode === 'grid' ? '列表' : '网格' }}视图
                     </n-tooltip>
                </n-space>
              </template>
                  <n-input
                    v-model:value="searchTerm"
                placeholder="搜索标签库..."
                    clearable
                size="small"
                style="margin-bottom: 10px;"
             />
            <n-scrollbar style="max-height: 350px;"> 
                 <!-- Grid View -->
                 <div v-if="tagsViewMode === 'grid'" class="tag-grid-view">
                    <n-collapse arrow-placement="right" :default-expanded-names="defaultExpandedNames" accordion> 
                       <template v-for="groupData in groupedFilteredTags" :key="groupData.group.id">
                          <n-collapse-item 
                             :title="groupData.group.name"
                             :name="`group-${groupData.group.id}`" 
                             v-if="(groupData as any).sortedCategories.length > 0" 
                           >
                              <div v-for="categoryData in (groupData as any).sortedCategories" :key="categoryData.category.id" class="category-section-grid">
                                 <div class="category-header-grid">{{ categoryData.category.name }}</div>
                                 <n-flex wrap :size="[8, 8]" class="tag-list-grid">
                                     <div 
                                         v-for="tag in categoryData.tags" 
                      :key="tag.id"
                                         class="tag-item-card" 
                                         @click="toggleSelectionFromLibrary(tag)"
                                         :class="{'tag-item-selected': selectedTags.some(st => st.id === tag.id)}"
                                     >
                                        <div class="tag-card-header">
                                             <n-button text circle size="tiny" class="add-button" title="添加/移除标签">
                                                <n-icon :component="AddIcon" />
                        </n-button>
                    </div>
                                        <div class="tag-card-body">
                                            <div class="tag-name">{{ tag.name }}</div>
                                            <div class="tag-keyword">{{ tag.keyword || '&nbsp;' }}</div>
                                        </div>
                                     </div>
                                     <span v-if="categoryData.tags.length === 0" class="no-tags-in-category"></span>
                                 </n-flex>
                              </div>
                          </n-collapse-item>
                       </template>
                       <n-empty v-if="groupedFilteredTags.length === 0 && !searchTerm" description="无可用分组或分类" size="small" style="margin-top: 20px;"/>
                       <n-empty v-if="groupedFilteredTags.length === 0 && searchTerm" description="未搜索到匹配标签" size="small" style="margin-top: 20px;"/>
                    </n-collapse>
                  </div>
                  
                 <!-- List View -->
                 <n-list v-else hoverable clickable size="small" class="tag-list-view">
                     <template v-for="groupData in groupedFilteredTags" :key="`group-list-${groupData.group.id}`">
                         <n-list-item v-if="(groupData as any).sortedCategories.length > 0" class="group-header-list">
                              <n-thing :title="groupData.group.name">
                                 <template #avatar> <n-icon :component="GroupIcon" /> </template>
                              </n-thing>
                         </n-list-item>
                          <template v-for="categoryData in (groupData as any).sortedCategories" :key="categoryData.category.id">
                              <n-list-item 
                                 v-for="tag in categoryData.tags" 
                                 :key="tag.id" 
                                 @click="toggleSelectionFromLibrary(tag)" 
                                 :class="{'tag-item-selected': selectedTags.some(st => st.id === tag.id)}"
                                 class="tag-list-item-indented"
                               >
                      <n-thing :title="tag.name">
                        <template #description>
                                        <span class="tag-subtitles">{{ tag.keyword || tag.subtitles?.join(', ') || '&nbsp;' }}</span>
                        </template>
                        <template #header-extra>
                                          <n-space size="small">
                                              <!-- Use AddIcon, but click is on item -->
                                              <n-button tertiary circle size="tiny" @click.stop="toggleSelectionFromLibrary(tag)" title="添加/移除标签">
                                                 <template #icon><n-icon :component="AddIcon" /></template>
                          </n-button>
                                          </n-space>
                        </template>
                      </n-thing>
                    </n-list-item>
                        </template>
                     </template>
                     <n-list-item v-if="groupedFilteredTags.length === 0 && !searchTerm">
                         <n-empty description="无可用分组或分类" size="small" />
                     </n-list-item>
                      <n-list-item v-if="groupedFilteredTags.length === 0 && searchTerm">
                         <n-empty description="未搜索到匹配标签" size="small" />
                    </n-list-item>
                  </n-list>
            </n-scrollbar>
            </n-card>
        </n-space>
          </n-gi>
          
      <!-- Right Column: Selected Tags & Settings -->
      <n-gi :span="24" :md="14">
        <n-space vertical size="large">
            <!-- Selected Tags Area -->
            <n-card title="已选标签" size="small">
              <template #header-extra>
                <n-space align="center">
                        <n-tag v-if="selectedTags.length > 0" type="success" size="tiny">{{ selectedTags.length }} 项</n-tag>
                         <!-- Removed Layout Toggle -->
                        <n-button text size="tiny" @click="resetWeights" title="重置权重">
                            <template #icon><n-icon :component="ResetIcon"/></template>
                  </n-button>
                         <n-button text size="tiny" @click="resetAllTags" title="重置权重和括号">
                            <template #icon><n-icon :component="ResetAllIcon"/></template>
                  </n-button>
                        <n-button text type="error" size="tiny" @click="clearTags" title="清空列表">
                            <template #icon><n-icon :component="ClearIcon"/></template>
                  </n-button>
                </n-space>
              </template>
              
                 <!-- NEW Quick Apply Structure -->
                 <n-space vertical size="small" style="margin-bottom: 10px;">
                     <!-- Row 1: Weight Presets -->
                     <n-space align="center" wrap item-style="display: flex;">
                        <span style="font-size: 12px; color: var(--n-text-color-3); margin-right: 5px;">权重:</span>
                        <n-button 
                          v-for="(_, preset) in weightPresets" 
                          :key="preset"
                          size="tiny"
                           quaternary
                          @click="applyWeightPreset(preset)"
                          :disabled="selectedTags.length === 0"
                        >{{ preset }}</n-button>
                        <n-button 
                          size="tiny"
                           quaternary
                          @click="applyRandomWeights"
                          :disabled="selectedTags.length === 0"
                           title="应用随机权重"
                        >
                           <template #icon><n-icon :component="RandomIcon" /></template>
                        </n-button>
                      </n-space>
                      
                     <!-- Row 2: Brackets & Global Nesting -->
                      <n-space align="center" wrap item-style="display: flex;">
                         <span style="font-size: 12px; color: var(--n-text-color-3); margin-right: 5px;">括号:</span>
                         <n-button 
                           v-for="bracket in bracketTypes.filter(b => b.value !== 'none')" 
                           :key="bracket.value"
                           size="tiny" 
                           quaternary
                           @click="applyBracketToAll(bracket.value as BracketType)"
                           :disabled="selectedTags.length === 0"
                           :title="`全部设为 ${bracket.example}`"
                         >
                           {{ bracket.example }}
                         </n-button>
                         <n-button 
                           size="tiny"
                           quaternary
                           @click="applyBracketToAll('none')"
                           :disabled="selectedTags.length === 0"
                           title="移除所有括号"
                         >
                           无
                         </n-button>
                         <n-divider vertical />
                         <span style="font-size: 12px; color: var(--n-text-color-3); margin-left: 5px;">全局嵌套:</span>
                         <n-button-group size="tiny">
                           <n-button @click="decreaseGlobalNesting" :disabled="globalNestingCount <= 0" title="减少嵌套层数">
                               <template #icon><n-icon :component="DecreaseIcon" /></template>
                           </n-button>
                           <n-button disabled style="min-width: 25px; padding: 0 6px; text-align: center;">{{ globalNestingCount }}</n-button>
                           <n-button @click="increaseGlobalNesting" :disabled="globalNestingCount >= 5" title="增加嵌套层数">
                               <template #icon><n-icon :component="IncreaseIcon" /></template>
                           </n-button>
                         </n-button-group>
                       </n-space>
                 </n-space>
                 <n-divider style="margin: 5px 0;"/>

                 <!-- Selected Tags List -->
                 <n-scrollbar style="max-height: 350px;"> 
                    <div v-if="selectedTags.length > 0" class="selected-tags-grid">
                      <!-- Grid Header -->
                       <div class="selected-tag-item header">
                          <div class="tag-name-col">标签</div>
                          <div class="tag-weight-col">权重</div>
                          <div class="tag-bracket-col">括号</div>
                          <div class="tag-actions-col">操作</div>
                    </div>
                       <!-- Grid Rows -->
                       <div v-for="(tag, index) in selectedTags" :key="tag.id" class="selected-tag-item">
                           <div class="tag-name-col">
                               <n-tooltip trigger="hover">
                                   <template #trigger>
                                       <span class="tag-text">{{ tag.name }}</span>
                </template>
                                   {{ tag.name }}
                               </n-tooltip>
                               <span v-if="tag.keyword && tag.keyword !== tag.name" class="tag-keyword-display"> ({{ tag.keyword }})</span>
                           </div>
                            <div class="tag-weight-col">
                                <n-input-number
                                  v-model:value="tagWeights[tag.id]"
                                    size="tiny"
                                  :min="0"
                                    :max="maxWeight" 
                                  :step="Math.pow(0.1, decimalPlaces)"
                                  @update:value="(val) => val !== null && updateTagWeight(tag.id, val)"
                                    style="width: 85px;"
                                  />
                            </div>
                             <div class="tag-bracket-col">
                                  <n-space :size="2" justify="center">
                                <n-button 
                                  v-for="bracket in bracketTypes.filter(b => b.value !== 'none')" 
                                  :key="bracket.value"
                                  size="tiny" 
                                        quaternary 
                                  :type="tagBrackets[tag.id] === bracket.value ? 'primary' : 'default'"
                                  @click="toggleBracket(tag.id, bracket.value as BracketType)"
                                        :title="`切换 ${bracket.example}`"
                                >
                                  {{ bracket.example }}
                                </n-button>
                                <n-button 
                                  size="tiny"
                                        quaternary
                                  :type="tagBrackets[tag.id] === 'none' ? 'primary' : 'default'"
                                        @click="toggleBracket(tag.id, 'none')"
                                        title="移除括号"
                                >
                                  无
                                </n-button>
                                </n-space>
                  </div>
                             <div class="tag-actions-col">
                                 <n-button text circle size="tiny" @click="randomizeTagWeight(tag.id)" title="随机权重">
                                     <template #icon><n-icon :component="RandomIcon"/></template>
                      </n-button>
                                 <n-button text circle size="tiny" type="error" @click="removeTag(index)" title="移除标签">
                                     <template #icon><n-icon :component="ClearIcon"/></template>
                      </n-button>
                    </div>
                       </div>
                    </div>
                     <n-empty v-else description="请从左侧选择或输入标签" size="small" style="padding: 20px 0;"/>
                 </n-scrollbar>
            </n-card>

            <!-- Result Card -->
            <n-card title="生成结果" size="small">
      <template #header-extra>
        <n-select
          v-model:value="activeTemplate"
          :options="Object.entries(templates).map(([key, t]) => ({ label: t.name, value: key as any }))"
                       size="small"
          style="width: 150px;"
                       title="选择输出模板格式"
        />
      </template>
        <n-input
          v-model:value="generatedPrompt"
          type="textarea"
                    placeholder="添加标签后将在此生成..."
          :rows="4"
                    readonly
                 />
                 <n-tooltip trigger="hover" v-if="templates[activeTemplate]">
                     <template #trigger>
                        <n-icon size="14" :component="InfoIcon" style="margin-top: 5px; color: var(--n-text-color-3); cursor: help;"/>
            </template>
                     {{ templates[activeTemplate].description }}
                 </n-tooltip>
    </n-card>
    
            <!-- General Settings Card (Moved Down) -->
            <n-card title="全局设置" size="small">
                 <template #header-extra>
                     <n-button text size="tiny" @click="saveSettings" title="手动保存所有设置">
                        <template #icon><n-icon :component="SaveIcon"/></template>
                     </n-button>
                 </template>
                 <!-- Use vertical space for stacking rows -->
                 <n-space vertical size="medium" class="global-settings-space">
                    <!-- Row 1: Weight Range -->
                    <n-space align="center" justify="space-between" class="setting-row">
                        <span class="setting-label">权重范围:</span>
                <n-space align="center">
                  <n-input-number
                                size="small" 
                                v-model:value="formattedMinWeight" 
                    :step="Math.pow(0.1, decimalPlaces)"
                                style="width: 80px;" 
                                :min="0" 
                                :max="formattedMaxWeight"
                            />
                            <span>-</span>
                      <n-input-number
                                size="small" 
                                v-model:value="formattedMaxWeight" 
                        :step="Math.pow(0.1, decimalPlaces)"
                                style="width: 80px;" 
                                :min="formattedMinWeight"
                                :max="2" 
                      />
                    </n-space>
                </n-space>
                
                    <!-- Row 2: Decimal Places -->
                    <n-space align="center" justify="space-between" class="setting-row">
                        <span class="setting-label">小数位数:</span>
                  <n-input-number
                            size="small" 
                    v-model:value="decimalPlaces"
                    :min="0"
                    :max="3"
                    :step="1"
                            style="width: 80px;"
                  />
                </n-space>
                    
                    <!-- Row 3: Default Bracket -->
                    <n-space align="center" justify="space-between" class="setting-row">
                        <span class="setting-label">默认括号:</span>
                        <n-select 
              size="small"
                            v-model:value="defaultBracket" 
                            :options="bracketTypes" 
                            style="width: 100px;"
                  />
                </n-space>
                
                    <!-- Row 4: Global Nesting -->
                    <n-space align="center" justify="space-between" class="setting-row">
                        <span class="setting-label">全局嵌套:</span>
                        <n-button-group size="small">
                            <n-button @click="decreaseGlobalNesting" :disabled="globalNestingCount <= 0">-</n-button>
                            <n-button disabled style="min-width: 35px; text-align: center;">{{ globalNestingCount }}</n-button>
                            <n-button @click="increaseGlobalNesting" :disabled="globalNestingCount >= 5">+</n-button>
                        </n-button-group>
                </n-space>
              </n-space>
            </n-card>
        </n-space>
          </n-gi>
    </n-grid>

     <!-- Fixed Action Bar -->
    <div class="fixed-action-bar" :style="actionBarStyle">
          <!-- Add Randomize Button Here -->
          <n-button 
            @click="applyRandomWeights" 
            :disabled="selectedTags.length === 0"
            size="large"
            style="margin-right: 12px;"
            quaternary
          >
            <template #icon><n-icon :component="RandomIcon" /></template>
            随机权重
          </n-button>
          
          <n-button 
            type="primary" 
            @click="copyToClipboard" 
            :disabled="!generatedPrompt"
            size="large"
          >
              <template #icon><n-icon :component="CopyIcon" /></template>
              复制生成结果
          </n-button>
            
    </div>

  </div>
</template>

<style scoped>
.weight-generator-view {
  /* Removed fixed height, let content flow */
  /* height: calc(100vh - 60px); */ 
}

/* Layout adjustments */
.n-card {
  margin-bottom: 0; /* Remove default bottom margin if using grid gap */
}

/* Input/Parsing Area */
.n-collapse-transition {
  margin-top: 8px;
}

/* Tag Library Selection */
.tag-subtitles {
  font-size: 0.85em;
  color: var(--n-text-color-3);
}
.tag-selected-in-list {
   background-color: var(--n-item-color-active) !important;
}
.tag-selected-in-list :deep(.n-thing-header__title) {
    color: var(--n-item-text-color-active) !important;
}

/* Selected Tags Area */
.selected-tags-grid {
  border: 1px solid var(--n-divider-color);
  border-radius: var(--n-border-radius);
  overflow: hidden; /* Clip content */
}

.selected-tag-item {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 100px 150px 60px; /* Adjust columns */
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--n-divider-color);
  transition: background-color 0.2s ease;
}
.selected-tag-item:last-child {
  border-bottom: none;
}
.selected-tag-item:hover {
    background-color: var(--n-action-color);
}

.selected-tag-item.header {
  font-weight: 500;
  background-color: var(--n-action-color);
  color: var(--n-text-color-2);
  font-size: 12px;
  padding: 4px 8px;
}

.tag-name-col,
.tag-weight-col,
.tag-bracket-col,
.tag-actions-col {
  padding: 0 4px;
  overflow: hidden; /* Prevent text overflow */
  text-overflow: ellipsis; /* Add ellipsis for overflow */
  white-space: nowrap; /* Prevent wrapping in grid cells */
  font-size: 13px; /* Consistent font size */
}
.tag-name-col .tag-text {
    display: inline-block;
    max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
    vertical-align: bottom;
}
.tag-name-col .tag-keyword-display {
    font-size: 0.85em;
    color: var(--n-text-color-3);
    margin-left: 4px;
}

.tag-weight-col {
  text-align: center;
}
.tag-bracket-col {
  text-align: center;
}
.tag-actions-col {
  text-align: right;
}

/* General Settings - Optimized Styles */
.global-settings-space {
    padding: 5px 0; /* Add some vertical padding */
}

.setting-row {
  width: 100%; /* Ensure space-between works */
}

.setting-label {
  /* Remove fixed width */
  flex-shrink: 0;
  text-align: left; /* Align left */
  font-size: 14px; /* Slightly larger */
  color: var(--n-text-color-1); /* Standard text color */
  font-weight: 500;
  margin-right: 16px; /* Space between label and control */
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

@media (max-width: 992px) { /* Adjust breakpoint as needed */
  .selected-tag-item {
     grid-template-columns: minmax(100px, 1fr) 90px 130px 55px; 
  }
}

@media (max-width: 768px) {
  .weight-generator-view {
     padding-bottom: 70px; /* Ensure space for action bar */
  }

  .selected-tag-item {
     grid-template-columns: 1fr 70px; /* Stack controls below */
     row-gap: 5px;
     padding: 8px;
  }
  .selected-tag-item.header {
      display: none; /* Hide header on small screens */
  }
  .tag-name-col {
      grid-column: 1 / 3; /* Span full width */
      white-space: normal; /* Allow name to wrap */
  }
  .tag-weight-col {
      grid-column: 1 / 2;
      grid-row: 2 / 3;
      text-align: left;
      .n-input-number {
          width: 90px !important; /* Force width if needed */
      }
  }
  .tag-bracket-col {
      grid-column: 2 / 3;
      grid-row: 2 / 3;
      justify-content: flex-start;
      text-align: left;
  }
  .tag-actions-col {
      grid-column: 1 / 3; /* Span full width below */
      grid-row: 3 / 4;
      text-align: right;
      padding-top: 5px;
      border-top: 1px solid var(--n-divider-color); 
      margin-top: 5px;
  }

  .fixed-action-bar {
    height: 56px; 
    padding: 0 16px;
    left: 0 !important; 
  }

  .fixed-action-bar .n-button {
     padding-left: 10px;
     padding-right: 10px;
  }
  .fixed-action-bar .n-button--large {
      height: 40px;
      font-size: 14px;
  }
}

/* Tag Library Selection Styles */
.tag-grid-view .n-collapse-item__header {
    padding-top: 8px;
    padding-bottom: 8px;
}
.tag-grid-view .n-collapse-item__content-inner {
    padding-top: 5px !important;
}

.category-section-grid {
    margin-bottom: 12px;
}
.category-section-grid:last-child {
    margin-bottom: 0;
}

.category-header-grid {
    font-size: 13px;
    font-weight: 500;
    color: var(--n-text-color-2);
    margin-bottom: 8px;
}

.tag-list-grid {
  /* gap: 8px; Inherited from n-flex */
}

.tag-list-view .group-header-list :deep(.n-list-item__main) {
    font-weight: bold;
    color: var(--n-text-color-1);
}

.tag-list-view .tag-list-item-indented {
    padding-left: 30px !important; /* Indent tags under group */
}

/* Re-apply selected state highlight */
.tag-item-card.tag-selected-in-list {
    border-color: var(--n-primary-color-pressed);
    box-shadow: 0 0 0 1px var(--n-primary-color-pressed);
}
.tag-list-view .tag-selected-in-list {
   background-color: var(--n-item-color-active) !important;
}
.tag-list-view .tag-selected-in-list :deep(.n-thing-header__title) {
    color: var(--n-item-text-color-active) !important;
}

/* NEW/MODIFIED Tag Card Styles */
.tag-item-card {
    border: 1px solid var(--n-border-color);
    border-radius: 4px;
    /* margin: 4px; Applied by n-flex gap */
    padding: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--n-color);
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
    position: relative;
    overflow: hidden;
    min-width: 100px; /* Adjust min width */
    cursor: pointer;
}

.tag-item-card:hover {
    border-color: var(--n-primary-color-hover);
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.tag-card-header {
    display: flex;
    justify-content: flex-end; /* Buttons to the right */
    padding: 2px 4px;
    background-color: var(--n-action-color); /* Subtle header background */
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    opacity: 0; /* Hide initially */
    transition: opacity 0.2s ease;
}

.tag-item-card:hover .tag-card-header {
    opacity: 1;
}

.tag-card-header .add-button {
   /* No special positioning needed now */
   pointer-events: none; /* Click is on the card */
}

.tag-card-body {
    padding: 22px 8px 6px 8px; /* Top padding to clear header */
    text-align: center;
}

.tag-card-body .tag-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--n-text-color-1);
    margin-bottom: 2px;
    word-break: break-word;
}

.tag-card-body .tag-keyword {
    font-size: 11px;
    color: var(--n-text-color-3);
    word-break: break-word;
    min-height: 15px; /* Ensure space even if empty */
}
/* End NEW/MODIFIED Tag Card Styles */

/* NEW: Style for selected tag cards */
.tag-item-card.tag-item-selected {
    border-color: var(--n-primary-color-pressed);
    box-shadow: 0 0 0 1px var(--n-primary-color-pressed);
    background-color: var(--n-item-color-active-hover);
}

.tag-list-view .tag-list-item-indented.tag-item-selected {
   background-color: var(--n-item-color-active) !important; 
}
.tag-list-view .tag-list-item-indented.tag-item-selected :deep(.n-thing-header__title) {
    color: var(--n-item-text-color-active) !important;
}
</style> 