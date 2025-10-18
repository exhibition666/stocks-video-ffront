<script lang="ts" setup>
import { useDesign } from '@/hooks/web/useDesign'
import { useRouter } from 'vue-router'
import { ref, reactive, onMounted, computed, onUnmounted, watch } from 'vue'
import StocksHeader from '@/components/StocksHeader/index.vue'
import { ElMessage, ElLoading, ElCard, ElDescriptions, ElDescriptionsItem, ElDivider, ElRow, ElNotification } from 'element-plus'
import * as XLSX from 'xlsx'
import { InfoFilled, QuestionFilled } from '@element-plus/icons-vue'
import { getFilePage } from '@/api/infra/file'
import { getAppSTSToken, listFilesWithSTS } from '@/api/infra/file/app-sts'
import { extractOptionInquiryFromExcel, OptionInquiryParams, OptionInquiryResult, getStockListSimple, getOptionPriceByCondition } from '@/api/stocks-front/option-inquiry'
import request from '@/config/axios'
import OSS from 'ali-oss'
import { useUserStore } from '@/store/modules/user'
import { getAccessToken } from '@/utils/auth'

const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('inquiry')
const router = useRouter()
const userStore = useUserStore()

// 登录状态检查
const isLoggedIn = computed(() => {
  return !!getAccessToken() && !!userStore.user
})

// 跳转到登录页面
const goToLogin = () => {
  router.push('/stocks-front/login')
}

// 返回首页
const goToHome = () => {
  router.push('/stocks-front/home')
}

// 监听登录状态变化，登录后自动加载数据
watch(isLoggedIn, (newValue) => {
  if (newValue) {
    // 用户登录后，只从API加载股票选项
    // console.log('用户已登录，开始加载数据...')
    loadStockOptionsFromAPI()
  }
}, { immediate: false })

// Excel文件信息接口
interface ExcelFileInfo {
  id: number
  name: string
  path: string
  size: number
  createTime: string
}

// OSS配置
const OSS_CONFIG_ID = import.meta.env.VITE_OSS_CONFIG_ID || 31

// 文件加载相关状态 - 已禁用OSS加载
const isStockIndexLoaded = ref(true) // 直接设为true，不再依赖Excel文件
const isStockOptionsLoaded = ref(true) // 直接设为true，不再依赖Excel文件
const stockIndexFileName = ref('API接口数据')
const stockOptionsFileName = ref('API接口数据')
const isLoadingFiles = ref(false)

// 调试信息
const debugInfo = ref({
  apiCalled: false,
  filesFound: 0,
  lastError: '',
  loadAttempts: 0
})

// 调试面板显示状态
const showDebugPanel = ref(false)
const debugData = ref({
  stockIndexSheets: [] as string[],
  stockOptionsSheets: [] as string[],
  vanillaSheetData: [] as any[],
  originalVanillaSheetData: [] as any[], // 原始数据
  selectedStockRow: null as any,
  availableColumns: [] as string[],
  searchParams: null as any,
  dataProcessingInfo: null as any // 数据处理信息
})

// 表单数据
const formData = reactive({
  stockCode: '',
  optionType: 'call',
  term: '2W',
  structureType: 'atm', // 'atm'=平值, 'itm'=实值, 'otm'=虚值, 'custom'=自定义
  strikePriceRatio: '100', // 行权价格比例
  strikePrice: '',
  expiryDate: ''
})

// 行权价格比例选项 - 与数据库字段完全匹配
const itmPrices = ref(['80', '90', '95']) // 实值期权：80%, 90%, 95%
const otmPrices = ref(['103', '105', '110']) // 虚值期权：103%, 105%, 110%, 120%
const discountPrices = ref(['8080', '9070', '9090']) // 折价期权：8080, 8090, 9070, 9080, 9090

// 处理期限变更
const handleTermChange = (term) => {
  // 根据选择的期限，计算到期日
  const today = new Date()
  let expiryDate = new Date(today)
  
  switch(term) {
    case '2W':
      expiryDate.setDate(today.getDate() + 14)
      break
    case '1M':
      expiryDate.setMonth(today.getMonth() + 1)
      break
    case '2M':
      expiryDate.setMonth(today.getMonth() + 2)
      break
    case '3M':
      expiryDate.setMonth(today.getMonth() + 3)
      break
    case '6M':
      expiryDate.setMonth(today.getMonth() + 6)
      break
    case '12M':
      expiryDate.setFullYear(today.getFullYear() + 1)
      break
  }
  
  // 格式化日期为YYYY-MM-DD
  const year = expiryDate.getFullYear()
  const month = String(expiryDate.getMonth() + 1).padStart(2, '0')
  const day = String(expiryDate.getDate()).padStart(2, '0')
  formData.expiryDate = `${year}-${month}-${day}`
}

// 处理结构类型变更
const handleStructureTypeChange = (type) => {
  if (type === 'atm') {
    formData.strikePriceRatio = '100'
  } else if (type === 'itm') {
    formData.strikePriceRatio = '90' // 默认选择90%
  } else if (type === 'otm') {
    formData.strikePriceRatio = '103' // 默认选择103%
  } else if (type === 'discount') {
    formData.strikePriceRatio = '8080' // 默认选择8080
  }
  
  // 如果不是自定义，根据比例计算行权价格
  if (type !== 'custom') {
    calculateStrikePrice()
  }
}

// 选择结构和行权价格比例
const selectStructureAndRatio = (structureType, ratio) => {
  formData.structureType = structureType
  formData.strikePriceRatio = ratio
  formData.optionType = 'call' // 默认选择看涨期权
  calculateStrikePrice()
}

// 选择行权价格比例（保留兼容性）
const selectStrikePriceRatio = (ratio) => {
  formData.strikePriceRatio = ratio
  calculateStrikePrice()
}

// 计算行权价格
const calculateStrikePrice = () => {
  // 获取当前选中股票的价格
  const selectedOption = stockOptions.value.find(option => option.value === formData.stockCode)
  if (!selectedOption || !selectedOption.price) {
    // 如果没有价格信息，使用模拟价格
    const mockPrice = generateMockPrice(formData.stockCode)
    formData.strikePrice = (mockPrice * parseFloat(formData.strikePriceRatio) / 100).toFixed(2)
    return
  }
  
  const currentPrice = selectedOption.price
  const ratio = parseFloat(formData.strikePriceRatio) / 100
  formData.strikePrice = (currentPrice * ratio).toFixed(2)
}

// 禁用过去的日期
const disabledDate = (time) => {
  return time.getTime() < Date.now() - 8.64e7 // 禁用今天之前的日期
}

// 通过STS下载并解析Excel文件
const downloadAndParseExcel = async (filePath: string, fileName: string): Promise<any> => {
  try {
    // 如果是测试数据，返回模拟的Excel数据
    if (filePath.startsWith('test/')) {
      // console.log('检测到测试数据，返回模拟Excel内容')
      return {
        sheetsData: {
          'Sheet1': [
            { '股票代码': '000001', '股票名称': '平安银行', '现价': 10.50 },
            { '股票代码': '000002', '股票名称': '万科A', '现价': 15.20 },
            { '股票代码': '600000', '股票名称': '浦发银行', '现价': 8.90 }
          ]
        },
        firstSheetData: [
          { '股票代码': '000001', '股票名称': '平安银行', '现价': 10.50 },
          { '股票代码': '000002', '股票名称': '万科A', '现价': 15.20 },
          { '股票代码': '600000', '股票名称': '浦发银行', '现价': 8.90 }
        ],
        has7095Sheet: false,
        fileName
      }
    }

    // 获取STS临时凭证 (使用前台用户专用接口)
    // console.log('正在获取前台用户STS临时凭证...')
    const stsToken = await getAppSTSToken(OSS_CONFIG_ID)
    
    if (!stsToken || !stsToken.accessKeyId || !stsToken.endpoint || !stsToken.bucket) {
      throw new Error('获取STS凭证失败，或凭证中缺少必要信息')
    }
    
    // console.log('成功获取STS凭证:', {
    //   accessKeyId: stsToken.accessKeyId,
    //   endpoint: stsToken.endpoint,
    //   bucket: stsToken.bucket,
    //   expiration: stsToken.expiration
    // })

    // 初始化OSS客户端
    // console.log('初始化OSS客户端...')
    const client = new OSS({
      accessKeyId: stsToken.accessKeyId,
      accessKeySecret: stsToken.accessKeySecret,
      stsToken: stsToken.securityToken,
      bucket: stsToken.bucket,
      endpoint: stsToken.endpoint,
      secure: true // 强制使用HTTPS
    })

    // 使用OSS客户端下载文件
    // console.log(`开始从OSS下载文件: ${filePath}`)
    const result = await client.get(filePath)
    // console.log('文件下载成功，大小:', result.content.length, 'bytes')

    if (!result.content || result.content.length === 0) {
      throw new Error('下载的文件为空')
    }

    // 解析Excel文件
    // console.log('开始解析Excel文件...')
    const data = new Uint8Array(result.content)
    
    // 检查文件头，确认是Excel格式
    const fileHeader = Array.from(data.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('')
    // console.log('文件头部签名:', fileHeader)

    // Excel文件的常见文件头
    const excelSignatures = [
      '504b0304', // ZIP格式 (.xlsx)
      'd0cf11e0', // OLE格式 (.xls)
      '504b0506', // ZIP格式变体
      '504b0708'  // ZIP格式变体
    ]

    const isValidExcel = excelSignatures.some(sig => fileHeader.startsWith(sig))
    if (!isValidExcel) {
      // console.error('文件头部不匹配Excel格式，实际头部:', fileHeader)
      throw new Error('下载的文件不是有效的Excel格式')
    }

    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false
    })

    // 处理所有sheet
    const sheetsData: any = {}
    let firstSheetData: any[] = []

    // 特别关注7095工作表
    let has7095Sheet = workbook.SheetNames.includes('7095')

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length > 0) {
        sheetsData[sheetName] = jsonData

        // 如果是7095工作表，进行特殊处理并打印日志
        if (sheetName === '7095') {
          // console.log(`${fileName} - 找到7095工作表, 数据条数:`, jsonData.length)
          // console.log(`${fileName} - 7095工作表数据样例:`, jsonData.slice(0, 2))
        }

        // 保存第一个非空sheet的数据作为主数据
        if (firstSheetData.length === 0) {
          firstSheetData = jsonData
        }
      }
    })

    // console.log(`${fileName} 解析完成，共读取 ${Object.keys(sheetsData).length} 个工作表`)

    return {
      sheetsData,
      firstSheetData,
      has7095Sheet,
      fileName
    }
  } catch (error: any) {
    // console.error(`解析文件 ${fileName} 失败:`, error)

    // 提供更详细的错误信息
    let errorMessage = `解析文件 ${fileName} 失败`
    if (error.message) {
      if (error.message.includes('Invalid HTML')) {
        errorMessage += ': 文件格式无效，可能下载的不是Excel文件'
      } else if (error.message.includes('权限')) {
        errorMessage += ': 文件访问权限不足'
      } else if (error.message.includes('网络')) {
        errorMessage += ': 网络连接问题'
      } else {
        errorMessage += ': ' + error.message
      }
    }

    throw new Error(errorMessage)
  }
}

// 从infra_file表获取Excel文件列表
const getExcelFilesFromDB = async (): Promise<ExcelFileInfo[]> => {
  try {
    const params: PageParam = {
      pageNo: 1,
      pageSize: 100
    }

    // console.log('正在查询infra_file表中的文件...')
    const response = await getFilePage(params)
    // console.log('API响应:', response)

    // 检查响应数据结构
    let files: any[] = []
    if (response && response.list) {
      files = response.list
    } else if (Array.isArray(response)) {
      files = response
    } else if (response && response.data && Array.isArray(response.data)) {
      files = response.data
    } else {
      // console.warn('未找到文件列表数据，响应结构:', response)
      return []
    }

    // console.log('找到文件总数:', files.length)

    // 过滤出Excel文件，并且文件名包含相关关键词
    const excelFiles = files.filter((file: any) => {
      const fileName = file.name || file.fileName || ''
      const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
      const isQuoteTable = fileName.includes('报价表') ||
                          fileName.includes('报价') ||
                          fileName.includes('期权') ||
                          fileName.includes('股指') ||
                          fileName.includes('excel') ||
                          fileName.includes('Excel')

      // console.log(`文件: ${fileName}, 是Excel: ${isExcel}, 包含关键词: ${isQuoteTable}`)
      return isExcel && isQuoteTable
    })

    // console.log('过滤后的Excel文件:', excelFiles)

    return excelFiles.map((file: any) => {
      // 处理文件路径，确保格式正确
      let filePath = file.path || file.url || file.name || file.fileName

              // 如果路径不是完整的OSS路径，可能需要添加前缀
        if (filePath && !filePath.startsWith('http') && !filePath.includes('/')) {
          // 如果只是文件名，可能需要添加目录前缀
          // console.log('文件路径可能需要调整:', filePath)
        }

      return {
        id: file.id,
        name: file.name || file.fileName,
        path: filePath,
        size: file.size || file.fileSize || 0,
        createTime: file.createTime
      }
    })
  } catch (error: any) {
    console.error('从infra_file表获取文件列表失败:', error)
    // console.log('尝试使用前台用户STS接口获取文件列表...')

    // 备用方案：使用前台用户STS接口获取文件列表
    try {
      // 1. 先获取STS临时凭证
      const stsToken = await getAppSTSToken(OSS_CONFIG_ID)
      // console.log('成功获取STS凭证用于列表查询:', stsToken)
      
      // 2. 使用STS凭证获取文件列表
      const listResponse = await listFilesWithSTS({
        configId: OSS_CONFIG_ID,
        path: '', // 根目录
        maxKeys: 100,
        accessKeyId: stsToken.accessKeyId,
        accessKeySecret: stsToken.accessKeySecret,
        securityToken: stsToken.securityToken
      })

      // console.log('前台用户STS文件列表响应:', listResponse)

      if (listResponse && listResponse.data && Array.isArray(listResponse.data)) {
        const ossFiles = listResponse.data.filter((file: any) => {
          const fileName = file.name || file.key || ''
          const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls')
          const isQuoteTable = fileName.includes('报价表') ||
                              fileName.includes('报价') ||
                              fileName.includes('期权') ||
                              fileName.includes('股指')
          return isExcel && isQuoteTable
        })

        return ossFiles.map((file: any, index: number) => ({
          id: index + 1,
          name: file.name || file.key,
          path: file.name || file.key,
          size: file.size || 0,
          createTime: file.lastModified || new Date().toISOString()
        }))
      }
    } catch (ossError: any) {
      console.error('前台用户STS获取文件列表也失败了:', ossError)
    }

    ElMessage.error(`获取Excel文件列表失败: ${error?.message || error}`)

    // 最后的备用方案：返回模拟数据用于测试
    // console.log('使用模拟数据进行测试...')
    return [
      {
        id: 1,
        name: '股指期权报价表.xlsx',
        path: 'test/股指期权报价表.xlsx',
        size: 1024000,
        createTime: new Date().toISOString()
      },
      {
        id: 2,
        name: '个股期权报价表.xlsx',
        path: 'test/个股期权报价表.xlsx',
        size: 2048000,
        createTime: new Date().toISOString()
      }
    ]
  }
}

