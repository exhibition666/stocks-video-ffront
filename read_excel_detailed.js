const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 文件路径
const stockIndexPath = path.join(__dirname, '股票期权报价表', '股指报价表20250704.xlsx');
const stockOptionsPath = path.join(__dirname, '股票期权报价表', '中信中证资本期权报价表2025-07-04.xlsx');
    
// 分析工作表内容
function analyzeWorksheet(worksheet, sheetName) {
  console.log(`\n分析工作表: ${sheetName}`);
    
  // 转换为JSON
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
  if (data.length === 0) {
    console.log('  工作表为空');
    return;
      }
      
  console.log(`  行数: ${data.length}`);
      
  // 找到有效的表头行（通常不是第一行，可能有合并单元格或标题）
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (data[i] && data[i].length > 5) { // 假设有效表头至少有5列
      headerRowIndex = i;
          break;
        }
      }
      
  const headers = data[headerRowIndex];
  console.log(`  找到表头在第 ${headerRowIndex + 1} 行`);
  console.log(`  列数: ${headers ? headers.length : 0}`);
  
  if (headers && headers.length > 0) {
    console.log('  表头内容:');
    console.log(`    ${headers.slice(0, 15).join(' | ')}`);
        
    // 显示数据样例
    console.log('  数据样例(前3行):');
    for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 4, data.length); i++) {
      if (data[i] && data[i].length > 0) {
        const row = data[i].slice(0, 15).map(cell => cell === undefined ? '' : cell);
        console.log(`    ${row.join(' | ')}`);
      }
    }
    
    // 查找关键列
    findKeyColumns(headers);
  }
  
  // 检查是否包含7095特殊工作表的结构
  if (sheetName === '7095') {
    console.log('\n特别分析7095工作表:');
    analyzeSheet7095(data);
  }
}

// 查找关键列
function findKeyColumns(headers) {
  const keyColumns = {
    '股票代码': ['证券代码', '股票代码', '代码', '标的代码', '合约标的'],
    '股票名称': ['证券名称', '股票名称', '名称', '标的名称', '合约标的名称'],
    '行权价格': ['行权价', '行权价格', '执行价', '执行价格', 'strike price'],
    '期权类型': ['期权类型', '看涨看跌', '方向', 'call/put', '期权种类'],
    '到期日': ['到期日', '到期时间', '期限', '期权到期日', '到期'],
    '波动率': ['波动率', '隐含波动率', 'iv', '历史波动率', 'hv'],
    '期权价格': ['期权价格', '期权费', '权利金', '价格', '报价']
  };
  
  console.log('\n  关键列位置:');
  
  for (const [key, keywords] of Object.entries(keyColumns)) {
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '').toLowerCase();
      if (keywords.some(keyword => header.includes(keyword.toLowerCase()))) {
        console.log(`    ${key}: 第 ${i + 1} 列 (${headers[i]})`);
        break;
          }
        }
      }
    }
    
// 特别分析7095工作表
function analyzeSheet7095(data) {
  // 找到有效的表头行
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (data[i] && data[i].length > 5) {
            headerRowIndex = i;
            break;
          }
        }
  
  const headers = data[headerRowIndex];
  if (!headers) {
    console.log('  无法找到有效表头');
    return;
  }
  
  // 尝试识别股票代码和名称列
  let codeColumnIndex = -1;
  let nameColumnIndex = -1;
  
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase();
    if (header.includes('代码') || header.includes('code')) {
      codeColumnIndex = i;
      }
    if (header.includes('名称') || header.includes('name')) {
      nameColumnIndex = i;
    }
  }
  
  // 如果没有找到明确的列名，尝试使用前两列
  if (codeColumnIndex === -1) codeColumnIndex = 0;
  if (nameColumnIndex === -1) nameColumnIndex = 1;
  
  console.log(`  股票代码列: 第 ${codeColumnIndex + 1} 列`);
  console.log(`  股票名称列: 第 ${nameColumnIndex + 1} 列`);
  
  // 提取股票代码和名称
  console.log('  股票列表示例:');
  const stocks = [];
  
  for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 11, data.length); i++) {
    if (data[i] && data[i].length > Math.max(codeColumnIndex, nameColumnIndex)) {
      const code = data[i][codeColumnIndex];
      const name = data[i][nameColumnIndex];
      if (code) {
        stocks.push({ code, name });
        console.log(`    ${code} - ${name || '未知'}`);
    }
  }
  }
  
  console.log(`  共找到 ${stocks.length} 支股票`);
}

// 分析股指报价表
console.log('=================== 股指报价表分析 ===================');
try {
  const workbook = XLSX.readFile(stockIndexPath);
  console.log('工作表列表:', workbook.SheetNames);
  
  // 分析每个工作表
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    analyzeWorksheet(worksheet, sheetName);
  });
} catch (error) {
  console.error('读取股指报价表出错:', error);
}

// 分析期权报价表
console.log('\n\n=================== 期权报价表分析 ===================');
try {
  const workbook = XLSX.readFile(stockOptionsPath);
  console.log('工作表列表:', workbook.SheetNames);
  
  // 分析特定的工作表
  const sheetsToAnalyze = ['香草看涨报价', '7095', '雪球报价'];
  
  sheetsToAnalyze.forEach(sheetName => {
    if (workbook.SheetNames.includes(sheetName)) {
      const worksheet = workbook.Sheets[sheetName];
      analyzeWorksheet(worksheet, sheetName);
}
  });
} catch (error) {
  console.error('读取期权报价表出错:', error);
} 