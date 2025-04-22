import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 指定需要处理的文件路径
const filePath = path.join(__dirname, 'dist', 'templates', 'default.json');
const sourceFilePath = path.join(__dirname, 'public', 'templates', 'default.json');

// 从source读取UTF-8文件内容
try {
  console.log('正在修复文件编码...');
  const content = fs.readFileSync(sourceFilePath, 'utf8');
  
  // 尝试解析和重新格式化JSON，以确保格式正确
  let formattedContent = content;
  try {
    const jsonObj = JSON.parse(content);
    formattedContent = JSON.stringify(jsonObj, null, 2);
    console.log('JSON格式化成功');
  } catch (jsonError) {
    console.warn('警告: JSON解析失败，将使用原始内容。错误:', jsonError.message);
  }
  
  // 确保dist/templates目录存在
  const templatesDir = path.join(__dirname, 'dist', 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  // 以UTF-8编码写入到目标文件
  fs.writeFileSync(filePath, formattedContent, 'utf8');
  console.log('文件编码修复完成！');
} catch (error) {
  console.error('修复文件编码时出错:', error);
} 