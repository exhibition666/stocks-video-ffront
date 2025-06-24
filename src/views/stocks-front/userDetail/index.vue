<script lang="ts" setup>
import { useUserStore } from '@/store/modules/user'
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import StocksHeader from '@/components/StocksHeader/index.vue'
import avatarImg from '@/assets/imgs/avatar.gif'
import { computed, ref, onMounted } from 'vue'
import { ArrowLeft, Edit, Key, Calendar, Ticket, ShoppingCart } from '@element-plus/icons-vue'
import { getAccessUrl } from '@/api/infra/file'
import * as UserApi from '@/api/member/user'
import { ElMessage } from 'element-plus'
import { getLevelList } from '@/api/member/level'
import axios from 'axios'
import { getAccessToken } from '@/utils/auth'
import { getVipPackageOrderPage } from '@/api/member/vip-package'
import type { VipPackageOrderVO } from '@/api/member/vip-package/types'

const router = useRouter()
const userStore = useUserStore()
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('user-detail')

const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID

// 会员信息
const userInfo = ref<UserApi.UserVO | null>(null)
const signedAvatarUrl = ref('')
const loading = ref(false)
const memberLevels = ref([])
const normalLevel = ref(null)

// VIP订单记录
const vipOrderRecords = ref<VipPackageOrderVO[]>([])
const orderLoading = ref(false)
const activeTab = ref('info')
const orderPagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})
const orderStatus = ref<number | null>(null) // 订单状态筛选

// 订单状态映射
const orderStatusMap = {
  0: { text: '待支付', type: 'warning' },
  1: { text: '已支付', type: 'success' },
  2: { text: '已取消', type: 'info' }
}

// 计算VIP是否过期
const isVipExpired = computed(() => {
  if (!userInfo.value) return false
  const vipExpireTime = userInfo.value.vipExpireTime || userInfo.value.vip_expire_time || userInfo.value.expireTime
  if (!vipExpireTime) return false
  
  const now = new Date()
  const expireDate = new Date(vipExpireTime)
  return now > expireDate
})

// 计算是否为VIP用户
const isVipUser = computed(() => {
  if (!userInfo.value) return false
  const levelName = userInfo.value.level?.name || ''
  const levelId = userInfo.value.level?.id || userInfo.value.level_id || userInfo.value.levelId
  return levelName.includes('VIP') || levelName.includes('vip') || (levelId && levelId > 1)
})

// 格式化VIP过期时间
const formattedExpireTime = computed(() => {
  if (!userInfo.value) return '未设置'
  const vipExpireTime = userInfo.value.vipExpireTime || userInfo.value.vip_expire_time || userInfo.value.expireTime
  if (!vipExpireTime) return '未设置'
  
  const expireDate = new Date(vipExpireTime)
  return expireDate.toLocaleString()
})

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

const fetchSignedUrl = async (path: string) => {
  if (!path) return ''
  try {
    const res = await getAccessUrl(OSS_CONFIG_ID, path)
    return res.accessUrl || ''
  } catch {
    return ''
  }
}

// 获取会员等级列表
const fetchMemberLevels = async () => {
  try {
    const levels = await getLevelList({})
    memberLevels.value = levels
    
    // 找出ID最小的等级作为普通用户等级
    if (levels && levels.length > 0) {
      normalLevel.value = levels.reduce((min, level) => 
        level.id < min.id ? level : min, levels[0])
      console.log('找到ID最小的会员等级:', normalLevel.value)
    }
  } catch (error) {
    console.error('获取会员等级列表失败:', error)
  }
}

// 获取VIP订单记录
const fetchVipOrderRecords = async () => {
  orderLoading.value = true
  try {
    // 构建请求参数
    const params: any = {
      pageNo: orderPagination.value.pageNo,
      pageSize: orderPagination.value.pageSize
    }
    
    // 添加订单状态筛选条件
    if (orderStatus.value !== null) {
      params.status = orderStatus.value
    }
    
    // 调用真实API获取VIP订单数据
    const response = await getVipPackageOrderPage(params)
    
    if (response && response.list) {
      vipOrderRecords.value = response.list
      orderPagination.value.total = response.total || 0
      console.log('获取到VIP订单记录:', vipOrderRecords.value)
    } else {
      vipOrderRecords.value = []
      orderPagination.value.total = 0
    }
  } catch (error) {
    console.error('获取VIP订单记录失败:', error)
    ElMessage.error('获取VIP订单记录失败')
    vipOrderRecords.value = []
  } finally {
    orderLoading.value = false
  }
}

