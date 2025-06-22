<template>
  <div :class="prefixCls" class="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-blue-100 to-white">
    <div class="flex flex-col items-center w-full max-w-md p-8 bg-white rounded-2xl shadow-lg">
      <img alt="logo" class="mb-4 h-48px w-48px" src="@/assets/imgs/logo.png" />
      <div class="text-2xl font-bold mb-2">会员中心</div>
      <div class="text-gray-500 mb-6">欢迎登录或注册，体验更多精彩内容</div>
      <MemberLoginForm />
      <div class="flex justify-end w-full mt-4">
        <ThemeSwitch />
        <LocaleDropdown class="ml-2" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { ThemeSwitch } from '@/layout/components/ThemeSwitch'
import { LocaleDropdown } from '@/layout/components/LocaleDropdown'
import MemberLoginForm from './components/MemberLoginForm.vue'

defineOptions({ name: 'MemberLogin' })

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('login')
</script>

<style lang="scss" scoped>
.#{$namespace}-login {
  min-height: 100vh;
  background: linear-gradient(to bottom, #e0e7ff 0%, #fff 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
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
