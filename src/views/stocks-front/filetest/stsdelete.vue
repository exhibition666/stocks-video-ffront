<template>
  <ContentWrap>
    <div class="delete-test-container">
      <h2 style="text-align: center; margin-bottom: 24px;">STS 文件删除测试</h2>
      <el-card shadow="never">
        <el-form :model="formData" :rules="formRules" ref="formRef" label-width="140px" style="max-width: 700px; margin: 0 auto;">
          <el-form-item label="文件路径 (Path)" prop="path">
            <el-input v-model="formData.path" placeholder="请输入 OSS 中的完整文件路径, e.g., pic/your-file-name.jpg" clearable />
            <div class="el-form-item__description">
              这是文件在 OSS Bucket 中的相对路径，不包含 Bucket 名称和域名。
            </div>
          </el-form-item>
          <el-form-item label="OSS 配置 ID">
            <el-input :model-value="formData.configId" disabled>
              <template #append>从 .env 文件 (VITE_OSS_CONFIG_ID) 自动读取</template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="danger" @click="handleDelete" :loading="loading" style="width: 100%;">
              <Icon icon="ep:delete" style="margin-right: 8px;" />
              确认删除
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </ContentWrap>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, ElNotification, FormInstance, FormRules } from 'element-plus'
import { useOssDeleter } from '@/utils/ossDeleter'

defineOptions({ name: 'STSDeleteTest' })

const { deleteFile } = useOssDeleter()
const loading = ref(false)
const formRef = ref<FormInstance>()
const formData = reactive({
  path: '',
  configId: Number(import.meta.env.VITE_OSS_CONFIG_ID) || undefined
})

const formRules = reactive<FormRules>({
  path: [{ required: true, message: '文件路径不能为空', trigger: 'blur' }]
})

const handleDelete = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      if (!formData.configId) {
        ElMessage.error('关键配置缺失：无法从 .env 文件中获取 VITE_OSS_CONFIG_ID')
        return
      }

      loading.value = true
      try {
        const success = await deleteFile(formData.configId, formData.path)

        if (success) {
          ElNotification.success({
            title: '删除成功',
            message: `文件 ${formData.path} 已成功从 OSS 删除。`
          })
          formData.path = '' // 清空输入框以便下次使用
        }
        // 失败的消息在 useOssDeleter 中已经提示
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
        // console.error('删除文件时发生错误:', error)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>
.delete-test-container {
  padding: 20px;
}
.el-form-item__description {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  margin-top: 4px;
}
</style>
