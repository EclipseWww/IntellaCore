import React, { useState, useEffect } from 'react';
import { Card, Steps, Button, message, Space, Typography, Progress, Row, Col, Spin, List, Drawer, Alert, Collapse, Modal } from 'antd';
import { quizAPI } from '../../../services/api';
import QuizQuestion from './QuizQuestion';
import QuizResult from './QuizResult';
import ReactMarkdown from 'react-markdown';

const { Title, Text, Paragraph } = Typography;

const Quiz = ({
  quizId,
  settings = {}, // 来自课时活动的设置
  mode = 'standalone', // standalone 或 embedded
  onComplete, // 完成回调
  isTeacher = false, // 添加教师角色标识
  activityId = null, // 活动ID（用于独立计数提交次数）
  lessonId = null // 课时ID
}) => {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submission, setSubmission] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]); // 添加答题记录状态
  const [selectedSubmission, setSelectedSubmission] = useState(null); // 添加选中的提交记录
  const [attemptNumber, setAttemptNumber] = useState(0); // 添加状态来跟踪尝试次数
  const [quizStarted, setQuizStarted] = useState(false); // 添加状态来跟踪测验是否已开始
  const [startTime, setStartTime] = useState(null); // 添加状态来记录开始时间
  const [quizSettings, setQuizSettings] = useState({}); // 存储合并后的设置
  const [showConfirmModal, setShowConfirmModal] = useState(false); // 控制提交确认对话框

  // 进度保存相关状态
  const [submissionId, setSubmissionId] = useState(null); // 当前答题记录ID
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [questionOrder, setQuestionOrder] = useState([]); // 固定的题目顺序
  const [optionOrderMap, setOptionOrderMap] = useState({}); // 选项顺序映射

  // 加载测验数据和答题记录
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [quizResponse, submissionsResponse] = await Promise.all([
          quizAPI.quizzes.getById(quizId),
          quizAPI.submissions.getByQuiz(quizId)
        ]);

        // 处理测验数据
        const quizData = quizResponse.data || quizResponse;

        // 检查quizData是否有效
        if (!quizData || !quizData._id) {
          throw new Error('无效的测验数据');
        }

        // 合并设置，优先使用从课时活动传递的设置，其次使用测验自身的设置
        const mergedSettings = {
          ...((quizData.settings || {})),  // 确保即使settings为undefined也能正常处理
          ...settings
        };
        setQuizSettings(mergedSettings);


        // 处理题目数据
        let questions = quizData.questions || [];

        questions = questions.map(q => {
          // 检查q.questionId是否存在
          if (!q.questionId) {
            return null; // 返回null以便后续过滤
          }

          // 检查是否为字符串ID或对象
          const questionIdIsObject = typeof q.questionId === 'object' && q.questionId !== null;

          // 在数据异常的情况下构建一个基本题目对象
          if (!questionIdIsObject) {
            return {
              _id: q._id,
              order: q.order,
              type: 'SINGLE_CHOICE', // 默认类型
              options: [],
              originalQuestionId: q.questionId,
              content: '此题目数据异常，请刷新页面或联系管理员'
            };
          }

          return {
            ...q.questionId,
            _id: q._id,
            order: q.order,
            type: q.questionId.type || 'SINGLE_CHOICE',
            options: q.questionId.options || [],
            originalQuestionId: q.questionId._id
          };
        }).filter(Boolean); // 过滤掉null值

        questions.sort((a, b) => a.order - b.order);

        // 不再在此处随机化题目，改为在开始答题时由服务器确定顺序
        // 保存原始题目数据，顺序将在 handleStartQuiz 中根据服务器返回的 questionOrder 重排
        setQuiz({
          ...quizData,
          questions
        });

        // 设置答题记录（只显示已完成的提交，过滤掉 IN_PROGRESS）
        const submissionsData = submissionsResponse.data || [];
        const completedSubmissions = submissionsData.filter(s => s.status === 'SUBMITTED');
        setSubmissions(completedSubmissions.sort((a, b) =>
          new Date(b.submitTime || 0) - new Date(a.submitTime || 0)
        ));

        // 重置当前步骤为0，防止切换测验时索引越界
        setCurrentStep(0);

        // 设置时间限制
        if (mergedSettings.timeLimit > 0) {
          setTimeLeft(mergedSettings.timeLimit * 60);
        }

        // 设置尝试次数（只计算已完成的提交，不计算进行中的）
        setAttemptNumber(completedSubmissions.length);
      } catch (error) {
        message.error(`加载测验数据失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      loadData();
    }
  }, [quizId, settings]);

  // 处理倒计时
  useEffect(() => {
    let timer;
    if (timeLeft > 0 && !submission && quizStarted) { // 只有在测验开始后才启动计时器
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // 时间到直接提交，不显示确认对话框
            message.info('时间到，自动提交测验');
            handleConfirmSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => timer && clearInterval(timer);
  }, [timeLeft, submission, quizStarted]); // 添加quizStarted依赖

  // localStorage 备份 key
  const getLocalStorageKey = () => `quiz_progress_${quizId}_${activityId || 'default'}`;

  // 保存进度到 localStorage（作为回退方案）
  const saveToLocalStorage = (answersData) => {
    try {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify({
        answers: answersData,
        timestamp: Date.now(),
        submissionId
      }));
    } catch (e) {
      console.warn('保存到 localStorage 失败:', e);
    }
  };

  // 从 localStorage 恢复进度
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(getLocalStorageKey());
      if (saved) {
        const data = JSON.parse(saved);
        // 检查是否是24小时内的数据
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          return data;
        }
      }
    } catch (e) {
      console.warn('从 localStorage 读取失败:', e);
    }
    return null;
  };

  // 清除 localStorage 中的进度
  const clearLocalStorage = () => {
    try {
      localStorage.removeItem(getLocalStorageKey());
    } catch (e) {
      console.warn('清除 localStorage 失败:', e);
    }
  };

  // 保存进度到服务器
  const saveProgressToServer = async (answersData) => {
    if (!submissionId) return;

    setSaveStatus('saving');
    try {
      await quizAPI.submissions.saveProgress(submissionId, answersData);
      setSaveStatus('saved');
      // 同时保存到 localStorage 作为备份
      saveToLocalStorage(answersData);
    } catch (error) {
      console.error('保存进度失败:', error);
      setSaveStatus('error');
      message.warning('保存进度失败，已保存到本地');
      // 保存失败时，保存到 localStorage
      saveToLocalStorage(answersData);
    }
  };

  // 处理答案更新
  const handleAnswerChange = (questionId, answer) => {
    const newAnswers = {
      ...answers,
      [questionId]: answer
    };
    setAnswers(newAnswers);

    // 每道题作答后立即保存进度
    saveProgressToServer({ [questionId]: answer });

    // 自动跳转到下一题（仅针对单选和判断题）
    const question = orderedQuestions.find(q => q.originalQuestionId === questionId);
    if (question && (question.type === 'SINGLE_CHOICE' || question.type === 'TRUE_FALSE')) {
      // 延迟跳转，让用户看到选中的效果
      if (currentStep < orderedQuestions.length - 1) {
        setTimeout(() => {
          setCurrentStep(curr => {
            // 再次检查以防用户快速点击
            if (curr < orderedQuestions.length - 1) {
              return curr + 1;
            }
            return curr;
          });
        }, 300);
      }
    }
  };

  // 处理开始测验
  const handleStartQuiz = async () => {
    try {
      // 调用服务器 start 接口
      const response = await quizAPI.submissions.start({
        quizId: quiz._id,
        activityId,
        lessonId
      });

      const data = response.data;

      // 检查是否是服务器自动提交的超时记录
      if (data.autoSubmitted) {
        message.warning(data.message || '之前的答题已超时并自动提交');
        // 刷新页面重新加载数据
        window.location.reload();
        return;
      }

      setSubmissionId(data.submissionId);
      setStartTime(new Date(data.startTime));
      setQuestionOrder(data.questionOrder);
      setOptionOrderMap(data.optionOrderMap || {});

      // 如果是恢复进度
      if (data.isResume) {
        message.info('已恢复之前的答题进度');
        setAnswers(data.answers || {});

        // 计算剩余时间（如果有时间限制）- 后端已处理超时情况
        if (quizSettings.timeLimit > 0) {
          const elapsed = Math.floor((Date.now() - new Date(data.startTime).getTime()) / 1000);
          const remaining = Math.max(0, quizSettings.timeLimit * 60 - elapsed);
          console.log('恢复进度时间计算:', { timeLimit: quizSettings.timeLimit, elapsed, remaining });
          setTimeLeft(remaining);
        } else {
          console.log('无时间限制或设置:', { quizSettings });
        }

        // 尝试从 localStorage 恢复更新的进度（处理离线情况）
        const localData = loadFromLocalStorage();
        if (localData && localData.answers && localData.submissionId === data.submissionId) {
          // 只有当本地存储的 submissionId 与当前恢复的 submissionId 一致时才合并
          console.log('检测到本地有更新的进度，尝试合并');
          const mergedAnswers = { ...data.answers, ...localData.answers };
          setAnswers(mergedAnswers);
          // 同步合并后的答案到服务器
          try {
            await quizAPI.submissions.saveProgress(data.submissionId, mergedAnswers);
          } catch (e) {
            console.warn('同步合并进度失败:', e);
          }
        }

        // 跳转到第一个未作答的题目
        const firstUnanswered = data.questionOrder.findIndex(
          qId => !data.answers[qId]
        );
        setCurrentStep(firstUnanswered >= 0 ? firstUnanswered : 0);
      } else {
        // 新开始
        setAnswers({});
        setCurrentStep(0); // 重置为第一题

        // 设置时间限制（如果有）
        if (quizSettings.timeLimit > 0) {
          setTimeLeft(quizSettings.timeLimit * 60);
        } else {
          setTimeLeft(0);
        }

        // 新开始的测验，不应该恢复之前的 localStorage 数据
        // 清除可能存在的旧数据，防止干扰
        clearLocalStorage();
      }

      setQuizStarted(true);
    } catch (error) {
      console.error('开始测验失败:', error);
      message.error(error.response?.data?.message || '开始测验失败');
    }
  };

  // 处理提交按钮点击 - 检查是否全部作答后显示确认对话框
  const handleSubmit = () => {
    // 检查是否所有题目都已作答
    const unansweredQuestions = orderedQuestions.filter(
      (q) => !isQuestionAnswered(q, answers[q.originalQuestionId])
    );

    if (unansweredQuestions.length > 0) {
      // 找到第一个未作答的题目索引
      const firstUnansweredIndex = orderedQuestions.findIndex(
        (q) => !isQuestionAnswered(q, answers[q.originalQuestionId])
      );
      message.warning(`还有 ${unansweredQuestions.length} 道题目未作答，请完成所有题目后再提交`);
      // 跳转到第一个未作答的题目
      setCurrentStep(firstUnansweredIndex);
      return;
    }

    setShowConfirmModal(true);
  };

  // 实际提交函数
  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);
      setShowConfirmModal(false);

      // 计算用时（毫秒）
      const now = new Date();
      const duration = startTime ? now - startTime : 0;

      // 处理所有答案
      const submissionAnswers = Object.entries(answers).map(([questionId, answer]) => {
        // 在测验题目中找到对应题目 - 现在用 originalQuestionId 匹配
        const question = quiz.questions.find(q =>
          q.originalQuestionId?.toString() === questionId?.toString()
        );
        if (!question) {
          console.warn('找不到对应题目:', questionId);
          return null;
        }

        const answerData = {
          questionId: question.originalQuestionId, // 使用保存的原始题目ID
          selectedOption: undefined,
          scaleValue: undefined
        };

        if (question.type === 'PSYCHOLOGICAL_SCALE') {
          // 心理量表题目
          const isMatrix = Array.isArray(question.matrixRows) && question.matrixRows.length > 0;
          if (isMatrix && answer && typeof answer === 'object') {
            // 矩阵量表：传行->列索引(0-based)
            answerData.matrixAnswers = answer;
          } else {
            // 单个量表：将0-based索引转换为1-based分值
            const idx = Number(answer);
            if (!Number.isNaN(idx)) {
              answerData.scaleValue = idx + 1;
            }
          }
        } else {
          // 选择题（单选、多选、判断）
          answerData.selectedOption = Array.isArray(answer) ? answer[0] : answer;
        }

        return answerData;
      }).filter(Boolean);

      // 提交答案和用时（不再提交具体时间戳）
      const result = await quizAPI.submissions.submit({
        quizId: quiz._id,
        answers: submissionAnswers,
        duration: duration, // 用时（毫秒）
        activityId: activityId || undefined, // 活动ID（用于独立计算提交次数）
        lessonId: lessonId || undefined // 课时ID
      });

      const submissionData = result.data || result;
      setSubmission(submissionData);

      // 提交成功后清除 localStorage 备份
      clearLocalStorage();

      if (onComplete) {
        onComplete(submissionData);
      }
    } catch (error) {
      message.error('提交测验失败: ' + (error.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  // 工具函数：随机打乱数组
  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // 格式化剩余时间
  const formatTimeLeft = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 处理查看详情 - 根据测验状态决定是否允许查看
  const handleViewDetails = async (sub) => {
    try {
      // 如果测验已经开始，则不允许查看详情
      if (quizStarted) {
        message.info('测验进行中无法查看详细结果');
        return;
      }

      // 否则允许查看详情
      message.loading({ content: '加载答题详情...', key: 'detailsLoading' });

      const response = await quizAPI.submissions.getById(sub._id);

      // 确保我们获取到了正确的数据
      const submissionData = response.data || response;

      // 设置选中的提交记录
      setSelectedSubmission(submissionData);
      message.success({ content: '加载成功', key: 'detailsLoading', duration: 1 });
    } catch (error) {
      message.error({ content: '获取答题详情失败', key: 'detailsLoading' });
    }
  };

  // 返回到提交列表
  const handleBackToList = () => {
    setSelectedSubmission(null);
  };

  // 处理删除提交记录
  const handleDeleteSubmission = async (submissionId) => {
    try {
      Modal.confirm({
        title: '确认删除',
        content: '确定要删除此测验提交记录吗？此操作无法撤销，学生将失去相应积分。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          message.loading({ content: '正在删除...', key: 'deleteSubmission' });
          await quizAPI.submissions.delete(submissionId);
          message.success({ content: '删除成功', key: 'deleteSubmission' });

          // 重新加载提交记录
          const submissionsResponse = await quizAPI.submissions.getByQuiz(quizId);
          const submissionsData = submissionsResponse.data || [];
          setSubmissions(submissionsData.sort((a, b) =>
            new Date(b.submitTime) - new Date(a.submitTime)
          ));

          // 如果删除的是当前选中的记录，返回列表
          if (selectedSubmission && selectedSubmission._id === submissionId) {
            setSelectedSubmission(null);
          }
        }
      });
    } catch (error) {
      console.error('删除测验提交记录失败:', error);
      message.error('删除测验提交记录失败');
    }
  };

  // 根据服务器返回的 questionOrder 对题目进行排序
  const orderedQuestions = React.useMemo(() => {
    if (!quiz || !quiz.questions) return [];
    if (!questionOrder || questionOrder.length === 0) {
      // 如果还没有开始答题，返回原始顺序
      return quiz.questions;
    }
    // 根据 questionOrder 重新排序
    return questionOrder.map(qId => {
      return quiz.questions.find(q =>
        q.originalQuestionId?.toString() === qId?.toString() ||
        q.questionId?.toString() === qId?.toString()
      );
    }).filter(Boolean);
  }, [quiz, questionOrder]);

  // 判断当前题目是否已作答（支持量表矩阵必须每行选择）
  const isQuestionAnswered = (question, answer) => {
    if (!question) return false;
    const type = question.type;
    if (type === 'PSYCHOLOGICAL_SCALE') {
      const isMatrix = Array.isArray(question.matrixRows) && question.matrixRows.length > 0;
      if (isMatrix) {
        if (!answer || typeof answer !== 'object') return false;
        // 需要矩阵每一行都有选择
        const rows = question.matrixRows || [];
        return rows.every((row, index) => {
          const key = (row && (row.id ?? index)) + '';
          return Object.prototype.hasOwnProperty.call(answer, key) && answer[key] !== undefined && answer[key] !== null && answer[key] !== '';
        });
      }
      // 单个量表：允许值为 0 的索引
      return answer !== undefined && answer !== null && `${answer}` !== '';
    }
    if (type === 'MULTIPLE_CHOICE') {
      return Array.isArray(answer) && answer.length > 0;
    }
    // 单选/判断等
    return answer !== undefined && answer !== null && `${answer}` !== '';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '16px' }}>
        <Spin size="large" tip="加载测验中..." />
      </div>
    );
  }

  if (!quiz) {
    return null;
  }

  // 如果已提交，显示结果
  if (submission) {
    return (
      <QuizResult
        submission={submission}
        quiz={quiz}
        settings={settings}
        mode={mode}
        canAttemptAgain={attemptNumber < quizSettings.maxAttempts}
        attemptNumber={attemptNumber}
      />
    );
  }

  if (quiz.status !== 'PUBLISHED') {
    return (
      <>
        <Card>
          <Alert
            message="测验尚未开始"
            description="请等待教师发布后再进行作答。"
            type="warning"
            showIcon
            style={{ marginBottom: submissions.length > 0 ? '24px' : 0 }}
          />
          {submissions.length > 0 && !selectedSubmission && (
            <List
              dataSource={submissions}
              renderItem={(sub) => (
                <List.Item
                  key={sub._id}
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleViewDetails(sub)}
                    >
                      查看详情
                    </Button>,
                    isTeacher && (
                      <Button
                        type="link"
                        danger
                        onClick={() => handleDeleteSubmission(sub._id)}
                      >
                        删除
                      </Button>
                    )
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={`第 ${sub.attemptNumber || '未知'} 次提交`}
                    description={
                      <Space>
                        <Text>得分: {sub.score}</Text>
                        <Text type="secondary">
                          {new Date(sub.submitTime).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}

          {/* 显示选中的提交记录详情 */}
          {selectedSubmission && (
            <div style={{ marginTop: '24px' }}>
              <Button
                type="link"
                onClick={handleBackToList}
                style={{ padding: '0', marginBottom: '16px' }}
              >
                ← 返回答题记录
              </Button>
              <QuizResult
                submission={selectedSubmission}
                quiz={quiz}
                settings={{
                  ...settings,
                  // 在预览模式下，使用quiz的设置决定是否显示答案
                  showAnswerAfterSubmit: quizSettings.showAnswerAfterSubmit
                }}
                mode="preview"
              />
            </div>
          )}
        </Card>
      </>
    );
  }

  // 如果测验未开始，显示起始屏幕
  if (!quizStarted) {
    return (
      <Card>
        {selectedSubmission ? (
          // 显示答题详情
          <>
            <Button
              type="link"
              onClick={handleBackToList}
              style={{ padding: '0', marginBottom: '16px' }}
            >
              ← 返回
            </Button>
            <QuizResult
              submission={selectedSubmission}
              quiz={quiz}
              settings={{
                ...settings,
                // 在预览模式下，使用quiz的设置决定是否显示答案
                showAnswerAfterSubmit: quizSettings.showAnswerAfterSubmit
              }}
              mode="preview"
            />
          </>
        ) : (
          <>
            <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }} size="large">
              <Title level={2}>{quiz.title}</Title>

              {quiz.description && (
                <Paragraph style={{ fontSize: '16px', maxWidth: '800px', margin: '0 auto 24px' }}>
                  {quiz.description}
                </Paragraph>
              )}

              <div style={{ margin: '24px 0' }}>
                <Row gutter={[16, 16]} justify="center">
                  <Col>
                    <Card size="small" style={{ textAlign: 'center', minWidth: '120px' }}>
                      <Paragraph style={{ margin: 0 }}>题目数量</Paragraph>
                      <Title level={3} style={{ margin: 0, color: '#1890ff' }}>{quiz.questions.length}</Title>
                    </Card>
                  </Col>

                  {quizSettings.timeLimit > 0 && (
                    <Col>
                      <Card size="small" style={{ textAlign: 'center', minWidth: '120px' }}>
                        <Paragraph style={{ margin: 0 }}>时间限制</Paragraph>
                        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>{quizSettings.timeLimit}分钟</Title>
                      </Card>
                    </Col>
                  )}

                  {quizSettings.maxAttempts > 0 && (
                    <Col>
                      <Card size="small" style={{ textAlign: 'center', minWidth: '120px' }}>
                        <Paragraph style={{ margin: 0 }}>最大尝试次数</Paragraph>
                        <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                          {attemptNumber}/{quizSettings.maxAttempts}
                        </Title>
                      </Card>
                    </Col>
                  )}
                </Row>
              </div>

              {attemptNumber >= quizSettings.maxAttempts ? (
                <Alert
                  message="已达最大提交次数"
                  description={`本测验限制提交 ${quizSettings.maxAttempts} 次，已无法再次作答。`}
                  type="warning"
                  showIcon
                  style={{ maxWidth: '600px', margin: '0 auto' }}
                />
              ) : (
                <Button
                  type="primary"
                  size="large"
                  onClick={handleStartQuiz}
                  style={{ minWidth: '150px' }}
                >
                  开始测验
                </Button>
              )}

              {quizSettings.timeLimit > 0 && (
                <Alert
                  message="注意"
                  description={`本测验有时间限制，开始后请在${quizSettings.timeLimit}分钟内完成。`}
                  type="info"
                  showIcon
                  style={{ maxWidth: '600px', margin: '24px auto 0' }}
                />
              )}
            </Space>

            {/* 历史记录区域 - 答题前允许查看详情 */}
            {submissions.length > 0 && (
              <Collapse
                defaultActiveKey={[]}
                style={{ marginTop: '24px' }}
              >
                <Collapse.Panel
                  header={<span style={{ fontWeight: 'bold' }}>历史答题记录 ({submissions.length})</span>}
                  key="1"
                >
                  <List
                    dataSource={submissions}
                    renderItem={(sub) => (
                      <List.Item
                        key={sub._id}
                        actions={[
                          <Button
                            type="link"
                            onClick={() => handleViewDetails(sub)}
                          >
                            查看详情
                          </Button>,
                          isTeacher && (
                            <Button
                              type="link"
                              danger
                              onClick={() => handleDeleteSubmission(sub._id)}
                            >
                              删除
                            </Button>
                          )
                        ].filter(Boolean)}
                      >
                        <List.Item.Meta
                          title={`第 ${sub.attemptNumber || '未知'} 次提交`}
                          description={
                            <Space>
                              {quizSettings.showScoreAfterSubmit ? (
                                <Text>得分: {sub.score}</Text>
                              ) : (
                                <Text type="secondary">分数未公开</Text>
                              )}
                              <Text type="secondary">
                                {new Date(sub.submitTime).toLocaleString()}
                              </Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Collapse.Panel>
              </Collapse>
            )}
          </>
        )}
      </Card>
    );
  }

  if (!orderedQuestions || orderedQuestions.length === 0) {
    return (
      <Card>
        <Alert
          message="暂无题目"
          description="该测验暂时没有题目。"
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  const currentQuestion = orderedQuestions[currentStep];

  // 安全检查：如果找不到当前题目（可能是索引越界或题目加载问题）
  if (!currentQuestion) {
    console.error('Quiz Error: Invalid currentQuestion at step', currentStep, 'orderedQuestions length:', orderedQuestions.length);
    // 尝试重置到第一题
    if (currentStep !== 0 && orderedQuestions.length > 0) {
      setTimeout(() => setCurrentStep(0), 0);
    }
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin tip="正在加载题目..." />
        </div>
      </Card>
    );
  }

  return (
    <div className="quiz-container" style={{ padding: '8px', maxWidth: '100%', margin: '0 auto' }}>
      {attemptNumber >= quizSettings.maxAttempts ? (
        <Card>
          <Alert
            message="已达最大提交次数"
            description={`本测验限制提交 ${quizSettings.maxAttempts} 次，已无法再次作答。`}
            type="warning"
            showIcon
          />
        </Card>
      ) : (
        <Row gutter={24}>
          {/* 左侧：题目区域 */}
          {/* 左侧：题目区域 */}
          <Col xs={24} lg={18} xl={18} xxl={19}>
            <div style={{ minHeight: 300 }}>
              <QuizQuestion
                question={{
                  ...currentQuestion,
                  content: currentQuestion.content
                }}
                value={answers[currentQuestion.originalQuestionId]}
                onChange={(answer) => handleAnswerChange(currentQuestion.originalQuestionId, answer)}
                randomizeOptions={quizSettings.randomizeOptions}
                optionOrder={optionOrderMap[currentQuestion.originalQuestionId]}
                currentStep={currentStep}
              />
            </div>
          </Col>

          {/* 右侧：信息面板 */}
          <Col xs={24} lg={6} xl={6} xxl={5}>
            <Card
              bordered={false}
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'sticky', top: 20 }}
              bodyStyle={{ padding: '20px 12px' }}
            >
              {/* 计时器 */}
              {timeLeft > 0 && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff' }}>
                        {formatTimeLeft(timeLeft)}
                      </span>
                    </div>
                    <Progress
                      percent={(timeLeft / (quizSettings.timeLimit * 60)) * 100}
                      showInfo={false}
                      size="small"
                      strokeColor="#1890ff"
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>剩余时间</div>
                  </div>
                  <div style={{ margin: '20px 0', borderTop: '1px solid #f0f0f0' }} />
                </>
              )}

              {/* 答题进度 */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>答题进度</Text>
                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
                  <span style={{ color: '#1890ff' }}>{Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== null && answers[k] !== '').length}</span> / {orderedQuestions.length}
                </div>
              </div>

              {/* 题目导航 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
                {orderedQuestions.map((q, idx) => {
                  const isAnswered = answers[q.originalQuestionId] !== undefined && answers[q.originalQuestionId] !== null && answers[q.originalQuestionId] !== '';
                  const isActive = currentStep === idx;
                  return (
                    <button
                      key={q._id}
                      onClick={() => setCurrentStep(idx)}
                      title={`第 ${idx + 1} 题`}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 8,
                        border: `1px solid ${isActive ? '#1890ff' : isAnswered ? '#52c41a' : '#d9d9d9'}`,
                        background: isActive ? '#1890ff' : isAnswered ? '#f6ffed' : '#fff',
                        color: isActive ? '#fff' : isAnswered ? '#52c41a' : '#666',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: isActive ? 'bold' : 'normal',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s',
                        boxShadow: isActive ? '0 4px 10px rgba(24, 144, 255, 0.2)' : 'none'
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    style={{ flex: 1 }}
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    disabled={currentStep === 0}
                  >
                    上一题
                  </Button>
                  <Button
                    type="primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (currentStep === orderedQuestions.length - 1) {
                        handleSubmit();
                      } else {
                        setCurrentStep(prev => prev + 1);
                      }
                    }}
                    loading={submitting && currentStep === orderedQuestions.length - 1}
                  >
                    {currentStep === orderedQuestions.length - 1 ? '提交' : '下一题'}
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* 历史记录区域 - 在答题过程中只显示列表，不允许查看详情 */}
      {submissions.length > 0 && (
        <Collapse
          defaultActiveKey={[]}
          style={{ marginTop: '24px' }}
        >
          <Collapse.Panel
            header={<span style={{ fontWeight: 'bold' }}>历史答题记录 ({submissions.length})</span>}
            key="1"
          >
            <List
              dataSource={submissions}
              renderItem={(sub) => (
                <List.Item
                  key={sub._id}
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleViewDetails(sub)}
                    >
                      查看详情
                    </Button>,
                    isTeacher && (
                      <Button
                        type="link"
                        danger
                        onClick={() => handleDeleteSubmission(sub._id)}
                      >
                        删除
                      </Button>
                    )
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={`第 ${sub.attemptNumber || '未知'} 次提交`}
                    description={
                      <Space>
                        {quizSettings.showScoreAfterSubmit ? (
                          <Text>得分: {sub.score}</Text>
                        ) : (
                          <Text type="secondary">分数未公布</Text>
                        )}
                        <Text type="secondary">
                          {new Date(sub.submitTime).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Collapse.Panel>
        </Collapse>
      )}

      {/* 提交确认对话框 */}
      <Modal
        title="确认提交测验"
        open={showConfirmModal}
        onOk={handleConfirmSubmit}
        onCancel={() => setShowConfirmModal(false)}
        okText="确认提交"
        cancelText="继续答题"
        okButtonProps={{ loading: submitting }}
        cancelButtonProps={{ disabled: submitting }}
        width={600}
        maskClosable={false}
      >
        <div style={{ padding: '16px 0' }}>
          {/* 答题进度统计 */}
          <div style={{ marginBottom: '24px' }}>
            <Title level={4} style={{ marginBottom: '16px' }}>答题进度</Title>
            {(() => {
              const totalQuestions = quiz.questions.length;
              const answeredQuestions = Object.keys(answers).filter(
                questionId => answers[questionId] !== undefined && answers[questionId] !== null && answers[questionId] !== ''
              ).length;
              const unansweredQuestions = totalQuestions - answeredQuestions;

              return (
                <div>
                  <Row gutter={16} style={{ marginBottom: '16px' }}>
                    <Col span={8}>
                      <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
                        <div style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '24px' }}>{answeredQuestions}</div>
                        <div style={{ color: '#52c41a' }}>已答题</div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ textAlign: 'center', backgroundColor: unansweredQuestions > 0 ? '#fff1f0' : '#f6ffed', border: unansweredQuestions > 0 ? '1px solid #ffccc7' : '1px solid #b7eb8f' }}>
                        <div style={{ color: unansweredQuestions > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold', fontSize: '24px' }}>{unansweredQuestions}</div>
                        <div style={{ color: unansweredQuestions > 0 ? '#ff4d4f' : '#52c41a' }}>未答题</div>
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ textAlign: 'center', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff' }}>
                        <div style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '24px' }}>{totalQuestions}</div>
                        <div style={{ color: '#1890ff' }}>总题数</div>
                      </Card>
                    </Col>
                  </Row>

                  <Progress
                    percent={Math.round((answeredQuestions / totalQuestions) * 100)}
                    status={unansweredQuestions > 0 ? "active" : "success"}
                    strokeColor={unansweredQuestions > 0 ? "#faad14" : "#52c41a"}
                  />

                  {unansweredQuestions > 0 && (
                    <Alert
                      message="注意"
                      description={`您还有 ${unansweredQuestions} 道题目未作答，确定要提交吗？未作答的题目将不得分。`}
                      type="warning"
                      showIcon
                      style={{ marginTop: '16px' }}
                    />
                  )}
                </div>
              );
            })()}
          </div>

          {/* 时间信息 */}
          {timeLeft !== null && (
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ marginBottom: '8px' }}>剩余时间</Title>
              <div style={{
                padding: '12px',
                backgroundColor: timeLeft <= 300 ? '#fff1f0' : '#e6f7ff',
                borderRadius: '6px',
                border: `1px solid ${timeLeft <= 300 ? '#ffccc7' : '#91d5ff'}`,
                textAlign: 'center'
              }}>
                <Text strong style={{
                  fontSize: '18px',
                  color: timeLeft <= 300 ? '#ff4d4f' : '#1890ff'
                }}>
                  {formatTimeLeft(timeLeft)}
                </Text>
                {timeLeft <= 300 && (
                  <div style={{ marginTop: '4px', color: '#ff4d4f' }}>
                    <Text type="danger">时间即将用完，请尽快提交！</Text>
                  </div>
                )}
              </div>
            </div>
          )}

          <Paragraph style={{ marginBottom: 0, fontSize: '14px', color: '#666' }}>
            提交后将无法修改答案，请确认所有题目都已认真作答。
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
};

export default Quiz;