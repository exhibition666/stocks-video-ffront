<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, onMounted, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import StocksHeader from '@/components/StocksHeader/index.vue'
import { FrontVideoApi } from '@/api/stocks-front/video'
import { getAccessUrl } from '@/api/infra/file'
import { useSignedUrlPreview } from '@/utils/useSignedUrlPreview'
import { FrontVideoTypeApi } from '@/api/stocks-front/videotype'
import 'video.js/dist/video-js.css'
import { useUserStore } from '@/store/modules/user'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const videoId = ref(Number(route.params.id))
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID

const videoData = ref<any>(null)
const { signedUrl: fullVideoUrl, fetchSignedUrl: fetchFullVideoUrl } = useSignedUrlPreview()
const { signedUrl: previewVideoUrl, fetchSignedUrl: fetchPreviewVideoUrl } = useSignedUrlPreview()
const { signedUrl: coverUrl, fetchSignedUrl: fetchCoverUrl } = useSignedUrlPreview()
const loading = ref(true)
const errorMsg = ref('')
const videoTypeOptions = ref<any[]>([])
const typeName = ref('')
const playerReady = ref(false)
const videoElement = ref<HTMLVideoElement | null>(null)
const trialEnded = ref(false)
const showUpgradeOverlay = ref(false)
const isFullScreen = ref(false)

// 全屏控制
const toggleFullScreen = () => {
  if (!videoElement.value) return
  
  if (!isFullScreen.value) {
    // 进入全屏
    if (videoElement.value.requestFullscreen) {
      videoElement.value.requestFullscreen()
    } else if ((videoElement.value as any).webkitRequestFullscreen) {
      (videoElement.value as any).webkitRequestFullscreen()
    } else if ((videoElement.value as any).msRequestFullscreen) {
      (videoElement.value as any).msRequestFullscreen()
    }
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen()
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen()
    }
  }
}

// 监听全屏状态变化
const handleFullscreenChange = () => {
  isFullScreen.value = !!document.fullscreenElement || 
                     !!(document as any).webkitFullscreenElement || 
                     !!(document as any).msFullscreenElement
}

// 防止视频下载的全局处理
const setupAntiDownloadProtection = () => {
  // 禁用整个页面的右键菜单
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // 如果是视频或图片元素，阻止默认右键菜单
    if (target.tagName === 'VIDEO' || target.tagName === 'IMG' || 
        target.classList.contains('main-video-player') || 
        target.classList.contains('main-video-cover')) {
      e.preventDefault();
      return false;
    }
  };
  
  // 禁用视频的拖拽功能
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'VIDEO' || target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  };
  
  // 添加事件监听器
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('msfullscreenchange', handleFullscreenChange);
  
  // 组件卸载时移除事件监听器
  onBeforeUnmount(() => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('dragstart', handleDragStart);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('msfullscreenchange', handleFullscreenChange);
  });
};

// 判断是否VIP
const isVipUser = computed(() => {
  const levelName = userStore.user?.level?.name || ''
  const isVip = levelName.includes('VIP') || levelName.includes('vip')
  return isVip
})

// 试看时长（秒），优先取视频 previewLimit 字段
const previewDuration = computed(() => {
  return videoData.value?.previewLimit || 60
})

// 当前要播放的视频URL
const currentVideoUrl = computed(() => {
  // VIP用户使用完整视频URL，非VIP用户优先使用预览视频URL，如果没有则使用完整视频URL
  if (isVipUser.value) {
    return fullVideoUrl.value;
  } else {
    // 如果有专门的预览视频，则使用预览视频
    if (videoData.value?.previewUrl && previewVideoUrl.value) {
      return previewVideoUrl.value;
    } 
    // 否则使用完整视频，但在播放器中限制时长
    return fullVideoUrl.value;
  }
})

// 是否需要限制播放时长
const needLimitDuration = computed(() => {
  // 只有非VIP用户且使用完整视频时才需要限制时长
  return !isVipUser.value && !videoData.value?.previewUrl && fullVideoUrl.value
})

const userStore = useUserStore()

