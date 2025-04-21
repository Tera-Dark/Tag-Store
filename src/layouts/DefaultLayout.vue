<script setup lang="ts">
import { NLayout, NLayoutHeader, NLayoutSider, NLayoutContent, NInput, NSpace } from 'naive-ui';
import { ref } from 'vue';
import CategoryList from '../components/CategoryList.vue';
import { useTagStore } from '../stores/tagStore';

const collapsed = ref(false);
const tagStore = useTagStore();
</script>

<template>
  <n-layout style="height: 100vh">
    <n-layout-header style="height: 64px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--n-border-color);" bordered>
      <n-space align="center">
        <h2>TagStore</h2>
      </n-space>
      <n-space align="center" style="flex-grow: 1; justify-content: center;">
        <n-input 
          v-model:value="tagStore.searchTerm" 
          placeholder="搜索名称、副标题或关键词..."
          clearable
          style="max-width: 400px;" 
        />
      </n-space>
      <n-space align="center">
        <!-- Placeholder for future icons like settings, about -->
      </n-space>
    </n-layout-header>
    <n-layout has-sider style="height: calc(100vh - 64px)">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="240"
        :collapsed="collapsed"
        show-trigger
        @collapse="collapsed = true"
        @expand="collapsed = false"
        style="display: flex; flex-direction: column;"
      >
        <!-- Use the CategoryList component, passing collapsed state -->
        <CategoryList :collapsed="collapsed" />
      </n-layout-sider>
      <n-layout-content style="padding: 24px; background-color: var(--n-color);">
        <!-- Router view will render the main content here -->
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<style scoped>
/* Add layout-specific styles if needed */
.n-layout-header,
.n-layout-sider,
.n-layout-content {
  /* Optional: add transitions for smoother collapsing */
  transition: background-color 0.3s var(--n-bezier), color 0.3s var(--n-bezier);
}
</style> 