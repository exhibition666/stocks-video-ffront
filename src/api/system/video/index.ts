import request from '@/config/axios'
import type { Dayjs } from 'dayjs';

/** 视频信息 */
export interface Video {
  id?: number; // 视频ID
  title?: string; // 视频标题
  description?: string; // 视频描述
  fileUrl?: string; // 完整视频
  picUrl?: string; // 封面图片
  duration?: number; // 视频时长（单位：秒）
  typeId?: number; // 视频分类id
  previewLimit?: number; // 试看时长（秒）
  isVipOnly?: boolean | number; // 是否仅VIP可观看（1=是，0=否）
  status?: number; // 状态（1=上架，0=下架）
  view?: number; // 观看数
  creator?: string; // 创建者
  createTime?: string; // 创建时间
  updater?: string; // 更新者
  updateTime?: string; // 更新时间
  deleted?: boolean | number; // 是否删除
  tenantId?: number; // 租户编号
}

// 视频 API
export const VideoApi = {
  // 查询视频分页
  getVideoPage: async (params: any) => {
    return await request.get({ url: `/system/video/page`, params })
  },

  // 查询视频详情
  getVideo: async (id: number) => {
    return await request.get({ url: `/system/video/get?id=` + id })
  },

  // 新增视频
  createVideo: async (data: Video) => {
    return await request.post({ url: `/system/video/create`, data })
  },

  // 修改视频
  updateVideo: async (data: Video) => {
    return await request.put({ url: `/system/video/update`, data })
  },

  // 删除视频
  deleteVideo: async (id: number) => {
    return await request.delete({ url: `/system/video/delete?id=` + id })
  },

  /** 批量删除视频 */
  deleteVideoList: async (ids: number[]) => {
    return await request.delete({ url: `/system/video/delete-list?ids=${ids.join(',')}` })
  },

  // 导出视频 Excel
  exportVideo: async (params) => {
    return await request.download({ url: `/system/video/export-excel`, params })
  },
}
