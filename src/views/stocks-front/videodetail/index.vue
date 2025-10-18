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
import { getAccessToken } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const videoId = ref(Number(route.params.id))
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID
const RELATED_OSS_CONFIG_ID = Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || Number(OSS_CONFIG_ID) || 32

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

// 新增：观看码校验
const showWatchcodeOverlay = ref(false)
const inputWatchcode = ref('')
const isWatchcodeVerified = ref(false)

// 新增：登录状态检查
const showLoginModal = ref(false)

// 是否需要观看码 - 修改逻辑：用户登录后，只有 isVipOnly=true 的视频才需要邀请码
const needWatchcode = computed(() => {
  if (!isUserLoggedIn.value) return false
  return videoData.value?.isVipOnly === true || videoData.value?.isVipOnly === 1
})

// 检查用户是否已登录
const isUserLoggedIn = computed(() => {
  return !!getAccessToken()
})

// 本地存储 key（按视频维度缓存已验证状态）
// 取消本地持久化验证状态，改为服务端校验记录

// 新增：服务端校验是否已验证过当前视频的邀请码（不再使用本地存储）
const checkServerWatchcodeStatus = async () => {
  try {
    const result = await FrontVideoApi.getWatchcodeExists(videoId.value)
    // 兼容直接返回布尔或 { code, data }
    const exists = (typeof result === 'boolean') ? result : (result?.data === true)
    isWatchcodeVerified.value = !!exists
  } catch (e) {
    isWatchcodeVerified.value = false
  }
}

const handleSubmitWatchcode = async () => {
  if (!inputWatchcode.value || inputWatchcode.value.trim().length === 0) {
    ElMessage.error('请输入观看邀请码')
    return
  }

  try {
    // 调用后端接口验证邀请码（本项目的 request 封装通常直接返回 data）
    const result = await FrontVideoApi.validateWatchcode(videoId.value, inputWatchcode.value.trim())

    // 兼容两种返回：直接返回 data 或 { code, data }
    const resp = (result && typeof result === 'object' && 'valid' in result) ? result : (result?.data || {})

    if (resp.valid === true) {
      // 验证成功
      isWatchcodeVerified.value = true
      showWatchcodeOverlay.value = false
      // 验证成功后，刷新一次服务端状态，确保后续不再要求输入
      await checkServerWatchcodeStatus()
      ElMessage.success(resp.message || '验证通过')
    } else {
      // 验证失败
      isWatchcodeVerified.value = false
      ElMessage.error(resp.message || '邀请码错误')
    }
  } catch (error) {
    console.error('验证邀请码失败:', error)
    ElMessage.error('验证失败，请稍后重试')
  }
}

const resetWatchcodeIfNeeded = () => {
  // 当更换视频时，重置输入框，但保留本地已验证状态（同视频有效）
  inputWatchcode.value = ''
}

// 新增：跳转到登录页面
const goToLogin = () => {
  showLoginModal.value = false
  router.push('/stocks-front/login')
}

// 新增：关闭登录提示
const closeLoginModal = () => {
  showLoginModal.value = false
  // 跳转回视频列表页面
  router.push('/stocks-front/video')
}

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

// 判断是否VIP - 暂时注销，所有用户都可观看完整视频
const isVipUser = computed(() => {
  // const levelName = userStore.user?.level?.name || ''
  // const isVip = levelName.includes('VIP') || levelName.includes('vip')
  // return isVip
  return true // 暂时让所有用户都视为VIP用户
})

// 试看时长（秒），暂时设为很大值让所有用户都能观看完整视频
const previewDuration = computed(() => {
  // return videoData.value?.previewLimit || 60
  return 999999 // 暂时设为很大值，让所有用户都能观看完整视频
})

// 当前要播放的视频URL - 暂时让所有用户都使用完整视频
const currentVideoUrl = computed(() => {
  // VIP用户使用完整视频URL，非VIP用户优先使用预览视频URL，如果没有则使用完整视频URL
  // if (isVipUser.value) {
  //   return fullVideoUrl.value;
  // } else {
  //   // 如果有专门的预览视频，则使用预览视频
  //   if (videoData.value?.previewUrl && previewVideoUrl.value) {
  //     return previewVideoUrl.value;
  //   } 
  //   // 否则使用完整视频，但在播放器中限制时长
  //   return fullVideoUrl.value;
  // }
  
  // 暂时让所有用户都使用完整视频
  return fullVideoUrl.value;
})

