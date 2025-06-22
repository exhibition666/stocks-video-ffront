import request from '@/config/axios'
import type { Dayjs } from 'dayjs';

/** 视频分类信息 */
export interface VideoType {
          id: number; // 视频分类id
          name?: string; // 视频分类名称
  }

// 视频分类 API
export const VideoTypeApi = {
  // 查询视频分类分页
  getVideoTypePage: async (params: any) => {
    return await request.get({ url: `/system/video-type/page`, params })
  },

  // 查询视频分类详情
  getVideoType: async (id: number) => {
    return await request.get({ url: `/system/video-type/get?id=` + id })
  },

  // 新增视频分类
  createVideoType: async (data: VideoType) => {
    return await request.post({ url: `/system/video-type/create`, data })
  },

  // 修改视频分类
  updateVideoType: async (data: VideoType) => {
    return await request.put({ url: `/system/video-type/update`, data })
  },

  // 删除视频分类
  deleteVideoType: async (id: number) => {
    return await request.delete({ url: `/system/video-type/delete?id=` + id })
  },

  /** 批量删除视频分类 */
  deleteVideoTypeList: async (ids: number[]) => {
    return await request.delete({ url: `/system/video-type/delete-list?ids=${ids.join(',')}` })
  },

  // 导出视频分类 Excel
  exportVideoType: async (params) => {
    return await request.download({ url: `/system/video-type/export-excel`, params })
  },
}