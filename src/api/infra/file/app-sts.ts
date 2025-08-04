import request from '@/config/axios'

export interface OssFileDeleteReqVO {
  path: string
  configId: number
  credentials?: STSCredentials
}

export interface OssFileListReqVO {
  configId: number
  path: string
  maxKeys?: number
  accessKeyId?: string
  accessKeySecret?: string
  securityToken?: string
}

export interface STSCredentials {
  accessKeyId: string
  accessKeySecret: string
  securityToken: string
  expiration: string
  bucket: string
  endpoint: string
}

// 获取 STS 凭证 (前台用户版本)
export const getAppSTSToken = (configId: number): Promise<STSCredentials> => {
  return request.get({ url: '/infra/file/app-oss-sts/get-token', params: { configId } })
}

// 使用 STS 凭证获取文件列表 (前台用户版本)
export const listFilesWithSTS = (data: OssFileListReqVO): Promise<any[]> => {
  return request.post({ url: '/infra/file/app-oss-sts/list-files', data })
}

// 使用 STS 凭证删除文件 (前台用户版本)
export const deleteFileWithSTS = (data: OssFileDeleteReqVO): Promise<void> => {
  return request.post({ url: '/infra/file/app-oss-sts/delete-file', data })
} 