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
    NTooltip,
    NSwitch,
    NCheckbox,
    NRadioGroup,
    NRadio,
    NStatistic,
    NTabs,
    NTabPane,
    NBadge,
    useMessage
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
    ScaleOutline as BalanceIcon
} from '@vicons/ionicons5';
import { useTagStore } from '../../stores/tagStore';
import { useLibraryStore } from '../../stores/libraryStore';
import type { Category, Tag } from '../../types/data';
import { useRouter } from 'vue-router';

const tagStore = useTagStore();
const libraryStore = useLibraryStore();
const message = useMessage();
const router = useRouter();

// --- 基本组件状态 ---
const selectedCategoryIds = ref<string[]>([]);
const numTagsToDraw = ref<number>(5);
const minTagsToDraw = ref<number>(1);
const maxTagsToDraw = ref<number>(20);
const exclusionKeywords = ref<string>('');
const drawnTags = ref<Tag[]>([]);
const isDrawing = ref<boolean>(false);
const ALL_CATEGORIES_KEY = '__ALL__';

// --- 高级功能状态 ---
const useMultiCategoryMode = ref<boolean>(false);
const ensureEachCategory = ref<boolean>(false);
const noDuplicates = ref<boolean>(true);
const drawMethod = ref<string>('random'); // 'random', 'weighted', 'leastUsed'
const saveHistory = ref<boolean>(true);
const currentTab = ref<string>('basic'); // 'basic', 'advanced', 'history'

// --- 标签使用统计 ---
const tagUsageCounts = ref<Record<string, number>>({});

// --- 历史记录 ---
const historyItems = ref<Array<{
  id: number;
  timestamp: string;
  tags: Tag[];
}>>([]);

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

const historyCount = computed(() => {
    return historyItems.value.length;
});

const isMultiCategoryActive = computed(() => {
    return useMultiCategoryMode.value && selectedCategoryIds.value.length > 1;
});

// --- 本地存储功能 ---
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
    } catch (error) {
        console.error('加载设置失败:', error);
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
const drawTags = async () => {
    if (isDrawing.value) return;
    
    try {
        isDrawing.value = true;
        showResults.value = false;
        
        // 等待一小段时间以允许UI更新
        await new Promise(resolve => setTimeout(resolve, 300));
        
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

        // 确保分类平衡（如果启用）
        if (ensureEachCategory.value && isMultiCategoryActive.value) {
            const result: Tag[] = [];
            
            // 确保每个分类至少有一个标签
            for (const categoryId of selectedCategoryIds.value) {
                if (categoryId === ALL_CATEGORIES_KEY) continue;
                
                const tagsInCategory = tagStore.tags.filter(t => t.categoryId === categoryId);
                if (tagsInCategory.length > 0) {
                    const shuffled = [...tagsInCategory].sort(() => 0.5 - Math.random());
                    const selectedTag = shuffled[0];
                    result.push(selectedTag);
                }
            }
            
            // 如果还需要更多标签
            const remainingCount = numTagsToDraw.value - result.length;
            if (remainingCount > 0) {
                const selectedIds = new Set(result.map(t => t.id));
                const remainingTags = availableTags.filter(t => !selectedIds.has(t.id));
                
                if (remainingTags.length > 0) {
                    const shuffled = [...remainingTags].sort(() => 0.5 - Math.random());
                    const additionalTags = shuffled.slice(0, remainingCount);
                    result.push(...additionalTags);
                }
            }
            
            drawnTags.value = result;
        } else {
            // 标准抽取
            let selectedTags: Tag[] = [];
            
            // 根据抽取方法选择标签
            if (drawMethod.value === 'leastUsed') {
                // 按使用次数排序（最少使用优先）
                const sortedTags = [...availableTags].sort((a, b) => {
                    const countA = tagUsageCounts.value[a.id] || 0;
                    const countB = tagUsageCounts.value[b.id] || 0;
                    return countA - countB;
                });
                
                selectedTags = sortedTags.slice(0, numTagsToDraw.value);
            } else {
                // 随机抽取
                const shuffledTags = availableTags.sort(() => 0.5 - Math.random());
                selectedTags = shuffledTags.slice(0, numTagsToDraw.value);
            }
            
            drawnTags.value = selectedTags;
        }

        // 更新结果状态
        if (drawnTags.value.length < numTagsToDraw.value && drawnTags.value.length > 0) {
            message.info(`符合条件的标签不足 ${numTagsToDraw.value} 个，已抽取所有 ${drawnTags.value.length} 个。`);
        } else if (drawnTags.value.length === 0 && availableTags.length > 0) {
            message.warning('没有符合条件的标签可供抽取（可能被关键词排除了）');
        } else {
            message.success(`成功抽取 ${drawnTags.value.length} 个标签`);
        }
        
        // 更新使用统计
        updateTagUsage(drawnTags.value);
        
        // 保存到历史记录
        if (saveHistory.value && drawnTags.value.length > 0) {
            addToHistory(drawnTags.value);
        }
        
        // 显示结果
        showResults.value = true;
    } catch (error) {
        console.error('抽取标签时出错:', error);
        message.error('抽取标签失败');
    } finally {
        isDrawing.value = false;
    }
};

// 更新标签使用次数
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

// 添加到历史记录
const addToHistory = (tags: Tag[]) => {
    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        tags: [...tags]
    };
    
    historyItems.value.unshift(historyItem);
    
    // 限制历史记录数量
    if (historyItems.value.length > 20) {
        historyItems.value = historyItems.value.slice(0, 20);
    }
    
    // 保存到本地存储
    localStorage.setItem('tagDrawerHistory', JSON.stringify(historyItems.value));
};

// 从历史记录中重新加载
const reloadFromHistory = (item: { id: number; timestamp: string; tags: Tag[] }) => {
    drawnTags.value = [...item.tags];
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
                    <div class="result-category">
                      {{ tagStore.categories.find(c => c.id === tag.categoryId)?.name || '未分类' }}
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
                <n-button text size="small" @click="reloadFromHistory(item)">
                  重新加载
                </n-button>
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
}

.result-tag:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
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
</style> 