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
import { useUserStore } from '@/store/modules/user'
import { Search } from '@element-plus/icons-vue'
import { getAccessToken } from '@/utils/auth'
import { ElMessage } from 'element-plus'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('video') // 修改为video而不是home
const router = useRouter()

// 从环境变量获取 configId
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID_MAIN || 31
// console.log('OSS_CONFIG_ID from env:', OSS_CONFIG_ID)

// 数据加载状态
const loading = ref(false)
// 错误信息
const errorMsg = ref('')

// 分类数据
const categories = ref<VideoType[]>([])

// 视频数据
const videoList = ref<Video[]>([])

// 存储每个视频的签名URL
const videoPicUrlMap = ref<Record<number, string>>({})

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
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    // 如果搜索关键词为空，显示所有视频
    getVideoList(currentCategoryId.value || undefined)
    return
  }

      // console.log('搜索关键词:', keyword)
  loading.value = true
  errorMsg.value = ''

  // 实现模糊搜索功能
  setTimeout(() => {
    // 在现有视频列表中进行模糊搜索
    const filteredVideos = videoList.value.filter(video =>
      video.title?.toLowerCase().includes(keyword.toLowerCase()) ||
      video.description?.toLowerCase().includes(keyword.toLowerCase())
    )

    if (filteredVideos.length === 0) {
      errorMsg.value = `未找到包含"${keyword}"的相关视频`
      videoList.value = []
    } else {
      videoList.value = filteredVideos
      errorMsg.value = ''
    }

    loading.value = false
  }, 500)
}