// 是否需要限制播放时长 - 暂时不需要限制，所有用户都能观看完整视频
const needLimitDuration = computed(() => {
  // 只有非VIP用户且使用完整视频时才需要限制时长
  // return !isVipUser.value && !videoData.value?.previewUrl && fullVideoUrl.value
  
  // 暂时不需要限制时长
  return false
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

// 获取相关推荐（同类型最多3条，排除当前视频）
const fetchRelatedVideos = async (typeId?: number, currentId?: number) => {
  try {
    if (!typeId) {
      videoData.value = { ...(videoData.value || {}), relatedVideos: [] }
      return
    }
    const params: any = { pageNo: 1, pageSize: 3, typeId }
    const res = await FrontVideoApi.getVideoList(params)
    const list = (res?.list || []).filter((v: any) => v.id !== currentId).slice(0, 3)
    await signRelatedCovers(list)
    videoData.value = { ...(videoData.value || {}), relatedVideos: list }
  } catch (e) {
    videoData.value = { ...(videoData.value || {}), relatedVideos: [] }
  }
}

// 获取签名封面图URL
const fetchSignedCover = async (path?: string) => {
  if (!path) return ''
  try {
    const url = await getAccessUrl(RELATED_OSS_CONFIG_ID, path)
    return (url as any).accessUrl || (typeof url === 'string' ? url : '')
  } catch (e) {
    return ''
  }
}

// 为相关推荐批量签名封面图
const signRelatedCovers = async (list: any[]) => {
  if (!Array.isArray(list) || list.length === 0) return
  const tasks = list.map(async (item) => {
    const signed = await fetchSignedCover(item.picUrl)
    if (signed) item.picUrl = signed
  })
  await Promise.all(tasks)
}

const getVideoDetail = async (id: number) => {
  loading.value = true;
  errorMsg.value = '';
  trialEnded.value = false;
  showUpgradeOverlay.value = false;
  
  try {
    const res = await FrontVideoApi.getVideoDetail(id);
    videoData.value = res;
    
    // 新增：检查登录状态，未登录则显示登录提示
    if (!isUserLoggedIn.value) {
      showLoginModal.value = true
      loading.value = false
      return
    }
    
    if (videoTypeOptions.value.length && res?.typeId) {
      const type = videoTypeOptions.value.find(t => t.id === res.typeId);
      typeName.value = type ? type.name : '';
    }
    
    // 加载相关推荐（同类型最多3条）
    await fetchRelatedVideos(res?.typeId, res?.id)
    
    // 初始化观看码校验状态 - 使用 nextTick 确保计算属性已更新
    await nextTick()
    await checkServerWatchcodeStatus()
    
    // 调试信息
    console.log('视频数据:', {
      id: res?.id,
      title: res?.title,
      isVipOnly: res?.isVipOnly,
      needWatchcode: needWatchcode.value,
      isWatchcodeVerified: isWatchcodeVerified.value
    })
    
    if (needWatchcode.value && !isWatchcodeVerified.value) {
      console.log('显示邀请码输入框')
      showWatchcodeOverlay.value = true
    } else {
      console.log('隐藏邀请码输入框')
      showWatchcodeOverlay.value = false
    }
    resetWatchcodeIfNeeded()
    
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

// 新增：监听视频数据变化，重新评估邀请码状态
watch(
  () => videoData.value,
  async (newVideoData) => {
    if (newVideoData && isUserLoggedIn.value) {
      // 等待计算属性更新
      await nextTick()
      
      // 重新检查邀请码状态
      if (needWatchcode.value && !isWatchcodeVerified.value) {
        console.log('视频数据变化后显示邀请码输入框', {
          isVipOnly: newVideoData?.isVipOnly,
          needWatchcode: needWatchcode.value,
          isWatchcodeVerified: isWatchcodeVerified.value
        })
        showWatchcodeOverlay.value = true
      } else {
        console.log('视频数据变化后隐藏邀请码输入框', {
          isVipOnly: newVideoData?.isVipOnly,
          needWatchcode: needWatchcode.value,
          isWatchcodeVerified: isWatchcodeVerified.value
        })
        showWatchcodeOverlay.value = false
      }
    }
  },
  { deep: true }
)

// 生成自定义视频ID的方法
const generateCustomVideoId = () => {
  const currentVideoId = videoData.value?.id || 'unknown'
  const userId = userStore.user?.id || 'guest'
  const randomNum = Math.floor(1000 + Math.random() * 9000) // 生成4位随机数字
  return `${currentVideoId}_${userId}_${randomNum}`
}

// 复制验证码内容的方法
const copyVerificationText = async () => {
  const customVideoId = generateCustomVideoId()
  const text = `视频名称：${videoData.value?.title || '未知'}，视频ID：${customVideoId}`

  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 使用现代的 Clipboard API
      await navigator.clipboard.writeText(text)
    } else {
      // 降级方案：使用传统的 document.execCommand
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
    }

    ElMessage.success('复制成功！请发送给公众号获取验证码')
  } catch (err) {
    console.error('复制失败:', err)
    ElMessage.error('复制失败，请手动复制内容')
  }
}
</script>

<template>
  <div class="video-detail-page">
    <StocksHeader />

    <div class="page-breadcrumb">
      <div class="breadcrumb-container">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item @click="$router.push('/stocks-front/home')">
            <i class="el-icon-house"></i>
            <span>首页</span>
          </el-breadcrumb-item>
          <el-breadcrumb-item @click="$router.push('/stocks-front/video')">
            <i class="el-icon-video-camera"></i>
            <span>视频</span>
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
              <!-- 新增：登录提示模态框 -->
              <div v-if="showLoginModal" class="login-modal-overlay">
                <div class="login-modal-card">
                  <div class="login-modal-icon">
                    <div class="icon-wrapper">
                      <i class="el-icon-lock"></i>
                    </div>
                    <div class="icon-glow"></div>
                  </div>
                  <div class="login-modal-content">
                    <h2>登录后观看</h2>
                    <p>此视频需要登录后才能观看，请先登录您的账户</p>
                    <div class="login-modal-actions">
                      <el-button type="primary" size="large" @click="goToLogin" class="primary-btn">
                        <i class="el-icon-user"></i>
                        立即登录
                      </el-button>
                      <el-button type="default" size="large" @click="closeLoginModal" class="secondary-btn">
                        <i class="el-icon-close"></i>
                        稍后再说
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="player-container">
                <!-- 观看码遮罩：需要邀请码且未通过验证时显示 - 全屏模态框 -->
                <div v-if="needWatchcode && !isWatchcodeVerified" class="watchcode-fullscreen-overlay">
                  <div class="watchcode-fullscreen-content" @contextmenu.prevent>
                    <div class="watchcode-main-section">
                      <div class="watchcode-left-panel">
                        <div class="watchcode-icon">
                          <i class="el-icon-lock"></i>
                        </div>
                        <h2>VIP视频需要邀请码</h2>
                        <p class="watchcode-description">此视频为VIP专属内容，请输入正确的邀请码后观看</p>

                        <div class="watchcode-input-section">
                          <el-input
                            v-model="inputWatchcode"
                            placeholder="请输入邀请码"
                            size="large"
                            clearable
                            @keyup.enter="handleSubmitWatchcode"
                          />
                          <el-button type="primary" size="large" @click="handleSubmitWatchcode" class="submit-btn">
                            <i class="el-icon-unlock"></i>
                            确认观看
                          </el-button>
                        </div>
                      </div>

                      <div class="watchcode-right-panel">
                        <div class="qrcode-section">
                          <h3>获取邀请码</h3>
                          <p class="qrcode-tip">关注公众号获取最新邀请码</p>
                          <div class="qrcode-container">
                            <img src="/gongzonghao.jpg" alt="公众号二维码" class="qrcode-image" />
                          </div>
                          <p class="qrcode-instruction">扫描二维码关注公众号</p>
                          <div class="verification-message">
                            <p class="verification-text">关注后发送以下内容获取验证码</p>
                            <div class="verification-content">
                              <span class="content-text">视频名称：{{ videoData?.title || '未知' }}<br/>视频ID：{{ generateCustomVideoId() }}</span>
                            </div>
                            <div class="copy-button-container">
                              <button class="copy-btn" @click="copyVerificationText">
                                <i class="el-icon-document-copy"></i>
                                复制内容
                              </button>
                            </div>
                          </div>
                          <div class="qrcode-features">
                            <div class="feature-item">
                              <i class="el-icon-check"></i>
                              <span>获取最新邀请码</span>
                            </div>
                            <div class="feature-item">
                              <i class="el-icon-check"></i>
                              <span>第一时间获取新视频通知</span>
                            </div>
                            <div class="feature-item">
                              <i class="el-icon-check"></i>
                              <span>专属投资策略分享</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="watchcode-close-btn" @click="$router.push('/stocks-front/video')">
                      <span>关闭</span>
                    </div>
                  </div>
                </div>

                <!-- 使用普通HTML5视频元素 -->
                <video
                  v-if="currentVideoUrl && (!needWatchcode || isWatchcodeVerified)"
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
                <div class="custom-video-controls" v-if="currentVideoUrl && !trialEnded && (!needWatchcode || isWatchcodeVerified)">
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
                  <!-- 暂时让所有用户都显示为VIP完整版本 -->
                  <el-tag type="success" effect="dark" size="large">
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
    
    <!-- ICP备案信息 -->
    <IcpFooter />
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

// 新增：观看码模态框样式（非全屏）
.watchcode-fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
}

.watchcode-fullscreen-content {
  position: relative;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.watchcode-main-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 100%;
}

.watchcode-left-panel {
  padding: 40px 30px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 100%);

  .watchcode-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    box-shadow: 0 10px 20px rgba(26, 115, 232, 0.3);

    i {
      font-size: 32px;
    }
  }

  h2 {
    font-size: 24px;
    font-weight: 700;
    color: $text-color;
    margin: 0 0 12px 0;
    line-height: 1.2;
  }

  .watchcode-description {
    font-size: 14px;
    color: $text-light;
    margin: 0 0 24px 0;
    line-height: 1.6;
    max-width: 300px;
  }

  .watchcode-input-section {
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 16px;

    :deep(.el-input) {
      .el-input__wrapper {
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border: 2px solid transparent;
        transition: all 0.3s ease;

        &:hover, &.is-focus {
          border-color: $primary-color;
          box-shadow: 0 2px 12px rgba(26, 115, 232, 0.2);
        }
      }
    }

    .submit-btn {
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 8px;
      background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
      border: none;
      box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3);
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(26, 115, 232, 0.4);
      }

      i {
        margin-right: 6px;
        font-size: 14px;
      }
    }
  }
}

