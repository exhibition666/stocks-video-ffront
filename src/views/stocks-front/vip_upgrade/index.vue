<template>
  <div class="vip-bg">
    <StocksHeader />

    <!-- 永久VIP提示 -->
    <div v-if="isPermanentVip" class="permanent-vip-notice">
      <div class="notice-content">
        <div class="notice-icon">
          <i class="el-icon-crown"></i>
        </div>
        <div class="notice-text">
          <h3>您已经是永久VIP会员</h3>
          <p>恭喜您！您已拥有永久VIP权限，可以享受所有服务功能</p>
          <el-button
            type="primary"
            size="large"
            @click="goToHome"
            class="home-btn"
          >
            返回首页
          </el-button>
        </div>
      </div>
    </div>

    <!-- 页面标题 -->
    <div v-else class="page-header">
      <div class="header-content">
        <h1 class="page-title">升级VIP会员</h1>
        <p class="page-subtitle">解锁更多专业功能，享受优质投资服务</p>
      </div>
    </div>

    <!-- VIP套餐列表 -->
    <div v-if="!isPermanentVip" class="vip-cards vip-content">
      <div v-for="item in vipList" :key="item.id" class="vip-card" :class="{ 'popular': item.vipType === VipTypeEnum.YEAR }">
        <div v-if="item.vipType === VipTypeEnum.YEAR" class="popular-badge">
          <i class="el-icon-star-filled"></i>
          <span>推荐</span>
        </div>

        <div class="card-header">
          <div class="vip-title">{{ item.name }}</div>
          <div class="vip-tags">
            <span v-if="item.remark" class="vip-tag hot">{{ item.remark }}</span>
            <span v-if="item.vipType === VipTypeEnum.MONTH" class="vip-tag">月卡</span>
            <span v-if="item.vipType === VipTypeEnum.YEAR" class="vip-tag popular">年卡</span>
            <span v-if="item.vipType === VipTypeEnum.FOREVER" class="vip-tag premium">永久</span>
          </div>
        </div>

        <div class="card-body">
          <div class="price-section">
            <div class="vip-price">￥{{ Number(item.price).toFixed(2) }}</div>
            <div class="price-unit">{{ item.vipType === VipTypeEnum.FOREVER ? '一次性付费' : '/' + formatVipType(item.vipType) }}</div>
          </div>

          <div class="features-list">
            <div class="feature-item">
              <i class="el-icon-check"></i>
              <span>无限制观看所有视频</span>
            </div>
            <div class="feature-item">
              <i class="el-icon-check"></i>
              <span>专业期权策略分析</span>
            </div>
            <div class="feature-item">
              <i class="el-icon-check"></i>
              <span>实时市场数据推送</span>
            </div>
            <div class="feature-item" v-if="item.vipType !== VipTypeEnum.MONTH">
              <i class="el-icon-check"></i>
              <span>专属客服支持</span>
            </div>
            <div class="feature-item" v-if="item.vipType === VipTypeEnum.FOREVER">
              <i class="el-icon-check"></i>
              <span>终身免费更新</span>
            </div>
          </div>

          <div class="vip-info">
            <div class="info-row">
              <div class="info-item">
                <span class="info-label">有效期：</span>
                <span class="info-value">{{ formatDuration(item.duration, item.vipType) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">支付方式：</span>
                <span class="info-value">
                  <i class="el-icon-alipay"></i>
                  支付宝
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <el-button
            type="primary"
            class="vip-btn"
            size="large"
            @click="handlePurchase(item)"
            :loading="purchaseLoading === item.id"
          >
            <i class="el-icon-shopping-cart-2"></i>
            立即购买
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StocksHeader from '@/components/StocksHeader/index.vue'
import { ref, onMounted, computed } from 'vue'
import { getVipPackageList, buyVipPackage } from '@/api/member/vip-package'
import { VipPackage, VipTypeEnum, PayTypeEnum } from '@/api/member/vip-package/types'
import { useRouter } from 'vue-router'
import { useMessage } from '@/hooks/web/useMessage'
import { useUserStore } from '@/store/modules/user'
import { getAccessToken } from '@/utils/auth'

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()
const vipList = ref<VipPackage[]>([])
const loading = ref(false)
const purchaseLoading = ref<number | null>(null)

// 判断是否为永久VIP用户
const isPermanentVip = computed(() => {
  if (!userStore.user) return false

  // 检查用户等级名称是否包含"永久"关键字
  const levelName = userStore.user.level?.name || ''
  const isPermanentByName = levelName.includes('永久') ||
                           levelName.includes('FOREVER') ||
                           levelName.includes('forever') ||
                           levelName.includes('永久VIP') ||
                           levelName.includes('终身VIP') ||
                           levelName.includes('终身')

  // 检查VIP到期时间
  const vipExpireTime = userStore.user.vipExpireTime || userStore.user.vip_expire_time || userStore.user.expireTime
  const isVipUser = levelName.includes('VIP') || levelName.includes('vip') || (userStore.user.level?.id && userStore.user.level.id > 1)

  // 如果用户等级名称包含永久关键字，则认为是永久VIP
  if (isPermanentByName) return true

  // 如果是VIP用户但没有到期时间，也可能是永久VIP（需要进一步验证）
  if (isVipUser && !vipExpireTime) {
            // console.log('检测到VIP用户但无到期时间，可能是永久VIP')
    return true
  }

  // 如果有到期时间，检查是否为遥远的未来时间（比如2099年），这通常表示永久VIP
  if (vipExpireTime) {
    const expireDate = new Date(vipExpireTime)
    const year2099 = new Date('2099-01-01')
    if (expireDate >= year2099) {
      // console.log('检测到VIP到期时间为遥远未来，认为是永久VIP')
      return true
    }
  }

  return false
})

// 格式化VIP类型
const formatVipType = (type: string) => {
  switch (type) {
    case VipTypeEnum.MONTH:
      return '月卡'
    case VipTypeEnum.YEAR:
      return '年卡'
    case VipTypeEnum.FOREVER:
      return '永久'
    default:
      return type
  }
}

// 格式化时长显示
const formatDuration = (duration: number, type: string) => {
  if (type === VipTypeEnum.FOREVER) {
    return '永久有效'
  }
  return `${duration}天`
}

// 获取VIP套餐列表
const fetchVipList = async () => {
  loading.value = true
  try {
    const res = await getVipPackageList()
    vipList.value = res || []
  } finally {
    loading.value = false
  }
}

// 返回首页
const goToHome = () => {
  router.push('/stocks-front/home')
}

// 点击购买按钮
const handlePurchase = async (item: VipPackage) => {
  if (!getAccessToken()) {
    message.error('请先登录再进行购买')
    await router.push({ path: '/stocks-front/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  
  purchaseLoading.value = item.id
  try {
    // 默认使用支付宝支付
    const payType = PayTypeEnum.ALIPAY
    
    // 直接调用购买API
    const orderId = await buyVipPackage({ packageId: item.id, payType })
    
    // 跳转到收银台页面
    await router.push({
      path: '/stocks-front/pay/cashier',
      query: { id: orderId }
    })
  } catch (error: any) {
    message.error(error?.msg || '下单失败')
  } finally {
    purchaseLoading.value = null
  }
}

onMounted(async () => {
  // 确保用户信息已加载
  if (getAccessToken() && !userStore.user) {
    await userStore.setMemberInfo()
  }

  // 获取VIP套餐列表
  fetchVipList()
})
</script>

<style scoped lang="scss">
.vip-bg {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 0;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }
}

.page-header {
  padding: 120px 20px 60px;
  text-align: center;
  position: relative;
  z-index: 2;

  .header-content {
    max-width: 800px;
    margin: 0 auto;

    .page-title {
      font-size: 48px;
      font-weight: 800;
      color: white;
      margin: 0 0 20px 0;
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      letter-spacing: -1px;
    }

    .page-subtitle {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
  }
}

.vip-content {
  padding: 0 20px 80px;
  position: relative;
  z-index: 2;
}

.vip-cards {
  display: flex;
  gap: 30px;
  justify-content: center;
  flex-wrap: wrap;
  max-width: 1200px;
  margin: 0 auto;
}

.vip-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  width: 320px;
  padding: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 32px;
  transition: all 0.4s ease;
  border: 1px solid rgba(255, 255, 255, 0.3);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-10px) scale(1.02);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
  }

  &.popular {
    border: 2px solid #ff9800;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff9800 0%, #f57c00 100%);
    }
  }
}
.popular-badge {
  position: absolute;
  top: 20px;
  right: -30px;
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  padding: 8px 40px;
  font-size: 12px;
  font-weight: 600;
  transform: rotate(45deg);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);

  i {
    margin-right: 4px;
    font-size: 10px;
  }
}