// 获取签名URL的工具函数
const fetchSignedUrl = async (path: string) => {
  if (!path) return ''
  try {
    const configId = Number(OSS_CONFIG_ID)
    if (isNaN(configId)) {
      throw new Error('无效的configId: ' + OSS_CONFIG_ID)
    }
    // console.log('获取签名URL - 请求详情:', { configId, path, timeout: 1800 })
    const res = await getAccessUrl(configId, path)
    // console.log('获取签名URL - 原始响应:', res)
    
    // 兼容后端返回 { accessUrl: string }
    let accessUrl = res.accessUrl || res
    
    // 确保URL是字符串
    if (typeof accessUrl === 'object' && accessUrl !== null) {
      accessUrl = accessUrl.accessUrl || ''
    }
    
    // console.log('处理后的accessUrl:', accessUrl)
    
    if (!accessUrl) {
      throw new Error('响应中没有找到有效的accessUrl')
    }
    
    return accessUrl
  } catch (error) {
          // console.error('fetchSignedUrl 详细错误:', error, JSON.stringify(error));
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
    // console.log('正在使用OSS配置ID:', OSS_CONFIG_ID)
    const res = await FrontVideoApi.getVideoList(params)
    videoList.value = res.list || []
    
    // 重置签名URL映射
    videoPicUrlMap.value = {}
    
    // 为每个视频获取签名URL
    for (const video of videoList.value) {
      // 使用picUrl字段获取封面图片
      if (video.picUrl) {
        try {
          // console.log(`为视频ID ${video.id} 获取封面图片URL: ${video.picUrl}，使用configId: ${OSS_CONFIG_ID}`)
          const accessUrl = await fetchSignedUrl(video.picUrl)
          if (accessUrl) {
            // console.log(`获取到签名URL: ${accessUrl}`)
            videoPicUrlMap.value[video.id] = accessUrl
          }
        } catch (err) {
          // console.error(`获取视频 ${video.id} 的封面图片失败:`, err)
      }
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
  searchKeyword.value = '' // 切换到全部视频时清空搜索关键词
  getVideoList()
}

const handleCategoryClick = (category: VideoType) => {
  currentCategoryId.value = category.id
  searchKeyword.value = '' // 切换分类时清空搜索关键词
  getVideoList(category.id)
}

// 获取默认图片
const getDefaultImage = (url?: string) => {
  if (url) return url
  return '/public/52b80c4b-982d-4333-bb14-e98a141352fe.jpg' // 使用公共目录下的图片作为默认图片
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

// 格式化视频时长
const formatDuration = (duration?: number) => {
  if (!duration) return '00:00'
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// 处理图片加载错误
const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  if (target) {
    const videoId = target.closest('.video-card')?.getAttribute('data-video-id')
    // console.log(`图片加载失败，视频ID: ${videoId || '未知'}，URL: ${target.src}`)
    
    // 检查是否是签名URL加载失败
    if (target.src.includes('aliyuncs.com') || target.src.includes('signature')) {
      // console.log('OSS签名URL加载失败，尝试使用默认图片')
    }
    
    // 使用默认图片
    target.src = '/public/52b80c4b-982d-4333-bb14-e98a141352fe.jpg'
    
    // 移除crossorigin属性，避免默认图片也加载失败
    target.removeAttribute('crossorigin')
  }
}

// 移动端侧边栏状态
const sidebarVisible = ref(false)
const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

onMounted(async () => {
  // console.log('视频页面组件已加载')
  await getVideoCategories()
  await getVideoList() // 默认加载全部视频
})
</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />

    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">视频教学</h1>
        <p class="page-subtitle">专业的股票期权教学视频，助您掌握投资技巧</p>
      </div>
    </div>

    <div class="video-container">
      <!-- 搜索区域 -->
      <div class="search-section">
        <div class="search-wrapper">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索您感兴趣的视频内容..."
            class="search-input"
            size="large"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon class="search-icon"><Search /></el-icon>
            </template>
          </el-input>
          <el-button
            class="search-btn"
            type="primary"
            size="large"
            @click="handleSearch"
            :loading="loading"
          >
            <el-icon><Search /></el-icon>
            <span>搜索</span>
          </el-button>
        </div>
      </div>

      <!-- 分类筛选 -->
      <div class="category-section">
        <h3 class="section-title">视频分类</h3>
        <div class="category-tabs">
          <div
            class="category-tab"
            :class="{ active: currentCategoryId === null }"
            @click="handleAllCategory"
          >
            <i class="el-icon-menu"></i>
            <span>全部视频</span>
          </div>
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-tab"
            :class="{ active: currentCategoryId === category.id }"
            @click="handleCategoryClick(category)"
          >
            <i class="el-icon-video-play"></i>
            <span>{{ category.name }}</span>
          </div>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="errorMsg" class="error-section">
        <div class="error-card">
          <i class="el-icon-warning-outline error-icon"></i>
          <div class="error-content">
            <h4>提示信息</h4>
            <p>{{ errorMsg }}</p>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div v-for="n in 6" :key="n" class="loading-skeleton">
          <div class="skeleton-thumbnail"></div>
          <div class="skeleton-details">
            <div class="skeleton-title"></div>
            <div class="skeleton-meta"></div>
          </div>
        </div>
      </div>

      <!-- 视频内容区域 -->
      <div v-else class="video-content">
        <div class="content-header">
          <h3 class="section-title">
            <i class="el-icon-video-play"></i>
            {{ currentCategoryId ? categories.find(c => c.id === currentCategoryId)?.name : '全部视频' }}
            <span class="video-count">({{ videoList.length }} 个视频)</span>
          </h3>
        </div>

        <div class="video-grid">
          <div
            v-for="video in videoList"
            :key="video.id"
            class="video-card"
            :data-video-id="video.id"
            @click="video.id && goToVideoDetail(video.id)"
          >
            <div class="card-thumbnail">
              <el-image
                :src="video.id && videoPicUrlMap[video.id] || getDefaultImage(video.picUrl)"
                :alt="video.title"
                fit="cover"
                lazy
                :preview-src-list="[]"
                :initial-index="0"
              >
                <template #error>
                  <div class="image-error">
                    <img src="/public/52b80c4b-982d-4333-bb14-e98a141352fe.jpg" alt="默认封面" />
                  </div>
                </template>
                <template #placeholder>
                  <div class="image-placeholder">
                    <el-icon class="is-loading"><i class="el-icon-loading"></i></el-icon>
                  </div>
                </template>
              </el-image>
              <div class="video-overlay">
                <div class="play-button">
                  <i class="el-icon-video-play"></i>
                </div>
              </div>
              <div class="duration-badge">{{ formatDuration(video.duration) }}</div>
            </div>

            <div class="card-content">
              <h4 class="video-title">{{ video.title }}</h4>
              <div class="video-meta">
                <div class="meta-item">
                  <i class="el-icon-view"></i>
                  <span>{{ formatViews(video.view || getRandomViews()) }}</span>
                </div>
                <div class="meta-item">
                  <i class="el-icon-time"></i>
                  <span>{{ formatDate() }}</span>
                </div>
              </div>
              <div class="video-description">
                专业的期权教学内容，帮助您深入理解投资策略
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更多按钮已隐藏 -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-video;
$primary-color: #1a73e8;
$secondary-color: #34a853;
$text-color: #2c3e50;
$text-light: #5f6368;
$bg-color: #ffffff;
$bg-light: #f8f9fa;
$border-color: #e8eaed;
$shadow-light: 0 2px 8px rgba(0, 0, 0, 0.1);
$shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.15);
$header-height: 70px;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 100%);
  color: $text-color;

  // 页面头部
  .page-header {
    background: linear-gradient(135deg, #1a73e8 0%, #4285f4 50%, #34a853 100%);
    padding: 80px 0 60px;
    text-align: center;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
      animation: rotate 20s linear infinite;
    }

    .header-content {
      position: relative;
      z-index: 2;
      max-width: 800px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .page-title {
      font-size: 48px;
      font-weight: 800;
      color: white;
      margin-bottom: 16px;
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      letter-spacing: -1px;
    }

    .page-subtitle {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      line-height: 1.5;
    }
  }

  .video-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  // 搜索区域
  .search-section {
    margin-bottom: 40px;

    .search-wrapper {
      display: flex;
      max-width: 600px;
      margin: 0 auto;
      gap: 12px;

      .search-input {
        flex: 1;

        :deep(.el-input__wrapper) {
          border-radius: 25px;
          box-shadow: $shadow-light;
          border: 1px solid $border-color;
          transition: all 0.3s ease;

          &.is-focus {
            box-shadow: $shadow-hover;
            border-color: $primary-color;
          }
        }

        :deep(.el-input__inner) {
          font-size: 16px;

          &::placeholder {
            color: $text-light;
          }
        }

        .search-icon {
          color: $text-light;
          font-size: 18px;
        }
      }

      .search-btn {
        border-radius: 25px;
        padding: 0 24px;
        background: $primary-color;
        border: none;
        box-shadow: $shadow-light;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: $shadow-hover;
          background: darken($primary-color, 8%);
        }

        i {
          margin-right: 6px;
        }
      }
    }
  }

  // 错误信息样式
  .error-section {
    margin: 30px 0;

    .error-card {
      background: white;
      border-radius: 16px;
      padding: 30px;
      box-shadow: $shadow-light;
      border-left: 4px solid #ff9800;
      display: flex;
      align-items: center;
      gap: 16px;

      .error-icon {
        font-size: 32px;
        color: #ff9800;
      }

      .error-content {
        h4 {
          margin: 0 0 8px 0;
          color: $text-color;
          font-size: 18px;
          font-weight: 600;
        }

        p {
          margin: 0;
          color: $text-light;
          font-size: 16px;
        }
      }
    }
  }

  // 分类区域
  .category-section {
    margin-bottom: 40px;

    .section-title {
      font-size: 24px;
      font-weight: 700;
      color: $text-color;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: $primary-color;
      }
    }

    .category-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center; // 居中对齐

      .category-tab {
        background: white;
        border: 2px solid $border-color;
        border-radius: 25px;
        padding: 12px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center; // 按钮内容居中
        gap: 8px;
        font-weight: 500;
        color: $text-color;
        box-shadow: $shadow-light;

        i {
          font-size: 16px;
          color: $text-light;
          transition: color 0.3s ease;
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: $shadow-hover;
          border-color: $primary-color;

          i {
            color: $primary-color;
          }
        }

        &.active {
          background: $primary-color;
          border-color: $primary-color;
          color: white;

          i {
            color: white;
          }
        }
      }
    }
  }

  // 视频内容区域
  .video-content {
    .content-header {
      margin-bottom: 30px;

      .section-title {
        font-size: 28px;
        font-weight: 700;
        color: $text-color;
        display: flex;
        align-items: center;
        gap: 12px;

        i {
          color: $primary-color;
          font-size: 32px;
        }

        .video-count {
          font-size: 18px;
          color: $text-light;
          font-weight: 400;
        }
      }
    }
  }

  // 加载骨架屏
  .loading-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px;

    .loading-skeleton {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: $shadow-light;

      .skeleton-thumbnail {
        width: 100%;
        height: 200px;
        background: linear-gradient(90deg, #f0f2f5 25%, #f8f9fa 50%, #f0f2f5 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }

      .skeleton-details {
        padding: 20px;

        .skeleton-title {
          height: 20px;
          background: linear-gradient(90deg, #f0f2f5 25%, #f8f9fa 50%, #f0f2f5 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
          margin-bottom: 12px;
          width: 90%;
        }

        .skeleton-meta {
          height: 16px;
          background: linear-gradient(90deg, #f0f2f5 25%, #f8f9fa 50%, #f0f2f5 75%);
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

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  // 视频网格
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  // 视频卡片
  .video-card {
    cursor: pointer;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: $shadow-light;
    transition: all 0.3s ease;
    border: 1px solid $border-color;

    &:hover {
      transform: translateY(-8px);
      box-shadow: $shadow-hover;
      border-color: $primary-color;

      .card-thumbnail {
        .video-overlay {
          opacity: 1;
        }

        :deep(.el-image img) {
          transform: scale(1.05);
        }
      }

      .video-title {
        color: $primary-color;
      }
    }

    .card-thumbnail {
      position: relative;
      width: 100%;
      overflow: hidden;

      &::before {
        content: "";
        display: block;
        padding-top: 56.25%; // 16:9 比例
      }

      :deep(.el-image) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
      }

      .image-error, .image-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: $bg-light;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .video-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;

        .play-button {
          width: 60px;
          height: 60px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: scale(0.8);
          transition: transform 0.3s ease;

          i {
            font-size: 24px;
            color: $primary-color;
            margin-left: 4px;
          }
        }

        &:hover .play-button {
          transform: scale(1);
        }
      }

      .duration-badge {
        position: absolute;
        bottom: 12px;
        right: 12px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        z-index: 3;
      }
    }

    .card-content {
      padding: 16px;

      .video-title {
        font-size: 16px;
        font-weight: 600;
        line-height: 1.4;
        margin: 0 0 10px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        color: $text-color;
        transition: color 0.3s ease;
      }

      .video-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: $text-light;

          i {
            font-size: 14px;
          }
        }
      }

      .video-description {
        font-size: 13px;
        color: $text-light;
        line-height: 1.4;
        margin: 0;
      }
    }
  }

  // 加载更多
  .load-more-section {
    display: flex;
    justify-content: center;
    margin-top: 50px;
    padding-bottom: 50px;

    .load-more-btn {
      padding: 16px 40px;
      font-weight: 600;
      font-size: 16px;
      border-radius: 25px;
      background: $primary-color;
      border: none;
      box-shadow: $shadow-light;
      transition: all 0.3s ease;

      i {
        margin-right: 8px;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: $shadow-hover;
        background: darken($primary-color, 8%);
      }
    }
  }

  // 响应式设计
  @media (max-width: 1200px) {
    .video-container {
      padding: 30px 16px;
    }

    .video-grid {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .page-header {
      padding: 60px 0 40px;

      .page-title {
        font-size: 36px;
      }

      .page-subtitle {
        font-size: 18px;
      }
    }

    .video-grid {
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .search-section {
      .search-wrapper {
        flex-direction: column;

        .search-btn {
          align-self: center;

          span {
            display: none;
          }
        }
      }
    }

    .category-section {
      .category-tabs {
        .category-tab {
          span {
            display: none;
          }
        }
      }
    }
  }

  @media (max-width: 576px) {
    .page-header {
      padding: 40px 0 30px;

      .page-title {
        font-size: 28px;
      }

      .page-subtitle {
        font-size: 16px;
      }
    }

    .video-grid {
      grid-template-columns: 1fr;
    }

    .video-container {
      padding: 20px 12px;
    }

    .video-card {
      .card-content {
        padding: 16px;
      }
    }
  }
}
</style>
