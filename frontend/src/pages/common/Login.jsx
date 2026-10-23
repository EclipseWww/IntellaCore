import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, message, Select, Modal, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import api, { classAPI, loginRequestAPI } from '../../services/api';
import { ExclamationCircleOutlined, LoadingOutlined, SyncOutlined } from '@ant-design/icons';

const { Option } = Select;

// Logo组件 - 基于网站favicon
const Logo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="64" height="64">
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4158D0" />
        <stop offset="50%" stopColor="#C850C0" />
        <stop offset="100%" stopColor="#FFCC70" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="90" fill="url(#logoGradient)" />
    <rect x="60" y="70" width="80" height="60" rx="5" fill="white" />
    <path d="M80 90 L70 100 L80 110" stroke="#4158D0" strokeWidth="3" fill="none" />
    <path d="M120 90 L130 100 L120 110" stroke="#4158D0" strokeWidth="3" fill="none" />
    <line x1="85" y1="100" x2="115" y2="100" stroke="#C850C0" strokeWidth="3" />
    <rect x="70" y="140" width="60" height="10" rx="2" fill="white" />
    <circle cx="80" cy="145" r="2" fill="#4158D0" />
    <circle cx="100" cy="145" r="2" fill="#4158D0" />
    <circle cx="120" cy="145" r="2" fill="#4158D0" />
  </svg>
);

// 自定义图标组件
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 1 1 8 0v4" />
  </svg>
);

const ClassIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const PersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const SeatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
  </svg>
);

// 图标包裹，确保在选择器里垂直居中
const IconWrap = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 18,
      height: 18,
      color: '#94a3b8',
      verticalAlign: 'middle'
    }}
  >
    {children}
  </span>
);