// 处理分页变化
const handlePageChange = (page: number) => {
  orderPagination.value.pageNo = page
  fetchVipOrderRecords()
}

// 处理每页数量变化
const handleSizeChange = (size: number) => {
  orderPagination.value.pageSize = size
  orderPagination.value.pageNo = 1
  fetchVipOrderRecords()
}

// 处理状态筛选变化
const handleStatusChange = (status: number | null) => {
  orderStatus.value = status
  orderPagination.value.pageNo = 1 // 重置到第一页
  fetchVipOrderRecords()
}

// 检查VIP过期并处理
const checkVipExpiration = async () => {
  if (!userInfo.value) return
  
  console.log('检查VIP过期状态...')
  
  try {
    // 尝试从多个可能的字段名称获取VIP到期时间
    const vipExpireTime = userInfo.value.vipExpireTime || userInfo.value.vip_expire_time || userInfo.value.expireTime
    
    if (vipExpireTime) {
      console.log('找到VIP到期时间:', vipExpireTime)
      const now = new Date()
      const expireDate = new Date(vipExpireTime)
      
      // 判断是否已过期
      if (now > expireDate) {
        console.log('VIP已过期，准备降级为普通用户')
        
        // 如果会员等级列表未加载，先加载
        if (!normalLevel.value) {
          await fetchMemberLevels()
        }
        
        if (normalLevel.value) {
          // 当前用户等级ID
          const currentLevelId = userInfo.value.level?.id || userInfo.value.level_id || userInfo.value.levelId
          
          // 如果当前不是最低等级，则只在前端进行降级处理
          if (currentLevelId !== normalLevel.value.id) {
            console.log('执行前端降级操作，从', currentLevelId, '降级到', normalLevel.value.id)
            
            // 更新本地用户信息
            userInfo.value.level = { 
              id: normalLevel.value.id, 
              name: normalLevel.value.name, 
              level: normalLevel.value.value || 1, 
              icon: normalLevel.value.icon || '' 
            }
            if (userInfo.value.level_id) userInfo.value.level_id = normalLevel.value.id
            if (userInfo.value.levelId) userInfo.value.levelId = normalLevel.value.id
            
            // 更新store中的用户信息
            userStore.user = { ...userInfo.value }
            
            // 移除VIP过期提示消息
            // ElMessage.warning('您的VIP会员已过期，已恢复为普通会员')
          } else {
            console.log('用户已经是最低等级会员，无需降级')
          }
        }
      } else {
        console.log('VIP未过期，到期时间:', expireDate.toISOString())
      }
    } else {
      console.log('用户无VIP到期时间记录，视为普通用户')
    }
  } catch (error) {
    console.error('检查VIP过期出错:', error)
  }
}

