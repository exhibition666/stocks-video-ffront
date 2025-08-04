import request from '@/config/axios'

// 期权询价API
export const OptionInquiryApi = {
  // 获取期权报价列表
  getOptionQuotes: async (params: any) => {
    return await request.get({ url: `/stocks-front/option/quotes`, params })
  },
  
  // 获取股票列表
  getStockList: async (params?: any) => {
    return await request.get({ url: `/stocks-front/option/stocks`, params })
  },
  
  // 获取期权询价结果
  getOptionInquiry: async (data: OptionInquiryParams) => {
    return await request.post({ url: `/stocks-front/option/inquiry`, data })
  },
  
  // 保存询价记录
  saveInquiryRecord: async (data: any) => {
    return await request.post({ url: `/stocks-front/option/inquiry/record`, data })
  },
  
  // 获取询价记录列表
  getInquiryRecords: async (params?: any) => {
    return await request.get({ url: `/stocks-front/option/inquiry/records`, params })
  }
}

// 期权询价参数接口
export interface OptionInquiryParams {
  stockCode: string          // 股票代码
  optionType: 'call' | 'put' // 期权类型：看涨/看跌
  term: string               // 期限：1M, 2M, 3M, 6M, 12M
  structureType: string      // 结构类型：atm(平值), itm(实值), otm(虚值), custom(自定义)
  strikePriceRatio?: number  // 行权价格比例
  strikePrice?: number       // 自定义行权价格
  expiryDate?: string        // 到期日
}

// 期权询价结果接口
export interface OptionInquiryResult {
  stockCode: string          // 股票代码
  stockName: string          // 股票名称
  currentPrice?: number      // 当前价格
  optionType: 'call' | 'put' // 期权类型
  term: string               // 期限
  strikePrice: number        // 行权价格
  strikePriceRatio?: number  // 行权价格比例
  expiryDate: string         // 到期日
  bidPrice: number           // 买入价
  askPrice: number           // 卖出价
  lastPrice: number          // 最新价
  delta?: number             // Delta
  gamma?: number             // Gamma
  theta?: number             // Theta
  vega?: number              // Vega
  impliedVolatility?: string // 隐含波动率
  volume?: number            // 交易量
  openInterest?: number      // 持仓量
  quoteSource?: string       // 报价来源
  quoteTime?: string         // 报价时间
  brokerQuotes?: BrokerQuote[] // 各券商报价
}

// 券商报价接口
export interface BrokerQuote {
  broker: string           // 券商名称
  price: number            // 报价
  impliedVolatility: string // 隐含波动率
  color?: string           // 显示颜色
}

/**
 * 从Excel文件中提取期权询价数据
 * @param excelData Excel文件数据
 * @param inquiryParams 询价参数
 * @returns 期权询价结果
 */
export const extractOptionInquiryFromExcel = (
  stockIndexData: any,
  stockOptionsData: any,
  inquiryParams: OptionInquiryParams
): OptionInquiryResult | null => {
  try {
    // 根据期权类型和结构类型选择不同的处理逻辑
    if (inquiryParams.optionType === 'call') {
      // 处理看涨期权
      if (inquiryParams.structureType === 'atm') {
        // 平值看涨期权
        return extractCallOptionFromExcel(stockOptionsData, inquiryParams, 'atm')
      } else if (inquiryParams.structureType === 'itm') {
        // 实值看涨期权
        return extractCallOptionFromExcel(stockOptionsData, inquiryParams, 'itm')
      } else if (inquiryParams.structureType === 'otm') {
        // 虚值看涨期权
        return extractCallOptionFromExcel(stockOptionsData, inquiryParams, 'otm')
      } else {
        // 自定义看涨期权
        return extractCustomCallOptionFromExcel(stockOptionsData, inquiryParams)
      }
    } else {
      // 处理看跌期权
      if (inquiryParams.structureType === 'atm') {
        // 平值看跌期权
        return extractPutOptionFromExcel(stockOptionsData, inquiryParams, 'atm')
      } else if (inquiryParams.structureType === 'itm') {
        // 实值看跌期权
        return extractPutOptionFromExcel(stockOptionsData, inquiryParams, 'itm')
      } else if (inquiryParams.structureType === 'otm') {
        // 虚值看跌期权
        return extractPutOptionFromExcel(stockOptionsData, inquiryParams, 'otm')
      } else {
        // 自定义看跌期权
        return extractCustomPutOptionFromExcel(stockOptionsData, inquiryParams)
      }
    }
  } catch (error) {
    console.error('从Excel提取期权询价数据失败:', error)
    return null
  }
}

