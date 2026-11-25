import React from 'react';
import { Alert, Collapse, Space, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { diffOutput, STATUS_LABELS, statusOf } from './outputDiff';
import { formatPythonError, translatePythonError } from './pythonErrorTranslator';

const monoStyle = { fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 };
const preStyle = (background, border) => ({
    background,
    padding: 8,
    margin: '4px 0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    borderLeft: border ? `3px solid ${border}` : undefined,
    maxHeight: 240,
    overflow: 'auto'
});

/** 测试点的错误信息：浏览器自测带结构化 errorInfo，服务器结果为 "类型: 信息" 字符串 */
export function describeResultError(result) {
    if (result.errorInfo) return formatPythonError(result.errorInfo);
    if (!result.error) return null;
    if (result.errorType && result.errorType !== 'Crash') {
        const message = result.error.replace(new RegExp(`^${result.errorType}:\\s*`), '');
        return formatPythonError({ type: result.errorType, message, line: result.errorLine });
    }
    if (/Error|Exception/.test(result.error) && !/[一-龥]/.test(result.error)) return `❌ ${translatePythonError(result.error)}`;
    return `❌ ${result.error}`;
}

const ActualOutput = ({ result, expected, showDiff }) => {
    const passed = statusOf(result) === 'AC';
    if (!showDiff || passed || statusOf(result) !== 'WA') {
        return (
            <pre style={preStyle(passed ? '#f6ffed' : '#fff2f0', passed ? '#52c41a' : '#ff4d4f')}>
                {result.actualOutput || '(无输出)'}
            </pre>
        );
    }
    const { lines, hint } = diffOutput(expected, result.actualOutput);
    return (
        <>
            <pre style={preStyle('#fff2f0', '#ff4d4f')}>
                {lines.length === 0 ? '(无输出)' : lines.map((line, i) => (
                    <div key={i} style={line.ok ? undefined : { background: '#ffccc7' }}>{line.text || ' '}</div>
                ))}
            </pre>
            {hint && <div style={{ color: '#cf1322', marginTop: 4 }}>💡 {hint}</div>}
        </>
    );
};

/**
 * 测评结果列表
 * @param results      结果数组，每项含 index（对应 testCases 下标）
 * @param testCases    当前活动的测试点（学生端隐藏测试点只有占位）
 * @param revealHidden 教师端：显示隐藏测试点的输入与预期输出
 * @param labelPrefix  测试点名称前缀
 */
const TestResultList = ({ results = [], testCases = [], revealHidden = false, labelPrefix = '测试点' }) => (
    <Collapse size="small">
        {results.map((result, idx) => {
            const caseIndex = result.index ?? idx;
            const testCase = testCases[caseIndex] || {};
            const status = statusOf(result);
            const label = STATUS_LABELS[status] || { text: status, color: 'default' };
            const isHidden = result.isHidden ?? testCase.isHidden;
            const showContent = !isHidden || revealHidden;
            const input = testCase.input ?? result.input ?? '';
            const expected = testCase.expectedOutput ?? result.expectedOutput ?? '';
            const errorText = describeResultError(result);
            return (
                <Collapse.Panel
                    key={idx}
                    header={
                        <Space>
                            {status === 'AC'
                                ? <CheckOutlined style={{ color: '#52c41a' }} />
                                : <CloseOutlined style={{ color: '#ff4d4f' }} />}
                            <span>{labelPrefix} {idx + 1}</span>
                            {isHidden && <Tag>隐藏</Tag>}
                            <Tag color={label.color}>{label.text}</Tag>
                            {result.timeMs != null && status !== 'TLE' && <span style={{ color: '#999', fontSize: 12 }}>{result.timeMs} ms</span>}
                        </Space>
                    }
                >
                    <div style={monoStyle}>
                        {!showContent && (
                            <Alert message="隐藏测试点：输入和预期输出不公开" type="info" showIcon style={{ marginBottom: 12 }} />
                        )}
                        {showContent && (
                            <>
                                <strong>输入：</strong>
                                <pre style={preStyle('#f5f5f5')}>{input || '(无输入)'}</pre>
                                <strong>预期输出：</strong>
                                <pre style={preStyle('#f6ffed', '#52c41a')}>{expected || '(无输出)'}</pre>
                            </>
                        )}
                        <strong>实际输出：</strong>
                        <ActualOutput result={result} expected={expected} showDiff={showContent} />
                        {errorText && (
                            <pre style={{ ...preStyle('#fff1f0', '#ff4d4f'), color: '#cf1322' }}>{errorText}</pre>
                        )}
                    </div>
                </Collapse.Panel>
            );
        })}
    </Collapse>
);

export default TestResultList;