// 从OSS加载Excel文件的主函数
const loadExcelFilesFromOSS = async () => {
  isLoadingFiles.value = true
  debugInfo.value.loadAttempts++
  debugInfo.value.lastError = ''

  try {
    // 1. 从infra_file表获取Excel文件列表
    debugInfo.value.apiCalled = true
    const excelFiles = await getExcelFilesFromDB()
    debugInfo.value.filesFound = excelFiles.length

    if (excelFiles.length === 0) {
      ElMessage.warning('数据库中未找到Excel文件，将使用测试数据进行演示')
      // 使用更丰富的测试数据
      const mockStockIndexData = [
        { '股票代码': '000300', '股票名称': '沪深300ETF', '现价': 4.125, '涨跌幅': '+1.23%' },
        { '股票代码': '000016', '股票名称': '上证50ETF', '现价': 2.856, '涨跌幅': '+0.85%' },
        { '股票代码': '000905', '股票名称': '中证500ETF', '现价': 1.234, '涨跌幅': '-0.45%' }
      ]

      const mockStockOptionsData = [
        { '证券代码': '000001', '证券简称': '平安银行', '现价': 10.50, '1M(Exp.25/08/04)': 0.0234, '1m(90call)': 0.0156, '1m(110call)': 0.0089 },
        { '证券代码': '000002', '证券简称': '万科A', '现价': 15.20, '1M(Exp.25/08/04)': 0.0345, '1m(90call)': 0.0267, '1m(110call)': 0.0123 },
        { '证券代码': '600000', '证券简称': '浦发银行', '现价': 8.90, '1M(Exp.25/08/04)': 0.0198, '1m(90call)': 0.0134, '1m(110call)': 0.0078 },
        { '证券代码': '600036', '证券简称': '招商银行', '现价': 35.60, '1M(Exp.25/08/04)': 0.0567, '1m(90call)': 0.0423, '1m(110call)': 0.0234 },
        { '证券代码': '000858', '证券简称': '五粮液', '现价': 128.50, '1M(Exp.25/08/04)': 0.1234, '1m(90call)': 0.0987, '1m(110call)': 0.0567 }
      ]

      await processStockIndexDataFromOSS({
        sheetsData: {
          '股指期权': mockStockIndexData,
          '沪深300': mockStockIndexData.slice(0, 1),
          '上证50': mockStockIndexData.slice(1, 2)
        },
        firstSheetData: mockStockIndexData,
        has7095Sheet: false,
        fileName: '测试股指期权数据'
      })

      await processStockOptionsDataFromOSS({
        sheetsData: {
          '香草看涨报价': mockStockOptionsData,
          '7095': mockStockOptionsData.map(item => ({
            '代码': item['证券代码'],
            '标的': item['证券简称'],
            '现价': item['现价']
          }))
        },
        firstSheetData: mockStockOptionsData,
        has7095Sheet: true,
        fileName: '测试个股期权数据'
      })

      isStockIndexLoaded.value = true
      isStockOptionsLoaded.value = true
      stockIndexFileName.value = '测试股指期权数据'
      stockOptionsFileName.value = '测试个股期权数据'
      ElMessage.success('测试数据加载成功，您可以体验期权询价功能')
      return
    }

    if (excelFiles.length < 2) {
      ElMessage.warning(`数据库中只找到${excelFiles.length}个Excel文件，建议上传股指期权和个股期权两个报价表文件`)
      // 继续处理，即使只有一个文件
    }

    // console.log('找到Excel文件:', excelFiles)

    // 2. 根据文件名判断文件类型并加载
    let stockIndexFile = null
    let stockOptionsFile = null

    // 首先尝试通过文件名明确区分股指期权和个股期权文件
    for (const file of excelFiles) {
      const fileName = file.name.toLowerCase()

      // 更精确地判断文件类型
      if ((fileName.includes('股指') || fileName.includes('指数') || fileName.includes('沪深300')) && !stockIndexFile) {
        // console.log('正在加载股指期权文件:', file.name)
        try {
          stockIndexFile = await downloadAndParseExcel(file.path, file.name)
          stockIndexFileName.value = file.name
          isStockIndexLoaded.value = true
          // console.log('股指期权文件加载成功')
        } catch (error) {
          // console.error('加载股指期权文件失败:', error)
        }
      } else if ((fileName.includes('个股') || fileName.includes('股票') || fileName.includes('中信') || fileName.includes('证券')) && !stockOptionsFile) {
        // console.log('正在加载个股期权文件:', file.name)
        try {
          stockOptionsFile = await downloadAndParseExcel(file.path, file.name)
          stockOptionsFileName.value = file.name
          isStockOptionsLoaded.value = true
          // console.log('个股期权文件加载成功')
        } catch (error) {
          // console.error('加载个股期权文件失败:', error)
        }
      }

      // 如果两个文件都找到了，就停止查找
      if (stockIndexFile && stockOptionsFile) {
        break
      }
    }

    // 3. 如果没有找到合适的文件，尝试通过文件内容判断
    if (!stockIndexFile || !stockOptionsFile) {
      // 获取未分类的文件
      const remainingFiles = excelFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        const isStockIndex = fileName.includes('股指') || fileName.includes('指数') || fileName.includes('沪深300');
        const isStockOption = fileName.includes('个股') || fileName.includes('股票') || fileName.includes('中信') || fileName.includes('证券');
        
        // 如果已经找到了股指期权文件，且当前文件被识别为股指期权，则跳过
        if (stockIndexFile && isStockIndex) return false;
        // 如果已经找到了个股期权文件，且当前文件被识别为个股期权，则跳过
        if (stockOptionsFile && isStockOption) return false;
        
        return true;
      });

      // 如果还有未分类的文件，尝试加载并通过内容判断
      for (const file of remainingFiles) {
        try {
          const excelData = await downloadAndParseExcel(file.path, file.name);
          
          // 通过内容判断文件类型
          const isLikelyStockIndex = isFileStockIndex(excelData);
          
          if (!stockIndexFile && isLikelyStockIndex) {
            // console.log(`通过内容判断 ${file.name} 为股指期权文件`);
            stockIndexFile = excelData;
            stockIndexFileName.value = file.name;
            isStockIndexLoaded.value = true;
          } else if (!stockOptionsFile && !isLikelyStockIndex) {
            // console.log(`通过内容判断 ${file.name} 为个股期权文件`);
            stockOptionsFile = excelData;
            stockOptionsFileName.value = file.name;
            isStockOptionsLoaded.value = true;
          }
          
          // 如果两个文件都找到了，就停止查找
          if (stockIndexFile && stockOptionsFile) {
            break;
          }
        } catch (error) {
          // console.error(`尝试加载文件 ${file.name} 失败:`, error);
        }
      }
    }

    // 4. 如果仍然没有找到合适的文件，使用前两个文件
    if (!stockIndexFile && excelFiles.length > 0) {
      // console.log('未找到股指期权文件，使用第一个文件:', excelFiles[0].name)
      try {
        stockIndexFile = await downloadAndParseExcel(excelFiles[0].path, excelFiles[0].name)
        stockIndexFileName.value = excelFiles[0].name
        isStockIndexLoaded.value = true
      } catch (error) {
        // console.error('加载第一个文件作为股指期权文件失败:', error)
      }
    }

    if (!stockOptionsFile && excelFiles.length > 1) {
      // console.log('未找到个股期权文件，使用第二个文件:', excelFiles[1].name)
      try {
        stockOptionsFile = await downloadAndParseExcel(excelFiles[1].path, excelFiles[1].name)
        stockOptionsFileName.value = excelFiles[1].name
        isStockOptionsLoaded.value = true
      } catch (error) {
        // console.error('加载第二个文件作为个股期权文件失败:', error)
      }
    }

    // 5. 处理加载的数据
    if (stockIndexFile) {
      processStockIndexDataFromOSS(stockIndexFile)
    }

    if (stockOptionsFile) {
      processStockOptionsDataFromOSS(stockOptionsFile)
    }

    if (isStockIndexLoaded.value && isStockOptionsLoaded.value) {
      ElMessage.success('数据加载成功')
    } else {
      ElMessage.warning('部分数据加载失败，请检查文件格式')
    }

    // 确保预览数据得到更新
    updatePreviewData()

  } catch (error: any) {
    // console.error('加载Excel文件失败:', error)
    debugInfo.value.lastError = error?.message || error.toString()
    ElMessage.error('加载Excel文件失败: ' + (error?.message || error))
  } finally {
    isLoadingFiles.value = false
  }
}

// 通过内容判断文件是否为股指期权文件
const isFileStockIndex = (excelData: any): boolean => {
  // 检查是否包含股指期权特有的关键词
  const allText = JSON.stringify(excelData).toLowerCase();
  
  // 股指期权的特征关键词
  const stockIndexKeywords = ['沪深300', '上证50', '中证500', '股指期货', '指数期权', 'sse50', 'csi300', 'csi500'];
  
  // 个股期权的特征关键词
  const stockOptionsKeywords = ['个股期权', '股票期权', '中信', '证券', '平安', '万科', '茅台', '个股'];
  
  // 计算匹配度
  let stockIndexScore = 0;
  let stockOptionsScore = 0;
  
  stockIndexKeywords.forEach(keyword => {
    if (allText.includes(keyword)) stockIndexScore++;
  });
  
  stockOptionsKeywords.forEach(keyword => {
    if (allText.includes(keyword)) stockOptionsScore++;
  });
  
  // console.log(`文件内容分析 - 股指期权特征分数: ${stockIndexScore}, 个股期权特征分数: ${stockOptionsScore}`);
  
  // 如果股指期权特征分数更高，则判定为股指期权文件
  return stockIndexScore >= stockOptionsScore;
}

// 处理从OSS加载的股指期权数据
const processStockIndexDataFromOSS = (fileData) => {
  try {
    // console.log('开始处理股指期权数据:', fileData.fileName)

    // 保存所有sheet数据
    if (!allSheetsData.value.stockIndex) {
      allSheetsData.value.stockIndex = {}
    }
    allSheetsData.value.stockIndex = fileData.sheetsData

    // 保存第一个sheet的数据作为主数据
    stockIndexData.value = fileData.firstSheetData

    // console.log('股指期权数据处理完成，数据条数:', stockIndexData.value.length)
    // console.log('包含的工作表:', Object.keys(fileData.sheetsData))

    // 提取股票选项
    extractStockOptions()

    // 更新预览数据
    updatePreviewData()
    
    // 检查Excel数据加载状态
    checkExcelDataStatus()

  } catch (error) {
    // console.error('处理股指期权数据失败:', error)
    ElMessage.error('处理股指期权数据失败')
  }
}

// 处理从OSS加载的个股期权数据
const processStockOptionsDataFromOSS = (fileData) => {
  try {
    // console.log('开始处理个股期权数据:', fileData.fileName)

    // 保存所有sheet数据
    if (!allSheetsData.value.stockOptions) {
      allSheetsData.value.stockOptions = {}
    }
    allSheetsData.value.stockOptions = fileData.sheetsData

    // 保存第一个sheet的数据作为主数据
    stockOptionsData.value = fileData.firstSheetData

    // console.log('个股期权数据处理完成，数据条数:', stockOptionsData.value.length)
    // console.log('包含的工作表:', Object.keys(fileData.sheetsData))

    // 提取股票选项
    extractStockOptions()

    // 更新预览数据
    updatePreviewData()
    
    // 检查Excel数据加载状态
    checkExcelDataStatus()

  } catch (error) {
    // console.error('处理个股期权数据失败:', error)
    ElMessage.error('处理个股期权数据失败')
  }
}

// 文件内容显示相关
const activeTab = ref('stockIndex')
const showFileContent = ref(false)
const previewColumns = ref<string[]>([])
const previewData = ref<any[]>([])
const maxPreviewRows = 10

// 多sheet支持
const activeSheet = ref('')
const sheetList = ref<string[]>([])
const allSheetsData = ref({
  stockIndex: {},
  stockOptions: {}
})

// 解析后的数据
const stockIndexData = ref<any[]>([])
const stockOptionsData = ref<any[]>([])

// 股票代码输入相关
interface StockOption {
  id: number
  code: string
  name: string
  value: string
  label: string
  price?: number | null
  // 添加期权价格字段
  prices?: {
    '2W'?: number
    '1M'?: number
    '2M'?: number
    '3M'?: number
    '6M'?: number
    '2W (103)'?: number
    '1M (103)'?: number
    '2M (103)'?: number
    '3M (103)'?: number
    '6M (103)'?: number
    '2W (105)'?: number
    '1M (105)'?: number
    '2M (105)'?: number
    '3M (105)'?: number
    '6M (105)'?: number
    '2W (110)'?: number
    '1M (110)'?: number
    '2M (110)'?: number
    '3M (110)'?: number
    '6M (110)'?: number
    '2W (80)'?: number
    '1M (80)'?: number
    '2M (80)'?: number
    '3M (80)'?: number
    '6M (80)'?: number
    '2W (90)'?: number
    '1M (90)'?: number
    '2M (90)'?: number
    '3M (90)'?: number
    '6M (90)'?: number
    '2W (95)'?: number
    '1M (95)'?: number
    '2M (95)'?: number
    '3M (95)'?: number
    '6M (95)'?: number
    '2W (8080)'?: number
    '1M (8080)'?: number
    '2M (8080)'?: number
    '3M (8080)'?: number
    '6M (8080)'?: number
    '2W (9090)'?: number
    '1M (9090)'?: number
    '2M (9090)'?: number
    '3M (9090)'?: number
    '6M (9090)'?: number
    '2W (9070)'?: number
    '1M (9070)'?: number
    '2M (9070)'?: number
    '3M (9070)'?: number
    '6M (9070)'?: number
  }
}

const stockOptions = ref<StockOption[]>([])
const filteredStockOptions = ref<StockOption[]>([])
const isSearching = ref(false)
const searchTimeout = ref<NodeJS.Timeout | null>(null)
const showSearchResults = ref(false)
const maxDisplayResults = 5 // 最多显示5个匹配结果
const selectedStockInfo = ref('') // 显示在输入框中的股票信息
const isStockOptionsLoading = ref(false) // 股票选项加载状态

// 查询结果
const queryResult = ref<any>(null)
const isQuerying = ref(false)
const showResult = ref(false)
const selectedStockName = ref('')  // 存储所选股票的名称
const calculationMethod = ref('') // 存储计算方法说明
const showStrikePriceGuide = ref(false) // 控制行权价格指南对话框
const showImagePreview = ref(false) // 控制图片预览对话框

// 计算是否可以查询
const canQuery = computed(() => {
  if (formData.structureType === 'custom') {
    return formData.stockCode &&
           formData.optionType &&
           formData.strikePrice
  } else {
    return formData.stockCode &&
           formData.optionType &&
           formData.strikePriceRatio
  }
})

// 监听股票代码变化，更新行权价格
watch(() => formData.stockCode, (newVal) => {
  if (newVal && formData.structureType !== 'custom') {
    calculateStrikePrice()
  }
})

// 专门处理7095工作表中的数据
const process7095SheetData = (data: any[]): StockOption[] => {
  if (!Array.isArray(data) || data.length === 0) return []

  const firstItem = data[0]
  const keys = Object.keys(firstItem)
  // console.log('7095表格的列名:', keys)

  // 尝试找到标的列
  let targetCodeKey: string | null = null
  let targetNameKey: string | null = null
  
  // 常见的标的代码和名称列名
  const codeKeywords = ['证券代码', '股票代码', '代码', '标的代码']
  const nameKeywords = ['证券名称', '股票名称', '名称', '标的', '标的名称']
  
  // 查找最匹配的列名
  for (const key of keys) {
    // 查找代码列
    if (!targetCodeKey) {
      for (const keyword of codeKeywords) {
        if (key.includes(keyword)) {
          targetCodeKey = key
          break
        }
      }
    }
    
    // 查找名称列
    if (!targetNameKey) {
      for (const keyword of nameKeywords) {
        if (key.includes(keyword)) {
          targetNameKey = key
          break
        }
      }
    }
    
    if (targetCodeKey && targetNameKey) break
  }
  
  // console.log('找到的标的代码列:', targetCodeKey)
  // console.log('找到的标的名称列:', targetNameKey)
  
  // 如果没有找到对应的列，尝试使用数字索引的列(如果存在)
  if (!targetCodeKey) {
    const numericKeys = keys.filter(k => /^\d+$/.test(k))
    if (numericKeys.length > 0) {
      targetCodeKey = numericKeys[0] // 假设第一个数字列是代码
      // console.log('使用数字索引列作为标的代码:', targetCodeKey)
    }
  }
  
  if (!targetNameKey && targetCodeKey) {
    const numericKeys = keys.filter(k => /^\d+$/.test(k))
    if (numericKeys.length > 1) {
      targetNameKey = numericKeys[1] // 假设第二个数字列是名称
      // console.log('使用数字索引列作为标的名称:', targetNameKey)
    }
  }
  
  // 提取股票代码和名称
  const options: StockOption[] = []
  data.forEach(item => {
    let code = targetCodeKey ? item[targetCodeKey] : ''
    let name = targetNameKey ? item[targetNameKey] : ''
    
    // 如果代码是数字，转为字符串并尝试格式化为6位代码
    if (typeof code === 'number') {
      code = String(code).padStart(6, '0')
    }
    
    // 如果名称为空但有其他列可能包含名称
    if (!name && targetCodeKey) {
      for (const key of keys) {
        if (key !== targetCodeKey && typeof item[key] === 'string' && item[key].length > 0) {
          name = item[key]
          break
        }
      }
    }
    
    if (code && !options.some(opt => opt.value === code)) {
      options.push({
        value: code,
        label: `${code} ${name}`,
        name: name || code // 如果名称为空，使用代码作为名称
      })
    }
  })
  
  // console.log('从7095表格提取的选项:', options)
  return options
}

