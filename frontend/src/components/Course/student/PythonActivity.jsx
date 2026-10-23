import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Space, message, Tag, Spin, Alert, Progress, Collapse } from 'antd';
import {
    SaveOutlined,
    SendOutlined,
    RollbackOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    TrophyOutlined,
    CheckOutlined,
    CloseOutlined
} from '@ant-design/icons';
import { pythonAPI } from '../../../services/api';
import PythonEditor from '../../Python/PythonEditor';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import './PythonActivity.css';

const { Panel } = Collapse;

/**
 * Python编程活动组件（学生端）
 * 支持OJ自动评测功能
 */
const PythonActivity = ({
    lessonId,
    activityId,
    pythonSettings = {},
    onSubmitSuccess
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [submission, setSubmission] = useState(null);
    const [code, setCode] = useState('');
    const [lastOutput, setLastOutput] = useState('');

    // 测评相关状态
    const [testResults, setTestResults] = useState(null);

    const editorRef = useRef(null);

    const {
        instructions = '',
        starterCode = '# 在这里编写你的Python代码\n',
        testCases = []
    } = pythonSettings;
    // 解码内容 helper function
    const decodeContent = (content) => {
        if (!content) return '';
        if (typeof content !== 'string') return content;
        if (content.startsWith('ENC:')) {
            try {
                return atob(content.substring(4));
            } catch (e) {
                console.error('解码失败:', e);
                return content;
            }
        }
        return content;
    };

    // 加载提交记录
    useEffect(() => {
        const fetchSubmission = async () => {
            try {
                setLoading(true);
                const response = await pythonAPI.getSubmission(lessonId, activityId);
                if (response.success && response.data) {
                    setSubmission(response.data);
                    setCode(response.data.code || starterCode);
                    setLastOutput(response.data.output || '');
                    // 加载保存的测评结果
                    if (response.data.testResults && response.data.testResults.totalCount > 0) {
                        setTestResults(response.data.testResults);
                    }
                } else {
                    setCode(starterCode);
                }
            } catch (error) {
                console.error('获取Python提交记录失败:', error);
                setCode(starterCode);
            } finally {
                setLoading(false);
            }
        };

        if (lessonId && activityId) {
            fetchSubmission();
        }
    }, [lessonId, activityId, starterCode]);

    // 处理代码变化
    const handleCodeChange = useCallback((newCode) => {
        setCode(newCode);
        // 代码变化时清除之前的测评结果
        setTestResults(null);
    }, []);

    // 处理执行完成
    const handleExecutionComplete = useCallback((output, hasError) => {
        setLastOutput(output);
    }, []);

    // 标准化输出：去除每行末尾空格，用于比较
    const normalizeOutput = (output) => {
        return output
            .split('\n')
            .map(line => line.trimEnd())  // 去除每行末尾空格
            .join('\n')
            .trim();  // 去除首尾空行
    };

    // 运行单个测试用例（带超时保护）
    const runSingleTest = async (testCase, pyodide) => {
        const inputs = (testCase.input || '').split('\n');
        let inputIndex = 0;
        let capturedOutput = '';

        window._testInputCallback = () => {
            if (inputIndex < inputs.length) {
                return decodeContent(inputs[inputIndex++]);
            }
            return '';
        };

        // 设置输出回调
        window._testOutputCallback = (text) => {
            capturedOutput += text;
        };

        // 超时Promise
        const timeoutMs = 8000; // 8秒超时
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('代码执行超时（超过8秒），可能存在无限循环')), timeoutMs);
        });

        try {
            // 准备测试代码
            const userCode = code.trim() || 'pass';
            const indentedCode = userCode.split('\n').map(line => '    ' + line).join('\n');
            const transformedCode = indentedCode.replace(/input\s*\(/g, '_test_input(');

            // 设置测试环境
            const setupCode = `
import sys

class TestOutput:
    def write(self, text):
        if text:
            import js
            js.window._testOutputCallback(str(text))
    def flush(self):
        pass

sys.stdout = TestOutput()
sys.stderr = TestOutput()

def _test_input(prompt=''):
    # 忽略提示词，不输出到结果（这样学生在input()中写提示词不影响测评）
    import js
    return str(js.window._testInputCallback())
`;
            await pyodide.runPythonAsync(setupCode);

            // 运行用户代码（带超时保护）
            const wrapperCode = `
async def _test_main():
${transformedCode}

import asyncio
asyncio.ensure_future(_test_main())
`;

            // 使用Promise.race实现超时保护
            await Promise.race([
                (async () => {
                    await pyodide.runPythonAsync(wrapperCode);
                    // 等待一小段时间让异步代码完成
                    await new Promise(resolve => setTimeout(resolve, 100));
                })(),
                timeoutPromise
            ]);

            // 比较输出（忽略行末尾空格差异）
            const actualOutput = normalizeOutput(capturedOutput);
            const expectedOutput = normalizeOutput(decodeContent(testCase.expectedOutput || ''));
            const passed = actualOutput === expectedOutput;

            return {
                passed,
                actualOutput,
                expectedOutput,
                error: null
            };
        } catch (error) {
            return {
                passed: false,
                actualOutput: capturedOutput.trim(),
                expectedOutput: normalizeOutput(decodeContent(testCase.expectedOutput || '')),
                error: error.message
            };
        }
    };

    // 运行所有测试并计算分数
    const runAllTests = async () => {
        if (testCases.length === 0) {
            return { results: [], passedCount: 0, totalCount: 0, score: null };
        }

        try {
            // 获取Pyodide实例
            if (!window.loadPyodide) {
                throw new Error('Python运行环境未加载');
            }

            const pyodide = await window.loadPyodide({
                indexURL: '/libs/pyodide/'
            });

            const results = [];

            for (let i = 0; i < testCases.length; i++) {
                const testCase = testCases[i];
                const result = await runSingleTest(testCase, pyodide);
                results.push({
                    index: i,
                    ...result,
                    isHidden: testCase.isHidden,
                    input: testCase.input
                });
            }

            const passedCount = results.filter(r => r.passed).length;
            const totalCount = testCases.length;
            // 根据通过率计算0-10分
            const score = Math.round((passedCount / totalCount) * 10);

            return { results, passedCount, totalCount, score };
        } catch (error) {
            console.error('测评失败:', error);
            throw error;
        }
    };

    // 保存草稿
    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            const response = await pythonAPI.saveDraft(lessonId, activityId, code, lastOutput);
            if (response.success) {
                setSubmission(response.data);
                message.success('草稿已保存');
            } else {
                message.error(response.message || '保存失败');
            }
        } catch (error) {
            console.error('保存草稿失败:', error);
            message.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    // 提交代码（如果有测试点则自动评分）
    const handleSubmit = async () => {
        if (!code.trim()) {
            message.warning('请先编写代码');
            return;
        }

        try {
            setSubmitting(true);

            let autoScore = null;
            let testResultsData = null;

            // 如果有测试用例，先运行测试
            if (testCases.length > 0) {
                message.loading({ content: '正在测评...', key: 'submit' });
                try {
                    const testData = await runAllTests();
                    autoScore = testData.score;
                    testResultsData = testData;
                    setTestResults(testData);

                    message.loading({
                        content: `测评完成: ${testData.passedCount}/${testData.totalCount} 通过，得分: ${autoScore}/10`,
                        key: 'submit'
                    });
                } catch (error) {
                    message.warning({ content: '测评失败，将提交等待教师评分', key: 'submit' });
                }
            }

            // 提交代码，包含自动评分和测试结果
            const response = await pythonAPI.submit(lessonId, activityId, code, lastOutput, autoScore, testResultsData);
            if (response.success) {
                setSubmission(response.data);
                if (autoScore !== null) {
                    message.success({ content: `提交成功！自动评分: ${autoScore}/10`, key: 'submit' });
                } else {
                    message.success({ content: '代码已提交，等待教师评分', key: 'submit' });
                }
                if (onSubmitSuccess) {
                    onSubmitSuccess();
                }
            } else {
                message.error({ content: response.message || '提交失败', key: 'submit' });
            }
        } catch (error) {
            console.error('提交代码失败:', error);
            message.error({ content: '提交失败', key: 'submit' });
        } finally {
            setSubmitting(false);
        }
    };

    // 撤回提交
    const handleWithdraw = async () => {
        try {
            setWithdrawing(true);
            const response = await pythonAPI.withdraw(lessonId, activityId);
            if (response.success) {
                setSubmission(response.data);
                setTestResults(null);
                message.success('已撤回提交，可以继续编辑');
            } else {
                message.error(response.message || '撤回失败');
            }
        } catch (error) {
            console.error('撤回提交失败:', error);
            message.error('撤回失败');
        } finally {
            setWithdrawing(false);
        }
    };

    // 渲染提交状态标签
    const renderStatusTag = () => {
        if (!submission) return null;

        if (submission.score !== null && submission.score !== undefined) {
            return (
                <Tag icon={<TrophyOutlined />} color="gold">
                    得分: {submission.score}/10
                </Tag>
            );
        }

        if (submission.status === 'submitted') {
            return (
                <Tag icon={<CheckCircleOutlined />} color="success">
                    已提交
                </Tag>
            );
        }

        return (
            <Tag icon={<ClockCircleOutlined />} color="processing">
                草稿
            </Tag>
        );
    };

    // 渲染测评结果
    const renderTestResults = () => {
        if (!testResults || testResults.totalCount === 0) return null;

        const { results, passedCount, totalCount } = testResults;
        const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

        // 合并当前最新的测试用例设置和保存的运行结果
        // 这样确保如果由于老师修改了隐藏状态，学生端能立即生效
        const mergedResults = testCases.map((testCase, idx) => {
            const result = results[idx] || {};
            return {
                ...result,
                // 使用当前的设置覆盖保存的结果（主要是隐藏状态和输入输出）
                input: testCase.input,
                expectedOutput: testCase.expectedOutput,
                isHidden: testCase.isHidden,
                // 保持运行结果
                passed: result.passed,
                actualOutput: result.actualOutput,
                error: result.error
            };
        });

        return (
            <Card
                title={
                    <Space>
                        <span>📊 测评结果</span>
                        <Tag color={passedCount === totalCount ? 'success' : 'warning'}>
                            {passedCount}/{totalCount} 通过
                        </Tag>
                    </Space>
                }
                size="small"
                style={{ marginBottom: 16 }}
            >
                <Progress
                    percent={percent}
                    status={passedCount === totalCount ? 'success' : 'exception'}
                    style={{ marginBottom: 16 }}
                />
                <Collapse size="small">
                    {mergedResults.map((result, idx) => (
                        <Panel
                            key={idx}
                            header={
                                <Space>
                                    {result.passed ? (
                                        <CheckOutlined style={{ color: '#52c41a' }} />
                                    ) : (
                                        <CloseOutlined style={{ color: '#ff4d4f' }} />
                                    )}
                                    <span>测试点 {idx + 1}</span>
                                    {result.isHidden && <Tag size="small">隐藏</Tag>}
                                    {result.passed ? (
                                        <Tag color="success" size="small">通过</Tag>
                                    ) : (
                                        <Tag color="error" size="small">未通过</Tag>
                                    )}
                                </Space>
                            }
                        >
                            {result.isHidden ? (
                                <div style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}>
                                    <Alert
                                        message="此测试点为隐藏测试点，输入和预期输出已隐藏"
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />
                                    <div>
                                        <strong>实际输出：</strong>
                                        <pre style={{
                                            background: result.passed ? '#f6ffed' : '#fff2f0',
                                            padding: 8,
                                            margin: '4px 0',
                                            whiteSpace: 'pre-wrap',
                                            borderLeft: `3px solid ${result.passed ? '#52c41a' : '#ff4d4f'}`
                                        }}>
                                            {result.error ? `错误: ${result.error}` : (result.actualOutput || '(无输出)')}
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}>
                                    <div style={{ marginBottom: 8 }}>
                                        <strong>输入：</strong>
                                        <pre style={{ background: '#f5f5f5', padding: 8, margin: '4px 0', whiteSpace: 'pre-wrap' }}>
                                            {decodeContent(result.input || '(无输入)')}
                                        </pre>
                                    </div>
                                    <div style={{ marginBottom: 8 }}>
                                        <strong>预期输出：</strong>
                                        <pre style={{ background: '#f6ffed', padding: 8, margin: '4px 0', whiteSpace: 'pre-wrap', borderLeft: '3px solid #52c41a' }}>
                                            {decodeContent(result.expectedOutput || '(无输出)')}
                                        </pre>
                                    </div>
                                    <div>
                                        <strong>实际输出：</strong>
                                        <pre style={{
                                            background: result.passed ? '#f6ffed' : '#fff2f0',
                                            padding: 8,
                                            margin: '4px 0',
                                            whiteSpace: 'pre-wrap',
                                            borderLeft: `3px solid ${result.passed ? '#52c41a' : '#ff4d4f'}`
                                        }}>
                                            {result.error ? `错误: ${result.error}` : (result.actualOutput || '(无输出)')}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </Panel>
                    ))}
                </Collapse>
            </Card>
        );
    };

    if (loading) {
        return (
            <div className="python-activity-loading">
                <Spin tip="加载中..." />
            </div>
        );
    }

    const isSubmitted = submission?.status === 'submitted';
    const isGraded = submission?.score !== null && submission?.score !== undefined;

    return (
        <div className="python-activity-container">
            <div className="python-activity-layout">
                {/* 左侧：活动说明 */}
                <div className="python-activity-left">
                    {instructions && (
                        <Card
                            title="📝 活动说明"
                            size="small"
                            className="instructions-card"
                        >
                            <div className="instructions-content">
                                <MarkdownRenderer content={instructions} />
                            </div>
                        </Card>
                    )}

                    {/* 评分反馈（只显示教师手动评语，不显示自动评测） */}
                    {isGraded && submission.feedback && submission.feedback !== '自动评测' && (
                        <Alert
                            message={`教师评语`}
                            description={submission.feedback}
                            type="info"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    )}

                    {/* 测评结果 - 放在说明下方 */}
                    {renderTestResults()}
                </div>

                {/* 右侧：代码编辑器 */}
                <div className="python-activity-right">
                    <PythonEditor
                        ref={editorRef}
                        initialCode={code}
                        onCodeChange={handleCodeChange}
                        onExecutionComplete={handleExecutionComplete}
                        height="100%"
                        scoreTag={
                            isGraded ? (
                                <Tag icon={<TrophyOutlined />} color="gold">
                                    得分: {submission.score}/10
                                </Tag>
                            ) : null
                        }
                        extraButtons={
                            <>
                                <Button
                                    icon={<SaveOutlined />}
                                    onClick={handleSaveDraft}
                                    loading={saving}
                                >
                                    保存
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    onClick={handleSubmit}
                                    loading={submitting}
                                >
                                    提交
                                </Button>
                            </>
                        }
                    />
                </div>
            </div>
        </div>
    );
};

export default PythonActivity;
