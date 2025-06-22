<template>
  <ContentWrap>
    <div class="video-upload-page">
      <div class="upload-title-wrap">
        <i class="el-icon-video-camera-solid upload-title-icon"></i>
      <h2 class="upload-title">视频上传</h2>
      </div>
      <el-card class="upload-card">
        <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px" class="upload-form">
          <el-form-item label="视频标题" prop="title">
            <el-input v-model="formData.title" placeholder="请输入视频标题" maxlength="255" show-word-limit />
          </el-form-item>
          <el-form-item label="视频描述" prop="description">
            <el-input v-model="formData.description" type="textarea" :rows="3" placeholder="请输入视频描述" maxlength="500" show-word-limit />
          </el-form-item>
          <el-form-item label="视频分类" prop="typeId">
            <el-select v-model="formData.typeId" placeholder="请选择视频分类" filterable style="width: 100%">
              <el-option v-for="item in videoTypeOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="仅VIP可看" prop="isVipOnly">
            <el-switch v-model="formData.isVipOnly" :active-value="true" :inactive-value="false" />
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio :label="1">上架</el-radio>
              <el-radio :label="0">下架</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <!-- 封面图片上传卡片区域 -->
        <div class="bili-upload-area" :class="{ 'is-disabled': imageUploadProgress > 0 && imageUploadProgress < 100 }" style="margin-top: 0; margin-bottom: 32px;">
          <template v-if="!signedPicUrl">
            <el-upload
              drag
              :show-file-list="false"
              :file-list="imageFileList"
              :http-request="imageUploadWithProgress"
              :accept="['jpg','jpeg','png','webp'].map(t => '.' + t).join(',')"
              :limit="1"
              @remove="handleRemovePic"
              v-model:file-list="imageFileList"
              :disabled="imageUploadProgress > 0 && imageUploadProgress < 100"
            >
              <div class="bili-upload-inner">
                <el-icon style="font-size: 48px; color: #fc5c7d;"><UploadFilled /></el-icon>
                <div class="bili-upload-tip">拖拽到此处也可上传</div>
                <el-button type="primary" class="bili-upload-btn" :disabled="imageUploadProgress > 0 && imageUploadProgress < 100">上传封面</el-button>
                <div v-if="imageUploadProgress > 0" class="bili-progress-wrap">
                  <el-progress
                    :percentage="imageUploadProgress"
                    type="line"
                    :stroke-width="12"
                    :show-text="false"
                    class="bili-progress-bar"
                  />
                  <span class="bili-progress-num" style="color: #fc5c7d;">{{ imageUploadProgress }}%</span>
                </div>
              </div>
            </el-upload>
          </template>
          <template v-else>
            <div class="preview-wrap" style="flex-direction: column; align-items: center;">
              <el-image :src="signedPicUrl" style="max-width: 200px; max-height: 120px;" />
              <el-button link type="danger" @click="handleRemovePic" style="margin-top: 12px;">删除</el-button>
            </div>
          </template>
        </div>
        <!-- 视频上传卡片区域 -->
        <div class="bili-upload-area" :class="{ 'is-disabled': isUploadingVideo }">
          <template v-if="!signedVideoUrl">
            <el-upload
              drag
              :show-file-list="false"
              :file-list="videoFileList"
              :http-request="videoUploadWithProgress"
              :accept="videoTypes.map(t => '.' + t).join(',')"
              :limit="1"
              @remove="handleRemoveVideo"
              v-model:file-list="videoFileList"
              :disabled="isUploadingVideo"
            >
              <div class="bili-upload-inner">
                <el-icon style="font-size: 48px; color: #6a82fb;"><UploadFilled /></el-icon>
                <div class="bili-upload-tip">拖拽到此处也可上传</div>
                <el-button type="primary" class="bili-upload-btn" :disabled="isUploadingVideo">上传视频</el-button>
                <div v-if="videoUploadProgress > 0" class="bili-progress-wrap">
                  <el-progress
                    :percentage="videoUploadProgress"
                    type="line"
                    :stroke-width="12"
                    :show-text="false"
                    class="bili-progress-bar"
                  />
                  <span class="bili-progress-num">{{ videoUploadProgress }}%</span>
                </div>
              </div>
            </el-upload>
          </template>
          <template v-else>
            <div class="preview-wrap" style="flex-direction: column; align-items: center;">
              <video ref="videoRef" :src="signedVideoUrl" controls class="video-preview" @loadedmetadata="onVideoLoaded"></video>
              <el-button link type="danger" @click="handleRemoveVideo" style="margin-top: 12px;">删除</el-button>
            </div>
          </template>
        </div>
        <!-- 发布视频按钮放到最下方 -->
        <div style="text-align: center; margin-top: 36px;">
          <el-button type="primary" :loading="loading" @click="handleSubmit" style="font-size: 18px; padding: 12px 48px; border-radius: 10px;">发布视频</el-button>
        </div>
      </el-card>
    </div>
  </ContentWrap>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import UploadFile from '@/components/UploadFile/src/UploadFile.vue'
