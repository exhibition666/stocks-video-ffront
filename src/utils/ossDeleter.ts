import OSS from 'ali-oss'
import { getSTSToken } from '@/api/infra/file/sts'
import { ElMessage } from 'element-plus'

export function useOssDeleter() {
  const deleteFile = async (configId: number, path: string): Promise<boolean> => {
    if (!configId || !path) {
      ElMessage.error('删除失败：缺少必要的配置ID或文件路径。')
      return false
    }

    try {
      // 1. 获取 STS 临时凭证，凭证中包含 bucket 和 endpoint
      const stsToken = await getSTSToken(configId)
      if (!stsToken || !stsToken.accessKeyId || !stsToken.endpoint || !stsToken.bucket) {
        throw new Error('获取STS凭证失败，或凭证中缺少 endpoint/bucket 等关键信息。')
      }

      console.log('成功获取 STS 凭证，准备初始化 OSS 客户端:', stsToken)

      // 2. 初始化 OSS 客户端 (使用 endpoint)
      const client = new OSS({
        accessKeyId: stsToken.accessKeyId,
        accessKeySecret: stsToken.accessKeySecret,
        stsToken: stsToken.securityToken,
        bucket: stsToken.bucket,
        endpoint: stsToken.endpoint,
        secure: true // 强制使用 https
      })

      console.log('OSS 客户端已初始化，准备删除文件:', path)

      // 3. 执行删除操作
      const result = await client.delete(path)

      console.log('OSS 删除操作返回结果:', result)

      if (result.res.status === 204) {
        console.log(`文件 ${path} 已成功从 OSS 删除。`)
        return true
      } else {
        throw new Error(`OSS返回了非预期的状态码: ${result.res.status}`)
      }
    } catch (error: any) {
      console.error('使用 STS 删除文件时发生严重错误:', error)
      const message = error.message || '未知错误'
      ElMessage.error(`删除失败: ${message}`)
      return false
    }
  }

  return {
    deleteFile
  }
} 