// 显示升级VIP提示
const showVipUpgradePrompt = () => {
  if (trialEnded.value) return; // 防止重复提示
  
  trialEnded.value = true;
  showUpgradeOverlay.value = true;
  
  if (videoElement.value) {
    // 暂停视频
    videoElement.value.pause();
    
    // 禁用视频控件
    videoElement.value.controls = false;
    
    // 记录当前播放位置
    const currentTime = videoElement.value.currentTime;
    
    // 添加事件拦截
    videoElement.value.addEventListener('play', preventPlayback);
    videoElement.value.addEventListener('seeking', preventSeeking);
    
    // 确保视频停在试看结束的时间点
    videoElement.value.currentTime = previewDuration.value;
  }
  
  ElMessage.warning('试看结束，升级为VIP会员可观看完整内容');
}

// 阻止继续播放
const preventPlayback = (event: Event) => {
  if (!videoElement.value) return;
  event.preventDefault();
  event.stopPropagation();
  videoElement.value.pause();
}

// 阻止拖动进度条
const preventSeeking = (event: Event) => {
  if (!videoElement.value || !trialEnded.value) return;
  event.preventDefault();
  event.stopPropagation();
  // 将时间重置回试看结束点
  videoElement.value.currentTime = previewDuration.value;
}

// 监听视频时间更新，用于试看功能
const handleTimeUpdate = (event: Event) => {
  if (!needLimitDuration.value || !videoElement.value || trialEnded.value) return;
  
  const currentTime = videoElement.value.currentTime;
  if (currentTime >= previewDuration.value) {
    showVipUpgradePrompt();
  }
}

// 视频加载错误处理
const handleVideoError = () => {
      // console.error('视频加载失败');
  ElMessage.error('视频加载失败，请稍后再试');
}

// 视频加载成功处理
const handleVideoLoaded = () => {
  playerReady.value = true;
}

// 升级VIP
const upgradeToVip = () => {
  showUpgradeOverlay.value = false;
  // 跳转到VIP升级页面
  router.push('/stocks-front/vip_upgrade');
}

// 关闭升级提示
const closeUpgradeOverlay = () => {
  showUpgradeOverlay.value = false;
}

const getVideoDetail = async (id: number) => {
  loading.value = true;
  errorMsg.value = '';
  trialEnded.value = false;
  showUpgradeOverlay.value = false;
  
  try {
    const res = await FrontVideoApi.getVideoDetail(id);
    videoData.value = res;
    
    if (videoTypeOptions.value.length && res?.typeId) {
      const type = videoTypeOptions.value.find(t => t.id === res.typeId);
      typeName.value = type ? type.name : '';
    }
    
    try {
      // 获取完整视频URL
      if (res?.fileUrl) {
        await fetchFullVideoUrl(res.fileUrl);
      }
      
      // 获取预览视频URL（如果有）
      if (res?.previewUrl) {
        await fetchPreviewVideoUrl(res.previewUrl);
      }
      
      // 获取封面图URL
      if (res?.picUrl) {
        await fetchCoverUrl(res.picUrl);
      }
    } catch (e) {
      // console.error('获取签名URL失败:', e);
    }
  } catch (e) {
    if (e && e.toString().includes('401')) {
      errorMsg.value = '未登录，部分视频详情仅登录后可见';
    } else {
      errorMsg.value = '获取视频详情失败';
    }
  } finally {
    loading.value = false;
  }
}

const getVideoTypeList = async () => {
  try {
    const res = await FrontVideoTypeApi.getAllVideoTypes();
    videoTypeOptions.value = res.list || [];
  } catch (e) {
    if (e && e.toString().includes('401')) {
      errorMsg.value = '未登录，部分分类仅登录后可见';
    } else {
      errorMsg.value = '获取视频分类失败';
    }
  }
}

onMounted(async () => {
  // 设置防下载保护
  setupAntiDownloadProtection();
  // 获取数据
  await getVideoTypeList();
  if (videoId.value) getVideoDetail(videoId.value);
})

// 监听路由参数变化，自动刷新详情
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      videoId.value = Number(newId);
      getVideoDetail(videoId.value);
    }
  }
)
</script>

