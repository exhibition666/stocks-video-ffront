<template>
  <div class="not-found-page">
    <h1>404 - 页面未找到</h1>
    <p>您访问的页面不存在或已被删除。</p>
    <el-button type="primary" @click="goHome">返回首页</el-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
const goHome = () => {
  router.push('/stocks-front/home')
}
</script>

<style scoped>
.not-found-page {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.not-found-page h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}
.not-found-page p {
  margin-bottom: 2rem;
  color: #888;
}
</style> 