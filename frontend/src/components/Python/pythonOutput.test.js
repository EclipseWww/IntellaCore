import { diffOutput, statusOf, errorTypeOf } from './outputDiff';
import { normalizeOutput } from './pythonRunner';
import { formatPythonError } from './pythonErrorTranslator';
import { describeResultError } from './TestResultList';
import { buildClassStats } from '../../pages/teacher/components/review/PythonClassStats';

test('normalizeOutput matches the server comparison rules', () => {
    expect(normalizeOutput('1  \r\n2\t\r\n\r\n')).toBe('1\n2');
    expect(normalizeOutput(undefined)).toBe('');
});

test('diffOutput points at the first differing line with a helpful hint', () => {
    expect(diffOutput('1\n2', '1\n2 ').firstDiff).toBeNull();
    expect(diffOutput('a b', 'ab').hint).toMatch(/空格不一致/);
    expect(diffOutput('Hello', 'hello').hint).toMatch(/大小写不一致/);
    expect(diffOutput('1\n2\n3', '1\n2').hint).toMatch(/输出少了：从第 3 行/);
    expect(diffOutput('1', '1\n2').hint).toMatch(/输出多了/);
    expect(diffOutput('1', '').hint).toBe('程序没有输出任何内容');
    const { lines } = diffOutput('1\n2', '1\n3');
    expect(lines.map(line => line.ok)).toEqual([true, false]);
});

test('statusOf and errorTypeOf understand legacy results', () => {
    expect(statusOf({ passed: true })).toBe('AC');
    expect(statusOf({ passed: false, error: '代码执行超时（超过8秒）' })).toBe('TLE');
    expect(statusOf({ passed: false })).toBe('WA');
    expect(statusOf({ status: 'OLE' })).toBe('OLE');
    expect(errorTypeOf({ error: "NameError: name 'x' is not defined" })).toBe('NameError');
});

test('formatPythonError shows line, translated reason and Chinese punctuation hints', () => {
    const text = formatPythonError({ type: 'SyntaxError', message: "invalid character '（' (U+FF08)", line: 2, text: 'print（"你好，世界"）' });
    expect(text).toMatch(/第 2 行：语法错误/);
    expect(text).toMatch(/（ → \(/);
    // 字符串里的中文逗号不算
    expect(text).not.toMatch(/， → ,/);
    expect(formatPythonError({ type: 'NameError', message: "name 'x' is not defined", line: 5 })).toMatch(/变量 'x' 未定义/);
});

test('describeResultError formats server results', () => {
    expect(describeResultError({ error: 'ZeroDivisionError: division by zero', errorType: 'ZeroDivisionError', errorLine: 3 }))
        .toMatch(/第 3 行：除零错误/);
    expect(describeResultError({ error: '运行超时（超过 5 秒）' })).toBe('❌ 运行超时（超过 5 秒）');
    expect(describeResultError({})).toBeNull();
});

test('buildClassStats aggregates pass rates and counts each error type once per student', () => {
    const submissions = [
        { attempts: [{}, {}], testResults: { passedCount: 2, totalCount: 2, results: [{ index: 0, status: 'AC' }, { index: 1, status: 'AC' }] } },
        { attempts: [{}], testResults: { passedCount: 0, totalCount: 2, results: [
            { index: 0, status: 'RE', errorType: 'ValueError' }, { index: 1, status: 'RE', errorType: 'ValueError' }
        ] } },
        { attempts: [], testResults: { totalCount: 0, results: [] } }
    ];
    const stats = buildClassStats(submissions, [{}, { isHidden: true }]);
    expect(stats.judgedCount).toBe(2);
    expect(stats.fullMarks).toBe(1);
    expect(stats.averageAttempts).toBe(1);
    expect(stats.cases[0]).toMatchObject({ total: 2, statuses: { AC: 1, RE: 1 } });
    expect(stats.cases[1].isHidden).toBe(true);
    expect(stats.errors).toEqual([{ type: 'ValueError', count: 1 }]);
});
