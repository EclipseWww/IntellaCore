import React, { useState, useEffect } from 'react';
import { Card, Space, Tag, Button, Empty, message, Popconfirm, Row, Col, Radio, Input, Divider, InputNumber } from 'antd';
import { DeleteOutlined, UndoOutlined, SaveOutlined, LeftOutlined, RightOutlined, CodeOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import htmlProjectAPI from '../../../../services/htmlProjectAPI';
import { courseManagementAPI } from '../../../../services/api';

const { TextArea } = Input;

const HtmlReview = ({
    submissions,
    projects,
    onRefresh,
    formatClassName,
    loading,
    gradingState,
    onUpdateGradingState
}) => {
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(-1);

    // Local state for grading inputs
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState('');

    // Toggle between preview and source code view
    const [showSourceCode, setShowSourceCode] = useState(false);

    // Initialize selection
    useEffect(() => {
        if (submissions && submissions.length > 0 && !selectedSubmission) {
            handleSelectSubmission(submissions[0], 0);
        }
    }, [submissions]);

    // Update local inputs when selection changes
    useEffect(() => {
        if (selectedSubmission) {
            setScore(selectedSubmission.grade?.score);
            setFeedback(selectedSubmission.grade?.feedback || '');
        }
    }, [selectedSubmission]);

    const gradeScoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };

    const handleSelectSubmission = (submission, index) => {
        setSelectedSubmission(submission);
        setCurrentIndex(index);
    };

    const handleNext = () => {
        if (currentIndex < submissions.length - 1) {
            handleSelectSubmission(submissions[currentIndex + 1], currentIndex + 1);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            handleSelectSubmission(submissions[currentIndex - 1], currentIndex - 1);
        }
    };

    const getMatchingProject = (submission) => {
        if (!submission || !projects) return null;
        const studentId = submission.student?._id || submission.student;
        return projects.find(p => {
            const creatorId = p.creator?._id || p.creator;
            return creatorId === studentId;
        });
    };

    const currentProject = getMatchingProject(selectedSubmission);

    const handleUnpublish = async () => {
        if (!currentProject) return;
        try {
            const response = await htmlProjectAPI.teacherUnpublishProject(currentProject._id);
            if (response.success) {
                message.success('已取消发布');
                onRefresh();
            }
        } catch (error) {
            console.error('取消发布失败:', error);
            message.error('取消发布失败');
        }
    };

    const handlePublish = async () => {
        if (!currentProject) return;
        try {
            const response = await htmlProjectAPI.teacherPublishProject(currentProject._id);
            if (response.success) {
                message.success('发布成功（无积分消耗）');
                onRefresh();
            }
        } catch (error) {
            console.error('发布失败:', error);
            message.error('发布失败');
        }
    };

    const handleDelete = async () => {
        if (!currentProject) return;
        try {
            const response = await htmlProjectAPI.teacherDeleteProject(currentProject._id);
            if (response.success) {
                message.success('删除成功');
                onRefresh();
            }
        } catch (error) {
            console.error('删除失败:', error);
            message.error('删除失败');
        }
    };

    const handleQuickGrade = (gradeKey) => {
        setScore(gradeScoreMap[gradeKey]);
    };

    const handleSubmitGrade = async () => {
        if (!selectedSubmission) return;

        const submissionId = selectedSubmission._id;

        try {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });

            const response = await courseManagementAPI.gradeSubmission(submissionId, {
                grade: {
                    score: score,
                    feedback: feedback
                }
            });

            if (response.success) {
                message.success('评分成功');
                onRefresh(submissionId, { score: score, feedback, gradedAt: new Date() });
            }
        } catch (error) {
            console.error('评分失败:', error);
            message.error('评分失败');
        } finally {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    const isGrading = gradingState?.[selectedSubmission?._id]?.loading;

    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无提交记录" />;
    }

    // Use project.code directly from the projects list (already fetched by getProjectsByLesson)
    const projectCode = currentProject?.code || '';

    return (
        <Row gutter={16} style={{ height: 'calc(100vh - 200px)' }}>
            {/* Student List */}
            <Col span={4} style={{ height: '100%' }}>
                <Card
                    title={`学生列表 (${submissions.length})`}
                    size="small"
                    bodyStyle={{ padding: 0, height: 'calc(100% - 40px)', overflowY: 'auto' }}
                    style={{ height: '100%' }}
                >
                    {submissions.map((submission, index) => {
                        const isSelected = selectedSubmission?._id === submission._id;
                        const studentName = submission.student?.name || '未知学生';
                        const isGraded = submission.status === 'graded';
                        const hasProject = !!getMatchingProject(submission);

                        return (
                            <div
                                key={submission._id}
                                onClick={() => handleSelectSubmission(submission, index)}
                                style={{
                                    padding: '10px 12px',
                                    borderBottom: '1px solid #f0f0f0',
                                    cursor: 'pointer',
                                    background: isSelected ? '#e6f7ff' : 'transparent',
                                    borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: isSelected ? 'bold' : 'normal' }}>{studentName}</span>
                                    <Space size={4}>
                                        {!hasProject && <Tag color="red">无作品</Tag>}
                                        <Tag color={isGraded ? 'green' : 'blue'}>{isGraded ? '已评' : '待评'}</Tag>
                                    </Space>
                                </div>
                                {submission.grade?.score !== undefined && (
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: 4 }}>
                                        得分: {submission.grade.score}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </Card>
            </Col>

            {/* Preview Area */}
            <Col span={14} style={{ height: '100%' }}>
                <Card
                    title={
                        <Space>
                            <span>网页预览</span>
                            {selectedSubmission && (
                                <Tag color="blue">{selectedSubmission.student?.name || '未知学生'}</Tag>
                            )}
                            {currentProject?.isPublished && <Tag color="cyan">已发布</Tag>}
                        </Space>
                    }
                    extra={
                        <Space>
                            <Button
                                icon={showSourceCode ? <EyeOutlined /> : <CodeOutlined />}
                                onClick={() => setShowSourceCode(!showSourceCode)}
                                disabled={!projectCode}
                            >
                                {showSourceCode ? '预览' : '源码'}
                            </Button>
                            <Divider type="vertical" />
                            <Button icon={<LeftOutlined />} onClick={handlePrev} disabled={currentIndex <= 0} />
                            <span>{currentIndex + 1} / {submissions.length}</span>
                            <Button icon={<RightOutlined />} onClick={handleNext} disabled={currentIndex >= submissions.length - 1} />
                        </Space>
                    }
                    bodyStyle={{ padding: 0, height: 'calc(100% - 58px)', overflow: 'hidden' }}
                    style={{ height: '100%' }}
                >
                    {projectCode ? (
                        showSourceCode ? (
                            <pre style={{
                                width: '100%',
                                height: '100%',
                                margin: 0,
                                padding: 16,
                                overflow: 'auto',
                                background: '#1e1e1e',
                                color: '#d4d4d4',
                                fontSize: 13,
                                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all'
                            }}>
                                <code>{projectCode}</code>
                            </pre>
                        ) : (
                            <iframe
                                srcDoc={projectCode}
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Project Preview"
                                sandbox="allow-scripts"
                            />
                        )
                    ) : (
                        <Empty
                            description="该学生暂未提交网页作品"
                            style={{ marginTop: '100px' }}
                        />
                    )}
                </Card>
            </Col>

            {/* Grading Panel */}
            <Col span={6} style={{ height: '100%' }}>
                <Card title="评分操作" size="small" style={{ height: '100%' }} bodyStyle={{ overflowY: 'auto', height: 'calc(100% - 40px)' }}>
                    {selectedSubmission ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {/* Project Stats/Actions */}
                            {currentProject && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>作品管理:</div>
                                    <Space wrap>
                                        {currentProject.isPublished ? (
                                            <Popconfirm title="确定取消发布?" onConfirm={handleUnpublish}>
                                                <Button size="small" icon={<UndoOutlined />}>取消发布</Button>
                                            </Popconfirm>
                                        ) : (
                                            <Popconfirm title="确定发布此作品？（无积分消耗）" onConfirm={handlePublish}>
                                                <Button size="small" type="primary" icon={<CheckOutlined />}>发布</Button>
                                            </Popconfirm>
                                        )}
                                        <Popconfirm title="确定删除?" onConfirm={handleDelete} okButtonProps={{ danger: true }}>
                                            <Button size="small" icon={<DeleteOutlined />} danger type="dashed">删除作品</Button>
                                        </Popconfirm>
                                    </Space>
                                    <Divider style={{ margin: '12px 0' }} />
                                </div>
                            )}

                            <div>
                                <div style={{ marginBottom: 8, color: '#666' }}>快捷评分:</div>
                                <Radio.Group value={Object.entries(gradeScoreMap).find(([_, v]) => v === score)?.[0]} onChange={e => handleQuickGrade(e.target.value)}>
                                    {Object.keys(gradeScoreMap).map(k => <Radio.Button key={k} value={k}>{k}</Radio.Button>)}
                                </Radio.Group>
                            </div>

                            <div style={{ marginTop: 16 }}>
                                <div style={{ marginBottom: 8, color: '#666' }}>分数 (0-10):</div>
                                <InputNumber min={0} max={10} value={score} onChange={setScore} style={{ width: '100%' }} />
                            </div>

                            <div style={{ marginTop: 16 }}>
                                <div style={{ marginBottom: 8, color: '#666' }}>评语:</div>
                                <TextArea rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="输入评语..." />
                            </div>

                            <div style={{ marginTop: 24 }}>
                                <Button
                                    type="primary"
                                    block
                                    icon={<SaveOutlined />}
                                    onClick={handleSubmitGrade}
                                    loading={isGrading}
                                >
                                    提交评分
                                </Button>
                            </div>
                        </Space>
                    ) : (
                        <Empty description="请选择学生" />
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default HtmlReview;
