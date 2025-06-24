/**
 * VIP套餐类型
 */
export interface VipPackage {
  /** 套餐编号 */
  id: number
  /** 套餐名称 */
  name: string
  /** VIP类型（month=月卡, year=年卡, forever=永久） */
  vipType: string
  /** 支付金额（单位：分） */
  price: number
  /** 时长（单位：天） */
  duration: number
  /** 排序值 */
  sort: number
  /** 备注说明 */
  remark?: string
}

/**
 * VIP类型枚举
 */
export enum VipTypeEnum {
  /** 月卡 */
  MONTH = 'month',
  /** 年卡 */
  YEAR = 'year',
  /** 永久 */
  FOREVER = 'forever'
}

/**
 * 支付方式枚举
 */
export enum PayTypeEnum {
  /** 微信支付 */
  WECHAT = 'wechat_pay',
  /** 支付宝 */
  ALIPAY = 'alipay'
} 