// 测试API调用
const testAPI = async () => {
  console.log('手动测试API调用...')
  console.log('环境变量:', {
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL
  })
  await loadStockOptionsFromAPI()
}

// 从新API加载股票列表
const loadStockOptionsFromAPI = async () => {
  try {
    console.log('开始调用API获取股票列表...')
    isStockOptionsLoading.value = true
    

    // 先加载简版列表用于搜索
    const resp = await getStockListSimple()
    
    
    console.log('API响应:', resp)

    // 检查响应结构：Axios响应中，实际数据在 resp.data 中
    if (!resp) {
      console.warn('API返回数据格式异常:', resp)
      ElMessage.warning('获取股票列表失败1111，将使用备用方案')
      // 如果API失败，回退到原来的Excel数据提取方式
      extractStockOptionsFromExcel()
      return
    }
  
    
    // 从 resp.data.data 中获取实际的股票列表数据
    const list = Array.isArray(resp) ? resp : []
    if (list.length === 0) {
      console.warn('API返回的数据列表为空')
      ElMessage.warning('获取股票列表失败2222，将使用备用方案')
      extractStockOptionsFromExcel()
      return
    }


    
    // 转换数据格式，根据新的数据库结构映射
    const options: StockOption[] = list.map((r: any) => {
      // 构建价格对象
      const prices: any = {}
      
      // 映射所有价格字段
      const priceFields = [
        '2W', '1M', '2M', '3M', '6M',
        '2W (103)', '1M (103)', '2M (103)', '3M (103)', '6M (103)',
        '2W (105)', '1M (105)', '2M (105)', '3M (105)', '6M (105)',
        '2W (110)', '1M (110)', '2M (110)', '3M (110)', '6M (110)',
        '2W (80)', '1M (80)', '2M (80)', '3M (80)', '6M (80)',
        '2W (90)', '1M (90)', '2M (90)', '3M (90)', '6M (90)',
        '2W (95)', '1M (95)', '2M (95)', '3M (95)', '6M (95)',
        '2W (8080)', '1M (8080)', '2M (8080)', '3M (8080)', '6M (8080)',
        '2W (9090)', '1M (9090)', '2M (9090)', '3M (9090)', '6M (9090)',
        '2W (9070)', '1M (9070)', '2M (9070)', '3M (9070)', '6M (9070)'
      ]
      
      priceFields.forEach(field => {
        if (r[field] && !isNaN(parseFloat(r[field]))) {
          prices[field] = parseFloat(r[field])
        }
      })
      
      return {
        id: r.id || 0,
        code: r.code,
        name: r.name,
        value: r.code,
        label: `${r.code} ${r.name}`,
        price: null, // 保持兼容性
        prices: prices
      }
    })
    
    stockOptions.value = options
    filteredStockOptions.value = options.slice(0, maxDisplayResults)
    
    console.log('从API加载股票选项成功:', options.length, '个')
    ElMessage.success(`成功加载 ${options.length} 只股票`)
    
  } catch (error) {
    console.error('从API加载股票选项失败:', error)
    ElMessage.error('获取股票列表失败3333，将使用备用方案')
    // 如果API失败，回退到原来的Excel数据提取方式
    extractStockOptionsFromExcel()
  } finally {
    isStockOptionsLoading.value = false
  }
}

// 从上传的文件中提取股票代码和名称（备用方案）
const extractStockOptionsFromExcel = () => {
  try {
    let options: StockOption[] = []
    
    // 优先从名为"7095"的工作表中提取股票标的信息
    let foundInSheet7095 = false
    
    // 从期权报价表中查找7095工作表
    if (allSheetsData.value.stockOptions && allSheetsData.value.stockOptions['7095']) {
      const sheet7095Data = allSheetsData.value.stockOptions['7095']
      const processedOptions = extractStocksFromSheet(sheet7095Data, '7095')
      
      if (processedOptions.length > 0) {
        options = processedOptions
        foundInSheet7095 = true
        // console.log('从期权报价表的7095工作表中提取了', options.length, '个股票选项')
      }
    }
    
    // 从股指报价表中查找7095工作表
    if (!foundInSheet7095 && allSheetsData.value.stockIndex && allSheetsData.value.stockIndex['7095']) {
      const sheet7095Data = allSheetsData.value.stockIndex['7095']
      const processedOptions = extractStocksFromSheet(sheet7095Data, '7095')
      
      if (processedOptions.length > 0) {
        options = processedOptions
        foundInSheet7095 = true
        // console.log('从股指报价表的7095工作表中提取了', options.length, '个股票选项')
      }
    }
    
    // 如果没有找到7095工作表或没有提取到选项，从香草看涨报价工作表提取
    if (!foundInSheet7095 && allSheetsData.value.stockOptions && allSheetsData.value.stockOptions['香草看涨报价']) {
      const sheetData = allSheetsData.value.stockOptions['香草看涨报价']
      // 处理香草看涨报价表数据：使用第二行作为表头
      const processedSheetData = processExcelDataWithSecondRowHeader(sheetData)
      const processedOptions = extractStocksFromSheet(processedSheetData, '香草看涨报价')
      
      if (processedOptions.length > 0) {
        options = processedOptions
        // console.log('从期权报价表的香草看涨报价工作表中提取了', options.length, '个股票选项')
      }
    }
    
    // 如果仍然没有找到选项，从所有工作表中尝试提取
    if (options.length === 0) {
      // console.log('未从特定工作表找到股票选项，尝试从所有工作表中提取')
      
      // 从期权报价表中提取
      if (allSheetsData.value.stockOptions) {
        Object.entries(allSheetsData.value.stockOptions).forEach(([sheetName, sheetData]) => {
          if (Array.isArray(sheetData) && sheetData.length > 0) {
            const processedOptions = extractStocksFromSheet(sheetData, sheetName)
            options = [...options, ...processedOptions]
          }
        })
      }
      
      // 从股指报价表中提取
      if (allSheetsData.value.stockIndex) {
        Object.entries(allSheetsData.value.stockIndex).forEach(([sheetName, sheetData]) => {
          if (Array.isArray(sheetData) && sheetData.length > 0) {
            const processedOptions = extractStocksFromSheet(sheetData, sheetName)
            options = [...options, ...processedOptions]
          }
        })
      }
      
      // 去重
      options = removeDuplicateStocks(options)
    }
    
    stockOptions.value = options
    // console.log('最终提取的股票选项:', options)
  } catch (error) {
    // console.error('提取股票代码选项出错:', error)
    ElMessage.error('提取股票代码选项失败')
  }
}

// 从工作表中提取股票信息
const extractStocksFromSheet = (sheetData: any[], sheetName: string): StockOption[] => {
  if (!Array.isArray(sheetData) || sheetData.length === 0) return []
  
  const options: StockOption[] = []
  
  // 根据工作表名称选择不同的提取策略
  if (sheetName === '7095') {
    // 7095工作表的特殊处理
    sheetData.forEach(row => {
      const code = row['代码'] || row['证券代码'] || ''
      const name = row['标的'] || row['证券简称'] || row['名称'] || ''
      const price = extractStockPrice(row)
      
      if (code && !options.some(opt => opt.value === code)) {
        options.push({
          value: code,
          label: `${code} ${name}`,
          name: name || code,
          price: price
        })
      }
    })
  } else if (sheetName === '香草看涨报价') {
    // 香草看涨报价工作表的处理（使用处理后的数据）
    sheetData.forEach(row => {
      // 现在列名已经是正确的了
      const code = row['证券代码'] || ''
      const name = row['证券简称'] || ''
      const price = extractStockPrice(row)
      
      if (code && !options.some(opt => opt.value === code)) {
        options.push({
          value: code,
          label: `${code} ${name}`,
          name: name || code,
          price: price
        })
      }
    })
  } else {
    // 其他工作表的通用处理
    // 尝试识别包含股票代码和名称的列
    const firstRow = sheetData[0] || {}
    const keys = Object.keys(firstRow)
    
    // 尝试找到代码列和名称列
    const codeKeys = ['证券代码', '股票代码', '代码', '标的代码']
    const nameKeys = ['证券简称', '证券名称', '股票名称', '名称', '标的', '标的名称']
    
    let codeKey = ''
    let nameKey = ''
    
    // 查找代码列
    for (const key of keys) {
      if (codeKeys.some(k => key.includes(k))) {
        codeKey = key
        break
      }
    }
    
    // 查找名称列
    for (const key of keys) {
      if (nameKeys.some(k => key.includes(k))) {
        nameKey = key
        break
      }
    }
    
    // 如果找到了代码列，提取股票信息
    if (codeKey) {
      sheetData.forEach(row => {
        const code = row[codeKey] || ''
        const name = nameKey ? (row[nameKey] || '') : ''
        const price = extractStockPrice(row)
        
        if (code && !options.some(opt => opt.value === code)) {
          options.push({
            value: code,
            label: `${code} ${name}`,
            name: name || code,
            price: price
          })
        }
      })
    }
  }
  
  return options
}

// 从行数据中提取股票价格
const extractStockPrice = (row: any): number | undefined => {
  // 尝试从不同可能的字段中提取价格
  if (row['现价']) return parseFloat(row['现价'])
  if (row['最新价']) return parseFloat(row['最新价'])
  if (row['收盘价']) return parseFloat(row['收盘价'])
  if (row['price']) return parseFloat(row['price'])
  
  return undefined
}

// 去除重复的股票
const removeDuplicateStocks = (stocks: StockOption[]): StockOption[] => {
  const uniqueStocks: StockOption[] = []
  const codeSet = new Set<string>()
  
  stocks.forEach(stock => {
    if (!codeSet.has(stock.value)) {
      codeSet.add(stock.value)
      uniqueStocks.push(stock)
    }
  })
  
  return uniqueStocks
}

// 生成模拟价格
const generateMockPrice = (stockCode: string): number => {
  // 使用股票代码作为随机种子，确保相同代码生成相同价格
  const seed = stockCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const basePrice = (seed % 100) + 10 // 10-109元之间
  return basePrice
}

// 处理股票代码输入
const handleStockCodeInput = (query) => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }
  
  // 如果输入为空，清除股票信息显示
  if (!query) {
    selectedStockName.value = ''
  }
  
  isSearching.value = true
  showSearchResults.value = true
  
  searchTimeout.value = setTimeout(() => {
    if (query) {
      // 过滤股票选项
      filteredStockOptions.value = stockOptions.value
        .filter(option => {
          return option.value.includes(query) || 
                option.name.includes(query) || 
                option.label.toLowerCase().includes(query.toLowerCase())
        })
        .slice(0, maxDisplayResults) // 只取前N个匹配结果
      
      // 如果有完全匹配的股票代码，自动选择
      const exactMatch = filteredStockOptions.value.find(option => option.value === query)
      if (exactMatch) {
        selectedStockName.value = exactMatch.name
      }
    } else {
      filteredStockOptions.value = []
    }
    isSearching.value = false
  }, 300)
}

// 选择股票
const handleSelectStock = (item) => {
  formData.stockCode = item.value
  selectedStockName.value = item.name // 只显示股票名称
  showSearchResults.value = false // 隐藏搜索结果
}

// 点击文档其他地方时关闭搜索结果
const handleClickOutside = (event) => {
  const stockCodeInput = document.querySelector('.stock-code-input')
  const searchResults = document.querySelector('.stock-search-results')
  
  if (stockCodeInput && searchResults && 
      !stockCodeInput.contains(event.target) && 
      !searchResults.contains(event.target)) {
    showSearchResults.value = false
  }
}

// 重新聚焦到输入框时显示搜索结果
const handleFocus = () => {
  if (formData.stockCode && filteredStockOptions.value.length > 0) {
    showSearchResults.value = true
  }
}

// 切换预览标签
const handleTabChange = (tab) => {
  activeTab.value = tab
  updatePreviewData()
}

// 切换sheet
const handleSheetChange = (sheet) => {
  activeSheet.value = sheet
  updatePreviewData()
}

// 更新预览数据
const updatePreviewData = () => {
  // 优先显示有数据的标签页
  if (!activeTab.value) {
    if (isStockIndexLoaded.value && Object.keys(allSheetsData.value.stockIndex || {}).length > 0) {
      activeTab.value = 'stockIndex'
    } else if (isStockOptionsLoaded.value && Object.keys(allSheetsData.value.stockOptions || {}).length > 0) {
      activeTab.value = 'stockOptions'
    }
  }

  if (activeTab.value === 'stockIndex' && isStockIndexLoaded.value) {
    // 股指报价表预览
    sheetList.value = Object.keys(allSheetsData.value.stockIndex || {})
    if (sheetList.value.length > 0) {
      // 如果没有选中sheet或选中的sheet不在列表中，默认选第一个
      if (!activeSheet.value || !sheetList.value.includes(activeSheet.value)) {
        activeSheet.value = sheetList.value[0]
      }

      const data = allSheetsData.value.stockIndex[activeSheet.value] || []
      if (data.length > 0) {
        // 从第一条数据获取列名
        const firstItem = data[0]
        previewColumns.value = Object.keys(firstItem)
        // 最多显示10行
        previewData.value = data.slice(0, maxPreviewRows)
        showFileContent.value = true
        // console.log('股指报价表预览数据已更新:', previewData.value.length, '条记录')
      } else {
        showFileContent.value = false
      }
    } else {
      showFileContent.value = false
    }
  } else if (activeTab.value === 'stockOptions' && isStockOptionsLoaded.value) {
    // 期权报价表预览
    sheetList.value = Object.keys(allSheetsData.value.stockOptions || {})
    if (sheetList.value.length > 0) {
      // 如果没有选中sheet或选中的sheet不在列表中，默认选第一个
      if (!activeSheet.value || !sheetList.value.includes(activeSheet.value)) {
        activeSheet.value = sheetList.value[0]
      }

      const data = allSheetsData.value.stockOptions[activeSheet.value] || []
      if (data.length > 0) {
        // 从第一条数据获取列名
        const firstItem = data[0]
        previewColumns.value = Object.keys(firstItem)
        // 最多显示10行
        previewData.value = data.slice(0, maxPreviewRows)
        showFileContent.value = true
        // console.log('期权报价表预览数据已更新:', previewData.value.length, '条记录')
      } else {
        showFileContent.value = false
      }
    } else {
      showFileContent.value = false
    }
  } else {
    showFileContent.value = false
  }
}

// 处理股指报价表文件上传
const handleStockIndexFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const loading = ElLoading.service({
    lock: true,
    text: '正在解析股指报价表...',
    background: 'rgba(0, 0, 0, 0.7)'
  })
  
  uploadedStockIndexFileName.value = file.name
  
  // 使用FileReader读取文件
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      
      // 处理所有sheet
      const sheetsData = {}
      let firstSheetData = []
      
      // 特别关注7095工作表
      let has7095Sheet = workbook.SheetNames.includes('7095')
      
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        if (jsonData.length > 0) {
          sheetsData[sheetName] = jsonData
          
          // 如果是7095工作表，进行特殊处理并打印日志
          if (sheetName === '7095') {
            // console.log('找到7095工作表, 数据条数:', jsonData.length)
            // console.log('7095工作表数据样例:', jsonData.slice(0, 2))
          }
          
          // 保存第一个非空sheet的数据作为主数据
          if (firstSheetData.length === 0) {
            firstSheetData = jsonData
          }
        }
      })
      
      // 更新数据
      stockIndexData.value = firstSheetData
      allSheetsData.value = {
        ...allSheetsData.value,
        stockIndex: sheetsData
      }
      
      // 如果找到7095工作表，提供特别提示
      isStockIndexUploaded.value = true
      if (has7095Sheet) {
        ElMessage.success('数据加载成功')
      } else {
        ElMessage.success('数据加载成功')
      }
      
      // console.log('股指报价表数据:', sheetsData)
      
      // 提取股票代码选项（备用方案）
      extractStockOptionsFromExcel()
      
      // 如果当前标签是股指报价表，更新预览数据
      if (activeTab.value === 'stockIndex') {
        updatePreviewData()
      }
    } catch (error) {
      // console.error('解析股指报价表出错:', error)
      ElMessage.error('解析股指报价表失败，请检查文件格式')
    } finally {
      loading.close()
    }
  }
  
  reader.onerror = () => {
    loading.close()
    ElMessage.error('读取文件失败')
  }
  
  reader.readAsArrayBuffer(file)
}

