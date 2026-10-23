import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Tooltip, Modal, Input, message, Badge, Form, Select, InputNumber, Tabs, Button } from 'antd';
import api from '../../services/api';
import { classAPI, classroomLayoutAPI } from '../../services/api';
import { addStudentPoints } from '../../services/achievementService';

const { TabPane } = Tabs;

const styles = {
  container: {
    width: '100%',
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  mainContent: {
    flex: '1 1 600px',
    minWidth: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  seatGrid: {
    display: 'grid',
    gap: '10px',
    transform: 'rotate(180deg)', // 整体旋转180度
    justifyContent: 'center',
    padding: '16px',
    width: '100%'
  },
  seat: {
    width: '90px',
    height: '70px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    padding: '4px',
    backgroundColor: 'white',
    transition: 'all 0.3s',
    transform: 'rotate(180deg)', // 座位内容旋转回来
    cursor: 'default',
    position: 'relative'
  },
  occupiedSeat: {
    borderColor: '#91d5ff'
  },
  onlineSeat: {
    borderColor: '#91d5ff'
  },
  offlineSeat: {
    borderColor: '#d9d9d9',
    opacity: 0.8
  },
  submissionCount: {
    fontSize: '11px',
    color: '#666',
    marginTop: '2px'
  },
  teacherDesk: {
    width: '60%',
    textAlign: 'center',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    marginTop: '20px',
    fontSize: '16px',
    border: '1px solid #d9d9d9'
  },
  seatNumber: {
    fontSize: '12px',
    color: '#999',
    marginBottom: '1px'
  },
  studentName: {
    fontSize: '13px',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  sidebarContainer: {
    flex: '0 0 220px',
    maxWidth: '260px',
    padding: '0 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  studentsList: {
    maxHeight: '300px',
    overflowY: 'auto',
    border: '1px solid #f0f0f0',
    borderRadius: '4px',
    padding: '8px'
  },
  studentsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#666',
    marginBottom: '8px',
    borderBottom: '1px solid #f0f0f0',
    paddingBottom: '8px'
  },
  studentItem: {
    padding: '8px 12px',
    margin: '4px 0',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.2s',
    fontSize: '14px',
    color: '#333'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '5px'
  },
  pointsAdjustForm: {
    maxWidth: '500px'
  }
};

// 根据提交比例获取背景色
const getSubmissionColor = (submitted, total) => {
  if (!total) return 'white';  // 如果没有需要提交的作业
  const ratio = submitted / total;
  if (ratio === 0) return '#ffd6d6';      // 未提交
  if (ratio <= 0.3) return '#ffe7ba';     // 提交较少
  if (ratio <= 0.6) return '#e8f4d9';     // 提交一般
  if (ratio < 1) return '#d9f7be';        // 提交较多，颜色改为浅绿色
  return '#b5f5ec';                       // 全部提交，颜色改为浅青色
};

// 获取状态对应的颜色
const getStatusColor = (status) => {
  switch (status) {
    case 'online': return '#52c41a'; // 绿色
    case 'absent': return '#ff7875'; // 红色
    default: return '#d9d9d9'; // 灰色
  }
};

const SeatingChart = ({ students = [], onUpdateSeat, stats, classId }) => {
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [seatInput, setSeatInput] = useState('');
  const deskClickCountRef = useRef(0);
  const deskClickTimerRef = useRef(null);

  // 添加调整积分相关状态
  const [adjustPointsLoading, setAdjustPointsLoading] = useState(false);
  const [adjustPointsForm] = Form.useForm();
  const [activeTabKey, setActiveTabKey] = useState('1');  // 添加标签页状态
  const [layouts, setLayouts] = useState([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState(null);

  // 计算最大行列数和分离有座位和无座位的学生
  const { maxRows, maxCols, seatMap, offlineStudents, noSeatStudents } = useMemo(() => {
    let maxRow = 0;
    let maxCol = 0;
    const map = {};
    const offline = [];
    const noSeat = [];

    // 先处理所有学生
    students.forEach(student => {
      // 未分配座位的学生
      if (!student.seatNumber) {
        noSeat.push(student);
        return;
      }

      // 处理有座位的学生
      const match = student.seatNumber.match(/([A-Z])(\d+)/);
      if (match) {
        const col = match[1].charCodeAt(0) - 65;
        const row = parseInt(match[2]) - 1;

        // 更新最大行列值
        maxCol = Math.max(maxCol, col);
        maxRow = Math.max(maxRow, row);

        // 无论是否在线，都在座位图上占位；离线学生将以灰色显示
        const isOnlineNow = !!student.isOnlineNow;
        map[student.seatNumber] = student;
        if (!isOnlineNow) {
          // 不在线（含被强制下线）放入未在线列表
          offline.push(student);
        }
      } else {
        // 座位号格式有问题的学生
        noSeat.push(student);
      }
    });

    return {
      maxRows: maxRow + 1,
      maxCols: maxCol + 1,
      seatMap: map,
      offlineStudents: offline,
      noSeatStudents: noSeat
    };
  }, [students]);

  // 加载机房布局选项与当前班级设置的机房布局
  useEffect(() => {
    const fetchLayoutsAndSetting = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user?.role !== 'teacher' || !classId) return;

        const layoutList = await classroomLayoutAPI.getLayouts();
        setLayouts(layoutList || []);

        const details = await classAPI.getClassDetails(classId);
        const data = details?.data || details;
        if (data?.selectedClassroomLayout?._id) {
          setSelectedLayoutId(data.selectedClassroomLayout._id);
        } else if ((layoutList || []).length > 0) {
          setSelectedLayoutId(layoutList[0]._id);
        }
      } catch (e) {
        // 忽略错误
      }
    };
    fetchLayoutsAndSetting();
  }, [classId]);

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setIsModalVisible(true);
    setSeatInput('');
    // 重置表单
    adjustPointsForm.resetFields();
    adjustPointsForm.setFieldsValue({
      operationType: 'add',
      amount: 10,
      reason: ''
    });
    // 默认打开座位分配标签页
    setActiveTabKey('1');
  };

  // 提交调整积分
  const handleSubmitAdjustPoints = async () => {
    try {
      const values = await adjustPointsForm.validateFields();

      if (!selectedStudent) {
        message.error('未选择学生');
        return;
      }

      const { amount, reason, operationType } = values;

      if (!amount || amount <= 0) {
        message.error('请输入大于0的积分数值');
        return;
      }

      setAdjustPointsLoading(true);

      // 根据操作类型设置积分值（增加为正数，扣除为负数）
      const pointsAmount = operationType === 'add' ? amount : -amount;

      const response = await addStudentPoints(
        selectedStudent._id,
        pointsAmount,
        reason || (pointsAmount > 0 ? '教师奖励积分' : '教师扣除积分')
      );

      if (response.success) {
        message.success(`积分${pointsAmount > 0 ? '增加' : '扣除'}成功，当前积分：${response.newBalance}`);
        setIsModalVisible(false);
        setSelectedStudent(null);
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('调整积分失败:', error);
      message.error('调整积分失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setAdjustPointsLoading(false);
    }
  };

  // 处理标签页切换
  const handleTabChange = (key) => {
    setActiveTabKey(key);
  };

  // 处理模态框确认按钮点击
  const handleModalOk = async () => {
    // 根据当前标签页执行不同的操作
    if (activeTabKey === '1') {
      // 座位分配标签页
      // 如果输入为空且是老师操作,则视为清空座位号
      const isTeacher = JSON.parse(localStorage.getItem('user') || '{}').role === 'teacher';
      const shouldClearSeat = !seatInput && isTeacher;

      if (!shouldClearSeat && !seatInput) {
        message.error('请输入座位号');
        return;
      }

      if (!shouldClearSeat) {
        const upperSeat = seatInput.toUpperCase();
        // 验证座位号格式
        const isValidSeat = /^[A-Z][1-9][0-9]*$/.test(upperSeat);
        if (!isValidSeat) {
          message.error('座位号格式不正确，请输入如 A1、B2 的格式');
          return;
        }

        // 检查座位是否已被占用(排除当前选中的学生)
        if (seatMap[upperSeat] && seatMap[upperSeat]._id !== selectedStudent._id) {
          message.error('该座位已被占用');
          return;
        }
      }

      try {
        // 调用后端 API 更新座位
        await api.post('/auth/update-seat', {
          userId: selectedStudent._id,
          seatNumber: shouldClearSeat ? null : seatInput.toUpperCase()
        });

        // 更新本地存储中该学生的座位信息
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user._id === selectedStudent._id) {
          const updatedUser = {
            ...user,
            seatNumber: shouldClearSeat ? null : seatInput.toUpperCase()
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }

        message.success(shouldClearSeat ? '已清空座位号' : '座位分配成功');
        setIsModalVisible(false);
        setSelectedStudent(null);
        setSeatInput('');

        // 更新学生列表中的座位信息
        const updatedStudents = students.map(student => {
          if (student._id === selectedStudent._id) {
            // 如果是被修改的学生,更新座位号
            return { ...student, seatNumber: shouldClearSeat ? null : seatInput.toUpperCase() };
          }
          return student;
        });

        // 调用父组件的 onUpdateSeat 回调
        if (onUpdateSeat) {
          onUpdateSeat(updatedStudents);
        }
      } catch (error) {
        message.error(error.response?.data?.message || '座位分配失败');
      }
    } else if (activeTabKey === '2') {
      // 调整积分标签页
      await handleSubmitAdjustPoints();
    }
  };

  const handleDeskClick = async () => {
    const isTeacher = JSON.parse(localStorage.getItem('user') || '{}').role === 'teacher';
    if (!isTeacher) return;

    deskClickCountRef.current += 1;

    // 重置之前的定时器
    if (deskClickTimerRef.current) {
      clearTimeout(deskClickTimerRef.current);
    }

    // 设置新的定时器，3秒后重置点击次数
    deskClickTimerRef.current = setTimeout(() => {
      deskClickCountRef.current = 0;
    }, 3000);

    // 如果点击次数达到10次
    if (deskClickCountRef.current === 10) {
      deskClickCountRef.current = 0;
      if (deskClickTimerRef.current) {
        clearTimeout(deskClickTimerRef.current);
      }

      try {
        // 清空所有学生的座位号
        const promises = students.map(student =>
          student.seatNumber ?
            api.post('/auth/update-seat', {
              userId: student._id,
              seatNumber: null
            }) :
            Promise.resolve()
        );

        await Promise.all(promises);
        message.success('已清空所有座位');

        // 更新所有学生的座位信息
        const updatedStudents = students.map(student => ({
          ...student,
          seatNumber: null
        }));

        // 调用父组件的回调
        if (onUpdateSeat) {
          onUpdateSeat(updatedStudents);
        }
      } catch (error) {
        message.error('清空座位失败');
      }
    }
  };

  const renderSeat = (col, row) => {
    const seatNumber = `${String.fromCharCode(65 + col)}${row + 1}`;
    const student = seatMap[seatNumber];
    const isOnline = !!student?.isOnlineNow;
    const isTeacher = JSON.parse(localStorage.getItem('user') || '{}').role === 'teacher';

    return (
      <Tooltip
        key={seatNumber}
        title={student ?
          `${student.name} - ${seatNumber}${!isOnline ? ' (未在线)' : ''}${student.submissionStats ?
            `\n作业提交：${student.submissionStats.submitted}/${student.submissionStats.total}` :
            ''}`
          : seatNumber}
        placement="top"
      >
        <div
          style={{
            ...styles.seat,
            ...(student ? styles.occupiedSeat : {}),
            ...(isOnline ? styles.onlineSeat : {}),
            ...(!isOnline && student ? styles.offlineSeat : {}),
            cursor: student ? 'pointer' : 'default',
            backgroundColor: student ?
              isOnline ? getSubmissionColor(
                student.submissionStats?.submitted || 0,
                student.submissionStats?.total || 0
              ) : '#f0f0f0' : // 未在线学生使用灰色背景
              'white',
            borderColor: isOnline ? '#91d5ff' : '#d9d9d9'  // 未在线学生和空座位都使用灰色边框
          }}
          onClick={() => student && handleStudentClick(student)}
        >
          <div style={styles.seatNumber}>{seatNumber}</div>
          {student && (
            <>
              <div style={styles.studentName}>
                {student.name}
              </div>
              {student.submissionStats && (
                <div style={styles.submissionCount}>
                  {student.submissionStats.submitted}/{student.submissionStats.total}
                </div>
              )}
              {isTeacher && isOnline && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForceLogout(student);
                  }}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#faad14',
                    border: '1px solid rgba(0,0,0,0.15)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.6) inset',
                    cursor: 'pointer',
                    position: 'absolute',
                    right: 6,
                    top: 6
                  }}
                  title="强制下线"
                />
              )}
            </>
          )}
        </div>
      </Tooltip>
    );
  };

  const renderGrid = () => {
    const grid = [];
    for (let row = 0; row < maxRows; row++) {
      for (let col = 0; col < maxCols; col++) {
        grid.push(renderSeat(col, row));
      }
    }
    return grid;
  };

  const handleForceLogout = async (student) => {
    if (!classId) {
      message.warning('请先选择班级');
      return;
    }
    try {
      await classAPI.forceLogoutStudent(classId, student._id);
      message.success('已强制下线该学生');
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('refresh-class-students'));
      }
    } catch (e) {
      message.error(e?.response?.data?.message || '操作失败');
    }
  };

  // 渲染学生列表项
  const renderStudentItem = (student, type) => {
    return (
      <div
        key={student._id}
        style={{
          ...styles.studentItem,
          backgroundColor: type === 'offline' ? '#fff1f0' : '#f9f9f9',
          borderLeft: `3px solid ${type === 'offline' ? '#ff7875' : '#d9d9d9'}`,
        }}
        onClick={() => handleStudentClick(student)}
      >
        <span
          style={{
            ...styles.statusDot,
            backgroundColor: type === 'offline' ? '#ff7875' : '#d9d9d9'
          }}
        />
        {student.name}
        {student.seatNumber && ` (${student.seatNumber})`}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.mainContent}>
        <div style={{
          ...styles.seatGrid,
          gridTemplateColumns: `repeat(${maxCols}, 1fr)`
        }}>
          {renderGrid()}
        </div>
        <div
          style={styles.teacherDesk}
          onClick={handleDeskClick}
        >
          讲台
        </div>
      </div>

      <div style={styles.sidebarContainer}>
        {/* 未在线学生列表 */}
        {offlineStudents.length > 0 && (
          <div style={styles.studentsList}>
            <div style={styles.studentsTitle}>
              未在线学生 ({offlineStudents.length})
            </div>
            {offlineStudents.map(student => renderStudentItem(student, 'offline'))}
          </div>
        )}

        {/* 未分配座位学生列表 */}
        {noSeatStudents.length > 0 && (
          <div style={styles.studentsList}>
            <div style={styles.studentsTitle}>
              未分配座位 ({noSeatStudents.length})
            </div>
            {noSeatStudents.map(student => renderStudentItem(student, 'noSeat'))}
          </div>
        )}

        {/* 清空座位按钮（独立按钮，无标题无外框，教师可见） */}
        {(() => {
          const isTeacher = JSON.parse(localStorage.getItem('user') || '{}').role === 'teacher';
          if (!isTeacher) return null;
          return (
            <>
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Select
                  size="small"
                  style={{ flex: 1 }}
                  placeholder="选择教室"
                  value={selectedLayoutId}
                  onChange={async (val) => {
                    setSelectedLayoutId(val);
                    if (!classId) return;
                    try {
                      await classAPI.updateClassSettings(classId, { selectedClassroomLayout: val });
                      message.success('教室设置已更新');
                    } catch (e) {
                      message.error(e?.response?.data?.message || '更新教室失败');
                    }
                  }}
                  options={(layouts || []).map(l => ({ label: l.name, value: l._id }))}
                />
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    if (!classId) {
                      message.warning('请先选择班级');
                      return;
                    }
                    Modal.confirm({
                      title: '确认清空座位',
                      content: '将清空本班所有学生的座位号，是否继续？',
                      okText: '清空',
                      okType: 'danger',
                      cancelText: '取消',
                      onOk: async () => {
                        try {
                          const res = await classAPI.clearClassSeats(classId);
                          message.success(res?.message || '已清空班级座位号');
                          const updatedStudents = students.map(s => ({ ...s, seatNumber: null }));
                          if (onUpdateSeat) onUpdateSeat(updatedStudents);
                        } catch (e) {
                          message.error(e?.response?.data?.message || '清空座位失败');
                        }
                      }
                    });
                  }}
                >
                  清空班级座位
                </Button>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Button
                  danger
                  size="small"
                  style={{ width: '100%' }}
                  onClick={() => {
                    if (!classId) {
                      message.warning('请先选择班级');
                      return;
                    }
                    Modal.confirm({
                      title: '确认全班下线',
                      content: '将强制下线本班所有在线学生，是否继续？',
                      okText: '确认下线',
                      okType: 'danger',
                      cancelText: '取消',
                      onOk: async () => {
                        try {
                          const res = await classAPI.forceLogoutAllStudents(classId);
                          message.success(res?.message || '已强制下线全班学生');
                          // 触发刷新
                          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                            window.dispatchEvent(new CustomEvent('refresh-class-students'));
                          }
                        } catch (e) {
                          message.error(e?.response?.data?.message || '全班下线失败');
                        }
                      }
                    });
                  }}
                >
                  全班下线
                </Button>
              </div>
            </>
          );
        })()}
      </div>

      <Modal
        title={`学生管理 - ${selectedStudent?.name || ''}`}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false);
          setSelectedStudent(null);
          setSeatInput('');
        }}
        okText={activeTabKey === '1' ? '确认分配' : '确认调整'}
        confirmLoading={activeTabKey === '2' && adjustPointsLoading}
      >
        <Tabs activeKey={activeTabKey} onChange={handleTabChange}>
          <TabPane tab="分配座位" key="1">
            <p>为 {selectedStudent?.name} 分配座位{selectedStudent?.seatNumber ? `(当前座位: ${selectedStudent.seatNumber})` : ''}：</p>
            <Input
              placeholder={JSON.parse(localStorage.getItem('user') || '{}').role === 'teacher' ? "请输入座位号（如：A1、B2），留空表示清除座位" : "请输入座位号（如：A1、B2）"}
              value={seatInput}
              onChange={e => setSeatInput(e.target.value)}
              style={{ marginTop: '10px' }}
            />
          </TabPane>
          <TabPane tab="调整积分" key="2">
            <Form
              form={adjustPointsForm}
              layout="vertical"
              style={styles.pointsAdjustForm}
            >
              <Form.Item
                name="operationType"
                label="操作类型"
                initialValue="add"
              >
                <Select>
                  <Select.Option value="add">增加积分</Select.Option>
                  <Select.Option value="deduct">扣除积分</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="amount"
                label="积分数量"
                initialValue={10}
                rules={[
                  { required: true, message: '请输入积分数量' },
                  { type: 'number', min: 1, message: '积分必须大于0' }
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>

              <Form.Item
                name="reason"
                label="原因"
              >
                <Input.TextArea placeholder="例如：课堂表现优异" />
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Modal>
    </div>
  );
};

export default SeatingChart; 