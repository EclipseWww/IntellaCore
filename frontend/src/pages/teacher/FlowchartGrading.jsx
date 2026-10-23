import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Card,
    Space,
    Button,
    Form,
    Input,
    InputNumber,
    Select,
    message,
    Typography,
    Spin,
    Cascader,
    Empty,
    Tag,
    Tooltip,
    Row,
    Col,
    Statistic,
    List,
    Badge,
    Divider
} from 'antd';
import {
    LeftOutlined,
    RightOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    UserOutlined,
    SaveOutlined
} from '@ant-design/icons';
import { courseManagementAPI, flowchartAPI } from '../../services/api';
import MxGraphEditor from '../../components/mxgraph/MxGraphEditor';
import MarkdownRenderer from '../../components/shared/MarkdownRenderer';

const { Title, Text } = Typography;
const { TextArea } = Input;

const FlowchartGrading = () => {
    // State
    const [options, setOptions] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [grading, setGrading] = useState(false);
    const [activityDetails, setActivityDetails] = useState(null);

    // Form state
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState('');

    // Load courses and build cascader options
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const response = await courseManagementAPI.getTeacherCourses();
                const courseData = response.data || [];

                // Build cascader options
                const cascaderOptions = await Promise.all(courseData.map(async course => {
                    const unitsResponse = await courseManagementAPI.getUnits(course._id);
                    const units = unitsResponse.data || [];

                    return {
                        value: course._id,
                        label: course.title,
                        children: await Promise.all(units.map(async unit => {
                            const lessonsResponse = await courseManagementAPI.getLessons(course._id, unit._id);
                            const lessons = lessonsResponse.success ? lessonsResponse.data : [];

                            return {
                                value: unit._id,
                                label: unit.title,
                                children: await Promise.all(lessons.map(async lesson => {
                                    const lessonResponse = await courseManagementAPI.getLesson(course._id, unit._id, lesson._id);
                                    const activities = lessonResponse.success && lessonResponse.data ?
                                        lessonResponse.data.activities.filter(activity => activity.type === 'flowchart') : [];

                                    return {
                                        value: lesson._id,
                                        label: lesson.title,
                                        children: activities.map(activity => ({
                                            value: activity._id,
                                            label: activity.title || '流程图活动',
                                            activityData: activity
                                        }))
                                    };
                                }))
                            };
                        }))
                    };
                }));

                setOptions(cascaderOptions);
            } catch (error) {
                console.error('获取课程列表失败:', error);
                message.error('获取课程列表失败');
            }
        };
        fetchCourses();
    }, []);

    // Handle cascader change
    const handleCascaderChange = async (value, selectedOptions) => {
        setSelectedKeys(value || []);
        setSelectedSubmission(null);
        setCurrentIndex(-1);
        setSubmissions([]);
        setScore(null);
        setFeedback('');

        if (value && value.length === 4) {
            const [courseId, unitId, lessonId, activityId] = value;

            // Get activity details
            const activityOption = selectedOptions[3];
            if (activityOption?.activityData) {
                setActivityDetails(activityOption.activityData);
            }

            // Fetch submissions
            await fetchSubmissions(lessonId, activityId);
        }
    };

    // Fetch submissions
    const fetchSubmissions = async (lessonId, activityId) => {
        setLoading(true);
        try {
            const response = await flowchartAPI.getActivitySubmissions(lessonId, activityId);
            if (response.success) {
                setSubmissions(response.submissions || []);
                if (response.submissions && response.submissions.length > 0) {
                    handleSelectSubmission(response.submissions[0], 0);
                }
            }
        } catch (error) {
            console.error('获取提交列表失败:', error);
            message.error('获取提交列表失败');
        } finally {
            setLoading(false);
        }
    };

    // Handle submission selection
    const handleSelectSubmission = (submission, index) => {
        setSelectedSubmission(submission);
        setCurrentIndex(index);
        setScore(submission.grade?.score || null);
        setFeedback(submission.grade?.feedback || '');
    };

    // Navigate to previous submission
    const handlePrev = () => {
        if (currentIndex > 0) {
            handleSelectSubmission(submissions[currentIndex - 1], currentIndex - 1);
        }
    };

    // Navigate to next submission
    const handleNext = () => {
        if (currentIndex < submissions.length - 1) {
            handleSelectSubmission(submissions[currentIndex + 1], currentIndex + 1);
        }
    };

    // Handle grading
    const handleGrade = async () => {
        if (!selectedSubmission) return;
        if (score === null || score < 0 || score > 100) {
            message.warning('请输入有效的分数（0-100）');
            return;
        }

        setGrading(true);
        try {
            const response = await flowchartAPI.gradeSubmission(selectedSubmission._id, score, feedback);
            if (response.success) {
                message.success('评分成功');

                // Update local state
                const updatedSubmission = {
                    ...selectedSubmission,
                    status: 'graded',
                    grade: {
                        score,
                        feedback,
                        gradedAt: new Date()
                    }
                };
                setSelectedSubmission(updatedSubmission);

                // Update submissions list
                const updatedSubmissions = submissions.map(s =>
                    s._id === selectedSubmission._id ? updatedSubmission : s
                );
                setSubmissions(updatedSubmissions);

                // Auto-advance to next ungraded
                if (currentIndex < submissions.length - 1) {
                    handleNext();
                }
            }
        } catch (error) {
            console.error('评分失败:', error);
            message.error('评分失败');
        } finally {
            setGrading(false);
        }
    };

    // Quick grade buttons
    const quickGrades = [
        { label: 'A (100)', score: 100, color: '#52c41a' },
        { label: 'B (80)', score: 80, color: '#1890ff' },
        { label: 'C (60)', score: 60, color: '#faad14' },
        { label: 'D (40)', score: 40, color: '#fa8c16' },
        { label: 'F (0)', score: 0, color: '#f5222d' }
    ];

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, submissions]);

    // Calculate stats
    const stats = {
        total: submissions.length,
        graded: submissions.filter(s => s.status === 'graded').length,
        pending: submissions.filter(s => s.status !== 'graded').length
    };

    return (
        <div style={{ padding: 24 }}>
            <Title level={3}>流程图批阅</Title>

            {/* Activity Selector */}
            <Card style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>选择流程图活动</Text>
                    <Cascader
                        options={options}
                        value={selectedKeys}
                        onChange={handleCascaderChange}
                        placeholder="选择 课程 / 单元 / 课时 / 活动"
                        style={{ width: '100%' }}
                        showSearch
                    />
                </Space>
            </Card>

            {/* Stats */}
            {submissions.length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic title="总提交数" value={stats.total} />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="已批阅"
                                value={stats.graded}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="待批阅"
                                value={stats.pending}
                                valueStyle={{ color: '#faad14' }}
                            />
                        </Col>
                    </Row>
                </Card>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                    <Spin size="large" />
                </div>
            ) : selectedKeys.length === 4 && submissions.length === 0 ? (
                <Empty description="暂无提交记录" />
            ) : selectedKeys.length === 4 ? (
                <Row gutter={16}>
                    {/* Student List */}
                    <Col span={4}>
                        <Card
                            title="学生列表"
                            size="small"
                            bodyStyle={{ maxHeight: 600, overflowY: 'auto', padding: 0 }}
                        >
                            <List
                                dataSource={submissions}
                                renderItem={(item, index) => (
                                    <List.Item
                                        key={item._id}
                                        onClick={() => handleSelectSubmission(item, index)}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '8px 12px',
                                            backgroundColor: currentIndex === index ? '#e6f7ff' : 'transparent',
                                            borderLeft: currentIndex === index ? '3px solid #1890ff' : '3px solid transparent'
                                        }}
                                    >
                                        <Space>
                                            <Badge
                                                status={item.status === 'graded' ? 'success' : 'processing'}
                                            />
                                            <span>{item.userId?.name || '未知学生'}</span>
                                        </Space>
                                        {item.grade?.score !== undefined && (
                                            <Tag color={item.grade.score >= 60 ? 'green' : 'red'}>
                                                {item.grade.score}
                                            </Tag>
                                        )}
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>

                    {/* Flowchart View */}
                    <Col span={14}>
                        <Card
                            title={
                                <Space>
                                    <span>学生流程图</span>
                                    {selectedSubmission && (
                                        <Tag color="blue">
                                            {selectedSubmission.userId?.name || '未知学生'}
                                        </Tag>
                                    )}
                                </Space>
                            }
                            extra={
                                <Space>
                                    <Button
                                        icon={<LeftOutlined />}
                                        onClick={handlePrev}
                                        disabled={currentIndex <= 0}
                                    />
                                    <Text>{currentIndex + 1} / {submissions.length}</Text>
                                    <Button
                                        icon={<RightOutlined />}
                                        onClick={handleNext}
                                        disabled={currentIndex >= submissions.length - 1}
                                    />
                                </Space>
                            }
                        >
                            {selectedSubmission ? (
                                <div style={{ height: 500 }}>
                                    <MxGraphEditor
                                        mode="view"
                                        initialData={selectedSubmission.flowchartData}
                                        readOnly={true}
                                        showSubmitButton={false}
                                    />
                                </div>
                            ) : (
                                <Empty description="请选择学生查看流程图" />
                            )}
                        </Card>
                    </Col>

                    {/* Grading Panel */}
                    <Col span={6}>
                        <Card title="评分" size="small">
                            {selectedSubmission ? (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {/* Quick Grade Buttons */}
                                    <div>
                                        <Text type="secondary">快捷评分：</Text>
                                        <div style={{ marginTop: 8 }}>
                                            {quickGrades.map(g => (
                                                <Button
                                                    key={g.score}
                                                    size="small"
                                                    style={{
                                                        marginRight: 8,
                                                        marginBottom: 8,
                                                        borderColor: score === g.score ? g.color : undefined,
                                                        color: score === g.score ? g.color : undefined
                                                    }}
                                                    onClick={() => setScore(g.score)}
                                                >
                                                    {g.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <Divider style={{ margin: '12px 0' }} />

                                    {/* Score Input */}
                                    <div>
                                        <Text type="secondary">分数 (0-100)：</Text>
                                        <InputNumber
                                            min={0}
                                            max={100}
                                            value={score}
                                            onChange={setScore}
                                            style={{ width: '100%', marginTop: 8 }}
                                        />
                                    </div>

                                    {/* Feedback */}
                                    <div>
                                        <Text type="secondary">评语：</Text>
                                        <TextArea
                                            rows={4}
                                            value={feedback}
                                            onChange={e => setFeedback(e.target.value)}
                                            placeholder="输入评语（可选）"
                                            style={{ marginTop: 8 }}
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleGrade}
                                        loading={grading}
                                        block
                                        style={{ marginTop: 16 }}
                                    >
                                        保存评分
                                    </Button>

                                    {/* Submission Info */}
                                    <Divider style={{ margin: '12px 0' }} />
                                    <div>
                                        <Text type="secondary">提交信息：</Text>
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                节点数: {selectedSubmission.nodeCount || '-'}
                                            </Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                连线数: {selectedSubmission.edgeCount || '-'}
                                            </Text>
                                            <br />
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                用时: {selectedSubmission.duration ? `${Math.floor(selectedSubmission.duration / 60)}分${selectedSubmission.duration % 60}秒` : '-'}
                                            </Text>
                                        </div>
                                    </div>
                                </Space>
                            ) : (
                                <Empty description="请选择学生" />
                            )}
                        </Card>

                        {/* Activity Instructions */}
                        {activityDetails?.flowchartSettings?.instructions && (
                            <Card title="活动说明" size="small" style={{ marginTop: 16 }}>
                                <MarkdownRenderer content={activityDetails.flowchartSettings.instructions} />
                            </Card>
                        )}
                    </Col>
                </Row>
            ) : (
                <Empty description="请选择流程图活动" />
            )}
        </div>
    );
};

export default FlowchartGrading;
