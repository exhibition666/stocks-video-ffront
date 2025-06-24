import { store } from '@/store'
import { defineStore } from 'pinia'
import { getAccessToken, removeToken } from '@/utils/auth'
import { CACHE_KEY, useCache, deleteUserCache } from '@/hooks/web/useCache'
import { getInfo, loginOut } from '@/api/login'
import { getCurrentUser } from '@/api/member/user'
import { getLevelList } from '@/api/member/level'
import { useMessage } from '@/hooks/web/useMessage'

const { wsCache } = useCache()
const message = useMessage()

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
  vipExpireTime?: string
  vip_expire_time?: string
  level_id?: number
  levelId?: number
  expireTime?: string
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
        
        // 检查VIP是否过期
        await this.checkVipExpiration(memberUser)
        
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
    },
    // 检查VIP过期并处理
    async checkVipExpiration(user) {
      if (!user) return
      
      console.log('检查VIP过期状态...')
      console.log('完整的用户数据:', JSON.stringify(user))
      
      try {
        // 尝试从多个可能的字段名称获取VIP到期时间，优先使用vipExpireTime
        const vipExpireTime = user.vipExpireTime || user.vip_expire_time || user.expireTime
        
        if (vipExpireTime) {
          console.log('找到VIP到期时间:', vipExpireTime)
          const now = new Date()
          const expireDate = new Date(vipExpireTime)
          
          console.log('当前时间:', now.toISOString())
          console.log('VIP到期时间:', vipExpireTime, '解析为:', expireDate.toISOString())
          
          // 判断是否已过期
          if (now > expireDate) {
            console.log('VIP已过期，准备降级为普通用户')
            
            try {
              // 获取所有会员等级
              const allLevels = await getLevelList({})
              console.log('获取到的会员等级列表:', allLevels)
              
              if (allLevels && allLevels.length > 0) {
                // 找出ID最小的等级作为普通用户等级
                const normalLevel = allLevels.reduce((min, level) => 
                  level.id < min.id ? level : min, allLevels[0])
                
                console.log('找到ID最小的会员等级:', normalLevel)
                
                // 当前用户等级ID
                const currentLevelId = user.level?.id || user.level_id || user.levelId
                
                // 如果当前不是最低等级，则只在前端进行降级处理
                if (currentLevelId !== normalLevel.id) {
                  console.log('执行前端降级操作，从', currentLevelId, '降级到', normalLevel.id)
                  
                  // 不再调用后端API，只更新前端数据
                  // await updateUserLevel({
                  //   id: user.id,
                  //   levelId: normalLevel.id
                  // })
                  
                  // 更新本地用户信息
                  user.level = { 
                    id: normalLevel.id, 
                    name: normalLevel.name, 
                    level: normalLevel.value || 1, 
                    icon: normalLevel.icon || '' 
                  }
                  if (user.level_id) user.level_id = normalLevel.id
                  if (user.levelId) user.levelId = normalLevel.id
                  
                  // 更新store中的用户信息
                  this.user = { ...user }
                  
                  // 更新缓存
                  const userInfo = wsCache.get(CACHE_KEY.USER)
                  if (userInfo) {
                    userInfo.user = { ...user }
                    wsCache.set(CACHE_KEY.USER, userInfo)
                  }
                  
                  // 添加过期提醒
                  message.warning('您的VIP会员已过期，已恢复为普通会员')
                  
                  console.log('前端用户数据已更新为普通会员')
                } else {
                  console.log('用户已经是最低等级会员，无需降级')
                }
              } else {
                console.error('获取会员等级列表失败或列表为空')
              }
            } catch (error) {
              console.error('降级用户失败:', error)
              console.error('错误详情:', JSON.stringify(error))
            }
          } else {
            console.log('VIP未过期，到期时间:', expireDate.toISOString())
          }
        } else {
          console.log('用户无VIP到期时间记录，视为普通用户')
        }
      } catch (error) {
        console.error('检查VIP过期出错:', error)
        console.error('错误详情:', JSON.stringify(error))
      }
      
      return user
    }
  }
})

export const useUserStoreWithOut = () => {
  return useUserStore(store)
}
