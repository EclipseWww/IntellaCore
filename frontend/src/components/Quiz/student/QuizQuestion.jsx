import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, Radio, Checkbox, Input, Typography, Space, Table } from 'antd';
import { shuffleArray } from '../../../utils/array';
import MarkdownRenderer from '../../shared/MarkdownRenderer';
import './QuizQuestion.css';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

// 题目类型映射
const QUESTION_TYPE_MAP = {
  'SINGLE_CHOICE': 'single',
  'MULTIPLE_CHOICE': 'multiple',
  'TRUE_FALSE': 'single',
  'PSYCHOLOGICAL_SCALE': 'scale'
};

const QuizQuestion = ({
  question,
  value,
  onChange,
  randomizeOptions = false,
  optionOrder = null, // 服务器提供的选项顺序（用于恢复进度时保持一致）
  disabled = false,
  currentStep
}) => {
  // 创建一个ref用于保存题目ID到选项的映射
  const optionsMapRef = useRef({});

  // 保存初始randomizeOptions值的ref
  const initialRandomizeRef = useRef(null);

  // 在组件挂载时设置初始randomizeOptions值
  useEffect(() => {
    if (initialRandomizeRef.current === null) {
      initialRandomizeRef.current = randomizeOptions;
    }
  }, []);

  // 使用问题ID作为稳定的标识符
  const questionId = question?._id;

  // 使用useMemo来处理和缓存选项，使其仅在问题ID变化且没有缓存时重新计算
  const options = useMemo(() => {
    if (!question?.options) return [];

    // 如果已经有缓存的选项，直接返回
    if (optionsMapRef.current[questionId]) {
      return optionsMapRef.current[questionId];
    }

    let processedOptions = [...question.options].map(opt => ({
      ...opt,
      _id: opt._id || opt.id, // 确保有唯一标识
      content: opt.content || '', // 确保有内容
      value: opt.value // 用于量表题
    }));

    // 如果服务器提供了选项顺序，使用服务器的顺序
    if (optionOrder && Array.isArray(optionOrder) && optionOrder.length > 0) {
      const orderedOptions = optionOrder
        .map(optId => processedOptions.find(opt => opt._id?.toString() === optId?.toString()))
        .filter(Boolean);
      // 如果匹配到的选项数量正确，使用服务器顺序
      if (orderedOptions.length === processedOptions.length) {
        processedOptions = orderedOptions;
      }
    } else {
      // 使用保存的初始randomizeOptions值，而不是当前的props
      const shouldRandomize = initialRandomizeRef.current && question.type !== 'TRUE_FALSE';

      // 只有在非判断题且启用了选项乱序时才打乱选项顺序
      if (shouldRandomize) {
        // 对选项进行随机化处理
        processedOptions = shuffleArray(processedOptions);
      }
    }

    // 缓存处理后的选项
    optionsMapRef.current[questionId] = processedOptions;

    return processedOptions;
  }, [questionId, optionOrder]); // 添加 optionOrder 依赖

  if (!question) {
    console.log('没有题目数据');
    return null;
  }

  // 将后端题目类型映射到前端类型
  const questionType = QUESTION_TYPE_MAP[question.type] || question.type;

  const renderQuestionContent = () => {
    // 使用 MarkdownRenderer 组件替代 ReactMarkdown
    const questionContent = question.content ? (
      <div className="quiz-question-content">
        <MarkdownRenderer content={question.content} hideCopyButton={true} />
      </div>
    ) : '';

    switch (questionType) {
      case 'single':
        return (
          <div style={{
            padding: '8px 0',
            marginBottom: '8px',
            flexDirection: 'column',
            alignItems: 'flex-start'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              marginBottom: '12px'
            }}>
              <div style={{
                minWidth: '60px',
                height: '24px',
                backgroundColor: '#e6f7ff',
                color: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
                padding: '0 8px',
                width: 'fit-content'
              }}>
                第 {currentStep + 1} 题
              </div>
              <div style={{ flex: 1, padding: '0 16px' }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#262626',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                }}>
                  {questionContent}
                </span>
              </div>
            </div>

            <div style={{ marginLeft: '36px' }}>
              <Radio.Group
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {options.map((option, optIndex) => (
                    <Radio
                      key={option._id}
                      value={option._id}
                      style={{ userSelect: 'none' }}
                    >
                      <span style={{ userSelect: 'none' }}>
                        {String.fromCharCode(65 + optIndex)}.{' '}
                        <span className="quiz-option-content">
                          <MarkdownRenderer content={option.content} hideCopyButton={true} />
                        </span>
                      </span>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </div>
          </div>
        );

      case 'multiple':
        return (
          <div style={{
            padding: '8px 0',
            marginBottom: '8px',
            flexDirection: 'column',
            alignItems: 'flex-start'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              marginBottom: '12px'
            }}>
              <div style={{
                minWidth: '60px',
                height: '24px',
                backgroundColor: '#e6f7ff',
                color: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
                padding: '0 8px',
                width: 'fit-content'
              }}>
                第 {currentStep + 1} 题
              </div>
              <div style={{ flex: 1, padding: '0 16px' }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  color: '#262626',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                }}>
                  {questionContent}
                </span>
              </div>
            </div>

            <div style={{ marginLeft: '36px' }}>
              <Checkbox.Group
                value={value}
                onChange={onChange}
                disabled={disabled}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {options.map((option, optIndex) => (
                    <Checkbox
                      key={option._id}
                      value={option._id}
                      style={{ display: 'block', marginBottom: '4px' }}
                    >
                      <div style={{
                        padding: '8px 12px',
                        background: (value || []).includes(option._id) ? '#e6f7ff' : '#fff',
                        border: `1px solid ${(value || []).includes(option._id) ? '#91d5ff' : '#d9d9d9'}`,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        transition: 'all 0.3s'
                      }}>
                        <span style={{
                          width: '20px',
                          color: (value || []).includes(option._id) ? '#1890ff' : '#595959'
                        }}>
                          {String.fromCharCode(65 + optIndex)}.
                        </span>
                        <span style={{
                          color: (value || []).includes(option._id) ? '#1890ff' : '#262626',
                          fontWeight: (value || []).includes(option._id) ? '500' : 'normal'
                        }}>
                          <span className="quiz-option-content">
                            <MarkdownRenderer content={option.content} hideCopyButton={true} />
                          </span>
                        </span>
                      </div>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </div>
          </div>
        );

      case 'scale':
        // 生成量表选项
        const generateScaleOptions = () => {
          if (question.scaleLabels && question.scaleLabels.length === question.scaleLevel) {
            return question.scaleLabels;
          } else {
            // 使用数字标签
            return Array.from({ length: question.scaleLevel || 5 }, (_, i) => `${i + 1}`);
          }
        };

        const scaleOptions = generateScaleOptions();
        const isMatrixScale = question.matrixRows && question.matrixRows.length > 0;

        if (isMatrixScale) {
          // 矩阵量表渲染
          return (
            <div style={{
              padding: '8px 0',
              marginBottom: '8px',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                marginBottom: '16px'
              }}>
                <div style={{
                  minWidth: '60px',
                  height: '24px',
                  backgroundColor: '#e6f7ff',
                  color: '#1890ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  padding: '0 8px',
                  width: 'fit-content'
                }}>
                  第 {currentStep + 1} 题
                </div>
                <div style={{ flex: 1, padding: '0 16px' }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#262626',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                  }}>
                    {questionContent}
                  </span>
                </div>
              </div>

              {/* 矩阵量表表格 */}
              <div style={{ width: '100%', marginLeft: '16px', marginRight: '16px' }}>
                <div style={{
                  overflowX: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  backgroundColor: '#fff'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '600px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fafafa' }}>
                        <th style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          borderBottom: '1px solid #d9d9d9',
                          borderRight: '1px solid #d9d9d9',
                          fontWeight: '600',
                          color: '#262626',
                          width: '40%'
                        }}>
                        </th>
                        {scaleOptions.map((label, index) => (
                          <th key={index} style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            borderBottom: '1px solid #d9d9d9',
                            borderRight: index < scaleOptions.length - 1 ? '1px solid #d9d9d9' : 'none',
                            fontWeight: '600',
                            color: '#262626',
                            fontSize: '13px',
                            minWidth: '80px'
                          }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {question.matrixRows.map((row, rowIndex) => (
                        <tr key={row.id || rowIndex} style={{
                          backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#fafafa'
                        }}>
                          <td style={{
                            padding: '12px 16px',
                            borderBottom: rowIndex < question.matrixRows.length - 1 ? '1px solid #d9d9d9' : 'none',
                            borderRight: '1px solid #d9d9d9',
                            verticalAlign: 'middle'
                          }}>
                            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                              <MarkdownRenderer content={row.content} hideCopyButton={true} />
                            </div>
                          </td>
                          {scaleOptions.map((label, colIndex) => (
                            <td key={colIndex} style={{
                              padding: '8px',
                              textAlign: 'center',
                              borderBottom: rowIndex < question.matrixRows.length - 1 ? '1px solid #d9d9d9' : 'none',
                              borderRight: colIndex < scaleOptions.length - 1 ? '1px solid #d9d9d9' : 'none',
                              verticalAlign: 'middle'
                            }}>
                              <Radio
                                name={`matrix_${question._id}_${row.id || rowIndex}`}
                                value={colIndex}
                                checked={value && value[row.id || rowIndex] === colIndex}
                                onChange={() => {
                                  const newValue = { ...value };
                                  newValue[row.id || rowIndex] = colIndex;
                                  onChange(newValue);
                                }}
                                disabled={disabled}
                                style={{
                                  transform: 'scale(1.2)',
                                  color: '#1890ff'
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 去除量表说明提示，根据需求不展示 1=1/2=2 等标签说明 */}
              </div>
            </div>
          );
        } else {
          // 单个量表渲染
          return (
            <div style={{
              padding: '8px 0',
              marginBottom: '8px',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                marginBottom: '12px'
              }}>
                <div style={{
                  minWidth: '60px',
                  height: '24px',
                  backgroundColor: '#e6f7ff',
                  color: '#1890ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  padding: '0 8px',
                  width: 'fit-content'
                }}>
                  第 {currentStep + 1} 题
                </div>
                <div style={{ flex: 1, padding: '0 16px' }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#262626',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none',
                  }}>
                    {questionContent}
                  </span>
                </div>
              </div>

              <div style={{ marginLeft: '36px' }}>
                <div>
                  <Radio.Group
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    style={{ width: '100%' }}
                  >
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px',
                      padding: '16px',
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      border: '1px solid #d9d9d9'
                    }}>
                      {scaleOptions.map((label, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          minWidth: '80px',
                          padding: '8px'
                        }}>
                          <Radio
                            value={index}
                            style={{
                              marginBottom: '8px',
                              transform: 'scale(1.2)'
                            }}
                          />
                          <span style={{
                            fontSize: '12px',
                            textAlign: 'center',
                            color: '#666',
                            lineHeight: '1.3'
                          }}>
                            {index + 1}
                          </span>
                          <span style={{
                            fontSize: '13px',
                            textAlign: 'center',
                            color: '#262626',
                            lineHeight: '1.3',
                            marginTop: '4px'
                          }}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Radio.Group>
                </div>
              </div>
            </div>
          );
        }

      default:
        console.log('未知题目类型:', questionType);
        return null;
    }
  };

  return (
    <div className="quiz-question">
      {question.description && (
        <Paragraph style={{ marginBottom: 24 }}>
          <div className="quiz-question-description">
            <MarkdownRenderer content={question.description} hideCopyButton={true} />
          </div>
        </Paragraph>
      )}
      {renderQuestionContent()}
    </div>
  );
};

export default QuizQuestion; 