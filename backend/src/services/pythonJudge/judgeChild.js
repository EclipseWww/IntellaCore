'use strict';

/**
 * Python 判题子进程（由 ./index.js 以 Node 权限模型 fork）。
 *
 * 隔离措施（父进程负责启动参数）：
 *   --permission：只能读取 pyodide 目录与本目录，不能写文件、不能创建子进程或 Worker
 *   --disallow-code-generation-from-strings：禁止 eval / new Function，堵住从 Python 经 JS FFI 执行任意 JS 的路径
 *   --wasm-max-mem-pages：限制 Python 可用内存；env 为空对象，读不到服务器密钥
 * 加载完成后再移除 Python 侧的 js / pyodide_js 模块和 JS 全局的 process、fetch 等对象。
 *
 * 每个进程只服务一次提交（父进程用完即杀），不同学生之间不共享解释器状态。
 */

const fs = require('fs');
const path = require('path');

const proc = process;
const send = message => proc.connected && proc.send(message);
proc.on('disconnect', () => proc.exit(0));

const pyodideDir = proc.argv[2];

// Emscripten 初始化时会调用 process.binding('constants')，权限模型下该调用被拒绝，这里只提供所需常量
const originalBinding = proc.binding;
proc.binding = name => {
  if (name === 'constants') return { fs: fs.constants, os: require('os').constants };
  return originalBinding.call(proc, name);
};

const HIDDEN_GLOBALS = [
  'process', 'fetch', 'Request', 'Response', 'Headers', 'FormData', 'WebSocket', 'EventSource',
  'XMLHttpRequest', 'BroadcastChannel', 'MessageChannel', 'MessagePort', 'Worker', 'navigator'
];

async function main() {
  const { loadPyodide } = require(path.join(pyodideDir, 'pyodide.js'));
  const pyodide = await loadPyodide({
    indexURL: pyodideDir.endsWith(path.sep) ? pyodideDir : pyodideDir + path.sep,
    stdout: () => {},
    stderr: () => {}
  });
  pyodide.FS.writeFile('/home/pyodide/_ic_harness.py', fs.readFileSync(path.join(__dirname, 'harness.py'), 'utf8'));
  pyodide.FS.writeFile('/home/pyodide/turtle.py', fs.readFileSync(path.join(__dirname, 'turtle.py'), 'utf8'));

  const harness = pyodide.pyimport('_ic_harness');
  const runJudge = harness.run_judge;

  pyodide.unregisterJsModule('js');
  pyodide.unregisterJsModule('pyodide_js');
  pyodide.runPython("import sys\nfor _m in ('js', 'pyodide_js'):\n    sys.modules.pop(_m, None)");
  harness.snapshot();
  for (const name of HIDDEN_GLOBALS) {
    try { delete globalThis[name]; } catch { /* 不可删除的属性忽略 */ }
  }

  proc.on('message', message => {
    if (!message || message.type !== 'run') return;
    const started = performance.now();
    let result;
    let fatal = false;
    try {
      const proxy = runJudge(String(message.code ?? ''), String(message.input ?? ''), message.outputLimit);
      result = proxy.toJs({ dict_converter: Object.fromEntries });
      proxy.destroy();
    } catch (error) {
      // Python 异常都在 harness 内部处理；走到这里说明解释器本身崩溃（栈溢出、内存耗尽等）
      fatal = true;
      result = { stdout: '', truncated: false, error: { type: 'Crash', message: String(error?.message || error).slice(0, 500) } };
    }
    send({ type: 'result', id: message.id, ...result, timeMs: Math.round(performance.now() - started) });
    if (fatal) setImmediate(() => proc.exit(1));
  });
  send({ type: 'ready' });
}

main().catch(error => {
  send({ type: 'fatal', message: String(error?.stack || error).slice(0, 2000) });
  setImmediate(() => proc.exit(1));
});
