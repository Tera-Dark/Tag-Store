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
    NInputGroup,
    NRadioGroup,
    NRadio,
    NTabs,
    NTabPane,
    NCollapse,
    NCollapseItem,
    NSlider,
    useMessage,
    NSpin,
    NDropdown
} from 'naive-ui';
import { 
    CopyOutline as CopyIcon,
    AddOutline as AddIcon,
    ReloadOutline as ResetIcon,
    PricetagsOutline as TagIcon,
    SettingsOutline as SettingsIcon,
    SaveOutline as SaveIcon,
    TrashOutline as ClearIcon,
    ScaleOutline as WeightIcon,
    DocumentTextOutline as TemplateIcon,
    TextOutline as TextIcon,
    ListOutline as ListIcon,
    ShuffleOutline as RandomIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Category, Tag } from '../../types/data';
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
const libraryStore = useLibraryStore();
const message = useMessage();
const router = useRouter();

// --- 基本组件状态 ---
const selectedCategoryIds = ref<string[]>([]);
const searchTerm = ref<string>('');
const selectedTags = ref<Tag[]>([]);
const generatedPrompt = ref<string>('');
const isLoading = ref<boolean>(false);
const ALL_CATEGORIES_KEY = '__ALL__';
const activeTab = ref<string>('select'); // 'select' 或 'text'
const tagLayout = ref<'vertical' | 'grid'>('grid'); // 标签布局：垂直列表或网格

// --- 文本输入模式 ---
const inputText = ref<string>('');
const customTagsHolder = ref<Array<{id: string; name: string; keyword?: string; isFromLibrary?: boolean}>>([]);

// --- 新增：文本转换高级设置状态 ---
const extractionSettings = ref({
  delimiters: ',，\n\t', // 默认分隔符：中英文逗号、换行符、制表符
  trimWhitespace: true,    // 默认去除首尾空格
  removeEmpty: true,       // 默认移除空标签
  caseSensitiveMatch: false, // 默认不区分大小写匹配库
  duplicateHandling: 'keepFirst' as 'keepFirst' | 'keepAll' // 默认去重（保留第一个）
});
const showExtractionSettings = ref(false); // 控制高级设置显隐

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
const promptTemplate = ref<string>('');
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
            extractionHistory: extractionHistory.value // 保存历史记录
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
        }
    } catch (error) {
        console.error('加载设置失败:', error);
        // 不提示错误，避免干扰
    }
};

// --- 计算属性 ---
const categoryOptions = computed(() => {
    return tagStore.categories.map(cat => ({
        label: cat.name,
        value: cat.id
    }));
});

const filteredTags = computed(() => {
    let tags = [...tagStore.tags];
    
    // 按分类过滤 (使用 selectedCategoryIds)
    if (selectedCategoryIds.value.length > 0) {
        // 如果选择了某些分类，则只保留这些分类下的标签
        const selectedSet = new Set(selectedCategoryIds.value);
        tags = tags.filter(tag => selectedSet.has(tag.categoryId));
    }
    // 如果 selectedCategoryIds 为空，则不按分类过滤，显示所有
    
    // 按搜索词过滤
    if (searchTerm.value.trim()) {
        const term = searchTerm.value.toLowerCase().trim();
        tags = tags.filter(tag => 
            tag.name.toLowerCase().includes(term) || 
            (tag.subtitles && tag.subtitles.some(sub => sub.toLowerCase().includes(term)))
        );
    }
    
    // 排除已选标签
    const selectedTagIdsSet = new Set(selectedTags.value.map(t => t.id));
    tags = tags.filter(tag => !selectedTagIdsSet.has(tag.id));
    
    return tags;
});

const currentLibraryName = computed(() => {
    return libraryStore.activeLibrary?.name || '无活动库';
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
    selectedTags.value.push(tag);
    // 设置默认权重和括号类型
    tagWeights.value[tag.id] = defaultWeight.value;
    tagBrackets.value[tag.id] = defaultBracket.value;
    bracketNesting.value[tag.id] = defaultNesting.value;
    generatePrompt();
};

const removeTag = (index: number) => {
    const tag = selectedTags.value[index];
    selectedTags.value.splice(index, 1);
    delete tagWeights.value[tag.id];
    delete tagBrackets.value[tag.id];
    delete bracketNesting.value[tag.id];
    generatePrompt();
};

const clearTags = () => {
    selectedTags.value = [];
    tagWeights.value = {};
    generatePrompt();
};

const updateTagWeight = (tagId: string, value: string | number | null) => {
    if (value !== null) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        tagWeights.value[tagId] = formatNumberByDecimalPlaces(numValue, decimalPlaces.value);
        generatePrompt();
    }
};

// 修改parseInputText函数，添加标签库检索功能
const parseInputText = () => {
    if (!inputText.value.trim()) {
        message.warning('请输入标签文本');
        return;
    }
    
    try {
        // 按中英文逗号分割
        const tags = inputText.value.split(/[,，]+/).filter(tag => tag.trim());
        
        // 转换为标签对象，并查找标签库
        const newTags = tags.map((tagName, index) => {
            // 在标签库中查找是否存在该标签
            const existingTag = tagStore.tags.find(t => 
                t.name.toLowerCase() === tagName.trim().toLowerCase()
            );
            
            // 如果找到，使用现有标签信息
            if (existingTag) {
                return {
                    ...existingTag,
                    isFromLibrary: true // 标记为来自标签库
                };
            }
            
            // 否则创建新标签
            return {
                id: `custom-${Date.now()}-${index}`,
                name: tagName.trim(),
                keyword: '',
                isFromLibrary: false
            };
        });
        
        customTagsHolder.value = newTags;
        
        // 设置默认权重和括号
        customTagsHolder.value.forEach(tag => {
            tagWeights.value[tag.id] = defaultWeight.value;
            tagBrackets.value[tag.id] = defaultBracket.value;
            bracketNesting.value[tag.id] = defaultNesting.value;
        });
        
        // 更新选中标签
        selectedTags.value = customTagsHolder.value as unknown as Tag[];
        
        // 生成提示词
        generatePrompt();
        
        message.success(`已解析 ${customTagsHolder.value.length} 个标签`);
    } catch (error) {
        console.error('解析标签失败:', error);
        message.error('解析标签失败');
    }
};