.card-header {
  padding: 30px 30px 20px;
  text-align: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);

  .vip-title {
    font-size: 28px;
    font-weight: 800;
    color: #2c3e50;
    margin-bottom: 15px;
  }

  .vip-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;

    .vip-tag {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: 600;

      &.hot {
        background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
        color: white;
      }
      &.popular {
        background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
        color: white;
      }
      &.premium {
        background: linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%);
        color: white;
      }
      &:not(.hot):not(.popular):not(.premium) {
        background: #e3f2fd;
        color: #1976d2;
      }
    }
  }
}

.card-body {
  padding: 30px;
  flex: 1;

  .price-section {
    text-align: center;
    margin-bottom: 30px;

    .vip-price {
      font-size: 48px;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 5px;
      line-height: 1;
    }

    .price-unit {
      font-size: 14px;
      color: #6c757d;
      font-weight: 500;
    }
  }

  .features-list {
    margin-bottom: 30px;

    .feature-item {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      font-size: 15px;
      color: #495057;

      i {
        color: #4caf50;
        margin-right: 12px;
        font-size: 16px;
        font-weight: bold;
      }
    }
  }

  .vip-info {
    border-top: 1px solid #e9ecef;
    padding-top: 20px;

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex: 1;
      font-size: 14px;

      .info-label {
        color: #6c757d;
        font-weight: 500;
        margin-bottom: 4px;
      }

      .info-value {
        color: #495057;
        font-weight: 600;

        i {
          color: #1677FF;
          margin-right: 4px;
        }
      }
    }
  }
}

