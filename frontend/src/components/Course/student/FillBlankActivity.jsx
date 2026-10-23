import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Button, Space, message, Tag, Row, Spin, Popconfirm } from 'antd';
import { CheckCircleOutlined, SaveOutlined, SendOutlined, RollbackOutlined } from '@ant-design/icons';
import { fillBlankAPI } from '../../../services/api';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './FillBlankActivity.css';

// 填空标记占位符
const BLANK_PLACEHOLDER_START = '【BLANK_';
const BLANK_PLACEHOLDER_END = '】';

/**
 * 预处理内容：将 {{blank:答案}} 替换为HTML兼容的占位符
 */
const preprocessContent = (content) => {
    if (!content) return { processedContent: '', blanks: [] };

    const regex = /\{\{blank:([^}]*)\}\}/g;
    const blanks = [];
    let blankIndex = 0;

    const processedContent = content.replace(regex, (match, answer) => {
        blanks.push({
            index: blankIndex,
            correctAnswer: answer.trim()
        });
        const placeholder = `${BLANK_PLACEHOLDER_START}${blankIndex}${BLANK_PLACEHOLDER_END}`;
        blankIndex++;
        return placeholder;
    });

    return { processedContent, blanks };
};

/**
 * 单独的输入框组件 - 完全独立管理自己的状态
 */
const BlankInput = ({
    blankIndex,
    blank,
    initialValue,
    isSubmitted,
    correctAnswersRef,
    showCorrectAfterSubmit,
    answersRef
}) => {
    const [value, setValue] = useState(initialValue || '');
    const [showHint, setShowHint] = useState(false);
    const [inputWidth, setInputWidth] = useState(60);
    const measureSpanRef = useRef(null);

    const hasCorrectAnswer = blank.correctAnswer && blank.correctAnswer.length > 0;

    // 提交后检查是否正确
    useEffect(() => {
        if (isSubmitted && correctAnswersRef.current) {
            setShowHint(true);
        }
    }, [isSubmitted]);

    // 测量文字宽度
    useEffect(() => {
        if (measureSpanRef.current) {
            // 获取span的宽度，并加上一点额外的缓冲空间
            const width = measureSpanRef.current.offsetWidth;
            // 最小宽度60px，最大宽度不设限（或者设一个比较大的值，比如parent的100%）
            setInputWidth(Math.max(60, width));
        }
    }, [value, blank.correctAnswer, isSubmitted, showHint]);

    const isCorrect = hasCorrectAnswer && showHint &&
        value.trim().toLowerCase() === blank.correctAnswer.toLowerCase();

    let className = 'fillblank-input';
    if (isSubmitted) {
        if (hasCorrectAnswer) {
            className += isCorrect ? ' correct' : ' incorrect';
        } else {
            className += ' neutral';
        }
    }

    const handleChange = (e) => {
        const newValue = e.target.value;
        setValue(newValue);
        // 只更新ref，不触发父组件重新渲染
        answersRef.current[blankIndex.toString()] = newValue;
    };

    // 如果已提交且有正确答案，我们需要确保输入框足够宽以显示（可能是正确答案或者用户的错误答案）
    // 这里简单起见，测量内容可以是当前值，或者是 correct answer (如果需要显示的话)
    // 但通常输入框只显示 value。正确答案显示在旁边。
    // 如果想要输入框够长，measureText 应该是 value。
    const measureText = value || `(${blankIndex + 1})`;

    return (
        <span className="fillblank-input-inline">
            <span ref={measureSpanRef} className="fillblank-measure-span">
                {measureText}
            </span>
            <input
                type="text"
                className={className}
                value={value}
                onChange={handleChange}
                placeholder={`(${blankIndex + 1})`}
                disabled={isSubmitted}
                style={{ width: inputWidth }}
            />
            {isSubmitted && showCorrectAfterSubmit && hasCorrectAnswer && !isCorrect && (
                <span className="correct-answer-hint">{blank.correctAnswer}</span>
            )}
        </span>
    );
};

/**
 * 填空活动组件
 */
