import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Typography,
  Divider,
  Spin,
  Cascader,
  Empty,
  Tag,
  Tooltip,
  Radio,
  Layout,
  Statistic,
  Row,
  Col,
  Switch,
  Checkbox,
  Progress,
  Drawer
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { courseManagementAPI, API_BASE_URL, flowchartAPI, spreadsheetActivityAPI, fillBlankAPI } from '../../services/api';
import htmlProjectAPI from '../../services/htmlProjectAPI';
import { pythonAPI } from '../../services/pythonAPI';
import MxGraphEditor from '../../components/mxgraph/MxGraphEditor';
import SpreadsheetEditor from '../../components/Spreadsheet/SpreadsheetEditor';
import FillBlankReview from './components/review/FillBlankReview';
import FlowchartReview from './components/review/FlowchartReview';
import HtmlReview from './components/review/HtmlReview';
import ExcelReview from './components/review/ExcelReview';
import PptReview from './components/review/PptReview';
import WordReview from './components/review/WordReview';
import PythonReview from './components/review/PythonReview';
import QuizReview from './components/review/QuizReview';
import { LeftOutlined, RightOutlined, CheckCircleOutlined, DownloadOutlined, QuestionCircleOutlined, ThunderboltOutlined, SettingOutlined, SaveOutlined, EditOutlined, UnorderedListOutlined, FileSearchOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';

const { TextArea } = Input;
const { Title } = Typography;
const { Content } = Layout;

// 注册 Python 语言支持
SyntaxHighlighter.registerLanguage('python', python);

// 文件类型映射
const getFileType = (mimeType, fileName) => {
  const mimeMap = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/python': 'py',
    'application/x-python': 'py'
  };

  // 首先尝试从 MIME 类型获取
  if (mimeType && mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }

  // 如果 MIME 类型不匹配，尝试从文件扩展名获取
  const extension = fileName.split('.').pop().toLowerCase();
  const extensionMap = {
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'docx',
    'xls': 'xlsx',
    'xlsx': 'xlsx',
    'ppt': 'ppt',
    'pptx': 'pptx',
    'txt': 'txt',
    'py': 'txt',  // Python 文件作为文本显示
    'js': 'txt',  // JavaScript 文件作为文本显示
    'json': 'txt', // JSON 文件作为文本显示
    'csv': 'csv'
  };

  return extensionMap[extension] || 'txt';  // 默认作为文本文件处理
};

// 添加格式化班级名称的函数
const formatClassName = (grade, name) => {
  if (!grade || !name) return '未分配班级';
  return `${grade}级${name}班`;
};

// 计算各等级学生数量和未评阅作业数量
const calculateStatistics = (submissions) => {
  const stats = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    ungraded: 0
  };

  submissions.forEach(submission => {
    // 检查是否有教师评分或有效的AI评分
    const hasTeacherGrade = submission.status === 'graded' && (submission.grade?.score !== undefined || submission.grade?.bonusScore !== undefined);
    const hasAiGrade = submission.aiGrade && submission.aiGrade.score !== undefined;

    if (!hasTeacherGrade && !hasAiGrade) {
      stats.ungraded++;
    } else {
      // 优先使用教师评分，如果没有则使用AI评分
      let score;
      if (hasTeacherGrade) {
        score = submission.grade?.score !== undefined ? submission.grade.score : submission.grade?.bonusScore;
      } else {
        score = submission.aiGrade?.score;
      }

      if (score >= 9) stats.A++;
      else if (score >= 7) stats.B++;
      else if (score >= 5) stats.C++;
      else if (score >= 3) stats.D++;
      else if (score >= 1) stats.E++;
      else stats.F++;
    }
  });

  return stats;
};

