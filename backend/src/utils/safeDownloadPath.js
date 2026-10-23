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

module.exports = { safeDownloadPath };