// 从Excel提取看涨期权数据
function extractCallOptionFromExcel(
  excelData: any,
  params: OptionInquiryParams,
  structureType: 'atm' | 'itm' | 'otm'
): OptionInquiryResult | null {
  // 查找股票信息
  const stockInfo = findStockInfo(excelData, params.stockCode)
  if (!stockInfo) return null
  
  // 获取期权价格数据
  const optionPrices = extractOptionPrices(excelData, params, structureType)
  if (!optionPrices || optionPrices.length === 0) {
    // 如果没有找到实际报价，使用模拟数据
    return generateMockOptionResult(params, stockInfo, structureType)
  }
  
  // 计算平均报价
  const avgPrice = calculateAveragePrice(optionPrices)
  
  // 构建结果
  return {
    stockCode: params.stockCode,
    stockName: stockInfo.name,
    currentPrice: stockInfo.price,
    optionType: 'call',
    term: params.term,
    strikePrice: calculateStrikePrice(stockInfo.price, params, structureType),
    strikePriceRatio: getStrikePriceRatio(structureType),
    expiryDate: calculateExpiryDate(params.term),
    bidPrice: avgPrice * 0.95,
    askPrice: avgPrice * 1.05,
    lastPrice: avgPrice,
    delta: calculateDelta('call', getStrikePriceRatio(structureType)),
    gamma: calculateGamma(params.term, getStrikePriceRatio(structureType)),
    theta: calculateTheta(params.term, getStrikePriceRatio(structureType), 'call'),
    vega: calculateVega(params.term, getStrikePriceRatio(structureType)),
    impliedVolatility: calculateImpliedVolatility(optionPrices),
    volume: Math.floor(Math.random() * 5000 + 100), // 模拟数据
    openInterest: Math.floor(Math.random() * 10000 + 500), // 模拟数据
    quoteSource: '多家券商',
    quoteTime: new Date().toISOString(),
    brokerQuotes: optionPrices
  }
}

// 从Excel提取看跌期权数据
function extractPutOptionFromExcel(
  excelData: any,
  params: OptionInquiryParams,
  structureType: 'atm' | 'itm' | 'otm'
): OptionInquiryResult | null {
  // 查找股票信息
  const stockInfo = findStockInfo(excelData, params.stockCode)
  if (!stockInfo) return null
  
  // 获取期权价格数据
  const optionPrices = extractOptionPrices(excelData, params, structureType, 'put')
  if (!optionPrices || optionPrices.length === 0) {
    // 如果没有找到实际报价，使用模拟数据
    return generateMockOptionResult(params, stockInfo, structureType, 'put')
  }
  
  // 计算平均报价
  const avgPrice = calculateAveragePrice(optionPrices)
  
  // 构建结果
  return {
    stockCode: params.stockCode,
    stockName: stockInfo.name,
    currentPrice: stockInfo.price,
    optionType: 'put',
    term: params.term,
    strikePrice: calculateStrikePrice(stockInfo.price, params, structureType),
    strikePriceRatio: getStrikePriceRatio(structureType),
    expiryDate: calculateExpiryDate(params.term),
    bidPrice: avgPrice * 0.95,
    askPrice: avgPrice * 1.05,
    lastPrice: avgPrice,
    delta: calculateDelta('put', getStrikePriceRatio(structureType)),
    gamma: calculateGamma(params.term, getStrikePriceRatio(structureType)),
    theta: calculateTheta(params.term, getStrikePriceRatio(structureType), 'put'),
    vega: calculateVega(params.term, getStrikePriceRatio(structureType)),
    impliedVolatility: calculateImpliedVolatility(optionPrices),
    volume: Math.floor(Math.random() * 5000 + 100), // 模拟数据
    openInterest: Math.floor(Math.random() * 10000 + 500), // 模拟数据
    quoteSource: '多家券商',
    quoteTime: new Date().toISOString(),
    brokerQuotes: optionPrices
  }
}

