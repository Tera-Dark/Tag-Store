<script setup lang="ts">
import { NPageHeader, NCard, NSpace, NDivider, NRadioGroup, NRadioButton } from 'naive-ui';
import { useRouter } from 'vue-router';
import { useSettingsStore } from '../stores/settingsStore';

const router = useRouter();
const settingsStore = useSettingsStore();

const handleBack = () => {
  router.push('/'); // Navigate back to home or previous route if needed
};

// Handler to call the action
const handleThemeChange = (value: string | number | boolean) => {
    if (typeof value === 'string' && (value === 'light' || value === 'dark' || value === 'system')) {
        settingsStore.setThemeMode(value);
    }
};

</script>

<template>
  <div class="settings-view">
    <n-page-header title="设置" @back="handleBack">
      <template #subtitle>
        管理应用配置
      </template>
    </n-page-header>

    <n-divider />

    <n-space vertical>
      <n-card title="外观">
        <n-space align="center">
           <span>主题模式:</span>
           <n-radio-group 
             :value="settingsStore.themeMode" 
             @update:value="handleThemeChange"
             name="theme-mode"
            >
             <n-radio-button value="light">浅色</n-radio-button>
             <n-radio-button value="dark">深色</n-radio-button>
             <n-radio-button value="system">跟随系统</n-radio-button>
           </n-radio-group>
        </n-space>
      </n-card>

      <n-card title="数据管理">
         <p>此处将来可以添加更详细的导入/导出选项或模板管理。</p>
          <!-- Placeholder for Data Management options -->
      </n-card>
      
       <!-- Add more setting categories as needed -->

    </n-space>
  </div>
</template>

<style scoped>
.settings-view {
  max-width: 800px; /* Limit width for readability */
  margin: 0 auto; /* Center the content */
  padding: 20px;
}
</style> 