const Login = () => {
  const confirmSeatMapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedClassStatus, setSelectedClassStatus] = useState({
    isInClass: false
  });
  const [seatMap, setSeatMap] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [seatMapVisible, setSeatMapVisible] = useState(false);
  const [confirmSeatMapVisible, setConfirmSeatMapVisible] = useState(false);
  const [formValues, setFormValues] = useState(null);
  const [studentsWithoutSeat, setStudentsWithoutSeat] = useState([]);
  const [maxColumns, setMaxColumns] = useState(6);
  const [maxRows, setMaxRows] = useState(8);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');

  // 登录请求相关状态
  const [loginRequestModal, setLoginRequestModal] = useState({
    visible: false,
    type: null, // 'IP_CHANGE_REQUIRED' | 'DEVICE_CONFLICT'
    message: '',
    studentId: null,
    studentName: null,
    classId: null,
    oldIp: null,
    newIp: null
  });
  const [requestPending, setRequestPending] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const pollingIntervalRef = useRef(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0); // 60秒冷却倒计时
  const cooldownIntervalRef = useRef(null);

  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (token && user && user.id) {
      api.get('/auth/validate-token')
        .then(response => {
          if (response.data.valid) {
            if (user.role === 'teacher') {
              navigate('/teacher');
            } else if (user.role === 'admin') {
              navigate('/admin');
            } else {
              navigate('/student');
            }
          }
        })
        .catch(error => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        });
    }
  }, [navigate]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);
        const response = await classAPI.getAvailableClasses();
        const groupedClasses = response.data.reduce((acc, cls) => {
          if (!acc[cls.grade]) {
            acc[cls.grade] = [];
          }
          acc[cls.grade].push(cls);
          return acc;
        }, {});
        setClasses(groupedClasses);
      } catch (error) {
        console.error('获取班级列表失败:', error);
        message.error('获取班级列表失败');
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();
  }, []);

  const generateSeatMap = (students, rowsOverride, colsOverride) => {
    const studentsWithSeat = students.filter(s => s.seatNumber);
    const withoutSeat = students.filter(s => !s.seatNumber);

    setStudentsWithoutSeat(withoutSeat);

    if (studentsWithSeat.length === 0) {
      return [];
    }

    let maxRowNum = rowsOverride || 1;
    let maxColNum = colsOverride || 1;

    if (!rowsOverride || !colsOverride) {
      let maxColLetter = 'A';
      let inferredMaxRow = 1;
      studentsWithSeat.forEach(student => {
        if (student.seatNumber) {
          const col = student.seatNumber.charAt(0);
          const rowNum = parseInt(student.seatNumber.substring(1), 10);
          if (col > maxColLetter) maxColLetter = col;
          if (rowNum > inferredMaxRow) inferredMaxRow = rowNum;
        }
      });
      const inferredMaxColNum = maxColLetter.charCodeAt(0) - 64;
      maxRowNum = rowsOverride || inferredMaxRow;
      maxColNum = colsOverride || inferredMaxColNum;
    }

    setMaxColumns(maxColNum);
    setMaxRows(maxRowNum);

    const columns = Array.from({ length: maxColNum }, (_, i) =>
      String.fromCharCode(65 + i)
    );

    const rows = Array.from({ length: maxRowNum }, (_, i) => i + 1);

    const seatMapData = [];

    for (let row of rows) {
      for (let col of columns) {
        const seatId = `${col}${row}`;
        const student = studentsWithSeat.find(s => s.seatNumber === seatId);

        seatMapData.push({
          id: seatId,
          occupied: !!student,
          studentName: student ? student.name : null,
          studentId: student ? student._id : null,
          username: student ? student.username : null
        });
      }
    }

    return seatMapData;
  };

  const fetchClassStudents = async (classId) => {
    try {
      const response = await api.get(`/classes/${classId}/students`);
      const studentArray = Array.isArray(response.data.data.students) ? response.data.data.students : [];
      setStudents(studentArray);
      setSelectedClassStatus({
        isInClass: response.data.data.isInClass || false
      });
      const layoutFromClass = response.data.data.selectedClassroomLayout || null;
      if (layoutFromClass) {
        setSelectedLayout(layoutFromClass);
      } else {
        setSelectedLayout(null);
      }

      const seatMapData = generateSeatMap(
        studentArray,
        layoutFromClass?.rows,
        layoutFromClass?.cols
      );
      setSeatMap(seatMapData);
    } catch (error) {
      console.error('获取学生列表失败:', error);
      message.error('获取学生列表失败');
      setStudents([]);
      setSelectedClassStatus({ isInClass: false });
      setSeatMap([]);
      setStudentsWithoutSeat([]);
    }
  };

  const onFinish = (values) => {
    setFormValues(values);

    const username = values.username;
    const student = students.find(s => s.username === username);

    if (student) {
      if (student.seatNumber) {
        setSelectedSeat(student.seatNumber);
        setSelectedStudentName(student.name);
        setConfirmSeatMapVisible(true);
      } else {
        setSelectedStudentName(student.name);
        loginUser(values);
      }
    } else {
      loginUser(values);
    }
  };

  const loginUser = (values) => {
    try {
      setLoading(true);

      if (selectedClassStatus.isInClass) {
        values.isInClass = true;
      }

      const { classId, ...loginData } = values;

      api.post('/auth/login', loginData)
        .then(response => {
          localStorage.setItem('token', response.data.token);
          const userInfo = {
            ...response.data.user,
            seatNumber: response.data.user.seatNumber
          };
          localStorage.setItem('user', JSON.stringify(userInfo));

          let expiryTime;
          if (response.data.user.role === 'teacher') {
            expiryTime = new Date().getTime() + 12 * 60 * 60 * 1000;
          } else {
            expiryTime = new Date().getTime() + 60 * 60 * 1000;
          }
          localStorage.setItem('tokenExpiry', expiryTime);

          message.success('登录成功');

          if (response.data.user.role === 'teacher') {
            navigate('/teacher');
          } else if (response.data.user.role === 'admin') {
            navigate('/admin');
          } else {
            if (response.data.classInfo?.needSelectSeat) {
              navigate('/student/seat-selection');
              return;
            }

            const { classInfo } = response.data;
            if (classInfo?.autoRedirectToLesson &&
              classInfo.currentCourse &&
              classInfo.currentUnit &&
              classInfo.currentLesson) {
              navigate(`/student/course/${classInfo.currentCourse}/unit/${classInfo.currentUnit}/lesson/${classInfo.currentLesson}`);
            } else {
              navigate('/student');
            }
          }
        })
        .catch(error => {
          console.error('Login error:', error);
          const errorData = error.response?.data;

          // 检查是否是可以请求登录的错误类型
          if (errorData?.canRequestLogin &&
            (errorData.code === 'IP_CHANGE_REQUIRED' || errorData.code === 'DEVICE_CONFLICT' || errorData.code === 'IP_AND_DEVICE_CONFLICT')) {
            setLoginRequestModal({
              visible: true,
              type: errorData.code,
              message: errorData.message,
              studentId: errorData.studentId,
              studentName: errorData.studentName,
              classId: errorData.classId,
              oldIp: errorData.oldIp || null,
              newIp: errorData.newIp || null
            });
          } else if (errorData?.code === 'CLASS_ARCHIVED') {
            // 班级已归档（学生已毕业），显示专属提示
            message.warning({
              content: '您所在班级已完成本阶段学习，账号已停用，如有问题请联系教师',
              duration: 6,
              icon: '🎓'
            });
          } else if (error.response?.status === 409) {
            message.error('该用户已登录');
          } else {
            message.error(error.response?.data?.message || '登录失败');
          }
          setLoading(false);
        });
    } catch (error) {
      console.error('Login execution error:', error);
      message.error('登录失败');
      setLoading(false);
    }
  };

  const handleConfirmLogin = () => {
    if (!formValues) return;
    setConfirmSeatMapVisible(false);
    loginUser(formValues);
  };

  const handleClassChange = (classId) => {
    form.setFieldsValue({ username: '', name: '' });
    fetchClassStudents(classId);
    setSelectedSeat(null);
    setSelectedStudentName('');
  };

  // 清理轮询定时器
  const clearPollingInterval = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // 清理冷却定时器
  const clearCooldownInterval = () => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
    setCooldownSeconds(0);
  };

  // 启动60秒冷却倒计时
  const startCooldown = () => {
    setCooldownSeconds(60);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearCooldownInterval();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearPollingInterval();
      clearCooldownInterval();
    };
  }, []);

  // 发起登录请求
  const handleRequestLogin = async () => {
    if (!loginRequestModal.studentId || !loginRequestModal.classId) {
      message.error('登录信息不完整');
      return;
    }

    setRequestPending(true);
    try {
      const response = await loginRequestAPI.createRequest({
        username: form.getFieldValue('username'),
        requestType: loginRequestModal.type === 'IP_CHANGE_REQUIRED'
          ? 'ip_change'
          : (loginRequestModal.type === 'IP_AND_DEVICE_CONFLICT'
            ? 'ip_and_device_conflict'
            : 'device_conflict'),
        oldIp: loginRequestModal.oldIp,
        newIp: loginRequestModal.newIp,
        classId: loginRequestModal.classId,
        studentId: loginRequestModal.studentId,
        studentName: loginRequestModal.studentName
      });

      if (response.success) {
        setCurrentRequestId(response.requestId);
        message.info('登录请求已发送，等待教师审批...');

        // 启动60秒冷却倒计时
        startCooldown();

        // 开始轮询请求状态
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await loginRequestAPI.getRequestStatus(response.requestId);

            if (statusRes.status === 'approved') {
              clearPollingInterval();
              message.success('教师已同意，正在登录...');
              setLoginRequestModal({ ...loginRequestModal, visible: false });
              setRequestPending(false);
              setCurrentRequestId(null);
              // 重新尝试登录
              loginUser(formValues);
            } else if (statusRes.status === 'rejected') {
              clearPollingInterval();
              message.error('教师拒绝了登录请求');
              setRequestPending(false);
              setCurrentRequestId(null);
            } else if (statusRes.status === 'expired') {
              clearPollingInterval();
              message.warning('登录请求已过期，请重试');
              setRequestPending(false);
              setCurrentRequestId(null);
            }
          } catch (pollError) {
            console.error('轮询请求状态失败:', pollError);
          }
        }, 3000); // 每3秒查询一次
      } else {
        message.error(response.message || '发送请求失败');
        setRequestPending(false);
      }
    } catch (error) {
      console.error('发起登录请求失败:', error);
      message.error('发送请求失败');
      setRequestPending(false);
    }
  };

  // 重试登录
  const handleRetryLogin = () => {
    clearPollingInterval();
    setLoginRequestModal({ ...loginRequestModal, visible: false });
    setRequestPending(false);
    setCurrentRequestId(null);
    // 用户可以直接重新点击登录按钮
    message.info('请重新点击登录');
  };

  // 关闭登录请求弹窗
  const handleCloseLoginRequestModal = () => {
    clearPollingInterval();
    setLoginRequestModal({ ...loginRequestModal, visible: false });
    setRequestPending(false);
    setCurrentRequestId(null);
  };

  const handleStudentSelect = (studentId) => {
    const selectedStudent = students.find(s => s._id === studentId);
    if (selectedStudent) {
      form.setFieldsValue({
        username: selectedStudent.username,
        name: selectedStudent.name
      });

      setSelectedStudentName(selectedStudent.name);

      if (selectedStudent.seatNumber) {
        setSelectedSeat(selectedStudent.seatNumber);
      }
    }
  };

  const handleSeatClick = (seat) => {
    if (seat.occupied) {
      setSelectedSeat(seat.id);

      const selectedStudent = students.find(s => s.username === seat.username);

      form.setFieldsValue({
        username: seat.username,
        name: seat.studentName,
        studentId: selectedStudent?._id
      });

      setSelectedStudentName(seat.studentName);
      setSeatMapVisible(false);
    }
  };

  const handleNoSeatStudentClick = (student) => {
    form.setFieldsValue({
      username: student.username,
      name: student.name,
      studentId: student._id
    });

    setSelectedStudentName(student.name);
    setSeatMapVisible(false);
  };

  const renderSeatMap = () => {
    if (seatMap.length === 0 && studentsWithoutSeat.length === 0) return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
        该班级还未分配座位
      </div>
    );

    const getResponsiveGridStyle = () => {
      const maxCols = Math.min(maxColumns, Math.floor((window.innerWidth - 100) / 60));
      return {
        display: 'grid',
        gap: '8px',
        gridTemplateColumns: `repeat(${maxCols > 0 ? maxCols : 1}, minmax(50px, 1fr))`
      };
    };

    const gridStyle = getResponsiveGridStyle();

    const rows = {};
    seatMap.forEach(seat => {
      const row = seat.id.substring(1);
      if (!rows[row]) rows[row] = [];
      rows[row].push(seat);
    });

    const sortedRows = Object.keys(rows).sort((a, b) => Number(a) - Number(b));

    return (
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ flex: 3, minWidth: '300px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
              color: 'white',
              textAlign: 'center',
              padding: '12px',
              marginBottom: '20px',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '14px'
            }}>讲台</div>

            {sortedRows.map(rowNum => (
              <div key={rowNum} style={{ ...gridStyle, marginBottom: '8px' }}>
                {rows[rowNum].sort((a, b) => a.id.localeCompare(b.id)).map(seat => {
                  let seatStyle = {
                    padding: '8px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    cursor: seat.occupied ? 'pointer' : 'default',
                    minHeight: '50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  };

                  if (seat.occupied) {
                    seatStyle.backgroundColor = '#f0f9ff';
                    seatStyle.borderColor = '#93c5fd';
                  } else {
                    seatStyle.backgroundColor = '#f1f5f9';
                    seatStyle.color = '#cbd5e1';
                  }

                  if (seat.id === selectedSeat) {
                    seatStyle.backgroundColor = '#dcfce7';
                    seatStyle.borderColor = '#4ade80';
                    seatStyle.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.3)';
                  }

                  return (
                    <div key={seat.id} style={seatStyle} onClick={() => handleSeatClick(seat)}>
                      <div style={{ fontWeight: '600', fontSize: '12px', color: '#64748b' }}>{seat.id}</div>
                      <div style={{ fontSize: '13px', marginTop: '2px' }}>
                        {seat.occupied ? seat.studentName : '空'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {studentsWithoutSeat.length > 0 && (
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{
                padding: '16px',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                backgroundColor: '#fafafa',
                height: '100%',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <h4 style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px', fontWeight: '600' }}>未分配座位</h4>
                {studentsWithoutSeat.map(student => (
                  <div
                    key={student._id}
                    style={{
                      margin: '6px 0',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleNoSeatStudentClick(student)}
                  >
                    {student.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 确认座位弹窗打开后自动滚动到高亮座位
  useEffect(() => {
    if (confirmSeatMapVisible && confirmSeatMapRef.current && selectedSeat) {
      // 等待DOM渲染完成后滚动
      const timer = setTimeout(() => {
        const highlighted = confirmSeatMapRef.current.querySelector('[data-seat-highlighted="true"]');
        if (highlighted) {
          highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [confirmSeatMapVisible, selectedSeat]);

  const renderConfirmSeatMap = () => {
    if (seatMap.length === 0 && studentsWithoutSeat.length === 0) return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
        该班级还未分配座位
      </div>
    );

    const getResponsiveGridStyle = () => {
      const maxCols = Math.min(maxColumns, Math.floor((window.innerWidth - 100) / 60));
      return {
        display: 'grid',
        gap: '6px',
        gridTemplateColumns: `repeat(${maxCols > 0 ? maxCols : 1}, minmax(44px, 1fr))`
      };
    };

    const gridStyle = getResponsiveGridStyle();

    const rows = {};
    seatMap.forEach(seat => {
      const row = seat.id.substring(1);
      if (!rows[row]) rows[row] = [];
      rows[row].push(seat);
    });

    const sortedRows = Object.keys(rows).sort((a, b) => Number(a) - Number(b));

    return (
      <div ref={confirmSeatMapRef} style={{
        padding: '12px',
        maxHeight: 'calc(80vh - 220px)',
        minHeight: '120px',
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRadius: '8px',
        border: '1px solid #f1f5f9',
        backgroundColor: '#fafbfc'
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 3, minWidth: '250px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
              color: 'white',
              textAlign: 'center',
              padding: '8px',
              marginBottom: '12px',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px'
            }}>讲台</div>

            {sortedRows.map(rowNum => (
              <div key={rowNum} style={{ ...gridStyle, marginBottom: '6px' }}>
                {rows[rowNum].sort((a, b) => a.id.localeCompare(b.id)).map(seat => {
                  const isHighlighted = seat.id === selectedSeat;
                  let seatStyle = {
                    padding: '6px 4px',
                    textAlign: 'center',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    cursor: 'default',
                    minHeight: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  };

                  if (seat.occupied) {
                    seatStyle.backgroundColor = '#f0f9ff';
                    seatStyle.borderColor = '#93c5fd';
                  } else {
                    seatStyle.backgroundColor = '#f1f5f9';
                    seatStyle.color = '#cbd5e1';
                  }

                  if (isHighlighted) {
                    seatStyle.backgroundColor = '#dcfce7';
                    seatStyle.borderColor = '#4ade80';
                    seatStyle.boxShadow = '0 0 0 3px rgba(74, 222, 128, 0.4)';
                    seatStyle.transform = 'scale(1.05)';
                  }

                  return (
                    <div
                      key={seat.id}
                      style={seatStyle}
                      data-seat-highlighted={isHighlighted ? 'true' : undefined}
                    >
                      <div style={{ fontWeight: '600', fontSize: '11px', color: isHighlighted ? '#166534' : '#64748b' }}>{seat.id}</div>
                      <div style={{ fontSize: '12px', marginTop: '1px', fontWeight: isHighlighted ? '600' : '400' }}>
                        {seat.occupied ? seat.studentName : '空'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {studentsWithoutSeat.length > 0 && (
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div style={{
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                backgroundColor: '#fafafa',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <h4 style={{ margin: '0 0 8px', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>未分配座位</h4>
                {studentsWithoutSeat.map(student => (
                  <div
                    key={student._id}
                    style={{
                      margin: '4px 0',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      cursor: 'default',
                      fontSize: '12px'
                    }}
                  >
                    {student.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f8fafc',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        right: '-10%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(65, 88, 208, 0.05) 0%, rgba(200, 80, 192, 0.05) 100%)',
        zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-15%',
        width: '700px',
        height: '700px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(200, 80, 192, 0.03) 0%, rgba(255, 204, 112, 0.03) 100%)',
        zIndex: 0
      }}></div>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        zIndex: 1
      }}>
        {/* Logo和标题区域 */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <Logo />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1e293b',
            margin: '0 0 8px',
            letterSpacing: '-0.5px'
          }}>信息科技学习平台</h1>
          <p style={{
            fontSize: '15px',
            color: '#94a3b8',
            margin: 0
          }}>欢迎回来，请登录您的账户</p>
        </div>

        {/* 登录表单卡片 */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.04)'
        }}>
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            form={form}
            requiredMark={false}
          >
            <Form.Item
              label={<span style={{ color: '#475569', fontWeight: '500', fontSize: '14px' }}>选择班级</span>}
              name="classId"
              style={{ marginBottom: '20px' }}
            >
              <Select
                loading={loadingClasses}
                onChange={handleClassChange}
                placeholder="请选择班级"
                size="large"
                suffixIcon={<IconWrap><ClassIcon /></IconWrap>}
                style={{ width: '100%' }}
                dropdownStyle={{ borderRadius: '12px' }}
              >
                {Object.entries(classes).map(([grade, gradeClasses]) => (
                  <Select.OptGroup key={grade} label={`${grade}级`}>
                    {gradeClasses.map(cls => (
                      <Option key={cls._id} value={cls._id}>
                        {cls.name}班
                      </Option>
                    ))}
                  </Select.OptGroup>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label={<span style={{ color: '#475569', fontWeight: '500', fontSize: '14px' }}>选择姓名</span>}
              name="studentId"
              style={{ marginBottom: '20px' }}
            >
              <Select
                placeholder="请选择姓名"
                onChange={handleStudentSelect}
                size="large"
                suffixIcon={<IconWrap><PersonIcon /></IconWrap>}
                style={{ width: '100%' }}
                dropdownStyle={{ borderRadius: '12px' }}
              >
                {students.map(student => (
                  <Option key={student.username} value={student._id}>
                    {student.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label={<span style={{ color: '#475569', fontWeight: '500', fontSize: '14px' }}>学号</span>}
              name="username"
              rules={[{ required: true, message: '请输入学号' }]}
              style={{ marginBottom: '20px' }}
            >
              <Input
                prefix={<span style={{ color: '#94a3b8', marginRight: '8px' }}><UserIcon /></span>}
                placeholder="请输入学号"
                size="large"
                style={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '12px 16px'
                }}
              />
            </Form.Item>

            <Form.Item name="name" hidden>
              <Input />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: '#475569', fontWeight: '500', fontSize: '14px' }}>密码</span>}
              name="password"
              style={{ marginBottom: '24px' }}
            >
              <Input.Password
                prefix={<span style={{ color: '#94a3b8', marginRight: '8px' }}><LockIcon /></span>}
                disabled={selectedClassStatus.isInClass}
                placeholder={selectedClassStatus.isInClass ? "上课中，无需密码" : "请输入密码"}
                size="large"
                style={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '12px 16px'
                }}
              />
            </Form.Item>

            {students.length > 0 && (
              <Button
                type="default"
                onClick={() => setSeatMapVisible(true)}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: '#64748b',
                  fontWeight: '500'
                }}
              >
                <SeatIcon />
                查看座位图
              </Button>
            )}

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{
                  width: '100%',
                  height: '52px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(65, 88, 208, 0.25)'
                }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </div>

        {/* 页脚 */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          color: '#94a3b8',
          fontSize: '13px'
        }}>
          山东省青岛第三十九中学 © {new Date().getFullYear()}
        </div>
      </div>

      {/* 座位图查看模态框 */}
      <Modal
        title={
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
            班级座位图
          </span>
        }
        open={seatMapVisible}
        onCancel={() => setSeatMapVisible(false)}
        footer={null}
        width={1000}
        centered
        styles={{
          body: { overflowX: 'auto', maxWidth: '100%', maxHeight: '70vh', overflowY: 'auto' },
          content: { borderRadius: '20px' }
        }}
      >
        {renderSeatMap()}
      </Modal>

      {/* 登录前座位确认模态框 - 优化布局：确保确认按钮始终可见 */}
      <Modal
        title={
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
            请确认你的座位
          </span>
        }
        open={confirmSeatMapVisible}
        onCancel={() => setConfirmSeatMapVisible(false)}
        footer={null}
        width={Math.min(900, window.innerWidth - 40)}
        centered
        styles={{
          body: { padding: '0', overflow: 'hidden' },
          content: { borderRadius: '20px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        {/* 固定顶部区域：学生信息 + 座位号 */}
        <div style={{
          padding: '16px 24px 12px',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <div style={{
                fontSize: '15px',
                color: '#1e293b',
                marginBottom: '4px'
              }}>
                你好，<span style={{ fontWeight: '600' }}>{selectedStudentName || '同学'}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>请确认你正在使用的电脑对应下方座位图中高亮的座位是否正确</div>
            </div>
            {selectedSeat ? (
              <div style={{
                padding: '8px 20px',
                backgroundColor: '#f0fdf4',
                border: '2px solid #4ade80',
                borderRadius: '10px',
                color: '#166534',
                fontSize: '15px',
                fontWeight: '600',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <SeatIcon /> 座位：{selectedSeat}
              </div>
            ) : (
              <div style={{
                padding: '8px 16px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#991b1b',
                fontSize: '13px',
                flexShrink: 0
              }}>
                未分配座位
              </div>
            )}
          </div>
        </div>

        {/* 可滚动的座位图区域 */}
        <div style={{ flex: '1 1 auto', overflow: 'hidden', padding: '0 24px' }}>
          {renderConfirmSeatMap()}
        </div>

        {/* 固定底部：确认按钮区域 - 始终可见 */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: 'white',
          flexShrink: 0
        }}>
          <span style={{ flex: 1, fontSize: '13px', color: '#94a3b8' }}>
            👆 座位图中绿色高亮的就是你的位置
          </span>
          <Button
            onClick={() => setConfirmSeatMapVisible(false)}
            style={{
              height: '44px',
              padding: '0 24px',
              borderRadius: '10px',
              fontWeight: '500'
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleConfirmLogin}
            loading={loading}
            style={{
              height: '44px',
              padding: '0 32px',
              borderRadius: '10px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(65, 88, 208, 0.25)',
              fontSize: '15px'
            }}
          >
            ✓ 确认并登录
          </Button>
        </div>
      </Modal>

      {/* 登录请求弹窗 */}
      <Modal
        title={null}
        open={loginRequestModal.visible}
        onCancel={handleCloseLoginRequestModal}
        footer={null}
        width={400}
        centered
        closable={!requestPending}
        maskClosable={!requestPending}
        styles={{
          content: { borderRadius: '20px' }
        }}
      >
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <ExclamationCircleOutlined
            style={{
              fontSize: 56,
              color: loginRequestModal.type === 'IP_CHANGE_REQUIRED' ? '#faad14' :
                (loginRequestModal.type === 'IP_AND_DEVICE_CONFLICT' ? '#722ed1' : '#ff4d4f'),
              marginBottom: 16
            }}
          />

          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1e293b',
            margin: '0 0 8px'
          }}>
            {loginRequestModal.type === 'IP_CHANGE_REQUIRED' ? '登录IP变更' :
              (loginRequestModal.type === 'IP_AND_DEVICE_CONFLICT' ? 'IP变更 + 设备冲突' : '设备登录冲突')}
          </h3>

          <p style={{
            color: '#64748b',
            fontSize: '14px',
            margin: '0 0 16px'
          }}>
            {loginRequestModal.message}
          </p>

          {/* IP变更信息 - 单独IP变更或组合类型都显示 */}
          {(loginRequestModal.type === 'IP_CHANGE_REQUIRED' || loginRequestModal.type === 'IP_AND_DEVICE_CONFLICT') && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#92400e',
              textAlign: 'left'
            }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>原IP:</strong> {loginRequestModal.oldIp || '未知'}
              </div>
              <div>
                <strong>当前IP:</strong> {loginRequestModal.newIp || '未知'}
              </div>
            </div>
          )}

          {/* 设备冲突信息 - 单独设备冲突或组合类型都显示 */}
          {(loginRequestModal.type === 'DEVICE_CONFLICT' || loginRequestModal.type === 'IP_AND_DEVICE_CONFLICT') && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#991b1b',
              textAlign: 'left'
            }}>
              你的账号已在其他设备登录。如需在此设备登录，请向教师发起请求，教师同意后将登出其他设备。
            </div>
          )}

          {requestPending && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <LoadingOutlined style={{ fontSize: 20, color: '#3b82f6' }} spin />
              <span style={{ color: '#1e40af', fontSize: '14px' }}>
                等待教师审批中...
              </span>
            </div>
          )}

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Button
              type="primary"
              size="large"
              loading={requestPending && cooldownSeconds === 0}
              onClick={handleRequestLogin}
              disabled={requestPending || cooldownSeconds > 0}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                fontWeight: '600',
                background: (requestPending || cooldownSeconds > 0)
                  ? '#d9d9d9'
                  : 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
                border: 'none'
              }}
            >
              {cooldownSeconds > 0
                ? `请求已发送 (${cooldownSeconds}s)`
                : (requestPending ? '请求已发送' : '请求登录')}
            </Button>

            <Button
              size="large"
              icon={<SyncOutlined />}
              onClick={handleRetryLogin}
              disabled={requestPending}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                fontWeight: '500'
              }}
            >
              重试登录
            </Button>
          </Space>

          <p style={{
            marginTop: '16px',
            fontSize: '12px',
            color: '#94a3b8'
          }}>
            请求有效期为5分钟，过期后需重新发起
          </p>
        </div>
      </Modal>

      {/* 全局样式覆盖 */}
      <style>{`
        .ant-select-selector {
          border-radius: 12px !important;
          border: 1px solid #e2e8f0 !important;
          height: 48px !important;
          padding: 8px 16px !important;
          display: flex !important;
          align-items: center !important;
        }
        .ant-select-selection-item {
          line-height: 30px !important;
        }
        .ant-select-selection-placeholder {
          line-height: 30px !important;
        }
        .ant-select-arrow {
          top: 50% !important;
          transform: translateY(-50%) !important;
          margin-top: 0 !important;
          right: 16px !important;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
        .ant-select-arrow svg {
          display: block !important;
          width: 18px;
          height: 18px;
        }
        /* 重新强制居中 Select 箭头与自定义图标 */
        .ant-select-arrow {
          top: 0 !important;
          bottom: 0 !important;
          transform: none !important;
          margin-top: 0 !important;
          right: 16px !important;
          display: flex !important;
          align-items: center !important;
          justifyContent: center !important;
          height: 48px !important;
        }
        .ant-select-arrow svg {
          display: block !important;
          width: 18px !important;
          height: 18px !important;
        }
        .ant-input-affix-wrapper {
          border-radius: 12px !important;
          border: 1px solid #e2e8f0 !important;
        }
        .ant-input-affix-wrapper:hover,
        .ant-input-affix-wrapper:focus,
        .ant-input-affix-wrapper-focused {
          border-color: #4158D0 !important;
          box-shadow: 0 0 0 2px rgba(65, 88, 208, 0.1) !important;
        }
        .ant-select:hover .ant-select-selector,
        .ant-select-focused .ant-select-selector {
          border-color: #4158D0 !important;
          box-shadow: 0 0 0 2px rgba(65, 88, 208, 0.1) !important;
        }
        .ant-btn-default:hover {
          border-color: #4158D0 !important;
          color: #4158D0 !important;
        }
        .ant-form-item-label > label {
          height: auto !important;
        }
        .ant-modal-content {
          border-radius: 20px !important;
          overflow: hidden;
        }
        .ant-modal-header {
          padding: 20px 24px !important;
          border-bottom: 1px solid #f1f5f9 !important;
        }
        .ant-modal-close {
          top: 16px !important;
        }
        .ant-input-password .ant-input {
          padding: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default Login;