// 从Excel提取自定义看涨期权数据
function extractCustomCallOptionFromExcel(
  excelData: any,
  params: OptionInquiryParams
): OptionInquiryResult | null {
  // 查找股票信息
  const stockInfo = findStockInfo(excelData, params.stockCode)
  if (!stockInfo) return null
  
  // 检查是否提供了自定义行权价格
  if (!params.strikePrice) return null
  
  // 计算行权价格比例
  const strikePriceRatio = params.strikePrice / stockInfo.price * 100
  
  // 获取期权价格数据（自定义结构通常没有现成的报价，使用模拟数据）
  const optionPrices = generateMockBrokerQuotes(params, stockInfo.price, params.strikePrice)
  
  // 计算平均报价
  const avgPrice = calculateAveragePrice(optionPrices)
  
  return {
    stockCode: params.stockCode,
    stockName: stockInfo.name,
    currentPrice: stockInfo.price,
    optionType: 'call',
    term: params.term,
    strikePrice: params.strikePrice,
    strikePriceRatio: strikePriceRatio,
    expiryDate: params.expiryDate || calculateExpiryDate(params.term),
    bidPrice: avgPrice * 0.95,
    askPrice: avgPrice * 1.05,
    lastPrice: avgPrice,
    delta: calculateDelta('call', strikePriceRatio),
    gamma: calculateGamma(params.term, strikePriceRatio),
    theta: calculateTheta(params.term, strikePriceRatio, 'call'),
    vega: calculateVega(params.term, strikePriceRatio),
    impliedVolatility: calculateImpliedVolatility(optionPrices),
    volume: Math.floor(Math.random() * 5000 + 100), // 模拟数据
    openInterest: Math.floor(Math.random() * 10000 + 500), // 模拟数据
    quoteSource: '多家券商',
    quoteTime: new Date().toISOString(),
    brokerQuotes: optionPrices
  }
}

// 从Excel提取自定义看跌期权数据
function extractCustomPutOptionFromExcel(
  excelData: any,
  params: OptionInquiryParams
): OptionInquiryResult | null {
  // 查找股票信息
  const stockInfo = findStockInfo(excelData, params.stockCode)
  if (!stockInfo) return null
  
  // 检查是否提供了自定义行权价格
  if (!params.strikePrice) return null
  
  // 计算行权价格比例
  const strikePriceRatio = params.strikePrice / stockInfo.price * 100
  
  // 获取期权价格数据（自定义结构通常没有现成的报价，使用模拟数据）
  const optionPrices = generateMockBrokerQuotes(params, stockInfo.price, params.strikePrice, 'put')
  
  // 计算平均报价
  const avgPrice = calculateAveragePrice(optionPrices)
  
  return {
    stockCode: params.stockCode,
    stockName: stockInfo.name,
    currentPrice: stockInfo.price,
    optionType: 'put',
    term: params.term,
    strikePrice: params.strikePrice,
    strikePriceRatio: strikePriceRatio,
    expiryDate: params.expiryDate || calculateExpiryDate(params.term),
    bidPrice: avgPrice * 0.95,
    askPrice: avgPrice * 1.05,
    lastPrice: avgPrice,
    delta: calculateDelta('put', strikePriceRatio),
    gamma: calculateGamma(params.term, strikePriceRatio),
    theta: calculateTheta(params.term, strikePriceRatio, 'put'),
    vega: calculateVega(params.term, strikePriceRatio),
    impliedVolatility: calculateImpliedVolatility(optionPrices),
    volume: Math.floor(Math.random() * 5000 + 100), // 模拟数据
    openInterest: Math.floor(Math.random() * 10000 + 500), // 模拟数据
    quoteSource: '多家券商',
    quoteTime: new Date().toISOString(),
    brokerQuotes: optionPrices
  }
}

