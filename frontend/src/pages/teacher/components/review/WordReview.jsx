import React, { useState, useEffect, useRef } from 'react';
import { Card, Space, Tag, Button, Empty, message, Row, Col, Radio, Input, Spin, Tooltip, Divider, List, Typography } from 'antd';
import { SaveOutlined, LeftOutlined, RightOutlined, DownloadOutlined, FileWordOutlined, CheckOutlined, CloseOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { renderAsync } from 'docx-preview';
import { courseManagementAPI } from '../../../../services/api';

const { TextArea } = Input;

/**
 * WordReview - Word文件批阅组件
 * 用于查看和批阅学生提交的Word文件
 */
const WordReview = ({
    submissions,
    onRefresh,
    formatClassName,
    gradingState,
    onUpdateGradingState,
    onDownload,
    sortMode,
    onSortChange
}) => {
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const previewRef = useRef(null);

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

            // 加载Word预览
            if (selectedSubmission._id) {
                loadWordData(selectedSubmission);
            }
        }
    }, [selectedSubmission]);

    // 加载Word数据
    const loadWordData = async (submission) => {
        if (!submission?._id) return;

        const token = localStorage.getItem('token');
        const downloadUrl = `/api/submissions/${submission._id}/download?token=${token}`;

        setLoading(true);

        // 清理旧的预览
        if (previewRef.current) {
            previewRef.current.innerHTML = '';
        }

        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();

            // 渲染 Word
            if (previewRef.current) {
                await renderAsync(blob, previewRef.current, previewRef.current, {
                    className: "docx", // class name/prefix for default styles
                    inWrapper: true, // enables rendering of wrapper around document content
                    ignoreWidth: false, // disables rendering width of page
                    ignoreHeight: false, // disables rendering height of page
                    ignoreFonts: false, // disables fonts rendering
                    breakPages: true, // enables page breaking on page breaks
                    ignoreLastRenderedPageBreak: false, // Changed to false to better respect doc structure
                    experimental: true, // Enables experimental features for better rendering
                    trimXmlDeclaration: true, // if true, xml declaration will be removed from xml documents before parsing
                    useBase64URL: true, // Use base64 for images
                    debug: false,
                });
            }

        } catch (error) {
            console.error('加载Word失败:', error);
            message.error('加载Word文件失败');
            if (previewRef.current) {
                previewRef.current.innerHTML = '<div style="padding: 20px; color: red;">加载失败，请尝试下载原文件查看</div>';
            }
        } finally {
            setLoading(false);
        }
    };

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

    // 快捷评分
    const handleQuickGrade = async (gradeKey) => {
        if (!selectedSubmission) return;
        const newScore = gradeScoreMap[gradeKey];
        const submissionId = selectedSubmission._id;

        // 如果点击的是当前已选的等级，则清除评分
        const isClearing = score === newScore;
        const finalScore = isClearing ? null : newScore;

        try {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });
            const response = await courseManagementAPI.gradeSubmission(submissionId, {
                grade: { score: finalScore, feedback: feedback }
            });
            if (response.success) {
                message.success(isClearing ? '已清除评分' : `评分 ${gradeKey} (${newScore}分) 成功`);
                setScore(finalScore);
                // 传递完整的状态更新
                if (onRefresh) {
                    if (isClearing) {
                        onRefresh(submissionId, { score: null, feedback: null, gradedAt: null });
                    } else {
                        onRefresh(submissionId, { score: finalScore, feedback, gradedAt: new Date() });
                    }
                }
                if (!isClearing && currentIndex < submissions.length - 1) setTimeout(() => handleNext(), 300);
            }
        } catch (error) {
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
            const response = await courseManagementAPI.gradeSubmission(submissionId, {
                grade: { score: score, feedback: feedback }
            });
            if (response.success) {
                message.success('评语保存成功');
                setShowFeedback(false);
                if (onRefresh) onRefresh(submissionId, { score, feedback, gradedAt: new Date() });
            }
        } catch (error) {
            message.error('保存评语失败');
        } finally {
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    // 下载原文件
    const handleDownloadFile = () => {
        if (selectedSubmission?.content?.file && onDownload) {
            onDownload(selectedSubmission.content.file);
        }
    };

    const isGrading = gradingState?.[selectedSubmission?._id]?.loading;

    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无Word作业提交记录" />;
    }

    return (
        <Row gutter={8} style={{ height: 'calc(100vh - 180px)' }}>
            {/* 左侧: 学生列表 + 评分 */}
            <Col span={6} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* 评分区域 */}
                <div style={{ marginBottom: 8, padding: '8px', background: '#fafafa', borderRadius: 4 }}>
                    <div style={{ marginBottom: 6, fontSize: 12, color: '#666' }}>快捷评分:</div>
                    <Radio.Group
                        value={Object.entries(gradeScoreMap).find(([_, v]) => v === score)?.[0]}
                        optionType="button"
                        buttonStyle="solid"
                        size="small"
                        disabled={!selectedSubmission || isGrading}
                        style={{ width: '100%', display: 'flex' }}
                    >
                        {Object.keys(gradeScoreMap).map(k => (
                            <Radio.Button key={k} value={k} style={{ flex: 1, textAlign: 'center', padding: 0 }} onClick={() => handleQuickGrade(k)}>{k}</Radio.Button>
                        ))}
                    </Radio.Group>
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                        <Button
                            size="small"
                            type="link"
                            onClick={() => setShowFeedback(!showFeedback)}
                            style={{ padding: 0, fontSize: 12 }}
                        >
                            {showFeedback ? '收起评语' : '添加评语'}
                        </Button>
                    </div>
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
                            block
                        >
                            保存评语
                        </Button>
                    </div>
                )}

                {/* 学生列表 (占据剩余空间) */}
                <div style={{ flex: 1, overflow: 'hidden', border: '1px solid #f0f0f0', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', fontSize: 13, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {submissions.map((submission, index) => {
                            const isSelected = selectedSubmission?._id === submission._id;
                            const studentName = submission.student?.name || '未知学生';
                            const isGraded = submission.status === 'graded';

                            return (
                                <div
                                    key={submission._id}
                                    onClick={() => handleSelectSubmission(submission, index)}
                                    style={{
                                        padding: '6px 10px',
                                        borderBottom: '1px solid #f0f0f0',
                                        cursor: 'pointer',
                                        background: isSelected ? '#e6f7ff' : 'transparent',
                                        borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 12 }}>{studentName}</span>
                                        <Tag color={isGraded ? 'green' : 'blue'} style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                                            {isGraded && submission.grade?.score !== null && submission.grade?.score !== undefined ? submission.grade.score + '分' : '待'}
                                        </Tag>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Col>

            {/* 右侧: Word预览 */}
            <Col span={18} style={{ height: '100%' }}>
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
                            <FileWordOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontWeight: 500 }}>Word预览</span>
                            {selectedSubmission?.content?.file?.originalName && (
                                <span style={{ fontSize: 12, color: '#888' }}>
                                    {selectedSubmission.content.file.originalName}
                                </span>
                            )}
                        </Space>
                        <Space>
                            <Tooltip title="下载原文件">
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleDownloadFile}
                                    disabled={!selectedSubmission?.content?.file}
                                />
                            </Tooltip>
                            <span style={{ fontSize: 12, margin: '0 8px', color: '#999' }}>|</span>
                            <Button size="small" icon={<LeftOutlined />} onClick={handlePrev} disabled={currentIndex <= 0} />
                            <span style={{ fontSize: 12 }}>{currentIndex + 1} / {submissions.length}</span>
                            <Button size="small" icon={<RightOutlined />} onClick={handleNext} disabled={currentIndex >= submissions.length - 1} />
                        </Space>
                    </div>

                    {/* Word内容区域 */}
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', backgroundColor: '#f5f5f5' }}>
                        {/* Inject custom styles for docx fixes */}
                        <style>{`
                            .docx-wrapper { 
                                padding: 20px; 
                                background: transparent !important; 
                                display: flex; 
                                flex-direction: column; 
                                alignItems: center; 
                            }
                            .docx-wrapper > section.docx { 
                                margin-bottom: 20px; 
                                box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
                                overflow: visible !important; /* Allow content to overflow page if needed */
                            }
                        `}</style>

                        {loading && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 10,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.7)'
                            }}>
                                <Spin size="large" tip="正在加载Word..." />
                            </div>
                        )}

                        {selectedSubmission ? (
                            <div
                                ref={previewRef}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    overflow: 'auto', // Handle both X and Y overflow
                                    // padding and flex handled by .docx-wrapper
                                }}
                            >
                                {/* Word渲染区域 */}
                            </div>
                        ) : (
                            <Empty
                                description="请选择学生查看Word"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                style={{ marginTop: '100px' }}
                            />
                        )}
                    </div>
                </div>
            </Col>
        </Row>
    );
};

export default WordReview;
