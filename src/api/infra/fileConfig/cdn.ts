import request from '@/config/axios'

export interface CDNConfig {
  enabled: boolean
  domain: string
  refreshObjectPaths: string[]
  refreshDirPaths: string[]
  type: 'aliyun' | 'qcloud' | 'qiniu'
}

// 获取CDN配置
export const getCDNConfig = () => {
  return request.get<CDNConfig>({ url: '/infra/file-config/cdn/get' })
}

// 更新CDN配置
export const updateCDNConfig = (data: CDNConfig) => {
  return request.put({ url: '/infra/file-config/cdn/update', data })
}

// 刷新CDN缓存
export const refreshCDNCache = (objectPaths: string[], dirPaths: string[]) => {
  return request.post({
    url: '/infra/file-config/cdn/refresh',
    data: { objectPaths, dirPaths }
  })
} 