// 添加重置所有标签（移除权重和括号）的功能
const resetAllTags = () => {
    if (selectedTags.value.length === 0) {
        message.warning('请先选择或输入标签');
        return;
    }
    
    selectedTags.value.forEach(tag => {
        tagWeights.value[tag.id] = 1.0; // 重置为默认权重1.0
        tagBrackets.value[tag.id] = 'none'; // 移除所有括号
    });
    
    generatePrompt();
    message.success('已重置所有标签');
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

// 设置标签括号类型
const updateTagBracket = (tagId: string, value: BracketType) => {
    if (value !== null) {
        tagBrackets.value[tagId] = value;
        generatePrompt();
    }
};

// 应用括号类型到所有标签
const applyBracketToAll = (bracketType: BracketType, additionalNesting?: number) => {
    if (selectedTags.value.length === 0) {
        message.warning('请先选择或输入标签');
        return;
    }
    
    selectedTags.value.forEach(tag => {
        tagBrackets.value[tag.id] = bracketType;
        // 不再修改单个标签的嵌套次数，只设置括号类型
    });
    
    generatePrompt();
    message.success(`已为所有标签应用${bracketTypes.find(b => b.value === bracketType)?.label || '无括号'}`);
};

// 增加或减少括号功能
const toggleBracket = (tagId: string, bracketType: BracketType) => {
    // 继承当前嵌套次数
    const nestingCount = bracketNesting.value[tagId] || 0;
    
    // 如果当前标签已经使用了该括号，则移除；否则设置为新括号
    if (tagBrackets.value[tagId] === bracketType) {
        tagBrackets.value[tagId] = 'none';
    } else {
        tagBrackets.value[tagId] = bracketType;
    }
    generatePrompt();
};

// 增加嵌套次数
const increaseNesting = (tagId: string) => {
    if (!bracketNesting.value[tagId]) {
        bracketNesting.value[tagId] = 0;
    }
    bracketNesting.value[tagId]++;
    generatePrompt();
};

// 减少嵌套次数
const decreaseNesting = (tagId: string) => {
    if (!bracketNesting.value[tagId]) {
        bracketNesting.value[tagId] = 0;
    }
    if (bracketNesting.value[tagId] > 0) {
        bracketNesting.value[tagId]--;
    }
    generatePrompt();
};

// 修复 getBracketedTagName 函数，现在它只负责根据类型和总嵌套数应用括号
const getBracketedTagName = (content: string, bracketType: BracketType, totalNestingLevels: number): string => {
    // 如果没有指定括号类型或总嵌套层数为0，则不应用括号
    if (bracketType === 'none' || totalNestingLevels <= 0) {
        return content;
    }

    let bracketOpen = '';
    let bracketClose = '';

    // 设置括号类型
    switch (bracketType) {
        case 'round': bracketOpen = '('; bracketClose = ')'; break;
        case 'square': bracketOpen = '['; bracketClose = ']'; break;
        case 'curly': bracketOpen = '{'; bracketClose = '}'; break;
        case 'angle': bracketOpen = '<'; bracketClose = '>'; break;
        default: return content; // 未知类型，返回原始内容
    }

    // 应用指定层数的括号
    let openBrackets = '';
    let closeBrackets = '';
    for (let i = 0; i < totalNestingLevels; i++) {
        openBrackets += bracketOpen;
        closeBrackets += bracketClose;
    }

    return openBrackets + content + closeBrackets;
};

// 重构 generatePrompt 函数以实现新的括号和格式化逻辑
const generatePrompt = () => {
    if (selectedTags.value.length === 0) {
        generatedPrompt.value = '';
        return;
    }

    const templateConfig = templates.value[activeTemplate.value];
    if (!templateConfig) {
        console.error('未找到激活的模板配置:', activeTemplate.value);
        return;
    }

    const formattedTags = selectedTags.value.map(tag => {
        const weight = tagWeights.value[tag.id] || defaultWeight.value;
        const formattedWeight = formatNumberByDecimalPlaces(weight, decimalPlaces.value);
        const selectedBracketType = tagBrackets.value[tag.id] || defaultBracket.value;
        const individualNestingCount = bracketNesting.value[tag.id] || 0;
        const tagNameRaw = tag.name;
        const weightIsOne = Number(formattedWeight) === 1.0;

        let contentToWrap = tagNameRaw;
        let effectiveBracketType = selectedBracketType;
        let totalNestingLevels = 0; // 总共要应用的括号层数

        if (weightIsOne) {
            // --- 情况 1 & 3: 权重为 1 --- 
            if (selectedBracketType === 'none') {
                // 情况 1: 权重为1，未选括号 -> 只返回名字
                return tagNameRaw;
            } else {
                // 情况 3: 权重为1，选了括号 -> 只包裹名字，应用嵌套
                contentToWrap = tagNameRaw;
                effectiveBracketType = selectedBracketType;
                // 计算总嵌套层数：全局 + (单个+1基础层)
                totalNestingLevels = globalNestingCount.value + (individualNestingCount + 1);
            }
        } else {
            // --- 情况 2 & 4: 权重不为 1 --- 
            const weightStr = formattedWeight.toString();
            
            // 准备核心内容，尝试去除模板自带的括号
            let coreFormat = templateConfig.tagFormat.replace(/^[({\\[<](.*)[)}\]>]$/, '$1');
            if (coreFormat === templateConfig.tagFormat) { // 如果没有剥离掉括号，使用默认核心
                 coreFormat = '{{name}}:{{weight}}'; 
            }
            contentToWrap = coreFormat
                               .replace('{{name}}', tagNameRaw)
                               .replace('{{weight}}', weightStr);

            if (selectedBracketType === 'none') {
                // 情况 2: 权重不为1，未选括号 -> 默认用 () 包裹，应用嵌套
                effectiveBracketType = 'round';
                // 计算总嵌套层数：全局 + (单个+1基础层)
                totalNestingLevels = globalNestingCount.value + (individualNestingCount + 1);
            } else {
                // 情况 4: 权重不为1，选了括号 -> 用选定括号包裹，应用嵌套
                effectiveBracketType = selectedBracketType;
                // 计算总嵌套层数：全局 + (单个+1基础层)
                totalNestingLevels = globalNestingCount.value + (individualNestingCount + 1);
            }
        }

        // 调用新的 getBracketedTagName 应用括号
        return getBracketedTagName(contentToWrap, effectiveBracketType, totalNestingLevels);
    });

    // 使用模板的模板字符串和分隔符组合最终结果
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
    
    console.log('onMounted: Initializing tagStore...');
    // 初始化标签库数据
    tagStore.initializeStore().then(() => {
        // initializeStore 成功解析，我们假设数据已加载或正在加载
        console.log('onMounted: tagStore initializeStore promise resolved. Categories count:', tagStore.categories.length);
        
        // 直接设置默认值，不再需要 nextTick 或检查长度
        selectedCategoryIds.value = []; 
        tagStore.setFilterCategories([]); 
        console.log('onMounted: Default categories set to empty.');
        
        // 可以在这里添加一个稍微延迟的加载完成提示，如果需要的话
        // setTimeout(() => message.info('分类加载完成'), 100); 
        
    }).catch(error => {
         // 如果 initializeStore 真的失败了，在这里处理错误
         console.error('onMounted: Error initializing tagStore:', error);
         message.error('加载标签库时出错');
         // 保留这个错误提示，因为这是真正的错误
    });
});

