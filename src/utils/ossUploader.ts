import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export function useOssUploader() {
  const ossClient = ref<any>(null)
  const stsToken = ref<any>(null)
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  const configId = Number(import.meta.env.VITE_OSS_CONFIG_ID) || 31

  // 获取STS令牌
  const getSTSToken = async () => {
    const url = `${baseUrl}/admin-api/infra/file/oss-sts/get-token?configId=${configId}`
    const res = await fetch(url, { method: 'GET' })
    const result = await res.json()
    if (result.code !== 0) throw new Error(result.msg || '获取STS令牌失败')
    stsToken.value = result.data
  }

  // 初始化OSS客户端
  const initOssClient = async () => {
    if (!stsToken.value) await getSTSToken()
    if (!ossClient.value) {
      const OSS = (await import('ali-oss')).default
      ossClient.value = new OSS({
        accessKeyId: stsToken.value.accessKeyId,
        accessKeySecret: stsToken.value.accessKeySecret,
        stsToken: stsToken.value.securityToken,
        bucket: stsToken.value.bucket,
        endpoint: stsToken.value.endpoint,
        secure: true
      })
    }
  }

  // 通用OSS上传方法
  const ossUpload = async (
    options,
    typePrefix = 'other/',
    onUrl?: (url: string) => void,
    onProgress?: (percent: number) => void,
    onResult?: (result: any) => void
  ) => {
    await initOssClient()
    const file = options.file
    const ext = file.name.split('.').pop().toLowerCase()
    const date = new Date()
    const dateFolder = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`
    const randomStr = Math.random().toString(36).substring(2, 10)
    const fileName = `${randomStr}_${Date.now()}_${file.name}`
    const ossPath = `${typePrefix}${dateFolder}/${fileName}`
    try {
      const result = await ossClient.value.multipartUpload(ossPath, file, {
        progress: (p) => {
          if (onProgress) onProgress(Math.floor(p * 100))
        }
      })
      if (onResult) onResult(result)
      let fileUrl = ''
      if (stsToken.value.domain) {
        fileUrl = `https://${stsToken.value.domain}/${ossPath}`
      } else {
        fileUrl = `https://${stsToken.value.bucket}.${stsToken.value.endpoint}/${ossPath}`
      }
      options.onSuccess(result)
      if (onUrl) onUrl(fileUrl)
      ElMessage.success('文件上传成功')
    } catch (error: any) {
      ElMessage.error('文件上传失败: ' + (error?.message || '未知错误'))
      options.onError(error)
    }
  }

  // 视频上传
  const ossVideoUpload = (options) => ossUpload(options, 'video/')
  // 图片上传
  const ossImageUpload = (options) => ossUpload(options, 'pic/')

  return {
    ossUpload,
    ossVideoUpload,
    ossImageUpload,
    getSTSToken,
    initOssClient,
    stsToken,
    ossClient
  }
} 