const xlsx = require('xlsx');
const path = require('path');

// 创建工作簿
const workbook = xlsx.utils.book_new();

// 创建表头
const headers = ['username', 'name', 'password', 'grade', 'class'];
const data = [
  headers,
  ['20240001', '张三', '123456', '2024', '1'],  // 示例数据
  ['20240002', '李四', '123456', '2024', '1'],  // 示例数据
  ['20240101', '王五', '123456', '2024', '2'],  // 示例数据
];

// 创建工作表
const worksheet = xlsx.utils.aoa_to_sheet(data);

// 设置列宽
const colWidths = [
  { wch: 10 },  // username
  { wch: 8 },   // name
  { wch: 12 },  // password
  { wch: 8 },   // grade
  { wch: 6 },   // class
];
worksheet['!cols'] = colWidths;

// 将工作表添加到工作簿
xlsx.utils.book_append_sheet(workbook, worksheet, '学生信息');

// 保存文件
const templatePath = path.join(__dirname, 'student_template.xlsx');
xlsx.writeFile(workbook, templatePath);

console.log('模板文件已创建：', templatePath); 