.watchcode-right-panel {
  padding: 40px 30px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  border-left: 1px solid rgba(0, 0, 0, 0.1);

  .qrcode-section {
    width: 100%;
    max-width: 280px;

    h3 {
      font-size: 20px;
      font-weight: 700;
      color: $text-color;
      margin: 0 0 8px 0;
    }

    .qrcode-tip {
      font-size: 14px;
      color: $text-light;
      margin: 0 0 20px 0;
    }

    .qrcode-container {
      width: 160px;
      height: 160px;
      margin: 0 auto 16px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
      border: 3px solid white;

      .qrcode-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    }

    .qrcode-instruction {
      font-size: 12px;
      color: $text-light;
      margin: 0 0 16px 0;
      font-weight: 500;
    }

    .verification-message {
      margin: 0 0 20px 0;
      padding: 12px;
      background: rgba(26, 115, 232, 0.08);
      border-radius: 8px;
      border-left: 3px solid $primary-color;

      .verification-text {
        font-size: 12px;
        color: $text-color;
        margin: 0 0 8px 0;
        font-weight: 600;
      }

      .verification-content {
        background: rgba(255, 255, 255, 0.8);
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid rgba(26, 115, 232, 0.2);

        .content-text {
          font-size: 11px;
          color: $text-color;
          font-weight: 500;
          word-break: break-all;
          line-height: 1.4;
        }
      }

      .copy-button-container {
        margin-top: 8px;
        text-align: center;

        .copy-btn {
          background: linear-gradient(135deg, #1a73e8, #4285f4);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);

          &:hover {
            background: linear-gradient(135deg, #1557b0, #3367d6);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(26, 115, 232, 0.4);
          }

          &:active {
            transform: translateY(0);
            box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
          }

          i {
            font-size: 12px;
          }
        }
      }
    }

    .qrcode-features {
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: left;

      .feature-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(26, 115, 232, 0.05);
        border-radius: 8px;
        border-left: 3px solid $primary-color;

        i {
          color: $secondary-color;
          font-size: 14px;
          font-weight: bold;
        }

        span {
          color: $text-color;
          font-size: 12px;
          font-weight: 500;
        }
      }
    }
  }
}

.watchcode-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  border: none;

  &:hover {
    background: rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  span {
    font-size: 14px;
    color: $text-color;
    font-weight: 500;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .watchcode-fullscreen-content {
    width: 95%;
    max-width: none;
    max-height: 85vh;
  }

  .watchcode-main-section {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }

  .watchcode-left-panel {
    padding: 30px 20px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);

    .watchcode-icon {
      width: 60px;
      height: 60px;
      margin-bottom: 16px;

      i {
        font-size: 24px;
      }
    }

    h2 {
      font-size: 20px;
      margin-bottom: 8px;
    }

    .watchcode-description {
      font-size: 13px;
      margin-bottom: 20px;
    }

    .watchcode-input-section {
      max-width: 280px;
    }
  }

  .watchcode-right-panel {
    padding: 30px 20px;
    border-left: none;

    .qrcode-section {
      max-width: 240px;

      h3 {
        font-size: 18px;
      }

      .qrcode-container {
        width: 120px;
        height: 120px;
      }

      .verification-message {
        margin: 0 0 16px 0;
        padding: 10px;

        .verification-text {
          font-size: 11px;
        }

        .verification-content {
          padding: 6px 8px;

          .content-text {
            font-size: 10px;
          }
        }

        .copy-button-container {
          margin-top: 6px;

          .copy-btn {
            padding: 6px 12px;
            font-size: 10px;
            border-radius: 16px;

            i {
              font-size: 10px;
            }
          }
        }
      }

      .qrcode-features .feature-item {
        padding: 6px 10px;
        gap: 6px;

        span {
          font-size: 11px;
        }
      }
    }
  }
}

// 新增：登录提示模态框样式
.login-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.login-modal-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 24px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95));
  border-radius: 24px;
  padding: 40px 30px;
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  max-width: 480px;
  width: 90%;
  backdrop-filter: blur(20px);
  animation: slideUp 0.4s ease-out;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #1a73e8, #4285f4, #34a853, #fbbc04, #ea4335);
    border-radius: 24px 24px 0 0;
  }
}