// 处理期权报价表文件上传
const handleStockOptionsFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const loading = ElLoading.service({
    lock: true,
    text: '正在解析期权报价表...',
    background: 'rgba(0, 0, 0, 0.7)'
  })
  
  uploadedStockOptionsFileName.value = file.name
  
  // 使用FileReader读取文件
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      
      // 处理所有sheet
      const sheetsData = {}
      let firstSheetData = []
      
      // 特别关注7095工作表
      let has7095Sheet = workbook.SheetNames.includes('7095')
      
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        if (jsonData.length > 0) {
          sheetsData[sheetName] = jsonData
          
          // 如果是7095工作表，进行特殊处理并打印日志
          if (sheetName === '7095') {
            // console.log('找到7095工作表, 数据条数:', jsonData.length)
            // console.log('7095工作表数据样例:', jsonData.slice(0, 2))
          }
          
          // 保存第一个非空sheet的数据作为主数据
          if (firstSheetData.length === 0) {
            firstSheetData = jsonData
          }
        }
      })
      
      // 更新数据
      stockOptionsData.value = firstSheetData
      allSheetsData.value = {
        ...allSheetsData.value,
        stockOptions: sheetsData
      }
      
      // 如果找到7095工作表，提供特别提示
      isStockOptionsUploaded.value = true
      if (has7095Sheet) {
        ElMessage.success('数据加载成功')
      } else {
        ElMessage.success('数据加载成功')
      }
      
      // console.log('期权报价表数据:', sheetsData)
      
      // 提取股票代码选项（备用方案）
      extractStockOptionsFromExcel()
      
      // 如果当前标签是期权报价表，更新预览数据
      if (activeTab.value === 'stockOptions') {
        updatePreviewData()
      }
    } catch (error) {
      // console.error('解析期权报价表出错:', error)
      ElMessage.error('解析期权报价表失败，请检查文件格式')
    } finally {
      loading.close()
    }
  }
  
  reader.onerror = () => {
    loading.close()
    ElMessage.error('读取文件失败')
  }
  
  reader.readAsArrayBuffer(file)
}

// 重置文件上传
const resetStockIndexFile = () => {
  stockIndexFileRef.value.value = ''
  isStockIndexUploaded.value = false
  uploadedStockIndexFileName.value = ''
  stockIndexData.value = []
  
  // 清除对应的sheet数据
  allSheetsData.value = {
    ...allSheetsData.value,
    stockIndex: {}
  }
  
  // 重新提取股票代码选项（备用方案）
  extractStockOptionsFromExcel()
  
  // 如果当前标签是股指报价表，更新预览数据
  if (activeTab.value === 'stockIndex') {
    showFileContent.value = false
  }
}

const resetStockOptionsFile = () => {
  stockOptionsFileRef.value.value = ''
  isStockOptionsUploaded.value = false
  uploadedStockOptionsFileName.value = ''
  stockOptionsData.value = []
  
  // 清除对应的sheet数据
  allSheetsData.value = {
    ...allSheetsData.value,
    stockOptions: {}
  }
  
  // 重新提取股票代码选项（备用方案）
  extractStockOptionsFromExcel()
  
  // 如果当前标签是期权报价表，更新预览数据
  if (activeTab.value === 'stockOptions') {
    showFileContent.value = false
  }
}

// 查询期权价格
const queryOptionPrice = async () => {
  if (!canQuery.value) {
    ElMessage.warning('请填写完整查询信息')
    return
  }
  
  // 验证股票代码是否有效
  const selectedOption = stockOptions.value.find(option => option.value === formData.stockCode)
  if (!selectedOption) {
    ElMessage.warning('请选择有效的股票代码')
    return
  }
  
  isQuerying.value = true
  showResult.value = false
  // 获取选中的股票名称
  selectedStockName.value = selectedOption.label
  
  try {
  // 构建询价参数
  const inquiryParams: OptionInquiryParams = {
    stockCode: formData.stockCode,
    optionType: formData.optionType as 'call' | 'put',
    term: formData.term,
    structureType: formData.structureType
  }
  
  // 如果是自定义结构，添加额外参数
  if (formData.structureType === 'custom') {
    inquiryParams.strikePrice = parseFloat(formData.strikePrice)
    inquiryParams.expiryDate = formData.expiryDate
  } else {
    // 如果不是自定义，添加行权价格比例
    inquiryParams.strikePriceRatio = parseFloat(formData.strikePriceRatio)
  }
  
  // 输出参数用于对比
  console.log('开始期权询价前:', {
    currentPrice: selectedOption.price,
    optionType: inquiryParams.optionType,
    stockCode: inquiryParams.stockCode,
    stockName: selectedOption.name,
    strikePrice: inquiryParams.strikePrice || 0,
    structureType: inquiryParams.structureType,
    term: inquiryParams.term
  })
  
      let result: OptionInquiryResult | null = null
      
    // 如果是看涨期权，从新的API接口获取数据
      if (formData.optionType === 'call') {
      result = await getCallOptionFromAPI(inquiryParams, selectedOption)
      } else {
      // 看跌期权暂时不支持，提示用户
      ElMessage.warning('看跌期权功能暂未开放，请选择看涨期权')
      return
    }

    console.log("result:-----------------------", result)
      
      if (result) {
        // 保存查询结果
        queryResult.value = result
        // 输出结果用于对比
        console.log('询价完成:', result)
        // 保存计算方法说明
        calculationMethod.value = generateCalculationMethod(result)
        showResult.value = true
      
      // 使用 Notification 提示查询成功
      ElNotification({
        title: '查询成功',
        message: `已成功获取 ${result.stockName}(${result.stockCode}) 的期权报价信息`,
        type: 'success',
        duration: 4000,
        position: 'top-right'
      })
      } else {
        ElMessage.error('未能在报价表中找到匹配的期权报价')
      }
    } catch (error) {
      console.error('查询出错:', error)
      ElMessage.error('查询失败，请检查输入参数')
    } finally {
      isQuerying.value = false
    }
}

// 从新的API接口获取看涨期权数据
const getCallOptionFromAPI = async (params: OptionInquiryParams, stockOption: StockOption): Promise<OptionInquiryResult | null> => {
  try {
    // 更新调试数据
    debugData.value.searchParams = {
      stockCode: params.stockCode,
      optionType: params.optionType,
      term: params.term,
      structureType: params.structureType,
      strikePriceRatio: formData.strikePriceRatio
    }
    
    console.log('从API接口获取期权数据:', {
      stockCode: params.stockCode,
      term: params.term,
      structureType: params.structureType,
      strikePriceRatio: formData.strikePriceRatio
    })
    
    // 根据结构类型和期限确定要查询的condition字段
    let condition = ''
    let strikePriceRatio = 100
    
    if (params.structureType === 'atm') {
      // 平值期权 - 直接使用期限字段
      condition = params.term
      strikePriceRatio = 100
    } else if (params.structureType === 'itm') {
      // 实值期权 - 使用带比例的价格字段
      const ratio = formData.strikePriceRatio || '90'
      condition = `${params.term} (${ratio})`
      strikePriceRatio = parseInt(ratio)
    } else if (params.structureType === 'otm') {
      // 虚值期权 - 使用带比例的价格字段
      const ratio = formData.strikePriceRatio || '103'
      condition = `${params.term} (${ratio})`
      strikePriceRatio = parseInt(ratio)
    } else if (params.structureType === 'discount') {
      // 折价期权 - 使用带比例的价格字段
      const ratio = formData.strikePriceRatio || '8080'
      condition = `${params.term} (${ratio})`
      strikePriceRatio = parseInt(ratio)
    }
    
    console.log('查询的condition字段:', condition)
    
    // 调用API接口获取期权价格
    const apiParams = {
      code: params.stockCode,
      condition: condition
    }
    
    console.log('API请求参数:', apiParams)
    
    const response = await getOptionPriceByCondition(apiParams)
    console.log('API响应:', response)
      
    if (!response) {
      console.error('API调用失败:', response)
      return null
    }
    
    // 解析期权价格 - 处理带百分号的数据和'-'的情况
    let optionPrice: string | number
    let canDisplay = true
    
    if (typeof response === 'string') {
      if (response.includes('%')) {
        // 如果带百分号，直接使用该值
        optionPrice = response
        console.log('获取到的期权价格（带百分号）:', optionPrice)
      } else if (response === '-') {
        // 如果是'-'，表示没有值
        //canDisplay = false
        optionPrice = '该股票暂时无法显示报价'
        console.log('该股票暂时无法显示报价')
    } else {
        // 如果是纯数字，转换为百分比格式
        const numValue = parseFloat(response)
        if (!isNaN(numValue) && numValue > 0) {
          optionPrice = `${numValue}%`
          console.log('获取到的期权价格（数字转换）:', optionPrice)
        } else {
          canDisplay = false
          console.log('API返回的期权价格无效:', response)
        }
      }
    } else {
      canDisplay = false
      console.log('API返回的数据格式异常:', response)
    }
    
    // 如果无法显示，返回null
    if (!canDisplay) {
      return null
    }
    
    // 计算行权价格（这里需要股票当前价格，暂时使用模拟价格）
    const currentPrice = stockOption.price || generateMockPrice(params.stockCode)
    const strikePrice = (currentPrice * strikePriceRatio) / 100
    
    // 计算到期日
    const expiryDate = params.expiryDate || calculateExpiryDate(params.term)
    
    // 直接使用API返回的百分比值作为隐含波动率
    const impliedVolatility = optionPrice

    console.log("数据类型：" + typeof impliedVolatility)

    // 直接使用API返回的数据，不生成券商报价
    const brokerQuotes = []

    return {
      stockCode: params.stockCode,
      stockName: stockOption.name,
      currentPrice: currentPrice,
      optionType: 'call',
      term: params.term,
      strikePrice: parseFloat(strikePrice.toFixed(2)),
      strikePriceRatio: parseFloat(strikePriceRatio.toFixed(2)),
      expiryDate: expiryDate,
      impliedVolatility: typeof impliedVolatility === 'string' ? impliedVolatility : `${impliedVolatility}%`,
      quoteSource: 'API接口期权报价',
      quoteTime: new Date().toISOString(),
      brokerQuotes
    }
    
  } catch (error) {
    console.error('从API接口获取期权数据失败:', error)
    return null
  }
}

// 从价格字段名中提取行权价格比例
const extractStrikePriceRatioFromField = (fieldName: string): number | null => {
  const match = fieldName.match(/\((\d+)\)/)
  if (match) {
    const ratio = parseInt(match[1])
    return isNaN(ratio) ? null : ratio
  }
  return null
}

// 从基础价格生成多家券商报价
// baseIV为香草看涨报价sheet原始单元格数值（如0.0435），此处假定调用方已传入
const generateBrokerQuotesFromBasePrice = (baseIV: number, stockCode: string): any[] => {
  const brokers = [
    { code: 'YAQZ', name: 'YAQZ', color: '#E74C3C', bias: 0.003 },   // 偏向高波动率
    { code: 'YHQZ', name: 'YHQZ', color: '#3498DB', bias: -0.002 },  // 偏向低波动率
    { code: 'ZXZZ', name: 'ZXZZ', color: '#2ECC71', bias: 0.001 },   // 中性偏高
    { code: 'ZSQH', name: 'ZSQH', color: '#F39C12', bias: -0.001 },  // 中性偏低
    { code: 'ZJ', name: 'ZJ', color: '#9B59B6', bias: 0.004 },       // 激进高波动率
    { code: 'GJQZ', name: 'GJQZ', color: '#F1C40F', bias: -0.003 }   // 保守低波动率
  ]
  
  // 使用更复杂的种子算法确保结果一致性和分散性
  const stockSeed = stockCode.split('').reduce((acc, char, idx) => {
    return acc + char.charCodeAt(0) * (idx + 1) * 17 // 增加位置权重和质数因子
  }, 0)
  
  return brokers.map((broker, index) => {
    // 生成更分散的券商特定种子
    const brokerSeed = broker.code.split('').reduce((acc, char, idx) => {
      return acc + char.charCodeAt(0) * (idx + 1) * 23 // 使用不同质数
    }, 0)
    
    // 组合种子并增加随机性
    const combinedSeed = ((stockSeed * 31 + brokerSeed * 37 + index * 41) % 10000) / 10000
    
    // ±0.8%扰动范围，确保更大差异
    const randomVariance = (combinedSeed - 0.5) * 0.016 // -0.008~+0.008
    
    // 结合券商特定偏好和随机扰动
    let iv = baseIV + broker.bias + randomVariance
    
    // 确保IV不会为负且在合理范围内
    if (iv < 0.001) iv = 0.001 // 最小0.1%
    //if (iv > 0.15) iv = 0.15   // 最大15%
    
    return {
      broker: broker.name,
      impliedVolatility: `${(iv * 100).toFixed(2)}%`,
      color: broker.color
    }
  })
}

// 从价格反推隐含波动率
const calculateImpliedVolatilityFromPrice = (optionPrice: number, stockPrice: number, strikePrice: number, term: string): number => {
  // 简化的隐含波动率计算
  // 实际应用中应使用牛顿法等数值方法求解
  
  const timeToExpiry = getTermFactorInYears(term)  // 转换为年份
  const moneyness = strikePrice / stockPrice
  
  // 基于ATM隐含波动率的经验公式
  let baseIV = 0.20  // 基础隐含波动率20%
  
  // 根据价格水平调整
  const priceRatio = optionPrice / stockPrice
  if (priceRatio > 0.1) baseIV += 0.05
  if (priceRatio > 0.2) baseIV += 0.05
  
  // 根据期限调整
  if (timeToExpiry < 0.25) baseIV += 0.02  // 短期期权波动率通常更高
  if (timeToExpiry > 1) baseIV -= 0.02     // 长期期权波动率通常更低
  
  // 根据行权价调整（波动率微笑）
  if (moneyness < 0.95 || moneyness > 1.05) baseIV += 0.01
  
  return baseIV * 100  // 转换为百分比
}

// 获取期限的年份因子
const getTermFactorInYears = (term: string): number => {
  switch (term) {
    case '2W': return 2/52
    case '1M': return 1/12
    case '2M': return 2/12
    case '3M': return 3/12
    case '6M': return 6/12
    case '12M': return 1
    default: return 1/12
  }
}

// 计算Delta
const calculateDelta = (optionType: 'call' | 'put', strikePriceRatio: number): number => {
  if (optionType === 'call') {
    // 看涨期权Delta范围通常为0-1
    if (strikePriceRatio < 80) return 0.95      // 深度实值
    if (strikePriceRatio < 90) return 0.85      // 实值
    if (strikePriceRatio < 95) return 0.70      // 轻度实值
    if (strikePriceRatio < 98) return 0.60      // 接近平值(实值侧)
    if (strikePriceRatio < 102) return 0.50     // 平值
    if (strikePriceRatio < 105) return 0.40     // 接近平值(虚值侧)
    if (strikePriceRatio < 110) return 0.30     // 轻度虚值
    if (strikePriceRatio < 120) return 0.15     // 虚值
    return 0.05                                 // 深度虚值
  } else {
    // 看跌期权Delta范围通常为-1-0
    if (strikePriceRatio < 80) return -0.05     // 深度虚值
    if (strikePriceRatio < 90) return -0.15     // 虚值
    if (strikePriceRatio < 95) return -0.30     // 轻度虚值
    if (strikePriceRatio < 98) return -0.40     // 接近平值(虚值侧)
    if (strikePriceRatio < 102) return -0.50    // 平值
    if (strikePriceRatio < 105) return -0.60    // 接近平值(实值侧)
    if (strikePriceRatio < 110) return -0.70    // 轻度实值
    if (strikePriceRatio < 120) return -0.85    // 实值
    return -0.95                                // 深度实值
  }
}

// 计算Gamma
const calculateGamma = (term: string, priceRatio: number = 100): number => {
  // Gamma通常在0.01-0.2之间，期限越短Gamma越大
  // 平值期权的Gamma最大，实值和虚值期权的Gamma较小
  
  // 基础期限因子
  const termFactor = {
    '2W': 0.18,
    '1M': 0.15,
    '2M': 0.12,
    '3M': 0.09,
    '6M': 0.06,
    '12M': 0.03
  }[term] || 0.1
  
  // 根据行权价格比例确定Gamma调整因子
  const priceRatioFactor = Math.abs(priceRatio - 100) <= 2 ? 1.0 :  // 接近平值，Gamma最大
                          Math.abs(priceRatio - 100) <= 5 ? 0.9 :  // 轻微偏离平值，Gamma略小
                          Math.abs(priceRatio - 100) <= 10 ? 0.7 : // 中度偏离平值，Gamma更小
                          0.5;                                     // 远离平值，Gamma最小
  
  return parseFloat((termFactor * priceRatioFactor).toFixed(4))
}