<template>
  <div class="video-detail-page">
    <StocksHeader />

    <!-- 页面头部导航 -->
    <div class="page-breadcrumb">
      <div class="breadcrumb-container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item @click="$router.push('/stocks-front/home')">
            <i class="el-icon-house"></i>
            <span>首页</span>
          </el-breadcrumb-item>
          <el-breadcrumb-item @click="$router.push('/stocks-front/video')">
            <i class="el-icon-video-play"></i>
            <span>视频教学</span>
          </el-breadcrumb-item>
          <el-breadcrumb-item>
            <span>{{ videoData?.title || '视频详情' }}</span>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
    </div>

    <div class="video-detail-container">
      <template v-if="loading">
        <div class="loading-container">
          <div class="loading-player"></div>
          <div class="loading-content">
            <el-skeleton :rows="3" animated />
            <el-skeleton :rows="2" animated />
          </div>
        </div>
      </template>
      <template v-else-if="errorMsg">
        <div class="error-container">
          <div class="error-card">
            <i class="el-icon-warning-outline"></i>
            <h3>{{ errorMsg }}</h3>
            <p>请检查网络连接或稍后重试</p>
            <el-button type="primary" @click="$router.push('/stocks-front/home')">
              <i class="el-icon-back"></i>
              返回首页
            </el-button>
          </div>
        </div>
      </template>
      <template v-else-if="videoData">
        <div class="video-content-layout">
          <!-- 左侧主区域 -->
          <div class="video-main-content">
            <!-- 视频播放器 -->
            <div class="video-player-section">
              <div class="player-container">
                <!-- 使用普通HTML5视频元素 -->
                <video
                  v-if="currentVideoUrl"
                  ref="videoElement"
                  class="main-video-player"
                  :src="currentVideoUrl"
                  :poster="coverUrl"
                  controls
                  preload="auto"
                  controlsList="nodownload"
                  disablePictureInPicture
                  @timeupdate="handleTimeUpdate"
                  @error="handleVideoError"
                  @loadeddata="handleVideoLoaded"
                  @contextmenu.prevent
                ></video>
                <el-image v-else :src="coverUrl" class="main-video-cover" fit="cover" @contextmenu.prevent />

                <!-- 自定义全屏按钮 -->
                <div class="custom-video-controls" v-if="currentVideoUrl && !trialEnded">
                  <div class="fullscreen-button" @click="toggleFullScreen">
                    <i :class="isFullScreen ? 'el-icon-close' : 'el-icon-full-screen'"></i>
                  </div>
                </div>

                <!-- 防止复制视频URL的遮罩层 -->
                <div class="video-protection-overlay" @contextmenu.prevent></div>

                <!-- 试看结束遮罩 -->
                <div v-if="trialEnded" class="trial-ended-overlay">
                  <div class="trial-ended-content">
                    <div class="trial-icon">
                      <i class="el-icon-lock"></i>
                    </div>
                    <h3>试看时间已结束</h3>
                    <p>升级为VIP会员，解锁完整视频内容</p>
                    <div class="trial-ended-buttons">
                      <el-button type="primary" size="large" @click="$router.push('/stocks-front/vip_upgrade')">
                        <i class="el-icon-crown"></i>
                        <span>立即升级VIP</span>
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 视频信息区域 -->
            <div class="video-info-section">
              <div class="video-header">
                <h1 class="video-title">{{ videoData.title }}</h1>
                <div class="video-status-badge">
                  <el-tag v-if="!isVipUser && videoData.previewUrl" type="warning" effect="dark" size="large">
                    <i class="el-icon-view"></i>
                    预览版本
                  </el-tag>
                  <el-tag v-else-if="!isVipUser" type="warning" effect="dark" size="large">
                    <i class="el-icon-time"></i>
                    试看模式 ({{ previewDuration }}秒)
                  </el-tag>
                  <el-tag v-else type="success" effect="dark" size="large">
                    <i class="el-icon-check"></i>
                    VIP完整版本
                  </el-tag>
                </div>
              </div>

              <div class="video-meta-bar">
                <div class="meta-stats">
                  <div class="stat-item">
                    <i class="el-icon-view"></i>
                    <span>{{ videoData.view || 0 }} 次观看</span>
                  </div>
                  <div class="stat-item" v-if="typeName">
                    <i class="el-icon-folder"></i>
                    <span>{{ typeName }}</span>
                  </div>
                  <div class="stat-item">
                    <i class="el-icon-time"></i>
                    <span>{{ new Date().toLocaleDateString() }}</span>
                  </div>
                </div>

                <div class="action-buttons" v-if="!isVipUser">
                  <el-button type="primary" size="large" @click="$router.push('/stocks-front/vip_upgrade')">
                    <i class="el-icon-crown"></i>
                    <span>升级VIP解锁完整内容</span>
                  </el-button>
                </div>
              </div>

              <!-- 视频描述 -->
              <div class="video-description-section">
                <div class="description-header">
                  <h3 class="section-title">
                    <i class="el-icon-document"></i>
                    视频简介
                  </h3>
                  <div class="video-tags" v-if="videoData.tags">
                    <el-tag
                      v-for="(tag, index) in videoData.tags.split(',')"
                      :key="index"
                      size="small"
                      effect="plain"
                      class="tag-item"
                    >
                      {{ tag.trim() }}
                    </el-tag>
                  </div>
                </div>
                <div class="description-content">
                  <p v-if="videoData.description">{{ videoData.description }}</p>
                  <div v-else class="no-description">
                    <i class="el-icon-info"></i>
                    <span>暂无视频简介</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧推荐区域 -->
          <div class="video-sidebar">
            <div class="sidebar-card">
              <div class="sidebar-header">
                <h3 class="sidebar-title">
                  <i class="el-icon-video-play"></i>
                  相关推荐
                </h3>
              </div>

              <div class="related-videos-list">
                <div
                  v-for="item in videoData.relatedVideos"
                  :key="item.id"
                  class="related-video-item"
                  @click="$router.push(`/stocks-front/videodetail/${item.id}`)"
                >
                  <div class="related-thumbnail">
                    <el-image :src="item.picUrl" fit="cover" @contextmenu.prevent />
                    <div class="play-overlay">
                      <i class="el-icon-video-play"></i>
                    </div>
                    <div class="video-duration">05:30</div>
                  </div>
                  <div class="related-content">
                    <h4 class="related-title">{{ item.title }}</h4>
                    <div class="related-meta">
                      <span class="view-count">{{ item.view || 0 }} 次观看</span>
                      <span class="upload-time">2天前</span>
                    </div>
                  </div>
                </div>

                <!-- 如果没有相关视频，显示提示 -->
                <div v-if="!videoData.relatedVideos || videoData.relatedVideos.length === 0" class="no-related-content">
                  <div class="empty-state">
                    <i class="el-icon-video-camera-solid"></i>
                    <h4>暂无相关推荐</h4>
                    <p>系统正在为您寻找更多精彩内容</p>
                    <el-button type="primary" plain @click="$router.push('/stocks-front/video')">
                      浏览更多视频
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
$primary-color: #1a73e8;
$secondary-color: #34a853;
$text-color: #2c3e50;
$text-light: #5f6368;
$bg-color: #ffffff;
$bg-light: #f8f9fa;
$border-color: #e8eaed;
$shadow-light: 0 2px 8px rgba(0, 0, 0, 0.1);
$shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.15);