const FillBlankActivity = ({
    lessonId,
    activityId,
    content,
    instructions,
    showCorrectAfterSubmit = true,
    onSubmitSuccess
}) => {
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [renderKey, setRenderKey] = useState(0); // 用于强制重新渲染
    const answersRef = useRef({});
    const correctAnswersRef = useRef(null);

    // 预处理内容
    const { processedContent, blanks } = useMemo(() => preprocessContent(content), [content]);

    // 计算空格总数和有正确答案的空格数
    const totalBlanks = blanks.length;
    const blanksWithAnswers = useMemo(() => blanks.filter(b => b.correctAnswer).length, [blanks]);

    // 加载提交记录
    const loadSubmission = useCallback(async () => {
        if (!lessonId || !activityId) return;

        try {
            setLoading(true);
            const response = await fillBlankAPI.getSubmission(lessonId, activityId);
            if (response.success && response.data) {
                setSubmission(response.data);
                const answersObj = response.data.answers instanceof Map
                    ? Object.fromEntries(response.data.answers)
                    : (response.data.answers || {});
                answersRef.current = answersObj;
            }
        } catch (error) {
            console.error('加载填空提交失败:', error);
        } finally {
            setLoading(false);
        }
    }, [lessonId, activityId]);

    useEffect(() => {
        loadSubmission();
    }, [loadSubmission]);

    // 保存草稿
    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            await fillBlankAPI.saveDraft(lessonId, activityId, answersRef.current);
            message.success('草稿已保存');
        } catch (error) {
            console.error('保存草稿失败:', error);
            message.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    // 提交答案
    const handleSubmit = async () => {
        const currentAnswers = answersRef.current;
        const filledCount = Object.keys(currentAnswers).filter(k => currentAnswers[k]?.trim()).length;
        if (filledCount < totalBlanks) {
            message.warning(`还有 ${totalBlanks - filledCount} 个空格未填写`);
            return;
        }

        try {
            setSubmitting(true);
            const response = await fillBlankAPI.submit(lessonId, activityId, currentAnswers);
            if (response.success) {
                setSubmission(response.data);
                if (response.correctAnswers) {
                    correctAnswersRef.current = response.correctAnswers;
                }
                if (blanksWithAnswers > 0 && response.data.correctCount !== undefined) {
                    message.success(`提交成功！正确: ${response.data.correctCount}/${blanksWithAnswers}`);
                } else {
                    message.success('提交成功！');
                }
                setRenderKey(prev => prev + 1); // 强制重新渲染以显示结果
                onSubmitSuccess?.(response.data);
            }
        } catch (error) {
            console.error('提交失败:', error);
            message.error('提交失败');
        } finally {
            setSubmitting(false);
        }
    };

    // 撤回提交
    const handleWithdraw = async () => {
        try {
            setWithdrawing(true);
            const response = await fillBlankAPI.withdraw(lessonId, activityId);
            if (response.success) {
                setSubmission(response.data);
                correctAnswersRef.current = null;
                setRenderKey(prev => prev + 1); // 强制重新渲染
                message.success('已撤回，可以重新填写');
            }
        } catch (error) {
            console.error('撤回失败:', error);
            message.error('撤回失败');
        } finally {
            setWithdrawing(false);
        }
    };

    // 渲染输入框 - 不依赖任何会变化的state
    const renderBlankInput = (blankIndex) => {
        const blank = blanks[blankIndex];
        if (!blank) return null;

        const isSubmitted = submission?.status === 'submitted';

        return (
            <BlankInput
                key={`blank-${blankIndex}-${renderKey}`}
                blankIndex={blankIndex}
                blank={blank}
                initialValue={answersRef.current[blankIndex.toString()] || ''}
                isSubmitted={isSubmitted}
                correctAnswersRef={correctAnswersRef}
                showCorrectAfterSubmit={showCorrectAfterSubmit}
                answersRef={answersRef}
            />
        );
    };

    // 文本渲染器 - 处理占位符替换为输入框
    const createTextRenderer = () => {
        const TextRenderer = ({ children }) => {
            if (typeof children !== 'string') {
                return <>{children}</>;
            }

            const regex = new RegExp(`${BLANK_PLACEHOLDER_START.replace(/[[\]]/g, '\\$&')}(\\d+)${BLANK_PLACEHOLDER_END.replace(/[[\]]/g, '\\$&')}`, 'g');

            if (!regex.test(children)) {
                return <>{children}</>;
            }

            regex.lastIndex = 0;
            const parts = [];
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(children)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(<span key={`text-${lastIndex}`}>{children.slice(lastIndex, match.index)}</span>);
                }
                parts.push(renderBlankInput(parseInt(match[1], 10)));
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < children.length) {
                parts.push(<span key={`text-${lastIndex}`}>{children.slice(lastIndex)}</span>);
            }

            return <>{parts}</>;
        };
        return TextRenderer;
    };

    // 创建稳定的TextRenderer
    const TextRenderer = useMemo(() => createTextRenderer(), [blanks, submission, renderKey]);

    // ReactMarkdown组件映射
    const components = useMemo(() => ({
        p: ({ children, ...props }) => <p {...props}><TextRenderer>{children}</TextRenderer></p>,
        td: ({ children, ...props }) => <td {...props}><TextRenderer>{children}</TextRenderer></td>,
        th: ({ children, ...props }) => <th {...props}><TextRenderer>{children}</TextRenderer></th>,
        li: ({ children, ...props }) => <li {...props}><TextRenderer>{children}</TextRenderer></li>,
        strong: ({ children, ...props }) => <strong {...props}><TextRenderer>{children}</TextRenderer></strong>,
        em: ({ children, ...props }) => <em {...props}><TextRenderer>{children}</TextRenderer></em>,
    }), [TextRenderer]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="加载中..." />
            </div>
        );
    }

    const isSubmitted = submission?.status === 'submitted';

    return (
        <div className="fillblank-activity">
            {/* 活动说明 */}
            {instructions && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <MarkdownRenderer content={instructions} />
                </Card>
            )}

            {/* 填空内容 */}
            <Card className="fillblank-card">
                <div className="fillblank-content" key={renderKey}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={components}
                    >
                        {processedContent}
                    </ReactMarkdown>
                </div>
            </Card>

            {/* 提交状态或操作按钮 */}
            {isSubmitted ? (
                <div className="fillblank-status-bar">
                    <Space>
                        <Tag color="success" icon={<CheckCircleOutlined />}>已提交</Tag>
                        {/* 只有所有空都有标准答案时才显示得分 */}
                        {submission.blanksWithAnswers > 0 && submission.blanksWithAnswers === submission.totalBlanks && (
                            <>
                                <Tag color="blue">正确: {submission.correctCount}/{submission.blanksWithAnswers}</Tag>
                                {submission.autoScore !== null && (
                                    <Tag color="green">得分: {submission.autoScore}/10</Tag>
                                )}
                            </>
                        )}
                        {/* 存在开放答案的空时，不再显示等待教师评分，只显示已提交 */}
                        {/* 
                        {(submission.blanksWithAnswers === 0 || submission.blanksWithAnswers < submission.totalBlanks) && (
                            <Tag color="orange">等待教师评分</Tag>
                        )} 
                        */}
                        {submission.grade?.bonusScore > 0 && (
                            <Tag color="purple">加分: +{submission.grade.bonusScore}</Tag>
                        )}
                        <span style={{ color: '#999', fontSize: 12 }}>
                            {new Date(submission.submittedAt).toLocaleString()}
                        </span>
                    </Space>
                    {/* 已被教师评分后不允许撤回 */}
                    {!submission.grade?.gradedAt && (
                        <Popconfirm
                            title="确定要撤回并重新填写吗？"
                            onConfirm={handleWithdraw}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                size="small"
                                icon={<RollbackOutlined />}
                                loading={withdrawing}
                            >
                                撤回重填
                            </Button>
                        </Popconfirm>
                    )}
                </div>
            ) : (
                <Row justify="end" style={{ marginTop: 16 }}>
                    <Space>
                        <Button
                            icon={<SaveOutlined />}
                            onClick={handleSaveDraft}
                            loading={saving}
                        >
                            保存草稿
                        </Button>
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSubmit}
                            loading={submitting}
                        >
                            提交答案
                        </Button>
                    </Space>
                </Row>
            )}
        </div>
    );
};

export default FillBlankActivity;
