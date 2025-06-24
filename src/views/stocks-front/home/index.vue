<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import StocksHeader from '@/components/StocksHeader/index.vue'
import { FrontVideoApi } from '@/api/stocks-front/video'
import { FrontVideoTypeApi } from '@/api/stocks-front/videotype'
import type { Video } from '@/api/system/video'
import type { VideoType } from '@/api/system/videotype'
import { getAccessUrl } from '@/api/infra/file'
import { useSignedUrlPreview } from '@/utils/useSignedUrlPreview'
import { useUserStore } from '@/store/modules/user'
import { Search } from '@element-plus/icons-vue'
import { getAccessToken } from '@/utils/auth'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('home')
const router = useRouter()

// 从环境变量获取 configId
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID
console.log('OSS_CONFIG_ID from env:', OSS_CONFIG_ID)

// 测试图片路径（只用相对路径！）
const testImagePath = '20250619/398b82aad7370a0e5d6fdab76e3af5a_1750312606407.png'
const testImageUrl = ref('')
const testImageLoading = ref(true)

// 数据加载状态
const loading = ref(false)
// 错误信息
const errorMsg = ref('')

// 分类数据
const categories = ref<VideoType[]>([])

// 视频数据
const videoList = ref<Video[]>([])

// 存储每个视频的签名URL composable
const videoPicSignedUrlMap = ref<Record<number, ReturnType<typeof useSignedUrlPreview>>>({})

// 当前选中的分类ID，null 表示全部
const currentCategoryId = ref<number | null>(null)

// 搜索关键词
const searchKeyword = ref('')

// 判断用户是否已登录
const isUserLoggedIn = computed(() => {
  return !!getAccessToken()
})

const userStore = useUserStore()

// 处理搜索
const handleSearch = () => {
  if (!searchKeyword.value.trim()) return
  
  console.log('搜索关键词:', searchKeyword.value)
  // 可以添加实际的搜索逻辑，例如调用API进行搜索
  errorMsg.value = `正在搜索"${searchKeyword.value}"相关的视频...`
  
  // 模拟搜索行为
  loading.value = true
  setTimeout(() => {
    loading.value = false
    // 这里可以调用实际的搜索API
    // searchVideos(searchKeyword.value)
  }, 1000)
}

// 获取签名URL的工具函数
const fetchSignedUrl = async (path: string) => {
  if (!path) return ''
  try {
    const configId = Number(OSS_CONFIG_ID)
    if (isNaN(configId)) {
      throw new Error('无效的configId: ' + OSS_CONFIG_ID)
    }
    console.log('获取签名URL - 请求详情:', { configId, path, timeout: 1800 })
    const res = await getAccessUrl(configId, path)
    console.log('获取签名URL - 原始响应:', res)
    console.log('后端原始返回JSON:', JSON.stringify(res, null, 2))
    // 兼容后端返回 { accessUrl: string }
    const accessUrl = res.accessUrl
    console.log('fetchSignedUrl accessUrl:', accessUrl)
    if (!accessUrl) {
      throw new Error('响应中没有找到有效的accessUrl')
    }
    return accessUrl
  } catch (error) {
    console.error('fetchSignedUrl 详细错误:', error, JSON.stringify(error));
    errorMsg.value = `获取签名URL失败: ${error.message || '未知错误'}`;
    return ''
  }
}

// 获取视频分类
const getVideoCategories = async () => {
  try {
    const res = await FrontVideoTypeApi.getAllVideoTypes()
    categories.value = res.list || []
  } catch (error) {
    if (error && error.toString().includes('401')) {
      errorMsg.value = '未登录，部分分类仅登录后可见';
    } else {
      errorMsg.value = '获取视频分类失败: ' + (error.message || '未知错误')
    }
  }
}

// 获取视频列表
const getVideoList = async (categoryId?: number) => {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = {
      pageNo: 1,
      pageSize: 24 // 增加默认显示数量
    }
    if (categoryId) {
      params['typeId'] = categoryId
    }
    const res = await FrontVideoApi.getVideoList(params)
    videoList.value = res.list || []
    videoPicSignedUrlMap.value = {}
    for (const video of videoList.value) {
      if (video.picUrl) {
        const preview = useSignedUrlPreview()
        videoPicSignedUrlMap.value[video.id] = preview
        preview.fetchSignedUrl(video.picUrl)
      }
    }
    if (res.list?.length === 0) {
      errorMsg.value = '没有找到视频数据'
    }
  } catch (error) {
    if (error && error.toString().includes('401')) {
      errorMsg.value = '未登录，部分视频仅登录后可见';
    } else {
      errorMsg.value = '获取视频列表失败: ' + (error.message || '未知错误')
    }
  } finally {
    loading.value = false
  }
}

