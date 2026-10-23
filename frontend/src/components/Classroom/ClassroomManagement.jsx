import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, Row, Col, Upload, message, Select, Space, Typography, Switch, Button, Cascader, Table, Tag, Tooltip, Drawer, Modal, Badge, List, Empty } from 'antd';
import { classAPI, courseUnitAPI, courseManagementAPI, lessonAPI, loginRequestAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import SeatingChart, { CLASSROOM_CONFIG } from './SeatingChart';
import { UploadOutlined, DesktopOutlined, CheckCircleOutlined, CloseCircleOutlined, QuestionCircleOutlined, EyeOutlined, EyeInvisibleOutlined, UserSwitchOutlined, SwapOutlined, LaptopOutlined } from '@ant-design/icons';
import { typingAPI, quizAPI, spreadsheetActivityAPI, fillBlankAPI, pythonAPI, flowchartAPI } from '../../services/api';

const { Option } = Select;
const { Text } = Typography;

const ClassroomManagement = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || user._id; // Handle both id formats
      return userId ? (localStorage.getItem(`selected-classroom-${userId}`) || null) : null;
    } catch (e) {
      return null;
    }
  });
  const [settings, setSettings] = useState({
    allowIpChange: false,
    isInClass: false,
    allowAiUsage: false,
    currentLesson: null,
    autoRedirectToLesson: false
  });
  const [options, setOptions] = useState([]); // 级联选择器的选项
  const [selectedKeys, setSelectedKeys] = useState([]); // 选中的课程、单元、课时

  const navigate = useNavigate();
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
  const [showHistory, setShowHistory] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [selectedRange, setSelectedRange] = useState(null);
  const [currentSubmissionCode, setCurrentSubmissionCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // 新增状态变量
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [showAssignmentWindow, setShowAssignmentWindow] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(600); // 新增状态变量，用于存储Drawer宽度
  const [typingRecords, setTypingRecords] = useState([]);
  const [loadingTypingRecords, setLoadingTypingRecords] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  // 添加新的状态变量，用于控制何时获取打字记录
  const [shouldFetchTypingRecords, setShouldFetchTypingRecords] = useState(false);

  // 新增状态变量，用于控制何时获取quiz提交记录
  const [shouldFetchQuizSubmissions, setShouldFetchQuizSubmissions] = useState(false);
  const [quizSubmissions, setQuizSubmissions] = useState([]);

  // 新增状态变量，用于spreadsheet、fillblank、python活动
  const [spreadsheetSubmissions, setSpreadsheetSubmissions] = useState({});
  const [fillBlankSubmissions, setFillBlankSubmissions] = useState({});
  const [pythonSubmissions, setPythonSubmissions] = useState({});
  const [shouldFetchSpreadsheetSubmissions, setShouldFetchSpreadsheetSubmissions] = useState(false);
  const [shouldFetchFillBlankSubmissions, setShouldFetchFillBlankSubmissions] = useState(false);
  const [shouldFetchPythonSubmissions, setShouldFetchPythonSubmissions] = useState(false);
  const [loadingQuizSubmissions, setLoadingQuizSubmissions] = useState(false);

  // 流程图提交相关状态
  const [flowchartSubmissions, setFlowchartSubmissions] = useState({});
  const [shouldFetchFlowchartSubmissions, setShouldFetchFlowchartSubmissions] = useState(false);

  // 登录请求相关状态
  const [loginRequests, setLoginRequests] = useState([]);
  const [loadingLoginRequests, setLoadingLoginRequests] = useState(false);
  const [loginRequestDrawerVisible, setLoginRequestDrawerVisible] = useState(false);
  const loginRequestPollingRef = useRef(null);

  // 处理Python测试用例显示/隐藏
  const handlePythonTestCaseVisibility = async (activity, show) => {
    try {
      const isHidden = !show; // show=true means isHidden=false

      // 构建更新对象，将所有测试用例的 isHidden 属性设置为新值
      const updatedTestCases = activity.pythonSettings?.testCases?.map(tc => ({
        ...tc,
        isHidden: isHidden
      })) || [];

      // 调用API更新活动详情
      await lessonAPI.updateActivityDetails(activity.lessonId, activity._id, {
        pythonSettings: {
          testCases: updatedTestCases
        }
      });

      // 更新本地状态
      setActivities(prev => prev.map(a =>
        a._id === activity._id ? {
          ...a,
          pythonSettings: {
            ...a.pythonSettings,
            testCases: updatedTestCases
          }
        } : a
      ));

      message.success(show ? '已显示测试点详情' : '已隐藏测试点详情');
    } catch (error) {
      console.error('更新测试点可见性失败:', error);
      message.error('更新测试点可见性失败');
    }
  };

  // 处理测验发布状态 (Draft/Published)
  const handleQuizPublishStatus = async (activity, published) => {
    try {
      const quizId = activity.quizSettings?.quiz?._id || activity.quizSettings?.quiz;
      if (!quizId) {
        message.error('未找到关联的测验');
        return;
      }

      // 只有当当前状态与目标状态不一致时才调用 API
      // 如果 published=true，我们需要状态为 PUBLISHED
      // 如果 published=false，我们需要状态为 DRAFT
      // quizAPI.quizzes.publish 只是切换状态，不接受参数，所以我们需要先检查当前状态

      // 因为 quizAPI.quizzes.publish 是一个 toggle 操作，我们需要小心使用
      // 最好是后端提供确定的 publish/unpublish 接口，或者我们先获取最新状态

      // 假设 publish 接口就是切换状态
      await quizAPI.quizzes.publish(quizId);

      // 更新本地状态
      setActivities(prev => prev.map(a => {
        if (a._id === activity._id && a.quizSettings?.quiz) {
          return {
            ...a,
            quizSettings: {
              ...a.quizSettings,
              quiz: {
                ...a.quizSettings.quiz,
                status: published ? 'PUBLISHED' : 'DRAFT'
              }
            }
          };
        }
        return a;
      }));

      message.success(published ? '测验已发布' : '测验已转为草稿');
    } catch (error) {
      console.error('更新测验状态失败:', error);
      message.error('更新测验状态失败');
    }
  };

  // 获取作业提交情况
  const fetchAssignmentSubmissions = async (courseId, unitId, lessonId) => {
    if (!courseId || !unitId || !lessonId || !selectedClass) return;

    // 避免重复请求
    if (loadingSubmissions) {
      console.log('已有作业提交请求正在进行中，跳过重复请求');
      return;
    }

    setLoadingSubmissions(true);
    try {
      // 获取课时详情，找出需要提交的活动
      const lessonResponse = await courseManagementAPI.getLesson(courseId, unitId, lessonId);
      if (lessonResponse.success && lessonResponse.data) {
        // 获取需要提交的活动（包括标记为requireSubmission的和flowchart类型的）
        const submissionActivities = lessonResponse.data.activities.filter(activity =>
          activity.requireSubmission || activity.type === 'flowchart'
        );

        // 如果有需要提交的活动，获取每个活动的提交情况
        if (submissionActivities.length > 0) {
          const allSubmissions = [];

          for (const activity of submissionActivities) {
            const response = await courseManagementAPI.getTeacherSubmissions(
              courseId,
              unitId,
              lessonId,
              activity._id
            );

            if (response && response.length > 0) {
              // 过滤当前班级的提交
              const classSubmissions = response.filter(submission =>
                submission.student && submission.student.classId === selectedClass
              );

              // 为每个提交添加活动信息
              classSubmissions.forEach(submission => {
                allSubmissions.push({
                  ...submission,
                  activityTitle: activity.title,
                  activityId: activity._id
                });
              });
            }
          }

          setAssignmentSubmissions(allSubmissions);
        } else {
          setAssignmentSubmissions([]);
        }
      }
    } catch (error) {
      console.error('获取作业提交情况失败:', error);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // 获取活动相关的打字记录（按活动分组，匹配LessonDetail的逻辑）
  const fetchClassTypingRecords = async () => {
    if (!selectedClass || !selectedKeys || selectedKeys.length !== 3) return;

    const hasTypingActivity = activities.some(activity => activity.type === 'typing');
    if (!hasTypingActivity) {
      console.log('当前课时没有打字活动，跳过获取打字记录');
      return;
    }

    setLoadingTypingRecords(true);
    try {
      const [courseId, unitId, lessonId] = selectedKeys;
      const recordsByStudent = {}; // { studentId: { activityId: { hasRecord, speed, accuracy } } }

      // 获取所有打字活动
      const typingActivities = activities.filter(activity => activity.type === 'typing');

      for (const activity of typingActivities) {
        try {
          // 获取该活动的所有打字记录（使用教师端API，可以获取整个班级的记录）
          const response = await typingAPI.getTypingRecords({
            classId: selectedClass,
            lessonId: lessonId,
            activityId: activity._id
          });

          if (response && response.records) {
            // 按学生ID分组
            response.records.forEach(record => {
              const studentId = record.student?._id || record.studentId;
              if (!studentId) return;

              // 只处理当前班级的学生
              const isClassStudent = students.some(s => s._id === studentId);
              if (!isClassStudent) return;

              if (!recordsByStudent[studentId]) {
                recordsByStudent[studentId] = {};
              }

              // 如果这个学生已经有这个活动的记录，更新为最新的或者累计统计
              if (!recordsByStudent[studentId][activity._id]) {
                recordsByStudent[studentId][activity._id] = {
                  hasRecord: true,
                  count: 1,
                  speed: record.speed || 0,
                  accuracy: record.accuracy || 0,
                  totalSpeed: record.speed || 0,
                  totalAccuracy: record.accuracy || 0
                };
              } else {
                const existing = recordsByStudent[studentId][activity._id];
                existing.count++;
                existing.totalSpeed += record.speed || 0;
                existing.totalAccuracy += record.accuracy || 0;
                existing.speed = Math.round(existing.totalSpeed / existing.count);
                existing.accuracy = Math.round(existing.totalAccuracy / existing.count);
              }
            });
          }
        } catch (error) {
          console.error(`获取打字活动${activity._id}的记录失败:`, error);
        }
      }

      console.log('处理后的打字记录(按活动分组):', recordsByStudent);
      setTypingRecords(recordsByStudent);
    } catch (error) {
      console.error('获取班级打字记录失败:', error);
      message.error('获取打字记录失败');
    } finally {
      setLoadingTypingRecords(false);
    }
  };

  // 获取班级quiz提交记录
  const fetchClassQuizSubmissions = async () => {
    if (!selectedClass) return;

    // 首先检查是否有quiz类型的活动
    const hasQuizActivity = activities.some(activity => activity.type === 'quiz');

    // 如果没有quiz活动，不需要获取提交记录
    if (!hasQuizActivity) {
      console.log('当前课时没有quiz活动，跳过获取提交记录');
      return;
    }

    setLoadingQuizSubmissions(true);
    try {
      // 如果当前有选择特定课时，并且能够确定对应的quizId
      // 如果当前有选择特定课时，并且能够确定对应的quizId
      let quizIds = [];
      activities.forEach(activity => {
        if (activity.type === 'quiz' && activity.quizSettings && activity.quizSettings.quiz) {
          // Check if quiz is populated (object) or just ID (string)
          const quiz = activity.quizSettings.quiz;
          const quizId = typeof quiz === 'object' ? quiz._id : quiz;
          if (quizId) {
            quizIds.push(quizId);
          }
        }
      });

      console.log('准备获取的quiz IDs:', quizIds);

      // 合并所有班级学生的测验提交记录
      const submissionsByStudent = {};

      // 如果找到了具体的quizId，逐个获取对应的提交记录
      if (quizIds.length > 0) {
        for (const quizId of quizIds) {
          console.log(`获取特定测验(${quizId})的提交记录`);
          const response = await quizAPI.submissions.getClassSubmissions(selectedClass, quizId);

          if (response.success && response.students) {
            // 处理当前测验的提交记录，合并到总记录中
            response.students.forEach(student => {
              if (student.student && student.student._id) {
                const studentId = student.student._id;

                // 如果这是第一次遇到这个学生，初始化其提交记录数组
                if (!submissionsByStudent[studentId]) {
                  submissionsByStudent[studentId] = [];
                }

                // 添加该学生的提交记录到已有的数组中
                if (student.submissions && student.submissions.length > 0) {
                  submissionsByStudent[studentId].push(...student.submissions);
                }
              }
            });
          }
        }
        console.log('合并后的提交记录:', submissionsByStudent);
      } else {
        // 如果没有找到任何quizId，获取所有的提交记录
        console.log('未找到具体的quiz ID，获取班级所有测验提交记录');
        const response = await quizAPI.submissions.getClassSubmissions(selectedClass);

        if (response.success && response.students) {
          response.students.forEach(student => {
            if (student.student && student.student._id) {
              submissionsByStudent[student.student._id] = student.submissions;
            }
          });
        }
      }

      setQuizSubmissions(submissionsByStudent);
    } catch (error) {
      console.error('获取班级quiz提交记录失败:', error);
      message.error('获取quiz提交记录失败');
    } finally {
      setLoadingQuizSubmissions(false);
    }
  };

  // 获取班级spreadsheet提交记录
  const fetchClassSpreadsheetSubmissions = async () => {
    if (!selectedClass || !selectedKeys || selectedKeys.length !== 3) return;

    const hasSpreadsheetActivity = activities.some(activity => activity.type === 'spreadsheet');
    if (!hasSpreadsheetActivity) {
      console.log('当前课时没有spreadsheet活动，跳过获取提交记录');
      return;
    }

    try {
      const [courseId, unitId, lessonId] = selectedKeys;
      const submissionsByStudent = {};

      // 获取所有spreadsheet活动
      const spreadsheetActivities = activities.filter(activity => activity.type === 'spreadsheet');

      for (const activity of spreadsheetActivities) {
        try {
          // 使用批量获取所有提交的API
          const response = await spreadsheetActivityAPI.getActivitySubmissions(lessonId, activity._id);
          if (response.success && response.data) {
            // 按学生ID分组
            response.data.forEach(submission => {
              const studentId = submission.studentId?._id || submission.studentId;
              if (!studentId) return;

              // 只处理当前班级的学生
              const isClassStudent = students.some(s => s._id === studentId);
              if (!isClassStudent) return;

              if (!submissionsByStudent[studentId]) {
                submissionsByStudent[studentId] = {};
              }
              submissionsByStudent[studentId][activity._id] = {
                hasSubmission: !!submission.data, // 有内容即视为已保存
                submission: submission
              };
            });
          }
        } catch (error) {
          console.error(`获取spreadsheet活动${activity._id}的提交失败:`, error);
        }
      }

      setSpreadsheetSubmissions(submissionsByStudent);
    } catch (error) {
      console.error('获取班级spreadsheet提交记录失败:', error);
    }
  };

  // 获取班级fillblank提交记录
  const fetchClassFillBlankSubmissions = async () => {
    if (!selectedClass || !selectedKeys || selectedKeys.length !== 3) return;

    const hasFillBlankActivity = activities.some(activity => activity.type === 'fillblank');
    if (!hasFillBlankActivity) {
      console.log('当前课时没有fillblank活动，跳过获取提交记录');
      return;
    }

    try {
      const [courseId, unitId, lessonId] = selectedKeys;
      const submissionsByStudent = {};

      // 获取所有fillblank活动
      const fillBlankActivities = activities.filter(activity => activity.type === 'fillblank');

      for (const activity of fillBlankActivities) {
        try {
          // 使用批量获取所有提交的API
          const response = await fillBlankAPI.getActivitySubmissions(lessonId, activity._id);
          if (response.success && response.data) {
            // 按学生ID分组
            response.data.forEach(submission => {
              const studentId = submission.studentId?._id || submission.studentId;
              if (!studentId) return;

              // 只处理当前班级的学生
              const isClassStudent = students.some(s => s._id === studentId);
              if (!isClassStudent) return;

              if (!submissionsByStudent[studentId]) {
                submissionsByStudent[studentId] = {};
              }
              submissionsByStudent[studentId][activity._id] = {
                hasSubmission: submission.status === 'submitted',
                submission: submission
              };
            });
          }
        } catch (error) {
          console.error(`获取fillblank活动${activity._id}的提交失败:`, error);
        }
      }

      setFillBlankSubmissions(submissionsByStudent);
    } catch (error) {
      console.error('获取班级fillblank提交记录失败:', error);
    }
  };

  // 获取班级python提交记录
  const fetchClassPythonSubmissions = async () => {
    if (!selectedClass || !selectedKeys || selectedKeys.length !== 3) return;

    const hasPythonActivity = activities.some(activity => activity.type === 'python');
    if (!hasPythonActivity) {
      console.log('当前课时没有python活动，跳过获取提交记录');
      return;
    }

    try {
      const [courseId, unitId, lessonId] = selectedKeys;
      const submissionsByStudent = {};

      // 获取所有python活动
      const pythonActivities = activities.filter(activity => activity.type === 'python');

      for (const activity of pythonActivities) {
        try {
          // 使用批量获取所有提交的API
          const response = await pythonAPI.getActivitySubmissions(lessonId, activity._id, selectedClass);
          if (response.success && response.data) {
            // 按学生ID分组
            response.data.forEach(submission => {
              const studentId = submission.studentId?._id || submission.studentId;
              if (!studentId) return;

              // 只处理当前班级的学生
              const isClassStudent = students.some(s => s._id === studentId);
              if (!isClassStudent) return;

              if (!submissionsByStudent[studentId]) {
                submissionsByStudent[studentId] = {};
              }
              submissionsByStudent[studentId][activity._id] = {
                hasSubmission: submission.status === 'submitted',
                submission: submission
              };
            });
          }
        } catch (error) {
          console.error(`获取python活动${activity._id}的提交失败:`, error);
        }
      }

      setPythonSubmissions(submissionsByStudent);
    } catch (error) {
      console.error('获取班级python提交记录失败:', error);
    }
  };

  // 获取班级flowchart提交记录
  const fetchClassFlowchartSubmissions = async () => {
    if (!selectedClass || !selectedKeys || selectedKeys.length !== 3) return;

    const hasFlowchartActivity = activities.some(activity => activity.type === 'flowchart');
    if (!hasFlowchartActivity) {
      console.log('当前课时没有flowchart活动，跳过获取提交记录');
      return;
    }

    try {
      const [courseId, unitId, lessonId] = selectedKeys;
      const submissionsByStudent = {};

      // 获取所有flowchart活动
      const flowchartActivities = activities.filter(activity => activity.type === 'flowchart');

      for (const activity of flowchartActivities) {
        try {
          // 使用flowchartAPI获取活动的所有提交
          const response = await flowchartAPI.getActivitySubmissions(lessonId, activity._id, selectedClass);
          if (response.success && response.submissions) {
            // 按学生ID分组
            response.submissions.forEach(submission => {
              const studentId = submission.userId?._id || submission.userId;
              if (!studentId) return;

              // 只处理当前班级的学生
              const isClassStudent = students.some(s => s._id === studentId);
              if (!isClassStudent) return;

              if (!submissionsByStudent[studentId]) {
                submissionsByStudent[studentId] = {};
              }
              // 任何有记录的流程图都视为已完成（因为学生端只有保存按钮）
              submissionsByStudent[studentId][activity._id] = {
                hasSubmission: true, // 有数据就是已保存/已完成
                status: submission.status,
                submission: submission
              };
            });
          }
        } catch (error) {
          console.error(`获取flowchart活动${activity._id}的提交失败:`, error);
        }
      }

      setFlowchartSubmissions(submissionsByStudent);
    } catch (error) {
      console.error('获取班级flowchart提交记录失败:', error);
    }
  };

  // 获取登录请求
  const fetchLoginRequests = async () => {
    if (!selectedClass) return;

    setLoadingLoginRequests(true);
    try {
      const response = await loginRequestAPI.getPendingRequests(selectedClass);
      if (response.success) {
        setLoginRequests(response.requests || []);
      }
    } catch (error) {
      console.error('获取登录请求失败:', error);
    } finally {
      setLoadingLoginRequests(false);
    }
  };

  // 同意登录请求
  const handleApproveLoginRequest = async (requestId) => {
    try {
      const response = await loginRequestAPI.approveRequest(requestId);
      if (response.success) {
        message.success('已同意登录请求');
        fetchLoginRequests(); // 刷新列表
      }
    } catch (error) {
      console.error('同意登录请求失败:', error);
      message.error('操作失败');
    }
  };

  // 拒绝登录请求
  const handleRejectLoginRequest = async (requestId) => {
    try {
      const response = await loginRequestAPI.rejectRequest(requestId);
      if (response.success) {
        message.success('已拒绝登录请求');
        fetchLoginRequests(); // 刷新列表
      }
    } catch (error) {
      console.error('拒绝登录请求失败:', error);
      message.error('操作失败');
    }
  };

  // 批量同意所有请求
  const handleBulkApprove = async () => {
    if (!selectedClass || loginRequests.length === 0) return;

    try {
      const response = await loginRequestAPI.bulkApprove(selectedClass);
      if (response.success) {
        message.success(`已同意 ${response.count} 个登录请求`);
        fetchLoginRequests(); // 刷新列表
      }
    } catch (error) {
      console.error('批量同意失败:', error);
      message.error('批量操作失败');
    }
  };

  // 批量拒绝所有请求
  const handleBulkReject = async () => {
    if (!selectedClass || loginRequests.length === 0) return;

    try {
      const response = await loginRequestAPI.bulkReject(selectedClass);
      if (response.success) {
        message.success(`已拒绝 ${response.count} 个登录请求`);
        fetchLoginRequests(); // 刷新列表
      }
    } catch (error) {
      console.error('批量拒绝失败:', error);
      message.error('批量操作失败');
    }
  };

  // 登录请求轮询
  useEffect(() => {
    if (selectedClass) {
      // 立即获取一次
      fetchLoginRequests();

      // 每10秒轮询一次
      loginRequestPollingRef.current = setInterval(() => {
        fetchLoginRequests();
      }, 10000);
    }

    return () => {
      if (loginRequestPollingRef.current) {
        clearInterval(loginRequestPollingRef.current);
      }
    };
  }, [selectedClass]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await classAPI.getTeacherClasses();
        // 将班级按年级分组
        const groupedClasses = response.data.reduce((acc, cls) => {
          if (!acc[cls.grade]) {
            acc[cls.grade] = [];
          }
          acc[cls.grade].push(cls);
          return acc;
        }, {});
        setClasses(groupedClasses);
        // 只有在没有已选择班级时，才设置默认班级
        let savedClass = null;
        try {
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const userId = user.id || user._id;
          if (userId) {
            savedClass = localStorage.getItem(`selected-classroom-${userId}`);
          }
        } catch (e) { }
        if (!savedClass && response.data.length > 0) {
          setSelectedClass(response.data[0]._id);
          try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = user.id || user._id;
            if (userId) {
              localStorage.setItem(`selected-classroom-${userId}`, response.data[0]._id);
            }
          } catch (e) {
            console.error('Error saving selected class preference', e);
          }
        }
      } catch (error) {
        console.error('获取班级列表失败:', error);
        message.error('获取班级列表失败');
      }
    };

    fetchClasses();
  }, []);

  // 在班级变更时不再自动获取打字记录，等待课时加载后再获取

  // 修改 useEffect，使用 shouldFetchTypingRecords 作为依赖
  useEffect(() => {
    if (shouldFetchTypingRecords && selectedClass && students.length > 0) {
      fetchClassTypingRecords();
      setShouldFetchTypingRecords(false);
    }
  }, [shouldFetchTypingRecords, selectedClass, students]);

  // 新增 useEffect，使用 shouldFetchQuizSubmissions 作为依赖
  useEffect(() => {
    if (shouldFetchQuizSubmissions && selectedClass) {
      fetchClassQuizSubmissions();
      // 重置标志，避免重复获取
      setShouldFetchQuizSubmissions(false);
    }
  }, [shouldFetchQuizSubmissions, selectedClass]);

  // 新增 useEffect，使用 shouldFetchSpreadsheetSubmissions 作为依赖
  useEffect(() => {
    if (shouldFetchSpreadsheetSubmissions && selectedClass && students.length > 0) {
      fetchClassSpreadsheetSubmissions();
      setShouldFetchSpreadsheetSubmissions(false);
    }
  }, [shouldFetchSpreadsheetSubmissions, selectedClass, students]);

  // 新增 useEffect，使用 shouldFetchFillBlankSubmissions 作为依赖
  useEffect(() => {
    if (shouldFetchFillBlankSubmissions && selectedClass && students.length > 0) {
      fetchClassFillBlankSubmissions();
      setShouldFetchFillBlankSubmissions(false);
    }
  }, [shouldFetchFillBlankSubmissions, selectedClass, students]);

  // 新增 useEffect，使用 shouldFetchPythonSubmissions 作为依赖
  useEffect(() => {
    if (shouldFetchPythonSubmissions && selectedClass && students.length > 0) {
      fetchClassPythonSubmissions();
      setShouldFetchPythonSubmissions(false);
    }
  }, [shouldFetchPythonSubmissions, selectedClass, students]);

  // 新增 useEffect，使用 shouldFetchFlowchartSubmissions 作为依赖
  useEffect(() => {
    if (shouldFetchFlowchartSubmissions && selectedClass && students.length > 0) {
      fetchClassFlowchartSubmissions();
      setShouldFetchFlowchartSubmissions(false);
    }
  }, [shouldFetchFlowchartSubmissions, selectedClass, students]);

  useEffect(() => {
    if (selectedKeys && selectedKeys.length === 3 && options.length > 0) {
      const [courseId, unitId, lessonId] = selectedKeys;
      // 当选择的课时变化时，加载课时活动和提交情况
      loadActivitiesForLesson(courseId, unitId, lessonId);
      // 这里调用获取作业提交情况，是级联选择变化后触发的数据获取
      // handleCascaderChange中不再单独调用此函数，避免重复请求
      fetchAssignmentSubmissions(courseId, unitId, lessonId);
    }
  }, [selectedKeys, options]);

  // 获取课程、单元、课时数据
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!selectedClass) return;

      // 清空活动状态
      setActivities([]);

      try {
        const response = await courseManagementAPI.getTeacherCourses();
        const courseData = response.data || [];

        // 过滤出对当前班级可见的课程
        const filteredCourses = courseData.filter(course =>
          course.isPublic ||
          (course.accessibleClasses && course.accessibleClasses.includes(selectedClass))
        );

        // 构建级联选择器的选项
        const cascaderOptions = await Promise.all(filteredCourses.map(async course => {
          const unitsResponse = await courseManagementAPI.getUnits(course._id);
          const units = unitsResponse.data || [];

          return {
            value: course._id,
            label: course.title,
            children: await Promise.all(units.map(async unit => {
              const lessonsResponse = await courseManagementAPI.getLessons(course._id, unit._id);
              const lessons = lessonsResponse.success ? lessonsResponse.data : [];


              return {
                value: unit._id,
                label: unit.title,
                children: lessons.map(lesson => ({
                  value: lesson._id,
                  label: (
                    <span>
                      {lesson.title}
                      {lesson.status === 'draft' && (
                        <Tag color="orange" style={{ marginLeft: 8 }}>草稿</Tag>
                      )}
                    </span>
                  ),
                  lesson: lesson // Store the full lesson object for later use
                }))
              };
            }))
          };
        }));

        setOptions(cascaderOptions);
        // 在设置完选项后，获取班级设置
        await fetchClassSettings();
        console.log(cascaderOptions);
        if (selectedKeys && selectedKeys.length === 3) {
          const [courseId, unitId, lessonId] = selectedKeys;
          const course = cascaderOptions.find(c => c.value === courseId);
          if (course) {
            const unit = course.children.find(u => u.value === unitId);
            if (unit) {
              const lessonItem = unit.children.find(l => l.value === lessonId);
              if (lessonItem && lessonItem.lesson) {
                setActivities(lessonItem.lesson.activities.map(activity => ({
                  ...activity,
                  lessonId: lessonId
                })));
              }
            }
          }
        }
      } catch (error) {
        console.error('获取课程数据失败:', error);
        message.error('获取课程数据失败');
      }
    };

    fetchCourseData();
  }, [selectedClass]);

  // 处理级联选择变化
  const handleCascaderChange = (value) => {
    setSelectedKeys(value);

    // 清除旧的提交记录和相关状态
    setAssignmentSubmissions([]);
    setShouldFetchTypingRecords(false);
    setShouldFetchQuizSubmissions(false);
    setActivities([]);

    if (value && value.length === 3) {
      const [courseId, unitId, lessonId] = value;

      const course = options.find(c => c.value === courseId);
      if (course) {
        const unit = course.children?.find(u => u.value === unitId);
        if (unit) {
          const lessonItem = unit.children?.find(l => l.value === lessonId);
          if (lessonItem && lessonItem.lesson && lessonItem.lesson.activities) {
            // Set only the activities for the selected lesson
            const newActivities = lessonItem.lesson.activities.map(activity => ({
              ...activity,
              lessonId: lessonId
            }));

            setActivities(newActivities);

            // 检查是否有打字活动，如果有则设置标志以触发获取打字记录
            if (newActivities.some(activity => activity.type === 'typing')) {
              setShouldFetchTypingRecords(true);
            }

            // 检查是否有quiz活动，如果有则设置标志以触发获取提交记录 
            const hasQuiz = newActivities.some(activity => activity.type === 'quiz');
            if (hasQuiz) {
              setShouldFetchQuizSubmissions(true);
            }

            // 检查是否有spreadsheet活动，如果有则设置标志以触发获取提交记录
            if (newActivities.some(activity => activity.type === 'spreadsheet')) {
              setShouldFetchSpreadsheetSubmissions(true);
            }

            // 检查是否有fillblank活动，如果有则设置标志以触发获取提交记录
            if (newActivities.some(activity => activity.type === 'fillblank')) {
              setShouldFetchFillBlankSubmissions(true);
            }

            // 检查是否有python活动，如果有则设置标志以触发获取提交记录
            if (newActivities.some(activity => activity.type === 'python')) {
              setShouldFetchPythonSubmissions(true);
            }

            // 检查是否有flowchart活动，如果有则设置标志以触发获取提交记录
            if (newActivities.some(activity => activity.type === 'flowchart')) {
              setShouldFetchFlowchartSubmissions(true);
            }
          } else {
            // 如果没有活动数据，设置空数组
            setActivities([]);
          }
        }
      }
      // 更新当前课程、单元和课时
      updateClassSettings('currentCourse', courseId);
      updateClassSettings('currentUnit', unitId);
      updateClassSettings('currentLesson', lessonId);
    } else if (value && value.length === 2) {
      const [courseId, unitId] = value;
      // 只更新课程和单元
      updateClassSettings('currentCourse', courseId);
      updateClassSettings('currentUnit', unitId);
      updateClassSettings('currentLesson', null);
    } else if (value && value.length === 1) {
      const [courseId] = value;
      // 只更新课程
      updateClassSettings('currentCourse', courseId);
      updateClassSettings('currentUnit', null);
      updateClassSettings('currentLesson', null);
    } else {
      // 清空所有选择
      updateClassSettings('currentCourse', null);
      updateClassSettings('currentUnit', null);
      updateClassSettings('currentLesson', null);
    }
  };

  // 定期从服务器获取学生信息（在线状态、座位号等）
  useEffect(() => {
    if (!selectedClass) return;

    const fetchStudentInfo = async () => {
      try {
        const response = await classAPI.getClassOnlineStudents(selectedClass);
        // 获取学生基本信息（包含在线状态、IP等）
        const onlineStudents = (response.data || []).map(student => ({
          ...student,
          ip: student.ip
        }));
        console.log('获取到的学生数据:', onlineStudents);
        setStudents(onlineStudents);

        // 保存学生统计信息（在线人数、缺席人数等）
        if (response.stats) {
          console.log('学生统计信息:', response.stats);
        }
      } catch (error) {
        console.error('获取学生信息失败:', error);
      }
    };

    const onRefresh = () => {
      fetchStudentInfo();
    };
    // 监听来自子组件的刷新事件
    window.addEventListener('refresh-class-students', onRefresh);

    // 首次加载
    fetchStudentInfo();

    // 每30秒更新一次在线状态
    const timer = setInterval(fetchStudentInfo, 30000);

    return () => {
      clearInterval(timer);
      window.removeEventListener('refresh-class-students', onRefresh);
    };
  }, [selectedClass]);

  // 获取班级设置
  const fetchClassSettings = async () => {
    if (!selectedClass) return;
    try {
      const response = await classAPI.getClassDetails(selectedClass);
      const data = response.data;

      // 更新设置
      setSettings({
        allowIpChange: data.allowIpChange,
        isInClass: data.isInClass,
        allowAiUsage: data.allowAiUsage,
        currentLesson: data.currentLesson,
        autoRedirectToLesson: data.autoRedirectToLesson
      });

      let keys = [];
      // 如果有当前课程、单元和课时，设置级联选择器的值
      if (data.currentCourse?._id && data.currentUnit?._id && data.currentLesson?._id) {
        keys = [
          data.currentCourse._id,
          data.currentUnit._id,
          data.currentLesson._id
        ];
      } else if (data.currentCourse?._id && data.currentUnit?._id) {
        keys = [
          data.currentCourse._id,
          data.currentUnit._id
        ];
      } else if (data.currentCourse?._id) {
        keys = [data.currentCourse._id];
      }

      setSelectedKeys(keys);

      // 如果有课时，直接加载活动
      if (keys.length === 3) {
        const [courseId, unitId, lessonId] = keys;

        // 在这里加载活动
        await loadActivitiesForLesson(courseId, unitId, lessonId);
        // 注：不需要在这里调用fetchAssignmentSubmissions
        // 因为setSelectedKeys(keys)会触发useEffect中的调用
        // await fetchAssignmentSubmissions(courseId, unitId, lessonId);
      }
    } catch (error) {
      console.error('获取班级设置失败:', error);
    }
  };

  // 修改 loadActivitiesForLesson
  const loadActivitiesForLesson = async (courseId, unitId, lessonId) => {
    setLoadingActivities(true);
    try {
      // 从 options 中查找对应的课时
      const course = options.find(c => c.value === courseId);
      if (course) {
        const unit = course.children?.find(u => u.value === unitId);
        if (unit) {
          const lessonItem = unit.children?.find(l => l.value === lessonId);
          if (lessonItem && lessonItem.lesson && lessonItem.lesson.activities) {
            const newActivities = lessonItem.lesson.activities.map(activity => ({
              ...activity,
              lessonId: lessonId
            }));

            setActivities(newActivities);

            // 检查是否有打字活动，如果有则设置标志以触发获取打字记录
            if (newActivities.some(activity => activity.type === 'typing')) {
              setShouldFetchTypingRecords(true);
            }

            // 检查是否有quiz活动，如果有则设置标志以触发获取提交记录
            const hasQuiz = newActivities.some(activity => activity.type === 'quiz');
            if (hasQuiz && selectedClass) {
              console.log('检测到quiz活动，设置标志以获取提交记录');
              setShouldFetchQuizSubmissions(true);
            }

            // 检查是否有spreadsheet活动
            if (newActivities.some(activity => activity.type === 'spreadsheet') && selectedClass) {
              setShouldFetchSpreadsheetSubmissions(true);
            }

            // 检查是否有fillblank活动
            if (newActivities.some(activity => activity.type === 'fillblank') && selectedClass) {
              setShouldFetchFillBlankSubmissions(true);
            }

            // 检查是否有python活动
            if (newActivities.some(activity => activity.type === 'python') && selectedClass) {
              setShouldFetchPythonSubmissions(true);
            }

            // 检查是否有flowchart活动
            if (newActivities.some(activity => activity.type === 'flowchart') && selectedClass) {
              setShouldFetchFlowchartSubmissions(true);
            }

            setLoadingActivities(false);
            return;
          }
        }
      }

      // 如果在 options 中找不到，则直接从 API 获取
      const lessonResponse = await courseManagementAPI.getLesson(courseId, unitId, lessonId);
      if (lessonResponse.success && lessonResponse.data) {
        // 确保 activities 存在且是数组
        const newActivities = (lessonResponse.data.activities || []).map(activity => ({
          ...activity,
          lessonId: lessonId
        }));

        setActivities(newActivities);

        // 检查是否有打字活动，如果有则设置标志以触发获取打字记录
        if (newActivities.some(activity => activity.type === 'typing')) {
          setShouldFetchTypingRecords(true);
        }

        // 检查是否有quiz活动，如果有则设置标志以触发获取提交记录
        const hasQuiz = newActivities.some(activity => activity.type === 'quiz');
        if (hasQuiz && selectedClass) {
          console.log('检测到quiz活动，设置标志以获取提交记录');
          setShouldFetchQuizSubmissions(true);
        }

        // 检查是否有spreadsheet活动
        if (newActivities.some(activity => activity.type === 'spreadsheet') && selectedClass) {
          setShouldFetchSpreadsheetSubmissions(true);
        }

        // 检查是否有fillblank活动
        if (newActivities.some(activity => activity.type === 'fillblank') && selectedClass) {
          setShouldFetchFillBlankSubmissions(true);
        }

        // 检查是否有python活动
        if (newActivities.some(activity => activity.type === 'python') && selectedClass) {
          setShouldFetchPythonSubmissions(true);
        }

        // 检查是否有flowchart活动
        if (newActivities.some(activity => activity.type === 'flowchart') && selectedClass) {
          setShouldFetchFlowchartSubmissions(true);
        }
      } else {
        // 如果没有获取到数据，设置一个空数组
        setActivities([]);
      }
    } catch (error) {
      console.error('加载课时活动失败:', error);
      // 出错时设置空数组
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  // 更新班级设置
  const updateClassSettings = async (key, value) => {
    try {
      await classAPI.updateClassSettings(selectedClass, { [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('更新班级设置失败:', error);
      message.error('更新班级设置失败');
    }
  };

  // 修改班级选择的处理函数
  const handleClassChange = (classId) => {
    // 清空所有与班级相关的状态，避免数据刷新问题
    setTypingRecords([]);
    setQuizSubmissions({});
    setAssignmentSubmissions([]);
    setActivities([]);
    setSelectedKeys([]);
    setStudents([]);

    // 更新选定的班级
    setSelectedClass(classId);
    setSelectedClass(classId);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || user._id;
      if (userId) {
        localStorage.setItem(`selected-classroom-${userId}`, classId);
      }
    } catch (e) {
      console.error('Error saving selected class preference', e);
    }
  };

  // 打开模拟学生页面
  const openStudentSimulation = () => {
    if (!selectedKeys || selectedKeys.length < 3) {
      message.warning('请先选择具体的课时');
      return;
    }

    const [courseId, unitId, lessonId] = selectedKeys;

    // 使用路径参数格式构建URL
    const url = `/student/course/${courseId}/unit/${unitId}/lesson/${lessonId}`;

    // 如果需要额外的模拟模式参数，可以添加查询参数
    const params = new URLSearchParams({
      mode: 'simulation',
      classId: selectedClass
    });

    // 打开新窗口并传递参数
    window.open(`${url}?${params.toString()}`, '_blank');
  };

  // 修改 getSubmissionTableData 函数以包含打字数据
  const getSubmissionTableData = () => {
    if (!students.length) return [];

    // 获取当前课时的所有需要提交的活动
    const activityList = [];

    // 首先从当前选择的课时中获取标记为需要提交的活动（包括流程图活动）
    const requiredActivities = activities.filter(activity => activity.requireSubmission || activity.type === 'flowchart');

    // 如果当前课时有标记为需要提交的活动，添加到活动列表中
    requiredActivities.forEach(activity => {
      if (activity._id && !activityList.some(a => a.id === activity._id)) {
        activityList.push({
          id: activity._id,
          title: activity.title || '未命名活动'
        });
      }
    });

    // 然后从已有提交记录中添加活动
    if (assignmentSubmissions.length > 0) {
      // 从提交记录中提取活动信息
      const activityMap = {};
      assignmentSubmissions.forEach(submission => {
        if (submission.activityId && !activityMap[submission.activityId]) {
          activityMap[submission.activityId] = {
            id: submission.activityId,
            title: submission.activityTitle || '未知作业'
          };
        }
      });

      // 添加不在活动列表中的活动
      Object.values(activityMap).forEach(activity => {
        if (!activityList.some(a => a.id === activity.id)) {
          activityList.push(activity);
        }
      });
    }

    // 检查是否有任何需要显示列的活动
    const hasDisplayableActivities = activities.some(activity =>
      activity.type === 'typing' ||
      activity.type === 'quiz' ||
      activity.type === 'spreadsheet' ||
      activity.type === 'fillblank' ||
      activity.type === 'python' ||
      activity.type === 'flowchart' ||
      activity.requireSubmission
    );

    // 如果没有可显示的活动，返回空数组
    if (!hasDisplayableActivities && activityList.length === 0) return [];

    // 为每个学生创建一条记录，每个活动作为一个字段
    return students.map(student => {
      const rowData = {
        key: student._id || student.name,
        studentName: student.name || '未知学生',
      };

      // 为每个活动添加一个字段
      activityList.forEach(activity => {
        const submission = assignmentSubmissions.find(
          s => s.student?._id === student._id && s.activityId === activity.id
        );

        rowData[`activity_${activity.id}`] = {
          status: submission ? submission.status : 'not_submitted',
          grade: submission ? submission.grade : null,
          aiGrade: submission ? submission.aiGrade : null,
          submittedAt: submission ? submission.submittedAt : null,
          activityTitle: activity.title
        };
      });

      // 添加打字活动数据（按活动分组）
      const typingActivitiesForData = activities.filter(a => a.type === 'typing');
      typingActivitiesForData.forEach(activity => {
        const typingData = typingRecords[student._id]?.[activity._id];
        rowData[`typing_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '打字练习',
          hasRecord: typingData?.hasRecord || false,
          count: typingData?.count || 0,
          speed: typingData?.speed || 0,
          accuracy: typingData?.accuracy || 0
        };
      });

      // 添加测验提交情况
      const quizActivities = activities.filter(a => a.type === 'quiz');
      if (quizActivities.length > 0) {
        // 获取当前课时quiz活动对应的测验ID（处理quiz可能是对象或字符串ID的情况）
        const quizIds = quizActivities
          .map(a => {
            const quiz = a.quizSettings?.quiz;
            return typeof quiz === 'object' ? quiz?._id : quiz;
          })
          .filter(Boolean);

        // 构建测验标题映射
        const quizTitles = {};
        quizActivities.forEach(activity => {
          if (activity.quizSettings && activity.quizSettings.quiz) {
            const quizId = typeof activity.quizSettings.quiz === 'object'
              ? activity.quizSettings.quiz._id
              : activity.quizSettings.quiz;
            quizTitles[quizId] = activity.title || '未命名测验';
          }
        });

        // 计算学生提交的测验
        if (student._id && quizSubmissions[student._id]) {
          const studentQuizSubmissions = quizSubmissions[student._id];

          // 按测验ID归类最新的提交
          const latestSubmissionsByQuiz = {};

          studentQuizSubmissions.forEach(submission => {
            const quizId = submission.quizId;

            // 如果这是第一次看到这个测验ID，或者提交时间比之前记录的更晚
            if (!latestSubmissionsByQuiz[quizId] ||
              new Date(submission.submitTime) > new Date(latestSubmissionsByQuiz[quizId].submitTime)) {
              latestSubmissionsByQuiz[quizId] = submission;
            }
          });

          // 根据当前课时的测验ID过滤
          let relevantSubmissions = [];
          if (quizIds.length > 0) {
            relevantSubmissions = quizIds
              .filter(id => latestSubmissionsByQuiz[id])
              .map(id => latestSubmissionsByQuiz[id]);
          } else if (Object.keys(latestSubmissionsByQuiz).length > 0) {
            // 如果找不到具体的quizId但有提交记录，使用所有提交
            relevantSubmissions = Object.values(latestSubmissionsByQuiz);
          }

          // 添加每个测验的提交情况
          relevantSubmissions.forEach(submission => {
            const quizId = submission.quizId;
            rowData[`quiz_${quizId}`] = {
              quizId: quizId,
              quizTitle: quizTitles[quizId] || submission.quizTitle || '未知测验',
              score: submission.score,
              accuracy: submission.accuracy,
              correctCount: submission.correctCount,
              totalQuestions: submission.totalQuestions,
              submitTime: submission.submitTime,
              attemptNumber: submission.attemptNumber
            };
          });

          // 如果没有特定测验的提交，但有提交记录，添加一个汇总项
          if (relevantSubmissions.length === 0 && studentQuizSubmissions.length > 0) {
            rowData[`quiz_summary`] = {
              count: studentQuizSubmissions.length,
              lastSubmitTime: studentQuizSubmissions[0].submitTime
            };
          }
        }
      }

      // 添加spreadsheet活动提交情况
      const spreadsheetActivitiesForData = activities.filter(a => a.type === 'spreadsheet');
      spreadsheetActivitiesForData.forEach(activity => {
        const submissionData = spreadsheetSubmissions[student._id]?.[activity._id];
        rowData[`spreadsheet_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '在线表格',
          hasSubmission: submissionData?.hasSubmission || false,
          submission: submissionData?.submission
        };
      });

      // 添加fillblank活动提交情况
      const fillBlankActivitiesForData = activities.filter(a => a.type === 'fillblank');
      fillBlankActivitiesForData.forEach(activity => {
        const submissionData = fillBlankSubmissions[student._id]?.[activity._id];
        rowData[`fillblank_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '填空练习',
          hasSubmission: submissionData?.hasSubmission || false,
          submission: submissionData?.submission
        };
      });

      // 添加python活动提交情况
      const pythonActivitiesForData = activities.filter(a => a.type === 'python');
      pythonActivitiesForData.forEach(activity => {
        const submissionData = pythonSubmissions[student._id]?.[activity._id];
        rowData[`python_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || 'Python编程',
          hasSubmission: submissionData?.hasSubmission || false,
          submission: submissionData?.submission
        };
      });

      // 添加flowchart活动提交情况
      const flowchartActivitiesForData = activities.filter(a => a.type === 'flowchart');
      flowchartActivitiesForData.forEach(activity => {
        const submissionData = flowchartSubmissions[student._id]?.[activity._id];
        rowData[`flowchart_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '流程图',
          hasSubmission: submissionData?.hasSubmission || false,
          status: submissionData?.status,
          submission: submissionData?.submission
        };
      });

      return rowData;
    });
  };

  // 修改 getTableColumns 函数以按照课程活动顺序显示
  const getTableColumns = () => {
    const baseColumns = [
      {
        title: '学生姓名',
        dataIndex: 'studentName',
        key: 'studentName',
        width: 100,
        fixed: 'left',
        sorter: (a, b) => a.studentName.localeCompare(b.studentName),
        sortDirections: ['ascend', 'descend']
      }
    ];

    // 按照活动在课程中的顺序生成列
    const activityColumns = activities.map(activity => {
      switch (activity.type) {
        case 'typing':
          return {
            title: activity.title || '打字练习',
            dataIndex: `typing_${activity._id}`,
            key: `typing_${activity._id}`,
            width: 120,
            sorter: (a, b) => {
              const speedA = a[`typing_${activity._id}`]?.speed || 0;
              const speedB = b[`typing_${activity._id}`]?.speed || 0;
              return speedB - speedA;
            },
            render: (value) => {
              if (!value || !value.hasRecord || value.count === 0) {
                return <Tag color="default">未练习</Tag>;
              }
              return (
                <Tooltip title={`${value.count} 次练习, 平均速度: ${value.speed}字/分钟, 准确率: ${value.accuracy}%`}>
                  <Tag color="blue">{value.speed}字/分钟</Tag>
                </Tooltip>
              );
            }
          };

        case 'quiz':
          const quizId = activity.quizSettings?.quiz?._id || activity.quizSettings?.quiz;
          return {
            title: activity.title || '测验',
            dataIndex: `quiz_${quizId}`,
            key: `quiz_${activity._id}`,
            width: 120,
            sorter: (a, b) => {
              const dataA = a[`quiz_${quizId}`];
              const dataB = b[`quiz_${quizId}`];
              if (dataA && dataB) {
                return (dataB.accuracy || 0) - (dataA.accuracy || 0);
              }
              return dataA ? -1 : (dataB ? 1 : 0);
            },
            render: (value) => {
              if (!value) {
                return <Tag color="default">未完成</Tag>;
              }
              return (
                <Tooltip title={`正确率: ${value.accuracy}% (${value.correctCount}/${value.totalQuestions})\n提交时间: ${new Date(value.submitTime).toLocaleString()}\n提交次数: ${value.attemptNumber}`}>
                  <Tag color={value.accuracy >= 80 ? 'success' :
                    value.accuracy >= 60 ? 'processing' :
                      value.accuracy >= 40 ? 'warning' : 'error'}>
                    {value.accuracy}%
                  </Tag>
                </Tooltip>
              );
            }
          };

        case 'spreadsheet':
          return {
            title: activity.title || '在线表格',
            dataIndex: `spreadsheet_${activity._id}`,
            key: `spreadsheet_${activity._id}`,
            width: 100,
            sorter: (a, b) => {
              const valA = a[`spreadsheet_${activity._id}`];
              const valB = b[`spreadsheet_${activity._id}`];
              const scoreA = valA?.hasSubmission ? 1 : 0;
              const scoreB = valB?.hasSubmission ? 1 : 0;
              return scoreA - scoreB;
            },
            render: (value) => {
              if (!value) return <Tag color="default">未知</Tag>;
              return value.hasSubmission
                ? <Tag color="success">已保存</Tag>
                : <Tag color="default">未保存</Tag>;
            }
          };

        case 'fillblank':
          return {
            title: activity.title || '填空练习',
            dataIndex: `fillblank_${activity._id}`,
            key: `fillblank_${activity._id}`,
            width: 100,
            sorter: (a, b) => {
              const valA = a[`fillblank_${activity._id}`];
              const valB = b[`fillblank_${activity._id}`];
              const scoreA = valA?.hasSubmission ? (valA.submission?.score ?? -1) : -2;
              const scoreB = valB?.hasSubmission ? (valB.submission?.score ?? -1) : -2;
              return scoreA - scoreB;
            },
            render: (value) => {
              if (!value) return <Tag color="default">未知</Tag>;
              if (value.hasSubmission) {
                const submission = value.submission;
                if (submission?.score !== undefined) {
                  return (
                    <Tooltip title={`得分: ${submission.score}`}>
                      <Tag color="success">已提交: {submission.score}分</Tag>
                    </Tooltip>
                  );
                }
                return <Tag color="success">已提交</Tag>;
              }
              return <Tag color="default">未完成</Tag>;
            }
          };

        case 'python':
          return {
            title: activity.title || 'Python编程',
            dataIndex: `python_${activity._id}`,
            key: `python_${activity._id}`,
            width: 100,
            sorter: (a, b) => {
              const valA = a[`python_${activity._id}`];
              const valB = b[`python_${activity._id}`];
              const scoreA = valA?.hasSubmission ? (valA.submission?.score ?? -1) : -2;
              const scoreB = valB?.hasSubmission ? (valB.submission?.score ?? -1) : -2;
              return scoreA - scoreB;
            },
            render: (value) => {
              if (!value) return <Tag color="default">未知</Tag>;
              if (value.hasSubmission) {
                const submission = value.submission;
                if (submission?.score !== undefined) {
                  return (
                    <Tooltip title={`得分: ${submission.score}`}>
                      <Tag color="success">已提交: {submission.score}分</Tag>
                    </Tooltip>
                  );
                }
                return <Tag color="success">已提交</Tag>;
              }
              return <Tag color="default">未完成</Tag>;
            }
          };

        case 'flowchart':
          return {
            title: activity.title || '流程图',
            dataIndex: `flowchart_${activity._id}`,
            key: `flowchart_${activity._id}`,
            width: 120,
            sorter: (a, b) => {
              const valA = a[`flowchart_${activity._id}`];
              const valB = b[`flowchart_${activity._id}`];
              
              const getScore = (val) => {
                if (!val) return -2;
                if (val.status === 'graded') {
                   return val.submission?.grade?.score ?? -1;
                }
                if (val.hasSubmission) return -1;
                return -2;
              };
              return getScore(valA) - getScore(valB);
            },
            render: (value) => {
              if (!value) return <Tag color="default">未保存</Tag>;
              if (value.status === 'graded') {
                const submission = value.submission;
                const score = submission?.grade?.score !== undefined ? submission.grade.score : 'N/A';
                return <Tag color="success">已批阅: {score}</Tag>;
              }
              if (value.hasSubmission) {
                return <Tag color="processing">已保存</Tag>;
              }
              return <Tag color="error">未保存</Tag>;
            }
          };

        // 默认: 需要提交的活动 (practice, html等)
        default:
          if (activity.requireSubmission) {
            return {
              title: activity.title || '作业',
              dataIndex: `activity_${activity._id}`,
              key: `activity_${activity._id}`,
              width: 120,
              sorter: (a, b) => {
                const valA = a[`activity_${activity._id}`];
                const valB = b[`activity_${activity._id}`];
                
                const getScore = (val) => {
                  if (!val || val.status === 'not_submitted') return -2;
                  if (val.status === 'graded') {
                    const score = val.grade?.score !== undefined ? val.grade.score :
                      val.aiGrade?.score !== undefined ? val.aiGrade.score : -1;
                    return score;
                  }
                  if (val.status === 'submitted') return -1;
                  return -2;
                };
                return getScore(valA) - getScore(valB);
              },
              render: (value) => {
                if (!value) return <Tag color="default">未知</Tag>;
                let color = 'default';
                let text = '未知';
                switch (value.status) {
                  case 'graded':
                    color = 'success';
                    const score = value.grade?.score !== undefined ? value.grade.score :
                      value.aiGrade?.score !== undefined ? value.aiGrade.score : 'N/A';
                    text = `已批阅: ${score}`;
                    break;
                  case 'submitted':
                    color = 'processing';
                    text = '已提交';
                    break;
                  case 'not_submitted':
                  default:
                    color = 'error';
                    text = '未提交';
                    break;
                }
                const tooltipTitle = value.submittedAt ? `提交时间: ${new Date(value.submittedAt).toLocaleString()}` : '';
                return (
                  <Tooltip title={tooltipTitle}>
                    <Tag color={color}>{text}</Tag>
                  </Tooltip>
                );
              }
            };
          }
          return null; // 不需要提交的活动（如reading, video）不显示列
      }
    }).filter(col => col !== null); // 过滤掉null

    const columns = [...baseColumns, ...activityColumns];

    // 计算表格总宽度，用于设置Drawer宽度
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);
    // 设置最小宽度为600，最大宽度为窗口宽度的80%
    const windowWidth = window.innerWidth;
    const calculatedWidth = Math.min(Math.max(totalWidth + 48, 600), windowWidth * 0.8);

    // 更新Drawer宽度
    setTimeout(() => {
      setDrawerWidth(calculatedWidth);
    }, 0);

    return columns;
  };

  // 处理显示作业浮窗
  const handleToggleAssignmentWindow = () => {
    setShowAssignmentWindow(!showAssignmentWindow);

    // 当打开Drawer时，重新计算宽度
    if (!showAssignmentWindow) {
      const columns = getTableColumns();
      const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);
      const windowWidth = window.innerWidth;
      const calculatedWidth = Math.min(Math.max(totalWidth + 48, 600), windowWidth * 0.8);
      setDrawerWidth(calculatedWidth);
    }
  };

  // 处理活动发布状态变更
  const handleActivityPublishChange = async (activity, checked) => {
    try {
      await lessonAPI.updateActivityPublishStatus(activity.lessonId, activity._id, checked);

      // 直接更新本地状态，不触发重新请求
      setActivities(prev => prev.map(a =>
        a._id === activity._id ? { ...a, isPublished: checked } : a
      ));

      // 不需要设置 shouldFetchTypingRecords 或 shouldFetchQuizSubmissions，因为活动类型没有变化
    } catch (error) {
      console.error('更新活动状态失败:', error);
      message.error('更新活动状态失败');
    }
  };

  return (
    <div style={{ margin: '16px 0' }}>
      {/* 顶部操作栏 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        background: '#f5f5f5',
        padding: '12px',
        borderRadius: '8px',
        alignItems: 'center'
      }}>
        {/* 班级选择 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text strong style={{ marginRight: '8px', whiteSpace: 'nowrap' }}>班级：</Text>
          <Select
            style={{ width: 140 }}
            value={selectedClass}
            onChange={handleClassChange}
            placeholder="请选择班级"
            size="middle"
          >
            {Object.entries(classes)
              .sort(([gradeA], [gradeB]) => Number(gradeB) - Number(gradeA))
              .map(([grade, gradeClasses]) => (
              <Select.OptGroup key={grade} label={`${grade}级`}>
                {[...gradeClasses].sort((a, b) => {
                  const numA = Number(a.name);
                  const numB = Number(b.name);
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  return String(a.name).localeCompare(String(b.name));
                }).map(cls => (
                  <Option key={cls._id} value={cls._id}>
                    {cls.grade}级{cls.name}班
                  </Option>
                ))}
              </Select.OptGroup>
            ))}
          </Select>
        </div>

        {/* 课程选择 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text strong style={{ marginRight: '8px', whiteSpace: 'nowrap' }}>课程：</Text>
          <Cascader
            style={{ minWidth: 200, maxWidth: 320 }}
            options={options}
            value={selectedKeys}
            onChange={handleCascaderChange}
            placeholder="请选择课程/单元/课时"
            changeOnSelect={false}
            expandTrigger="click"
            size="middle"
            dropdownMenuColumnStyle={{
              minWidth: 180,
              maxHeight: 600
            }}
            popupClassName="classroom-course-cascader-popup"
          />
          <style>{`
            .classroom-course-cascader-popup .ant-cascader-menu {
              min-width: 200px !important;
              max-height: 600px !important;
            }
            .classroom-course-cascader-popup .ant-cascader-menu-item {
              padding: 8px 16px !important;
              font-size: 14px !important;
            }
          `}</style>
        </div>

        {/* 班级设置开关 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tooltip title={!settings.currentLesson ? "请先选择课程" : "学生登录后自动跳转到课程页面"}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Switch
                size="default"
                checkedChildren="自动跳转"
                unCheckedChildren="手动跳转"
                checked={settings.autoRedirectToLesson}
                onChange={(checked) => updateClassSettings('autoRedirectToLesson', checked)}
                disabled={!settings.currentLesson}
              />
            </div>
          </Tooltip>

          <Tooltip title="允许学生从不同IP地址登录">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Switch
                size="default"
                checkedChildren="允许换IP"
                unCheckedChildren="禁止换IP"
                checked={settings.allowIpChange}
                onChange={(checked) => updateClassSettings('allowIpChange', checked)}
              />
            </div>
          </Tooltip>

          <Tooltip title="允许学生使用AI辅助功能">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Switch
                size="default"
                checkedChildren="允许AI"
                unCheckedChildren="禁止AI"
                checked={settings.allowAiUsage}
                onChange={(checked) => updateClassSettings('allowAiUsage', checked)}
              />
            </div>
          </Tooltip>
        </div>

        {/* 分隔：自动推到右侧 */}
        <div style={{ flex: '1 1 auto' }} />

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="default"
            icon={<DesktopOutlined />}
            onClick={openStudentSimulation}
            size="middle"
          >
            模拟学生
          </Button>
          {loginRequests.length > 0 && (
            <Badge count={loginRequests.length} offset={[-5, 5]}>
              <Button
                type="default"
                icon={<UserSwitchOutlined />}
                onClick={() => setLoginRequestDrawerVisible(true)}
                size="middle"
              >
                登录请求
              </Button>
            </Badge>
          )}
          <Button
            type={settings.isInClass ? "danger" : "primary"}
            onClick={async () => {
              const newStatus = !settings.isInClass;
              await updateClassSettings('isInClass', newStatus);
            }}
          >
            {settings.isInClass ? '下课' : '上课'}
          </Button>
          <Button
            type="primary"
            onClick={handleToggleAssignmentWindow}
            icon={showAssignmentWindow ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          >
            {showAssignmentWindow ? '隐藏作业' : '显示作业'}
          </Button>
        </div>
      </div>

      {/* 活动发布状态区域 */}
      {loadingActivities ? (
        <div style={{
          padding: '12px',
          background: '#f0f7ff',
          borderRadius: '8px',
          border: '1px solid #d6e8ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          height: '60px'
        }}>
          <Text type="secondary">活动加载中...</Text>
        </div>
      ) : activities.length > 0 ? (
        <div style={{
          padding: '12px',
          background: '#f0f7ff',
          borderRadius: '8px',
          border: '1px solid #d6e8ff',
          marginBottom: '16px'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <Text strong>活动发布状态</Text>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            {activities.map(activity => (
              <div key={activity._id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                background: '#fff',
                borderRadius: '4px',
                border: '1px solid #e8e8e8'
              }}>
                <Text strong style={{ marginRight: '12px', minWidth: '80px' }}>{activity.title}</Text>

                {/* 只有发布状态控制，对于所有活动都适用 */}
                {/* 只有发布状态控制，对于所有活动都适用 */}
                <div style={{ display: 'flex', alignItems: 'center', marginRight: '16px' }}>
                  <Switch
                    size="default"
                    checkedChildren="已发布"
                    unCheckedChildren="未发布"
                    checked={activity.isPublished}
                    onChange={(checked) => handleActivityPublishChange(activity, checked)}
                  />
                </div>

                {/* Python活动额外的控制：隐藏/显示测试用例 */}
                {activity.type === 'python' && (
                  <div style={{ display: 'flex', alignItems: 'center', marginRight: '16px' }}>
                    <Text type="secondary" style={{ marginRight: '8px', fontSize: '12px' }}>测试点:</Text>
                    <Switch
                      size="small"
                      checkedChildren="显示"
                      unCheckedChildren="隐藏"
                      // 如果所有测试用例都是隐藏的，或者大部分是隐藏的，则显示为隐藏状态
                      // 这里我们检查第一个测试用例的状态作为代表，或者如果没有测试用例默认为显示
                      checked={!activity.pythonSettings?.testCases?.some(tc => tc.isHidden)}
                      onChange={(checked) => handlePythonTestCaseVisibility(activity, checked)}
                    />
                  </div>
                )}

                {/* Quiz活动额外的控制：测验发布状态 (Draft vs Published) */}
                {activity.type === 'quiz' && activity.quizSettings?.quiz && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Text type="secondary" style={{ marginRight: '8px', fontSize: '12px' }}>测验状态:</Text>
                    <Switch
                      size="small"
                      checkedChildren="已发布"
                      unCheckedChildren="草稿"
                      // 只有当 quiz 对象存在且状态为 PUBLISHED 时才为 true
                      checked={activity.quizSettings.quiz.status === 'PUBLISHED'}
                      onChange={(checked) => handleQuizPublishStatus(activity, checked)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px',
          background: '#f0f7ff',
          borderRadius: '8px',
          border: '1px solid #d6e8ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          height: '60px'
        }}>
          <Text type="secondary">请选择课时查看活动</Text>
        </div>
      )}

      {/* 座位图 */}
      <SeatingChart
        students={students.map(student => {
          // 计算该学生提交的作业数
          const studentSubmissions = assignmentSubmissions.filter(
            submission => submission.student?._id === student._id
          );
          const submittedCount = studentSubmissions.length;

          // 计算当前课时中需要统计的活动总数（除了reading和video类型外的所有活动）
          const countableActivities = activities.filter(activity =>
            activity.type !== 'reading' && activity.type !== 'video'
          );
          const totalActivities = countableActivities.length;

          // 检查当前课时是否包含打字活动
          const typingActivitiesForStat = activities.filter(activity => activity.type === 'typing');
          const hasTypingActivity = typingActivitiesForStat.length > 0;

          // 计算学生的打字记录（仅当有打字活动时）
          // typingRecords结构: { studentId: { activityId: { hasRecord, count, ... } } }
          let typingCount = 0;
          if (hasTypingActivity && student._id && typingRecords[student._id]) {
            // 遍历每个打字活动，检查学生是否有对应记录
            typingActivitiesForStat.forEach(activity => {
              if (typingRecords[student._id][activity._id]?.hasRecord) {
                typingCount++;
              }
            });
          }

          // 计算学生的quiz提交情况
          let quizCount = 0;
          if (student._id && quizSubmissions[student._id]) {
            // 找出当前课时的quiz活动
            const quizActivitiesForStat = activities.filter(a => a.type === 'quiz');
            // 提取quiz ID，处理quiz可能是对象或字符串ID的情况
            const quizIds = quizActivitiesForStat
              .map(a => {
                const quiz = a.quizSettings?.quiz;
                return typeof quiz === 'object' ? quiz?._id : quiz;
              })
              .filter(Boolean);

            // 计算学生提交了多少个quiz
            if (quizIds.length > 0) {
              const studentQuizSubmissions = quizSubmissions[student._id];
              const submittedQuizIds = new Set(studentQuizSubmissions.map(s => s.quizId));
              quizCount = quizIds.filter(id => submittedQuizIds.has(id)).length;
            } else if (quizActivitiesForStat.length > 0 && quizSubmissions[student._id].length > 0) {
              // 如果找不到具体的quizId但有quiz活动，并且学生有提交记录，视为提交了一个
              quizCount = 1;
            }
          }

          // 计算spreadsheet活动提交情况
          let spreadsheetCount = 0;
          const spreadsheetActivitiesForStat = activities.filter(a => a.type === 'spreadsheet');
          if (spreadsheetActivitiesForStat.length > 0 && student._id && spreadsheetSubmissions[student._id]) {
            spreadsheetActivitiesForStat.forEach(activity => {
              if (spreadsheetSubmissions[student._id][activity._id]?.hasSubmission) {
                spreadsheetCount++;
              }
            });
          }

          // 计算fillblank活动提交情况
          let fillBlankCount = 0;
          const fillBlankActivitiesForStat = activities.filter(a => a.type === 'fillblank');
          if (fillBlankActivitiesForStat.length > 0 && student._id && fillBlankSubmissions[student._id]) {
            fillBlankActivitiesForStat.forEach(activity => {
              if (fillBlankSubmissions[student._id][activity._id]?.hasSubmission) {
                fillBlankCount++;
              }
            });
          }

          // 计算python活动提交情况
          let pythonCount = 0;
          const pythonActivitiesForStat = activities.filter(a => a.type === 'python');
          if (pythonActivitiesForStat.length > 0 && student._id && pythonSubmissions[student._id]) {
            pythonActivitiesForStat.forEach(activity => {
              if (pythonSubmissions[student._id][activity._id]?.hasSubmission) {
                pythonCount++;
              }
            });
          }

          // 计算flowchart活动提交情况
          let flowchartCount = 0;
          const flowchartActivitiesForStat = activities.filter(a => a.type === 'flowchart');
          if (flowchartActivitiesForStat.length > 0 && student._id && flowchartSubmissions[student._id]) {
            flowchartActivitiesForStat.forEach(activity => {
              if (flowchartSubmissions[student._id][activity._id]?.hasSubmission) {
                flowchartCount++;
              }
            });
          }

          // 计算实际提交数（包括所有类型的提交）
          const actualSubmittedCount = submittedCount + typingCount + quizCount + spreadsheetCount + fillBlankCount + pythonCount + flowchartCount;

          return {
            ...student,
            submissionStats: {
              submitted: actualSubmittedCount,
              total: totalActivities
            }
          };
        })}
        onUpdateSeat={(updatedStudents) => {
          setStudents(updatedStudents);
        }}
        stats={students.length > 0 ? {
          total: students.length,
          online: students.filter(s => s.isOnlineToday).length,
          absent: students.filter(s => !s.isOnlineToday).length,
          withSeat: students.filter(s => s.hasSeat).length,
          withoutSeat: students.filter(s => !s.hasSeat).length
        } : null}
        classId={selectedClass}
      />

      {/* 作业提交情况Drawer */}
      <Drawer
        title="作业提交情况"
        placement="right"
        onClose={() => setShowAssignmentWindow(false)}
        open={showAssignmentWindow}
        width={drawerWidth}
        bodyStyle={{ padding: '12px' }}
      >
        {loadingSubmissions ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
        ) : settings.currentLesson ? (
          <Table
            columns={getTableColumns()}
            dataSource={getSubmissionTableData()}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: '当前课时没有需要提交的作业' }}
            style={{ flex: 1 }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            请先选择课时
          </div>
        )}
      </Drawer>

      {/* 登录请求抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>学生登录请求</span>
            <Badge count={loginRequests.length} style={{ backgroundColor: '#52c41a' }} />
          </div>
        }
        placement="right"
        width={400}
        open={loginRequestDrawerVisible}
        onClose={() => setLoginRequestDrawerVisible(false)}
        extra={
          loginRequests.length > 0 && (
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={handleBulkApprove}
              >
                全部同意
              </Button>
              <Button
                danger
                size="small"
                onClick={handleBulkReject}
              >
                全部拒绝
              </Button>
            </Space>
          )
        }
      >
        {loadingLoginRequests && loginRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : loginRequests.length === 0 ? (
          <Empty
            description="暂无登录请求"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={loginRequests}
            renderItem={(item) => {
              // 计算剩余时间
              const expiresAt = new Date(item.expiresAt);
              const now = new Date();
              const remainingMs = expiresAt - now;
              const remainingMin = Math.max(0, Math.floor(remainingMs / 60000));
              const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

              return (
                <List.Item
                  style={{
                    padding: '16px',
                    marginBottom: '12px',
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0'
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <Text strong style={{ fontSize: '15px' }}>
                          {item.studentName}
                        </Text>
                        <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
                          {item.username}
                        </Text>
                      </div>
                      <Tag color={item.requestType === 'ip_change' ? 'orange' :
                        (item.requestType === 'ip_and_device_conflict' ? 'purple' : 'red')}>
                        {item.requestType === 'ip_change' ? (
                          <><SwapOutlined /> IP变更</>
                        ) : item.requestType === 'ip_and_device_conflict' ? (
                          <><SwapOutlined /> IP+设备冲突</>
                        ) : (
                          <><LaptopOutlined /> 设备冲突</>
                        )}
                      </Tag>
                    </div>

                    {/* IP变更信息 - ip_change 或组合类型都显示 */}
                    {(item.requestType === 'ip_change' || item.requestType === 'ip_and_device_conflict') && (
                      <div style={{
                        background: '#fff7e6',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        fontSize: '12px'
                      }}>
                        <div>原IP: <Text code>{item.oldIp || '未知'}</Text></div>
                        <div>新IP: <Text code>{item.newIp || '未知'}</Text></div>
                      </div>
                    )}

                    {/* 设备冲突信息 - device_conflict 或组合类型都显示 */}
                    {(item.requestType === 'device_conflict' || item.requestType === 'ip_and_device_conflict') && (
                      <div style={{
                        background: '#fff1f0',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        fontSize: '12px',
                        color: '#cf1322'
                      }}>
                        该学生已在其他设备登录，同意将登出其他设备
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        剩余 {remainingMin}:{remainingSec.toString().padStart(2, '0')}
                      </Text>
                      <Space>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleApproveLoginRequest(item._id)}
                        >
                          同意
                        </Button>
                        <Button
                          danger
                          size="small"
                          onClick={() => handleRejectLoginRequest(item._id)}
                        >
                          拒绝
                        </Button>
                      </Space>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default ClassroomManagement; 