<template>
  <div class="icp-footer">
    <a 
      href="https://beian.miit.gov.cn" 
      target="_blank" 
      rel="noopener noreferrer"
      class="icp-link"
    >
      沪ICP备2025140742号
    </a>
  </div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'IcpFooter' })
</script>

<style lang="scss" scoped>
.icp-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  background: transparent;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  margin-top: auto;
  
  .icp-link {
    color: #666;
    text-decoration: none;
    font-size: 14px;
    transition: color 0.3s ease;
    
    &:hover {
      color: #1a73e8;
      text-decoration: underline;
    }
  }
}

// 深色主题适配
.dark .icp-footer {
  border-top-color: rgba(255, 255, 255, 0.1);
  
  .icp-link {
    color: #999;
    
    &:hover {
      color: #4a9eff;
    }
  }
}
</style> 