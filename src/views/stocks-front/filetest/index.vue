<template>
  <div class="filetest-container">
    <StocksHeader />
    
    <div class="content">
      <h1 class="title">OSS 文件上传测试</h1>
      
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>系统信息</span>
          </div>
        </template>
        
        <div class="system-info">
          <div class="info-item">
            <span class="info-label">Base URL:</span>
            <span class="info-value">{{ baseUrl }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">API URL:</span>
            <span class="info-value">{{ apiUrl }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">OSS配置ID:</span>
            <span class="info-value">{{ ossConfigId }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">登录状态:</span>
            <span class="info-value">{{ loginStatus }}</span>
          </div>
        </div>
      </el-card>
      
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>登录验证</span>
          </div>
        </template>
        
        <div class="login-info">
          <el-form label-width="120px">
            <el-form-item label="认证方式">
              <el-radio-group v-model="authType">
                <el-radio label="none">无认证</el-radio>
                <el-radio label="token">Token认证</el-radio>
                <el-radio label="login">先登录</el-radio>
              </el-radio-group>
            </el-form-item>
            
            <el-form-item v-if="authType === 'token'" label="认证令牌">
              <el-input v-model="authToken" placeholder="请输入认证令牌" />
              <div class="form-tips">填入AccessToken或RefreshToken</div>
            </el-form-item>
            
            <el-form-item v-if="authType === 'login'" label="用户名">
              <el-input v-model="loginForm.username" placeholder="请输入用户名" />
            </el-form-item>
            
            <el-form-item v-if="authType === 'login'" label="密码">
              <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" />
            </el-form-item>
            
            <el-form-item v-if="authType === 'login'">
              <el-button type="primary" @click="handleLogin" :loading="loading.login">
                登录系统
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-card>
      
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>配置信息</span>
          </div>
        </template>
        
        <div class="config-info">
          <el-form label-width="120px">
            <el-form-item label="配置ID">
              <el-select v-model="configId" placeholder="请选择OSS配置" style="width: 200px">
                <el-option v-for="item in ossConfigList" :key="item.id" :label="item.name || (item.remark ? item.remark : item.id)" :value="item.id" />
              </el-select>
            </el-form-item>
            
            <el-form-item>
              <el-button @click="getConfigDetail" :loading="loading.configDetail">
                查看配置信息
              </el-button>
            </el-form-item>
          </el-form>
          
          <div v-if="configDetail" class="config-detail">
            <h3>配置详情</h3>
            <pre>{{ configDetailDisplay }}</pre>
          </div>
        </div>
      </el-card>
      
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>获取STS临时令牌</span>
            <el-switch v-model="showDebugInfo" active-text="显示调试信息" />
          </div>
        </template>
        
        <div class="sts-info">
          <el-form label-width="120px">
            <el-form-item label="配置ID">
              <el-select v-model="configId" placeholder="请选择OSS配置" style="width: 200px">
                <el-option v-for="item in ossConfigList" :key="item.id" :label="item.name || (item.remark ? item.remark : item.id)" :value="item.id" />
              </el-select>
            </el-form-item>
            
            <el-form-item v-if="!useCustomApiUrl" label="API类型">
              <el-select v-model="configIdType" placeholder="请选择API类型">
                <el-option label="App端接口" value="app" />
                <el-option label="管理后台接口" value="admin" />
                <el-option label="管理后台Token接口" value="admin-token" />
              </el-select>
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="useCustomApiUrl">使用自定义API地址</el-checkbox>
            </el-form-item>
            
            <el-form-item v-if="useCustomApiUrl" label="API地址">
              <el-input v-model="customApiUrl" placeholder="请输入完整的API地址" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" @click="getSTSToken" :loading="loading.sts">
                获取临时令牌
              </el-button>
            </el-form-item>
          </el-form>
          
          <div v-if="errorMessage" class="error-message">
            <el-alert
              :title="errorMessage"
              type="error"
              :closable="false"
              show-icon
              class="mb-3"
            />
          </div>
          
          <!-- 调试信息面板 -->
          <div v-if="showDebugInfo && debugInfo.requestUrl" class="debug-info">
            <h3>调试信息</h3>
            
            <div class="debug-section">
              <div class="debug-section-title">请求详情</div>
              <div class="debug-item">
                <span class="debug-label">请求URL:</span>
                <span class="debug-value">{{ debugInfo.requestUrl }}</span>
              </div>
              <div v-if="debugInfo.requestHeaders" class="debug-item">
                <span class="debug-label">请求头:</span>
                <pre class="debug-value">{{ JSON.stringify(debugInfo.requestHeaders, null, 2) }}</pre>
              </div>
            </div>
            
            <div v-if="debugInfo.responseStatus" class="debug-section">
              <div class="debug-section-title">响应状态</div>
              <div class="debug-item">
                <span class="debug-label">状态码:</span>
                <span class="debug-value">{{ debugInfo.responseStatus }}</span>
              </div>
              <div class="debug-item">
                <span class="debug-label">状态文本:</span>
                <span class="debug-value">{{ debugInfo.responseStatusText }}</span>
              </div>
            </div>
            
            <div v-if="debugInfo.responseHeaders" class="debug-section">
              <div class="debug-section-title">响应头</div>
              <div v-for="(value, key) in debugInfo.responseHeaders" :key="key" class="debug-item">
                <span class="debug-label">{{ key }}:</span>
                <span class="debug-value">{{ value }}</span>
              </div>
            </div>
            
            <div v-if="debugInfo.responseText" class="debug-section">
              <div class="debug-section-title">响应内容</div>
              <pre class="response-text">{{ debugInfo.responseText }}</pre>
            </div>
          </div>
          
          <div v-if="stsToken?.value && stsToken.value.accessKeyId" class="token-info">
            <h3>STS令牌信息：</h3>
            <pre>{{ stsTokenDisplay }}</pre>
            
            <div class="expires-info">
              <el-tag type="info">
                过期时间: {{ new Date(stsToken.value.expiration).toLocaleString() }}
              </el-tag>
            </div>
          </div>
        </div>
      </el-card>
      
      <el-card class="mb-4" :disabled="!hasToken">
        <template #header>
          <div class="card-header">
            <span>文件上传</span>
          </div>
        </template>
        
        <div class="upload-section">
          <div class="upload-drag-area">
            <el-upload
              v-if="hasToken"
              class="upload-demo"
              drag
              action="#"
              :http-request="uploadFile"
              :on-success="handleUploadSuccess"
              :on-error="handleUploadError"
              multiple
            >
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                拖拽文件到此处 或 <em>点击上传</em>
              </div>
            </el-upload>
            <div v-else class="no-token-tip">
              请先获取STS令牌
            </div>
          </div>
          
          <div v-if="loading.upload" class="upload-progress">
            <el-progress :percentage="uploadProgress" />
          </div>
          
          <div v-if="ossUploadErrorInfo" class="upload-error-info">
            <el-alert type="error" :closable="false" show-icon>
              <h4>上传错误提示</h4>
              <p>{{ ossUploadErrorInfo.message }}</p>
              <div v-if="ossUploadErrorInfo.code === 'AccessDenied'" class="ram-permission-help">
                <h5>可能的原因：阿里云RAM权限配置不正确</h5>
                <p>请检查以下配置：</p>
                <ol>
                  <li>RAM用户需要有<code>oss:PutObject</code>权限</li>
                  <li>OSS Bucket需要正确配置CORS跨域访问</li>
                  <li>STS临时令牌需要包含正确的权限策略</li>
                </ol>
                <p>
                  <el-link 
                    href="https://help.aliyun.com/zh/oss/developer-reference/ram-policy-overview" 
                    type="primary" 
                    target="_blank"
                  >
                    阿里云RAM权限参考文档
                  </el-link>
                </p>
              </div>
            </el-alert>
          </div>
        </div>
      </el-card>
      
      <!-- 修改OSS文件浏览/预览卡片 -->
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>OSS 文件浏览/预览</span>
            <span v-if="!hasToken" class="card-subtitle">
              <el-tag type="warning">需要先获取STS临时令牌</el-tag>
            </span>
            <span v-else class="card-subtitle">
              <el-tag type="success">当前路径: {{ ossPath || '根目录' }}</el-tag>
            </span>
          </div>
        </template>
        <div class="oss-browser">
          <!-- 移除路径输入，改为面包屑导航 -->
          <div v-if="hasToken" class="breadcrumb-nav">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item @click="navigateToRoot()">根目录</el-breadcrumb-item>
              <template v-if="pathStack.length > 0">
                <el-breadcrumb-item v-for="(path, index) in pathSegments" :key="index" @click="navigateToPath(index)">
                  {{ path }}
                </el-breadcrumb-item>
              </template>
            </el-breadcrumb>
            <div class="breadcrumb-actions">
              <el-button :loading="loadingList" @click="handleListFiles" icon="Refresh" circle size="small" title="刷新" />
            </div>
          </div>
          
          <!-- 目录树视图 -->
          <el-tree
            v-if="hasToken"
            :data="treeData"
            :props="treeProps"
            lazy
            :load="loadTreeNode"
            node-key="path"
            highlight-current
            @node-click="handleTreeNodeClick"
            style="margin-bottom: 16px;"
          />
          
          <!-- 文件列表 -->
          <div v-if="hasToken">
          <el-table v-if="fileList.length > 0" :data="fileList" style="width: 100%; margin-top: 12px;">
              <el-table-column prop="name" label="名称">
                <template #default="scope">
                  <div class="file-name">
                    <el-icon v-if="scope.row.type === 'dir'" class="folder-icon"><Folder /></el-icon>
                    <el-icon v-else class="file-icon"><Document /></el-icon>
                    {{ scope.row.name }}
                  </div>
                </template>
              </el-table-column>
            <el-table-column prop="type" label="类型" width="80">
              <template #default="scope">
                <el-tag v-if="scope.row.type === 'dir'" type="info">文件夹</el-tag>
                <el-tag v-else type="success">文件</el-tag>
              </template>
            </el-table-column>
              <el-table-column prop="size" label="大小" width="100">
                <template #default="scope">
                  <span v-if="scope.row.type !== 'dir'">{{ formatFileSize(scope.row.size) }}</span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="lastModified" label="修改时间" width="160">
                <template #default="scope">
                  <span>{{ scope.row.lastModified }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="scope">
                <el-button v-if="scope.row.type === 'dir'" size="small" @click="enterDir(scope.row)">进入</el-button>
                <el-link v-else type="primary" :href="scope.row.url" target="_blank">下载</el-link>
              </template>
            </el-table-column>
            <el-table-column label="预览" width="120">
              <template #default="scope">
                <el-image v-if="scope.row.type === 'file' && isImage(scope.row.name)" :src="scope.row.url" :preview-src-list="[scope.row.url]" fit="contain" style="width: 60px; height: 60px;" />
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无文件/文件夹" style="margin-top: 20px;" />
          </div>
          
          <!-- 如果未获取STS令牌，显示提示 -->
          <el-empty v-else description="请先获取STS临时令牌" :image-size="200">
            <template #extra>
              <el-button type="primary" @click="scrollToStsToken">获取STS令牌</el-button>
            </template>
          </el-empty>
        </div>
      </el-card>
      
      <el-card>
        <template #header>
          <div class="card-header">
            <span>已上传文件</span>
            <el-button v-if="uploadedFiles.length > 0" @click="refreshFileList" size="small">
              刷新列表
            </el-button>
          </div>
        </template>
        
        <div class="file-list">
          <el-table v-if="uploadedFiles.length > 0" :data="uploadedFiles" style="width: 100%">
            <el-table-column prop="name" label="文件名" />
            <el-table-column prop="url" label="访问链接">
              <template #default="scope">
                <div class="url-cell">
                  <el-link type="primary" :href="scope.row.url" target="_blank" class="file-url">
                    {{ scope.row.url }}
                  </el-link>
                  <el-button 
                    type="primary" 
                    link 
                    @click="copyUrl(scope.row.url)"
                  >
                    复制
                  </el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="预览">
              <template #default="scope">
                <div class="preview">
                  <el-image
                    v-if="isImage(scope.row.name)"
                    :src="scope.row.url"
                    :preview-src-list="[scope.row.url]"
                    fit="contain"
                    class="preview-image"
                  />
                  <el-button v-else type="primary" size="small" @click="openFile(scope.row.url)">
                    查看文件
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无上传文件" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Folder, Document, Refresh } from '@element-plus/icons-vue'
import StocksHeader from '@/components/StocksHeader/index.vue'
import { getAccessToken, getRefreshToken } from '@/utils/auth'

// 系统信息
const baseUrl = ref(import.meta.env.VITE_BASE_URL || '未设置')
const apiUrl = ref(import.meta.env.VITE_API_URL || '未设置')
const ossConfigId = ref(import.meta.env.VITE_OSS_CONFIG_ID || '未设置')
const loginStatus = computed(() => {
  const token = getAccessToken()
  return token ? '已登录' : '未登录'
})

// 认证相关
const authType = ref('token') // none, token, login
const authToken = ref(getAccessToken() || '') // 默认使用当前系统的token
const loginForm = ref({
  username: '',
  password: ''
})

// 配置ID
const configId = ref(import.meta.env.VITE_OSS_CONFIG_ID || '31')
const configDetail = ref(null)
const configDetailDisplay = computed(() => {
  if (!configDetail.value) return ''
  // 不再修改configDetail值，而是创建一个新对象
  const displayData = { ...configDetail.value }
  // 尝试解析和格式化config字段
  try {
    const config = displayData.config
    if (typeof config === 'string') {
      displayData.parsedConfig = JSON.parse(config)
    }
  } catch (e) {
    console.error('解析配置失败:', e)
  }
  return JSON.stringify(displayData, null, 2)
})

// API接口类型
const configIdType = ref('admin-token')
// STS令牌信息
const stsToken = ref(null)
// 加载状态
const loading = ref({
  sts: false,
  upload: false,
  login: false,
  configDetail: false
})
// 上传进度
const uploadProgress = ref(0)
// 已上传文件列表
const uploadedFiles = ref([])
// 使用自定义API地址
const useCustomApiUrl = ref(false)
// 自定义API地址
const customApiUrl = ref('')
// 错误消息
const errorMessage = ref('')
// 是否显示调试信息
const showDebugInfo = ref(false)
// 调试信息
const debugInfo = ref({
  requestUrl: '',
  requestHeaders: {},
  responseStatus: '',
  responseStatusText: '',
  responseHeaders: null,
  responseText: ''
})
// 上传错误信息
const ossUploadErrorInfo = ref(null)

// 文件浏览相关
const ossPath = ref('')
const fileList = ref([])
const loadingList = ref(false)
const pathStack = ref<string[]>([])

// OSS配置列表
const ossConfigList = ref([])

// 计算当前路径的面包屑导航段
const pathSegments = computed(() => {
  if (!ossPath.value) return [];
  // 移除末尾的斜杠，然后分割路径
  const path = ossPath.value.endsWith('/') ? ossPath.value.slice(0, -1) : ossPath.value;
  return path.split('/').filter(Boolean); // 过滤空字符串
});

// 导航到根目录
const navigateToRoot = () => {
  pathStack.value = [];
  ossPath.value = '';
  handleListFiles();
};

// 导航到特定路径深度
const navigateToPath = (index: number) => {
  if (index < 0) return;
  
  // 计算新路径，保留到指定索引的部分
  const newPathSegments = pathSegments.value.slice(0, index + 1);
  const newPath = newPathSegments.join('/') + '/';
  
  // 更新路径栈，保留到当前路径的部分
  pathStack.value = pathStack.value.slice(0, index);
  ossPath.value = newPath;
  handleListFiles();
};

// 滚动到STS令牌卡片
const scrollToStsToken = () => {
  // 更可靠的选择器方式，直接找包含"获取STS临时令牌"文本的元素
  const elements = document.querySelectorAll('.card-header span');
  let target = null;
  
  for (const el of elements) {
    if (el.textContent && el.textContent.includes('获取STS临时令牌')) {
      target = el.closest('.el-card');
      break;
    }
  }
  
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// 获取OSS配置列表
async function fetchOssConfigList() {
  const accessToken = getAccessToken();
  if (!accessToken) {
    errorMessage.value = '未登录，部分配置仅登录后可见';
    return;
  }
  try {
    const res = await fetch(`${baseUrl.value}/admin-api/infra/file-config/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      }
    });
    const result = await res.json();
    if (result.code !== 0) {
      throw new Error(result.msg || '获取OSS配置列表失败');
    }
    ossConfigList.value = result.data.list || [];
    const mainConfig = ossConfigList.value.find(item => item.master === true || item.master === 1 || item.master === '是');
    if (mainConfig) {
      configId.value = mainConfig.id;
    }
  } catch (e) {
    if (e && e.toString().includes('401')) {
      errorMessage.value = '未登录，部分配置仅登录后可见';
    } else {
      errorMessage.value = '获取OSS配置列表失败：' + (e.message || e);
    }
    ossConfigList.value = [];
  }
}

// 登录系统
const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  
  loading.value.login = true
  try {
    // 构建登录API URL
    const loginUrl = `${baseUrl.value}/admin-api/system/auth/login`
    
    // 发送登录请求
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username: loginForm.value.username,
        password: loginForm.value.password
      })
    })
    
    const result = await response.json()
    
    if (result.code !== 0) {
      throw new Error(result.msg || '登录失败')
    }
    
    // 登录成功，更新token
    authToken.value = result.data.accessToken
    ElMessage.success('登录成功')
  } catch (error) {
    console.error('登录失败:', error)
    ElMessage.error(`登录失败: ${error.message || '未知错误'}`)
  } finally {
    loading.value.login = false
  }
}

// 获取配置详情
const getConfigDetail = async () => {
  loading.value.configDetail = true
  try {
    // 构建API URL
    const url = `${baseUrl.value}/admin-api/infra/file-config/get?id=${configId.value}`
    
    // 设置请求选项
    const fetchOptions = {
      method: 'GET',
      headers: {}
    }
    
    // 根据认证方式添加认证头
    if (authType.value === 'token' && authToken.value) {
      fetchOptions.headers['Authorization'] = 'Bearer ' + authToken.value
    }
    
    const response = await fetch(url, fetchOptions)
    const result = await response.json()
    
    if (result.code !== 0) {
      throw new Error(result.msg || '获取配置详情失败')
    }
    
    // 更新配置详情
    configDetail.value = result.data
    ElMessage.success('获取配置详情成功')
  } catch (error) {
    console.error('获取配置详情失败:', error)
    ElMessage.error(`获取配置详情失败: ${error.message || '未知错误'}`)
  } finally {
    loading.value.configDetail = false
  }
}

// 获取STS令牌
const getSTSToken = async () => {
  if (!configId.value && !useCustomApiUrl.value) {
    ElMessage.warning('请输入OSS配置ID或使用自定义API地址')
    return
  }
  
  if (useCustomApiUrl.value && !customApiUrl.value) {
    ElMessage.warning('请输入自定义API地址')
    return
  }
  
  loading.value.sts = true
  errorMessage.value = ''
  
  // 重置调试信息
  debugInfo.value = {
    requestUrl: '',
    requestHeaders: {},
    responseStatus: '',
    responseStatusText: '',
    responseHeaders: null,
    responseText: ''
  }
  
  try {
    // 调用App端STS接口
    let url = '';
    if (useCustomApiUrl.value) {
      url = customApiUrl.value;
    } else {
      // 提供多种预设API路径选项，根据configIdType选择
      const baseUrl = import.meta.env.VITE_BASE_URL || '';
      switch(configIdType.value) {
        case 'app':
          url = `${baseUrl}/infra/file/app-oss-sts/get-token?configId=${configId.value}`;
          break;
        case 'admin':
          url = `${baseUrl}/infra/file/oss-sts/get-token?configId=${configId.value}`;
          break;
        case 'admin-token':
          url = `${baseUrl}/admin-api/infra/file/oss-sts/get-token?configId=${configId.value}`;
          break;
        default:
          url = `${baseUrl}/infra/file/app-oss-sts/get-token?configId=${configId.value}`;
      }
    }
    
    console.log('请求STS令牌URL:', url)
    debugInfo.value.requestUrl = url
    
    // 设置请求选项
    const fetchOptions = {
      method: 'GET',
      headers: {}
    }
    
    // 根据认证方式添加认证头
    if (authType.value === 'token' && authToken.value) {
      fetchOptions.headers['Authorization'] = 'Bearer ' + authToken.value
    }
    
    debugInfo.value.requestHeaders = fetchOptions.headers
    
    const response = await fetch(url, fetchOptions)
    
    // 存储调试信息
    debugInfo.value.responseStatus = response.status
    debugInfo.value.responseStatusText = response.statusText
    debugInfo.value.responseHeaders = Object.fromEntries(response.headers.entries())
    
    // 获取响应文本 - 只读取一次响应体
    const responseText = await response.text()
    debugInfo.value.responseText = responseText
    
    if (!response.ok) {
      // 检查是否返回了HTML (通常是404或500错误页面)
      if (responseText.includes('<!DOCTYPE html>') || responseText.includes('<html>')) {
        throw new Error(`服务器返回了HTML页面而不是JSON数据，状态码: ${response.status}`)
      } else {
        // 尝试解析为JSON，如果可能的话
        try {
          const errorData = JSON.parse(responseText)
          throw new Error(errorData.msg || `请求失败: ${response.status}`)
        } catch (parseError) {
          // 如果无法解析JSON，则返回原始文本
          throw new Error(`请求失败 (${response.status}): ${responseText.substring(0, 100)}...`)
        }
      }
    }
    
    // 尝试解析JSON
    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      throw new Error(`响应不是有效的JSON: ${responseText.substring(0, 100)}...`)
    }
    
    // 处理可能的不同返回格式
    let stsData = null
    
    // 情况1: { code: 0, data: { stsToken } } 格式
    if (result.code === 0 && result.data) {
      stsData = result.data
    }
    // 情况2: { code: 200, data: { stsToken } } 格式
    else if (result.code === 200 && result.data) {
      stsData = result.data
    } 
    // 情况3: { accessKeyId, accessKeySecret, ... } 格式 (直接返回令牌)
    else if (result.accessKeyId && result.accessKeySecret && result.securityToken) {
      stsData = result
    }
    // 情况4: { success: true, data: { stsToken } } 格式 
    else if (result.success === true && result.data) {
      stsData = result.data
    }
    // 其他情况，抛出错误
    else {
      throw new Error(result.msg || '获取STS令牌失败: 未知的响应格式')
    }
    
    // 检查是否获取到必要的令牌信息
    console.log('最终赋值给stsToken.value的数据', stsData)
    if (stsData.accessKeyId) {
    stsToken.value = stsData
    } else if (stsData.stsToken && stsData.stsToken.accessKeyId) {
      stsToken.value = stsData.stsToken
    } else if (stsData.data && stsData.data.accessKeyId) {
      stsToken.value = stsData.data
    } else {
      ElMessage.error('获取到的STS令牌格式不正确')
      return
    }
    // 初始化OSS客户端
    await initOssClient()
    
    ElMessage.success('获取STS令牌成功')
    
    // 自动获取文件列表
    handleListFiles()
  } catch (error) {
    console.error('获取STS令牌失败:', error)
    ElMessage.error(`获取STS令牌失败: ${error.message || '未知错误'}`)
    errorMessage.value = error.message || '未知错误'
  } finally {
    loading.value.sts = false
  }
}

// 格式化显示的Token信息
const stsTokenDisplay = computed(() => {
  if (!stsToken?.value) return ''
  const display = { ...stsToken.value }
  // 敏感信息只显示部分
  if (display.accessKeySecret) {
    display.accessKeySecret = display.accessKeySecret.substring(0, 3) + '******'
  }
  if (display.securityToken) {
    display.securityToken = display.securityToken.substring(0, 10) + '******'
  }
  return JSON.stringify(display, null, 2)
})

// OSS客户端实例
let ossClient = null

// 初始化OSS客户端
const initOssClient = async () => {
  if (!stsToken?.value) return
  
  try {
    // 动态导入OSS
    const OSS = (await import('ali-oss')).default
    
    ossClient = new OSS({
      accessKeyId: stsToken.value.accessKeyId,
      accessKeySecret: stsToken.value.accessKeySecret,
      stsToken: stsToken.value.securityToken,
      bucket: stsToken.value.bucket,
      endpoint: stsToken.value.endpoint,
      region: stsToken.value.endpoint?.split('.')[0]?.split('oss-')[1] || '', // 从endpoint解析region
      secure: true // 使用HTTPS
    })
    
    console.log('OSS客户端初始化成功')
  } catch (error) {
    console.error('OSS客户端初始化失败:', error)
    ElMessage.error('OSS客户端初始化失败，请确保已安装ali-oss库')
  }
}

// 上传文件
const uploadFile = async (options) => {
  if (!ossClient) {
    ElMessage.warning('OSS客户端未初始化，请先获取STS令牌')
    return
  }
  
  const file = options.file
  loading.value.upload = true
  uploadProgress.value = 0
  ossUploadErrorInfo.value = null
  
  try {
    // 判断文件类型，添加前缀
    const ext = file.name.split('.').pop().toLowerCase()
    let typePrefix = 'other/'
    // 视频类型
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'mpeg', 'mpg', '3gp', 'rmvb']
    // 图片类型
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
    if (videoExts.includes(ext)) {
      typePrefix = 'video/'
    } else if (imageExts.includes(ext)) {
      typePrefix = 'pic/'
    }

    // 生成文件路径，使用类型+日期目录
    const date = new Date()
    const dateFolder = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`
    const randomStr = Math.random().toString(36).substring(2, 10)
    const fileName = `${randomStr}_${Date.now()}_${file.name}`
    const ossPath = `${typePrefix}${dateFolder}/${fileName}`
    
    // 上传文件
    const result = await ossClient.multipartUpload(ossPath, file, {
      progress: (p) => {
        uploadProgress.value = Math.floor(p * 100)
      }
    })
    
    console.log('文件上传成功:', result)
    
    // 构建访问URL
    let fileUrl = ''
    if (stsToken.value.domain) {
      // 如果有自定义域名，优先使用
      fileUrl = `https://${stsToken.value.domain}/${ossPath}`
    } else {
      // 否则使用OSS默认域名
      fileUrl = `https://${stsToken.value.bucket}.${stsToken.value.endpoint}/${ossPath}`
    }
    
    // 添加到已上传文件列表
    uploadedFiles.value.unshift({
      name: file.name,
      ossPath,
      url: fileUrl,
      size: file.size,
      uploadTime: new Date().toLocaleString()
    })
    
    // 调用上传成功回调
    options.onSuccess(result)
    
    ElMessage.success('文件上传成功')
  } catch (error) {
    console.error('文件上传失败:', error)
    
    // 解析和处理阿里云OSS错误
    ossUploadErrorInfo.value = {
      code: error.code || 'UnknownError',
      message: error.message || '文件上传失败',
      requestId: error.requestId || '',
      hostId: error.hostId || ''
    }
    
    // 根据错误类型显示不同的错误信息
    let errorMsg = '文件上传失败'
    if (error.code === 'AccessDenied') {
      errorMsg = '访问被拒绝，请检查RAM权限配置'
    } else if (error.code === 'InvalidAccessKeyId') {
      errorMsg = 'AccessKey无效，请检查STS令牌'
    } else if (error.code === 'SignatureDoesNotMatch') {
      errorMsg = '签名不匹配，请检查STS令牌'
    } else if (error.message) {
      errorMsg = error.message
    }
    
    ElMessage.error(`上传失败: ${errorMsg}`)
    options.onError(error)
  } finally {
    loading.value.upload = false
  }
}

// 上传成功回调
const handleUploadSuccess = (res) => {
  console.log('上传成功回调:', res)
}

// 上传错误回调
const handleUploadError = (err) => {
  console.error('上传错误回调:', err)
}

// 复制URL到剪贴板
const copyUrl = (url) => {
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('URL已复制到剪贴板')
  }).catch(err => {
    console.error('复制失败:', err)
    ElMessage.error('复制失败')
  })
}

// 打开文件
const openFile = (url) => {
  window.open(url, '_blank')
}

// 刷新文件列表
const refreshFileList = () => {
  ElMessage.info('刷新文件列表功能待实现')
}

// 判断是否为图片文件
const isImage = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === undefined || bytes === null) return '-'
  if (bytes === 0) return '0 B'
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i]
}

// 浏览文件夹
const handleListFiles = async () => {
  if (!hasToken.value) {
    ElMessage.warning('请先获取STS临时令牌')
    return
  }
  loadingList.value = true
  try {
    const items = await listFilesByPath(ossPath.value)
    fileList.value = items.map(item => ({
      name: item.name,
      type: item.isDirectory ? 'dir' : 'file',
      url: item.url,
      size: item.size,
      lastModified: item.lastModified,
      raw: item
    }))
  } catch (e) {
    console.error('获取文件列表失败', e)
    ElMessage.error(e.message || '获取文件列表失败')
  } finally {
    loadingList.value = false
  }
}

// 进入文件夹
const enterDir = (row: any) => {
  // 将当前路径推入路径栈
  pathStack.value.push(ossPath.value);
  // 设置新路径，确保以斜杠结尾
  ossPath.value = row.name.endsWith('/') ? row.name : row.name + '/';
  // 获取新路径的文件列表
  handleListFiles();
}

// 返回上级目录
const goBackDir = () => {
  if (pathStack.value.length > 0) {
    // 从路径栈中取出上级路径
    ossPath.value = pathStack.value.pop() || '';
    handleListFiles();
  }
}

// 在script setup 计算属性处添加
const hasToken = computed(() => !!stsToken.value && !!stsToken.value.accessKeyId)

// ====== 新增：Tree 相关 ======
const treeData = ref([{ label: '根目录', path: '', isLeaf: false }])

const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf'
}

