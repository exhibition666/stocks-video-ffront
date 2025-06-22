<script lang="ts" setup>
import { useRoute } from 'vue-router'
import { ref, onMounted, watch } from 'vue'
import StocksHeader from '@/components/StocksHeader/index.vue'
import { FrontVideoApi } from '@/api/stocks-front/video'
import { getAccessUrl } from '@/api/infra/file'
import { useSignedUrlPreview } from '@/utils/useSignedUrlPreview'
import { VideoTypeApi } from '@/api/system/videotype'
import { VideoPlayer } from '@videojs-player/vue'
import 'video.js/dist/video-js.css'

const route = useRoute()
const videoId = ref(Number(route.params.id))
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID

const videoData = ref<any>(null)
const { signedUrl: videoUrl, fetchSignedUrl: fetchVideoUrl } = useSignedUrlPreview()
const { signedUrl: coverUrl, fetchSignedUrl: fetchCoverUrl } = useSignedUrlPreview()
const { signedUrl: previewUrl, fetchSignedUrl: fetchPreviewUrl } = useSignedUrlPreview()
const loading = ref(true)
const errorMsg = ref('')
const videoTypeOptions = ref<any[]>([])
const typeName = ref('')
const videoSource = ref({
  src: '',
  type: 'video/mp4'
})

const playerOptions = ref({
  autoplay: false,
  controls: true,
  fluid: true,
  techOrder: ['html5'],
  playbackRates: [0.5, 1, 1.5, 2]
})

const handlePlayerReady = (player: any) => {
  console.log('播放器就绪:', player)
}

const getVideoDetail = async (id: number) => {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await FrontVideoApi.getVideoDetail(id)
    console.log('接口原始返回：', res)
    const detail = res
    console.log('detail:', detail)
    console.log('fileUrl:', detail?.fileUrl)
    console.log('picUrl:', detail?.picUrl)
    videoData.value = detail
    if (videoTypeOptions.value.length && detail?.typeId) {
      const type = videoTypeOptions.value.find(t => t.id === detail.typeId)
      typeName.value = type ? type.name : ''
    }
    try {
      if (detail?.fileUrl) {
        await fetchVideoUrl(detail.fileUrl)
        videoSource.value.src = videoUrl.value
      }
      if (detail?.picUrl) {
        await fetchCoverUrl(detail.picUrl)
      }
      if (detail?.previewUrl) {
        await fetchPreviewUrl(detail.previewUrl)
      }
    } catch (e) {
      console.error('fetchSignedUrl 发生异常', e)
    }
    console.log('videoData.value:', videoData.value)
    console.log('videoUrl:', videoUrl.value)
    console.log('coverUrl:', coverUrl.value)
    console.log('previewUrl:', previewUrl.value)
  } catch (e) {
    errorMsg.value = '获取视频详情失败'
    console.error('获取视频详情异常', e)
  } finally {
    loading.value = false
    console.log('loading.value:', loading.value)
  }
}

const getVideoTypeList = async () => {
  const res = await VideoTypeApi.getVideoTypePage({ pageNo: 1, pageSize: 100 })
  videoTypeOptions.value = res.list || []
}

onMounted(async () => {
  await getVideoTypeList()
  console.log('onMounted, videoId:', videoId.value)
  if (videoId.value) getVideoDetail(videoId.value)
})

// 监听路由参数变化，自动刷新详情
watch(
  () => route.params.id,
  (newId, oldId) => {
    console.log('route.params.id 变化:', oldId, '=>', newId)
    if (newId) {
      videoId.value = Number(newId)
      getVideoDetail(videoId.value)
    }
  }
)
</script>

