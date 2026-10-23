import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Space, Tag, Button, Empty, message, Row, Col, Radio, Input, Spin } from 'antd';
import { SaveOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { flowchartAPI } from '../../../../services/api';

const { TextArea } = Input;

/**
 * FlowchartReview - 流程图批阅组件
 * 用于查看和批阅学生提交的流程图
 */
const FlowchartReview = ({
    submissions,
    onRefresh,
    formatClassName,
    gradingState,
    onUpdateGradingState
}) => {
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const iframeRef = useRef(null);

    // 评分状态
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);

    const gradeScoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };

    // 初始化选择第一个学生
    useEffect(() => {
        if (submissions && submissions.length > 0 && !selectedSubmission) {
            handleSelectSubmission(submissions[0], 0);
        }
    }, [submissions]);

    // 选择学生时更新评分状态
    useEffect(() => {
        if (selectedSubmission) {
            setScore(selectedSubmission.grade?.score ?? null);
            setFeedback(selectedSubmission.grade?.feedback || '');
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

            const response = await flowchartAPI.gradeSubmission(submissionId, finalScore, feedback);

            if (response.success) {
                message.success(isClearing ? '已清除评分' : `评分 ${gradeKey} (${newScore}分) 成功`);
                setScore(finalScore);
                // 传递完整的状态更新，包括status和grade对象
                if (onRefresh) {
                    if (isClearing) {
                        onRefresh(submissionId, { grade: null, status: 'submitted' });
                    } else {
                        onRefresh(submissionId, { grade: { score: finalScore, feedback, gradedAt: new Date() }, status: 'graded' });
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

    // 提交评语
    const handleSubmitFeedback = async () => {
        if (!selectedSubmission) return;

        const submissionId = selectedSubmission._id;

        try {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });

            const response = await flowchartAPI.gradeSubmission(submissionId, score, feedback);

            if (response.success) {
                message.success('评语保存成功');
                setShowFeedback(false);
                if (onRefresh) onRefresh(submissionId, { score, feedback, gradedAt: new Date() });
            }
        } catch (error) {
            console.error('保存评语失败:', error);
            message.error('保存评语失败');
        } finally {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    // 构建 iframe URL - 不再传递 data，改用 postMessage
    const getIframeSrc = useCallback(() => {
        if (!selectedSubmission?.flowchartData) return null;
        const params = new URLSearchParams();
        params.set('readonly', '1');
        params.set('hasData', '1'); // 标记有数据，等待 postMessage
        return `/mxgraph/editor.html?${params.toString()}`;
    }, [selectedSubmission]);

    // 当 iframe 加载完成后，通过 postMessage 发送数据
    useEffect(() => {
        const handleIframeMessage = (event) => {
            if (event.data?.type === 'ready' && iframeRef.current) {
                // 编辑器准备好了，发送流程图数据
                if (selectedSubmission?.flowchartData) {
                    iframeRef.current.contentWindow.postMessage(
                        { type: 'load', data: selectedSubmission.flowchartData },
                        '*'
                    );
                }
            }
        };
        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, [selectedSubmission]);

    const isGrading = gradingState?.[selectedSubmission?._id]?.loading;

    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无流程图作业提交记录" />;
    }

    return (
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
                    <Button
                        size="small"
                        type="link"
                        onClick={() => setShowFeedback(!showFeedback)}
                        style={{ marginLeft: 8, padding: 0, fontSize: 12 }}
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
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', fontSize: 13, fontWeight: 500 }}>
                        学生列表 ({submissions.length})
                    </div>
                    <div style={{ height: 'calc(100% - 36px)', overflowY: 'auto' }}>
                        {submissions.map((submission, index) => {
                            const isSelected = selectedSubmission?._id === submission._id;
                            const studentName = submission.userId?.name || '未知学生';
                            const isGraded = submission.status === 'graded';
                            const studentScore = submission.grade?.score;

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
                                                <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>{studentScore}分</Tag>
                                            )}
                                            <Tag color={isGraded ? 'green' : 'blue'} style={{ margin: 0, fontSize: 11 }}>
                                                {isGraded ? '已评' : '待评'}
                                            </Tag>
                                        </Space>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                        {formatClassName?.(submission.userId?.classId?.grade, submission.userId?.classId?.name) || ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Col>

            {/* 右侧: 流程图预览 */}
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
                            <span style={{ fontWeight: 500 }}>流程图预览</span>
                            {selectedSubmission && (
                                <Tag color="blue">{selectedSubmission.userId?.name || '未知学生'}</Tag>
                            )}
                        </Space>
                        <Space>
                            <Button size="small" icon={<LeftOutlined />} onClick={handlePrev} disabled={currentIndex <= 0} />
                            <span style={{ fontSize: 12 }}>{currentIndex + 1} / {submissions.length}</span>
                            <Button size="small" icon={<RightOutlined />} onClick={handleNext} disabled={currentIndex >= submissions.length - 1} />
                        </Space>
                    </div>

                    {/* 流程图内容区域 */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        {selectedSubmission?.flowchartData ? (
                            <iframe
                                ref={iframeRef}
                                key={selectedSubmission._id}
                                src={getIframeSrc()}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="流程图预览"
                            />
                        ) : (
                            <Empty
                                description="该学生暂无流程图数据"
                                style={{ marginTop: '100px' }}
                            />
                        )}
                    </div>
                </div>
            </Col>
        </Row>
    );
};

export default FlowchartReview;
