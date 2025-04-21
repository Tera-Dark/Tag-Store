import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// Import the TagGrid component instead of HomeView
import TagGrid from '../components/TagGrid.vue'; // Correct path to components

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home', // Can keep the name or change to 'TagGrid' or similar
    component: TagGrid, // Point to the TagGrid component
  },
  // Add other routes here as needed
];

const router = createRouter({
  history: createWebHashHistory(), // Use hash history for GitHub Pages compatibility
  routes,
});

export default router; 