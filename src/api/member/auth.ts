import type { UserLoginVO } from '@/api/login/types'
import request from '@/config/axios'

// ========== MEMBER - AUTH API ==========

export interface SendSmsCodeReqVO {
  mobile: string
  scene: number
}

export interface SmsLoginReqVO {
  mobile: string
  code: string
}

export interface PasswordLoginReqVO {
  mobile: string
  password: string
}

// 发送短信验证码
export const sendSmsCode = (data: SendSmsCodeReqVO): Promise<boolean> => {
  // scene: 1=登录, 2=改手机号, 3=修改密码, 4=重置密码
  if (data.scene === 1 || data.scene === 2 || data.scene === 4) {
  return request.post({
      url: '/member/auth/send-sms-code',
    data,
    headers: { isToken: false }
  })
  } else {
    // scene=3(修改密码)必须带token
    return request.post({
      url: '/member/auth/send-sms-code',
      data
    })
  }
}

// 短信验证码登录 (包含无感注册)
export const smsLogin = (data: SmsLoginReqVO): Promise<UserLoginVO> => {
  return request.post({
    url: '/member/auth/sms-login',
    data,
    headers: { isToken: false }
  })
}

// 账号密码登录
export const login = (data: PasswordLoginReqVO): Promise<UserLoginVO> => {
  return request.post({
    url: '/member/auth/login',
    data,
    headers: { isToken: false }
  })
} 