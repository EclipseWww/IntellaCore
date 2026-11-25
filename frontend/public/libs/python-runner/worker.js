/* eslint-disable no-restricted-globals */
/**
 * Python 运行 Web Worker（经典 Worker，兼容较老的 Chromium 内核浏览器）。
 *
 * 在 Worker 里运行 Pyodide，死循环不会卡住页面：主线程可以随时 terminate() 后重建。
 * 消息协议（主线程 → Worker）：
 *   { type: 'run', id, code }            交互运行
 *   { type: 'input', id, value }         回应 input-request
 * Worker → 主线程：
 *   ready / init-error / stdout / turtle / input-request / done
 */
var VERSION_QUERY = self.location.search || '';
var PYODIDE_BASE = '/libs/pyodide/';
var RUNNER_BASE = '/libs/python-runner/';
var FLUSH_INTERVAL_MS = 50;
var STDOUT_FLUSH_CHARS = 4096;
var TURTLE_FLUSH_COUNT = 200;
var MAX_TURTLE_COMMANDS = 200000;
var INTERACTIVE_OUTPUT_LIMIT = 2 * 1024 * 1024;

importScripts(PYODIDE_BASE + 'pyodide.js');

var harness = null;
var current = null; // 当前交互运行的状态

function now() {
  return (self.performance && performance.now) ? performance.now() : Date.now();
}

function flush(force) {
  if (!current) return;
  var t = now();
  if (!force && t - current.lastFlush < FLUSH_INTERVAL_MS) return;
  current.lastFlush = t;
  if (current.stdout) {
    self.postMessage({ type: 'stdout', id: current.id, text: current.stdout });
    current.stdout = '';
  }
  if (current.turtle.length) {
    self.postMessage({ type: 'turtle', id: current.id, cmds: current.turtle });
    current.turtle = [];
  }
}

function write(text) {
  if (!current) return;
  current.stdout += text;
  if (current.stdout.length >= STDOUT_FLUSH_CHARS) flush(true);
  else flush(false);
}

function turtleCmd(cmd, argsJson) {
  if (!current || current.turtleCount >= MAX_TURTLE_COMMANDS) return;
  var args = {};
  try { args = JSON.parse(argsJson); } catch (e) { /* 忽略无效参数 */ }
  current.turtle.push({ cmd: cmd, args: args });
  current.turtleCount++;
  if (current.turtle.length >= TURTLE_FLUSH_COUNT) flush(true);
  else flush(false);
}

function requestInput(prompt) {
  flush(true);
  var run = current;
  return new Promise(function (resolve) {
    run.inputResolve = resolve;
    self.postMessage({ type: 'input-request', id: run.id, prompt: prompt });
  });
}

function toPlain(proxy) {
  var value = proxy.toJs({ dict_converter: Object.fromEntries });
  proxy.destroy();
  return value;
}

var ready = (async function init() {
  var pyodide = await loadPyodide({ indexURL: PYODIDE_BASE, stdLibURL: PYODIDE_BASE + 'python_stdlib.bin' });
  var files = ['harness.py', 'turtle.py'];
  for (var i = 0; i < files.length; i++) {
    var response = await fetch(RUNNER_BASE + files[i] + VERSION_QUERY);
    if (!response.ok) throw new Error('加载 ' + files[i] + ' 失败: ' + response.status);
    pyodide.FS.writeFile('/home/pyodide/' + (files[i] === 'harness.py' ? '_ic_harness.py' : files[i]), await response.text());
  }
  // 预先导入运行时会用到的模块，再记录干净状态
  await pyodide.runPythonAsync('import asyncio, ast, inspect, json, math, random');
  harness = pyodide.pyimport('_ic_harness');
  harness.bridge.turtle_cmd = turtleCmd;
  harness.snapshot();
  self.postMessage({ type: 'ready' });
})().catch(function (error) {
  self.postMessage({ type: 'init-error', message: String((error && error.message) || error) });
  throw error;
});

async function runInteractive(message) {
  current = { id: message.id, stdout: '', turtle: [], turtleCount: 0, lastFlush: now(), inputResolve: null };
  var result;
  try {
    result = toPlain(await harness.run_interactive(message.code, write, requestInput, INTERACTIVE_OUTPUT_LIMIT));
  } catch (error) {
    result = { error: { type: 'InternalError', message: String((error && error.message) || error) } };
  }
  flush(true);
  self.postMessage({ type: 'done', id: message.id, error: result.error || null, truncated: !!result.truncated });
  current = null;
}

self.onmessage = function (event) {
  var message = event.data || {};
  if (message.type === 'input') {
    if (current && current.id === message.id && current.inputResolve) {
      var resolve = current.inputResolve;
      current.inputResolve = null;
      resolve(String(message.value == null ? '' : message.value));
    }
    return;
  }
  ready.then(function () {
    if (message.type === 'run') return runInteractive(message);
    return undefined;
  });
};
