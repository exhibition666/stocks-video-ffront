<template>
  <div :class="prefixCls + '-bg'">
    <div class="login-card">
      <div class="login-left">
        <div class="login-header">
          <div class="login-title">股票期权系统</div>
          <div class="login-desc">欢迎登录或注册，体验更多精彩内容</div>
        </div>
        <MemberLoginForm />
      </div>
      <div class="login-right">
        <div class="welcome-content">
          <div class="welcome-title">欢迎来到<br/>股票期权学习平台</div>
          <div class="welcome-desc">
            海量专业股票视频教程，助您掌握投资技巧<br/>
            专家实时解盘，捕捉市场机会<br/>
            期权策略分析，提升投资决策效率
          </div>
          <div class="features">
            <div class="feature-item">
              <i class="el-icon-video-camera"></i>
              <span>专业教学</span>
            </div>
            <div class="feature-item">
              <i class="el-icon-money"></i>
              <span>期权交易</span>
            </div>
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
import { useRouter } from 'vue-router'
import { watch, onMounted } from 'vue'
import { debugAuthState } from '@/utils/authDebugger'

defineOptions({ name: 'MemberLogin' })

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('login')
const router = useRouter()

const userStore = useUserStore()

// 返回首页
const goToHome = () => {
  router.push('/stocks-front/home')
}

// 登录页面加载时输出登录状态
onMounted(() => {
  // console.group('===== 登录页面初始状态 =====')
  // console.log('登录页面加载，当前登录状态:')
  debugAuthState()
  // console.groupEnd()
})

// 监听用户信息变化
watch(
  () => userStore.user,
  (user, oldUser) => {
    // console.group('===== 用户信息变更 =====')
    // console.log('旧用户信息:', oldUser)
    // console.log('新用户信息:', user)
    
    if (user && !oldUser) {
      // console.log('用户已登录，完整登录状态:')
      debugAuthState()
    } else if (!user && oldUser) {
      // console.log('用户已登出，完整登录状态:')
      debugAuthState()
    }
    // console.groupEnd()
  },
  { immediate: true, deep: true }
)
</script>

<style lang="scss" scoped>
.#{$namespace}-login-bg {
  min-height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #1a73e8 0%, #4285f4 50%, #34a853 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
    animation: rotate 20s linear infinite;
  }
}
.login-card {
  display: flex;
  width: 950px;
  min-height: 550px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  position: relative;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.login-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  background: rgba(255, 255, 255, 0.98);
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.login-title {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #1a73e8 0%, #34a853 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
}

.login-desc {
  color: #5f6368;
  font-size: 16px;
  text-align: center;
  line-height: 1.5;
}
.login-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a73e8 0%, #4285f4 50%, #34a853 100%);
  padding: 60px 40px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: -100px;
    right: -100px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    z-index: 0;
    animation: float 6s ease-in-out infinite;
  }

  &::after {
    content: "";
    position: absolute;
    bottom: -80px;
    left: -80px;
    width: 250px;
    height: 250px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    z-index: 0;
    animation: float 8s ease-in-out infinite reverse;
  }
}

.welcome-content {
  position: relative;
  z-index: 1;
  text-align: center;
}
.welcome-title {
  font-size: 38px;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 32px;
  text-align: center;
  line-height: 1.2;
  position: relative;
  z-index: 1;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  letter-spacing: -0.5px;
}
.welcome-desc {
  color: rgba(255, 255, 255, 0.95);
  font-size: 18px;
  text-align: center;
  line-height: 1.8;
  margin-bottom: 48px;
  position: relative;
  z-index: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.features {
  display: flex;
  justify-content: center;
  gap: 32px;
  width: 100%;
  position: relative;
  z-index: 1;
}
.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  padding: 24px 20px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.4s ease;
  min-width: 120px;

  i {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.9;
  }

  span {
    font-size: 16px;
    font-weight: 600;
  }

  &:hover {
    transform: translateY(-8px) scale(1.05);
    background: rgba(255, 255, 255, 0.25);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  }
}



@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-10px) rotate(1deg); }
  66% { transform: translateY(5px) rotate(-1deg); }
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
