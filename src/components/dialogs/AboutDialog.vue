<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import { NModal, NCard, NButton, NSpace, NText, NDivider, NIcon } from 'naive-ui';
import { LogoGithub as GithubIcon } from '@vicons/ionicons5'; // Import Github icon

// --- Props ---
interface Props {
  show: boolean;
}
const props = defineProps<Props>();

// --- Emits ---
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

// --- App Info (Hardcoded for now) ---
const appName = "TagStore";
const appVersion = "1.0.0"; // Or get from package.json later
const creatorName = "Tera-Dark";
const githubUrl = "https://github.com/Tera-Dark/Tag-Store";

// --- Methods ---
const handleClose = () => {
  emit('update:show', false);
};

const openGithub = () => {
    window.open(githubUrl, '_blank');
};

</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    title="关于 TagStore"
    :bordered="false"
    size="small"
    style="max-width: 450px"
    :mask-closable="true"
    :close-on-esc="true"
    @update:show="handleClose"
  >
    <n-space vertical align="center">
        <n-text strong style="font-size: 1.2em;">{{ appName }}</n-text>
        <n-text depth="3">版本 {{ appVersion }}</n-text>
    </n-space>

    <n-divider />

    <n-space vertical>
        <n-text>一个简单的标签管理系统。</n-text>
        <n-text>作者: {{ creatorName }}</n-text>
         <n-button text type="primary" @click="openGithub">
             <template #icon>
                 <n-icon :component="GithubIcon" />
             </template>
             查看 GitHub 仓库
         </n-button>
    </n-space>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleClose">关闭</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
/* Add dialog specific styles if needed */
</style> 