import React from 'react';
import { Card, List, Typography, Space, Button, Tag } from 'antd';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import './QuizResult.css';
import { getResultQuestions } from './resultQuestions';

const { Title, Text } = Typography;

// 字母选项标识数组
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const QuizResult = ({ submission, quiz, settings, mode, canAttemptAgain, attemptNumber, answerLabel = '你的答案' }) => {
  if (!submission || !quiz) {
    return <Card><Text>加载中...</Text></Card>;
  }

  // 根据数据结构获取数据
  const submissionData = submission.submission || submission;
  const { score, submitTime, answers } = submissionData;

  // 如果是查看详情的场景，使用 submission 中的统计数据
  const totalCount = submission.totalCount || quiz.questions?.length || 0;
  const correctCount = submission.correctCount ?? score ?? answers?.filter(a => a.isCorrect)?.length ?? 0;
  const accuracy = submission.accuracy || (totalCount > 0 ? (correctCount / totalCount) * 100 : 0);

  // 确保questions存在
  const questions = getResultQuestions(quiz.questions || [], answers || [], submission.questions || []);

  // 是否为量表测试（仅依据测验配置，不因混合题而整体隐藏）
  const isScaleTest = Boolean(quiz.isScaleTest);

  // 工具：生成量表选项标签
  const getScaleOptions = (question) => {
    const level = question?.scaleLevel || (Array.isArray(question?.scaleLabels) ? question.scaleLabels.length : 5);
    if (Array.isArray(question?.scaleLabels) && question.scaleLabels.length === level) {
      return question.scaleLabels;
    }
    return Array.from({ length: level }, (_, i) => `${i + 1}`);
  };

  // 获取测验设置
  const quizSettings = quiz.settings || {};
  // 判断是否显示答案 - 优先使用传入的 settings，如果没有则使用 quiz.settings
  const showAnswers = settings?.showAnswerAfterSubmit !== undefined
    ? settings.showAnswerAfterSubmit
    : quizSettings.showAnswerAfterSubmit;

  // 判断是否显示分数 - 优先使用传入的 settings，如果没有则使用 quiz.settings
  const showScore = settings?.showScoreAfterSubmit !== undefined
    ? settings.showScoreAfterSubmit
    : quizSettings.showScoreAfterSubmit;

  const handleAttemptAgain = () => {
    window.location.reload();
  };

  return (
    <Card>
      <Title level={4} style={{ marginTop: '8px' }}>测验结果</Title>
      {showScore && !isScaleTest ? (
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ marginRight: '8px', fontSize: '13px' }}>得分</Text>
            <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>{score}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ marginRight: '8px', fontSize: '13px' }}>正确率</Text>
            <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>{accuracy.toFixed(1)}%</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ marginRight: '8px', fontSize: '13px' }}>提交时间</Text>
            <Text style={{ fontSize: '14px' }}>{new Date(submitTime).toLocaleString()}</Text>
          </div>
        </div>
      ) : showScore && isScaleTest ? (
        // 量表测试：显示提交时间和提示，不显示分数/正确率
        <div style={{
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ marginRight: '8px', fontSize: '13px' }}>提交时间</Text>
            <Text style={{ fontSize: '14px' }}>{new Date(submitTime).toLocaleString()}</Text>
          </div>
          <div style={{ marginTop: '12px' }}>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              本次为问卷测验：系统将记录你的选择用于统计分析，不计对错、分数与积分。
            </Text>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ marginRight: '8px', fontSize: '13px' }}>提交时间</Text>
            <Text style={{ fontSize: '14px' }}>{new Date(submitTime).toLocaleString()}</Text>
          </div>
          <div style={{ marginTop: '12px' }}>
            <Text type="secondary" style={{ fontSize: '14px' }}>
              您已完成测验，但系统设置为不显示得分。请等待老师公布结果。
            </Text>
          </div>
        </div>
      )}

      {canAttemptAgain && (
        <Button type="primary" onClick={handleAttemptAgain} style={{ marginTop: '16px' }}>再次作答</Button>
      )}

      {/* 显示完整答题详情（包括正确答案） */}
      {showAnswers ? (
        <>
          <Title level={5}>答题详情</Title>
          <List
            dataSource={answers || []}
            renderItem={answer => {
              // 查找对应的题目
              const question = questions.find(q => q.originalQuestionId === answer.questionId);

              if (!question) {
                return (
                  <List.Item>
                    <Text type="warning">题目信息不可用</Text>
                  </List.Item>
                );
              }

              const correctOption = (question.options || []).find(opt => opt.isCorrect);
              const selectedOption = (question.options || []).find(opt =>
                opt._id?.toString() === answer.selectedOption
              );

              // 判断题特殊处理
              const userSelectedTrue = question.type === 'TRUE_FALSE' &&
                selectedOption &&
                selectedOption.content === '正确';

              return (
                <List.Item style={{ marginBottom: '16px', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '8px', background: '#f9f9f9' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ fontSize: '16px', color: '#333', fontWeight: 'bold' }}>
                      <div className="quiz-markdown-content">
                        <MarkdownRenderer content={question.content} hideCopyButton={true} />
                      </div>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {question.type === 'PSYCHOLOGICAL_SCALE' ? (
                        // 量表题：展示用户评分（单个）或矩阵评分
                        <div style={{ marginTop: '8px' }}>
                          {answer.matrixAnswers ? (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
                                <thead>
                                  <tr style={{ background: '#fafafa' }}>
                                    <th style={{ textAlign: 'left', padding: '6px 8px', border: '1px solid #e8e8e8' }}></th>
                                    {getScaleOptions(question).map((label, i) => (
                                      <th key={i} style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #e8e8e8' }}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(answer.matrixAnswers).map(([rowKey, idx], r) => (
                                    <tr key={rowKey}>
                                      <td style={{ padding: '6px 8px', border: '1px solid #e8e8e8' }}>{
                                        (question.matrixRows || []).find(x => (x.id || '').toString() === rowKey)?.content || rowKey
                                      }</td>
                                      {getScaleOptions(question).map((_, i) => (
                                        <td key={i} style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #e8e8e8' }}>
                                          {Number(idx) === i ? '●' : '○'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {getScaleOptions(question).map((label, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div>{Number(answer.scaleValue) - 1 === i ? '●' : '○'}</div>
                                  <div style={{ fontSize: '12px', color: '#666' }}>{i + 1}</div>
                                  <div style={{ fontSize: '12px' }}>{label}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : question.type === 'TRUE_FALSE' ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {/* 正确选项 */}
                          {(() => {
                            const isCorrectA = correctOption?.content === '正确';
                            const isSelectedA = userSelectedTrue;
                            let bgColorA = 'white';
                            let borderColorA = '#d9d9d9';
                            let borderWidthA = '1px';

                            if (isCorrectA && isSelectedA) {
                              bgColorA = '#f6ffed';
                              borderColorA = '#52c41a';
                              borderWidthA = '2px';
                            } else if (isCorrectA) {
                              bgColorA = '#f6ffed';
                              borderColorA = '#52c41a';
                              borderWidthA = '2px';
                            } else if (isSelectedA) {
                              bgColorA = '#fff2f0';
                              borderColorA = '#ff4d4f';
                              borderWidthA = '2px';
                            }

                            return (
                              <div style={{
                                padding: '10px 12px',
                                border: `${borderWidthA} solid ${borderColorA}`,
                                borderRadius: '6px',
                                background: bgColorA,
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'center'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                  <Text style={{ marginRight: '8px', color: isCorrectA ? '#52c41a' : isSelectedA ? '#ff4d4f' : '#333' }}><strong>A.</strong></Text>
                                  <Text>正确</Text>
                                </div>
                                <Space size={4}>
                                  {!isScaleTest && isCorrectA && (
                                    <Tag color="success" style={{ margin: 0, fontWeight: 'bold' }}>正确答案</Tag>
                                  )}
                                  {isSelectedA && (
                                    <Tag color={isCorrectA ? 'success' : 'error'} style={{ margin: 0 }}>
                                      {isCorrectA ? '✓ 你的选择' : '✗ 你的选择'}
                                    </Tag>
                                  )}
                                </Space>
                              </div>
                            );
                          })()}
                          {/* 错误选项 */}
                          {(() => {
                            const isCorrectB = correctOption?.content === '错误';
                            const isSelectedB = !userSelectedTrue;
                            let bgColorB = 'white';
                            let borderColorB = '#d9d9d9';
                            let borderWidthB = '1px';

                            if (isCorrectB && isSelectedB) {
                              bgColorB = '#f6ffed';
                              borderColorB = '#52c41a';
                              borderWidthB = '2px';
                            } else if (isCorrectB) {
                              bgColorB = '#f6ffed';
                              borderColorB = '#52c41a';
                              borderWidthB = '2px';
                            } else if (isSelectedB) {
                              bgColorB = '#fff2f0';
                              borderColorB = '#ff4d4f';
                              borderWidthB = '2px';
                            }

                            return (
                              <div style={{
                                padding: '10px 12px',
                                border: `${borderWidthB} solid ${borderColorB}`,
                                borderRadius: '6px',
                                background: bgColorB,
                                marginBottom: '8px',
                                display: 'flex',
                                alignItems: 'center'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                  <Text style={{ marginRight: '8px', color: isCorrectB ? '#52c41a' : isSelectedB ? '#ff4d4f' : '#333' }}><strong>B.</strong></Text>
                                  <Text>错误</Text>
                                </div>
                                <Space size={4}>
                                  {!isScaleTest && isCorrectB && (
                                    <Tag color="success" style={{ margin: 0, fontWeight: 'bold' }}>正确答案</Tag>
                                  )}
                                  {isSelectedB && (
                                    <Tag color={isCorrectB ? 'success' : 'error'} style={{ margin: 0 }}>
                                      {isCorrectB ? '✓ 你的选择' : '✗ 你的选择'}
                                    </Tag>
                                  )}
                                </Space>
                              </div>
                            );
                          })()}
                        </Space>
                      ) : (
                        // 保持选项的原始顺序并添加字母标识
                        question.options.map((option, index) => {
                          const isCorrect = option.isCorrect;
                          const isUserSelected = selectedOption && selectedOption._id === option._id;

                          // 确定背景色和边框色
                          let bgColor = 'white';
                          let borderColor = '#d9d9d9';
                          let borderWidth = '1px';

                          if (isCorrect && isUserSelected) {
                            // 选对了
                            bgColor = '#f6ffed';
                            borderColor = '#52c41a';
                            borderWidth = '2px';
                          } else if (isCorrect) {
                            // 正确答案（用户没选）
                            bgColor = '#f6ffed';
                            borderColor = '#52c41a';
                            borderWidth = '2px';
                          } else if (isUserSelected) {
                            // 用户选的（但不是正确答案）
                            bgColor = '#fff2f0';
                            borderColor = '#ff4d4f';
                            borderWidth = '2px';
                          }

                          return (
                            <div key={option._id} style={{
                              padding: '10px 12px',
                              border: `${borderWidth} solid ${borderColor}`,
                              borderRadius: '6px',
                              background: bgColor,
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                <Text strong style={{ marginRight: '8px', display: 'inline-block', width: '20px', color: isCorrect ? '#52c41a' : isUserSelected ? '#ff4d4f' : '#333' }}>{OPTION_LABELS[index]}.</Text>
                                <div className="quiz-markdown-content" style={{ flex: 1, display: 'inline-block' }}>
                                  <MarkdownRenderer content={option.content} hideCopyButton={true} />
                                </div>
                              </div>
                              <Space size={4}>
                                {!isScaleTest && isCorrect && (
                                  <Tag color="success" style={{ margin: 0, fontWeight: 'bold' }}>正确答案</Tag>
                                )}
                                {isUserSelected && (
                                  <Tag color={isCorrect ? 'success' : 'error'} style={{ margin: 0 }}>
                                    {isCorrect ? '✓ 你的选择' : '✗ 你的选择'}
                                  </Tag>
                                )}
                              </Space>
                            </div>
                          );
                        })
                      )}
                    </Space>

                    {/* 如果题目有解析，显示解析 */}
                    {question.explanation && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px'
                      }}>
                        <Text strong style={{ display: 'block', marginBottom: '4px' }}>解析：</Text>
                        <div className="quiz-markdown-content explanation">
                          <MarkdownRenderer content={question.explanation} hideCopyButton={true} />
                        </div>
                      </div>
                    )}
                  </Space>
                </List.Item>
              );
            }}
          />
        </>
      ) : showScore ? (
        // 仅显示对错情况，不显示正确答案
        <>
          <Title level={5}>答题情况</Title>
          <List
            dataSource={answers || []}
            renderItem={(answer, index) => {
              // 查找对应的题目
              const question = questions.find(q => q.originalQuestionId === answer.questionId);

              if (!question) {
                return (
                  <List.Item>
                    <Text type="warning">题目信息不可用</Text>
                  </List.Item>
                );
              }

              const selectedOption = (question.options || []).find(opt =>
                opt._id?.toString() === answer.selectedOption
              );

              // 判断题特殊处理
              const userSelectedTrue = question.type === 'TRUE_FALSE' &&
                selectedOption &&
                selectedOption.content === '正确';

              return (
                <List.Item style={{
                  marginBottom: '16px',
                  padding: '16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px',
                  background: '#f9f9f9'
                }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '16px', color: '#333', fontWeight: 'bold', flex: 1 }}>
                        <Text>第 {index + 1} 题</Text>
                        <div className="quiz-markdown-content">
                          <MarkdownRenderer content={question.content} hideCopyButton={true} />
                        </div>
                      </div>
                      <div>
                        {isScaleTest || question.type === 'PSYCHOLOGICAL_SCALE' ? (
                          <Tag color="blue" style={{ fontSize: '14px', padding: '2px 8px' }}>已记录</Tag>
                        ) : answer.isCorrect ? (
                          <Tag color="success" style={{ fontSize: '14px', padding: '2px 8px' }}>回答正确</Tag>
                        ) : (
                          <Tag color="error" style={{ fontSize: '14px', padding: '2px 8px' }}>回答错误</Tag>
                        )}
                      </div>
                    </div>

                    {/* 显示所有选项，但不标明正确答案，只标明用户的选择；量表题单独处理 */}
                    <Space direction="vertical" style={{ width: '100%', marginTop: '12px' }}>
                      {question.type === 'PSYCHOLOGICAL_SCALE' ? (
                        <div>
                          {answer.matrixAnswers ? (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
                                <thead>
                                  <tr style={{ background: '#fafafa' }}>
                                    <th style={{ textAlign: 'left', padding: '6px 8px', border: '1px solid #e8e8e8' }}></th>
                                    {getScaleOptions(question).map((label, i) => (
                                      <th key={i} style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #e8e8e8' }}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(answer.matrixAnswers).map(([rowKey, idx], r) => (
                                    <tr key={rowKey}>
                                      <td style={{ padding: '6px 8px', border: '1px solid #e8e8e8' }}>{
                                        (question.matrixRows || []).find(x => (x.id || '').toString() === rowKey)?.content || rowKey
                                      }</td>
                                      {getScaleOptions(question).map((_, i) => (
                                        <td key={i} style={{ textAlign: 'center', padding: '6px 8px', border: '1px solid #e8e8e8' }}>
                                          {Number(idx) === i ? '●' : '○'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {getScaleOptions(question).map((label, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div>{Number(answer.scaleValue) - 1 === i ? '●' : '○'}</div>
                                  <div style={{ fontSize: '12px', color: '#666' }}>{i + 1}</div>
                                  <div style={{ fontSize: '12px' }}>{label}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : question.type === 'TRUE_FALSE' ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div style={{
                            padding: '8px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            background: 'white',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <Text style={{ marginRight: '4px' }}><strong>A.</strong></Text>
                              <Text>正确</Text>
                            </div>
                            {userSelectedTrue && <Text style={{ marginLeft: '8px' }}>{answerLabel}</Text>}
                          </div>
                          <div style={{
                            padding: '8px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            background: 'white',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                              <Text style={{ marginRight: '4px' }}><strong>B.</strong></Text>
                              <Text>错误</Text>
                            </div>
                            {!userSelectedTrue && <Text style={{ marginLeft: '8px' }}>{answerLabel}</Text>}
                          </div>
                        </Space>
                      ) : (
                        // 显示所有选项，但不标明正确答案
                        question.options.map((option, index) => {
                          const isUserSelected = selectedOption && selectedOption._id === option._id;
                          return (
                            <div key={option._id} style={{
                              padding: '8px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              background: isUserSelected ? '#f6ffed' : 'white',
                              marginBottom: '8px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                <Text strong style={{ marginRight: '4px', display: 'inline-block', width: '18px' }}>{OPTION_LABELS[index]}.</Text>
                                <div className="quiz-markdown-content" style={{ flex: 1, display: 'inline-block' }}>
                                  <MarkdownRenderer content={option.content} hideCopyButton={true} />
                                </div>
                              </div>
                              {isUserSelected && <Text style={{ marginLeft: '8px' }}>{answerLabel}</Text>}
                            </div>
                          );
                        })
                      )}
                    </Space>
                  </Space>
                </List.Item>
              );
            }}
          />
        </>
      ) : (
        // 当既不显示答案也不显示分数时，显示友好提示
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Text type="secondary">答案和得分暂未公布，请稍后查看。</Text>
        </div>
      )}
    </Card>
  );
};

export default QuizResult;