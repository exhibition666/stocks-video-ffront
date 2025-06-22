import request from '@/config/axios'
import type { Dayjs } from 'dayjs';

/** 通用文件管理信息 */
export interface File {
          id: number; // 主键ID
          fileName?: string; // 原始文件名
          fileType?: string; // 文件类型（image/video/other）
          url?: string; // 文件访问URL（OSS地址）
          bucket: string; // 所属Bucket名称
          fileSize: number; // 文件大小（字节）
          extension: string; // 文件扩展名，如jpg/mp4
          bizType: string; // 业务类型（如 video_cover）
          bizId: number; // 业务ID
  }

// 通用文件管理 API
export const FileApi = {
  // 查询通用文件管理分页
  getFilePage: async (params: any) => {
    return await request.get({ url: `/system/file/page`, params })
  },

  // 查询通用文件管理详情
  getFile: async (id: number) => {
    return await request.get({ url: `/system/file/get?id=` + id })
  },

  // 新增通用文件管理
  createFile: async (data: File) => {
    return await request.post({ url: `/system/file/create`, data })
  },

  // 修改通用文件管理
  updateFile: async (data: File) => {
    return await request.put({ url: `/system/file/update`, data })
  },

  // 删除通用文件管理
  deleteFile: async (id: number) => {
    return await request.delete({ url: `/system/file/delete?id=` + id })
  },

  /** 批量删除通用文件管理 */
  deleteFileList: async (ids: number[]) => {
    return await request.delete({ url: `/system/file/delete-list?ids=${ids.join(',')}` })
  },

  // 导出通用文件管理 Excel
  exportFile: async (params) => {
    return await request.download({ url: `/system/file/export-excel`, params })
  },
}