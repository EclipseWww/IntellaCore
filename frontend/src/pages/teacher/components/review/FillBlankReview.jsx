import React from 'react';
import { Card, Space, Tag, Button, Radio, Spin, Empty, message } from 'antd';
import { fillBlankAPI } from '../../../../services/api';

const FillBlankReview = ({
    submissions,
    gradingState,
    onUpdateGradingState,
    onRefresh,
    formatClassName
}) => {
    const gradeScoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };

    const handleGrade = async (item, gradeKey) => {
        const bonusScore = gradeScoreMap[gradeKey];
        const currentScore = gradingState[item._id]?.bonusScore ?? item.grade?.bonusScore;

        // 如果点击的是当前已选的等级，则清除评分
        const isClearing = currentScore === bonusScore;
        const newScore = isClearing ? null : bonusScore;

        // 更新本地loading状态
        onUpdateGradingState(item._id, { bonusScore: newScore, loading: true });

        try {
            const feedback = gradingState[item._id]?.feedback ?? item.grade?.feedback ?? '';
            const response = await fillBlankAPI.gradeSubmission(item._id, newScore, feedback);

            if (response.success) {
                message.success(isClearing ? '已清除评分' : '评分成功');
                // 通知父组件刷新数据
                onRefresh(item._id, response.data.grade);
            }
        } catch (error) {
            console.error('评分失败:', error);
            message.error('评分失败');
        } finally {
            onUpdateGradingState(item._id, { loading: false });
        }
    };


    if (!submissions || submissions.length === 0) {
        return <Empty description="暂无提交记录" />;
    }

    return (
        <Card title={`学生填空结果 (${submissions.length}人提交)`}>
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                {submissions.map((item) => (
                    <Card
                        key={item._id}
                        size="small"
                        style={{ marginBottom: 12 }}
                        title={
                            <Space>
                                <span>{item.studentId?.name || '未知学生'}</span>
                                {item.studentId?.classId?.grade && item.studentId?.classId?.name && (
                                    <Tag>{formatClassName(item.studentId.classId.grade, item.studentId.classId.name)}</Tag>
                                )}
                                {item.autoScore !== null && (
                                    <Tag color="blue">自动评分: {item.autoScore}/10</Tag>
                                )}
                                {item.blanksWithAnswers > 0 && (
                                    <Tag color="cyan">正确: {item.correctCount}/{item.blanksWithAnswers}</Tag>
                                )}
                                {item.status === 'graded' && (
                                    <Tag color="green">已评</Tag>
                                )}
                            </Space>
                        }
                        extra={
                            <Space>
                                <Radio.Group
                                    size="small"
                                    value={Object.entries(gradeScoreMap).find(
                                        ([_, score]) => score === (gradingState[item._id]?.bonusScore ?? item.grade?.bonusScore)
                                    )?.[0]}
                                    optionType="button"
                                    buttonStyle="solid"
                                >
                                    <Radio.Button value="A" onClick={() => handleGrade(item, 'A')}>A</Radio.Button>
                                    <Radio.Button value="B" onClick={() => handleGrade(item, 'B')}>B</Radio.Button>
                                    <Radio.Button value="C" onClick={() => handleGrade(item, 'C')}>C</Radio.Button>
                                    <Radio.Button value="D" onClick={() => handleGrade(item, 'D')}>D</Radio.Button>
                                    <Radio.Button value="E" onClick={() => handleGrade(item, 'E')}>E</Radio.Button>
                                    <Radio.Button value="F" onClick={() => handleGrade(item, 'F')}>F</Radio.Button>
                                </Radio.Group>
                                {gradingState[item._id]?.loading && <Spin size="small" />}
                            </Space>
                        }
                    >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {item.answers && Object.entries(
                                item.answers instanceof Map ? Object.fromEntries(item.answers) : item.answers
                            ).map(([index, answer]) => (
                                <Tag key={index} style={{ margin: 0 }}>
                                    ({parseInt(index) + 1}) {answer || '(空)'}
                                </Tag>
                            ))}
                        </div>
                        {item.grade?.feedback && (
                            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                                评语: {item.grade.feedback}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </Card>
    );
};

export default FillBlankReview;
