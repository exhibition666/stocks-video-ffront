<template>
  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="88px"
    >
      <el-form-item label="视频标题" prop="title">
        <el-input
          v-model="queryParams.title"
          placeholder="请输入视频标题"
          clearable
          @keyup.enter="handleQuery"
          class="!w-160px"
        />
      </el-form-item>
      <el-form-item label="视频分类" prop="typeId">
        <el-select
          v-model="queryParams.typeId"
          placeholder="请选择视频分类"
          clearable
          class="!w-160px"
        >
          <el-option
            v-for="item in videoTypeOptions"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select
          v-model="queryParams.status"
          placeholder="请选择状态"
          clearable
          class="!w-160px"
        >
          <el-option label="上架" :value="1" />
          <el-option label="下架" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="仅VIP可看" prop="isVipOnly">
        <el-select
          v-model="queryParams.isVipOnly"
          placeholder="请选择"
          clearable
          class="!w-160px"
        >
          <el-option label="是" :value="1" />
          <el-option label="否" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button
          type="success"
          plain
          @click="handleExport"
          :loading="exportLoading"
          v-hasPermi="['system:video:export']"
        >
          <Icon icon="ep:download" class="mr-5px" /> 导出
        </el-button>
        <el-checkbox
          :model-value="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="handleSelectAllChange"
          >当页全选</el-checkbox
        >
        <el-button
          type="danger"
          plain
          :disabled="isEmpty(checkedIds)"
          @click="handleDeleteBatch"
          v-hasPermi="['system:video:delete']"
        >
          <Icon icon="ep:delete" class="mr-5px" /> 批量删除
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <div v-if="loading" class="loading-container">
      <el-skeleton :rows="5" animated />
    </div>
    <div v-else-if="list.length > 0" class="video-grid">
      <el-card
        v-for="video in list"
        :key="video.id"
        class="video-card"
        shadow="hover"
        :body-style="{ padding: '0px' }"
        @click="handleCardClick(video.id)"
      >
        <el-checkbox
          :model-value="checkedIds.includes(video.id)"
          @change="() => handleCheckboxChange(video.id)"
          class="card-checkbox"
          size="large"
          @click.stop
        />
        <div class="thumbnail-wrapper">
          <el-image :src="video.signedPicUrl" fit="cover" class="video-thumbnail">
            <template #placeholder>
              <div class="image-slot">加载中<span class="dot">...</span></div>
            </template>
            <template #error>
              <div class="image-slot">
                <Icon icon="ep:picture" />
              </div>
            </template>
          </el-image>
          <div class="duration-badge">{{ formatDuration(video.duration) }}</div>
          <div class="status-badge" :class="video.status === 1 ? 'online' : 'offline'">
            {{ video.status === 1 ? '已上架' : '已下架' }}
          </div>
        </div>
        <div class="info-wrapper">
          <h3 class="video-title">{{ video.title }}</h3>
          <div class="meta-info">
            <span class="creator">
              <Icon icon="ep:user" />
              {{ video.creator }}
            </span>
            <span class="views">
              <Icon icon="ep:view" />
              {{ video.view }}
            </span>
          </div>
          <div class="time-info">
            <Icon icon="ep:clock" />
            {{ dateFormatter(null, null, video.createTime) }}
          </div>
        </div>
      </el-card>
    </div>
    <el-empty v-else description="暂无视频数据" />
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
      class="mt-20px"
    />
  </ContentWrap>
</template>

<style scoped lang="scss">
:deep(.el-form) {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}
:deep(.el-form-item) {
  margin-right: 5px !important;
}
.actions-right {
  margin-left: auto;
}
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.video-card {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }
}

.card-checkbox {
  position: absolute;
  top: 5px;
  right: 5px;
  z-index: 1;
  :deep(.el-checkbox__inner) {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.4);
    border: 2px solid #fff;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
    &::after {
      width: 6px;
      height: 12px;
      left: 6px;
      top: 1px;
    }
  }
}

.thumbnail-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 Aspect Ratio */
}

.video-thumbnail {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #eee;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 14px;
}

.duration-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.status-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  color: white;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  &.online {
    background-color: #67c23a;
  }
  &.offline {
    background-color: #f56c6c;
  }
}

.info-wrapper {
  padding: 14px;
}

