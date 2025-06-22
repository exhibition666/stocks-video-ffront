import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import remainingRouter from './modules/remaining'
import { getAccessToken } from '@/utils/auth'

// 创建路由实例
const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_PATH), // createWebHashHistory URL带#，createWebHistory URL不带#
  strict: true,
  routes: remainingRouter as RouteRecordRaw[],
  scrollBehavior: () => ({ left: 0, top: 0 })
})

/*
// 全局前置守卫：未登录强制跳转到登录页
router.beforeEach((to, from, next) => {
  // 登录页 path
  const loginPath = '/stocks-front/login'
  // 判断是否已登录
  const hasToken = !!getAccessToken()
  // 如果未登录且不是在登录页，强制跳转到登录页
  if (!hasToken && to.path !== loginPath) {
    next(loginPath)
  } else {
    next()
  }
})
*/

export const resetRouter = (): void => {
  const resetWhiteNameList = ['Redirect', 'Login', 'NoFind', 'Root']
  router.getRoutes().forEach((route) => {
    const { name } = route
    if (name && !resetWhiteNameList.includes(name as string)) {
      router.hasRoute(name) && router.removeRoute(name)
    }
  })
}

export const setupRouter = (app: App<Element>) => {
  app.use(router)
}

export default router
