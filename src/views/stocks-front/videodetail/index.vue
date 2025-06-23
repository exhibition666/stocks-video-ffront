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
const isDev = ref(process.env.NODE_ENV === 'development')

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
  
  // 组件卸载时移除事件监听器
  onBeforeUnmount(() => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('dragstart', handleDragStart);
  });
};

// 判断是否VIP
const isVipUser = computed(() => {
  const levelName = userStore.user?.level?.name || ''
  const isVip = levelName.includes('VIP') || levelName.includes('vip')
  console.log('当前用户等级:', levelName, '是否VIP:', isVip)
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
  console.log('视频加载成功');
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
    
    console.log('视频详情:', {
      videoData: videoData.value,
      fullVideoUrl: fullVideoUrl.value,
      previewVideoUrl: previewVideoUrl.value,
      coverUrl: coverUrl.value,
      previewLimit: previewDuration.value
    });
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
  console.log('组件已挂载');
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
    <div class="video-detail-content">
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
        <div class="video-player-card">
          <h2 class="video-title">{{ videoData.title }}</h2>
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
                controlsList="nodownload nofullscreen"
                disablePictureInPicture
                @timeupdate="handleTimeUpdate"
                @error="handleVideoError"
                @loadeddata="handleVideoLoaded"
                @contextmenu.prevent
              ></video>
              <el-image v-else :src="coverUrl" class="main-video-cover" fit="cover" @contextmenu.prevent />
              
              <!-- 视频播放状态标签 -->
              <div class="video-status-tags">
                <el-tag v-if="!isVipUser && videoData.previewUrl" type="warning" effect="dark" size="large">
                  预览版本
                </el-tag>
                <el-tag v-else-if="!isVipUser" type="warning" effect="dark" size="large">
                  试看模式 ({{ previewDuration }}秒)
                </el-tag>
                <el-tag v-else type="success" effect="dark" size="large">
                  <i class="el-icon-video-play"></i> VIP完整版本
                </el-tag>
              </div>
              
              <!-- 防止复制视频URL的遮罩层 -->
              <div class="video-protection-overlay" @contextmenu.prevent></div>
              
              <!-- 试看提示遮罩 -->
              <div v-if="!isVipUser && !trialEnded" class="preview-overlay">
                <div class="preview-info">
                  <i class="el-icon-lock"></i>
                  <span v-if="videoData.previewUrl">预览版本</span>
                  <span v-else>试看 {{ previewDuration }}秒</span>
                </div>
              </div>
              
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
          
          <!-- 播放器调试信息 -->
          <div v-if="isDev" class="debug-info">
            <p>播放器状态: {{ playerReady ? '已就绪' : '未就绪' }}</p>
            <p>视频URL: {{ currentVideoUrl || '未加载' }}</p>
            <p>用户VIP状态: {{ isVipUser ? 'VIP用户' : '普通用户' }}</p>
            <p>试看结束: {{ trialEnded ? '是' : '否' }}</p>
          </div>
        </div>
        
        <!-- 视频信息卡片 -->
        <div class="video-info-card">
          <div class="video-meta-row">
            <div class="meta-item">
              <i class="el-icon-folder"></i>
              <span class="video-meta-label">分类：</span>
              <el-tag size="small" effect="plain" type="info">{{ typeName }}</el-tag>
            </div>
            <div class="meta-item">
              <i class="el-icon-view"></i>
              <span class="video-meta-label">观看数：</span>
              <span class="meta-value">{{ videoData.view || 0 }}</span>
            </div>
            <div class="meta-item">
              <span class="video-meta-label">状态：</span>
              <el-tag v-if="videoData.status === 1" type="success" size="small">已上架</el-tag>
              <el-tag v-else type="info" size="small">已下架</el-tag>
            </div>
            <div v-if="!isVipUser" class="vip-notice">
              <el-button type="danger" size="default" @click="$router.push('/stocks-front/vip_upgrade')">
                <i class="el-icon-crown"></i> 升级VIP观看完整内容
              </el-button>
            </div>
          </div>
          
          <el-divider>
            <i class="el-icon-info"></i> 视频简介
          </el-divider>
          
          <div class="video-desc">
            <p v-if="videoData.description">{{ videoData.description }}</p>
            <p v-else class="no-desc">暂无视频简介</p>
          </div>
          
          <!-- 推荐标签 -->
          <div v-if="videoData.tags" class="video-tags">
            <span class="tags-label">标签：</span>
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
        
        <!-- 相关推荐 -->
        <div v-if="videoData.relatedVideos && videoData.relatedVideos.length" class="related-videos">
          <h3 class="section-title">相关推荐</h3>
          <div class="related-list">
            <div 
              v-for="item in videoData.relatedVideos" 
              :key="item.id" 
              class="related-item"
              @click="$router.push(`/stocks-front/videodetail/${item.id}`)"
            >
              <div class="related-cover-wrapper">
                <el-image :src="item.picUrl" class="related-cover" fit="cover" @contextmenu.prevent />
                <div class="play-icon-overlay">
                  <i class="el-icon-video-play"></i>
                </div>
              </div>
              <div class="related-info">
                <div class="related-title">{{ item.title }}</div>
                <div class="related-views">{{ item.view || 0 }}次观看</div>
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
  max-width: 1000px;
  margin: 20px auto 60px auto;
  padding: 0 20px;
}

.video-detail-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  padding: 30px;
}