// 计算Theta
const calculateTheta = (term: string, priceRatio: number = 100, optionType: 'call' | 'put' = 'call'): number => {
  // Theta通常为负值，期限越短绝对值越大
  // 平值期权的Theta绝对值最大，实值和虚值期权的Theta绝对值较小
  
  // 基础期限因子
  const termFactor = {
    '2W': -0.05,
    '1M': -0.04,
    '2M': -0.03,
    '3M': -0.025,
    '6M': -0.015,
    '12M': -0.01
  }[term] || -0.02
  
  // 对于深度实值看跌或深度实值看涨，Theta可能为正
  if ((optionType === 'put' && priceRatio > 120) || (optionType === 'call' && priceRatio < 80)) {
    return parseFloat((Math.abs(termFactor) * 0.1).toFixed(4)) // 极小的正值
  }
  
  // 根据行权价格比例确定Theta调整因子
  const priceRatioFactor = Math.abs(priceRatio - 100) <= 2 ? 1.0 :  // 接近平值，Theta绝对值最大
                          Math.abs(priceRatio - 100) <= 5 ? 0.9 :  // 轻微偏离平值，Theta绝对值略小
                          Math.abs(priceRatio - 100) <= 10 ? 0.7 : // 中度偏离平值，Theta绝对值更小
                          0.5;                                     // 远离平值，Theta绝对值最小
  
  return parseFloat((termFactor * priceRatioFactor).toFixed(4))
}

// 计算Vega
const calculateVega = (term: string, priceRatio: number = 100): number => {
  // Vega通常在0.1-0.3之间，期限越长Vega越大
  // 平值期权的Vega最大，实值和虚值期权的Vega较小
  
  // 基础期限因子
  const termFactor = {
    '2W': 0.12,
    '1M': 0.15,
    '2M': 0.18,
    '3M': 0.21,
    '6M': 0.25,
    '12M': 0.3
  }[term] || 0.2
  
  // 根据行权价格比例确定Vega调整因子
  const priceRatioFactor = Math.abs(priceRatio - 100) <= 2 ? 1.0 :  // 接近平值，Vega最大
                          Math.abs(priceRatio - 100) <= 5 ? 0.9 :  // 轻微偏离平值，Vega略小
                          Math.abs(priceRatio - 100) <= 10 ? 0.7 : // 中度偏离平值，Vega更小
                          0.5;                                     // 远离平值，Vega最小
  
  return parseFloat((termFactor * priceRatioFactor).toFixed(4))
}

// 获取期限的中文显示名称
const getTermDisplayName = (term: string): string => {
  const termMap = {
    '2W': '2周 (2W)',
    '1M': '1个月 (1M)',
    '2M': '2个月 (2M)',
    '3M': '3个月 (3M)',
    '6M': '6个月 (6M)',
    '12M': '12个月 (12M)'
  }
  return termMap[term] || term
}

// 计算到期日
const calculateExpiryDate = (term: string): string => {
  const today = new Date()
  const expiryDate = new Date(today)
  
  switch (term) {
    case '2W':
      expiryDate.setDate(today.getDate() + 14)
      break
    case '1M':
      expiryDate.setMonth(today.getMonth() + 1)
      break
    case '2M':
      expiryDate.setMonth(today.getMonth() + 2)
      break
    case '3M':
      expiryDate.setMonth(today.getMonth() + 3)
      break
    case '6M':
      expiryDate.setMonth(today.getMonth() + 6)
      break
    case '12M':
      expiryDate.setFullYear(today.getFullYear() + 1)
      break
  }
  
  // 格式化日期为YYYY-MM-DD
  const year = expiryDate.getFullYear()
  const month = String(expiryDate.getMonth() + 1).padStart(2, '0')
  const day = String(expiryDate.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

// 生成计算方法说明
const generateCalculationMethod = (result: OptionInquiryResult): string => {
  const isFromAPI = result.quoteSource === 'API接口期权报价'
  
  if (isFromAPI) {
    return `
      <p>本询价结果直接来源于API接口期权报价：</p>
      <ul>
        <li>股票代码: ${result.stockCode}</li>
        <li>股票名称: ${result.stockName}</li>
        <li>期权类型: ${result.optionType === 'call' ? '看涨期权' : '看跌期权'}</li>
        <li>行权价格: ${result.strikePrice}</li>
        <li>行权价格比例: ${result.strikePriceRatio ? result.strikePriceRatio + '%' : '自定义'}</li>
        <li>期限: ${result.term}</li>
        <li>到期日: ${result.expiryDate}</li>
      </ul>
      <p>数据来源：</p>
      <ul>
        <li>隐含波动率直接来自后端API接口的实际报价数据</li>
        <li>数据实时更新，确保准确性</li>
        <li>基于真实市场数据，具有较高的参考价值</li>
      </ul>
      <p class="note">注：数据来源于真实API接口报价，具有较高的参考价值。</p>
    `
  } else {
  return `
    <p>本询价结果基于以下因素计算：</p>
    <ul>
      <li>股票代码: ${result.stockCode}</li>
      <li>股票名称: ${result.stockName}</li>
      <li>期权类型: ${result.optionType === 'call' ? '看涨期权' : '看跌期权'}</li>
      <li>行权价格: ${result.strikePrice}</li>
      <li>行权价格比例: ${result.strikePriceRatio ? result.strikePriceRatio + '%' : '自定义'}</li>
      <li>期限: ${result.term}</li>
      <li>到期日: ${result.expiryDate}</li>
    </ul>
    <p>计算方法：</p>
    <ul>
      <li>期权价格基于Black-Scholes模型计算</li>
      <li>买入价 = 最新价 × 0.95</li>
      <li>卖出价 = 最新价 × 1.05</li>
      <li>隐含波动率基于历史数据和剩余期限估算</li>
      <li>希腊字母值根据Black-Scholes模型计算</li>
    </ul>
    <p class="note">注：实际交易中，期权价格受多种市场因素影响，本结果仅供参考。</p>
  `
  }
}

onMounted(async () => {
  // console.log('股票期权询价页面已加载')
  // 设置默认期限为2周
  handleTermChange('2W')

  // 添加点击外部关闭搜索结果的事件监听
  document.addEventListener('click', handleClickOutside)

  // 只从API加载股票选项
  if (isLoggedIn.value) {
    // console.log('用户已登录，开始从API加载股票选项...')
    // 设置初始加载状态
    isStockOptionsLoading.value = true
    await loadStockOptionsFromAPI()
  } else {
    // console.log('用户未登录，跳过数据加载')
  }
})

// 在组件卸载时移除事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 处理Excel数据：去除_EMPTY表头行，使用包含"证券代码"的行作为表头
const processExcelDataWithSecondRowHeader = (sheetData: any[]): any[] => {
  if (!Array.isArray(sheetData) || sheetData.length < 1) {
    console.warn('Excel数据行数不足，无法处理')
    return sheetData
  }
  
  console.log('=== 处理Excel数据：去除_EMPTY表头行，使用包含"证券代码"的行作为表头 ===')
  console.log('原始数据行数:', sheetData.length)
  
  // 找到包含"证券代码"的行作为表头
  let headerRowIndex = -1
  let headerRow = null
  
  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i]
    const values = Object.values(row)
    
    // 检查这一行是否包含"证券代码"
    const hasSecurityCode = values.some(value => 
      String(value).includes('证券代码')
    )
    
    if (hasSecurityCode) {
      headerRowIndex = i
      headerRow = row
      console.log(`找到表头行（第${i + 1}行）:`, row)
      break
    }
  }
  
  if (headerRowIndex === -1) {
    console.warn('未找到包含"证券代码"的表头行')
    return sheetData
  }
  
  // 获取表头行的值作为新的列名
  const newHeaders = Object.values(headerRow)
  console.log('新的列名:', newHeaders)
  
  // 从表头行的下一行开始作为实际数据
  const actualData = sheetData.slice(headerRowIndex + 1)
  console.log(`从第${headerRowIndex + 2}行开始的数据行数:`, actualData.length)
  
  // 过滤掉包含_EMPTY的行，保留有效数据行
  const validData = actualData.filter((row, index) => {
    // 检查这一行是否包含_EMPTY
    const hasEmpty = Object.values(row).some(value => 
      String(value).includes('_EMPTY') || String(value).includes('EMPTY')
    )
    
    // 如果这一行包含_EMPTY，则过滤掉
    if (hasEmpty) {
      console.log(`过滤掉第${headerRowIndex + 2 + index}行（包含_EMPTY）:`, row)
      return false
    }
    
    // 检查这一行是否有有效的股票代码
    const hasValidStockCode = Object.values(row).some(value => 
      String(value).includes('.SH') || String(value).includes('.SZ') || 
      /^\d{6}$/.test(String(value))
    )
    
    if (!hasValidStockCode) {
      console.log(`过滤掉第${headerRowIndex + 2 + index}行（无有效股票代码）:`, row)
      return false
    }
    
    return true
  })
  
  console.log(`过滤后有效数据行数: ${validData.length}/${actualData.length}`)
  
  // 重新构建数据，使用表头行的值作为列名
  const processedData = validData.map((row, index) => {
    const newRow: any = {}
    
    // 使用表头行的值作为列名，按列索引对应
    const rowValues = Object.values(row)
    newHeaders.forEach((header, colIndex) => {
      if (colIndex < rowValues.length) {
        newRow[header] = rowValues[colIndex]
      }
    })
    
    return newRow
  })
  
  console.log('处理后的数据行数:', processedData.length)
  console.log('处理后的第一行数据:', processedData[0])
  
  return processedData
}

// 检查Excel数据加载状态
const checkExcelDataStatus = () => {
  console.log('=== Excel数据加载状态检查 ===')
  console.log('股指报价表工作表:', Object.keys(allSheetsData.value.stockIndex || {}))
  console.log('期权报价表工作表:', Object.keys(allSheetsData.value.stockOptions || {}))
  
  if (allSheetsData.value.stockOptions && allSheetsData.value.stockOptions['香草看涨报价']) {
    const vanillaSheet = allSheetsData.value.stockOptions['香草看涨报价']
    console.log('香草看涨报价表原始数据行数:', vanillaSheet.length)
    if (vanillaSheet.length > 0) {
      console.log('香草看涨报价表原始列名:', Object.keys(vanillaSheet[0]))
      console.log('香草看涨报价表前3行原始数据:', vanillaSheet.slice(0, 3))
      
      // 处理数据
      const processedSheet = processExcelDataWithSecondRowHeader(vanillaSheet)
      console.log('处理后的列名:', Object.keys(processedSheet[0] || {}))
      console.log('处理后的前3行数据:', processedSheet.slice(0, 3))
    }
  } else {
    console.log('未找到香草看涨报价工作表')
  }
  
  // 更新调试数据
  debugData.value.stockIndexSheets = Object.keys(allSheetsData.value.stockIndex || {})
  debugData.value.stockOptionsSheets = Object.keys(allSheetsData.value.stockOptions || {})
}

// 保存询价结果
const savedQuotes = ref<any[]>([])
const saveQuote = () => {
  if (!queryResult.value) return
  
  // 添加时间戳
  const quoteWithTimestamp = {
    ...queryResult.value,
    timestamp: new Date().toLocaleString()
  }
  
  savedQuotes.value.push(quoteWithTimestamp)
  ElMessage.success('询价结果已保存')
}

// 对比报价
const compareQuotes = () => {
  if (savedQuotes.value.length < 1) {
    ElMessage.warning('请先保存询价结果再进行对比')
    return
  }
  
  // 这里可以跳转到对比页面或显示对比对话框
  ElMessage.info('对比功能开发中')
}

// 行权价格指南对话框已在上面定义
// const showStrikePriceGuide = ref(false)


</script>

