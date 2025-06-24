<template>
  <div class="debug-page">
    <el-card shadow="hover" class="debug-card">
      <template #header>
        <div class="card-header">
          <span>登录状态调试页面</span>
          <el-button type="primary" @click="refreshDebugInfo">刷新数据</el-button>
        </div>
      </template>
      
      <!-- Token 信息 -->
      <el-collapse v-model="activeNames">
        <el-collapse-item title="Token 信息" name="token">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="Access Token">
              <div class="overflow-text">{{ debugInfo.accessToken || '未设置' }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="Refresh Token">
              <div class="overflow-text">{{ debugInfo.refreshToken || '未设置' }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
        
        <!-- Cookies 信息 -->
        <el-collapse-item title="Cookies 信息" name="cookies">
          <el-table :data="cookiesData" style="width: 100%" v-if="cookiesData.length > 0" max-height="300">
            <el-table-column prop="name" label="名称" width="180" />
            <el-table-column prop="value" label="值">
              <template #default="scope">
                <div class="overflow-text">{{ scope.row.value }}</div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="无 Cookies 数据" />
        </el-collapse-item>
        
        <!-- LocalStorage 信息 -->
        <el-collapse-item title="LocalStorage 信息" name="localStorage">
          <el-descriptions :column="1" border>
            <el-descriptions-item v-for="(value, key) in debugInfo.localStorage" :key="key" :label="key">
              <div class="overflow-text">{{ value || '未设置' }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
        
        <!-- SessionStorage 信息 -->
        <el-collapse-item title="SessionStorage 信息" name="sessionStorage">
          <el-descriptions :column="1" border>
            <el-descriptions-item v-for="(value, key) in debugInfo.sessionStorage" :key="key" :label="key">
              <div class="overflow-text">{{ value || '未设置' }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
        
        <!-- wsCache 信息 -->
        <el-collapse-item title="wsCache 信息" name="wsCache">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="User">
              <pre class="json-pre">{{ JSON.stringify(debugInfo.wsCache?.user || null, null, 2) }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="Access Token">
              <div class="overflow-text">{{ debugInfo.wsCache?.accessToken || '未设置' }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="Refresh Token">
              <div class="overflow-text">{{ debugInfo.wsCache?.refreshToken || '未设置' }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="Tenant ID">
              <div class="overflow-text">{{ debugInfo.wsCache?.tenantId || '未设置' }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="Visit Tenant ID">
              <div class="overflow-text">{{ debugInfo.wsCache?.visitTenantId || '未设置' }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
        
        <!-- Store 信息 -->
        <el-collapse-item title="Store 用户信息" name="store">
          <el-descriptions :column="1" border v-if="debugInfo.store">
            <el-descriptions-item v-for="(value, key) in debugInfo.store" :key="key" :label="key">
              <div class="overflow-text">{{ typeof value === 'object' ? JSON.stringify(value) : value }}</div>
            </el-descriptions-item>
          </el-descriptions>
          <el-empty v-else description="未登录或无用户信息" />
        </el-collapse-item>

        <!-- VIP过期信息 -->
        <el-collapse-item title="VIP过期检查" name="vipExpire">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="当前时间">
              {{ new Date().toLocaleString() }} ({{ new Date().toISOString() }})
            </el-descriptions-item>
            <el-descriptions-item label="VIP到期时间(vipExpireTime)" v-if="userStore.user?.vipExpireTime">
              {{ new Date(userStore.user.vipExpireTime).toLocaleString() }} 
              ({{ userStore.user.vipExpireTime }})
            </el-descriptions-item>
            <el-descriptions-item label="VIP到期时间(vip_expire_time)" v-if="userStore.user?.vip_expire_time">
              {{ new Date(userStore.user.vip_expire_time).toLocaleString() }} 
              ({{ userStore.user.vip_expire_time }})
            </el-descriptions-item>
            <el-descriptions-item label="VIP到期时间(expireTime)" v-if="userStore.user?.expireTime">
              {{ new Date(userStore.user.expireTime).toLocaleString() }} 
              ({{ userStore.user.expireTime }})
            </el-descriptions-item>
            <el-descriptions-item label="VIP到期时间" v-else>
              未设置
            </el-descriptions-item>
            <el-descriptions-item label="用户等级ID">
              {{ userStore.user?.level?.id || userStore.user?.level_id || userStore.user?.levelId || '未知' }}
            </el-descriptions-item>
            <el-descriptions-item label="用户等级ID来源">
              <span v-if="userStore.user?.level?.id">level.id: {{ userStore.user?.level?.id }}</span>
              <span v-if="userStore.user?.level_id">level_id: {{ userStore.user?.level_id }}</span>
              <span v-if="userStore.user?.levelId">levelId: {{ userStore.user?.levelId }}</span>
              <span v-if="!userStore.user?.level?.id && !userStore.user?.level_id && !userStore.user?.levelId">未找到</span>
            </el-descriptions-item>
            <el-descriptions-item label="用户等级名称">
              {{ userStore.user?.level?.name || '未知' }}
            </el-descriptions-item>
            <el-descriptions-item label="是否已过期">
              <el-tag :type="isVipExpired ? 'danger' : 'success'">
                {{ isVipExpired ? '已过期' : '未过期' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="是否为VIP用户">
              <el-tag :type="isVipUser ? 'success' : 'info'">
                {{ isVipUser ? '是' : '否' }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <div class="action-buttons" style="margin-top: 10px;">
            <el-button type="primary" @click="checkVipExpiration">手动检查VIP过期</el-button>
            <el-button type="success" @click="refreshUserInfo">刷新用户信息</el-button>
            <el-button type="info" @click="printUserObject">打印用户对象</el-button>
            <el-button type="warning" @click="fetchOriginalUserData">获取原始用户信息</el-button>
            <el-button type="danger" @click="showTestDialog">测试VIP过期</el-button>
            <el-button type="danger" @click="forceUpdateUserData">强制更新用户数据</el-button>
            <el-button type="danger" @click="testVipExpireAndUpdateFrontend">测试VIP过期并更新前端</el-button>
          </div>
        </el-collapse-item>

        <!-- 会员等级列表 -->
        <el-collapse-item title="会员等级列表" name="memberLevels">
          <el-button type="primary" @click="fetchMemberLevels" style="margin-bottom: 10px;">
            获取会员等级列表
          </el-button>
          
          <el-table v-if="memberLevels.length > 0" :data="memberLevels" border style="width: 100%">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="等级名称" width="150" />
            <el-table-column prop="value" label="等级值" width="100" />
            <el-table-column prop="experience" label="所需经验" width="120" />
            <el-table-column prop="discountPercent" label="折扣百分比" width="120" />
            <el-table-column prop="icon" label="图标">
              <template #default="scope">
                <div class="overflow-text">{{ scope.row.icon }}</div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="scope">
                <el-button type="primary" size="small" @click="setAsNormalLevel(scope.row)">
                  设为普通等级
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无会员等级数据" />
          
          <el-alert
            v-if="normalLevel"
            type="success"
            :title="`ID最小的会员等级: ${normalLevel.name} (ID: ${normalLevel.id})`"
            style="margin-top: 10px;"
            show-icon
          />
        </el-collapse-item>
      </el-collapse>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button type="primary" @click="goToLogin">去登录</el-button>
        <el-button type="warning" @click="handleLogout">退出登录</el-button>
        <el-button @click="goToHome">返回首页</el-button>
      </div>
    </el-card>
    
    <!-- 底部导航栏（移动端） -->
    <div class="mobile-nav">
      <el-button-group>
        <el-button type="primary" @click="goToLogin">登录</el-button>
        <el-button type="warning" @click="handleLogout">登出</el-button>
        <el-button @click="goToHome">首页</el-button>
        <el-button type="success" @click="refreshDebugInfo">刷新</el-button>
      </el-button-group>
    </div>
    
    <!-- 返回顶部按钮 -->
    <el-backtop :right="20" :bottom="20" />

    <!-- 测试对话框 -->
    <el-dialog v-model="testDialogVisible" title="测试VIP过期时间" width="500px">
      <el-form :model="testForm" label-width="120px">
        <el-form-item label="当前时间">
          {{ new Date().toLocaleString() }}
        </el-form-item>
        <el-form-item label="VIP过期时间">
          <el-date-picker
            v-model="testForm.expireTime"
            type="datetime"
            placeholder="选择日期时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
        <el-form-item label="过期类型">
          <el-radio-group v-model="testForm.expireType">
            <el-radio :label="1">已过期（过去时间）</el-radio>
            <el-radio :label="2">未过期（未来时间）</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="testDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="applyTestExpireTime">应用测试时间</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { debugAuthState } from '@/utils/authDebugger'
import { ElMessage } from 'element-plus'
import { CACHE_KEY, useCache } from '@/hooks/web/useCache'
import { getCurrentUser } from '@/api/member/user'
import { getLevelList } from '@/api/member/level'
import axios from 'axios'
import { getAccessToken } from '@/utils/auth'

const router = useRouter()
const userStore = useUserStore()
const { wsCache } = useCache()
const activeNames = ref(['token', 'cookies', 'localStorage', 'sessionStorage', 'wsCache', 'store', 'vipExpire', 'memberLevels'])
const debugInfo = ref({
  accessToken: '',
  refreshToken: '',
  cookies: [],
  localStorage: {},
  sessionStorage: {},
  wsCache: {},
  store: null
})

// 格式化 cookies 数据为表格格式
const cookiesData = computed(() => {
  if (!debugInfo.value.cookies || debugInfo.value.cookies.length === 0) {
    return []
  }
  return debugInfo.value.cookies.map(cookie => {
    const [name, value] = cookie.split('=')
    return { name, value }
  })
})

// 刷新调试信息
const refreshDebugInfo = () => {
  debugInfo.value = debugAuthState()
  console.log('调试页面刷新数据:', debugInfo.value)
}

// 页面加载时获取调试信息
onMounted(() => {
  refreshDebugInfo()
  fetchMemberLevels()
})

// 导航到登录页
const goToLogin = () => {
  router.push('/stocks-front/login')
}

// 导航到首页
const goToHome = () => {
  router.push('/stocks-front/home')
}

// 退出登录
const handleLogout = async () => {
  await userStore.loginOut()
  refreshDebugInfo()
}

// 计算VIP是否过期
const isVipExpired = computed(() => {
  if (!userStore.user) return false
  const vipExpireTime = userStore.user.vipExpireTime || userStore.user.vip_expire_time || userStore.user.expireTime
  if (!vipExpireTime) return false
  
  const now = new Date()
  const expireDate = new Date(vipExpireTime)
  return now > expireDate
})

// 计算是否为VIP用户
const isVipUser = computed(() => {
  if (!userStore.user) return false
  const levelName = userStore.user.level?.name || ''
  const levelId = userStore.user.level?.id || userStore.user.level_id || userStore.user.levelId
  return levelName.includes('VIP') || levelName.includes('vip') || (levelId && levelId > 1)
})

// 手动检查VIP过期
const checkVipExpiration = async () => {
  if (!userStore.user) {
    ElMessage.warning('请先登录')
    return
  }
  
  try {
    await userStore.checkVipExpiration(userStore.user)
    ElMessage.success('VIP过期检查完成')
    refreshDebugInfo()
  } catch (error) {
    console.error('VIP过期检查失败:', error)
    ElMessage.error('VIP过期检查失败')
  }
}

// 刷新用户信息
const refreshUserInfo = async () => {
  try {
    await userStore.setMemberInfo()
    ElMessage.success('用户信息刷新成功')
    refreshDebugInfo()
  } catch (error) {
    console.error('用户信息刷新失败:', error)
    ElMessage.error('用户信息刷新失败')
  }
}

// 打印用户对象到控制台
const printUserObject = () => {
  if (!userStore.user) {
    ElMessage.warning('用户未登录')
    return
  }
  
  console.group('===== 用户对象详情 =====')
  console.log('完整用户对象:', userStore.user)
  console.log('JSON格式用户对象:', JSON.stringify(userStore.user, null, 2))
  
  // 列出所有属性
  console.log('===== 用户对象的所有属性 =====')
  for (const key in userStore.user) {
    console.log(`${key}:`, userStore.user[key])
  }
  
  // 检查缓存
  const cachedUser = wsCache.get(CACHE_KEY.USER)?.user
  if (cachedUser) {
    console.log('===== 缓存中的用户对象 =====')
    console.log('缓存用户对象:', cachedUser)
    
    // 比较是否一致
    console.log('缓存与当前对象是否相同:', 
      JSON.stringify(cachedUser) === JSON.stringify(userStore.user) ? '完全一致' : '不一致')
  }
  
  console.groupEnd()
  ElMessage.success('已在控制台打印用户对象')
}

// 直接从API获取原始用户数据
const fetchOriginalUserData = async () => {
  if (!getAccessToken()) {
    ElMessage.warning('用户未登录，无法获取用户信息')
    return
  }
  
  try {
    ElMessage.info('正在从API获取原始用户数据...')
    
    // 方法1: 使用封装的API
    console.group('===== 方法1: 使用封装的API获取用户数据 =====')
    const userData1 = await getCurrentUser()
    console.log('API返回的原始用户数据:', userData1)
    console.log('JSON格式:', JSON.stringify(userData1, null, 2))
    console.groupEnd()
    
    // 方法2: 直接使用axios调用原始接口
    console.group('===== 方法2: 直接使用axios获取原始用户数据 =====')
    const token = getAccessToken()
    const response = await axios.get('/app-api/member/user/get', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    console.log('Axios直接调用的结果:', response.data)
    console.log('JSON格式:', JSON.stringify(response.data, null, 2))
    console.groupEnd()
    
    // 对比两种方式的结果是否一致
    console.group('===== 对比store中的用户数据和API返回数据 =====')
    console.log('Store中的用户数据:', userStore.user)
    console.log('API返回的用户数据:', userData1)
    console.log('两者是否一致:', JSON.stringify(userStore.user) === JSON.stringify(userData1) ? '完全一致' : '不一致')
    
    // 查找后端返回的字段
    console.log('===== API返回数据中的所有字段 =====')
    for (const key in userData1) {
      console.log(`${key}:`, userData1[key])
    }
    
    // 对比缓存中的数据
    const cachedUser = wsCache.get(CACHE_KEY.USER)?.user
    if (cachedUser) {
      console.log('===== 缓存中的数据和API返回数据对比 =====')
      console.log('缓存中的用户数据:', cachedUser)
      console.log('两者是否一致:', JSON.stringify(cachedUser) === JSON.stringify(userData1) ? '完全一致' : '不一致')
    }
    console.groupEnd()
    
    ElMessage.success('原始用户数据已在控制台输出')
  } catch (error) {
    console.error('获取原始用户数据失败:', error)
    ElMessage.error('获取原始用户数据失败')
  }
}

// 测试对话框相关
const testDialogVisible = ref(false)
const testForm = reactive({
  expireTime: '',
  expireType: 1
})

// 显示测试对话框
const showTestDialog = () => {
  if (!userStore.user) {
    ElMessage.warning('请先登录')
    return
  }
  
  // 初始化表单
  const now = new Date()
  
  // 根据选择的类型设置默认时间
  if (testForm.expireType === 1) {
    // 过期时间 - 昨天
    now.setDate(now.getDate() - 1)
  } else {
    // 未过期 - 一个月后
    now.setMonth(now.getMonth() + 1)
  }
  
  // 格式化日期
  testForm.expireTime = now.toISOString().slice(0, 19)
  
  testDialogVisible.value = true
}

// 应用测试时间
const applyTestExpireTime = async () => {
  if (!userStore.user) {
    ElMessage.warning('请先登录')
    return
  }
  
  try {
    // 深拷贝用户对象
    const userCopy = JSON.parse(JSON.stringify(userStore.user))
    
    // 设置过期时间
    userCopy.vipExpireTime = testForm.expireTime
    
    // 调用VIP过期检查
    await userStore.checkVipExpiration(userCopy)
    
    // 手动更新用户对象的过期时间（这仅在前端生效，不会影响后端）
    userStore.user.vipExpireTime = testForm.expireTime
    
    // 关闭对话框
    testDialogVisible.value = false
    
    // 更新调试信息
    refreshDebugInfo()
    
    ElMessage.success('测试VIP过期时间已应用')
  } catch (error) {
    console.error('应用测试时间失败:', error)
    ElMessage.error('应用测试时间失败')
  }
}

// 强制更新用户信息（跳过缓存，直接从API获取并更新到store）
const forceUpdateUserData = async () => {
  if (!getAccessToken()) {
    ElMessage.warning('用户未登录，无法获取用户信息')
    return
  }
  
  try {
    ElMessage.info('正在强制更新用户数据...')
    
    // 直接使用axios调用原始接口获取最新数据
    const token = getAccessToken()
    const response = await axios.get('/app-api/member/user/get', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    
    const userData = response.data.data
    console.log('API返回的原始用户数据:', userData)
    
    if (!userData) {
      ElMessage.error('API返回的用户数据为空')
      return
    }
    
    // 打印API返回的vipExpireTime字段
    console.log('API返回的vipExpireTime:', userData.vipExpireTime)
    
    // 强制更新store中的用户数据
    userStore.user = userData
    
    // 更新缓存
    const userInfo = wsCache.get(CACHE_KEY.USER)
    if (userInfo) {
      userInfo.user = userData
      wsCache.set(CACHE_KEY.USER, userInfo)
    }
    
    // 更新页面
    refreshDebugInfo()
    
    ElMessage.success('用户数据已强制更新')
  } catch (error) {
    console.error('强制更新用户数据失败:', error)
    ElMessage.error('强制更新用户数据失败')
  }
}

// 会员等级相关
const memberLevels = ref([])
const normalLevel = ref(null)

// 获取会员等级列表
const fetchMemberLevels = async () => {
  try {
    const levels = await getLevelList({})
    memberLevels.value = levels
    
    // 找出ID最小的等级作为普通用户等级
    if (levels && levels.length > 0) {
      normalLevel.value = levels.reduce((min, level) => 
        level.id < min.id ? level : min, levels[0])
      console.log('找到ID最小的会员等级:', normalLevel.value)
    }
  } catch (error) {
    console.error('获取会员等级列表失败:', error)
    ElMessage.error('获取会员等级列表失败')
  }
}

// 设置为普通等级
const setAsNormalLevel = (level) => {
  normalLevel.value = level
  ElMessage.success(`已将 ${level.name} (ID: ${level.id}) 设置为普通等级`)
}

// 测试VIP过期并更新前端数据
const testVipExpireAndUpdateFrontend = async () => {
  if (!userStore.user) {
    ElMessage.warning('请先登录')
    return
  }
  
  try {
    // 获取会员等级列表
    const levels = await getLevelList({})
    if (!levels || levels.length === 0) {
      ElMessage.error('获取会员等级列表失败')
      return
    }
    
    // 找出ID最小的等级作为普通用户等级
    const normalLevel = levels.reduce((min, level) => 
      level.id < min.id ? level : min, levels[0])
    
    console.log('找到ID最小的会员等级:', normalLevel)
    
    // 深拷贝用户对象
    const userCopy = JSON.parse(JSON.stringify(userStore.user))
    
    // 设置过期时间为昨天
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    userCopy.vipExpireTime = yesterday.toISOString()
    
    // 更新用户等级为普通等级
    userCopy.level = { 
      id: normalLevel.id, 
      name: normalLevel.name, 
      level: normalLevel.value || 1, 
      icon: normalLevel.icon || '' 
    }
    if (userCopy.level_id) userCopy.level_id = normalLevel.id
    if (userCopy.levelId) userCopy.levelId = normalLevel.id
    
    // 更新store中的用户信息
    userStore.user = userCopy
    
    // 更新缓存
    const userInfo = wsCache.get(CACHE_KEY.USER)
    if (userInfo) {
      userInfo.user = userCopy
      wsCache.set(CACHE_KEY.USER, userInfo)
    }
    
    ElMessage.success(`已将用户降级为普通会员(${normalLevel.name})，并设置VIP过期时间为昨天`)
    refreshDebugInfo()
  } catch (error) {
    console.error('测试VIP过期失败:', error)
    ElMessage.error('测试VIP过期失败')
  }
}
</script>

<style lang="scss" scoped>
html, body {
  height: 100%;
  overflow-y: auto !important;
}

.debug-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  margin-bottom: 60px;
}

.debug-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.overflow-text {
  word-break: break-all;
  white-space: normal;
  max-height: 120px;
  overflow-y: auto;
}

.json-pre {
  background-color: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
  overflow: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.el-descriptions__body) {
  width: 100%;
}

:deep(.el-descriptions__cell) {
  max-width: 0;
}

:deep(.el-collapse-item__content) {
  overflow: visible;
}

// 移动端底部导航栏
.mobile-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 10px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  z-index: 100;
  text-align: center;
  
  .el-button-group {
    width: 100%;
    display: flex;
    
    .el-button {
      flex: 1;
      font-size: 12px;
      padding: 8px 0;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .debug-page {
    padding: 10px;
  }
  
  .card-header {
    flex-direction: column;
    gap: 10px;
    
    .el-button {
      width: 100%;
    }
  }
  
  .action-buttons {
    flex-direction: column;
    
    .el-button {
      width: 100%;
    }
  }
  
  .mobile-nav {
    display: block;
  }
}
</style> 