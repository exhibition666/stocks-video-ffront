<script lang="ts" setup>
import { useUserStore } from '@/store/modules/user'
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import { StocksHeader } from '@/components/StocksHeader'
import avatarImg from '@/assets/imgs/avatar.gif'
import { computed, ref, onMounted } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getAccessUrl } from '@/api/infra/file'

defineOptions({
  name: 'UserDetail'
})

const router = useRouter()
const userStore = useUserStore()
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('user-detail')

// 从环境变量获取 configId
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID
console.log('OSS_CONFIG_ID from env:', OSS_CONFIG_ID)

// 获取用户信息
const userName = computed(() => userStore.user.nickname ?? 'Admin')
const userId = computed(() => userStore.user.id ?? '')
const userEmail = computed(() => userStore.user.email ?? '未设置')
const userAvatar = computed(() => userStore.user.avatar || avatarImg)
const userMobile = computed(() => userStore.user.mobile ?? '未设置')
const signedAvatarUrl = ref('')

const fetchSignedUrl = async (path: string) => {
  if (!path) return ''
  try {
    const res = await getAccessUrl(OSS_CONFIG_ID, path)
    return res.data
  } catch {
    return ''
  }
}

onMounted(async () => {
  signedAvatarUrl.value = await fetchSignedUrl(userStore.user.avatar)
})

// 返回首页
const goBack = () => {
  router.push('/stocks-front/home')
}
</script>

<template>
  <div :class="prefixCls">
    <!-- 顶部导航栏 -->
    <StocksHeader />
    
    <!-- 用户详情内容 -->
    <div :class="`${prefixCls}-content`">
      <div :class="`${prefixCls}-card`">
        <div :class="`${prefixCls}-title`">
          <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
          <h1>个人中心</h1>
        </div>
        
        <div :class="`${prefixCls}-info`">
          <div :class="`${prefixCls}-avatar`">
            <el-avatar :size="100" :src="signedAvatarUrl || avatarImg" />
          </div>
          
          <div :class="`${prefixCls}-details`">
            <el-descriptions title="用户信息" :column="1" border>
              <el-descriptions-item label="用户名">{{ userName }}</el-descriptions-item>
              <el-descriptions-item label="用户ID">{{ userId }}</el-descriptions-item>
              <el-descriptions-item label="手机号码">{{ userMobile }}</el-descriptions-item>
              <el-descriptions-item label="电子邮箱">{{ userEmail }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
        
        <div :class="`${prefixCls}-actions`">
          <el-button type="primary">修改信息</el-button>
          <el-button>修改密码</el-button>
        </div>
      </div>
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
  
  &-avatar {
    margin-right: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .el-avatar {
      margin-bottom: 15px;
    }
    
    @media (max-width: 768px) {
      margin-right: 0;
      margin-bottom: 20px;
    }
  }
  
  &-details {
    flex: 1;
  }
  
  &-actions {
    display: flex;
    justify-content: flex-start;
    gap: 15px;
    margin-top: 20px;
  }
}
</style>
