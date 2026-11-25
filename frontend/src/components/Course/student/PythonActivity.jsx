import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, Button, Space, message, Tag, Spin, Alert, Progress, Modal, List, Tooltip, Empty } from 'antd';
import {
    SaveOutlined,
    SendOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    TrophyOutlined,
    ExperimentOutlined,
    HistoryOutlined,
    LockOutlined,
    EditOutlined
} from '@ant-design/icons';
import { pythonAPI } from '../../../services/api';
import PythonEditor from '../../Python/PythonEditor';
import TestResultList from '../../Python/TestResultList';
import { pythonRunner } from '../../Python/pythonRunner';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import './PythonActivity.css';

const DEFAULT_STARTER = '# 在这里编写你的Python代码\n';
const LOCAL_SAVE_DELAY_MS = 1000;
const SERVER_AUTOSAVE_INTERVAL_MS = 60 * 1000;

const currentUserId = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.id || user?._id || 'anonymous';
    } catch {
        return 'anonymous';
    }
};

const readLocalDraft = (key) => {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value.code === 'string' ? value : null;
    } catch {
        return null;
    }
};

const formatTime = (value) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '');

/**
 * Python编程活动组件（学生端）
 * - 运行、自测（公开样例）在浏览器 Worker 中进行；正式提交由服务器运行全部测试点并评分
 * - 代码自动保存到本机，并定时同步草稿到服务器
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
    const [submission, setSubmission] = useState(null);
    const [code, setCode] = useState('');
    const [lastOutput, setLastOutput] = useState('');
    const [selfTesting, setSelfTesting] = useState(false);
    const [selfTestResults, setSelfTestResults] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [attempts, setAttempts] = useState(null);
    const [expandedAttempt, setExpandedAttempt] = useState(null);

    const {
        instructions = '',
        starterCode = DEFAULT_STARTER,
        testCases = [],
        maxAttempts = 0
    } = pythonSettings;

    const storageKey = `python-draft:${currentUserId()}:${lessonId}:${activityId}`;
    const serverCodeRef = useRef('');   // 服务器上最新的代码（草稿或未提交修改）
    const codeRef = useRef('');
    const localTimerRef = useRef(null);
    const busyRef = useRef(false);

    const sampleCases = useMemo(
        () => testCases.filter(tc => !tc.isHidden && ((tc.input || '') !== '' || (tc.expectedOutput || '') !== '')),
        [testCases]
    );

    const applySubmission = useCallback((data) => {
        setSubmission(data);
        serverCodeRef.current = data?.draftCode ?? data?.code ?? '';
    }, []);

    // 加载提交记录；若本机有更新的未保存代码则恢复
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            let serverCode = starterCode;
            let serverUpdatedAt = 0;
            try {
                const response = await pythonAPI.getSubmission(lessonId, activityId);
                if (!cancelled && response.success && response.data) {
                    applySubmission(response.data);
                    serverCode = response.data.draftCode ?? response.data.code ?? starterCode;
                    serverUpdatedAt = Date.parse(response.data.updatedAt) || 0;
                    setLastOutput(response.data.output || '');
                }
            } catch (error) {
                console.error('获取Python提交记录失败:', error);
                message.warning('获取已保存的代码失败，先显示本机或初始代码');
            }
            if (cancelled) return;
            const local = readLocalDraft(storageKey);
            if (local && local.code !== serverCode && local.savedAt > serverUpdatedAt) {
                setCode(local.code);
                codeRef.current = local.code;
                message.info('已恢复本机上次未保存的代码');
            } else {
                setCode(serverCode);
                codeRef.current = serverCode;
            }
            setLoading(false);
        };
        if (lessonId && activityId) load();
        return () => { cancelled = true; };
    }, [lessonId, activityId, starterCode, storageKey, applySubmission]);

    // 定时把未保存的修改同步到服务器（静默）
    useEffect(() => {
        const timer = setInterval(async () => {
            if (busyRef.current || codeRef.current === serverCodeRef.current) return;
            const snapshot = codeRef.current;
            try {
                const response = await pythonAPI.saveDraft(lessonId, activityId, snapshot);
                if (response.success) applySubmission(response.data);
            } catch {
                // 本机已有备份，下次再试
            }
        }, SERVER_AUTOSAVE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [lessonId, activityId, applySubmission]);

    useEffect(() => () => clearTimeout(localTimerRef.current), []);

    const handleCodeChange = useCallback((newCode) => {
        setCode(newCode);
        codeRef.current = newCode;
        setSelfTestResults(null);
        clearTimeout(localTimerRef.current);
        localTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(storageKey, JSON.stringify({ code: newCode, savedAt: Date.now() }));
            } catch {
                // 本机存储已满时忽略
            }
        }, LOCAL_SAVE_DELAY_MS);
    }, [storageKey]);

    const handleExecutionComplete = useCallback((output) => {
        setLastOutput(output);
    }, []);

    const errorMessageOf = (error, fallback) => error?.response?.data?.message || fallback;

    const handleSaveDraft = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        setSaving(true);
        const snapshot = codeRef.current;
        try {
            const response = await pythonAPI.saveDraft(lessonId, activityId, snapshot, lastOutput);
            if (response.success) {
                applySubmission(response.data);
                message.success(response.message || '已保存');
            } else {
                message.error(response.message || '保存失败');
            }
        } catch (error) {
            message.error(errorMessageOf(error, '保存失败（代码已备份在本机）'));
        } finally {
            busyRef.current = false;
            setSaving(false);
        }
    }, [lessonId, activityId, lastOutput, applySubmission]);

    const handleSelfTest = async () => {
        if (!sampleCases.length) return;
        setSelfTesting(true);
        setSelfTestResults([]);
        try {
            const results = await pythonRunner.runTests(codeRef.current, sampleCases, { onProgress: setSelfTestResults });
            const passed = results.filter(r => r.passed).length;
            if (passed === results.length) message.success(`公开样例全部通过（${passed}/${results.length}），可以提交了`);
            else message.warning(`公开样例通过 ${passed}/${results.length}，请查看左侧的自测结果`);
        } catch (error) {
            message.error(`自测失败：${error.message || '无法启动 Python 运行环境'}`);
            setSelfTestResults(null);
        } finally {
            setSelfTesting(false);
        }
    };

    const handleSubmit = async () => {
        const snapshot = codeRef.current;
        if (!snapshot.trim()) {
            message.warning('请先编写代码');
            return;
        }
        if (busyRef.current) return;
        busyRef.current = true;
        setSubmitting(true);
        const key = 'python-submit';
        message.loading({ content: testCases.length ? '正在服务器评测全部测试点…' : '正在提交…', key, duration: 0 });
        try {
            const response = await pythonAPI.submit(lessonId, activityId, snapshot, lastOutput);
            if (response.success) {
                applySubmission(response.data);
                try { localStorage.removeItem(storageKey); } catch { /* 忽略 */ }
                const data = response.data;
                const allPassed = data?.testResults?.totalCount > 0 && data.testResults.passedCount === data.testResults.totalCount;
                (allPassed || !testCases.length ? message.success : message.warning)({ content: response.message, key, duration: 4 });
                onSubmitSuccess?.();
            } else {
                message.error({ content: response.message || '提交失败', key });
            }
        } catch (error) {
            message.error({ content: errorMessageOf(error, '提交失败，请稍后重试'), key, duration: 4 });
        } finally {
            busyRef.current = false;
            setSubmitting(false);
        }
    };

    const openHistory = async () => {
        setHistoryOpen(true);
        setAttempts(null);
        setExpandedAttempt(null);
        try {
            const response = await pythonAPI.getMyAttempts(lessonId, activityId);
            setAttempts(response.success ? response.data : []);
        } catch {
            setAttempts([]);
            message.error('获取提交历史失败');
        }
    };

    const restoreAttempt = (attempt) => {
        Modal.confirm({
            title: '把这次提交的代码恢复到编辑器？',
            content: '编辑器中当前的代码会被替换（不会自动提交）。',
            okText: '恢复',
            cancelText: '取消',
            onOk: () => {
                handleCodeChange(attempt.code || '');
                setHistoryOpen(false);
            }
        });
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
    const locked = !!submission?.locked;
    const attemptCount = submission?.attemptCount || 0;
    const attemptsExhausted = maxAttempts > 0 && attemptCount >= maxAttempts;
    const hasUnsubmittedChanges = isSubmitted && code !== submission.code;
    const serverResults = submission?.testResults?.totalCount > 0 ? submission.testResults : null;

    const statusTags = (
        <Space wrap size={[4, 4]}>
            {locked && <Tag icon={<LockOutlined />} color="purple">老师已评分</Tag>}
            {!locked && isSubmitted && <Tag icon={<CheckCircleOutlined />} color="success">已提交</Tag>}
            {!isSubmitted && <Tag icon={<ClockCircleOutlined />} color="processing">草稿</Tag>}
            {hasUnsubmittedChanges && <Tag icon={<EditOutlined />} color="orange">有未提交的修改</Tag>}
            {attemptCount > 0 && (
                <Tag>已提交 {attemptCount}{maxAttempts > 0 ? `/${maxAttempts}` : ''} 次</Tag>
            )}
            {attemptCount === 0 && maxAttempts > 0 && <Tag>最多提交 {maxAttempts} 次</Tag>}
        </Space>
    );

    const submitDisabledReason = locked
        ? '老师已评分，不能再提交；如需修改请联系老师'
        : attemptsExhausted ? `已达到最多提交次数（${maxAttempts} 次）` : null;

    return (
        <div className="python-activity-container">
            <div className="python-activity-layout">
                <div className="python-activity-left">
                    {instructions && (
                        <Card title="📝 活动说明" size="small" className="instructions-card" extra={statusTags}>
                            <div className="instructions-content">
                                <MarkdownRenderer content={instructions} />
                            </div>
                        </Card>
                    )}
                    {!instructions && <div style={{ marginBottom: 12 }}>{statusTags}</div>}

                    {locked && (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginTop: 16 }}
                            message="老师已评分，作业已锁定"
                            description="可以继续在编辑器里练习，但不能再提交。如需重新提交，请联系老师清除评分。"
                        />
                    )}

                    {isGraded && submission.feedback && submission.feedback !== '自动评测' && (
                        <Alert message="教师评语" description={submission.feedback} type="info" showIcon style={{ marginTop: 16 }} />
                    )}

                    {selfTestResults && (
                        <Card
                            title={<Space><span>🧪 自测结果（公开样例，仅供参考）</span>
                                <Tag color={selfTestResults.length === sampleCases.length && selfTestResults.every(r => r.passed) ? 'success' : 'warning'}>
                                    {selfTestResults.filter(r => r.passed).length}/{sampleCases.length} 通过
                                </Tag>
                            </Space>}
                            size="small"
                            style={{ marginTop: 16 }}
                        >
                            {selfTesting && <Spin size="small" style={{ marginBottom: 8 }} tip={`正在运行样例 ${selfTestResults.length + 1}/${sampleCases.length}`} />}
                            <TestResultList results={selfTestResults} testCases={sampleCases} labelPrefix="样例" />
                        </Card>
                    )}

                    {serverResults && (
                        <Card
                            title={
                                <Space>
                                    <span>📊 最近一次提交的评测结果</span>
                                    <Tag color={serverResults.passedCount === serverResults.totalCount ? 'success' : 'warning'}>
                                        {serverResults.passedCount}/{serverResults.totalCount} 通过
                                    </Tag>
                                    {isGraded && <Tag icon={<TrophyOutlined />} color="gold">{submission.score}/10</Tag>}
                                </Space>
                            }
                            size="small"
                            style={{ marginTop: 16 }}
                        >
                            <Progress
                                percent={Math.round((serverResults.passedCount / serverResults.totalCount) * 100)}
                                status={serverResults.passedCount === serverResults.totalCount ? 'success' : 'exception'}
                                style={{ marginBottom: 12 }}
                            />
                            {hasUnsubmittedChanges && (
                                <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="代码已修改，这是上次提交时的结果" />
                            )}
                            <TestResultList results={serverResults.results} testCases={testCases} />
                        </Card>
                    )}
                </div>

                <div className="python-activity-right">
                    <PythonEditor
                        initialCode={code}
                        starterCode={starterCode}
                        onCodeChange={handleCodeChange}
                        onExecutionComplete={handleExecutionComplete}
                        onSave={handleSaveDraft}
                        height="100%"
                        scoreTag={isGraded ? (
                            <Tag icon={<TrophyOutlined />} color="gold">得分: {submission.score}/10</Tag>
                        ) : null}
                        extraButtons={
                            <>
                                <Tooltip title="保存到服务器 (Ctrl+S)；代码也会自动备份在本机">
                                    <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={saving}>保存</Button>
                                </Tooltip>
                                {sampleCases.length > 0 && (
                                    <Tooltip title="用公开样例在本机检查答案，不计成绩">
                                        <Button icon={<ExperimentOutlined />} onClick={handleSelfTest} loading={selfTesting}>自测</Button>
                                    </Tooltip>
                                )}
                                <Tooltip title={submitDisabledReason || (testCases.length ? '提交后由服务器运行全部测试点（含隐藏测试点）自动评分' : '提交给老师评分')}>
                                    <Button
                                        type="primary"
                                        icon={<SendOutlined />}
                                        onClick={handleSubmit}
                                        loading={submitting}
                                        disabled={!!submitDisabledReason}
                                    >
                                        提交
                                    </Button>
                                </Tooltip>
                                <Tooltip title="提交历史">
                                    <Button icon={<HistoryOutlined />} onClick={openHistory} disabled={attemptCount === 0} />
                                </Tooltip>
                            </>
                        }
                    />
                </div>
            </div>

            <Modal
                title="提交历史（最近 30 次）"
                open={historyOpen}
                onCancel={() => setHistoryOpen(false)}
                footer={null}
                width={720}
            >
                {attempts === null ? <Spin /> : attempts.length === 0 ? <Empty description="还没有提交记录" /> : (
                    <List
                        dataSource={attempts}
                        renderItem={(attempt, idx) => (
                            <List.Item
                                key={attempt._id || idx}
                                actions={[
                                    <Button size="small" type="link" onClick={() => setExpandedAttempt(expandedAttempt === idx ? null : idx)}>
                                        {expandedAttempt === idx ? '收起代码' : '查看代码'}
                                    </Button>,
                                    <Button size="small" type="link" onClick={() => restoreAttempt(attempt)}>恢复到编辑器</Button>
                                ]}
                            >
                                <div style={{ width: '100%' }}>
                                    <Space>
                                        <span>第 {attempts.length - idx} 次</span>
                                        <span style={{ color: '#999' }}>{formatTime(attempt.submittedAt)}</span>
                                        {attempt.totalCount > 0 && (
                                            <Tag color={attempt.passedCount === attempt.totalCount ? 'success' : 'warning'}>
                                                通过 {attempt.passedCount}/{attempt.totalCount}
                                            </Tag>
                                        )}
                                        {attempt.score != null && <Tag color="gold">{attempt.score}/10</Tag>}
                                    </Space>
                                    {expandedAttempt === idx && (
                                        <pre className="python-attempt-code">{attempt.code}</pre>
                                    )}
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Modal>
        </div>
    );
};

export default PythonActivity;
