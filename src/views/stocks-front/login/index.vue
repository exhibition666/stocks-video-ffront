<template>
  <div :class="prefixCls + '-bg'">
    <div class="login-card">
      <div class="login-left">
        <img alt="logo" class="login-logo" src="@/assets/imgs/logo.png" />
        <div class="login-title">会员中心</div>
        <div class="login-desc">欢迎登录或注册，体验更多精彩内容</div>
      <MemberLoginForm />
      </div>
      <div class="login-right">
        <div class="welcome-title">欢迎您 来到<br/>Nine Nine Six Network!</div>
        <div class="welcome-desc">
          加密级的财富管家，24小时不停不休<br/>
          自持独立负载高峰，稳定快速兼容认证<br/>
          AI人工智能定制投资，好服务为科技加持
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { ThemeSwitch } from '@/layout/components/ThemeSwitch'
import { LocaleDropdown } from '@/layout/components/LocaleDropdown'
import MemberLoginForm from './components/MemberLoginForm.vue'
import { useUserStore } from '@/store/modules/user'
import { watch, onMounted } from 'vue'
import { debugAuthState } from '@/utils/authDebugger'

defineOptions({ name: 'MemberLogin' })

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('login')

const userStore = useUserStore()

// 登录页面加载时输出登录状态
onMounted(() => {
  console.group('===== 登录页面初始状态 =====')
  console.log('登录页面加载，当前登录状态:')
  debugAuthState()
  console.groupEnd()
})

// 监听用户信息变化
watch(
  () => userStore.user,
  (user, oldUser) => {
    console.group('===== 用户信息变更 =====')
    console.log('旧用户信息:', oldUser)
    console.log('新用户信息:', user)
    
    if (user && !oldUser) {
      console.log('用户已登录，完整登录状态:')
      debugAuthState()
    } else if (!user && oldUser) {
      console.log('用户已登出，完整登录状态:')
      debugAuthState()
    }
    console.groupEnd()
  },
  { immediate: true, deep: true }
)
</script>

<style lang="scss" scoped>
.#{$namespace}-login-bg {
  min-height: 100vh;
  width: 100vw;
  background: linear-gradient(120deg, #f6d365 0%, #fda085 50%, #a1c4fd 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card {
  display: flex;
  width: 900px;
  min-height: 480px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
  overflow: hidden;
}
.login-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 32px;
  background: rgba(255,255,255,0.95);
}
.login-logo {
  width: 72px;
  height: 72px;
  margin-bottom: 24px;
}
.login-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
}
.login-desc {
  color: #888;
  margin-bottom: 32px;
}
.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
}
.welcome-title {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 24px;
  text-align: center;
  line-height: 1.3;
}
.welcome-desc {
  color: #666;
  font-size: 16px;
  text-align: center;
  line-height: 2;
}
@media (max-width: 900px) {
  .login-card {
    flex-direction: column;
    width: 98vw;
    min-width: 320px;
  }
  .login-left, .login-right {
    padding: 32px 12px;
  }
  .welcome-title {
    font-size: 22px;
  }
}
</style>

<style lang="scss">
.dark .login-form {
  .el-divider__text {
    background-color: var(--login-bg-color);
  }

  .el-card {
    background-color: var(--login-bg-color);
  }
}
</style>
