<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
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
    NTreeSelect,
    NTag,
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
import { useSettingsStore } from '../../stores/settingsStore';
import { useRouter } from 'vue-router';
import type { Tag, Group, Category } from '../../types/data';
import { safeCompare, filterValidTags } from '../../utils/sortHelpers';
import { useErrorHandler, ErrorType } from '../../services/ErrorService';
import _ from 'lodash';

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
const selectedNodeKeys = ref<string[]>([]);
const ALL_CATEGORIES_KEY = '__ALL__';
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

const MAX_TAGS_PER_PAGE = 50; // 每页显示的最大标签数
const currentPage = ref(1); // 当前页码
const isVirtualScrollEnabled = ref(true); // 是否启用虚拟滚动
const tagsPerPage = ref(MAX_TAGS_PER_PAGE); // 用户可调整的每页标签数量

// 添加加载状态
const isLoadingMoreTags = ref(false);

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
            selectedNodeKeys: selectedNodeKeys.value, // 存储选择的节点键（多选分类）
            // 保存懒加载设置
            lazyLoadSettings: {
                tagsPerPage: tagsPerPage.value,
                isVirtualScrollEnabled: isVirtualScrollEnabled.value
            }
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
            
            // 加载分类选择（多选）
            if (settings.selectedNodeKeys && Array.isArray(settings.selectedNodeKeys)) {
                selectedNodeKeys.value = settings.selectedNodeKeys;
            }
            
            // 加载懒加载设置
            if (settings.lazyLoadSettings) {
                tagsPerPage.value = settings.lazyLoadSettings.tagsPerPage || MAX_TAGS_PER_PAGE;
                isVirtualScrollEnabled.value = settings.lazyLoadSettings.isVirtualScrollEnabled !== undefined 
                    ? settings.lazyLoadSettings.isVirtualScrollEnabled 
                    : true;
            }
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
const treeData = computed(() => {
  const groupMap = new Map<string, { group: Group; categories: Category[] }>();
  tagStore.groups.forEach(g => groupMap.set(g.id, { group: g, categories: [] }));
  tagStore.categories.forEach(c => {
      const groupData = groupMap.get(c.groupId);
      if (groupData) {
          groupData.categories.push(c);
      }
  });
  groupMap.forEach(gData => gData.categories.sort(safeCompare));
  const sortedGroups = Array.from(groupMap.values())
      .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || safeCompare(a.group, b.group));

  const groupOptions = sortedGroups.map(gData => ({
      label: gData.group.name,
      key: `group-${gData.group.id}`,
      icon: () => h(NIcon, null, { default: () => h(TagIcon) }),
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
          icon: () => h(NIcon, null, { default: () => h(TagIcon) })
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

const tagsViewMode = ref<'grid' | 'list'>('grid'); // Restore view mode state

// Modify filteredTags to group by Group -> Category
const groupedFilteredTags = computed(() => {
    // 根据finalSelectedCategoryIds和searchTerm直接过滤
    const baseFilteredTags = filterValidTags(tagStore.tags.filter(t => {
        // 分类过滤：判断标签的分类ID是否在选定的分类ID列表中
        const categoryMatch = finalSelectedCategoryIds.value.includes(t.categoryId);
        
        // 搜索词过滤
        const searchMatch = !searchTerm.value || 
                            t.name.toLowerCase().includes(searchTerm.value.toLowerCase()) || 
                            t.subtitles?.some(s => s.toLowerCase().includes(searchTerm.value.toLowerCase())) || 
                            t.keyword?.toLowerCase().includes(searchTerm.value.toLowerCase());
        
        return categoryMatch && searchMatch;
    }));

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
            categoryData.tags.sort(safeCompare);
        });
         // Convert categories map to sorted array for the template
        (groupData as any).sortedCategories = Array.from(groupData.categories.values())
            .sort((a, b) => safeCompare(a.category, b.category));
    });

    const sortedGroups = Array.from(groupMap.values())
        .sort((a, b) => (a.group.order ?? Infinity) - (b.group.order ?? Infinity) || safeCompare(a.group, b.group));

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
    // Default expansion is now handled by the watcher
    
    // 添加滚动监听，实现自动加载更多
    if (typeof window !== 'undefined') {
        const handleScroll = _.debounce(() => {
            if (!isVirtualScrollEnabled.value || isLoadingMoreTags.value || !hasMoreTags.value) return;
            
            // 更精确的选择器，通过标签库面板作为父元素
            const tagListContainer = document.querySelector('.left-panel .n-scrollbar');
            if (!tagListContainer) return;
            
            const rect = tagListContainer.getBoundingClientRect();
            const isNearBottom = rect.bottom <= window.innerHeight + 100;
            
            if (isNearBottom) {
                loadMoreTags();
            }
        }, 200);
        
        window.addEventListener('scroll', handleScroll);
        
        // 清理函数
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }
});

