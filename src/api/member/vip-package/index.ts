import request from '@/config/axios'

/**
 * 获取VIP套餐列表
 */
export const getVipPackageList = () => {
  return request.get({ url: '/member/vip-package/list' })
}

/**
 * 获取VIP订单记录
 * @param params 分页参数
 */
export const getVipPackageOrderPage = (params: any) => {
  return request.get({ url: '/member/vip-order/page', params })
}

/**
 * VIP套餐支付参数
 */
export interface VipPackageBuyParams {
  /** VIP套餐编号 */
  packageId: number
  /** 支付方式（如：wechat_pay=微信支付, alipay=支付宝） */
  payType: string
}

/**
 * 购买VIP套餐
 * @param params 支付参数
 * @returns 支付订单编号
 */
export const buyVipPackage = (params: VipPackageBuyParams) => {
  return request.post({ url: '/member/vip-package/buy', data: params })
} 