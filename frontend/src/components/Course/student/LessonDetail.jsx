import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, List, Collapse, message, Modal, Tabs, Steps, Tag, Space, Button, Row, Col, Layout, Table, Empty, Spin, Menu, Image, Alert, Divider } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import usePageTitle from '../../../hooks/usePageTitle';
import {
  PlayCircleOutlined,
  BookOutlined,
  FileTextOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  RightOutlined,
  FormOutlined,
  ReadOutlined,
  VideoCameraOutlined,
  CommentOutlined,
  RobotOutlined,
  ArrowLeftOutlined,
  DownloadOutlined,
  HistoryOutlined,
  EditOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FileOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  HtmlOutlined,
  ExportOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { courseManagementAPI, API_BASE_URL, typingAPI, quizAPI, classAPI, flowchartAPI, spreadsheetActivityAPI, fillBlankAPI, pythonAPI } from '../../../services/api';
import AssignmentSubmission from './AssignmentSubmission';
import AutoGradeFeedback from './AutoGradeFeedback';
import { isManualGrade, getAutoGrade } from '../../../utils/submissionGrading';
import TypingPractice from '../../Typing/TypingPractice';
import MxGraphEditor from '../../mxgraph/MxGraphEditor';
import SpreadsheetEditor from '../../Spreadsheet/SpreadsheetEditor';
import 'react-quill/dist/quill.snow.css';
import './LessonDetail.css';
import CourseAIHelper from './CourseAIHelper';
import _ from 'lodash';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import Quiz from '../../Quiz/student/Quiz';
import MarkdownRenderer from '../../../components/shared/MarkdownRenderer';
import FillBlankActivity from './FillBlankActivity';
import PythonActivity from './PythonActivity';

// 注册 Python 语言支持
SyntaxHighlighter.registerLanguage('python', python);

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TabPane } = Tabs;
const { Content, Sider } = Layout;

// 修改活动类型图标映射
const activityIcons = {
  video: <VideoCameraOutlined style={{ color: '#1890ff', fontSize: '16px' }} />,
  reading: <ReadOutlined style={{ color: '#52c41a', fontSize: '16px' }} />,
  quiz: <FormOutlined style={{ color: '#722ed1', fontSize: '16px' }} />,
  practice: <CodeOutlined style={{ color: '#fa8c16', fontSize: '16px' }} />,
  discussion: <CommentOutlined style={{ color: '#13c2c2', fontSize: '16px' }} />,
  typing: <EditOutlined style={{ color: '#eb2f96', fontSize: '16px', transform: 'rotate(90deg)' }} />,
  flowchart: <FileTextOutlined style={{ color: '#eb2f96', fontSize: '16px' }} />,
  spreadsheet: <FileExcelOutlined style={{ color: '#52c41a', fontSize: '16px' }} />,
  html: <CodeOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />,
  fillblank: <EditOutlined style={{ color: '#fa541c', fontSize: '16px' }} />,
  python: <CodeOutlined style={{ color: '#3776ab', fontSize: '16px' }} />
};

// 修改活动类型的中文映射
const activityTypeLabels = {
  video: '视频',
  reading: '阅读',
  quiz: '测验',
  practice: '练习',
  discussion: '讨论',
  typing: '打字练习',
  flowchart: '流程图',
  spreadsheet: '在线表格',
  html: 'HTML网页',
  fillblank: '填空',
  python: 'Python编程'
};

// 添加自定义AI图标组件
const AIIcon = ({ style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    version="1.1"
    width="24"
    height="20"
    viewBox="0 0 13.5 14.399999618530273"
    style={style}
  >
    <defs>
      <linearGradient
        x1="0.8993133306503296"
        y1="-0.04394836351275444"
        x2="0.24075928330421448"
        y2="0.9298340082168579"
        id="master_svg0_2366_01267"
      >
        <stop offset="0.6084760185331106%" stopColor="#FF768D" stopOpacity="1"></stop>
        <stop offset="67.67439842224121%" stopColor="#2D6AE2" stopOpacity="1"></stop>
        <stop offset="99.99993443489075%" stopColor="#78ABF5" stopOpacity="1"></stop>
      </linearGradient>
    </defs>
    <g>
      <path
        d="M0.562939,5.79672L0,6.67106L0.498614,7.68384Q4.43568,7.64845,6.40421,7.63077Q5.87699,8.45156,4.82261,10.0931L5.29349,11.1148L6.36982,11.1148Q7.45928,9.42212,8.00398,8.57582Q8.92542,10.5172,10.7683,14.4L11.8277,14.4L12.3792,13.5484L9.59079,7.59611L12.9485,7.56694Q13.3162,7.00327,13.5,6.72144Q13.3382,6.37966,13.0147,5.69608L9.86061,5.73569L12.8984,1.00212L12.4135,0L11.3691,0L8.26666,4.77933L6.75,1.59439L5.70514,1.59439L5.14402,2.45869L6.69809,5.76079L0.562939,5.79672Z"
        fillRule="evenodd"
        fill="url(#master_svg0_2366_01267)"
        fillOpacity="1"
      ></path>
    </g>
  </svg>
);

// 修改SelectionPopup组件
const SelectionPopup = ({ position, onAskAI, onClose }) => {
  if (!position) return null;

  return (
    <Button
      onClick={onAskAI}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        background: '#fff',
        borderColor: '#e8e8e8',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 16px',
        height: '36px',
        borderRadius: '18px',
        transform: 'translateX(-50%)',
        animation: 'fadeIn 0.2s ease-in-out',
        zIndex: 1000,
        color: '#595959',
        transition: 'all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#fafafa';
        e.currentTarget.style.borderColor = '#d9d9d9';
        e.currentTarget.style.transform = 'translateX(-50%) translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#fff';
        e.currentTarget.style.borderColor = '#e8e8e8';
        e.currentTarget.style.transform = 'translateX(-50%)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.08)';
      }}
    >
      <AIIcon style={{ fontSize: '16px' }} />
      <span>询问AI助手</span>
    </Button>
  );
};

// 修改动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;
document.head.appendChild(styleSheet);

