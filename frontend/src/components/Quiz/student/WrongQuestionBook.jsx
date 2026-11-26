import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Typography, Tag, Space, Spin, Empty, Segmented, Statistic, Row, Col, Alert, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, RedoOutlined, BookOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { quizAPI } from '../../../services/quizAPI';
import FreePractice from './FreePractice';

const { Text, Paragraph } = Typography;

const TYPE_LABELS = { SINGLE_CHOICE: '单选', TRUE_FALSE: '判断', MULTIPLE_CHOICE: '多选' };

const formatDate = (value) => (value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-');

// 单道错题：显示题目、你上次的选择；老师公布答案时显示正确答案与解析
const WrongQuestionCard = ({ item, index }) => {
    const selected = new Set((item.userAnswers || []).map(String));
    return (
        <Card
            type="inner"
            style={{ marginBottom: 16, border: item.mastered ? '1px solid #b7eb8f' : '1px solid #ffa39e' }}
            title={
                <Space wrap>
                    <span>第 {index + 1} 题</span>
                    <Tag>{TYPE_LABELS[item.type] || '选择'}</Tag>
                    {item.mastered
                        ? <Tag color="success" icon={<CheckCircleOutlined />}>已掌握</Tag>
                        : <Tag color="error" icon={<CloseCircleOutlined />}>答错 {item.wrongCount} 次</Tag>}
                </Space>
            }
            extra={<Text type="secondary" style={{ fontSize: 12 }}>最近答错：{formatDate(item.lastWrongAt)}</Text>}
        >
            <Paragraph>
                <ReactMarkdown>{item.content}</ReactMarkdown>
            </Paragraph>

            <div style={{ marginBottom: 12 }}>
                {(item.options || []).map(opt => {
                    const isSelected = selected.has(String(opt._id));
                    const isCorrect = item.showAnswers && opt.isCorrect;
                    let style = { padding: '8px 12px', borderRadius: 4, marginBottom: 8, border: '1px solid #d9d9d9' };
                    if (isCorrect) style = { ...style, background: '#f6ffed', borderColor: '#b7eb8f', fontWeight: 'bold' };
                    else if (isSelected) style = { ...style, background: '#fff1f0', borderColor: '#ffa39e' };
                    return (
                        <div key={opt._id} style={style}>
                            <Space>
                                <span>{opt.content}</span>
                                {isCorrect && <Tag color="success">正确答案</Tag>}
                                {isSelected && !isCorrect && <Tag color="error">上次的选择</Tag>}
                            </Space>
                        </div>
                    );
                })}
                {selected.size === 0 && <Text type="secondary">上次未作答</Text>}
            </div>

            {item.showAnswers ? (
                <div style={{ background: '#fafafa', padding: 12, borderRadius: 4 }}>
                    <Text strong>解析：</Text>
                    <ReactMarkdown>{item.explanation || '暂无解析'}</ReactMarkdown>
                </div>
            ) : (
                <Text type="secondary">老师未公布这道题的答案，暂不能重练</Text>
            )}

            <div style={{ marginTop: 12 }}>
                <Space size={[4, 4]} wrap>
                    <Text type="secondary" style={{ fontSize: 12 }}>来源：</Text>
                    {item.sources.map(source => <Tag key={source}>{source}</Tag>)}
                    {(item.tags || []).map(tag => <Tag key={`tag-${tag}`} color="blue">{tag}</Tag>)}
                </Space>
            </div>
        </Card>
    );
};

// active：所在标签页被切换到时刷新一次（做完自由练习或测验后切过来能看到新错题）
const WrongQuestionBook = ({ active = true }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ list: [], activeCount: 0, masteredCount: 0, retryableCount: 0 });
    const [filter, setFilter] = useState('active');
    const [retrying, setRetrying] = useState(false);

    const fetchBook = useCallback(async () => {
        try {
            setLoading(true);
            const res = await quizAPI.freePractice.getWrongQuestions();
            if (res.success) setData(res.data);
        } catch (error) {
            console.error('获取错题本失败:', error);
            message.error('获取错题本失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active && !retrying) fetchBook();
    }, [active, fetchBook]);

    if (retrying) {
        return (
            <FreePractice
                mode="wrong"
                onExit={() => {
                    setRetrying(false);
                    fetchBook();
                }}
            />
        );
    }

    const list = data.list.filter(item => (filter === 'active' ? !item.mastered : item.mastered));

    return (
        <div>
            <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                <Col xs={8} md={5}>
                    <Statistic title="未掌握" value={data.activeCount} valueStyle={{ color: '#ff4d4f' }} />
                </Col>
                <Col xs={8} md={5}>
                    <Statistic title="已掌握" value={data.masteredCount} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col xs={8} md={14} style={{ textAlign: 'right' }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<RedoOutlined />}
                        disabled={data.retryableCount === 0}
                        onClick={() => setRetrying(true)}
                    >
                        错题重练{data.retryableCount > 0 ? `（${Math.min(data.retryableCount, 10)} 题）` : ''}
                    </Button>
                </Col>
            </Row>

            <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="自由练习和课程测验里答错的题会自动收进错题本。重练时答对就算掌握，以后再答错会重新回到“未掌握”。错题重练不计积分。"
            />

            <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                    { label: `未掌握（${data.activeCount}）`, value: 'active' },
                    { label: `已掌握（${data.masteredCount}）`, value: 'mastered' }
                ]}
                style={{ marginBottom: 16 }}
            />

            <Spin spinning={loading}>
                {list.length === 0 ? (
                    <Empty
                        image={<BookOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />}
                        description={filter === 'active' ? '没有未掌握的错题，继续保持！' : '还没有已掌握的错题'}
                        style={{ padding: '40px 0' }}
                    />
                ) : (
                    list.map((item, index) => <WrongQuestionCard key={item.questionId} item={item} index={index} />)
                )}
            </Spin>
        </div>
    );
};

export default WrongQuestionBook;
