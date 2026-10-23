import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Form,
  Input,
  Button,
  message,
  Space,
  Typography,
  Breadcrumb,
  Modal,
  Select,
  Checkbox,
  Table,
  Row,
  Col,
  Tag,
  Empty,
  Upload,
  InputNumber,
  Menu,
  Switch,
  Tabs,
  Popconfirm,
  Radio,
  Slider,
  Divider,
  Alert,
  Tooltip,
  Collapse
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  UploadOutlined,
  InboxOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DownloadOutlined,
  PictureOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import ExcelGradingSettings from './components/ExcelGradingSettings';
import OfficeGradingSettings from './components/OfficeGradingSettings';
import { courseManagementAPI, API_BASE_URL, typingAPI, quizAPI, lessonAPI, mediaAPI } from '../../services/api';
import MarkdownEditor from '../../components/shared/MarkdownEditor';
import MarkdownRenderer from '../../components/shared/MarkdownRenderer';

const { Content } = Layout;
const { Title } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

const normalizeOfficeRuleScores = (rules = []) => {
  const uniformTen = rules.length > 0 && rules.every(rule => Number(rule.score ?? 1) === 10);
  return rules.map(rule => ({ ...rule, score: uniformTen ? 1 : Number(rule.score ?? 1) }));
};

const LessonEdit = () => {
  const { courseId, unitId, lessonId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState(null);
  const [unit, setUnit] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [activities, setActivities] = useState([]);
  const [activityForm] = Form.useForm();
  const isEditing = !!lessonId;
  const [submitting, setSubmitting] = useState(false);
  const [typingTexts, setTypingTexts] = useState([]);
  const [selectedActivityIndex, setSelectedActivityIndex] = useState(0);
  const [quizzes, setQuizzes] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [missingMedia, setMissingMedia] = useState([]);
  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    lessonAPI.mediaStatus(lessonId).then(result => { if (active) setMissingMedia(result.missing); }).catch(console.error);
    return () => { active = false; };
  }, [lessonId]);
  const [publicMedias, setPublicMedias] = useState([]);
  const [loadingMedias, setLoadingMedias] = useState(false);
  const [selectedTab, setSelectedTab] = useState('content'); // 'content' 或 'public-media'
  const [spreadsheets, setSpreadsheets] = useState([]); // 加载表格列表

  // 添加图片调整相关状态
  const [imageResizeModalVisible, setImageResizeModalVisible] = useState(false);
  const [imageToResize, setImageToResize] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const [imageScale, setImageScale] = useState(100);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef(null);
  const exportModeRef = useRef('full');

  const [quizDetails, setQuizDetails] = useState(null);
  const [loadingQuizDetails, setLoadingQuizDetails] = useState(false);
  const [regeneratingPptRules, setRegeneratingPptRules] = useState(false);

  useEffect(() => {
    if (isEditing) {
      fetchLessonDetails();
      // 从localStorage恢复选中的活动索引
      const savedIndex = localStorage.getItem(`selectedActivityIndex-${lessonId}`);
      if (savedIndex !== null) {
        setSelectedActivityIndex(parseInt(savedIndex));
      }
    } else {
      fetchCourseAndUnit();
    }
    loadTypingTexts(); // 加载打字文本列表
    loadQuizzes(); // 加载测验列表
    loadSpreadsheets(); // 加载表格列表
  }, [courseId, unitId, lessonId]);

  // 添加加载媒体文件列表的useEffect
  useEffect(() => {
    if (isEditing && lessonId && selectedTab === 'public-media') {
      loadPublicMedias();
    }
  }, [courseId, unitId, lessonId, selectedTab]);

  // 添加一个新的 useEffect 来处理活动数据加载到表单
  useEffect(() => {
    if (activities.length > 0 && selectedActivityIndex < activities.length) {
      const activity = activities[selectedActivityIndex];
      console.log('[DEBUG] useEffect setting form for activity:', activity.title);

      const formValues = {
        ...activity,
        requireSubmission: !!activity.requireSubmission,
        allowedFormats: activity.allowedFormats || [],
        referenceAnswer: activity.referenceAnswer || ''
      };

      // 确保 quiz ID 正确提取
      if (formValues.quizSettings?.quiz) {
        const quizId = typeof formValues.quizSettings.quiz === 'object' ?
          formValues.quizSettings.quiz._id : formValues.quizSettings.quiz;

        console.log('[DEBUG] Form quizId resolved to:', quizId);

        formValues.quizSettings = {
          ...formValues.quizSettings,
          quiz: quizId
        };
      }

      activityForm.setFieldsValue(formValues);

      // 如果是测验类型，加载测验详情
      if (activity.type === 'quiz' && formValues.quizSettings?.quiz) {
        handleQuizChange(formValues.quizSettings.quiz);
      } else {
        setQuizDetails(null);
      }
    }
  }, [activities, selectedActivityIndex, activityForm]);

  const fetchCourseAndUnit = async () => {
    try {
      const courseResponse = await courseManagementAPI.getCourse(courseId);
      if (courseResponse.data.success) {
        setCourse(courseResponse.data.data.course);
      }

      const unitsResponse = await courseManagementAPI.getUnits(courseId);
      if (unitsResponse.data.success) {
        const currentUnit = unitsResponse.data.data.find(u => u._id === unitId);
        setUnit(currentUnit);
      }
    } catch (error) {
      console.error('获取课程或单元信息失败:', error);
      message.error('获取课程或单元信息失败');
    }
  };

  const fetchLessonDetails = async () => {
    try {
      const response = await courseManagementAPI.getLesson(courseId, unitId, lessonId);
      if (response.success) {
        const lessonData = response.data;
        setLesson(lessonData);
        setCourse(lessonData.course);
        setUnit(lessonData.unit);

        // 保存当前选中的活动ID，用于在重新加载后找回对应活动
        const currentActivityId = activities[selectedActivityIndex]?._id;

        // 更新活动列表
        setActivities((lessonData.activities || []).map(activity => {
          const normalized = { ...activity };
          for (const key of ['pptGradingSettings', 'excelGradingSettings']) {
            if (activity[key]) normalized[key] = { ...activity[key], rules: normalizeOfficeRuleScores(activity[key].rules || []) };
          }
          return normalized;
        }));

        // 如果有当前选中的活动，尝试在新的活动列表中找到对应的活动
        if (currentActivityId && lessonData.activities?.length > 0) {
          const newIndex = lessonData.activities.findIndex(a => a._id === currentActivityId);
          if (newIndex !== -1) {
            setSelectedActivityIndex(newIndex);
            localStorage.setItem(`selectedActivityIndex-${lessonId}`, newIndex.toString());
          }
        }

        form.setFieldsValue({
          title: lessonData.title,
          description: lessonData.description,
          objectives: lessonData.objectives || []
        });
      } else {
        message.error('获取课时详情失败');
      }
    } catch (error) {
      console.error('获取课时详情失败:', error);
      message.error('获取课时详情失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const lessonData = {
        ...values,
        activities
      };

      await courseManagementAPI.updateLesson(courseId, unitId, lessonId, lessonData);
      message.success('课时更新成功');
    } catch (error) {
      console.error('保存课时失败:', error);
      message.error('保存课时失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = () => {
    // 创建一个新的空活动
    const newActivity = {
      title: '新活动',
      type: 'reading',
      description: '',
      content: '',
      requireSubmission: false,
      resources: []
    };

    // 添加到活动列表
    const newActivities = [...activities, newActivity];

    // 更新课时信息
    courseManagementAPI.updateLesson(courseId, unitId, lessonId, {
      ...lesson,
      activities: newActivities
    }).then(() => {
      // 重新获取课时详情
      fetchLessonDetails().then(() => {
        // 选中新添加的活动
        const newIndex = newActivities.length - 1;
        setSelectedActivityIndex(newIndex);
        localStorage.setItem(`selectedActivityIndex-${lessonId}`, newIndex.toString());

        // 重置表单
        activityForm.resetFields();
        activityForm.setFieldsValue({
          ...newActivity,
          requireSubmission: false,
          allowedFormats: [],
          typingSettings: {
            targetSpeed: 60,
            targetAccuracy: 95,
            timeLimit: 5,
            allowOnce: false,
          },
          quizSettings: {
            quiz: undefined,
            timeLimit: 0,
            randomizeQuestions: false,
            randomizeOptions: false,
            showAnswerAfterSubmit: false,
            showScoreAfterSubmit: false,
            allowMultipleAttempts: false,
            maxAttempts: 1
          }
        });

        message.success('活动添加成功');
      });
    }).catch(error => {
      console.error('添加活动失败:', error);
      message.error('添加活动失败');
    });
  };

  const handleEditActivity = (activity, index) => {
    // 选中要编辑的活动
    setSelectedActivityIndex(index);
    localStorage.setItem(`selectedActivityIndex-${lessonId}`, index.toString());

    // 加载活动数据到表单
    activityForm.setFieldsValue({
      ...activity,
      requireSubmission: !!activity.requireSubmission,
      allowedFormats: activity.allowedFormats || [],
      referenceAnswer: activity.referenceAnswer || ''
    });

    message.info('请在右侧编辑活动内容');
  };

  const handleDeleteActivity = async (index) => {
    const activity = activities[index];
    const hasResources = activity.resources && activity.resources.length > 0;

    // 显示确认对话框
    Modal.confirm({
      title: '确认删除',
      content: hasResources
        ? `该活动包含 ${activity.resources.length} 个资源文件，删除活动将同时删除所有资源文件。确定要删除吗？`
        : '确定要删除该活动吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 如果活动有资源，先删除所有资源
          if (hasResources) {
            for (const resource of activity.resources) {
              const filename = resource.path.split('/').pop();
              try {
                await courseManagementAPI.deleteResource(courseId, unitId, lessonId, filename);
                console.log(`已删除资源: ${filename}`);
              } catch (error) {
                console.error(`删除资源失败: ${filename}`, error);
                // 继续删除其他资源
              }
            }
          }

          const newActivities = [...activities];
          newActivities.splice(index, 1);

          // 更新课时信息，删除活动
          await courseManagementAPI.updateLesson(courseId, unitId, lessonId, {
            ...lesson,
            activities: newActivities
          });

          // 调整选中的活动索引
          if (newActivities.length === 0) {
            setSelectedActivityIndex(0);
            localStorage.removeItem(`selectedActivityIndex-${lessonId}`);
          } else if (index >= newActivities.length) {
            // 如果删除的是最后一个活动，选中新的最后一个活动
            const newIndex = newActivities.length - 1;
            setSelectedActivityIndex(newIndex);
            localStorage.setItem(`selectedActivityIndex-${lessonId}`, newIndex.toString());
          }
          // 如果删除的是中间的活动，索引不变，自动指向下一个活动

          // 重新获取课时详情以更新UI
          await fetchLessonDetails();
          message.success('活动删除成功');
        } catch (error) {
          console.error('删除活动失败:', error);
          message.error('删除活动失败');
        }
      }
    });
  };



  // 修改handleActivitySubmit函数，确保正确处理description字段
  const handleActivitySubmit = async () => {
    try {
      setSubmitting(true);
      const values = await activityForm.validateFields();
      const newActivities = [...activities];

      // 构建活动数据
      let activityData = {
        title: values.title,
        type: values.type,
        description: values.description || '', // 确保description字段被保存
        content: values.content || '',
        // 练习类型自动需要提交文件
        requireSubmission: values.type === 'practice' ? true : false,
        allowedFormats: values.type === 'practice' ? (values.allowedFormats || []) : [],
        resources: activities[selectedActivityIndex]?.resources || [],
        pptGradingSettings: activities[selectedActivityIndex]?.pptGradingSettings,
        // 批阅配置不属于活动文字表单，保存时需保留规则和上传文件关联。
        excelGradingSettings: activities[selectedActivityIndex]?.excelGradingSettings
      };

      // 如果是打字练习类型，添加打字相关设置
      if (values.type === 'typing' && values.typingSettings) {
        activityData = {
          ...activityData,
          typingSettings: {
            text: values.typingSettings.text,
            targetSpeed: values.typingSettings.targetSpeed,
            targetAccuracy: values.typingSettings.targetAccuracy,
            timeLimit: values.typingSettings.timeLimit,
            allowOnce: values.typingSettings.allowOnce || false
          }
        };
        // 打字练习不需要content字段
        delete activityData.content;
      }

      // 如果是测验类型，添加测验相关设置
      if (values.type === 'quiz' && values.quizSettings) {
        activityData = {
          ...activityData,
          quizSettings: {
            quiz: values.quizSettings.quiz,
            timeLimit: values.quizSettings.timeLimit,
            randomizeQuestions: values.quizSettings.randomizeQuestions,
            randomizeOptions: values.quizSettings.randomizeOptions,
            showAnswerAfterSubmit: values.quizSettings.showAnswerAfterSubmit,
            showScoreAfterSubmit: values.quizSettings.showScoreAfterSubmit,
            allowMultipleAttempts: values.quizSettings.allowMultipleAttempts,
            maxAttempts: values.quizSettings.allowMultipleAttempts ? (values.quizSettings.maxAttempts || 1) : 1
          }
        };



        // 测验不需要content字段
        delete activityData.content;
      }

      // 如果是流程图类型，添加流程图相关设置
      if (values.type === 'flowchart') {
        activityData = {
          ...activityData,
          flowchartSettings: {
            instructions: values.flowchartSettings?.instructions || '',
            maxNodes: values.flowchartSettings?.maxNodes || 50,
            timeLimit: values.flowchartSettings?.timeLimit || 0,
            allowedNodeTypes: values.flowchartSettings?.allowedNodeTypes || [],
            template: values.flowchartSettings?.template || '',
            referenceAnswer: values.flowchartSettings?.referenceAnswer || ''
          }
        };
        // 流程图不需要content字段
        delete activityData.content;
      }

      // 如果是在线表格类型，添加表格相关设置
      if (values.type === 'spreadsheet') {
        activityData = {
          ...activityData,
          spreadsheetSettings: {
            instructions: values.spreadsheetSettings?.instructions || '',
            spreadsheetId: values.spreadsheetSettings?.spreadsheetId || null,
            timeLimit: values.spreadsheetSettings?.timeLimit || 0
          }
        };
        // 在线表格不需要content字段
        delete activityData.content;
      }

      // 如果是 HTML 网页类型，添加 HTML 相关设置
      if (values.type === 'html') {
        activityData = {
          ...activityData,
          htmlSettings: {
            instructions: values.htmlSettings?.instructions || '',
            timeLimit: values.htmlSettings?.timeLimit || 0
          }
        };
        // HTML网页不需要content字段
        delete activityData.content;
      }

      // 如果是填空类型，添加填空相关设置
      if (values.type === 'fillblank') {
        activityData = {
          ...activityData,
          fillBlankSettings: {
            instructions: values.fillBlankSettings?.instructions || '',
            content: values.fillBlankSettings?.content || '',
            showCorrectAfterSubmit: values.fillBlankSettings?.showCorrectAfterSubmit ?? true
          }
        };
        // 填空不需要content字段
        delete activityData.content;
      }

      // 如果是Python编程类型，添加Python相关设置
      if (values.type === 'python') {
        activityData = {
          ...activityData,
          pythonSettings: {
            instructions: values.pythonSettings?.instructions || '',
            starterCode: values.pythonSettings?.starterCode || '# 在这里编写你的Python代码\n',
            testCases: values.pythonSettings?.testCases || []
          }
        };
        // Python不需要content字段
        delete activityData.content;
      }

      // 如果需要提交，添加相关字段
      if (values.requireSubmission) {
        activityData.allowedFormats = values.allowedFormats || [];
        if (values.allowedFormats?.includes('PY')) {
          activityData.referenceAnswer = values.referenceAnswer || '';
        }
      }

      // 如果是编辑现有活动，保留原有的_id
      const currentActivity = activities[selectedActivityIndex];
      if (currentActivity?._id) {
        activityData._id = currentActivity._id;
      }

      // 更新当前选中的活动
      newActivities[selectedActivityIndex] = activityData;

      // 更新课时信息
      try {
        await courseManagementAPI.updateLesson(courseId, unitId, lessonId, {
          ...lesson,
          activities: newActivities
        });

        await fetchLessonDetails();
        message.success('活动保存成功');
      } catch (error) {
        console.error('保存活动失败:', error);
        message.error('保存活动失败: ' + error.message);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
      // 表单验证失败时显示消息提示
      if (error.errorFields) {
        const errorFields = error.errorFields.map(field => field.name[0]).join('、');
        message.error(`请完善以下必填项: ${errorFields}`);
      } else {
        message.error('表单验证失败，请检查必填项');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async (file, activityIndex) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('activityIndex', activityIndex);

    try {
      const response = await courseManagementAPI.uploadActivityResource(courseId, unitId, lessonId, formData);
      message.success('文件上传成功');
      await fetchLessonDetails(); // 刷新数据
      return response;
    } catch (error) {
      message.error('文件上传失败');
      return false;
    }
  };

  const getCurrentActivity = () => activities[selectedActivityIndex] || {};

  const updateCurrentPptSettings = settings => {
    const newActivities = [...activities];
    newActivities[selectedActivityIndex] = {
      ...newActivities[selectedActivityIndex],
      pptGradingSettings: settings
    };
    setActivities(newActivities);
  };

  const handlePptGradingUpload = async (file, fileRole) => {
    const activity = getCurrentActivity();
    if (!activity?._id) {
      message.warning('请先保存活动，再上传PPT批阅文件');
      return false;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileRole', fileRole);
    try {
      const response = await lessonAPI.uploadPptGradingFile(lessonId, activity._id, formData);
      if (response.success) {
        updateCurrentPptSettings(response.data);
        message.success(response.message || '上传成功');
      }
      return response;
    } catch (error) {
      message.error(error.response?.data?.message || '上传失败');
      return false;
    }
  };

  const handlePptRuleChange = (index, patch) => {
    const activity = getCurrentActivity();
    const settings = activity.pptGradingSettings || {};
    const rules = [...(settings.rules || [])];
    rules[index] = {
      ...rules[index],
      ...patch
    };
    updateCurrentPptSettings({
      ...settings,
      rules
    });
  };

  const handleSavePptGradingSettings = async () => {
    const activity = getCurrentActivity();
    if (!activity?._id) {
      message.warning('请先保存活动');
      return;
    }
    const settings = activity.pptGradingSettings || {};
    try {
      const response = await lessonAPI.updatePptGradingSettings(lessonId, activity._id, {
        enabled: settings.enabled !== false,
        rules: settings.rules || []
      });
      if (response.success) {
        updateCurrentPptSettings(response.data);
        message.success('PPT批阅配置已保存');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    }
  };

  const handleRegeneratePptRules = async () => {
    const activity = getCurrentActivity();
    if (!activity?._id) {
      message.warning('请先保存活动');
      return;
    }
    if (!activity.pptGradingSettings?.referenceFile?.path) {
      message.warning('请先上传参考答案PPT');
      return;
    }
    try {
      setRegeneratingPptRules(true);
      const response = await lessonAPI.regeneratePptGradingRules(lessonId, activity._id);
      if (response.success) {
        updateCurrentPptSettings(response.data);
        message.success('得分点已重新解析');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '重新解析失败');
    } finally {
      setRegeneratingPptRules(false);
    }
  };

  const handleDownloadPptGradingFile = async fileRole => {
    const activity = getCurrentActivity();
    if (!activity?._id) {
      message.warning('请先保存活动');
      return;
    }
    const settings = activity.pptGradingSettings || {};
    const fileInfo = fileRole === 'original' ? settings.originalFile : settings.referenceFile;
    if (!fileInfo?.path) {
      message.warning(fileRole === 'original' ? '尚未上传原始PPT' : '尚未上传参考答案PPT');
      return;
    }
    try {
      const response = await lessonAPI.downloadPptGradingFile(lessonId, activity._id, fileRole);
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInfo.originalName || fileInfo.filename || `${fileRole}.pptx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      message.error(error.response?.data?.message || '下载失败');
    }
  };

  const updatePptRulesBatch = (indexes, patch) => {
    const activity = getCurrentActivity();
    const settings = activity.pptGradingSettings || {};
    const indexSet = new Set(indexes);
    const rules = (settings.rules || []).map((rule, index) => indexSet.has(index) ? {
      ...rule,
      ...patch
    } : rule);
    updateCurrentPptSettings({
      ...settings,
      rules
    });
  };

  const togglePptRuleGroup = (group, enabled) => {
    updatePptRulesBatch(group.items.map(item => item.index), {
      enabled
    });
  };

  const togglePptRuleTypeInGroup = (group, typeLabel) => {
    const typeItems = group.items.filter(item => getPptRuleTypeLabel(item.type) === typeLabel);
    const hasEnabled = typeItems.some(item => item.enabled !== false);
    updatePptRulesBatch(typeItems.map(item => item.index), {
      enabled: !hasEnabled
    });
  };

  const getPptRuleTypeLabel = type => {
    if (type?.startsWith('animation')) return '动画';
    if (type?.startsWith('media')) return '音视频';
    if (type?.startsWith('transition')) return '切换';
    if (type?.startsWith('background')) return '背景';
    const labelMap = {
      criteriaGroup: '整步要求',
      textContent: '文字',
      textProperty: '文字格式',
      tableProperty: '表格',
      slideLayout: '版式',
      objectDeleted: '删除对象',
      objectOrder: '叠放顺序',
      objectProperty: '对象属性',
      showProperty: '放映',
      textShape: '文字',
      picture: '图片',
      hyperlink: '超链接',
      masterPicture: '母版',
      masterPictureSize: '母版尺寸',
      slideCount: '页数',
      showSettings: '放映'
    };
    return labelMap[type] || type;
  };

  const getPptRuleGroupKey = rule => {
    if (rule.slideNumber) return `slide-${rule.slideNumber}`;
    if (rule.type === 'masterPicture' || rule.type === 'masterPictureSize') return 'master';
    if (rule.type === 'showSettings' || rule.type === 'showProperty') return 'show';
    if (rule.type === 'slideCount') return 'global';
    return 'other';
  };

  const getPptRuleGroupTitle = (key, rules) => {
    if (key.startsWith('slide-')) return `第 ${rules[0]?.slideNumber} 张幻灯片`;
    if (key === 'master') return '幻灯片母版';
    if (key === 'show') return '放映设置';
    if (key === 'global') return '整体要求';
    return '其他要求';
  };

  const groupPptRules = (rules = []) => {
    const groupMap = new Map();
    rules.forEach((rule, index) => {
      const key = getPptRuleGroupKey(rule);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push({
        ...rule,
        index,
        key: rule.id || `${key}-${index}`
      });
    });
    return Array.from(groupMap.entries()).map(([key, items]) => {
      const enabledItems = items.filter(item => item.enabled !== false);
      return {
        key,
        title: getPptRuleGroupTitle(key, items),
        items,
        enabledCount: enabledItems.length,
        totalCount: items.length,
        score: enabledItems.reduce((sum, item) => sum + (Number(item.score) || 0), 0),
        types: Array.from(new Set(items.map(item => getPptRuleTypeLabel(item.type)))).filter(Boolean)
      };
    });
  };

  const handleDeleteResource = async (record) => {
    try {
      console.log('准备删除资源:', {
        courseId,
        unitId,
        lessonId,
        resourcePath: record.path
      });

      // 从完整路径中提取文件名
      const filename = record.path.split('/').pop();

      // 删除资源
      await courseManagementAPI.deleteResource(courseId, unitId, lessonId, filename);
      message.success('资源删除成功');
      await fetchLessonDetails(); // 刷新数据
    } catch (error) {
      console.error('删除资源失败:', error);
      message.error('删除资源失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 复制文本到剪贴板
  const copyToClipboard = (text, successMsg = '已复制到剪贴板') => {
    if (!text) {
      message.error('内容为空，无法复制');
      return;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      message.success(successMsg);
    } catch (err) {
      message.error('复制失败');
    }
    document.body.removeChild(textArea);
  };

  const handleDownloadResource = async (record) => {
    try {
      if (!record.path) {
        message.error('资源路径无效');
        return;
      }

      // 清理路径，移除前缀
      const cleanPath = record.path.replace('resources/', '');

      const response = await fetch(
        `${API_BASE_URL}/api/download/resource/${cleanPath}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.originalName || record.filename; // 使用原始文件名
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('资源下载成功');
    } catch (error) {
      console.error('下载资源失败:', error);
      message.error('下载资源失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadTypingTexts = async () => {
    try {
      const data = await typingAPI.getTexts();
      setTypingTexts(data);
    } catch (error) {
      console.error('加载打字文本失败:', error);
    }
  };

  // 加载测验列表
  const loadQuizzes = async () => {
    try {
      const response = await quizAPI.quizzes.getList();
      setQuizzes(response.data || []);
    } catch (error) {
      console.error('加载测验列表失败:', error);
      message.error('加载测验列表失败');
    }
  };

  // 加载表格列表
  const loadSpreadsheets = async () => {
    try {
      // spreadsheetAPI has named exports, not a default export named spreadsheetAPI
      const { getSpreadsheets } = await import('../../services/spreadsheetAPI');
      const response = await getSpreadsheets();
      if (response) {
        // The API returns response.data directly based on file view?
        // Line 11: const response = await api.get... return response.data
        // So getSpreadsheets returns the data object.
        // Let's assume response is the data or matches current usage.
        // checking file content again: line 12 return response.data;
        // usually api.get returns axios object. response.data is the payload.
        // IF backend returns standard structure { success: true, data: [...] }
        // Then response is that object.
        setSpreadsheets(response.data || []);
      }
    } catch (error) {
      console.error('加载表格列表失败:', error);
    }
  };

  // 处理活动上移
  const handleMoveUp = async (index) => {
    if (index === 0) return;
    const newActivities = [...activities];
    const temp = newActivities[index];
    newActivities[index] = newActivities[index - 1];
    newActivities[index - 1] = temp;

    try {
      await courseManagementAPI.updateLesson(courseId, unitId, lessonId, {
        ...lesson,
        activities: newActivities
      });

      // 如果当前选中的活动是被移动的活动，则更新选中索引
      if (selectedActivityIndex === index) {
        setSelectedActivityIndex(index - 1);
        localStorage.setItem(`selectedActivityIndex-${lessonId}`, (index - 1).toString());
      }
      // 如果当前选中的活动是被交换的活动，则更新选中索引
      else if (selectedActivityIndex === index - 1) {
        setSelectedActivityIndex(index);
        localStorage.setItem(`selectedActivityIndex-${lessonId}`, index.toString());
      }

      setActivities(newActivities);
      message.success('活动顺序调整成功');
    } catch (error) {
      console.error('调整活动顺序失败:', error);
      message.error('调整活动顺序失败');
    }
  };

  // 处理活动下移
  const handleMoveDown = async (index) => {
    if (index === activities.length - 1) return;
    const newActivities = [...activities];
    const temp = newActivities[index];
    newActivities[index] = newActivities[index + 1];
    newActivities[index + 1] = temp;

    try {
      await courseManagementAPI.updateLesson(courseId, unitId, lessonId, {
        ...lesson,
        activities: newActivities
      });

      // 如果当前选中的活动是被移动的活动，则更新选中索引
      if (selectedActivityIndex === index) {
        setSelectedActivityIndex(index + 1);
        localStorage.setItem(`selectedActivityIndex-${lessonId}`, (index + 1).toString());
      }
      // 如果当前选中的活动是被交换的活动，则更新选中索引
      else if (selectedActivityIndex === index + 1) {
        setSelectedActivityIndex(index);
        localStorage.setItem(`selectedActivityIndex-${lessonId}`, index.toString());
      }

      setActivities(newActivities);
      message.success('活动顺序调整成功');
    } catch (error) {
      console.error('调整活动顺序失败:', error);
      message.error('调整活动顺序失败');
    }
  };

  // 处理课时导出
  const handleExportLesson = async (mode = 'full') => {
    try {
      setExporting(true);
      message.loading({ content: '正在导出课时...', key: 'exportLesson', duration: 0 });

      // 直接使用浏览器下载功能
      const token = localStorage.getItem('token');
      const url = `${API_BASE_URL}/api/lessons/${lessonId}/export?mode=${mode}`;

      // 创建一个隐藏的a标签来触发下载
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `lesson_${lesson.title || lessonId}_${mode}.zip`);
      link.setAttribute('target', '_blank');

      // 添加授权头
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`导出失败: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          link.href = url;
          document.body.appendChild(link);
          link.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(link);
          message.success({ content: '课时导出成功', key: 'exportLesson' });
        })
        .catch(error => {
          console.error('导出课时失败:', error);
          message.error({ content: `导出课时失败: ${error.message}`, key: 'exportLesson' });
        })
        .finally(() => {
          setExporting(false);
        });
    } catch (error) {
      console.error('导出课时失败:', error);
      message.error({ content: `导出课时失败: ${error.message}`, key: 'exportLesson' });
      setExporting(false);
    }
  };

  // 处理活动选择
  const handleActivitySelect = (index) => {
    setSelectedActivityIndex(index);
    // 保存选中的活动索引到localStorage
    localStorage.setItem(`selectedActivityIndex-${lessonId}`, index.toString());

    // Form update is handled by useEffect when selectedActivityIndex changes
  };

  // 加载公开媒体文件列表
  const loadPublicMedias = async () => {
    if (!courseId || !unitId || !lessonId) return;

    try {
      setLoadingMedias(true);
      const response = await mediaAPI.getLessonMedias(courseId, unitId, lessonId);
      if (response.success) {
        setPublicMedias(response.data || []);
      } else {
        message.error('加载公开媒体文件列表失败');
      }
    } catch (error) {
      console.error('加载公开媒体文件列表失败:', error);
      message.error('加载公开媒体文件列表失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingMedias(false);
    }
  };

  // 处理删除公开媒体文件
  const handleDeletePublicMedia = async (media) => {
    try {
      const filename = media.filename;
      const response = await mediaAPI.deleteMedia(courseId, unitId, lessonId, filename);
      if (response.success) {
        message.success(`${media.mediaType === 'video' ? '视频' : '图片'}删除成功`);
        loadPublicMedias(); // 重新加载媒体文件列表
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

  // 复制Markdown格式的媒体代码到剪贴板
  const copyMarkdownMediaCode = (media) => {
    const url = media.path; // 使用相对路径
    let markdownCode;

    if (media.mediaType === 'video') {
      // 使用超链接样式，学生端点击将弹出视频预览模态框
      markdownCode = `[点击播放视频](${url})`;
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

  // 表格切换
  const handleTabChange = (activeKey) => {
    setSelectedTab(activeKey);
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

  // 处理图片上传前的预览和调整
  const handleImageBeforeUpload = (file) => {
    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('请选择图片文件');
      return false;
    }

    // 创建图片的URL
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result;
      img.onload = () => {
        // 设置原始尺寸
        setOriginalImageSize({ width: img.width, height: img.height });
        setImageWidth(img.width);
        setImageHeight(img.height);
        setPreviewImage(reader.result);
        setImageToResize(file);
        setImageScale(100);
        setImageResizeModalVisible(true);
      };
    };
    return false; // 阻止默认上传
  };

  // 处理图片上传（调整后）
  const handleResizedImageUpload = async () => {
    if (!imageToResize || !canvasRef.current) return;

    // 创建canvas绘制调整后的图片
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // 设置canvas尺寸为调整后的尺寸
    canvas.width = imageWidth;
    canvas.height = imageHeight;

    // 在canvas上绘制调整后的图片
    const img = new Image();
    img.src = previewImage;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

    // 将canvas转换为Blob
    canvas.toBlob(async (blob) => {
      // 创建文件对象
      const resizedFile = new File([blob], imageToResize.name, {
        type: imageToResize.type,
        lastModified: Date.now()
      });

      // 创建FormData对象并添加调整后的图片
      const formData = new FormData();
      formData.append('media', resizedFile);

      try {
        setLoadingMedias(true);
        const response = await mediaAPI.uploadMedia(courseId, unitId, lessonId, formData);

        if (response.success) {
          message.success('图片上传成功');
          loadPublicMedias(); // 刷新媒体列表
        } else {
          message.error('图片上传失败');
        }
      } catch (error) {
        console.error('图片上传失败:', error);
        message.error('图片上传失败: ' + (error.response?.data?.message || error.message));
      } finally {
        setLoadingMedias(false);
        setImageResizeModalVisible(false);
        setImageToResize(null);
      }
    }, imageToResize.type);
  };

  // 处理图片比例变化
  const handleScaleChange = (value) => {
    setImageScale(value);
    const newWidth = Math.round(originalImageSize.width * (value / 100));
    const newHeight = Math.round(originalImageSize.height * (value / 100));
    setImageWidth(newWidth);
    setImageHeight(newHeight);
  };

  // 处理宽度变化，保持宽高比
  const handleWidthChange = (value) => {
    setImageWidth(value);
    const aspectRatio = originalImageSize.height / originalImageSize.width;
    const newHeight = Math.round(value * aspectRatio);
    setImageHeight(newHeight);
    const newScale = (value / originalImageSize.width) * 100;
    setImageScale(newScale);
  };

  // 处理高度变化，保持宽高比
  const handleHeightChange = (value) => {
    setImageHeight(value);
    const aspectRatio = originalImageSize.width / originalImageSize.height;
    const newWidth = Math.round(value * aspectRatio);
    setImageWidth(newWidth);
    const newScale = (value / originalImageSize.height) * 100;
    setImageScale(newScale);
  };

  // 处理测验发布
  const handlePublishQuiz = async (quizIdOrObj) => {
    const quizId = typeof quizIdOrObj === 'object' ? quizIdOrObj?._id : quizIdOrObj;
    if (!quizId) return;

    try {
      await quizAPI.quizzes.publish(quizId);
      message.success('测验发布成功');

      // 重新获取测验详情，更新状态展示
      handleQuizChange(quizId);
    } catch (error) {
      console.error('发布测验失败:', error);
      message.error('发布测验失败');
    }
  };

  // 在表单字段值变化时的处理函数中添加加载测验详情的功能
  const handleQuizChange = async (quizIdOrObj) => {
    const quizId = typeof quizIdOrObj === 'object' ? quizIdOrObj?._id : quizIdOrObj;

    if (!quizId) {
      setQuizDetails(null);
      return;
    }

    try {
      setLoadingQuizDetails(true);
      const response = await quizAPI.quizzes.getById(quizId);
      if (response.data && response.data._id) {
        setQuizDetails(response.data);


      }
    } catch (error) {
      console.error('获取测验详情失败:', error);
      message.error('获取测验详情失败');
    } finally {
      setLoadingQuizDetails(false);
    }
  };

  return (
    <Layout className="lesson-edit-layout">
      <Content style={{ padding: '24px', backgroundColor: '#f0f2f5' }}>
        <Card className="main-card" bordered={false}>
          <div className="page-header" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/teacher?tab=1')}
              >
                返回课程列表
              </Button>
              <Title level={4} style={{ margin: 0 }}>
                {isEditing ? '编辑课时' : '创建课时'}
              </Title>
            </Space>
            {isEditing && (
              <Space>
              <Select defaultValue="full" id="lesson-export-mode" style={{ width: 180 }} disabled={exporting}
                options={[{ value: 'full', label: '完整包（含媒体）' }, { value: 'content', label: '内容包（不含媒体）' }, { value: 'media', label: '媒体包（单独迁移）' }]}
                onChange={value => { exportModeRef.current = value; }} />
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => handleExportLesson(exportModeRef.current)}
                loading={exporting}
              >
                导出课时
              </Button>
              </Space>
            )}
          </div>

          <Row gutter={24}>
            {missingMedia.length > 0 && <Col span={24}><Alert type="warning" showIcon style={{ marginBottom: 16 }}
              message={`缺少 ${missingMedia.length} 个媒体文件，共 ${(missingMedia.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(1)} MB`}
              description="请返回课程列表，在本单元的「导入课时」入口导入对应媒体包。系统会自动恢复引用，无需修改正文。" /></Col>}
            <Col span={6}>
              <div className="left-sidebar">
                {/* 课时基本信息卡片 */}
                <Card
                  title={<span style={{ fontWeight: 'bold' }}>课时基本信息</span>}
                  className="info-card"
                  style={{ marginBottom: 24 }}
                >
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                  >
                    <Form.Item
                      name="title"
                      label="课时标题"
                      rules={[{ required: true, message: '请输入课时标题' }]}
                    >
                      <Input placeholder="请输入课时标题" />
                    </Form.Item>

                    <Form.Item
                      name="description"
                      label="课时描述"
                    >
                      <TextArea rows={4} placeholder="请输入课时描述" />
                    </Form.Item>

                    <Form.Item
                      name="objectives"
                      label="学习目标"
                    >
                      <Select
                        mode="tags"
                        placeholder="请输入学习目标（回车添加）"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>

                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={loading} block>
                        保存课时信息
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>

                {/* 活动列表卡片 */}
                <Card
                  title={<span style={{ fontWeight: 'bold' }}>活动列表</span>}
                  className="activities-card"
                  extra={
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={handleAddActivity}
                    >
                      添加活动
                    </Button>
                  }
                >
                  <div className="activities-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {activities.length > 0 ? (
                      <Menu
                        mode="vertical"
                        selectedKeys={[selectedActivityIndex.toString()]}
                        style={{ border: 'none' }}
                      >
                        {activities.map((activity, index) => (
                          <Menu.Item
                            key={index.toString()}
                            onClick={() => handleActivitySelect(index)}
                            style={{
                              margin: '4px 0',
                              padding: '0',
                              borderRadius: '4px',
                              background: selectedActivityIndex === index ? '#e6f7ff' : 'transparent',
                              height: 'auto',
                              lineHeight: 'normal'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                              padding: '8px 16px',
                              minHeight: '40px'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexGrow: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                <Tag color={
                                  activity.type === 'reading' ? 'blue' :
                                    activity.type === 'quiz' ? 'green' :
                                      activity.type === 'discussion' ? 'orange' :
                                        activity.type === 'practice' ? 'purple' :
                                          activity.type === 'typing' ? 'cyan' :
                                            activity.type === 'flowchart' ? 'magenta' :
                                              activity.type === 'spreadsheet' ? 'lime' :
                                                activity.type === 'html' ? 'volcano' :
                                                  activity.type === 'fillblank' ? 'geekblue' :
                                                    activity.type === 'python' ? 'gold' : 'default'
                                }>
                                  {activity.type === 'reading' ? '阅读' :
                                    activity.type === 'quiz' ? '测验' :
                                      activity.type === 'discussion' ? '讨论' :
                                        activity.type === 'practice' ? '练习' :
                                          activity.type === 'typing' ? '打字' :
                                            activity.type === 'flowchart' ? '流程图' :
                                              activity.type === 'spreadsheet' ? '表格' :
                                                activity.type === 'html' ? 'HTML' :
                                                  activity.type === 'fillblank' ? '填空' :
                                                    activity.type === 'python' ? 'Python' : '活动'}
                                </Tag>
                                <span style={{ marginLeft: 8 }}>{activity.title}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<ArrowUpOutlined />}
                                  disabled={index === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveUp(index);
                                  }}
                                />
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<ArrowDownOutlined />}
                                  disabled={index === activities.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveDown(index);
                                  }}
                                />
                              </div>
                            </div>
                          </Menu.Item>
                        ))}
                      </Menu>
                    ) : (
                      <Empty
                        description="暂无活动"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ margin: '30px 0' }}
                      />
                    )}
                  </div>
                </Card>
              </div>
            </Col>

            {/* 右侧：活动详细内容 */}
            <Col span={18}>
              {activities.length > 0 ? (
                <Card
                  className="activity-details-card"
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Tag color={
                        activities[selectedActivityIndex]?.type === 'reading' ? 'blue' :
                          activities[selectedActivityIndex]?.type === 'quiz' ? 'green' :
                            activities[selectedActivityIndex]?.type === 'discussion' ? 'orange' :
                              activities[selectedActivityIndex]?.type === 'practice' ? 'purple' :
                                activities[selectedActivityIndex]?.type === 'typing' ? 'cyan' :
                                  activities[selectedActivityIndex]?.type === 'flowchart' ? 'magenta' :
                                    activities[selectedActivityIndex]?.type === 'spreadsheet' ? 'lime' :
                                      activities[selectedActivityIndex]?.type === 'html' ? 'volcano' :
                                        activities[selectedActivityIndex]?.type === 'fillblank' ? 'geekblue' :
                                          activities[selectedActivityIndex]?.type === 'python' ? 'gold' : 'default'
                      } style={{ marginRight: 8 }}>
                        {activities[selectedActivityIndex]?.type === 'reading' ? '阅读' :
                          activities[selectedActivityIndex]?.type === 'quiz' ? '测验' :
                            activities[selectedActivityIndex]?.type === 'discussion' ? '讨论' :
                              activities[selectedActivityIndex]?.type === 'practice' ? '练习' :
                                activities[selectedActivityIndex]?.type === 'typing' ? '打字' :
                                  activities[selectedActivityIndex]?.type === 'flowchart' ? '流程图' :
                                    activities[selectedActivityIndex]?.type === 'spreadsheet' ? '表格' :
                                      activities[selectedActivityIndex]?.type === 'html' ? 'HTML' :
                                        activities[selectedActivityIndex]?.type === 'fillblank' ? '填空' :
                                          activities[selectedActivityIndex]?.type === 'python' ? 'Python' : '活动'}
                      </Tag>
                      <span style={{ fontWeight: 'bold' }}>{activities[selectedActivityIndex]?.title || '活动详情'}</span>
                    </div>
                  }
                  extra={
                    <Space>
                      <Upload
                        customRequest={async ({ file }) => await handleUpload(file, selectedActivityIndex)}
                        showUploadList={false}
                      >
                        <Button icon={<UploadOutlined />}>上传资源</Button>
                      </Upload>
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => handleActivitySubmit()}
                      >
                        保存活动
                      </Button>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteActivity(selectedActivityIndex)}
                      >
                        删除活动
                      </Button>
                    </Space>
                  }
                >
                  <Tabs activeKey={selectedTab} style={{ marginTop: 8 }} onChange={handleTabChange}>
                    <TabPane tab="活动内容" key="content">
                      <Form
                        form={activityForm}
                        layout="vertical"
                        initialValues={{
                          type: 'reading',
                          requireSubmission: false,
                          allowedFormats: [],
                          typingSettings: {
                            targetSpeed: 60,
                            targetAccuracy: 95,
                            timeLimit: 5,
                            allowOnce: false
                          },
                          quizSettings: {
                            quiz: undefined
                          }
                        }}
                      >
                        <Row gutter={16}>
                          <Col span={16}>
                            <Form.Item
                              name="title"
                              label="活动标题"
                              rules={[{ required: true, message: '请输入活动标题' }]}
                            >
                              <Input placeholder="请输入活动标题" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name="type"
                              label="活动类型"
                              rules={[{ required: true, message: '请选择活动类型' }]}
                            >
                              <Select
                                placeholder="请选择活动类型"
                                onChange={(value) => {
                                  // 当类型为练习或HTML网页时，自动勾选需要学生提交
                                  if (value === 'practice' || value === 'html') {
                                    activityForm.setFieldsValue({ requireSubmission: true });
                                  }
                                }}
                                optionLabelProp="label"
                              >
                                {/* 常用活动类型：阅读、打字、练习、Python编程 */}
                                <Select.Option value="reading" label="阅读">
                                  <Tooltip title="学生阅读教师提供的文本内容，支持Markdown格式，可嵌入图片、视频等多媒体资源。适合理论知识学习和预习材料。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="blue">阅读</Tag>
                                      <span>文本阅读材料</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="typing" label="打字练习">
                                  <Tooltip title="学生进行打字速度和准确率训练，可设置目标速度、准确率和时间限制。系统自动统计打字成绩，适合信息技术课程的打字基础训练。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="cyan">打字练习</Tag>
                                      <span>打字速度训练</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="practice" label="练习">
                                  <Tooltip title="学生根据要求完成实践任务并提交作业文件（如Word、PPT、Excel等）。教师可设置允许的文件格式，适合需要学生动手操作的作业。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="purple">练习</Tag>
                                      <span>实践练习任务</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="python" label="Python编程">
                                  <Tooltip title="学生在在线编程环境中编写Python代码，支持代码运行和测试用例验证。教师可设置初始代码模板和测试用例，系统自动评分。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="gold">Python编程</Tag>
                                      <span>Python代码编写</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>

                                {/* 其他活动类型 */}
                                <Select.Option value="quiz" label="测验">
                                  <Tooltip title="在线选择题测验，支持单选题和多选题。可设置时间限制、随机题目顺序、是否显示答案等。系统自动批改计分。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="green">测验</Tag>
                                      <span>选择题测验</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="fillblank" label="填空">
                                  <Tooltip title="学生根据题目要求填写答案，支持多个填空位置和标准答案设置。系统可自动批改，也可教师手动评分。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="geekblue">填空</Tag>
                                      <span>填空问答</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="flowchart" label="流程图">
                                  <Tooltip title="学生使用在线流程图工具绘制逻辑流程图，适合算法设计、程序流程分析等。教师可设置参考答案进行对比评分。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="magenta">流程图</Tag>
                                      <span>逻辑流程设计</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="spreadsheet" label="在线表格">
                                  <Tooltip title="学生使用在线表格编辑器完成Excel相关任务，支持公式、格式设置等功能。适合电子表格操作练习和数据处理。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="green">在线表格</Tag>
                                      <span>Excel表格编辑</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="html" label="HTML网页">
                                  <Tooltip title="学生在在线代码编辑器中编写HTML/CSS/JavaScript代码，实时预览网页效果。适合Web前端开发入门和网页设计学习。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="volcano">HTML网页</Tag>
                                      <span>网页代码编写</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                                <Select.Option value="discussion" label="讨论">
                                  <Tooltip title="创建讨论话题，学生可以发表观点和互相回复。适合课堂互动、思考题讨论和课后交流。" placement="right">
                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                      <Tag color="orange">讨论</Tag>
                                      <span>互动讨论话题</span>
                                    </div>
                                  </Tooltip>
                                </Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) =>
                            prevValues.type !== currentValues.type
                          }
                        >
                          {({ getFieldValue }) => {
                            const activityType = getFieldValue('type');
                            if (activityType === 'typing') {
                              return (
                                <Card
                                  title="打字练习设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                >
                                  <Form.Item
                                    name={['typingSettings', 'text']}
                                    label="练习文本"
                                    rules={[{ required: true, message: '请选择练习文本' }]}
                                  >
                                    <Select
                                      placeholder="请选择练习文本"
                                      showSearch
                                      optionFilterProp="children"
                                    >
                                      {typingTexts.map(text => (
                                        <Select.Option key={text._id} value={text._id}>
                                          {text.content.substring(0, 30)}...
                                        </Select.Option>
                                      ))}
                                    </Select>
                                  </Form.Item>

                                  <Row gutter={16}>
                                    <Col span={8}>
                                      <Form.Item
                                        name={['typingSettings', 'targetSpeed']}
                                        label="目标速度(字/分钟)"
                                        rules={[{ required: true, message: '请设置目标速度' }]}
                                      >
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                      <Form.Item
                                        name={['typingSettings', 'targetAccuracy']}
                                        label="目标准确率(%)"
                                        rules={[{ required: true, message: '请设置目标准确率' }]}
                                      >
                                        <InputNumber min={1} max={100} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                      <Form.Item
                                        name={['typingSettings', 'timeLimit']}
                                        label="时间限制(分钟)"
                                        rules={[{ required: true, message: '请设置时间限制' }]}
                                      >
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                      <Form.Item
                                        name={['typingSettings', 'allowOnce']}
                                        valuePropName="checked"
                                        label=""
                                      >
                                        <Checkbox>只允许完成一次（完成后不可再次练习）</Checkbox>
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Card>
                              );
                            } else if (activityType === 'quiz') {
                              return (
                                <Card
                                  title="测验设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                  loading={loadingQuizDetails}
                                >
                                  <Form.Item
                                    name={['quizSettings', 'quiz']}
                                    label="选择测验"
                                    rules={[{ required: true, message: '请选择测验' }]}
                                  >
                                    <Select
                                      placeholder="请选择测验"
                                      showSearch
                                      optionFilterProp="children"
                                      onChange={handleQuizChange}
                                    >
                                      {quizzes.map(quiz => (
                                        <Select.Option key={quiz._id} value={quiz._id}>
                                          {quiz.title}
                                        </Select.Option>
                                      ))}
                                    </Select>
                                  </Form.Item>

                                  {/* 选择测验后显示更多设置 */}
                                  {quizDetails && (
                                    <>
                                      <Divider orientation="left">测验配置</Divider>



                                      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                          <Tag color={
                                            quizDetails.status === 'DRAFT' ? 'default' :
                                              quizDetails.status === 'PUBLISHED' ? 'green' :
                                                quizDetails.status === 'IN_PROGRESS' ? 'blue' :
                                                  quizDetails.status === 'ENDED' ? 'red' : 'default'
                                          }>
                                            {
                                              quizDetails.status === 'DRAFT' ? '草稿' :
                                                quizDetails.status === 'PUBLISHED' ? '已发布' :
                                                  quizDetails.status === 'IN_PROGRESS' ? '进行中' :
                                                    quizDetails.status === 'ENDED' ? '已结束' : quizDetails.status
                                            }
                                          </Tag>
                                          {quizDetails.questions?.length > 0 ? (
                                            <Tag color="blue" style={{ marginLeft: '8px' }}>
                                              题目数量: {quizDetails.questions.length}
                                            </Tag>
                                          ) : (
                                            <Tag color="red" style={{ marginLeft: '8px' }}>
                                              未添加题目
                                            </Tag>
                                          )}
                                        </div>
                                        {quizDetails.status === 'DRAFT' && quizDetails.questions?.length > 0 && (
                                          <Button
                                            type="primary"
                                            size="small"
                                            onClick={() => {
                                              Modal.confirm({
                                                title: '确认发布测验',
                                                content: '发布后测验将对学生可见，确定要发布吗？',
                                                onOk: () => handlePublishQuiz(quizDetails._id)
                                              });
                                            }}
                                          >
                                            发布测验
                                          </Button>
                                        )}
                                        {quizDetails.status === 'PUBLISHED' && (
                                          <Button
                                            danger
                                            size="small"
                                            onClick={() => {
                                              Modal.confirm({
                                                title: '确认撤回测验',
                                                content: '撤回后测验将变为草稿状态，不再对学生可见，确定要撤回吗？',
                                                onOk: () => handlePublishQuiz(quizDetails._id)
                                              });
                                            }}
                                          >
                                            撤回测验
                                          </Button>
                                        )}
                                      </div>

                                      <Row gutter={16}>
                                        <Col span={12}>
                                          <Form.Item
                                            name={['quizSettings', 'timeLimit']}
                                            label="时间限制(分钟)"
                                            extra="0表示无时间限制"
                                          >
                                            <InputNumber min={0} style={{ width: '100%' }} />
                                          </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                          <Form.Item
                                            label="允许多次尝试"
                                            style={{ marginBottom: 0 }}
                                          >
                                            <Space>
                                              <Form.Item
                                                name={['quizSettings', 'allowMultipleAttempts']}
                                                valuePropName="checked"
                                                style={{ marginBottom: 0 }}
                                              >
                                                <Switch />
                                              </Form.Item>
                                              <Form.Item
                                                noStyle
                                                shouldUpdate={(prevValues, currentValues) => {
                                                  return prevValues.quizSettings?.allowMultipleAttempts !==
                                                    currentValues.quizSettings?.allowMultipleAttempts;
                                                }}
                                              >
                                                {({ getFieldValue }) => {
                                                  const allowMultiple = getFieldValue(['quizSettings', 'allowMultipleAttempts']);
                                                  return allowMultiple ? (
                                                    <Form.Item
                                                      name={['quizSettings', 'maxAttempts']}
                                                      style={{ marginBottom: 0 }}
                                                    >
                                                      <InputNumber
                                                        min={1}
                                                        placeholder="最大次数"
                                                        style={{ width: '100px' }}
                                                      />
                                                    </Form.Item>
                                                  ) : null;
                                                }}
                                              </Form.Item>
                                            </Space>
                                          </Form.Item>
                                        </Col>
                                      </Row>

                                      <Row gutter={16}>
                                        <Col span={12}>
                                          <Form.Item
                                            name={['quizSettings', 'randomizeQuestions']}
                                            label="随机题目顺序"
                                            valuePropName="checked"
                                          >
                                            <Switch />
                                          </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                          <Form.Item
                                            name={['quizSettings', 'randomizeOptions']}
                                            label="随机选项顺序"
                                            valuePropName="checked"
                                          >
                                            <Switch />
                                          </Form.Item>
                                        </Col>
                                      </Row>

                                      <Row gutter={16}>
                                        <Col span={12}>
                                          <Form.Item
                                            name={['quizSettings', 'showAnswerAfterSubmit']}
                                            label="提交后显示答案"
                                            valuePropName="checked"
                                          >
                                            <Switch />
                                          </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                          <Form.Item
                                            name={['quizSettings', 'showScoreAfterSubmit']}
                                            label="提交后显示分数"
                                            valuePropName="checked"
                                          >
                                            <Switch />
                                          </Form.Item>
                                        </Col>
                                      </Row>


                                    </>
                                  )}
                                </Card>
                              );
                            } else if (activityType === 'flowchart') {
                              return (
                                <Card
                                  title="流程图设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                >
                                  <Form.Item
                                    name={['flowchartSettings', 'instructions']}
                                    label="绘制说明"
                                    extra="向学生说明流程图的绘制要求"
                                  >
                                    <MarkdownEditor
                                      placeholder="请输入流程图绘制说明，支持Markdown格式"
                                      height={300}
                                    />
                                  </Form.Item>

                                  <Form.Item
                                    name={['flowchartSettings', 'allowedNodeTypes']}
                                    label="允许的节点类型"
                                    extra="不选择则允许所有类型"
                                  >
                                    <Select
                                      mode="multiple"
                                      placeholder="选择允许使用的节点类型（可多选）"
                                      allowClear
                                    >
                                      <Select.Option value="start">开始</Select.Option>
                                      <Select.Option value="end">结束</Select.Option>
                                      <Select.Option value="process">处理</Select.Option>
                                      <Select.Option value="decision">判断</Select.Option>
                                      <Select.Option value="data">数据</Select.Option>
                                      <Select.Option value="connector">连接器</Select.Option>
                                    </Select>
                                  </Form.Item>

                                  <Alert
                                    type="info"
                                    message="流程图活动说明"
                                    description={
                                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                        <li>学生将在学习页面看到流程图编辑器</li>
                                        <li>学生可以拖拽节点、连接节点来绘制流程图</li>
                                        <li>提交后教师可以在课堂管理中查看和评分</li>
                                      </ul>
                                    }
                                    style={{ marginTop: 16 }}
                                  />
                                </Card>
                              );
                            } else if (activityType === 'spreadsheet') {
                              return (
                                <Card
                                  title="在线表格设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                >
                                  <Form.Item
                                    name={['spreadsheetSettings', 'instructions']}
                                    label="活动说明"
                                    extra="向学生说明表格处理的要求"
                                  >
                                    <MarkdownEditor
                                      placeholder="请输入活动说明，支持Markdown格式"
                                    />
                                  </Form.Item>

                                  <Row gutter={16}>
                                    <Col span={12}>
                                      <Form.Item
                                        name={['spreadsheetSettings', 'spreadsheetId']}
                                        label="模板表格 (可选)"
                                        extra="如果选择了模板，学生将基于该模板开始"
                                      >
                                        <Select
                                          placeholder="请选择模板表格"
                                          allowClear
                                          showSearch
                                          optionFilterProp="children"
                                        >
                                          {spreadsheets.map(ss => (
                                            <Select.Option key={ss._id} value={ss._id}>
                                              {ss.name}
                                            </Select.Option>
                                          ))}
                                        </Select>
                                      </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                      <Form.Item
                                        name={['spreadsheetSettings', 'timeLimit']}
                                        label="时间限制(分钟)"
                                        extra="0表示无时间限制"
                                      >
                                        <InputNumber min={0} style={{ width: '100%' }} />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Card>
                              );
                            } else if (activityType === 'fillblank') {
                              return (
                                <Card
                                  title="填空设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                >
                                  <Form.Item
                                    name={['fillBlankSettings', 'instructions']}
                                    label="活动说明"
                                    extra="向学生说明填空的要求"
                                  >
                                    <MarkdownEditor
                                      placeholder="请输入活动说明，支持Markdown格式"
                                      height={150}
                                    />
                                  </Form.Item>

                                  <Form.Item
                                    name={['fillBlankSettings', 'content']}
                                    label="填空内容"
                                    rules={[{ required: true, message: '请输入填空内容' }]}
                                    extra={
                                      <div style={{ marginTop: 8 }}>
                                        <strong>使用方法：</strong> 在需要挖空的位置使用 <code>{'{{blank:正确答案}}'}</code> 标记。<br />
                                        <strong>示例：</strong> <code>{'HTTP协议的默认端口号是{{blank:80}}，HTTPS协议的默认端口号是{{blank:443}}。'}</code>
                                      </div>
                                    }
                                  >
                                    <MarkdownEditor
                                      placeholder="请输入带有填空标记的内容..."
                                      height={400}
                                    />
                                  </Form.Item>

                                  <Form.Item
                                    name={['fillBlankSettings', 'showCorrectAfterSubmit']}
                                    label="提交后显示正确答案"
                                    valuePropName="checked"
                                    initialValue={true}
                                  >
                                    <Switch />
                                  </Form.Item>

                                  <Alert
                                    type="info"
                                    message="填空活动说明"
                                    description={
                                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                        <li>学生将看到带有输入框的文本，需要填写空白处</li>
                                        <li>提交后系统将自动对比答案并计算得分</li>
                                        <li>支持文本填空和Markdown表格填空</li>
                                      </ul>
                                    }
                                    style={{ marginTop: 16 }}
                                  />
                                </Card>
                              );
                            } else if (activityType === 'python') {
                              return (
                                <Card
                                  title="Python编程设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                >
                                  <Form.Item
                                    name={['pythonSettings', 'instructions']}
                                    label="活动说明"
                                    extra="向学生说明编程任务的要求"
                                  >
                                    <MarkdownEditor
                                      placeholder="请输入活动说明，支持Markdown格式"
                                      height={200}
                                    />
                                  </Form.Item>

                                  <Form.Item
                                    name={['pythonSettings', 'starterCode']}
                                    label="初始代码"
                                    extra="学生开始编程时看到的代码模板"
                                  >
                                    <Input.TextArea
                                      rows={8}
                                      placeholder="# 在这里编写你的Python代码"
                                      style={{ fontFamily: 'Consolas, Monaco, monospace' }}
                                    />
                                  </Form.Item>

                                  <Divider orientation="left">测试用例（OJ自动评测）</Divider>

                                  <Form.List name={['pythonSettings', 'testCases']}>
                                    {(fields, { add, remove }) => (
                                      <>
                                        {fields.map(({ key, name, ...restField }, index) => (
                                          <Card
                                            key={key}
                                            size="small"
                                            title={`测试点 ${index + 1}`}
                                            style={{ marginBottom: 12 }}
                                            extra={
                                              <Button
                                                type="text"
                                                danger
                                                icon={<MinusCircleOutlined />}
                                                onClick={() => remove(name)}
                                              >
                                                删除
                                              </Button>
                                            }
                                          >
                                            <Row gutter={16}>
                                              <Col span={12}>
                                                <Form.Item
                                                  {...restField}
                                                  name={[name, 'input']}
                                                  label="输入数据"
                                                  extra="每行一个输入，模拟input()的返回值"
                                                >
                                                  <Input.TextArea
                                                    rows={3}
                                                    placeholder="例如：\n5\n10"
                                                    style={{ fontFamily: 'Consolas, Monaco, monospace' }}
                                                  />
                                                </Form.Item>
                                              </Col>
                                              <Col span={12}>
                                                <Form.Item
                                                  {...restField}
                                                  name={[name, 'expectedOutput']}
                                                  label="预期输出"
                                                  rules={[{ required: true, message: '请输入预期输出' }]}
                                                >
                                                  <Input.TextArea
                                                    rows={3}
                                                    placeholder="程序应输出的结果"
                                                    style={{ fontFamily: 'Consolas, Monaco, monospace' }}
                                                  />
                                                </Form.Item>
                                              </Col>
                                            </Row>
                                            <Form.Item
                                              {...restField}
                                              name={[name, 'isHidden']}
                                              valuePropName="checked"
                                              style={{ marginBottom: 0 }}
                                            >
                                              <Checkbox>隐藏测试点（学生看不到具体输入输出）</Checkbox>
                                            </Form.Item>
                                          </Card>
                                        ))}
                                        <Button
                                          type="dashed"
                                          onClick={() => add({ input: '', expectedOutput: '', isHidden: false })}
                                          block
                                          icon={<PlusOutlined />}
                                        >
                                          添加测试点
                                        </Button>
                                      </>
                                    )}
                                  </Form.List>

                                  <Alert
                                    type="info"
                                    message="Python编程活动说明"
                                    description={
                                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                        <li>学生将在浏览器中直接编写和运行Python代码</li>
                                        <li>支持Python基础语法和常用库（无需安装Python环境）</li>
                                        <li>开启turtle图形后，学生可以使用turtle库绘制图形</li>
                                        <li>错误消息将以中文显示，便于学生理解</li>
                                        <li><strong>添加测试用例后，学生可点击"测评"按钮自动评测代码</strong></li>
                                      </ul>
                                    }
                                    style={{ marginTop: 16 }}
                                  />
                                </Card>
                              );
                            } else {
                              return (
                                <Form.Item
                                  name="content"
                                  label="活动内容"
                                >
                                  <MarkdownEditor placeholder="请输入活动内容..." height="600px" />
                                </Form.Item>
                              );
                            }
                          }}
                        </Form.Item>

                        {/* 练习类型 - 自动需要提交文件 */}
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) =>
                            prevValues.type !== currentValues.type
                          }
                        >
                          {({ getFieldValue }) => {
                            const activityType = getFieldValue('type');
                            // 只有练习类型才显示文件提交设置
                            if (activityType === 'practice') {
                              return (
                                <Card
                                  title="文件提交设置"
                                  style={{ marginBottom: 24 }}
                                  type="inner"
                                >
                                  <Form.Item
                                    name="allowedFormats"
                                    label="允许的文件格式"
                                    rules={[
                                      { required: true, message: '请选择允许的文件格式' },
                                      {
                                        validator: (_, value) => {
                                          if (!value || value.length <= 1) return Promise.resolve();
                                          
                                          const hasPpt = value.some(v => v.includes('PPT'));
                                          const hasExcel = value.some(v => v.includes('XLS'));
                                          const hasWord = value.some(v => v.includes('DOC'));
                                          const hasPython = value.some(v => v === 'PY');
                                          
                                          const typesCount = [hasPpt, hasExcel, hasWord, hasPython].filter(Boolean).length;
                                          if (typesCount > 1) {
                                            return Promise.reject(new Error('批阅系统限制：不能同时选择多种需专门解析的格式（如 PPT 和 Excel 不能混选）'));
                                          }
                                          return Promise.resolve();
                                        }
                                      }
                                    ]}
                                  >
                                    <Select mode="multiple" placeholder="请选择允许的文件格式">
                                      <Select.Option value="DOC">DOC</Select.Option>
                                      <Select.Option value="DOCX">DOCX</Select.Option>
                                      <Select.Option value="PDF">PDF</Select.Option>
                                      <Select.Option value="PPT">PPT</Select.Option>
                                      <Select.Option value="PPTX">PPTX</Select.Option>
                                      <Select.Option value="XLS">XLS</Select.Option>
                                      <Select.Option value="XLSX">XLSX</Select.Option>
                                      <Select.Option value="ZIP">ZIP</Select.Option>
                                      <Select.Option value="RAR">RAR</Select.Option>
                                      <Select.Option value="PY">PY</Select.Option>
                                      <Select.Option value="TXT">TXT</Select.Option>
                                      <Select.Option value="C">C</Select.Option>
                                      <Select.Option value="CPP">CPP</Select.Option>
                                    </Select>
                                  </Form.Item>

                                  <Form.Item
                                    noStyle
                                    shouldUpdate={(prevValues, currentValues) => {
                                      const prevFormats = prevValues.allowedFormats || [];
                                      const currentFormats = currentValues.allowedFormats || [];
                                      return prevFormats.includes('PY') !== currentFormats.includes('PY');
                                    }}
                                  >
                                    {({ getFieldValue }) => {
                                      const allowedFormats = getFieldValue('allowedFormats') || [];
                                      return allowedFormats.includes('PY') ? (
                                        <Row gutter={16}>
                                          <Col span={12}>
                                            <Form.Item
                                              name="description"
                                              label="AI提示词"
                                              extra="为AI提供的指导信息，用于评估学生的代码"
                                            >
                                              <Input.TextArea
                                                rows={4}
                                                placeholder="请输入AI提示词（可描述评分标准、关键点等）"
                                              />
                                            </Form.Item>
                                          </Col>
                                          <Col span={12}>
                                            <Form.Item
                                              name="referenceAnswer"
                                              label="参考答案"
                                              extra="用于Python编程题的参考答案代码"
                                            >
                                              <Input.TextArea
                                                rows={4}
                                                placeholder="请输入Python代码参考答案（选填）"
                                              />
                                            </Form.Item>
                                          </Col>
                                        </Row>
                                      ) : null;
                                    }}
                                  </Form.Item>
                                </Card>
                              );
                            }
                            return null;
                          }}
                        </Form.Item>
                                              <Form.Item
                                                noStyle
                                                shouldUpdate={(prevValues, currentValues) =>
                                                  prevValues.type !== currentValues.type ||
                                                  prevValues.allowedFormats !== currentValues.allowedFormats
                                                }
                                              >
                                                {({ getFieldValue }) => {
                                                  const activityType = getFieldValue('type');
                                                  const allowedFormats = getFieldValue('allowedFormats') || [];
                                                  const isPptPractice = activityType === 'practice' && allowedFormats.some(format => ['PPT', 'PPTX'].includes(format));
                                                  if (activityType === 'practice' && allowedFormats.some(format => ['XLS', 'XLSX'].includes(format))) return <ExcelGradingSettings lessonId={lessonId} activity={activities[selectedActivityIndex]} onChange={settings => setActivities(previous => previous.map((a,i) => i === selectedActivityIndex ? { ...a, excelGradingSettings: settings } : a))} />;
                                                  if (!isPptPractice) return null;

                                                  const pptSettings = activities[selectedActivityIndex]?.pptGradingSettings || {};
                                                  const pptRules = pptSettings.rules || [];
                                                  const pptRuleGroups = groupPptRules(pptRules);
                                                  return <OfficeGradingSettings
                                                    settings={pptSettings} groups={pptRuleGroups} accept=".pptx" busy={regeneratingPptRules}
                                                    onUpload={handlePptGradingUpload} onDownload={handleDownloadPptGradingFile}
                                                    onEnabledChange={enabled => updateCurrentPptSettings({ ...pptSettings, enabled })}
                                                    onRegenerate={handleRegeneratePptRules} onSave={handleSavePptGradingSettings}
                                                    onRuleChange={handlePptRuleChange} onGroupChange={togglePptRuleGroup}
                                                    onTypeChange={togglePptRuleTypeInGroup} getTypeLabel={getPptRuleTypeLabel}
                                                  />;
                                                }}
                          </Form.Item>
                        <Card
                          title="活动资源"
                          style={{ marginBottom: 24 }}
                          type="inner"
                          extra={
                            <Upload
                              customRequest={async ({ file }) => await handleUpload(file, selectedActivityIndex)}
                              showUploadList={false}
                            >
                              <Button icon={<UploadOutlined />}>上传资源</Button>
                            </Upload>
                          }
                        >
                          {activities[selectedActivityIndex]?.resources?.length > 0 ? (
                            <Table
                              dataSource={activities[selectedActivityIndex].resources.map(r => ({ ...r, key: r._id || r.path }))}
                              columns={[
                                {
                                  title: '文件名',
                                  dataIndex: 'filename',
                                  key: 'filename',
                                  ellipsis: true,
                                },
                                {
                                  title: '类型',
                                  dataIndex: 'type',
                                  key: 'type',
                                  width: 100,
                                },
                                {
                                  title: '大小',
                                  dataIndex: 'size',
                                  key: 'size',
                                  width: 100,
                                  render: (size) => formatFileSize(size)
                                },
                                {
                                  title: '上传时间',
                                  dataIndex: 'uploadTime',
                                  key: 'uploadTime',
                                  width: 180,
                                  render: (time) => new Date(time).toLocaleString()
                                },
                                {
                                  title: '操作',
                                  key: 'action',
                                  width: 200,
                                  render: (_, record) => (
                                    <Space size="small">
                                      <Button
                                        type="link"
                                        size="small"
                                        onClick={() => handleDownloadResource(record)}
                                        icon={<DownloadOutlined />}
                                      >
                                        下载
                                      </Button>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        onClick={() => handleDeleteResource(record)}
                                        icon={<DeleteOutlined />}
                                      >
                                        删除
                                      </Button>
                                    </Space>
                                  )
                                }
                              ]}
                              pagination={false}
                              size="small"
                            />
                          ) : (
                            <Empty
                              description="暂无活动资源"
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              style={{ margin: '16px 0' }}
                            >
                              <Upload
                                customRequest={async ({ file }) => await handleUpload(file, selectedActivityIndex)}
                                showUploadList={false}
                              >
                                <Button icon={<UploadOutlined />}>上传资源</Button>
                              </Upload>
                            </Empty>
                          )}
                        </Card>
                      </Form>
                    </TabPane>
                    <TabPane tab="公开媒体" key="public-media">
                      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                        <Space>
                          <Upload
                            customRequest={() => { }}
                            beforeUpload={handleImageBeforeUpload}
                            showUploadList={false}
                            accept="image/*"
                          >
                            <Button
                              type="primary"
                              icon={<UploadOutlined />}
                            >
                              上传图片
                            </Button>
                          </Upload>
                          <Upload
                            customRequest={async ({ file }) => {
                              // 直接走媒体上传接口
                              const formData = new FormData();
                              formData.append('media', file);
                              try {
                                setLoadingMedias(true);
                                const resp = await mediaAPI.uploadMedia(courseId, unitId, lessonId, formData);
                                if (resp.success) {
                                  message.success('视频上传成功');
                                  loadPublicMedias();
                                } else {
                                  message.error('视频上传失败');
                                }
                              } catch (err) {
                                console.error('视频上传失败:', err);
                                message.error('视频上传失败: ' + (err.response?.data?.message || err.message));
                              } finally {
                                setLoadingMedias(false);
                              }
                            }}
                            showUploadList={false}
                            accept="video/*"
                          >
                            <Button
                              type="default"
                              icon={<UploadOutlined />}
                            >
                              上传视频
                            </Button>
                          </Upload>
                          <Button
                            onClick={loadPublicMedias}
                            icon={<FileImageOutlined />}
                          >
                            刷新媒体列表
                          </Button>
                        </Space>
                        <Typography.Text type="secondary">
                          公开媒体可以在所有活动中通过Markdown引用
                        </Typography.Text>
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
                                  onConfirm={() => handleDeletePublicMedia(record)}
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
                        <Empty description="暂无公开媒体文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </TabPane>

                  </Tabs>
                </Card>
              ) : (
                <Card>
                  <Empty
                    description="请先添加活动"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ margin: '100px 0' }}
                  >
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAddActivity}
                    >
                      添加第一个活动
                    </Button>
                  </Empty>
                </Card>
              )}
            </Col>
          </Row>
        </Card>
      </Content>

      {/* 图片尺寸调整对话框 */}
      <Modal
        title="调整图片尺寸"
        open={imageResizeModalVisible}
        onOk={handleResizedImageUpload}
        onCancel={() => setImageResizeModalVisible(false)}
        okText="上传"
        cancelText="取消"
        width={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {previewImage && (
            <div style={{ marginBottom: 16, border: '1px solid #d9d9d9', padding: 8, borderRadius: 4 }}>
              <img
                src={previewImage}
                alt="预览"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  width: `${imageWidth}px`,
                  height: `${imageHeight}px`
                }}
              />
            </div>
          )}

          <div style={{ width: '100%', marginBottom: 16 }}>
            <Form layout="vertical">
              <Form.Item label="调整比例">
                <Slider
                  min={10}
                  max={200}
                  value={imageScale}
                  onChange={handleScaleChange}
                  tipFormatter={value => `${value}%`}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="宽度(像素)">
                    <InputNumber
                      min={10}
                      max={5000}
                      value={imageWidth}
                      onChange={handleWidthChange}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="高度(像素)">
                    <InputNumber
                      min={10}
                      max={5000}
                      value={imageHeight}
                      onChange={handleHeightChange}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary">
                  原始尺寸: {originalImageSize.width} x {originalImageSize.height} 像素
                </Typography.Text>
              </div>
            </Form>
          </div>
        </div>

        {/* 隐藏的canvas用于绘制和导出调整后的图片 */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </Modal>
    </Layout>
  );
};

export default LessonEdit;
