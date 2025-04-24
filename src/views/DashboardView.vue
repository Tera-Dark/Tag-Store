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
import { LayersOutline as StackIcon, PricetagsOutline as TagIcon, LibraryOutline as LibraryIcon } from '@vicons/ionicons5';
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
        <n-card title="当前标签库统计">
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
        <n-card title="应用总览">
           <n-space vertical>
             <n-statistic label="标签库总数">
                <template #prefix><n-icon :component="LibraryIcon" /></template>
                 {{ totalLibraries }}
             </n-statistic>
             <!-- Add more stats later, e.g., total tags across all libraries -->
            </n-space>
        </n-card>
      </n-gi>
       <!-- Add more cards/widgets here -->
       <n-gi>
          <n-card title="快捷操作">
             <n-space>
                <n-button ghost @click="router.push('/tags')">前往标签管理</n-button>
                <n-button ghost @click="router.push('/settings')">打开设置</n-button>
             </n-space>
          </n-card>
       </n-gi>
    </n-grid>

  </div>
</template>

<style scoped>
.dashboard-view {
  padding: 20px;
}
.n-card {
    height: 100%; /* Make cards fill grid item height */
}
</style> 