const LessonDetail = ({ lessonId, courseId, unitId, initialActivityId = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExercise, setShowExercise] = useState(false);
  const [currentExercise, setCurrentExercise] = useState(null);
  const [currentActivity, setCurrentActivity] = useState(0);
  const [activities, setActivities] = useState([]);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [submissionHistoryMap, setSubmissionHistoryMap] = useState({});
  const [uploadingActivityId, setUploadingActivityId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [currentSubmissionCode, setCurrentSubmissionCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(() => {
    const savedTask = localStorage.getItem(`lesson-${lessonId}-selected-task`);
    return savedTask || 'activity-0';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [typingRecord, setTypingRecord] = useState(null);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [quizSubmissionMap, setQuizSubmissionMap] = useState({});
  const [flowchartSubmissionMap, setFlowchartSubmissionMap] = useState({});
  const [spreadsheetSubmissionMap, setSpreadsheetSubmissionMap] = useState({}); // 表格提交记录
  const [fillBlankSubmissionMap, setFillBlankSubmissionMap] = useState({}); // 填空提交记录
  const [pythonSubmissionMap, setPythonSubmissionMap] = useState({}); // Python提交记录
  const [currentSpreadsheetSubmission, setCurrentSpreadsheetSubmission] = useState(null); // 当前选中的表格提交记录
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState('');
  const [htmlPreviewTitle, setHtmlPreviewTitle] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [allowAiUsage, setAllowAiUsage] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imagePreviewTitle, setImagePreviewTitle] = useState('');
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoPreviewTitle, setVideoPreviewTitle] = useState('');
  const [showTeachPanel, setShowTeachPanel] = useState(false);
  const [teachQuizDetails, setTeachQuizDetails] = useState(null);
  const [teachQuestions, setTeachQuestions] = useState([]);
  const [teachCurrentIndex, setTeachCurrentIndex] = useState(0);
  const [teachLoading, setTeachLoading] = useState(false);
  const [teachShowAnswers, setTeachShowAnswers] = useState(false);

  // 教师模拟学生模式检测
  const isSimulation = new URLSearchParams(location.search).get('mode') === 'simulation';
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isTeacherSimulation = isSimulation && currentUser?.role === 'teacher';

  // 打开讲题模式
  const handleToggleTeachPanel = async (activity) => {
    try {
      if (!activity?.quizSettings?.quiz) {
        message.error('未配置测验');
        return;
      }
      const willOpen = !showTeachPanel;
      setShowTeachPanel(willOpen);
      if (willOpen) {
        setTeachLoading(true);
        setTeachCurrentIndex(0);
        setTeachShowAnswers(false);
        // 拉取测验详情
        const quiz = activity.quizSettings.quiz;
        const quizId = typeof quiz === 'object' ? quiz._id : quiz;
        const resp = await quizAPI.quizzes.getById(quizId);
        const quizData = resp.data || resp;
        // 规范化题目结构（与 Quiz.jsx 中一致）
        let questions = (quizData.questions || []).map(q => {
          if (!q.questionId) return null;
          const questionIdIsObject = typeof q.questionId === 'object' && q.questionId !== null;
          if (!questionIdIsObject) {
            return {
              _id: q._id,
              order: q.order,
              type: 'SINGLE_CHOICE',
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
        }).filter(Boolean).sort((a, b) => a.order - b.order);

        setTeachQuizDetails(quizData);
        setTeachQuestions(questions);
      }
    } catch (error) {
      message.error('加载测验详情失败');
    } finally {
      setTeachLoading(false);
    }
  };

  const handleTeachPrev = () => setTeachCurrentIndex(prev => Math.max(0, prev - 1));
  const handleTeachNext = () => setTeachCurrentIndex(prev => Math.min(teachQuestions.length - 1, prev + 1));

  // 使用自定义Hook设置页面标题
  usePageTitle(lesson?.title);

  // 获取班级AI使用权限设置
  useEffect(() => {
    const fetchClassSettings = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.id) {
          console.error('用户未登录或ID不存在');
          return;
        }

        const classSettings = await classAPI.getUserClassSettings(user.id);
        setAllowAiUsage(classSettings.allowAiUsage);
      } catch (error) {
        console.error('获取班级设置失败:', error);
      }
    };

    fetchClassSettings();
  }, []);

  // 修改菜单项配置
  const menuItems = [
    ...activities.map((activity, index) => {
      if (!activity.isPublished) return null; // 过滤未发布的活动

      // 作业提交状态判断
      const hasSubmission = activity.requireSubmission && submissionHistoryMap[activity._id]?.length > 0;
      const hasGrade = hasSubmission &&
        ((submissionHistoryMap[activity._id][0]?.grade?.score !== undefined) ||
          (submissionHistoryMap[activity._id][0]?.aiGrade?.score !== undefined));

      // 打字活动状态判断
      const isTypingActivity = activity.type === 'typing';
      const hasTypingRecord = isTypingActivity && submissionHistoryMap[activity._id]?.hasRecord === true;

      // 测验活动状态判断
      const isQuizActivity = activity.type === 'quiz';
      const hasQuizSubmission = isQuizActivity && quizSubmissionMap[activity._id]?.hasSubmission === true;

      // 流程图活动状态判断
      const isFlowchartActivity = activity.type === 'flowchart';
      const hasFlowchartSubmission = isFlowchartActivity && flowchartSubmissionMap[activity._id]?.hasSubmission === true;

      // 表格活动状态判断
      const isSpreadsheetActivity = activity.type === 'spreadsheet';
      const hasSpreadsheetSubmission = isSpreadsheetActivity && spreadsheetSubmissionMap[activity._id]?.hasSubmission === true;

      // 统一计算完成状态
      const getCompletionStatus = () => {
        // 需要提交作业的活动
        if (activity.requireSubmission) {
          if (hasGrade) return { done: true, label: '已评分' };
          if (hasSubmission) return { done: true, label: '已提交' };
          return { done: false, label: '待提交' };
        }
        // 打字活动
        if (isTypingActivity) {
          return hasTypingRecord ? { done: true, label: '已完成' } : { done: false, label: '待完成' };
        }
        // 测验活动
        if (isQuizActivity) {
          return hasQuizSubmission ? { done: true, label: '已完成' } : { done: false, label: '待完成' };
        }
        // 流程图活动
        if (isFlowchartActivity) {
          return hasFlowchartSubmission ? { done: true, label: '已提交' } : { done: false, label: '待提交' };
        }
        // 表格活动
        if (isSpreadsheetActivity) {
          return hasSpreadsheetSubmission ? { done: true, label: '已保存' } : { done: false, label: '进行中' };
        }
        // HTML活动
        if (activity.type === 'html') {
          return submissionHistoryMap[activity._id]?.length > 0
            ? { done: true, label: '已提交' }
            : { done: false, label: '待提交' };
        }
        // 填空活动
        if (activity.type === 'fillblank') {
          return fillBlankSubmissionMap[activity._id]?.hasSubmission
            ? { done: true, label: '已提交' }
            : { done: false, label: '待完成' };
        }
        // Python活动
        if (activity.type === 'python') {
          return pythonSubmissionMap[activity._id]?.hasSubmission
            ? { done: true, label: '已提交' }
            : { done: false, label: '待完成' };
        }
        // 阅读/讨论等无需提交的活动
        return null;
      };

      const status = getCompletionStatus();

      // 活动类型颜色映射
      const activityTypeColors = {
        video: 'blue',
        reading: 'blue',
        quiz: 'green',
        practice: 'purple',
        discussion: 'orange',
        typing: 'cyan',
        flowchart: 'magenta',
        spreadsheet: 'green',
        html: 'volcano',
        fillblank: 'geekblue',
        python: 'gold'
      };

      return {
        key: `activity-${index}`, // 使用过滤后的索引
        label: (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '4px 0',
            maxWidth: '100%',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%'
            }}>
              <Tag
                color={activityTypeColors[activity.type] || 'default'}
                style={{
                  margin: 0,
                  fontSize: 11,
                  lineHeight: '18px',
                  padding: '0 6px',
                  flexShrink: 0
                }}
              >
                {activityTypeLabels[activity.type] || '活动'}
              </Tag>
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: 13
              }}>
                {activity.title}
              </span>
              {status && (
                status.done ? (
                  <CheckCircleFilled
                    style={{
                      color: '#52c41a',
                      fontSize: 14,
                      flexShrink: 0
                    }}
                    title={status.label}
                  />
                ) : (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '1px solid #d9d9d9',
                      flexShrink: 0,
                      boxSizing: 'border-box'
                    }}
                    title={status.label}
                  />
                )
              )}
            </div>
          </div>
        ),
        icon: activityIcons[activity.type] || <BookOutlined />,
      };
    }).filter(item => item !== null) // 过滤掉 null
  ];

  // 获取文件类型
  const getFileType = (mimeType, fileName) => {
    const mimeMap = {
      'text/x-python': 'py',
      'text/python': 'py',
      'application/x-python': 'py'
    };

    // 首先尝试从 MIME 类型获取
    if (mimeType && mimeMap[mimeType]) {
      return mimeMap[mimeType];
    }

    // 如果 MIME 类型不匹配，尝试从文件扩展名获取
    const extension = fileName.split('.').pop().toLowerCase();
    return extension === 'py' ? 'py' : null;
  };

  // 获取提交文件的代码内容
  const fetchSubmissionCode = async (submission) => {
    try {
      setPreviewLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/submissions/${submission._id}/preview`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('获取代码内容失败');
      }

      const text = await response.text();
      setCurrentSubmissionCode(text);
    } catch (error) {

      message.error('获取代码内容失败');
      setCurrentSubmissionCode('');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 添加获取打字记录的函数
  const fetchTypingRecord = async (activityId) => {
    try {
      const records = await typingAPI.getRecords({
        lessonId,
        activityId
      });
      if (records && records.length > 0) {
        setTypingRecord(records[0]); // 获取最新的记录
        // 更新打字记录映射
        setSubmissionHistoryMap(prev => ({
          ...prev,
          [activityId]: {
            ...(prev[activityId] || {}),
            hasRecord: true
          }
        }));
      } else {
        setTypingRecord(null);
        // 更新打字记录映射为无记录
        setSubmissionHistoryMap(prev => ({
          ...prev,
          [activityId]: {
            ...(prev[activityId] || {}),
            hasRecord: false
          }
        }));
      }
    } catch (error) {

      message.error('获取打字记录失败');
    }
  };

  // 添加获取测验提交记录的函数
  // 添加获取测验提交记录的函数
  const fetchQuizSubmissions = async (activityId, quizIdOrObj) => {
    // 处理传入的 ID 可能是对象的情况
    const quizId = typeof quizIdOrObj === 'object' ? quizIdOrObj?._id : quizIdOrObj;

    if (!quizId) return;

    try {
      const response = await quizAPI.submissions.getByQuiz(quizId);
      // 正确处理API返回的数据结构
      // 正确处理API返回的数据结构
      const submissions = response.data || [];
      // 只有状态为 SUBMITTED 才算完成
      const hasSubmission = submissions && submissions.some(s => s.status === 'SUBMITTED');

      // 更新测验提交记录映射
      setQuizSubmissionMap(prev => ({
        ...prev,
        [activityId]: { hasSubmission }
      }));
    } catch (error) {
      console.error('获取测验提交记录失败:', error);
      message.error('获取测验提交记录失败');
    }
  };

  // 添加测验提交后重新获取数据的函数
  // 添加测验提交后重新获取数据的函数
  const refreshQuizSubmission = async (activityId, quizIdOrObj) => {
    // 处理传入的 ID 可能是对象的情况
    const quizId = typeof quizIdOrObj === 'object' ? quizIdOrObj?._id : quizIdOrObj;

    if (!quizId) return;

    try {
      const response = await quizAPI.submissions.getByQuiz(quizId);
      // 正确处理API返回的数据结构
      const submissions = response.data || [];
      // 只有状态为 SUBMITTED 才算完成
      const hasSubmission = submissions && submissions.some(s => s.status === 'SUBMITTED');

      // 更新测验提交记录映射
      setQuizSubmissionMap(prev => ({
        ...prev,
        [activityId]: { hasSubmission }
      }));
    } catch (error) {
      console.error('获取测验提交记录失败:', error);
    }
  };

  // 获取流程图提交记录
  const fetchFlowchartSubmission = async (activityId) => {
    try {
      const response = await flowchartAPI.getSubmission(lessonId, activityId);
      const hasSubmission = response.success && response.submission && response.submission.status !== 'draft';

      setFlowchartSubmissionMap(prev => ({
        ...prev,
        [activityId]: {
          hasSubmission,
          submission: response.submission
        }
      }));
    } catch (error) {
      console.error('获取流程图提交记录失败:', error);
    }
  };

  // 刷新流程图提交记录
  const refreshFlowchartSubmission = async (activityId) => {
    await fetchFlowchartSubmission(activityId);
  };

  // 获取表格提交记录
  const fetchSpreadsheetSubmission = async (activityId) => {
    try {
      const response = await spreadsheetActivityAPI.getOrCreateSubmission(lessonId, activityId);
      if (response.success) {
        setSpreadsheetSubmissionMap(prev => ({
          ...prev,
          [activityId]: {
            hasSubmission: !!response.data,
            submission: response.data
          }
        }));
        // 始终更新当前选中的表格提交记录（由selectedTask的useEffect负责同步正确的数据）
        setCurrentSpreadsheetSubmission(response.data);
      }
    } catch (error) {
      console.error('获取表格提交记录失败:', error);
    }
  };

  // 刷新表格提交记录
  const refreshSpreadsheetSubmission = async (activityId) => {
    await fetchSpreadsheetSubmission(activityId);
  };

  // 添加打字记录刷新函数
  const refreshTypingRecord = async (activityId) => {
    try {
      const records = await typingAPI.getRecords({
        lessonId,
        activityId
      });
      if (records && records.length > 0) {
        setTypingRecord(records[0]); // 获取最新的记录
        // 更新打字记录映射
        setSubmissionHistoryMap(prev => ({
          ...prev,
          [activityId]: {
            ...(prev[activityId] || {}),
            hasRecord: true
          }
        }));
      } else {
        setTypingRecord(null);
        // 更新打字记录映射为无记录
        setSubmissionHistoryMap(prev => ({
          ...prev,
          [activityId]: {
            ...(prev[activityId] || {}),
            hasRecord: false
          }
        }));
      }
    } catch (error) {
      console.error('获取打字记录失败:', error);
    }
  };

  useEffect(() => {
    const fetchLessonDetail = async () => {
      try {
        const lessonData = await courseManagementAPI.getLesson(courseId, unitId, lessonId);

        if (lessonData.success) {
          setLesson(lessonData.data);
          setActivities(lessonData.data.activities || []);
        } else {
          message.error(lessonData.message || '获取课时详情失败');
        }
      } catch (error) {

        message.error('获取课时详情失败');
      } finally {
        setLoading(false);
      }
    };

    if (lessonId && courseId && unitId) {
      fetchLessonDetail();
    }
  }, [lessonId, courseId, unitId]);

  // 处理URL参数 activityId 以及 initialActivityId prop 跳转
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetActivityId = params.get('activityId') || initialActivityId;

    if (targetActivityId && activities.length > 0) {
      const index = activities.findIndex(a => a._id === targetActivityId);
      if (index !== -1) {
        const newTaskKey = `activity-${index}`;
        setSelectedTask(newTaskKey);
        // 更新 selectedActivityId 状态，这通常由 Menu 的 onSelect 触发，但也可能需要手动同步
        setSelectedActivityId(targetActivityId);
        // 既然改变了 selectedTask，也需要确保 currentActivity 等状态同步（如果它们不依赖 selectedTask 的话）
        // 但根据代码 renderContent 依赖 selectedTask，所以应该够了。
      }
    }
  }, [activities, location.search, initialActivityId]);

  // 添加获取所有活动提交历史的useEffect
  useEffect(() => {
    const fetchAllSubmissionHistories = async () => {
      // 获取所有需要提交作业的活动，以及所有的 HTML 活动
      const submissionActivities = activities.filter(activity => activity.requireSubmission || activity.type === 'html');

      // 并行获取所有活动的提交历史
      await Promise.all(
        submissionActivities.map(activity => fetchSubmissionHistory(activity._id))
      );
    };

    const fetchAllTypingRecords = async () => {
      // 获取所有打字活动
      const typingActivities = activities.filter(activity => activity.type === 'typing');

      // 并行获取所有打字活动的记录
      await Promise.all(
        typingActivities.map(activity => fetchTypingRecord(activity._id))
      );
    };

    const fetchAllQuizSubmissions = async () => {
      // 获取所有测验活动
      const quizActivities = activities.filter(activity => activity.type === 'quiz');

      // 并行获取所有测验活动的提交记录
      await Promise.all(
        quizActivities.map(activity => {
          const quiz = activity.quizSettings?.quiz;
          const quizId = typeof quiz === 'object' ? quiz?._id : quiz;
          return fetchQuizSubmissions(activity._id, quizId);
        })
      );
    };

    const fetchAllFlowchartSubmissions = async () => {
      // 获取所有流程图活动
      const flowchartActivities = activities.filter(activity => activity.type === 'flowchart');

      // 并行获取所有流程图活动的提交记录
      await Promise.all(
        flowchartActivities.map(activity => fetchFlowchartSubmission(activity._id))
      );
    };

    const fetchAllSpreadsheetSubmissions = async () => {
      // 获取所有在线表格活动
      const spreadsheetActivities = activities.filter(activity => activity.type === 'spreadsheet');

      // 并行获取所有在线表格活动的提交记录
      await Promise.all(
        spreadsheetActivities.map(activity => fetchSpreadsheetSubmission(activity._id))
      );
    };

    const fetchAllFillBlankSubmissions = async () => {
      // 获取所有填空活动
      const fillBlankActivities = activities.filter(activity => activity.type === 'fillblank');

      // 并行获取所有填空活动的提交记录
      await Promise.all(
        fillBlankActivities.map(async (activity) => {
          try {
            const response = await fillBlankAPI.getSubmission(lessonId, activity._id);
            if (response.success) {
              setFillBlankSubmissionMap(prev => ({
                ...prev,
                [activity._id]: {
                  hasSubmission: response.data?.status === 'submitted',
                  submission: response.data
                }
              }));
            }
          } catch (error) {
            console.error('获取填空提交记录失败:', error);
          }
        })
      );
    };

    const fetchAllPythonSubmissions = async () => {
      // 获取所有Python活动
      const pythonActivities = activities.filter(activity => activity.type === 'python');

      // 并行获取所有Python活动的提交记录
      await Promise.all(
        pythonActivities.map(async (activity) => {
          try {
            const response = await pythonAPI.getSubmission(lessonId, activity._id);
            if (response.success) {
              setPythonSubmissionMap(prev => ({
                ...prev,
                [activity._id]: {
                  hasSubmission: response.data?.status === 'submitted',
                  submission: response.data
                }
              }));
            }
          } catch (error) {
            console.error('获取Python提交记录失败:', error);
          }
        })
      );
    };

    if (activities.length > 0) {
      fetchAllSubmissionHistories();
      fetchAllTypingRecords();
      fetchAllQuizSubmissions();
      fetchAllFlowchartSubmissions();
      fetchAllSpreadsheetSubmissions();
      fetchAllFillBlankSubmissions();
      fetchAllPythonSubmissions();
    }
  }, [activities]); // 当activities变化时重新获取

  // 修改活动加载逻辑
  useEffect(() => {
    if (activities[currentActivity]) {


      // 如果当前活动需要提交作业，则加载提交历史
      if (activities[currentActivity].requireSubmission) {
        fetchSubmissionHistory(activities[currentActivity]._id);
      }

      // 如果是打字活动，加载打字记录
      if (activities[currentActivity].type === 'typing') {
        fetchTypingRecord(activities[currentActivity]._id);
      }
      // 如果是测验活动，加载测验提交记录
      if (activities[currentActivity].type === 'quiz') {
        fetchQuizSubmissions(activities[currentActivity]._id, activities[currentActivity].quizSettings.quiz);
      }
      // 如果是表格活动，加载表格提交记录
      if (activities[currentActivity].type === 'spreadsheet') {
        fetchSpreadsheetSubmission(activities[currentActivity]._id);
      }
    }
  }, [currentActivity, activities]);

  // 当 selectedTask 变化时，从缓存中同步 currentSpreadsheetSubmission
  useEffect(() => {
    if (selectedTask.startsWith('activity-')) {
      const index = parseInt(selectedTask.split('-')[1]);
      const activity = activities[index];
      if (activity?.type === 'spreadsheet') {
        const submissionData = spreadsheetSubmissionMap[activity._id]?.submission;
        if (submissionData) {
          setCurrentSpreadsheetSubmission(submissionData);
        }
      }
    }
  }, [selectedTask, activities, spreadsheetSubmissionMap]);

  // 添加一个useEffect来处理提交历史模态框的Python文件加载
  useEffect(() => {
    if (showHistory && selectedActivityId) {
      const submissions = submissionHistoryMap[selectedActivityId] || [];
      const pythonSubmission = submissions.find(submission =>
        getFileType(submission.content.file?.mimeType, submission.content.file?.originalName) === 'py'
      );

      if (pythonSubmission) {
        fetchSubmissionCode(pythonSubmission);
      }
    }
  }, [showHistory, selectedActivityId, submissionHistoryMap]);

  // 更新悬浮按钮位置
  const updateFloatingButtonPosition = useCallback(() => {
    if (selectedRange) {
      const rect = selectedRange.getBoundingClientRect();
      setSelectionPosition({
        x: rect.left + (rect.width / 2),
        y: rect.bottom + window.pageYOffset
      });
    }
  }, [selectedRange]);

  // 处理文本选择
  const handleTextSelection = useCallback(() => {
    if (!allowAiUsage) {
      return; // 如果不允许使用AI，直接返回
    }

    const selection = window.getSelection();
    const text = selection.toString().trim();

    // 延迟处理，避免与浏览器原生事件冲突
    setTimeout(() => {
      if (text) {
        // 检查是否有有效的选择范围
        if (selection.rangeCount === 0) {
          return;
        }

        // 检查选择的文本是否在 AI 助手面板内
        const aiHelperPanel = document.querySelector('.ai-helper-panel');
        if (aiHelperPanel) {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          if (aiHelperPanel.contains(container)) {
            return;
          }
        }

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          setSelectedText(text);
          setSelectionPosition({
            x: rect.left + (rect.width / 2),
            y: rect.bottom + window.pageYOffset
          });
        } catch (error) {
          setSelectedText('');
          setSelectionPosition(null);
        }
      } else {
        setSelectedText('');
        setSelectionPosition(null);
      }
    }, 0); // 延迟0毫秒，推到事件循环末尾

  }, [allowAiUsage]);

  // 添加滚动事件监听
  useEffect(() => {
    const handleScroll = _.throttle(() => {
      updateFloatingButtonPosition();
    }, 100);

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [updateFloatingButtonPosition]);

  // 添加和移除文本选择事件监听
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
    };
  }, [handleTextSelection]);

  // 处理询问AI助手
  const handleAskAI = () => {
    if (selectedText) {
      setSelectedQuestion(`关于这段内容："${selectedText}"，请解释一下`);
      setSelectionPosition(null);
      setSelectedRange(null);
    }
    setShowAIHelper(true);
  };

  const handleStartExercise = (exercise) => {
    setCurrentExercise(exercise);
    setShowExercise(true);
  };

  const handleSubmitAssignment = (activity) => {
    if (isManualGrade(submissionHistoryMap[activity._id]?.[0])) { message.warning('作业已由教师人工评分，不能重新提交覆盖'); return; }
    if (uploadingActivityId) return;
    if (!activity.requireSubmission) {
      message.error('该活动不需要提交作业');
      return;
    }

    // 获取允许的文件类型
    const allowedFormats = activity.allowedFormats || [];
    if (allowedFormats.length === 0) {
      message.error('未设置允许上传的文件类型');
      return;
    }

    // 构建accept字符串
    const acceptTypes = allowedFormats.map(format => `.${format.toLowerCase()}`).join(',');

    // 触发文件选择
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = acceptTypes;
    fileInput.style.display = 'none';

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 检查文件扩展名是否符合要求
      const fileExt = file.name.split('.').pop().toUpperCase();
      if (!allowedFormats.includes(fileExt)) {
        message.error(`只允许上传 ${allowedFormats.join(', ')} 格式的文件`);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        // 清空当前代码内容，避免显示旧内容
        setCurrentSubmissionCode('');

        setUploadingActivityId(activity._id);
        // 使用courseManagementAPI.submitAssignment方法提交作业
        const result = await courseManagementAPI.submitAssignment(
          courseId,
          unitId,
          lessonId,
          activity._id,
          formData
        );

        if (result.autoGradeError) message.warning(result.autoGradeError);
        else message.success(result.submission?.grade?.score != null ? '自动评阅完成：' + result.submission.grade.score + '/10 分' : result.message || '作业提交成功');
        // 刷新提交历史
        await fetchSubmissionHistory(activity._id);
        if (result.submission?.pptAutoGrade?.score != null || result.submission?.excelAutoGrade?.score != null) {
          setSelectedActivityId(activity._id);
          setShowHistory(true);
        }
      } catch (error) {
        message.error(error.response?.data?.message || '提交作业失败');
      } finally {
        setUploadingActivityId(null);
      }

      // 清理临时创建的input元素
      document.body.removeChild(fileInput);
    };

    document.body.appendChild(fileInput);
    fileInput.click();
  };

  // 修改获取提交历史函数
  const fetchSubmissionHistory = async (activityId) => {
    try {
      // 清空当前代码内容，避免显示旧内容
      setCurrentSubmissionCode('');

      const data = await courseManagementAPI.getSubmissionHistory(courseId, unitId, lessonId, activityId);
      // 更新特定活动的提交历史
      setSubmissionHistoryMap(prev => ({
        ...prev,
        [activityId]: data
      }));

      // 不在这里调用fetchSubmissionCode，让useEffect处理
    } catch (error) {
      // 忽略 404 错误（未找到提交记录）
      if (error.response && error.response.status === 404) {
        setSubmissionHistoryMap(prev => ({
          ...prev,
          [activityId]: []
        }));
        return;
      }
      console.error('获取提交历史失败:', error);
      // message.error('获取提交历史失败'); // 暂时屏蔽错误提示，避免干扰
    }
  };

  // 添加HTML资源预览函数
  const handleHtmlPreview = async (resource) => {
    try {
      if (!resource.path) {
        message.error('资源路径无效');
        return;
      }

      // 检查文件类型是否为HTML
      const isHtml = resource.originalName?.toLowerCase().endsWith('.html') ||
        resource.mimeType === 'text/html' ||
        resource.filename?.toLowerCase().endsWith('.html') ||
        resource.title?.toLowerCase().endsWith('.html') ||
        resource.path?.toLowerCase().endsWith('.html');

      if (!isHtml) {
        message.error('只能预览HTML文件');
        return;
      }

      // 显示加载中
      message.loading('加载HTML预览...', 0);

      // 获取HTML文件内容
      const cleanPath = resource.path.replace('resources/', '');
      const response = await fetch(
        `${API_BASE_URL}/api/download/resource/${cleanPath}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('获取HTML内容失败');
      }

      // 获取HTML内容
      const htmlContent = await response.text();

      // 创建Blob对象
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });

      // 创建Blob URL
      const blobUrl = URL.createObjectURL(htmlBlob);

      // 设置预览URL和标题
      setHtmlPreviewUrl(blobUrl);
      setHtmlPreviewTitle(resource.title || resource.originalName);

      // 显示预览模态框
      setShowHtmlPreview(true);

      // 关闭加载提示
      message.destroy();
    } catch (error) {
      message.destroy();
      message.error('预览HTML失败');
    }
  };

  // 添加在新窗口打开HTML预览的函数
  const openHtmlInNewWindow = async () => {
    try {
      if (!htmlPreviewUrl) {
        message.error('预览内容不可用');
        return;
      }

      // 在新窗口打开当前已加载的HTML内容
      const newWindow = window.open(htmlPreviewUrl, '_blank');

      // 当窗口关闭时不释放Blob URL，因为模态框还在使用
      if (newWindow) {
        message.success('已在新窗口打开');
      }
    } catch (error) {
      message.error('打开HTML失败');
    }
  };

  // 修改资源下载处理函数
  const handleResourceDownload = async (resource, isAssignment = false) => {
    try {
      if (!resource.path) {
        message.error('资源路径无效');
        return;
      }

      let response;
      if (isAssignment) {
        // 作业文件下载
        const cleanPath = resource.path.replace('uploads/assignments/', '');
        response = await fetch(
          `${API_BASE_URL}/api/download/assignment/${cleanPath}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
      } else {
        // 普通资源文件下载
        const cleanPath = resource.path.replace('resources/', '');
        response = await fetch(
          `${API_BASE_URL}/api/download/resource/${cleanPath}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
      }

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.originalName || resource.title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('资源下载成功');
    } catch (error) {
      message.error('下载资源失败');
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

  const handleBack = () => {
    navigate('/student');
  };

  // 在 renderContent 函数外部定义一个工具函数来获取当前选中的活动索引
  const getSelectedActivityIndex = (selectedTask) => {
    if (selectedTask.startsWith('activity-')) {
      return parseInt(selectedTask.split('-')[1]);
    }
    return 0;
  };

  // 添加一个格式化日期的函数
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 修改格式化文件名的函数
  const formatFileName = (fileName, maxLength = 13) => {
    if (!fileName) return '未知文件';

    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return fileName.length > maxLength ? fileName.slice(0, maxLength) + '...' : fileName;
    }

    const name = fileName.slice(0, lastDotIndex);
    const extension = fileName.slice(lastDotIndex);

    if (name.length > maxLength) {
      return name.slice(0, maxLength) + '...' + extension;
    }

    return fileName;
  };

  // 添加获取文件图标的函数
  const getFileIcon = (resource) => {
    if (!resource.originalName && !resource.filename && !resource.title && !resource.path) {
      return <FileUnknownOutlined />;
    }

    const fileName = resource.originalName || resource.filename || resource.title || resource.path;
    const extension = fileName.split('.').pop().toLowerCase();

    switch (extension) {
      case 'doc':
      case 'docx':
        return <FileWordOutlined style={{ color: '#2b579a' }} />;
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#f40f02' }} />;
      case 'xls':
      case 'xlsx':
        return <FileExcelOutlined style={{ color: '#217346' }} />;
      case 'ppt':
      case 'pptx':
        return <FilePptOutlined style={{ color: '#d24726' }} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FileZipOutlined style={{ color: '#ffc107' }} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
        return <FileImageOutlined style={{ color: '#36cfc9' }} />;
      case 'txt':
        return <FileTextOutlined style={{ color: '#73777a' }} />;
      case 'html':
      case 'htm':
        return <FileOutlined style={{ color: '#e44d26' }} />;
      default:
        return <FileOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  // 切换全屏状态
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 添加图片资源预览函数
  const handleImagePreview = async (resource) => {
    try {
      if (!resource.path) {
        message.error('资源路径无效');
        return;
      }

      // 检查文件类型是否为图片
      const isImage = resource.originalName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/) ||
        resource.mimeType?.startsWith('image/') ||
        resource.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/);

      if (!isImage) {
        message.error('只能预览图片文件');
        return;
      }

      // 显示加载中
      message.loading('加载图片预览...', 0);

      // 获取图片文件内容
      const cleanPath = resource.path.replace('resources/', '');
      const imageUrl = `${API_BASE_URL}/api/download/resource/${cleanPath}?token=${localStorage.getItem('token')}`;

      // 设置预览URL和标题
      setImagePreviewUrl(imageUrl);
      setImagePreviewTitle(resource.title || resource.originalName);

      // 显示预览模态框
      setShowImagePreview(true);

      // 关闭加载提示
      message.destroy();
    } catch (error) {
      message.destroy();
      message.error('预览图片失败');
    }
  };

  // 添加视频资源预览函数（支持 Range 与 inline 播放）
  const handleVideoPreview = async (resource) => {
    try {
      if (!resource.path) {
        message.error('资源路径无效');
        return;
      }

      const isVideo = resource.originalName?.toLowerCase().match(/\.(mp4|webm|ogg|avi|mov|mkv)$/) ||
        resource.mimeType?.startsWith('video/') ||
        resource.filename?.toLowerCase().match(/\.(mp4|webm|ogg|avi|mov|mkv)$/);

      if (!isVideo) {
        message.error('只能预览视频文件');
        return;
      }

      message.loading('加载视频预览...', 0);

      // 资源路径以 resources/ 开头，统一下载接口为 /api/download/resource/{cleanPath}
      const cleanPath = resource.path.replace('resources/', '');
      const url = `${API_BASE_URL}/api/download/resource/${cleanPath}?token=${localStorage.getItem('token')}&inline=1`;
      setVideoPreviewUrl(url);
      setVideoPreviewTitle(resource.title || resource.originalName);
      setShowVideoPreview(true);
      message.destroy();
    } catch (error) {
      message.destroy();
      message.error('预览视频失败');
    }
  };

  // Markdown 点击视频链接预览
  const handleMarkdownVideoLink = (href, title) => {
    try {
      if (!href) return;
      let finalUrl = href;
      const isAbsolute = /^https?:\/\//i.test(href);

      if (href.startsWith('/resources/') || href.startsWith('resources/')) {
        const cleanPath = href.replace(/^\/?resources\//, '');
        finalUrl = `${API_BASE_URL}/api/download/resource/${cleanPath}?token=${localStorage.getItem('token')}&inline=1`;
      } else if (href.startsWith('/public/media/')) {
        // 公开媒体静态路径，直接拼接站点域名（无需 token）
        finalUrl = `${API_BASE_URL}${href}`;
      } else if (href.startsWith('/api/download/resource/')) {
        const base = `${API_BASE_URL}${href}`;
        const hasToken = /([?&])token=/.test(base);
        finalUrl = hasToken ? base : `${base}${base.includes('?') ? '&' : '?'}token=${localStorage.getItem('token')}&inline=1`;
      } else if (!isAbsolute && /\.(mp4|webm|ogg|avi|mov|mkv)(\?.*)?$/i.test(href)) {
        const cleanPath = href.replace(/^\/+/, '');
        finalUrl = `${API_BASE_URL}/api/download/resource/${cleanPath}?token=${localStorage.getItem('token')}&inline=1`;
      }

      setVideoPreviewUrl(finalUrl);
      setVideoPreviewTitle(title || '视频预览');
      setShowVideoPreview(true);
    } catch (error) {
      message.error('无法打开视频链接');
    }
  };

  // 修改渲染内容区域
  const renderContent = () => {
    const selectedActivityIndex = getSelectedActivityIndex(selectedTask);
    const activity = activities[selectedActivityIndex];

    if (!activity) return null;

    return (
      <Card className="activity-detail">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space align="center" size={12}>
                {/* 活动类型图标 - 简约风格 */}
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {activityIcons[activity.type] || <BookOutlined style={{ fontSize: 18, color: '#1890ff' }} />}
                </div>
                <div>
                  <Title level={4} style={{ marginTop: 0, marginBottom: 0 }}>{activity.title}</Title>
                </div>
                {activity.type === 'typing' && activity.typingSettings?.allowOnce && (
                  <Tag color="gold" style={{ marginLeft: 8 }}>当前为考核模式，只允许完成一次汉字录入</Tag>
                )}
              </Space>
            </Col>
            <Col>
              <Space>
                {isTeacherSimulation && activity.type === 'quiz' && (
                  <Button
                    icon={<FormOutlined />}
                    onClick={() => handleToggleTeachPanel(activity)}
                  >
                    {showTeachPanel ? '关闭讲题' : '讲题模式'}
                  </Button>
                )}
                {renderAssignmentButtons(activity)}
              </Space>
            </Col>
          </Row>

          {/* 标题分割线 - 带渐变色 */}
          <Divider style={{ margin: '16px 0 20px 0', borderColor: '#e8e8e8' }} />

          {/* 移除活动描述显示
          {activity.description && (
            <Paragraph>{activity.description}</Paragraph>
          )}
          */}

          {/* 显示活动资源 - 改进样式 */}
          {activity.resources && activity.resources.length > 0 && (
            <div style={{ marginBottom: 0 }}>
              <Title level={5}>
                <Space>
                  <DownloadOutlined />
                  学习资源
                </Space>
              </Title>
              <List
                grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                dataSource={activity.resources}
                renderItem={resource => {
                  // 检查是否为HTML文件
                  const isHtml = resource.originalName?.toLowerCase().endsWith('.html') ||
                    resource.mimeType === 'text/html' ||
                    resource.filename?.toLowerCase().endsWith('.html') ||
                    resource.title?.toLowerCase().endsWith('.html') ||
                    resource.path?.toLowerCase().endsWith('.html');

                  // 检查是否为图片文件
                  const isImage = resource.originalName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/) ||
                    resource.mimeType?.startsWith('image/') ||
                    resource.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp)$/);
                  // 检查是否为视频文件
                  const isVideo = resource.originalName?.toLowerCase().match(/\.(mp4|webm|ogg|avi|mov|mkv)$/) ||
                    resource.mimeType?.startsWith('video/') ||
                    resource.filename?.toLowerCase().match(/\.(mp4|webm|ogg|avi|mov|mkv)$/);

                  return (
                    <List.Item>
                      <Card
                        size="small"
                        hoverable
                        bodyStyle={{ padding: '12px 16px' }}
                        style={{
                          cursor: 'pointer',
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          transition: 'all 0.3s'
                        }}
                        onClick={(e) => {
                          // 视频默认预览，其它类型默认下载
                          if (isVideo) {
                            handleVideoPreview(resource);
                          } else {
                            handleResourceDownload(resource);
                          }
                        }}
                      >
                        <Row align="middle" justify="space-between" gutter={8}>
                          <Col flex="auto">
                            <Space align="start" size={12}>
                              <div style={{ fontSize: '24px', marginTop: '2px' }}>
                                {getFileIcon(resource)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                  strong
                                  style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                  title={resource.title || resource.originalName || resource.filename}
                                >
                                  {formatFileName(resource.title || resource.originalName || resource.filename)}
                                </Text>
                                <Space size={8} style={{ marginTop: '4px' }}>
                                  {resource.size && (
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                      {formatFileSize(resource.size)}
                                    </Text>
                                  )}
                                </Space>
                              </div>
                            </Space>
                          </Col>
                          <Col>
                            <Space>
                              {isImage && (
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<FullscreenOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleImagePreview(resource);
                                  }}
                                >
                                  预览
                                </Button>
                              )}
                              {isVideo && (
                                <Button
                                  type={isImage || isHtml ? 'default' : 'primary'}
                                  size="small"
                                  icon={<FullscreenOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVideoPreview(resource);
                                  }}
                                >
                                  预览
                                </Button>
                              )}
                              {isHtml && (
                                <Button
                                  type={isImage ? "default" : "primary"}
                                  size="small"
                                  icon={<FullscreenOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHtmlPreview(resource);
                                  }}
                                >
                                  预览
                                </Button>
                              )}
                              <Button
                                type={(isHtml || isImage) ? "default" : "primary"}
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResourceDownload(resource);
                                }}
                              >
                                下载
                              </Button>
                            </Space>
                          </Col>
                        </Row>
                      </Card>
                    </List.Item>
                  );
                }}
              />
            </div>
          )}

          {/* 根据活动类型渲染不同的内容 */}
          {activity.type === 'quiz' ? (
            <>
              {/* 教师讲题面板（显示在测验上方） */}
              {isTeacherSimulation && showTeachPanel && (
                <Card style={{ marginTop: 0, marginBottom: 16, borderColor: '#b7eb8f' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Title level={4} style={{ margin: 0 }}>讲题模式</Title>
                      </Col>
                      <Col>
                        <Space>
                          <Button onClick={handleTeachPrev} disabled={teachCurrentIndex === 0}>上一题</Button>
                          <Button type="primary" onClick={handleTeachNext} disabled={teachCurrentIndex >= teachQuestions.length - 1}>下一题</Button>
                          <Button type={teachShowAnswers ? 'default' : 'primary'} onClick={() => setTeachShowAnswers(!teachShowAnswers)}>
                            {teachShowAnswers ? '关闭答案' : '显示答案'}
                          </Button>
                        </Space>
                      </Col>
                    </Row>

                    {teachLoading ? (
                      <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin tip="加载题目中..." />
                      </div>
                    ) : teachQuestions.length === 0 ? (
                      <Empty description="暂无题目" />
                    ) : (
                      (() => {
                        const q = teachQuestions[teachCurrentIndex];
                        const isScale = q?.type === 'PSYCHOLOGICAL_SCALE';
                        if (!q) return null;
                        return (
                          <>
                            <div className="quiz-markdown-content" style={{ marginTop: 4 }}>
                              <MarkdownRenderer content={q.content} hideCopyButton={true} onVideoLinkClick={handleMarkdownVideoLink} />
                            </div>
                            {!isScale ? (
                              <List
                                style={{ marginTop: 8 }}
                                dataSource={q.options || []}
                                renderItem={(opt, idx) => (
                                  <List.Item key={opt._id} style={{ padding: '8px 12px' }}>
                                    <Space style={{ width: '100%', alignItems: 'flex-start' }}>
                                      <Text strong style={{ width: 20 }}>{String.fromCharCode(65 + idx)}.</Text>
                                      <div className="quiz-markdown-content" style={{ flex: 1 }}>
                                        <MarkdownRenderer content={opt.content} hideCopyButton={true} onVideoLinkClick={handleMarkdownVideoLink} />
                                      </div>
                                      {teachShowAnswers && opt.isCorrect && <Tag color="success">正确</Tag>}
                                    </Space>
                                  </List.Item>
                                )}
                              />
                            ) : (
                              <Text type="secondary">量表题</Text>
                            )}
                            {teachShowAnswers && q.explanation && (
                              <div style={{ marginTop: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, padding: 12 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>解析</Text>
                                <div className="quiz-markdown-content explanation">
                                  <MarkdownRenderer content={q.explanation} hideCopyButton={true} onVideoLinkClick={handleMarkdownVideoLink} />
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()
                    )}
                  </Space>
                </Card>
              )}

              {/* 测验作答模块 */}
              <Quiz
                key={activity._id} // 添加key以确保切换活动时重新挂载组件，防止状态残留
                quizId={typeof activity.quizSettings?.quiz === 'object' ? activity.quizSettings.quiz._id : activity.quizSettings?.quiz}
                settings={activity.quizSettings}
                mode="embedded"
                isTeacher={isTeacherSimulation}
                activityId={activity._id}
                lessonId={lessonId}
                onComplete={(result) => {
                  message.success('测验完成！');
                  // 从服务器重新获取测验提交记录
                  const quizId = typeof activity.quizSettings?.quiz === 'object' ? activity.quizSettings.quiz._id : activity.quizSettings?.quiz;
                  refreshQuizSubmission(activity._id, quizId);
                }}
              />
            </>
          ) : activity.type === 'typing' ? (
            <TypingPractice
              key={activity._id}
              mode="lesson"
              textId={activity.typingSettings?.text}
              targetSpeed={activity.typingSettings?.targetSpeed}
              targetAccuracy={activity.typingSettings?.targetAccuracy}
              timeLimit={activity.typingSettings?.timeLimit * 60}
              lessonId={lessonId}
              activityId={activity._id}
              existingRecord={typingRecord}
              disabled={activity.typingSettings?.allowOnce && typingRecord}
              allowOnce={activity.typingSettings?.allowOnce}
              onComplete={(result) => {
                // Optimistic update
                setSubmissionHistoryMap(prev => ({
                  ...prev,
                  [activity._id]: {
                    ...(prev[activity._id] || {}),
                    hasRecord: true
                  }
                }));

                // Refresh from server with delay for consistency
                setTimeout(() => {
                  refreshTypingRecord(activity._id);
                }, 1000);
              }}
            />
          ) : activity.type === 'flowchart' ? (
            <MxGraphEditor
              key={activity._id}
              mode="edit"
              initialData={flowchartSubmissionMap[activity._id]?.submission?.flowchartData}
              instructions={activity.flowchartSettings?.instructions}
              readOnly={flowchartSubmissionMap[activity._id]?.submission?.status === 'graded'}
              lessonId={lessonId}
              activityId={activity._id}
              onSubmit={async () => {
                // 编辑器会独立保存，这里只需要刷新数据
                refreshFlowchartSubmission(activity._id);
              }}
            />

          ) : activity.type === 'spreadsheet' ? (
            <div style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
              {currentSpreadsheetSubmission?.spreadsheetData ? (
                <SpreadsheetEditor
                  key={`${currentSpreadsheetSubmission?._id}-${currentSpreadsheetSubmission?.updatedAt}`}
                  data={currentSpreadsheetSubmission?.spreadsheetData}
                  readOnly={currentSpreadsheetSubmission?.status === 'graded'}
                  onSave={async (data) => {
                    try {
                      if (currentSpreadsheetSubmission?._id) {
                        await spreadsheetActivityAPI.updateSubmission(currentSpreadsheetSubmission._id, {
                          spreadsheetData: data,
                          status: 'submitted'
                        });
                        message.success('已保存');
                        // Wait a bit before refreshing to ensure database write is complete
                        setTimeout(() => {
                          refreshSpreadsheetSubmission(activity._id);
                        }, 500);
                      }
                    } catch (error) {
                      console.error('LessonDetail: Save error:', error);
                      message.error('保存失败');
                    }
                  }}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                  <Spin tip="加载表格中..." />
                </div>
              )}
            </div>
          ) : activity.type === 'html' ? (
            <div className="activity-content">
              {activity.htmlSettings?.instructions && (
                <div style={{ marginBottom: 24 }}>
                  <Title level={4}>活动说明</Title>
                  <MarkdownRenderer content={activity.htmlSettings.instructions} />
                </div>
              )}

              <div style={{
                marginTop: 24,
                padding: 24,
                background: '#f5f5f5',
                borderRadius: 8,
                textAlign: 'center'
              }}>
                <Space direction="vertical" size="large">
                  <div style={{ color: '#666' }}>
                    <CodeOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
                    <div>这是一个 HTML 网页制作任务</div>
                  </div>

                  <Space>
                    <Button
                      type="primary"
                      size="large"
                      icon={<CodeOutlined />}
                      onClick={() => {
                        // 如果有提交记录且包含链接，尝试提取项目ID并打开对应编辑器
                        const submission = submissionHistoryMap[activity._id]?.[0];
                        if (submission?.content?.links?.[0]) {
                          // 链接格式: /student/html-gallery/PROJECT_ID
                          const match = submission.content.links[0].match(/\/html-gallery\/([a-zA-Z0-9]+)/);
                          if (match && match[1]) {
                            window.open(`/student/html-editor/${match[1]}`, '_blank');
                            return;
                          }
                        }
                        // 默认打开编辑器首页
                        window.open('/student/html-editor', '_blank');
                      }}
                    >
                      打开 HTML 编辑器
                    </Button>

                  </Space>

                  {submissionHistoryMap[activity._id]?.length > 0 && (
                    <Alert
                      type="success"
                      showIcon
                      message="已提交作业"
                      description={`提交时间: ${new Date(submissionHistoryMap[activity._id][0].submittedAt).toLocaleString()}`}
                      style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto' }}
                    />
                  )}
                </Space>
              </div>
            </div>
          ) : activity.type === 'fillblank' ? (
            <FillBlankActivity
              key={activity._id}
              lessonId={lessonId}
              activityId={activity._id}
              content={activity.fillBlankSettings?.content}
              instructions={activity.fillBlankSettings?.instructions}
              showCorrectAfterSubmit={activity.fillBlankSettings?.showCorrectAfterSubmit}
              onSubmitSuccess={() => {
                // 刷新填空提交状态
                fillBlankAPI.getSubmission(lessonId, activity._id).then(response => {
                  if (response.success) {
                    setFillBlankSubmissionMap(prev => ({
                      ...prev,
                      [activity._id]: {
                        hasSubmission: response.data?.status === 'submitted',
                        submission: response.data
                      }
                    }));
                  }
                });
              }}
            />
          ) : activity.type === 'python' ? (
            <PythonActivity
              key={activity._id}
              lessonId={lessonId}
              activityId={activity._id}
              pythonSettings={activity.pythonSettings}
              onSubmitSuccess={() => {
                // 刷新Python提交状态
                pythonAPI.getSubmission(lessonId, activity._id).then(response => {
                  if (response.success) {
                    setPythonSubmissionMap(prev => ({
                      ...prev,
                      [activity._id]: {
                        hasSubmission: response.data?.status === 'submitted',
                        submission: response.data
                      }
                    }));
                  }
                });
              }}
            />
          ) : (
            activity.content && (
              <div className="activity-content">
                <MarkdownRenderer content={activity.content} onVideoLinkClick={handleMarkdownVideoLink} />
              </div>
            )
          )}


        </Space>
      </Card>
    );
  };

  // 添加响应式菜单控制
  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 1200);
    };

    // 初始化时检查一次
    handleResize();

    // 添加窗口大小变化监听
    window.addEventListener('resize', handleResize);

    // 清理监听器
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 修改菜单点击处理函数
  const handleMenuClick = ({ key }) => {
    setSelectedTask(key);
    // 保存选中的任务到 localStorage
    localStorage.setItem(`lesson-${lessonId}-selected-task`, key);
  };

  // 修改作业提交按钮部分
  const renderAssignmentButtons = (activity) => {
    if (!activity.requireSubmission) return null;

    // 获取当前活动的提交历史
    const activitySubmissions = submissionHistoryMap[activity._id] || [];
    const latestSubmission = activitySubmissions[0];
    const activityScore = latestSubmission?.grade?.score ?? latestSubmission?.aiGrade?.score;
    const hasGrade = activityScore != null;
    const automaticResult = getAutoGrade(latestSubmission, 'pptAutoGrade') || getAutoGrade(latestSubmission, 'excelAutoGrade');
    const locked = isManualGrade(latestSubmission);
    const hasSubmission = activitySubmissions.length > 0;

    return (
      <Space wrap>
        {hasGrade ? <Tag color="green" style={{fontSize:15,fontWeight:600,height:32,padding:'0 12px',lineHeight:'30px',display:'inline-flex',alignItems:'center',gap:5,borderRadius:6,marginRight:0}}><CheckCircleOutlined /> 得分：{activityScore}/10</Tag> : automaticResult ? <Tag color="orange">暂计：{automaticResult.score}/10 · 待复核</Tag> : null}
        {!locked && (
          <Button
            type="primary"
            icon={<FormOutlined />}
            onClick={() => handleSubmitAssignment(activity)}
            loading={uploadingActivityId === activity._id}
            disabled={!!uploadingActivityId}
          >
            {hasSubmission ? '重新提交作业' : '提交作业'}
          </Button>
        )}
        {hasSubmission && (
          <Button
            type="primary"
            danger={hasGrade}
            icon={<HistoryOutlined />}
            onClick={() => {
              setSelectedActivityId(activity._id);
              setShowHistory(true);
            }}
            style={{
              background: hasGrade ? '#52c41a' : undefined,
              borderColor: hasGrade ? '#52c41a' : undefined
            }}
          >
            {hasGrade || automaticResult ? "查看评分结果" : "查看提交记录"}
          </Button>
        )}
      </Space>
    );
  };

  // 修改提交历史Modal的渲染
  const renderSubmissionHistory = () => {
    const submissions = submissionHistoryMap[selectedActivityId] || [];
    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未找到认证token，请重新登录');
      return null; // 如果没有token，直接返回
    }

    // 找到Python文件提交
    const pythonSubmission = submissions.find(submission =>
      getFileType(submission.content.file?.mimeType, submission.content.file?.originalName) === 'py'
    );

    return (
      <Modal
        title={submissions.some(item => item.grade?.score != null || item.aiGrade?.score != null || item.pptAutoGrade?.score != null || item.excelAutoGrade?.score != null) ? '作业得分详情' : '作业提交记录'}
        open={showHistory}
        onCancel={() => {
          setShowHistory(false);
          setCurrentSubmissionCode('');
          setSelectedActivityId(null);
          setPreviewLoading(false); // 重置加载状态
        }}
        width={900}
        className="assignment-feedback-modal"
        footer={null}
        styles={{ body: { maxHeight: '74vh', overflowY: 'auto', padding: '8px 0 0' } }}
      >
        {submissions.length > 0 ? (
          <div className="assignment-feedback-records">
            {submissions.map((submission) => {
              return (
                <section key={submission._id} className="assignment-feedback-record">
                  <Row justify="space-between" align="middle" style={{ marginBottom: '16px' }}>
                    <Col flex="auto">
                      <Space size="large" style={{ flexWrap: 'wrap', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                        <Space size="large" style={{ flexWrap: 'wrap', gap: '8px' }}>
                          <Space>
                            <Text type="secondary">提交时间：</Text>
                            <Text>{formatDate(submission.submittedAt)}</Text>
                          </Space>
                          <Space>
                            <FileTextOutlined style={{ color: '#1890ff' }} />
                            <Text
                              style={{
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                color: '#1890ff'
                              }}
                              title={submission.content.file?.originalName}
                              onClick={() => handleResourceDownload(submission.content.file, true)}
                            >
                              {formatFileName(submission.content.file?.originalName, 24)}
                            </Text>
                          </Space>
                        </Space>
                        {(submission.grade?.score != null || submission.aiGrade?.score != null) && (!getAutoGrade(submission, 'pptAutoGrade') && !getAutoGrade(submission, 'excelAutoGrade') || isManualGrade(submission)) && (
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ fontSize: '15px', color: '#52c41a' }}>
                              得分：{submission.grade?.score ?? submission.aiGrade?.score}分
                            </Text>
                          </Space>
                        )}
                      </Space>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    {/* Python文件预览 */}
                    {getFileType(submission.content.file?.mimeType, submission.content.file?.originalName) === 'py' && (
                      <Col span={24}>
                        <div style={{ marginTop: '8px' }}>
                          {previewLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                              <Spin tip="加载代码中..." />
                            </div>
                          ) : (
                            <div style={{
                              marginTop: '8px',
                              background: '#f6f8fa',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              border: '1px solid #e8e8e8'
                            }}>
                              <SyntaxHighlighter
                                language="python"
                                style={docco}
                                showLineNumbers={true}
                                customStyle={{
                                  margin: 0,
                                  padding: '16px',
                                  maxHeight: '200px',
                                  overflow: 'auto',
                                  fontSize: '14px',
                                  lineHeight: '1.5',
                                  backgroundColor: '#ffffff'
                                }}
                                lineNumberStyle={{
                                  minWidth: '3em',
                                  paddingRight: '1em',
                                  color: '#666',
                                  userSelect: 'none'
                                }}
                                wrapLines={true}
                                wrapLongLines={true}
                              >
                                {submission._id === pythonSubmission?._id
                                  ? (currentSubmissionCode !== undefined
                                    ? (currentSubmissionCode || '# 空文件 - 这是一个空的Python文件')
                                    : '加载中...')
                                  : '加载中...'}
                              </SyntaxHighlighter>
                            </div>
                          )}
                        </div>
                      </Col>
                    )}

                    <Col span={24}>
                      <AutoGradeFeedback submission={submission} />
                      {!isManualGrade(submission) && (getAutoGrade(submission, 'pptAutoGrade') || getAutoGrade(submission, 'excelAutoGrade')) && activities.find(item => item._id === selectedActivityId)?.requireSubmission && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                          <Button type="primary" icon={<FormOutlined />} loading={uploadingActivityId === selectedActivityId} disabled={!!uploadingActivityId} onClick={() => handleSubmitAssignment(activities.find(item => item._id === selectedActivityId))}>修改后重新提交</Button>
                        </div>
                      )}
                    </Col>
                    {(submission.grade?.feedback || submission.aiGrade?.feedback) && (!getAutoGrade(submission, 'pptAutoGrade') && !getAutoGrade(submission, 'excelAutoGrade') || isManualGrade(submission)) && (
                      <Col span={24}>
                        <Text type="secondary" strong>评语：</Text>
                        <Paragraph style={{ margin: '8px 0' }}>
                          {submission.grade?.feedback || submission.aiGrade?.feedback}
                        </Paragraph>
                        {submission.aiGrade?.suggestions?.length > 0 && (
                          <>
                            <Text type="secondary" strong style={{ display: 'block', marginTop: '16px' }}>改进建议：</Text>
                            <List
                              size="small"
                              style={{ marginTop: '8px' }}
                              dataSource={submission.aiGrade.suggestions}
                              renderItem={(item, index) => (
                                <List.Item>
                                  <Text type="secondary">{index + 1}. </Text>
                                  {item}
                                </List.Item>
                              )}
                            />
                          </>
                        )}
                      </Col>
                    )}
                  </Row>
                </section>
              );
            })}
          </div>
        ) : (
          <Empty description="暂无提交记录" />
        )}
      </Modal >
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large">
          <div style={{ padding: '30px', background: 'rgba(0,0,0,0.05)' }}>
            <p>加载中...</p>
          </div>
        </Spin>
      </div>
    );
  }

  if (!lesson) {
    return <Empty description="课时不存在" />;
  }

  const { objectives = [], resources = [], exercises = [] } = lesson;

  return (
    <Layout style={{ minHeight: '100vh', margin: 0, padding: 0 }}>
      <Sider
        width={250}
        collapsedWidth={80}
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        breakpoint="lg"
        theme="light"
        style={{
          boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
          zIndex: 1,
          margin: 0,
          padding: 0
        }}
      >
        <div style={{
          padding: collapsed ? '24px 12px' : '24px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Space style={{ cursor: 'pointer' }} onClick={handleBack}>
            <ArrowLeftOutlined />
            {!collapsed && <Text strong>返回首页</Text>}
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedTask]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
          inlineCollapsed={collapsed}
        />
      </Sider>

      <Layout style={{ padding: 0, margin: 0 }}>
        <Content style={{ background: '#fff', padding: 0, margin: 0, minHeight: 280 }}>
          <Card className="lesson-header">
            <Row gutter={24} align="top">
              <Col flex="auto">
                <Title level={2}>{lesson.title}</Title>
                <Paragraph>{lesson.description}</Paragraph>
              </Col>
              {objectives.length > 0 && (
                <Col flex="400px">
                  <div className="lesson-objectives" style={{
                    background: '#fafafa',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0'
                  }}>
                    <Title level={4} style={{
                      fontSize: '16px',
                      marginTop: 0,
                      marginBottom: '16px',
                      color: '#1f1f1f'
                    }}>
                      学习目标
                    </Title>
                    <List
                      size="small"
                      dataSource={objectives}
                      split={false}
                      renderItem={(objective) => (
                        <List.Item style={{
                          border: 'none',
                          padding: '4px 0',
                          lineHeight: '24px'
                        }}>
                          <Text style={{
                            color: '#595959',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <CheckCircleOutlined style={{
                              marginRight: 8,
                              fontSize: '14px',
                              color: '#8c8c8c'
                            }} />
                            {objective}
                          </Text>
                        </List.Item>
                      )}
                    />
                  </div>
                </Col>
              )}
            </Row>
          </Card>

          {renderContent()}

          {/* AI助手按钮，根据allowAiUsage控制显示 */}
          {allowAiUsage && (
            <div className="floating-ai-helper">
              <Button
                type="default"
                shape="circle"
                size="large"
                onClick={() => setShowAIHelper(!showAIHelper)}
                className={showAIHelper ? 'active' : ''}
                icon={<AIIcon style={{ fontSize: '20px' }} />}
                style={{
                  background: '#fff',
                  borderColor: '#e8e8e8',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              />

              {/* AI助手悬浮窗 */}
              <div className={`ai-helper-panel ${showAIHelper ? 'show' : ''}`}>
                <CourseAIHelper
                  courseId={courseId}
                  chapterId={lessonId}
                  courseUnitId={unitId}
                  lessonId={lessonId}
                  currentContent={activities[getSelectedActivityIndex(selectedTask)]?.description || ''}
                  courseName={lesson?.title}
                  courseDescription={lesson?.description || ''}
                  selectedText={selectedText}
                  selectedQuestion={selectedQuestion}
                />
              </div>
            </div>
          )}

          <Modal
            title={currentExercise?.title}
            open={showExercise}
            onCancel={() => setShowExercise(false)}
            footer={null}
            width={800}
          >
            {currentExercise && (
              <div className="exercise-content">
                <Paragraph>{currentExercise.content}</Paragraph>
                {currentExercise.duration && (
                  <Text type="secondary">预计用时：{currentExercise.duration}分钟</Text>
                )}
              </div>
            )}
          </Modal>

          {renderSubmissionHistory()}



          {/* 选择文本弹出AI按钮，根据allowAiUsage控制显示 */}
          {allowAiUsage && (
            <SelectionPopup
              position={selectionPosition}
              onAskAI={handleAskAI}
              onClose={() => setSelectionPosition(null)}
            />
          )}

          {/* HTML预览模态框 - 支持全屏 */}
          <Modal
            title={
              <Row justify="space-between" align="middle">
                <Col>
                  <Space size="middle">
                    {htmlPreviewTitle}
                    <Button
                      type="text"
                      icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? '退出全屏' : '全屏查看'}
                    </Button>
                    <Button
                      type="text"
                      icon={<ExportOutlined />}
                      onClick={openHtmlInNewWindow}
                    >
                      在新窗口打开
                    </Button>
                  </Space>
                </Col>
              </Row>
            }
            open={showHtmlPreview}
            onCancel={() => {
              setShowHtmlPreview(false);
              setIsFullscreen(false);
              // 释放Blob URL
              if (htmlPreviewUrl) {
                URL.revokeObjectURL(htmlPreviewUrl);
                setHtmlPreviewUrl('');
              }
            }}
            footer={null}
            width={isFullscreen ? "100%" : "80%"}
            style={{
              top: isFullscreen ? 0 : 100,
              padding: 0,
              maxWidth: isFullscreen ? "100vw" : "1200px"
            }}

            styles={{
              body: {
                padding: 0,
                height: isFullscreen ? 'calc(100vh - 55px)' : 'calc(80vh)',
                overflow: 'hidden'
              },
              mask: {
                backgroundColor: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0.45)'
              }
            }}
            className={isFullscreen ? "fullscreen-modal" : ""}
            maskClosable={false} // 禁止点击遮罩层关闭模态框
            keyboard={false} // 禁止按ESC键关闭模态框
          >
            {htmlPreviewUrl && (
              <iframe
                src={htmlPreviewUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                title="HTML预览"
                sandbox="allow-same-origin allow-scripts"
              />
            )}
          </Modal>

          {/* 图片预览模态框 */}
          <Modal
            title={imagePreviewTitle}
            open={showImagePreview}
            onCancel={() => {
              setShowImagePreview(false);
            }}
            footer={null}
            width="auto"
            style={{ maxWidth: '90vw' }}
            centered
          >
            <div style={{ textAlign: 'center' }}>
              <Image
                src={imagePreviewUrl}
                alt={imagePreviewTitle}
                style={{ maxWidth: '100%', maxHeight: '80vh' }}
                preview={false}
              />
            </div>
          </Modal>

          {/* 视频预览模态框 */}
          <Modal
            title={videoPreviewTitle}
            open={showVideoPreview}
            onCancel={() => {
              setShowVideoPreview(false);
              setVideoPreviewUrl('');
            }}
            footer={null}
            width={isFullscreen ? '100%' : '80%'}
            style={{
              top: isFullscreen ? 0 : 100,
              padding: 0,
              maxWidth: isFullscreen ? '100vw' : '1200px'
            }}
            styles={{
              body: {
                padding: 0,
                height: isFullscreen ? 'calc(100vh - 55px)' : 'calc(80vh)',
                overflow: 'hidden'
              }
            }}
            className={isFullscreen ? 'fullscreen-modal' : ''}
            maskClosable={true}
          >
            {videoPreviewUrl && (
              <video
                src={videoPreviewUrl}
                style={{ width: '100%', height: '100%', background: '#000' }}
                controls
                controlsList="nodownload"
                preload="metadata"
              />
            )}
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default LessonDetail;