// 加载状态样式
.loading-container {
  padding: 20px 0;
  
  .skeleton-player {
    height: 400px;
    background: #f5f7fa;
    border-radius: 8px;
    margin: 20px 0;
  }
}

// 视频播放器卡片
.video-player-card {
  margin-bottom: 30px;
}

.video-title {
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  -webkit-background-clip: text;
  color: transparent;
  padding: 0 20px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.video-player-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.video-container {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.main-video-player {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 12px;
  display: block;
  user-select: none;
  -webkit-user-select: none;
}

.main-video-cover {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 12px;
  object-fit: cover;
  user-select: none;
  -webkit-user-select: none;
}

.video-status-tags {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
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

// 试看提示遮罩
.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.7) 100%);
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
  
  .preview-info {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    
    i {
      font-size: 16px;
      color: #fc5c7d;
    }
  }
  
  &:hover {
    opacity: 1;
  }
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

// 调试信息
.debug-info {
  margin-top: 16px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
  border-left: 4px solid #409eff;
  
  p {
    margin: 4px 0;
  }
}

// 视频信息卡片
.video-info-card {
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid #ebeef5;
}

.video-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  margin-bottom: 20px;
}

.meta-item {
  display: flex;
  align-items: center;
  font-size: 14px;
  
  i {
    margin-right: 4px;
    color: #909399;
  }
}

.video-meta-label {
  color: #606266;
  margin-right: 6px;
  font-weight: 500;
}

.meta-value {
  color: #303133;
  font-weight: 500;
}

.vip-notice {
  margin-left: auto;
}

.video-desc {
  font-size: 15px;
  line-height: 1.8;
  color: #303133;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border-left: 4px solid #6a82fb;
  margin-bottom: 20px;
  
  .no-desc {
    color: #909399;
    font-style: italic;
  }
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 16px;
  
  .tags-label {
    color: #606266;
    margin-right: 8px;
    font-size: 14px;
  }
  
  .tag-item {
    margin-right: 8px;
    margin-bottom: 8px;
  }
}

// 相关推荐
.related-videos {
  margin-top: 40px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
  position: relative;
  padding-left: 12px;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    background: linear-gradient(to bottom, #6a82fb, #fc5c7d);
    border-radius: 2px;
  }
}

.related-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.related-item {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    
    .play-icon-overlay {
      opacity: 1;
    }
  }
}

.related-cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
}

.related-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
  
  &:hover {
    transform: scale(1.05);
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
    font-size: 48px;
    color: #fff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }
}

.related-info {
  padding: 12px;
  background: #f8fafc;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

.related-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.related-views {
  font-size: 12px;
  color: #909399;
}

// 响应式调整
@media (max-width: 768px) {
  .video-detail-content {
    padding: 20px;
  }
  
  .video-title {
    font-size: 22px;
  }
  
  .video-meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .vip-notice {
    margin-left: 0;
    margin-top: 12px;
    width: 100%;
    
    .el-button {
      width: 100%;
    }
  }
  
  .related-list {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 15px;
  }
}
</style>
