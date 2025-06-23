import { getAccessToken, getRefreshToken } from '@/utils/auth'
import { CACHE_KEY, useCache } from '@/hooks/web/useCache'
import { useUserStore } from '@/store/modules/user'

const { wsCache } = useCache()

// 定义 token 键名
const AccessTokenKey = 'ACCESS_TOKEN'
const RefreshTokenKey = 'REFRESH_TOKEN'

/**
 * 身份验证调试工具 - 在控制台输出所有与登录相关的数据
 * 可以在任何页面调用此函数来查看当前登录状态
 */
export function debugAuthState() {
  console.group('===== 登录状态调试信息 =====')
  
  // 1. 输出 Token 信息
  const accessToken = getAccessToken()
  const refreshToken = getRefreshToken()
  console.log('1. Token 信息:')
  console.log('   Access Token:', accessToken || '未设置')
  console.log('   Refresh Token:', refreshToken || '未设置')
  
  // 2. 输出 Cookies
  console.log('2. Cookies:')
  const cookies = document.cookie.split(';').map(cookie => cookie.trim())
  console.table(cookies.map(cookie => {
    const [name, value] = cookie.split('=')
    return { name, value }
  }))
  
  // 3. 输出 LocalStorage
  console.log('3. LocalStorage 中的关键信息:')
  const localStorageItems = {
    'token': localStorage.getItem('token'),
    'tenantId': localStorage.getItem('tenantId'),
    'userId': localStorage.getItem('userId')
  }
  console.table(localStorageItems)
  
  // 4. 输出 SessionStorage
  console.log('4. SessionStorage 中的关键信息:')
  const sessionStorageItems = {
    'token': sessionStorage.getItem('token'),
    'tenantId': sessionStorage.getItem('tenantId')
  }
  console.table(sessionStorageItems)
  
  // 5. 输出 wsCache 中的用户信息
  console.log('5. wsCache 中的用户信息:')
  const userCache = wsCache.get(CACHE_KEY.USER)
  console.log('   USER 缓存:', userCache)
  console.log('   Access Token 缓存:', wsCache.get(AccessTokenKey))
  console.log('   Refresh Token 缓存:', wsCache.get(RefreshTokenKey))
  console.log('   租户ID缓存:', wsCache.get(CACHE_KEY.TenantId))
  console.log('   访问租户ID缓存:', wsCache.get(CACHE_KEY.VisitTenantId))
  
  // 6. 输出 Store 中的用户信息
  try {
    const userStore = useUserStore()
    console.log('6. Store 中的用户信息:')
    console.log('   userStore.user:', userStore.user)
    console.log('   userStore.permissions:', userStore.permissions)
    console.log('   userStore.roles:', userStore.roles)
    console.log('   userStore.isSetUser:', userStore.isSetUser)
  } catch (error) {
    console.log('6. Store 中的用户信息: 无法获取 (可能不在 Vue 组件中)')
  }
  
  console.groupEnd()
  
  return {
    accessToken,
    refreshToken,
    cookies,
    localStorage: localStorageItems,
    sessionStorage: sessionStorageItems,
    wsCache: {
      user: userCache,
      accessToken: wsCache.get(AccessTokenKey),
      refreshToken: wsCache.get(RefreshTokenKey),
      tenantId: wsCache.get(CACHE_KEY.TenantId),
      visitTenantId: wsCache.get(CACHE_KEY.VisitTenantId)
    },
    store: useUserStore().user
  }
}

/**
 * 在页面加载时自动调试登录状态
 * 可以在任何页面的 onMounted 中调用
 */
export function setupAuthDebugger() {
  // 页面加载时立即执行一次
  debugAuthState()
  
  // 每30秒检查一次登录状态变化
  const intervalId = setInterval(() => {
    console.log('定时检查登录状态:')
    debugAuthState()
  }, 30000)
  
  // 返回清理函数
  return () => {
    clearInterval(intervalId)
  }
} 