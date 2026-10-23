import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Progress, message, Modal, Row, Col, Typography, Space, Spin, Statistic } from 'antd';
import PracticeReview from './PracticeReview';
import { ClockCircleOutlined, TrophyOutlined, PlayCircleOutlined, ReloadOutlined, ArrowLeftOutlined, LogoutOutlined, EyeOutlined } from '@ant-design/icons';
import { quizAPI } from '../../../services/quizAPI';
import QuizQuestion from './QuizQuestion';
import { useNavigate } from 'react-router-dom';
import './FreePractice.css';

const { Title, Text } = Typography;

const FreePractice = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [sessionId, setSessionId] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(300); // 5分钟 = 300秒
    const [initialTimeLimit, setInitialTimeLimit] = useState(300);
    const [status, setStatus] = useState('intro'); // intro, practicing, submitting, completed, reviewing
    const [result, setResult] = useState(null);
    const timerRef = useRef(null);
    const [showReview, setShowReview] = useState(false);

    // 开始练习
    const startPractice = async () => {
        try {
            setLoading(true);
            const res = await quizAPI.freePractice.start();
            if (res.success) {
                setQuestions(res.data.questions);
                setSessionId(res.data.sessionId);
                setInitialTimeLimit(res.data.timeLimit || 300);
                setTimeRemaining(res.data.timeLimit || 300);
                setAnswers({});
                setCurrentStep(0);
                setStatus('practicing');
                setShowReview(false);
                startTimer();
            }
        } catch (error) {
            console.error('开始练习失败:', error);
            const errorMsg = error.response?.data?.message || '无法开始练习，请稍后重试';
            if (error.response?.status === 404 || error.response?.status === 403) {
                Modal.error({
                    title: '无法开始练习',
                    content: errorMsg,
                    okText: '好的'
                });
            } else {
                message.error(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    // 启动计时器
    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // 时间到处理
    const handleTimeUp = () => {
        message.warning('时间到！系统正在自动提交答案...');
        handleSubmit();
    };

    // 提交答案
    const handleSubmit = async () => {
        if (!sessionId) return;
        if (timerRef.current) clearInterval(timerRef.current);

        try {
            setStatus('submitting');
            const res = await quizAPI.freePractice.submit(sessionId, answers);
            if (res.success) {
                setResult(res.data);
                setStatus('completed');
            }
        } catch (error) {
            console.error('提交练习失败:', error);
            message.error('提交失败，请重试');
            setStatus('practicing');
            startTimer();
        }
    };

    // 确认提交
    const onFinish = () => {
        const answeredCount = Object.keys(answers).length;
        const totalCount = questions.length;
        Modal.confirm({
            title: '确认提交',
            content: `你已完成 ${answeredCount}/${totalCount} 道题目。确定要提交吗？`,
            okText: '确认提交',
            cancelText: '继续练习',
            onOk: handleSubmit
        });
    };

    // 处理答案变更
    const handleAnswerChange = (val) => {
        if (status !== 'practicing') return;
        setAnswers(prev => ({
            ...prev,
            [questions[currentStep]._id]: val
        }));
    };

    // 退出练习检查
    const handleExit = () => {
        if (status === 'practicing') {
            Modal.confirm({
                title: '确认退出',
                content: '正在进行的练习将不会被保存。确定要退出吗？',
                okText: '退出',
                cancelText: '取消',
                onOk: () => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setStatus('intro');
                    setAnswers({});
                    setQuestions([]);
                }
            });
        } else {
            setStatus('intro');
        }
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // 1. Intro Page (Start Screen)
    if (status === 'intro') {
        return (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Card style={{ maxWidth: 600, margin: '0 auto', borderRadius: 16 }}>
                    <Title level={2} style={{ color: '#1890ff' }}>
                        <PlayCircleOutlined /> 自由练习
                    </Title>
                    <div style={{ margin: '30px 0' }}>
                        <Text style={{ fontSize: 16, display: 'block', marginBottom: 12 }}>
                            正确率达到60%才奖励积分，达标后按答对题目计分。
                        </Text>

                    </div>
                    <Button
                        type="primary"
                        size="large"
                        shape="round"
                        icon={<PlayCircleOutlined />}
                        onClick={startPractice}
                        loading={loading}
                        style={{ height: 48, padding: '0 40px', fontSize: 18 }}
                    >
                        开始挑战
                    </Button>
                </Card>
            </div>
        );
    }

    // 2. Loading State
    if (loading && questions.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin tip="正在准备练习题目..." size="large" />
            </div>
        );
    }

    // 3. Review Page
    if (showReview && sessionId) {
        return <PracticeReview sessionId={sessionId} onBack={() => setShowReview(false)} />;
    }

    // 4. Result Page
    if (status === 'completed' && result) {
        const percentage = result.totalQuestions > 0 ? Math.round((result.correctCount / result.totalQuestions) * 1000) / 10 : 0;
        return (
            <div className="free-practice-container">
                <Card className="result-card" style={{ maxWidth: 800, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <TrophyOutlined style={{ fontSize: 64, color: '#faad14', marginBottom: 24 }} />
                        <Title level={2}>练习完成！</Title>
                        <div style={{ margin: '30px 0' }}>
                            <Progress
                                type="circle"
                                percent={percentage}
                                format={() => <span className="points-earned">+{result.pointsEarned}积分</span>}
                                width={160}
                                strokeColor="#faad14"
                            />
                        </div>
                        {result.rewardMessage && <Text type="warning" style={{ display: 'block' }}>{result.rewardMessage}</Text>}
                        {result.limitMessage && <Text type="secondary" style={{ display: 'block' }}>{result.limitMessage}</Text>}
                        <Row gutter={16} justify="center" style={{ marginTop: 32 }}>
                            <Col span={8}>
                                <Statistic title="答对题目" value={result.correctCount} suffix={`/ ${result.totalQuestions}`} valueStyle={{ color: '#52c41a' }} />
                            </Col>
                            <Col span={8}>
                                <Statistic title="正确率" value={percentage} suffix="%" />
                            </Col>
                        </Row>
                        <div style={{ marginTop: 40 }}>
                            <Space size="large">
                                <Button type="default" size="large" icon={<EyeOutlined />} onClick={() => setShowReview(true)}>查看解析</Button>
                                <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={startPractice}>再练一次</Button>
                                <Button size="large" onClick={() => setStatus('intro')}>返回首页</Button>
                            </Space>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    // 4. Practice Interface
    return (
        <div className="free-practice-container">
            <Row gutter={24}>
                {/* Left Column: Question Area */}
                <Col xs={24} lg={20}>
                    <div className="practice-left-panel">
                        {/* Question Area */}
                        <div className="question-area">
                            {questions.length > 0 && (
                                <Card className="question-card" style={{ minHeight: 400 }}>
                                    <QuizQuestion
                                        question={questions[currentStep]}
                                        value={answers[questions[currentStep]._id]}
                                        onChange={handleAnswerChange}
                                        currentStep={currentStep}
                                        randomizeOptions={true}
                                        disabled={status !== 'practicing'}
                                    />
                                </Card>
                            )}
                        </div>


                    </div>
                </Col>

                {/* Right Column: Info Panel */}
                <Col xs={24} lg={4}>
                    <div className="practice-right-panel">
                        <Card
                            bordered={false}
                            className="practice-info-card"
                            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'sticky', top: 20 }}
                            bodyStyle={{ padding: '20px 16px' }}
                        >
                            {/* Timer */}
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                    <ClockCircleOutlined style={{ fontSize: 24, color: timeRemaining < 60 ? '#ff4d4f' : '#1890ff', marginRight: 8 }} />
                                    <span style={{ fontSize: 28, fontWeight: 'bold', color: timeRemaining < 60 ? '#ff4d4f' : '#333' }}>
                                        {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                                <Progress
                                    percent={(timeRemaining / initialTimeLimit) * 100}
                                    showInfo={false}
                                    size="small"
                                    strokeColor={timeRemaining < 60 ? '#ff4d4f' : '#1890ff'}
                                />
                                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>剩余时间</div>
                            </div>

                            <div style={{ margin: '20px 0', borderTop: '1px solid #f0f0f0' }} />

                            {/* Progress Info */}
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <Text type="secondary" style={{ fontSize: 13 }}>答题进度</Text>
                                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
                                    <span style={{ color: '#1890ff' }}>{Object.keys(answers).length}</span> / {questions.length}
                                </div>
                            </div>

                            {/* Question Navigator */}
                            <div className="question-indicators-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, justifyContent: 'center' }}>
                                {questions.map((q, idx) => (
                                    <button
                                        key={q._id}
                                        className={`indicator-btn-small ${currentStep === idx ? 'active' : ''} ${answers[q._id] ? 'answered' : ''}`}
                                        onClick={() => setCurrentStep(idx)}
                                        title={`第 ${idx + 1} 题`}
                                        style={{ width: '100%', aspectRatio: '1', margin: 0 }}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>

                            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Button
                                        style={{ flex: 1 }}
                                        onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                                        disabled={currentStep === 0}
                                    >
                                        上一题
                                    </Button>
                                    <Button
                                        type="primary"
                                        style={{ flex: 1 }}
                                        onClick={() => {
                                            if (currentStep === questions.length - 1) {
                                                onFinish();
                                            } else {
                                                setCurrentStep(prev => Math.min(questions.length - 1, prev + 1));
                                            }
                                        }}
                                        loading={status === 'submitting' && currentStep === questions.length - 1}
                                    >
                                        {currentStep === questions.length - 1 ? '提交' : '下一题'}
                                    </Button>
                                </div>
                                <Button
                                    type="default"
                                    danger
                                    icon={<LogoutOutlined />}
                                    onClick={handleExit}
                                    block
                                >
                                    退出练习
                                </Button>
                            </div>
                        </Card>
                    </div>
                </Col>
            </Row>

            <style jsx>{`
                .indicator-btn-small {
                    border-radius: 8px;
                    border: 1px solid #d9d9d9;
                    background: #fff;
                    color: #666;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s;
                    outline: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .indicator-btn-small:hover {
                    border-color: #1890ff;
                    color: #1890ff;
                }
                .indicator-btn-small.active {
                    background: #1890ff;
                    color: #fff;
                    border-color: #1890ff;
                    font-weight: bold;
                    box-shadow: 0 4px 10px rgba(24, 144, 255, 0.2);
                }
                .indicator-btn-small.answered:not(.active) {
                    background: #e6f7ff;
                    border-color: #91d5ff;
                    color: #1890ff;
                }
                @media (max-width: 991px) {
                    .practice-right-panel {
                        margin-bottom: 24px;
                        order: -1; 
                    }
                    /* Ensure info panel appears on top on mobile if desired, or let it follow natural order */
                }
            `}</style>
        </div>
    );
};

export default FreePractice;
