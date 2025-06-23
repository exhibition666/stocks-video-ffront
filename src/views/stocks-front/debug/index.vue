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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/modules/user'
import { debugAuthState } from '@/utils/authDebugger'

const router = useRouter()
const userStore = useUserStore()
const activeNames = ref(['token', 'cookies', 'localStorage', 'sessionStorage', 'wsCache', 'store'])
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