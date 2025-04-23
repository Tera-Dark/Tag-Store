import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- fix-encoding.js 脚本开始 ---');

// --- 处理用户库文件夹 ---
try {
  console.log('\n--- 开始处理用户库文件夹 ---');

  // 确保目标用户库目录存在
  const userLibsDir = path.join(__dirname, 'dist', 'user_libraries');
  if (!fs.existsSync(userLibsDir)) {
    fs.mkdirSync(userLibsDir, { recursive: true });
    console.log(`✅ 创建用户库目录: ${userLibsDir}`);
  }

  // 源用户库目录
  const sourceUserLibsDir = path.join(__dirname, 'public', 'user_libraries');
  if (!fs.existsSync(sourceUserLibsDir)) {
    console.warn(`🟠 警告: 源用户库目录不存在 ${sourceUserLibsDir}`);
  } else {
    // 读取源目录中的所有文件
    const files = fs.readdirSync(sourceUserLibsDir);
    console.log(`发现${files.length}个用户库文件`);

    // 复制每个文件到目标目录
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sourcePath = path.join(sourceUserLibsDir, file);
        const targetPath = path.join(userLibsDir, file);
        console.log(`  处理用户库文件: ${file}`);

        // 读取源文件内容
        const content = fs.readFileSync(sourcePath, 'utf8');

        // 尝试解析和重新格式化JSON
        let formattedContent = content;
        try {
          const jsonObj = JSON.parse(content);
          formattedContent = JSON.stringify(jsonObj, null, 2);
          console.log(`    JSON格式化成功: ${file}`);
        } catch (jsonError) {
          console.warn(`    🟡 警告: JSON解析失败 ${file}, 将使用原始内容。错误:`, jsonError.message);
        }

        // 写入目标文件
        fs.writeFileSync(targetPath, formattedContent, 'utf8');
        console.log(`    ✅ 复制并修复编码: ${file}`);
      }
    }

    console.log('✅ 用户库文件处理完成');
  }
} catch (error) {
  console.error('处理用户库文件时出错:', error);
}

console.log('\n--- fix-encoding.js 脚本结束 ---'); 