<template>
  <div :class="prefixCls">
    <StocksHeader />

    <!-- 登录遮罩 -->
    <div v-if="!isLoggedIn" class="login-overlay">
      <div class="login-mask"></div>
      <div class="login-prompt">
        <div class="login-icon">
          <i class="el-icon-lock"></i>
        </div>
        <h3 class="login-title">需要登录才能使用</h3>
        <p class="login-description">
          期权询价是专业的金融服务功能<br/>
          请先登录您的账户以获得完整的服务体验
        </p>
        <div class="login-actions">
          <el-button type="primary" size="large" @click="goToLogin" class="login-button">
            立即登录
          </el-button>
          <el-button type="default" size="large" @click="goToHome" class="home-button">
            返回首页
          </el-button>
        </div>
      </div>
    </div>

    <div class="inquiry-container" :class="{ 'blurred': !isLoggedIn }">
      <div class="inquiry-header">
        <h1 class="inquiry-title">股票期权询价</h1>
        <p class="inquiry-description">专业的股票期权询价服务，助您做出明智的投资决策</p>
      </div>
      
      <div class="inquiry-content">
        <div class="inquiry-form-container">
          <!-- 调试面板 -->
          <div class="debug-panel" v-if="showDebugPanel">
            <h3 class="debug-title">调试信息</h3>
            
            <div class="debug-section">
              <h4>搜索参数</h4>
              <pre>{{ JSON.stringify(debugData.searchParams, null, 2) }}</pre>
            </div>
            
            <div class="debug-section">
              <h4>股指报价表工作表</h4>
              <ul>
                <li v-for="sheet in debugData.stockIndexSheets" :key="sheet">{{ sheet }}</li>
              </ul>
            </div>
            
            <div class="debug-section">
              <h4>期权报价表工作表</h4>
              <ul>
                <li v-for="sheet in debugData.stockOptionsSheets" :key="sheet">{{ sheet }}</li>
              </ul>
            </div>
            
            <div class="debug-section" v-if="debugData.selectedStockRow">
              <h4>选中的股票行数据</h4>
              <pre>{{ JSON.stringify(debugData.selectedStockRow, null, 2) }}</pre>
            </div>
            
            <div class="debug-section">
              <h4>可用列名</h4>
              <div class="column-list">
                <span v-for="col in debugData.availableColumns" :key="col" class="column-item">{{ col }}</span>
              </div>
            </div>
            
            <div class="debug-section" v-if="debugData.dataProcessingInfo">
              <h4>数据处理信息</h4>
              <div class="processing-info">
                <p><strong>原始数据行数:</strong> {{ debugData.dataProcessingInfo.originalRows }}</p>
                <p><strong>表头行号:</strong> 第{{ debugData.dataProcessingInfo.headerRowIndex }}行</p>
                <p><strong>总数据行数（从表头行后开始）:</strong> {{ debugData.dataProcessingInfo.totalDataRows }}</p>
                <p><strong>过滤掉的行数（_EMPTY等）:</strong> {{ debugData.dataProcessingInfo.filteredRows }}</p>
                <p><strong>处理后数据行数:</strong> {{ debugData.dataProcessingInfo.processedRows }}</p>
                <p><strong>原始列数:</strong> {{ debugData.dataProcessingInfo.originalHeaders.length }}</p>
                <p><strong>处理后列数:</strong> {{ debugData.dataProcessingInfo.processedHeaders.length }}</p>
              </div>
            </div>
            
            <div class="debug-section" v-if="debugData.originalVanillaSheetData.length > 0">
              <h4>原始数据（前3行）</h4>
              <div class="table-container">
                <table class="debug-table">
                  <thead>
                    <tr>
                      <th v-for="col in Object.keys(debugData.originalVanillaSheetData[0] || {})" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in debugData.originalVanillaSheetData" :key="index">
                      <td v-for="col in Object.keys(row)" :key="col">{{ row[col] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <div class="debug-section" v-if="debugData.vanillaSheetData.length > 0">
              <h4>处理后数据（前5行）</h4>
              <div class="table-container">
                <table class="debug-table">
                  <thead>
                    <tr>
                      <th v-for="col in Object.keys(debugData.vanillaSheetData[0] || {})" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in debugData.vanillaSheetData" :key="index">
                      <td v-for="col in Object.keys(row)" :key="col">{{ row[col] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <h2 class="section-title" v-if="false">Excel文件加载状态</h2>

          <!-- 调试按钮 - 已隐藏 -->
          <div class="debug-controls" v-if="false">
            <el-button 
              type="info" 
              size="small" 
              @click="showDebugPanel = !showDebugPanel"
              :icon="showDebugPanel ? 'el-icon-close' : 'el-icon-view'"
            >
              {{ showDebugPanel ? '隐藏调试信息' : '显示调试信息' }}
            </el-button>
          </div>

          <div class="file-status-section" v-if="false">
            <div class="file-status-item">
              <div class="file-label">股指报价表</div>
              <div class="file-status-box" :class="{ 'is-loaded': isStockIndexLoaded, 'is-loading': isLoadingFiles }">
                <template v-if="isLoadingFiles">
                  <div class="loading-content">
                    <i class="el-icon-loading"></i>
                    <div class="loading-text">正在从OSS加载文件...</div>
                  </div>
                </template>
                <template v-else-if="isStockIndexLoaded">
                  <div class="loaded-file">
                    <i class="el-icon-document"></i>
                    <span class="file-name">{{ stockIndexFileName }}</span>
                    <el-button type="text" class="reload-btn" @click="loadExcelFilesFromOSS">
                      <i class="el-icon-refresh"></i>
                    </el-button>
                  </div>
                </template>
                <template v-else>
                  <div class="not-loaded-content">
                    <i class="el-icon-warning"></i>
                    <div class="not-loaded-text">未找到股指报价表文件</div>
                    <el-button type="primary" size="small" @click="loadExcelFilesFromOSS">
                      重新加载
                    </el-button>
                  </div>
                </template>
              </div>
            </div>

            <div class="file-status-item">
              <div class="file-label">期权报价表</div>
              <div class="file-status-box" :class="{ 'is-loaded': isStockOptionsLoaded, 'is-loading': isLoadingFiles }">
                <template v-if="isLoadingFiles">
                  <div class="loading-content">
                    <i class="el-icon-loading"></i>
                    <div class="loading-text">正在从OSS加载文件...</div>
                  </div>
                </template>
                <template v-else-if="isStockOptionsLoaded">
                  <div class="loaded-file">
                    <i class="el-icon-document"></i>
                    <span class="file-name">{{ stockOptionsFileName }}</span>
                    <el-button type="text" class="reload-btn" @click="loadExcelFilesFromOSS">
                      <i class="el-icon-refresh"></i>
                    </el-button>
                  </div>
                </template>
                <template v-else>
                  <div class="not-loaded-content">
                    <i class="el-icon-warning"></i>
                    <div class="not-loaded-text">未找到期权报价表文件</div>
                    <el-button type="primary" size="small" @click="loadExcelFilesFromOSS">
                      重新加载
                    </el-button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- 调试信息 - 已隐藏 -->
          <div class="debug-info" v-if="false">
            <h3>调试信息</h3>
            <div class="debug-item">
              <span>API调用状态:</span>
              <span :class="debugInfo.apiCalled ? 'success' : 'error'">
                {{ debugInfo.apiCalled ? '已调用' : '未调用' }}
              </span>
            </div>
            <div class="debug-item">
              <span>找到文件数量:</span>
              <span>{{ debugInfo.filesFound }}</span>
            </div>
            <div class="debug-item">
              <span>加载尝试次数:</span>
              <span>{{ debugInfo.loadAttempts }}</span>
            </div>
            <div class="debug-item" v-if="debugInfo.lastError">
              <span>最后错误:</span>
              <span class="error">{{ debugInfo.lastError }}</span>
            </div>
            <div class="debug-item">
              <span>OSS配置ID:</span>
              <span>{{ OSS_CONFIG_ID }}</span>
            </div>
            <div class="debug-actions">
              <el-button
                type="primary"
                size="small"
                @click="loadExcelFilesFromOSS"
                :loading="isLoadingFiles"
              >
                重新加载文件
              </el-button>
            </div>
          </div>

          <!-- 文件内容预览 - 已隐藏 -->
          <div class="file-preview-container" v-if="false">
            <h3 class="preview-title">文件内容预览</h3>

            <div class="preview-tabs">
              <div
                class="tab"
                :class="{ active: activeTab === 'stockIndex' }"
                @click="handleTabChange('stockIndex')"
                v-if="isStockIndexLoaded"
              >
                股指报价表
              </div>
              <div
                class="tab"
                :class="{ active: activeTab === 'stockOptions' }"
                @click="handleTabChange('stockOptions')"
                v-if="isStockOptionsLoaded"
              >
                期权报价表
              </div>
            </div>
            
            <div class="sheet-selector" v-if="sheetList.length > 0">
              <span class="sheet-label">选择工作表:</span>
              <div class="sheet-tabs">
                <div 
                  v-for="sheet in sheetList" 
                  :key="sheet"
                  class="sheet-tab"
                  :class="{ active: activeSheet === sheet }"
                  @click="handleSheetChange(sheet)"
                >
                  {{ sheet }}
                </div>
              </div>
            </div>
            
            <div class="preview-content" v-if="showFileContent">
              <div class="table-container">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th v-for="(column, index) in previewColumns" :key="index">{{ column }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in previewData" :key="rowIndex">
                      <td v-for="(column, colIndex) in previewColumns" :key="colIndex">
                        {{ row[column] }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="preview-note" v-if="activeTab === 'stockIndex' && stockIndexData.length > maxPreviewRows || activeTab === 'stockOptions' && stockOptionsData.length > maxPreviewRows">
                注：仅显示前 {{ maxPreviewRows }} 条数据
              </div>
            </div>
            <div class="empty-preview" v-else>
              请上传文件以查看内容
            </div>
          </div>
          
          <div class="divider"></div>
          
          <!-- 数据加载状态提示 -->
          <div class="data-loading-status" v-if="isLoggedIn">
            <el-alert
              :title="isStockOptionsLoading ? '数据加载中，请稍后再查询' : '数据加载完成，可进行查询'"
              :type="isStockOptionsLoading ? 'warning' : 'success'"
              :closable="false"
              show-icon
            >
              <template #default>
                <p v-if="isStockOptionsLoading">正在加载股票数据，请稍等...</p>
                <p v-else>股票数据已加载完成，您可以开始查询期权价格</p>
              </template>
            </el-alert>
          </div>
          
          <div class="section-header">
          <h2 class="section-title">查询参数</h2>
            <div class="section-subtitle">填写以下参数进行期权询价</div>
          </div>
          
          <!-- 数据来源说明 - 已隐藏 -->
          <div class="data-source-notice" v-if="false">
            <el-alert
              title="数据来源说明"
              type="info"
              :closable="false"
              show-icon
            >
              <template #default>
                <p>本系统现已升级为API接口模式，不再需要上传Excel文件。</p>
                <p>期权价格数据直接通过后端接口获取，确保数据的实时性和准确性。</p>
              </template>
            </el-alert>
          </div>
          
          <!-- 测试API调用按钮 - 已隐藏 -->
          <div class="api-test-section" v-if="false">
            <el-button 
              type="info" 
              size="small" 
              @click="testAPI"
              :loading="isStockOptionsLoading"
            >
              测试API调用
            </el-button>
            <span class="api-status">
              API状态: {{ stockOptions.length > 0 ? '已加载' : '未加载' }}
            </span>
            <span class="data-info" v-if="stockOptions.length > 0">
              数据条数: {{ stockOptions.length }}
            </span>
            <span class="data-source-info">
              数据来源: 后端API接口
            </span>
          </div>
          <el-form label-position="top">
            <el-form-item label="股票代码" class="enhanced-form-item">
              <div class="stock-code-input-container">
                <el-input
                  v-model="formData.stockCode"
                  placeholder="请输入股票代码"
                  class="stock-code-input enhanced-input"
                  @input="handleStockCodeInput"
                  @focus="handleFocus"
                >
                  <template #prefix>
                    <i class="el-icon-search"></i>
                  </template>
                </el-input>
                
                <!-- 股票名称显示 -->
                <div v-if="selectedStockName" class="selected-stock-name">
                  <i class="el-icon-check"></i>
                  {{ selectedStockName }}
                </div>
                
                <!-- 股票选项加载状态 -->
                <div v-if="isStockOptionsLoading" class="stock-loading-status">
                  <i class="el-icon-loading"></i> 正在加载股票列表...
                </div>
                
                <!-- 股票选项数量提示 - 已隐藏 -->
                <div v-else-if="false" class="stock-count-hint">
                  已加载 {{ stockOptions.length }} 只股票
                </div>
                
                <div v-if="showSearchResults && filteredStockOptions.length > 0" class="stock-search-results">
                  <div v-if="isSearching" class="search-loading">
                    <i class="el-icon-loading"></i> 正在搜索...
                  </div>
                  <ul v-else class="stock-list">
                    <li
                      v-for="option in filteredStockOptions.slice(0, maxDisplayResults)"
                      :key="option.value"
                      class="stock-item"
                      @click="handleSelectStock(option)"
                    >
                      <span class="stock-code">{{ option.value }}</span>
                      <span class="stock-name">{{ option.name }}</span>
                    </li>
                  </ul>
                </div>
                
                <div v-else-if="showSearchResults && !isSearching" class="stock-search-results">
                  <div class="no-match">
                    <i class="el-icon-warning-outline"></i> 未找到匹配的股票
                  </div>
                </div>
              </div>
            </el-form-item>
            
            <el-form-item label="期限" class="enhanced-form-item">
              <div class="term-options">
                <el-radio-group v-model="formData.term" @change="handleTermChange" class="enhanced-radio-group">
                  <el-radio-button label="2W" class="term-radio">2周</el-radio-button>
                  <el-radio-button label="1M" class="term-radio">1个月</el-radio-button>
                  <el-radio-button label="2M" class="term-radio">2个月</el-radio-button>
                  <el-radio-button label="3M" class="term-radio">3个月</el-radio-button>
                  <el-radio-button label="6M" class="term-radio">6个月</el-radio-button>
                </el-radio-group>
              </div>
            </el-form-item>
            
            <el-form-item label="结构" class="enhanced-form-item">
              <div class="structure-options enhanced-structure">
                <!-- 平值 -->
                <div class="structure-row">
                  <div class="structure-label">平值:</div>
                  <div class="structure-tags">
                    <el-tag 
                      :class="['structure-tag', formData.structureType === 'atm' && formData.strikePriceRatio === '100' ? 'active' : '']"
                      @click="selectStructureAndRatio('atm', '100')"
                    >
                      100call
                    </el-tag>
                </div>
                </div>
                
                <!-- 实值 -->
                <div class="structure-row">
                  <div class="structure-label">实值:</div>
                  <div class="structure-tags">
                <el-tag 
                  v-for="price in itmPrices" 
                  :key="price" 
                      :class="['structure-tag', formData.structureType === 'itm' && formData.strikePriceRatio === price ? 'active' : '']"
                      @click="selectStructureAndRatio('itm', price)"
                >
                      {{ price }}call
                </el-tag>
                  </div>
              </div>
              
                <!-- 虚值 -->
                <div class="structure-row">
                  <div class="structure-label">虚值:</div>
                  <div class="structure-tags">
                <el-tag 
                  v-for="price in otmPrices" 
                  :key="price" 
                      :class="['structure-tag', formData.structureType === 'otm' && formData.strikePriceRatio === price ? 'active' : '']"
                      @click="selectStructureAndRatio('otm', price)"
                >
                      {{ price }} call
                </el-tag>
                  </div>
              </div>
              
                <!-- 折价 -->
                <div class="structure-row">
                  <div class="structure-label">折价:</div>
                  <div class="structure-tags">
                <el-tag 
                  v-for="price in discountPrices" 
                  :key="price" 
                      :class="['structure-tag', formData.structureType === 'discount' && formData.strikePriceRatio === price ? 'active' : '']"
                      @click="selectStructureAndRatio('discount', price)"
                >
                  {{ price }}
                </el-tag>
              </div>
                </div>
              </div>
            </el-form-item>
            
            <el-form-item label="到期日" v-if="formData.structureType === 'custom'">
              <el-date-picker
                v-model="formData.expiryDate"
                type="date"
                placeholder="选择到期日"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                :disabled-date="disabledDate"
                style="width: 100%"
              />
            </el-form-item>
            
            <el-form-item class="enhanced-form-item inquiry-form-item">
              <div class="inquiry-button-container">
                <el-button
                  type="primary"
                  :loading="isQuerying"
                  @click="queryOptionPrice"
                  :disabled="!canQuery"
                  class="inquiry-button"
                  size="large"
                >
                  <i class="el-icon-search"></i>
                  询价
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </div>
        
        <!-- 询价结果 -->
        <div class="inquiry-result-container">
          <div v-if="showResult" class="result-section">
            <el-row :gutter="20">
              <!-- 期权基本信息 -->
              <el-col :span="24">
                <el-card class="result-card option-info-card">
                  <template #header>
                    <div class="card-header">
                      <span class="header-title">期权信息</span>
                      <el-tag type="primary" size="small" class="header-tag">期权详情</el-tag>
                    </div>
                  </template>
                  
                  <div class="option-info-grid">
                    <div class="info-item">
                      <div class="info-label">股票代码</div>
                      <div class="info-value code-value">{{ queryResult.stockCode }}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">股票名称</div>
                      <div class="info-value name-value">{{ queryResult.stockName }}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">期权类型</div>
                      <div class="info-value type-value">
                        <el-tag :type="queryResult.optionType === 'call' ? 'success' : 'warning'" size="small">
                      {{ queryResult.optionType === 'call' ? '看涨期权 (Call)' : '看跌期权 (Put)' }}
                        </el-tag>
                      </div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">行权价格</div>
                      <div class="info-value strike-value">
                        <el-tag type="info" size="small" class="strike-tag">
                        {{ queryResult.strikePriceRatio ? queryResult.strikePriceRatio + 'call' : '--' }}
                      </el-tag>
                      </div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">到期日</div>
                      <div class="info-value date-value">{{ queryResult.expiryDate }}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">期限</div>
                      <div class="info-value term-value">
                        <el-tag type="primary" size="small" class="term-tag">
                          {{ getTermDisplayName(queryResult.term) }}
                        </el-tag>
                      </div>
                    </div>
                  </div>
                </el-card>
              </el-col>
              
              <!-- 报价信息 -->
              <el-col :span="24" class="mt-4">
                <el-card class="result-card">
                  <template #header>
                    <div class="card-header">
                      <span>报价信息</span>
                      <el-tag type="success">{{ queryResult.quoteSource === '多家券商' ? '多家券商' : '券商' }}</el-tag>
                    </div>
                  </template>
                  
                  <!-- 报价时间 -->
                  <div class="quote-time-section">
                    <div class="time-label">报价时间</div>
                    <div class="time-value">{{ new Date(queryResult.quoteTime).toLocaleString() }}</div>
                  </div>
                  
                  <!-- 报价价格 -->
                  <div class="price-section">
                    <div class="main-price">
                      <div class="price-label">报价价格</div>
                      <div class="price-value">{{ queryResult.impliedVolatility ? (queryResult.impliedVolatility.includes('%') ? queryResult.impliedVolatility : queryResult.impliedVolatility) : '--' }}</div>
                    </div>
                  </div>
                  
                  <!-- 钉钉二维码 -->
                  <div class="dingtalk-section">
                    <div class="dingtalk-title">交易请加入钉钉群咨询客服</div>
                    <div class="dingtalk-qr">
                      <img 
                        src="/钉钉二维码 (2).png" 
                        alt="钉钉二维码" 
                        class="qr-image clickable" 
                        @click="showImagePreview = true"
                        title="点击查看大图"
                      />
                    </div>
                  </div>
                  
                  <div class="action-buttons" v-if="false">
                    <el-button type="primary" @click="saveQuote">保存询价</el-button>
                    <el-button @click="compareQuotes">对比报价</el-button>
                  </div>
                </el-card>
              </el-col>
              
              <!-- 计算方法说明 - 已隐藏 -->
              <el-col :span="24" class="mt-4" v-if="false">
                <el-card class="method-card">
                  <template #header>
                    <div class="card-header">
                      <span>计算方法说明</span>
                    </div>
                  </template>
                  <div class="method-content" v-html="calculationMethod"></div>
                </el-card>
              </el-col>
            </el-row>
          </div>
          
          <div v-else class="empty-result">
            <div class="empty-result-content">
              <i class="el-icon-data-analysis"></i>
              <h3>输入参数开始询价</h3>
              <p>在左侧填写股票代码、期权类型和行权价格等参数，点击询价按钮获取结果</p>
            </div>
          </div>
        </div>
        
        <div class="inquiry-info" v-if="false">
          <h2>什么是股票期权询价？</h2>
          <p>股票期权询价是指投资者在交易股票期权前，通过专业工具或服务获取期权合约当前市场价格的过程。准确的询价可以帮助投资者评估期权的价值，从而制定更为合理的交易策略。</p>
          
          <h2>如何使用我们的询价服务？</h2>
          <ol class="instruction-list">
            <li>
              <span class="step">步骤 1</span>
              <p>上传最新的股指报价表和期权报价表（支持Excel格式）</p>
            </li>
            <li>
              <span class="step">步骤 2</span>
              <p>输入您要查询的股票代码、期权类型和行权价格</p>
            </li>
            <li>
              <span class="step">步骤 3</span>
              <p>点击"获取询价"按钮，系统将从报价表中查询相关信息</p>
            </li>
            <li>
              <span class="step">步骤 4</span>
              <p>查看详细的期权报价和希腊字母值，辅助您做出投资决策</p>
            </li>
          </ol>
          
          <h2>为什么选择我们的询价服务？</h2>
          <div class="feature-list">
            <div class="feature-item">
              <i class="el-icon-data-line"></i>
              <h3>实时数据</h3>
              <p>提供最新市场数据，确保询价准确性</p>
            </div>
            
            <div class="feature-item">
              <i class="el-icon-cpu"></i>
              <h3>智能算法</h3>
              <p>采用先进定价模型，计算更为精准</p>
            </div>
            
            <div class="feature-item">
              <i class="el-icon-money"></i>
              <h3>专业分析</h3>
              <p>提供专业风险评估和投资建议</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 图片预览对话框 -->
  <el-dialog
    v-model="showImagePreview"
    title="钉钉二维码"
    width="400px"
    destroy-on-close
    center
  >
    <div class="image-preview-content">
      <img src="/钉钉二维码 (2).png" alt="钉钉二维码" class="preview-image" />
      <div class="image-description">
        扫描二维码加入钉钉群，联系客服进行交易咨询
      </div>
    </div>
  </el-dialog>

  <!-- 行权价格获取指南对话框 -->
  <el-dialog
    v-model="showStrikePriceGuide"
    title="如何从券商APP获取行权价格"
    width="600px"
    destroy-on-close
  >
    <div class="strike-price-guide">
      <h3>从券商APP获取行权价格的步骤</h3>
      
      <div class="guide-section">
        <h4>1. 登录您的券商APP</h4>
        <p>打开您的证券交易APP（如中信证券、华泰证券、国泰君安等）并登录您的账户。</p>
      </div>
      
      <div class="guide-section">
        <h4>2. 进入期权交易区</h4>
        <p>在APP主界面找到"期权"、"衍生品"或"股票期权"等入口，点击进入期权交易区。</p>
      </div>
      
      <div class="guide-section">
        <h4>3. 查找目标股票期权</h4>
        <p>在期权交易区输入您想要查询的股票代码或名称，例如"600519"或"贵州茅台"。</p>
      </div>
      
      <div class="guide-section">
        <h4>4. 查看期权链</h4>
        <p>找到该股票的期权链或期权报价表，通常会按到期日和看涨/看跌类型分类展示。</p>
      </div>
      
      <div class="guide-section">
        <h4>5. 找到行权价格</h4>
        <p>在期权链中，您会看到不同的行权价格选项，通常会在中间列显示。选择您感兴趣的行权价格。</p>
        <div class="example-table">
          <div class="table-header">
            <div>合约名称</div>
            <div>行权价格</div>
            <div>最新价</div>
          </div>
          <div class="table-row">
            <div>贵州茅台购9月2300</div>
            <div class="highlight">2300.00</div>
            <div>56.78</div>
          </div>
          <div class="table-row">
            <div>贵州茅台购9月2350</div>
            <div class="highlight">2350.00</div>
            <div>42.15</div>
          </div>
        </div>
      </div>
      
      <div class="guide-section">
        <h4>6. 输入行权价格</h4>
        <p>将您在券商APP中找到的行权价格输入到本系统的"行权价格"输入框中。</p>
      </div>
      
      <div class="guide-note">
        <p><strong>注意：</strong>不同券商APP的界面可能略有不同，但基本流程相似。如果您找不到期权报价信息，可以联系您的券商客服获取帮助。</p>
      </div>
    </div>
    
    <template #footer>
      <el-button @click="showStrikePriceGuide = false">我知道了</el-button>
    </template>
  </el-dialog>
  
  <!-- ICP备案信息 -->
  <IcpFooter />
</template>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-inquiry;
$primary-color: #1a2980;
$secondary-color: #26d0ce;
$text-color: #0f0f0f;
$text-secondary: var(--el-text-color-secondary);

// 登录遮罩样式
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;

  .login-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
  }

  .login-prompt {
    position: relative;
    z-index: 10000;
    background: #fff;
    border-radius: 16px;
    padding: 40px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;

    .login-icon {
      margin-bottom: 20px;

      i {
        font-size: 48px;
        color: $primary-color;
      }
    }

    .login-title {
      font-size: 24px;
      font-weight: 600;
      color: $text-color;
      margin: 0 0 16px 0;
    }

    .login-description {
      font-size: 16px;
      color: $text-secondary;
      line-height: 1.6;
      margin: 0 0 32px 0;
    }

    .login-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .login-button {
      font-size: 16px;
      padding: 12px 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
      border: none;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(26, 41, 128, 0.3);
      }
    }

    .home-button {
      font-size: 16px;
      padding: 12px 32px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: $text-color;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.5);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
      }
    }
  }
}

// 模糊效果
.inquiry-container.blurred {
  filter: blur(4px);
  pointer-events: none;
  user-select: none;
}
$bg-color: #ffffff;
$header-height: 60px;
$border-color: #e5e5e5;
$call-color: #4caf50;
$put-color: #f44336;

.#{$prefix-cls} {
  width: 100%;
  min-height: 100vh;
  background: $bg-color;
  color: $text-color;
  
  .inquiry-container {
    padding-top: calc($header-height + 60px);
    min-height: calc(100vh - $header-height);
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 20px 20px 20px;
    display: flex;
    flex-direction: column;
  }
  
  .inquiry-header {
    text-align: center;
    margin-bottom: 25px;
    padding-top: 40px;
    margin-top: 20px;
    position: relative;
    z-index: 1;
    
    .inquiry-title {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 15px;
      color: $primary-color;
      text-shadow: 0 2px 4px rgba(26, 41, 128, 0.1);
      line-height: 1.2;
      position: relative;
      z-index: 1;
      margin-top: 20px;
    }
    
    .inquiry-description {
      font-size: 16px;
      color: $text-secondary;
      max-width: 500px;
      margin: 0 auto;
      line-height: 1.5;
      font-weight: 400;
      position: relative;
      z-index: 1;
    }
  }
  
  .inquiry-content {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 20px;
    flex-grow: 1;
    overflow: hidden;
    
    .section-header {
      margin-bottom: 20px;
      margin-top: 10px;
      text-align: center;
      
      .section-title {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 4px;
        color: $primary-color;
        background: linear-gradient(135deg, $primary-color 0%, $secondary-color 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      
      .section-subtitle {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        font-weight: 400;
      }
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
      color: $primary-color;
    }
      
      .api-test-section {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
        padding: 16px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e9ecef;
        
        .api-status {
          font-size: 14px;
          color: var(--el-text-color-secondary);
        }
        
        .data-info {
          font-size: 12px;
          color: var(--el-color-success);
          background-color: #f0f9ff;
          padding: 4px 8px;
          border-radius: 4px;
          margin-left: 8px;
        }
        
        .data-source-info {
          font-size: 12px;
          color: var(--el-color-primary);
          background-color: #ecf5ff;
          padding: 4px 8px;
          border-radius: 4px;
          margin-left: 8px;
        }
        
              .data-loading-status {
        margin-bottom: 30px;
        
        :deep(.el-alert) {
          border-radius: 8px;
          
          .el-alert__title {
            font-weight: 600;
          }
          
          .el-alert__content {
            p {
              margin: 4px 0 0 0;
              font-size: 14px;
              line-height: 1.4;
            }
          }
        }
      }
      
      .data-source-notice {
        margin-bottom: 20px;
      }
    }
    
    .divider {
      height: 1px;
      background-color: $border-color;
      margin: 30px 0;
    }
    
    .upload-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
      
      @media (max-width: 576px) {
        grid-template-columns: 1fr;
      }
      
      .upload-item {
        .upload-label {
          font-weight: 500;
          margin-bottom: 8px;
        }
        
        .upload-box {
          position: relative;
          border: 2px dashed #dcdfe6;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          
          &:hover {
            border-color: $primary-color;
          }
          
          &.is-uploaded {
            border-style: solid;
            border-color: $secondary-color;
            background-color: rgba($secondary-color, 0.05);
          }
          
          .file-input {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0;
            cursor: pointer;
            z-index: 2;
          }
          
          .upload-placeholder {
            i {
              font-size: 32px;
              color: #c0c4cc;
              margin-bottom: 8px;
            }
            
            .upload-text {
              font-size: 16px;
              margin-bottom: 4px;
            }
            
            .upload-hint {
              font-size: 12px;
              color: $text-secondary;
            }
          }
          
          .uploaded-file {
            display: flex;
            align-items: center;
            justify-content: center;
            
            i {
              font-size: 24px;
              color: $secondary-color;
              margin-right: 8px;
            }
            
            .file-name {
              flex: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            .delete-btn {
              color: #f56c6c;
              
              &:hover {
                opacity: 0.8;
              }
            }
          }
        }
      }
    }
    
    .inquiry-form-container {
      background: #f9f9f9;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      height: 100%;
      overflow-y: auto;
      
      .debug-controls {
        margin-bottom: 16px;
        text-align: right;
      }
      
      .debug-panel {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
        
        .debug-title {
          color: #495057;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          border-bottom: 2px solid #007bff;
          padding-bottom: 8px;
        }
        
        .debug-section {
          margin-bottom: 16px;
          
          h4 {
            color: #6c757d;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
          }
          
          pre {
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            overflow-x: auto;
            max-height: 200px;
            overflow-y: auto;
          }
          
          ul {
            list-style: none;
            padding: 0;
            margin: 0;
            
            li {
              background: #ffffff;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 4px 8px;
              margin-bottom: 4px;
              font-size: 12px;
              font-family: monospace;
            }
          }
          
          .column-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            
            .column-item {
              background: #e3f2fd;
              border: 1px solid #2196f3;
              border-radius: 4px;
              padding: 2px 6px;
              font-size: 11px;
              font-family: monospace;
              color: #1976d2;
            }
          }
          
          .processing-info {
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 12px;
            
            p {
              margin: 4px 0;
              font-size: 13px;
              
              strong {
                color: #495057;
              }
            }
          }
          
          .table-container {
            overflow-x: auto;
            max-height: 300px;
            overflow-y: auto;
            
            .debug-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              font-family: monospace;
              
              th, td {
                border: 1px solid #dee2e6;
                padding: 4px 6px;
                text-align: left;
                white-space: nowrap;
              }
              
              th {
                background: #f8f9fa;
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 1;
              }
              
              tr:nth-child(even) {
                background: #f8f9fa;
              }
            }
          }
        }
      }
      
      :deep(.el-form-item__label) {
        font-weight: 600;
        font-size: 16px;
        color: var(--el-color-primary);
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
              .enhanced-form-item {
          margin-bottom: 12px;
          
          :deep(.el-form-item__label) {
            font-weight: 600;
            font-size: 14px;
            color: var(--el-color-primary);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          &:last-child {
            margin-bottom: 0;
          }
          
          &.inquiry-form-item {
            :deep(.el-form-item__content) {
              display: flex;
              justify-content: center;
              align-items: center;
            }
          }
        }
      
      .select-empty-tip {
        margin-top: 8px;
        font-size: 14px;
        color: #e6a23c;
        display: flex;
        align-items: center;
        
        i {
          margin-right: 4px;
        }
      }
      
      .stock-code-input-container {
        position: relative;
        margin-bottom: 12px;
        
        .stock-code-input {
          width: 100%;
          
          &.enhanced-input {
            :deep(.el-input__wrapper) {
              border-radius: 8px;
              border: 2px solid #e9ecef;
              transition: all 0.3s ease;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
              
              &:hover {
                border-color: var(--el-color-primary-light-5);
                box-shadow: 0 4px 12px rgba(64, 158, 255, 0.1);
              }
              
              &.is-focus {
                border-color: var(--el-color-primary);
                box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
              }
            }
            
            :deep(.el-input__prefix) {
              color: var(--el-color-primary);
              font-size: 16px;
            }
          }
        }
        
        .selected-stock-name {
          margin-top: 10px;
          font-size: 14px;
          color: var(--el-color-primary);
          font-weight: 500;
          padding: 8px 12px;
          background-color: #ecf5ff;
          border-radius: 6px;
          border-left: 3px solid var(--el-color-primary);
        }
        
        .selected-stock-info {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 13px;
          color: var(--el-text-color-secondary);
          background-color: #f5f7fa;
          padding: 2px 8px;
          border-radius: 4px;
          max-width: 110px; /* 限制宽度 */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0.8;
          z-index: 2; /* 确保显示在输入框上方 */
        }
        
        .stock-loading-status {
          margin-top: 8px;
          font-size: 12px;
          color: var(--el-color-primary);
          background-color: #ecf5ff;
          padding: 6px 10px;
          border-radius: 4px;
          text-align: center;
          border: 1px solid rgba(64, 158, 255, 0.2);
        }
        
        .stock-count-hint {
          margin-top: 8px;
          font-size: 12px;
          color: var(--el-color-success);
          background-color: #f0f9ff;
          padding: 6px 10px;
          border-radius: 4px;
          text-align: center;
          border: 1px solid rgba(103, 194, 58, 0.2);
        }
        
        .stock-search-results {
          position: absolute;
          width: 100%;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          border: 1px solid #dcdfe6;
          border-radius: 4px;
          box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
          z-index: 100;
          top: calc(100% + 2px);
          left: 0;
          margin-top: 0;
          
          .search-loading {
            padding: 10px;
            text-align: center;
            color: var(--el-text-color-secondary);
          }
          
          .stock-list {
            list-style: none;
            padding: 0;
            margin: 0;
            
            .stock-item {
              padding: 10px 15px;
              cursor: pointer;
              display: flex;
              justify-content: space-between;
              
              &:hover {
                background-color: #f5f7fa;
              }
              
              .stock-code {
                font-weight: 500;
                margin-right: 10px;
              }
              
              .stock-name {
                color: var(--el-text-color-secondary);
              }
            }
          }
          
          .no-match {
            padding: 10px;
            text-align: center;
            color: #e6a23c;
            
            i {
              margin-right: 4px;
            }
          }
        }
      }
    }
    
    .result-section {
      margin-top: 20px;
      
      .result-card {
          margin-bottom: 10px;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border: 1px solid #e9ecef;
          height: fit-content;
          width: 100%;
          box-sizing: border-box;
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
              padding: 10px 12px;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-bottom: 1px solid #dee2e6;
              border-radius: 10px 10px 0 0;
              border-left: 1px solid #e9ecef;
              border-right: 1px solid #e9ecef;
              border-top: 1px solid #e9ecef;
            
            .header-title {
              font-weight: 600;
              font-size: 14px;
              color: var(--el-color-primary);
            }
            
            .header-tag {
              border-radius: 20px;
              font-weight: 500;
            }
          }
          
          &.option-info-card {
            .option-info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              padding: 10px;
              
                              .info-item {
                  display: flex;
                  flex-direction: column;
                  gap: 3px;
                  padding: 8px;
                  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                  border-radius: 6px;
                  border: 1px solid #d1d5db;
                  transition: all 0.3s ease;
                
                &:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                  border-color: var(--el-color-primary);
                  border-width: 2px;
                }
                
                .info-label {
                  font-size: 11px;
                  color: var(--el-text-color-secondary);
                  font-weight: 500;
                  text-transform: uppercase;
                  letter-spacing: 0.3px;
                }
                
                .info-value {
                  font-size: 13px;
                  font-weight: 600;
                  color: var(--el-text-color-primary);
                  
                  &.code-value {
                    font-family: 'Courier New', monospace;
                    color: var(--el-color-primary);
                    background: rgba(64, 158, 255, 0.1);
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid rgba(64, 158, 255, 0.2);
                  }
                  
                  &.name-value {
                    color: var(--el-color-success);
                    font-weight: 700;
                  }
                  
                  &.type-value {
                    .el-tag {
                      border-radius: 20px;
                      font-weight: 600;
                    }
                  }
                  
                  &.strike-value {
                    .strike-tag {
                      border-radius: 20px;
                      font-weight: 600;
                      background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
                      border: none;
                      color: white;
                    }
                  }
                  
                  &.date-value {
                    font-family: 'Courier New', monospace;
                    color: var(--el-color-warning);
                    background: rgba(230, 162, 60, 0.1);
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid rgba(230, 162, 60, 0.2);
                  }
                  
                  &.term-value {
                    .term-tag {
                      border-radius: 20px;
                      font-weight: 600;
                      background: linear-gradient(135deg, #409eff 0%, #337ecc 100%);
                      border: none;
                      color: white;
                    }
                  }
                }
              }
            }
          }
        
        .quote-time-section {
          text-align: center;
          margin-bottom: 12px;
          padding: 10px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 10px;
          border: 1px solid #d1d5db;
          
          .time-label {
            font-size: 12px;
            color: var(--el-text-color-secondary);
            margin-bottom: 6px;
            font-weight: 500;
          }
          
          .time-value {
            font-size: 16px;
            font-weight: 600;
            color: var(--el-color-primary);
            font-family: 'Courier New', monospace;
          }
        }
        
        .price-section {
          padding: 12px;
          margin-bottom: 12px;
          background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
          border-radius: 10px;
          border: 1px solid #feb2b2;
          
          .main-price {
            text-align: center;
            
            .price-label {
              font-size: 16px;
              color: var(--el-text-color-secondary);
              margin-bottom: 10px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            
            .price-value {
              font-size: 32px;
              font-weight: 800;
              color: var(--el-color-danger);
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
              background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
              -webkit-background-clip: text;
              background-clip: text;
              -webkit-text-fill-color: transparent;
              padding: 4px 0;
            }
          }
        }
        
                .dingtalk-section {
              text-align: center;
          padding: 16px;
          background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
          border-radius: 10px;
          border: 1px solid #2196f3;
          margin-top: 12px;
              
          .dingtalk-title {
                font-size: 14px;
            color: var(--el-color-primary);
            margin-bottom: 16px;
            font-weight: 600;
          }
          
          .dingtalk-qr {
            .qr-image {
              width: 120px;
              height: 120px;
              border-radius: 8px;
              border: 3px solid #fff;
              box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
              transition: transform 0.3s ease;
              cursor: pointer;
              
              &:hover {
                transform: scale(1.1);
                box-shadow: 0 8px 25px rgba(33, 150, 243, 0.6);
              }
              
              &.clickable {
                cursor: pointer;
                
                &:hover {
                  transform: scale(1.1);
                  box-shadow: 0 10px 30px rgba(33, 150, 243, 0.7);
                }
              }
            }
          }
        }
        
        .greeks-section {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          justify-content: space-between;
          
          .greek-item {
            width: calc(50% - 8px);
            margin-bottom: 12px;
            
            .greek-name {
              font-size: 14px;
              color: var(--el-text-color-secondary);
            }
            
            .greek-value {
              font-size: 16px;
              font-weight: bold;
            }
          }
        }
        
        .action-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 20px;
        }
        
        .inquiry-button-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 15px;
          width: 100%;
          text-align: center;
        }
        
        .inquiry-button {
          width: 200px;
          height: 44px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--el-color-primary) 0%, #337ecc 100%);
          border: none;
          box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
          transition: all 0.3s ease;
          margin: 0 auto;
          
          &:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(64, 158, 255, 0.4);
            background: linear-gradient(135deg, #337ecc 0%, var(--el-color-primary) 100%);
          }
          
          &:active {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
          }
          
          i {
            margin-right: 8px;
            font-size: 20px;
          }
        }
      }
      
      .method-card {
        .method-content {
          font-size: 14px;
          line-height: 1.6;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }
  
  @media (max-width: 1200px) {
    .inquiry-container {
      max-width: 100%;
      padding: 15px;
    }
    
    .inquiry-content {
      grid-template-columns: 350px 1fr;
      gap: 15px;
    }
  }
  
  @media (max-width: 992px) {
    .inquiry-content {
      grid-template-columns: 1fr;
      gap: 15px;
    }
    
    .option-info-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      padding: 8px;
    }
  }
  
  .inquiry-result-container {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 300px;
    
    .empty-result {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f9f9f9;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      
      .empty-result-content {
        text-align: center;
        
        i {
          font-size: 36px;
          color: var(--el-color-primary-light-5);
          margin-bottom: 15px;
        }
        
        h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--el-color-primary);
          margin-bottom: 8px;
        }
        
        p {
          color: var(--el-text-color-secondary);
          max-width: 250px;
          margin: 0 auto;
          font-size: 14px;
        }
      }
    }
    
    .result-section {
      .mt-4 {
        margin-top: 12px;
      }
    }
  }
  
  @media (max-width: 768px) {
    .inquiry-header {
      .inquiry-title {
        font-size: 26px;
      }
      
      .inquiry-description {
        font-size: 13px;
      }
    }
    
    .inquiry-container {
      padding: 15px;
      padding-top: calc($header-height + 40px);
    }
    
    .inquiry-content {
      height: calc(100vh - 240px);
    }
    
    .inquiry-button {
      width: 180px !important;
    }
    
    .inquiry-form-container {
      padding: 15px;
    }
    
    .option-info-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
      padding: 6px;
    }
    
    .price-value {
      font-size: 28px !important;
    }
    
    .dingtalk-qr .qr-image {
      width: 100px !important;
      height: 100px !important;
    }
    
    .inquiry-button {
      width: 160px !important;
    }
  }
}

