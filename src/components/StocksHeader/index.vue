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
      <img src="@/assets/imgs/logo.png" alt="Logo" class="logo" />
      <span class="title">股票交易系统</span>
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
      <!-- 根据登录状态显示不同的内容 -->
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
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
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

    .logo {
      width: 40px;
      height: 40px;
    }

    .title {
      font-size: 20px;
      font-weight: bold;
      color: var(--el-text-color-primary);
    }

    &:hover {
      .title {
        color: var(--el-color-primary);
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