import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Tag, Divider, Space, Spin, message, Descriptions } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { quizAPI } from '../../../services/quizAPI';
import ReactMarkdown from 'react-markdown';

const { Title, Paragraph, Text } = Typography;

const PracticeReview = ({ sessionId, onBack }) => {
    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const res = await quizAPI.freePractice.getDetails(sessionId);
                if (res.success) {
                    setDetails(res.data);
                }
            } catch (error) {
                message.error('加载详情失败');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        if (sessionId) {
            fetchDetails();
        }
    }, [sessionId]);

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    if (!details) return null;

    const { sessionInfo, questions } = details;

    return (
        <div className="practice-review">
            <Card title={
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回</Button>
                    <span>练习回顾</span>
                </Space>
            } bordered={false}>

                {/* 概览信息 */}
                <Descriptions bordered column={4} style={{ marginBottom: 24 }}>
                    <Descriptions.Item label="答对题数">
                        <Text type="success" strong>{sessionInfo.score}</Text> / {sessionInfo.total}
                    </Descriptions.Item>
                    <Descriptions.Item label="获得积分">
                        <Text type="warning" strong>+{sessionInfo.points}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="开始时间">
                        {new Date(sessionInfo.startTime).toLocaleString()}
                    </Descriptions.Item>
                    <Descriptions.Item label="用时">
                        {sessionInfo.endTime ? Math.ceil((new Date(sessionInfo.endTime) - new Date(sessionInfo.startTime)) / 1000 / 60) + ' 分钟' : '-'}
                    </Descriptions.Item>
                </Descriptions>

                {/* 题目列表 */}
                <div className="review-questions">
                    {questions.map((q, index) => (
                        <Card
                            key={index}
                            type="inner"
                            title={
                                <Space>
                                    <Tag color={q.isCorrect ? 'success' : 'error'}>
                                        {q.isCorrect ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                        {q.isCorrect ? ' 回答正确' : ' 回答错误'}
                                    </Tag>
                                    <span>第 {index + 1} 题</span>
                                    <Tag>{q.type === 'SINGLE_CHOICE' ? '单选' : q.type === 'TRUE_FALSE' ? '判断' : '多选'}</Tag>
                                </Space>
                            }
                            style={{ marginBottom: 16, border: q.isCorrect ? '1px solid #b7eb8f' : '1px solid #ffa39e' }}
                        >
                            <Paragraph>
                                <ReactMarkdown>{q.content}</ReactMarkdown>
                            </Paragraph>

                            {/* 选项展示 */}
                            <div className="options-list" style={{ marginBottom: 16 }}>
                                {q.options.map((opt) => {
                                    const isSelected = q.userAnswer === opt._id;
                                    const isCorrect = q.correctAnswer === opt._id; // 注意：多选可能需要改逻辑，这里假设单选/判断

                                    let style = { padding: '8px 12px', borderRadius: 4, marginBottom: 8, border: '1px solid #d9d9d9' };

                                    if (isCorrect) {
                                        style = { ...style, background: '#f6ffed', borderColor: '#b7eb8f', fontWeight: 'bold' };
                                    } else if (isSelected && !q.isCorrect) {
                                        style = { ...style, background: '#fff1f0', borderColor: '#ffa39e' };
                                    }

                                    return (
                                        <div key={opt._id} style={style}>
                                            <Space>
                                                {isSelected && (q.isCorrect ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />)}
                                                {!isSelected && isCorrect && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                                <span>{opt.content}</span>
                                                {isCorrect && <Tag color="success" style={{ marginLeft: 8 }}>正确答案</Tag>}
                                                {isSelected && !isCorrect && <Tag color="error" style={{ marginLeft: 8 }}>你的答案</Tag>}
                                            </Space>
                                        </div>
                                    );
                                })}
                            </div>

                            <Divider orientation="left" style={{ margin: '12px 0' }}>解析</Divider>
                            <div style={{ background: '#fafafa', padding: 12, borderRadius: 4 }}>
                                <ReactMarkdown>{q.analysis || '暂无解析'}</ReactMarkdown>
                            </div>

                        </Card>
                    ))}
                </div>
            </Card>
        </div>
    );
};

export default PracticeReview;
