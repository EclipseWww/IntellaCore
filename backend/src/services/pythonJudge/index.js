'use strict';

/**
 * 服务器端 Python 判题。
 *
 * 每次提交占用一个判题槽位（并发数 PYTHON_JUDGE_WORKERS，默认 2），在独立的受限子进程中逐个运行测试点。
 * 单个测试点超时（PYTHON_JUDGE_TIMEOUT_MS，默认 5000ms）直接杀掉子进程并换新进程继续。
 * 进程预先启动备用，一次提交用完即销毁，学生之间不共享解释器状态。
 */

const { fork } = require('child_process');
const path = require('path');

const CHILD_SCRIPT = path.join(__dirname, 'judgeChild.js');
const MAX_TIMEOUTS_PER_JOB = 2;
const STORED_OUTPUT_LIMIT = 2000;

const intFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const config = {
  workers: intFromEnv('PYTHON_JUDGE_WORKERS', 2),
  timeoutMs: intFromEnv('PYTHON_JUDGE_TIMEOUT_MS', 5000),
  memoryMb: intFromEnv('PYTHON_JUDGE_MEMORY_MB', 512),
  maxQueue: intFromEnv('PYTHON_JUDGE_MAX_QUEUE', 200),
  startupTimeoutMs: 30000,
  outputLimit: 65536,
  idleShutdownMs: 10 * 60 * 1000
};

class JudgeUnavailableError extends Error {
  constructor(message) { super(message); this.name = 'JudgeUnavailableError'; }
}

class JudgeBusyError extends Error {
  constructor(message) { super(message); this.name = 'JudgeBusyError'; }
}

// Node 权限模型（--permission）在 22.13 / 23.5 起稳定；更早的版本不启用服务器判题
function permissionFlag(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (major > 23 || (major === 23 && minor >= 5) || (major === 22 && minor >= 13)) return '--permission';
  return null;
}

function resolvePyodideDir() {
  try {
    return path.dirname(require.resolve('pyodide/package.json'));
  } catch {
    return null;
  }
}

const pyodideDir = resolvePyodideDir();

function unavailableReason() {
  if (!permissionFlag()) return `服务器判题需要 Node.js 22.13 及以上版本（当前 ${process.versions.node}）`;
  if (!pyodideDir) return '服务器未安装 pyodide 依赖';
  return null;
}

class JudgeProcess {
  constructor() {
    const execArgv = [
      permissionFlag(),
      `--allow-fs-read=${pyodideDir}`,
      `--allow-fs-read=${__dirname}`,
      '--disallow-code-generation-from-strings',
      `--wasm-max-mem-pages=${Math.max(256, Math.floor(config.memoryMb * 16))}`,
      '--max-old-space-size=256'
    ];
    this.stderr = '';
    this.exited = false;
    this.child = fork(CHILD_SCRIPT, [pyodideDir], {
      execArgv,
      env: {},
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      serialization: 'json'
    });
    this.child.stderr.on('data', chunk => {
      if (this.stderr.length < 4000) this.stderr += chunk.toString();
    });
    this.child.on('error', () => {});
    this.waiter = null;
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.kill();
        reject(new JudgeUnavailableError('判题进程启动超时'));
      }, config.startupTimeoutMs);
      this.child.on('message', message => {
        if (message?.type === 'ready') {
          clearTimeout(timer);
          resolve();
        } else if (message?.type === 'fatal') {
          clearTimeout(timer);
          reject(new JudgeUnavailableError(`判题进程启动失败: ${message.message}`));
        } else if (message?.type === 'result' && this.waiter && message.id === this.waiter.id) {
          this.waiter.resolve(message);
        }
      });
      this.child.on('exit', code => {
        this.exited = true;
        clearTimeout(timer);
        reject(new JudgeUnavailableError(`判题进程异常退出(${code}) ${this.stderr.slice(0, 500)}`));
        if (this.waiter) this.waiter.resolve({ crashed: true });
      });
    });
    this.ready.catch(() => {});
    this.nextId = 1;
  }

  run({ code, input, timeoutMs = config.timeoutMs }) {
    if (this.exited) return Promise.resolve({ crashed: true });
    const id = this.nextId++;
    return new Promise(resolve => {
      const timer = setTimeout(() => finish({ timeout: true }), timeoutMs);
      const finish = result => {
        clearTimeout(timer);
        this.waiter = null;
        resolve(result);
      };
      this.waiter = { id, resolve: finish };
      this.child.send({ type: 'run', id, code, input, outputLimit: config.outputLimit });
    });
  }

  kill() {
    if (!this.exited) this.child.kill('SIGKILL');
  }
}

// ---------------------------------------------------------------- 进程池