// --- 监听器 ---
watch([activeTemplate], () => {
    generatePrompt();
});

// 修复bracketTypes.find问题
const bracketLabel = (value: BracketType) => {
    const found = bracketTypes.find((b) => b.value === value);
    return found ? found.label : '无';
};

// 更新 handleCategorySelect 以处理数组并调用 store 方法
const handleCategorySelect = (categoryIds: string[]) => {
  // 更新本地状态
  selectedCategoryIds.value = categoryIds;
  
  // 调用 tagStore 的方法设置过滤分类 (下一步将在 tagStore 中实现)
  // 注意：这里假设的方法名是 setFilterCategories
  tagStore.setFilterCategories(categoryIds); 
  
  // 显示成功消息
  if (categoryIds.length === 0) {
      message.success('已清除分类选择，显示所有标签');
  } else {
      message.success(`已选择 ${categoryIds.length} 个分类`);
  }
  
  // 在DOM更新后检查标签列表
  nextTick(() => {
    // 检查 filteredTags 是否已定义
    const currentFilteredTags = filteredTags.value;
    if (currentFilteredTags) {
        console.log('选择分类:', categoryIds, '过滤后标签数量:', currentFilteredTags.length);
        if (categoryIds.length > 0 && currentFilteredTags.length === 0) {
          message.info('所选分类下没有可用标签');
        }
    } else {
         console.warn('handleCategorySelect: filteredTags is undefined after nextTick');
    }
  });
};

// 获取当前选择的分类名称的方法
const getCategoryName = () => {
  if (!selectedCategoryIds.value.length) return '选择分类';
  if (selectedCategoryIds.value.length === 1 && selectedCategoryIds.value[0] === ALL_CATEGORIES_KEY) return '所有分类';
  
  const categoryNames = tagStore.categories.filter(cat => selectedCategoryIds.value.includes(cat.id)).map(cat => cat.name);
  return categoryNames.join(', ');
};

// 添加标签视图模式切换状态
const tagsViewMode = ref<'grid' | 'list'>('grid');

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

// 获取所有已选标签的第一个标签的嵌套次数，用于全局控制显示
const getFirstTagNesting = (): number => {
    if (selectedTags.value.length > 0) {
        const firstTagId = selectedTags.value[0].id;
        return getTagNesting(firstTagId);
    }
    return 0;
};

// 添加截断文本的工具函数
const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
};

// 添加自定义渲染函数以确保分类名称完整显示
const renderCategoryLabel = (option: any) => {
  return h(
    'div',
    {
      style: {
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        padding: '4px 0'
      }
    },
    option.label
  );
};

const renderCategoryOption = (option: any) => {
  return h(
    'div',
    {
      style: {
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        padding: '6px 0',
      }
    },
    option.label
  );
};

// 添加单独的全局嵌套计数变量，用于与单个标签嵌套分开
const globalNestingCount = ref<number>(0);

