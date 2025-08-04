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
    <div class="user-name-wrapper" @click="handleUserInteraction">
      <span class="user-name">
        {{ userName }}
      </span>
      <i class="el-icon-arrow-down dropdown-arrow"></i>
    </div>
    <template #dropdown>
      <ElDropdownMenu class="user-dropdown-menu">
        <ElDropdownItem @click="toUserDetail" class="dropdown-item profile-item">
          <Icon icon="ep:user" class="dropdown-icon" />
          <div class="item-content">
            <div class="item-title">个人中心</div>
            <div class="item-desc">查看和编辑个人信息</div>
          </div>
        </ElDropdownItem>
        <ElDropdownItem divided @click="loginOut" class="dropdown-item logout-item">
          <Icon icon="ep:switch-button" class="dropdown-icon" />
          <div class="item-content">
            <div class="item-title">退出登录</div>
            <div class="item-desc">安全退出当前账户</div>
          </div>
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

.user-name-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 20px;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .user-name {
    font-size: 15px;
    font-weight: 600;
    color: #5f6368;
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;

    @media (max-width: 991px) {
      display: none;
    }
  }

  .dropdown-arrow {
    font-size: 12px;
    color: #5f6368;
    transition: transform 0.3s ease;
  }

  &:hover .dropdown-arrow {
    transform: rotate(180deg);
  }
}

:deep(.user-dropdown-menu) {
  min-width: 240px;
  padding: 8px 0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.04);

  .dropdown-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin: 2px 8px;
    border-radius: 8px;
    transition: all 0.3s ease;
    cursor: pointer;

    .dropdown-icon {
      margin-right: 12px;
      font-size: 20px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .item-content {
      flex: 1;

      .item-title {
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 2px;
      }

      .item-desc {
        font-size: 12px;
        color: #909399;
        line-height: 1.2;
      }
    }

    &.profile-item {
      .dropdown-icon {
        color: #1a73e8;
        background: rgba(26, 115, 232, 0.1);
        border-radius: 6px;
      }

      &:hover {
        background: linear-gradient(135deg, #f1f5ff 0%, #e8f0fe 100%);

        .item-title {
          color: #1a73e8;
        }
      }
    }

    &.vip-item {
      .dropdown-icon {
        color: #ff9800;
        background: rgba(255, 152, 0, 0.1);
        border-radius: 6px;

        &.vip-icon {
          animation: sparkle 2s ease-in-out infinite;
        }
      }

      &:hover {
        background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);

        .item-title {
          color: #ff9800;
        }
      }
    }

    &.logout-item {
      .dropdown-icon {
        color: #f56565;
        background: rgba(245, 101, 101, 0.1);
        border-radius: 6px;
      }

      &:hover {
        background: linear-gradient(135deg, #fef5f5 0%, #fed7d7 100%);

        .item-title {
          color: #f56565;
        }
      }
    }
  }
}

@keyframes sparkle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.1) rotate(5deg); }
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