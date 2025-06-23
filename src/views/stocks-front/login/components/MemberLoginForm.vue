<template>
  <div class="member-login-form">
    <el-tabs v-model="activeTab" stretch>
      <el-tab-pane label="短信登录/注册" name="sms" />
      <el-tab-pane label="密码登录" name="password" />
    </el-tabs>

    <!-- 短信登录 -->
    <el-form v-show="activeTab === 'sms'" ref="smsFormRef" :model="smsFormData" :rules="smsFormRules" class="login-form">
      <el-form-item prop="mobile">
        <el-input v-model="smsFormData.mobile" size="large" placeholder="请输入手机号" />
      </el-form-item>
      <el-form-item prop="code">
        <el-input v-model="smsFormData.code" size="large" placeholder="请输入6位验证码">
          <template #append>
            <el-button :disabled="smsCodeDisabled" @click="handleSendSmsCode">
              {{ smsCodeText }}
            </el-button>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" :loading="loading" @click="handleSmsLogin" class="w-full">
          登录 / 注册
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 密码登录 -->
    <el-form v-show="activeTab === 'password'" ref="pwdFormRef" :model="pwdFormData" :rules="pwdFormRules" class="login-form">
      <el-form-item prop="mobile">
        <el-input v-model="pwdFormData.mobile" size="large" placeholder="请输入手机号" />
      </el-form-item>
      <el-form-item prop="password">
        <el-input v-model="pwdFormData.password" type="password" size="large" show-password placeholder="请输入密码" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" :loading="loading" @click="handlePasswordLogin" class="w-full">
          登录
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, FormInstance, FormRules } from 'element-plus'
import { sendSmsCode, smsLogin, login } from '@/api/member/auth'
import { setToken } from '@/utils/auth'
import { useUserStore } from '@/store/modules/user'
import { useRouter } from 'vue-router'
import { debugAuthState } from '@/utils/authDebugger'

const activeTab = ref('sms')
const loading = ref(false)
const router = useRouter()
const userStore = useUserStore()

// --- 短信登录 ---
const smsFormRef = ref<FormInstance>()
const smsFormData = reactive({ mobile: '', code: '' })
const smsFormRules = reactive<FormRules>({
  mobile: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  code: [{ required: true, message: '请输入验证码', trigger: 'blur' }]
})
const smsCodeText = ref('获取验证码')
const smsCodeDisabled = ref(false)

const handleSendSmsCode = async () => {
  await smsFormRef.value?.validateField('mobile')
  smsCodeDisabled.value = true
  try {
    await sendSmsCode({ mobile: smsFormData.mobile, scene: 1 }) // scene 21 for login/register
    ElMessage.success('验证码发送成功！')
    // 倒计时
    let count = 60
    smsCodeText.value = `${count}s后重试`
    const timer = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(timer)
        smsCodeText.value = '获取验证码'
        smsCodeDisabled.value = false
      } else {
        smsCodeText.value = `${count}s后重试`
      }
    }, 1000)
  } catch {
    smsCodeDisabled.value = false
  }
}

const handleSmsLogin = async () => {
  await smsFormRef.value?.validate()
  loading.value = true
  try {
    const res = await smsLogin(smsFormData)
    handleLoginSuccess(res)
  } finally {
    loading.value = false
  }
}

// --- 密码登录 ---
const pwdFormRef = ref<FormInstance>()
const pwdFormData = reactive({ mobile: '', password: '' })
const pwdFormRules = reactive<FormRules>({
  mobile: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
})

const handlePasswordLogin = async () => {
  await pwdFormRef.value?.validate()
  loading.value = true
  try {
    const res = await login(pwdFormData)
    handleLoginSuccess(res)
  } finally {
    loading.value = false
  }
}

// --- 通用登录成功处理 ---
const handleLoginSuccess = (res) => {
  console.group('===== 登录成功处理 =====')
  console.log('登录API响应:', res)
  
  console.log('设置 token 前的状态:')
  debugAuthState()
  
  // 设置 token
  setToken(res)
  console.log('设置 token 后的状态:')
  debugAuthState()
  
  // 强制延迟一下，确保 token 已经被设置
  setTimeout(() => {
    // 更新用户信息 - 使用 setMemberInfo 而不是 setUserInfoAction
    userStore.setMemberInfo().then(() => {
      console.log('更新会员信息后的状态:')
      debugAuthState()
      
      ElMessage.success('登录成功')
      router.push({ path: '/stocks-front/home' }) // 跳转到前台首页
      console.groupEnd()
    }).catch(error => {
      console.error('更新会员信息失败:', error)
      console.groupEnd()
      
      // 即使获取会员信息失败，也允许用户登录成功
      ElMessage.success('登录成功')
      router.push({ path: '/stocks-front/home' }) // 跳转到前台首页
    })
  }, 300) // 延迟300ms
}
</script>

<style lang="scss" scoped>
.member-login-form {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;

  .login-form {
    margin-top: 20px;
  }
}
</style> 
