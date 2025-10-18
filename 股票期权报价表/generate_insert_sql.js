const XLSX = require('xlsx');
const fs = require('fs');

// 读取Excel文件
function readExcelFile(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // 获取第一个工作表
        const worksheet = workbook.Sheets[sheetName];
        
        // 将工作表转换为JSON数组
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return jsonData;
    } catch (error) {
        console.error('读取Excel文件失败:', error);
        return null;
    }
}

// 从建表语句中提取字段名
function extractFieldNamesFromCreateTable() {
    const createTableSQL = fs.readFileSync('yudao_excel_daily建表语句.sql', 'utf8');
    const lines = createTableSQL.split('\n');
    const fieldNames = [];
    
    for (const line of lines) {
        // 匹配字段定义行，格式如：`字段名` VARCHAR(255) COMMENT '注释'
        const match = line.match(/`([^`]+)`\s+[A-Z]+\([^)]+\)/);
        if (match && match[1] !== 'id' && match[1] !== 'creator' && match[1] !== 'create_time' && 
            match[1] !== 'updater' && match[1] !== 'update_time' && match[1] !== 'deleted' && match[1] !== 'tenant_id') {
            fieldNames.push(match[1]);
        }
    }
    
    return fieldNames;
}

// 生成INSERT语句
function generateInsertSQL(data, fieldNames) {
    let sqlContent = '';
    
    // 添加文件头部注释
    sqlContent += `-- 期权报价数据插入语句\n`;
    sqlContent += `-- 生成时间: ${new Date().toLocaleString()}\n`;
    sqlContent += `-- 数据来源: 中信中证资本期权报价表2025-08-25origin.xlsx\n`;
    sqlContent += `-- 数据行数: ${data.length - 1}\n`;
    sqlContent += `-- 字段数量: ${fieldNames.length}\n\n`;
    
    // 从第二行开始处理数据（第一行是标题）
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        // 构建INSERT语句
        sqlContent += `INSERT INTO \`yudao_excel_daily\` (`;
        sqlContent += fieldNames.map(field => `\`${field}\``).join(', ');
        sqlContent += `) VALUES (`;
        
        // 处理每个字段的值
        const values = [];
        for (let j = 0; j < fieldNames.length; j++) {
            const value = row[j] || '';
            
            // 处理不同类型的值
            if (value === '' || value === null || value === undefined) {
                values.push('NULL');
            } else if (typeof value === 'number') {
                values.push(value.toString());
            } else {
                // 字符串类型，需要转义单引号
                const escapedValue = value.toString().replace(/'/g, "''");
                values.push(`'${escapedValue}'`);
            }
        }
        
        sqlContent += values.join(', ');
        sqlContent += `);\n`;
    }
    
    return sqlContent;
}

// 主函数
function main() {
    console.log('开始处理Excel文件...');
    
    // 读取Excel文件
    const excelData = readExcelFile('中信中证资本期权报价表2025-08-25origin.xlsx');
    if (!excelData) {
        console.error('无法读取Excel文件');
        return;
    }
    
    console.log(`Excel文件读取成功，共 ${excelData.length} 行数据`);
    
    // 从建表语句中提取字段名
    const fieldNames = extractFieldNamesFromCreateTable();
    console.log(`从建表语句中提取到 ${fieldNames.length} 个字段:`);
    fieldNames.forEach((field, index) => {
        console.log(`${index + 1}. ${field}`);
    });
    
    // 生成INSERT SQL
    console.log('开始生成INSERT SQL语句...');
    const sqlContent = generateInsertSQL(excelData, fieldNames);
    
    // 写入文件
    fs.writeFileSync('yudao_excel_daily_insert.sql', sqlContent, 'utf8');
    
    console.log('SQL文件生成完成！');
    console.log(`文件名: yudao_excel_daily_insert.sql`);
    console.log(`文件大小: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`INSERT语句数量: ${excelData.length - 1}`);
}

// 运行主函数
main(); 