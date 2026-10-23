import React, { useState, useEffect, useMemo } from 'react';
import { Space, Tag, Button, Empty, message, Row, Col, Radio, Input, Spin, InputNumber, Tooltip, Tabs } from 'antd';
import { SaveOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, RobotOutlined, PlayCircleOutlined, FileTextOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
import { pythonAPI } from '../../../../services/pythonAPI';
import PythonEditor from '../../../../components/Python/PythonEditor';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// 注册Python语言
SyntaxHighlighter.registerLanguage('python', python);

const { TextArea } = Input;

// 内联样式：确保 Tabs 内容面板填满高度
const tabsStyle = `
.python-review-tabs .ant-tabs-content-holder {
    flex: 1;
    overflow: hidden;
}
.python-review-tabs .ant-tabs-content {
    height: 100%;
}
.python-review-tabs .ant-tabs-tabpane {
    height: 100%;
}
`;

/**
 * PythonReview - Python编程活动批阅组件
 * 用于查看和批阅学生提交的Python代码
 */
const PythonReview = ({
    submissions,
    onRefresh,
    formatClassName,
    gradingState,
    onUpdateGradingState,
    sortMode,
    onSortChange
}) => {
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(-1);

    // 评分状态
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);
    const [customScore, setCustomScore] = useState(null);

    const gradeScoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };

    // (已被全局排序替代)

    // 初始化选择第一个学生
    useEffect(() => {
        if (submissions && submissions.length > 0 && !selectedSubmission) {
            handleSelectSubmission(submissions[0], 0);
        }
    }, [submissions]);

    // 选择学生时更新评分状态
    useEffect(() => {
        if (selectedSubmission) {
            const currentScore = selectedSubmission.score ?? null;
            setScore(currentScore);
            setCustomScore(currentScore);
            setFeedback(selectedSubmission.feedback || '');
            setShowFeedback(false);
        }
    }, [selectedSubmission]);

    // 选择学生
    const handleSelectSubmission = (submission, index) => {
        setSelectedSubmission(submission);
        setCurrentIndex(index);
    };

    // 下一个学生
    const handleNext = () => {
        if (currentIndex < submissions.length - 1) {
            handleSelectSubmission(submissions[currentIndex + 1], currentIndex + 1);
        }
    };

    // 上一个学生
    const handlePrev = () => {
        if (currentIndex > 0) {
            handleSelectSubmission(submissions[currentIndex - 1], currentIndex - 1);
        }
    };

    // 快捷评分 - 直接提交
    const handleQuickGrade = async (gradeKey) => {
        if (!selectedSubmission) return;

        const newScore = gradeScoreMap[gradeKey];
        const submissionId = selectedSubmission._id;

        // 如果点击的是当前已选的等级，则清除评分
        const isClearing = score === newScore;
        const finalScore = isClearing ? null : newScore;

        try {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });

            const response = await pythonAPI.gradeSubmission(submissionId, finalScore, feedback);

            if (response.success) {
                message.success(isClearing ? '已清除评分' : `评分 ${gradeKey} (${newScore}分) 成功`);
                setScore(finalScore);
                setCustomScore(finalScore);
                // 传递完整的状态更新
                if (onRefresh) {
                    if (isClearing) {
                        onRefresh(submissionId, { score: null, feedback: null, gradedAt: null });
                    } else {
                        onRefresh(submissionId, { score: finalScore, feedback, gradedAt: new Date() });
                    }
                }

                // 只有评分成功（非清除）时才自动跳到下一个学生
                if (!isClearing && currentIndex < submissions.length - 1) {
                    setTimeout(() => handleNext(), 300);
                }
            }
        } catch (error) {
            console.error('评分失败:', error);
            message.error('评分失败');
        } finally {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    // 自定义分数提交
    const handleCustomScoreSubmit = async () => {
        if (!selectedSubmission || customScore === null) return;

        const submissionId = selectedSubmission._id;

        try {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });

            const response = await pythonAPI.gradeSubmission(submissionId, customScore, feedback);

            if (response.success) {
                message.success(`评分 ${customScore} 分成功`);
                setScore(customScore);
                if (onRefresh) onRefresh(submissionId, { score: customScore, feedback, gradedAt: new Date() });

                // 自动跳到下一个学生
                if (currentIndex < submissions.length - 1) {
                    setTimeout(() => handleNext(), 300);
                }
            }
        } catch (error) {
            console.error('评分失败:', error);
            message.error('评分失败');
        } finally {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    // 提交评语
    const handleSubmitFeedback = async () => {
        if (!selectedSubmission) return;

        const submissionId = selectedSubmission._id;
        const finalScore = score ?? customScore ?? 0;

        try {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });

            const response = await pythonAPI.gradeSubmission(submissionId, finalScore, feedback);

            if (response.success) {
                message.success('评语保存成功');
                setShowFeedback(false);
                if (onRefresh) onRefresh(submissionId, { score: finalScore, feedback, gradedAt: new Date() });
            }
        } catch (error) {
            console.error('保存评语失败:', error);
            message.error('保存评语失败');
        } finally {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    const isGrading = gradingState?.[selectedSubmission?._id]?.loading;

    // 判断是否已自动评分
    const hasAutoScore = selectedSubmission?.feedback === '自动评测' && selectedSubmission?.score !== null;

    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无Python编程作业提交记录" />;
    }

    return (
        <>
            <style>{tabsStyle}</style>
            <Row gutter={8} style={{ height: 'calc(100vh - 180px)' }}>
                {/* 左侧: 学生列表 + 评分 */}
                <Col span={5} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* 快捷评分 */}
                    <div style={{ marginBottom: 8, padding: '8px', background: '#fafafa', borderRadius: 4 }}>
                        <div style={{ marginBottom: 6, fontSize: 12, color: '#666' }}>快捷评分:</div>
                        <Radio.Group
                            value={Object.entries(gradeScoreMap).find(([_, v]) => v === score)?.[0]}
                            optionType="button"
                            buttonStyle="solid"
                            size="small"
                            disabled={!selectedSubmission || isGrading}
                        >
                            {Object.keys(gradeScoreMap).map(k => (
                                <Radio.Button key={k} value={k} onClick={() => handleQuickGrade(k)}>{k}</Radio.Button>
                            ))}
                        </Radio.Group>

                        {/* 自定义分数 */}
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <InputNumber
                                size="small"
                                min={0}
                                max={10}
                                value={customScore}
                                onChange={setCustomScore}
                                style={{ width: 60 }}
                                disabled={!selectedSubmission || isGrading}
                            />
                            <span style={{ fontSize: 12, color: '#666' }}>分</span>
                            <Button
                                size="small"
                                type="primary"
                                onClick={handleCustomScoreSubmit}
                                disabled={!selectedSubmission || isGrading || customScore === null}
                            >
                                确定
                            </Button>
                        </div>

                        <Button
                            size="small"
                            type="link"
                            onClick={() => setShowFeedback(!showFeedback)}
                            style={{ marginTop: 4, padding: 0, fontSize: 12 }}
                        >
                            {showFeedback ? '收起评语' : '添加评语'}
                        </Button>
                    </div>

                    {/* 评语输入框 */}
                    {showFeedback && (
                        <div style={{ marginBottom: 8, padding: '8px', background: '#fafafa', borderRadius: 4 }}>
                            <TextArea
                                rows={2}
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="输入评语..."
                                style={{ marginBottom: 6, fontSize: 12 }}
                            />
                            <Button
                                size="small"
                                type="primary"
                                icon={<SaveOutlined />}
                                onClick={handleSubmitFeedback}
                                loading={isGrading}
                            >
                                保存评语
                            </Button>
                        </div>
                    )}

                    {/* 学生列表 */}
                    <div style={{ flex: 1, overflow: 'hidden', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', fontSize: 13, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>学生列表 ({submissions.length})</span>
                            {onSortChange && (
                                <Button 
                                    type="text" 
                                    size="small" 
                                    onClick={onSortChange}
                                    icon={<SortAscendingOutlined style={{ 
                                        transform: sortMode === 'desc' ? 'rotate(180deg)' : 'none',
                                        color: sortMode !== 'none' ? '#1890ff' : 'inherit'
                                    }}/>}
                                    title="切换排序 (默认/降序/升序)"
                                />
                            )}
                        </div>
                        <div style={{ height: 'calc(100% - 36px)', overflowY: 'auto' }}>
                            {submissions.map((submission, index) => {
                                const isSelected = selectedSubmission?._id === submission._id;
                                const studentName = submission.studentId?.name || '未知学生';
                                const isGraded = submission.score !== null && submission.score !== undefined;
                                const studentScore = submission.score;
                                const isAutoGraded = submission.feedback === '自动评测';

                                return (
                                    <div
                                        key={submission._id}
                                        onClick={() => handleSelectSubmission(submission, index)}
                                        style={{
                                            padding: '8px 10px',
                                            borderBottom: '1px solid #f0f0f0',
                                            cursor: 'pointer',
                                            background: isSelected ? '#e6f7ff' : 'transparent',
                                            borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: 13 }}>{studentName}</span>
                                            <Space size={4}>
                                                {studentScore !== undefined && studentScore !== null && (
                                                    <Tooltip title={isAutoGraded ? '自动评测分数' : '教师评分'}>
                                                        <Tag
                                                            color={isAutoGraded ? 'cyan' : 'orange'}
                                                            style={{ margin: 0, fontSize: 11 }}
                                                            icon={isAutoGraded ? <RobotOutlined /> : null}
                                                        >
                                                            {studentScore}分
                                                        </Tag>
                                                    </Tooltip>
                                                )}
                                                <Tag color={isGraded ? 'green' : 'blue'} style={{ margin: 0, fontSize: 11 }}>
                                                    {isGraded ? '已评' : '待评'}
                                                </Tag>
                                            </Space>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                            {formatClassName?.(submission.studentId?.classId?.grade, submission.studentId?.classId?.name) || ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Col>

                {/* 右侧: 代码预览 */}
                <Col span={19} style={{ height: '100%' }}>
                    <div style={{ height: '100%', border: '1px solid #f0f0f0', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
                        {/* 标题栏 */}
                        <div style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #f0f0f0',
                            background: '#fafafa',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <Space>
                                <span style={{ fontWeight: 500 }}>Python代码预览</span>
                                {selectedSubmission && (
                                    <>
                                        <Tag color="blue">{selectedSubmission.studentId?.name || '未知学生'}</Tag>
                                        {hasAutoScore && (
                                            <Tooltip title="此分数由自动评测生成，教师可修改">
                                                <Tag color="cyan" icon={<RobotOutlined />}>
                                                    自动评测: {selectedSubmission.score}分
                                                </Tag>
                                            </Tooltip>
                                        )}
                                    </>
                                )}
                            </Space>
                            <Space>
                                <Button size="small" icon={<LeftOutlined />} onClick={handlePrev} disabled={currentIndex <= 0} />
                                <span style={{ fontSize: 12 }}>{currentIndex + 1} / {submissions.length}</span>
                                <Button size="small" icon={<RightOutlined />} onClick={handleNext} disabled={currentIndex >= submissions.length - 1} />
                            </Space>
                        </div>

                        {/* 代码内容区域 */}
                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {selectedSubmission?.code ? (
                                <Tabs
                                    defaultActiveKey="view"
                                    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                                    tabBarStyle={{ margin: 0, paddingLeft: 12, background: '#fafafa', flexShrink: 0 }}
                                    className="python-review-tabs"
                                    items={[
                                        {
                                            key: 'view',
                                            label: (
                                                <span>
                                                    <FileTextOutlined />
                                                    查看代码
                                                </span>
                                            ),
                                            children: (
                                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                                                    {/* 代码显示 */}
                                                    <div style={{ flex: 1, overflow: 'auto', background: '#1e1e1e' }}>
                                                        <SyntaxHighlighter
                                                            language="python"
                                                            style={vs2015}
                                                            showLineNumbers
                                                            wrapLines
                                                            customStyle={{
                                                                margin: 0,
                                                                padding: '12px',
                                                                fontSize: '14px',
                                                                lineHeight: '1.5',
                                                                minHeight: '100%',
                                                                background: '#1e1e1e'
                                                            }}
                                                        >
                                                            {selectedSubmission.code}
                                                        </SyntaxHighlighter>
                                                    </div>

                                                    {/* 学生运行输出显示 */}
                                                    {selectedSubmission.output && (
                                                        <div style={{
                                                            borderTop: '1px solid #f0f0f0',
                                                            padding: '8px 12px',
                                                            background: '#1e1e1e',
                                                            color: '#d4d4d4',
                                                            maxHeight: '150px',
                                                            overflow: 'auto'
                                                        }}>
                                                            <div style={{ fontSize: 12, color: '#52c41a', marginBottom: 4 }}>
                                                                📤 学生运行输出:
                                                            </div>
                                                            <pre style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', color: '#00ff00' }}>
                                                                {selectedSubmission.output}
                                                            </pre>
                                                        </div>
                                                    )}

                                                    {/* 测试结果显示 */}
                                                    {selectedSubmission.testResults && selectedSubmission.testResults.results && selectedSubmission.testResults.results.length > 0 && (
                                                        <div style={{
                                                            borderTop: '1px solid #f0f0f0',
                                                            padding: '8px 12px',
                                                            background: '#fafafa',
                                                            maxHeight: '300px',
                                                            overflow: 'auto'
                                                        }}>
                                                            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                                                                <CheckCircleOutlined style={{ marginRight: 4 }} />
                                                                测试结果 ({selectedSubmission.testResults.passedCount}/{selectedSubmission.testResults.totalCount} 通过)
                                                            </div>
                                                            {selectedSubmission.testResults.results.map((test, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    style={{
                                                                        padding: '8px 12px',
                                                                        marginBottom: 8,
                                                                        background: test.passed ? '#f6ffed' : '#fff2f0',
                                                                        borderRadius: 4,
                                                                        border: `1px solid ${test.passed ? '#b7eb8f' : '#ffccc7'}`
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: test.passed ? 0 : 8 }}>
                                                                        <Tag color={test.passed ? 'success' : 'error'} style={{ margin: 0 }}>
                                                                            测试点 {idx + 1}
                                                                        </Tag>
                                                                        <span style={{ fontSize: 12, marginLeft: 8 }}>
                                                                            {test.passed ? '✅ 通过' : '❌ 未通过'}
                                                                        </span>
                                                                        {test.isHidden && (
                                                                            <Tag style={{ margin: '0 0 0 8px' }}>隐藏测试点</Tag>
                                                                        )}
                                                                    </div>

                                                                    {/* 未通过时显示详细信息 */}
                                                                    {!test.passed && (
                                                                        <div style={{ marginTop: 8, fontFamily: 'Consolas, Monaco, monospace', fontSize: 12 }}>
                                                                            {/* 输入 */}
                                                                            {test.input && !test.isHidden && (
                                                                                <div style={{ marginBottom: 8 }}>
                                                                                    <div style={{ color: '#666', marginBottom: 2 }}>📥 输入:</div>
                                                                                    <pre style={{
                                                                                        background: '#fff',
                                                                                        padding: 6,
                                                                                        margin: 0,
                                                                                        borderRadius: 3,
                                                                                        whiteSpace: 'pre-wrap',
                                                                                        border: '1px solid #d9d9d9'
                                                                                    }}>
                                                                                        {test.input}
                                                                                    </pre>
                                                                                </div>
                                                                            )}

                                                                            {/* 期望输出 */}
                                                                            {test.expectedOutput && !test.isHidden && (
                                                                                <div style={{ marginBottom: 8 }}>
                                                                                    <div style={{ color: '#52c41a', marginBottom: 2 }}>✅ 期望输出:</div>
                                                                                    <pre style={{
                                                                                        background: '#f6ffed',
                                                                                        padding: 6,
                                                                                        margin: 0,
                                                                                        borderRadius: 3,
                                                                                        whiteSpace: 'pre-wrap',
                                                                                        border: '1px solid #b7eb8f'
                                                                                    }}>
                                                                                        {test.expectedOutput}
                                                                                    </pre>
                                                                                </div>
                                                                            )}

                                                                            {/* 学生实际输出 */}
                                                                            <div style={{ marginBottom: test.error ? 8 : 0 }}>
                                                                                <div style={{ color: '#ff4d4f', marginBottom: 2 }}>❌ 学生实际输出:</div>
                                                                                <pre style={{
                                                                                    background: '#fff2f0',
                                                                                    padding: 6,
                                                                                    margin: 0,
                                                                                    borderRadius: 3,
                                                                                    whiteSpace: 'pre-wrap',
                                                                                    border: '1px solid #ffccc7'
                                                                                }}>
                                                                                    {test.actualOutput || '(无输出)'}
                                                                                </pre>
                                                                            </div>

                                                                            {/* 错误信息 */}
                                                                            {test.error && (
                                                                                <div>
                                                                                    <div style={{ color: '#ff4d4f', marginBottom: 2 }}>⚠️ 错误信息:</div>
                                                                                    <pre style={{
                                                                                        background: '#fff1f0',
                                                                                        padding: 6,
                                                                                        margin: 0,
                                                                                        borderRadius: 3,
                                                                                        whiteSpace: 'pre-wrap',
                                                                                        border: '1px solid #ffa39e',
                                                                                        color: '#cf1322'
                                                                                    }}>
                                                                                        {test.error}
                                                                                    </pre>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'run',
                                            label: (
                                                <span>
                                                    <PlayCircleOutlined />
                                                    运行代码
                                                </span>
                                            ),
                                            children: (
                                                <div style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}>
                                                    <PythonEditor
                                                        key={selectedSubmission._id}
                                                        initialCode={selectedSubmission.code}
                                                        readOnly={false}
                                                        height="100%"
                                                    />
                                                </div>
                                            )
                                        }
                                    ]}
                                />
                            ) : (
                                <Empty
                                    description="该学生暂无代码提交"
                                    style={{ marginTop: '100px' }}
                                />
                            )}
                        </div>
                    </div>
                </Col>
            </Row>
        </>
    );
};

export default PythonReview;
