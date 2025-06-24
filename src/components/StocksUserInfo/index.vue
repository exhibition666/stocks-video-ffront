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
import { resetActivityTimer } from '@/utils/userActivity'

defineOptions({ name: 'StocksUserInfo' })

const { t } = useI18n()

const router = useRouter()

const userStore = useUserStore()

const tagsViewStore = useTagsViewStore()

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('user-info')

const avatar = computed(() => userStore.user?.avatar || avatarImg)
const userName = computed(() => userStore.user?.nickname ?? 'Admin')

// 锁定屏幕
const lockStore = useLockStore()
const getIsLock = computed(() => lockStore.getLockInfo?.isLock ?? false)
const dialogVisible = ref<boolean>(false)
const lockScreen = () => {
  dialogVisible.value = true
}

const loginOut = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await userStore.loginOut()
    tagsViewStore.delAllViews()
    // 修改重定向地址到股票前台首页，并使用window.location进行完全刷新
    window.location.href = '/stocks-front/home'
  } catch {}
}

const toUserDetail = () => {
  resetActivityTimer()
  router.push('/stocks-front/userDetail')
}

// 用户交互处理
const handleUserInteraction = () => {
  resetActivityTimer()
}
</script>

<template>
  <ElDropdown class="custom-hover" :class="prefixCls" trigger="click" @click="handleUserInteraction">
    <div class="user-avatar-wrapper" @click="handleUserInteraction">
      <ElAvatar :src="avatar" alt="" class="user-avatar" />
      <span class="user-name">
        {{ userName }}
      </span>
    </div>
    <template #dropdown>
      <ElDropdownMenu class="user-dropdown-menu">
        <ElDropdownItem @click="toUserDetail" class="dropdown-item">
          <Icon icon="ep:user" class="dropdown-icon" />
          <div>个人中心</div>
        </ElDropdownItem>
        <ElDropdownItem divided @click="loginOut" class="dropdown-item">
          <Icon icon="ep:switch-button" class="dropdown-icon" />
          <div>退出登录</div>
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

.user-avatar-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 22px;
  transition: all 0.3s;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .user-name {
    padding-left: 8px;
    font-size: 14px;
    color: #333;
    max-width: 100px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    
    @media (max-width: 991px) {
      display: none;
    }
  }
}

:deep(.user-dropdown-menu) {
  min-width: 150px;
  padding: 5px 0;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  
  .dropdown-item {
    display: flex;
    align-items: center;
    padding: 10px 15px;
    
    .dropdown-icon {
      margin-right: 8px;
      font-size: 18px;
    }
    
    &:hover {
      background-color: #f5f7fa;
    }
  }
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