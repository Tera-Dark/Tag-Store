import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// Import components/views
import SettingsView from '../views/SettingsView.vue'; 
import ToolboxView from '../views/ToolboxView.vue'; 
import TagManagementView from '../views/TagManagementView.vue'; 
import AboutView from '../views/AboutView.vue'; // Import About view
import DashboardView from '../views/DashboardView.vue'; // Import Dashboard view
// Import the tool views
import TagDrawerView from '../views/tools/TagDrawerView.vue';
import WeightGeneratorView from '../views/tools/WeightGeneratorView.vue'; // 导入权重添加器工具
import TagShoppingCartView from '../views/tools/TagShoppingCartView.vue'; // Import new tool view
import AiExpandView from '../components/ai-expand/AiExpandView.vue'; // 导入AI扩写工具

const routes: Array<RouteRecordRaw> = [
  {
    path: '/', // Root path now points to Dashboard
    name: 'Dashboard',
    component: DashboardView,
  },
  {
    path: '/tags', // New path for Tag Management
    name: 'TagManagement',
    component: TagManagementView,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView, 
  },
  {
    path: '/toolbox', 
    name: 'Toolbox',
    component: ToolboxView,
  },
  // 工具页面路由
  {
    path: '/toolbox/tag-drawer',
    name: 'TagDrawerTool',
    component: TagDrawerView,
  },
  {
    path: '/toolbox/weight-generator', // 添加权重添加器路由
    name: 'WeightGeneratorTool',
    component: WeightGeneratorView,
  },
  // Add route for Tag Shopping Cart
  {
    path: '/toolbox/tag-cart',
    name: 'TagShoppingCartTool',
    component: TagShoppingCartView,
  },
  // 添加AI扩写工具路由
  {
    path: '/toolbox/ai-expand',
    name: 'AiExpandTool',
    component: AiExpandView,
  },
  {
    path: '/about', // Add about route
    name: 'About',
    component: AboutView,
  },
];

const router = createRouter({
  history: createWebHashHistory(), 
  routes,
});

export default router; 