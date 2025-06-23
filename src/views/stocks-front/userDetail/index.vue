<script lang="ts" setup>
import { useUserStore } from '@/store/modules/user'
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import StocksHeader from '@/components/StocksHeader/index.vue'
import avatarImg from '@/assets/imgs/avatar.gif'
import { computed, ref, onMounted } from 'vue'
import { ArrowLeft, Edit, Key } from '@element-plus/icons-vue'
import { getAccessUrl } from '@/api/infra/file'
import * as UserApi from '@/api/member/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('user-detail')

const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID

// 会员信息
const userInfo = ref<UserApi.UserVO | null>(null)
const signedAvatarUrl = ref('')
const loading = ref(false)

const fetchSignedUrl = async (path: string) => {
  if (!path) return ''
  try {
    const res = await getAccessUrl(OSS_CONFIG_ID, path)
    return res.accessUrl || ''
  } catch {
    return ''
  }
}

const fetchUserInfo = async () => {
  loading.value = true
  try {
    const res = await UserApi.getCurrentUser()
    userInfo.value = res
    signedAvatarUrl.value = await fetchSignedUrl(res.avatar)
  } catch (e) {
    ElMessage.error('获取会员信息失败')
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchUserInfo)

// 返回首页
const goBack = () => {
  router.push('/stocks-front/home')
}

// 编辑信息弹窗
const editDialogVisible = ref(false)
const editForm = ref({ nickname: '', avatar: '', sex: 1 })
const editLoading = ref(false)
const openEditDialog = () => {
  if (!userInfo.value) return
  editForm.value = {
    nickname: userInfo.value.nickname || '',
    avatar: userInfo.value.avatar || '',
    sex: userInfo.value.sex || 1
  }
  editDialogVisible.value = true
}
const handleEditSubmit = async () => {
  editLoading.value = true
  try {
    await UserApi.updateUser(editForm.value)
    ElMessage.success('信息修改成功')
    editDialogVisible.value = false
    fetchUserInfo()
  } catch {
    ElMessage.error('信息修改失败')
  } finally {
    editLoading.value = false
  }
}

// 密码修改弹窗
const pwdDialogVisible = ref(false)
const pwdForm = ref({ password: '', code: '' })
const pwdLoading = ref(false)
const handlePwdSubmit = async () => {
  pwdLoading.value = true
  try {
    await UserApi.updateUserPassword(pwdForm.value)
    ElMessage.success('密码修改成功')
    pwdDialogVisible.value = false
    pwdForm.value = { password: '', code: '' }
  } catch {
    ElMessage.error('密码修改失败')
  } finally {
    pwdLoading.value = false
  }
}

// 发送验证码（调用会员短信接口）
import { sendSmsCode } from '@/api/member/auth'
const sendCodeLoading = ref(false)
const sendCode = async () => {
  if (!userInfo.value?.mobile) return ElMessage.error('未绑定手机号')
  sendCodeLoading.value = true
  try {
    await sendSmsCode({ mobile: userInfo.value.mobile, scene: 3 })
    ElMessage.success('验证码已发送')
  } catch (e: any) {
    ElMessage.error(e?.msg || '验证码发送失败')
  } finally {
    sendCodeLoading.value = false
  }
}
</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />
    <div :class="`${prefixCls}-content`">
      <el-card :loading="loading" :class="`${prefixCls}-card`">
        <div :class="`${prefixCls}-title`">
          <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
          <h1>个人中心</h1>
        </div>
        <div :class="`${prefixCls}-info`">
          <div :class="`${prefixCls}-avatar-wrap`">
            <el-tag
              v-if="userInfo?.level && userInfo.level.name"
              type="info"
              effect="dark"
              class="level-tag"
            >
              {{ userInfo.level.name }}
            </el-tag>
            <el-avatar :size="100" :src="signedAvatarUrl || avatarImg" />
            <el-button type="primary" :icon="Edit" size="small" @click="openEditDialog" style="margin-top: 10px;">编辑信息</el-button>
          </div>
          <div :class="`${prefixCls}-details`">
            <el-descriptions title="会员信息" :column="2" border>
              <el-descriptions-item label="昵称" v-if="userInfo?.nickname">{{ userInfo.nickname }}</el-descriptions-item>
              <el-descriptions-item label="手机号" v-if="userInfo?.mobile">{{ userInfo.mobile }}</el-descriptions-item>
              <el-descriptions-item label="性别" v-if="userInfo?.sex !== undefined && userInfo?.sex !== null">
                <el-tag v-if="userInfo.sex === 1" type="success">男</el-tag>
                <el-tag v-else-if="userInfo.sex === 2" type="warning">女</el-tag>
                <el-tag v-else type="info">未知</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="会员等级" v-if="userInfo?.level && userInfo.level.name">{{ userInfo.level.name }}</el-descriptions-item>
              <el-descriptions-item label="经验值" v-if="userInfo?.experience !== undefined && userInfo?.experience !== null">{{ userInfo.experience }}</el-descriptions-item>
              <el-descriptions-item label="当前积分" v-if="userInfo?.point !== undefined && userInfo?.point !== null">{{ userInfo.point }}</el-descriptions-item>
              <el-descriptions-item label="分销功能" v-if="userInfo?.brokerageEnabled !== undefined">
                <el-tag v-if="userInfo.brokerageEnabled" type="success">已开启</el-tag>
                <el-tag v-else type="info">未开启</el-tag>
              </el-descriptions-item>
            </el-descriptions>
            <div style="margin-top: 20px;">
              <el-button type="danger" :icon="Key" @click="pwdDialogVisible = true">修改密码</el-button>
            </div>
          </div>
        </div>
      </el-card>

      <!-- 编辑信息弹窗 -->
      <el-dialog v-model="editDialogVisible" title="编辑会员信息" width="400px" :close-on-click-modal="false">
        <el-form :model="editForm" label-width="80px">
          <el-form-item label="昵称">
            <el-input v-model="editForm.nickname" maxlength="20" />
          </el-form-item>
          <el-form-item label="头像">
            <el-input v-model="editForm.avatar" placeholder="请输入头像URL" />
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="editForm.sex">
              <el-radio :label="1">男</el-radio>
              <el-radio :label="2">女</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="editLoading" @click="handleEditSubmit">保存</el-button>
        </template>
      </el-dialog>

      <!-- 修改密码弹窗 -->
      <el-dialog v-model="pwdDialogVisible" title="修改密码" width="400px" :close-on-click-modal="false">
        <el-form :model="pwdForm" label-width="80px">
          <el-form-item label="新密码">
            <el-input v-model="pwdForm.password" type="password" show-password maxlength="32" />
          </el-form-item>
          <el-form-item label="验证码">
            <el-input v-model="pwdForm.code" maxlength="6" style="width: 180px; margin-right: 10px;" />
            <el-button :loading="sendCodeLoading" @click="sendCode">发送验证码</el-button>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="pwdDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="pwdLoading" @click="handlePwdSubmit">修改</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-user-detail;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f5f5;
  &-content {
    width: 100%;
    max-width: 1200px;
    margin: 80px auto 0;
    padding: 20px;
  }
  &-card {
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    padding: 20px;
  }
  &-title {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid #eee;
    padding-bottom: 15px;
    h1 {
      margin: 0 0 0 20px;
      font-size: 22px;
      font-weight: 500;
    }
  }
  &-info {
    display: flex;
    margin-bottom: 30px;
    @media (max-width: 768px) {
      flex-direction: column;
    }
  }
  &-avatar-wrap {
    margin-right: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    .level-tag {
      position: absolute;
      left: -80px;
      top: 40px;
      font-size: 15px;
      font-weight: bold;
      padding: 6px 16px;
      border-radius: 16px;
    }
    .el-avatar {
      margin-bottom: 15px;
    }
    @media (max-width: 768px) {
      margin-right: 0;
      margin-bottom: 20px;
      .level-tag {
        position: static;
        margin-bottom: 10px;
      }
    }
  }
  &-details {
    flex: 1;
  }
}
</style>
