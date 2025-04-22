<script setup lang="ts">
import { 
    NPageHeader, 
    NCard, 
    NSpace, 
    NDivider, 
    NIcon,
    NGrid, // Use Grid for layout
    NGi,   // Grid item
    NThing, // To structure card content
    NAvatar
} from 'naive-ui';
import { useRouter } from 'vue-router';
import { 
    ShuffleOutline as DrawerIcon,
    ScaleOutline as WeightIcon, // 添加权重图标
    CartOutline as CartIcon // Add icon for shopping cart
} from '@vicons/ionicons5';

const router = useRouter();

const handleBack = () => {
  // Consider navigating back in history or to home
  if (window.history.length > 1) {
      router.go(-1); 
  } else {
      router.push('/');
  }
};

// Updated tools array with path
const tools = [
    {
        title: '标签抽取器',
        description: '从当前库中随机抽取标签组合，激发创作灵感',
        icon: DrawerIcon,
        path: '/toolbox/tag-drawer' // Add navigation path
    },
    {
        title: '权重添加器',
        description: '生成带权重的AI绘图提示词，适用于Stable Diffusion等AI绘图工具',
        icon: WeightIcon,
        path: '/toolbox/weight-generator'
    },
    // Add Tag Shopping Cart tool
    {
        title: '标签购物车',
        description: '通过分类细分，组合挑选标签，构建提示词',
        icon: CartIcon,
        path: '/toolbox/tag-cart'
    }
    // Add more tool objects here later if needed
];

// Handle card click for navigation
const handleToolClick = (path: string | undefined) => {
    if (path) {
        console.log('正在导航到:', path);
        router.push(path);
    }
};

</script>

<template>
  <div class="toolbox-view">
    <n-page-header title="扩展工具箱" @back="handleBack">
      <template #subtitle>
        集成多种辅助创作的实用工具
      </template>
    </n-page-header>

    <n-divider />

    <n-grid x-gap="12" y-gap="12" cols="1 s:2 m:3 l:4" responsive="screen">
      <n-gi v-for="(tool, index) in tools" :key="index">
        <n-card 
            hoverable 
            class="tool-card" 
            @click="handleToolClick(tool.path)"
            >
             <n-thing>
                <template #avatar>
                  <n-avatar size="large" color="#f0f4fa"> 
                     <n-icon :component="tool.icon" size="28" color="#4b6a92" />
                  </n-avatar>
                </template>
                <template #header>
                  {{ tool.title }}
                </template>
                {{ tool.description }}
             </n-thing>
        </n-card>
      </n-gi>
    </n-grid>

  </div>
</template>

<style scoped>
.toolbox-view {
  max-width: 1200px; /* Allow wider content for grid */
  margin: 0 auto; 
  padding: 20px;
}

.tool-card {
  cursor: pointer;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  height: 100%;
}

.tool-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--n-box-shadow-2);
}
</style> 