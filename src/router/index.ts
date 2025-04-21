import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// Import components/views
import SettingsView from '../views/SettingsView.vue'; 
import ToolboxView from '../views/ToolboxView.vue'; 
import TagManagementView from '../views/TagManagementView.vue'; 
import AboutView from '../views/AboutView.vue'; // Import About view
import DashboardView from '../views/DashboardView.vue'; // Import Dashboard view
// Import the new tool view
import TagDrawerView from '../views/tools/TagDrawerView.vue';

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
  // 将工具页面改为顶级路由
  {
    path: '/toolbox/tag-drawer',
    name: 'TagDrawerTool',
    component: TagDrawerView,
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