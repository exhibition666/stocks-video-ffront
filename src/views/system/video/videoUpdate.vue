<template>
  <ContentWrap>
    <div class="video-upload-page">
      <div class="upload-title-wrap">
        <i class="el-icon-video-camera-solid upload-title-icon"></i>
        <h2 class="upload-title">视频编辑</h2>
      </div>
      <el-card class="upload-card">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-width="100px"
          v-loading="formLoading"
          class="upload-form"
        >
          <el-form-item label="视频标题" prop="title">
            <el-input v-model="formData.title" placeholder="请输入视频标题" />
          </el-form-item>
          <el-form-item label="视频分类" prop="typeId">
            <el-select v-model="formData.typeId" placeholder="请选择视频分类" class="w-1/1">
              <el-option
                v-for="item in videoTypeOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="视频简介" prop="description">
            <el-input
              type="textarea"
              :rows="4"
              v-model="formData.description"
              placeholder="请输入视频简介"
            />
          </el-form-item>
          <el-form-item label="视频状态" prop="status">
            <el-radio-group v-model="formData.status">
              <el-radio :label="1">上架</el-radio>
              <el-radio :label="0">下架</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="会员专属" prop="isVipOnly">
            <el-switch
              v-model="formData.isVipOnly"
              :active-value="true"
              :inactive-value="false"
            />
          </el-form-item>
        </el-form>

        <!-- 更换封面 -->
        <div
          class="bili-upload-area"
          :class="{ 'is-disabled': imageUploadProgress > 0 && imageUploadProgress < 100 }"
          style="margin-top: 0; margin-bottom: 32px"
        >
          <template v-if="!picPreviewUrl">
            <el-upload
              drag
              :show-file-list="false"
              :http-request="imageUploadWithProgress"
              accept=".jpg,.jpeg,.png,.webp"
              :limit="1"
            >
              <div class="bili-upload-inner">
                <el-icon style="font-size: 48px; color: #fc5c7d"><UploadFilled /></el-icon>
                <div class="bili-upload-tip">拖拽到此处也可上传</div>
                <el-button
                  type="primary"
                  class="bili-upload-btn"
                  :disabled="imageUploadProgress > 0 && imageUploadProgress < 100"
                  >上传封面</el-button
                >
                <div v-if="imageUploadProgress > 0" class="bili-progress-wrap">
                  <el-progress
                    :percentage="imageUploadProgress"
                    type="line"
                    :stroke-width="12"
                    :show-text="false"
                    class="bili-progress-bar"
                  />
                  <span class="bili-progress-num" style="color: #fc5c7d"
                    >{{ imageUploadProgress }}%</span
                  >
                </div>
              </div>
            </el-upload>
          </template>
          <template v-else>
            <div class="preview-wrap" style="flex-direction: column; align-items: center">
              <el-image :src="picPreviewUrl" style="max-width: 200px; max-height: 120px" />
              <el-button link type="danger" @click="handleRemovePic" style="margin-top: 12px"
                >删除</el-button
              >
            </div>
          </template>
        </div>

        <!-- 更换视频 -->
        <div class="bili-upload-area" :class="{ 'is-disabled': isUploadingVideo }">
          <template v-if="!filePreviewUrl">
            <el-upload
              drag
              :show-file-list="false"
              :http-request="videoUploadWithProgress"
              accept=".mp4,.avi,.mov,.wmv,.flv,.mkv,.webm"
              :limit="1"
              :disabled="isUploadingVideo"
            >
              <div class="bili-upload-inner">
                <el-icon style="font-size: 48px; color: #6a82fb"><UploadFilled /></el-icon>
                <div class="bili-upload-tip">拖拽到此处也可上传</div>
                <el-button type="primary" class="bili-upload-btn" :disabled="isUploadingVideo"
                  >上传视频</el-button
                >
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
            <div class="preview-wrap" style="flex-direction: column; align-items: center">
              <video
                ref="videoRef"
                :src="filePreviewUrl"
                controls
                class="video-preview"
                @loadedmetadata="onVideoLoaded"
              ></video>
              <el-button link type="danger" @click="handleRemoveVideo" style="margin-top: 12px"
                >删除</el-button
              >
            </div>
          </template>
        </div>

        <!-- 操作按钮 -->
        <div class="form-actions">
          <el-button
            type="primary"
            @click="submitForm"
            :loading="formLoading"
            style="font-size: 18px; padding: 12px 48px; border-radius: 10px"
          >
            <Icon icon="ep:check" class="mr-5px" />
            保存修改
          </el-button>
          <el-button
            @click="close"
            size="large"
            style="font-size: 18px; padding: 12px 48px; border-radius: 10px"
            >返回列表</el-button
          >
        </div>
      </el-card>
    </div>
  </ContentWrap>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { VideoApi, Video } from '@/api/system/video'