const goToVideoDetail = (videoId: number) => {
  router.push(`/stocks-front/videodetail/${videoId}`)
}

const goToHome = () => {
  router.push('/stocks-front/home')
}

const goToUserDetail = () => {
  router.push('/stocks-front/userDetail')
}

const goToVipUpgrade = () => {
  router.push('/stocks-front/vip_upgrade')
}

// 处理"全部"分类点击
const handleAllCategory = () => {
  currentCategoryId.value = null
  getVideoList()
}

const handleCategoryClick = (category: VideoType) => {
  currentCategoryId.value = category.id
  getVideoList(category.id)
}

// 获取默认图片
const getDefaultImage = (url?: string) => {
  return url || '/src/assets/imgs/mountain.jpg'
}

// 格式化观看次数
const formatViews = (count: number = 0) => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M 次观看'
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K 次观看'
  }
  return count + ' 次观看'
}

// 格式化发布时间 (随机生成，仅用于演示)
const formatDate = () => {
  const days = Math.floor(Math.random() * 365)
  if (days === 0) {
    return '今天'
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return days + ' 天前'
  } else if (days < 30) {
    return Math.floor(days / 7) + ' 周前'
  } else if (days < 365) {
    return Math.floor(days / 30) + ' 个月前'
  } else {
    return Math.floor(days / 365) + ' 年前'
  }
}

// 随机生成观看次数（用于演示）
const getRandomViews = () => {
  return Math.floor(Math.random() * 1000000)
}

// 移动端侧边栏状态
const sidebarVisible = ref(false)
const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