const spare = [];
const waiting = [];
let active = 0;
let idleTimer = null;
let disabledUntil = 0;

function refill() {
  while (spare.length < config.workers) spare.push(new JudgeProcess());
}

function scheduleIdleShutdown() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (active > 0) return;
    while (spare.length) spare.pop().kill();
  }, config.idleShutdownMs);
  idleTimer.unref?.();
}

async function takeProcess() {
  const proc = spare.shift() || new JudgeProcess();
  refill();
  try {
    await proc.ready;
    return proc;
  } catch (error) {
    // 启动失败通常是环境问题（依赖缺失等），暂停一分钟避免反复拉起
    disabledUntil = Date.now() + 60 * 1000;
    while (spare.length) spare.pop().kill();
    throw error;
  }
}

function acquireSlot() {
  if (active < config.workers) {
    active++;
    return Promise.resolve();
  }
  if (waiting.length >= config.maxQueue) {
    return Promise.reject(new JudgeBusyError('判题队列已满，请稍后再提交'));
  }
  return new Promise(resolve => waiting.push(resolve));
}

function releaseSlot() {
  const next = waiting.shift();
  if (next) next();
  else active--;
  scheduleIdleShutdown();
}

// ---------------------------------------------------------------- 结果比较

/** 去掉每行行尾空白与首尾空行后比较；兼容 Windows 换行 */
function normalizeOutput(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

function truncate(text, limit = STORED_OUTPUT_LIMIT) {
  return text.length > limit ? `${text.slice(0, limit)}\n…（输出过长，已截断）` : text;
}

function caseResult(index, testCase, run) {
  const base = { index, isHidden: !!testCase.isHidden, timeMs: run.timeMs ?? null };
  if (run.skipped) {
    return { ...base, passed: false, status: 'TLE', actualOutput: '', error: '前面的测试点已超时，本测试点未运行' };
  }
  if (run.timeout) {
    return { ...base, passed: false, status: 'TLE', actualOutput: '', error: `运行超时（超过 ${config.timeoutMs / 1000} 秒），可能存在死循环`, timeMs: config.timeoutMs };
  }
  if (run.crashed || run.error?.type === 'Crash') {
    return { ...base, passed: false, status: 'RE', actualOutput: '', error: '程序崩溃（可能是递归太深或占用内存过多）', errorType: 'Crash' };
  }
  const actual = normalizeOutput(run.stdout);
  const result = { ...base, actualOutput: truncate(actual) };
  if (run.error) {
    result.passed = false;
    result.status = 'RE';
    result.errorType = run.error.type;
    result.errorLine = run.error.line ?? null;
    result.error = `${run.error.type}: ${run.error.message}`;
    return result;
  }
  if (run.truncated) {
    return { ...result, passed: false, status: 'OLE', error: '输出内容过多，超过限制' };
  }
  result.passed = actual === normalizeOutput(testCase.expectedOutput);
  result.status = result.passed ? 'AC' : 'WA';
  return result;
}

function summarize(results) {
  const totalCount = results.length;
  const passedCount = results.filter(r => r.passed).length;
  return {
    results,
    passedCount,
    totalCount,
    score: totalCount > 0 ? Math.round((passedCount / totalCount) * 10) : null
  };
}

/**
 * 运行全部测试点。
 * @returns {Promise<{results, passedCount, totalCount, score}>}
 * @throws JudgeUnavailableError 服务器无法判题；JudgeBusyError 队列已满
 */
async function judge(code, testCases) {
  const reason = unavailableReason();
  if (reason) throw new JudgeUnavailableError(reason);
  if (Date.now() < disabledUntil) throw new JudgeUnavailableError('判题服务暂时不可用');
  if (!testCases.length) return summarize([]);

  await acquireSlot();
  let proc = null;
  try {
    const results = [];
    let timeouts = 0;
    for (const [index, testCase] of testCases.entries()) {
      if (timeouts >= MAX_TIMEOUTS_PER_JOB) {
        results.push(caseResult(index, testCase, { skipped: true }));
        continue;
      }
      if (!proc) proc = await takeProcess();
      const run = await proc.run({ code, input: testCase.input || '' });
      if (run.timeout || run.crashed || run.error?.type === 'Crash') {
        if (run.timeout) timeouts++;
        proc.kill();
        proc = null;
      }
      results.push(caseResult(index, testCase, run));
    }
    return summarize(results);
  } finally {
    proc?.kill();
    releaseSlot();
  }
}

function shutdown() {
  clearTimeout(idleTimer);
  while (spare.length) spare.pop().kill();
}

module.exports = {
  judge,
  shutdown,
  normalizeOutput,
  caseResult,
  permissionFlag,
  unavailableReason,
  JudgeUnavailableError,
  JudgeBusyError,
  config
};
