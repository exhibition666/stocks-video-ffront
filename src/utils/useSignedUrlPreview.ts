import { ref } from 'vue'
import { getAccessUrl } from '@/api/infra/file'

export function useSignedUrlPreview() {
  const signedUrl = ref('')
  const loading = ref(false)
  const error = ref('')

  /**
   * 获取签名URL
   * @param {string} filePath
   */
  const fetchSignedUrl = async (filePath: string) => {
    signedUrl.value = ''
    error.value = ''
    loading.value = true
    try {
      const ossConfigId = Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || 31
      const res = await getAccessUrl(ossConfigId, filePath)
      signedUrl.value = res.accessUrl
    } catch (e: any) {
      error.value = e.message || '获取签名URL失败'
    } finally {
      loading.value = false
    }
  }

  return {
    signedUrl,
    loading,
    error,
    fetchSignedUrl
  }
}

/**
 * 这是一个非组合式函数，可用于批量获取URL。
 * 它从 useSignedUrlPreview 中提取了核心逻辑。
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 签名后的URL
 */
export const getSignedUrlForPreview = async (filePath: string): Promise<string> => {
  if (!filePath) {
    return ''
  }
  try {
    const ossConfigId = Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || 31
    const res = await getAccessUrl(ossConfigId, filePath)
    return res.accessUrl || ''
  } catch (e) {
    console.error(`获取签名URL失败: ${filePath}`, e)
    return ''
  }
} 