import { VideoTypeApi, VideoType } from '@/api/system/videotype'
import { getSignedUrlForPreview, useSignedUrlPreview } from '@/utils/useSignedUrlPreview'
import { UploadFilled } from '@element-plus/icons-vue'
import { useOssUploader } from '@/utils/ossUploader'
import { createFile } from '@/api/infra/file'

defineOptions({ name: 'VideoUpdate' })

const message = useMessage()
const route = useRoute()

const formLoading = ref(false)
const formData = ref<Video>({
  id: undefined,
  title: '',
  description: '',
  fileUrl: '',
  picUrl: '',
  duration: 0,
  status: 1,
  typeId: undefined,
  isVipOnly: false,
  view: 0
})
const { signedUrl: picPreviewUrl, fetchSignedUrl: fetchPicSignedUrl } = useSignedUrlPreview()
const { signedUrl: filePreviewUrl, fetchSignedUrl: fetchVideoSignedUrl } = useSignedUrlPreview()
const formRef = ref()
const videoTypeOptions = ref<VideoType[]>([])
const newImageFileRow = ref(null)
const newVideoFileRow = ref(null)

// 新增的状态
const videoUploadProgress = ref(0)
const imageUploadProgress = ref(0)
const isUploadingVideo = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)

const { ossUpload } = useOssUploader()

const formRules = {
  title: [{ required: true, message: '视频标题不能为空', trigger: 'blur' }],
  typeId: [{ required: true, message: '视频分类不能为空', trigger: 'change' }]
}

const getVideoDetails = async () => {
  formLoading.value = true
  try {
    const id = Number(route.query.id)
    if (id) {
      const data = await VideoApi.getVideo(id)
      formData.value = data
      // 获取预览URL
      if (data.picUrl) {
        await fetchPicSignedUrl(data.picUrl)
      }
      if (data.fileUrl) {
        await fetchVideoSignedUrl(data.fileUrl)
      }
    }
  } catch (e) {
    console.error('获取视频详情失败', e)
  } finally {
    formLoading.value = false
  }
}

const getVideoTypeList = async () => {
  try {
    const res = await VideoTypeApi.getVideoTypePage({ pageNo: 1, pageSize: 100 })
    videoTypeOptions.value = res.list
  } catch (error) {
    console.error('获取视频分类列表失败', error)
  }
}

const imageUploadWithProgress = (options) =>
  ossUpload(
    options,
    'pic/',
    undefined,
    (percent) => {
      imageUploadProgress.value = percent
      if (percent === 100) {
        setTimeout(() => {
          imageUploadProgress.value = 0
        }, 1500)
      }
    },
    async (result) => {
      console.log('图片上传-OSS multipartUpload 原始结果:', result)
      const path = result.name
      console.log('从原始结果中提取的图片相对路径:', path)
      formData.value.picUrl = path
      newImageFileRow.value = {
        configId: Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || 31,
        name: path.split('/').pop() || '',
        path: path,
        url: path,
        type: path.split('.').pop() || '',
        size: options.file.size
      }
      if (path) {
        await fetchPicSignedUrl(path)
        console.log('获取到的图片签名预览URL:', picPreviewUrl.value)
      }
    }
  )

