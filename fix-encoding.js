import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义需要处理的文件列表
const filesToProcess = [
  {
    source: path.join(__dirname, 'public', 'templates', 'default.json'),
    target: path.join(__dirname, 'dist', 'templates', 'default.json')
  },
  {
    source: path.join(__dirname, 'public', 'templates', 'english20.json'),
    target: path.join(__dirname, 'dist', 'templates', 'english20.json')
  },
  {
    source: path.join(__dirname, 'public', 'templates', 'english50.json'),
    target: path.join(__dirname, 'dist', 'templates', 'english50.json')
  }
];

// 确保目标目录存在
const templatesDir = path.join(__dirname, 'dist', 'templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// 处理每个文件
for (const file of filesToProcess) {
  try {
    console.log(`正在处理文件: ${file.source}`);
    
    // 检查源文件是否存在
    if (!fs.existsSync(file.source)) {
      console.warn(`警告: 源文件不存在 ${file.source}`);
      continue;
    }
    
    // 从source读取UTF-8文件内容
    const content = fs.readFileSync(file.source, 'utf8');
    
    // 尝试解析和重新格式化JSON，以确保格式正确
    let formattedContent = content;
    try {
      const jsonObj = JSON.parse(content);
      formattedContent = JSON.stringify(jsonObj, null, 2);
      console.log(`JSON格式化成功: ${path.basename(file.source)}`);
    } catch (jsonError) {
      console.warn(`警告: JSON解析失败 ${path.basename(file.source)}, 将使用原始内容。错误:`, jsonError.message);
    }
    
    // 以UTF-8编码写入到目标文件
    fs.writeFileSync(file.target, formattedContent, 'utf8');
    console.log(`✅ 文件编码修复完成: ${path.basename(file.target)}`);
  } catch (error) {
    console.error(`处理文件时出错 ${file.source}:`, error);
  }
}

console.log('所有文件处理完成！'); 