<template>
  <Dialog :title="dialogTitle" v-model="dialogVisible">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      v-loading="formLoading"
    >
      <el-form-item label="视频标题" prop="title">
        <el-input v-model="formData.title" placeholder="请输入视频标题" />
      </el-form-item>
      <el-form-item label="视频描述" prop="description">
        <Editor v-model="formData.description" height="150px" />
      </el-form-item>
      <el-form-item label="完整视频" prop="fileUrl">
        <UploadFile v-model="formData.fileUrl" :file-type="['mp4','avi','mov','wmv','flv','mkv','webm','mpeg','mpg','3gp','rmvb']" :file-size="500" :limit="1" :is-show-tip="true" />
      </el-form-item>
      <el-form-item label="预览视频 " prop="previewUrl">
        <el-input v-model="formData.previewUrl" placeholder="请输入预览视频 " />
      </el-form-item>
      <el-form-item label="封面图片" prop="picUrl">
        <el-input v-model="formData.picUrl" placeholder="请输入封面图片链接" />
      </el-form-item>
      <el-form-item label="视频时长（秒）" prop="duration">
        <el-input v-model="formData.duration" placeholder="请输入视频时长（秒）" />
      </el-form-item>
      <el-form-item label="视频分类" prop="typeId">
        <el-select
          v-model="formData.typeId"
          placeholder="请选择视频分类"
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="item in videoTypeOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="试看时长（秒）" prop="previewLimit">
        <el-input v-model="formData.previewLimit" placeholder="请输入试看时长（秒）" />
      </el-form-item>
      <el-form-item label="仅VIP可看" prop="isVipOnly">
        <el-switch v-model="formData.isVipOnly" active-value="1" inactive-value="0" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :label="1">上架</el-radio>
          <el-radio :label="0">下架</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="观看数" prop="view">
        <el-input v-model="formData.view" placeholder="请输入观看数" />
      </el-form-item>
      <el-form-item label="创建者" prop="creator">
        <el-input v-model="formData.creator" placeholder="请输入创建者" />
      </el-form-item>
      <el-form-item label="创建时间" prop="createTime">
        <el-date-picker v-model="formData.createTime" type="datetime" placeholder="选择创建时间" style="width: 100%" />
      </el-form-item>
      <el-form-item label="更新者" prop="updater">
        <el-input v-model="formData.updater" placeholder="请输入更新者" />
      </el-form-item>
      <el-form-item label="更新时间" prop="updateTime">
        <el-date-picker v-model="formData.updateTime" type="datetime" placeholder="选择更新时间" style="width: 100%" />
      </el-form-item>
      <el-form-item label="是否删除" prop="deleted">
        <el-switch v-model="formData.deleted" active-value="1" inactive-value="0" />
      </el-form-item>
      <el-form-item label="租户编号" prop="tenantId">
        <el-input v-model="formData.tenantId" placeholder="请输入租户编号" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="submitForm" type="primary" :disabled="formLoading">确 定</el-button>
      <el-button @click="dialogVisible = false">取 消</el-button>
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { VideoApi, Video } from '@/api/system/video'
import { VideoTypeApi, VideoType } from '@/api/system/videotype'
import { DICT_TYPE, getIntDictOptions } from '@/utils/dict'
import UploadFile from '@/components/UploadFile/src/UploadFile.vue'

/** 视频 表单 */
defineOptions({ name: 'VideoForm' })

const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗

const dialogVisible = ref(false) // 弹窗的是否展示
const dialogTitle = ref('') // 弹窗的标题
const formLoading = ref(false) // 表单的加载中：1）修改时的数据加载；2）提交的按钮禁用
const formType = ref('') // 表单的类型：create - 新增；update - 修改
const videoTypeOptions = ref<VideoType[]>([]) // 视频分类选项

const formData = ref({
  id: undefined,
  title: undefined,
  description: undefined,
  fileUrl: undefined,
  previewUrl: undefined,
  picUrl: undefined,
  duration: undefined,
  typeId: undefined,
  previewLimit: undefined,
  isVipOnly: 0,
  status: 1,
  view: undefined,
  creator: undefined,
  createTime: undefined,
  updater: undefined,
  updateTime: undefined,
  deleted: 0,
  tenantId: undefined,
})
const formRules = reactive({
  title: [{ required: true, message: '视频标题不能为空', trigger: 'blur' }],
  fileUrl: [{ required: true, message: '完整视频不能为空', trigger: 'blur' }],
  previewUrl: [{ required: true, message: '预览视频 不能为空', trigger: 'blur' }],
  picUrl: [{ required: true, message: '封面图片不能为空', trigger: 'blur' }],
  duration: [{ required: true, message: '视频时长不能为空', trigger: 'blur' }],
  typeId: [{ required: true, message: '视频分类不能为空', trigger: 'change' }],
  status: [{ required: true, message: '状态不能为空', trigger: 'change' }],
})
const formRef = ref() // 表单 Ref

/** 获取视频分类列表 */
const getVideoTypeList = async () => {
  try {
    const res = await VideoTypeApi.getVideoTypePage({ pageNo: 1, pageSize: 100 });
    videoTypeOptions.value = res.list;
  } catch (error) {
    console.error("获取视频分类列表失败", error);
  }
}

/** 打开弹窗 */
const open = async (type: string, id?: number) => {
  dialogVisible.value = true
  dialogTitle.value = t('action.' + type)
  formType.value = type
  resetForm()
  // 获取视频分类列表
  await getVideoTypeList()
  // 修改时，设置数据
  if (id) {
    formLoading.value = true
    try {
      formData.value = await VideoApi.getVideo(id)
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
    const data = formData.value as unknown as Video
    if (formType.value === 'create') {
      await VideoApi.createVideo(data)
      message.success(t('common.createSuccess'))
    } else {
      await VideoApi.updateVideo(data)
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
    title: undefined,
    description: undefined,
    fileUrl: undefined,
    previewUrl: undefined,
    picUrl: undefined,
    duration: undefined,
    typeId: undefined,
    previewLimit: undefined,
    isVipOnly: 0,
    status: 1,
    view: undefined,
    creator: undefined,
    createTime: undefined,
    updater: undefined,
    updateTime: undefined,
    deleted: 0,
    tenantId: undefined,
  }
  formRef.value?.resetFields()
}
</script>