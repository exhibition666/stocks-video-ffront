import request from '@/config/axios'

// 文件预签名地址 Response VO
export interface FilePresignedUrlRespVO {
  // 文件配置编号
  configId: number
  // 文件上传 URL
  uploadUrl: string
  // 文件 URL
  url: string
  // 文件路径
  path: string
}

// 查询文件列表
export const getFilePage = (params: PageParam) => {
  return request.get({ url: '/infra/file/page', params })
}

// 删除文件
export const deleteFile = (id: number) => {
  return request.delete({ url: '/infra/file/delete?id=' + id })
}

// 批量删除文件
export const deleteFileList = (ids: number[]) => {
  return request.delete({ url: '/infra/file/delete-list', params: { ids: ids.join(',') } })
}

// 获取文件预签名地址
export const getFilePresignedUrl = (name: string, directory?: string) => {
  return request.get<FilePresignedUrlRespVO>({
    url: '/infra/file/presigned-url',
    params: { name, directory }
  })
}

// 创建文件
export const createFile = (data: any) => {
  return request.post({ url: '/infra/file/create', data })
}

// 上传文件
export const updateFile = (data: any) => {
  return request.upload({ url: '/infra/file/upload', data })
}

// 获取带签名的访问 URL
export const getAccessUrl = (configId: string | number, path: string, timeout = 1800) => {
  return request.get({
    url: '/infra/file/access-url',
    params: { configId, path, timeout }
  })
}

// 列出 OSS 文件和文件夹
export const listFiles = (data: { configId: string | number, path?: string, maxKeys?: number }, useAppApi = false) => {
  // useAppApi: true 时走 app 端接口，否则管理后台接口
  const url = useAppApi
    ? '/infra/file/app-oss-sts/list-files'
    : '/infra/file/oss-sts/list-files';
  return request.post({
    url,
    data,
    headers: { 'Content-Type': 'application/json' }
  });
}