.file-preview-container {
  margin: 30px 0;
  
  .preview-title {
    font-size: 16px;
    margin-bottom: 16px;
    color: $primary-color;
  }
  
  .preview-tabs {
    display: flex;
    margin-bottom: 16px;
    border-bottom: 1px solid #dcdfe6;
    
    .tab {
      padding: 8px 16px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 14px;
      
      &:hover {
        color: $primary-color;
      }
      
      &.active {
        color: $primary-color;
        border-bottom: 2px solid $primary-color;
      }
    }
  }
  
  .sheet-selector {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    
    .sheet-label {
      font-size: 14px;
      font-weight: 500;
      margin-right: 12px;
      margin-bottom: 8px;
    }
    
    .sheet-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      
      .sheet-tab {
        padding: 6px 12px;
        cursor: pointer;
        transition: all 0.3s;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        font-size: 13px;
        margin-bottom: 8px;
        
        &:hover {
          border-color: $primary-color;
          color: $primary-color;
        }
        
        &.active {
          border-color: $primary-color;
          background-color: rgba($primary-color, 0.05);
          color: $primary-color;
        }
      }
    }
  }
  
  .preview-content {
    .table-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #ebeef5;
      border-radius: 4px;
    }
    
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      
      th, td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid #ebeef5;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      th {
        background-color: #f5f7fa;
        font-weight: 600;
        color: #606266;
      }
      
      tr:hover {
        background-color: #f5f7fa;
      }
    }
    
    .preview-note {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
      font-style: italic;
    }
  }
  
  .empty-preview {
    padding: 40px;
    text-align: center;
    color: #909399;
    background-color: #f5f7fa;
    border-radius: 4px;
  }
}

