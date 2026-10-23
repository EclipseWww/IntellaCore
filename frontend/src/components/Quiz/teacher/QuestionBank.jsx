import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Select, Button, Space, Form, Input, Radio, InputNumber, message, Modal, Spin, Divider, Typography, List, Tag, Slider, Tooltip, Popover, Upload, Table, Empty, Tabs, Popconfirm, Progress, Statistic, Pagination } from 'antd';
import { PlusOutlined, MinusCircleOutlined, RobotOutlined, LoadingOutlined, QuestionCircleOutlined, FileImageOutlined, CopyOutlined, DeleteOutlined, UploadOutlined, VideoCameraOutlined, WarningOutlined, ExclamationCircleOutlined, RestOutlined, UndoOutlined } from '@ant-design/icons';
import { quizAPI, mediaAPI, questionAnalyticsAPI } from '../../../services/api';
import ReactMarkdown from 'react-markdown';
import MarkdownEditor from '../../../components/shared/MarkdownEditor';

// 添加题目选项中图片的CSS样式
const optionImageStyle = `
  .option-content img {
    max-width: 100%;
    height: auto;
    display: inline-block;
    vertical-align: middle;
    margin: 4px;
    border-radius: 4px;
  }
  
  .question-options .ant-list-item {
    flex-wrap: wrap;
  }
`;

const { Option } = Select;
const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

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

