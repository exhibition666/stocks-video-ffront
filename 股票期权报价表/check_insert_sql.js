const fs = require('fs');

// 读取SQL文件的前100行
function checkSQLFile() {
    try {
        const content = fs.readFileSync('yudao_excel_daily_insert.sql', 'utf8');
        const lines = content.split('\n');
        
        console.log('=== SQL文件前50行 ===');
        for (let i = 0; i < Math.min(50, lines.length); i++) {
            console.log(`${i + 1}: ${lines[i]}`);
        }
        
        console.log('\n=== 文件信息 ===');
        console.log(`总行数: ${lines.length}`);
        console.log(`文件大小: ${(content.length / 1024 / 1024).toFixed(2)} MB`);
        
        // 统计INSERT语句数量
        const insertCount = content.match(/INSERT INTO/g)?.length || 0;
        console.log(`INSERT语句数量: ${insertCount}`);
        
        // 显示文件末尾信息
        console.log('\n=== 文件末尾信息 ===');
        const lastLines = lines.slice(-10);
        lastLines.forEach((line, index) => {
            console.log(`${lines.length - 10 + index + 1}: ${line}`);
        });
        
    } catch (error) {
        console.error('读取SQL文件失败:', error);
    }
}

checkSQLFile(); 