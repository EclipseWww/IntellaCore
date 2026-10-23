import React, { useState, useEffect } from 'react';
import { List, Card, Tag, Button, Empty, Skeleton, message, Typography, Space } from 'antd';
import { FieldTimeOutlined, ArrowRightOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import quizAPI from '../../../services/quizAPI';

const { Text, Paragraph } = Typography;

const PendingQuizzes = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [quizzes, setQuizzes] = useState([]);

    useEffect(() => {
        fetchPendingQuizzes();
    }, []);

    const fetchPendingQuizzes = async () => {
        try {
            setLoading(true);
            // 调用新的专用接口获取未完成测验
            const res = await quizAPI.getPendingQuizzes();

            if (res.success) {
                setQuizzes(res.data);
            }
        } catch (error) {
            console.error('获取未完成测验失败:', error);
            // 不显示错误信息，以免打扰用户，只是显示空列表
            message.error('加载待完成测验失败');
        } finally {
            setLoading(false);
        }
    };

    // handleStartQuiz function is no longer needed as navigation logic is inline
    // const handleStartQuiz = (quiz) => {
    //     // 跳转到测验页面
    //     // 路径可能需要根据实际路由结构调整
    //     // 假设结构为 /student/course/:courseId/unit/:unitId/lesson/:lessonId
    //     if (quiz.courseId && quiz.unitId && quiz.lessonId) {
    //         navigate(`/student/course/${quiz.courseId}/unit/${quiz.unitId}/lesson/${quiz.lessonId}`);
    //     } else {
    //         message.error('无法跳转：缺少课程信息');
    //     }
    // };

    if (loading) {
        return <Skeleton active paragraph={{ rows: 4 }} />;
    }

    if (quizzes.length === 0) {
        return (
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无待完成的测验"
            />
        );
    }

    return (
        <List
            grid={{ gutter: 16, column: 1 }}
            dataSource={quizzes}
            renderItem={item => (
                <List.Item>
                    <Card
                        hoverable
                        size="small"
                        style={{ borderRadius: 8 }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    background: '#f0f5ff',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FileTextOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                                </div>
                                <Space direction="vertical" size={0}>
                                    <Text strong>{item.title}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {item.courseName}
                                    </Text>
                                </Space>
                            </Space>
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => {
                                    navigate(`/student/course/${item.courseId}/unit/${item.unitId}/lesson/${item.lessonId}?activityId=${item.activityId}`);
                                }}
                            >
                                去完成
                            </Button>
                        </div>
                    </Card>
                </List.Item>
            )}
        />
    );
};

export default PendingQuizzes;
