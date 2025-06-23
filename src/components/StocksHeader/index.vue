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

const goToHome = () => {
  router.push('/stocks-front/home')
}

const goToLogin = () => {
  router.push('/stocks-front/login')
}

const handleSearch = () => {
  console.log('搜索关键词：', searchKeyword.value)
}
</script>

<template>
  <div :class="prefixCls">
    <div :class="`${prefixCls}-left`" @click="goToHome">
      <template v-if="levelName && isUserLoggedIn">
        <el-tag type="info" effect="dark" class="level-tag">{{ levelName }}</el-tag>
      </template>
      <img src="@/assets/imgs/logo.png" alt="Logo" class="logo" />
      <span class="title">Nine Nine Six Network</span>
    </div>
    <div v-if="showSearch" :class="`${prefixCls}-search`">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索..."
        :prefix-icon="Search"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button :icon="Search" @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
    </div>
    <div :class="`${prefixCls}-right`">
      <template v-if="isUserLoggedIn">
        <StocksUserInfo />
      </template>
      <template v-else>
        <el-button type="primary" @click="goToLogin">登录/注册</el-button>
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
  padding: 0 20px;
  background: linear-gradient(90deg, #2d006b 0%, #3a1c71 100%);
  border-bottom: 1.5px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;

  &-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 200px;
    cursor: pointer;

    .level-tag {
      margin-right: 10px;
      font-size: 15px;
      font-weight: bold;
      padding: 6px 16px;
      border-radius: 16px;
      background: #fffbe6;
      color: #ff9800;
      border: none;
    }
    .logo {
      width: 40px;
      height: 40px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #fff;
      text-shadow: 2px 2px 8px #00000033;
      margin-left: 8px;
    }
    &:hover {
      .title {
        color: #ffe082;
      }
    }
  }

  &-search {
    flex: 1;
    max-width: 600px;
    margin: 0 20px;
  }
  
  &-right {
    display: flex;
    align-items: center;
  }
}
</style> 