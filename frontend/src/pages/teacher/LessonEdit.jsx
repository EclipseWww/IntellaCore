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
  Modal,
  Select,
  Row,
  Col,
  Tag,
  Empty,
  Upload,
  Tabs,
  Alert,
  Tooltip
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import ExcelGradingSettings from './components/ExcelGradingSettings';
import OfficeGradingSettings from './components/OfficeGradingSettings';
import { courseManagementAPI, API_BASE_URL, typingAPI, quizAPI, lessonAPI, mediaAPI } from '../../services/api';
import { ACTIVITY_TYPES, getActivityTypeColor, getActivityTypeShortLabel } from '../../utils/activityTypes';
import LessonSidebar from './components/lessonEdit/LessonSidebar';
import ActivityTypeSettings from './components/lessonEdit/ActivityTypeSettings';
import PracticeSubmissionSettings from './components/lessonEdit/PracticeSubmissionSettings';
import ActivityResourcesCard from './components/lessonEdit/ActivityResourcesCard';
import PublicMediaPanel from './components/lessonEdit/PublicMediaPanel';
import ImageResizeModal from './components/lessonEdit/ImageResizeModal';

const { Content } = Layout;
const { Title } = Typography;
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
  // 课时内容版本：多位老师共同维护课程时，保存时带上，避免覆盖别人刚保存的修改
  const lessonVersionRef = useRef(undefined);

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
        lessonVersionRef.current = lessonData.contentVersion;
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

  // 保存课时（所有修改课时内容的地方都通过这里）
  const saveLesson = async (data) => {
    try {
      const saved = await courseManagementAPI.updateLesson(courseId, unitId, lessonId, {
        ...data,
        contentVersion: lessonVersionRef.current
      });
      if (saved && saved.contentVersion !== undefined) lessonVersionRef.current = saved.contentVersion;
      return saved;
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.code === 'LESSON_CHANGED') {
        error.lessonConflict = true;
        Modal.confirm({
          title: '这个课时刚被其他老师修改过',
          content: `${error.response.data.message}。刷新后会载入最新内容，你这次没有保存成功的修改需要重新操作。`,
          okText: '刷新',
          cancelText: '暂不刷新',
          onOk: () => fetchLessonDetails()
        });
      }
      throw error;
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const lessonData = {
        ...values,
        activities
      };

      await saveLesson(lessonData);
      message.success('课时更新成功');
    } catch (error) {
      if (error.lessonConflict) return;
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
    saveLesson({
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
      if (error.lessonConflict) return;
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
          await saveLesson({
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
          if (error.lessonConflict) return;
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
            maxAttempts: values.pythonSettings?.maxAttempts || 0,
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
        await saveLesson({
          ...lesson,
          activities: newActivities
        });

        await fetchLessonDetails();
        message.success('活动保存成功');
      } catch (error) {
        if (error.lessonConflict) return;
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
      await saveLesson({
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
      if (error.lessonConflict) return;
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
      await saveLesson({
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
      if (error.lessonConflict) return;
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
                onClick={() => navigate(`/teacher?tab=course&course=${courseId}`)}
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
            <LessonSidebar
              activities={activities}
              form={form}
              handleActivitySelect={handleActivitySelect}
              handleAddActivity={handleAddActivity}
              handleMoveDown={handleMoveDown}
              handleMoveUp={handleMoveUp}
              handleSubmit={handleSubmit}
              loading={loading}
              selectedActivityIndex={selectedActivityIndex}
            />

            {/* 右侧：活动详细内容 */}
            <Col span={18}>
              {activities.length > 0 ? (
                <Card
                  className="activity-details-card"
                  title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Tag color={getActivityTypeColor(activities[selectedActivityIndex]?.type)} style={{ marginRight: 8 }}>
                        {getActivityTypeShortLabel(activities[selectedActivityIndex]?.type)}
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
                                {/* 选项来自 utils/activityTypes.js：常用类型在前 */}
                                {[...ACTIVITY_TYPES.filter(t => t.common), ...ACTIVITY_TYPES.filter(t => !t.common)].map(type => (
                                  <Select.Option key={type.value} value={type.value} label={type.label}>
                                    <Tooltip title={type.description} placement="right">
                                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                        <Tag color={type.color}>{type.label}</Tag>
                                        <span>{type.summary}</span>
                                      </div>
                                    </Tooltip>
                                  </Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>

                        <ActivityTypeSettings
                          handlePublishQuiz={handlePublishQuiz}
                          handleQuizChange={handleQuizChange}
                          loadingQuizDetails={loadingQuizDetails}
                          quizDetails={quizDetails}
                          quizzes={quizzes}
                          spreadsheets={spreadsheets}
                          typingTexts={typingTexts}
                        />

                        {/* 练习类型 - 自动需要提交文件 */}
                        <PracticeSubmissionSettings />
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
                        <ActivityResourcesCard
                          activities={activities}
                          formatFileSize={formatFileSize}
                          handleDeleteResource={handleDeleteResource}
                          handleDownloadResource={handleDownloadResource}
                          handleUpload={handleUpload}
                          selectedActivityIndex={selectedActivityIndex}
                        />
                      </Form>
                    </TabPane>
                    <TabPane tab="公开媒体" key="public-media">
                      <PublicMediaPanel
                        copyMarkdownMediaCode={copyMarkdownMediaCode}
                        copyMediaUrlToClipboard={copyMediaUrlToClipboard}
                        courseId={courseId}
                        formatFileSize={formatFileSize}
                        getMediaPreview={getMediaPreview}
                        handleDeletePublicMedia={handleDeletePublicMedia}
                        handleImageBeforeUpload={handleImageBeforeUpload}
                        lessonId={lessonId}
                        loadPublicMedias={loadPublicMedias}
                        loadingMedias={loadingMedias}
                        publicMedias={publicMedias}
                        setLoadingMedias={setLoadingMedias}
                        unitId={unitId}
                      />
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
      <ImageResizeModal
        canvasRef={canvasRef}
        handleHeightChange={handleHeightChange}
        handleResizedImageUpload={handleResizedImageUpload}
        handleScaleChange={handleScaleChange}
        handleWidthChange={handleWidthChange}
        imageHeight={imageHeight}
        imageResizeModalVisible={imageResizeModalVisible}
        imageScale={imageScale}
        imageWidth={imageWidth}
        originalImageSize={originalImageSize}
        previewImage={previewImage}
        setImageResizeModalVisible={setImageResizeModalVisible}
      />
    </Layout>
  );
};

export default LessonEdit;
