// Run locally: npm run init-admin. Run in Docker: docker compose exec backend npm run init-admin.
const readline = require('readline');
const { Writable } = require('stream');
const mongoose = require('mongoose');
const config = require('../config');
const { initializeAdmin } = require('../services/adminInitialization');

async function prompt(label, hidden = false) {
  if (!process.stdin.isTTY) throw new Error('请使用交互终端，或设置 INIT_ADMIN_USERNAME 和 INIT_ADMIN_PASSWORD');
  process.stdout.write(label);
  const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
  const reader = readline.createInterface({ input: process.stdin, output, terminal: true });
  try { return await new Promise(resolve => reader.question('', resolve)); }
  finally { reader.close(); if (hidden) process.stdout.write('\n'); }
}

async function main() {
  const username = process.env.INIT_ADMIN_USERNAME || await prompt('管理员用户名: ');
  const password = process.env.INIT_ADMIN_PASSWORD || await prompt('管理员密码（至少6字符）: ', true);
  if (!process.env.INIT_ADMIN_PASSWORD && password !== await prompt('再次输入密码: ', true)) throw new Error('两次密码不一致');
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  const result = await initializeAdmin({ username, password });
  console.log(`管理员 ${result.username} 初始化成功。请使用该账号登录后台。`);
}
main().catch(error => { console.error(error.code === 11000 ? '账号已存在或已被另一初始化进程创建' : error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