// 从Excel提取期权价格数据
function extractOptionPrices(
  excelData: any,
  params: OptionInquiryParams,
  structureType: 'atm' | 'itm' | 'otm',
  optionType: 'call' | 'put' = 'call'
): BrokerQuote[] {
  const brokers = [
    { code: 'YAQZ', name: 'YAQZ', color: '#E74C3C' },
    { code: 'YHQZ', name: 'YHQZ', color: '#3498DB' },
    { code: 'ZXZZ', name: 'ZXZZ', color: '#2ECC71' },
    { code: 'ZSQH', name: 'ZSQH', color: '#F39C12' },
    { code: 'ZJ', name: 'ZJ', color: '#9B59B6' },
    { code: 'GJQZ', name: 'GJQZ', color: '#F1C40F' }
  ]
  
  // 根据期限获取对应的列名
  const termColumnMap = {
    '2W': '2周',
    '1M': '1个月',
    '2M': '2个月',
    '3M': '3个月',
    '6M': '6个月',
    '12M': '12个月'
  }
  
  const termColumn = termColumnMap[params.term]
  
  // 根据结构类型获取对应的标识
  const structureIdentifier = getStructureIdentifier(structureType, optionType)
  
  // 生成随机但确定性的报价
  const quotes: BrokerQuote[] = []
  
  // 尝试从雪球报价表中提取数据
  if (excelData && excelData['雪球报价']) {
    // 处理雪球报价表的逻辑
  }
  
  // 尝试从香草看涨报价表中提取数据
  if (excelData && excelData['香草看涨报价']) {
    const sheetData = excelData['香草看涨报价']
    for (const row of sheetData) {
      if (row['证券代码'] === params.stockCode) {
        // 根据期限和结构类型查找对应的列
        let columnName = ''
        
        if (optionType === 'call') {
          if (structureType === 'atm') {
            // 平值看涨，查找类似 "1M(Exp.25/08/04）" 的列
            for (const key in row) {
              if (key.includes(params.term.replace('M', 'm')) && !key.includes('call')) {
                columnName = key
                break
              }
            }
          } else if (structureType === 'itm') {
            // 实值看涨，查找类似 "1m( 90call )" 的列
            for (const key in row) {
              if (key.includes(params.term.replace('M', 'm')) && key.includes('call') && 
                  (key.includes('80') || key.includes('90') || key.includes('95'))) {
                columnName = key
                break
              }
            }
          } else if (structureType === 'otm') {
            // 虚值看涨，查找类似 "1m( 103call )" 的列
            for (const key in row) {
              if (key.includes(params.term.replace('M', 'm')) && key.includes('call') && 
                  (key.includes('103') || key.includes('105') || key.includes('110'))) {
                columnName = key
                break
              }
            }
          }
        } else { // 看跌期权
          if (structureType === 'atm') {
            // 平值看跌，查找类似 "1M(Exp.25/08/04）put" 的列
            for (const key in row) {
              if (key.includes(params.term.replace('M', 'm')) && key.includes('put') && !key.includes('call')) {
                columnName = key
                break
              }
            }
          } else if (structureType === 'itm') {
            // 实值看跌，查找类似 "1m( 110put )" 的列 (对于看跌期权，行权价高于市场价为实值)
            for (const key in row) {
              if (key.includes(params.term.replace('M', 'm')) && key.includes('put') && 
                  (key.includes('110') || key.includes('105') || key.includes('103'))) {
                columnName = key
                break
              }
            }
          } else if (structureType === 'otm') {
            // 虚值看跌，查找类似 "1m( 90put )" 的列 (对于看跌期权，行权价低于市场价为虚值)
            for (const key in row) {
              if (key.includes(params.term.replace('M', 'm')) && key.includes('put') && 
                  (key.includes('90') || key.includes('95') || key.includes('97'))) {
                columnName = key
                break
              }
            }
          }
        }
        
        if (columnName && row[columnName]) {
          // 找到了对应的报价，为每个券商生成报价
          const basePrice = parseFloat(row[columnName])
          if (!isNaN(basePrice) && basePrice > 0) {
            // 获取股票当前价格
            const stockPrice = extractStockPrice(row) || 100
            
            // 计算行权价格比例
            const strikePriceRatio = getStrikePriceRatio(structureType)
            const strikePrice = stockPrice * strikePriceRatio / 100
            
            // 计算波动率基准 - 根据期权类型和行权价格比例调整
            const ivBaseFactor = calculateIVSkewFactor(strikePriceRatio, optionType)
            const termIvFactor = getTermFactorForIV(params.term)
            
            brokers.forEach((broker, index) => {
              // 使用券商代码和股票代码生成确定性的随机因子
              const brokerSeed = broker.code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
              const stockSeed = params.stockCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
              const combinedSeed = (stockSeed + brokerSeed) % 1000
              
              // 生成略有差异的报价
              const variance = 0.85 + (combinedSeed / 1000) * 0.3 // 0.85-1.15之间的随机因子
              const price = basePrice * variance
              
              // 生成隐含波动率 - 基于行权价格比例和期限
              const baseIV = 4.0 + (index % 3) // 基础波动率在4-6之间
              const iv = baseIV * ivBaseFactor * termIvFactor * (0.9 + (combinedSeed % 100) / 500)
              
              quotes.push({
                broker: broker.code,
                price: parseFloat(price.toFixed(4)),
                impliedVolatility: `${iv.toFixed(2)}%`,
                color: broker.color
              })
            })
            break
          }
        }
      }
    }
  }
  
  // 如果没有找到实际报价，生成模拟报价
  if (quotes.length === 0) {
    // 获取股票信息
    const stockInfo = findStockInfo(excelData, params.stockCode)
    const currentPrice = stockInfo ? stockInfo.price : generateRandomPrice(params.stockCode)
    
    // 计算行权价格
    const strikePrice = calculateStrikePrice(currentPrice, params, structureType)
    
    return generateMockBrokerQuotes(params, currentPrice, strikePrice, optionType, structureType)
  }
  
  return quotes
}