.video-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin: 0 0 10px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-info,
.time-info {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
  gap: 16px;

  .icon {
    margin-right: 4px;
  }
}
</style>
<script setup lang="ts">
import { isEmpty } from '@/utils/is'
import { dateFormatter } from '@/utils/formatTime'
import download from '@/utils/download'
import { VideoApi, Video } from '@/api/system/video'
import { VideoTypeApi, VideoType } from '@/api/system/videotype'
import { getSignedUrlForPreview } from '@/utils/useSignedUrlPreview'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

/** 视频 列表 */
defineOptions({ name: 'Video' })

const message = useMessage() // 消息弹窗
const { t } = useI18n() // 国际化
const router = useRouter()

const loading = ref(true) // 列表的加载中
const list = ref<any[]>([]) // 列表的数据, 使用 any[] 以便添加 signedPicUrl
const total = ref(0) // 列表的总页数
const videoTypeOptions = ref<VideoType[]>([]) // 视频分类选项
const checkedIds = ref<number[]>([]) // 选中的ID列表

const queryParams = reactive({
  pageNo: 1,
  pageSize: 12,
  title: undefined,
  typeId: undefined,
  status: undefined,
  isVipOnly: undefined,
  createTime: []
})
const queryFormRef = ref() // 搜索的表单
const exportLoading = ref(false) // 导出的加载中

/** 全选/半选 相关计算属性 */
const isAllSelected = computed(() => {
  if (list.value.length === 0) return false
  return list.value.every((video) => checkedIds.value.includes(video.id))
})
const isIndeterminate = computed(() => {
  if (list.value.length === 0) return false
  const selectedCount = list.value.filter((video) => checkedIds.value.includes(video.id)).length
  return selectedCount > 0 && selectedCount < list.value.length
})

/** 全选/取消全选 操作 */
const handleSelectAllChange = (value: boolean) => {
  const currentPageIds = list.value.map((video) => video.id)
  if (value) {
    // 全选
    currentPageIds.forEach((id) => {
      if (!checkedIds.value.includes(id)) {
        checkedIds.value.push(id)
      }
    })
  } else {
    // 取消全选
    checkedIds.value = checkedIds.value.filter((id) => !currentPageIds.includes(id))
  }
}

/** 获取视频分类列表 */
const getVideoTypeList = async () => {
  try {
    const res = await VideoTypeApi.getVideoTypePage({ pageNo: 1, pageSize: 100 })
    videoTypeOptions.value = res.list
  } catch (error) {
    console.error('获取视频分类列表失败', error)
  }
}

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await VideoApi.getVideoPage(queryParams)
    const signedUrlPromises =
      data.list.map((item) => {
        return item.picUrl ? getSignedUrlForPreview(item.picUrl) : Promise.resolve('')
      }) || []
    const signedUrls = await Promise.all(signedUrlPromises)
    data.list.forEach((item, index) => {
      item.signedPicUrl = signedUrls[index]
    })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const formatDuration = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  checkedIds.value = [] // 清空选项
  handleQuery()
}

/** 复选框变化时触发 */
const handleCheckboxChange = (id: number) => {
  const index = checkedIds.value.indexOf(id)
  if (index === -1) {
    checkedIds.value.push(id)
  } else {
    checkedIds.value.splice(index, 1)
  }
}

/** 卡片点击操作，跳转到编辑页 */
const handleCardClick = (id?: number) => {
  router.push({ path: '/video/videoUpdate', query: { id } })
}

/** 批量删除视频 */
const handleDeleteBatch = async () => {
  try {
    // 删除的二次确认
    await message.delConfirm()
    await VideoApi.deleteVideoList(checkedIds.value)
    message.success(t('common.delSuccess'))
    checkedIds.value = [] // 清空选中的ID
    await getList()
  } catch {}
}

/** 导出按钮操作 */
const handleExport = async () => {
  try {
    // 导出的二次确认
    await message.exportConfirm()
    // 发起导出
    exportLoading.value = true
    const data = await VideoApi.exportVideo(queryParams)
    download.excel(data, '视频.xls')
  } catch {
  } finally {
    exportLoading.value = false
  }
}

/** 初始化 **/
onMounted(() => {
  getVideoTypeList()
  getList()
})
</script>