import useOfficeGradingReport from './useOfficeGradingReport';
import BatchGradeProgress from './BatchGradeProgress';
import React, { useState, useEffect, useRef } from 'react';
import { Card, Space, Tag, Button, Empty, message, Row, Col, Radio, Input, Spin, Tooltip, Alert, Table, Switch, Tabs, Dropdown } from 'antd';
import { selectOfficeBatchSubmissions } from './officeBatchSelection';
import { getAutoGrade } from '../../../../utils/submissionGrading';
import { SaveOutlined, LeftOutlined, RightOutlined, DownloadOutlined, SortAscendingOutlined } from '@ant-design/icons';
import SpreadsheetEditor from '../../../../components/Spreadsheet/SpreadsheetEditor';
import { reviewAPI } from '../../../../services/reviewAPI';
import { courseManagementAPI } from '../../../../services/api';

const { TextArea } = Input;

/**
 * ExcelReview - Excel文件批阅组件
 * 用于查看和批阅学生提交的Excel文件
 */
const ExcelReview = ({
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
    const [excelData, setExcelData] = useState(null);
    const [loadingExcel, setLoadingExcel] = useState(false);
    const [excelWarning, setExcelWarning] = useState(''); // 截断或错误提示
    const [showDownloadHint, setShowDownloadHint] = useState(false); // 是否提示下载原文件

    // 评分状态
    const [autoBusy, setAutoBusy] = useState(false);
    const [onlyErrors, setOnlyErrors] = useState(true);
    const [autoResult, setAutoResult] = useState(null);
    const [activeTab, setActiveTab] = useState('autoGrade');
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [showFeedback, setShowFeedback] = useState(false);

    const gradeScoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };

    // Keep the selected object synchronized with refreshed records and class filters.
    useEffect(() => {
        for (const item of submissions || []) if (!getAutoGrade(item, 'excelAutoGrade')) delete resultCache.current[item._id];
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
            setAutoResult(null);
        }
    }, [submissions]);

    // 选择学生时更新评分状态
    useEffect(() => {
        if (selectedSubmission) {
            setScore(selectedSubmission.grade?.score ?? null);
            setFeedback(selectedSubmission.grade?.feedback || '');
            setExpandedRuleKeys([]);
            setShowFeedback(false);
            setOnlyErrors(true);
        }
    }, [selectedSubmission]);

    const {loading:reportLoading,error:reportError}=useOfficeGradingReport(selectedSubmission,'excelAutoGrade',resultCache,setAutoResult);

    useEffect(()=>{if(activeTab==='preview' && selectedSubmission)loadExcelData(selectedSubmission);},[activeTab,selectedSubmission?._id,selectedSubmission?.content?.file?.filename]);

    // 加载Excel数据
    const loadExcelData = async (submission) => {
        if (!submission?._id) return;

        setLoadingExcel(true);
        setExcelData(null);
        setExcelWarning('');
        setShowDownloadHint(false);

        try {
            const response = await reviewAPI.getExcelData(submission._id);
            if (selectedIdRef.current !== submission._id) return;
            if (response.success) {
                setExcelData(response.data);
                // 处理截断提示
                if (response.isTruncated && response.truncationMessage) {
                    setExcelWarning(response.truncationMessage);
                    setShowDownloadHint(true);
                }
            } else {
                // 处理错误，可能需要下载原文件
                setExcelWarning(response.message || '加载Excel数据失败');
                if (response.canDownload) {
                    setShowDownloadHint(true);
                }
                message.warning(response.message || '加载Excel数据失败');
            }
        } catch (error) {
            if (selectedIdRef.current !== submission._id) return;
            console.error('加载Excel数据失败:', error);
            const errMsg = error.response?.data?.message || '加载Excel数据失败';
            setExcelWarning(errMsg);
            if (error.response?.data?.canDownload) {
                setShowDownloadHint(true);
            }
            message.error(errMsg);
        } finally {
            if (selectedIdRef.current === submission._id) setLoadingExcel(false);
        }
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

    const handleAutoGrade = async () => {
        if (!selectedSubmission) return;
        const id = selectedSubmission._id;
        setAutoBusy(true);
        try {
            const response = await reviewAPI.autoGradeExcelSubmission(id);
            if (response.success) {
                const result = response.data.submission.excelAutoGrade;
                resultCache.current[id] = result;
                if (selectedIdRef.current === id) {
                    setAutoResult(result);
                    setActiveTab('autoGrade');
                    setScore(result.score); setFeedback(result.feedback);
                }
                if (onRefresh) onRefresh(id, { score: result.score, feedback: result.feedback, gradedAt: result.gradedAt, excelAutoGrade: result });
                message.success('Excel自动评阅完成');
            }
        } catch (e) { message.error(e.response?.data?.error || e.response?.data?.message || '自动评阅失败'); }
        finally { setAutoBusy(false); }
    };

    const handleBatchAutoGrade = async (includeGraded = false) => {
        const targets = selectOfficeBatchSubmissions(submissions, includeGraded, 'excelAutoGrade', resultCache.current);
        if (!targets.length) { message.info('没有需要批阅的作业'); return; }
        setAutoBusy(true);
        setBatchProgress({total:targets.length,processed:0,failed:0,current:''});
        let completed = 0, failed = 0;
        for (const submission of targets) {
            setBatchProgress(p => ({...p,current:submission.student?.name || '未知学生'}));
            try {
                const response = await reviewAPI.autoGradeExcelSubmission(submission._id);
                if (!response.success) { failed++; continue; }
                const result = response.data.submission.excelAutoGrade;
                resultCache.current[submission._id] = result;
                completed++;
                if (selectedIdRef.current === submission._id) {
                    setAutoResult(result);
                    setActiveTab('autoGrade');
                    setScore(result.score); setFeedback(result.feedback);
                }
                if (onRefresh) onRefresh(submission._id, {score:result.score,feedback:result.feedback,gradedAt:result.gradedAt,excelAutoGrade:result});
            } catch (e) { failed++; }
            finally { setBatchProgress(p => ({...p,processed:p.processed + 1,failed})); }
        }
        setAutoBusy(false);
        message.info(`批量评阅完成：${completed}份已评分，${failed}份失败`);
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

            const response = await courseManagementAPI.gradeSubmission(submissionId, {
                grade: {
                    score: finalScore,
                    feedback: feedback
                }
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

            const response = await courseManagementAPI.gradeSubmission(submissionId, {
                grade: {
                    score: score,
                    feedback: feedback
                }
            });

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

    // 下载原文件
    const handleDownloadFile = () => {
        if (selectedSubmission?.content?.file && onDownload) {
            onDownload(selectedSubmission.content.file);
        }
    };

    const isGrading = gradingState?.[selectedSubmission?._id]?.loading;

    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无Excel作业提交记录" />;
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
                            <Radio.Button
                                key={k}
                                value={k}
                                onClick={() => handleQuickGrade(k)}
                            >
                                {k}
                            </Radio.Button>
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
                            const studentName = submission.student?.name || '未知学生';
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
                                        {formatClassName?.(submission.student?.grade, submission.student?.className) || ''}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Col>

            {/* 右侧: Excel预览 */}
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
                            <span style={{ fontWeight: 500 }}>Excel预览</span>
                            {selectedSubmission && (
                                <Tag color="blue">{selectedSubmission.student?.name || '未知学生'}</Tag>
                            )}
                            {selectedSubmission?.content?.file?.originalName && (
                                <span style={{ fontSize: 12, color: '#888' }}>
                                    {selectedSubmission.content.file.originalName}
                                </span>
                            )}
                        </Space>
                        <Space>
                            <Button loading={autoBusy} disabled={!selectedSubmission} onClick={handleAutoGrade}>自动评阅</Button>
                            <Dropdown menu={{ items: [
                                { key: 'ungraded', label: '仅批阅未批阅作业' },
                                { key: 'all', label: '全部重新批阅（含已批阅）' }
                            ], onClick: ({ key }) => handleBatchAutoGrade(key === 'all') }} trigger={['click']} disabled={autoBusy || !submissions.length}>
                                <Button disabled={autoBusy || !submissions.length}>批量评阅 ▾</Button>
                            </Dropdown>
                            <Tooltip title="下载原文件">
                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={handleDownloadFile}
                                    disabled={!selectedSubmission?.content?.file}
                                />
                            </Tooltip>
                            <Button size="small" icon={<LeftOutlined />} onClick={handlePrev} disabled={currentIndex <= 0} />
                            <span style={{ fontSize: 12 }}>{currentIndex + 1} / {submissions.length}</span>
                            <Button size="small" icon={<RightOutlined />} onClick={handleNext} disabled={currentIndex >= submissions.length - 1} />
                        </Space>
                    </div>

                    <BatchGradeProgress progress={batchProgress} />
                    <div style={{ borderBottom: '1px solid #f0f0f0', padding: '0 12px', flexShrink: 0 }}>
                        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                            { label: '自动评分结果', key: 'autoGrade' },
                            { label: '预览', key: 'preview' }
                        ]} style={{ marginBottom: -1 }} />
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, display: activeTab === 'autoGrade' ? 'block' : 'none' }}>
                    {reportLoading && <Spin tip="正在加载评阅详情" />}
                    {reportError && <Alert type="error" message={reportError} />}
                    {autoResult ? <>
                        <Space><Tag color="blue">自动评分 {autoResult.score}/10 · 通过 {autoResult.passedCount}/{autoResult.totalRules}</Tag><Switch checked={onlyErrors} onChange={setOnlyErrors} checkedChildren="仅看错题" unCheckedChildren="全部得分点" /></Space>
                        <Table size="small" rowKey="id" pagination={{pageSize: 10}} scroll={{x:720}} expandable={{showExpandColumn:false,expandRowByClick:true,expandedRowKeys:expandedRuleKeys,onExpandedRowsChange:setExpandedRuleKeys,rowExpandable:r=>!!r.details?.length, expandedRowRender:r=><Table size="small" rowKey="id" pagination={{pageSize:10}} dataSource={r.details.filter(d=>!onlyErrors || !d.passed)} columns={[{title:'单元格',dataIndex:'address'},{title:'属性',dataIndex:'property'},{title:'详情',dataIndex:'message'}]} />}} dataSource={(autoResult.results || []).filter(r => !onlyErrors || !r.passed)} columns={[
                            {title:'得分点',dataIndex:'title',render:(text,row)=><span>{row.details?.length ? <span style={{marginRight:6,color:'#1677ff'}}>{expandedRuleKeys.includes(row.id) ? '−' : '+'}</span> : null}{text}</span>}, {title:'得分',width:120,render:(_,r)=> <span style={{whiteSpace:'nowrap'}}>{r.score}/{r.maxScore}</span>},
                            {title:'结果',render:(_,r)=><Tag color={r.passed ? 'green' : 'red'}>{r.passed ? '正确' : '错误'}</Tag>}, {title:'详情',dataIndex:'message'}
                        ]} />
                    </> : !reportLoading && !reportError && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Empty description="暂无自动批阅记录" />
                    </div>}
                    </div>
                    {/* Excel内容区域 */}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column' }}>
                        {/* 截断/错误警告 */}
                        {excelWarning && (
                            <Alert
                                message={excelWarning}
                                type={excelData ? 'warning' : 'error'}
                                showIcon
                                style={{ margin: '8px', flexShrink: 0 }}
                                action={showDownloadHint && (
                                    <Button
                                        size="small"
                                        type="link"
                                        icon={<DownloadOutlined />}
                                        onClick={handleDownloadFile}
                                    >
                                        下载原文件
                                    </Button>
                                )}
                            />
                        )}
                        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            {loadingExcel ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                    <Spin size="large" tip="加载Excel数据中..." />
                                </div>
                            ) : excelData && activeTab === 'preview' ? (
                                <SpreadsheetEditor
                                    key={selectedSubmission?._id}
                                    data={excelData}
                                    readOnly={true}
                                    showFormulas={true}
                                    style={{ height: '100%' }}
                                />
                            ) : (
                                <Empty
                                    description={excelWarning || "无法加载Excel数据"}
                                    style={{ marginTop: '100px' }}
                                >
                                    {showDownloadHint && (
                                        <Button
                                            type="primary"
                                            icon={<DownloadOutlined />}
                                            onClick={handleDownloadFile}
                                        >
                                            下载原文件查看
                                        </Button>
                                    )}
                                </Empty>
                            )}
                        </div>
                    </div>
                </div>
            </Col>
        </Row>
    );
};

export default ExcelReview;
