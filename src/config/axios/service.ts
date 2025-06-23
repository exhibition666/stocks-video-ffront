import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import qs from 'qs'
import { config } from '@/config/axios/config'
import {
  getAccessToken,
  getRefreshToken,
  getTenantId,
  getVisitTenantId,
  removeToken,
  setToken
} from '@/utils/auth'
import errorCode from './errorCode'

import { resetRouter } from '@/router'
import { deleteUserCache } from '@/hooks/web/useCache'

const tenantEnable = import.meta.env.VITE_APP_TENANT_ENABLE
const { result_code, base_url, request_timeout } = config

// 需要忽略的提示。忽略后，自动 Promise.reject('error')
const ignoreMsgs = [
  '无效的刷新令牌', // 刷新令牌被删除时，不用提示
  '刷新令牌已过期' // 使用刷新令牌，刷新获取新的访问令牌时，结果因为过期失败，此时需要忽略。否则，会导致继续 401，无法跳转到登出界面
]
// 是否显示重新登录
export const isRelogin = { show: false }
// 请求队列
const requestList: any[] = []
// 是否正在刷新中
const isRefreshToken = false
// 请求白名单，无须 token 的接口
const whiteList: string[] = ['/login', '/refresh-token']

// 需要跳过自动刷新Token的接口白名单
const noRefreshTokenApi = [
  '/member/auth/send-sms-code',
  '/member/auth/sms-login',
  '/member/auth/login'
  // 可根据实际情况继续补充
];

// 创建axios实例
const service: AxiosInstance = axios.create({
  baseURL: base_url, // api 的 base_url
  timeout: request_timeout, // 请求超时时间
  withCredentials: false, // 禁用 Cookie 等信息
  // 自定义参数序列化函数
  paramsSerializer: (params) => {
    return qs.stringify(params, { allowDots: true })
  }
})

// request拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 是否需要设置 token
    let isToken = (config!.headers || {}).isToken === false
    whiteList.some((v) => {
      if (config.url && config.url.indexOf(v) > -1) {
        return (isToken = false)
      }
    })
    if (isToken) {
      // 关键：彻底移除 Authorization（兼容大小写）
      delete config.headers.Authorization
      delete config.headers.authorization
      delete config.headers.isToken
    } else if (getAccessToken() && !isToken) {
      config.headers.Authorization = 'Bearer ' + getAccessToken() // 让每个请求携带自定义token
    }
    // 设置租户
    if (tenantEnable && tenantEnable === 'true') {
      let tenantId = getTenantId()
      if (!tenantId) {
        tenantId = 1 // 默认租户ID，保证游客和未登录用户可访问
      }
      config.headers['tenant-id'] = tenantId
      // 只有登录时，才设置 visit-tenant-id 访问租户
      const visitTenantId = getVisitTenantId()
      if (config.headers.Authorization && visitTenantId) {
        config.headers['visit-tenant-id'] = visitTenantId
      }
    }
    const method = config.method?.toUpperCase()
    // 防止 GET 请求缓存
    if (method === 'GET') {
      config.headers['Cache-Control'] = 'no-cache'
      config.headers['Pragma'] = 'no-cache'
    }
    // 自定义参数序列化函数
    else if (method === 'POST') {
      const contentType = config.headers['Content-Type'] || config.headers['content-type']
      if (contentType === 'application/x-www-form-urlencoded') {
        if (config.data && typeof config.data !== 'string') {
          config.data = qs.stringify(config.data)
        }
      }
    }
    return config
  },
  (error: AxiosError) => {
    // Do something with request error
    console.log(error) // for debug
    return Promise.reject(error)
  }
)

// response 拦截器
service.interceptors.response.use(
  async (response: AxiosResponse<any>) => {
    let { data } = response
    const config = response.config
    if (!data) {
      // 返回"[HTTP]请求没有返回值";
      throw new Error()
    }
    const { t } = useI18n()
    // 未设置状态码则默认成功状态
    // 二进制数据则直接返回，例如说 Excel 导出
    if (
      response.request.responseType === 'blob' ||
      response.request.responseType === 'arraybuffer'
    ) {
      // 注意：如果导出的响应为 json，说明可能失败了，不直接返回进行下载
      if (response.data.type !== 'application/json') {
        return response.data
      }
      data = await new Response(response.data).json()
    }
    const code = data.code || result_code
    // 获取错误信息
    const msg = data.msg || errorCode[code] || errorCode['default']
    if (ignoreMsgs.indexOf(msg) !== -1) {
      // 如果是忽略的错误码，直接返回 msg 异常
      return Promise.reject(msg)
    } else if (code === 401) {
      // 对于会员系统，401 可能是未登录状态，不需要弹窗
      // 检查是否是会员相关 API
      if (config.url && config.url.includes('/member/')) {
        console.log('会员 API 未登录:', config.url)
        return Promise.reject('未登录，无权限访问')
      }
      // 对于非会员 API，尝试刷新 token
      return handleAuthorized()
    } else if (code === 500) {
      ElMessage.error(t('sys.api.errMsg500'))
      return Promise.reject(new Error(msg))
    } else if (code === 901) {
      ElMessage.error({
        offset: 300,
        dangerouslyUseHTMLString: true,
        message:
          '<div>' +
          t('sys.api.errMsg901') +
          '</div>' +
          '<div> &nbsp; </div>' +
          '<div>参考 https://doc.iocoder.cn/ 教程</div>' +
          '<div> &nbsp; </div>' +
          '<div>5 分钟搭建本地环境</div>'
      })
      return Promise.reject(new Error(msg))
    } else if (code !== 200) {
      if (msg === '无效的刷新令牌') {
        // hard coding：忽略这个提示，直接登出
        console.log(msg)
        return handleAuthorized()
      } else {
        ElNotification.error({ title: msg })
      }
      return Promise.reject('error')
    } else {
      return data
    }
  },
  (error: AxiosError) => {
    console.log('err' + error) // for debug
    let { message } = error
    const { t } = useI18n()
    if (message === 'Network Error') {
      message = t('sys.api.errorMessage')
    } else if (message.includes('timeout')) {
      message = t('sys.api.apiTimeoutMessage')
    } else if (message.includes('Request failed with status code')) {
      message = t('sys.api.apiRequestFailed') + message.substr(message.length - 3)
    }
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

const refreshToken = async () => {
  axios.defaults.headers.common['tenant-id'] = getTenantId()
  return await axios.post(base_url + '/system/auth/refresh-token?refreshToken=' + getRefreshToken())
}
const handleAuthorized = () => {
  const { t } = useI18n()
  if (!isRelogin.show) {
    // 如果已经到登录页面则不进行弹窗提示
    if (window.location.href.includes('login')) {
      return
    }
    isRelogin.show = true
    ElMessageBox.confirm(t('sys.api.timeoutMessage'), t('common.confirmTitle'), {
      showCancelButton: false,
      closeOnClickModal: false,
      showClose: false,
      closeOnPressEscape: false,
      confirmButtonText: t('login.relogin'),
      type: 'warning'
    }).then(() => {
      resetRouter() // 重置静态路由表
      deleteUserCache() // 删除用户缓存
      removeToken()
      isRelogin.show = false
      // 干掉token后再走一次路由让它过router.beforeEach的校验
      window.location.href = window.location.href
    })
  }
  return Promise.reject(t('sys.api.timeoutMessage'))
}
export { service }
