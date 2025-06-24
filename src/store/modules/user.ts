import { store } from '@/store'
import { defineStore } from 'pinia'
import { getAccessToken, removeToken } from '@/utils/auth'
import { CACHE_KEY, useCache, deleteUserCache } from '@/hooks/web/useCache'
import { getInfo, loginOut } from '@/api/login'
import { getCurrentUser } from '@/api/member/user'

const { wsCache } = useCache()

export interface MemberUserVO {
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
  vip_expire_time?: string
}

interface UserInfoVO {
  // USER 缓存
  permissions: Set<string>
  roles: string[]
  isSetUser: boolean
  user: MemberUserVO | null
}

export const useUserStore = defineStore('admin-user', {
  state: (): UserInfoVO => ({
    permissions: new Set<string>(),
    roles: [],
    isSetUser: false,
    user: null
  }),
  getters: {
    getPermissions(): Set<string> {
      return this.permissions
    },
    getRoles(): string[] {
      return this.roles
    },
    getIsSetUser(): boolean {
      return this.isSetUser
    },
    getUser(): MemberUserVO | null {
      return this.user
    },
    getLevelId(): number | null {
      return this.user?.level?.id ?? null
    },
    getNickname(): string {
      return this.user?.nickname ?? ''
    }
  },
  actions: {
    async setUserInfoAction() {
      if (!getAccessToken()) {
        // 没有token时，直接返回游客信息
        this.user = null
        this.roles = []
        this.permissions = new Set<string>()
        this.isSetUser = true
        return null
      }
      let userInfo = wsCache.get(CACHE_KEY.USER)
      if (!userInfo) {
        userInfo = await getInfo()
      } else {
        // 特殊：在有缓存的情况下，进行加载。但是即使加载失败，也不影响后续的操作，保证可以进入系统
        try {
          userInfo = await getInfo()
        } catch (error) {}
      }
      this.permissions = new Set(userInfo.permissions)
      this.roles = userInfo.roles
      this.user = userInfo.user as MemberUserVO
      this.isSetUser = true
      wsCache.set(CACHE_KEY.USER, userInfo)
      wsCache.set(CACHE_KEY.ROLE_ROUTERS, userInfo.menus)
    },
    async setUserAvatarAction(avatar: string) {
      const userInfo = wsCache.get(CACHE_KEY.USER)
      // NOTE: 是否需要像`setUserInfoAction`一样判断`userInfo != null`
      if (this.user) this.user.avatar = avatar
      if (userInfo && userInfo.user) userInfo.user.avatar = avatar
      wsCache.set(CACHE_KEY.USER, userInfo)
    },
    async setUserNicknameAction(nickname: string) {
      const userInfo = wsCache.get(CACHE_KEY.USER)
      // NOTE: 是否需要像`setUserInfoAction`一样判断`userInfo != null`
      if (this.user) this.user.nickname = nickname
      if (userInfo && userInfo.user) userInfo.user.nickname = nickname
      wsCache.set(CACHE_KEY.USER, userInfo)
    },
    async loginOut() {
      await loginOut()
      removeToken()
      deleteUserCache() // 删除用户缓存
      this.resetState()
    },
    resetState() {
      this.permissions = new Set<string>()
      this.roles = []
      this.isSetUser = false
      this.user = null
    },
    async setMemberInfo() {
      if (!getAccessToken()) {
        // 没有token时，直接返回游客信息
        console.log('未检测到 token，返回游客信息')
        this.user = null
        this.isSetUser = true
        return null
      }
      
      try {
        // 获取会员信息
        console.log('正在获取会员信息...')
        console.log('当前 token:', getAccessToken())
        
        // 确保请求头中包含 token
        const memberUser = await getCurrentUser()
        console.log('获取到的会员信息:', JSON.stringify(memberUser))
        
        if (!memberUser) {
          console.error('获取会员信息失败: 返回数据为空')
          this.user = null
          this.isSetUser = false
          return null
        }
        
        // 更新 store 中的用户信息
        this.user = memberUser
        this.isSetUser = true
        
        // 创建一个简化的用户信息对象，用于缓存
        const userInfo = {
          user: memberUser,
          permissions: [],
          roles: [],
          menus: []
        }
        
        // 保存到缓存
        console.log('保存会员信息到缓存:', JSON.stringify(userInfo))
        wsCache.set(CACHE_KEY.USER, userInfo)
        
        return memberUser
      } catch (error) {
        console.error('获取会员信息失败:', error)
        console.error('错误详情:', JSON.stringify(error))
        this.user = null
        this.isSetUser = false
        return null
      }
    }
  }
})

export const useUserStoreWithOut = () => {
  return useUserStore(store)
}