.video-detail-page {
  background: linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 100%);
  min-height: 100vh;
}

// 面包屑导航
.page-breadcrumb {
  background: white;
  border-bottom: 1px solid $border-color;
  padding: 16px 0;

  .breadcrumb-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }

  :deep(.el-breadcrumb) {
    font-size: 14px;

    .el-breadcrumb__item {
      .el-breadcrumb__inner {
        display: flex;
        align-items: center;
        gap: 6px;
        color: $text-light;
        transition: color 0.3s ease;

        &:hover {
          color: $primary-color;
          cursor: pointer;
        }

        i {
          font-size: 16px;
        }
      }

      &:last-child .el-breadcrumb__inner {
        color: $text-color;
        font-weight: 500;
      }
    }
  }
}

.video-detail-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 20px 40px;
}

// 加载状态样式
.loading-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;

  .loading-player {
    aspect-ratio: 16/9;
    background: linear-gradient(90deg, #f0f2f5 25%, #f8f9fa 50%, #f0f2f5 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 16px;
  }

  .loading-content {
    background: white;
    padding: 24px;
    border-radius: 16px;
    box-shadow: $shadow-light;
  }
}

// 错误状态
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;

  .error-card {
    background: white;
    padding: 60px 40px;
    border-radius: 20px;
    box-shadow: $shadow-light;
    text-align: center;
    max-width: 500px;

    i {
      font-size: 64px;
      color: #ff6b6b;
      margin-bottom: 20px;
    }

    h3 {
      font-size: 24px;
      color: $text-color;
      margin: 0 0 12px 0;
      font-weight: 600;
    }

    p {
      color: $text-light;
      margin: 0 0 30px 0;
      font-size: 16px;
    }
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

// 主要布局
.video-content-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 30px;
}