const videoUploadWithProgress = (options) =>
  ossUpload(
    options,
    'video/',
    undefined,
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
      console.log('视频上传-OSS multipartUpload 原始结果:', result)
      const path = result.name
      console.log('从原始结果中提取的视频相对路径:', path)
      formData.value.fileUrl = path
      newVideoFileRow.value = {
        configId: Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || 31,
        name: path.split('/').pop() || '',
        path: path,
        url: path,
        type: path.split('.').pop() || '',
        size: options.file.size
      }
      if (path) {
        await fetchVideoSignedUrl(path)
        console.log('获取到的视频签名预览URL:', filePreviewUrl.value)
      }
    }
  )

const handleRemovePic = () => {
  formData.value.picUrl = ''
  picPreviewUrl.value = ''
  newImageFileRow.value = null
}

const handleRemoveVideo = () => {
  formData.value.fileUrl = ''
  filePreviewUrl.value = ''
  newVideoFileRow.value = null
  formData.value.duration = 0 // 重置时长
}

const onVideoLoaded = () => {
  if (videoRef.value && videoRef.value.duration) {
    formData.value.duration = Math.round(videoRef.value.duration)
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) return
  formLoading.value = true
  try {
    if (newImageFileRow.value) {
      await createFile(newImageFileRow.value)
      newImageFileRow.value = null
    }
    if (newVideoFileRow.value) {
      await createFile(newVideoFileRow.value)
      newVideoFileRow.value = null
    }
    await VideoApi.updateVideo(formData.value)
    message.success('保存成功')
    close()
  } catch (e) {
    console.error('保存失败', e)
  } finally {
    formLoading.value = false
  }
}

const close = () => {
  window.location.href = 'http://localhost:8009/video/list'
}

onMounted(() => {
  const videoId = route.query.id
  if (!videoId) {
    message.error('需要选择视频才能修改')
    window.location.href = 'http://localhost:8009/video/list'
    return
  }
  getVideoTypeList()
  getVideoDetails()
})
</script>

<style lang="scss" scoped>
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
  box-shadow: 0 4px 24px 0 rgba(106, 130, 251, 0.08);
  border-radius: 18px;
  padding: 40px 36px 28px 36px;
  border: none;
  background: #fff;
}
.upload-form {
  background: linear-gradient(135deg, #f8fafc 60%, #f0f4ff 100%);
  border-radius: 16px;
  padding: 36px 20px 0 20px;
  box-shadow: 0 2px 8px 0 rgba(106, 130, 251, 0.04);
}
:deep(.el-form-item) {
  margin-bottom: 32px !important;
}
:deep(.el-input),
:deep(.el-textarea) {
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
  box-shadow: 0 2px 8px 0 rgba(252, 92, 125, 0.08);
  font-size: 16px;
  padding: 10px 32px;
  border-radius: 8px;
}
:deep(.el-button--primary):hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 6px 18px 0 rgba(252, 92, 125, 0.15);
}
.video-preview {
  width: 100%;
  max-width: 480px;
  height: 240px;
  border-radius: 14px;
  background: #000;
  box-shadow: 0 4px 16px 0 rgba(106, 130, 251, 0.1);
  border: 2px solid #f0f4ff;
  margin-bottom: 8px;
}
:deep(.el-image) {
  border-radius: 12px;
  box-shadow: 0 2px 8px 0 rgba(106, 130, 251, 0.1);
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
  transition: width 0.4s cubic-bezier(0.23, 1, 0.32, 1);
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
.form-actions {
  margin-top: 36px;
  text-align: center;
  display: flex;
  justify-content: center;
  gap: 20px;
}
</style>
