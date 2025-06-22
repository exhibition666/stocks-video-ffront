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
  return request.post({
    baseURL: import.meta.env.VITE_BASE_URL,
    url: '/app-api/member/auth/send-sms-code',
    data,
    headers: { isToken: false }
  })
}

// 短信验证码登录 (包含无感注册)
export const smsLogin = (data: SmsLoginReqVO): Promise<UserLoginVO> => {
  return request.post({
    baseURL: import.meta.env.VITE_BASE_URL,
    url: '/app-api/member/auth/sms-login',
    data,
    headers: { isToken: false }
  })
}

// 账号密码登录
export const login = (data: PasswordLoginReqVO): Promise<UserLoginVO> => {
  return request.post({
    baseURL: import.meta.env.VITE_BASE_URL,
    url: '/app-api/member/auth/login',
    data,
    headers: { isToken: false }
  })
} 