const fetchUserInfo = async () => {
  loading.value = true
  try {
    const res = await UserApi.getCurrentUser()
    userInfo.value = res
    signedAvatarUrl.value = await fetchSignedUrl(res.avatar)
    
    // 获取会员等级列表
    await fetchMemberLevels()
    
    // 检查VIP是否过期
    await checkVipExpiration()
    
    // 获取VIP订单记录
    await fetchVipOrderRecords()
  } catch (e) {
    ElMessage.error('获取会员信息失败')
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchUserInfo)

// 返回首页
const goBack = () => {
  router.push('/stocks-front/home')
}

// 编辑信息弹窗
const editDialogVisible = ref(false)
const editForm = ref({ nickname: '', avatar: '', sex: 1 })
const editLoading = ref(false)
const openEditDialog = () => {
  if (!userInfo.value) return
  editForm.value = {
    nickname: userInfo.value.nickname || '',
    avatar: userInfo.value.avatar || '',
    sex: userInfo.value.sex || 1
  }
  editDialogVisible.value = true
}
const handleEditSubmit = async () => {
  editLoading.value = true
  try {
    await UserApi.updateUser(editForm.value)
    ElMessage.success('信息修改成功')
    editDialogVisible.value = false
    fetchUserInfo()
  } catch {
    ElMessage.error('信息修改失败')
  } finally {
    editLoading.value = false
  }
}

// 密码修改弹窗
const pwdDialogVisible = ref(false)
const pwdForm = ref({ password: '', code: '' })
const pwdLoading = ref(false)
const handlePwdSubmit = async () => {
  pwdLoading.value = true
  try {
    await UserApi.updateUserPassword(pwdForm.value)
    ElMessage.success('密码修改成功')
    pwdDialogVisible.value = false
    pwdForm.value = { password: '', code: '' }
  } catch {
    ElMessage.error('密码修改失败')
  } finally {
    pwdLoading.value = false
  }
}

// 发送验证码（调用会员短信接口）
import { sendSmsCode } from '@/api/member/auth'
const sendCodeLoading = ref(false)
const sendCode = async () => {
  if (!userInfo.value?.mobile) return ElMessage.error('未绑定手机号')
  sendCodeLoading.value = true
  try {
    await sendSmsCode({ mobile: userInfo.value.mobile, scene: 3 })
    ElMessage.success('验证码已发送')
  } catch (e: any) {
    ElMessage.error(e?.msg || '验证码发送失败')
  } finally {
    sendCodeLoading.value = false
  }
}
</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />
    <div :class="`${prefixCls}-content`">
      <el-card :loading="loading" :class="`${prefixCls}-card`" shadow="hover">
        <div :class="`${prefixCls}-title`">
          <el-button @click="goBack" :icon="ArrowLeft" round>返回</el-button>
          <h1>个人中心</h1>
        </div>
        
        <el-tabs v-model="activeTab" class="user-tabs">
          <el-tab-pane label="基本信息" name="info">
        <div :class="`${prefixCls}-info`">
          <div :class="`${prefixCls}-avatar-wrap`">
                <el-avatar :size="120" :src="signedAvatarUrl || avatarImg" />
                <el-button type="primary" :icon="Edit" size="small" @click="openEditDialog" class="edit-btn" round>编辑信息</el-button>
          </div>
          <div :class="`${prefixCls}-details`">
            <el-descriptions title="会员信息" :column="2" border>
              <el-descriptions-item label="昵称" v-if="userInfo?.nickname">{{ userInfo.nickname }}</el-descriptions-item>
              <el-descriptions-item label="手机号" v-if="userInfo?.mobile">{{ userInfo.mobile }}</el-descriptions-item>
              <el-descriptions-item label="性别" v-if="userInfo?.sex !== undefined && userInfo?.sex !== null">
                    <el-tag v-if="userInfo.sex === 1" type="success" effect="light" round>男</el-tag>
                    <el-tag v-else-if="userInfo.sex === 2" type="danger" effect="light" round>女</el-tag>
                    <el-tag v-else type="info" effect="light" round>未知</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="会员等级" v-if="userInfo?.level && userInfo.level.name">
                    <el-tag :type="isVipUser ? 'warning' : 'info'" effect="dark" round>
                      {{ userInfo.level.name }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="经验值" v-if="userInfo?.experience !== undefined && userInfo?.experience !== null">
                    <el-progress :percentage="userInfo.experience % 100" :format="() => userInfo.experience" />
                  </el-descriptions-item>
                  <el-descriptions-item label="当前积分" v-if="userInfo?.point !== undefined && userInfo?.point !== null">
                    <span class="point-value">{{ userInfo.point }}</span>
              </el-descriptions-item>
                  <el-descriptions-item label="VIP到期时间" v-if="userInfo">
                    <el-tag v-if="isVipExpired" type="danger" effect="dark" round>已过期</el-tag>
                    <el-tag v-else-if="isVipUser" type="success" effect="dark" round>
                      <el-icon><Calendar /></el-icon>
                      {{ formattedExpireTime }}
                    </el-tag>
                    <el-tag v-else type="info" effect="light" round>普通会员</el-tag>
              </el-descriptions-item>
            </el-descriptions>
                <div class="action-buttons">
                  <el-button type="danger" :icon="Key" @click="pwdDialogVisible = true" round>修改密码</el-button>
                  <el-button type="primary" @click="fetchUserInfo" round>刷新信息</el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="VIP订单记录" name="orders">
            <div class="vip-orders">
              <div class="section-title">
                <el-icon><Ticket /></el-icon>
                <span>VIP购买记录</span>
                
                <div class="filter-actions">
                  <span class="filter-label">状态筛选：</span>
                  <el-radio-group v-model="orderStatus" @change="handleStatusChange" size="small">
                    <el-radio-button :label="null">全部</el-radio-button>
                    <el-radio-button :label="0">待支付</el-radio-button>
                    <el-radio-button :label="1">已支付</el-radio-button>
                    <el-radio-button :label="2">已取消</el-radio-button>
                  </el-radio-group>
                </div>
              </div>
              
              <el-table
                :data="vipOrderRecords"
                border
                stripe
                style="width: 100%"
                v-loading="orderLoading"
                :empty-text="orderLoading ? '加载中...' : '暂无订单记录'"
              >
                <el-table-column prop="id" label="订单号" width="100" />
                <el-table-column prop="packageName" label="套餐名称" width="150">
                  <template #default="scope">
                    <el-tag :type="scope.row.duration >= 365 ? 'warning' : 'success'" effect="plain">
                      {{ scope.row.packageName }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="packageId" label="套餐ID" width="100" />
                <el-table-column prop="price" label="价格" width="100">
                  <template #default="scope">
                    <span class="price">¥{{ scope.row.price.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="statusName" label="状态" width="100">
                  <template #default="scope">
                    <el-tag :type="orderStatusMap[scope.row.status]?.type" effect="dark" round>
                      {{ orderStatusMap[scope.row.status]?.text }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="payTime" label="支付时间" min-width="180">
                  <template #default="scope">
                    {{ formatDate(scope.row.payTime) }}
                  </template>
                </el-table-column>
                <el-table-column prop="createTime" label="创建时间" min-width="180">
                  <template #default="scope">
                    {{ formatDate(scope.row.createTime) }}
                  </template>
                </el-table-column>
              </el-table>
              
              <!-- 分页组件 -->
              <div class="pagination-container" v-if="orderPagination.total > 0">
                <el-pagination
                  v-model:current-page="orderPagination.pageNo"
                  v-model:page-size="orderPagination.pageSize"
                  :page-sizes="[10, 20, 30, 50]"
                  :total="orderPagination.total"
                  layout="total, sizes, prev, pager, next, jumper"
                  @size-change="handleSizeChange"
                  @current-change="handlePageChange"
                />
              </div>
              
              <div class="order-tips" v-if="vipOrderRecords.length > 0">
                <el-alert
                  type="info"
                  :closable="false"
                  show-icon
                >
                  <template #title>
                    <div class="order-tip-title">
                      <el-icon><ShoppingCart /></el-icon>
                      <span>共有 {{ orderPagination.total }} 条VIP购买记录</span>
                    </div>
                  </template>
                </el-alert>
          </div>
        </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- 编辑信息弹窗 -->
      <el-dialog 
        v-model="editDialogVisible" 
        title="编辑会员信息" 
        width="450px" 
        :close-on-click-modal="false"
        destroy-on-close
        center
        class="custom-dialog"
      >
        <el-form :model="editForm" label-width="80px">
          <el-form-item label="昵称">
            <el-input v-model="editForm.nickname" maxlength="20" placeholder="请输入昵称" />
          </el-form-item>
          <el-form-item label="头像">
            <el-input v-model="editForm.avatar" placeholder="请输入头像URL" />
            <div class="avatar-preview" v-if="editForm.avatar">
              <img :src="editForm.avatar" alt="头像预览" />
            </div>
          </el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="editForm.sex">
              <el-radio :label="1">男</el-radio>
              <el-radio :label="2">女</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="editDialogVisible = false" round>取消</el-button>
            <el-button type="primary" :loading="editLoading" @click="handleEditSubmit" round>保存</el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 修改密码弹窗 -->
      <el-dialog 
        v-model="pwdDialogVisible" 
        title="修改密码" 
        width="450px" 
        :close-on-click-modal="false"
        destroy-on-close
        center
        class="custom-dialog"
      >
        <el-form :model="pwdForm" label-width="80px">
          <el-form-item label="新密码">
            <el-input 
              v-model="pwdForm.password" 
              type="password" 
              show-password 
              maxlength="32"
              placeholder="请输入新密码"
            />
            <div class="form-tip">密码长度为8-32个字符，必须包含字母和数字</div>
          </el-form-item>
          <el-form-item label="验证码">
            <div class="code-input-group">
              <el-input 
                v-model="pwdForm.code" 
                maxlength="6" 
                placeholder="请输入验证码"
              />
              <el-button 
                :loading="sendCodeLoading" 
                @click="sendCode" 
                type="primary"
                round
              >
                发送验证码
              </el-button>
            </div>
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="pwdDialogVisible = false" round>取消</el-button>
            <el-button type="primary" :loading="pwdLoading" @click="handlePwdSubmit" round>确认修改</el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-user-detail;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f7fa;
  &-content {
    width: 100%;
    max-width: 1200px;
    margin: 80px auto 0;
    padding: 20px;
  }
  &-card {
    background-color: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 20px;
  }
  &-title {
    display: flex;
    align-items: center;
    margin-bottom: 30px;
    border-bottom: 1px solid #ebeef5;
    padding-bottom: 15px;
    h1 {
      margin: 0 0 0 20px;
      font-size: 24px;
      font-weight: 500;
      color: #303133;
    }
  }
  &-info {
    display: flex;
    margin-bottom: 30px;
    @media (max-width: 768px) {
      flex-direction: column;
    }
  }
  &-avatar-wrap {
    margin-right: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    .el-avatar {
      margin-bottom: 15px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      border: 4px solid #fff;
    }
    .edit-btn {
      margin-top: 15px;
    }
    @media (max-width: 768px) {
      margin-right: 0;
      margin-bottom: 30px;
    }
  }
  &-details {
    flex: 1;
    
    :deep(.el-descriptions__body) {
      width: 100%;
    }
    
    :deep(.el-descriptions__label) {
      background-color: #f8f9fb;
      color: #606266;
    }
    
    :deep(.el-tag) {
      font-weight: 500;
    }
    
    .point-value {
      font-weight: bold;
      color: #ff9900;
      font-size: 16px;
    }
    
    .action-buttons {
      margin-top: 24px;
      display: flex;
      gap: 12px;
    }
  }
}

// 自定义对话框样式
.custom-dialog {
  :deep(.el-dialog__header) {
    padding: 20px;
    margin-right: 0;
    text-align: center;
    border-bottom: 1px solid #ebeef5;
    
    .el-dialog__title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }
  
  :deep(.el-dialog__body) {
    padding: 30px 25px;
  }
  
  :deep(.el-dialog__footer) {
    padding: 15px 20px;
    border-top: 1px solid #ebeef5;
  }
  
  .dialog-footer {
    display: flex;
    justify-content: center;
    gap: 15px;
    
    .el-button {
      min-width: 100px;
    }
  }
  
  .avatar-preview {
    margin-top: 10px;
    text-align: center;
    
    img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #ebeef5;
    }
  }
  
  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
    line-height: 1.4;
  }
  
  .code-input-group {
    display: flex;
    gap: 10px;
    
    .el-input {
      flex: 1;
    }
    
    .el-button {
      white-space: nowrap;
    }
  }
}

// 标签页样式
.user-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 25px;
  }
  
  :deep(.el-tabs__item) {
    font-size: 16px;
    padding: 0 25px;
    height: 50px;
    line-height: 50px;
  }
  
  :deep(.el-tabs__active-bar) {
    height: 3px;
  }
}

// VIP订单记录样式
.vip-orders {
  .section-title {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    font-size: 18px;
    font-weight: 500;
    color: #303133;
    flex-wrap: wrap;
    gap: 15px;
    
    .el-icon {
      margin-right: 8px;
      font-size: 20px;
      color: #409eff;
    }
    
    .filter-actions {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      
      .filter-label {
        font-size: 14px;
        color: #606266;
      }
      
      @media (max-width: 768px) {
        margin-left: 0;
        margin-top: 10px;
        width: 100%;
      }
    }
  }
  
  .price {
    color: #f56c6c;
    font-weight: bold;
  }
  
  .order-tips {
    margin-top: 20px;
    
    .order-tip-title {
      display: flex;
      align-items: center;
      
      .el-icon {
        margin-right: 5px;
      }
    }
  }
  
  :deep(.el-table) {
    border-radius: 8px;
    overflow: hidden;
    
    .el-table__header-wrapper th {
      background-color: #f5f7fa;
      color: #606266;
      font-weight: 600;
    }
  }
}

@media (max-width: 768px) {
  .vip-orders {
    :deep(.el-table) {
      width: 100%;
      overflow-x: auto;
    }
  }
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  
  :deep(.el-pagination) {
    padding: 0;
    margin: 0;
    font-weight: normal;
    
    .el-pagination__sizes {
      margin-left: 15px;
    }
  }
}
</style>
