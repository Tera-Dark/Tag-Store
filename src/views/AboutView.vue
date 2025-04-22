<script setup lang="ts">
import { NPageHeader, NCard, NSpace, NDivider, NText, NIcon } from 'naive-ui';
import { useRouter } from 'vue-router';
import { LogoGithub as GithubIcon, CodeSlashOutline as TechIcon, ShieldCheckmarkOutline as LicenseIcon } from '@vicons/ionicons5';

const router = useRouter();

const handleBack = () => {
  if (window.history.length > 1) {
      router.go(-1); 
  } else {
      router.push('/'); // Fallback to home
  }
};

// Example version (replace with dynamic import later if needed)
const appVersion = '1.0.0'; 
const buildDate = new Date().toLocaleDateString(); // Placeholder build date

const techStack = [
    { name: 'Vue 3', description: '渐进式 JavaScript 框架' },
    { name: 'TypeScript', description: 'JavaScript 的超集，提供静态类型' },
    { name: 'Pinia', description: 'Vue 状态管理库' },
    { name: 'Naive UI', description: 'Vue 3 组件库' },
    { name: 'Dexie.js', description: 'IndexedDB 封装库' },
    { name: 'Vite', description: '下一代前端构建工具' },
];

const openLink = (url: string) => {
    window.open(url, '_blank');
};

</script>

<template>
  <div class="about-view">
    <n-page-header title="关于 TagStore" @back="handleBack">
      <template #subtitle>
        标签管理，得心应手
      </template>
    </n-page-header>

    <n-divider />

    <n-space vertical size="large">
      <n-card title="版本信息">
        <n-space vertical>
          <n-text>版本号: {{ appVersion }}</n-text>
          <n-text>构建日期: {{ buildDate }}</n-text>
        </n-space>
      </n-card>

      <n-card title="技术栈">
        <template #header-extra>
          <n-icon :component="TechIcon" size="18" />
        </template>
        <n-list hoverable clickable>
          <n-list-item v-for="tech in techStack" :key="tech.name">
             <n-text strong>{{ tech.name }}</n-text>: {{ tech.description }}
          </n-list-item>
        </n-list>
      </n-card>

       <n-card title="开源与许可">
         <template #header-extra>
           <n-icon :component="LicenseIcon" size="18" />
         </template>
         <n-space vertical>
            <n-text>
              本项目源代码托管在 GitHub，遵循 MIT 许可证。
            </n-text>
            <n-button text type="primary" @click="openLink('https://github.com/Tera-Dark/Tag-Store')">
                <template #icon> <n-icon :component="GithubIcon" /> </template>
                访问 GitHub 仓库
            </n-button>
             <n-button text type="primary" @click="openLink('#')"> <!-- Add link to actual license file later -->
                 查看 MIT 许可证
            </n-button>
         </n-space>
      </n-card>

    </n-space>
  </div>
</template>

<style scoped>
.about-view {
  max-width: 800px; 
  margin: 0 auto; 
  padding: 20px;
}

.n-list-item {
    cursor: default !important; /* Override clickable style if not needed */
}
</style> 