// 修改全局嵌套控制函数，增加和减少全局嵌套次数
const increaseGlobalNesting = () => {
    globalNestingCount.value++;
    generatePrompt();
};

const decreaseGlobalNesting = () => {
    if (globalNestingCount.value > 0) {
        globalNestingCount.value--;
        generatePrompt();
    }
};

// 添加 watch 来监控 tagStore.categories 的变化
watch(() => tagStore.categories, (newCategories) => {
  console.log('Watcher: tagStore.categories changed:', newCategories);
}, { deep: true });

// 4. 添加复用历史记录的方法 (实现将在下一步)
const reuseHistoryEntry = (text: string) => {
    inputText.value = text;
    parseInputText(); // 选择性地：复用后自动解析
    message.success('已复用历史记录');
};
</script>

<template>
  <div class="weight-generator-view">
    <n-page-header title="权重添加器" @back="handleBack">
      <template #subtitle>
        生成带权重的AI绘图提示词
      </template>
      <template #extra>
        <n-space>
          <n-button type="primary" @click="copyToClipboard" :disabled="!generatedPrompt">
            <template #icon>
              <n-icon><CopyIcon /></n-icon>
            </template>
            复制结果
          </n-button>
        </n-space>
      </template>
    </n-page-header>
    
    <n-divider />
    
    <!-- 输入模式选择 REMOVED n-tabs -->
    <!-- <n-tabs type="line" v-model:value="activeTab"> -->
      <!-- <n-tab-pane name="select" tab="标签选择"> -->
        <!-- MOVED Text Input Card Here -->
        <n-card title="文本转标签" size="small" style="margin-bottom: 12px;">
          <n-space vertical>
            <n-input
              v-model:value="inputText"
              type="textarea"
              placeholder="在此输入或粘贴包含标签的文本，用逗号或换行分隔..."
              :rows="4"
            />
            <n-space justify="space-between">
              <n-space>
                  <n-button type="primary" @click="parseInputText">解析标签</n-button>
                  <n-button @click="inputText = ''">清空输入</n-button>
              </n-space>
              <n-button text @click="showExtractionSettings = !showExtractionSettings">
                高级解析设置 {{ showExtractionSettings ? '▼' : '▶' }}
              </n-button>
            </n-space>
            
            <!-- 高级设置区域 -->
            <n-collapse-transition :show="showExtractionSettings">
              <n-card size="small" title="高级解析设置" style="margin-top: 10px;">
                  <n-grid :cols="2" :x-gap="12">
                      <n-gi>
                          <n-form-item label="分隔符 (用 \n 换行, \t 制表)">
                              <n-input 
                                v-model:value="extractionSettings.delimiters" 
                                placeholder=",，\n\t"
                              />
                          </n-form-item>
                      </n-gi>
                      <n-gi>
                           <n-form-item label="重复标签处理">
                              <n-select
                                v-model:value="extractionSettings.duplicateHandling"
                                :options="[
                                    { label: '保留第一个', value: 'keepFirst' },
                                    { label: '保留所有', value: 'keepAll' },
                                    { label: '合并权重', value: 'mergeWeights' } // 可能需要添加
                                ]"
                              />
                          </n-form-item>
                      </n-gi>
                      <n-gi :span="2">
                          <n-space item-style="display: flex; align-items: center;">
                               <n-checkbox v-model:checked="extractionSettings.trimWhitespace">去除首尾空格</n-checkbox>
                               <n-checkbox v-model:checked="extractionSettings.removeEmpty">移除空标签</n-checkbox>
                               <n-checkbox v-model:checked="extractionSettings.caseSensitiveMatch">匹配库时区分大小写</n-checkbox>
                          </n-space>
                      </n-gi>
                  </n-grid>
                   <template #footer>
                      <n-text depth="3" style="font-size: 12px;">修改设置后需重新解析。</n-text>
                   </template>
              </n-card>
            </n-collapse-transition>
          </n-space>
        </n-card>

        <n-grid :cols="24" :x-gap="12">
          <!-- 标签选择 - 改为全宽度 -->
          <n-gi :span="24">
            <n-card title="标签选择" size="small">
              <template #header-extra>
                <n-space>
                  <n-button tertiary size="tiny" @click="tagsViewMode = tagsViewMode === 'list' ? 'grid' : 'list'">
                    <template #icon>
                      <n-icon>
                        <component :is="tagsViewMode === 'list' ? TagIcon : ListIcon" />
                      </n-icon>
                    </template>
                    {{ tagsViewMode === 'list' ? '网格' : '列表' }}
                  </n-button>
                </n-space>
              </template>
              
              <n-space vertical>
                <!-- 调整分类选择和搜索布局，增加选择器宽度 -->
                <n-space style="width: 100%; margin-bottom: 12px;">
                  <!-- 修改select组件，增加宽度，以便能够显示完整内容 -->
                  <n-select
                    v-model:value="selectedCategoryIds"
                    multiple
                    :options="categoryOptions"
                    @update:value="handleCategorySelect"
                    placeholder="选择一个或多个分类 (不选则显示所有)"
                    style="min-width: 180px; width: 40%;"
                    clearable
                    max-tag-count="responsive"
                  />
                  <n-input
                    v-model:value="searchTerm"
                    placeholder="搜索标签..."
                    clearable
                    style="flex: 1;"
                  />
                </n-space>
                
                <!-- 可用标签区域 - 根据视图模式切换显示方式 -->
                <div style="max-height: 400px; overflow-y: auto; overflow-x: hidden; padding: 10px 0; margin-bottom: 10px;">
                  <!-- 网格视图 - 优化间距和显示 -->
                  <div v-if="tagsViewMode === 'grid'" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; padding: 5px;">
                    <n-tag
                      v-for="tag in filteredTags"
                      :key="tag.id"
                      :type="tag.color ? 'success' : 'default'"
                      style="cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; min-height: 32px; display: flex; align-items: center; padding: 4px 8px; box-sizing: border-box;"
                      @click="addTag(tag)"
                    >
                      {{ tag.name }}
                      <template #icon>
                        <n-button tertiary circle size="tiny" @click.stop="addTag(tag)">
                          <template #icon>
                            <n-icon><AddIcon /></n-icon>
                          </template>
                        </n-button>
                      </template>
                    </n-tag>
                    <div v-if="filteredTags.length === 0" class="empty-placeholder" style="grid-column: 1 / -1;">
                      <div>无匹配标签</div>
                      <div class="empty-desc">请尝试其他搜索条件</div>
                    </div>
                  </div>
                  
                  <!-- 列表视图 -->
                  <n-list v-else hoverable clickable>
                    <n-list-item v-for="tag in filteredTags" :key="tag.id" @click="addTag(tag)">
                      <n-thing :title="tag.name">
                        <template #description>
                          <span v-if="tag.subtitles && tag.subtitles.length">
                            {{ tag.subtitles.join(', ') }}
                          </span>
                        </template>
                        <template #header-extra>
                          <n-button tertiary circle size="small" @click.stop="addTag(tag)">
                            <template #icon>
                              <n-icon><AddIcon /></n-icon>
                            </template>
                          </n-button>
                        </template>
                      </n-thing>
                    </n-list-item>
                    <n-list-item v-if="filteredTags.length === 0">
                      <n-thing title="无匹配标签">
                        <template #description>
                          请尝试其他搜索条件
                        </template>
                      </n-thing>
                    </n-list-item>
                  </n-list>
                </div>
              </n-space>
            </n-card>
          </n-gi>
          
          <!-- 已选标签和权重设置 - 另起一行显示 -->
          <n-gi :span="24" style="margin-top: 12px;">
            <n-card title="已选标签" size="small">
              <template #header-extra>
                <n-space align="center">
                  <n-button tertiary size="tiny" @click="tagLayout = tagLayout === 'vertical' ? 'grid' : 'vertical'">
                    <template #icon>
                      <n-icon>
                        <component :is="tagLayout === 'vertical' ? ListIcon : TagIcon" />
                      </n-icon>
                    </template>
                    {{ tagLayout === 'vertical' ? '网格' : '列表' }}
                  </n-button>
                  <n-button tertiary size="tiny" @click="resetWeights">
                    <template #icon>
                      <n-icon><ResetIcon /></n-icon>
                    </template>
                    重置
                  </n-button>
                  <n-button tertiary size="tiny" @click="clearTags">
                    <template #icon>
                      <n-icon><ClearIcon /></n-icon>
                    </template>
                    清空
                  </n-button>
                </n-space>
              </template>
              
              <n-space vertical>
                <n-space style="margin-bottom: 10px; flex-wrap: wrap">
                  <span>快速应用:</span>
                  <n-space style="flex-wrap: wrap">
                    <n-button 
                      v-for="(weight, preset) in weightPresets" 
                      :key="preset"
                      size="tiny"
                      @click="applyWeightPreset(preset)"
                      :disabled="selectedTags.length === 0"
                    >{{ preset }}</n-button>
                    <n-button 
                      size="tiny"
                      @click="applyRandomWeights"
                      type="info"
                      :disabled="selectedTags.length === 0"
                    >
                      <template #icon>
                        <n-icon><RandomIcon /></n-icon>
                      </template>
                      随机权重
                    </n-button>
                    <n-button 
                      size="tiny"
                      @click="resetAllTags"
                      type="warning"
                      :disabled="selectedTags.length === 0"
                    >
                      重置标签
                    </n-button>
                  </n-space>
                </n-space>
                
                <n-space style="margin-bottom: 10px; flex-wrap: wrap">
                  <span>括号类型:</span>
                  <n-space style="flex-wrap: wrap">
                    <n-button 
                      v-for="bracket in bracketTypes" 
                      :key="bracket.value"
                      size="tiny"
                      @click="() => applyBracketToAll(bracket.value as BracketType)"
                      :disabled="selectedTags.length === 0"
                    >{{ bracket.label }}</n-button>
                    
                    <!-- 全局嵌套控制按钮 -->
                    <n-space v-if="selectedTags.length > 0">
                      <n-button 
                        size="tiny" 
                        type="info"
                        @click="decreaseGlobalNesting"
                      >-</n-button>
                      <span>全局嵌套: {{ globalNestingCount }}</span>
                      <n-button 
                        size="tiny" 
                        type="info"
                        @click="increaseGlobalNesting"
                      >+</n-button>
                    </n-space>
                  </n-space>
                </n-space>
                
                <!-- 网格布局显示标签 - 高度自适应 -->
                <template v-if="tagLayout === 'grid'">
                  <div class="tags-grid" :style="{ maxHeight: getSelectedTagsHeight() }">
                    <div class="tags-grid-container">
                      <div v-for="(tag, index) in selectedTags" :key="tag.id" class="tag-card-wrapper">
                        <n-card size="small" class="tag-card">
                          <div class="tag-card-content">
                            <div class="tag-header">
                              <div class="tag-title" :title="tag.name">{{ tag.name }}</div>
                              <n-button tertiary circle size="tiny" @click="removeTag(index)" class="tag-remove-btn">
                                <template #icon>
                                  <n-icon><ClearIcon /></n-icon>
                                </template>
                              </n-button>
                            </div>
                            
                            <!-- 添加keyword显示 -->
                            <div v-if="tag.keyword" class="tag-keyword" :title="tag.keyword">
                              {{ truncateText(tag.keyword, 20) }}
                            </div>
                            
                            <div class="tag-controls">
                              <div class="tag-weight-control">
                                <n-space :size="3" align="center">
                                  <n-icon size="14"><WeightIcon /></n-icon>
                                  <n-input-number
                                    v-model:value="tagWeights[tag.id]"
                                    size="small"
                                    :min="0"
                                    :max="2"
                                    :step="Math.pow(0.1, decimalPlaces)"
                                    @update:value="(val) => val !== null && updateTagWeight(tag.id, val)"
                                    style="width: 120px;"
                                  />
                                  <n-button size="tiny" @click="randomizeTagWeight(tag.id)" class="random-btn">
                                    <n-icon size="14"><RandomIcon /></n-icon>
                                  </n-button>
                                </n-space>
                              </div>
                              
                              <div class="tag-bracket-buttons">
                                <n-space :size="2">
                                  <n-button 
                                    v-for="bracket in bracketTypes.filter(b => b.value !== 'none')" 
                                    :key="bracket.value"
                                    size="tiny" 
                                    :type="tagBrackets[tag.id] === bracket.value ? 'primary' : 'default'"
                                    @click="toggleBracket(tag.id, bracket.value as BracketType)"
                                  >
                                    {{ bracket.example }}
                                  </n-button>
                                  <n-button 
                                    size="tiny"
                                    :type="tagBrackets[tag.id] === 'none' ? 'primary' : 'default'"
                                    @click="tagBrackets[tag.id] = 'none'; generatePrompt()"
                                  >
                                    无
                                  </n-button>
                                  
                                  <!-- 添加嵌套控制按钮 -->
                                  <n-space v-if="tagBrackets[tag.id] !== 'none'" style="margin-left: 4px">
                                    <n-button size="tiny" @click="decreaseNesting(tag.id)">-</n-button>
                                    <span>+{{ getTagNesting(tag.id) }}</span>
                                    <n-button size="tiny" @click="increaseNesting(tag.id)">+</n-button>
                                  </n-space>
                                </n-space>
                              </div>
                            </div>
                          </div>
                        </n-card>
                      </div>
                    </div>
                    
                    <div v-if="selectedTags.length === 0" class="empty-placeholder">
                      <div>尚未选择标签</div>
                      <div class="empty-desc">从上方添加标签</div>
                    </div>
                  </div>
                </template>
                
                <!-- 垂直列表显示标签 - 高度自适应 -->
                <template v-else>
                  <div :style="{ maxHeight: getSelectedTagsHeight(), overflowY: 'auto' }">
                    <n-list hoverable>
                      <n-list-item v-for="(tag, index) in selectedTags" :key="tag.id">
                        <n-thing :title="tag.name">
                          <template #description>
                            <n-space vertical :size="8">
                              <n-space align="center" :size="5">
                                <n-icon size="16"><WeightIcon /></n-icon>
                                <n-input-number
                                  v-model:value="tagWeights[tag.id]"
                                  size="small"
                                  :min="0"
                                  :max="2"
                                  :step="Math.pow(0.1, decimalPlaces)"
                                  @update:value="(val) => val !== null && updateTagWeight(tag.id, val)"
                                  style="width: 120px;"
                                />
                                <n-button size="tiny" @click="randomizeTagWeight(tag.id)">
                                  <template #icon>
                                    <n-icon><RandomIcon /></n-icon>
                                  </template>
                                </n-button>
                              </n-space>
                              
                              <n-space :size="2">
                                <n-button 
                                  v-for="bracket in bracketTypes.filter(b => b.value !== 'none')" 
                                  :key="bracket.value"
                                  size="tiny" 
                                  :type="tagBrackets[tag.id] === bracket.value ? 'primary' : 'default'"
                                  @click="toggleBracket(tag.id, bracket.value as BracketType)"
                                >
                                  {{ bracket.example }}
                                </n-button>
                                <n-button 
                                  size="tiny"
                                  :type="tagBrackets[tag.id] === 'none' ? 'primary' : 'default'"
                                  @click="tagBrackets[tag.id] = 'none'; generatePrompt()"
                                >
                                  无
                                </n-button>
                                
                                <!-- 添加嵌套控制按钮 -->
                                <n-space v-if="tagBrackets[tag.id] !== 'none'" style="margin-left: 4px">
                                  <n-button size="tiny" @click="decreaseNesting(tag.id)">-</n-button>
                                  <span>+{{ getTagNesting(tag.id) }}</span>
                                  <n-button size="tiny" @click="increaseNesting(tag.id)">+</n-button>
                                </n-space>
                              </n-space>
                            </n-space>
                          </template>
                          <template #header-extra>
                            <n-button tertiary circle size="small" @click="removeTag(index)">
                              <template #icon>
                                <n-icon><ClearIcon /></n-icon>
                              </template>
                            </n-button>
                          </template>
                        </n-thing>
                      </n-list-item>
                      <n-list-item v-if="selectedTags.length === 0">
                        <n-thing title="尚未选择标签">
                          <template #description>
                            从上方添加标签
                          </template>
                        </n-thing>
                      </n-list-item>
                    </n-list>
                  </div>
                </template>
              </n-space>
            </n-card>
          </n-gi>
        </n-grid>
      <!-- </n-tab-pane> -->
      
      <!-- REMOVED TEXT TAB PANE -->
      <!-- <n-tab-pane name="text" tab="文本转换"> -->
        <!-- Text Input Card was here - MOVED UP -->
        <!-- Parsed Tags Card was here - REMOVED -->
        <!-- History Card was here - REMOVED -->
      <!-- </n-tab-pane> -->
      
      <!-- <n-tab-pane name="settings" tab="设置"> -->
        <!-- Settings Card - REMAINS BUT UNWRAPPED -->
        <n-grid :cols="24" :x-gap="12" style="margin-top: 12px;">
          <n-gi :span="24">
            <n-card title="权重与括号设置" size="small">
              <n-grid :cols="24" :x-gap="12">
                <n-gi :span="12">
                  <n-space vertical>
                    <!-- 最小权重设置 -->
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                      <span style="width: 80px; flex-shrink: 0;">最小权重:</span>
                      <n-slider 
                        v-model:value="formattedMinWeight" 
                        :min="0" 
                        :max="2" 
                        :step="Math.pow(0.1, decimalPlaces)"
                        style="flex: 1; margin: 0 16px;"
                      />
                      <n-input-number 
                        v-model:value="formattedMinWeight" 
                        size="small" 
                        :min="0" 
                        :max="formattedMaxWeight" 
                        :step="Math.pow(0.1, decimalPlaces)" 
                        style="width: 120px; flex-shrink: 0;" 
                      />
                    </div>
                    
                    <!-- 最大权重设置 -->
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                      <span style="width: 80px; flex-shrink: 0;">最大权重:</span>
                      <n-slider 
                        v-model:value="formattedMaxWeight" 
                        :min="formattedMinWeight" 
                        :max="2" 
                        :step="Math.pow(0.1, decimalPlaces)"
                        style="flex: 1; margin: 0 16px;"
                      />
                      <n-input-number 
                        v-model:value="formattedMaxWeight" 
                        size="small" 
                        :min="formattedMinWeight" 
                        :max="2" 
                        :step="Math.pow(0.1, decimalPlaces)" 
                        style="width: 120px; flex-shrink: 0;" 
                      />
                    </div>
                    
                    <!-- 小数位数设置 - 没有滑块 -->
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                      <span style="width: 80px; flex-shrink: 0;">小数位数:</span>
                      <div style="flex: 1;"></div>
                      <n-input-number 
                        v-model:value="decimalPlaces" 
                        size="small" 
                        :min="0" 
                        :max="3" 
                        :step="1" 
                        style="width: 120px; flex-shrink: 0;" 
                      />
                    </div>
                  </n-space>
                </n-gi>
                
                <n-gi :span="12">
                  <n-space vertical>
                    <!-- 默认括号设置 -->
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                      <span style="width: 80px; flex-shrink: 0;">默认括号:</span>
                      <n-select
                        v-model:value="defaultBracket"
                        :options="bracketTypes"
                        size="small"
                        style="width: 120px;"
                      />
                    </div>
                    
                    <!-- 默认嵌套设置 -->
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                      <span style="width: 80px; flex-shrink: 0;">默认嵌套:</span>
                      <n-input-number
                        v-model:value="defaultNesting"
                        :min="0"
                        :max="5"
                        :step="1"
                        size="small"
                        style="width: 120px;"
                      />
                    </div>
                    
                    <!-- 按钮区域 -->
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                      <n-button 
                        @click="applyRandomWeights"
                        size="small"
                        type="info"
                        :disabled="selectedTags.length === 0"
                      >
                        <template #icon>
                          <n-icon><RandomIcon /></n-icon>
                        </template>
                        应用随机权重
                      </n-button>
                      <n-button 
                        tertiary 
                        size="small" 
                        @click="tagLayout = tagLayout === 'vertical' ? 'grid' : 'vertical'"
                      >
                        {{ tagLayout === 'vertical' ? '网格布局' : '列表布局' }}
                      </n-button>
                    </div>
                  </n-space>
                </n-gi>
              </n-grid>
            </n-card>
          </n-gi>
          
          <n-gi :span="24" style="margin-top: 12px;">
            <n-space justify="end">
              <n-button type="primary" @click="saveSettings">
                <template #icon>
                  <n-icon><SaveIcon /></n-icon>
                </template>
                保存设置
              </n-button>
            </n-space>
          </n-gi>
        </n-grid>
      <!-- </n-tab-pane> -->
    <!-- </n-tabs> -->
    
    <!-- 下方生成结果和设置 -->
    <n-card title="生成结果" size="small" style="margin-top: 12px;">
      <template #header-extra>
        <n-select
          v-model:value="activeTemplate"
          :options="Object.entries(templates).map(([key, t]) => ({ label: t.name, value: key as any }))"
          style="width: 150px;"
        />
      </template>
      
      <n-space vertical size="large">
        <n-input
          v-model:value="generatedPrompt"
          type="textarea"
          placeholder="选择标签后将在此显示生成的提示词..."
          :rows="4"
          :readonly="true"
        />
        
        <n-space>
          <n-button type="primary" @click="copyToClipboard" :disabled="!generatedPrompt">
            <template #icon>
              <n-icon><CopyIcon /></n-icon>
            </template>
            复制到剪贴板
          </n-button>
          <n-button @click="applyRandomWeights" :disabled="selectedTags.length === 0">
            <template #icon>
              <n-icon><RandomIcon /></n-icon>
            </template>
            随机权重
          </n-button>
        </n-space>
      </n-space>
    </n-card>
    
    <!-- 设置 -->
    <n-collapse style="margin-top: 12px;">
      <n-collapse-item title="高级设置" name="advanced">
        <n-grid :cols="24" :x-gap="12">
          <n-gi :span="12">
            <n-card title="默认权重设置" size="small">
              <n-space vertical>
                <n-space align="center">
                  <span>默认权重值:</span>
                  <n-input-number
                    v-model:value="defaultWeight"
                    :min="0"
                    :max="2"
                    :step="Math.pow(0.1, decimalPlaces)"
                    style="width: 120px;"
                  />
                </n-space>
                
                <n-space vertical>
                  <div v-for="(weight, preset) in weightPresets" :key="preset">
                    <n-space align="center">
                      <span style="width: 60px;">{{ preset }}:</span>
                      <n-input-number
                        v-model:value="weightPresets[preset]"
                        :min="0"
                        :max="2"
                        :step="Math.pow(0.1, decimalPlaces)"
                        style="width: 120px;"
                      />
                    </n-space>
                  </div>
                </n-space>
                
                <n-space align="center" style="margin-top: 10px;">
                  <span>小数位数:</span>
                  <n-input-number
                    v-model:value="decimalPlaces"
                    :min="0"
                    :max="3"
                    :step="1"
                    style="width: 120px;"
                  />
                  <span style="color: #999; font-size: 0.9em;">
                    (控制随机权重精度)
                  </span>
                </n-space>
              </n-space>
            </n-card>
          </n-gi>
          
          <n-gi :span="12">
            <n-card 
              v-if="activeTemplate === 'custom'" 
              title="自定义模板设置" 
              size="small"
            >
              <n-space vertical>
                <n-space align="center">
                  <span>模板名称:</span>
                  <n-input
                    v-model:value="templates.custom.name"
                    placeholder="模板名称"
                    style="width: 120px;"
                  />
                </n-space>
                
                <n-space align="center">
                  <span>标签格式:</span>
                  <n-input
                    v-model:value="templates.custom.tagFormat"
                    placeholder="使用 {{name}} 和 {{weight}} 作为占位符"
                  />
                </n-space>
                
                <n-space align="center">
                  <span>分隔符:</span>
                  <n-input
                    v-model:value="templates.custom.separator"
                    placeholder="标签之间的分隔符"
                    style="width: 120px;"
                  />
                </n-space>
                
                <n-space align="center">
                  <span>描述:</span>
                  <n-input
                    v-model:value="templates.custom.description"
                    placeholder="模板描述"
                  />
                </n-space>
              </n-space>
            </n-card>
            <n-card 
              v-else 
              title="当前模板信息" 
              size="small"
            >
              <n-thing 
                :title="currentTemplate.name"
                :description="currentTemplate.description"
              >
                <div>
                  <div>标签格式: {{ currentTemplate.tagFormat }}</div>
                  <div>分隔符: "{{ currentTemplate.separator }}"</div>
                </div>
              </n-thing>
            </n-card>
          </n-gi>
          
          <n-gi :span="24" style="margin-top: 12px;">
            <n-space justify="end">
              <n-button type="primary" @click="saveSettings">
                <template #icon>
                  <n-icon><SaveIcon /></n-icon>
                </template>
                保存设置
              </n-button>
            </n-space>
          </n-gi>
        </n-grid>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<style scoped>
