import { normalizeOutput } from './pythonRunner';

const show = text => (text === undefined ? '（没有这一行）' : `"${text}"`);

/**
 * 逐行比较预期输出与实际输出，找出第一处不同并给出易懂的提示。
 * @returns {{ lines: Array<{text, ok}>, firstDiff: number|null, hint: string|null }}
 *   lines 为实际输出的每一行及是否与预期一致；firstDiff 为第一处不同的行号（从 1 开始）
 */
export function diffOutput(expected, actual) {
    const expectedLines = normalizeOutput(expected).split('\n');
    const actualText = normalizeOutput(actual);
    const actualLines = actualText === '' ? [] : actualText.split('\n');
    const lines = actualLines.map((text, i) => ({ text, ok: text === expectedLines[i] }));

    let firstDiff = null;
    const total = Math.max(expectedLines.length, actualLines.length);
    for (let i = 0; i < total; i++) {
        if (expectedLines[i] !== actualLines[i]) {
            firstDiff = i + 1;
            break;
        }
    }
    if (firstDiff === null) return { lines, firstDiff, hint: null };

    const want = expectedLines[firstDiff - 1];
    const got = actualLines[firstDiff - 1];
    let hint;
    if (actualLines.length === 0) {
        hint = '程序没有输出任何内容';
    } else if (got === undefined) {
        hint = `输出少了：从第 ${firstDiff} 行开始缺少 ${show(want)}`;
    } else if (want === undefined) {
        hint = `输出多了：第 ${firstDiff} 行多出 ${show(got)}`;
    } else if (want.replace(/\s+/g, '') === got.replace(/\s+/g, '')) {
        hint = `第 ${firstDiff} 行空格不一致：应为 ${show(want)}，实际为 ${show(got)}`;
    } else if (want.toLowerCase() === got.toLowerCase()) {
        hint = `第 ${firstDiff} 行大小写不一致：应为 ${show(want)}，实际为 ${show(got)}`;
    } else if (/[，。：；（）！？]/.test(got) !== /[，。：；（）！？]/.test(want)) {
        hint = `第 ${firstDiff} 行标点不一致（注意中英文标点）：应为 ${show(want)}，实际为 ${show(got)}`;
    } else {
        hint = `第 ${firstDiff} 行不一致：应为 ${show(want)}，实际为 ${show(got)}`;
    }
    return { lines, firstDiff, hint };
}

export const STATUS_LABELS = {
    AC: { text: '通过', color: 'success' },
    WA: { text: '答案错误', color: 'error' },
    RE: { text: '运行错误', color: 'volcano' },
    TLE: { text: '运行超时', color: 'orange' },
    OLE: { text: '输出超限', color: 'magenta' }
};

/** 兼容旧数据：没有 status 字段时按 passed / error 推断 */
export function statusOf(result) {
    if (!result) return null;
    if (result.status) return result.status;
    if (result.passed) return 'AC';
    if (result.error && /超时/.test(result.error)) return 'TLE';
    return result.error ? 'RE' : 'WA';
}

/** 从 "ValueError: xxx" 形式的错误串中取出错误类型 */
export function errorTypeOf(result) {
    if (result?.errorType) return result.errorType;
    const match = /^(\w+(?:Error|Exception))\b/.exec(result?.error || '');
    return match ? match[1] : null;
}
