import useOfficeGradingReport from './useOfficeGradingReport';
import BatchGradeProgress from './BatchGradeProgress';
import React, { useState, useEffect, useRef, Component } from 'react';
import { Card, Space, Tag, Button, Empty, message, Row, Col, Radio, Input, Spin, Tooltip, Divider, List, Typography, Collapse, Alert, Result, Tabs, Table, Dropdown } from 'antd';
import { selectOfficeBatchSubmissions } from './officeBatchSelection';
import { getAutoGrade } from '../../../../utils/submissionGrading';
import { SaveOutlined, LeftOutlined, RightOutlined, DownloadOutlined, ThunderboltOutlined, EyeOutlined, ProjectOutlined, LinkOutlined, CheckOutlined, CloseOutlined, WarningOutlined, FileOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { reviewAPI } from '../../../../services/reviewAPI';
import { courseManagementAPI, API_BASE_URL } from '../../../../services/api';

const { TextArea } = Input;

// Error Boundary to catch errors from pptxjs DOM manipulation
class PptErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[PptReview] Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 20, textAlign: 'center' }}>
                    <Alert
                        type="warning"
                        message="PPT预览加载出现问题"
                        description="该PPT文件可能包含不支持的元素，但分析功能仍然可用。请下载原文件使用PowerPoint查看。"
                        showIcon
                        icon={<WarningOutlined />}
                    />
                </div>
            );
        }
        return this.props.children;
    }
}

// 动态加载脚本助手函数
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

const loadCss = (href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
};

/**
 * PptReview - PPT文件批阅组件
 * 用于查看和批阅学生提交的PPT文件，支持动画分析
 */
