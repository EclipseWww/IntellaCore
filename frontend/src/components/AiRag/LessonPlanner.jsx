import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, Select, Spin, message, Typography, Space, Alert, Row, Col, Tag, Collapse, List } from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  SendOutlined,
  BookOutlined,
  AimOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  EditOutlined,
  InfoCircleOutlined,
  ExperimentOutlined,
  SafetyOutlined,
  RocketOutlined,
  CodeOutlined,
  FormOutlined
} from '@ant-design/icons';
import { aiRagAPI } from '../../services/api';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

/**
 * AI备课组件 - 大单元教学设计
 */
const LessonPlanner = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [lessonPlan, setLessonPlan] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [references, setReferences] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [parseError, setParseError] = useState(false);
  const eventSourceRef = useRef(null);

  // 获取知识库列表
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      setLoadingKnowledgeBases(true);
      try {
        const response = await aiRagAPI.getKnowledgeBases();
        if (response.success) {
          setKnowledgeBases(response.data || []);
        }
      } catch (error) {
        console.error('获取知识库列表错误:', error);
      } finally {
        setLoadingKnowledgeBases(false);
      }
    };
    fetchKnowledgeBases();
  }, []);

  // 清理事件源
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 实时解析JSON内容
  const parseJsonContent = (content) => {
    try {
      // 找到JSON的起始位置
      const jsonStart = content.indexOf('{');
      if (jsonStart === -1) return null;

      let jsonStr = content.substring(jsonStart);

      // 核心预处理函数：修复字符串值中的换行和代码块问题
      const fixJsonString = (str) => {
        let result = '';
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < str.length; i++) {
          const char = str[i];

          if (escapeNext) {
            result += char;
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            result += char;
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            result += char;
            continue;
          }

          // 在字符串内部，将实际换行符转换为 \n
          if (inString && (char === '\n' || char === '\r')) {
            if (char === '\r' && str[i + 1] === '\n') {
              i++; // 跳过 \r\n 中的 \n
            }
            result += '\\n';
            continue;
          }

          // 在字符串内部，处理反引号（markdown代码块）
          if (inString && char === '`') {
            result += "'"; // 将反引号替换为单引号
            continue;
          }

          result += char;
        }

        return result;
      };

      // 第一次尝试：直接解析
      try {
        const result = JSON.parse(jsonStr.trim());
        if (result && typeof result === 'object') {
          return result;
        }
      } catch (e) {
        // 继续修复
      }

      // 第二次尝试：修复字符串中的换行和代码块
      try {
        const fixed = fixJsonString(jsonStr);
        const result = JSON.parse(fixed.trim());
        if (result && typeof result === 'object') {
          return result;
        }
      } catch (e) {
        // 继续修复
      }

      // 第三次尝试：修复不完整的JSON（流式传输中）
      let fixedJson = fixJsonString(jsonStr).trim();

      // 移除末尾不完整的内容
      // 处理未闭合的字符串
      let inStr = false;
      let lastCompletePos = 0;
      for (let i = 0; i < fixedJson.length; i++) {
        if (fixedJson[i] === '\\' && i + 1 < fixedJson.length) {
          i++;
          continue;
        }
        if (fixedJson[i] === '"') {
          inStr = !inStr;
          if (!inStr) {
            lastCompletePos = i + 1;
          }
        }
        if (!inStr && (fixedJson[i] === '}' || fixedJson[i] === ']' || fixedJson[i] === ',')) {
          lastCompletePos = i + 1;
        }
      }

      // 如果在字符串中间截断，回退到上一个完整位置
      if (inStr && lastCompletePos > 0) {
        fixedJson = fixedJson.substring(0, lastCompletePos);
      }

      // 移除末尾的逗号
      fixedJson = fixedJson.replace(/,\s*$/, '');

      // 补全缺失的括号
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;

      for (let i = 0; i < openBrackets - closeBrackets; i++) fixedJson += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) fixedJson += '}';

      try {
        const result = JSON.parse(fixedJson);
        if (result && (result.title || result.coreCompetencies || result.keyPoints || result.teachingProcess)) {
          return result;
        }
        return null;
      } catch (e) {
        // 流式传输中解析失败是正常的，不需要警告
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    setLoading(true);
    setLessonPlan(null);
    setRawContent('');
    setReferences([]);
    setParseError(false);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const requestBody = { ...values, dbName: selectedKnowledgeBase };

      const eventSource = aiRagAPI.generateLessonPlan(
        requestBody,
        (content) => {
          if (Array.isArray(content) && content.length >= 2) {
            const lessonPlanContent = content[0];
            const referenceContent = content[1];

            if (lessonPlanContent) {
              setRawContent(lessonPlanContent);
              const parsed = parseJsonContent(lessonPlanContent);
              if (parsed) {
                setLessonPlan(parsed);
                setParseError(false);
              }
            }

            if (Array.isArray(referenceContent) && referenceContent.length > 0) {
              setReferences(referenceContent);
            }
          } else if (typeof content === 'string') {
            setRawContent(content);
            const parsed = parseJsonContent(content);
            if (parsed) {
              setLessonPlan(parsed);
              setParseError(false);
            }
          }
        },
        (error) => {
          console.error('流式传输错误:', error);
          message.error('生成教学方案失败: ' + (error.error || '未知错误'));
          setLoading(false);
        },
        (data) => {
          const finalContent = data?.lessonPlan || rawContent;
          setRawContent(finalContent);

          const parsedPlan = parseJsonContent(finalContent);
          if (parsedPlan) {
            setLessonPlan(parsedPlan);
            setParseError(false);
          } else {
            setParseError(true);
          }

          setLoading(false);
          message.success('教学方案生成成功');
        }
      );

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error('生成教学方案错误:', error);
      message.error('生成教学方案失败');
      setLoading(false);
    }
  };

  // 复制到剪贴板
  const copyToClipboard = () => {
    if (!rawContent) {
      message.warning('没有可复制的内容');
      return;
    }
    navigator.clipboard.writeText(rawContent)
      .then(() => message.success('已复制到剪贴板'))
      .catch(() => message.error('复制失败'));
  };

  // 下载为JSON
  const downloadAsJson = () => {
    if (!lessonPlan) {
      message.warning('没有可下载的教案');
      return;
    }
    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(lessonPlan, null, 2)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${lessonPlan.title || '教学方案'}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // 渲染核心素养目标（信息科技新课标四维度）
  const renderCoreCompetencies = (competencies) => {
    if (!competencies) return null;

    const dimensions = [
      { key: 'informationAwareness', label: '信息意识', color: '#1890ff', icon: <BulbOutlined /> },
      { key: 'computationalThinking', label: '计算思维', color: '#52c41a', icon: <ExperimentOutlined /> },
      { key: 'digitalLearning', label: '数字化学习与创新', color: '#fa8c16', icon: <RocketOutlined /> },
      { key: 'socialResponsibility', label: '信息社会责任', color: '#722ed1', icon: <SafetyOutlined /> }
    ];

    const hasContent = dimensions.some(d => competencies[d.key]?.length > 0);
    if (!hasContent) return null;

    return (
      <Card title={<><AimOutlined style={{ marginRight: 8 }} />核心素养目标</>} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {dimensions.map(dim => {
            const items = competencies[dim.key];
            if (!items || items.length === 0) return null;

            return (
              <Col xs={24} md={12} key={dim.key}>
                <div style={{
                  background: `${dim.color}08`,
                  padding: 16,
                  borderRadius: 8,
                  borderLeft: `4px solid ${dim.color}`,
                  height: '100%'
                }}>
                  <Space style={{ marginBottom: 8 }}>
                    <span style={{ color: dim.color }}>{dim.icon}</span>
                    <Text strong style={{ color: dim.color }}>{dim.label}</Text>
                  </Space>
                  {items.map((item, i) => (
                    <div key={i} style={{ marginTop: 6, lineHeight: 1.6, paddingLeft: 4 }}>• {item}</div>
                  ))}
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>
    );
  };

  // 渲染重难点及突破策略
  const renderKeyDifficulties = (keyPoints, difficulties, strategies) => {
    if ((!keyPoints || keyPoints.length === 0) && (!difficulties || difficulties.length === 0)) {
      return null;
    }

    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {keyPoints && keyPoints.length > 0 && (
          <Col xs={24} md={12}>
            <Card title={<><CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />教学重点</>}>
              {keyPoints.map((item, i) => (
                <Tag key={i} color="success" style={{
                  marginBottom: 8, marginRight: 8, whiteSpace: 'normal',
                  height: 'auto', lineHeight: 1.6, padding: '6px 12px', fontSize: 14
                }}>
                  {item}
                </Tag>
              ))}
            </Card>
          </Col>
        )}
        {difficulties && difficulties.length > 0 && (
          <Col xs={24} md={12}>
            <Card title={<><BulbOutlined style={{ marginRight: 8, color: '#fa8c16' }} />教学难点</>}>
              {difficulties.map((item, i) => (
                <Tag key={i} color="warning" style={{
                  marginBottom: 8, marginRight: 8, whiteSpace: 'normal',
                  height: 'auto', lineHeight: 1.6, padding: '6px 12px', fontSize: 14
                }}>
                  {item}
                </Tag>
              ))}
              {strategies && strategies.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: '#fff7e6', borderRadius: 6 }}>
                  <Text strong style={{ color: '#fa8c16' }}>突破策略：</Text>
                  {strategies.map((s, i) => (
                    <div key={i} style={{ marginTop: 4, lineHeight: 1.6 }}>• {s}</div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        )}
      </Row>
    );
  };

  // 渲染大单元目录
  const renderUnitOutline = (unitOutline) => {
    if (!unitOutline || unitOutline.length === 0) return null;

    return (
      <Card
        title={<><ScheduleOutlined style={{ marginRight: 8 }} />大单元课程目录</>}
        style={{ marginBottom: 16 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {unitOutline.map((item, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px',
                background: item.isCurrent ? '#e6f7ff' : '#fafafa',
                border: item.isCurrent ? '2px solid #1890ff' : '1px solid #f0f0f0',
                borderRadius: 8,
                flex: '1 1 calc(50% - 6px)',
                minWidth: 240
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <Tag color={item.isCurrent ? 'blue' : 'default'} style={{ marginRight: 8 }}>
                  {item.period}
                </Tag>
                {item.isCurrent && <Tag color="processing">当前课时</Tag>}
              </div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>{item.title}</Text>
              {item.brief && (
                <Text type="secondary" style={{ fontSize: 13 }}>{item.brief}</Text>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  // 渲染真实情境创设
  const renderRealContext = (realContext) => {
    if (!realContext) return null;

    return (
      <Card
        title={<><BulbOutlined style={{ marginRight: 8, color: '#fa8c16' }} />真实情境创设</>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          {realContext.scenario && (
            <Col span={24}>
              <div style={{
                padding: 16,
                background: '#fff7e6',
                borderRadius: 8,
                borderLeft: '4px solid #fa8c16'
              }}>
                <Text strong style={{ color: '#fa8c16', display: 'block', marginBottom: 8 }}>
                  🎬 情境场景
                </Text>
                <Paragraph style={{ marginBottom: 0, lineHeight: 1.8 }}>
                  {realContext.scenario}
                </Paragraph>
              </div>
            </Col>
          )}
          {realContext.connection && (
            <Col xs={24} md={12}>
              <div style={{
                padding: 16,
                background: '#e6f7ff',
                borderRadius: 8,
                borderLeft: '4px solid #1890ff',
                height: '100%'
              }}>
                <Text strong style={{ color: '#1890ff', display: 'block', marginBottom: 8 }}>
                  🔗 与本课关联
                </Text>
                <Paragraph style={{ marginBottom: 0, lineHeight: 1.8 }}>
                  {realContext.connection}
                </Paragraph>
              </div>
            </Col>
          )}
          {realContext.drivingQuestion && (
            <Col xs={24} md={12}>
              <div style={{
                padding: 16,
                background: '#f6ffed',
                borderRadius: 8,
                borderLeft: '4px solid #52c41a',
                height: '100%'
              }}>
                <Text strong style={{ color: '#52c41a', display: 'block', marginBottom: 8 }}>
                  ❓ 驱动性问题
                </Text>
                <Paragraph style={{ marginBottom: 0, lineHeight: 1.8, fontWeight: 500 }}>
                  {realContext.drivingQuestion}
                </Paragraph>
              </div>
            </Col>
          )}
        </Row>
      </Card>
    );
  };

  // 渲染教学过程（详细版）
  const renderTeachingProcess = (process) => {
    if (!process || process.length === 0) return null;

    const stageColors = {
      '情境': '#1890ff', '导入': '#1890ff',
      '探究': '#52c41a', '新知': '#52c41a', '讲授': '#52c41a',
      '合作': '#13c2c2', '讨论': '#13c2c2',
      '实践': '#fa8c16', '练习': '#fa8c16', '应用': '#fa8c16',
      '总结': '#722ed1', '评价': '#722ed1', '小结': '#722ed1'
    };

    const getColor = (stage) => {
      for (const [key, color] of Object.entries(stageColors)) {
        if (stage?.includes(key)) return color;
      }
      return '#1890ff';
    };

    const defaultActiveKeys = process.map((_, i) => i.toString());

    return (
      <Card title={<><ScheduleOutlined style={{ marginRight: 8 }} />教学过程</>} style={{ marginBottom: 16 }}>
        <Collapse defaultActiveKey={defaultActiveKeys} expandIconPosition="end">
          {process.map((step, index) => {
            const color = getColor(step.stage);
            return (
              <Panel
                header={
                  <Space size={12}>
                    <Tag color={color} style={{ margin: 0, fontSize: 14, padding: '2px 12px' }}>{step.stage}</Tag>
                    <Text type="secondary"><ClockCircleOutlined style={{ marginRight: 4 }} />{step.duration}</Text>
                    {step.objective && <Text type="secondary" style={{ fontSize: 13 }}>| {step.objective}</Text>}
                  </Space>
                }
                key={index.toString()}
                style={{ marginBottom: 8 }}
              >
                <div style={{ paddingLeft: 8 }}>
                  {/* 教师活动 */}
                  {step.teacherActivities?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#1890ff' }}>👨‍🏫 教师活动：</Text>
                      {step.teacherActivities.map((a, i) => (
                        <div key={i} style={{
                          marginTop: 8, padding: '8px 12px', background: '#e6f7ff',
                          borderRadius: 6, borderLeft: '3px solid #1890ff', lineHeight: 1.6
                        }}>
                          {a}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 学生活动 */}
                  {step.studentActivities?.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#52c41a' }}>👨‍🎓 学生活动：</Text>
                      {step.studentActivities.map((a, i) => (
                        <div key={i} style={{
                          marginTop: 8, padding: '8px 12px', background: '#f6ffed',
                          borderRadius: 6, borderLeft: '3px solid #52c41a', lineHeight: 1.6
                        }}>
                          {a}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 兼容旧格式 */}
                  {step.activities?.length > 0 && !step.teacherActivities && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>教学活动：</Text>
                      {step.activities.map((a, i) => (
                        <div key={i} style={{
                          marginTop: 8, padding: '8px 12px', background: '#f5f5f5',
                          borderRadius: 6, borderLeft: '3px solid #999', lineHeight: 1.6
                        }}>
                          {a}
                        </div>
                      ))}
                    </div>
                  )}

                  {step.content && !step.teacherActivities && (
                    <Paragraph style={{ marginBottom: 16 }}>{step.content}</Paragraph>
                  )}

                  {/* 代码示例 */}
                  {step.codeExample && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#722ed1' }}><CodeOutlined /> 代码示例：</Text>
                      <pre style={{
                        marginTop: 8, padding: 12, background: '#282c34', color: '#abb2bf',
                        borderRadius: 6, overflow: 'auto', fontSize: 13, lineHeight: 1.5
                      }}>
                        {step.codeExample
                          .replace(/```\w*\n?/g, '')
                          .replace(/```$/g, '')
                          .replace(/\\n/g, '\n')
                          .trim()}
                      </pre>
                    </div>
                  )}

                  {/* 环节内练习任务 */}
                  {step.exercise && step.exercise.title && (
                    <div style={{
                      marginBottom: 16,
                      padding: 16,
                      background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)',
                      borderRadius: 8,
                      border: '1px solid #91d5ff'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                        <FormOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                        <Text strong style={{ color: '#1890ff' }}>{step.exercise.title}</Text>
                        {step.exercise.difficulty && (
                          <Tag
                            color={step.exercise.difficulty === '基础' ? 'green' : step.exercise.difficulty === '提高' ? 'orange' : 'red'}
                            style={{ marginLeft: 8 }}
                          >
                            {step.exercise.difficulty}
                          </Tag>
                        )}
                      </div>
                      {step.exercise.description && (
                        <Paragraph style={{ marginBottom: 12, lineHeight: 1.8 }}>
                          {step.exercise.description}
                        </Paragraph>
                      )}
                      {step.exercise.referenceAnswer && (
                        <div>
                          <Text strong style={{ color: '#52c41a' }}>参考答案：</Text>
                          <pre style={{
                            marginTop: 8, padding: 12, background: '#282c34', color: '#abb2bf',
                            borderRadius: 6, overflow: 'auto', fontSize: 13, lineHeight: 1.5
                          }}>
                            {step.exercise.referenceAnswer
                              .replace(/```\w*\n?/g, '')  // 移除开始的代码块标记
                              .replace(/```$/g, '')       // 移除结束的代码块标记
                              .replace(/\\n/g, '\n')      // 处理转义换行
                              .trim()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 设计意图 */}
                  {(step.designIntent || step.design) && (
                    <div style={{
                      padding: 12, background: '#f9f9f9', borderRadius: 6,
                      borderLeft: `3px solid ${color}`
                    }}>
                      <Text type="secondary">
                        <EditOutlined style={{ marginRight: 6 }} />
                        <strong>设计意图：</strong>{step.designIntent || step.design}
                      </Text>
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </Collapse>
      </Card>
    );
  };

  // 渲染练习题
  const renderExercises = (exercises) => {
    if (!exercises || exercises.length === 0) return null;

    return (
      <Card title={<><FormOutlined style={{ marginRight: 8 }} />课堂练习</>} style={{ marginBottom: 16 }}>
        <Collapse defaultActiveKey={exercises.map((_, i) => i.toString())} expandIconPosition="end">
          {exercises.map((ex, index) => (
            <Panel
              header={
                <Space>
                  <Text strong>{ex.title}</Text>
                  {ex.difficulty && <Tag color={ex.difficulty === '基础' ? 'green' : 'orange'}>{ex.difficulty}</Tag>}
                </Space>
              }
              key={index.toString()}
            >
              <Paragraph>{ex.description}</Paragraph>
              {ex.referenceAnswer && (
                <div>
                  <Text strong style={{ color: '#52c41a' }}>参考答案：</Text>
                  <pre style={{
                    marginTop: 8, padding: 12, background: '#282c34', color: '#abb2bf',
                    borderRadius: 6, overflow: 'auto', fontSize: 13
                  }}>
                    {ex.referenceAnswer
                      .replace(/```\w*\n?/g, '')
                      .replace(/```$/g, '')
                      .replace(/\\n/g, '\n')
                      .trim()}
                  </pre>
                </div>
              )}
            </Panel>
          ))}
        </Collapse>
      </Card>
    );
  };

  // 渲染评价标准
  const renderEvaluation = (evaluation) => {
    if (!evaluation) return null;

    return (
      <Card title={<><CheckCircleOutlined style={{ marginRight: 8 }} />评价标准</>} style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          {evaluation.criteria && (
            <Col xs={24} md={16}>
              <Text strong>评价指标：</Text>
              <List
                dataSource={evaluation.criteria}
                renderItem={(item, i) => (
                  <List.Item style={{ padding: '8px 0', border: 'none' }}>
                    <Tag color="blue">{i + 1}</Tag> {item}
                  </List.Item>
                )}
              />
            </Col>
          )}
          {evaluation.methods && (
            <Col xs={24} md={8}>
              <Text strong>评价方式：</Text>
              <div style={{ marginTop: 8 }}>
                {evaluation.methods.map((m, i) => (
                  <Tag key={i} style={{ marginBottom: 8 }}>{m}</Tag>
                ))}
              </div>
            </Col>
          )}
        </Row>
      </Card>
    );
  };

  // 渲染作业
  const renderHomework = (homework) => {
    if (!homework || homework.length === 0) return null;

    return (
      <Card title={<><FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />课后作业</>} style={{ marginBottom: 16 }}>
        {Array.isArray(homework) && typeof homework[0] === 'object' ? (
          homework.map((hw, i) => (
            <div key={i} style={{ marginBottom: i < homework.length - 1 ? 12 : 0 }}>
              <Text strong>{hw.title}：</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0, paddingLeft: 12 }}>{hw.content}</Paragraph>
            </div>
          ))
        ) : (
          <List
            dataSource={homework}
            renderItem={(item, i) => (
              <List.Item style={{ padding: '8px 0' }}>
                {i + 1}. {typeof item === 'string' ? item : item.content || JSON.stringify(item)}
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  // 渲染参考资料
  const renderReferences = (refs) => {
    if (!refs || refs.length === 0) return null;

    return (
      <Card
        title={<><InfoCircleOutlined style={{ marginRight: 8, color: '#1890ff' }} />参考资料 ({refs.length}条)</>}
        style={{ marginBottom: 16 }}
      >
        {refs.map((ref, index) => {
          const content = typeof ref === 'string' ? ref : (ref.content || ref.title || JSON.stringify(ref));
          const title = typeof ref === 'object' ? ref.title : null;

          return (
            <div key={index} style={{
              marginBottom: index < refs.length - 1 ? 12 : 0,
              padding: 12, background: '#fafafa', borderRadius: 6, borderLeft: '3px solid #1890ff'
            }}>
              {title && <Text strong style={{ display: 'block', marginBottom: 4 }}>{title}</Text>}
              <Text type="secondary" style={{ lineHeight: 1.6 }}>
                {content.length > 300 ? content.substring(0, 300) + '...' : content}
              </Text>
            </div>
          );
        })}
      </Card>
    );
  };

  // 渲染教案展示
  const renderLessonPlan = () => {
    if (!lessonPlan) return null;

    return (
      <div>
        {/* 标题区域 */}
        <div style={{
          marginBottom: 20, paddingBottom: 16,
          borderBottom: '2px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <Text strong style={{ fontSize: 20 }}>{lessonPlan.title || '教学方案'}</Text>
            {lessonPlan.unitTheme && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">大单元主题：{lessonPlan.unitTheme}</Text>
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {lessonPlan.grade && <Tag>{lessonPlan.grade}</Tag>}
              {lessonPlan.totalPeriods && <Tag>{lessonPlan.totalPeriods}</Tag>}
              {lessonPlan.currentPeriod && <Tag color="blue">{lessonPlan.currentPeriod}</Tag>}
              {lessonPlan.duration && <Tag icon={<ClockCircleOutlined />}>{lessonPlan.duration}</Tag>}
            </div>
          </div>
          {loading && <Spin />}
        </div>

        {/* 核心素养目标 */}
        {renderCoreCompetencies(lessonPlan.coreCompetencies)}

        {/* 大单元课程目录 */}
        {renderUnitOutline(lessonPlan.unitOutline)}

        {/* 真实情境创设 */}
        {renderRealContext(lessonPlan.realContext)}

        {/* 重点难点 */}
        {renderKeyDifficulties(lessonPlan.keyPoints, lessonPlan.difficulties, lessonPlan.breakthroughStrategies)}

        {/* 教学准备 */}
        {lessonPlan.preparation && (
          <Card title={<><CheckCircleOutlined style={{ marginRight: 8 }} />教学准备</>} style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              {lessonPlan.preparation.teacher?.length > 0 && (
                <Col xs={24} md={8}>
                  <Text strong style={{ color: '#1890ff' }}>教师准备</Text>
                  {lessonPlan.preparation.teacher.map((item, i) => (
                    <div key={i} style={{ marginTop: 6, lineHeight: 1.6 }}>• {item}</div>
                  ))}
                </Col>
              )}
              {lessonPlan.preparation.student?.length > 0 && (
                <Col xs={24} md={8}>
                  <Text strong style={{ color: '#52c41a' }}>学生准备</Text>
                  {lessonPlan.preparation.student.map((item, i) => (
                    <div key={i} style={{ marginTop: 6, lineHeight: 1.6 }}>• {item}</div>
                  ))}
                </Col>
              )}
              {lessonPlan.preparation.environment?.length > 0 && (
                <Col xs={24} md={8}>
                  <Text strong style={{ color: '#fa8c16' }}>环境准备</Text>
                  {lessonPlan.preparation.environment.map((item, i) => (
                    <div key={i} style={{ marginTop: 6, lineHeight: 1.6 }}>• {item}</div>
                  ))}
                </Col>
              )}
            </Row>
          </Card>
        )}

        {/* 教学过程 */}
        {renderTeachingProcess(lessonPlan.teachingProcess)}

        {/* 兼容旧版：如果有独立的exercises数组，仍然渲染 */}
        {lessonPlan.exercises && lessonPlan.exercises.length > 0 && renderExercises(lessonPlan.exercises)}

        {/* 评价标准 */}
        {renderEvaluation(lessonPlan.evaluation)}

        {/* 课后作业 */}
        {renderHomework(lessonPlan.homework)}

        {/* 板书设计 */}
        {lessonPlan.boardDesign && (
          <Card title={<><EditOutlined style={{ marginRight: 8 }} />板书设计</>} style={{ marginBottom: 16 }}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {lessonPlan.boardDesign.replace(/\\n/g, '\n')}
            </pre>
          </Card>
        )}

        {/* 教学反思 */}
        {lessonPlan.reflection && (
          <Card title={<><BulbOutlined style={{ marginRight: 8, color: '#722ed1' }} />教学反思</>} style={{ marginBottom: 16 }}>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
              {lessonPlan.reflection.replace(/\\n/g, '\n')}
            </pre>
          </Card>
        )}

        {/* 参考资料 */}
        {renderReferences(references)}
      </div>
    );
  };

  return (
    <div className="lesson-planner">
      <Row gutter={24} style={{ marginTop: 20 }}>
        {/* 左侧表单 */}
        <Col xs={24} md={8}>
          <Card title="备课信息">
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Form.Item name="courseInfo" label="课程信息" rules={[{ required: true, message: '请输入课程信息' }]}>
                <Input placeholder="例如：Python条件判断语句（if语句）" />
              </Form.Item>

              <Form.Item name="targetStudents" label="目标学生" rules={[{ required: true, message: '请输入目标学生信息' }]}>
                <Input placeholder="例如：初中七年级学生，35人" />
              </Form.Item>

              <Form.Item name="teachingGoals" label="教学目标" rules={[{ required: true, message: '请输入教学目标' }]}>
                <TextArea rows={4} placeholder="例如：1. 理解if语句的语法结构；2. 能使用if-else进行条件判断..." />
              </Form.Item>

              <Form.Item name="additionalRequirements" label="额外要求">
                <TextArea rows={3} placeholder="例如：希望增加小组讨论环节，包含代码示例，按大单元设计..." />
              </Form.Item>

              <Form.Item name="model" label="选择模型" initialValue="qwen-max">
                <Select>
                  <Option value="qwen-max">通义千问-Max</Option>
                  <Option value="qwen-plus">通义千问-Plus</Option>
                  <Option value="qwen-turbo">通义千问-Turbo</Option>
                </Select>
              </Form.Item>

              <Form.Item label="知识库" extra="选择知识库可以让AI生成更符合需求的教学方案">
                <Select
                  placeholder="选择知识库（可选）"
                  allowClear
                  loading={loadingKnowledgeBases}
                  onChange={value => setSelectedKnowledgeBase(value)}
                >
                  {knowledgeBases.map(db => <Option key={db} value={db}>{db}</Option>)}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} icon={<SendOutlined />} block size="large">
                  生成教学方案
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右侧结果 */}
        <Col xs={24} md={16}>
          <Card
            title="教学方案"
            extra={
              <Space>
                <Button icon={<CopyOutlined />} onClick={copyToClipboard} disabled={!rawContent}>复制</Button>
                <Button icon={<DownloadOutlined />} onClick={downloadAsJson} disabled={!lessonPlan}>下载</Button>
              </Space>
            }
            style={{ minHeight: 500 }}
          >
            {loading && !lessonPlan && !rawContent && (
              <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#666' }}>正在生成详细教学方案，请稍候...</div>
              </div>
            )}

            {lessonPlan && (
              <div style={{ maxHeight: 800, overflowY: 'auto' }}>
                {renderLessonPlan()}
              </div>
            )}

            {loading && !lessonPlan && rawContent && (
              <div>
                <Alert
                  message="正在生成中..."
                  description="AI正在生成详细教学方案，内容将逐步呈现"
                  type="info" showIcon style={{ marginBottom: 16 }}
                />
                <pre style={{
                  whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16,
                  borderRadius: 8, maxHeight: 400, overflow: 'auto', fontSize: 14
                }}>
                  {rawContent}
                </pre>
              </div>
            )}

            {!loading && parseError && rawContent && !lessonPlan && (
              <div>
                <Alert message="教案格式解析失败，显示原始内容" type="warning" showIcon style={{ marginBottom: 16 }} />
                <pre style={{
                  whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16,
                  borderRadius: 8, maxHeight: 500, overflow: 'auto', fontSize: 14
                }}>
                  {rawContent}
                </pre>
              </div>
            )}

            {!loading && !lessonPlan && !parseError && !rawContent && (
              <div style={{ textAlign: 'center', color: '#999', padding: '120px 0' }}>
                <BookOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }} />
                <div style={{ fontSize: 16 }}>填写左侧表单并点击"生成教学方案"开始</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LessonPlanner;