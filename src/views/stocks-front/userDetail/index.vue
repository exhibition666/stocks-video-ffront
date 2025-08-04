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
      // console.log('找到ID最小的会员等级:', normalLevel.value)
    }
  } catch (error) {
    // console.error('获取会员等级列表失败:', error)
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
      // console.log('获取到VIP订单记录:', vipOrderRecords.value)
    } else {
      vipOrderRecords.value = []
      orderPagination.value.total = 0
    }
  } catch (error) {
    // console.error('获取VIP订单记录失败:', error)
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
  
      // console.log('检查VIP过期状态...')
  
  try {
    // 尝试从多个可能的字段名称获取VIP到期时间
    const vipExpireTime = userInfo.value.vipExpireTime || userInfo.value.vip_expire_time || userInfo.value.expireTime
    
    if (vipExpireTime) {
      // console.log('找到VIP到期时间:', vipExpireTime)
      const now = new Date()
      const expireDate = new Date(vipExpireTime)
      
      // 判断是否已过期
      if (now > expireDate) {
        // console.log('VIP已过期，准备降级为普通用户')
        
        // 如果会员等级列表未加载，先加载
        if (!normalLevel.value) {
          await fetchMemberLevels()
        }
        
        if (normalLevel.value) {
          // 当前用户等级ID
          const currentLevelId = userInfo.value.level?.id || userInfo.value.level_id || userInfo.value.levelId
          
          // 如果当前不是最低等级，则只在前端进行降级处理
          if (currentLevelId !== normalLevel.value.id) {
            // console.log('执行前端降级操作，从', currentLevelId, '降级到', normalLevel.value.id)
            
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
                            // console.log('用户已经是最低等级会员，无需降级')
          }
        }
      } else {
        // console.log('VIP未过期，到期时间:', expireDate.toISOString())
      }
    } else {
              // console.log('用户无VIP到期时间记录，视为普通用户')
    }
  } catch (error) {
    // console.error('检查VIP过期出错:', error)
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
    // console.error(e)
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
const editForm = ref({ nickname: '' })
const editLoading = ref(false)
const openEditDialog = () => {
  if (!userInfo.value) return
  editForm.value = {
    nickname: userInfo.value.nickname || ''
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
          <div :class="`${prefixCls}-profile-card`">
            <div class="profile-header">
              <div class="user-avatar">
                <div class="avatar-circle">
                  <i class="el-icon-user"></i>
                </div>
              </div>
              <div class="user-basic">
                <h2 class="user-name">{{ userInfo?.nickname || '未设置昵称' }}</h2>
                <div class="user-level">
                  <el-tag :type="isVipUser ? 'warning' : 'info'" effect="dark" size="large">
                    {{ userInfo?.level?.name || '普通会员' }}
                  </el-tag>
                </div>
              </div>
            </div>

            <div class="profile-content">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">
                    <i class="el-icon-phone"></i>
                    <span>手机号</span>
                  </div>
                  <div class="info-value">{{ userInfo?.mobile || '未绑定' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-label">
                    <i class="el-icon-medal"></i>
                    <span>会员等级</span>
                  </div>
                  <div class="info-value">
                    <el-tag :type="isVipUser ? 'warning' : 'info'" effect="plain" round>
                      {{ userInfo?.level?.name || '普通会员' }}
                    </el-tag>
                  </div>
                </div>

                <div class="info-item">
                  <div class="info-label">
                    <i class="el-icon-time"></i>
                    <span>VIP到期时间</span>
                  </div>
                  <div class="info-value">
                    <el-tag v-if="isVipExpired" type="danger" effect="dark" round>已过期</el-tag>
                    <el-tag v-else-if="isVipUser" type="success" effect="dark" round>
                      {{ formattedExpireTime }}
                    </el-tag>
                    <el-tag v-else type="info" effect="light" round>普通会员</el-tag>
                  </div>
                </div>
              </div>

              <div class="action-buttons">
                <el-button type="primary" :icon="Edit" @click="openEditDialog" round>编辑信息</el-button>
                <el-button type="danger" :icon="Key" @click="pwdDialogVisible = true" round>修改密码</el-button>
                <el-button type="success" @click="fetchUserInfo" round>刷新信息</el-button>
              </div>
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
        width="480px"
        :close-on-click-modal="false"
        destroy-on-close
        center
        class="edit-dialog"
      >
        <template #header>
          <div class="dialog-header">
            <div class="header-icon">
              <i class="el-icon-edit"></i>
            </div>
            <h3>编辑昵称</h3>
            <p>修改您的显示昵称</p>
          </div>
        </template>

        <div class="dialog-content">
          <el-form :model="editForm" label-width="0" class="edit-form">
            <div class="form-item">
              <div class="input-label">
                <i class="el-icon-user"></i>
                <span>昵称</span>
              </div>
              <el-input
                v-model="editForm.nickname"
                maxlength="20"
                placeholder="请输入昵称"
                size="large"
                class="custom-input"
                show-word-limit
              />
              <div class="form-tip">昵称长度为1-20个字符</div>
            </div>
          </el-form>
        </div>

        <template #footer>
          <div class="dialog-footer">
            <el-button @click="editDialogVisible = false" size="large" class="cancel-btn">取消</el-button>
            <el-button type="primary" :loading="editLoading" @click="handleEditSubmit" size="large" class="confirm-btn">保存修改</el-button>
          </div>
        </template>
      </el-dialog>

      <!-- 修改密码弹窗 -->
      <el-dialog
        v-model="pwdDialogVisible"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        center
        class="password-dialog"
      >
        <template #header>
          <div class="dialog-header">
            <div class="header-icon">
              <i class="el-icon-key"></i>
            </div>
            <h3>修改密码</h3>
            <p>为了您的账户安全，请设置新密码</p>
          </div>
        </template>

        <div class="dialog-content">
          <el-form :model="pwdForm" label-width="0" class="password-form">
            <div class="form-item">
              <div class="input-label">
                <i class="el-icon-lock"></i>
                <span>新密码</span>
              </div>
              <el-input
                v-model="pwdForm.password"
                type="password"
                show-password
                maxlength="32"
                placeholder="请输入新密码"
                size="large"
                class="custom-input"
              />
              <div class="form-tip">密码长度为8-32个字符，必须包含字母和数字</div>
            </div>

            <div class="form-item">
              <div class="input-label">
                <i class="el-icon-message"></i>
                <span>验证码</span>
              </div>
              <div class="code-input-group">
                <el-input
                  v-model="pwdForm.code"
                  maxlength="6"
                  placeholder="请输入验证码"
                  size="large"
                  class="custom-input"
                />
                <el-button
                  :loading="sendCodeLoading"
                  @click="sendCode"
                  type="primary"
                  size="large"
                  class="send-code-btn"
                >
                  发送验证码
                </el-button>
              </div>
            </div>
          </el-form>
        </div>

        <template #footer>
          <div class="dialog-footer">
            <el-button @click="pwdDialogVisible = false" size="large" class="cancel-btn">取消</el-button>
            <el-button type="primary" :loading="pwdLoading" @click="handlePwdSubmit" size="large" class="confirm-btn">确认修改</el-button>
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
    margin-bottom: 30px;
  }

  &-profile-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    padding: 0;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);

    .profile-header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 40px 30px;
      display: flex;
      align-items: center;
      gap: 30px;

      .user-avatar {
        .avatar-circle {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid rgba(255, 255, 255, 0.3);

          i {
            font-size: 40px;
            color: rgba(255, 255, 255, 0.9);
          }
        }
      }

      .user-basic {
        flex: 1;

        .user-name {
          font-size: 28px;
          font-weight: 700;
          color: white;
          margin: 0 0 15px 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .user-level {
          :deep(.el-tag) {
            font-size: 16px;
            padding: 8px 16px;
            font-weight: 600;
          }
        }
      }
    }

    .profile-content {
      background: white;
      padding: 40px 30px;

      .info-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 25px;
        margin-bottom: 40px;

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #667eea;

          .info-label {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            color: #495057;

            i {
              font-size: 18px;
              color: #667eea;
            }
          }

          .info-value {
            font-weight: 500;
            color: #212529;

            :deep(.el-tag) {
              font-weight: 600;
            }
          }
        }
      }

      .action-buttons {
        display: flex;
        justify-content: center;
        gap: 15px;
        flex-wrap: wrap;

        .el-button {
          min-width: 120px;
          height: 44px;
          font-weight: 600;

          &.el-button--primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;

            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
            }
          }
        }
      }
    }

    @media (max-width: 768px) {
      .profile-header {
        flex-direction: column;
        text-align: center;
        gap: 20px;
        padding: 30px 20px;

        .user-basic .user-name {
          font-size: 24px;
        }
      }

      .profile-content {
        padding: 30px 20px;

        .action-buttons {
          flex-direction: column;

          .el-button {
            width: 100%;
          }
        }
      }
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

// 密码修改对话框样式
.password-dialog {
  :deep(.el-dialog) {
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  :deep(.el-dialog__header) {
    padding: 0;
    margin: 0;
    border: none;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__footer) {
    padding: 0;
    border: none;
  }

  .dialog-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 40px 30px;
    text-align: center;
    color: white;

    .header-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;

      i {
        font-size: 36px;
        color: white;
      }
    }

    h3 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 10px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    p {
      font-size: 16px;
      margin: 0;
      opacity: 0.9;
    }
  }

  .dialog-content {
    padding: 40px 30px;
    background: white;

    .password-form {
      .form-item {
        margin-bottom: 30px;

        .input-label {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-weight: 600;
          color: #495057;

          i {
            font-size: 18px;
            color: #667eea;
          }
        }

        .custom-input {
          :deep(.el-input__wrapper) {
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 2px solid #e9ecef;
            transition: all 0.3s ease;

            &:hover {
              border-color: #667eea;
            }

            &.is-focus {
              border-color: #667eea;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            }
          }
        }

        .form-tip {
          font-size: 13px;
          color: #6c757d;
          margin-top: 8px;
          padding-left: 12px;
          line-height: 1.4;
        }

        .code-input-group {
          display: flex;
          gap: 12px;

          .custom-input {
            flex: 1;
          }

          .send-code-btn {
            min-width: 120px;
            border-radius: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            font-weight: 600;

            &:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
            }
          }
        }
      }
    }
  }

  .dialog-footer {
    padding: 30px;
    background: #f8f9fa;
    display: flex;
    justify-content: center;
    gap: 20px;

    .el-button {
      min-width: 120px;
      height: 48px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
    }

    .cancel-btn {
      background: white;
      border: 2px solid #dee2e6;
      color: #6c757d;

      &:hover {
        border-color: #adb5bd;
        color: #495057;
      }
    }

    .confirm-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
      }
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

// 编辑信息对话框样式
.edit-dialog {
  :deep(.el-dialog) {
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  :deep(.el-dialog__header) {
    padding: 0;
    margin: 0;
    border: none;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }

  :deep(.el-dialog__footer) {
    padding: 0;
    border: none;
  }

  .dialog-header {
    background: linear-gradient(135deg, #34a853 0%, #137333 100%);
    padding: 40px 30px;
    text-align: center;
    color: white;

    .header-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;

      i {
        font-size: 36px;
        color: white;
      }
    }

    h3 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 10px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    p {
      font-size: 16px;
      margin: 0;
      opacity: 0.9;
    }
  }

  .dialog-content {
    padding: 40px 30px;
    background: white;

    .edit-form {
      .form-item {
        .input-label {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          font-weight: 600;
          color: #495057;

          i {
            font-size: 18px;
            color: #34a853;
          }
        }

        .custom-input {
          :deep(.el-input__wrapper) {
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 2px solid #e9ecef;
            transition: all 0.3s ease;

            &:hover {
              border-color: #34a853;
            }

            &.is-focus {
              border-color: #34a853;
              box-shadow: 0 4px 12px rgba(52, 168, 83, 0.2);
            }
          }
        }

        .form-tip {
          font-size: 13px;
          color: #6c757d;
          margin-top: 8px;
          padding-left: 12px;
          line-height: 1.4;
        }
      }
    }
  }

  .dialog-footer {
    padding: 30px;
    background: #f8f9fa;
    display: flex;
    justify-content: center;
    gap: 20px;

    .el-button {
      min-width: 120px;
      height: 48px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
    }

    .cancel-btn {
      background: white;
      border: 2px solid #dee2e6;
      color: #6c757d;

      &:hover {
        border-color: #adb5bd;
        color: #495057;
      }
    }

    .confirm-btn {
      background: linear-gradient(135deg, #34a853 0%, #137333 100%);
      border: none;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(52, 168, 83, 0.4);
      }
    }
  }
}
</style>
