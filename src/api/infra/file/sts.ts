import request from '@/config/axios'

export interface OssFileDeleteReqVO {
  path: string
  configId: number
  credentials?: STSCredentials
}

export interface STSCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  bucket: string
  endpoint: string
}

// 获取 STS 凭证
export const getSTSToken = (configId: number): Promise<STSCredentials> => {
  return request.get({ url: '/infra/file/oss-sts/get-token', params: { configId } })
}

// 使用 STS 凭证删除文件
export const deleteFileWithSTS = (data: OssFileDeleteReqVO): Promise<void> => {
  return request.post({ url: '/infra/file/oss-sts/delete-file', data })
} 