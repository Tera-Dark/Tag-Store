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
    NButton
} from 'naive-ui';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { LayersOutline as StackIcon, PricetagsOutline as TagIcon, LibraryOutline as LibraryIcon, ShuffleOutline as DrawerIcon, ScaleOutline as WeightIcon, CartOutline as CartIcon } from '@vicons/ionicons5';
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

// 推荐工具数据
const tools = [
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

    <n-card title="推荐工具传送门" class="tools-portal-card">
      <n-grid x-gap="18" y-gap="18" cols="1 s:2 m:3" responsive="screen">
        <n-gi v-for="tool in tools" :key="tool.path">
          <n-card hoverable class="tool-portal-item">
            <n-space vertical align="center" style="width:100%;">
              <n-icon :component="tool.icon" size="32" color="#4b6a92" style="margin-bottom: 6px;" />
              <div class="tool-title">{{ tool.title }}</div>
              <div class="tool-desc">{{ tool.description }}</div>
              <n-button size="small" type="primary" @click="handleToolClick(tool.path)">立即体验</n-button>
            </n-space>
          </n-card>
        </n-gi>
      </n-grid>
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
.tool-portal-item {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 6px rgba(24,160,88,0.04);
  transition: box-shadow 0.2s, transform 0.2s;
}
.tool-portal-item:hover {
  box-shadow: 0 4px 16px rgba(24,160,88,0.10);
  transform: translateY(-2px) scale(1.03);
}
.tool-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #222;
}
.tool-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  text-align: center;
  min-height: 36px;
}
</style> 