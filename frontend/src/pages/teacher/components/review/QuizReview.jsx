import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Empty, message, Modal, Card, Typography, Row, Col, Tooltip, Spin, Descriptions, Progress } from 'antd';
import { EyeOutlined, DeleteOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { quizAPI } from '../../../../services/api';

const { Text, Title } = Typography;

/**
 * QuizReview - 测验活动批阅组件
 * 以表格形式展示班级学生的测验成绩
 */
const QuizReview = ({
    quizId,
    activityId,
    lessonId,
    onRefresh,
    formatClassName,
    selectedClass, // 班级筛选，如 "1级1班"
    onClassOptionsLoaded // 回调：传递可用班级列表
}) => {
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState([]);
    const [quiz, setQuiz] = useState(null);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // 加载测验和提交数据
    useEffect(() => {
        const loadData = async () => {
            if (!quizId) return;

            try {
                setLoading(true);
                const [quizRes, submissionsRes] = await Promise.all([
                    quizAPI.quizzes.getById(quizId),
                    quizAPI.submissions.getByQuiz(quizId)
                ]);

                setQuiz(quizRes.data || quizRes);

                // 过滤出属于当前活动的提交（如果有activityId的话）
                let subs = submissionsRes.data || [];
                if (activityId) {
                    // 新提交有activityId，旧提交没有
                    subs = subs.filter(s => !s.activityId || s.activityId === activityId);
                }
                // 按班级筛选
                if (selectedClass) {
                    subs = subs.filter(s => {
                        const student = s.studentId;
                        if (!student?.classId) return false;
                        const className = formatClassName ?
                            formatClassName(student.classId.grade, student.classId.name) :
                            `${student.classId.grade || ''}级${student.classId.name || ''}班`;
                        return className === selectedClass;
                    });
                }
                // 提取班级列表并通知父组件
                if (onClassOptionsLoaded) {
                    const allSubs = submissionsRes.data || [];
                    const classes = [...new Set(allSubs
                        .filter(s => s.studentId?.classId?.grade && s.studentId?.classId?.name)
                        .map(s => formatClassName ?
                            formatClassName(s.studentId.classId.grade, s.studentId.classId.name) :
                            `${s.studentId.classId.grade || ''}级${s.studentId.classId.name || ''}班`
                        ))];
                    onClassOptionsLoaded(classes.sort());
                }
                setSubmissions(subs);
            } catch (error) {
                console.error('加载测验数据失败:', error);
                message.error('加载测验数据失败');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [quizId, activityId, selectedClass, formatClassName]);

    // 查看详情
    const handleViewDetail = async (record) => {
        try {
            setDetailLoading(true);
            setDetailModalVisible(true);

            const response = await quizAPI.submissions.getById(record._id);
            setSelectedSubmission(response.data || response);
        } catch (error) {
            message.error('获取详情失败');
        } finally {
            setDetailLoading(false);
        }
    };

    // 删除提交
    const handleDelete = async (record) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除此测验提交记录吗？此操作无法撤销，学生将失去相应积分。',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await quizAPI.submissions.delete(record._id);
                    message.success('删除成功');
                    // 刷新列表
                    const res = await quizAPI.submissions.getByQuiz(quizId);
                    let subs = res.data || [];
                    if (activityId) {
                        subs = subs.filter(s => !s.activityId || s.activityId === activityId);
                    }
                    setSubmissions(subs);
                    if (onRefresh) onRefresh();
                } catch (error) {
                    message.error('删除失败');
                }
            }
        });
    };

    // 导出Excel
    const handleExport = async () => {
        try {
            setExportLoading(true);
            const blob = await quizAPI.submissions.exportToExcel(quizId);

            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quiz?.title || '测验'}-成绩导出-${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            message.success('导出成功');
        } catch (error) {
            console.error('导出失败:', error);
            message.error('导出失败');
        } finally {
            setExportLoading(false);
        }
    };

    // 计算统计数据
    const getStatistics = () => {
        if (submissions.length === 0) return null;

        const totalQuestions = quiz?.questions?.length || 1;
        const scores = submissions.map(s => (s.score / totalQuestions) * 100);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);

        return { avgScore, maxScore, minScore, total: submissions.length };
    };

    const stats = getStatistics();

    // 表格列定义
    const columns = [
        {
            title: '学生姓名',
            dataIndex: ['studentId', 'name'],
            key: 'name',
            width: 120,
            render: (text) => text || '未知'
        },
        {
            title: '班级',
            key: 'class',
            width: 100,
            render: (_, record) => {
                const student = record.studentId;
                if (!student?.classId) return '-';
                return formatClassName ?
                    formatClassName(student.classId.grade, student.classId.name) :
                    `${student.classId.grade || ''}${student.classId.name || ''}`;
            }
        },
        {
            title: '得分',
            key: 'score',
            width: 100,
            sorter: (a, b) => (a.score || 0) - (b.score || 0),
            render: (_, record) => {
                const totalQuestions = quiz?.questions?.length || 1;
                const percentage = ((record.score || 0) / totalQuestions * 100).toFixed(0);
                const color = percentage >= 60 ? 'green' : 'red';
                return (
                    <Space>
                        <Tag color={color}>{record.score || 0}/{totalQuestions}</Tag>
                        <Text type="secondary">({percentage}%)</Text>
                    </Space>
                );
            }
        },
        {
            title: '用时',
            key: 'duration',
            width: 80,
            render: (_, record) => {
                if (!record.startTime || !record.submitTime) return '-';
                const duration = (new Date(record.submitTime) - new Date(record.startTime)) / 1000 / 60;
                return `${duration.toFixed(1)}分钟`;
            }
        },
        {
            title: '提交时间',
            dataIndex: 'submitTime',
            key: 'submitTime',
            width: 160,
            sorter: (a, b) => new Date(a.submitTime) - new Date(b.submitTime),
            render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
        },
        {
            title: '尝试次数',
            dataIndex: 'attemptNumber',
            key: 'attemptNumber',
            width: 80,
            render: (text) => text || 1
        },
        {
            title: '操作',
            key: 'action',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Tooltip title="查看详情">
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDetail(record)}
                        />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDelete(record)}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" tip="加载中..." />
            </div>
        );
    }

    return (
        <div>
            {/* 统计信息 */}
            {stats && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <Row gutter={24}>
                        <Col span={6}>
                            <Text type="secondary">提交人数</Text>
                            <div><Text strong style={{ fontSize: 20 }}>{stats.total}</Text></div>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">平均分</Text>
                            <div><Text strong style={{ fontSize: 20, color: stats.avgScore >= 60 ? '#52c41a' : '#f5222d' }}>{stats.avgScore.toFixed(1)}%</Text></div>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">最高分</Text>
                            <div><Text strong style={{ fontSize: 20, color: '#52c41a' }}>{stats.maxScore.toFixed(1)}%</Text></div>
                        </Col>
                        <Col span={6}>
                            <Text type="secondary">最低分</Text>
                            <div><Text strong style={{ fontSize: 20, color: '#f5222d' }}>{stats.minScore.toFixed(1)}%</Text></div>
                        </Col>
                    </Row>
                </Card>
            )}

            {/* 操作栏 */}
            <Row justify="space-between" style={{ marginBottom: 16 }}>
                <Col>
                    <Text strong>{quiz?.title || '测验'}</Text>
                    <Text type="secondary" style={{ marginLeft: 12 }}>共 {quiz?.questions?.length || 0} 题</Text>
                </Col>
                <Col>
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        loading={exportLoading}
                    >
                        导出Excel
                    </Button>
                </Col>
            </Row>

            {/* 成绩表格 */}
            {submissions.length === 0 ? (
                <Empty description="暂无提交记录" />
            ) : (
                <Table
                    columns={columns}
                    dataSource={submissions}
                    rowKey="_id"
                    size="small"
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`
                    }}
                />
            )}

            {/* 详情弹窗 */}
            <Modal
                title="答题详情"
                open={detailModalVisible}
                onCancel={() => {
                    setDetailModalVisible(false);
                    setSelectedSubmission(null);
                }}
                footer={null}
                width={700}
            >
                {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin tip="加载中..." />
                    </div>
                ) : selectedSubmission ? (
                    <div>
                        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="学生">{selectedSubmission.submission?.studentId?.name || '未知'}</Descriptions.Item>
                            <Descriptions.Item label="得分">{selectedSubmission.submission?.score || 0} / {selectedSubmission.questions?.length || 0}</Descriptions.Item>
                            <Descriptions.Item label="提交时间">{selectedSubmission.submission?.submitTime ? new Date(selectedSubmission.submission.submitTime).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
                            <Descriptions.Item label="正确率">
                                <Progress
                                    percent={selectedSubmission.questions?.length ? ((selectedSubmission.submission?.score || 0) / selectedSubmission.questions.length * 100).toFixed(0) : 0}
                                    size="small"
                                    style={{ width: 100 }}
                                />
                            </Descriptions.Item>
                        </Descriptions>

                        {/* 题目列表 */}
                        <div style={{ maxHeight: 400, overflow: 'auto' }}>
                            {selectedSubmission.questions?.map((q, index) => (
                                <Card
                                    key={q.questionId}
                                    size="small"
                                    style={{ marginBottom: 8 }}
                                    title={
                                        <Space>
                                            <Text>第 {index + 1} 题</Text>
                                            {q.isCorrect ? (
                                                <Tag color="success" icon={<CheckCircleOutlined />}>正确</Tag>
                                            ) : (
                                                <Tag color="error" icon={<CloseCircleOutlined />}>错误</Tag>
                                            )}
                                        </Space>
                                    }
                                >
                                    <div dangerouslySetInnerHTML={{ __html: q.content }} />
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

export default QuizReview;
