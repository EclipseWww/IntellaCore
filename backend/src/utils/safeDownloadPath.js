const path = require('path');
const fs = require('fs/promises');

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function safeDownloadPath(root, requestedPath) {
  if (typeof requestedPath !== 'string' || requestedPath.includes('\0') ||
      path.posix.isAbsolute(requestedPath) || path.win32.isAbsolute(requestedPath)) {
    throw Object.assign(new Error('无效的文件路径'), { status: 403 });
  }
  // Treat both separators consistently even when the server runs on Linux.
  const target = path.resolve(root, requestedPath.replace(/\\/g, '/'));
  if (!contained(path.resolve(root), target)) throw Object.assign(new Error('无权访问此文件'), { status: 403 });
  const [realRoot, realTarget] = await Promise.all([fs.realpath(root), fs.realpath(target)]);
  if (!contained(realRoot, realTarget)) throw Object.assign(new Error('无权访问此文件'), { status: 403 });
  return realTarget;
}

// 单个路径段（如 courseId、filename）不得为 . / .. 或包含分隔符、空字符，防止拼路径时越出目录
function isSafePathSegment(value) {
  return typeof value === 'string' && value !== '' && value !== '.' && value !== '..' && !/[\\/\0]/.test(value);
}

// 用于 router.param：参数不安全时直接 400，避免进入 multer 建目录或删除文件
function guardPathParams(router, names) {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (!isSafePathSegment(value)) return res.status(400).json({ message: '无效的路径参数' });
      next();
    });
  }
}

module.exports = { safeDownloadPath, isSafePathSegment, guardPathParams };
