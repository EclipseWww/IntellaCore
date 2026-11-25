// 收到终止信号时：停止接收新请求、关闭数据库连接后退出。
// SSE 等长连接可能让 server.close 迟迟不结束，超时后强制退出，避免 docker stop 卡满等待时间。
function createShutdown({ server, closeDatabase, exit = code => process.exit(code), timeoutMs = 8000, log = console }) {
  let shuttingDown = false;
  return function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.log(`收到 ${signal} 信号，正在优雅关闭...`);
    const timer = setTimeout(() => {
      log.warn('关闭超时，强制退出');
      exit(0);
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    server.close(async () => {
      log.log('HTTP 服务器已关闭');
      try {
        await closeDatabase();
        log.log('MongoDB 连接已关闭');
      } catch (error) {
        log.error('关闭 MongoDB 连接失败:', error.message);
      }
      clearTimeout(timer);
      exit(0);
    });
    // Node 18.2+ 可主动断开空闲的 keep-alive 连接，加快关闭
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  };
}

module.exports = { createShutdown };