/**
 * 懒加载 Tree 节点
 */
const loadTreeNode = async (node, resolve) => {
  const nodePath = node.data?.path ?? ''
  try {
    const list = await listFilesByPath(nodePath)
    const children = list.map(item => {
      if (item.isDirectory) {
        return {
          label: item.name.replace(nodePath, '').replace(/\/$/, ''),
          path: item.name,
          isLeaf: false
        }
      }
      return {
        label: item.name.replace(nodePath, ''),
        path: item.name,
        url: item.url,
        isLeaf: true
      }
    })
    resolve(children)
  } catch (e) {
    console.error('加载目录失败', e)
    resolve([])
  }
}

// === 新增 normalizeItems 帮助函数 ===
/**
 * 根据 OSS 返回的对象列表，前端生成"目录 + 文件"混合列表
 * @param rawItems 后端 items 数组
 * @param prefix 当前前缀，必须与请求 path 一致
 */
function normalizeItems(rawItems, prefix = '') {
  const dirMap = new Map()
  const files = []
  rawItems.forEach((it) => {
    const rel = prefix ? it.name.replace(prefix, '') : it.name
    if (rel.includes('/')) {
      // 子目录
      const dirName = rel.split('/')[0] + '/'
      const fullPath = prefix + dirName
      if (!dirMap.has(fullPath)) {
        dirMap.set(fullPath, {
          name: fullPath,
          isDirectory: true,
          size: undefined,
          url: '',
          lastModified: undefined
        })
      }
    } else {
      // 当前目录文件
      files.push({
        name: it.name,
        isDirectory: false,
        size: it.size,
        url: it.url || '',
        lastModified: it.lastModified
      })
    }
  })
  return [...dirMap.values(), ...files]
}

