/**
 * Python 运行器（主线程侧）
 *
 * 全页面共用一个 Web Worker（public/libs/python-runner/worker.js）运行 Pyodide。
 * 死循环或点“停止”时直接结束 Worker 并在后台重建，页面不会卡死。
 */

// 修改 public/libs/python-runner 下的文件后递增，避免浏览器缓存旧版本
const RUNNER_VERSION = '1';
const WORKER_URL = `/libs/python-runner/worker.js?v=${RUNNER_VERSION}`;
export const DEFAULT_TEST_TIMEOUT_MS = 5000;

/** 与服务器判题一致：去掉每行行尾空白与首尾空行，兼容 Windows 换行 */
export function normalizeOutput(text) {
    return String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .trim();
}

class PythonRunner {
    constructor() {
        this.worker = null;
        this.status = 'idle'; // idle | loading | ready | error
        this.error = null;
        this.listeners = new Set();
        this.readyPromise = null;
        this.task = null; // 当前任务 { id, kind, resolve, handlers }
        this.nextId = 1;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.status, this.error);
        return () => this.listeners.delete(listener);
    }

    setStatus(status, error = null) {
        this.status = status;
        this.error = error;
        this.listeners.forEach(listener => listener(status, error));
    }

    /** 启动（或复用）Worker，返回加载完成的 Promise */
    ensure() {
        if (this.readyPromise && this.status !== 'error') return this.readyPromise;
        this.spawn();
        return this.readyPromise;
    }

    spawn() {
        if (typeof Worker === 'undefined') {
            this.setStatus('error', '当前浏览器不支持 Web Worker，无法运行 Python');
            this.readyPromise = Promise.reject(new Error(this.error));
            this.readyPromise.catch(() => {});
            return;
        }
        const worker = new Worker(WORKER_URL);
        this.worker = worker;
        this.setStatus('loading');
        this.readyPromise = new Promise((resolve, reject) => {
            worker.onmessage = event => {
                const message = event.data || {};
                if (message.type === 'ready') {
                    this.setStatus('ready');
                    resolve();
                } else if (message.type === 'init-error') {
                    this.setStatus('error', `加载 Python 运行环境失败：${message.message}`);
                    reject(new Error(message.message));
                } else {
                    this.handleMessage(message);
                }
            };
            worker.onerror = event => {
                if (this.status === 'loading') {
                    this.setStatus('error', `加载 Python 运行环境失败：${event.message || '未知错误'}`);
                    reject(new Error(event.message));
                } else if (this.task && this.worker === worker) {
                    this.crash(event.message);
                }
            };
        });
        this.readyPromise.catch(() => {});
    }

    handleMessage(message) {
        const task = this.task;
        if (!task || message.id !== task.id) return;
        const handlers = task.handlers || {};
        switch (message.type) {
            case 'stdout':
                handlers.onStdout?.(message.text);
                break;
            case 'turtle':
                handlers.onTurtle?.(message.cmds);
                break;
            case 'input-request':
                handlers.onInputRequest?.(message.prompt);
                break;
            case 'done':
            case 'test-result': {
                this.finish(message);
                // 解释器崩溃后无法继续使用，重建 Worker
                const type = message.error?.type;
                if (type === 'InternalError' || type === 'Crash') this.restart();
                break;
            }
            default:
                break;
        }
    }

    finish(result) {
        const task = this.task;
        if (!task) return;
        this.task = null;
        clearTimeout(task.timer);
        task.resolve(result);
    }

    crash(reason) {
        const message = `Python 运行环境崩溃（可能是递归太深或占用内存过多）${reason ? `：${reason}` : ''}`;
        this.finish({ type: 'done', error: { type: 'Crash', message }, stdout: '' });
        this.restart();
    }

    /** 结束 Worker 并在后台重建（用于停止死循环） */
    restart() {
        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.readyPromise = null;
        this.spawn();
    }

    get busy() {
        return !!this.task;
    }

    /**
     * 交互运行。handlers: onStdout(text) / onTurtle(cmds) / onInputRequest(prompt)
     * @returns {Promise<{error, truncated, stopped}>}
     */
    async run(code, handlers = {}) {
        if (this.task) this.stop();
        await this.ensure();
        const id = this.nextId++;
        return new Promise(resolve => {
            this.task = { id, kind: 'run', resolve, handlers };
            this.worker.postMessage({ type: 'run', id, code });
        });
    }

    sendInput(value) {
        if (this.task?.kind === 'run') {
            this.worker.postMessage({ type: 'input', id: this.task.id, value });
        }
    }

    /** 停止当前运行：结束 Worker，当前任务以 stopped 结束 */
    stop() {
        if (!this.task) return;
        const task = this.task;
        this.task = null;
        clearTimeout(task.timer);
        this.restart();
        task.resolve({ stopped: true, error: null });
    }

    /** 以给定输入运行一次，超时则重启 Worker */
    async runOnce(code, input, timeoutMs = DEFAULT_TEST_TIMEOUT_MS) {
        if (this.task) this.stop();
        await this.ensure();
        const id = this.nextId++;
        return new Promise(resolve => {
            const task = { id, kind: 'test', resolve };
            task.timer = setTimeout(() => {
                if (this.task !== task) return;
                this.task = null;
                this.restart();
                resolve({ timeout: true });
            }, timeoutMs);
            this.task = task;
            this.worker.postMessage({ type: 'test', id, code, input });
        });
    }

    /**
     * 用公开测试点自测（结果仅供参考，正式成绩以服务器判题为准）。
     * @returns {Promise<Array<{index, status, passed, actualOutput, expectedOutput, input, error, timeMs}>>}
     */
    async runTests(code, testCases, { timeoutMs = DEFAULT_TEST_TIMEOUT_MS, onProgress } = {}) {
        const results = [];
        for (const [index, testCase] of testCases.entries()) {
            const run = await this.runOnce(code, testCase.input || '', timeoutMs);
            const base = { index, input: testCase.input || '', expectedOutput: testCase.expectedOutput || '', timeMs: run.timeMs ?? null };
            let result;
            if (run.timeout) {
                result = { ...base, status: 'TLE', passed: false, actualOutput: '', error: `运行超时（超过 ${timeoutMs / 1000} 秒），可能存在死循环` };
            } else if (run.error) {
                result = { ...base, status: 'RE', passed: false, actualOutput: normalizeOutput(run.stdout), errorInfo: run.error };
            } else if (run.truncated) {
                result = { ...base, status: 'OLE', passed: false, actualOutput: normalizeOutput(run.stdout), error: '输出内容过多，超过限制' };
            } else {
                const actual = normalizeOutput(run.stdout);
                const passed = actual === normalizeOutput(testCase.expectedOutput);
                result = { ...base, status: passed ? 'AC' : 'WA', passed, actualOutput: actual };
            }
            results.push(result);
            onProgress?.(results.slice());
        }
        return results;
    }
}

export const pythonRunner = new PythonRunner();
export default pythonRunner;
