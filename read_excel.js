const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取股指报价表
const stockIndexPath = path.join(__dirname, '股票期权报价表', '股指报价表20250704.xlsx');
const stockOptionsPath = path.join(__dirname, '股票期权报价表', '中信中证资本期权报价表2025-07-04.xlsx');

// 读取股指报价表
try {
  const stockIndexWorkbook = XLSX.readFile(stockIndexPath);
  console.log('股指报价表工作表列表:', stockIndexWorkbook.SheetNames);
      
  // 获取第一个工作表的结构
  const firstSheet = stockIndexWorkbook.Sheets[stockIndexWorkbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
  if (data.length > 0) {
    console.log('股指报价表第一个工作表的列头:', data[0]);
  }
  
  console.log('股指报价表数据行数:', data.length);
} catch (error) {
  console.error('读取股指报价表出错:', error);
      }
      
// 读取期权报价表
try {
  const stockOptionsWorkbook = XLSX.readFile(stockOptionsPath);
  console.log('\n期权报价表工作表列表:', stockOptionsWorkbook.SheetNames);
  
  // 获取第一个工作表的结构
  const firstSheet = stockOptionsWorkbook.Sheets[stockOptionsWorkbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
  
  if (data.length > 0) {
    console.log('期权报价表第一个工作表的列头:', data[0]);
  }
  
  console.log('期权报价表数据行数:', data.length);
} catch (error) {
  console.error('读取期权报价表出错:', error);
} 