<template>
  <div class="video-detail-page">
    <StocksHeader />
    <div class="video-detail-content">
      <template v-if="loading">
        <el-skeleton :rows="4" animated />
      </template>
      <template v-else-if="errorMsg">
        <el-alert :title="errorMsg" type="error" show-icon />
      </template>
      <template v-else-if="videoData">
        <div class="video-player-card">
          <h2 class="video-title">{{ videoData.title }}</h2>
          <div class="video-player-wrap">
            <video-player
              v-if="videoUrl"
              :src="videoUrl"
              :poster="coverUrl"
              controls
              :loop="false"
              :volume="0.6"
              :playback-rates="[0.5, 1, 1.5, 2]"
              class="main-video-player vjs-big-play-centered"
            />
            <el-image v-else :src="coverUrl" class="main-video-cover" fit="cover" />
          </div>
        </div>
        <div class="video-info-card">
          <div class="video-meta-row">
            <span class="video-meta-label">分类：</span><span>{{ typeName }}</span>
            <span class="video-meta-label">观看数：</span><span>{{ videoData.view }}</span>
            <span v-if="videoData.status === 1" class="video-status online">已上架</span>
            <span v-else class="video-status offline">已下架</span>
          </div>
          <div class="video-desc-title">视频简介</div>
          <div class="video-desc">{{ videoData.description }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.video-detail-page {
  max-width: 900px;
  margin: 40px auto 0 auto;
  padding-bottom: 40px;
}
.video-detail-content {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(106,130,251,0.08);
  padding: 36px 36px 28px 36px;
}
.video-player-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}
.video-title {
  font-size: 28px;
  font-weight: bold;
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 18px;
  text-align: center;
}
.video-player-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}
.main-video-player {
  width: 100%;
  max-width: 720px;
  height: 400px;
  border-radius: 16px;
  background: #000;
  box-shadow: 0 4px 16px 0 rgba(106, 130, 251, 0.1);
  border: 2px solid #f0f4ff;
  overflow: hidden; // 隐藏内部溢出的部分以保持圆角

  :deep(.video-js) {
    width: 100%;
    height: 100%;
    border-radius: 14px;

    // 中央大播放按钮 (美化)
    .vjs-big-play-button {
      background-color: rgba(43, 51, 63, 0.7);
      font-size: 2.5em;
      border-radius: 50%;
      width: 2.5em;
      height: 2.5em;
      line-height: 2.5em;
      border: 2px solid rgba(255, 255, 255, 0.8);
      transition: all 0.3s ease;

      &:hover {
        background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
        border-color: #fff;
        transform: scale(1.1);
        box-shadow: 0 0 20px rgba(106, 130, 251, 0.7);
      }
    }

    // 控制条
    .vjs-control-bar {
      background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%);
      height: 4.5em;
      padding: 0 1em 1em;
      font-size: 14px;
    }

    // 进度条和音量条
    .vjs-play-progress,
    .vjs-volume-level {
      background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
    }

    .vjs-progress-control .vjs-slider,
    .vjs-volume-panel .vjs-slider {
      background-color: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
    }

    // 时间显示
    .vjs-time-control {
      font-size: 1.1em;
      line-height: 4;
      padding: 0;
    }
    .vjs-current-time,
    .vjs-duration,
    .vjs-time-divider {
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
    }
    .vjs-remaining-time {
      display: none;
    }

    // 倍速播放按钮
    .vjs-playback-rate .vjs-menu-button {
      font-size: 1.1em;
      line-height: 4;
      padding: 0;
    }
    .vjs-playback-rate-value {
      font-size: 1.1em;
      line-height: 4;
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
    }
  }
}
.main-video-cover {
  width: 100%;
  max-width: 720px;
  height: 400px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 4px 16px 0 rgba(106,130,251,0.10);
  border: 2px solid #f0f4ff;
}
.video-info-card {
  background: linear-gradient(135deg, #f8fafc 60%, #f0f4ff 100%);
  border-radius: 16px;
  padding: 32px 24px 24px 24px;
  box-shadow: 0 2px 8px 0 rgba(106,130,251,0.04);
  margin-top: 0;
}
.video-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: center;
  font-size: 16px;
  margin-bottom: 18px;
}
.video-meta-label {
  color: #6a82fb;
  font-weight: 500;
  margin-right: 4px;
}
.video-status {
  margin-left: 16px;
  font-size: 15px;
  font-weight: bold;
  padding: 2px 12px;
  border-radius: 8px;
}
.video-status.online {
  background: #e6f7ff;
  color: #1890ff;
}
.video-status.offline {
  background: #fff1f0;
  color: #fc5c7d;
}
.video-desc-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  margin-top: 10px;
}
.video-desc {
  font-size: 16px;
  color: #444;
  white-space: pre-line;
  line-height: 1.8;
  background: #f8fafc;
  border-radius: 10px;
  padding: 16px 18px;
}
</style>