.card-footer {
  padding: 0 30px 30px;

  .vip-btn {
    width: 100%;
    height: 50px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 25px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    transition: all 0.3s ease;

    i {
      margin-right: 8px;
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }
  }
}

/* 永久VIP提示样式 */
.permanent-vip-notice {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 200px);
  padding: 40px 20px;
}

.notice-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 60px 40px;
  text-align: center;
  color: white;
  box-shadow: 0 20px 40px rgba(26, 115, 232, 0.4);
  max-width: 500px;
  width: 100%;
  border: 3px solid rgba(255, 255, 255, 0.2);
}

.notice-icon {
  font-size: 80px;
  margin-bottom: 20px;
  color: #ffd700;
}

.notice-icon i {
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.notice-text h3 {
  font-size: 28px;
  font-weight: bold;
  margin: 0 0 15px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.notice-text p {
  font-size: 16px;
  margin: 0 0 30px 0;
  opacity: 0.9;
  line-height: 1.6;
}

.home-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 16px;
  padding: 12px 30px;
  border-radius: 25px;
  transition: all 0.3s ease;
}

.home-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

// 响应式设计
@media (max-width: 768px) {
  .page-header {
    padding: 100px 20px 40px;

    .page-title {
      font-size: 36px;
    }

    .page-subtitle {
      font-size: 18px;
    }
  }

  .vip-cards {
    gap: 20px;
    padding: 0 10px;
  }

  .vip-card {
    width: 100%;
    max-width: 350px;

    .card-header {
      padding: 25px 20px 15px;

      .vip-title {
        font-size: 24px;
      }
    }

    .card-body {
      padding: 20px;

      .price-section .vip-price {
        font-size: 40px;
      }
    }

    .card-footer {
      padding: 0 20px 20px;
    }
  }

  .notice-content {
    padding: 40px 30px;
    margin: 0 20px;

    .notice-icon {
      font-size: 60px;
    }

    .notice-text h3 {
      font-size: 24px;
    }

    .notice-text p {
      font-size: 14px;
    }
  }
}
</style>