onMounted(async () => {
  console.log('首页组件已加载')
  getVideoCategories()
  getVideoList() // 默认加载全部视频
})
</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />
    
    <!-- 移动端导航切换按钮 -->
    <div class="mobile-menu-toggle" @click="toggleSidebar">
      <i class="el-icon-menu"></i>
    </div>
    
    <div class="app-layout">
      <!-- 侧边栏 -->
      <aside class="sidebar" :class="{ 'active': sidebarVisible }">
        <div class="sidebar-section">
          <div class="sidebar-item" :class="{ active: $route.path.includes('/stocks-front/home') }" @click="goToHome">
            <i class="el-icon-house"></i>
            <span>首页</span>
          </div>
          <div class="sidebar-item">
            <i class="el-icon-video-play"></i>
            <span>短片</span>
          </div>
          <div class="sidebar-item">
            <i class="el-icon-collection-tag"></i>
            <span>订阅内容</span>
          </div>
        </div>
        
        <div class="sidebar-divider"></div>
        
        <div class="sidebar-section">
          <div class="sidebar-item">
            <i class="el-icon-collection"></i>
            <span>媒体库</span>
          </div>
          <div class="sidebar-item">
            <i class="el-icon-time"></i>
            <span>历史记录</span>
          </div>
          <div class="sidebar-item">
            <i class="el-icon-video-camera"></i>
            <span>我的视频</span>
          </div>
          <div class="sidebar-item">
            <i class="el-icon-clock"></i>
            <span>稍后观看</span>
          </div>
          <div class="sidebar-item">
            <i class="el-icon-star-on"></i>
            <span>收藏</span>
          </div>
        </div>
        
        <div class="sidebar-divider"></div>
        
        <div class="sidebar-section">
          <div class="sidebar-header">探索</div>
          <div 
            v-for="category in categories"
            :key="category.id"
            class="sidebar-item"
            :class="{ active: currentCategoryId === category.id }"
            @click="handleCategoryClick(category)"
          >
            <i class="el-icon-folder"></i>
            <span>{{ category.name }}</span>
          </div>
        </div>

        <div class="sidebar-divider"></div>

        <div class="sidebar-section" v-if="isUserLoggedIn">
          <div class="sidebar-header">我的账户</div>
          <div class="sidebar-item" @click="goToUserDetail">
            <i class="el-icon-user"></i>
            <span>个人资料</span>
          </div>
          <div class="sidebar-item" @click="goToVipUpgrade">
            <i class="el-icon-trophy"></i>
            <span>购买VIP</span>
          </div>
        </div>
      </aside>
      
      <!-- 遮罩层（移动端） -->
      <div class="sidebar-overlay" v-if="sidebarVisible" @click="toggleSidebar"></div>
      
      <!-- 主内容区 -->
      <main class="main-content">
        <!-- 顶部横幅 -->
        <div class="content-header">
          <h1 class="page-title">精选视频</h1>
          <p class="page-description">发现最新、最热门的视频内容</p>
        </div>
        
        <!-- 分类筛选器 -->
        <div class="category-chips">
          <div 
            class="category-chip" 
            :class="{ active: currentCategoryId === null }"
            @click="handleAllCategory"
          >
            全部
          </div>
          <div 
            v-for="category in categories.slice(0, 10)"
            :key="category.id"
            class="category-chip"
            :class="{ active: currentCategoryId === category.id }"
            @click="handleCategoryClick(category)"
          >
            {{ category.name }}
          </div>
        </div>
        
        <!-- 加载提示 -->
        <div v-if="loading" class="loading-container">
          <div v-for="i in 8" :key="i" class="loading-skeleton">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-details">
              <div class="skeleton-title"></div>
              <div class="skeleton-meta"></div>
            </div>
          </div>
        </div>
        
        <!-- 错误提示 -->
        <el-alert
          v-if="errorMsg"
          :title="errorMsg"
          type="warning"
          show-icon
          :closable="false"
          class="mb-4"
        />
        
        <!-- 视频网格 -->
        <el-empty v-if="!loading && videoList.length === 0" description="暂无视频" />
        <div v-else-if="!loading" class="video-grid">
          <div
            v-for="video in videoList"
            :key="video.id"
            class="video-card"
            @click="goToVideoDetail(video.id)"
          >
            <div class="thumbnail">
              <img :src="videoPicSignedUrlMap[video.id]?.signedUrl || getDefaultImage()" :alt="video.title" />
              <span class="duration">{{ Math.floor(video.duration || 0) }}秒</span>
            </div>
            <div class="video-info">
              <div class="avatar">
                <div class="avatar-circle"></div>
              </div>
              <div class="details">
                <h3 class="title" :title="video.title">{{ video.title }}</h3>
                <div class="channel-name">{{ video.author || '匿名用户' }}</div>
                <div class="meta">
                  <span class="views">{{ formatViews(getRandomViews()) }}</span>
                  <span class="dot">•</span>
                  <span class="publish-date">{{ formatDate() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 分页或加载更多按钮 -->
        <div class="load-more-container" v-if="!loading && videoList.length > 0">
          <el-button type="primary" round class="load-more-btn">加载更多</el-button>
        </div>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-home;
$primary-color: #065fd4;
$text-color: #0f0f0f;
$text-secondary: #606060;
$bg-color: #ffffff;
$bg-secondary: #f9f9f9;
$border-color: #e5e5e5;
$hover-color: #f2f2f2;
$sidebar-width: 240px;
$header-height: 60px;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background: $bg-color;
  color: $text-color;
  
  .app-layout {
    display: flex;
    padding-top: $header-height;
    min-height: calc(100vh - $header-height);
  }
  
  // 侧边栏样式
  .sidebar {
    width: $sidebar-width;
    height: calc(100vh - $header-height);
    position: fixed;
    left: 0;
    top: $header-height;
    background: $bg-color;
    overflow-y: auto;
    padding: 12px 0;
    z-index: 100;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    
    &-section {
      margin-bottom: 12px;
    }
    
    &-header {
      padding: 8px 24px;
      font-size: 16px;
      font-weight: 500;
      color: $text-color;
    }
    
    &-item {
      display: flex;
      align-items: center;
      padding: 10px 24px;
      cursor: pointer;
      border-radius: 0 20px 20px 0;
      margin-right: 12px;
      
      i {
        margin-right: 24px;
        font-size: 20px;
      }
      
      span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      &:hover {
        background: $hover-color;
      }
      
      &.active {
        background: rgba($primary-color, 0.1);
        font-weight: 500;
        color: $primary-color;
      }
    }
    
    &-divider {
      height: 1px;
      background: $border-color;
      margin: 12px 0;
    }
  }
  
  // 侧边栏遮罩
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
    display: none;
  }
  
  // 移动端菜单按钮
  .mobile-menu-toggle {
    position: fixed;
    top: 70px;
    left: 10px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: $primary-color;
    color: white;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 99;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    
    &:hover {
      background: darken($primary-color, 10%);
    }
    
    i {
      font-size: 20px;
    }
  }
  
  // 主内容区样式
  .main-content {
    flex: 1;
    margin-left: $sidebar-width;
    padding: 24px 40px;
    background-color: #f5f7fa;
  }
  
  // 内容头部
  .content-header {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba($border-color, 0.5);
    
    .page-title {
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 8px;
      color: $text-color;
    }
    
    .page-description {
      font-size: 16px;
      color: $text-secondary;
      margin: 0;
    }
  }
  
  // 分类筛选器
  .category-chips {
    display: flex;
    overflow-x: auto;
    gap: 12px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    scrollbar-width: none; // Firefox
    &::-webkit-scrollbar {
      display: none; // Chrome, Safari, Edge
    }
    
    .category-chip {
      background: $bg-secondary;
      color: $text-color;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      
      &:hover {
        border-color: rgba($primary-color, 0.3);
        background: darken($bg-secondary, 3%);
      }
      
      &.active {
        background: $primary-color;
        color: $bg-color;
      }
    }
  }
  
  // 加载骨架屏
  .loading-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    
    .loading-skeleton {
      display: flex;
      flex-direction: column;
      
      .skeleton-thumbnail {
        width: 100%;
        height: 180px;
        background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 12px;
        margin-bottom: 12px;
      }
      
      .skeleton-details {
        display: flex;
        flex-direction: column;
        
        .skeleton-title {
          height: 20px;
          background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-bottom: 12px;
          width: 90%;
        }
        
        .skeleton-meta {
          height: 16px;
          background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          width: 60%;
        }
      }
    }
  }
  
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  // 视频网格
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }
  
  // 视频卡片
  .video-card {
    cursor: pointer;
    background: $bg-color;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
      
      .thumbnail img {
        transform: scale(1.05);
      }
    }
    
    .thumbnail {
      position: relative;
      width: 100%;
      overflow: hidden;
      
      &::before {
        content: "";
        display: block;
        padding-top: 56.25%; // 16:9 比例
      }
      
      img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }
      
      .duration {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 3px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
    }
    
    .video-info {
      display: flex;
      padding: 12px;
      
      .avatar {
        margin-right: 12px;
        
        .avatar-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #eee;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      }
      
      .details {
        flex: 1;
        
        .title {
          font-size: 16px;
          font-weight: 500;
          line-height: 1.4;
          margin: 0 0 6px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          color: $text-color;
        }
        
        .channel-name {
          font-size: 14px;
          color: $text-secondary;
          margin-bottom: 4px;
        }
        
        .meta {
          font-size: 14px;
          color: $text-secondary;
          display: flex;
          align-items: center;
          
          .dot {
            margin: 0 4px;
          }
        }
      }
    }
  }
  
  // 加载更多
  .load-more-container {
    display: flex;
    justify-content: center;
    margin-top: 40px;
    padding-bottom: 40px;
    
    .load-more-btn {
      padding: 12px 32px;
      font-weight: 500;
      font-size: 16px;
      background-color: $primary-color;
      border-color: $primary-color;
      
      &:hover {
        background-color: darken($primary-color, 5%);
      }
    }
  }
  
  // 响应式设计
  @media (max-width: 1200px) {
    .main-content {
      padding: 24px;
    }
  }
  
  @media (max-width: 768px) {
    .mobile-menu-toggle {
      display: flex;
    }
    
    .sidebar {
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
      
      &.active {
        transform: translateX(0);
      }
    }
    
    .sidebar-overlay {
      display: block;
    }
    
    .main-content {
      margin-left: 0;
      padding: 16px;
    }
    
    .content-header {
      .page-title {
        font-size: 24px;
      }
    }
    
    .video-grid {
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }
  }
}
</style>
