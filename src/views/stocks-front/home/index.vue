<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import { ref, onMounted, computed } from 'vue'
import StocksHeader from '@/components/StocksHeader/index.vue'
import { Search, VideoPlay, DataAnalysis } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/user'
import { getAccessToken } from '@/utils/auth'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('home')
const router = useRouter()
const userStore = useUserStore()

// 检查用户是否已登录
const isLoggedIn = computed(() => {
  return !!getAccessToken() || !!userStore.getToken
})

// 跳转到视频页面
const goToVideoPage = () => {
  router.push('/stocks-front/video')
}

// 跳转到股票期权询价页面
const goToInquiryPage = () => {
  router.push('/stocks-front/inquiry')
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/stocks-front/login')
}

// 当前选中的内容索引
const activeContentIndex = ref(0)

// 内容数据
const contentItems = [
  {
    title: '专业视频教程',
    description: '从基础入门到高级策略，涵盖股票分析、期权交易、风险管理等全方位教学内容，助您系统掌握投资技能',
    buttonText: '开始学习',
    icon: 'el-icon-video-play',
    action: goToVideoPage
  },
  {
    title: '期权询价服务',
    description: '实时期权定价工具，支持多种期权策略分析，提供专业的风险评估和收益预测，让您的投资决策更加精准',
    buttonText: '立即询价',
    icon: 'el-icon-money',
    action: goToInquiryPage
  }

]

// 切换内容
const changeContent = (index) => {
  activeContentIndex.value = index
}

onMounted(() => {
  // console.log('首页组件已加载')
})
</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />
    
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">股票投资教育平台<br/>您的财富增长伙伴</h1>
        <p class="hero-subtitle">专业的股票期权教学 • 智能投资策略 • 风险管理培训</p>
        
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="goToVideoPage" class="hero-button">
            <i class="el-icon-video-play"></i>
            浏览视频
          </el-button>
          <el-button type="default" size="large" @click="goToInquiryPage" class="hero-button">
            <i class="el-icon-money"></i>
            期权询价
          </el-button>
        </div>
      </div>
    </div>
    
    <div class="content-section">
      <div class="content-nav">
        <div 
          v-for="(item, index) in contentItems" 
          :key="index"
          class="nav-item"
          :class="{ active: activeContentIndex === index }"
          @click="changeContent(index)"
        >
          <i :class="item.icon"></i>
          <span>{{ item.title }}</span>
        </div>
      </div>
      
      <div class="content-display">
        <div class="content-card">
          <h2>{{ contentItems[activeContentIndex].title }}</h2>
          <p>{{ contentItems[activeContentIndex].description }}</p>
          <el-button 
            type="primary" 
            @click="contentItems[activeContentIndex].action"
          >
            {{ contentItems[activeContentIndex].buttonText }}
          </el-button>
        </div>
        
        <div class="content-quote">
          <blockquote>
            "投资最重要的不是知道，而是做什么。不是我们看到了什么，而是我们做了什么。"
            <footer>— 沃伦·巴菲特</footer>
          </blockquote>
        </div>
      </div>
    </div>
    
    <div class="features-section">
      <h2 class="section-title">我们的服务</h2>
      
      <div class="feature-cards">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12" :md="8">
            <el-card shadow="hover" class="feature-card" @click="router.push('/stocks-front/inquiry')">
              <div class="card-content">
                <div class="card-icon">
                  <el-icon><Search /></el-icon>
                </div>
                <div class="card-info">
                  <h3>期权询价</h3>
                  <p>实时期权定价与风险分析，支持看涨看跌等多种策略</p>
                </div>
              </div>
            </el-card>
          </el-col>
          
          <el-col :xs="24" :sm="12" :md="8">
            <el-card shadow="hover" class="feature-card" @click="router.push('/stocks-front/video')">
              <div class="card-content">
                <div class="card-icon">
                  <el-icon><VideoPlay /></el-icon>
                </div>
                <div class="card-info">
                  <h3>视频教学</h3>
                  <p>专业讲师授课，从入门到精通的系统化学习路径</p>
                </div>
              </div>
            </el-card>
          </el-col>
          

        </el-row>
      </div>
    </div>
    
    <!-- 行动号召区域 - 仅在未登录时显示 -->
    <div v-if="!isLoggedIn" class="cta-section">
      <div class="cta-content">
        <h2>开启智慧投资之路</h2>
        <p>加入我们的学习社区，掌握专业投资技能，实现财富稳健增长</p>
        <el-button type="primary" size="large" @click="goToLogin">立即开始学习</el-button>
      </div>
    </div>
    
    <footer class="site-footer">
      <div class="footer-content">
        <div class="copyright">© 2025 NineTube 股票教育平台 版权所有 | 专业投资教育 · 智慧理财之选</div>
      </div>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-home;