.help-text {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  
  p {
    margin: 0;
    display: flex;
    align-items: center;
    
    .el-icon {
      margin-right: 4px;
      color: #909399;
    }
  }
}

.strike-price-guide {
  .guide-section {
    margin-bottom: 20px;
    
    h4 {
      margin-top: 0;
      margin-bottom: 8px;
      color: var(--el-color-primary);
    }
    
    p {
      margin: 0 0 8px 0;
      line-height: 1.5;
    }
  }
  
  .example-table {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    margin: 10px 0;
    
    .table-header {
      display: flex;
      background-color: #f5f7fa;
      font-weight: bold;
      
      div {
        flex: 1;
        padding: 8px 12px;
        border-right: 1px solid #ebeef5;
        
        &:last-child {
          border-right: none;
        }
      }
    }
    
    .table-row {
      display: flex;
      border-top: 1px solid #ebeef5;
      
      div {
        flex: 1;
        padding: 8px 12px;
        border-right: 1px solid #ebeef5;
        
        &:last-child {
          border-right: none;
        }
        
        &.highlight {
          color: var(--el-color-danger);
          font-weight: bold;
        }
      }
    }
  }
  
  .guide-note {
    background-color: #fdf6ec;
    border-left: 4px solid #e6a23c;
    padding: 10px 15px;
    border-radius: 4px;
    
    p {
      margin: 0;
      color: #b88230;
    }
  }
}

// 图片预览样式
.image-preview-content {
  text-align: center;
  padding: 20px;
  
  .preview-image {
    width: 100%;
    max-width: 300px;
    height: auto;
    border-radius: 8px;
    border: 2px solid #e9ecef;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    margin-bottom: 16px;
  }
  
  .image-description {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }
}

.inquiry-info {
  h2 {
    font-size: 24px;
    margin-bottom: 16px;
    color: var(--el-color-primary);
  }
  
  p {
    margin-bottom: 24px;
    line-height: 1.6;
  }
  
  .instruction-list {
    margin-bottom: 30px;
    padding-left: 0;
    list-style-type: none;
    
    li {
      display: flex;
      margin-bottom: 16px;
      
      .step {
        background: linear-gradient(to right, var(--el-color-primary), #409eff);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        margin-right: 16px;
        white-space: nowrap;
      }
      
      p {
        margin: 0;
      }
    }
  }
  
  .feature-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 30px;
    
    .feature-item {
      background: #f9f9f9;
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      transition: transform 0.3s ease;
      
      &:hover {
        transform: translateY(-5px);
      }
      
      i {
        font-size: 32px;
        color: var(--el-color-primary);
        margin-bottom: 12px;
      }
      
      h3 {
        font-size: 18px;
        margin-bottom: 10px;
      }
      
      p {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin: 0;
      }
    }
  }
}

.term-options {
          .enhanced-radio-group {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
      gap: 6px;
    
      .term-radio {
        margin-bottom: 6px;
      
      :deep(.el-radio-button__inner) {
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          border: 2px solid #e9ecef;
          transition: all 0.3s ease;
          background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        
        &:hover {
          border-color: var(--el-color-primary-light-5);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
        }
      }
      
      :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
        background: linear-gradient(135deg, var(--el-color-primary) 0%, #337ecc 100%);
        border-color: var(--el-color-primary);
        color: white;
        box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
        transform: translateY(-2px);
      }
    }
  }
}

.structure-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  &.enhanced-structure {
    .structure-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px;
      background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
      border-radius: 10px;
      border: 1px solid #e9ecef;
      transition: all 0.3s ease;
      
      &:hover {
        border-color: var(--el-color-primary-light-5);
        box-shadow: 0 4px 15px rgba(64, 158, 255, 0.1);
      }
      
      .structure-label {
        min-width: 60px;
        font-size: 15px;
        color: var(--el-color-primary);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
              .structure-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          
          .structure-tag {
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 12px;
            padding: 6px 12px;
            border-radius: 16px;
            font-weight: 500;
            border: 2px solid #e9ecef;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
          
          &:hover {
            background: linear-gradient(135deg, #ecf5ff 0%, #d9ecff 100%);
            border-color: var(--el-color-primary-light-5);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
          }
          
          &.active {
            background: linear-gradient(135deg, var(--el-color-primary) 0%, #337ecc 100%);
            color: white;
            border-color: var(--el-color-primary);
            box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
            transform: translateY(-2px);
          }
        }
      }
    }
  }
}

.option-structure {
  display: flex;
  flex-direction: column;
  gap: 16px;
  
  .structure-type,
  .option-type {
    display: flex;
    align-items: center;
    
    .structure-label,
    .option-type-label {
      width: 50px;
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
    
    .el-radio-group {
      flex: 1;
    }
  }
}

.strike-price-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .strike-price-tag {
    padding: 8px 15px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background-color: #ecf5ff;
    }

    &.active {
      background-color: var(--el-color-primary);
      color: white;
    }
  }
}

// 文件状态相关样式
.file-status-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;

  .file-status-item {
    .file-label {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 12px;
    }

    .file-status-box {
      border: 2px dashed #dcdfe6;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      transition: all 0.3s ease;
      background-color: #fafafa;

      &.is-loaded {
        border-color: var(--el-color-success);
        background-color: #f0f9ff;
      }

      &.is-loading {
        border-color: var(--el-color-primary);
        background-color: #ecf5ff;
      }

      .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;

        i {
          font-size: 24px;
          color: var(--el-color-primary);
          animation: rotate 2s linear infinite;
        }

        .loading-text {
          color: var(--el-color-primary);
          font-size: 14px;
        }
      }

      .loaded-file {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;

        i {
          font-size: 20px;
          color: var(--el-color-success);
        }

        .file-name {
          color: var(--el-text-color-primary);
          font-weight: 500;
        }

        .reload-btn {
          color: var(--el-color-primary);

          &:hover {
            color: var(--el-color-primary-light-3);
          }
        }
      }

      .not-loaded-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;

        i {
          font-size: 24px;
          color: var(--el-color-warning);
        }

        .not-loaded-text {
          color: var(--el-color-warning);
          font-size: 14px;
          margin-bottom: 10px;
        }
      }
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.custom-strike-price {
  width: 100%;
}

// 调试信息样式
.debug-info {
  margin: 20px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  border-left: 4px solid #409eff;

  h3 {
    margin: 0 0 10px 0;
    color: #409eff;
    font-size: 16px;
  }

  .debug-item {
    display: flex;
    justify-content: space-between;
    margin: 8px 0;
    padding: 4px 0;
    border-bottom: 1px solid #e0e0e0;

    &:last-child {
      border-bottom: none;
    }

    span:first-child {
      font-weight: 500;
      color: #666;
    }

    .success {
      color: #67c23a;
      font-weight: 500;
    }

    .error {
      color: #f56c6c;
      font-weight: 500;
      word-break: break-all;
    }
  }

  .debug-actions {
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid #e0e0e0;
    text-align: center;
  }
}

.market-data {
  margin-top: 20px;
  
  .market-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    
    .item-label {
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
    
    .item-value {
      font-size: 16px;
      font-weight: 500;
    }
  }
}

.method-content {
  font-size: 14px;
  line-height: 1.6;

  :deep(p) {
    margin: 10px 0;
  }

  :deep(ul) {
    padding-left: 20px;
    margin: 10px 0;
  }

  :deep(li) {
    margin: 5px 0;
  }

  :deep(.note) {
    color: var(--el-color-warning);
    font-style: italic;
  }
}

// 文件预览相关样式
.file-preview-container {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;

  .preview-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .preview-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;

    .tab {
      padding: 8px 16px;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;

      &:hover {
        background: #f0f0f0;
      }

      &.active {
        background: #409eff;
        color: #fff;
        border-color: #409eff;
      }
    }
  }

  .sheet-selector {
    margin-bottom: 16px;

    .sheet-label {
      font-size: 14px;
      color: #666;
      margin-right: 12px;
    }

    .sheet-tabs {
      display: inline-flex;
      gap: 4px;

      .sheet-tab {
        padding: 4px 12px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;

        &:hover {
          background: #f0f0f0;
        }

        &.active {
          background: #67c23a;
          color: #fff;
          border-color: #67c23a;
        }
      }
    }
  }

  .preview-content {
    .table-container {
      max-height: 400px;
      overflow: auto;
      border: 1px solid #ddd;
      border-radius: 4px;

      .preview-table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;

        th {
          background: #f5f7fa;
          padding: 8px 12px;
          border-bottom: 1px solid #ddd;
          border-right: 1px solid #ddd;
          font-size: 12px;
          font-weight: 600;
          color: #333;
          text-align: left;
          position: sticky;
          top: 0;
          z-index: 1;

          &:last-child {
            border-right: none;
          }
        }

        td {
          padding: 6px 12px;
          border-bottom: 1px solid #eee;
          border-right: 1px solid #eee;
          font-size: 12px;
          color: #666;

          &:last-child {
            border-right: none;
          }
        }

        tr:hover {
          background: #f9f9f9;
        }
      }
    }

    .preview-note {
      margin-top: 8px;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
  }

  .empty-preview {
    text-align: center;
    padding: 40px;
    color: #999;
    font-size: 14px;
  }
}

// 文件状态相关样式
.file-status-section {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;

  .file-status-item {
    flex: 1;

    .file-label {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin-bottom: 8px;
    }

    .file-status-box {
      padding: 16px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      background: #fff;
      min-height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;

      &.is-loaded {
        border-color: #67c23a;
        background: #f0f9ff;
      }

      &.is-loading {
        border-color: #409eff;
        background: #f0f9ff;
      }

      .loading-content {
        text-align: center;
        color: #409eff;

        .loading-text {
          margin-top: 8px;
          font-size: 14px;
        }
      }

      .loaded-file {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #67c23a;

        .file-name {
          font-size: 14px;
          font-weight: 500;
        }

        .reload-btn {
          margin-left: auto;
          color: #409eff;
        }
      }

      .not-loaded-content {
        text-align: center;
        color: #f56c6c;

        .not-loaded-text {
          margin: 8px 0;
          font-size: 14px;
        }
      }
    }
  }
}
</style>