// 左侧主内容区域
.video-main-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// 视频播放器区域
.video-player-section {
  .player-container {
    position: relative;
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    background: #000;
    box-shadow: $shadow-hover;
    border: 1px solid $border-color;
  }
}

.main-video-player {
  width: 100%;
  aspect-ratio: 16/9;
  display: block;
  user-select: none;
  -webkit-user-select: none;
}

.main-video-cover {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: cover;
  user-select: none;
  -webkit-user-select: none;
}

// 自定义视频控制
.custom-video-controls {
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.3s;
  
  .fullscreen-button {
    width: 40px;
    height: 40px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    
    i {
      font-size: 20px;
    }
    
    &:hover {
      background: rgba(0, 0, 0, 0.8);
    }
  }
}

.video-container:hover .custom-video-controls {
  opacity: 1;
}

// 防止复制视频URL的遮罩层
.video-protection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  pointer-events: none;
}

// 试看结束遮罩
.trial-ended-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;

  .trial-ended-content {
    text-align: center;
    color: white;
    padding: 50px 40px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 20px;
    backdrop-filter: blur(10px);
    max-width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);

    .trial-icon {
      width: 80px;
      height: 80px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;

      i {
        font-size: 40px;
        color: white;
      }
    }

    h3 {
      font-size: 28px;
      margin: 0 0 16px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    p {
      font-size: 18px;
      margin: 0 0 32px;
      opacity: 0.95;
      line-height: 1.5;
    }

    .trial-ended-buttons {
      display: flex;
      justify-content: center;

      .el-button {
        padding: 16px 32px;
        font-size: 16px;
        font-weight: 600;
        border-radius: 25px;

        i {
          margin-right: 8px;
          font-size: 18px;
        }
      }
    }
  }
}

// 视频信息区域
.video-info-section {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: $shadow-light;
  border: 1px solid $border-color;
}

.video-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  gap: 20px;

  .video-title {
    font-size: 24px;
    font-weight: 700;
    color: $text-color;
    margin: 0;
    line-height: 1.3;
    flex: 1;
  }

  .video-status-badge {
    flex-shrink: 0;

    .el-tag {
      padding: 8px 16px;
      font-weight: 600;

      i {
        margin-right: 6px;
      }
    }
  }
}

.video-meta-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-top: 1px solid $border-color;
  border-bottom: 1px solid $border-color;
  margin-bottom: 24px;

  .meta-stats {
    display: flex;
    align-items: center;
    gap: 24px;

    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: $text-light;
      font-size: 14px;

      i {
        font-size: 16px;
        color: $primary-color;
      }
    }
  }

  .action-buttons {
    .el-button {
      padding: 12px 24px;
      font-weight: 600;
      border-radius: 25px;

      i {
        margin-right: 8px;
      }
    }
  }
}

