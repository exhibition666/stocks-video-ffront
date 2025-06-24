<template>
  <div class="cashier-bg">
    <StocksHeader />
    <div class="cashier-content">
      <!-- 支付信息 -->
      <el-card v-loading="loading">
        <el-descriptions title="支付信息" :column="3" border>
          <el-descriptions-item label="支付单号">{{ payOrder.id }}</el-descriptions-item>
          <el-descriptions-item label="商品标题">{{ payOrder.subject }}</el-descriptions-item>
          <el-descriptions-item label="商品内容">{{ payOrder.body }}</el-descriptions-item>
          <el-descriptions-item label="支付金额">
            ￥{{ (payOrder.price / 100.0).toFixed(2) }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(payOrder.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="过期时间">
            {{ formatDate(payOrder.expireTime) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 支付宝扫码支付区域 -->
      <el-card v-if="!qrCodeUrl" style="margin-top: 20px" v-loading="submitLoading" element-loading-text="生成支付二维码中...">
        <div class="qr-container">
          <div class="qr-title">
            <img :src="svg_alipay_qr" alt="支付宝扫码支付" class="qr-icon" />
            <span>请使用支付宝扫码完成支付</span>
          </div>
          <el-button type="primary" @click="generateQrCode" :loading="submitLoading" size="large">
            生成支付二维码
          </el-button>
        </div>
      </el-card>

      <!-- 显示支付宝二维码 -->
      <el-card v-else style="margin-top: 20px">
        <div class="qr-container">
          <div class="qr-title">
            <img :src="svg_alipay_qr" alt="支付宝扫码支付" class="qr-icon" />
            <span>请使用支付宝扫码完成支付</span>
          </div>
          <div class="qr-code-wrapper">
            <Qrcode :text="qrCodeUrl" :width="200" />
          </div>
          <div class="qr-tips">
            <p>1. 打开支付宝APP</p>
            <p>2. 点击右上角"+"号，选择"扫一扫"</p>
            <p>3. 扫描上方二维码完成支付</p>
          </div>
          <el-button type="primary" @click="refreshQrCode" :loading="submitLoading" size="large">
            刷新二维码
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script lang="ts" setup>
import StocksHeader from '@/components/StocksHeader/index.vue'
import { Qrcode } from '@/components/Qrcode'
import * as PayOrderApi from '@/api/pay/order'
import { PayChannelEnum, PayDisplayModeEnum, PayOrderStatusEnum } from '@/utils/constants'
import { formatDate } from '@/utils/formatTime'
import { useTagsViewStore } from '@/store/modules/tagsView'
import { useRoute, useRouter } from 'vue-router'
import { buyVipPackage } from '@/api/member/vip-package'
import { PayTypeEnum } from '@/api/member/vip-package/types'
import { useUserStore } from '@/store/modules/user'
import { watch, ref } from 'vue'

// 导入支付宝扫码图标
import svg_alipay_qr from '@/assets/svgs/pay/icon/alipay_qr.svg'

defineOptions({ name: 'PayCashier' })

const message = useMessage() // 消息弹窗
const route = useRoute()
const router = useRouter()
const { delView } = useTagsViewStore() // 视图操作
const userStore = useUserStore()

const id = ref(undefined) // 支付单号
const returnUrl = ref<string | undefined>(undefined) // 支付完的回调地址
const loading = ref(false) // 支付信息的 loading
const payOrder = ref({}) // 支付信息
const submitLoading = ref(false) // 提交支付的 loading
const interval = ref<any>(undefined) // 定时任务，轮询是否完成支付
const qrCodeUrl = ref('') // 支付宝扫码支付的二维码URL

/** 获得支付信息 */
const getDetail = async () => {
  // 1.1 未传递订单编号
  if (!id.value) {
    message.error('未传递支付单号，无法查看对应的支付信息')
    goReturnUrl('cancel')
    return
  }
  loading.value = true
  try {
    const data = await PayOrderApi.getOrder(id.value, true)
    payOrder.value = data
    // 1.2 无法查询到支付信息
    if (!data) {
      message.error('支付订单不存在，请检查！')
      goReturnUrl('cancel')
      return
    }
    // 1.3 如果已支付、或者已关闭，则直接跳转
    if (data.status === PayOrderStatusEnum.SUCCESS.status) {
      message.success('支付成功')
      goReturnUrl('success')
      return
    } else if (data.status === PayOrderStatusEnum.CLOSED.status) {
      message.error('无法支付，原因：订单已关闭')
      goReturnUrl('close')
      return
    }
  } catch (error: any) {
    message.error(error?.msg || '获取支付信息失败')
    goReturnUrl('cancel')
  } finally {
    loading.value = false
  }
}

/** 生成支付宝扫码支付二维码 */
const generateQrCode = async () => {
  submitLoading.value = true
  try {
    const formData = {
      id: id.value,
      channelCode: PayChannelEnum.ALIPAY_QR.code,
      returnUrl: location.href // 支付成功后，支付渠道跳转回当前页；再由当前页，跳转回 returnUrl 对应的地址
    }
    const data = await PayOrderApi.submitOrder(formData)
    
    // 直接返回已支付的情况
    if (data.status === PayOrderStatusEnum.SUCCESS.status) {
      await userStore.setMemberInfo()
      message.success('支付成功！')
      goReturnUrl('success')
      return
    }

    // 展示二维码
    if (data.displayMode === PayDisplayModeEnum.QR_CODE.mode) {
      qrCodeUrl.value = data.displayContent
      
      // 打开轮询任务
      createQueryInterval()
    } else {
      message.error('生成支付二维码失败，请刷新页面重试')
    }
  } catch (error: any) {
    message.error(error?.msg || '生成支付二维码失败')
  } finally {
    submitLoading.value = false
  }
}

/** 刷新二维码 */
const refreshQrCode = () => {
  qrCodeUrl.value = ''
  setTimeout(() => {
    generateQrCode()
  }, 100)
}

/** 轮询查询任务 */
const createQueryInterval = () => {
  if (interval.value) {
    return
  }
  interval.value = setInterval(async () => {
    try {
      const data = await PayOrderApi.getOrder(id.value, true)
      // 已支付
      if (data.status === PayOrderStatusEnum.SUCCESS.status) {
        clearQueryInterval()
        await userStore.setMemberInfo()
        message.success('支付成功！')
        goReturnUrl('success')
        return
      }
      // 已取消或关闭
      if (data.status === PayOrderStatusEnum.CLOSED.status) {
        clearQueryInterval()
        message.error('支付已关闭！')
        goReturnUrl('close')
        return
      }
    } catch (error: any) {
      clearQueryInterval()
      message.error(error?.msg || '查询支付状态失败')
      goReturnUrl('cancel')
    }
  }, 3000) // 每3秒查询一次
}

/** 清空查询任务 */
const clearQueryInterval = () => {
  clearInterval(interval.value)
  interval.value = undefined
}

/**
 * 回到业务的 URL
 *
 * @param payResult 支付结果
 *                  ① success：支付成功
 *                  ② cancel：取消支付
 *                  ③ close：支付已关闭
 */
const goReturnUrl = (payResult) => {
  // 清理任务
  clearQueryInterval()

  // 未配置的情况下，跳转到首页
  if (!returnUrl.value) {
    router.push('/stocks-front/home')
    return
  }

  // 构建返回URL
  const url = returnUrl.value.indexOf('?') >= 0
    ? returnUrl.value + '&payResult=' + payResult
    : returnUrl.value + '?payResult=' + payResult

  // 如果是外部链接，则浏览器跳转
  if (returnUrl.value.indexOf('http') === 0) {
    window.location.href = url
  } else {
    // 内部路由跳转
    router.push(url)
  }
}

/** 自动下单逻辑 */
onMounted(async () => {
  // 如果url带有packageId和payType，自动下单
  const packageId = route.query.packageId
  const payType = route.query.payType
  if (packageId && payType) {
    try {
      loading.value = true
      // buyVipPackage返回订单id
      const orderId = await buyVipPackage({ packageId: Number(packageId), payType: String(payType) })
      // 跳转自身并带上id参数
      await router.replace({ path: '/stocks-front/pay/cashier', query: { id: orderId } })
      return
    } catch (e: any) {
      message.error(e?.msg || '下单失败')
      loading.value = false
      return
    }
  }
  // 原有初始化逻辑
  id.value = route.query.id
  if (route.query.returnUrl) {
    returnUrl.value = decodeURIComponent(route.query.returnUrl as string)
  }
  getDetail()
}),

onUnmounted(() => {
  clearQueryInterval()
})

// 监听id变化，自动查单
watch(
  () => route.query.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      id.value = newId
      getDetail()
    }
  }
)
</script>

<style lang="scss" scoped>
.cashier-bg {
  min-height: 100vh;
  background: #f5f8ff;
}
.cashier-content {
  max-width: 900px;
  margin: 0 auto;
  padding-top: 80px;
}
.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
}
.qr-title {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
  
  .qr-icon {
    width: 40px;
    height: 40px;
    margin-right: 10px;
  }
  
  span {
    font-size: 18px;
    font-weight: 500;
    color: #333;
  }
}
.qr-code-wrapper {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}
.qr-tips {
  margin: 20px 0 30px;
  padding: 15px 25px;
  background: #f7f9ff;
  border-radius: 8px;
  width: 80%;
  
  p {
    margin: 8px 0;
    color: #666;
    font-size: 14px;
  }
}
</style>
