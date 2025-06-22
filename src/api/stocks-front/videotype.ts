import request from '@/config/axios'
import type { VideoType } from '@/api/system/videotype'

// 前台视频分类 API
export const FrontVideoTypeApi = {
  // 获取所有视频分类列表
  getAllVideoTypes: async () => {
    return await request.get({ url: `/app-api/stocks-front/video-type/page`, params: { pageSize: 100 } })
  }
} 