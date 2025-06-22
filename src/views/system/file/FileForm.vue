<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <el-form-item label="原始文件名" prop="fileName">
        <el-input v-model="formData.fileName" placeholder="请输入原始文件名" />
      </el-form-item>
      <el-form-item label="文件类型（image/video/other）" prop="fileType">
        <el-select v-model="formData.fileType" placeholder="请选择文件类型（image/video/other）">
          <el-option label="请选择字典生成" value="" />
        </el-select>
      </el-form-item>
      <el-form-item label="文件访问URL（OSS地址）" prop="url">
        <el-input v-model="formData.url" placeholder="请输入文件访问URL（OSS地址）" />
      </el-form-item>
      <el-form-item label="所属Bucket名称" prop="bucket">
        <el-input v-model="formData.bucket" placeholder="请输入所属Bucket名称" />
      </el-form-item>
      <el-form-item label="文件大小（字节）" prop="fileSize">
        <el-input v-model="formData.fileSize" placeholder="请输入文件大小（字节）" />
      </el-form-item>
      <el-form-item label="文件扩展名，如jpg/mp4" prop="extension">
        <el-input v-model="formData.extension" placeholder="请输入文件扩展名，如jpg/mp4" />
      </el-form-item>
      <el-form-item label="业务类型（如 video_cover）" prop="bizType">
        <el-select v-model="formData.bizType" placeholder="请选择业务类型（如 video_cover）">
          <el-option label="请选择字典生成" value="" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务ID" prop="bizId">
        <el-input v-model="formData.bizId" placeholder="请输入业务ID" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { FileApi, File } from '@/api/system/file'

/** 通用文件管理 表单 */
defineOptions({ name: 'FileForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const formData = ref({
  id: undefined,
  fileName: undefined,
  fileType: undefined,
  url: undefined,
  bucket: undefined,
  fileSize: undefined,
  extension: undefined,
  bizType: undefined,
  bizId: undefined,
})
const formRules = reactive({
  fileName: [{ required: true, message: '原始文件名不能为空', trigger: 'blur' }],
  fileType: [{ required: true, message: '文件类型（image/video/other）不能为空', trigger: 'change' }],
  url: [{ required: true, message: '文件访问URL（OSS地址）不能为空', trigger: 'blur' }],
})
const formRef = ref() // 表单 Ref

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      formData.value = await FileApi.getFile(id)
    } finally {
      formLoading.value = false
    }
  }
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗

/** 提交表单 */
const emit = defineEmits(['success']) // 定义 success 事件，用于操作成功后的回调
const submitForm = async () => {
  // 校验表单
  await formRef.value.validate()
  // 提交请求
  formLoading.value = true
  try {
    const data = formData.value as unknown as File
    if (formType.value === 'create') {
      await FileApi.createFile(data)
      message.success(t('common.createSuccess'))
    } else {
      await FileApi.updateFile(data)
      message.success(t('common.updateSuccess'))
    }
    dialogVisible.value = false
    // 发送操作成功的事件
    emit('success')
  } finally {
    formLoading.value = false
  }
}

/** 重置表单 */
const resetForm = () => {
  formData.value = {
    id: undefined,
    fileName: undefined,
    fileType: undefined,
    url: undefined,
    bucket: undefined,
    fileSize: undefined,
    extension: undefined,
    bizType: undefined,
    bizId: undefined,
  }
  formRef.value?.resetFields()
}
</script>