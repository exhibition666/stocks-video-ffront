import request from '@/config/axios'
import type { Video } from '@/api/system/video'

// 前台视频 API
export const FrontVideoApi = {
  // 获取前台视频列表
  getVideoList: async (params: any) => {
    return await request.get({ url: `/stocks-front/video/page`, params })
  },
  
  // 获取视频详情
  getVideoDetail: async (id: number) => {
    return await request.get({ url: `/stocks-front/video/get?id=` + id })
  },
  
  // 根据分类ID获取视频列表
  getVideoListByType: async (typeId: number, params: any) => {
    return await request.get({ 
      url: `/stocks-front/video/page`, 
      params: { ...params, typeId } 
    })
  }
}

/**
 * 获取视频列表
 * @param params 查询参数
 * @returns 视频列表
 */
export const getVideoList = (params?: any) => {
  return request.get({ url: '/stocks-front/video/list', params })
}

/**
 * 获取视频详情
 * @param id 视频ID
 * @returns 视频详情
 */
export const getVideoDetail = (id: string | number) => {
  return request.get({ url: `/stocks-front/video/detail/${id}` })
}

/**
 * 记录视频观看历史
 * @param data 观看记录数据
 * @returns 操作结果
 */
export const recordVideoHistory = (data: any) => {
  return request.post({ url: '/stocks-front/video/history', data })
}

/**
 * 获取用户视频观看历史
 * @param params 查询参数
 * @returns 观看历史列表
 */
export const getUserVideoHistory = (params?: any) => {
  return request.get({ url: '/stocks-front/video/history', params })
}

/**
 * 获取视频分类列表
 * @returns 分类列表
 */
export const getVideoCategories = () => {
  return request.get({ url: '/stocks-front/video/categories' })
}

/**
 * 收藏/取消收藏视频
 * @param data 收藏数据
 * @returns 操作结果
 */
export const toggleVideoFavorite = (data: any) => {
  return request.post({ url: '/stocks-front/video/favorite', data })
}

/**
 * 获取用户收藏的视频列表
 * @param params 查询参数
 * @returns 收藏视频列表
 */
export const getUserFavoriteVideos = (params?: any) => {
  return request.get({ url: '/stocks-front/video/favorite', params })
} 