// 视频描述区域
.video-description-section {
  background: $bg-light;
  border-radius: 12px;
  padding: 24px;

  .description-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 16px;

    .section-title {
      font-weight: 600;
      font-size: 18px;
      color: $text-color;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: $primary-color;
        font-size: 20px;
      }
    }
  }

  .description-content {
    color: $text-color;
    font-size: 15px;
    line-height: 1.6;

    p {
      margin: 0;
    }

    .no-description {
      display: flex;
      align-items: center;
      gap: 8px;
      color: $text-light;
      font-style: italic;

      i {
        font-size: 16px;
      }
    }
  }
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .tag-item {
    margin: 0;
    border-radius: 20px;
    border: 1px solid $border-color;
    background: white;

    &:hover {
      border-color: $primary-color;
      color: $primary-color;
    }
  }
}

// 右侧推荐区域
.video-sidebar {
  .sidebar-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: $shadow-light;
    border: 1px solid $border-color;

    .sidebar-header {
      margin-bottom: 20px;

      .sidebar-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0;
        color: $text-color;
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          color: $primary-color;
          font-size: 22px;
        }
      }
    }
  }
}

.related-videos-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.related-video-item {
  display: flex;
  gap: 12px;
  cursor: pointer;
  padding: 12px;
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    background: $bg-light;
    transform: translateY(-2px);

    .related-thumbnail {
      :deep(.el-image img) {
        transform: scale(1.05);
      }

      .play-overlay {
        opacity: 1;
      }
    }

    .related-title {
      color: $primary-color;
    }
  }
}

.related-thumbnail {
  position: relative;
  width: 140px;
  height: 78px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;

  :deep(.el-image) {
    width: 100%;
    height: 100%;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
  }

  .play-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;

    i {
      font-size: 24px;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }
  }

  .video-duration {
    position: absolute;
    bottom: 6px;
    right: 6px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
}

.related-content {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 0;
  justify-content: center;
}

.related-title {
  font-size: 14px;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 8px;
  transition: color 0.3s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
}

.related-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: $text-light;

  .view-count, .upload-time {
    display: block;
  }
}

.no-related-content {
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;

    i {
      font-size: 48px;
      color: $text-light;
      margin-bottom: 16px;
      opacity: 0.7;
    }

    h4 {
      font-size: 18px;
      color: $text-color;
      margin: 0 0 8px 0;
      font-weight: 600;
    }

    p {
      color: $text-light;
      margin: 0 0 20px 0;
      font-size: 14px;
    }
  }
}

// 响应式调整
@media (max-width: 1200px) {
  .video-detail-container {
    padding: 20px 16px 40px;
  }

  .video-content-layout {
    gap: 20px;
  }
}

@media (max-width: 992px) {
  .video-content-layout {
    grid-template-columns: 1fr;
  }

  .loading-container {
    grid-template-columns: 1fr;
  }

  .video-sidebar {
    .sidebar-card {
      margin-top: 0;
    }
  }
}

@media (max-width: 768px) {
  .page-breadcrumb {
    .breadcrumb-container {
      padding: 0 16px;
    }
  }

  .video-detail-container {
    padding: 20px 12px 30px;
  }

  .video-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;

    .video-title {
      font-size: 20px;
    }
  }

  .video-meta-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;

    .meta-stats {
      flex-wrap: wrap;
      gap: 16px;
    }

    .action-buttons {
      width: 100%;

      .el-button {
        width: 100%;
        justify-content: center;
      }
    }
  }

  .related-video-item {
    .related-thumbnail {
      width: 120px;
      height: 67px;
    }
  }

  .description-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .trial-ended-overlay {
    .trial-ended-content {
      padding: 30px 20px;
      margin: 0 16px;

      h3 {
        font-size: 22px;
      }

      p {
        font-size: 16px;
      }
    }
  }
}

@media (max-width: 576px) {
  .video-info-section {
    padding: 20px;
  }

  .video-description-section {
    padding: 16px;
  }

  .video-sidebar .sidebar-card {
    padding: 16px;
  }

  .related-video-item {
    padding: 8px;

    .related-thumbnail {
      width: 100px;
      height: 56px;
    }

    .related-title {
      font-size: 13px;
    }

    .related-meta {
      font-size: 11px;
    }
  }
}
</style>