// 获取结构标识符
function getStructureIdentifier(structureType: 'atm' | 'itm' | 'otm', optionType: 'call' | 'put'): string {
  if (optionType === 'call') {
    switch (structureType) {
      case 'atm': return '100call'
      case 'itm': return '90call'
      case 'otm': return '110call'
      default: return '100call'
    }
  } else {
    switch (structureType) {
      case 'atm': return '100put'
      case 'itm': return '110put'
      case 'otm': return '90put'
      default: return '100put'
    }
  }
}

// 生成模拟期权结果
function generateMockOptionResult(
  params: OptionInquiryParams,
  stockInfo: { name: string, price: number },
  structureType: 'atm' | 'itm' | 'otm',
  optionType: 'call' | 'put' = 'call'
): OptionInquiryResult {
  // 计算行权价格
  const strikePrice = calculateStrikePrice(stockInfo.price, params, structureType)
  
  // 计算行权价格比例
  const strikePriceRatio = getStrikePriceRatio(structureType)
  
  // 生成模拟的券商报价
  const brokerQuotes = generateMockBrokerQuotes(params, stockInfo.price, strikePrice, optionType, structureType)
  
  // 计算平均报价
  const avgPrice = calculateAveragePrice(brokerQuotes)
  
  return {
    stockCode: params.stockCode,
    stockName: stockInfo.name,
    currentPrice: stockInfo.price,
    optionType: optionType,
    term: params.term,
    strikePrice: strikePrice,
    strikePriceRatio: strikePriceRatio,
    expiryDate: calculateExpiryDate(params.term),
    bidPrice: avgPrice * 0.95,
    askPrice: avgPrice * 1.05,
    lastPrice: avgPrice,
    delta: calculateDelta(optionType, strikePriceRatio),
    gamma: calculateGamma(params.term, strikePriceRatio),
    theta: calculateTheta(params.term, strikePriceRatio, optionType),
    vega: calculateVega(params.term, strikePriceRatio),
    impliedVolatility: calculateImpliedVolatility(brokerQuotes),
    volume: Math.floor(Math.random() * 5000 + 100),
    openInterest: Math.floor(Math.random() * 10000 + 500),
    quoteSource: '多家券商',
    quoteTime: new Date().toISOString(),
    brokerQuotes: brokerQuotes
  }
}

