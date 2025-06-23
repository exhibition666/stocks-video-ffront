import request from '@/config/axios'

export interface UserVO {
  id: number
  nickname: string
  avatar: string
  mobile: string
  sex: number
  point: number
  experience: number
  level: {
    id: number
    name: string
    level: number
    icon: string
  }
  brokerageEnabled: boolean
}

// 查询会员用户列表
export const getUserPage = async (params) => {
  return await request.get({ url: `/member/user/page`, params })
}

// 查询会员用户详情
export const getUser = async (id: number) => {
  return await request.get({ url: `/member/user/get?id=` + id })
}

// 修改会员用户
export const updateUser = async (data: Partial<UserVO>) => {
  return await request.put({ url: `/member/user/update`, data })
}

// 修改会员用户等级
export const updateUserLevel = async (data: any) => {
  return await request.put({ url: `/member/user/update-level`, data })
}

// 修改会员用户积分
export const updateUserPoint = async (data: any) => {
  return await request.put({ url: `/member/user/update-point`, data })
}

// 修改会员密码
export const updateUserPassword = async (data: { password: string; code: string }) => {
  return await request.put({ url: '/member/user/update-password', data })
}

// 获取当前登录会员信息
export const getCurrentUser = async () => {
  return await request.get({ 
    url: '/member/user/get',
    headers: {
      isToken: true
    }
  })
}
