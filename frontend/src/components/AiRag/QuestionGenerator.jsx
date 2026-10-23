import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, Select, Spin, message, Typography, Divider, Space, Alert, InputNumber, Checkbox, Row, Col, Layout, Collapse, Tabs, Badge, Tooltip, Tag } from 'antd';
import ReactMarkdown from 'react-markdown';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import { CopyOutlined, DownloadOutlined, SendOutlined, InfoCircleOutlined, BookOutlined, FileTextOutlined, ReadOutlined, SaveOutlined } from '@ant-design/icons';
import { aiRagAPI, quizAPI } from '../../services/api';

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { Content } = Layout;
const { Panel } = Collapse;
const { TabPane } = Tabs;

/**
 * AI出题组件
 * 用于生成试题
 */
const QuestionGenerator = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState('');
  const [streamingQuestions, setStreamingQuestions] = useState('');
  const [references, setReferences] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState(['选择题']);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [isParsingJson, setIsParsingJson] = useState(false);
  const eventSourceRef = useRef(null);
  const resultRef = useRef(null);
  const [savingQuestions, setSavingQuestions] = useState({});
  const [savedQuestions, setSavedQuestions] = useState({});

  // 获取知识库列表
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      setLoadingKnowledgeBases(true);
      try {
        const response = await aiRagAPI.getKnowledgeBases();
        if (response.success) {
          setKnowledgeBases(response.data || []);
        } else {
          message.error('获取知识库列表失败');
        }
      } catch (error) {
        console.error('获取知识库列表错误:', error);
        message.error('获取知识库列表失败: ' + (error.response?.data?.message || error.message));
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



  // 预设标签列表
  const DEFAULT_TAGS = [
    '信息技术基础：信息概念与特征',
    '信息技术基础：计算机基础知识',
    '信息技术基础：数据存储与单位换算',
    '信息技术基础：计算机病毒与防护',
    '互联网：网络基础知识',
    '互联网：网络设备',
    '互联网：通信介质',
    '互联网：TCP/IP协议与IP地址',
    '互联网：浏览器使用、网络安全、网络道德',
    '人工智能',
    '物联网',
    'Python编程：变量命名规则',
    'Python编程：赋值语句',
    'Python编程：数据输入输出',
    'Python编程：数据类型与转换',
    'Python编程：算术运算符',
    'Python编程：关系运算符',
    'Python编程：逻辑运算符',
    'Python编程：条件语句',
    'Python编程：for循环语句',
    'Python编程：range函数'
  ];

  // 提交表单，生成试题（流式响应）
  const handleSubmit = async (values) => {
    setLoading(true);
    setQuestions('');
    setStreamingQuestions('');
    setReferences([]);
    setParsedQuestions([]);
    setIsParsingJson(false);
    setSavedQuestions({});

    // 关闭之前的事件源
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const requestBody = {
        ...values,
        subject: '初中信息科技', // 固定学科
        questionTypes: selectedQuestionTypes,
        dbName: selectedKnowledgeBase
      };

      // 限制题目数量最大为5
      if (requestBody.count > 5) {
        requestBody.count = 5;
      }

      // 构建提示词，要求AI生成难度值
      const customPrompt = `请以JSON格式生成${values.count || 5}道初中信息科技题目。

要求：
1. 返回格式必须是合法的JSON，格式如下：
{
  "questions": [
    {
      "id": "1",
      "type": "选择题/判断题/编程题", 
      "content": "题目内容",
      "options": ["A. 选项1", "B. 选项2", ...],  // 选择题才有此字段
      "answer": "正确答案",
      "analysis": "详细解析",
      "difficultyValue": 5,  // 难度值，范围0-10，其中0-3为简单，4-6为中等，7-10为困难
      "knowledgePoints": ["${values.tag}"]  // 使用指定的知识点标签
    }
  ]
}

2. 题目要求：
- 学科：初中信息科技
- 主题/知识点：${values.tag} (请严格围绕此知识点出题)
- 补充主题：${values.topic || ''}
- 难度：${values.difficulty || '中等'}（请为每道题目提供一个0-10的具体难度值，${values.difficulty === '简单' ? '0-3' : values.difficulty === '中等' ? '4-6' : '7-10'}之间）
- 题型：${selectedQuestionTypes ? (Array.isArray(selectedQuestionTypes) ? selectedQuestionTypes.join('、') : selectedQuestionTypes) : '选择题、判断题'}
- 每道题必须包含完整的题干、选项（如适用）、答案和解析
- 每道题必须包含具体的难度值(difficultyValue)
- 每道题的知识点必须标记为: "${values.tag}"
- 题目难度要符合指定的难度级别
- 题目内容要覆盖指定的主题

请确保返回的是规范的JSON格式，不要包含任何其他说明文字。`;

      // 使用自定义提示词
      requestBody.customPrompt = customPrompt;

      // 使用流式响应API
      const eventSource = aiRagAPI.generateQuestions(
        requestBody,
        // 消息回调
        (content) => {
          if (Array.isArray(content) && content.length >= 2) {
            // 获取试题内容和参考资料
            const questionContent = content[0];
            const referenceContent = content[1];

            if (questionContent) {
              setStreamingQuestions(questionContent);
              // 检查是否包含JSON结构的开始
              if (questionContent.includes('"questions"')) {
                setIsParsingJson(true);
              }
              // 尝试解析不完整的JSON
              tryParseIncompleteJSON(questionContent);
            }

            if (Array.isArray(referenceContent) && referenceContent.length > 0) {
              const formattedRefs = referenceContent.map(ref => {
                if (typeof ref === 'string') return ref;
                return `${ref.title || '未知来源'}: ${ref.content || ''}`;
              });
              setReferences(formattedRefs);
            }
          } else if (typeof content === 'string') {
            setStreamingQuestions(content);
            // 检查是否包含JSON结构的开始
            if (content.includes('"questions"')) {
              setIsParsingJson(true);
            }
            // 尝试解析不完整的JSON
            tryParseIncompleteJSON(content);
          }
        },
        // 错误回调
        (error) => {
          console.error('流式传输错误:', error);
          message.error('生成试题失败: ' + (error.error || '未知错误'));
          setLoading(false);
          setIsParsingJson(false);
        },
        // 完成回调
        (data) => {
          console.log('流式传输完成:', data);
          setQuestions(streamingQuestions);
          setLoading(false);
          setIsParsingJson(false);
          message.success('试题生成成功');
        }
      );

      // 保存事件源引用
      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('生成试题错误:', error);
      message.error('生成试题失败: ' + (error.response?.data?.message || error.message));
      setLoading(false);
      setIsParsingJson(false);
    }
  };

  // 尝试解析不完整的JSON
  const tryParseIncompleteJSON = (content) => {
    if (!content) return;

    try {
      // 尝试直接解析完整JSON
      try {
        const parsedContent = JSON.parse(content);
        if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
          setParsedQuestions(parsedContent.questions);
          return;
        }
      } catch (e) {
        // 解析失败，尝试修复不完整的JSON
      }

      // 尝试提取questions数组部分
      const questionsMatch = content.match(/"questions"\s*:\s*\[([\s\S]*)/);
      if (questionsMatch && questionsMatch[1]) {
        let questionsContent = questionsMatch[1];

        // 计算已完成的题目对象数量
        const completeObjectsCount = (questionsContent.match(/\},/g) || []).length;

        // 如果有至少一个完整的题目对象
        if (completeObjectsCount > 0) {
          // 提取已完成的题目对象
          const objectsRegex = /(\{[^{}]*\}),/g;
          const objects = [];
          let match;

          while ((match = objectsRegex.exec(questionsContent)) !== null) {
            try {
              const objStr = match[1];
              const obj = JSON.parse(objStr);
              objects.push(obj);
            } catch (e) {
              // 忽略解析失败的对象
            }
          }

          // 如果找到了有效的题目对象
          if (objects.length > 0) {
            setParsedQuestions(objects);
          }
        }
      }
    } catch (error) {
      console.error('解析不完整JSON失败:', error);
    }
  };

  // 复制试题到剪贴板
  const copyToClipboard = () => {
    const contentToCopy = questions || streamingQuestions;
    if (!contentToCopy) {
      message.warning('没有可复制的内容');
      return;
    }

    navigator.clipboard.writeText(contentToCopy)
      .then(() => message.success('已复制到剪贴板'))
      .catch(err => message.error('复制失败: ' + err.message));
  };

  // 下载试题为Markdown文件
  const downloadAsMarkdown = () => {
    const contentToDownload = questions || streamingQuestions;
    if (!contentToDownload) {
      message.warning('没有可下载的内容');
      return;
    }

    const element = document.createElement('a');
    const file = new Blob([contentToDownload], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = '试题.md';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // 题型选项
  const questionTypeOptions = [
    { label: '选择题', value: '选择题' },
    { label: '判断题', value: '判断题' },
    { label: '编程题', value: '编程题' }
  ];

  // 难度选项
  const difficultyOptions = [
    { value: '简单', label: '简单' },
    { value: '中等', label: '中等' },
    { value: '困难', label: '困难' }
  ];

  // 渲染参考资料
  const renderReferences = (refs) => {
    if (!refs || refs.length === 0) return null;

    return (
      <div style={{ marginTop: 20 }}>
        <Collapse
          ghost
          expandIconPosition="end"
          defaultActiveKey={[]} // 默认折叠
        >
          <Panel
            header={
              <Space>
                <Badge count={refs.length} size="small" offset={[5, 0]}>
                  <InfoCircleOutlined style={{ fontSize: '18px' }} />
                </Badge>
                <Text strong>参考资料</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  (AI生成题目时参考的知识库内容)
                </Text>
              </Space>
            }
            key="1"
          >
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {refs.map((ref, index) => (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <Badge
                      count={index + 1}
                      style={{
                        backgroundColor: '#1890ff',
                        marginRight: '8px'
                      }}
                    />
                    <Text strong>参考片段</Text>
                  </div>
                  <div style={{
                    background: '#f9f9f9',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <Text>{ref}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Collapse>
      </div>
    );
  };

  // 保存题目到题库
  const saveQuestionToLibrary = async (question, index) => {
    // 设置保存状态
    setSavingQuestions(prev => ({ ...prev, [index]: true }));

    try {
      // 将AI生成的题目格式转换为数据库模型格式
      const questionType = mapQuestionType(question.type);

      if (!questionType) {
        message.error(`不支持保存 ${question.type} 类型的题目`);
        setSavingQuestions(prev => ({ ...prev, [index]: false }));
        return;
      }

      // 构建选项数组
      const options = [];
      if (question.options && Array.isArray(question.options)) {
        question.options.forEach((opt, i) => {
          // 从选项文本中提取选项内容（去掉前面的 A. B. 等标识）
          const content = opt.replace(/^[A-Z]\.\s*/, '');
          // 判断是否为正确答案
          const isCorrect = isCorrectOption(question.answer, i);

          options.push({
            content,
            isCorrect
          });
        });
      } else if (questionType === 'TRUE_FALSE') {
        // 处理判断题
        const isTrue = question.answer && (
          question.answer.includes('正确') ||
          question.answer.includes('√') ||
          question.answer.includes('对') ||
          question.answer.toLowerCase().includes('true')
        );

        options.push(
          { content: '正确', isCorrect: isTrue },
          { content: '错误', isCorrect: !isTrue }
        );
      }

      // 获取难度值，如果AI没有提供，则根据选择的难度范围生成一个随机值
      let difficultyValue = question.difficultyValue !== undefined ? Number(question.difficultyValue) : null;
      console.log('原始难度值:', question.difficultyValue, '转换后难度值:', difficultyValue);

      if (difficultyValue === undefined || difficultyValue === null || isNaN(difficultyValue)) {
        const difficulty = form.getFieldValue('difficulty');
        if (difficulty === '简单') {
          difficultyValue = Math.floor(Math.random() * 4); // 0-3
        } else if (difficulty === '中等') {
          difficultyValue = Math.floor(Math.random() * 3) + 4; // 4-6
        } else {
          difficultyValue = Math.floor(Math.random() * 4) + 7; // 7-10
        }
        console.log('生成的随机难度值:', difficultyValue);
      }

      // 获取知识点标签
      // 强制使用用户选择的标签，确保一个题目只有一个主标签
      const selectedTag = form.getFieldValue('tag');
      const tags = selectedTag ? [selectedTag] : [];

      // 构建保存的题目数据
      const questionData = {
        title: `初中信息科技 - ${selectedTag || form.getFieldValue('topic')}`,
        content: question.content,
        type: questionType,
        options: options,
        explanation: question.analysis || '',
        difficulty: difficultyValue,
        tags: tags
      };

      // 调用API保存题目
      const response = await quizAPI.questions.create(questionData);

      if (response.success) {
        message.success(`第 ${index + 1} 题已保存到题库`);
        // 标记题目已保存
        setSavedQuestions(prev => ({ ...prev, [index]: true }));
      } else {
        throw new Error(response.message || '保存失败');
      }

      // 更新保存状态
      setSavingQuestions(prev => ({ ...prev, [index]: false }));
    } catch (error) {
      console.error('保存题目错误:', error);
      message.error(`保存第 ${index + 1} 题失败: ${error.message || '未知错误'}`);
      setSavingQuestions(prev => ({ ...prev, [index]: false }));
    }
  };

  // 将AI生成的题型映射到数据库模型的题型
  const mapQuestionType = (aiType) => {
    const typeMap = {
      '选择题': 'SINGLE_CHOICE',
      '判断题': 'TRUE_FALSE',
      '编程题': 'PROGRAMMING'
    };

    return typeMap[aiType] || null;
  };

  // 判断选项是否为正确答案
  const isCorrectOption = (answer, optionIndex) => {
    if (!answer) return false;

    // 处理选择题答案格式，如 "A" 或 "答案是A"
    const answerLetters = answer.match(/[A-Z]/g) || [];
    const optionLetter = String.fromCharCode(65 + optionIndex); // A, B, C, ...

    return answerLetters.includes(optionLetter);
  };

  // 渲染题目内容
  const renderQuestions = () => {
    // 使用已解析的题目数组，而不是尝试解析streamingQuestions
    const questions = parsedQuestions;

    // 创建基本的卡片容器
    const cardContainer = (children) => (
      <div className="questions-list" style={{
        display: 'flex',
        overflowX: 'auto',
        gap: '20px',
        padding: '20px 0',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: '-ms-autohiding-scrollbar'
      }}>
        {children}
      </div>
    );

    // 如果正在加载但没有题目，直接显示加载卡片
    if (loading && (!questions || questions.length === 0)) {
      return cardContainer(
        <div
          style={{
            width: '360px',
            height: '600px',
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px dashed #d9d9d9',
            borderRadius: '8px',
            background: '#fafafa'
          }}
        >
          <Spin size="large" />
          <Text style={{ marginTop: 16 }}>正在生成下一题...</Text>
        </div>
      );
    }

    if (!questions || questions.length === 0) {
      // 如果有原始内容但不是JSON格式，则显示原始内容
      if (streamingQuestions && !streamingQuestions.includes('"questions"')) {
        return (
          <div style={{ padding: '0 16px' }}>
            <MarkdownRenderer content={streamingQuestions} />
          </div>
        );
      }

      return null;
    }

    // 渲染题目卡片
    return cardContainer(
      <>
        {questions.map((question, index) => (
          <Card
            key={question.id || index}
            className="question-item"
            style={{
              width: '360px',
              height: '600px',
              flex: '0 0 auto',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column'
            }}
            bodyStyle={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
            }}
            title={
              <Typography.Title level={5} style={{ margin: 0 }}>
                第 {index + 1} 题（{question.type || '未知类型'}）
                {question.difficultyValue !== undefined && (
                  <Tag color={getDifficultyColor(question.difficultyValue)} style={{ marginLeft: 8 }}>
                    难度: {question.difficultyValue}
                  </Tag>
                )}
              </Typography.Title>
            }
            actions={[
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={savingQuestions[index]}
                onClick={() => saveQuestionToLibrary(question, index)}
                disabled={!mapQuestionType(question.type) || savedQuestions[index]}
              >
                {savedQuestions[index] ? '已保存' : '保存到题库'}
              </Button>
            ]}
          >
            <div className="question-content" style={{ marginBottom: '1rem' }}>
              <MarkdownRenderer content={question.content || '加载中...'} />
            </div>

            {question.options && question.options.length > 0 && (
              <div className="question-options" style={{ marginBottom: '1rem' }}>
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} style={{ marginBottom: '0.5rem' }}>
                    <MarkdownRenderer content={option} />
                  </div>
                ))}
              </div>
            )}

            <div className="question-answer" style={{
              marginBottom: '1rem',
              padding: '0.8rem',
              background: '#f5f5f5',
              borderRadius: '4px'
            }}>
              <Text strong>答案：</Text>
              <div style={{ marginTop: '0.5rem' }}>
                <MarkdownRenderer content={question.answer || '加载中...'} />
              </div>
            </div>

            <div className="question-analysis" style={{
              padding: '0.8rem',
              background: '#f0f9ff',
              borderRadius: '4px'
            }}>
              <Text strong>解析：</Text>
              <div style={{ marginTop: '0.5rem' }}>
                <MarkdownRenderer content={question.analysis || '加载中...'} />
              </div>
            </div>

            {question.knowledgePoints && question.knowledgePoints.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <Text strong>知识点：</Text>
                <div style={{
                  marginTop: '0.5rem',
                  background: '#f0f7ff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e6f0ff'
                }}>
                  {question.knowledgePoints.map((point, i) => (
                    <Tag
                      key={i}
                      color="blue"
                      style={{
                        margin: '0 4px 4px 0',
                        padding: '2px 8px',
                        fontSize: '12px',
                        borderRadius: '12px'
                      }}
                    >
                      {point}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}

        {/* 下一个卡片加载提示 */}
        {loading && (
          <div
            style={{
              width: '360px',
              height: '600px',
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: '1px dashed #d9d9d9',
              borderRadius: '8px',
              background: '#fafafa'
            }}
          >
            <Spin size="large" />
            <Text style={{ marginTop: 16 }}>正在生成下一题...</Text>
          </div>
        )}
      </>
    );
  };

  // 根据难度值获取颜色
  const getDifficultyColor = (value) => {
    if (value <= 3) return 'green';
    if (value <= 6) return 'orange';
    return 'red';
  };

  return (
    <div className="question-generator">


      <Row gutter={24} style={{ marginTop: 20 }}>
        {/* 左侧表单区域 */}
        <Col xs={24} md={10} lg={8}>
          <Card title="出题信息" style={{ height: '100%' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
            >
              <Form.Item
                name="tag"
                label="知识点标签"
                rules={[{ required: true, message: '请选择知识点标签' }]}
              >
                <Select
                  placeholder="请选择标准知识点标签"
                  showSearch
                  optionFilterProp="children"
                >
                  {DEFAULT_TAGS.map(tag => (
                    <Option key={tag} value={tag}>{tag}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="topic"
                label="补充主题/知识点（可选）"
              >
                <Input placeholder="例如：更具体的知识点描述" />
              </Form.Item>

              <Form.Item
                name="difficulty"
                label="难度"
                initialValue="中等"
              >
                <Select options={difficultyOptions} />
              </Form.Item>

              <Form.Item
                label="题型"
                required
              >
                <Checkbox.Group
                  options={questionTypeOptions}
                  value={selectedQuestionTypes}
                  onChange={setSelectedQuestionTypes}
                />
              </Form.Item>

              <Form.Item
                name="count"
                label="题目数量"
                initialValue={5}
              >
                <InputNumber min={1} max={5} />
              </Form.Item>

              <Form.Item
                name="model"
                label="选择模型"
                initialValue="qwen-max"
              >
                <Select>
                  <Option value="qwen-max">通义千问-Max</Option>
                  <Option value="qwen-plus">通义千问-Plus</Option>
                  <Option value="qwen-turbo">通义千问-Turbo</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="选择知识库"
                extra="选择知识库可以让AI生成更符合您需求的试题"
              >
                <Select
                  placeholder="选择知识库（可选）"
                  allowClear
                  loading={loadingKnowledgeBases}
                  onChange={value => setSelectedKnowledgeBase(value)}
                  style={{ width: '100%' }}
                >
                  {knowledgeBases.map(db => (
                    <Option key={db} value={db}>{db}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<SendOutlined />}
                  block
                >
                  生成试题
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* 右侧结果区域 */}
        <Col xs={24} md={14} lg={16}>
          <Card
            title="生成的试题"
            extra={
              <Space>
                <Button
                  icon={<CopyOutlined />}
                  onClick={copyToClipboard}
                  disabled={!streamingQuestions && !questions}
                >
                  复制
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={downloadAsMarkdown}
                  disabled={!streamingQuestions && !questions}
                >
                  下载
                </Button>
              </Space>
            }
            style={{ minHeight: 500 }}
          >
            <div style={{ height: '100%', position: 'relative' }}>
              {(streamingQuestions || questions || loading) ? (
                <div style={{ position: 'relative' }}>
                  <div className="markdown-content">
                    {renderQuestions()}
                  </div>

                  {renderReferences(references)}
                  <div ref={resultRef} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#999', marginTop: 150 }}>
                  <p>填写左侧表单并点击"生成试题"按钮开始生成</p>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default QuestionGenerator; 