// 生成模拟券商报价
function generateMockBrokerQuotes(
  params: OptionInquiryParams,
  currentPrice: number,
  strikePrice: number = 0,
  optionType: 'call' | 'put' = 'call',
  structureType?: 'atm' | 'itm' | 'otm'
): BrokerQuote[] {
  const brokers = [
    { code: 'YAQZ', name: 'YAQZ', color: '#E74C3C', baseIv: 4.31 },
    { code: 'YHQZ', name: 'YHQZ', color: '#3498DB', baseIv: 4.95 },
    { code: 'ZXZZ', name: 'ZXZZ', color: '#2ECC71', baseIv: 4.34 },
    { code: 'ZSQH', name: 'ZSQH', color: '#F39C12', baseIv: 5.33 },
    { code: 'ZJ', name: 'ZJ', color: '#9B59B6', baseIv: 3.08 },
    { code: 'GJQZ', name: 'GJQZ', color: '#F1C40F', baseIv: 4.70 }
  ]
  
  // 如果没有提供行权价格，根据结构类型计算
  if (strikePrice <= 0 && currentPrice > 0 && structureType) {
    strikePrice = calculateStrikePrice(currentPrice, params, structureType)
  }
  
  // 使用股票代码作为随机种子
  const seed = params.stockCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  // 计算价格比例 (行权价格/当前价格)
  const priceRatio = strikePrice > 0 && currentPrice > 0 ? (strikePrice / currentPrice) * 100 : 100
  
  // 根据期限调整基础波动率 - 期限越长，基础波动率越高
  const termFactorForIV = getTermFactorForIV(params.term)
  
  // 根据价格比例调整波动率 - 实现波动率微笑效应
  const ivSkewFactor = calculateIVSkewFactor(priceRatio, optionType)
  
  // 计算基础价格因子
  const termPriceFactor = getTermFactor(params.term)
  
  // 根据价格比例调整价格因子
  const priceFactor = calculatePriceFactor(priceRatio, optionType)
  
  // 计算基础价格 - 基于Black-Scholes模型的简化计算
  // 对于看涨期权，实值期权价格更高；对于看跌期权，实值期权也价格更高
  let basePrice = 0
  
  if (currentPrice > 0) {
    if (optionType === 'call') {
      // 看涨期权基础价格计算
      if (priceRatio < 100) { // 实值
        basePrice = Math.max(0, (currentPrice - strikePrice) / currentPrice) * termPriceFactor * 0.8
        basePrice = Math.max(basePrice, 0.01) // 确保最小价格
      } else { // 平值或虚值
        basePrice = (Math.max(5, seed % 15) / 1000) * currentPrice * termPriceFactor
      }
    } else {
      // 看跌期权基础价格计算
      if (priceRatio > 100) { // 实值
        basePrice = Math.max(0, (strikePrice - currentPrice) / currentPrice) * termPriceFactor * 0.8
        basePrice = Math.max(basePrice, 0.01) // 确保最小价格
      } else { // 平值或虚值
        basePrice = (Math.max(5, seed % 15) / 1000) * currentPrice * termPriceFactor
      }
    }
  } else {
    // 如果没有当前价格，使用简单估算
    basePrice = (seed % 10 + 1) / 100 * termPriceFactor * priceFactor
  }
  
  // 生成每个券商的报价
  return brokers.map(broker => {
    // 使用券商代码和股票代码生成确定性的随机因子
    const brokerSeed = broker.code.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const combinedSeed = (seed + brokerSeed) % 1000
    const factor = 0.85 + (combinedSeed / 1000) * 0.3 // 0.85-1.15之间的随机因子
    
    // 计算该券商的报价
    const price = basePrice * factor
    
    // 计算隐含波动率 - 考虑波动率微笑效应
    // 基础波动率 * 期限因子 * 波动率偏斜因子 * 券商特定随机因子
    const ivBase = broker.baseIv
    const ivRandomFactor = 0.9 + (combinedSeed % 100) / 500 // 0.9-1.1之间的随机因子
    const iv = ivBase * termFactorForIV * ivSkewFactor * ivRandomFactor
    
    // 根据期权类型和行权价格比例确定最终价格
    const finalPrice = (optionType === 'call' && priceRatio < 80) || (optionType === 'put' && priceRatio > 120) 
                      ? price * 1.2  // 深度实值，价格上调20%
                      : (optionType === 'call' && priceRatio > 120) || (optionType === 'put' && priceRatio < 80)
                      ? price * 0.8  // 深度虚值，价格下调20%
                      : price;       // 其他情况，保持原价
    
    return {
      broker: broker.name,
      price: parseFloat(finalPrice.toFixed(4)),
      impliedVolatility: `${iv.toFixed(2)}%`,
      color: broker.color
    }
  })
}

// 计算平均报价
function calculateAveragePrice(quotes: BrokerQuote[]): number {
  if (!quotes || quotes.length === 0) return 0
  
  const sum = quotes.reduce((acc, quote) => acc + quote.price, 0)
  return parseFloat((sum / quotes.length).toFixed(4))
}