// === 修改 listFilesByPath 使用 normalize 列表 ===
const listFilesByPath = async (listPath = '') => {
  if (!hasToken.value) return []
  const res = await fetch(`${baseUrl.value}/admin-api/infra/file/oss-sts/list-files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      configId: Number(configId.value),
      path: listPath,
      maxKeys: 1000,
      accessKeyId: stsToken.value.accessKeyId,
      accessKeySecret: stsToken.value.accessKeySecret,
      securityToken: stsToken.value.securityToken
    })
  })
  const text = await res.text()
  const result = JSON.parse(text)
  if (result.code !== 0) throw new Error(result.msg || '获取目录失败')
  const raw = result.data || []
  return normalizeItems(raw, listPath)
}

// 点击 tree 节点
const handleTreeNodeClick = async (data) => {
  if (data.isLeaf && data.url) {
    // 文件，直接打开
    window.open(data.url, '_blank')
  } else if (!data.isLeaf) {
    // 文件夹，更新表格视图
    ossPath.value = data.path.endsWith('/') ? data.path : data.path + '/'
    await handleListFiles()
  }
}
// ====== Tree 相关结束 ======

// helper 判断目录
const isDirectory = (item) => {
  if (typeof item.isDirectory !== 'undefined') return !!item.isDirectory
  return item.name?.endsWith('/')
}

onMounted(() => {
  console.log('文件测试组件已加载')
  
  // 设置默认的自定义API地址
  if (!customApiUrl.value) {
    const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:48080';
    customApiUrl.value = `${baseUrl}/infra/file/app-oss-sts/get-token?configId=${configId.value}`
  }
  
  // 默认显示调试信息
  showDebugInfo.value = true
  
  // 自动检查是否有令牌，有则加载文件列表
  if (getAccessToken()) {
    authToken.value = getAccessToken()
    // 页面加载后先尝试获取STS令牌
    getSTSToken().then(() => {
      if (stsToken?.value) {
  handleListFiles()
      }
    }).catch(error => {
      console.error('获取STS令牌失败:', error)
    })
  }
  
  // 获取OSS配置列表
  fetchOssConfigList();
  
  // 默认选择Token认证方式
  authType.value = 'token';
})
</script>

<style lang="scss" scoped>
.filetest-container {
  width: 100%;
  min-height: 100vh;
  background-color: var(--el-bg-color);
  
  .content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 80px 20px 40px;
    max-height: calc(100vh - 60px);
    overflow-y: auto;
    position: relative;
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background-color: #c0c4cc;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-track {
      background-color: #f5f7fa;
    }
  }

  .title {
    font-size: 24px;
    margin-bottom: 24px;
    color: var(--el-text-color-primary);
  }

  .mb-4 {
    margin-bottom: 16px;
  }
  
  .mb-3 {
    margin-bottom: 12px;
  }
  
  .ml-2 {
    margin-left: 8px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .card-subtitle {
      margin-left: 10px;
      font-size: 14px;
    }
  }
  
  .system-info {
    padding: 8px 0;
    
    .info-item {
      display: flex;
      margin-bottom: 8px;
      
      .info-label {
        font-weight: 500;
        min-width: 120px;
        color: #666;
      }
      
      .info-value {
        flex: 1;
        word-break: break-all;
      }
    }
  }
  
  .form-tips {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
  
  .config-detail {
    margin-top: 20px;
    
    h3 {
      font-size: 16px;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }
    
    pre {
      background-color: #f5f7fa;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: monospace;
      max-height: 300px;
      overflow-y: auto;
    }
  }

  .token-info {
    margin-top: 20px;
    padding: 16px;
    background-color: var(--el-fill-color-light);
    border-radius: 4px;

    pre {
      background-color: var(--el-bg-color-page);
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: monospace;
      margin: 10px 0;
    }

    .expires-info {
      margin-top: 12px;
    }
  }
  
  .debug-info {
    margin-top: 20px;
    padding: 16px;
    background-color: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    
    h3 {
      margin-top: 0;
      margin-bottom: 16px;
      color: #495057;
      font-size: 16px;
      font-weight: 600;
    }
    
    .debug-section {
      margin-bottom: 16px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .debug-section-title {
        font-weight: 600;
        color: #343a40;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid #dee2e6;
      }
      
      .debug-item {
        display: flex;
        margin-bottom: 4px;
        
        .debug-label {
          font-weight: 500;
          min-width: 120px;
          color: #495057;
        }
        
        .debug-value {
          flex: 1;
          word-break: break-all;
        }
      }
      
      .response-text {
        background-color: #f1f3f5;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: monospace;
        font-size: 12px;
        max-height: 300px;
        overflow-y: auto;
      }
    }
  }

  .upload-section {
    .no-token-tip {
      text-align: center;
      color: var(--el-text-color-secondary);
      padding: 30px;
      border: 1px dashed var(--el-border-color);
      border-radius: 4px;
    }

    .upload-progress {
      margin-top: 16px;
    }
    
    .upload-error-info {
      margin-top: 16px;
      
      h4 {
        font-size: 16px;
        margin: 0 0 8px;
      }
      
      .ram-permission-help {
        margin-top: 16px;
        padding-top: 8px;
        border-top: 1px dashed #f56c6c;
        
        h5 {
          font-size: 14px;
          margin: 0 0 8px;
        }
        
        code {
          background-color: #f9f2f4;
          color: #c7254e;
          padding: 2px 4px;
          border-radius: 3px;
        }
        
        ol {
          padding-left: 20px;
          margin: 8px 0;
        }
        
        p {
          margin: 8px 0;
        }
      }
    }
  }

  .file-list {
    .url-cell {
      display: flex;
      align-items: center;

      .file-url {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 300px;
      }
    }

    .preview {
      .preview-image {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 4px;
      }
    }
  }

  .oss-browser {
    padding: 16px;
    background-color: var(--el-bg-color-page);
    border-radius: 4px;
    border: 1px solid var(--el-border-color);

    .el-form {
      margin-bottom: 16px;
    }

    .el-table {
      margin-top: 12px;
    }
    
    .breadcrumb-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 8px 12px;
      background-color: var(--el-bg-color);
      border-radius: 4px;
      border: 1px solid var(--el-border-color-light);
      
      .el-breadcrumb {
        flex: 1;
      }
      
      .el-breadcrumb-item {
        cursor: pointer;
        &:hover {
          color: var(--el-color-primary);
        }
      }
      
      .breadcrumb-actions {
        margin-left: 12px;
      }
    }
    
    .file-name {
      display: flex;
      align-items: center;
      
      .folder-icon {
        margin-right: 8px;
        color: #e6a23c;
      }
      
      .file-icon {
        margin-right: 8px;
        color: #909399;
      }
    }
  }
}
</style>