// --- 监听器 ---
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

// 计算分页后的标签
const paginatedTags = computed(() => {
  if (!isVirtualScrollEnabled.value) {
    return groupedFilteredTags.value; // 如果不启用虚拟滚动，返回全部标签
  }
  return groupedFilteredTags.value.slice(0, currentPage.value * tagsPerPage.value);
});

// 添加加载更多按钮
const hasMoreTags = computed(() => {
  return paginatedTags.value.length < groupedFilteredTags.value.length;
});

// 修改loadMoreTags函数，添加加载状态
const loadMoreTags = async () => {
  isLoadingMoreTags.value = true;
  // 模拟延迟加载，给UI时间刷新
  await new Promise(resolve => setTimeout(resolve, 100));
  currentPage.value++;
  isLoadingMoreTags.value = false;
};

// 检查标签是否已被选中
const isTagSelected = (tagId: string): boolean => {
  return selectedTags.value.some(tag => tag.id === tagId);
};

// 清空所有选中的标签
const clearAllTags = () => {
  selectedTags.value = [];
  tagWeights.value = {};
  tagBrackets.value = {};
  bracketNesting.value = {};
  generatePrompt();
  message.success('已清空所有标签');
};
</script>

<template>
  <div class="weight-generator-header">
    <n-button text circle size="large" class="back-btn" @click="handleBack">
      <n-icon size="24" :component="ArrowBackIcon" />
    </n-button>
  </div>
  <div class="weight-generator-container">
    <h1 class="page-title">权重添加器</h1>
    
    <div class="main-layout">
      <!-- 左侧面板：输入和设置 -->
      <div class="left-panel">
        <!-- 输入文本区域 -->
        <n-card title="文本输入" class="control-card">
          <n-space vertical size="large">
            <n-input
              v-model:value="inputText"
              type="textarea"
              :rows="4"
              placeholder="在此输入或粘贴标签文本，用逗号、换行符或Tab分隔..."
            />
            <div class="action-buttons">
              <n-button
                type="primary"
                size="large"
                @click="handleParseAndAdd"
                class="main-action-button"
              >
                解析并添加标签
              </n-button>
            </div>
          </n-space>
        </n-card>
        
        <!-- 标签库选择 -->
        <n-card title="从标签库选择" class="control-card">
          <n-space vertical size="medium">
            <div class="input-group">
              <div class="input-label">筛选分类</div>
              <n-tree-select
                v-model:value="selectedNodeKeys"
                :options="treeData"
                multiple
                cascade
                placeholder="选择分类"
                clearable
                class="full-width"
              />
            </div>
            
            <div class="input-group">
              <div class="input-label">搜索标签</div>
              <n-input 
                v-model:value="searchTerm" 
                placeholder="输入关键词搜索" 
                clearable
                class="full-width"
              />
            </div>
            
            <n-scrollbar style="max-height: 220px;">
              <div v-for="groupData in paginatedTags" :key="groupData.group.id">
                <div class="group-header">{{ groupData.group.name }}</div>
                <div v-for="categoryData in Array.from(groupData.categories.values())" :key="categoryData.category.id">
                  <div class="category-header">{{ categoryData.category.name }}</div>
                  <div class="tag-list-grid">
                    <div 
                      v-for="tag in categoryData.tags" 
                      :key="tag.id"
                      class="tag-item-wrapper"
                      @click="toggleSelectionFromLibrary(tag)"
                    >
                      <n-tag 
                        :type="isTagSelected(tag.id) ? 'primary' : 'default'"
                        size="medium"
                        class="tag-item"
                      >
                        {{ tag.name }}
                      </n-tag>
                      <div class="tag-keyword-tooltip" v-if="tag.keyword">{{ tag.keyword }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="hasMoreTags && isVirtualScrollEnabled" class="load-more-container">
                <n-button 
                  size="small" 
                  @click="loadMoreTags" 
                  :loading="isLoadingMoreTags"
                  :disabled="isLoadingMoreTags"
                >
                  {{ isLoadingMoreTags ? '加载中...' : `加载更多 (${paginatedTags.length}/${groupedFilteredTags.length})` }}
                </n-button>
              </div>
            </n-scrollbar>
          </n-space>
        </n-card>
        
        <!-- 基本设置 -->
        <n-card title="基本设置" class="control-card">
          <n-space vertical size="medium">
            <div class="input-group">
              <div class="input-label">输出模板</div>
              <n-select
                v-model:value="activeTemplate"
                :options="Object.entries(templates).map(([key, t]) => ({ label: t.name, value: key as any }))"
                placeholder="选择模板格式"
                class="full-width"
              />
            </div>
            
            <div class="input-group">
              <div class="input-label">默认权重</div>
              <n-input-number
                v-model:value="defaultWeight"
                :min="0"
                :max="2"
                :step="Math.pow(0.1, decimalPlaces)"
                class="full-width"
              />
            </div>
            
            <div class="input-group">
              <div class="input-label">默认括号</div>
              <n-select
                v-model:value="defaultBracket"
                :options="bracketTypes"
                placeholder="选择括号类型"
                class="full-width"
              />
            </div>
            
            <div class="input-group">
              <div class="input-label">小数位数</div>
              <n-input-number
                v-model:value="decimalPlaces"
                :min="0"
                :max="3"
                :step="1"
                class="full-width"
              />
            </div>
          </n-space>
        </n-card>
        
        <!-- 历史记录 -->
        <n-card title="历史记录" class="control-card">
          <n-scrollbar style="max-height: 150px;">
            <div v-if="!extractionHistory.length" class="empty-history">暂无解析历史记录</div>
            <div class="history-list" v-else>
              <div 
                v-for="(text, index) in extractionHistory" 
                :key="index" 
                class="history-item" 
                @click="loadFromHistory(text)"
              >
                <div class="history-text">
                  {{ text.length > 50 ? text.slice(0, 50) + '...' : text }}
                </div>
              </div>
            </div>
          </n-scrollbar>
        </n-card>
      </div>
      
      <!-- 右侧面板：选中标签和输出结果 -->
      <div class="right-panel">
        <!-- 选中的标签 -->
        <n-card title="已选标签" class="result-card">
          <template #header-extra>
            <span v-if="selectedTags.length" class="tag-count">
              共 {{ selectedTags.length }} 个标签
            </span>
          </template>
          
          <div v-if="selectedTags.length === 0" class="empty-state">
            <n-empty description="尚未选择任何标签" />
          </div>
          
          <div v-else class="selected-tags-container">
            <div class="selected-tags-header">
              <div class="header-name">标签名称</div>
              <div class="header-keyword">关键词</div>
              <div class="header-weight">权重</div>
              <div class="header-bracket">括号</div>
              <div class="header-nesting">嵌套</div>
              <div class="header-action"></div>
            </div>
            
            <n-scrollbar style="max-height: 350px;">
              <div 
                v-for="(tag, index) in selectedTags" 
                :key="tag.id" 
                class="selected-tag-item"
              >
                <div class="tag-name">{{ tag.name }}</div>
                <div class="tag-keyword">{{ tag.keyword || '-' }}</div>
                <div class="tag-weight">
                  <n-input-number 
                    v-model:value="tagWeights[tag.id]" 
                    size="small" 
                    :min="0" 
                    :max="maxWeight" 
                    :step="Math.pow(0.1, decimalPlaces)"
                    @update:value="(val) => val !== null && updateTagWeight(tag.id, val)"
                  />
                </div>
                <div class="tag-bracket">
                  <n-select 
                    v-model:value="tagBrackets[tag.id]" 
                    :options="bracketTypes" 
                    size="small"
                  />
                </div>
                <div class="tag-nesting">
                  <n-input-number
                    v-model:value="bracketNesting[tag.id]"
                    size="small"
                    :min="0"
                    :max="5"
                    :step="1"
                    :disabled="tagBrackets[tag.id] === 'none'"
                  />
                </div>
                <div class="tag-action">
                  <n-button text circle size="small" type="error" @click="removeTag(index)">
                    <template #icon><n-icon :component="ClearIcon"/></template>
                  </n-button>
                </div>
              </div>
            </n-scrollbar>
            
            <div class="bulk-actions">
              <n-space justify="space-between">
                <n-button size="small" @click="resetAllTags">重置权重和括号</n-button>
                <n-button size="small" @click="applyRandomWeights">随机权重</n-button>
                <n-button size="small" type="error" @click="clearAllTags" v-if="selectedTags.length > 0">
                  清空所有
                </n-button>
              </n-space>
            </div>
          </div>
        </n-card>
        
        <!-- 生成结果 -->
        <n-card title="生成结果" class="result-card">
          <n-input
            v-model:value="generatedPrompt"
            type="textarea"
            placeholder="添加标签后将在此生成..."
            :rows="5"
            readonly
          />
          
          <div class="result-actions">
            <n-button
              type="primary"
              size="large"
              @click="copyToClipboard"
              :disabled="!generatedPrompt"
              class="copy-button"
            >
              <template #icon><n-icon :component="CopyIcon" /></template>
              复制生成结果
            </n-button>
          </div>
        </n-card>
        
        <!-- 高级设置 -->
        <n-card title="高级设置" class="result-card">
          <n-collapse>
            <n-collapse-item title="文本解析设置">
              <n-space vertical>
                <div class="advanced-option">
                  <span class="option-label">分隔符：</span>
                  <n-input 
                    v-model:value="extractionSettings.delimiters" 
                    size="small" 
                    placeholder=",\n\t" 
                  />
                </div>
                <n-space>
                  <n-checkbox v-model:checked="extractionSettings.trimWhitespace">去除首尾空格</n-checkbox>
                  <n-checkbox v-model:checked="extractionSettings.removeEmpty">移除空标签</n-checkbox>
                </n-space>
                <n-space>
                  <n-checkbox v-model:checked="extractionSettings.caseSensitiveMatch">匹配库时区分大小写</n-checkbox>
                </n-space>
              </n-space>
            </n-collapse-item>
            
            <n-collapse-item title="权重范围设置">
              <n-space vertical>
                <div class="advanced-option">
                  <span class="option-label">最小权重：</span>
                  <n-input-number 
                    v-model:value="formattedMinWeight" 
                    :step="Math.pow(0.1, decimalPlaces)" 
                    :min="0" 
                    :max="formattedMaxWeight" 
                    size="small"
                  />
                </div>
                <div class="advanced-option">
                  <span class="option-label">最大权重：</span>
                  <n-input-number 
                    v-model:value="formattedMaxWeight" 
                    :step="Math.pow(0.1, decimalPlaces)" 
                    :min="formattedMinWeight" 
                    :max="2" 
                    size="small"
                  />
                </div>
                <div class="advanced-option">
                  <span class="option-label">全局嵌套：</span>
                  <n-button-group size="small">
                    <n-button @click="decreaseGlobalNesting" :disabled="globalNestingCount <= 0">-</n-button>
                    <n-button disabled style="min-width: 35px; text-align: center;">{{ globalNestingCount }}</n-button>
                    <n-button @click="increaseGlobalNesting" :disabled="globalNestingCount >= 5">+</n-button>
                  </n-button-group>
                </div>
              </n-space>
            </n-collapse-item>
            
            <n-collapse-item title="性能设置">
              <n-space vertical>
                <n-checkbox v-model:checked="isVirtualScrollEnabled">启用懒加载 (大量标签时提高性能)</n-checkbox>
                <div class="advanced-option" v-if="isVirtualScrollEnabled">
                  <span class="option-label">每页标签数：</span>
                  <n-slider 
                    v-model:value="tagsPerPage" 
                    :min="10" 
                    :max="200" 
                    :step="10" 
                    style="width: 180px;"
                  />
                </div>
              </n-space>
            </n-collapse-item>
          </n-collapse>
          
          <div class="save-settings">
            <n-button @click="saveSettings" size="small">
              <template #icon><n-icon :component="SaveIcon"/></template>
              保存设置
            </n-button>
          </div>
        </n-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 全局容器样式 */
.weight-generator-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.weight-generator-header {
  padding: 10px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  text-align: center;
}

/* 主布局 */
.main-layout {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) minmax(350px, 1.2fr);
  gap: 20px;
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
}

