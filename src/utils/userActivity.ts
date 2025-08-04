import { useUserStore } from '@/store/modules/user'
import { getAccessToken } from '@/utils/auth'
import { ref } from 'vue'

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5分钟无操作超时时间
let idleTimer: NodeJS.Timeout | null = null
let lastActivityTime = Date.now()
const isMonitoring = ref(false)

// 用户活动事件类型
const USER_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'keypress'
]

// 记录用户活动
const recordActivity = () => {
  lastActivityTime = Date.now()
}

// 检查用户是否空闲
const checkIdle = () => {
  const userStore = useUserStore()
  const currentTime = Date.now()
  const idleTime = currentTime - lastActivityTime

  if (getAccessToken() && idleTime >= IDLE_TIMEOUT) {
    // console.log('用户已空闲超过5分钟，自动登出')
    
    // 停止监听
    stopMonitoring()
    
    // 执行登出操作
    userStore.loginOut().then(() => {
      // 跳转到首页
      window.location.href = '/stocks-front/home'
    })
  }
}

// 开始监测用户活动
export const startActivityMonitoring = () => {
  if (isMonitoring.value) return
  
  // 只有登录状态才监测
  if (!getAccessToken()) return
  
  // console.log('开始监测用户活动')
  
  // 记录初始活动时间
  lastActivityTime = Date.now()
  
  // 添加事件监听器
  USER_EVENTS.forEach(event => {
    window.addEventListener(event, recordActivity, { passive: true })
  })
  
  // 设置定期检查定时器（每30秒检查一次）
  idleTimer = setInterval(checkIdle, 30 * 1000)
  isMonitoring.value = true
}

// 停止监测用户活动
export const stopMonitoring = () => {
  if (!isMonitoring.value) return
  
  // console.log('停止监测用户活动')
  
  // 移除事件监听器
  USER_EVENTS.forEach(event => {
    window.removeEventListener(event, recordActivity)
  })
  
  // 清除定时器
  if (idleTimer) {
    clearInterval(idleTimer)
    idleTimer = null
  }
  
  isMonitoring.value = false
}

// 重置活动计时器
export const resetActivityTimer = () => {
  lastActivityTime = Date.now()
}

// 获取是否正在监测
export const getIsMonitoring = () => isMonitoring.value 