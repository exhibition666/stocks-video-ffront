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
        <div class="welcome-title">欢迎来到<br/>股票视频学习平台</div>
        <div class="welcome-desc">
          海量专业股票视频教程，助您掌握投资技巧<br/>
          专家实时解盘，捕捉市场机会<br/>
          AI智能选股推荐，提升投资决策效率
        </div>
        <div class="features">
          <div class="feature-item">
            <i class="el-icon-video-camera"></i>
            <span>专业教学</span>
          </div>
          <div class="feature-item">
            <i class="el-icon-data-analysis"></i>
            <span>市场分析</span>
          </div>
          <div class="feature-item">
            <i class="el-icon-cpu"></i>
            <span>AI助手</span>
          </div>
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
  background: linear-gradient(120deg, #1a2980 0%, #26d0ce 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.login-card {
  display: flex;
  width: 900px;
  min-height: 500px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 10px 50px 0 rgba(0,0,0,0.15);
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
  animation: pulse 2s infinite;
}
.login-title {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
  background: linear-gradient(to right, #1a2980, #26d0ce);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.login-desc {
  color: #666;
  margin-bottom: 32px;
}
.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a2980 0%, #26d0ce 100%);
  padding: 0 24px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: "";
    position: absolute;
    top: -50px;
    right: -50px;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    z-index: 0;
  }
  
  &::after {
    content: "";
    position: absolute;
    bottom: -50px;
    left: -50px;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    z-index: 0;
  }
}
.welcome-title {
  font-size: 32px;
  font-weight: bold;
  color: #ffffff;
  margin-bottom: 24px;
  text-align: center;
  line-height: 1.3;
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.welcome-desc {
  color: rgba(255,255,255,0.9);
  font-size: 16px;
  text-align: center;
  line-height: 2;
  margin-bottom: 32px;
  position: relative;
  z-index: 1;
}
.features {
  display: flex;
  justify-content: space-around;
  width: 100%;
  margin-top: 20px;
  position: relative;
  z-index: 1;
}
.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  padding: 15px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
  transition: all 0.3s ease;
  
  i {
    font-size: 24px;
    margin-bottom: 8px;
  }
  
  span {
    font-size: 14px;
  }
  
  &:hover {
    transform: translateY(-5px);
    background: rgba(255,255,255,0.2);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@media (max-width: 900px) {
  .login-card {
    flex-direction: column;
    width: 98vw;
    min-width: 320px;
  }
  .login-left, .login-right {
    padding: 32px 16px;
  }
  .welcome-title {
    font-size: 24px;
  }
  .features {
    flex-wrap: wrap;
  }
  .feature-item {
    margin-bottom: 10px;
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
