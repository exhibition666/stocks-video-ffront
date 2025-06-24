import request from '@/config/axios'

export interface WalletRechargeVO {
  packageId?: number
  payPrice?: number
}

// 创建钱包充值
export const createWalletRecharge = async (data: WalletRechargeVO) => {
  return await request.post({ url: '/pay/wallet-recharge/create', data })
}

// getWalletRechargePage 未来可能会用到，暂时注释
// export const getWalletRechargePage = async (params) => {
//   return await request.get({ url: '/pay/wallet-recharge/page', params })
// } 