.login-modal-icon {
  position: relative;
  margin-bottom: 8px;

  .icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a73e8, #4285f4);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 8px 32px rgba(26, 115, 232, 0.3),
      0 0 0 4px rgba(26, 115, 232, 0.1);
    animation: pulse 2s infinite;
    position: relative;
    z-index: 2;

    i {
      font-size: 32px;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
  }

  .icon-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(26, 115, 232, 0.2) 0%, transparent 70%);
    animation: pulse 2s infinite;
    z-index: 1;
  }
}

.login-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(0, 0, 0, 0.2);
    transform: scale(1.1);
  }

  i {
    font-size: 14px;
    color: #666;
  }
}

.login-modal-content {
  flex-grow: 1;
  text-align: center;
  width: 100%;

  h2 {
    font-size: 28px;
    font-weight: 700;
    color: $text-color;
    margin-bottom: 12px;
    line-height: 1.2;
    background: linear-gradient(135deg, #1a73e8, #4285f4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  p {
    font-size: 16px;
    color: $text-light;
    margin-bottom: 32px;
    line-height: 1.6;
    opacity: 0.8;
  }

  .login-modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;

    .primary-btn {
      background: linear-gradient(135deg, #1a73e8, #4285f4);
      border: none;
      padding: 14px 28px;
      font-weight: 600;
      border-radius: 25px;
      box-shadow: 0 4px 16px rgba(26, 115, 232, 0.3);
      transition: all 0.3s ease;

      &:hover {
        background: linear-gradient(135deg, #1557b0, #3367d6);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(26, 115, 232, 0.4);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        margin-right: 8px;
        font-size: 16px;
      }
    }

    .secondary-btn {
      background: rgba(255, 255, 255, 0.8);
      border: 2px solid rgba(0, 0, 0, 0.1);
      color: #666;
      padding: 12px 28px;
      font-weight: 500;
      border-radius: 25px;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.9);
        border-color: rgba(0, 0, 0, 0.2);
        color: #333;
        transform: translateY(-1px);
      }

      i {
        margin-right: 8px;
        font-size: 16px;
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

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

  // 新增：登录模态框移动端适配
  .login-modal-card {
    padding: 32px 24px;
    gap: 20px;
    margin: 20px;
    border-radius: 20px;

    .login-modal-icon {
      .icon-wrapper {
        width: 64px;
        height: 64px;

        i {
          font-size: 24px;
        }
      }

      .icon-glow {
        width: 96px;
        height: 96px;
      }
    }

    .login-modal-content {
      h2 {
        font-size: 24px;
      }

      p {
        font-size: 14px;
        margin-bottom: 24px;
      }

      .login-modal-actions {
        flex-direction: column;
        gap: 12px;

        .primary-btn,
        .secondary-btn {
          width: 100%;
          padding: 12px 24px;
        }
      }
    }

    .login-modal-close {
      width: 28px;
      height: 28px;
      top: 12px;
      right: 12px;

      i {
        font-size: 12px;
      }
    }
  }

  // 新增：观看码全屏模态框移动端适配
  .watchcode-fullscreen-content {
    width: 95%;
    height: 95%;
    border-radius: 16px;
  }

  .watchcode-main-section {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .watchcode-left-panel {
    padding: 40px 30px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);

    .watchcode-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 24px;

      i {
        font-size: 32px;
      }
    }

    h2 {
      font-size: 28px;
      margin-bottom: 12px;
    }

    .watchcode-description {
      font-size: 16px;
      margin-bottom: 32px;
    }

    .watchcode-input-section {
      max-width: 100%;
    }
  }

  .watchcode-right-panel {
    padding: 40px 30px;
    border-left: none;

    .qrcode-section {
      max-width: 100%;

      h3 {
        font-size: 24px;
      }

      .qrcode-container {
        width: 160px;
        height: 160px;
        margin-bottom: 20px;
      }

      .qrcode-features {
        .feature-item {
          padding: 10px 12px;

          span {
            font-size: 13px;
          }
        }
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

  // 新增：登录模态框小屏幕适配
  .login-modal-card {
    padding: 24px 20px;
    margin: 16px;
    border-radius: 16px;

    .login-modal-icon {
      .icon-wrapper {
        width: 56px;
        height: 56px;

        i {
          font-size: 20px;
        }
      }

      .icon-glow {
        width: 84px;
        height: 84px;
      }
    }

    .login-modal-content {
      h2 {
        font-size: 20px;
      }

      p {
        font-size: 13px;
        margin-bottom: 20px;
      }

      .login-modal-actions {
        gap: 10px;

        .primary-btn,
        .secondary-btn {
          padding: 10px 20px;
          font-size: 14px;

          i {
            font-size: 14px;
          }
        }
      }
    }

    .login-modal-close {
      width: 24px;
      height: 24px;
      top: 10px;
      right: 10px;

      i {
        font-size: 10px;
      }
    }
  }

  // 新增：观看码全屏模态框小屏幕适配
  .watchcode-fullscreen-content {
    width: 98%;
    height: 98%;
    border-radius: 12px;
  }

  .watchcode-left-panel {
    padding: 30px 20px;

    .watchcode-icon {
      width: 60px;
      height: 60px;
      margin-bottom: 20px;

      i {
        font-size: 24px;
      }
    }

    h2 {
      font-size: 24px;
      margin-bottom: 10px;
    }

    .watchcode-description {
      font-size: 14px;
      margin-bottom: 24px;
    }

    .watchcode-input-section {
      gap: 16px;

      :deep(.el-input) {
        .el-input__wrapper {
          padding: 12px 16px;
          font-size: 14px;
        }
      }

      .submit-btn {
        padding: 12px 24px;
        font-size: 14px;
      }
    }
  }

  .watchcode-right-panel {
    padding: 30px 20px;

    .qrcode-section {
      h3 {
        font-size: 20px;
        margin-bottom: 8px;
      }

      .qrcode-tip {
        font-size: 14px;
        margin-bottom: 24px;
      }

      .qrcode-container {
        width: 140px;
        height: 140px;
        margin-bottom: 16px;
        border-radius: 16px;
      }

      .qrcode-instruction {
        font-size: 12px;
        margin-bottom: 24px;
      }

      .qrcode-features {
        gap: 12px;

        .feature-item {
          padding: 8px 10px;

          i {
            font-size: 14px;
          }

          span {
            font-size: 12px;
          }
        }
      }
    }
  }

  .watchcode-close-btn {
    top: 16px;
    right: 16px;
    padding: 6px 12px;

    span {
      font-size: 12px;
    }
  }
}
</style>