// 股票主题色彩方案
$primary-color: #1a73e8;      // 蓝色主色调
$secondary-color: #34a853;    // 绿色（涨）
$danger-color: #ea4335;       // 红色（跌）
$warning-color: #fbbc04;      // 黄色（警告）
$text-color: #202124;         // 深灰色文字
$text-light: #5f6368;         // 浅灰色文字
$bg-color: #ffffff;           // 白色背景
$bg-dark: #f8f9fa;            // 浅灰背景
$bg-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
$header-height: 70px;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background: $bg-color;
  color: $text-color;
  overflow-x: hidden;
  
  // 英雄区域
  .hero-section {
    height: 100vh;
    display: flex;
    align-items: center;
    padding: 0 5%;
    background: linear-gradient(rgba(26, 115, 232, 0.85), rgba(26, 115, 232, 0.75)),
                url('/ChatGPT Image 2025年7月21日 20_57_55.png') no-repeat center center;
    background-size: cover;
    background-attachment: fixed;
    padding-top: $header-height;
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 100vw;

    // 添加动态粒子效果
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 20% 80%, rgba(52, 168, 83, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 20%, rgba(251, 188, 4, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 40% 40%, rgba(234, 67, 53, 0.1) 0%, transparent 50%);
      animation: float 6s ease-in-out infinite;
    }

    .hero-content {
      max-width: 800px;
      position: relative;
      z-index: 2;
      color: white;

      .hero-title {
        font-size: 72px;
        font-weight: 800;
        line-height: 1.1;
        margin-bottom: 32px;
        color: white;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .hero-subtitle {
        font-size: 28px;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 48px;
        line-height: 1.4;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        font-weight: 300;
      }

      .hero-actions {
        display: flex;
        gap: 20px;

        .hero-button {
          padding: 16px 40px;
          font-weight: 600;
          font-size: 18px;
          border-radius: 50px;
          transition: all 0.3s ease;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);

          &:first-child {
            background: $secondary-color;
            border-color: $secondary-color;
            color: white;

            &:hover {
              background: darken($secondary-color, 10%);
              transform: translateY(-3px);
              box-shadow: 0 12px 35px rgba(52, 168, 83, 0.4);
            }
          }

          &:last-child {
            background: rgba(255, 255, 255, 0.15);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            backdrop-filter: blur(10px);

            &:hover {
              background: rgba(255, 255, 255, 0.25);
              border-color: rgba(255, 255, 255, 0.5);
              transform: translateY(-3px);
              box-shadow: 0 12px 35px rgba(255, 255, 255, 0.2);
            }
          }

          i {
            margin-right: 10px;
            font-size: 20px;
          }
        }
      }
    }
  }
  
  // 内容区域
  .content-section {
    padding: 100px 5%;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;

    .content-nav {
      display: flex;
      border-bottom: 3px solid #e8eaed;
      margin-bottom: 60px;
      background: white;
      border-radius: 12px 12px 0 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      overflow: hidden;

      .nav-item {
        padding: 20px 32px;
        cursor: pointer;
        font-weight: 600;
        color: $text-light;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        position: relative;
        background: white;

        i {
          font-size: 22px;
          transition: transform 0.3s ease;
        }

        &:hover {
          color: $primary-color;
          background: #f1f5ff;

          i {
            transform: scale(1.1);
          }
        }

        &.active {
          color: white;
          background: $primary-color;
          box-shadow: 0 4px 15px rgba(26, 115, 232, 0.3);

          &::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            right: 0;
            height: 3px;
            background: $secondary-color;
          }
        }
      }
    }

    .content-display {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;

      .content-card {
        background: white;
        padding: 50px;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        border: 1px solid #e8eaed;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
        }

        h2 {
          font-size: 36px;
          margin-bottom: 20px;
          color: $primary-color;
          font-weight: 700;
        }

        p {
          font-size: 20px;
          line-height: 1.7;
          margin-bottom: 32px;
          color: $text-light;
        }

        .el-button {
          padding: 14px 32px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 25px;
          background: $bg-gradient;
          border: none;
          color: white;
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(26, 115, 232, 0.3);
          }
        }
      }

      .content-quote {
        display: flex;
        align-items: center;
        background: linear-gradient(135deg, #f1f5ff 0%, #e8f0fe 100%);
        padding: 50px;
        border-radius: 20px;
        border-left: 6px solid $primary-color;

        blockquote {
          font-size: 26px;
          line-height: 1.6;
          font-style: italic;
          color: $primary-color;
          margin: 0;
          padding: 0;
          position: relative;
          font-weight: 500;

          &::before {
            content: '"';
            font-size: 100px;
            position: absolute;
            top: -50px;
            left: -30px;
            color: rgba($primary-color, 0.15);
            font-family: Georgia, serif;
          }

          footer {
            margin-top: 24px;
            font-size: 20px;
            color: $text-light;
            font-style: normal;
            font-weight: 600;
          }
        }
      }
    }
  }
  
  // 特性区域
  .features-section {
    padding: 120px 5%;
    background: linear-gradient(135deg, #f8f9fa 0%, #e8f0fe 100%);
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: $bg-gradient;
    }

    .section-title {
      text-align: center;
      font-size: 48px;
      margin-bottom: 80px;
      color: $primary-color;
      font-weight: 800;
      position: relative;

      &::after {
        content: '';
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        width: 80px;
        height: 4px;
        background: $bg-gradient;
        border-radius: 2px;
      }
    }

    .feature-cards {
      margin-top: 40px;

      .feature-card {
        height: 100%;
        cursor: pointer;
        transition: all 0.4s ease;
        border-radius: 20px;
        overflow: hidden;
        background: white;
        border: 1px solid #e8eaed;

        &:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15);
          border-color: $primary-color;
        }

        .card-content {
          display: flex;
          align-items: center;
          padding: 30px;

          .card-icon {
            width: 80px;
            height: 80px;
            border-radius: 20px;
            background: $bg-gradient;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 25px;
            box-shadow: 0 8px 25px rgba(26, 115, 232, 0.2);

            .el-icon {
              font-size: 32px;
              color: white;
            }
          }

          .card-info {
            flex: 1;

            h3 {
              margin: 0 0 12px 0;
              font-size: 22px;
              font-weight: 700;
              color: $text-color;
            }

            p {
              margin: 0;
              color: $text-light;
              font-size: 16px;
              line-height: 1.5;
            }
          }
        }
      }
    }
  }
  
  // 行动号召区域
  .cta-section {
    padding: 120px 5%;
    background: $bg-gradient;
    color: white;
    text-align: center;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
      animation: rotate 20s linear infinite;
    }

    .cta-content {
      max-width: 700px;
      margin: 0 auto;
      position: relative;
      z-index: 2;

      h2 {
        font-size: 48px;
        margin-bottom: 24px;
        font-weight: 800;
        text-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      }

      p {
        font-size: 22px;
        margin-bottom: 40px;
        opacity: 0.95;
        line-height: 1.6;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .el-button {
        padding: 18px 50px;
        font-size: 20px;
        font-weight: 700;
        background: white;
        color: $primary-color;
        border: none;
        border-radius: 50px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.95);
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
        }
      }
    }
  }

  // 页脚
  .site-footer {
    padding: 60px 5%;
    background: linear-gradient(135deg, #202124 0%, #3c4043 100%);
    color: white;

    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;

      .copyright {
        color: rgba(255, 255, 255, 0.8);
        font-size: 16px;
        text-align: center;
      }
    }
  }
  
  // 动画效果
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    33% { transform: translateY(-10px) rotate(1deg); }
    66% { transform: translateY(5px) rotate(-1deg); }
  }

  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // 响应式设计
  @media (max-width: 1200px) {
    .hero-section .hero-content .hero-title {
      font-size: 60px;
    }

    .content-section .content-display {
      gap: 40px;
    }
  }

  @media (max-width: 992px) {
    .hero-section .hero-content .hero-title {
      font-size: 52px;
    }

    .content-section .content-display {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    .features-section .section-title {
      font-size: 40px;
    }
  }

  @media (max-width: 768px) {
    .hero-section {
      padding: 0 3%;

      .hero-content {
        .hero-title {
          font-size: 42px;
        }

        .hero-subtitle {
          font-size: 22px;
        }

        .hero-actions {
          flex-direction: column;
          align-items: center;

          .hero-button {
            width: 100%;
            max-width: 300px;
          }
        }
      }
    }

    .content-section {
      padding: 80px 3%;

      .content-nav {
        overflow-x: auto;
        white-space: nowrap;
        padding-bottom: 10px;
        border-radius: 12px;

        &::-webkit-scrollbar {
          height: 4px;
        }

        &::-webkit-scrollbar-thumb {
          background: $primary-color;
          border-radius: 4px;
        }

        .nav-item {
          flex-shrink: 0;
        }
      }

      .content-display {
        .content-card, .content-quote {
          padding: 30px;
        }
      }
    }

    .features-section {
      padding: 80px 3%;

      .section-title {
        font-size: 36px;
      }

      .feature-cards .feature-card .card-content {
        padding: 20px;

        .card-icon {
          width: 60px;
          height: 60px;
          margin-right: 15px;

          .el-icon {
            font-size: 24px;
          }
        }

        .card-info h3 {
          font-size: 18px;
        }
      }
    }

    .cta-section {
      padding: 80px 3%;

      .cta-content {
        h2 {
          font-size: 36px;
        }

        p {
          font-size: 18px;
        }
      }
    }
  }

  @media (max-width: 480px) {
    .hero-section .hero-content {
      .hero-title {
        font-size: 32px;
      }

      .hero-subtitle {
        font-size: 18px;
      }
    }

    .content-section .content-display {
      .content-card, .content-quote {
        padding: 20px;
      }
    }
  }
}
</style>
