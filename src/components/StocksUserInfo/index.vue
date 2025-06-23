<script lang="ts" setup>
import { ElMessageBox } from 'element-plus'
import { ref, computed } from 'vue'
import avatarImg from '@/assets/imgs/avatar.gif'
import { useDesign } from '@/hooks/web/useDesign'
import { useTagsViewStore } from '@/store/modules/tagsView'
import { useUserStore } from '@/store/modules/user'
import LockDialog from '@/layout/components/UserInfo/src/components/LockDialog.vue'
import LockPage from '@/layout/components/UserInfo/src/components/LockPage.vue'
import { useLockStore } from '@/store/modules/lock'
import { useI18n } from '@/hooks/web/useI18n'
import { useRouter } from 'vue-router'
import { Icon } from '@/components/Icon'

defineOptions({ name: 'StocksUserInfo' })

const { t } = useI18n()

const router = useRouter()

const userStore = useUserStore()

const tagsViewStore = useTagsViewStore()

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('user-info')

const avatar = computed(() => userStore.user?.avatar || avatarImg)
const userName = computed(() => userStore.user?.nickname ?? 'Admin')
const levelName = computed(() => userStore.user?.level?.name || '')

// 锁定屏幕
const lockStore = useLockStore()
const getIsLock = computed(() => lockStore.getLockInfo?.isLock ?? false)
const dialogVisible = ref<boolean>(false)
const lockScreen = () => {
  dialogVisible.value = true
}

const loginOut = async () => {
  try {
    await ElMessageBox.confirm(t('common.loginOutMessage'), t('common.reminder'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    await userStore.loginOut()
    tagsViewStore.delAllViews()
    // 修改重定向地址到股票前台首页，并使用window.location进行完全刷新
    window.location.href = '/stocks-front/home'
  } catch {}
}

const toUserDetail = () => {
  console.log('正在跳转到用户详情页') // 添加日志
  router.push('/stocks-front/userDetail')
}

const toAdminBackend = () => {
  window.open('http://localhost:8009/index', '_blank')
}
</script>

<template>
  <ElDropdown class="custom-hover" :class="prefixCls" trigger="click">
    <div class="flex items-center">
      <ElAvatar :src="avatar" alt="" class="w-[calc(var(--logo-height)-25px)] rounded-[50%]" />
      <span class="pl-[5px] text-14px text-[var(--top-header-text-color)] <lg:hidden">
        {{ userName }}
      </span>
      <el-tag v-if="levelName" type="info" effect="dark" class="level-tag ml-2">{{ levelName }}</el-tag>
    </div>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem @click="toUserDetail">
          <Icon icon="ep:user" />
          <div>个人中心</div>
        </ElDropdownItem>
        <ElDropdownItem @click="toAdminBackend">
          <Icon icon="ep:setting" />
          <div>后台管理</div>
        </ElDropdownItem>
        <ElDropdownItem divided @click="loginOut">
          <Icon icon="ep:switch-button" />
          <div>退出系统</div>
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>

  <LockDialog v-if="dialogVisible" v-model="dialogVisible" />

  <teleport to="body">
    <transition name="fade-bottom" mode="out-in">
      <LockPage v-if="getIsLock" />
    </transition>
  </teleport>
</template>

<style scoped lang="scss">
.level-tag {
  margin-right: 10px;
  font-size: 15px;
  font-weight: bold;
  padding: 6px 16px;
  border-radius: 16px;
}
.fade-bottom-enter-active,
.fade-bottom-leave-active {
  transition:
    opacity 0.25s,
    transform 0.3s;
}

.fade-bottom-enter-from {
  opacity: 0;
  transform: translateY(-10%);
}

.fade-bottom-leave-to {
  opacity: 0;
  transform: translateY(10%);
}
</style> 