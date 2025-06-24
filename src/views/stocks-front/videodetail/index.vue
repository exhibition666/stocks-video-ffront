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
  console.error('视频加载失败');
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
      console.error('获取签名URL失败:', e);
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
    <div class="video-detail-container">
      <template v-if="loading">
        <div class="loading-container">
          <el-skeleton :rows="6" animated />
          <div class="skeleton-player"></div>
          <el-skeleton :rows="3" animated />
        </div>
      </template>
      <template v-else-if="errorMsg">
        <el-result icon="error" :title="errorMsg">
          <template #extra>
            <el-button type="primary" @click="$router.push('/stocks-front/home')">返回首页</el-button>
          </template>
        </el-result>
      </template>
      <template v-else-if="videoData">
        <div class="video-content-layout">
          <!-- 左侧主区域 -->
          <div class="video-main-content">
            <!-- 视频播放器 -->
            <div class="video-player-wrap">
              <div class="video-container">
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
                    <i class="el-icon-lock"></i>
                    <h3>试看结束</h3>
                    <p>升级为VIP会员可观看完整内容</p>
                    <div class="trial-ended-buttons">
                      <el-button type="danger" @click="$router.push('/stocks-front/vip_upgrade')">
                        <i class="el-icon-crown"></i> 立即升级VIP
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 视频信息区域 -->
            <div class="video-info-section">
              <h1 class="video-title">{{ videoData.title }}</h1>
              
              <div class="video-meta-info">
                <div class="video-meta-left">
                  <div class="view-count">
                    <i class="el-icon-view"></i>
                    <span>{{ videoData.view || 0 }}次观看</span>
                  </div>
                  <div class="video-category">
                    <i class="el-icon-folder"></i>
                    <span>{{ typeName }}</span>
                  </div>
                </div>
                
                <div class="video-meta-right">
                  <div v-if="!isVipUser" class="vip-access-status">
                    <el-tag v-if="videoData.previewUrl" type="warning" effect="dark">预览版本</el-tag>
                    <el-tag v-else type="warning" effect="dark">试看模式 ({{ previewDuration }}秒)</el-tag>
                    <el-button type="danger" size="small" @click="$router.push('/stocks-front/vip_upgrade')">
                      升级VIP
                    </el-button>
                  </div>
                  <div v-else class="vip-access-status">
                    <el-tag type="success" effect="dark">VIP完整版本</el-tag>
                  </div>
                </div>
              </div>
              
              <!-- 视频描述 -->
              <div class="video-description-card">
                <div class="description-header">
                  <span class="description-title"><i class="el-icon-info"></i> 视频简介</span>
                  <div class="video-tags" v-if="videoData.tags">
                    <el-tag 
                      v-for="(tag, index) in videoData.tags.split(',')" 
                      :key="index" 
                      size="small" 
                      effect="light" 
                      class="tag-item"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </div>
                <div class="description-content">
                  <p v-if="videoData.description">{{ videoData.description }}</p>
                  <p v-else class="no-desc">暂无视频简介</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 右侧推荐区域 -->
          <div class="video-sidebar">
            <h3 class="sidebar-title">相关推荐</h3>
            <div class="related-videos-list">
              <div 
                v-for="item in videoData.relatedVideos" 
                :key="item.id" 
                class="related-video-item"
                @click="$router.push(`/stocks-front/videodetail/${item.id}`)"
              >
                <div class="related-thumbnail">
                  <el-image :src="item.picUrl" fit="cover" @contextmenu.prevent />
                  <div class="play-icon-overlay">
                    <i class="el-icon-video-play"></i>
                  </div>
                </div>
                <div class="related-info">
                  <div class="related-title">{{ item.title }}</div>
                  <div class="related-meta">{{ item.view || 0 }}次观看</div>
                </div>
              </div>
              
              <!-- 如果没有相关视频，显示提示 -->
              <div v-if="!videoData.relatedVideos || videoData.relatedVideos.length === 0" class="no-related">
                <i class="el-icon-video-camera"></i>
                <p>暂无相关推荐视频</p>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.video-detail-page {
  background-color: #f9f9f9;
  min-height: 100vh;
}

.video-detail-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 80px 16px 40px;
}

// 加载状态样式
.loading-container {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  
  .skeleton-player {
    height: 400px;
    background: #f5f7fa;
    border-radius: 8px;
    margin: 20px 0;
  }
}

// YouTube风格布局
.video-content-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
}

// 左侧主内容区域
.video-main-content {
  display: flex;
  flex-direction: column;
}

// 视频播放器
.video-player-wrap {
  width: 100%;
}

.video-container {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  background: rgba(0, 0, 0, 0.75);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .trial-ended-content {
    text-align: center;
    color: #fff;
    padding: 30px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 16px;
    backdrop-filter: blur(5px);
    max-width: 90%;
    
    i {
      font-size: 48px;
      color: #fc5c7d;
      margin-bottom: 16px;
    }
    
    h3 {
      font-size: 24px;
      margin: 0 0 12px;
      font-weight: 600;
    }

    p {
      font-size: 16px;
      margin: 0 0 24px;
      opacity: 0.9;
    }
    
    .trial-ended-buttons {
      display: flex;
      justify-content: center;
      gap: 16px;
    }
  }
}

// 视频信息区域
.video-info-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.video-title {
  font-size: 18px;
  font-weight: 600;
  color: #030303;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.video-meta-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e5e5;
}

.video-meta-left {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #606060;
  font-size: 14px;
  
  .view-count, .video-category {
    display: flex;
    align-items: center;
    gap: 6px;
    
    i {
      font-size: 16px;
    }
  }
}

.video-meta-right {
  .vip-access-status {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

// 视频描述卡片
.video-description-card {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  
  .description-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  .description-title {
    font-weight: 600;
    font-size: 16px;
    color: #030303;
    display: flex;
    align-items: center;
    gap: 6px;
    
    i {
      color: #606060;
    }
  }
  
  .description-content {
    color: #0f0f0f;
    font-size: 14px;
    line-height: 1.5;
    
    .no-desc {
      color: #909090;
      font-style: italic;
    }
  }
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  .tag-item {
    margin: 0;
  }
}

// 右侧推荐区域
.video-sidebar {
  .sidebar-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: #030303;
  }
}

.related-videos-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.related-video-item {
  display: flex;
  gap: 12px;
  cursor: pointer;
  
  &:hover {
    .related-thumbnail img {
      transform: scale(1.05);
    }
    
    .play-icon-overlay {
      opacity: 1;
    }
    
    .related-title {
      color: #065fd4;
    }
  }
}

.related-thumbnail {
  position: relative;
  width: 168px;
  height: 94px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
}

.play-icon-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  
  i {
    font-size: 28px;
    color: #fff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }
}

.related-info {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-width: 0;
}

.related-title {
  font-size: 14px;
  font-weight: 500;
  color: #0f0f0f;
  margin-bottom: 4px;
  transition: color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.related-meta {
  font-size: 12px;
  color: #606060;
}

.no-related {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  color: #606060;
  background: #f9f9f9;
  border-radius: 8px;
  text-align: center;
  
  i {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.7;
  }
  
  p {
    margin: 0;
  }
}

// 响应式调整
@media (max-width: 992px) {
  .video-content-layout {
    grid-template-columns: 1fr;
  }
  
  .video-sidebar {
    margin-top: 24px;
  }
}

@media (max-width: 768px) {
  .video-detail-container {
    padding: 80px 12px 30px;
  }
  
  .video-meta-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .video-meta-right {
    width: 100%;
    
    .vip-access-status {
      justify-content: space-between;
      width: 100%;
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
  }
}
</style>