/* 左右面板 */
.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 卡片样式 */
.control-card,
.result-card {
  width: 100%;
}

/* 输入组样式 */
.input-group {
  margin-bottom: 12px;
}

.input-label {
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--n-text-color-2);
}

.full-width {
  width: 100%;
}

/* 按钮样式 */
.main-action-button {
  width: 100%;
}

.action-buttons {
  margin-top: 10px;
}

/* 分组和分类样式 */
.group-header {
  font-size: 16px;
  font-weight: 600;
  margin: 12px 0 8px 0;
  color: var(--n-text-color);
}

.category-header {
  font-size: 14px;
  font-weight: 500;
  margin: 10px 0 6px 8px;
  color: var(--n-text-color-2);
}

/* 标签列表样式 */
.tag-list-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0 8px 8px;
}

.tag-item-wrapper {
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.tag-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-item-wrapper:hover {
  transform: translateY(-2px);
}

/* 选中标签表格样式 */
.selected-tags-container {
  width: 100%;
}

.selected-tags-header {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr 40px;
  gap: 8px;
  padding: 8px;
  background-color: var(--n-color-table-header);
  border-radius: 4px 4px 0 0;
  font-weight: 500;
  font-size: 14px;
}

.selected-tag-item {
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 0.8fr 0.8fr 0.8fr 40px;
  gap: 8px;
  padding: 8px;
  align-items: center;
  border-bottom: 1px solid var(--n-divider-color);
}

.tag-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-keyword {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--n-text-color-2);
  font-size: 0.9em;
}

/* 空状态 */
.empty-state {
  padding: 40px 0;
  text-align: center;
}

.empty-history {
  padding: 20px 0;
  text-align: center;
  color: var(--n-text-color-3);
}

/* 历史记录项 */
.history-list {
  display: flex;
  flex-direction: column;
}

.history-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--n-divider-color);
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: var(--n-color-hover);
}

.history-text {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 批量操作按钮 */
.bulk-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--n-divider-color);
}

/* 结果操作 */
.result-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.copy-button {
  min-width: 150px;
}

/* 高级选项 */
.advanced-option {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.option-label {
  min-width: 80px;
  font-size: 14px;
}

/* 保存设置按钮 */
.save-settings {
  margin-top: 16px;
  text-align: right;
}

/* 标签计数 */
.tag-count {
  font-size: 14px;
  color: var(--n-text-color-2);
}

/* 加载更多容器 */
.load-more-container {
  text-align: center;
  margin: 16px 0;
}

/* 新增的样式 */
.tag-keyword-tooltip {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}
</style> 