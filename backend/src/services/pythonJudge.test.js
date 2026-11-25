const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const judge = require('./pythonJudge');

const frontendRunnerDir = path.join(__dirname, '../../../frontend/public/libs/python-runner');

test('harness 与 turtle 模拟模块在前后端保持一致', { skip: !fs.existsSync(frontendRunnerDir) && '仓库中没有前端目录' }, () => {
  for (const file of ['harness.py', 'turtle.py']) {
    assert.equal(
      fs.readFileSync(path.join(frontendRunnerDir, file), 'utf8'),
      fs.readFileSync(path.join(__dirname, 'pythonJudge', file), 'utf8'),
      `${file} 前后端不一致`
    );
  }
});

test('输出比较忽略行尾空白、首尾空行与 Windows 换行', () => {
  assert.equal(judge.normalizeOutput('1  \r\n2\t\r\n\r\n'), '1\n2');
  assert.equal(judge.normalizeOutput(null), '');
  assert.notEqual(judge.normalizeOutput('1 2'), judge.normalizeOutput('12'));
});

test('只有支持权限模型的 Node 版本才启用服务器判题', () => {
  assert.equal(judge.permissionFlag('16.20.0'), null);
  assert.equal(judge.permissionFlag('20.18.0'), null);
  assert.equal(judge.permissionFlag('22.12.0'), null);
  assert.equal(judge.permissionFlag('22.13.0'), '--permission');
  assert.equal(judge.permissionFlag('23.5.0'), '--permission');
  assert.equal(judge.permissionFlag('24.0.0'), '--permission');
});

test('测试点结果区分 AC / WA / RE / TLE / OLE', () => {
  const tc = { expectedOutput: '3\n' };
  assert.equal(judge.caseResult(0, tc, { stdout: '3  \n' }).status, 'AC');
  assert.equal(judge.caseResult(0, tc, { stdout: '4' }).status, 'WA');
  const re = judge.caseResult(0, tc, { stdout: '', error: { type: 'ValueError', message: 'bad', line: 2 } });
  assert.deepEqual([re.status, re.errorType, re.errorLine, re.error], ['RE', 'ValueError', 2, 'ValueError: bad']);
  assert.equal(judge.caseResult(0, tc, { timeout: true }).status, 'TLE');
  assert.equal(judge.caseResult(0, tc, { stdout: '3', truncated: true }).status, 'OLE');
  assert.equal(judge.caseResult(0, { isHidden: true, expectedOutput: '' }, { stdout: '' }).isHidden, true);
});

const reason = judge.unavailableReason();

test('服务器判题：多行输入、中文、隐藏测试点、运行错误与超时', { skip: reason || false, timeout: 60000 }, async t => {
  t.after(() => judge.shutdown());
  const originalTimeout = judge.config.timeoutMs;
  judge.config.timeoutMs = 1500;
  t.after(() => { judge.config.timeoutMs = originalTimeout; });

  const code = 'n = int(input("个数"))\nfor i in range(n):\n    print(i)\nprint("你好", input())';
  const result = await judge.judge(code, [
    { input: '2\n小明', expectedOutput: '0\n1\n你好 小明' },
    { input: '1\r\n小红\r\n', expectedOutput: '0\n你好 小红', isHidden: true },
    { input: 'x', expectedOutput: '' }
  ]);
  assert.deepEqual(result.results.map(r => r.status), ['AC', 'AC', 'RE']);
  assert.equal(result.results[2].errorType, 'ValueError');
  assert.equal(result.results[2].errorLine, 1);
  assert.deepEqual([result.passedCount, result.totalCount, result.score], [2, 3, 7]);

  // global 与函数内 input()：原先包进函数、正则替换的做法会出错
  const globals = await judge.judge('total = 0\ndef add():\n    global total\n    total += int(input())\nadd()\nadd()\nprint(total)', [
    { input: '3\n4', expectedOutput: '7' }
  ]);
  assert.equal(globals.results[0].status, 'AC');

  const loop = await judge.judge('while True:\n    pass', [{ expectedOutput: '' }, { expectedOutput: '' }, { expectedOutput: '' }]);
  assert.deepEqual(loop.results.map(r => r.status), ['TLE', 'TLE', 'TLE']);
  assert.match(loop.results[2].error, /未运行/);
});

test('服务器判题沙箱：无法访问 JS 宿主、文件系统与 eval', { skip: reason || false, timeout: 60000 }, async t => {
  t.after(() => judge.shutdown());
  const probe = `
results = []
for name, snippet in [
    ('js', 'import js'),
    ('pyodide_js', 'import pyodide_js'),
    ('file', 'open("/etc/hostname").read()'),
    ('eval', 'from pyodide.ffi import to_js\\nto_js({}).constructor.constructor("return 1")()'),
]:
    try:
        exec(snippet)
        results.append(name + ':open')
    except BaseException as e:
        results.append(name + ':blocked')
print(' '.join(results))`;
  const result = await judge.judge(probe, [{ expectedOutput: 'js:blocked pyodide_js:blocked file:blocked eval:blocked' }]);
  assert.equal(result.results[0].actualOutput, 'js:blocked pyodide_js:blocked file:blocked eval:blocked');
});
