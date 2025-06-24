<template>
  <div class="vip-bg">
    <StocksHeader />
    <div class="vip-cards vip-content">
      <div v-for="item in vipList" :key="item.id" class="vip-card">
        <div class="vip-title">{{ item.name }}</div>
        <div class="vip-tags">
          <span v-if="item.remark" class="vip-tag hot">{{ item.remark }}</span>
          <span v-if="item.vipType === VipTypeEnum.MONTH" class="vip-tag">月卡</span>
          <span v-if="item.vipType === VipTypeEnum.YEAR" class="vip-tag">年卡</span>
          <span v-if="item.vipType === VipTypeEnum.FOREVER" class="vip-tag warn">永久</span>
        </div>
        <div class="vip-price">￥{{ Number(item.price).toFixed(2) }}</div>
        <div class="vip-tip">此商品无限制购买</div>
        <div class="vip-info-row">
          <span>VIP类型</span>
          <span>{{ formatVipType(item.vipType) }}</span>
        </div>
        <div class="vip-info-row">
          <span>有效期</span>
          <span>{{ formatDuration(item.duration, item.vipType) }}</span>
        </div>
        <div class="vip-info-row">
          <span>支付方式</span>
          <span><i class="el-icon-alipay"></i> 支付宝</span>
        </div>
        <el-button
          type="primary"
          class="vip-btn"
          size="large"
          @click="handlePurchase(item)"
          :loading="purchaseLoading === item.id"
          >立即购买</el-button
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StocksHeader from '@/components/StocksHeader/index.vue'
import { ref, onMounted } from 'vue'
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

onMounted(() => {
  fetchVipList()
})
</script>

<style scoped lang="scss">
.vip-bg {
  min-height: 100vh;
  background: #f5f8ff;
  padding: 40px 0 0 0;
}
.vip-content {
  padding-top: 80px;
}
.vip-cards {
  display: flex;
  gap: 32px;
  justify-content: center;
  flex-wrap: wrap;
}
.vip-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px 0 rgba(80,120,255,0.08);
  width: 260px;
  padding: 28px 20px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
  transition: box-shadow 0.2s;
  &:hover {
    box-shadow: 0 8px 32px 0 rgba(80,120,255,0.18);
  }
}
.vip-title {
  font-size: 22px;
  font-weight: bold;
  color: #3a5cff;
  margin-bottom: 12px;
  text-align: center;
}
.vip-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
  justify-content: center;
}
.vip-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  background: #eaf1ff;
  color: #3a5cff;
  &.hot { background: #ffecb3; color: #ff9800; }
  &.warn { background: #ffeaea; color: #ff4d4f; }
  &.main { background: #eaf1ff; color: #3a5cff; }
}
.vip-price {
  font-size: 32px;
  font-weight: bold;
  color: #3a5cff;
  margin-bottom: 4px;
  text-align: center;
}
.vip-tip {
  color: #b0b0b0;
  font-size: 13px;
  margin-bottom: 10px;
}
.vip-info-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 14px;
  color: #333;
  margin-bottom: 2px;
  
  i {
    color: #1677FF;
    margin-right: 4px;
  }
}
.vip-desc {
  margin: 10px 0 18px 0;
  padding-left: 18px;
  color: #666;
  font-size: 13px;
  text-align: left;
  width: 100%;
}
.vip-btn {
  width: 100%;
  font-size: 16px;
  border-radius: 8px;
  margin-top: 16px;
}
</style>
