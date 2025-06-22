import request from '@/config/axios'
import type { Video } from '@/api/system/video'

// 前台视频 API
export const FrontVideoApi = {
  // 获取前台视频列表
  getVideoList: async (params: any) => {
    return await request.get({ url: `/app-api/stocks-front/video/page`, params })
  },
  
  // 获取视频详情
  getVideoDetail: async (id: number) => {
    return await request.get({ url: `/app-api/stocks-front/video/get?id=` + id })
  },
  
  // 根据分类ID获取视频列表
  getVideoListByType: async (typeId: number, params: any) => {
    return await request.get({ 
      url: `/app-api/stocks-front/video/page`, 
      params: { ...params, typeId } 
    })
  }
} 