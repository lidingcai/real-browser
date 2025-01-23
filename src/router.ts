import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/test',
    name: 'test',
    component: () => import('./Test.vue'),
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('./MainPage.vue'),
  },
  {
    path: '/pages/settings',
    name: 'Settings',
    component: () => import('./pages/settings/Settings.vue'),
  },

  {
    path: '/pages/error',
    name: 'Error',
    component: () => import('./pages/error/Error.vue'),
  },
]
export const router = createRouter({
  history: createWebHistory(),
  routes,
})
