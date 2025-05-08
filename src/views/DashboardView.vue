<script setup lang="ts">
import { 
    NPageHeader, 
    NCard, 
    NSpace, 
    NDivider, 
    NGrid, 
    NGi, 
    NStatistic, 
    NIcon,
    NButton,
    NCarousel
} from 'naive-ui';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { LayersOutline as StackIcon, PricetagsOutline as TagIcon, LibraryOutline as LibraryIcon, ShuffleOutline as DrawerIcon, ScaleOutline as WeightIcon, CartOutline as CartIcon, TextOutline as ExpandIcon } from '@vicons/ionicons5';
import { useLibraryStore } from '../stores/libraryStore'; // To get stats
import { useTagStore } from '../stores/tagStore'; // To get stats

const router = useRouter();
const libraryStore = useLibraryStore();
const tagStore = useTagStore(); // Make sure it's initialized for stats

// Handle back is likely unused, removing for now
// const handleBack = () => {
//     console.log("Back button clicked on dashboard");
// };

// Use computed properties for stats to ensure reactivity
const totalLibraries = computed(() => libraryStore.libraries.length);
const totalCategories = computed(() => tagStore.categories.length); // Changed from allCategories
const totalTags = computed(() => tagStore.tags.length); // Changed from allTags
const currentLibraryName = computed(() => libraryStore.activeLibrary?.name || '无');

// 推荐工具数据 - AI扩写工具移到首位
const tools = [
  {
    title: 'AI扩写',
    description: '使用AI模型扩展和丰富文本内容', // 简化描述以适应卡片
    icon: ExpandIcon,
    path: '/toolbox/ai-expand'
  },
  {
    title: '标签抽取器',
    description: '从当前库中随机抽取标签组合，激发创作灵感',
    icon: DrawerIcon,
    path: '/toolbox/tag-drawer'
  },
  {
    title: '权重添加器',
    description: '生成带权重的AI绘图提示词，适用于Stable Diffusion等AI绘图工具',
    icon: WeightIcon,
    path: '/toolbox/weight-generator'
  },
  {
    title: '标签购物车',
    description: '通过分类细分，组合挑选标签，构建提示词',
    icon: CartIcon,
    path: '/toolbox/tag-cart'
  }
];

const handleToolClick = (path: string) => {
  router.push(path);
};

</script>

<template>
  <div class="dashboard-view">
    <n-page-header title="仪表盘">
      <template #subtitle>
        应用概览与统计信息
      </template>
    </n-page-header>

    <n-divider />

    <n-grid x-gap="16" y-gap="16" cols="1 s:2 m:3" responsive="screen">
      <n-gi>
        <n-card title="当前标签库统计" class="stat-card">
           <n-space vertical>
             <n-statistic label="当前库" :value="currentLibraryName" />
             <n-statistic label="分类数量">
                <template #prefix><n-icon :component="StackIcon" /></template>
                {{ totalCategories }}
             </n-statistic>
             <n-statistic label="标签数量">
                <template #prefix><n-icon :component="TagIcon" /></template>
                {{ totalTags }}
             </n-statistic>
           </n-space>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="应用总览" class="stat-card">
           <n-space vertical>
             <n-statistic label="标签库总数">
                <template #prefix><n-icon :component="LibraryIcon" /></template>
                 {{ totalLibraries }}
             </n-statistic>
             <n-tag type="info" size="large" style="margin-top:12px;">当前库：{{ currentLibraryName }}</n-tag>
           </n-space>
        </n-card>
      </n-gi>
      <n-gi>
          <n-card title="快捷操作" class="stat-card">
             <n-space>
                <n-button ghost @click="router.push('/tags')">前往标签管理</n-button>
                <n-button ghost @click="router.push('/settings')">打开设置</n-button>
             </n-space>
          </n-card>
       </n-gi>
    </n-grid>

    <n-divider style="margin: 32px 0 16px 0;" />

    <n-card title="推荐工具传送门" class="tools-portal-card" :content-style="{ padding: '0px' }">
      <n-carousel
        effect="card"
        slides-per-view="auto"
        draggable
        autoplay
        mousewheel
        :space-between="30"
        :loop="true"
        dot-type="line"
        style="height: 320px; padding: 20px 0;"
        class="my-custom-carousel"
      >
        <div v-for="tool in tools" :key="tool.path" 
             class="carousel-item-wrapper tool-portal-item-direct" 
             @click="handleToolClick(tool.path)" 
             role="button" 
             tabindex="0"
        >
          <n-icon :component="tool.icon" size="36" color="#4b6a92" style="margin-bottom: 10px;" />
          <div class="tool-title" style="font-size: 20px; margin-bottom: 8px;">{{ tool.title }}</div>
          <div class="tool-desc" style="min-height: 40px; margin-bottom: 12px;">{{ tool.description }}</div>
          <n-button size="medium" type="primary" style="pointer-events: none;">立即体验</n-button> 
        </div>
      </n-carousel>
    </n-card>
  </div>
</template>

<style scoped>
.dashboard-view {
  padding: 20px;
  background: #f7f8fa;
}
.n-card {
    height: 100%;
    border-radius: 14px;
    box-shadow: 0 2px 12px rgba(24,160,88,0.06);
    transition: box-shadow 0.2s;
}
.n-card:hover {
    box-shadow: 0 4px 24px rgba(24,160,88,0.13);
}
.stat-card {
  background: #fff;
}
.tools-portal-card {
  margin-top: 12px;
  background: linear-gradient(90deg, #f0f4fa 0%, #e8f7f0 100%);
  border: none;
}

.tool-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #222;
  padding: 0 8px;
}
.tool-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  text-align: center;
  min-height: 36px;
}

.carousel-item-wrapper.tool-portal-item-direct {
  width: 380px;
  min-height: 220px;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.carousel-item-wrapper.tool-portal-item-direct:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.my-custom-carousel :deep(.n-carousel__slides) {
}

.my-custom-carousel :deep(.n-carousel__slide) {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style> 