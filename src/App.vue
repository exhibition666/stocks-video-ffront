<script lang="ts" setup>
import { isDark } from '@/utils/is'
import { useAppStore } from '@/store/modules/app'
import { useDesign } from '@/hooks/web/useDesign'
import { CACHE_KEY, useCache } from '@/hooks/web/useCache'
import routerSearch from '@/components/RouterSearch/index.vue'
import { onMounted, onUnmounted } from 'vue'
import { setupAuthDebugger } from '@/utils/authDebugger'
import { useUserStore } from '@/store/modules/user'

defineOptions({ name: 'APP' })

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('app')
const appStore = useAppStore()
const currentSize = computed(() => appStore.getCurrentSize)
const greyMode = computed(() => appStore.getGreyMode)
const { wsCache } = useCache()

// 根据浏览器当前主题设置系统主题色
const setDefaultTheme = () => {
  let isDarkTheme = wsCache.get(CACHE_KEY.IS_DARK)
  if (isDarkTheme === null) {
    isDarkTheme = isDark()
  }
  appStore.setIsDark(isDarkTheme)
}
setDefaultTheme()

// 设置全局登录状态调试
let cleanupAuthDebugger: (() => void) | null = null

onMounted(() => {
  // 启动登录状态调试器
  cleanupAuthDebugger = setupAuthDebugger()
  // console.log('全局登录状态调试已启动')

  // 自动同步 wsCache 到 userStore，保证刷新后登录态恢复
  const userStore = useUserStore()
  if (!userStore.user && wsCache.get(CACHE_KEY.USER)) {
    // 只同步一次，避免覆盖已登录的 store
    const userInfo = wsCache.get(CACHE_KEY.USER)
    userStore.user = userInfo.user
    userStore.isSetUser = true
    userStore.roles = userInfo.roles || []
    userStore.permissions = new Set(userInfo.permissions || [])
  }
})

onUnmounted(() => {
  // 清理登录状态调试器
  if (cleanupAuthDebugger) {
    cleanupAuthDebugger()
    cleanupAuthDebugger = null
  }
})
</script>
<template>
  <ConfigGlobal :size="currentSize">
    <RouterView :class="greyMode ? `${prefixCls}-grey-mode` : ''" />
    <routerSearch />
  </ConfigGlobal>
</template>
<style lang="scss">
$prefix-cls: #{$namespace}-app;

.size {
  width: 100%;
  height: 100%;
}

html,
body {
  @extend .size;

  padding: 0 !important;
  margin: 0;
  overflow: auto !important;

  #app {
    @extend .size;
    overflow: auto !important;
  }
}

.#{$prefix-cls}-grey-mode {
  filter: grayscale(100%);
}
</style>