const AssignmentReview = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // 状态管理
  const [courses, setCourses] = useState([]);
  const [options, setOptions] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); // 初始化为 null
  const [filteredInfo, setFilteredInfo] = useState({});
  const [sortedInfo, setSortedInfo] = useState({});
  const [selectedClass, setSelectedClass] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const selectedClassRef = useRef(selectedClass);
  selectedClassRef.current = selectedClass;
  const submissionRequestRef = useRef(0);
  const scrollContainerRef = useRef(null); // 移到组件顶层

  // 新增状态：是否只显示未评分的作业
  const [showingUngraded, setShowingUngraded] = useState(false);

  // 新增状态：当前预览的提交索引
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(-1);

  // 新增状态：记录每个学生的AI评阅加载状态
  const [loadingSubmissions, setLoadingSubmissions] = useState({});
  // 新增状态：记录每个学生的已用时间
  const [submissionTimes, setSubmissionTimes] = useState({});

  // 新增状态：活动详情
  const [activityDetails, setActivityDetails] = useState({
    description: '',
    referenceAnswer: ''
  });

  // 新增状态：活动详情编辑模式
  const [editingActivityDetails, setEditingActivityDetails] = useState(false);

  // 新增状态：活动详情加载状态
  const [loadingActivityDetails, setLoadingActivityDetails] = useState(false);

  // 新增状态：活动详情抽屉可见性
  const [activitySettingsVisible, setActivitySettingsVisible] = useState(false);

  // 新增状态：是否为Python作业
  const [isPythonAssignment, setIsPythonAssignment] = useState(false);

  // 流程图相关状态
  const [isFlowchartActivity, setIsFlowchartActivity] = useState(false);
  const [flowchartSubmissions, setFlowchartSubmissions] = useState([]);
  const [allFlowchartSubmissions, setAllFlowchartSubmissions] = useState([]);
  const [selectedFlowchartSubmission, setSelectedFlowchartSubmission] = useState(null);
  const [flowchartCurrentIndex, setFlowchartCurrentIndex] = useState(-1);
  const [flowchartScore, setFlowchartScore] = useState(null);
  const [flowchartFeedback, setFlowchartFeedback] = useState('');
  const [flowchartGrading, setFlowchartGrading] = useState(false);

  // 在线表格相关状态
  const [isSpreadsheetActivity, setIsSpreadsheetActivity] = useState(false);
  const [spreadsheetSubmissions, setSpreadsheetSubmissions] = useState([]);
  const [selectedSpreadsheetSubmission, setSelectedSpreadsheetSubmission] = useState(null);
  const [spreadsheetCurrentIndex, setSpreadsheetCurrentIndex] = useState(-1);
  const [spreadsheetScore, setSpreadsheetScore] = useState(null);
  const [spreadsheetFeedback, setSpreadsheetFeedback] = useState('');
  const [spreadsheetGrading, setSpreadsheetGrading] = useState(false);

  // 填空活动相关状态
  const [isFillBlankActivity, setIsFillBlankActivity] = useState(false);
  const [fillBlankSubmissions, setFillBlankSubmissions] = useState([]);
  const [fillBlankGrading, setFillBlankGrading] = useState({});

  // HTML网页活动相关状态
  const [isHtmlActivity, setIsHtmlActivity] = useState(false);
  const [htmlProjects, setHtmlProjects] = useState([]);

  // Excel文件作业状态
  const [isExcelActivity, setIsExcelActivity] = useState(false);
  const [excelGradingState, setExcelGradingState] = useState({});

  // PPT文件作业状态
  const [isPptActivity, setIsPptActivity] = useState(false);
  const [pptGradingState, setPptGradingState] = useState({});

  // Word文件作业状态
  const [isWordActivity, setIsWordActivity] = useState(false);
  const [wordGradingState, setWordGradingState] = useState({});

  // Python编程活动状态
  const [isPythonActivity, setIsPythonActivity] = useState(false);
  const [pythonSubmissions, setPythonSubmissions] = useState([]);
  const [pythonGradingState, setPythonGradingState] = useState({});

  // 测验活动状态
  const [isQuizActivity, setIsQuizActivity] = useState(false);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  const [currentActivityId, setCurrentActivityId] = useState(null);

  // 批量AI评阅相关状态
  const [batchAIModalVisible, setBatchAIModalVisible] = useState(false);
  const [batchAIType, setBatchAIType] = useState('ungraded');
  const [batchAIProgress, setBatchAIProgress] = useState(0);
  const [batchAITotal, setBatchAITotal] = useState(0);
  const [batchAIRunning, setBatchAIRunning] = useState(false);
  const [batchAIResults, setBatchAIResults] = useState({
    success: 0,
    failed: 0,
    processing: 0
  });
  // 用于存储每个提交的处理状态
  const [batchProcessStatus, setBatchProcessStatus] = useState({});
  // 批量评阅完成标志
  const [batchAICompleted, setBatchAICompleted] = useState(false);

  // 批量下载相关状态
  const [batchDownloading, setBatchDownloading] = useState(false);

  // 排序相关状态
  const [sortMode, setSortMode] = useState('none');

  // 一键评分相关状态
  const [batchGradeModalVisible, setBatchGradeModalVisible] = useState(false);
  const [batchGradeScore, setBatchGradeScore] = useState('B'); // 默认B等级
  const [batchGrading, setBatchGrading] = useState(false);
  const [batchGradeProgress, setBatchGradeProgress] = useState(0);
  const [batchGradeTotal, setBatchGradeTotal] = useState(0);

  // 待批改总览相关状态
  const [pendingDrawerVisible, setPendingDrawerVisible] = useState(false);
  const [pendingData, setPendingData] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [totalPending, setTotalPending] = useState(0);

  // 等级到分数的映射
  const gradeScoreMap = {
    'A': 10,
    'B': 8,
    'C': 6,
    'D': 4,
    'E': 2,
    'F': 0
  };

  const [codeContent, setCodeContent] = useState(null); // 初始化为 null
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // 使用useRef存储计时器ID，避免闭包问题
  const timersRef = useRef({});

  // 新增：用于跟踪当前是否应该处理键盘快捷键
  const shouldHandleShortcutsRef = useRef(true);

  // 开始计时 - 修改为使用学生ID
  const startTimer = (submissionId) => {
    // 清除已有的计时器
    if (timersRef.current[submissionId]) {
      clearInterval(timersRef.current[submissionId]);
    }

    // 重置该学生的计时
    setSubmissionTimes(prev => ({
      ...prev,
      [submissionId]: 0
    }));

    // 创建新的计时器
    const timerId = setInterval(() => {
      setSubmissionTimes(prev => {
        const newTimes = { ...prev };
        newTimes[submissionId] = (newTimes[submissionId] || 0) + 1;
        return newTimes;
      });
    }, 1000);

    // 保存计时器ID到ref中
    timersRef.current[submissionId] = timerId;
  };

  // 停止计时 - 修改为使用学生ID
  const stopTimer = (submissionId) => {
    if (timersRef.current[submissionId]) {
      clearInterval(timersRef.current[submissionId]);
      delete timersRef.current[submissionId];
    }
  };

  // 清理所有定时器
  useEffect(() => {
    return () => {
      // 清理所有计时器
      Object.values(timersRef.current).forEach(timerId => {
        if (timerId) clearInterval(timerId);
      });
      timersRef.current = {};
    };
  }, []);

  // 从localStorage加载上次选择的活动
  // 使用 ref 标记是否需要从 localStorage 加载
  const pendingSelectionRef = useRef(null);

  useEffect(() => {
    let savedSelection = null;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || user._id;
      if (userId) {
        savedSelection = localStorage.getItem(`assignmentReviewSelection-${userId}`);
      }
    } catch (e) {
      console.error('Error reading user preference', e);
    }
    if (savedSelection) {
      try {
        const parsedSelection = JSON.parse(savedSelection);
        if (Array.isArray(parsedSelection) && parsedSelection.length === 4) {
          // 保存待处理的选择，等待 options 加载完成后再处理
          pendingSelectionRef.current = parsedSelection;
        }
      } catch (error) {
        console.error('解析保存的选择出错:', error);
      }
    }
  }, []);

  // 当 options 加载完成后，处理待加载的选择
  useEffect(() => {
    if (options.length > 0 && pendingSelectionRef.current) {
      const savedSelection = pendingSelectionRef.current;
      pendingSelectionRef.current = null; // 清除，避免重复处理
      // 使用 handleCascaderChange 确保特殊活动类型能正确处理
      handleCascaderChange(savedSelection);
    }
  }, [options]);

  // 获取教师的课程列表（使用优化后的单次请求）
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        // 使用优化后的 API，一次性获取所有课程-单元-课时-活动的树形结构
        const response = await courseManagementAPI.getAssignmentTree();
        const cascaderOptions = response.data || [];

        setOptions(cascaderOptions);

        // 只有在没有保存的选择时才自动选择第一个路径
        let savedSelection = null;
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const userId = user.id || user._id;
          if (userId) {
            savedSelection = localStorage.getItem(`assignmentReviewSelection-${userId}`);
          }
        } catch (e) { }
        if (!savedSelection && cascaderOptions.length > 0) {
          const firstPath = findFirstCompletePath(cascaderOptions);
          if (firstPath) {
            setSelectedKeys(firstPath);
            const [courseId, unitId, lessonId, activityId] = firstPath;
            fetchSubmissions(courseId, unitId, lessonId, activityId);
          }
        }
      } catch (error) {
        console.error('获取课程列表失败:', error);
        message.error('获取课程列表失败');
        setCourses([]);
      }
    };
    fetchCourses();

    // 同时加载待批改数量
    const loadPendingCount = async () => {
      try {
        const response = await courseManagementAPI.getPendingAssignmentsSummary();
        if (response.success) {
          setTotalPending(response.totalPending || 0);
        }
      } catch (error) {
        console.error('加载待批改数量失败:', error);
      }
    };
    loadPendingCount();
  }, []);

  // 递归查找第一个完整路径
  const findFirstCompletePath = (options) => {
    if (!options || options.length === 0) return null;

    const findPath = (node) => {
      if (!node.children || node.children.length === 0) {
        return [node.value];
      }
      const childPath = findPath(node.children[0]);
      return childPath ? [node.value, ...childPath] : null;
    };

    return findPath(options[0]);
  };

  // 处理级联选择变化
  const handleCascaderChange = (value) => {
    // 确保 value 不为 undefined
    const newValue = value || [];
    setSelectedKeys(newValue);

    // 保存选择到localStorage
    if (newValue && newValue.length === 4) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id || user._id;
        if (userId) {
          localStorage.setItem(`assignmentReviewSelection-${userId}`, JSON.stringify(newValue));
        }
      } catch (e) { }
    }

    // 重置相关状态
    setSortMode('none');
    setSelectedSubmission(null);
    setPreviewUrl(null);
    setCodeContent(null);
    setCurrentPreviewIndex(-1);
    submissionRequestRef.current += 1;
    setClassOptions([]);
    setSubmissions([]);
    setAllSubmissions([]);
    setActivityDetails({
      description: '',
      referenceAnswer: ''
    });
    setIsPythonAssignment(false);

    // 重置流程图相关状态
    setIsFlowchartActivity(false);
    setFlowchartSubmissions([]);
    setAllFlowchartSubmissions([]);
    setSelectedFlowchartSubmission(null);
    setFlowchartCurrentIndex(-1);
    setFlowchartScore(null);
    setFlowchartFeedback('');

    // 重置HTML相关状态
    setIsHtmlActivity(false);
    setHtmlProjects([]);

    // 重置Excel状态
    setIsExcelActivity(false);
    setExcelGradingState({});

    // 重置PPT状态
    setIsPptActivity(false);
    setPptGradingState({});

    // 重置Word状态
    setIsWordActivity(false);
    setWordGradingState({});

    // 重置Python编程状态
    setIsPythonActivity(false);
    setPythonSubmissions([]);
    setPythonGradingState({});

    // 重置测验状态
    setIsQuizActivity(false);
    setCurrentQuizId(null);
    setCurrentActivityId(null);

    // 只有当选择了完整的路径（课程、单元、课时、作业）时才获取提交
    if (newValue && newValue.length === 4) {
      const [courseId, unitId, lessonId, activityId] = newValue;

      // 检查活动类型
      const selectionRequestId = submissionRequestRef.current;
      const checkActivityType = async () => {
        try {
          const lessonResponse = await courseManagementAPI.getLesson(courseId, unitId, lessonId);
          if (selectionRequestId !== submissionRequestRef.current) return;
          if (lessonResponse.success && lessonResponse.data) {
            const activity = lessonResponse.data.activities.find(a => a._id === activityId);
            if (activity?.type === 'flowchart') {
              setIsFlowchartActivity(true);
              setIsSpreadsheetActivity(false);
              setActivityDetails({
                description: activity.flowchartSettings?.instructions || '',
                referenceAnswer: activity.flowchartSettings?.referenceAnswer || ''
              });
              // 获取流程图提交
              const response = await flowchartAPI.getActivitySubmissions(lessonId, activityId);
              if (response.success) {
                setFlowchartSubmissions(response.submissions || []);
                setAllFlowchartSubmissions(response.submissions || []);
                if (response.submissions && response.submissions.length > 0) {
                  handleSelectFlowchartSubmission(response.submissions[0], 0);
                }
              }
            } else if (activity?.type === 'spreadsheet') {
              setIsSpreadsheetActivity(true);
              setIsFlowchartActivity(false);
              setActivityDetails({
                description: activity.spreadsheetSettings?.instructions || '',
                referenceAnswer: ''
              });
              // 获取在线表格提交
              const response = await spreadsheetActivityAPI.getActivitySubmissions(lessonId, activityId);
              if (response.success) {
                setSpreadsheetSubmissions(response.data || []);
                if (response.data && response.data.length > 0) {
                  handleSelectSpreadsheetSubmission(response.data[0], 0);
                }
              }
            } else if (activity?.type === 'fillblank') {
              setIsFillBlankActivity(true);
              setIsFlowchartActivity(false);
              setIsSpreadsheetActivity(false);
              setActivityDetails({
                description: activity.fillBlankSettings?.instructions || '',
                content: activity.fillBlankSettings?.content || ''
              });
              // 获取填空提交
              const response = await fillBlankAPI.getActivitySubmissions(lessonId, activityId);
              if (response.success) {
                setFillBlankSubmissions(response.data || []);
              }
            } else if (activity?.type === 'html') {
              setIsHtmlActivity(true);
              setIsFlowchartActivity(false);
              setIsSpreadsheetActivity(false);
              setIsFillBlankActivity(false);
              setActivityDetails({
                description: activity.description || '',
                referenceAnswer: '' // HTML usually doesn't have a simple reference answer string
              });

              // 获取HTML项目和提交记录
              try {
                const [projectsRes, submissionsRes] = await Promise.all([
                  htmlProjectAPI.getProjectsByLesson(lessonId, activityId),
                  courseManagementAPI.getTeacherSubmissions(courseId, unitId, lessonId, activityId)
                ]);

                if (projectsRes && projectsRes.success) {
                  setHtmlProjects(projectsRes.data || []);
                }

                // 处理提交记录
                const cols = submissionsRes || [];
                setAllSubmissions(cols);

                // 提取班级 (Reusing existing logic later in effect, but good to ensure data is set)
                setSubmissions(cols);

              } catch (err) {
                console.error('获取HTML项目或提交失败', err);
                message.error('获取数据失败');
              }
            } else if (activity?.type === 'python') {
              // Python编程活动
              setIsPythonActivity(true);
              setIsFlowchartActivity(false);
              setIsSpreadsheetActivity(false);
              setIsFillBlankActivity(false);
              setIsHtmlActivity(false);
              setActivityDetails({
                description: activity.pythonSettings?.instructions || '',
                referenceAnswer: activity.pythonSettings?.starterCode || ''
              });
              // 获取Python提交
              try {
                const response = await pythonAPI.getActivitySubmissions(lessonId, activityId);
                if (response.success) {
                  setPythonSubmissions(response.data || []);
                }
              } catch (err) {
                console.error('获取Python提交失败', err);
                message.error('获取Python提交失败');
              }
            } else if (activity?.type === 'quiz') {
              // 测验活动
              setIsQuizActivity(true);
              setIsFlowchartActivity(false);
              setIsSpreadsheetActivity(false);
              setIsFillBlankActivity(false);
              setIsHtmlActivity(false);
              setIsPythonActivity(false);
              // quiz 可能是一个已填充的对象或字符串 ID，需要正确处理
              const quizValue = activity.quizSettings?.quiz;
              const quizId = quizValue?._id || quizValue;
              setCurrentQuizId(quizId);
              setCurrentActivityId(activityId);
            } else {
              setIsFlowchartActivity(false);
              setIsSpreadsheetActivity(false);
              setIsFillBlankActivity(false);
              setIsHtmlActivity(false);
              setIsPythonActivity(false);
              setIsQuizActivity(false);
              fetchSubmissions(courseId, unitId, lessonId, activityId);
              fetchActivityDetails(lessonId, activityId);
            }
          }
        } catch (error) {
          console.error('检查活动类型失败:', error);
        }
      };
      checkActivityType();
    }
  };

  // 在 useEffect 中添加获取班级列表的逻辑
  useEffect(() => {
    const fetchClassList = () => {
      // 从所有提交记录或填空提交记录中提取班级
      let classes = [];
      if (isPythonActivity && pythonSubmissions.length > 0) {
        classes = [...new Set(pythonSubmissions
          .filter(s => s.studentId?.classId?.grade && s.studentId?.classId?.name && s.studentId?.classId?.status !== 'archived')
          .map(s => formatClassName(s.studentId.classId.grade, s.studentId.classId.name)))];
      } else if (isFillBlankActivity && fillBlankSubmissions.length > 0) {
        classes = [...new Set(fillBlankSubmissions
          .filter(s => s.studentId?.classId?.grade && s.studentId?.classId?.name && s.studentId?.classId?.status !== 'archived')
          .map(s => formatClassName(s.studentId.classId.grade, s.studentId.classId.name)))];
      } else if (isFlowchartActivity && allFlowchartSubmissions.length > 0) {
        classes = [...new Set(allFlowchartSubmissions
          .filter(s => s.userId?.classId?.grade && s.userId?.classId?.name && s.userId?.classId?.status !== 'archived')
          .map(s => formatClassName(s.userId.classId.grade, s.userId.classId.name)))];
      } else if (allSubmissions.length > 0) {
        classes = [...new Set(allSubmissions
          .filter(s => s.student?.grade && s.student?.className)
          .map(s => formatClassName(s.student.grade, s.student.className)))];
      }
      setClassOptions(classes.sort());
    };
    fetchClassList();
  }, [allSubmissions, fillBlankSubmissions, isFillBlankActivity, allFlowchartSubmissions, isFlowchartActivity, pythonSubmissions, isPythonActivity]); // 依赖allSubmissions和fillBlankSubmissions

  // 处理班级选择变化（Python活动采用后端筛选，直接重新请求）
  const handleClassChange = async (value) => {
    selectedClassRef.current = value;
    setSelectedClass(value);
    // 重置未评分筛选状态
    setShowingUngraded(false);
    // 重置分数排序状态
    setSortMode('none');

    if (selectedKeys.length === 4) {
      const [courseId, unitId, lessonId, activityId] = selectedKeys;

      if (value) {
        // Python活动：通过后端筛选
        if (isPythonActivity) {
          // 从当前提交中找到匹配班级的 classId
          const matchingSub = pythonSubmissions.find(s =>
            formatClassName(s.studentId?.classId?.grade, s.studentId?.classId?.name) === value
          );
          const classIdToFilter = matchingSub?.studentId?.classId?._id;
          if (classIdToFilter) {
            try {
              const response = await pythonAPI.getActivitySubmissions(lessonId, activityId, classIdToFilter);
              if (response.success) {
                setPythonSubmissions(response.data || []);
              }
            } catch (err) {
              console.error('按班级筛选Python提交失败', err);
            }
          }
        } else if (isFillBlankActivity) {
          // 填空题逻辑
          const filteredData = allSubmissions.filter(s =>
            formatClassName(s.student?.grade, s.student?.className) === value
          );
          setSubmissions(filteredData);
          if (filteredData.length > 0) handlePreview(filteredData[0], 0);
        } else if (isFlowchartActivity) {
          // 流程图筛选
          const filteredData = allFlowchartSubmissions.filter(s =>
            formatClassName(s.userId?.classId?.grade, s.userId?.classId?.name) === value
          );
          setFlowchartSubmissions(filteredData);
        } else {
          // 普通作业筛选
          const filteredData = allSubmissions.filter(s =>
            formatClassName(s.student?.grade, s.student?.className) === value
          );
          setSubmissions(filteredData);
          if (filteredData.length > 0) handlePreview(filteredData[0], 0);
        }
      } else {
        // 清除筛选时
        if (isPythonActivity) {
          // 重新获取所有Python提交
          try {
            const response = await pythonAPI.getActivitySubmissions(lessonId, activityId);
            if (response.success) {
              setPythonSubmissions(response.data || []);
            }
          } catch (err) {
            console.error('重新获取Python提交失败', err);
          }
        } else if (isFlowchartActivity) {
          setFlowchartSubmissions(allFlowchartSubmissions);
        } else {
          setSubmissions(allSubmissions);
          if (allSubmissions.length > 0) handlePreview(allSubmissions[0], 0);
        }
      }
    }
  };

  // 获取提交列表
  const fetchSubmissions = async (courseId, unitId, lessonId, activityId) => {
    const requestId = ++submissionRequestRef.current;
    setLoading(true);
    try {
      const response = await courseManagementAPI.getTeacherSubmissions(
        courseId,
        unitId,
        lessonId,
        activityId
      );
      const data = response || [];

      // 验证活动是否需要提交
      const lessonResponse = await courseManagementAPI.getLesson(courseId, unitId, lessonId);
      if (requestId !== submissionRequestRef.current) return;
      const activity = lessonResponse.data?.activities.find(
        a => a._id === activityId
      );

      // 定义不需要文件提交的活动类型（这些类型有自己的提交系统）
      const specialActivityTypes = ['flowchart', 'python', 'fillblank', 'spreadsheet', 'html', 'quiz', 'typing'];
      const isSpecialType = specialActivityTypes.includes(activity?.type);

      // 验证活动是否需要提交（特殊活动类型不需要 requireSubmission 标志）
      if (!activity?.requireSubmission && !isSpecialType) {
        message.warning('该活动未设置为需要提交作业');
        setSubmissions([]);
        setAllSubmissions([]);
        setLoading(false);
        return;
      }

      setAllSubmissions(data); // 保存所有提交记录

      const isExcel = Array.isArray(activity?.allowedFormats) &&
        activity.allowedFormats.some(format =>
          format.toUpperCase() === 'XLSX' || format.toUpperCase() === 'XLS'
        );
      setIsExcelActivity(isExcel);

      const isPpt = Array.isArray(activity?.allowedFormats) &&
        activity.allowedFormats.some(format =>
          format.toUpperCase() === 'PPTX' || format.toUpperCase() === 'PPT'
        );
      setIsPptActivity(isPpt);

      const isWord = Array.isArray(activity?.allowedFormats) &&
        activity.allowedFormats.some(format =>
          format.toUpperCase() === 'DOCX' || format.toUpperCase() === 'DOC'
        );
      setIsWordActivity(isWord);

      // 提取并设置班级选项
      const classes = [...new Set(data
        .filter(s => s.student?.grade && s.student?.className)
        .map(s => formatClassName(s.student.grade, s.student.className)))];
      setClassOptions(classes.sort());

      // 如果选择了班级，过滤提交列表
      const filteredData = selectedClassRef.current
        ? data.filter(s => formatClassName(s.student?.grade, s.student?.className) === selectedClassRef.current)
        : data;

      setSubmissions(filteredData);

      // 如果有提交记录且不是Excel/PPT/Word作业，自动加载第一份作业预览
      // Excel/PPT/Word作业由各自组件内部处理
      if (filteredData.length > 0 && !isExcel && !isPpt && !isWord) {
        handlePreview(filteredData[0], 0);
      }
    } catch (error) {
      if (requestId !== submissionRequestRef.current) return;
      console.error('获取提交列表失败:', error);
      message.error('获取提交列表失败');
      setSubmissions([]);
      setAllSubmissions([]);
    } finally {
      if (requestId === submissionRequestRef.current) setLoading(false);
    }
  };

  // 处理预览
  const handlePreview = async (submission, index) => {
    console.log('开始预览文件:', submission);

    if (!submission?.content?.file) {
      message.error('提交内容不完整');
      setCodeContent(null); // 清空内容
      setPreviewUrl(null); // 清空预览URL
      setSelectedSubmission(submission); // 仍然选中该学生
      setCurrentPreviewIndex(index);
      return;
    }

    const file = submission.content.file;
    const fileType = getFileType(file.mimeType, file.originalName);

    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未找到认证token，请重新登录');
      return;
    }

    // 先设置选中的提交，确保UI立即更新
    setSelectedSubmission(submission);
    setCurrentPreviewIndex(index);

    // 滚动学生列表到当前选中的学生
    setTimeout(() => {
      if (studentListRef.current) {
        const listElement = studentListRef.current;
        const selectedElement = listElement.querySelector(`[data-index="${index}"]`);

        if (selectedElement) {
          // 计算需要滚动的位置，使选中的元素在视图中居中
          const listHeight = listElement.clientHeight;
          const elementHeight = selectedElement.clientHeight;
          const elementTop = selectedElement.offsetTop;

          // 滚动位置 = 元素顶部位置 - (列表高度/2 - 元素高度/2)
          const scrollPosition = elementTop - (listHeight / 2 - elementHeight / 2);

          // 平滑滚动到计算出的位置
          listElement.scrollTo({
            top: Math.max(0, scrollPosition),
            behavior: 'smooth'
          });
        }
      }
    }, 100); // 短暂延迟确保DOM已更新

    if (fileType === 'py' || fileType === 'txt') {
      try {
        const response = await fetch(`${API_BASE_URL}/api/submissions/${submission._id}/preview?token=${token}`);
        const text = await response.text();
        setCodeContent(text); // 设置代码内容 (可能为空字符串)
        setPreviewUrl(null);  // 明确设置 previewUrl 为 null
      } catch (error) {
        console.error('获取文件内容失败:', error);
        message.error('获取文件内容失败');
        setCodeContent('# 加载文件内容失败'); // 显示错误信息
        setPreviewUrl(null);
      }
    } else {
      // 构建带有token的预览URL
      const previewUrl = `${API_BASE_URL}/api/submissions/${submission._id}/preview?token=${token}`;
      setPreviewUrl(previewUrl); // 设置预览 URL
      setCodeContent(null);   // 明确设置 codeContent 为 null
    }

    // 如果是 Python 文件，获取课程信息用于 AI 评阅
    if (fileType === 'py') {
      try {
        // 获取最新的课程信息
        const lessonResponse = await courseManagementAPI.getLesson(
          selectedKeys[0], // courseId
          selectedKeys[1], // unitId
          selectedKeys[2]  // lessonId
        );

        if (lessonResponse.success && lessonResponse.data) {
          const activity = lessonResponse.data.activities?.find(
            a => a._id === submission.activity
          );

          const lessonInfo = {
            objectives: lessonResponse.data.objectives || [],
            description: activity?.description || '',
            referenceAnswer: activity?.referenceAnswer || ''
          };

          console.log('准备传递给 AI 的数据:', {
            lessonInfo,
            codeContent: text,
            activityId: submission.activity,
            activities: lessonResponse.data.activities
          });
        }
      } catch (error) {
        console.error('获取课程信息失败:', error);
        message.error('获取课程信息失败');
      }
    }
  };

  // 处理翻页
  const handlePrevSubmission = () => {
    if (currentPreviewIndex > 0) {
      handlePreview(submissions[currentPreviewIndex - 1], currentPreviewIndex - 1);
    }
  };

  const handleNextSubmission = () => {
    if (currentPreviewIndex < submissions.length - 1) {
      handlePreview(submissions[currentPreviewIndex + 1], currentPreviewIndex + 1);
    }
  };

  // 处理键盘事件
  useEffect(() => {
    const handleKeyPress = (e) => {
      // 检查是否应该处理快捷键
      if (!shouldHandleShortcutsRef.current) return;

      // 检查当前是否有文本输入元素被激活
      if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable) {
        return;
      }

      // 检查是否有Modal或Drawer打开
      if (activitySettingsVisible || batchAIModalVisible || editingActivityDetails) {
        return;
      }

      if (currentPreviewIndex !== -1 && selectedSubmission) {
        // 左右箭头切换学生
        if (e.key === 'ArrowLeft') {
          handlePrevSubmission();
        } else if (e.key === 'ArrowRight') {
          handleNextSubmission();
        }

        // 数字键1-6对应A-F评分
        const gradeKeys = {
          '1': 'A',
          '2': 'B',
          '3': 'C',
          '4': 'D',
          '5': 'E',
          '6': 'F'
        };

        if (gradeKeys[e.key]) {
          handleGradeChange(gradeKeys[e.key], selectedSubmission);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPreviewIndex, submissions, selectedSubmission, activitySettingsVisible, batchAIModalVisible, editingActivityDetails]);

  // 清理预览URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 处理等级变化
  const handleGradeChange = async (grade, record) => {
    try {
      const score = gradeScoreMap[grade];
      await courseManagementAPI.gradeSubmission(record._id, {
        grade: {
          score,
          feedback: record.grade?.feedback || ''
        }
      });
      message.success(`评分成功: ${grade}`, 1);

      // 更新本地状态
      const updatedSubmission = {
        ...record,
        status: 'graded',
        grade: {
          ...record.grade,
          score,
          gradedAt: new Date()
        }
      };
      setSelectedSubmission(updatedSubmission);

      // 更新提交列表中的对应记录
      const updatedSubmissions = submissions.map(s =>
        s._id === record._id ? updatedSubmission : s
      );
      setSubmissions(updatedSubmissions);

      // 更新所有提交记录中的对应记录
      const updatedAllSubmissions = allSubmissions.map(s =>
        s._id === record._id ? updatedSubmission : s
      );
      setAllSubmissions(updatedAllSubmissions);

      // 自动跳转到下一个学生（如果不是最后一个）
      const currentIndex = submissions.findIndex(s => s._id === record._id);
      if (currentIndex < submissions.length - 1) {
        const nextSubmission = submissions[currentIndex + 1];
        handlePreview(nextSubmission, currentIndex + 1);
      }
    } catch (error) {
      console.error('评分失败:', error);
      message.error('评分失败');
    }
  };

  // 处理反馈变化
  const handleFeedbackChange = async (feedback, record) => {
    try {
      // 如果有评语但没有分数，默认给A
      const score = feedback && !record.grade?.score ? 10 : (record.grade?.score || 0);

      await courseManagementAPI.gradeSubmission(record._id, {
        grade: {
          score,
          feedback
        }
      });
      message.success('保存反馈成功');

      // 更新本地状态
      const updatedSubmission = {
        ...record,
        status: 'graded',
        grade: {
          ...record.grade,
          score,
          feedback,
          gradedAt: new Date()
        }
      };
      setSelectedSubmission(updatedSubmission);

      // 更新提交列表中的对应记录
      const updatedSubmissions = submissions.map(s =>
        s._id === record._id ? updatedSubmission : s
      );
      setSubmissions(updatedSubmissions);

      // 更新所有提交记录中的对应记录
      const updatedAllSubmissions = allSubmissions.map(s =>
        s._id === record._id ? updatedSubmission : s
      );
      setAllSubmissions(updatedAllSubmissions);
    } catch (error) {
      console.error('保存反馈失败:', error);
      message.error('保存反馈失败');
    }
  };

  // 添加临时反馈状态管理
  const [tempFeedback, setTempFeedback] = useState({});

  // 处理反馈输入变化
  const handleFeedbackInputChange = (value, recordId) => {
    // 当开始输入时禁用快捷键
    shouldHandleShortcutsRef.current = false;

    setTempFeedback(prev => ({
      ...prev,
      [recordId]: value
    }));
  };

  // 修改处理反馈提交，当输入完成后恢复快捷键
  const handleFeedbackBlur = async (feedback, record) => {
    // 延迟恢复快捷键处理
    setTimeout(() => {
      shouldHandleShortcutsRef.current = true;
    }, 100);

    await handleFeedbackChange(feedback, record);
  };

  // 流程图相关函数
  const handleSelectFlowchartSubmission = (submission, index) => {
    setSelectedFlowchartSubmission(submission);
    setFlowchartCurrentIndex(index);
    setFlowchartScore(submission.grade?.score ?? null);
    setFlowchartFeedback(submission.grade?.feedback || '');
  };

  const handleFlowchartPrev = () => {
    if (flowchartCurrentIndex > 0) {
      handleSelectFlowchartSubmission(flowchartSubmissions[flowchartCurrentIndex - 1], flowchartCurrentIndex - 1);
    }
  };

  const handleFlowchartNext = () => {
    if (flowchartCurrentIndex < flowchartSubmissions.length - 1) {
      handleSelectFlowchartSubmission(flowchartSubmissions[flowchartCurrentIndex + 1], flowchartCurrentIndex + 1);
    }
  };

  const handleFlowchartGrade = async () => {
    if (!selectedFlowchartSubmission) return;
    if (flowchartScore === null || flowchartScore < 0 || flowchartScore > 10) {
      message.warning('请输入有效的分数（0-10）');
      return;
    }

    setFlowchartGrading(true);
    try {
      const response = await flowchartAPI.gradeSubmission(selectedFlowchartSubmission._id, flowchartScore, flowchartFeedback);
      if (response.success) {
        message.success('评分成功');

        // 更新本地状态
        const updatedSubmission = {
          ...selectedFlowchartSubmission,
          status: 'graded',
          grade: {
            score: flowchartScore,
            feedback: flowchartFeedback,
            gradedAt: new Date()
          }
        };
        setSelectedFlowchartSubmission(updatedSubmission);

        // 更新提交列表
        const updatedSubmissions = flowchartSubmissions.map(s =>
          s._id === selectedFlowchartSubmission._id ? updatedSubmission : s
        );
        setFlowchartSubmissions(updatedSubmissions);

        // 自动跳转到下一个
        if (flowchartCurrentIndex < flowchartSubmissions.length - 1) {
          handleFlowchartNext();
        }
      }
    } catch (error) {
      console.error('评分失败:', error);
      message.error('评分失败');
    } finally {
      setFlowchartGrading(false);
    }
  };

  // 流程图快捷评分
  const handleFlowchartQuickGrade = (grade) => {
    const scoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };
    setFlowchartScore(scoreMap[grade]);
  };

  // 在线表格相关函数
  const handleSelectSpreadsheetSubmission = (submission, index) => {
    setSelectedSpreadsheetSubmission(submission);
    setSpreadsheetCurrentIndex(index);
    setSpreadsheetScore(submission.grade?.score ?? null);
    setSpreadsheetFeedback(submission.grade?.feedback || '');
  };

  const handleSpreadsheetPrev = () => {
    if (spreadsheetCurrentIndex > 0) {
      handleSelectSpreadsheetSubmission(spreadsheetSubmissions[spreadsheetCurrentIndex - 1], spreadsheetCurrentIndex - 1);
    }
  };

  const handleSpreadsheetNext = () => {
    if (spreadsheetCurrentIndex < spreadsheetSubmissions.length - 1) {
      handleSelectSpreadsheetSubmission(spreadsheetSubmissions[spreadsheetCurrentIndex + 1], spreadsheetCurrentIndex + 1);
    }
  };

  const handleSpreadsheetGrade = async () => {
    if (!selectedSpreadsheetSubmission) return;
    if (spreadsheetScore === null || spreadsheetScore < 0 || spreadsheetScore > 10) {
      message.warning('请输入有效的分数（0-10）');
      return;
    }

    setSpreadsheetGrading(true);
    try {
      const response = await courseManagementAPI.gradeSubmission(selectedSpreadsheetSubmission._id, {
        grade: {
          score: spreadsheetScore,
          feedback: spreadsheetFeedback
        }
      });

      message.success('评分成功');

      const updatedSubmission = {
        ...selectedSpreadsheetSubmission,
        status: 'graded',
        grade: {
          score: spreadsheetScore,
          feedback: spreadsheetFeedback,
          gradedAt: new Date()
        }
      };
      setSelectedSpreadsheetSubmission(updatedSubmission);

      const updatedSubmissions = spreadsheetSubmissions.map(s =>
        s._id === selectedSpreadsheetSubmission._id ? updatedSubmission : s
      );
      setSpreadsheetSubmissions(updatedSubmissions);

      if (spreadsheetCurrentIndex < spreadsheetSubmissions.length - 1) {
        handleSpreadsheetNext();
      }
    } catch (error) {
      console.error('评分失败:', error);
      message.error('评分失败');
    } finally {
      setSpreadsheetGrading(false);
    }
  };

  const handleSpreadsheetQuickGrade = (grade) => {
    const scoreMap = { 'A': 10, 'B': 8, 'C': 6, 'D': 4, 'E': 2, 'F': 0 };
    setSpreadsheetScore(scoreMap[grade]);
  };

  // 在 AssignmentReview 组件内添加下载处理函数
  const handleDownload = async (file) => {
    try {
      const blob = await courseManagementAPI.downloadAssignment(file.path);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error('下载文件失败');
    }
  };

  // 处理请求 AI 评阅
  const handleRequestAIGrade = async (submission = selectedSubmission) => {
    if (!submission) {
      message.warning('请先选择要评阅的作业');
      return;
    }

    try {
      // 设置该学生的加载状态
      setLoadingSubmissions(prev => ({
        ...prev,
        [submission._id]: true
      }));

      // 开始该学生的计时
      startTimer(submission._id);

      const response = await courseManagementAPI.requestAIGrade(submission._id);

      if (response.success) {
        // 保存当前选中的学生ID，以便在重新加载后恢复选中状态
        const currentSubmissionId = submission._id;

        // 如果当前有选择课程、单元、课时和活动，则重新获取所有提交数据
        if (selectedKeys.length === 4) {
          const [courseId, unitId, lessonId, activityId] = selectedKeys;

          // 重新获取所有提交数据
          const submissionsResponse = await courseManagementAPI.getTeacherSubmissions(
            courseId,
            unitId,
            lessonId,
            activityId
          );

          if (submissionsResponse) {
            const freshData = submissionsResponse || [];

            // 更新所有提交记录
            setAllSubmissions(freshData);

            // 应用当前的筛选条件（班级筛选和未评分筛选）
            let filteredData = freshData;

            // 应用班级筛选
            if (selectedClass) {
              filteredData = filteredData.filter(s =>
                formatClassName(s.student?.grade, s.student?.className) === selectedClass
              );
            }

            // 应用未评分筛选
            if (showingUngraded) {
              filteredData = filteredData.filter(s => {
                const teacherScore = s.grade?.score;
                const aiScore = s.aiGrade?.score;
                // 如果既没有教师评分也没有AI评分，则认为是未评分
                return teacherScore === undefined && aiScore === undefined;
              });
            }

            // 更新提交列表
            setSubmissions(filteredData);

            // 找到并选中之前选中的提交
            const newIndex = filteredData.findIndex(s => s._id === currentSubmissionId);
            if (newIndex !== -1) {
              // 如果找到了之前选中的提交，则选中它
              setSelectedSubmission(filteredData[newIndex]);
              setCurrentPreviewIndex(newIndex);
            } else if (filteredData.length > 0) {
              // 如果找不到之前选中的提交（可能是因为筛选条件变化），则选中第一个
              setSelectedSubmission(filteredData[0]);
              setCurrentPreviewIndex(0);
            }
          }
        } else {
          // 如果没有选择完整的路径，则只更新当前提交的AI评阅结果
          const updatedSubmission = { ...submission, aiGrade: response.data };

          // 更新当前提交的 AI 评阅结果
          if (selectedSubmission && selectedSubmission._id === submission._id) {
            setSelectedSubmission(updatedSubmission);
          }

          // 更新提交列表中的对应记录
          const updatedSubmissions = submissions.map(s =>
            s._id === submission._id ? updatedSubmission : s
          );
          setSubmissions(updatedSubmissions);

          // 更新所有提交记录中的对应记录
          const updatedAllSubmissions = allSubmissions.map(s =>
            s._id === submission._id ? updatedSubmission : s
          );
          setAllSubmissions(updatedAllSubmissions);
        }

        message.success('AI评阅完成');
      } else {
        message.error(response.message || 'AI 评阅失败');
      }
    } catch (error) {
      console.error('AI 评阅请求失败:', error);
      message.error(error.message || 'AI 评阅请求失败，请稍后重试');
    } finally {
      // 停止该学生的计时
      stopTimer(submission._id);

      // 清除该学生的加载状态
      setLoadingSubmissions(prev => ({
        ...prev,
        [submission._id]: false
      }));
    }
  };

  // 渲染 AI 评阅结果
  const renderAIGradePanel = (aiGrade) => {
    if (!selectedSubmission) return null;

    // 获取当前选中学生的加载状态
    const isLoading = loadingSubmissions[selectedSubmission._id] || false;

    // 获取当前选中学生的计时
    const currentTime = submissionTimes[selectedSubmission._id] || 0;

    // 检查 aiGrade 是否为有效的评阅结果
    const isValidAIGrade = aiGrade && (
      aiGrade.score !== undefined ||
      aiGrade.feedback ||
      (aiGrade.analysis && Object.keys(aiGrade.analysis).length > 0)
    );

    console.log('渲染AI评阅面板:', {
      submissionId: selectedSubmission._id,
      hasAiGrade: !!aiGrade,
      isValidAiGrade: isValidAIGrade,
      aiGrade
    });

    if (!isValidAIGrade) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          {isLoading ? (
            <div style={{ textAlign: 'center' }}>
              <Spin size="large">
                <div style={{
                  padding: '50px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '4px',
                  marginBottom: '20px',
                  minHeight: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '16px'
                }}>
                  <div style={{ fontSize: '16px', color: '#1890ff' }}>
                    AI 正在评阅作业...
                  </div>
                  <div style={{ color: '#666' }}>
                    预计需要 30-60 秒，请耐心等待
                  </div>
                  <div style={{
                    color: '#1890ff',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    marginTop: '8px'
                  }}>
                    {currentTime} 秒
                  </div>
                </div>
              </Spin>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Empty
                description={
                  <span style={{ color: '#666', marginBottom: '16px', display: 'block' }}>
                    暂无 AI 评阅结果
                  </span>
                }
              />
              <Button
                type="primary"
                onClick={() => handleRequestAIGrade(selectedSubmission)}
                disabled={!selectedSubmission}
                style={{ marginTop: '16px' }}
              >
                请求 AI 评阅
              </Button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Space>
              <Title level={4} style={{ margin: 0 }}>AI 评分：{aiGrade.score}</Title>
              <Spin spinning={isLoading} tip={isLoading ? `评阅中 ${currentTime}s` : ''}>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleRequestAIGrade(selectedSubmission)}
                  disabled={isLoading}
                >
                  重新评阅
                </Button>
              </Spin>
            </Space>
            <div style={{ marginBottom: '16px' }}>{aiGrade.feedback}</div>
          </Space>
        </div>

        <Divider>详细分析</Divider>

        {aiGrade.analysis && Object.entries(aiGrade.analysis).map(([key, analysis]) => {
          if (!analysis) return null;
          // 获取对应的中文名称
          let title;
          switch (key) {
            case 'codeQuality': title = '代码质量'; break;
            case 'functionality': title = '功能实现'; break;
            case 'basicConcepts': title = '基础概念掌握'; break;
            case 'logicClarity': title = '逻辑清晰度'; break;
            case 'readability': title = '代码可读性'; break; // 兼容旧版
            case 'efficiency': title = '代码效率'; break; // 兼容旧版
            default: title = key;
          }
          return (
            <Card
              key={key}
              size="small"
              title={
                <Space>
                  {title}
                  <Tag color="blue">{analysis.score} 分</Tag>
                </Space>
              }
              style={{ marginBottom: '12px' }}
            >
              {analysis.feedback}
            </Card>
          );
        })}

        {aiGrade.suggestions && aiGrade.suggestions.length > 0 && (
          <>
            <Divider>改进建议</Divider>
            <ul style={{ paddingLeft: '20px' }}>
              {aiGrade.suggestions.map((suggestion, index) => (
                <li key={index} style={{ marginBottom: '8px' }}>{suggestion}</li>
              ))}
            </ul>
          </>
        )}

        <div style={{ marginTop: '20px', color: '#888', fontSize: '12px' }}>
          评阅时间：{new Date(aiGrade.gradedAt).toLocaleString()}
        </div>
      </div>
    );
  };

  // 处理标签滚动
  const handleTagScroll = (direction) => {
    const container = scrollContainerRef.current;
    if (container) {
      const containerWidth = container.offsetWidth;
      const scrollAmount = containerWidth * 0.8; // 滚动容器宽度的 80%
      const targetScroll = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // 渲染学生标签
  const renderStudentTags = () => {
    return (
      <div style={{
        position: 'relative',
        padding: '10px 40px',
        borderBottom: '1px solid #f0f0f0',
      }}>
        {/* 左滚动按钮 */}
        <Button
          type="text"
          icon={<LeftOutlined />}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1,
            height: '100%',
            background: 'linear-gradient(to right, #fff 0%, rgba(255,255,255,0.9) 100%)'
          }}
          onClick={() => handleTagScroll('left')}
        />

        {/* 标签容器 */}
        <div
          ref={scrollContainerRef}
          style={{
            overflowX: 'hidden',
            whiteSpace: 'nowrap',
            scrollBehavior: 'smooth',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
              display: 'none'
            }
          }}
        >
          {submissions.map((submission, index) => {
            // 优先使用教师评分，其次使用AI评分
            const teacherScore = submission.grade?.score;
            const aiScore = submission.aiGrade?.score;
            const score = teacherScore !== undefined ? teacherScore : aiScore;
            const isAiGraded = teacherScore === undefined && aiScore !== undefined;

            const backgroundColor = getScoreColor(score);
            const borderColor = getScoreBorderColor(score);
            const isSelected = index === currentPreviewIndex;

            return (
              <div
                key={submission._id}
                onClick={() => handlePreview(submission, index)}
                style={{
                  padding: '12px',
                  backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                  borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  borderRadius: '4px',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.09)' : 'none',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {submission.student?.name || '未知学生'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {formatClassName(
                      submission.student?.grade,
                      submission.student?.className
                    )}
                  </div>
                </div>

                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor,
                  border: `2px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: getScoreTextColor(score),
                  fontWeight: 'bold',
                  position: 'relative'
                }}>
                  {score !== undefined ? (
                    <>
                      {Object.entries(gradeScoreMap).find(([_, s]) => s === score)?.[0]}
                      {isAiGraded && (
                        <div style={{
                          position: 'absolute',
                          top: -5,
                          right: -5,
                          backgroundColor: '#1890ff',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff'
                        }}>
                          AI
                        </div>
                      )}
                    </>
                  ) : '?'}
                </div>
              </div>
            );
          })}
        </div>

        {/* 右滚动按钮 */}
        <Button
          type="text"
          icon={<RightOutlined />}
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1,
            height: '100%',
            background: 'linear-gradient(to left, #fff 0%, rgba(255,255,255,0.9) 100%)'
          }}
          onClick={() => handleTagScroll('right')}
        />
      </div>
    );
  };

  // 渲染统计信息
  const renderStatistics = () => {
    // 根据当前活动类型和班级筛选，选择使用的数据
    let dataToUse = [];

    if (isFlowchartActivity) {
      dataToUse = flowchartSubmissions;
    } else if (isFillBlankActivity) {
      dataToUse = fillBlankSubmissions;
    } else {
      dataToUse = selectedClass ? submissions : allSubmissions;
    }

    // 如果是 Flowchart 或 FillBlank，手动应用班级筛选
    if ((isFlowchartActivity || isFillBlankActivity) && selectedClass) {
      dataToUse = dataToUse.filter(s => {
        // 兼容不同数据结构的班级信息获取
        const student = s.student || s.studentId;
        const grade = student?.grade || student?.classId?.grade;
        const className = student?.className || student?.classId?.name;
        return formatClassName(grade, className) === selectedClass;
      });
    }

    const stats = calculateStatistics(dataToUse);
    const total = dataToUse.length;

    // 计算已评阅的百分比
    const gradedPercentage = total > 0 ? Math.round(((total - stats.ungraded) / total) * 100) : 0;

    return (
      <div style={{
        marginBottom: '10px',
        background: '#f9f9f9',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>作业统计:</span>
            {selectedClass && <Tag color="blue" size="small" style={{ marginRight: '8px' }}>{selectedClass}</Tag>}
            <span>
              评阅进度:
              <span style={{
                fontWeight: 'bold',
                margin: '0 4px',
                color: gradedPercentage >= 80 ? '#52c41a' : gradedPercentage >= 50 ? '#faad14' : '#ff4d4f'
              }}>
                {gradedPercentage}%
              </span>
              ({total - stats.ungraded}/{total})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', fontWeight: 'bold', color: '#722ed1' }}>
              未评阅: {stats.ungraded}
            </span>
            <span>|</span>
            <div style={{ display: 'flex', marginLeft: '8px' }}>
              <Tooltip title={`A等级: ${stats.A}人 (${total > 0 ? Math.round((stats.A / total) * 100) : 0}%)`}>
                <Tag color="#52c41a" style={{ margin: '0 2px' }}>A: {stats.A}</Tag>
              </Tooltip>
              <Tooltip title={`B等级: ${stats.B}人 (${total > 0 ? Math.round((stats.B / total) * 100) : 0}%)`}>
                <Tag color="#1890ff" style={{ margin: '0 2px' }}>B: {stats.B}</Tag>
              </Tooltip>
              <Tooltip title={`C等级: ${stats.C}人 (${total > 0 ? Math.round((stats.C / total) * 100) : 0}%)`}>
                <Tag color="#faad14" style={{ margin: '0 2px' }}>C: {stats.C}</Tag>
              </Tooltip>
              <Tooltip title={`D等级: ${stats.D}人 (${total > 0 ? Math.round((stats.D / total) * 100) : 0}%)`}>
                <Tag color="#ff7a45" style={{ margin: '0 2px' }}>D: {stats.D}</Tag>
              </Tooltip>
              <Tooltip title={`E等级: ${stats.E}人 (${total > 0 ? Math.round((stats.E / total) * 100) : 0}%)`}>
                <Tag color="#ff4d4f" style={{ margin: '0 2px' }}>E: {stats.E}</Tag>
              </Tooltip>
              <Tooltip title={`F等级: ${stats.F}人 (${total > 0 ? Math.round((stats.F / total) * 100) : 0}%)`}>
                <Tag color="#f5222d" style={{ margin: '0 2px' }}>F: {stats.F}</Tag>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div style={{
          height: '4px',
          background: '#f0f0f0',
          borderRadius: '2px',
          overflow: 'hidden',
          marginTop: '6px'
        }}>
          <div style={{
            height: '100%',
            width: `${gradedPercentage}%`,
            background: gradedPercentage >= 80 ? '#52c41a' : gradedPercentage >= 50 ? '#faad14' : '#ff4d4f',
            borderRadius: '2px',
            transition: 'width 0.5s'
          }} />
        </div>
      </div>
    );
  };

  // 处理清除评分
  const handleClearGrade = async (record) => {
    try {
      // 发送完整的清除评分请求
      await courseManagementAPI.gradeSubmission(record._id, {
        grade: {
          score: null,
          feedback: '',
          gradedBy: null,
          gradedAt: null,
          rubricScores: []
        },
        aiGrade: {
          score: null,
          feedback: '',
          analysis: {
            codeQuality: { score: null, feedback: '' },
            functionality: { score: null, feedback: '' },
            readability: { score: null, feedback: '' },
            efficiency: { score: null, feedback: '' }
          },
          suggestions: [],
          gradedAt: null
        },
        status: 'submitted'
      });

      message.success('清除评分成功');

      // 更新本地状态
      const updatedSubmission = {
        ...record,
        status: 'submitted',
        grade: null,
        aiGrade: null
      };
      setSelectedSubmission(updatedSubmission);

      // 更新提交列表中的对应记录
      const updatedSubmissions = submissions.map(s =>
        s._id === record._id ? updatedSubmission : s
      );
      setSubmissions(updatedSubmissions);

      // 更新所有提交记录中的对应记录
      const updatedAllSubmissions = allSubmissions.map(s =>
        s._id === record._id ? updatedSubmission : s
      );
      setAllSubmissions(updatedAllSubmissions);
    } catch (error) {
      console.error('清除评分失败:', error);
      message.error('清除评分失败');
    }
  };

  // 处理查看未评分的作业
  const handleViewUngraded = (checked) => {
    // 直接使用传入的checked值，而不是取反
    setShowingUngraded(checked);

    if (selectedKeys.length === 4) {
      if (checked) {
        // 首先应用班级筛选（如果有）
        const classFiltered = selectedClass
          ? allSubmissions.filter(s => formatClassName(s.student?.grade, s.student?.className) === selectedClass)
          : allSubmissions;

        // 然后从筛选后的记录中筛选出未评分的作业
        const ungradedSubmissions = classFiltered.filter(submission => {
          const teacherScore = submission.grade?.score;
          const aiScore = submission.aiGrade?.score;
          // 如果既没有教师评分也没有AI评分，则认为是未评分
          return teacherScore === undefined && aiScore === undefined;
        });

        if (ungradedSubmissions.length > 0) {
          setSubmissions(ungradedSubmissions);
          // 自动选择第一个未评分的作业
          handlePreview(ungradedSubmissions[0], 0);
          message.info(`找到 ${ungradedSubmissions.length} 份未评分的作业`);
        } else {
          // 如果没有未评分的作业，显示提示并保持当前筛选状态
          message.info(selectedClass ? `${selectedClass}没有未评分的作业` : '没有未评分的作业');
          // 重置状态，因为没有符合条件的作业
          setShowingUngraded(false);
        }
      } else {
        // 取消未评分筛选，恢复显示所有作业（考虑班级筛选）
        if (selectedClass) {
          const classFiltered = allSubmissions.filter(s =>
            formatClassName(s.student?.grade, s.student?.className) === selectedClass
          );
          setSubmissions(classFiltered);
          // 如果有提交记录，自动加载第一份作业
          if (classFiltered.length > 0) {
            handlePreview(classFiltered[0], 0);
          }
        } else {
          setSubmissions(allSubmissions);
          // 如果有提交记录，自动加载第一份作业
          if (allSubmissions.length > 0) {
            handlePreview(allSubmissions[0], 0);
          }
        }
      }
    }
  };

  // 处理按分数排序
  const handleSortChange = () => {
    const nextMode = sortMode === 'none' ? 'desc' : (sortMode === 'desc' ? 'asc' : 'none');
    setSortMode(nextMode);
    
    const sorter = (a, b) => {
      if (nextMode !== 'none') {
        let scoreA = -1;
        if (a.status === 'graded' && a.grade?.score !== undefined && a.grade?.score !== null) scoreA = a.grade.score;
        else if (a.aiGrade?.score !== undefined && a.aiGrade?.score !== null) scoreA = a.aiGrade.score;
        else if (a.score !== undefined && a.score !== null) scoreA = a.score;
        
        let scoreB = -1;
        if (b.status === 'graded' && b.grade?.score !== undefined && b.grade?.score !== null) scoreB = b.grade.score;
        else if (b.aiGrade?.score !== undefined && b.aiGrade?.score !== null) scoreB = b.aiGrade.score;
        else if (b.score !== undefined && b.score !== null) scoreB = b.score;
        
        return nextMode === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      } else {
        // 恢复默认按时间或者原顺序排列
        const timeA = a.submittedAt || a.createdAt || a._id;
        const timeB = b.submittedAt || b.createdAt || b._id;
        return timeA < timeB ? 1 : -1;
      }
    };

    setSubmissions(prev => [...prev].sort(sorter));
    setAllSubmissions(prev => [...prev].sort(sorter));
    setPythonSubmissions(prev => [...prev].sort(sorter));
    setFlowchartSubmissions(prev => [...prev].sort(sorter));
    setAllFlowchartSubmissions(prev => [...prev].sort(sorter));
    setSpreadsheetSubmissions(prev => [...prev].sort(sorter));
    setFillBlankSubmissions(prev => [...prev].sort(sorter));
    
    // 清空选中状态避免错位
    setSelectedSubmission(null);
    setCurrentPreviewIndex(-1);
    setSelectedFlowchartSubmission(null);
    setFlowchartCurrentIndex(-1);
    setSelectedSpreadsheetSubmission(null);
    setSpreadsheetCurrentIndex(-1);
  };

  // 表格列配置
  const columns = [
    {
      title: '学生',
      dataIndex: ['student'],
      key: 'studentName',
      width: 100,
      filteredValue: filteredInfo.studentName || null,
      onFilter: (value, record) => record.student?.name?.toLowerCase().includes(value.toLowerCase()),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索学生姓名"
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              style={{ width: 90 }}
            >
              搜索
            </Button>
            <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
              重置
            </Button>
          </Space>
        </div>
      ),
      render: (student) => {
        if (!student) return '未知学生';
        return (
          <Space direction="vertical" size="small">
            <div>{student.name || '未知姓名'}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {formatClassName(student.grade, student.className)}
              {student.studentId ? ` (学号: ${student.studentId})` : ''}
            </div>
          </Space>
        );
      },
    },
    {
      title: '文件',
      dataIndex: 'content',
      key: 'files',
      width: 200,
      render: (content, record) => (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Button
            type="link"
            onClick={() => handlePreview(record, submissions.indexOf(record))}
            style={{
              padding: 0,
              height: 'auto',
              whiteSpace: 'normal',
              textAlign: 'left',
              lineHeight: '1.5'
            }}
          >
            {content.file.originalName}
          </Button>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: '已提交', value: 'submitted' },
        { text: '已批阅', value: 'graded' }
      ],
      filteredValue: filteredInfo.status || null,
      onFilter: (value, record) => {
        if (value === 'graded') {
          // 如果有教师评分或AI评分，都算作已批阅
          return record.status === 'graded' || (record.aiGrade && record.aiGrade.score !== undefined);
        }
        return record.status === value && !(record.aiGrade && record.aiGrade.score !== undefined);
      },
      render: (status, record) => {
        // 如果有AI评分但没有教师评分，显示为AI已批阅
        if (record.aiGrade && record.aiGrade.score !== undefined && status !== 'graded') {
          return <Tag color="cyan">AI已批阅</Tag>;
        }

        const statusMap = {
          submitted: <Tag color="blue">已提交</Tag>,
          graded: <Tag color="green">已批阅</Tag>,
        };
        return statusMap[status] || status;
      },
    },
    {
      title: '等级',
      key: 'grade',
      width: 100,
      filters: [
        { text: 'A', value: 'A' },
        { text: 'B', value: 'B' },
        { text: 'C', value: 'C' },
        { text: 'D', value: 'D' },
        { text: 'E', value: 'E' },
        { text: 'F', value: 'F' },
        { text: '未评分', value: 'ungraded' }
      ],
      filteredValue: filteredInfo.grade || null,
      onFilter: (value, record) => {
        // 获取评分（优先使用教师评分，其次使用AI评分）
        const teacherScore = record.grade?.score;
        const aiScore = record.aiGrade?.score;
        const score = teacherScore !== undefined ? teacherScore : aiScore;

        if (value === 'ungraded') {
          return score === undefined;
        }

        const targetScore = gradeScoreMap[value];
        return score === targetScore;
      },
      render: (_, record) => {
        // 获取评分（优先使用教师评分，其次使用AI评分）
        const teacherScore = record.grade?.score;
        const aiScore = record.aiGrade?.score;
        const currentScore = teacherScore !== undefined ? teacherScore : aiScore;

        const currentGrade = currentScore !== undefined ?
          Object.entries(gradeScoreMap).find(([_, score]) => score === currentScore)?.[0] :
          undefined;

        const gradeColors = {
          'A': '#52c41a',
          'B': '#1890ff',
          'C': '#faad14',
          'D': '#ff7a45',
          'E': '#ff4d4f',
          'F': '#f5222d'
        };

        return (
          <div>
            {currentGrade ? (
              <Tag color={gradeColors[currentGrade]} style={{ marginRight: '8px' }}>
                {currentGrade}{teacherScore === undefined && aiScore !== undefined ? ' (AI)' : ''}
              </Tag>
            ) : null}
            <Select
              value={currentGrade}
              style={{ width: 80 }}
              onChange={(value) => handleGradeChange(value, record)}
              placeholder="选择"
            >
              <Select.Option value="A">A</Select.Option>
              <Select.Option value="B">B</Select.Option>
              <Select.Option value="C">C</Select.Option>
              <Select.Option value="D">D</Select.Option>
              <Select.Option value="E">E</Select.Option>
              <Select.Option value="F">F</Select.Option>
            </Select>
          </div>
        );
      }
    },
    {
      title: '评价',
      key: 'feedback',
      width: 300,
      render: (_, record) => (
        <Input.TextArea
          value={tempFeedback[record._id] !== undefined ? tempFeedback[record._id] : record.grade?.feedback || ''}
          autoSize={{ minRows: 1, maxRows: 3 }}
          onChange={(e) => handleFeedbackInputChange(e.target.value, record._id)}
          onBlur={(e) => handleFeedbackBlur(e.target.value, record)}
          placeholder="可选填写评价"
        />
      )
    }
  ].filter(column => column.key !== 'submittedAt'); // 移除提交时间列

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    setFilteredInfo(filters);
    setSortedInfo(sorter);
  };

  // 重置筛选
  const clearFilters = () => {
    setFilteredInfo({});
    setSortedInfo({});
    selectedClassRef.current = null;
    setSelectedClass(null);
    setShowingUngraded(false); // 重置未评分筛选状态

    // 重置所有列的筛选值
    const emptyFilters = columns.reduce((acc, col) => {
      if (col.filteredValue) {
        acc[col.key] = null;
      }
      return acc;
    }, {});
    setFilteredInfo(emptyFilters);
    // 显示所有提交记录
    setSubmissions(allSubmissions);
  };

  // 获取分数对应的颜色
  const getScoreColor = (score) => {
    if (score === undefined) return '#f0f0f0'; // 未评分
    if (score >= 9) return '#52c41a'; // A - 绿色
    if (score >= 7) return '#1890ff'; // B - 蓝色
    if (score >= 5) return '#faad14'; // C - 黄色
    if (score >= 3) return '#ff7a45'; // D - 橙色
    if (score >= 1) return '#ff4d4f'; // E - 红色
    return '#f5222d'; // F - 深红色
  };

  // 获取分数对应的边框颜色
  const getScoreBorderColor = (score) => {
    if (score === undefined) return '#d9d9d9';
    if (score >= 9) return '#389e0d';
    if (score >= 7) return '#096dd9';
    if (score >= 5) return '#d48806';
    if (score >= 3) return '#d4380d';
    if (score >= 1) return '#cf1322';
    return '#a8071a';
  };

  // 获取分数对应的文字颜色
  const getScoreTextColor = (score) => {
    if (score === undefined) return '#666';
    if (score >= 7) return '#fff'; // A和B用白色
    if (score >= 5) return '#000'; // C用黑色
    return '#fff'; // D、E、F用白色
  };

  // 新增左侧学生列表的引用
  const studentListRef = useRef(null);

  // 处理批量AI评阅
  const handleBatchAIGrade = async () => {
    // 重置完成状态
    setBatchAICompleted(false);

    // 确定要评阅的提交列表
    let submissionsToProcess = [];

    // 根据用户选择的类型筛选要处理的提交
    if (batchAIType === 'ungraded') {
      // 未评阅的作业（既没有教师评分也没有AI评分）
      submissionsToProcess = allSubmissions.filter(s => {
        const teacherScore = s.grade?.score;
        const aiScore = s.aiGrade?.score;
        return teacherScore === undefined && aiScore === undefined;
      });
    } else if (batchAIType === 'all') {
      // 所有作业
      submissionsToProcess = allSubmissions;
    } else if (batchAIType === 'aigraded') {
      // 已有AI评分的作业（重新评阅）
      submissionsToProcess = allSubmissions.filter(s => {
        const teacherScore = s.grade?.score;
        const aiScore = s.aiGrade?.score;
        return teacherScore === undefined && aiScore !== undefined;
      });
    }

    // 如果有班级筛选，再次筛选
    if (selectedClass) {
      submissionsToProcess = submissionsToProcess.filter(s =>
        formatClassName(s.student?.grade, s.student?.className) === selectedClass
      );
    }

    // 如果没有符合条件的提交，显示提示并退出
    if (submissionsToProcess.length === 0) {
      message.info('没有符合条件的作业需要评阅');
      setBatchAIModalVisible(false);
      return;
    }

    // 初始化进度指标
    setBatchAIRunning(true);
    setBatchAITotal(submissionsToProcess.length);
    setBatchAIProgress(0);
    setBatchAIResults({
      success: 0,
      failed: 0,
      processing: submissionsToProcess.length
    });

    // 初始化处理状态对象
    const initialStatus = {};
    submissionsToProcess.forEach(s => {
      initialStatus[s._id] = 'pending'; // pending, processing, success, failed
    });
    setBatchProcessStatus(initialStatus);

    // 定义每批处理的作业数量（控制并发数）
    const batchSize = 50; // 同时处理50个请求

    // 分批处理
    for (let i = 0; i < submissionsToProcess.length; i += batchSize) {
      const batch = submissionsToProcess.slice(i, i + batchSize);

      // 并行处理这一批
      const promises = batch.map(submission => {
        // 更新该提交的状态为处理中
        setBatchProcessStatus(prev => ({
          ...prev,
          [submission._id]: 'processing'
        }));

        // 开始AI评阅
        return processSubmission(submission);
      });

      // 等待这一批处理完成
      await Promise.all(promises);
    }

    // 处理完成后获取最新的提交数据
    if (selectedKeys.length === 4) {
      const [courseId, unitId, lessonId, activityId] = selectedKeys;
      try {
        const response = await courseManagementAPI.getTeacherSubmissions(
          courseId,
          unitId,
          lessonId,
          activityId
        );
        const data = response || [];

        setAllSubmissions(data);

        // 应用当前的筛选条件
        const filteredData = selectedClass
          ? data.filter(s => formatClassName(s.student?.grade, s.student?.className) === selectedClass)
          : data;

        setSubmissions(filteredData);
      } catch (error) {
        console.error('获取最新提交列表失败:', error);
      }
    }

    // 设置批量评阅为已完成状态
    setBatchAIRunning(false);
    setBatchAICompleted(true);
  };

  // 处理单个提交的AI评阅过程
  const processSubmission = async (submission) => {
    try {
      // 开始该学生的计时
      startTimer(submission._id);

      // 发送AI评阅请求
      const response = await courseManagementAPI.requestAIGrade(submission._id);

      if (response.success) {
        // 更新该提交的状态为成功
        setBatchProcessStatus(prev => ({
          ...prev,
          [submission._id]: 'success'
        }));

        // 更新成功数量和进度
        setBatchAIResults(prev => ({
          ...prev,
          success: prev.success + 1,
          processing: prev.processing - 1
        }));
      } else {
        // 更新该提交的状态为失败
        setBatchProcessStatus(prev => ({
          ...prev,
          [submission._id]: 'failed'
        }));

        // 更新失败数量和进度
        setBatchAIResults(prev => ({
          ...prev,
          failed: prev.failed + 1,
          processing: prev.processing - 1
        }));
      }

      // 更新总体进度
      setBatchAIProgress(prev => prev + 1);
    } catch (error) {
      console.error(`评阅${submission.student?.name}的作业失败:`, error);

      // 更新该提交的状态为失败
      setBatchProcessStatus(prev => ({
        ...prev,
        [submission._id]: 'failed'
      }));

      // 更新失败数量和进度
      setBatchAIResults(prev => ({
        ...prev,
        failed: prev.failed + 1,
        processing: prev.processing - 1
      }));

      // 更新总体进度
      setBatchAIProgress(prev => prev + 1);
    } finally {
      // 停止该学生的计时
      stopTimer(submission._id);
    }
  };

  // 渲染批量AI评阅对话框
  const renderBatchAIModal = () => {
    // 计算各类型作业的数量
    const counts = {
      ungraded: allSubmissions.filter(s => {
        const teacherScore = s.grade?.score;
        const aiScore = s.aiGrade?.score;
        return teacherScore === undefined && aiScore === undefined;
      }).length,

      aigraded: allSubmissions.filter(s => {
        const teacherScore = s.grade?.score;
        const aiScore = s.aiGrade?.score;
        return teacherScore === undefined && aiScore !== undefined;
      }).length,

      all: allSubmissions.length
    };

    // 如果有班级筛选，计算筛选后的数量
    const filteredCounts = selectedClass ? {
      ungraded: submissions.filter(s => {
        const teacherScore = s.grade?.score;
        const aiScore = s.aiGrade?.score;
        return teacherScore === undefined && aiScore === undefined;
      }).length,

      aigraded: submissions.filter(s => {
        const teacherScore = s.grade?.score;
        const aiScore = s.aiGrade?.score;
        return teacherScore === undefined && aiScore !== undefined;
      }).length,

      all: submissions.length
    } : counts;

    // 使用实际会处理的数量
    const displayCounts = selectedClass ? filteredCounts : counts;

    // 记录实际成功和失败的提交数量
    const finalResults = Object.values(batchProcessStatus).reduce(
      (acc, status) => {
        if (status === 'success') acc.success++;
        else if (status === 'failed') acc.failed++;
        return acc;
      },
      { success: 0, failed: 0 }
    );

    return (
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ThunderboltOutlined style={{ color: '#1890ff', marginRight: 8 }} />
            批量AI评阅Python作业
            {selectedClass && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedClass}</Tag>}
          </div>
        }
        open={batchAIModalVisible}
        onCancel={handleCloseBatchAIModal}
        footer={[
          <Button
            key="cancel"
            onClick={handleCloseBatchAIModal}
            disabled={batchAIRunning}
          >
            {batchAICompleted ? '完成' : '取消'}
          </Button>,
          !batchAICompleted && (
            <Button
              key="submit"
              type="primary"
              onClick={handleBatchAIGrade}
              loading={batchAIRunning}
              disabled={batchAIRunning}
            >
              开始评阅
            </Button>
          )
        ]}
        width={600}
      >
        <div>
          {!batchAICompleted && !batchAIRunning && (
            <div style={{ marginBottom: 16 }}>
              <Radio.Group
                value={batchAIType}
                onChange={e => setBatchAIType(e.target.value)}
                disabled={batchAIRunning}
              >
                <Space direction="vertical">
                  <Radio value="ungraded">
                    仅评阅未评分作业
                    <Tag color={displayCounts.ungraded > 0 ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                      {displayCounts.ungraded} 份
                    </Tag>
                  </Radio>
                  <Radio value="aigraded">
                    重新评阅已有AI评分的作业
                    <Tag color={displayCounts.aigraded > 0 ? 'cyan' : 'default'} style={{ marginLeft: 8 }}>
                      {displayCounts.aigraded} 份
                    </Tag>
                  </Radio>
                  <Radio value="all">
                    评阅{selectedClass ? '当前班级' : '所有'}作业
                    <Tag color={displayCounts.all > 0 ? 'green' : 'default'} style={{ marginLeft: 8 }}>
                      {displayCounts.all} 份
                    </Tag>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>
          )}

          {(batchAIRunning || batchAICompleted) && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>评阅进度：{batchAIProgress}/{batchAITotal}</span>
                <span>
                  <Tag color="green">成功: {batchAICompleted ? finalResults.success : batchAIResults.success}</Tag>
                  <Tag color="red">失败: {batchAICompleted ? finalResults.failed : batchAIResults.failed}</Tag>
                  {!batchAICompleted && (
                    <Tag color="blue">进行中: {batchAIResults.processing}</Tag>
                  )}
                </span>
              </div>
              <Progress
                percent={Math.round((batchAIProgress / batchAITotal) * 100)}
                status={batchAIProgress === batchAITotal ? 'success' : 'active'}
              />

              {batchAICompleted && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, color: '#52c41a', fontWeight: 'bold' }}>
                    批量评阅已完成
                  </div>
                  <div style={{ marginTop: 8 }}>
                    共处理 {batchAITotal} 份作业，成功 {finalResults.success} 份，失败 {finalResults.failed} 份
                  </div>
                </div>
              )}

              <div style={{
                marginTop: 16,
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid #f0f0f0',
                borderRadius: 4,
                padding: 8
              }}>
                {/* 只显示有处理状态的提交 */}
                {Object.entries(batchProcessStatus).map(([submissionId, status]) => {
                  // 从提交列表中找出对应的提交对象
                  const submission = [...allSubmissions].find(s => s._id === submissionId);
                  if (!submission) return null;

                  let statusTag;

                  if (status === 'pending') {
                    statusTag = <Tag>等待中</Tag>;
                  } else if (status === 'processing') {
                    statusTag = <Tag color="blue">处理中</Tag>;
                  } else if (status === 'success') {
                    statusTag = <Tag color="green">成功</Tag>;
                  } else if (status === 'failed') {
                    statusTag = <Tag color="red">失败</Tag>;
                  }

                  return (
                    <div key={submissionId} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{submission.student?.name} - {formatClassName(submission.student?.grade, submission.student?.className)}</span>
                      {statusTag}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
            注意：批量评阅将会同时发送多个请求，可能需要一些时间来完成所有评阅。
          </div>
        </div>
      </Modal>
    );
  };

  // 获取活动详情
  const fetchActivityDetails = async (lessonId, activityId) => {
    setLoadingActivityDetails(true);
    try {
      const response = await courseManagementAPI.getLesson(
        selectedKeys[0], // courseId
        selectedKeys[1], // unitId
        lessonId
      );

      if (response.success && response.data) {
        const activity = response.data.activities?.find(
          a => a._id === activityId
        );

        if (activity) {
          // 检查是否为Python作业
          const isPython = Array.isArray(activity.allowedFormats) &&
            activity.allowedFormats.some(format => format.toUpperCase() === 'PY');

          setIsPythonAssignment(isPython);
          setActivityDetails({
            description: activity.description || '',
            referenceAnswer: activity.referenceAnswer || ''
          });
        } else {
          message.warning('未找到活动信息');
          setIsPythonAssignment(false);
        }
      } else {
        message.error('获取活动详情失败');
        setIsPythonAssignment(false);
      }
    } catch (error) {
      console.error('获取活动详情失败:', error);
      message.error('获取活动详情失败');
      setIsPythonAssignment(false);
    } finally {
      setLoadingActivityDetails(false);
    }
  };

  // 更新活动详情
  const updateActivityDetails = async () => {
    if (!selectedKeys || selectedKeys.length !== 4) {
      message.warning('请先选择一个活动');
      return;
    }

    try {
      setLoadingActivityDetails(true);
      const [courseId, unitId, lessonId, activityId] = selectedKeys;

      const response = await courseManagementAPI.updateActivityDetails(
        lessonId,
        activityId,
        activityDetails
      );

      if (response.success) {
        message.success('更新活动详情成功');
        setEditingActivityDetails(false);
      } else {
        message.error(response.message || '更新活动详情失败');
      }
    } catch (error) {
      console.error('更新活动详情失败:', error);
      message.error('更新活动详情失败');
    } finally {
      setLoadingActivityDetails(false);
    }
  };

  // 处理活动详情变更
  const handleActivityDetailsChange = (field, value) => {
    setActivityDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 渲染活动详情设置抽屉
  const renderActivitySettingsDrawer = () => {
    return (
      <Drawer
        title={
          <Space>
            <SettingOutlined />
            <span>Python作业设置</span>
          </Space>
        }
        width={500}
        open={activitySettingsVisible}
        onClose={handleCloseActivitySettings}
        maskClosable={!loadingActivityDetails}
        extra={
          <Space>
            {editingActivityDetails ? (
              <>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={updateActivityDetails}
                  loading={loadingActivityDetails}
                >
                  保存
                </Button>
                <Button
                  onClick={() => setEditingActivityDetails(false)}
                  disabled={loadingActivityDetails}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button
                icon={<EditOutlined />}
                onClick={() => setEditingActivityDetails(true)}
                disabled={loadingActivityDetails}
              >
                编辑
              </Button>
            )}
          </Space>
        }
      >
        <Spin spinning={loadingActivityDetails}>
          <Form layout="vertical">
            <Form.Item label="活动描述">
              {editingActivityDetails ? (
                <TextArea
                  value={activityDetails.description}
                  onChange={e => handleActivityDetailsChange('description', e.target.value)}
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  placeholder="请输入活动描述"
                />
              ) : (
                <div style={{
                  border: '1px solid #f0f0f0',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  minHeight: '80px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: '#fafafa'
                }}>
                  {activityDetails.description || '暂无描述'}
                </div>
              )}
            </Form.Item>

            <Form.Item label="参考答案">
              {editingActivityDetails ? (
                <TextArea
                  value={activityDetails.referenceAnswer}
                  onChange={e => handleActivityDetailsChange('referenceAnswer', e.target.value)}
                  autoSize={{ minRows: 6, maxRows: 15 }}
                  placeholder="请输入参考答案（Python代码）"
                />
              ) : (
                <div>
                  {activityDetails.referenceAnswer ? (
                    <SyntaxHighlighter
                      language="python"
                      style={github}
                      showLineNumbers={true}
                      customStyle={{
                        margin: 0,
                        borderRadius: '4px',
                        maxHeight: '400px',
                        overflow: 'auto'
                      }}
                    >
                      {activityDetails.referenceAnswer}
                    </SyntaxHighlighter>
                  ) : (
                    <div style={{
                      border: '1px solid #f0f0f0',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      minHeight: '80px',
                      background: '#fafafa'
                    }}>
                      暂无参考答案
                    </div>
                  )}
                </div>
              )}
            </Form.Item>
          </Form>
        </Spin>
      </Drawer>
    );
  };

  // 更新活动详情设置抽屉的打开关闭逻辑
  const handleOpenActivitySettings = () => {
    shouldHandleShortcutsRef.current = false; // 禁用快捷键
    setActivitySettingsVisible(true);
  };

  const handleCloseActivitySettings = () => {
    if (!loadingActivityDetails) {
      setActivitySettingsVisible(false);
      if (editingActivityDetails) {
        setEditingActivityDetails(false);
      }
      // 延迟恢复快捷键，确保抽屉已完全关闭
      setTimeout(() => {
        shouldHandleShortcutsRef.current = true;
      }, 300);
    }
  };

  // 修改处理批量AI评阅对话框的打开和关闭
  const handleOpenBatchAIModal = () => {
    shouldHandleShortcutsRef.current = false; // 禁用快捷键
    setBatchAIModalVisible(true);
  };

  const handleCloseBatchAIModal = () => {
    if (!batchAIRunning) {
      setBatchAIModalVisible(false);
      // 如果已完成，重置完成状态以便下次使用
      if (batchAICompleted) {
        setBatchAICompleted(false);
        setBatchProcessStatus({});
      }
      // 延迟恢复快捷键，确保对话框已完全关闭
      setTimeout(() => {
        shouldHandleShortcutsRef.current = true;
      }, 300);
    }
  };

  // 批量下载处理函数
  const handleBatchDownload = async () => {
    if (!submissions || submissions.length === 0) {
      message.warning('没有可下载的作业');
      return;
    }

    // 过滤出有文件提交的记录
    const validSubmissions = submissions.filter(s => s.content && s.content.file);
    
    if (validSubmissions.length === 0) {
      message.warning('当前列表没有找到包含文件的作业');
      return;
    }

    setBatchDownloading(true);
    message.loading({ content: '正在打包下载，请稍候...', key: 'batchDownload' });
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;

      for (const submission of validSubmissions) {
        try {
          const student = submission.student || {};
          const grade = student.grade || '未知年级';
          const className = student.className || '未知班级';
          const username = student.username || student.studentId || student._id || '未知学号';
          const name = student.name || '未知姓名';
          const fileInfo = submission.content.file;
          
          // 获取扩展名
          let extension = '';
          if (fileInfo.originalName) {
             const parts = fileInfo.originalName.split('.');
             if (parts.length > 1) {
                 extension = '.' + parts.pop();
             }
          }
          
          // 构造文件名：xxxx(年级)-xx(班级)-xxxxx(学号 即登录用户名)-姓名.扩展名
          const newFileName = `${grade}-${className}-${username}-${name}${extension}`;
          
          const token = localStorage.getItem('token');
          let downloadUrl = '';
          if (fileInfo.url) {
            downloadUrl = fileInfo.url.startsWith('http') ? fileInfo.url : `${API_BASE_URL}${fileInfo.url}`;
          } else {
            downloadUrl = `/api/submissions/${submission._id}/download?token=${token}`;
          }
          
          // 添加 token 参数如果需要
          if (downloadUrl.indexOf('token=') === -1 && token) {
             downloadUrl += (downloadUrl.indexOf('?') === -1 ? '?' : '&') + `token=${token}`;
          }
          
          const response = await fetch(downloadUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${downloadUrl}`);
          }
          const blob = await response.blob();
          
          zip.file(newFileName, blob);
          successCount++;
        } catch (err) {
          console.error(`下载文件失败 [${submission._id}]:`, err);
          failCount++;
        }
      }

      if (successCount === 0) {
        message.error({ content: '所有文件下载失败', key: 'batchDownload', duration: 3 });
        return;
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `作业批量下载_${new Date().getTime()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success({ 
        content: `批量下载完成！成功: ${successCount}, 失败: ${failCount}`, 
        key: 'batchDownload', 
        duration: 3 
      });

    } catch (error) {
      console.error('批量下载失败:', error);
      message.error({ content: '打包下载失败', key: 'batchDownload', duration: 3 });
    } finally {
      setBatchDownloading(false);
    }
  };

  // 打开一键评分对话框
  const handleOpenBatchGradeModal = () => {
    shouldHandleShortcutsRef.current = false; // 禁用快捷键
    setBatchGradeModalVisible(true);
    setBatchGradeProgress(0);
    setBatchGradeTotal(0);
  };

  // 关闭一键评分对话框
  const handleCloseBatchGradeModal = () => {
    if (!batchGrading) {
      setBatchGradeModalVisible(false);
      setTimeout(() => {
        shouldHandleShortcutsRef.current = true;
      }, 300);
    }
  };

  // 获取待批改作业汇总
  const fetchPendingSummary = async () => {
    setPendingLoading(true);
    try {
      const response = await courseManagementAPI.getPendingAssignmentsSummary();
      if (response.success) {
        setPendingData(response.data || []);
        setTotalPending(response.totalPending || 0);
      }
    } catch (error) {
      console.error('获取待批改汇总失败:', error);
      message.error('获取待批改汇总失败');
    } finally {
      setPendingLoading(false);
    }
  };

  // 打开待批改总览抽屉
  const handleOpenPendingDrawer = () => {
    setPendingDrawerVisible(true);
    fetchPendingSummary();
  };

  // 关闭待批改总览抽屉
  const handleClosePendingDrawer = () => {
    setPendingDrawerVisible(false);
  };

  // 从待批改总览跳转到具体活动
  const handleJumpToActivity = (activity) => {
    const { courseId, unitId, lessonId, value: activityId } = activity;
    const newKeys = [courseId, unitId, lessonId, activityId];
    handleCascaderChange(newKeys);
    setPendingDrawerVisible(false);
  };

  // 渲染待批改总览抽屉
  const renderPendingDrawer = () => {
    // 获取活动类型对应的颜色和名称
    const getActivityTypeInfo = (type) => {
      const typeMap = {
        'flowchart': { color: 'purple', name: '流程图' },
        'python': { color: 'blue', name: 'Python' },
        'spreadsheet': { color: 'green', name: '在线表格' },
        'fillblank': { color: 'orange', name: '填空' },
        'html': { color: 'cyan', name: 'HTML' },
        'quiz': { color: 'magenta', name: '测验' }
      };
      return typeMap[type] || { color: 'default', name: '作业' };
    };

    return (
      <Drawer
        title={
          <Space>
            <FileSearchOutlined />
            <span>待批改作业总览</span>
            {totalPending > 0 && (
              <Tag color="orange" style={{ marginLeft: 8 }}>共 {totalPending} 份待批改</Tag>
            )}
          </Space>
        }
        width={500}
        open={pendingDrawerVisible}
        onClose={handleClosePendingDrawer}
        extra={
          <Button onClick={fetchPendingSummary} loading={pendingLoading}>
            刷新
          </Button>
        }
      >
        <Spin spinning={pendingLoading}>
          {pendingData.length === 0 ? (
            <Empty description="暂无待批改作业" />
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              {pendingData.map(course => (
                <div key={course.value} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 15,
                    padding: '8px 12px',
                    background: '#fafafa',
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{course.label}</span>
                    <Tag color="orange">{course.pendingCount}</Tag>
                  </div>
                  {course.children?.map(unit => (
                    <div key={unit.value} style={{ marginLeft: 12, marginTop: 8 }}>
                      <div style={{
                        color: '#666',
                        fontSize: 13,
                        marginBottom: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>📁 {unit.label}</span>
                        <Tag color="default">{unit.pendingCount}</Tag>
                      </div>
                      {unit.children?.map(lesson => (
                        <div key={lesson.value} style={{ marginLeft: 12 }}>
                          <div style={{ color: '#888', fontSize: 12, marginBottom: 2 }}>
                            📄 {lesson.label}
                          </div>
                          {lesson.children?.map(activity => {
                            const typeInfo = getActivityTypeInfo(activity.type);
                            return (
                              <div
                                key={activity.value}
                                onClick={() => handleJumpToActivity(activity)}
                                style={{
                                  marginLeft: 12,
                                  padding: '6px 12px',
                                  marginBottom: 4,
                                  background: '#fff7e6',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  border: '1px solid #ffe7ba',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#fff1b8';
                                  e.currentTarget.style.borderColor = '#ffd666';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#fff7e6';
                                  e.currentTarget.style.borderColor = '#ffe7ba';
                                }}
                              >
                                <Space size={4}>
                                  <Tag color={typeInfo.color} style={{ marginRight: 4 }}>{typeInfo.name}</Tag>
                                  <span style={{ fontSize: 13 }}>{activity.label}</span>
                                </Space>
                                <Tag color="red">{activity.pendingCount} 待批改</Tag>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Spin>
      </Drawer>
    );
  };

  // 获取当前未评阅的提交列表
  const getUngradedSubmissions = () => {
    let dataSource = [];

    if (isFlowchartActivity) {
      dataSource = flowchartSubmissions;
    } else if (isFillBlankActivity) {
      dataSource = fillBlankSubmissions;
    } else if (isSpreadsheetActivity) {
      dataSource = spreadsheetSubmissions;
    } else if (isPythonActivity) {
      dataSource = pythonSubmissions;
    } else {
      dataSource = submissions;
    }

    // 应用班级筛选
    if (selectedClass) {
      dataSource = dataSource.filter(s => {
        const student = s.student || s.studentId || s.userId;
        const grade = student?.grade || student?.classId?.grade;
        const className = student?.className || student?.classId?.name;
        return formatClassName(grade, className) === selectedClass;
      });
    }

    // 筛选未评阅的提交
    return dataSource.filter(s => {
      // 填空题：即使有自动评分，也需要教师评阅（可能有开放性问题）
      // 只有教师评阅后 status 才会变成 'graded'
      if (isFillBlankActivity) {
        return s.status !== 'graded';
      }
      // 其他活动类型 - 检查 null 和 undefined
      const teacherScore = s.grade?.score;
      const aiScore = s.aiGrade?.score;
      // 清除评分后 score 会是 null，所以需要同时检查 undefined 和 null
      return (teacherScore === undefined || teacherScore === null) && (aiScore === undefined || aiScore === null);
    });
  };

  // 执行一键评分
  const handleBatchGrade = async () => {
    const ungradedList = getUngradedSubmissions();
    if (ungradedList.length === 0) {
      message.info('没有需要评分的作业');
      return;
    }

    const score = gradeScoreMap[batchGradeScore];
    setBatchGrading(true);
    setBatchGradeTotal(ungradedList.length);
    setBatchGradeProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ungradedList.length; i++) {
      const submission = ungradedList[i];
      try {
        // 根据活动类型调用不同的评分API
        if (isFlowchartActivity) {
          await flowchartAPI.gradeSubmission(submission._id, score, '');
        } else if (isFillBlankActivity) {
          // 填空题使用 bonusScore 字段
          await fillBlankAPI.gradeSubmission(submission._id, score, '');
        } else if (isPythonActivity) {
          await pythonAPI.gradeSubmission(submission._id, score, '');
        } else if (isSpreadsheetActivity) {
          // 在线表格使用 courseManagementAPI
          await courseManagementAPI.gradeSubmission(submission._id, {
            grade: { score, feedback: '' }
          });
        } else {
          // 普通文件作业
          await courseManagementAPI.gradeSubmission(submission._id, {
            grade: { score, feedback: '' }
          });
        }
        successCount++;
      } catch (error) {
        console.error('批量评分失败:', error);
        failCount++;
      }
      setBatchGradeProgress(i + 1);
    }

    setBatchGrading(false);

    if (successCount > 0) {
      message.success(`成功评分 ${successCount} 份作业${failCount > 0 ? `，${failCount} 份失败` : ''}`);
    } else if (failCount > 0) {
      message.error(`评分失败 ${failCount} 份`);
    }

    // 刷新数据
    if (selectedKeys.length === 4) {
      const [courseId, unitId, lessonId, activityId] = selectedKeys;

      if (isFlowchartActivity) {
        const response = await flowchartAPI.getActivitySubmissions(lessonId, activityId);
        if (response.success) {
          const subs = response.data || [];
          setAllFlowchartSubmissions(subs);
          setFlowchartSubmissions(subs);
        }
      } else if (isPythonActivity) {
        const response = await pythonAPI.getActivitySubmissions(lessonId, activityId);
        if (response.success) {
          setPythonSubmissions(response.data || []);
        }
      } else if (isSpreadsheetActivity) {
        const response = await spreadsheetActivityAPI.getActivitySubmissions(lessonId, activityId);
        if (response.success) {
          setSpreadsheetSubmissions(response.data || []);
        }
      } else if (isFillBlankActivity) {
        const response = await fillBlankAPI.getActivitySubmissions(lessonId, activityId);
        if (response.success) {
          setFillBlankSubmissions(response.data || []);
        }
      } else {
        await fetchSubmissions(courseId, unitId, lessonId, activityId);
      }
    }

    setBatchGradeModalVisible(false);
    setTimeout(() => {
      shouldHandleShortcutsRef.current = true;
    }, 300);
  };

  // 渲染一键评分对话框
  const renderBatchGradeModal = () => {
    const ungradedCount = getUngradedSubmissions().length;
    const progressPercent = batchGradeTotal > 0 ? Math.round((batchGradeProgress / batchGradeTotal) * 100) : 0;

    return (
      <Modal
        title="一键评分"
        open={batchGradeModalVisible}
        onCancel={handleCloseBatchGradeModal}
        footer={[
          <Button key="cancel" onClick={handleCloseBatchGradeModal} disabled={batchGrading}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleBatchGrade}
            loading={batchGrading}
            disabled={ungradedCount === 0}
          >
            确认评分
          </Button>
        ]}
        maskClosable={!batchGrading}
        closable={!batchGrading}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            当前有 <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{ungradedCount}</span> 份未评阅作业
            {selectedClass && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedClass}</Tag>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#666' }}>选择评分等级：</div>
            <Radio.Group
              value={batchGradeScore}
              onChange={(e) => setBatchGradeScore(e.target.value)}
              disabled={batchGrading}
              style={{ width: '100%' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <Radio.Button value="A" style={{ textAlign: 'center' }}>A (10分)</Radio.Button>
                <Radio.Button value="B" style={{ textAlign: 'center' }}>B (8分)</Radio.Button>
                <Radio.Button value="C" style={{ textAlign: 'center' }}>C (6分)</Radio.Button>
                <Radio.Button value="D" style={{ textAlign: 'center' }}>D (4分)</Radio.Button>
                <Radio.Button value="E" style={{ textAlign: 'center' }}>E (2分)</Radio.Button>
                <Radio.Button value="F" style={{ textAlign: 'center' }}>F (0分)</Radio.Button>
              </div>
            </Radio.Group>
          </div>

          {batchGrading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8, color: '#666' }}>
                评分进度: {batchGradeProgress} / {batchGradeTotal}
              </div>
              <div style={{
                height: '8px',
                background: '#f0f0f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: '#52c41a',
                  borderRadius: '4px',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  };


  return (
    <div style={{ padding: '12px' }}>
      {/* 选择器区域 - 使用 flex 布局，待批改总览按钮靠右 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Space>
          <Cascader
            options={options}
            value={selectedKeys}
            onChange={handleCascaderChange}
            placeholder="请选择课程/单元/课时/作业"
            style={{ width: '400px' }}
            changeOnSelect={false}
            expandTrigger="click"
          />
          <Select
            placeholder="选择班级"
            style={{ width: 150 }}
            onChange={handleClassChange}
            value={selectedClass}
            allowClear
            options={classOptions.map(c => ({ label: c, value: c }))}
          />
          <Space>
            <span>只看未评:</span>
            <Switch
              checked={showingUngraded}
              onChange={handleViewUngraded}
              size="small"
            />
          </Space>

          {/* 添加作业设置按钮 */}
          {selectedKeys.length === 4 && isPythonAssignment && (
            <Button
              icon={<SettingOutlined />}
              onClick={handleOpenActivitySettings}
            >
              作业设置
            </Button>
          )}

          {/* 添加一键AI评阅按钮 */}
          {selectedKeys.length === 4 && isPythonAssignment && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleOpenBatchAIModal}
            >
              一键AI评阅
            </Button>
          )}

          {/* 添加一键评分按钮 */}
          {selectedKeys.length === 4 && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleOpenBatchGradeModal}
            >
              一键评分
            </Button>
          )}

          {/* 批量下载按钮 */}
          {selectedKeys.length === 4 && (isPptActivity || isExcelActivity) && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleBatchDownload}
              loading={batchDownloading}
            >
              批量下载
            </Button>
          )}

          <Button onClick={clearFilters}>重置筛选</Button>
        </Space>

        {/* 待批改总览按钮 - 靠右显示 */}
        <Button
          icon={<FileSearchOutlined />}
          onClick={handleOpenPendingDrawer}
          style={{ background: totalPending > 0 ? '#fff7e6' : undefined, borderColor: totalPending > 0 ? '#ffc53d' : undefined }}
        >
          待批改总览 {totalPending > 0 && <Tag color="orange" style={{ marginLeft: 4 }}>{totalPending}</Tag>}
        </Button>
      </div>


      {/* 渲染批量AI评阅对话框 */}
      {renderBatchAIModal()}

      {/* 渲染一键评分对话框 */}
      {renderBatchGradeModal()}

      {/* 渲染活动设置抽屉 */}
      {renderActivitySettingsDrawer()}

      {/* 渲染待批改总览抽屉 */}
      {renderPendingDrawer()}

      {selectedKeys.length === 4 && (
        <>
          {/* 统计信息区域 */}
          {(isFlowchartActivity ? flowchartSubmissions.length > 0 :
            isFillBlankActivity ? fillBlankSubmissions.length > 0 :
              allSubmissions.length > 0) && renderStatistics()}

          {/* 流程图批阅区域 */}
          {isFlowchartActivity ? (
            <div style={{ marginTop: '20px' }}>
              <FlowchartReview
                submissions={flowchartSubmissions}
                onRefresh={(submissionId, grade) => {
                  if (submissionId && grade) {
                    setFlowchartSubmissions(prev =>
                      prev.map(s => s._id === submissionId ? { ...s, grade, status: 'graded' } : s)
                    );
                  }
                }}
                formatClassName={formatClassName}
                gradingState={fillBlankGrading}
                onUpdateGradingState={(id, updates) => setFillBlankGrading(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
              />
            </div>
          ) : isHtmlActivity ? (
            <div style={{ marginTop: '20px' }}>
              <HtmlReview
                projects={htmlProjects}
                submissions={submissions}
                onRefresh={(submissionId, grade) => {
                  // Refresh projects (for status changes)
                  htmlProjectAPI.getProjectsByLesson(selectedKeys[2], selectedKeys[3]).then(res => setHtmlProjects(res.data || []));

                  // Update local submission state if graded
                  if (submissionId && grade) {
                    const updateList = (list) => list.map(s => s._id === submissionId ? { ...s, grade, status: 'graded' } : s);
                    setSubmissions(prev => updateList(prev));
                    setAllSubmissions(prev => updateList(prev));
                  }
                }}
                formatClassName={formatClassName}
                loading={loading}
                gradingState={fillBlankGrading} // Reuse fillBlankGrading state for simplicity or create new one? reusing is fine as it's just ID -> loading/score map
                onUpdateGradingState={(id, updates) => setFillBlankGrading(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
              />
            </div>
          ) : isSpreadsheetActivity ? (
            <div style={{ marginTop: '20px' }}>
              {spreadsheetSubmissions.length === 0 ? (
                <Empty description="暂无提交记录" />
              ) : (
                <Row gutter={16}>
                  {/* 学生列表 */}
                  <Col span={4}>
                    <Card
                      title="学生列表"
                      size="small"
                      bodyStyle={{ maxHeight: 500, overflowY: 'auto', padding: 0 }}
                    >
                      {spreadsheetSubmissions.map((item, index) => (
                        <div
                          key={item._id}
                          onClick={() => handleSelectSpreadsheetSubmission(item, index)}
                          style={{
                            cursor: 'pointer',
                            padding: '8px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: spreadsheetCurrentIndex === index ? '#e6f7ff' : 'transparent',
                            borderLeft: spreadsheetCurrentIndex === index ? '3px solid #1890ff' : '3px solid transparent'
                          }}
                        >
                          <Space>
                            <Tag color={item.status === 'graded' ? 'green' : 'blue'} style={{ margin: 0 }}>
                              {item.status === 'graded' ? '已批' : '待批'}
                            </Tag>
                            <span>{item.userId?.name || '未知学生'}</span>
                          </Space>
                          {item.grade?.score !== undefined && (
                            <Tag color={item.grade.score >= 6 ? 'green' : 'red'}>
                              {item.grade.score}分
                            </Tag>
                          )}
                        </div>
                      ))}
                    </Card>
                  </Col>

                  {/* 表格预览 */}
                  <Col span={14}>
                    <Card
                      title={
                        <Space>
                          <span>学生在线表格</span>
                          {selectedSpreadsheetSubmission && (
                            <Tag color="blue">
                              {selectedSpreadsheetSubmission.userId?.name || '未知学生'}
                            </Tag>
                          )}
                        </Space>
                      }
                      extra={
                        <Space>
                          <Button
                            icon={<LeftOutlined />}
                            onClick={handleSpreadsheetPrev}
                            disabled={spreadsheetCurrentIndex <= 0}
                          />
                          <span>{spreadsheetCurrentIndex + 1} / {spreadsheetSubmissions.length}</span>
                          <Button
                            icon={<RightOutlined />}
                            onClick={handleSpreadsheetNext}
                            disabled={spreadsheetCurrentIndex >= spreadsheetSubmissions.length - 1}
                          />
                        </Space>
                      }
                    >
                      {selectedSpreadsheetSubmission ? (
                        <div style={{ height: 600 }}>
                          <SpreadsheetEditor
                            data={selectedSpreadsheetSubmission.spreadsheetData}
                            readOnly={true}
                          />
                        </div>
                      ) : (
                        <Empty description="请选择学生查看在线表格" />
                      )}
                    </Card>
                  </Col>

                  {/* 评分面板 */}
                  <Col span={6}>
                    <Card title="评分" size="small">
                      {selectedSpreadsheetSubmission ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {/* 快捷评分按钮 */}
                          <div>
                            <div style={{ marginBottom: 8, color: '#666' }}>快捷评分：</div>
                            <Radio.Group
                              value={Object.entries(gradeScoreMap).find(
                                ([_, score]) => score === spreadsheetScore
                              )?.[0]}
                              onChange={(e) => handleSpreadsheetQuickGrade(e.target.value)}
                              optionType="button"
                              buttonStyle="solid"
                            >
                              <Radio.Button value="A">A</Radio.Button>
                              <Radio.Button value="B">B</Radio.Button>
                              <Radio.Button value="C">C</Radio.Button>
                              <Radio.Button value="D">D</Radio.Button>
                              <Radio.Button value="E">E</Radio.Button>
                              <Radio.Button value="F">F</Radio.Button>
                            </Radio.Group>
                          </div>

                          <Divider style={{ margin: '12px 0' }} />

                          {/* 分数输入 */}
                          <div>
                            <div style={{ marginBottom: 8, color: '#666' }}>分数 (0-10)：</div>
                            <InputNumber
                              min={0}
                              max={10}
                              value={spreadsheetScore}
                              onChange={setSpreadsheetScore}
                              style={{ width: '100%' }}
                            />
                          </div>

                          {/* 评语输入 */}
                          <div>
                            <div style={{ marginBottom: 8, color: '#666' }}>评语：</div>
                            <TextArea
                              rows={3}
                              value={spreadsheetFeedback}
                              onChange={e => setSpreadsheetFeedback(e.target.value)}
                              placeholder="输入评语（可选）"
                            />
                          </div>

                          {/* 保存按钮 */}
                          <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSpreadsheetGrade}
                            loading={spreadsheetGrading}
                            style={{ width: '100%' }}
                          >
                            提交评分
                          </Button>
                        </Space>
                      ) : (
                        <Empty description="请选择学生" />
                      )}
                    </Card>
                  </Col>
                </Row>
              )}
            </div>
          ) : isFillBlankActivity ? (
            /* 填空批阅区域 - 全班学生在一个页面 */
            <div style={{ marginTop: '20px' }}>
              <FillBlankReview
                submissions={fillBlankSubmissions.filter(s => {
                  if (!selectedClass) return true;
                  // 兼容不同数据结构
                  const student = s.student || s.studentId;
                  const grade = student?.grade || student?.classId?.grade;
                  const className = student?.className || student?.classId?.name;
                  return formatClassName(grade, className) === selectedClass;
                })}
                gradingState={fillBlankGrading}
                onUpdateGradingState={(id, updates) => setFillBlankGrading(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
                onRefresh={(id, grade) => setFillBlankSubmissions(prev => prev.map(s =>
                  s._id === id ? { ...s, grade, status: 'graded' } : s
                ))}
                formatClassName={formatClassName}
              />
            </div>
          ) : isPptActivity ? (
            /* PPT作业批阅区域 */
            <div style={{ marginTop: '20px' }}>
              <PptReview
                submissions={submissions}
                onRefresh={(id, grade) => {
                  const updateList = (list) => list.map(s =>
                    s._id === id ? { ...s, grade: { ...grade, source: grade.source || (grade.pptAutoGrade ? 'ppt_auto' : 'manual') },
                      ...(grade.score == null ? { pptAutoGrade: null } : grade.pptAutoGrade ? { pptAutoGrade: grade.pptAutoGrade } : {}),
                      status: grade.score == null ? 'submitted' : 'graded' } : s
                  );
                  setSubmissions(prev => updateList(prev));
                  setAllSubmissions(prev => updateList(prev));
                }}
                formatClassName={formatClassName}
                gradingState={pptGradingState}
                onUpdateGradingState={(id, updates) => setPptGradingState(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
                onDownload={handleDownload}
                sortMode={sortMode}
                onSortChange={handleSortChange}
              />
            </div>
          ) : isWordActivity ? (
            /* Word作业批阅区域 */
            <div style={{ marginTop: '20px' }}>
              <WordReview
                submissions={submissions}
                onRefresh={(id, grade) => {
                  const updateList = (list) => list.map(s =>
                    s._id === id ? { ...s, grade, status: 'graded' } : s
                  );
                  setSubmissions(prev => updateList(prev));
                  setAllSubmissions(prev => updateList(prev));
                }}
                formatClassName={formatClassName}
                gradingState={wordGradingState}
                onUpdateGradingState={(id, updates) => setWordGradingState(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
                onDownload={handleDownload}
                sortMode={sortMode}
                onSortChange={handleSortChange}
              />
            </div>
          ) : isExcelActivity ? (
            /* Excel作业批阅区域 */
            <div style={{ marginTop: '20px' }}>
              <ExcelReview
                submissions={submissions}
                onRefresh={(id, grade) => {
                  const updateList = (list) => list.map(s =>
                    s._id === id ? { ...s, grade: { ...grade, source: grade.source || (grade.excelAutoGrade ? 'excel_auto' : 'manual') },
                      ...(grade.score == null ? { excelAutoGrade: null } : grade.excelAutoGrade ? { excelAutoGrade: grade.excelAutoGrade } : {}),
                      status: grade.score == null ? 'submitted' : 'graded' } : s
                  );
                  setSubmissions(prev => updateList(prev));
                  setAllSubmissions(prev => updateList(prev));
                }}
                formatClassName={formatClassName}
                gradingState={excelGradingState}
                onUpdateGradingState={(id, updates) => setExcelGradingState(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
                onDownload={handleDownload}
                sortMode={sortMode}
                onSortChange={handleSortChange}
              />
            </div>
          ) : isPythonActivity ? (
            /* Python编程活动批阅区域 */
            <div style={{ marginTop: '20px' }}>
              <PythonReview
                submissions={pythonSubmissions.filter(s => {
                  if (!selectedClass) return true;
                  const student = s.studentId;
                  const grade = student?.classId?.grade;
                  const className = student?.classId?.name;
                  return formatClassName(grade, className) === selectedClass;
                })}
                onRefresh={(id, grade) => {
                  setPythonSubmissions(prev => prev.map(s =>
                    s._id === id ? { ...s, score: grade.score, feedback: grade.feedback, gradedAt: grade.gradedAt } : s
                  ));
                }}
                formatClassName={formatClassName}
                gradingState={pythonGradingState}
                onUpdateGradingState={(id, updates) => setPythonGradingState(prev => ({
                  ...prev,
                  [id]: { ...prev[id], ...updates }
                }))}
                sortMode={sortMode}
                onSortChange={handleSortChange}
              />
            </div>
          ) : isQuizActivity ? (
            /* 测验活动批阅区域 */
            <div style={{ marginTop: '20px' }}>
              <QuizReview
                quizId={currentQuizId}
                activityId={currentActivityId}
                lessonId={selectedKeys[2]}
                formatClassName={formatClassName}
                selectedClass={selectedClass}
                onClassOptionsLoaded={(classes) => setClassOptions(classes)}
                onRefresh={() => {
                  // 可选：刷新数据后的回调
                }}
              />
            </div>
          ) : (
            /* 文件预览区域 */
            <div style={{ position: 'relative', marginTop: '20px', height: 'calc(100vh - 200px)' }}>
              {previewUrl || codeContent !== null ? (
                <>
                  {selectedSubmission && (
                    <div style={{
                      padding: '10px',
                      backgroundColor: '#fafafa',
                      marginBottom: '10px',
                      borderRadius: '4px'
                    }}>
                      <Space>
                        <Space>
                          <strong>当前批阅：</strong>
                          {selectedSubmission.student.name}
                          ({formatClassName(selectedSubmission.student.grade, selectedSubmission.student.className)})
                          {selectedSubmission.student.studentId && ` - ${selectedSubmission.student.studentId}`}
                        </Space>
                        <Divider type="vertical" />
                        <Radio.Group
                          value={Object.entries(gradeScoreMap).find(
                            ([_, score]) => score === selectedSubmission.grade?.score
                          )?.[0]}
                          onChange={(e) => handleGradeChange(e.target.value, selectedSubmission)}
                          optionType="button"
                          buttonStyle="solid"
                          size="middle"
                        >
                          <Radio.Button value="A">A</Radio.Button>
                          <Radio.Button value="B">B</Radio.Button>
                          <Radio.Button value="C">C</Radio.Button>
                          <Radio.Button value="D">D</Radio.Button>
                          <Radio.Button value="E">E</Radio.Button>
                          <Radio.Button value="F">F</Radio.Button>
                        </Radio.Group>
                        <Input.TextArea
                          value={tempFeedback[selectedSubmission._id] !== undefined ? tempFeedback[selectedSubmission._id] : selectedSubmission.grade?.feedback || ''}
                          autoSize={{ minRows: 1, maxRows: 2 }}
                          onChange={(e) => handleFeedbackInputChange(e.target.value, selectedSubmission._id)}
                          onBlur={(e) => handleFeedbackBlur(e.target.value, selectedSubmission)}
                          placeholder="评价"
                          style={{ width: '300px' }}
                        />
                        <Tooltip title="下载原文件">
                          <Button
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload(selectedSubmission.content.file)}
                          >
                            下载原文件
                          </Button>
                        </Tooltip>
                        <Tooltip title="清除所有评分和评语">
                          <Button
                            danger
                            onClick={() => handleClearGrade(selectedSubmission)}
                          >
                            清除评分
                          </Button>
                        </Tooltip>
                        <Tooltip title={
                          <div style={{ padding: '8px 0' }}>
                            <div style={{ marginBottom: '8px' }}>
                              <b>快捷键说明：</b>
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              切换学生：← →
                            </div>
                            <div>
                              评分：1=A, 2=B, 3=C, 4=D, 5=E, 6=F
                            </div>
                          </div>
                        }>
                          <Button type="text" icon={<QuestionCircleOutlined />} />
                        </Tooltip>
                      </Space>
                    </div>
                  )}
                  <div style={{
                    height: 'calc(100% - 60px)',
                    display: 'flex',
                    gap: '10px'
                  }}>
                    {/* 左侧学生列表 */}
                    <div style={{
                      width: '150px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '4px',
                      padding: '8px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      msOverflowStyle: 'none', /* IE and Edge */
                      scrollbarWidth: 'none',  /* Firefox */
                    }}
                      ref={studentListRef} // 添加引用
                    >
                      {/* 为Firefox之外的浏览器隐藏滚动条 */}
                      <style>
                        {`
                          /* 为Chrome, Safari和Opera隐藏滚动条 */
                          div[ref="studentListRef"]::-webkit-scrollbar {
                            display: none;
                          }
                        `}
                      </style>
                      <div style={{
                        fontWeight: 'bold',
                        padding: '4px 0',
                        borderBottom: '1px solid #eee',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>学生列表 ({submissions.length})</span>
                        <Button 
                            type="text" 
                            size="small" 
                            onClick={handleSortChange}
                            icon={<SortAscendingOutlined style={{ 
                                transform: sortMode === 'desc' ? 'rotate(180deg)' : 'none',
                                color: sortMode !== 'none' ? '#1890ff' : 'inherit'
                            }}/>}
                            title="切换排序 (默认/降序/升序)"
                        />
                      </div>
                      {submissions.map((submission, index) => {
                        // 优先使用教师评分，其次使用AI评分
                        const teacherScore = submission.grade?.score;
                        const aiScore = submission.aiGrade?.score;
                        const score = teacherScore !== undefined ? teacherScore : aiScore;
                        const isAiGraded = teacherScore === undefined && aiScore !== undefined;

                        const backgroundColor = getScoreColor(score);
                        const borderColor = getScoreBorderColor(score);
                        const isSelected = index === currentPreviewIndex;

                        return (
                          <div
                            key={submission._id}
                            data-index={index} // 添加索引属性用于滚动定位
                            onClick={() => handlePreview(submission, index)}
                            style={{
                              padding: '12px',
                              backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                              borderLeft: isSelected ? '3px solid #1890ff' : '3px solid transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '8px',
                              borderRadius: '4px',
                              boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.09)' : 'none',
                              transition: 'all 0.3s'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold' }}>
                                {submission.student?.name || '未知学生'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {formatClassName(
                                  submission.student?.grade,
                                  submission.student?.className
                                )}
                              </div>
                            </div>

                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor,
                              border: `2px solid ${borderColor}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: getScoreTextColor(score),
                              fontWeight: 'bold',
                              position: 'relative'
                            }}>
                              {score !== undefined ? (
                                <>
                                  {Object.entries(gradeScoreMap).find(([_, s]) => s === score)?.[0]}
                                  {isAiGraded && (
                                    <div style={{
                                      position: 'absolute',
                                      top: -5,
                                      right: -5,
                                      backgroundColor: '#1890ff',
                                      borderRadius: '50%',
                                      width: '16px',
                                      height: '16px',
                                      fontSize: '10px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff'
                                    }}>
                                      AI
                                    </div>
                                  )}
                                </>
                              ) : '?'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 中间内容区域 */}
                    {codeContent !== null ? ( // 使用 codeContent !== null 判断是否显示代码编辑器
                      <>
                        <div style={{
                          flex: 3,
                          overflow: 'auto',
                          backgroundColor: '#f5f5f5',
                          padding: '20px',
                          borderRadius: '4px'
                        }}>
                          <SyntaxHighlighter
                            language="python"
                            style={github}
                            showLineNumbers={true}
                            customStyle={{
                              margin: 0,
                              minHeight: '100%'
                            }}
                          >
                            {codeContent || '# 空文件 - 学生提交了一个空的Python文件'}
                          </SyntaxHighlighter>
                        </div>

                        {/* 右侧 AI 评阅面板 */}
                        {selectedSubmission && (
                          <div style={{
                            flex: 2,
                            backgroundColor: '#fff',
                            border: '1px solid #f0f0f0',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            {renderAIGradePanel(selectedSubmission.aiGrade)}
                          </div>
                        )}
                      </>
                    ) : previewUrl ? ( // 如果是PDF等其他文件
                      <iframe
                        src={previewUrl}
                        style={{
                          flex: 5, // 占据更多空间，因为没有AI面板
                          border: 'none',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px'
                        }}
                        type="application/pdf"
                        title="PDF预览"
                      />
                    ) : null /* 处理理论上不存在的情况 */}
                  </div>
                </>
              ) : (
                <Empty description="请选择要预览的作业" style={{ marginTop: '20%' }} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AssignmentReview; 