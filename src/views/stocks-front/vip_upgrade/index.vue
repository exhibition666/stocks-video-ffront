<template>
  <div class="vip-bg">
    <StocksHeader />
    <div class="vip-cards vip-content">
      <div v-for="(item, idx) in vipList" :key="idx" class="vip-card">
        <div class="vip-title">{{ item.title }}</div>
        <div class="vip-tags">
          <span v-for="(tag, i) in item.tags" :key="i" class="vip-tag" :class="tag.type">{{ tag.text }}</span>
        </div>
        <div class="vip-price">￥{{ item.price }}</div>
        <div class="vip-tip">此商品无限制购买</div>
        <div class="vip-info-row">
          <span>会员级别</span>
          <span>{{ item.level }}</span>
        </div>
        <div class="vip-info-row">
          <span>等级时长</span>
          <span>{{ item.duration }}</span>
        </div>
        <div class="vip-info-row">
          <span>流量额度</span>
          <span>{{ item.traffic }}</span>
        </div>
        <div class="vip-info-row">
          <span>到期限制</span>
          <span>{{ item.expire }}</span>
        </div>
        <div class="vip-info-row">
          <span>同时在线</span>
          <span>{{ item.devices }}</span>
        </div>
        <div class="vip-info-row">
          <span>描述</span>
          <span></span>
        </div>
        <ul class="vip-desc">
          <li v-for="(desc, i) in item.descList" :key="i">{{ desc }}</li>
        </ul>
        <el-button type="primary" class="vip-btn" size="large">购买</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StocksHeader from '@/components/StocksHeader/index.vue'
const vipList = [
  {
    title: '家宽限时特惠',
    tags: [
      { text: '买2年送半年', type: 'hot' },
      { text: '限时', type: 'warn' },
      { text: '买3年送1年', type: 'hot' },
      { text: '限量50天', type: 'warn' }
    ],
    price: 398.00,
    level: '高级家宽',
    duration: '1095天',
    traffic: '无限流量',
    expire: '30天重置',
    devices: '2个设备',
    descList: [
      '特惠3年钻石套餐',
      '包含所有家宽和国际节点',
      '全站所有线路均可使用',
      '无限流量不限网速',
      '可同时2个设备在线',
      '快速响应',
    ]
  },
  {
    title: '中级套餐',
    tags: [
      { text: '包月', type: 'main' },
      { text: '包半年', type: 'main' },
      { text: '包一年', type: 'main' }
    ],
    price: 12.00,
    level: '中级国际',
    duration: '30天',
    traffic: '无限流量',
    expire: '30天重置',
    devices: '2个设备',
    descList: [
      'IPLC广新专线',
      '无限流量不限网速',
      '可同时2个设备在线',
      '全球节点分布',
      '快速客服响应',
    ]
  },
  {
    title: '家宽套餐[港台]',
    tags: [
      { text: '包月', type: 'main' },
      { text: '包半年', type: 'main' },
      { text: '包一年', type: 'main' }
    ],
    price: 21.00,
    level: '高级家宽',
    duration: '30天',
    traffic: '无限流量',
    expire: '30天重置',
    devices: '2个设备',
    descList: [
      'IEPL广港专线',
      '海外本地家庭宽带',
      'ChatGPT/Netflix/Disney/TVB等全都支持',
      '香港宽带/台湾中华电信',
      '家宽高雅回国延迟新加坡',
      '无限流量不限速',
      '可同时2个设备在线',
      '快速客服响应',
    ]
  },
  {
    title: 'Tik Tok直播专线',
    tags: [
      { text: '独享直播专线', type: 'hot' },
      { text: '跨境专业服务', type: 'warn' }
    ],
    price: 1500.00,
    level: '合伙人',
    duration: '30天',
    traffic: '无限流量',
    expire: '30天重置',
    devices: '无限制',
    descList: [
      '独享国际直播专线',
      '可选100M 300M 500M 1000M',
      '真实原生IP 海外5G网络加持',
      '不限设备在线',
      '需定制请联系客户',
    ]
  }
]
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
  margin-top: 8px;
}
</style>