const PptReview = ({
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
    const selectedIdRef = useRef(null);
    const resultCache = useRef({});
    const [batchProgress, setBatchProgress] = useState(null);
    const [expandedRuleKeys, setExpandedRuleKeys] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [pptAnalysis, setPptAnalysis] = useState(null);
    const [libLoaded, setLibLoaded] = useState(false);
    const [debugInfo, setDebugInfo] = useState({ libs: 'pending', fetch: 'pending', render: 'pending' });
    const [autoGradeLoading, setAutoGradeLoading] = useState(false);
    const [batchAutoGradeLoading, setBatchAutoGradeLoading] = useState(false);
    const [autoGradeResult, setAutoGradeResult] = useState(null);
    const [activeTab, setActiveTab] = useState('autoGrade');
    const previewRef = useRef(null);

    // 评分状态
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);

    const gradeScoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };

    // State for iframe blob URL and ref
    const [docBlobUrl, setDocBlobUrl] = useState(null);
    const iframeRef = useRef(null);

    const {loading:reportLoading,error:reportError}=useOfficeGradingReport(selectedSubmission,'pptAutoGrade',resultCache,setAutoGradeResult);

    // Send blob URL to iframe when it loads
    useEffect(() => {
        if (!docBlobUrl || !iframeRef.current) return;

        // Use a flag to ensure we only send the blob URL once
        let hasSentBlobUrl = false;

        const handleMessage = (event) => {
            if (event.data?.type === 'pptx-ready') {
                if (hasSentBlobUrl) {
                    console.log('[PptReview] Ignoring duplicate pptx-ready message');
                    return;
                }
                hasSentBlobUrl = true;
                console.log('[PptReview] Iframe ready, sending blob URL');
                iframeRef.current?.contentWindow?.postMessage(
                    { type: 'load-pptx', blobUrl: docBlobUrl },
                    '*'
                );
            } else if (event.data?.type === 'pptx-success') {
                console.log('[PptReview] Iframe rendered successfully:', event.data.slideCount, 'slides');
                setDebugInfo(prev => ({ ...prev, render: `OK (${event.data.slideCount} slides)` }));
            } else if (event.data?.type === 'pptx-error') {
                console.error('[PptReview] Iframe error:', event.data.message);
                setDebugInfo(prev => ({ ...prev, render: 'ERROR: ' + event.data.message }));
            }
        };

        window.addEventListener('message', handleMessage);

        return () => window.removeEventListener('message', handleMessage);
    }, [docBlobUrl]);

    // 初始化依赖库 (仅加载JSZip用于分析)
    useEffect(() => {
        const initLibs = async () => {
            console.log('[PptReview] Starting library initialization...');
            setDebugInfo(prev => ({ ...prev, libs: 'loading...' }));
            try {
                // 只加载 JSZip v2 用于 PPT 结构分析
                if (!window.JSZip) {
                    console.log('[PptReview] Loading JSZip v2...');
                    await loadScript('/libs/pptxjs/jszip.min.js');
                    console.log('[PptReview] JSZip loaded. Version:', window.JSZip?.version || 'v2');
                }

                console.log('[PptReview] Libraries loaded successfully!');
                setDebugInfo(prev => ({ ...prev, libs: 'OK (JSZip ready)' }));
                setLibLoaded(true);
            } catch (err) {
                console.error('[PptReview] Failed to load libraries:', err);
                setDebugInfo(prev => ({ ...prev, libs: 'FAILED: ' + err.message }));
                message.error('无法加载分析组件: ' + err.message);
            }
        };
        initLibs();
    }, []);

    // Keep the selected object synchronized with refreshed records and class filters.
    useEffect(() => {
        for (const item of submissions || []) if (!getAutoGrade(item, 'pptAutoGrade')) delete resultCache.current[item._id];
        const index = (submissions || []).findIndex(item => item._id === selectedIdRef.current);
        const next = index >= 0 ? submissions[index] : submissions?.[0];
        if (next) {
            selectedIdRef.current = next._id;
            setSelectedSubmission(next);
            setCurrentIndex(index >= 0 ? index : 0);
        } else {
            selectedIdRef.current = null;
            setSelectedSubmission(null);
            setCurrentIndex(-1);
            setAutoGradeResult(null);
        }
    }, [submissions]);

    // 选择学生时更新评分状态
    useEffect(() => {
        if (selectedSubmission) {
            setScore(selectedSubmission.grade?.score ?? null);
            setFeedback(selectedSubmission.grade?.feedback || '');
            setExpandedRuleKeys([]);
            setShowFeedback(false);

            // 加载PPT分析和预览 (如果库加载完成)
            if (libLoaded && selectedSubmission._id) {
                loadPptData(selectedSubmission);
            }
        }
    }, [selectedSubmission, libLoaded]);

    // 加载PPT数据
    const loadPptData = async (submission) => {
        console.log('[PptReview] loadPptData called. Submission:', submission._id);

        if (!submission?._id) return;

        const token = localStorage.getItem('token');
        const downloadUrl = `/api/submissions/${submission._id}/download?token=${token}`;

        setLoading(true);
        setPptAnalysis(null);
        setDebugInfo(prev => ({ ...prev, fetch: 'loading...', render: 'pending' }));

        // 清理旧的 blob URL
        if (docBlobUrl) {
            URL.revokeObjectURL(docBlobUrl);
            setDocBlobUrl(null);
        }

        // 清理旧的预览
        if (previewRef.current) {
            previewRef.current.innerHTML = '';
        }

        try {
            console.log('[PptReview] Fetching file from:', downloadUrl);
            const response = await fetch(downloadUrl);
            console.log('[PptReview] Fetch response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            if (selectedIdRef.current !== submission._id) return;
            console.log('[PptReview] File downloaded. Blob size:', blob.size, 'Type:', blob.type);
            setDebugInfo(prev => ({ ...prev, fetch: 'OK (size: ' + blob.size + ')' }));

            // Create blob URL for DocViewer
            const blobUrl = URL.createObjectURL(blob);
            console.log('[PptReview] Created blob URL for DocViewer:', blobUrl);
            setDocBlobUrl(blobUrl);

            // 2. 使用 JSZip 分析
            await analyzePptStructure(blob, submission._id);
            if (selectedIdRef.current !== submission._id) return;

            // 3. 使用 pptxjs 预览 (disabled)
            renderPptx(blob);

        } catch (error) {
            console.error('[PptReview] 加载PPT失败:', error);
            if (selectedIdRef.current !== submission._id) return;
            setDebugInfo(prev => ({ ...prev, fetch: 'FAILED: ' + error.message }));
            message.error('加载PPT文件失败');
        } finally {
            if (selectedIdRef.current === submission._id) setLoading(false);
        }
    };

    // 分析 PPT 结构
    const analyzePptStructure = async (blob, submissionId) => {
        try {
            // Read Blob as ArrayBuffer for JSZip v2
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });

            if (!window.JSZip || !window.DOMParser) {
                console.warn('[PptReview] Analysis skipped: JSZip or DOMParser missing');
                return;
            }

            const zip = new window.JSZip(arrayBuffer);

            const analysis = {
                slides: [],
                totalAnimations: 0,
                totalTransitions: 0,
                totalLinks: 0
            };

            const slideFiles = Object.keys(zip.files).filter(name => name.match(/ppt\/slides\/slide\d+\.xml/));

            // Sort natural order
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                return numA - numB;
            });

            for (const fileName of slideFiles) {
                const slideNum = parseInt(fileName.match(/slide(\d+)\.xml/)[1]);
                const content = zip.file(fileName).asText();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(content, 'text/xml');
                // 检查动画
                const timingNodes = xmlDoc.getElementsByTagName('p:tnLst');
                // timingNodes[0].childNodes contains the sequence of animations
                const animationCount = (timingNodes.length > 0 && timingNodes[0].childNodes) ? timingNodes[0].childNodes.length : 0;
                const hasAnimation = animationCount > 0;

                // 检查切换
                const transitionNodes = xmlDoc.getElementsByTagName('p:transition');
                const hasTransition = transitionNodes.length > 0;

                // 检查超链接 (直接在 slide XML 中查找点击动作)
                // <a:hlinkClick> 元素用于定义形状或文本的点击行为 (包括内部跳转和外部链接)
                const linkNodes = xmlDoc.getElementsByTagName('a:hlinkClick');
                const linkCount = linkNodes.length;

                if (hasAnimation) analysis.totalAnimations++;
                if (hasTransition) analysis.totalTransitions++;
                analysis.totalLinks += linkCount;

                analysis.slides.push({
                    index: slideNum,
                    fileName,
                    hasAnimation,
                    animationCount,
                    hasTransition,
                    linkCount
                });
            }

            if (selectedIdRef.current === submissionId) setPptAnalysis(analysis);

        } catch (err) {
            console.error('分析 PPT 结构失败', err);
        }
    };

    // 渲染 PPTX
    // Note: pptxjs visual rendering is disabled due to property descriptor conflicts
    // with React's development mode. The analysis functionality still works.
    const renderPptx = (blob) => {
        console.log('[PptReview] renderPptx called - visual preview disabled due to compatibility issues');
        console.log('[PptReview] Use the download button to view the PPT in PowerPoint');

        // Only log for debugging, don't try to render with pptxjs
        // This avoids property descriptor conflicts that crash React
        setDebugInfo({
            libs: 'OK',
            fetch: 'OK',
            render: 'Disabled - use download'
        });
    };

    // 选择学生
    const handleSelectSubmission = (submission, index) => {
        selectedIdRef.current = submission._id;
        setExpandedRuleKeys([]);
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

    // PPT自动批阅
    const handleAutoGrade = async () => {
        if (!selectedSubmission?._id) return;
        const submissionId = selectedSubmission._id;

        try {
            setAutoGradeLoading(true);
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: true });
            const response = await reviewAPI.autoGradePptSubmission(submissionId);
            if (response.success) {
                const result = response.data.submission?.pptAutoGrade || response.data;
                resultCache.current[submissionId] = result;
                message.success(`自动批阅完成：${result.score}分`);
                if (selectedIdRef.current === submissionId) {
                    setScore(result.score);
                    setFeedback(result.feedback || '');
                    setAutoGradeResult(result);
                    setActiveTab('autoGrade');
                }
                if (onRefresh) {
                    onRefresh(submissionId, {
                        score: result.score,
                        feedback: result.feedback,
                        gradedAt: result.gradedAt,
                        source: 'ppt_auto',
                        pptAutoGrade: result
                    });
                }
            }
        } catch (error) {
            const msg = error?.response?.data?.message || '自动批阅失败';
            message.error(msg);
        } finally {
            setAutoGradeLoading(false);
            if (onUpdateGradingState) onUpdateGradingState(submissionId, { loading: false });
        }
    };

    // 批量PPT自动批阅
    const handleBatchAutoGrade = async (includeGraded = false) => {
        if (!submissions || submissions.length === 0) {
            message.warning('当前没有任何提交记录');
            return;
        }

        const ungradedSubmissions = selectOfficeBatchSubmissions(submissions, includeGraded, 'pptAutoGrade', resultCache.current);
        if (ungradedSubmissions.length === 0) {
            message.info('没有需要批阅的作业');
            return;
        }

        setBatchAutoGradeLoading(true);
        setBatchProgress({total:ungradedSubmissions.length,processed:0,failed:0,current:''});
        message.loading({ content: `正在批量批阅 ${ungradedSubmissions.length} 份作业...`, key: 'batchGrade' });

        let successCount = 0;
        let failCount = 0;

        for (const sub of ungradedSubmissions) {
            setBatchProgress(p => ({...p,current:sub.student?.name || '未知学生'}));
            try {
                if (onUpdateGradingState) onUpdateGradingState(sub._id, { loading: true });
                const response = await reviewAPI.autoGradePptSubmission(sub._id);
                if (response.success) {
                    successCount++;
                    resultCache.current[sub._id] = response.data.submission?.pptAutoGrade || response.data;
                    if (onRefresh) {
                        onRefresh(sub._id, {
                            score: response.data.score,
                            feedback: response.data.feedback,
                            gradedAt: new Date(),
                            source: 'ppt_auto',
                            pptAutoGrade: resultCache.current[sub._id]
                        });
                    }
                    if (selectedIdRef.current === sub._id) {
                        setScore(response.data.score);
                        setFeedback(response.data.feedback || '');
                        setAutoGradeResult(resultCache.current[sub._id]);
                        setActiveTab('autoGrade');
                    }
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Failed to grade submission ${sub._id}:`, error);
            } finally {
                setBatchProgress(p => ({...p,processed:p.processed + 1,failed:failCount}));
                if (onUpdateGradingState) onUpdateGradingState(sub._id, { loading: false });
            }
        }

        setBatchAutoGradeLoading(false);
        if (failCount > 0) {
            message.warning({ content: `批量批阅结束：${successCount} 份成功，${failCount} 份失败`, key: 'batchGrade', duration: 4 });
        } else {
            message.success({ content: `批量批阅完成，共批阅 ${successCount} 份！`, key: 'batchGrade', duration: 3 });
        }
    };

    // 下载原文件
    const handleDownloadFile = () => {
        if (selectedSubmission?.content?.file && onDownload) {
            onDownload(selectedSubmission.content.file);
        }
    };

    const isGrading = gradingState?.[selectedSubmission?._id]?.loading;


    const autoGradeColumns = [
        {
            title: '状态',
            key: 'status',
            width: 80,
            align: 'center',
            render: (_, record) => record.passed
                ? <CheckOutlined style={{ color: '#389e0d', fontSize: 16 }} />
                : <CloseOutlined style={{ color: '#cf1322', fontSize: 16 }} />
        },
        {
            title: '检测项',
            dataIndex: 'title',
            key: 'title',
            width: '35%',
            render: (text,record) => <span style={{ fontWeight: 500 }}>{record.details?.length ? <span style={{marginRight:6,color:'#1677ff'}}>{expandedRuleKeys.includes(record.key) ? '−' : '+'}</span> : null}{text}</span>
        },
        {
            title: '结果/反馈',
            dataIndex: 'summary',
            key: 'summary',
            render: (text) => text ? <span style={{ color: '#555', fontSize: 13 }}>{text}</span> : '-'
        },
        {
            title: '得分',
            key: 'score',
            width: 130,
            align: 'center',
            render: (_, record) => (
                <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: record.score === record.maxScore ? '#389e0d' : '#faad14' }}>
                    {record.score} / {record.maxScore}
                </span>
            )
        }
    ];

    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无PPT作业提交记录" />;
    }

    return (
        <Row gutter={8} style={{ height: 'calc(100vh - 180px)' }}>
            {/* 左侧: 学生列表 + 评分 + 分析结果 */}
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

                {/* 学生列表 */}
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

            {/* 右侧: PPT预览 */}
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
                            <span style={{ fontWeight: 500 }}>PPT预览</span>
                            {selectedSubmission?.content?.file?.originalName && (
                                <span style={{ fontSize: 12, color: '#888' }}>
                                    {selectedSubmission.content.file.originalName}
                                </span>
                            )}
                        </Space>
                        <Space>
                        <Button
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            onClick={handleAutoGrade}
                            loading={autoGradeLoading}
                            disabled={!selectedSubmission || isGrading || batchAutoGradeLoading}
                        >
                            自动批阅
                        </Button>
                        <Dropdown menu={{ items: [
                            { key: 'ungraded', label: '仅批阅未批阅作业' },
                            { key: 'all', label: '全部重新批阅（含已批阅）' }
                        ], onClick: ({ key }) => handleBatchAutoGrade(key === 'all') }} trigger={['click']} disabled={isGrading || autoGradeLoading || batchAutoGradeLoading || !submissions?.length}>
                            <Button loading={batchAutoGradeLoading} disabled={isGrading || autoGradeLoading || !submissions?.length}>批量批阅 ▾</Button>
                        </Dropdown>
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

                    <BatchGradeProgress progress={batchProgress} />
                    {/* Tabs 切换区域 */}
                    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '0 12px' }}>
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            items={[
                                { label: '自动评分结果', key: 'autoGrade' },
                                { label: '预览', key: 'preview' }
                            ]}
                            style={{ marginBottom: -1 }} // 让 active tab 底边与 border 重合
                        />
                    </div>

                    {reportLoading && <Spin tip="正在加载评阅详情" />}
                    {reportError && <Alert type="error" message={reportError} />}
                    {/* 内容区域 */}
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', backgroundColor: '#fff' }}>
                        {/* 预览 Tab 内容 */}
                        <div style={{
                            display: activeTab === 'preview' ? 'block' : 'none',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: '#fff',
                            overflow: 'hidden'
                        }}>
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
                                    color: '#666',
                                    background: 'rgba(255,255,255,0.8)'
                                }}>
                                    <Spin size="large" tip="正在加载PPT..." />
                                </div>
                            )}

                            {docBlobUrl ? (
                                <iframe
                                    ref={iframeRef}
                                    src="/pptx-preview.html"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        border: 'none',
                                        background: '#fff'
                                    }}
                                    title="PPT Preview"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            ) : (
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}>
                                    <Empty
                                        description={selectedSubmission ? "正在加载预览..." : "请在左侧选择学生查看详情"}
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                </div>
                            )}
                        </div>

                        {/* 自动评分结果 Tab 内容 */}
                        <div style={{
                            display: activeTab === 'autoGrade' ? 'block' : 'none',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            overflowY: 'auto',
                            padding: 24,
                            background: '#fff'
                        }}>
                            {autoGradeResult ? (
                                <div>
                                    <div style={{ padding: '12px 16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: 15, fontWeight: 600, color: '#389e0d' }}>
                                            自动批阅总分：{autoGradeResult.score} 分
                                        </div>
                                        <div style={{ fontSize: 13, color: '#666' }}>
                                            通过 {autoGradeResult.passedCount || 0}/{autoGradeResult.totalRules || 0} 项检测
                                        </div>
                                    </div>

                                    {autoGradeResult.results?.length > 0 && (
                                        <Table
                                            dataSource={autoGradeResult.results.map((r, i) => ({ ...r, key: i }))}
                                            columns={autoGradeColumns}
                                            scroll={{ x: 720 }}
                                            tableLayout="fixed"
                                            expandable={{
                                                showExpandColumn: false,
                                                expandRowByClick: true,
                                                expandedRowKeys: expandedRuleKeys,
                                                onExpandedRowsChange: setExpandedRuleKeys,
                                                rowExpandable: record => !!record.details?.length,
                                                expandedRowRender: record => <Table size="small" columns={autoGradeColumns} dataSource={record.details.map((item,index)=>({...item,key:index}))} pagination={false} />
                                            }}
                                            size="small"
                                            pagination={false}
                                            bordered
                                            style={{ marginTop: 16 }}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    <Empty
                                        description="暂无自动批阅记录"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Col>
        </Row>
    );
};

export default PptReview;
