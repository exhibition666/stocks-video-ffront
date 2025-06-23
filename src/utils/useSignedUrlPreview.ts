import { ref } from 'vue'
import { getAccessUrl } from '@/api/infra/file'

/**
 * 获取签名URL用于预览
 * @returns 签名URL和获取方法
 */
export function useSignedUrlPreview() {
  const signedUrl = ref('')
  const loading = ref(false)
  const error = ref('')

  /**
   * 获取签名URL
   * @param filePath 文件路径
   * @param isVideo 是否为视频文件（可选）
   * @returns 签名URL
   */
  const fetchSignedUrl = async (filePath: string, isVideo = false) => {
    if (!filePath) {
      signedUrl.value = ''
      return ''
    }

    // 如果已经是完整URL，直接返回
    if (filePath.startsWith('http')) {
      signedUrl.value = filePath
      return filePath
    }

    loading.value = true
    error.value = ''
    try {
      // 获取OSS配置ID - 使用主用户的AK/SK
      const ossConfigId = Number(import.meta.env.VITE_OSS_CONFIG_ID_MAIN) || 31
      
      // 调用API获取签名URL
      const res = await getAccessUrl(ossConfigId, filePath)
      
      // 检查返回结果格式并处理URL
      let finalUrl = ''
      if (typeof res === 'string') {
        finalUrl = res
      } else if (res && res.accessUrl) {
        finalUrl = res.accessUrl
      } else {
        console.error('获取签名URL返回格式异常:', res)
        signedUrl.value = ''
        return ''
      }
      
      signedUrl.value = finalUrl
      return finalUrl
    } catch (e: any) {
      console.error('获取签名URL失败:', e)
      error.value = e?.message || '获取签名URL失败'
      signedUrl.value = ''
      return ''
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