.weight-generator-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* 下拉按钮样式 */
.category-dropdown {
  width: 40%;
}

/* 调整标签网格样式 */
.tags-grid-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  padding: 5px;
}

.tag-card-wrapper {
  width: calc(25% - 10px);
  min-width: 150px;
}

/* 调整标签样式，确保内容可见 */
:deep(.n-tag) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 8px;
}

.empty-placeholder {
  padding: 20px;
  text-align: center;
  color: #999;
  width: 100%;
}

.empty-desc {
  font-size: 0.9em;
  margin-top: 8px;
}

.tags-grid {
  position: relative;
}

.tag-card-wrapper {
  width: calc(25% - 8px);
}

.tag-card {
  transition: all 0.2s ease;
  height: 100%;
}

.tag-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
}

.tag-card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tag-title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-remove-btn {
  flex-shrink: 0;
}

.tag-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-weight-control, .tag-bracket-control {
  display: flex;
  align-items: center;
}

.random-btn {
  padding: 0 4px;
}

.tag-bracket-buttons {
  display: flex;
  align-items: center;
  margin-top: 4px;
}

.tag-bracket-buttons .n-button {
  min-width: 36px;
  padding: 0 4px;
}

.tag-keyword {
  font-size: 0.85em;
  color: #666;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 恢复响应式布局 */
@media (max-width: 1200px) {
  .tag-card-wrapper {
    width: calc(33.33% - 8px);
  }
}

@media (max-width: 768px) {
  .tag-card-wrapper {
    width: calc(50% - 8px);
  }
}

@media (max-width: 576px) {
  .tag-card-wrapper {
    width: 100%;
  }
}

/* 也为列表模式添加 */
:deep(.n-thing-main__description) .tag-keyword {
  font-size: 0.85em;
  color: #666;
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 增强下拉选择器样式 */
:deep(.n-select) {
  min-width: 180px;
}

:deep(.n-base-selection-label) {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.n-base-selection-placeholder) {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.n-base-selection-tags) {
  max-width: 100%;
  overflow: hidden;
}

:deep(.n-base-selection-input) {
  max-width: 100%;
}
</style> 