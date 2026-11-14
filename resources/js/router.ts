import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./AppShell.vue') },
    { path: '/mine', name: 'mine', component: () => import('./AppShell.vue') },
    { path: '/zones', name: 'zones', component: () => import('./AppShell.vue') },
    { path: '/z/:zoneKey/:phase?', name: 'zone', component: () => import('./AppShell.vue') },
    { path: '/t/:code', name: 'tomb', component: () => import('./AppShell.vue') },
    { path: '/g/:code', name: 'group', component: () => import('./AppShell.vue') },
    { path: '/search', name: 'search', component: () => import('./AppShell.vue') },
    { path: '/funeral', name: 'funeral', component: () => import('./AppShell.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
