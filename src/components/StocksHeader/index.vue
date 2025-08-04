<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import { ref, computed } from 'vue'
import { StocksUserInfo } from '@/components/StocksUserInfo'
import { useUserStore } from '@/store/modules/user'
import { getAccessToken } from '@/utils/auth'
import { useI18n } from '@/hooks/web/useI18n'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('stocks-header')
const router = useRouter()
const userStore = useUserStore()
const { t } = useI18n()

// 判断用户是否已登录
const isUserLoggedIn = computed(() => {
  return !!getAccessToken()
})

// 获取用户等级名称
const levelName = computed(() => {
  return userStore.user?.level?.name || ''
})

// 计算是否为VIP用户
const isVipUser = computed(() => {
  if (!userStore.user) return false
  const levelName = userStore.user.level?.name || ''
  const levelId = userStore.user.level?.id || userStore.user.level_id || userStore.user.levelId
  return levelName.includes('VIP') || levelName.includes('vip') || (levelId && levelId > 1)
})

const goToHome = () => {
  router.push('/stocks-front/home')
}

const goToVideo = () => {
  router.push('/stocks-front/video')
}

const goToInquiry = () => {
  router.push('/stocks-front/inquiry')
}

const goToLogin = () => {
  router.push('/stocks-front/login')
}

const goToUserDetail = () => {
  router.push('/stocks-front/userDetail')
}

const goToVipUpgrade = () => {
  router.push('/stocks-front/vip_upgrade')
}
</script>

<template>
  <div :class="prefixCls">
    <div :class="`${prefixCls}-left`">
      <div class="logo-container" @click="goToHome">
        <span class="title">股票期权系统</span>
      </div>
      
      <div class="nav-links">
        <router-link to="/stocks-front/home" class="nav-item" active-class="active">
          <span>首页</span>
        </router-link>
        <router-link to="/stocks-front/inquiry" class="nav-item" active-class="active">
          <span>期权询价</span>
        </router-link>
        <router-link to="/stocks-front/video" class="nav-item" active-class="active">
          <span>视频教学</span>
        </router-link>
        <router-link v-if="isUserLoggedIn" to="/stocks-front/vip_upgrade" class="nav-item" active-class="active">
          <span>购买VIP</span>
        </router-link>
      </div>
    </div>
    
    <div :class="`${prefixCls}-right`">
      <template v-if="isUserLoggedIn">
        <div class="user-level" v-if="levelName">
          <el-tag :type="isVipUser ? 'warning' : 'info'" effect="dark" round>{{ levelName }}</el-tag>
        </div>
        <StocksUserInfo />
      </template>
      <template v-else>
        <el-button type="primary" @click="goToLogin" class="login-button">
          <i class="el-icon-user"></i>
          <span>登录</span>
        </el-button>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-stocks-header;

.#{$prefix-cls} {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 70px;
  padding: 0 32px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(232, 234, 237, 0.8);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1000;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;

  &-left {
    display: flex;
    align-items: center;

    .logo-container {
      display: flex;
      align-items: center;
      cursor: pointer;
      margin-right: 40px;
      transition: all 0.3s ease;

      &:hover {
        transform: scale(1.05);

        .title {
          color: #1a73e8;
        }
      }
    }



    .title {
      font-size: 26px;
      font-weight: 800;
      background: linear-gradient(135deg, #1a73e8 0%, #34a853 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transition: all 0.3s ease;
      letter-spacing: -0.5px;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 4px;

      .nav-item {
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #5f6368;
        transition: all 0.3s ease;
        position: relative;
        text-decoration: none;

        &:hover {
          background: linear-gradient(135deg, #f1f5ff 0%, #e8f0fe 100%);
          color: #1a73e8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(26, 115, 232, 0.15);
        }

        &.active {
          background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);
          color: white;
          font-weight: 700;
          box-shadow: 0 4px 15px rgba(26, 115, 232, 0.3);

          &::after {
            content: '';
            position: absolute;
            bottom: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 6px;
            height: 6px;
            background: #34a853;
            border-radius: 50%;
          }
        }


      }
    }
  }
  
  &-right {
    display: flex;
    align-items: center;
    gap: 20px;

    .user-level {
      margin-right: 8px;

      .el-tag {
        font-weight: 700;
        padding: 0 16px;
        height: 32px;
        line-height: 30px;
        border-radius: 16px;
        font-size: 13px;
        border: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

        &.el-tag--warning {
          background: linear-gradient(135deg, #fbbc04 0%, #ff9800 100%);
          color: white;
        }

        &.el-tag--info {
          background: linear-gradient(135deg, #9aa0a6 0%, #5f6368 100%);
          color: white;
        }
      }
    }

    .login-button {
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 25px;
      height: 44px;
      padding: 0 24px;
      background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);
      color: white;
      border: none;
      font-weight: 700;
      font-size: 15px;
      box-shadow: 0 4px 15px rgba(26, 115, 232, 0.3);
      transition: all 0.3s ease;

      i {
        font-size: 18px;
      }

      &:hover {
        background: linear-gradient(135deg, #1557b0 0%, #3367d6 100%);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(26, 115, 232, 0.4);
      }
    }
  }
  
  @media (max-width: 1024px) {
    padding: 0 24px;

    &-left {
      .logo-container {
        margin-right: 30px;
      }

      .nav-links .nav-item {
        padding: 10px 16px;
        font-size: 14px;
      }
    }
  }

  @media (max-width: 768px) {
    padding: 0 20px;
    height: 60px;

    &-left {
      .logo-container {
        margin-right: 20px;
      }

      .title {
        font-size: 20px;
      }

      .nav-links .nav-item {
        padding: 8px 12px;
        font-size: 14px;

        span {
          display: block;
        }
      }
    }

    &-right {
      gap: 12px;

      .login-button {
        height: 36px;
        padding: 0 16px;
        font-size: 14px;
      }
    }
  }

  @media (max-width: 576px) {
    padding: 0 16px;

    &-left {
      .title {
        display: none;
      }

      .nav-links .nav-item {
        padding: 8px 10px;
        border-radius: 20px;
        font-size: 12px;
      }
    }

    &-right {
      .user-level .el-tag {
        padding: 0 8px;
        height: 28px;
        line-height: 26px;
        font-size: 12px;
      }

      .login-button {
        height: 32px;
        padding: 0 12px;
        font-size: 13px;

        span {
          display: none;
        }
      }
    }
  }
}

@keyframes sparkle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.1) rotate(5deg); }
}
</style> 