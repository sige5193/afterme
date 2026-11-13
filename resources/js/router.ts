import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'cemetery', component: () => import('./AppShell.vue') },
    { path: '/t/:code', name: 'tomb', component: () => import('./AppShell.vue') },
    { path: '/funeral', name: 'funeral', component: () => import('./AppShell.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