const QuestionBank = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('SINGLE_CHOICE');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [tagInputVisible, setTagInputVisible] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [currentTags, setCurrentTags] = useState([]);
  const [publicMedias, setPublicMedias] = useState([]);
  const [loadingMedias, setLoadingMedias] = useState(false);
  const [selectedTab, setSelectedTab] = useState('edit');
  const [draftId, setDraftId] = useState('');

  // AI 解析相关状态
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiPopoverVisible, setAiPopoverVisible] = useState(false);

  // 题目分析相关状态
  const [questionAnalytics, setQuestionAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // 版本控制相关状态
  const [questionReferences, setQuestionReferences] = useState(null);
  const [updateModeModalVisible, setUpdateModeModalVisible] = useState(false);
  const [pendingUpdateValues, setPendingUpdateValues] = useState(null);

  // 回收站相关状态
  const [recycleBinVisible, setRecycleBinVisible] = useState(false);
  const [deletedQuestions, setDeletedQuestions] = useState([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);

  // 题号分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpValue, setJumpValue] = useState('');

  // 生成随机ID函数
  const generateDraftId = () => {
    return 'draft-' + Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
  };

  // 获取当前题目的ID (已保存题目用_id, 新建题目用draftId)
  const getCurrentQuestionId = () => {
    return selectedQuestion?._id || draftId;
  };

  // 获取题目列表
  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await quizAPI.questions.getList();
      setQuestions(response.data);
      return response.data; // 返回题目列表以便后续处理
    } catch (error) {
      message.error(`获取题目列表失败: ${error.response?.data?.message || error.message || '未知错误'}`);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // 处理URL参数定位到指定题目
  const urlParamsProcessedRef = React.useRef(false);

  useEffect(() => {
    // 防止React.StrictMode导致的重复执行
    if (urlParamsProcessedRef.current) return;

    const initFromUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const questionId = urlParams.get('questionId');
      const questionType = urlParams.get('type');

      if (questionId) {
        urlParamsProcessedRef.current = true; // 标记已处理
        const allQuestions = await fetchQuestions();

        // 如果有题型参数，先切换到对应题型
        if (questionType) {
          setSelectedType(questionType);
        }

        // 查找目标题目
        const targetQuestion = allQuestions.find(q => q._id === questionId);
        if (targetQuestion) {
          // 如果题型不匹配，切换到正确的题型
          if (targetQuestion.type !== selectedType) {
            setSelectedType(targetQuestion.type);
          }

          // 设置选中的题目并填充表单
          setSelectedQuestion(targetQuestion);
          fetchQuestionReferences(targetQuestion._id);
          const tags = Array.isArray(targetQuestion.tags) ? targetQuestion.tags : [];
          setCurrentTags(tags);
          const formData = {
            ...targetQuestion,
            options: targetQuestion.options?.map(opt => ({
              _id: opt._id,
              content: opt.content,
              value: opt.value,
              isCorrect: opt.isCorrect
            })),
            correctAnswer: targetQuestion.type === 'TRUE_FALSE' ?
              (targetQuestion.options?.[0]?.isCorrect ? true : false) :
              targetQuestion.options?.findIndex(opt => opt.isCorrect),
            difficulty: targetQuestion.difficulty || 5,
            tags: tags,
            scaleLabels: Array.isArray(targetQuestion.scaleLabels) ? targetQuestion.scaleLabels.join('\n') : targetQuestion.scaleLabels
          };
          form.setFieldsValue(formData);

          // 计算题目在分页中的位置并跳转
          const filteredByType = allQuestions.filter(q => q.type === targetQuestion.type);
          const questionIndex = filteredByType.findIndex(q => q._id === questionId);
          if (questionIndex !== -1) {
            const pageSize = 54;
            const targetPage = Math.ceil((questionIndex + 1) / pageSize);
            setCurrentPage(targetPage);
          }

          // 清除URL参数，避免刷新时重复处理
          const newUrl = new URL(window.location);
          newUrl.searchParams.delete('questionId');
          newUrl.searchParams.delete('type');
          window.history.replaceState({}, '', newUrl);

          // 只显示一次成功提示
          message.success('已定位到目标题目，可以开始编辑');
        } else {
          message.warning('未找到指定的题目');
        }
      } else {
        fetchQuestions();
      }
    };

    initFromUrlParams();
  }, []);

  // 监听表单中tags字段的变化
  useEffect(() => {
    const tags = form.getFieldValue('tags');
    if (Array.isArray(tags)) {
      setCurrentTags(tags);
    } else {
      setCurrentTags([]);
    }
  }, [form]);

  // 加载题目相关的媒体文件
  const loadQuestionMedias = async () => {
    const currentId = getCurrentQuestionId();
    if (!currentId) return;

    try {
      setLoadingMedias(true);
      const response = await mediaAPI.getLessonMedias(
        'question-bank',
        selectedType,
        currentId
      );

      if (response.success) {
        setPublicMedias(response.data || []);
      } else {
        message.error('加载题目媒体文件失败');
      }
    } catch (error) {
      console.error('加载题目媒体文件失败:', error);
      message.error('加载题目媒体文件失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingMedias(false);
    }
  };

  // 删除媒体文件
  const handleDeleteMedia = async (media) => {
    const currentId = getCurrentQuestionId();
    if (!currentId) return;

    try {
      const filename = media.filename;
      const response = await mediaAPI.deleteMedia(
        'question-bank',
        selectedType,
        currentId,
        filename
      );

      if (response.success) {
        message.success(`${media.mediaType === 'video' ? '视频' : '图片'}删除成功`);
        loadQuestionMedias(); // 重新加载媒体列表
      } else {
        message.error(`删除${media.mediaType === 'video' ? '视频' : '图片'}失败`);
      }
    } catch (error) {
      console.error(`删除${media.mediaType === 'video' ? '视频' : '图片'}失败:`, error);
      message.error(`删除${media.mediaType === 'video' ? '视频' : '图片'}失败: ` + (error.response?.data?.message || error.message));
    }
  };

  // 复制媒体URL到剪贴板
  const copyMediaUrlToClipboard = (media) => {
    const url = media.path; // 使用相对路径
    // 创建临时文本区域
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        message.success('媒体文件URL已复制到剪贴板');
      } else {
        message.error('复制失败');
      }
    } catch (err) {
      console.error('复制失败:', err);
      message.error('复制失败');
    }

    document.body.removeChild(textArea);
  };

  // 复制Markdown图片代码到剪贴板
  const copyMarkdownMediaCode = (media) => {
    const url = media.path; // 使用相对路径
    let markdownCode;

    if (media.mediaType === 'video') {
      markdownCode = `<video controls width="100%" src="${url}"></video>`;
    } else {
      markdownCode = `![${media.filename}](${url})`;
    }

    // 创建临时文本区域
    const textArea = document.createElement('textarea');
    textArea.value = markdownCode;
    document.body.appendChild(textArea);
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        message.success(`Markdown${media.mediaType === 'video' ? '视频' : '图片'}代码已复制到剪贴板`);
      } else {
        message.error('复制失败');
      }
    } catch (err) {
      console.error('复制失败:', err);
      message.error('复制失败');
    }

    document.body.removeChild(textArea);
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取媒体预览元素
  const getMediaPreview = (record) => {
    if (record.mediaType === 'video') {
      return (
        <div style={{ width: 50, height: 50, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
          <VideoCameraOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        </div>
      );
    } else {
      return (
        <div style={{ width: 50, height: 50, overflow: 'hidden' }}>
          <img
            src={record.path}
            alt={record.filename}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      );
    }
  };

  // 表格切换
  const handleTabChange = (activeKey) => {
    setSelectedTab(activeKey);
    if (activeKey === 'media') {
      loadQuestionMedias();
    }
  };

  // 上传题目中使用的媒体文件
  const handleUploadMedia = async (file) => {
    const currentId = getCurrentQuestionId();
    if (!currentId) return false;

    const formData = new FormData();
    formData.append('media', file);

    try {
      const response = await mediaAPI.uploadMedia(
        'question-bank',
        selectedType,
        currentId,
        formData
      );

      if (response.success) {
        message.success('媒体文件上传成功');
        loadQuestionMedias(); // 刷新媒体列表
        return response;
      } else {
        message.error('媒体文件上传失败');
        return false;
      }
    } catch (error) {
      console.error('媒体文件上传失败:', error);
      message.error('媒体文件上传失败: ' + (error.response?.data?.message || error.message));
      return false;
    }
  };

  // 处理创建/编辑题目
  const handleSubmit = async (values, updateMode = null) => {
    try {
      console.log('提交前的values:', values);
      console.log('selectedType:', selectedType);

      // 确保心理量表题目有scaleLevel
      if (selectedType === 'PSYCHOLOGICAL_SCALE' && !values.scaleLevel) {
        values.scaleLevel = 5; // 默认5级量表
        console.log('设置默认scaleLevel:', values.scaleLevel);
      }

      // 处理自定义标签文本转数组
      if (selectedType === 'PSYCHOLOGICAL_SCALE' && values.scaleLabels) {
        if (typeof values.scaleLabels === 'string') {
          // 将文本按行分割为数组，过滤空行
          values.scaleLabels = values.scaleLabels
            .split('\n')
            .map(label => label.trim())
            .filter(label => label.length > 0);
        }
      }

      // 确保options的格式正确
      if (values.options) {
        if (selectedType === 'PSYCHOLOGICAL_SCALE') {
          // 如果有options，处理传统量表选项
          if (values.options && values.options.length > 0) {
            values.options = values.options.map(option => ({
              content: option.content,
              value: option.value
            }));
          } else {
            // 如果没有options但有matrixRows，说明是矩阵模式，删除options字段
            delete values.options;
          }
        } else if (selectedType === 'TRUE_FALSE') {
          // 判断题的correctAnswer是布尔值，需要特殊处理
          const correctAnswer = form.getFieldValue('correctAnswer');
          values.options = [
            { content: '正确', isCorrect: correctAnswer === true },
            { content: '错误', isCorrect: correctAnswer === false }
          ];
        } else {
          // 单选题的correctAnswer是索引
          const correctAnswerIndex = form.getFieldValue('correctAnswer');
          values.options = values.options.map((option, index) => ({
            content: option.content,
            isCorrect: index === correctAnswerIndex
          }));
        }
      } else if (selectedType === 'TRUE_FALSE') {
        const correctAnswer = form.getFieldValue('correctAnswer');
        values.options = [
          { content: '正确', isCorrect: correctAnswer === true },
          { content: '错误', isCorrect: correctAnswer === false }
        ];
      }

      // 确保 tags 是数组
      if (!Array.isArray(values.tags)) {
        values.tags = values.tags ? [values.tags] : [];
      }

      if (selectedQuestion?._id) {
        // 编辑现有题目
        values.type = selectedType;

        // 检查是否有引用，如果有引用且未选择更新模式，显示选择对话框
        if (questionReferences && questionReferences.quizCount > 0 && !updateMode) {
          setPendingUpdateValues(values);
          setUpdateModeModalVisible(true);
          return;
        }

        // 带上更新模式
        if (updateMode) {
          values.updateMode = updateMode;
        }

        console.log('更新题目数据:', values);
        const response = await quizAPI.questions.update(selectedQuestion._id, values);

        // 显示版本更新信息
        if (response.archivedQuestion) {
          message.success(`题目更新成功，旧版本已归档 (v${response.archivedQuestion.version})`);
        } else {
          message.success('题目更新成功');
        }

        fetchQuestions();
        setQuestionReferences(null);
      } else {
        // 创建新题目时，传递当前的draftId以便后端可以处理关联的媒体文件
        const submitData = {
          ...values,
          type: selectedType,
          draftId: draftId // 传递草稿ID给后端
        };

        // 最后的保底检查：确保心理量表题目有scaleLevel
        if (selectedType === 'PSYCHOLOGICAL_SCALE' && !submitData.scaleLevel) {
          submitData.scaleLevel = 5;
        }

        console.log('创建题目数据:', submitData);
        await quizAPI.questions.create(submitData);
        message.success('题目创建成功');
        form.resetFields();
        setSelectedQuestion(null);
        setDraftId(''); // 重置草稿ID
        setModalVisible(false); // 关闭表单，用户需要再次点击新建按钮
        fetchQuestions();
      }
      setUpdateModeModalVisible(false);
      setPendingUpdateValues(null);
    } catch (error) {
      const action = selectedQuestion ? '更新' : '创建';
      message.error(`${action}题目失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    }
  };

  // 获取题目引用信息
  const fetchQuestionReferences = async (questionId) => {
    if (!questionId) {
      setQuestionReferences(null);
      return;
    }
    try {
      const response = await quizAPI.questions.getReferences(questionId);
      if (response.success) {
        setQuestionReferences(response.data);
      }
    } catch (error) {
      console.error('获取题目引用信息失败:', error);
    }
  };

  // 处理删除题目
  const handleDelete = async (id) => {
    try {
      const response = await quizAPI.questions.delete(id);
      if (response.success && response.data?.message) {
        message.success(response.data.message);
      } else {
        message.success('题目删除成功');
      }
      fetchQuestions();
    } catch (error) {
      message.error(`删除题目失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    }
  };

  // 获取已删除的题目列表（回收站）
  const fetchDeletedQuestions = async () => {
    try {
      setLoadingDeleted(true);
      const response = await quizAPI.questions.getDeleted({ type: selectedType });
      if (response.success) {
        setDeletedQuestions(response.data);
      }
    } catch (error) {
      message.error('获取回收站题目列表失败');
    } finally {
      setLoadingDeleted(false);
    }
  };

  // 还原题目
  const handleRestore = async (id) => {
    try {
      const response = await quizAPI.questions.restore(id);
      if (response.success) {
        message.success('题目已还原');
        fetchDeletedQuestions();
        fetchQuestions();
      }
    } catch (error) {
      message.error(`还原题目失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    }
  };

  // 永久删除题目
  const handlePermanentDelete = async (id) => {
    try {
      const response = await quizAPI.questions.permanentDelete(id);
      if (response.success) {
        message.success('题目已永久删除');
        fetchDeletedQuestions();
      }
    } catch (error) {
      message.error(`永久删除失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    }
  };

  // 打开回收站
  const openRecycleBin = () => {
    setRecycleBinVisible(true);
    fetchDeletedQuestions();
  };

  // 处理 AI 解析
  const handleAiParse = async () => {
    if (!aiText.trim()) {
      message.warning('请输入题目内容');
      return;
    }

    setAiLoading(true);
    try {
      // 将DEFAULT_TAGS传递给AI解析接口
      const response = await quizAPI.questions.parseWithAI(aiText, selectedType, DEFAULT_TAGS);

      if (response.success) {
        message.success('AI 解析成功');

        // 根据题目类型处理数据
        let formData = {};

        if (selectedType === 'SINGLE_CHOICE') {
          const correctIndex = response.data.options.findIndex(opt => opt.isCorrect);
          formData = {
            content: response.data.content || aiText,
            options: response.data.options.map(opt => ({
              content: opt.content
            })),
            correctAnswer: correctIndex >= 0 ? correctIndex : 0,
            explanation: response.data.explanation || '',
            difficulty: response.data.difficulty || 5,
            tags: response.data.tags || []
          };
        } else if (selectedType === 'TRUE_FALSE') {
          formData = {
            content: response.data.content || aiText,
            correctAnswer: response.data.correctAnswer,
            explanation: response.data.explanation || '',
            difficulty: response.data.difficulty || 5,
            tags: response.data.tags || []
          };
        } else if (selectedType === 'PSYCHOLOGICAL_SCALE') {
          formData = {
            content: response.data.content || aiText,
            options: response.data.options.map(opt => ({
              content: opt.content,
              value: opt.value
            })),
            explanation: response.data.explanation || '',
            difficulty: response.data.difficulty || 5,
            tags: response.data.tags || []
          };
        }

        // 将AI返回的标签与预设标签匹配
        let matchedTags = [];
        if (Array.isArray(formData.tags) && formData.tags.length > 0) {
          // 尝试从AI返回的标签中匹配预设标签
          matchedTags = formData.tags.filter(tag => DEFAULT_TAGS.includes(tag));

          // 如果没有匹配到任何标签，则尝试智能匹配
          if (matchedTags.length === 0) {
            // 尝试模糊匹配预设标签
            const contentLower = (formData.content || '').toLowerCase();
            matchedTags = DEFAULT_TAGS.filter(tag => {
              // 从标签中提取关键词
              const keywordMatch = tag.match(/：(.+)$/);
              const keyword = keywordMatch ? keywordMatch[1] : tag;
              return contentLower.includes(keyword.toLowerCase());
            }).slice(0, 3); // 最多选择3个标签
          }

          // 更新标签
          formData.tags = matchedTags;
        }

        // 更新表单数据
        form.setFieldsValue(formData);

        // 更新标签
        setCurrentTags(formData.tags);

        // 关闭 Popover
        setAiPopoverVisible(false);

        // 清空 AI 文本输入
        setAiText('');

      } else {
        message.error(response.message || 'AI 解析失败');
      }
    } catch (error) {
      message.error(`AI 解析失败: ${error.response?.data?.message || error.message || '未知错误'}`);
    } finally {
      setAiLoading(false);
    }
  };

  // 应用 AI 解析结果到表单
  const applyAiResult = () => {
    setAiModalVisible(false);
    // 表单已在 handleAiParse 中填充
  };

  // 处理添加知识点标签
  const handleTagInputConfirm = () => {
    if (tagInputValue && tagInputValue.trim() !== '') {
      // 获取当前标签数组
      const tagsArray = Array.isArray(currentTags) ? [...currentTags] : [];

      if (!tagsArray.includes(tagInputValue)) {
        const newTags = [...tagsArray, tagInputValue];
        setCurrentTags(newTags);
        form.setFieldsValue({
          tags: newTags
        });
      }
    }
    setTagInputVisible(false);
    setTagInputValue('');
  };

  // 处理删除知识点标签
  const handleTagClose = (removedTag) => {
    const tagsArray = Array.isArray(currentTags) ? [...currentTags] : [];
    const newTags = tagsArray.filter(tag => tag !== removedTag);
    setCurrentTags(newTags);
    form.setFieldsValue({
      tags: newTags
    });
  };

  // 筛选当前类型的题目
  const filteredQuestions = questions.filter(q => q.type === selectedType);

  // 分页逻辑
  const pageSize = 54;
  const totalQuestions = filteredQuestions.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);

  // 快速跳转到指定题号
  const handleJumpToQuestion = () => {
    const questionNumber = parseInt(jumpValue);
    if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > totalQuestions) {
      message.warning(`请输入1-${totalQuestions}之间的题号`);
      return;
    }

    const targetPage = Math.ceil(questionNumber / pageSize);
    setCurrentPage(targetPage);

    // 选中目标题目
    const targetQuestion = filteredQuestions[questionNumber - 1];
    if (targetQuestion) {
      setSelectedQuestion(targetQuestion);
      fetchQuestionReferences(targetQuestion._id);
      const tags = Array.isArray(targetQuestion.tags) ? targetQuestion.tags : [];
      setCurrentTags(tags);
      const formData = {
        ...targetQuestion,
        options: targetQuestion.options?.map(opt => ({
          _id: opt._id,
          content: opt.content,
          value: opt.value,
          isCorrect: opt.isCorrect
        })),
        correctAnswer: selectedType === 'TRUE_FALSE' ?
          (targetQuestion.options[0].isCorrect ? true : false) :
          targetQuestion.options?.findIndex(opt => opt.isCorrect),
        difficulty: targetQuestion.difficulty || 5,
        tags: tags,
        scaleLabels: Array.isArray(targetQuestion.scaleLabels) ? targetQuestion.scaleLabels.join('\n') : targetQuestion.scaleLabels
      };
      form.setFieldsValue(formData);
    }

    setJumpValue('');
  };

  const renderQuestionForm = () => {
    if (!selectedQuestion && !modalVisible) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          请选择左侧题目或点击新建题目按钮
        </div>
      );
    }

    // 确保 currentTags 是数组
    const tagsToRender = Array.isArray(currentTags) ? currentTags : [];
    const currentId = getCurrentQuestionId();

    return (
      <Tabs activeKey={selectedTab} onChange={handleTabChange}>
        <TabPane tab="编辑题目" key="edit">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              difficulty: 5,
              tags: [],
              scaleLevel: 5
            }}
          >
            {/* 版本控制：引用警告 */}
            {selectedQuestion && questionReferences && questionReferences.quizCount > 0 && (
              <div style={{
                marginBottom: 16,
                padding: '12px 16px',
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: 4
              }}>
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <span>
                    此题目已被 <strong>{questionReferences.quizCount}</strong> 个测验使用
                    {questionReferences.submissionCount > 0 && (
                      <>，有 <strong>{questionReferences.submissionCount}</strong> 份提交记录</>
                    )}
                    。修改后可选择更新模式。
                    <Tooltip title={`版本 ${selectedQuestion.version ?? 1}`}>
                      <Tag color="blue" style={{ marginLeft: 8 }}>v{selectedQuestion.version ?? 1}</Tag>
                    </Tooltip>
                  </span>
                </Space>
              </div>
            )}
            <Form.Item
              name="content"
              label="题目内容"
              rules={[{ required: true, message: '请输入题目内容' }]}
            >
              <MarkdownEditor
                placeholder="请输入题目内容，可以插入图片..."
                height="240px"
                view={{ menu: true, md: true, html: false }}
                hidePreview={true}
                fullToolbar={true}
                mediaContext={{
                  moduleId: 'question-bank',
                  sectionId: selectedType,
                  itemId: currentId
                }}
              />
            </Form.Item>

            {selectedType === 'TRUE_FALSE' && (
              <Form.Item
                name="correctAnswer"
                label="正确答案"
                rules={[{ required: true, message: '请选择正确答案' }]}
              >
                <Radio.Group>
                  <Radio value={true}>正确</Radio>
                  <Radio value={false}>错误</Radio>
                </Radio.Group>
              </Form.Item>
            )}

            {selectedType === 'SINGLE_CHOICE' && (
              <>
                <Form.List name="options">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field, index) => (
                        <Form.Item required={false} key={field.key}>
                          <Space align="baseline" style={{ display: 'flex', marginBottom: 8, flexWrap: 'wrap' }}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'content']}
                              validateTrigger={['onChange', 'onBlur']}
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  message: "请输入选项内容",
                                },
                              ]}
                              noStyle
                            >
                              <Input.TextArea
                                placeholder={`选项 ${index + 1}`}
                                style={{ width: '300px', minHeight: '32px' }}
                                autoSize={{ minRows: 1, maxRows: 4 }}
                                title="支持Markdown语法，如插入图片：![描述](图片URL)"
                              />
                            </Form.Item>
                            <Button
                              type="text"
                              size="small"
                              icon={<FileImageOutlined />}
                              title="插入图片"
                              onClick={() => {
                                // 创建一个隐藏的文件输入
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.style.display = 'none';
                                input.onchange = async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;

                                  try {
                                    // 使用mediaAPI上传图片
                                    const formData = new FormData();
                                    formData.append('media', file);

                                    const response = await mediaAPI.uploadMedia(
                                      'question-bank',
                                      selectedType,
                                      currentId,
                                      formData
                                    );

                                    if (response.success) {
                                      // 获取当前选项内容
                                      const currentContent = form.getFieldValue(['options', field.name, 'content']) || '';

                                      // 构造Markdown图片链接
                                      const imageMarkdown = `![${file.name}](${response.data.path})`;

                                      // 更新选项内容
                                      form.setFieldsValue({
                                        options: {
                                          [field.name]: {
                                            content: currentContent ? `${currentContent} ${imageMarkdown}` : imageMarkdown
                                          }
                                        }
                                      });

                                      message.success('图片已插入到选项');
                                    } else {
                                      message.error('图片上传失败');
                                    }
                                  } catch (error) {
                                    console.error('图片上传失败:', error);
                                    message.error('图片上传失败: ' + (error.response?.data?.message || error.message));
                                  }
                                };

                                // 触发文件选择
                                document.body.appendChild(input);
                                input.click();
                                document.body.removeChild(input);
                              }}
                            >
                            </Button>
                            <Radio
                              checked={form.getFieldValue('correctAnswer') === index}
                              onChange={() => {
                                // 设置当前选项为正确答案
                                form.setFieldsValue({ correctAnswer: index });

                                // 强制触发表单值的更新，确保预览组件能捕捉到变化
                                setTimeout(() => {
                                  // 获取当前所有选项
                                  const currentOptions = form.getFieldValue('options');

                                  // 更新所有选项的isCorrect属性
                                  const updatedOptions = currentOptions.map((opt, idx) => ({
                                    ...opt,
                                    isCorrect: idx === index
                                  }));

                                  // 更新表单中的选项，确保预览组件刷新
                                  form.setFieldsValue({ options: updatedOptions });
                                }, 0);
                              }}
                            >
                              正确答案
                            </Radio>
                            <MinusCircleOutlined
                              className="dynamic-delete-button"
                              onClick={() => remove(field.name)}
                              style={{ color: '#ff4d4f', fontSize: '16px', cursor: 'pointer' }}
                            />
                          </Space>
                        </Form.Item>
                      ))}
                      <Form.Item>
                        <Button
                          type="dashed"
                          onClick={() => {
                            add({ content: `选项 ${fields.length + 1}` });
                          }}
                          block
                          icon={<PlusOutlined />}
                        >
                          添加选项
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </>
            )}

            {/* 心理量表配置 */}
            {selectedType === 'PSYCHOLOGICAL_SCALE' && (
              <>
                {/* 量表级数 */}
                <Form.Item
                  name="scaleLevel"
                  label="量表级数"
                  rules={[{ required: true, message: '请选择量表级数' }]}
                  initialValue={5}
                >
                  <Select placeholder="选择量表级数">
                    <Option value={3}>3级量表</Option>
                    <Option value={4}>4级量表</Option>
                    <Option value={5}>5级量表</Option>
                    <Option value={6}>6级量表</Option>
                    <Option value={7}>7级量表</Option>
                    <Option value={8}>8级量表</Option>
                    <Option value={9}>9级量表</Option>
                    <Option value={10}>10级量表</Option>
                  </Select>
                </Form.Item>

                {/* 自定义量表标签（可选） */}
                <Form.Item
                  name="scaleLabels"
                  label={
                    <Space>
                      自定义标签（可选）
                      <Tooltip title="为量表级数定义自定义文字标签。如果不填写，将使用数字标签（1、2、3...）。每行一个标签，标签数量需要与量表级数匹配">
                        <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                      </Tooltip>
                    </Space>
                  }
                >
                  <TextArea
                    placeholder={`请输入自定义标签，每行一个，例如：
非常不同意
不同意
中性
同意
非常同意

（不填则使用数字1-N）`}
                    rows={4}
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                {/* 矩阵行项目（可选） */}
                <Form.Item label={
                  <Space>
                    矩阵行项目（可选）
                    <Tooltip title="添加多个评估项目可创建矩阵量表，学生需要对每个项目进行评分。例如：教学质量、课程内容、学习体验等">
                      <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                }>
                  <div style={{ marginBottom: 8, color: '#666', fontSize: '12px' }}>
                    添加多个评估项目可创建矩阵量表，不添加则为单个量表
                  </div>
                  <Form.List name="matrixRows">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field, index) => (
                          <Form.Item required={false} key={field.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 8, width: '100%' }}>
                              <Form.Item
                                {...field}
                                name={[field.name, 'content']}
                                validateTrigger={['onChange', 'onBlur']}
                                rules={[
                                  {
                                    required: true,
                                    whitespace: true,
                                    message: "请输入评估项目内容",
                                  },
                                ]}
                                style={{ margin: 0, flex: 1, maxWidth: '400px' }}
                              >
                                <Input placeholder={`评估项目 ${index + 1}`} />
                              </Form.Item>

                              <Form.Item
                                {...field}
                                name={[field.name, 'id']}
                                validateTrigger={['onChange', 'onBlur']}
                                rules={[
                                  {
                                    required: true,
                                    whitespace: true,
                                    message: "请输入项目ID",
                                  },
                                ]}
                                style={{ margin: 0, width: '130px' }}
                              >
                                <Input
                                  placeholder={index === 0 ? 'quality' : index === 1 ? 'content' : index === 2 ? 'experience' : `item_${index + 1}`}
                                />
                              </Form.Item>

                              <Tooltip title="项目ID用于唯一标识每个评估项目，用于数据存储和统计分析。建议使用简短的英文标识，如：quality（质量）、content（内容）、experience（体验）等">
                                <QuestionCircleOutlined style={{ color: '#1890ff', cursor: 'help', fontSize: '14px' }} />
                              </Tooltip>

                              <MinusCircleOutlined
                                className="dynamic-delete-button"
                                onClick={() => remove(field.name)}
                                style={{ color: '#ff4d4f', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}
                              />
                            </div>
                          </Form.Item>
                        ))}
                        <Form.Item>
                          <Button type="dashed" onClick={() => add()} block>
                            添加评估项目
                          </Button>
                        </Form.Item>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              </>
            )}


            <Form.Item
              name="explanation"
              label="题目解析"
            >
              <MarkdownEditor
                placeholder="请输入题目解析（可选），支持插入图片..."
                height="240px"
                view={{ menu: true, md: true, html: false }}
                hidePreview={true}
                fullToolbar={true}
                mediaContext={{
                  moduleId: 'question-bank',
                  sectionId: selectedType,
                  itemId: currentId
                }}
              />
            </Form.Item>

            <Form.Item
              name="difficulty"
              label={
                <Space>
                  难度设置
                  <Tooltip title="0表示最简单，10表示最难">
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
              }
              rules={[{ required: true, message: '请设置题目难度' }]}
            >
              <Slider
                min={0}
                max={10}
                marks={{
                  0: '简单',
                  5: '中等',
                  10: '困难'
                }}
              />
            </Form.Item>

            {/* 隐藏的表单项，用于存储标签数据 */}
            <Form.Item name="tags" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label="知识点标签"
            >
              <div>
                {currentTags.map((tag, index) => (
                  <Tag
                    key={tag}
                    closable
                    onClose={(e) => {
                      e.preventDefault(); // 阻止事件冒泡
                      handleTagClose(tag);
                    }}
                    style={{ marginBottom: 8 }}
                  >
                    {tag}
                  </Tag>
                ))}
                {tagInputVisible ? (
                  <Input
                    type="text"
                    size="small"
                    style={{ width: 100, marginBottom: 8 }}
                    value={tagInputValue}
                    onChange={e => setTagInputValue(e.target.value)}
                    onBlur={handleTagInputConfirm}
                    onPressEnter={handleTagInputConfirm}
                    autoFocus
                  />
                ) : (
                  <Tag onClick={() => setTagInputVisible(true)} style={{ borderStyle: 'dashed', cursor: 'pointer', marginBottom: 8 }}>
                    <PlusOutlined /> 添加知识点
                  </Tag>
                )}

                {/* 添加预设标签下拉选择 */}
                <div style={{ marginTop: 8 }}>
                  <Select
                    placeholder="选择预设标签"
                    style={{ width: '100%' }}
                    onChange={(value) => {
                      // 获取当前标签数组
                      const tagsArray = Array.isArray(currentTags) ? [...currentTags] : [];

                      // 检查是否已存在
                      if (!tagsArray.includes(value)) {
                        const newTags = [...tagsArray, value];
                        setCurrentTags(newTags);
                        form.setFieldsValue({
                          tags: newTags
                        });
                      }
                    }}
                    value={null}
                  >
                    {DEFAULT_TAGS.map((tag, index) => (
                      <Option key={index} value={tag}>{tag}</Option>
                    ))}
                  </Select>
                </div>
              </div>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {selectedQuestion ? '保存修改' : '创建题目'}
                </Button>
                <Button
                  type="default"
                  onClick={() => {
                    if (selectedQuestion) {
                      const hasReferences = questionReferences && (questionReferences.quizCount > 0 || questionReferences.submissionCount > 0);
                      Modal.confirm({
                        title: hasReferences ? '确认归档' : '确认删除',
                        content: hasReferences
                          ? `此题目已被 ${questionReferences.quizCount} 个测验引用，将被移入归档。`
                          : '确定要永久删除这道题目吗？此操作不可撤销。',
                        okText: hasReferences ? '归档' : '删除',
                        okButtonProps: { danger: !hasReferences },
                        onOk: () => handleDelete(selectedQuestion._id)
                      });
                    }
                  }}
                  danger={!(questionReferences && (questionReferences.quizCount > 0 || questionReferences.submissionCount > 0))}
                  disabled={!selectedQuestion}
                >
                  {questionReferences && (questionReferences.quizCount > 0 || questionReferences.submissionCount > 0) ? '归档题目' : '删除题目'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </TabPane>
        <TabPane tab="媒体管理" key="media">
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Upload
                customRequest={async ({ file }) => await handleUploadMedia(file)}
                showUploadList={false}
                accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.ogg"
              >
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                >
                  上传媒体文件
                </Button>
              </Upload>
              <Button
                icon={<FileImageOutlined />}
                onClick={loadQuestionMedias}
              >
                刷新媒体列表
              </Button>
            </Space>
          </div>
          <Table
            loading={loadingMedias}
            dataSource={publicMedias.map(media => ({ ...media, key: media.path }))}
            columns={[
              {
                title: '预览',
                key: 'preview',
                width: 80,
                render: (_, record) => getMediaPreview(record)
              },
              {
                title: '类型',
                dataIndex: 'mediaType',
                key: 'mediaType',
                width: 80,
                render: (type) => type === 'video' ? '视频' : '图片'
              },
              {
                title: '文件名',
                dataIndex: 'filename',
                key: 'filename',
                ellipsis: true,
                width: '30%'
              },
              {
                title: '大小',
                dataIndex: 'size',
                key: 'size',
                width: 100,
                render: (size) => formatFileSize(size)
              },
              {
                title: '操作',
                key: 'action',
                width: 180,
                render: (_, record) => (
                  <Space size="small">
                    <Button
                      type="link"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyMediaUrlToClipboard(record)}
                      title="复制URL"
                    >
                      URL
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => copyMarkdownMediaCode(record)}
                      title="复制Markdown"
                    >
                      MD
                    </Button>
                    <Popconfirm
                      title={`确定要删除这${record.mediaType === 'video' ? '个视频' : '张图片'}吗？`}
                      onConfirm={() => handleDeleteMedia(record)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        title={`删除${record.mediaType === 'video' ? '视频' : '图片'}`}
                      />
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
            pagination={{ pageSize: 5, size: 'small' }}
            size="small"
            scroll={{ x: 'max-content' }}
          />
          {publicMedias.length === 0 && !loadingMedias && (
            <Empty description="暂无媒体文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </TabPane>
      </Tabs>
    );
  };

  // AI 解析内容
  const renderAiContent = () => (
    <div style={{ width: 400 }}>
      <TextArea
        value={aiText}
        onChange={(e) => setAiText(e.target.value)}
        placeholder="请输入题目文本，AI 将自动解析为题目格式..."
        rows={6}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={() => setAiPopoverVisible(false)}>
          取消
        </Button>
        <Button
          type="primary"
          onClick={handleAiParse}
          loading={aiLoading}
          disabled={!aiText.trim()}
        >
          解析
        </Button>
      </div>
    </div>
  );

  // 当选择题目时，更新当前标签
  useEffect(() => {
    if (selectedQuestion) {
      const tags = selectedQuestion.tags || [];
      setCurrentTags(Array.isArray(tags) ? tags : []);
    } else {
      setCurrentTags([]);
    }
  }, [selectedQuestion]);

  // 初始化表单时确保 tags 字段是数组
  useEffect(() => {
    const initialTags = form.getFieldValue('tags');
    if (!Array.isArray(initialTags)) {
      form.setFieldsValue({ tags: [] });
      setCurrentTags([]);
    }
  }, [form]);

  // 获取题目分析数据
  const fetchQuestionAnalytics = async (questionId) => {
    if (!questionId) return;

    try {
      setAnalyticsLoading(true);
      const response = await questionAnalyticsAPI.getQuestionAnalytics(questionId);

      if (response && response.success && response.data) {
        setQuestionAnalytics(response.data);
        console.log('题目分析数据:', response.data);
      } else {
        setQuestionAnalytics(null);
        console.log('题目分析数据获取失败或暂无数据:', response);
      }
    } catch (error) {
      console.error('获取题目分析数据失败:', error);
      setQuestionAnalytics(null);
      message.error('获取题目分析数据失败');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // 当选择题目时，获取题目分析数据
  useEffect(() => {
    if (selectedQuestion && selectedQuestion._id) {
      fetchQuestionAnalytics(selectedQuestion._id);
    } else {
      setQuestionAnalytics(null);
    }
  }, [selectedQuestion]);

  // 添加预览组件
  const QuestionPreview = ({ form }) => {
    const content = Form.useWatch('content', form);
    const options = Form.useWatch('options', form);
    const correctAnswer = Form.useWatch('correctAnswer', form);
    const explanation = Form.useWatch('explanation', form);
    const difficulty = Form.useWatch('difficulty', form);
    const tags = Form.useWatch('tags', form);
    const scaleLabels = Form.useWatch('scaleLabels', form);
    const matrixRows = Form.useWatch('matrixRows', form);
    const scaleLevel = Form.useWatch('scaleLevel', form);

    // 处理选项的正确答案
    const processedOptions = React.useMemo(() => {
      if (!options) return [];

      if (selectedType === 'SINGLE_CHOICE') {
        return options.map((opt, index) => ({
          ...opt,
          isCorrect: index === correctAnswer || opt.isCorrect
        }));
      }
      return options;
    }, [options, correctAnswer, selectedType]);

    // 获取难度值对应的颜色
    const getDifficultyColor = (value) => {
      if (value <= 3) return 'green';
      if (value <= 6) return 'orange';
      return 'red';
    };

    return (
      <Card
        title="题目预览"
        className="question-preview"
        style={{
          border: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto'
        }}
      >
        <div style={{ height: '100%', position: 'relative' }}>
          {/* 题目类型和难度 */}
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {selectedType === 'SINGLE_CHOICE' ? '单选题' :
                selectedType === 'TRUE_FALSE' ? '判断题' : '心理量表题'}
            </Typography.Title>
            {difficulty && (
              <Tag color={getDifficultyColor(difficulty)} style={{ marginLeft: 8 }}>
                难度: {difficulty}
              </Tag>
            )}
          </div>

          {/* 题目内容 */}
          <div className="question-content" style={{ marginBottom: '1rem' }}>
            <ReactMarkdown>{content || ''}</ReactMarkdown>
          </div>

          {/* 题目分析数据 */}
          {selectedQuestion && selectedQuestion._id && (
            <div style={{ marginBottom: '1rem' }}>
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '10px' }}>
                  <Spin size="small" />
                  <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>加载分析数据...</span>
                </div>
              ) : questionAnalytics && questionAnalytics.stats ? (
                <div style={{
                  padding: '8px 12px',
                  background: '#f9f0ff',
                  borderRadius: '4px',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#722ed1', marginBottom: '8px' }}>题目统计</div>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="总答题次数"
                        value={questionAnalytics.stats.totalAttempts || 0}
                        valueStyle={{ fontSize: '16px' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="答对次数"
                        value={questionAnalytics.stats.correctAttempts || 0}
                        valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="正确率"
                        value={parseFloat(questionAnalytics.stats.correctRate || 0).toFixed(1)}
                        suffix="%"
                        valueStyle={{
                          fontSize: '16px',
                          color: parseFloat(questionAnalytics.stats.correctRate || 0) >= 60 ? '#52c41a' : '#f5222d'
                        }}
                      />
                      <Progress
                        percent={parseFloat(questionAnalytics.stats.correctRate || 0)}
                        size="small"
                        showInfo={false}
                        strokeColor={parseFloat(questionAnalytics.stats.correctRate || 0) >= 60 ? '#52c41a' : '#f5222d'}
                      />
                    </Col>
                  </Row>
                </div>
              ) : (
                <div style={{
                  padding: '8px 12px',
                  background: '#f0f0f0',
                  borderRadius: '4px',
                  color: '#666',
                  fontSize: '13px',
                  textAlign: 'center'
                }}>
                  暂无答题数据或题目尚未保存
                </div>
              )}
            </div>
          )}
          {!selectedQuestion && modalVisible && (
            <div style={{
              marginBottom: '1rem',
              padding: '8px 12px',
              background: '#fffbe6',
              borderRadius: '4px',
              color: '#fa8c16',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <QuestionCircleOutlined style={{ marginRight: '8px' }} />
                <span>新题目需要保存后才能查看分析数据</span>
              </div>
            </div>
          )}

          {/* 选项 */}
          {selectedType === 'SINGLE_CHOICE' && options?.length > 0 && (
            <div className="question-options" style={{ marginBottom: '1rem' }}>
              <List
                dataSource={options}
                renderItem={(item, index) => {
                  // 获取选项分析数据
                  let optionAnalytics = null;

                  if (questionAnalytics && questionAnalytics.stats && questionAnalytics.stats.optionDistribution) {
                    console.log(`-------第${index + 1}个选项-------`);
                    console.log('选项数据:', item);
                    console.log('分布数据:', questionAnalytics.stats.optionDistribution);

                    // 匹配策略1: 尝试通过_id匹配
                    if (item._id) {
                      const optionId = item._id.toString();
                      if (questionAnalytics.stats.optionDistribution[optionId]) {
                        const optionData = questionAnalytics.stats.optionDistribution[optionId];
                        console.log('通过_id找到选项数据:', optionId, optionData);
                        optionAnalytics = processOptionData(optionData, questionAnalytics.stats.totalAttempts);
                      }
                    }

                    // 匹配策略2: 尝试通过内容匹配
                    if (!optionAnalytics && item.content) {
                      // 检查所有选项数据，尝试匹配内容
                      const distributionEntries = Object.entries(questionAnalytics.stats.optionDistribution);

                      for (const [id, data] of distributionEntries) {
                        // 假设后端可能在数据中包含了选项内容
                        if (data.content && data.content === item.content) {
                          console.log('通过内容找到选项数据:', item.content, data);
                          optionAnalytics = processOptionData(data, questionAnalytics.stats.totalAttempts);
                          break;
                        }
                      }
                    }

                    // 匹配策略3: 回退到使用索引匹配
                    if (!optionAnalytics) {
                      const keys = Object.keys(questionAnalytics.stats.optionDistribution);
                      if (keys.length > index) {
                        const optionData = questionAnalytics.stats.optionDistribution[keys[index]];
                        console.log('使用索引找到选项数据:', index, optionData);
                        optionAnalytics = processOptionData(optionData, questionAnalytics.stats.totalAttempts);
                      } else {
                        console.log('无法找到对应的选项数据');
                      }
                    }
                  }

                  // 辅助函数：处理选项数据
                  function processOptionData(optionData, totalAttempts) {
                    let count = 0;
                    let percentage = 0;

                    if (typeof optionData === 'object') {
                      count = optionData.count || 0;
                      percentage = parseFloat(optionData.percentage || 0);
                    } else {
                      // 直接是百分比的情况
                      percentage = parseFloat(optionData || 0);
                      count = Math.round((totalAttempts || 0) * percentage / 100);
                    }

                    return { count, percentage };
                  }

                  return (
                    <List.Item style={{
                      padding: '8px 12px',
                      background: item?.isCorrect ? '#f6ffed' : '#fff',
                      border: `1px solid ${item?.isCorrect ? '#b7eb8f' : '#f0f0f0'}`,
                      borderRadius: '4px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Space>
                          <Text strong>{String.fromCharCode(65 + index)}.</Text>
                          <div className="option-content">
                            <ReactMarkdown>{item?.content || ''}</ReactMarkdown>
                          </div>
                          {item?.isCorrect && (
                            <Tag color="success">正确答案</Tag>
                          )}
                        </Space>

                        {questionAnalytics && questionAnalytics.stats ? (
                          optionAnalytics ? (
                            <div style={{ marginLeft: 'auto' }}>
                              <span style={{
                                marginLeft: '8px',
                                fontSize: '12px',
                                color: '#999',
                                whiteSpace: 'nowrap'
                              }}>
                                {optionAnalytics.count}次 ({optionAnalytics.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          ) : (
                            <div style={{ marginLeft: 'auto' }}>
                              <span style={{
                                marginLeft: '8px',
                                fontSize: '12px',
                                color: '#999',
                                whiteSpace: 'nowrap'
                              }}>
                                0次 (0.0%)
                              </span>
                            </div>
                          )
                        ) : null}
                      </div>
                    </List.Item>
                  );
                }}
              />
            </div>
          )}

          {/* 判断题答案 */}
          {selectedType === 'TRUE_FALSE' && options?.length > 0 && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.8rem',
              background: '#f5f5f5',
              borderRadius: '4px'
            }}>
              <Text strong>答案：</Text>
              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color="success">
                  {options.find(opt => opt.isCorrect)?.content || '未设置'}
                </Tag>

                {/* 添加判断题分析数据 */}
                {questionAnalytics && questionAnalytics.stats ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px', fontSize: '13px', color: '#666' }}>正确率:</span>
                    <span style={{
                      fontWeight: '500',
                      color: parseFloat(questionAnalytics.stats.correctRate || 0) >= 60 ? '#52c41a' : '#f5222d'
                    }}>
                      {parseFloat(questionAnalytics.stats.correctRate || 0).toFixed(1)}%
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '13px', color: '#666' }}>
                      ({questionAnalytics.stats.correctAttempts || 0}/{questionAnalytics.stats.totalAttempts || 0}次)
                    </span>
                  </div>
                ) : selectedQuestion && selectedQuestion._id ? (
                  <span style={{ fontSize: '13px', color: '#999' }}>暂无数据</span>
                ) : null}
              </div>
            </div>
          )}

          {/* 心理量表预览 */}
          {selectedType === 'PSYCHOLOGICAL_SCALE' && scaleLevel && (
            <div style={{ marginBottom: '1rem' }}>
              {(() => {
                // 生成量表选项
                const generateScaleOptions = () => {
                  let processedLabels = [];

                  if (scaleLabels) {
                    if (typeof scaleLabels === 'string') {
                      // 如果是文本格式，按行分割
                      processedLabels = scaleLabels
                        .split('\n')
                        .map(label => label.trim())
                        .filter(label => label.length > 0);
                    } else if (Array.isArray(scaleLabels)) {
                      // 如果已经是数组格式
                      processedLabels = scaleLabels.filter(label => label && label.trim());
                    }
                  }

                  if (processedLabels.length === scaleLevel) {
                    return processedLabels;
                  } else {
                    // 使用数字标签
                    return Array.from({ length: scaleLevel }, (_, i) => `${i + 1}`);
                  }
                };

                const scaleOptions = generateScaleOptions();

                // 如果有矩阵行，显示矩阵量表预览
                if (matrixRows?.filter(row => row && row.content).length > 0) {
                  return (
                    <div>
                      <Text strong style={{ marginBottom: '8px', display: 'block' }}>
                        矩阵量表预览（{scaleLevel}级量表）：
                      </Text>
                      <div style={{
                        overflowX: 'auto',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px',
                        backgroundColor: '#fff'
                      }}>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          minWidth: '500px'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#fafafa' }}>
                              <th style={{
                                padding: '8px 12px',
                                textAlign: 'left',
                                borderBottom: '1px solid #d9d9d9',
                                borderRight: '1px solid #d9d9d9',
                                fontWeight: '600',
                                fontSize: '12px'
                              }}>
                              </th>
                              {scaleOptions.map((label, index) => (
                                <th key={index} style={{
                                  padding: '8px 6px',
                                  textAlign: 'center',
                                  borderBottom: '1px solid #d9d9d9',
                                  borderRight: index < scaleOptions.length - 1 ? '1px solid #d9d9d9' : 'none',
                                  fontWeight: '600',
                                  fontSize: '11px',
                                  minWidth: '60px'
                                }}>
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrixRows?.filter(row => row && row.content).map((row, rowIndex) => (
                              <tr key={row.id || rowIndex} style={{
                                backgroundColor: rowIndex % 2 === 0 ? '#fff' : '#fafafa'
                              }}>
                                <td style={{
                                  padding: '8px 12px',
                                  borderBottom: rowIndex < matrixRows.filter(r => r && r.content).length - 1 ? '1px solid #d9d9d9' : 'none',
                                  borderRight: '1px solid #d9d9d9',
                                  fontSize: '12px'
                                }}>
                                  {row.content || ''}
                                </td>
                                {scaleOptions.map((_, colIndex) => (
                                  <td key={colIndex} style={{
                                    padding: '4px',
                                    textAlign: 'center',
                                    borderBottom: rowIndex < matrixRows.filter(r => r && r.content).length - 1 ? '1px solid #d9d9d9' : 'none',
                                    borderRight: colIndex < scaleOptions.length - 1 ? '1px solid #d9d9d9' : 'none'
                                  }}>
                                    <Radio disabled style={{ transform: 'scale(0.8)' }} />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                } else {
                  // 单个量表预览
                  return (
                    <div>
                      <Text strong style={{ marginBottom: '8px', display: 'block' }}>
                        量表预览（{scaleLevel}级量表）：
                      </Text>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        padding: '16px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '6px',
                        border: '1px solid #d9d9d9'
                      }}>
                        {scaleOptions.map((label, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '8px',
                            minWidth: '60px'
                          }}>
                            <Radio disabled style={{ marginBottom: '4px' }} />
                            <span style={{ fontSize: '11px', color: '#666' }}>{index + 1}</span>
                            <span style={{ fontSize: '12px', textAlign: 'center' }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          )}

          {/* 题目解析 */}
          {explanation && (
            <div style={{
              padding: '0.8rem',
              background: '#f0f9ff',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}>
              <Text strong>解析：</Text>
              <div style={{ marginTop: '0.5rem' }} className="markdown-content">
                <ReactMarkdown>{explanation || ''}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 知识点标签 */}
          {tags && tags.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <Text strong>知识点：</Text>
              <div style={{
                marginTop: '0.5rem',
                background: '#f0f7ff',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e6f0ff'
              }}>
                {tags.map((tag, i) => (
                  <Tag
                    key={tag}
                    color="blue"
                    style={{
                      margin: '0 4px 4px 0',
                      padding: '2px 8px',
                      fontSize: '12px',
                      borderRadius: '12px'
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <>
      <style>
        {`
          ${optionImageStyle}
          
          /* 增加markdown内容渲染样式 */
          .markdown-content img {
            max-width: 100%;
            height: auto;
          }
          
          .markdown-content video {
            max-width: 100%;
            height: auto;
          }
          
          .question-content img,
          .option-content img {
            max-width: 100%;
            height: auto;
          }
          
          /* 修复编辑器样式 */
          .question-bank .markdown-editor {
            height: 240px;
          }
          
          .question-bank .markdown-editor .rc-md-editor .editor-container .sec-md.visible {
            height: 100% !important;
            overflow-y: auto !important;
          }
        `}
      </style>
      <Row gutter={16} style={{ padding: '24px' }} className="question-bank">
        <Col span={6}>
          <Card title="题目管理">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                value={selectedType}
                onChange={(value) => {
                  setSelectedType(value);
                  setSelectedQuestion(null);
                  form.resetFields();
                  setCurrentTags([]);
                  setCurrentPage(1); // 切换题型时重置页码
                }}
              >
                <Option value="SINGLE_CHOICE">单选题</Option>
                <Option value="TRUE_FALSE">判断题</Option>
                <Option value="PSYCHOLOGICAL_SCALE">心理量表</Option>
              </Select>

              <Space style={{ width: '100%' }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedQuestion(null);
                    form.resetFields();
                    setCurrentTags([]);
                    // 生成新的草稿ID
                    const newDraftId = generateDraftId();
                    setDraftId(newDraftId);
                    setModalVisible(true);
                    // 使用 setTimeout 确保表单重置完成后再设置默认值
                    setTimeout(() => {
                      form.setFieldsValue({
                        type: selectedType,
                        options: selectedType === 'SINGLE_CHOICE' ? [
                          { content: '选项 1' },
                          { content: '选项 2' },
                          { content: '选项 3' },
                          { content: '选项 4' }
                        ] : [],
                        correctAnswer: selectedType === 'SINGLE_CHOICE' ? 0 : undefined,
                        difficulty: 5,
                        tags: [],
                        scaleLevel: selectedType === 'PSYCHOLOGICAL_SCALE' ? 5 : undefined
                      });
                    }, 0);
                  }}
                >
                  新建题目
                </Button>
                <Button
                  icon={<RestOutlined />}
                  onClick={openRecycleBin}
                  title="题目归档"
                >
                  题目归档
                </Button>
              </Space>

              <Divider style={{ margin: '12px 0' }}>题目列表</Divider>

              {/* 快速跳转 */}
              <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Input.Search
                  placeholder="跳转到题号"
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  onSearch={handleJumpToQuestion}
                  onPressEnter={handleJumpToQuestion}
                  style={{ flex: 1 }}
                  size="small"
                />
                <span style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap' }}>共 {totalQuestions} 题</span>
              </div>

              <List
                dataSource={paginatedQuestions}
                style={{ marginBottom: '12px', maxHeight: '500px', overflowY: 'auto' }}
                renderItem={(item, index) => {
                  const globalIndex = startIndex + index;
                  const isSelected = selectedQuestion?._id === item._id;
                  
                  // 提取纯文本作为预览
                  let plainText = item.content || '';
                  // 将 Markdown 图片替换为 [图片]
                  plainText = plainText.replace(/!\[.*?\]\(.*?\)/g, '[图片]');
                  // 将 Markdown 链接替换为链接文本
                  plainText = plainText.replace(/\[(.*?)\]\(.*?\)/g, '$1');
                  // 将 HTML 图片替换为 [图片]
                  plainText = plainText.replace(/<img[^>]*>/g, '[图片]');
                  // 去除其他 HTML 标签
                  plainText = plainText.replace(/<[^>]*>/g, '');
                  // 去除加粗、斜体、标题等 Markdown 符号
                  plainText = plainText.replace(/[#*`_>]/g, '').trim();
                  
                  const snippet = plainText.length > 30 ? plainText.substring(0, 30) + '...' : (plainText || '（包含多媒体或无文本）');
                  
                  // 获取难度标签和颜色
                  const getDifficultyProps = (diff) => {
                    if (diff >= 7) return { text: '困难', color: '#f5222d', bg: '#fff1f0' };
                    if (diff >= 4) return { text: '中等', color: '#fa8c16', bg: '#fff7e6' };
                    return { text: '简单', color: '#52c41a', bg: '#f6ffed' };
                  };
                  const diffProps = getDifficultyProps(item.difficulty || 5);

                  return (
                    <List.Item
                      key={item._id}
                      onClick={() => {
                        setSelectedQuestion(item);
                        fetchQuestionReferences(item._id);
                        const tags = Array.isArray(item.tags) ? item.tags : [];
                        setCurrentTags(tags);
                        const formData = {
                          ...item,
                          options: item.options?.map(opt => ({
                            _id: opt._id,
                            content: opt.content,
                            value: opt.value,
                            isCorrect: opt.isCorrect
                          })),
                          correctAnswer: selectedType === 'TRUE_FALSE' ?
                            (item.options?.[0]?.isCorrect ? true : false) :
                            item.options?.findIndex(opt => opt.isCorrect),
                          difficulty: item.difficulty || 5,
                          tags: tags,
                          scaleLabels: Array.isArray(item.scaleLabels) ? item.scaleLabels.join('\n') : item.scaleLabels
                        };
                        form.setFieldsValue(formData);
                      }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        background: isSelected ? '#e6f7ff' : '#fff',
                        border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        transition: 'all 0.3s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: isSelected ? '#1890ff' : '#262626' }}>
                            题目 {globalIndex + 1}
                          </span>
                          <span style={{ 
                            fontSize: '11px', 
                            color: diffProps.color,
                            backgroundColor: diffProps.bg,
                            padding: '1px 6px',
                            borderRadius: '10px'
                          }}>
                            {diffProps.text}
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: '13px', 
                          color: '#595959',
                          lineHeight: '1.4'
                        }}>
                          {snippet}
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />

              {/* 分页器 */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                <Pagination
                  simple
                  size="small"
                  current={currentPage}
                  pageSize={pageSize}
                  total={totalQuestions}
                  onChange={(page) => setCurrentPage(page)}
                  showSizeChanger={false}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={10}>
          <Card
            title={
              <Space>
                {selectedQuestion ? '编辑题目' : '新建题目'}
                <Popover
                  content={renderAiContent()}
                  title={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <RobotOutlined />
                      <span>AI 解析内容</span>
                    </div>
                  }
                  trigger="click"
                  open={aiPopoverVisible}
                  onOpenChange={setAiPopoverVisible}
                  placement="right"
                >
                  <Button
                    type="default"
                    icon={<RobotOutlined />}
                    onClick={() => {
                      setSelectedQuestion(null);
                      form.resetFields();
                      setCurrentTags([]);

                      // 生成新的草稿ID
                      const newDraftId = generateDraftId();
                      setDraftId(newDraftId);

                      // 显示编辑表单
                      setModalVisible(true);

                      // 使用 setTimeout 确保表单重置完成后再设置默认值
                      setTimeout(() => {
                        form.setFieldsValue({
                          type: selectedType,
                          options: selectedType === 'SINGLE_CHOICE' ? [
                            { content: '选项 1' },
                            { content: '选项 2' },
                            { content: '选项 3' },
                            { content: '选项 4' }
                          ] : [],
                          correctAnswer: selectedType === 'SINGLE_CHOICE' ? 0 : undefined,
                          difficulty: 5,
                          tags: [],
                          scaleLevel: selectedType === 'PSYCHOLOGICAL_SCALE' ? 5 : undefined
                        });
                      }, 0);
                    }}
                    style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
                  >
                    AI 解析内容
                  </Button>
                </Popover>
              </Space>
            }
          >
            {renderQuestionForm()}
          </Card>
        </Col>
        <Col span={8}>
          {(selectedQuestion || modalVisible) && (
            <QuestionPreview form={form} />
          )}
        </Col>
      </Row>

      {/* 更新模式选择对话框 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>已被测验引用</span>
          </Space>
        }
        open={updateModeModalVisible}
        onCancel={() => {
          setUpdateModeModalVisible(false);
          setPendingUpdateValues(null);
        }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="warning">
            此题目已被 <strong>{questionReferences?.quizCount || 0}</strong> 个测验引用，
            并有 <strong>{questionReferences?.submissionCount || 0}</strong> 份学生提交记录。
          </Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>请选择更新方式：</Text>
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button
            block
            onClick={() => handleSubmit(pendingUpdateValues, 'SYNC_ALL')}
          >
            <div style={{ textAlign: 'left' }}>
              <div><strong>同步更新到所有测验</strong></div>
              <div style={{ fontSize: 12, color: '#888' }}>所有引用此题目的测验都将使用新版本</div>
            </div>
          </Button>
          <Button
            block
            onClick={() => handleSubmit(pendingUpdateValues, 'PROTECT_SUBMITTED')}
          >
            <div style={{ textAlign: 'left' }}>
              <div><strong>保护已提交记录</strong></div>
              <div style={{ fontSize: 12, color: '#888' }}>归档旧版本，继续为已提交答卷保留原始题目</div>
            </div>
          </Button>
          <Button
            block
            type="default"
            onClick={() => {
              setUpdateModeModalVisible(false);
              setPendingUpdateValues(null);
            }}
          >
            取消
          </Button>
        </Space>
      </Modal>

      {/* 题目归档 Modal */}
      <Modal
        title={
          <Space>
            <RestOutlined />
            <span>题目归档</span>
          </Space>
        }
        open={recycleBinVisible}
        onCancel={() => setRecycleBinVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16, color: '#888' }}>
          已归档的题目会保留在此处，可以随时还原。如果题目被测验引用则不能永久删除。
        </div>
        <Table
          loading={loadingDeleted}
          dataSource={deletedQuestions}
          rowKey="_id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '序号',
              width: 60,
              render: (_, __, index) => index + 1
            },
            {
              title: '题目内容',
              dataIndex: 'content',
              ellipsis: true,
              render: (content) => (
                <Tooltip title={content}>
                  <span>{content?.substring(0, 50)}{content?.length > 50 ? '...' : ''}</span>
                </Tooltip>
              )
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 100,
              render: (type) => ({
                'SINGLE_CHOICE': '单选题',
                'TRUE_FALSE': '判断题',
                'PSYCHOLOGICAL_SCALE': '心理量表'
              }[type] || type)
            },
            {
              title: '引用',
              width: 80,
              render: (_, record) => (
                <Tooltip title={`${record.references?.quizCount || 0} 个测验，${record.references?.submissionCount || 0} 份提交`}>
                  <Tag color={record.references?.quizCount > 0 ? 'orange' : 'green'}>
                    {record.references?.quizCount || 0}
                  </Tag>
                </Tooltip>
              )
            },
            {
              title: '删除时间',
              dataIndex: 'deletedAt',
              width: 160,
              render: (deletedAt) => deletedAt ? new Date(deletedAt).toLocaleString('zh-CN') : '-'
            },
            {
              title: '操作',
              width: 150,
              render: (_, record) => (
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<UndoOutlined />}
                    onClick={() => handleRestore(record._id)}
                  >
                    还原
                  </Button>
                  <Popconfirm
                    title="确定要永久删除此题目吗？"
                    description="此操作不可撤销！"
                    onConfirm={() => handlePermanentDelete(record._id)}
                    disabled={record.references?.quizCount > 0 || record.references?.submissionCount > 0}
                  >
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={record.references?.quizCount > 0 || record.references?.submissionCount > 0}
                    >
                      永久删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
          locale={{
            emptyText: <Empty description="回收站为空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          }}
        />
      </Modal>
    </>
  );
};

export default QuestionBank; 