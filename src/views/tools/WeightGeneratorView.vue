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
    NDivider,
    NCard,
    NCheckbox,
    NCollapse,
    NCollapseItem,
    NScrollbar,
    NEmpty,
    useMessage
} from 'naive-ui';
import { 
    CopyOutline as CopyIcon,
    SaveOutline as SaveIcon,
    CloseCircleOutline as ClearIcon,
    ListOutline as ListIcon, 
    ShuffleOutline as RandomIcon,
    PricetagsOutline as TagIcon,
    ArrowBackOutline as ArrowBackIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
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

// --- 基本组件状态 ---
const selectedCategoryId = ref<string | null>(null);
const searchTerm = ref<string>('');
const selectedTags = ref<Tag[]>([]);
const generatedPrompt = ref<string>('');
const tagLayout = ref<'vertical' | 'grid'>('grid'); // 标签布局：垂直列表或网格
const isReady = ref(false);

// --- 文本输入模式 ---
const inputText = ref<string>('');

// --- 新增：文本转换高级设置状态 ---
const extractionSettings = ref({
  delimiters: ',\n\t',
  trimWhitespace: true,    // 默认去除首尾空格
  removeEmpty: true,       // 默认移除空标签
  caseSensitiveMatch: false, // 默认不区分大小写匹配库
  duplicateHandling: 'keepFirst' as 'keepFirst' | 'keepAll' | 'mergeWeights' // 默认去重（保留第一个）
});
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

// 替换 parseTagsFromText，支持括号解析
const parseTagsFromText = (text: string): Array<{id: string; name: string; keyword?: string; isFromLibrary?: boolean; weight?: number; bracketType?: BracketType; nesting?: number}> => {
    // 匹配 ((tag:1.2))、[tag:1.2]、{tag:1.2}、<tag:1.2>、tag:1.2、tag
    const tagPattern = /([\(\[\{<]+)?\s*([^\(\)\[\]\{\}<>:,\n\t]+)\s*(?::\s*([0-9.]+))?\s*([\)\]\}>]+)?/g;
    const results: Array<{id: string; name: string; keyword?: string; isFromLibrary?: boolean; weight?: number; bracketType?: BracketType; nesting?: number}> = [];
    let match;
    let idx = 0;
    while ((match = tagPattern.exec(text)) !== null) {
        let [, leftBrackets, name, weight, rightBrackets] = match;
        name = name?.trim();
        if (!name) continue;
        // 判断括号类型和嵌套层数
        let bracketType: BracketType = 'none';
        let nesting = 0;
        if (leftBrackets && rightBrackets) {
            const left = leftBrackets[0];
            const right = rightBrackets[0];
            if (left === '(' && right === ')') bracketType = 'round';
            else if (left === '[' && right === ']') bracketType = 'square';
            else if (left === '{' && right === '}') bracketType = 'curly';
            else if (left === '<' && right === '>') bracketType = 'angle';
            // 嵌套层数起始点改为0（1层括号就是1）
            nesting = Math.min(leftBrackets.length, rightBrackets.length);
        }
        // 查找库中是否有该标签
        const searchName = extractionSettings.value.caseSensitiveMatch ? name : name.toLowerCase();
        const existingTag = tagStore.tags.find(t => (extractionSettings.value.caseSensitiveMatch ? t.name : t.name.toLowerCase()) === searchName);
        results.push({
            id: existingTag ? existingTag.id : `parsed-${Date.now()}-${idx}`,
            name: existingTag ? existingTag.name : name,
            keyword: existingTag ? existingTag.keyword : name,
            isFromLibrary: !!existingTag,
            weight: weight ? parseFloat(weight) : undefined,
            bracketType,
            nesting
        });
        idx++;
    }
    return results;
};

// 修改 handleParseAndAdd，支持权重、括号类型、嵌套层数自动填充
const handleParseAndAdd = () => {
    if (!inputText.value.trim()) {
        message.warning('请输入要解析的文本');
        return;
    }
    const parsed = parseTagsFromText(inputText.value);
    if (!extractionHistory.value.length || extractionHistory.value[0] !== inputText.value) {
        extractionHistory.value.unshift(inputText.value);
        if (extractionHistory.value.length > MAX_HISTORY_ITEMS) {
            extractionHistory.value.pop();
        }
    }
    selectedTags.value = [];
    tagWeights.value = {};
    tagBrackets.value = {};
    bracketNesting.value = {};
    parsed.forEach(pt => {
        const tagToAdd: Omit<Tag, 'libraryId' | 'categoryId' | 'subtitles' | 'color'> & { isFromLibrary?: boolean, id: string } = {
            id: pt.id,
            name: pt.name,
            keyword: pt.keyword,
            weight: pt.weight ?? defaultWeight.value,
            isFromLibrary: pt.isFromLibrary
        };
        addTag(tagToAdd as Tag);
        if (pt.weight !== undefined) tagWeights.value[pt.id] = pt.weight;
        if (pt.bracketType && pt.bracketType !== 'none') tagBrackets.value[pt.id] = pt.bracketType;
        if (pt.nesting && pt.nesting > 0) bracketNesting.value[pt.id] = pt.nesting;
    });
    message.success(`已解析并添加 ${parsed.length} 个标签`);
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

// 重构 generatePrompt 函数以实现新的括号和格式化逻辑
const generatePrompt = () => {
    if (!selectedTags.value || selectedTags.value.length === 0) {
        generatedPrompt.value = '';
        return;
    }
    const templateConfig = templates.value?.[activeTemplate.value];
    if (!templateConfig) {
        console.error('未找到激活的模板配置:', activeTemplate.value);
        generatedPrompt.value = '错误：模板配置无效';
        return;
    }

    // 辅助函数：判断模板是否有括号，返回类型和内容
    function parseTemplateBracket(format: string) {
      const match = format.match(/^\s*([\(\[\{<])(.+)[\)\]\}>]\s*$/);
      if (match) {
        let type = 'round';
        if (match[1] === '(') type = 'round';
        if (match[1] === '[') type = 'square';
        if (match[1] === '{') type = 'curly';
        if (match[1] === '<') type = 'angle';
        return { hasBracket: true, bracketType: type, inner: match[2] };
      }
      return { hasBracket: false, bracketType: 'none', inner: format };
    }

    const formattedTags = selectedTags.value.map(tag => {
        const weight = tagWeights.value?.[tag.id] ?? defaultWeight.value;
        const formattedWeight = formatNumberByDecimalPlaces(weight, decimalPlaces.value);
        const userBracketType = tagBrackets.value?.[tag.id] ?? defaultBracket.value;
        const tagNameRaw = tag.name;
        let userNesting = (bracketNesting.value?.[tag.id] === undefined || bracketNesting.value?.[tag.id] === null)
          ? (globalNestingCount.value ?? 0)
          : bracketNesting.value?.[tag.id];

        // 解析模板括号
        const parsed = parseTemplateBracket(templateConfig.tagFormat);
        let content = parsed.inner.replace('{{name}}', tagNameRaw).replace('{{weight}}', formattedWeight.toString());
        let result = '';

        if (userBracketType !== 'none') {
          // 用户定义了括号，无论嵌套为0还是大于0，都至少包裹一层
          const brackets = bracketTypes.find(b => b.value === userBracketType)?.example || '()';
          let nesting = Math.max(1, userNesting);
          result = content;
          for (let i = 0; i < nesting; i++) {
            result = brackets.charAt(0) + result + brackets.charAt(1);
          }
        } else if (userBracketType === 'none') {
          if (Math.abs(Number(formattedWeight) - 1.0) >= 0.001) {
            // 权重不为1，未定义括号，强制用一层圆括号
            result = '(' + content + ')';
          } else {
            // 权重为1，未定义括号，直接原样输出
            result = tagNameRaw;
          }
        } else {
          // 既无括号也无权重，直接内容
          result = content;
        }
        return result;
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
    tagStore.setFilter(null, selectedCategoryId.value); // Apply initial filter if any
    // Default expansion is now handled by the watcher
});

// --- 监听器 ---
watch(selectedCategoryId, (newVal) => {
  tagStore.setFilter(null, newVal === '' ? null : newVal); // Now expects string | null
});

// NEW: Watch groupedFilteredTags to set default expansion when data is ready
watch(groupedFilteredTags, (newGroups) => {
    if (newGroups.length > 0 && defaultExpandedNames.value.length === 0) {
        // Set the first group to be expanded by default
        defaultExpandedNames.value = [`group-${newGroups[0].group.id}`];
    }
}, { deep: true }); // Use deep watch if necessary, though watching the computed length might be enough

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

// 1. 新增 selectedTagsViewMode 控制视图切换，默认 grid
const selectedTagsViewMode = ref<'grid' | 'list'>('grid');

// 自动应用功能：监听 selectedTags、tagWeights、tagBrackets、bracketNesting 变化自动刷新生成栏
watch([
  selectedTags, tagWeights, tagBrackets, bracketNesting
], () => {
  // 自动同步：括号为"无"时嵌套层数强制为0，嵌套为 undefined/null/空时强制为0
  selectedTags.value.forEach(tag => {
    if (tagBrackets.value[tag.id] === 'none') {
      bracketNesting.value[tag.id] = 0;
    } else if (bracketNesting.value[tag.id] === undefined || bracketNesting.value[tag.id] === null) {
      bracketNesting.value[tag.id] = 0;
    }
  });
  generatePrompt();
}, { deep: true });
</script>

<template>
  <div class="weight-header">
    <n-button text circle size="large" class="back-btn" @click="handleBack">
      <n-icon size="24" :component="ArrowBackIcon" />
    </n-button>
  </div>
  <div class="weight-main-card">
    <h2 class="weight-h2">权重添加器</h2>
    <n-divider style="margin-bottom: 24px; margin-top: 8px;" />
    <div class="main-controls">
      <!-- 输入/解析文本区 -->
      <n-card size="small" class="input-card">
        <n-input
          v-model:value="inputText"
          type="textarea"
          :rows="4"
          placeholder="在此输入或粘贴标签文本，用逗号、换行符或Tab分隔..."
        />
        <n-space justify="end" style="margin-top: 8px;">
          <n-button type="primary" @click="handleParseAndAdd">解析并添加标签</n-button>
        </n-space>
      </n-card>
      <!-- 标签库选择（可折叠） -->
      <n-collapse>
        <n-collapse-item title="从库选择标签">
          <n-space align="center" style="margin-bottom: 8px;">
            <n-select
              v-model:value="selectedCategoryId"
              :options="[{ label: '所有分类', value: '' }, ...categoryOptions]"
              placeholder="筛选分类"
              clearable
              size="small"
              style="min-width: 120px;"
            />
            <n-input
              v-model:value="searchTerm"
              placeholder="搜索标签库..."
              clearable
              size="small"
              style="margin-left: 8px; width: 180px;"
            />
            <n-button text circle size="small" @click="tagsViewMode = tagsViewMode === 'grid' ? 'list' : 'grid'" style="margin-left: 8px;">
              <n-icon :component="tagsViewMode === 'grid' ? ListIcon : TagIcon" />
            </n-button>
          </n-space>
          <n-scrollbar style="max-height: 220px;">
            <template v-if="tagsViewMode === 'grid'">
              <div v-for="groupData in groupedFilteredTags" :key="groupData.group.id">
                <div v-for="categoryData in (groupData as any).sortedCategories" :key="categoryData.category.id">
                  <div class="category-header-grid">{{ categoryData.category.name }}</div>
                  <n-flex wrap :size="[8, 8]" class="tag-list-grid">
                    <div
                      v-for="tag in categoryData.tags"
                      :key="tag.id"
                      class="tag-item-card"
                      @click="toggleSelectionFromLibrary(tag)"
                      :class="{'tag-item-selected': selectedTags.some(st => st.id === tag.id)}"
                    >
                      <div class="tag-card-body">
                        <div class="tag-name">{{ tag.name }}</div>
                        <div class="tag-keyword">{{ tag.keyword || '' }}</div>
                      </div>
                    </div>
                  </n-flex>
                </div>
              </div>
            </template>
            <template v-else>
              <div v-for="groupData in groupedFilteredTags" :key="groupData.group.id">
                <div v-for="categoryData in (groupData as any).sortedCategories" :key="categoryData.category.id">
                  <div class="category-header-grid">{{ categoryData.category.name }}</div>
                  <n-list hoverable clickable size="small" class="tag-list-view">
                    <n-list-item
                      v-for="tag in categoryData.tags"
                      :key="tag.id"
                      @click="toggleSelectionFromLibrary(tag)"
                      :class="{'tag-item-selected': selectedTags.some(st => st.id === tag.id)}"
                    >
                      <n-thing :title="tag.name">
                        <template #description>
                          <span class="tag-keyword">{{ tag.keyword || '' }}</span>
                        </template>
                      </n-thing>
                    </n-list-item>
                  </n-list>
                </div>
              </div>
            </template>
            <n-empty v-if="groupedFilteredTags.length === 0 && !searchTerm" description="无可用分组或分类" size="small" style="margin-top: 20px;"/>
            <n-empty v-if="groupedFilteredTags.length === 0 && searchTerm" description="未搜索到匹配标签" size="small" style="margin-top: 20px;"/>
          </n-scrollbar>
        </n-collapse-item>
      </n-collapse>
      <!-- 已选标签区 -->
      <n-card size="small" class="selected-card">
        <n-space justify="end" style="margin-bottom: 8px;">
          <n-button type="primary" size="large" @click="applyRandomWeights" :disabled="selectedTags.length === 0">
            <template #icon><n-icon :component="RandomIcon" /></template>
            随机权重
          </n-button>
          <n-button size="small" @click="resetWeights" :disabled="selectedTags.length === 0">重置权重</n-button>
          <n-button size="small" @click="resetAllTags" :disabled="selectedTags.length === 0">重置权重和括号</n-button>
          <n-button size="small" type="error" @click="clearTags" :disabled="selectedTags.length === 0">清空</n-button>
          <n-button text circle size="small" @click="selectedTagsViewMode = selectedTagsViewMode === 'grid' ? 'list' : 'grid'" style="margin-left: 8px;">
            <n-icon :component="selectedTagsViewMode === 'grid' ? ListIcon : TagIcon" />
          </n-button>
        </n-space>
        <div v-if="selectedTags.length > 0">
          <n-scrollbar style="max-height: 400px; min-height: 40px;">
            <template v-if="selectedTagsViewMode === 'grid'">
              <div class="selected-tags-grid">
                <div class="selected-tag-item header">
                  <div class="tag-name-col">标签</div>
                  <div class="tag-weight-col">权重</div>
                  <div class="tag-bracket-col">括号</div>
                  <div class="tag-nesting-col">嵌套</div>
                  <div class="tag-actions-col">操作</div>
                </div>
                <div v-for="(tag, index) in selectedTags" :key="tag.id" class="selected-tag-item">
                  <div class="tag-name-col">
                    <div>{{ tag.name }}</div>
                    <div class="tag-keyword-selected">{{ tag.keyword || '' }}</div>
                  </div>
                  <div class="tag-weight-col">
                    <n-input-number v-model:value="tagWeights[tag.id]" size="tiny" :min="0" :max="maxWeight" :step="Math.pow(0.1, decimalPlaces)" @update:value="(val) => val !== null && updateTagWeight(tag.id, val)" style="width: 85px;" />
                  </div>
                  <div class="tag-bracket-col">
                    <n-select v-model:value="tagBrackets[tag.id]" :options="bracketTypes" size="tiny" style="width: 80px;" />
                  </div>
                  <div class="tag-nesting-col">
                    <n-input-number
                      v-model:value="bracketNesting[tag.id]"
                      size="tiny"
                      :min="0"
                      :max="5"
                      :step="1"
                      style="width: 90px;"
                      :disabled="tagBrackets[tag.id] === 'none'"
                    />
                  </div>
                  <div class="tag-actions-col">
                    <n-button text circle size="tiny" type="error" @click="removeTag(index)">
                      <template #icon><n-icon :component="ClearIcon"/></template>
                    </n-button>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <n-list hoverable clickable size="small" class="selected-tags-list-view">
                <n-list-item v-for="(tag, index) in selectedTags" :key="tag.id">
                  <n-thing :title="tag.name">
                    <template #description>
                      <span class="tag-keyword-selected">{{ tag.keyword || '' }}</span>
                    </template>
                    <template #action>
                      <n-space>
                        <n-input-number v-model:value="tagWeights[tag.id]" size="tiny" :min="0" :max="maxWeight" :step="Math.pow(0.1, decimalPlaces)" @update:value="(val) => val !== null && updateTagWeight(tag.id, val)" style="width: 85px;" />
                        <n-select v-model:value="tagBrackets[tag.id]" :options="bracketTypes" size="tiny" style="width: 80px;" />
                        <n-input-number
                          v-model:value="bracketNesting[tag.id]"
                          size="tiny"
                          :min="0"
                          :max="5"
                          :step="1"
                          style="width: 90px;"
                          :disabled="tagBrackets[tag.id] === 'none'"
                        />
                        <n-button text circle size="tiny" type="error" @click="removeTag(index)">
                          <template #icon><n-icon :component="ClearIcon"/></template>
                        </n-button>
                      </n-space>
                    </template>
                  </n-thing>
                </n-list-item>
              </n-list>
            </template>
          </n-scrollbar>
        </div>
        <n-empty v-else description="请先输入或选择标签" size="small" style="padding: 20px 0;"/>
      </n-card>
      <!-- 生成结果区 -->
      <n-card size="small" class="result-card">
        <n-select
          v-model:value="activeTemplate"
          :options="Object.entries(templates).map(([key, t]) => ({ label: t.name, value: key as any }))"
          size="small"
          style="width: 150px; margin-bottom: 8px;"
          title="选择输出模板格式"
        />
        <n-input
          v-model:value="generatedPrompt"
          type="textarea"
          placeholder="添加标签后将在此生成..."
          :rows="4"
          readonly
        />
        <n-space justify="end" style="margin-top: 8px;">
          <n-button type="primary" @click="copyToClipboard" :disabled="!generatedPrompt">
            <template #icon><n-icon :component="CopyIcon" /></template>
            复制生成结果
          </n-button>
        </n-space>
      </n-card>
    </div>
    <!-- 折叠面板：高级设置、历史、全局设置 -->
    <n-collapse style="margin-top: 24px;">
      <n-collapse-item title="高级设置">
        <div style="padding: 8px 0;">
          <!-- 解析设置表单 -->
          <n-space vertical size="small">
            <n-input v-model:value="extractionSettings.delimiters" size="tiny" placeholder=",\n\t" style="width: 120px;" />
            <n-checkbox size="small" v-model:checked="extractionSettings.trimWhitespace">去除首尾空格</n-checkbox>
            <n-checkbox size="small" v-model:checked="extractionSettings.removeEmpty">移除空标签</n-checkbox>
            <n-checkbox size="small" v-model:checked="extractionSettings.caseSensitiveMatch">匹配库时区分大小写</n-checkbox>
          </n-space>
          <!-- 权重范围、小数位数、默认括号、全局嵌套等 -->
          <n-space vertical size="small" style="margin-top: 12px;">
            <n-space align="center">
              <span>权重范围:</span>
              <n-input-number size="small" v-model:value="formattedMinWeight" :step="Math.pow(0.1, decimalPlaces)" style="width: 80px;" :min="0" :max="formattedMaxWeight" />
              <span>-</span>
              <n-input-number size="small" v-model:value="formattedMaxWeight" :step="Math.pow(0.1, decimalPlaces)" style="width: 80px;" :min="formattedMinWeight" :max="2" />
            </n-space>
            <n-space align="center">
              <span>小数位数:</span>
              <n-input-number size="small" v-model:value="decimalPlaces" :min="0" :max="3" :step="1" style="width: 80px;" />
            </n-space>
            <n-space align="center">
              <span>默认括号:</span>
              <n-select size="small" v-model:value="defaultBracket" :options="bracketTypes" style="width: 100px;" />
            </n-space>
            <n-space align="center">
              <span>全局嵌套:</span>
              <n-button-group size="small">
                <n-button @click="decreaseGlobalNesting" :disabled="globalNestingCount <= 0">-</n-button>
                <n-button disabled style="min-width: 35px; text-align: center;">{{ globalNestingCount }}</n-button>
                <n-button @click="increaseGlobalNesting" :disabled="globalNestingCount >= 5">+</n-button>
              </n-button-group>
            </n-space>
          </n-space>
        </div>
      </n-collapse-item>
      <n-collapse-item title="历史记录">
        <n-list hoverable clickable size="small" bordered style="max-height: 150px; overflow-y: auto;">
          <template #header><div style="font-size: 12px; color: var(--n-text-color-3);">解析历史 (点击加载)</div></template>
          <n-list-item v-if="!extractionHistory.length">
            <n-empty size="small" description="暂无历史记录" />
          </n-list-item>
          <n-list-item v-for="(text, index) in extractionHistory" :key="index" @click="loadFromHistory(text)">
            {{ text.length > 50 ? text.slice(0, 50) + '...' : text }}
          </n-list-item>
        </n-list>
      </n-collapse-item>
      <n-collapse-item title="全局设置">
        <n-space vertical size="small">
          <n-button text size="tiny" @click="saveSettings" title="手动保存所有设置">
            <template #icon><n-icon :component="SaveIcon"/></template>
            手动保存所有设置
          </n-button>
        </n-space>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<style scoped>
.weight-header {
  padding: 24px 0 0 0;
  margin-left: 0;
}
.weight-main-card {
  max-width: 900px;
  margin: 32px auto 0 auto;
  padding: 32px 16px 48px 16px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.04);
}
.weight-h2 {
  text-align: center;
  font-weight: 600;
  font-size: 22px;
  margin-bottom: 0;
  margin-top: 0;
  letter-spacing: 1px;
}
.main-controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.selected-tags-grid {
  border: 1px solid var(--n-divider-color);
  border-radius: var(--n-border-radius);
  overflow: hidden;
}
.selected-tag-item {
  display: grid;
  grid-template-columns: minmax(140px, 1.5fr) 110px 110px 110px 70px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--n-divider-color);
}
.selected-tag-item:last-child {
  border-bottom: none;
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
.tag-nesting-col,
.tag-actions-col {
  padding: 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.category-header-grid {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color-2);
  margin-bottom: 8px;
}
.tag-list-grid {
  margin-bottom: 12px;
}
.tag-item-card {
  border: 1px solid var(--n-border-color);
  border-radius: 4px;
  padding: 8px 12px;
  background-color: var(--n-color);
  cursor: pointer;
  min-width: 90px;
  text-align: center;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.tag-item-card.tag-item-selected {
  border-color: var(--n-primary-color-pressed);
  box-shadow: 0 0 0 1px var(--n-primary-color-pressed);
  background-color: var(--n-item-color-active-hover);
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
  min-height: 15px;
}
.tag-keyword-selected {
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-top: 2px;
  word-break: break-all;
}
</style> 