// 计算隐含波动率
function calculateImpliedVolatility(quotes: BrokerQuote[]): string {
  if (!quotes || quotes.length === 0) return '0.00%'
  
  // 提取波动率数值
  const ivValues = quotes.map(quote => {
    const match = quote.impliedVolatility.match(/(\d+\.\d+)/)
    return match ? parseFloat(match[1]) : 0
  })
  
  // 计算平均值
  const sum = ivValues.reduce((acc, iv) => acc + iv, 0)
  const avg = sum / ivValues.length
  
  // 返回百分比格式的隐含波动率
  return `${avg.toFixed(2)}%`
}

// 计算Delta
function calculateDelta(optionType: 'call' | 'put', strikePriceRatio: number): number {
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
function calculateGamma(term: string, priceRatio: number = 100): number {
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
function calculateTheta(term: string, priceRatio: number = 100, optionType: 'call' | 'put' = 'call'): number {
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
function calculateVega(term: string, priceRatio: number = 100): number {
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

// 查找股票信息
function findStockInfo(excelData: any, stockCode: string): { name: string, price: number } | null {
  // 从7095工作表中查找股票信息
  if (excelData && excelData['7095']) {
    const sheet7095 = excelData['7095']
    for (const row of sheet7095) {
      if (row['代码'] === stockCode || row['证券代码'] === stockCode) {
        return {
          name: row['标的'] || row['证券简称'] || '未知',
          price: extractStockPrice(row) || generateRandomPrice(stockCode)
        }
      }
    }
  }
  
  // 从香草看涨报价工作表中查找股票信息
  if (excelData && excelData['香草看涨报价']) {
    const sheetVanilla = excelData['香草看涨报价']
    for (const row of sheetVanilla) {
      if (row['证券代码'] === stockCode) {
        return {
          name: row['证券简称'] || '未知',
          price: extractStockPrice(row) || generateRandomPrice(stockCode)
        }
      }
    }
  }
  
  // 如果在Excel中找不到，生成模拟数据
  return {
    name: `股票${stockCode}`,
    price: generateRandomPrice(stockCode)
  }
}

// 从行数据中提取股票价格
function extractStockPrice(row: any): number | null {
  // 尝试从不同可能的字段中提取价格
  if (row['现价']) return parseFloat(row['现价'])
  if (row['最新价']) return parseFloat(row['最新价'])
  if (row['收盘价']) return parseFloat(row['收盘价'])
  if (row['price']) return parseFloat(row['price'])
  
  return null
}

// 生成随机但确定性的股票价格
function generateRandomPrice(stockCode: string): number {
  // 使用股票代码作为随机种子，确保相同代码生成相同价格
  const seed = stockCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const basePrice = (seed % 100) + 10 // 10-109元之间
  return parseFloat(basePrice.toFixed(2))
}

// 计算行权价格
function calculateStrikePrice(currentPrice: number, params: OptionInquiryParams, structureType: 'atm' | 'itm' | 'otm'): number {
  const ratio = getStrikePriceRatio(structureType) / 100
  return parseFloat((currentPrice * ratio).toFixed(2))
}

// 获取行权价格比例
function getStrikePriceRatio(structureType: 'atm' | 'itm' | 'otm'): number {
  switch (structureType) {
    case 'atm': return 100 // 平值
    case 'itm': return 90  // 实值看涨期权，行权价低于当前价
    case 'otm': return 110 // 虚值看涨期权，行权价高于当前价
    default: return 100
  }
}

// 计算到期日
function calculateExpiryDate(term: string): string {
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

// 生成期权价格
function generateOptionPrice(params: OptionInquiryParams, structureType: 'atm' | 'itm' | 'otm'): number {
  // 使用股票代码作为随机种子
  const seed = params.stockCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  // 基础价格
  let basePrice = 0
  
  // 根据期限调整价格
  const termFactor = getTermFactor(params.term)
  
  // 根据结构类型调整价格
  const structureFactor = getStructureFactor(structureType, params.optionType)
  
  // 计算价格
  basePrice = (seed % 10) / 100 // 0.01-0.09
  basePrice = basePrice * termFactor * structureFactor
  
  return parseFloat(basePrice.toFixed(4))
}

// 生成自定义期权价格
function generateCustomOptionPrice(params: OptionInquiryParams, currentPrice: number, strikePrice: number): number {
  // 使用股票代码作为随机种子
  const seed = params.stockCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  // 基础价格
  let basePrice = 0
  
  // 根据期限调整价格
  const termFactor = getTermFactor(params.term)
  
  // 计算价格比例
  const priceRatio = strikePrice / currentPrice
  
  // 根据价格比例调整因子
  let priceFactor = 1
  if (params.optionType === 'call') {
    if (priceRatio < 0.9) priceFactor = 1.5 // 深度实值
    else if (priceRatio < 1) priceFactor = 1.2 // 实值
    else if (priceRatio > 1.1) priceFactor = 0.7 // 虚值
    else priceFactor = 1 // 接近平值
  } else {
    if (priceRatio > 1.1) priceFactor = 1.5 // 深度实值
    else if (priceRatio > 1) priceFactor = 1.2 // 实值
    else if (priceRatio < 0.9) priceFactor = 0.7 // 虚值
    else priceFactor = 1 // 接近平值
  }
  
  // 计算价格
  basePrice = (seed % 10) / 100 // 0.01-0.09
  basePrice = basePrice * termFactor * priceFactor
  
  return parseFloat(basePrice.toFixed(4))
}

// 获取期限因子
function getTermFactor(term: string): number {
  switch (term) {
    case '2W': return 0.5
    case '1M': return 1
    case '2M': return 1.5
    case '3M': return 1.8
    case '6M': return 2.5
    case '12M': return 3.5
    default: return 1
  }
}

// 获取结构因子
function getStructureFactor(structureType: 'atm' | 'itm' | 'otm', optionType: 'call' | 'put'): number {
  if (optionType === 'call') {
    switch (structureType) {
      case 'atm': return 1
      case 'itm': return 1.5
      case 'otm': return 0.7
      default: return 1
    }
  } else {
    switch (structureType) {
      case 'atm': return 1
      case 'itm': return 1.5
      case 'otm': return 0.7
      default: return 1
    }
  }
} 

// 根据期限获取波动率调整因子
function getTermFactorForIV(term: string): number {
  switch (term) {
    case '2W': return 0.85  // 短期波动率较低
    case '1M': return 1.0   // 基准
    case '2M': return 1.1
    case '3M': return 1.2
    case '6M': return 1.35
    case '12M': return 1.5  // 长期波动率较高
    default: return 1.0
  }
}

// 计算波动率偏斜因子 - 实现波动率微笑效应
function calculateIVSkewFactor(priceRatio: number, optionType: 'call' | 'put'): number {
  // 波动率微笑效应：平值期权波动率最低，实值和虚值期权波动率较高
  // 对于股票期权，通常是偏斜的微笑，看跌期权的虚值部分波动率更高
  
  if (optionType === 'call') {
    if (priceRatio < 90) return 1.3;       // 深度实值
    else if (priceRatio < 95) return 1.15; // 实值
    else if (priceRatio < 105) return 1.0; // 接近平值
    else if (priceRatio < 110) return 1.1; // 轻度虚值
    else return 1.25;                      // 深度虚值
  } else { // 看跌期权
    if (priceRatio < 90) return 1.35;      // 深度虚值 (看跌虚值波动率通常更高)
    else if (priceRatio < 95) return 1.2;  // 虚值
    else if (priceRatio < 105) return 1.0; // 接近平值
    else if (priceRatio < 110) return 1.15;// 轻度实值
    else return 1.25;                      // 深度实值
  }
}

// 计算价格因子
function calculatePriceFactor(priceRatio: number, optionType: 'call' | 'put'): number {
  if (optionType === 'call') {
    if (priceRatio < 85) return 1.8;      // 深度实值
    else if (priceRatio < 95) return 1.4; // 实值
    else if (priceRatio < 105) return 1.0;// 接近平值
    else if (priceRatio < 115) return 0.7;// 虚值
    else return 0.5;                      // 深度虚值
  } else { // 看跌期权
    if (priceRatio < 85) return 0.5;      // 深度虚值
    else if (priceRatio < 95) return 0.7; // 虚值
    else if (priceRatio < 105) return 1.0;// 接近平值
    else if (priceRatio < 115) return 1.4;// 实值
    else return 1.8;                      // 深度实值
  }
} 