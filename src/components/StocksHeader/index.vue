<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import { ref, computed } from 'vue'
import { StocksUserInfo } from '@/components/StocksUserInfo'
import { useUserStore } from '@/store/modules/user'
import { getAccessToken } from '@/utils/auth'
import { useI18n } from '@/hooks/web/useI18n'
import { Search } from '@element-plus/icons-vue'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('stocks-header')
const router = useRouter()
const userStore = useUserStore()
const { t } = useI18n()
const searchKeyword = ref('')

defineProps({
  showSearch: {
    type: Boolean,
    default: true
  }
})

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

const goToLogin = () => {
  router.push('/stocks-front/login')
}

const goToUserDetail = () => {
  router.push('/stocks-front/userDetail')
}

const goToVipUpgrade = () => {
  router.push('/stocks-front/vip_upgrade')
}

const handleSearch = () => {
  console.log('搜索关键词：', searchKeyword.value)
}
</script>

<template>
  <div :class="prefixCls">
    <div :class="`${prefixCls}-left`">
      <div class="logo-container" @click="goToHome">
        <img src="@/assets/imgs/logo.png" alt="Logo" class="logo" />
        <span class="title">NineTube</span>
      </div>
    </div>
    
    <div v-if="showSearch" :class="`${prefixCls}-search`">
      <div class="search-container">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索视频、频道..."
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          class="search-input"
          clearable
        >
          <template #append>
            <el-button :icon="Search" @click="handleSearch" class="search-button">
              <span class="search-button-text">搜索</span>
            </el-button>
          </template>
        </el-input>
      </div>
    </div>
    <div :class="`${prefixCls}-right`">
      <div class="user-links" v-if="isUserLoggedIn">
        <el-button type="text" @click="goToUserDetail" class="nav-link">个人资料</el-button>
        <el-button type="text" @click="goToVipUpgrade" class="nav-link">购买VIP</el-button>
      </div>
      <template v-if="isUserLoggedIn">
        <div class="user-level" v-if="levelName">
          <el-tag :type="isVipUser ? 'warning' : 'info'" effect="dark" round>{{ levelName }}</el-tag>
        </div>
        <StocksUserInfo />
      </template>
      <template v-else>
        <el-button type="primary" @click="goToLogin" class="login-button">
          <i class="el-icon-user"></i>
          登录
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
  height: 60px;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;

  &-left {
    display: flex;
    align-items: center;
    min-width: 120px;

    .logo-container {
      display: flex;
      align-items: center;
      cursor: pointer;
      
      &:hover .title {
        color: #065fd4;
      }
    }
    
    .logo {
      width: 36px;
      height: 36px;
    }
    
    .title {
      font-size: 22px;
      font-weight: 600;
      color: #212121;
      margin-left: 4px;
      transition: color 0.2s;
    }
  }

  &-search {
    flex: 1;
    max-width: 640px;
    margin: 0 10px;
    
    .search-container {
      width: 100%;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        pointer-events: none;
        z-index: 1;
      }
    }
    
    .search-input {
      width: 100%;
      
      :deep(.el-input__wrapper) {
        padding-left: 16px;
        border-radius: 24px 0 0 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: all 0.3s;
        background-color: #f8f8f8;
        
        &.is-focus {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          background-color: #ffffff;
        }
      }
      
      :deep(.el-input__inner) {
        height: 42px;
        font-size: 15px;
        
        &::placeholder {
          color: #909399;
          font-size: 14px;
        }
      }
      
      :deep(.el-input__prefix) {
        font-size: 18px;
        color: #909399;
      }
      
      :deep(.el-input__suffix) {
        color: #909399;
      }
      
      :deep(.el-input-group__append) {
        border-radius: 0 24px 24px 0;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .search-button {
        height: 42px;
        background: linear-gradient(to right, #065fd4, #1976d2);
        border: none;
        padding: 0 20px;
        transition: all 0.3s;
        
        .el-icon {
          color: white;
          font-size: 18px;
          margin-right: 2px;
        }
        
        .search-button-text {
          color: white;
          font-weight: 500;
        }
        
        &:hover {
          background: linear-gradient(to right, #0d47a1, #1565c0);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      }
    }
  }
  
  &-right {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .user-links {
      display: flex;
      gap: 12px;
      
      .nav-link {
        font-size: 14px;
        color: #606060;
        
        &:hover {
          color: #065fd4;
        }
      }
    }
    
    .user-level {
      margin-right: 6px;
      
      .el-tag {
        font-weight: 500;
        padding: 0 12px;
        height: 24px;
        line-height: 22px;
      }
    }
    
    .login-button {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 18px;
      height: 36px;
      padding: 0 16px;
      background: transparent;
      color: #065fd4;
      border: 1px solid #065fd4;
      
      i {
        font-size: 16px;
      }
      
      &:hover {
        background-color: #e6f0ff;
      }
    }
  }
  
  @media (max-width: 768px) {
    padding: 0 16px;
    
    &-search {
      max-width: 400px;
      
      .search-button-text {
        display: none;
      }
      
      .search-button {
        padding: 0 15px;
      }
    }
    
    &-left .title {
      display: none;
    }
    
    &-right .user-links {
      display: none;
    }
  }
  
  @media (max-width: 576px) {
    &-left .nav-links .nav-item span {
      display: none;
    }
    
    &-left .nav-links .nav-item {
      padding: 8px 10px;
    }
  }
}
</style> 