import { ElMessage, ElNotification } from 'element-plus'
import { VideoApi } from '@/api/system/video'
import { VideoTypeApi } from '@/api/system/videotype'
import { useOssUploader } from '@/utils/ossUploader'
import { createFile as createInfraFile, getAccessUrl } from '@/api/infra/file'
import { useSignedUrlPreview } from '@/utils/useSignedUrlPreview'
import { UploadFilled } from '@element-plus/icons-vue'

const videoTypes = ['mp4','avi','mov','wmv','flv','mkv','webm','mpeg','mpg','3gp','rmvb']
const formRef = ref()
const loading = ref(false)
const videoTypeOptions = ref([])
const videoRef = ref<HTMLVideoElement | null>(null)

const formData = reactive({
  fileUrl: '',
  title: '',
  description: '',
  picUrl: '',
  typeId: undefined,
  previewLimit: 0,
  isVipOnly: false,
  duration: 0,
  status: 1
})

const formRules = {
  fileUrl: [{ required: true, message: '请上传视频', trigger: 'blur' }],
  title: [{ required: true, message: '请输入视频标题', trigger: 'blur' }],
  picUrl: [{ required: true, message: '请上传封面图片', trigger: 'blur' }],
  typeId: [{ required: true, message: '请选择视频分类', trigger: 'change' }],
  duration: [{ required: true, message: '请等待视频加载完成', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

const { ossUpload, ossVideoUpload, ossImageUpload } = useOssUploader()
const videoUploadProgress = ref(0)
const imageUploadProgress = ref(0)
const ossConfigId = Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || 31
const {
  signedUrl: signedVideoUrl,
  fetchSignedUrl: fetchVideoSignedUrl
} = useSignedUrlPreview()
const {
  signedUrl: signedPicUrl,
  fetchSignedUrl: fetchPicSignedUrl
} = useSignedUrlPreview()

const videoFileRow = ref(null)
const imageFileRow = ref(null)
const videoFileList = ref([])
const imageFileList = ref([])
const isUploadingVideo = ref(false)

const videoUploadWithProgress = (options) =>
  ossUpload(
    options,
    'video/',
    (url) => { formData.fileUrl = url },
    (percent) => {
      videoUploadProgress.value = percent
      isUploadingVideo.value = percent > 0 && percent < 100
      if (percent === 100) {
        setTimeout(() => {
          videoUploadProgress.value = 0
          isUploadingVideo.value = false
        }, 1500)
      }
    },
    async (result) => {
      const fileRow = {
        configId: ossConfigId,
        name: result?.name?.split('/')?.pop() || '',
        path: result?.name || '',
        url: result?.name || '',
        type: result?.name?.split('.')?.pop() || '',
        size: options.file.size,
        creator: getCurrentUser(),
        createTime: getNow(),
        updater: getCurrentUser(),
        updateTime: getNow(),
        deleted: 0
      }
      console.log('即将保存到数据库的 fileRow:', fileRow)
      videoFileRow.value = { ...fileRow }
      // 获取签名URL并展示
      try {
        await fetchVideoSignedUrl(fileRow.url)
        console.log('视频签名URL:', signedVideoUrl.value)
      } catch (e) {
        console.error('获取视频签名URL失败:', e)
      }
    }
  )

const getCurrentUser = () => '' // TODO: 替换为实际登录用户名
const getNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

const imageUploadWithProgress = (options) =>
  ossUpload(
    options,
    'pic/',
    (url) => { formData.picUrl = url },
    (percent) => {
      imageUploadProgress.value = percent
      if (percent === 100) {
        setTimeout(() => {
          imageUploadProgress.value = 0
        }, 1500)
      }
    },
    async (result) => {
      const fileRow = {
        configId: ossConfigId,
        name: result?.name?.split('/')?.pop() || '',
        path: result?.name || '',
        url: result?.name || '',
        type: result?.name?.split('.')?.pop() || '',
        size: options.file.size,
        creator: getCurrentUser(),
        createTime: getNow(),
        updater: getCurrentUser(),
        updateTime: getNow(),
        deleted: 0
      }
      console.log('即将保存到数据库的 fileRow:', fileRow)
      imageFileRow.value = { ...fileRow }
      // 获取签名URL并展示
      try {
        await fetchPicSignedUrl(fileRow.url)
        console.log('图片签名URL:', signedPicUrl.value)
      } catch (e) {
        console.error('获取图片签名URL失败:', e)
      }
    }
  )

const onVideoLoaded = () => {
  if (videoRef.value && videoRef.value.duration) {
    formData.duration = Math.round(videoRef.value.duration)
    formData.previewLimit = Math.max(1, Math.floor(formData.duration / 5))
  }
}

const handleSubmit = async () => {
  await formRef.value.validate()
  loading.value = true
  try {
    // 拼接 system_video 参数，严格按表结构字段
    const systemVideoParams = {
      title: formData.title,
      description: formData.description,
      fileUrl: videoFileRow.value?.url || '',
      picUrl: imageFileRow.value?.url || '',
      duration: formData.duration,
      typeId: formData.typeId,
      previewLimit: formData.previewLimit,
      isVipOnly: formData.isVipOnly,
      status: formData.status,
      view: 0
    }
    console.log('最终提交到 system_video 的参数:', systemVideoParams)
    // 1. 存储到 system_video
    const videoRes = await VideoApi.createVideo(systemVideoParams)
    console.log('system_video 返回:', videoRes)
    // 2. 存储到 infra_file（视频）
    if (videoFileRow.value) {
      await createInfraFile(videoFileRow.value)
      console.log('视频文件信息已保存到数据库')
    }
    // 3. 存储到 infra_file（图片）
    if (imageFileRow.value) {
      await createInfraFile(imageFileRow.value)
      console.log('图片文件信息已保存到数据库')
    }
    ElNotification.success('发布成功！')
    // 清空所有状态
    formRef.value.resetFields()
    handleRemoveVideo()
    handleRemovePic()
  } catch (e) {
    ElMessage.error(e.message || '发布失败')
    console.error('发布失败详细：', e)
  } finally {
    loading.value = false
  }
}

const getVideoTypeList = async () => {
  const res = await VideoTypeApi.getVideoTypePage({ pageNo: 1, pageSize: 100 })
  videoTypeOptions.value = res.list || []
}

// 删除视频文件时清空相关数据
const handleRemoveVideo = () => {
  formData.fileUrl = ''
  videoFileRow.value = null
  signedVideoUrl.value = ''
  videoFileList.value = []
  videoUploadProgress.value = 0
}

// 删除图片文件时清空相关数据
const handleRemovePic = () => {
  formData.picUrl = ''
  imageFileRow.value = null
  signedPicUrl.value = ''
  imageFileList.value = []
  imageUploadProgress.value = 0
}

onMounted(getVideoTypeList)
</script>

<style scoped lang="scss">
.video-upload-page {
  max-width: 700px;
  margin: 40px auto 0 auto;
  padding-bottom: 40px;
}
.upload-title-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
}
.upload-title-icon {
  font-size: 32px;
  color: #6a82fb;
  margin-right: 12px;
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.upload-title {
  font-size: 28px;
  font-weight: bold;
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}
.upload-card {
  box-shadow: 0 4px 24px 0 rgba(106,130,251,0.08);
  border-radius: 18px;
  padding: 40px 36px 28px 36px;
  border: none;
  background: #fff;
}
.upload-form {
  background: linear-gradient(135deg, #f8fafc 60%, #f0f4ff 100%);
  border-radius: 16px;
  padding: 36px 20px 0 20px;
  box-shadow: 0 2px 8px 0 rgba(106,130,251,0.04);
}
:deep(.el-form-item) {
  margin-bottom: 32px !important;
}
:deep(.el-input), :deep(.el-textarea) {
  font-size: 16px;
}
:deep(.el-form-item__label) {
  font-size: 15px;
  color: #333;
  font-weight: 500;
  letter-spacing: 0.5px;
}
:deep(.el-button--primary) {
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  border: none;
  color: #fff;
  font-weight: bold;
  transition: box-shadow 0.2s, transform 0.2s;
  box-shadow: 0 2px 8px 0 rgba(252,92,125,0.08);
  font-size: 16px;
  padding: 10px 32px;
  border-radius: 8px;
}
:deep(.el-button--primary):hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 6px 18px 0 rgba(252,92,125,0.15);
}
.video-preview {
  width: 100%;
  max-width: 480px;
  height: 240px;
  border-radius: 14px;
  background: #000;
  box-shadow: 0 4px 16px 0 rgba(106,130,251,0.10);
  border: 2px solid #f0f4ff;
  margin-bottom: 8px;
}
:deep(.el-image) {
  border-radius: 12px;
  box-shadow: 0 2px 8px 0 rgba(106,130,251,0.10);
  border: 2px solid #f0f4ff;
}
// 进度条美化
:deep(.el-progress--line) {
  margin-bottom: 8px;
}
:deep(.el-progress-bar__outer) {
  border-radius: 8px;
  background: #f0f4ff;
}
:deep(.el-progress-bar__inner) {
  border-radius: 8px;
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  transition: width 0.4s cubic-bezier(.23,1,.32,1);
}
// 预览区分隔
.preview-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 8px;
  margin-bottom: 8px;
}
.bili-upload-area {
  width: 100%;
  min-height: 220px;
  border: 2px dashed #bfcfff;
  border-radius: 16px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, box-shadow 0.2s;
  margin-bottom: 32px;
  position: relative;
  &.is-disabled {
    pointer-events: none;
    opacity: 0.6;
  }
}
.bili-upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  background: transparent !important;
  box-shadow: none !important;
}
.bili-upload-tip {
  color: #888;
  font-size: 15px;
  margin: 12px 0 18px 0;
}
.bili-upload-btn {
  font-size: 16px;
  padding: 10px 32px;
  border-radius: 8px;
}
.bili-progress-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
  width: 100%;
}
.bili-progress-bar {
  flex: 1;
  min-width: 120px;
}
.bili-progress-num {
  font-size: 28px;
  color: #6a82fb;
  font-weight: bold;
  min-width: 60px;
  text-align: right;
}
:deep(.el-upload-dragger) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
:deep(.el-upload-dragger::before),
:deep(.el-upload-dragger::after) {
  display: none !important;
}
</style>
