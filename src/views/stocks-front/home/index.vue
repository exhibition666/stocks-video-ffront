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
import VipUpgrade from '@/views/stocks-front/vip_upgrade/index.vue'
import { useUserStore } from '@/store/modules/user'

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

const userStore = useUserStore()
const user = computed(() => userStore.user)

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
      pageSize: 12
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
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万次观看'
  }
  return count + '次观看'
}

const goToFileTest = () => {
  router.push('/stocks-front/filetest')
}

const goToSTSDeleteTest = () => {
  router.push('/stocks-front/filetest/stsdelete')
}

onMounted(async () => {
  console.log('首页组件已加载')
  // 测试获取签名URL
  console.log('开始获取图片URL, 路径:', testImagePath)
  testImageLoading.value = true
  errorMsg.value = ''
  
  try {
    const url = await fetchSignedUrl(testImagePath)
    console.log('准备赋值 testImageUrl，url:', url)
    testImageUrl.value = url
    console.log('赋值后 testImageUrl:', testImageUrl.value)
  } catch (error) {
    console.error('初始化获取图片URL失败:', error)
    errorMsg.value = error.message
  } finally {
    testImageLoading.value = false
  }
  
  getVideoCategories()
  getVideoList() // 默认加载全部视频
  console.log('当前 userStore.user:', userStore.user)
})
</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />
    <div style="margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto;">
      <el-card v-if="user" shadow="hover">
        <template #header>
          <span>当前登录用户信息</span>
        </template>
        <div>昵称：{{ user.nickname }}</div>
        <div>手机号：{{ user.mobile }}</div>
        <div>等级ID：{{ user.level_id }}</div>
        <div>积分：{{ user.point }}</div>
        <div>性别：{{ user.sex === 1 ? '男' : user.sex === 2 ? '女' : '未知' }}</div>
        <div>生日：{{ user.birthday }}</div>
      </el-card>
      <el-alert v-else title="未登录" type="info" show-icon />
    </div>
    <div :class="`${prefixCls}-main`">
      <div :class="`${prefixCls}-sidebar`">
        <div class="category-header">视频分类</div>
        <ul class="category-list">
          <li
            class="category-item"
            :class="{ active: currentCategoryId === null }"
            @click="handleAllCategory"
          >
            <span>全部</span>
          </li>
          <li
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ active: currentCategoryId === category.id }"
            @click="handleCategoryClick(category)"
          >
            <span>{{ category.name }}</span>
          </li>
        </ul>
      </div>
      <div :class="`${prefixCls}-content`">
        <div style="width:100%;display:flex;justify-content:center;margin-bottom:32px;">
          <router-link to="/stocks-front/vip_upgrade">
            <el-button type="primary" size="large" style="font-size:18px;padding: 0 48px;">
              会员VIP充值/升级入口
            </el-button>
          </router-link>
        </div>
        <div v-if="loading" class="loading-container">
          <el-skeleton :rows="3" animated />
          <el-skeleton :rows="3" animated />
          <el-skeleton :rows="3" animated />
        </div>
        
        <el-alert
          v-if="errorMsg"
          :title="errorMsg"
          type="warning"
          show-icon
          :closable="false"
          class="mb-4"
        />

        
        
        <el-empty v-if="!loading && videoList.length === 0" description="暂无视频" />
        <div v-else-if="!loading" :class="`${prefixCls}-grid`">
          <div
            v-for="video in videoList"
            :key="video.id"
            :class="`${prefixCls}-card`"
            @click="goToVideoDetail(video.id)"
          >
            <div class="thumbnail">
              <img :src="videoPicSignedUrlMap[video.id]?.signedUrl || getDefaultImage()" :alt="video.title" />
              <span class="duration">{{ Math.floor(video.duration || 0) }}秒</span>
            </div>
            <div class="info">
              <div class="details">
                <h3 class="title">{{ video.title }}</h3>
                <p class="stats">
                  <span>{{ formatViews(1000) }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-home;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background: #f6f8fb;
  
  &-main {
    display: flex;
    padding-top: 60px;
    min-height: calc(100vh - 60px);
    background: none;
    max-width: 1600px;
    margin: 0 auto;
    gap: 32px;
  }

  &-sidebar {
    width: 260px;
    padding: 32px 0 24px 0;
    border-right: none;
    background: #fff;
    height: 100%;
    overflow-y: auto;
    border-radius: 18px;
    box-shadow: 0 4px 24px 0 rgba(80,120,255,0.06);
    margin-top: 32px;
    .category-header {
      padding: 0 24px 12px;
      font-size: 18px;
      font-weight: bold;
      color: #333;
      border-bottom: 1px solid #e4eaf3;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .category-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .category-item {
      display: flex;
      align-items: center;
      padding: 14px 24px;
      cursor: pointer;
      color: #333;
      transition: background-color 0.3s, color 0.3s;
      border-radius: 8px;
      margin-bottom: 2px;
      &:hover {
        background-color: #f0f4ff;
        color: #6a82fb;
      }
      &.active {
        background-color: #eaf0ff;
        color: #6a82fb;
        font-weight: bold;
      }
      span {
        font-size: 15px;
      }
    }
  }

  &-content {
    flex: 1;
    padding: 40px 40px 40px 40px;
    overflow-y: auto;
    background: #fff;
    border-radius: 18px;
    min-height: 600px;
    box-shadow: 0 4px 24px 0 rgba(80,120,255,0.06);
    .loading-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    .mb-4 {
      margin-bottom: 16px;
    }
  }

  &-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
    max-width: 1800px;
    margin: 0 auto;
    padding: 0 16px;
  }

  &-card {
    background-color: #f8fafc;
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.25s cubic-bezier(.23,1,.32,1);
    box-shadow: 0 2px 12px 0 rgba(106,130,251,0.08);
    cursor: pointer;
    border: 1.5px solid #f0f4ff;
    &:hover {
      transform: translateY(-6px) scale(1.03);
      box-shadow: 0 8px 24px 0 rgba(106,130,251,0.13);
      border-color: #6a82fb;
    }
    .thumbnail {
      position: relative;
      width: 100%;
      padding-top: 56.25%; // 16:9 比例
      background: #eaf1ff;
      img {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 12px 12px 0 0;
        background: #f8fafc;
      }
      .duration {
        position: absolute;
        bottom: 10px;
        right: 12px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
    }
    .info {
      padding: 18px 16px 14px 16px;
      display: flex;
      gap: 12px;
      .details {
        flex: 1;
        min-width: 0;
        .title {
          font-size: 16px;
          font-weight: 600;
          color: #222;
          margin: 0 0 6px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.5;
        }
        .stats {
          font-size: 14px;
          color: #6a82fb;
          display: flex;
          align-items: center;
          gap: 4px;
          .dot {
            font-size: 12px;
          }
        }
      }
    }
  }

  @media (max-width: 1600px) {
    &-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 1200px) {
    &-main {
      gap: 0;
    }
    &-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    &-sidebar {
      display: none;
    }
    &-content {
      padding: 24px 8px;
    }
  }
  @media (max-width: 768px) {
    &-grid {
      grid-template-columns: repeat(1, 1fr);
    }
    &-content {
      padding: 8px 2px;
    }
  }
}

.test-image-container {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  max-width: 90%;
  width: 600px;

  .error-alert {
    margin-top: 10px;
  }

  .test-image {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    border: 1px solid #eee;
  }

  .image-url {
    margin: 10px 0;
    padding: 8px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 12px;
    word-break: break-all;
    max-height: 100px;
    overflow-y: auto;
  }
}
</style>
