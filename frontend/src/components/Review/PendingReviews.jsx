import React, { useState, useEffect } from 'react';
import { Card, List, Button, message, Space, Switch, Pagination, Layout, Menu, Input, Tag, Row, Col, Empty, Spin, Avatar, Badge, Select } from 'antd';
import { UserOutlined, FilterOutlined, SearchOutlined, BellOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { chatAPI } from '../../services/api';
import { getSettings, updateSetting } from '../../services/api';
import { classAPI } from '../../services/api';
import MessageItem from '../Chat/MessageItem';
import usePageTitle from '../../hooks/usePageTitle';

const { Sider, Content } = Layout;
const { Search } = Input;
const { Option } = Select;

const PendingReviews = () => {
  usePageTitle('消息审核'); // 添加页面标题

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leftLoading, setLeftLoading] = useState(false);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // 侧边栏不再支持折叠
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    courseId: null,
    type: null,
    grade: null,
    className: null
  });
  const [studentPager, setStudentPager] = useState({ page: 1, limit: 20, total: 0 });
  const [teacherClasses, setTeacherClasses] = useState([]);

  // 获取审核设置
  useEffect(() => {
    const fetchReviewSetting = async () => {
      try {
        const response = await getSettings('reviewEnabled');
        setReviewEnabled(response?.value || false);
      } catch (error) {
        console.error('获取审核设置失败:', error);
      }
    };
    fetchReviewSetting();
  }, []);

  // 切换审核开关
  const handleReviewToggle = async (checked) => {
    try {
      await updateSetting('reviewEnabled', checked);
      setReviewEnabled(checked);
      message.success(`审核功能已${checked ? '开启' : '关闭'}`);
    } catch (error) {
      console.error('更新审核设置失败:', error);
      message.error('更新设置失败');
    }
  };

  // 初次与过滤器变化时刷新左侧学生汇总
  useEffect(() => {
    fetchStudents();
  }, [filters, studentPager.page, studentPager.limit]);

  // 加载教师拥有的班级，用于生成年级/班级筛选项
  useEffect(() => {
    const loadTeacherClasses = async () => {
      try {
        const res = await classAPI.getTeacherClasses();
        const classes = Array.isArray(res)
          ? res
          : (Array.isArray(res?.data)
              ? res.data
              : (res?.classes || res?.data?.classes || []));
        setTeacherClasses(classes);
        if (!classes || classes.length === 0) {
          console.warn('教师班级为空或加载失败，返回值：', res);
        }
      } catch (error) {
        console.error('获取教师班级失败:', error);
      }
    };
    loadTeacherClasses();
  }, []);

  // 点击学生时加载该学生的全部消息
  useEffect(() => {
    if (selectedStudent) {
      fetchMessagesByStudent(selectedStudent);
    } else {
      // 未选学生时，默认显示空或提示
      setMessages([]);
    }
  }, [selectedStudent]);

  // 提取唯一的学生列表
  // 服务端聚合：获取学生汇总
  const fetchStudents = async () => {
    setLeftLoading(true);
    try {
      const params = { page: studentPager.page, limit: studentPager.limit };
      if (filters.type) params.type = filters.type;
      if (filters.courseId) params.courseId = filters.courseId;
      if (filters.grade) params.grade = filters.grade;
      if (filters.className) params.className = filters.className;
      const res = await chatAPI.getPendingStudentsAggregate(params);
      const list = res?.data?.students || [];
      setStudents(list);
      const pagination = res?.data?.pagination;
      if (pagination) {
        setStudentPager(prev => ({ ...prev, total: pagination.total, page: pagination.page, limit: pagination.limit }));
      }
      return list;
    } catch (error) {
      console.error('获取学生汇总失败:', error);
      message.error('获取学生汇总失败');
      setStudents([]);
      return [];
    } finally {
      setLeftLoading(false);
    }
  };

  const fetchMessagesByStudent = async (studentId) => {
    setLoading(true);
    try {
      const params = { status: 'pending' };
      if (filters.type) params.type = filters.type;
      if (filters.courseId) params.courseId = filters.courseId;
      const res = await chatAPI.getMessagesByStudent(studentId, params);
      const list = res?.data?.messages || [];
      setMessages(list);
      setPagination(prev => ({ ...prev, total: list.length }));
      return list;
    } catch (error) {
      console.error('按学生获取消息失败:', error);
      message.error('加载学生对话失败');
      setMessages([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (messageId) => {
    try {
      await chatAPI.approveMessage(messageId);
      message.success('消息已通过审核');
      if (selectedStudent) {
        const latestStudents = await fetchStudents();
        const latestMsgs = await fetchMessagesByStudent(selectedStudent);
        if (latestMsgs.length === 0) {
          if (latestStudents.length === 0) {
            setSelectedStudent(null);
            return;
          }
          const idx = latestStudents.findIndex(s => (s.id || s._id || s.studentId) === selectedStudent);
          const next = latestStudents[(idx >= 0 ? idx + 1 : 0)] || latestStudents[0];
          setSelectedStudent(next ? (next.id || next._id || next.studentId) : null);
        }
      } else {
        fetchStudents();
      }
    } catch (error) {
      console.error('审核失败:', error);
      message.error('审核失败');
    }
  };

  const handleReject = async (messageId) => {
    try {
      await chatAPI.rejectMessage(messageId);
      message.success('消息已拒绝');
      if (selectedStudent) {
        const latestStudents = await fetchStudents();
        const latestMsgs = await fetchMessagesByStudent(selectedStudent);
        if (latestMsgs.length === 0) {
          if (latestStudents.length === 0) {
            setSelectedStudent(null);
            return;
          }
          const idx = latestStudents.findIndex(s => (s.id || s._id || s.studentId) === selectedStudent);
          const next = latestStudents[(idx >= 0 ? idx + 1 : 0)] || latestStudents[0];
          setSelectedStudent(next ? (next.id || next._id || next.studentId) : null);
        }
      } else {
        fetchStudents();
      }
    } catch (error) {
      console.error('拒绝失败:', error);
      message.error('拒绝失败');
    }
  };

  const handlePageChange = (page, pageSize) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize
    }));
  };

  const handleStudentSelect = (studentId) => {
    setSelectedStudent(studentId === selectedStudent ? null : studentId);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    // 如果需要，可以在这里添加基于搜索词的筛选逻辑
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, current: 1 })); // 重置到第一页
    setStudentPager(prev => ({ ...prev, page: 1 }));
  };

  const handleGradeChange = (value) => {
    setFilters(prev => ({ ...prev, grade: value, className: null }));
    setStudentPager(prev => ({ ...prev, page: 1 }));
  };

  const filteredStudents = searchQuery
    ? students.filter(student => 
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  return (
    <Layout style={{ background: '#fff', minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider 
        width={250} 
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ marginBottom: '16px' }}>
            <Search 
              placeholder="搜索学生" 
              onSearch={handleSearch} 
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '8px 0' }}>
              <FilterOutlined /> 筛选
            </h4>
            <Select
              placeholder="选择类型"
              style={{ width: '100%', marginBottom: '8px' }}
              allowClear
              onChange={(value) => handleFilterChange('type', value)}
            >
              <Option value="general">普通问答</Option>
              <Option value="course">课程问答</Option>
            </Select>
            {/* 预留课程筛选位 */}
            {/* <Select placeholder="选择课程" style={{ width: '100%' }} onChange={(v)=>handleFilterChange('courseId', v)} /> */}
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              <Select
                placeholder="选择年级"
                allowClear
                value={filters.grade}
                onChange={handleGradeChange}
                style={{ width: '100%' }}
                options={Array.from(new Set((teacherClasses || []).map(c => c.grade)))
                  .sort((a, b) => b - a)
                  .map(g => ({ label: `${g}`, value: g }))}
              />
              <Select
                placeholder="选择班级"
                allowClear
                value={filters.className}
                onChange={v => handleFilterChange('className', v)}
                style={{ width: '100%' }}
                options={Array.from(new Set((teacherClasses || [])
                    .filter(c => !filters.grade || c.grade === filters.grade)
                    .map(c => c.name)))
                  .sort((a, b) => a - b)
                  .map(n => ({ label: `${n}`, value: n }))}
              />
            </Space>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            <h4 style={{ margin: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><UserOutlined /> 学生列表</span>
              <span style={{ color: '#999', fontWeight: 'normal' }}>{studentPager.total || 0}</span>
            </h4>
            
            {leftLoading ? (
              <div style={{ textAlign: 'center', marginTop: 40 }}>
                <Spin size="small" /> 加载学生...
              </div>
            ) : filteredStudents.length > 0 ? (
              <Menu
                mode="inline"
                selectedKeys={selectedStudent ? [selectedStudent] : []}
                style={{ border: 0 }}
              >
                {filteredStudents.map((student) => (
                  <Menu.Item 
                    key={student.id || student._id || student?.studentId} 
                    onClick={() => handleStudentSelect(student.id || student._id || student?.studentId)}
                    icon={<Avatar size="small" icon={<UserOutlined />} />}
                  >
                    <Space>
                      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {student.name || student.username}
                      </span>
                      <Badge count={student.count} style={{ backgroundColor: '#52c41a' }} />
                    </Space>
                  </Menu.Item>
                ))}
              </Menu>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无学生数据" />
            )}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Pagination
                size="small"
                current={studentPager.page}
                pageSize={studentPager.limit}
                total={studentPager.total}
                onChange={(p, ps) => setStudentPager({ page: p, limit: ps, total: studentPager.total })}
              />
            </div>
          </div>
        </div>
      </Sider>
      
      {/* 主内容区 */}
      <Content style={{ padding: '0 24px', minHeight: 280 }}>
        <Card
          title={
            <Row justify="space-between" align="middle">
              <Col>
                <Space size="large">
                  <Space>
                    <BellOutlined />
                    <span>待审核消息</span>
                    {selectedStudent && (
                      <Tag color="blue" closable onClose={() => setSelectedStudent(null)}>
                        已筛选学生
                      </Tag>
                    )}
                    {filters.type && (
                      <Tag color="purple" closable onClose={() => handleFilterChange('type', null)}>
                        类型: {filters.type === 'general' ? '普通问答' : '课程问答'}
                      </Tag>
                    )}
                  </Space>
                  <Switch
                    checked={reviewEnabled}
                    onChange={handleReviewToggle}
                    checkedChildren="审核开启"
                    unCheckedChildren="审核关闭"
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<CheckCircleOutlined />} 
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    disabled={!selectedStudent || messages.length === 0}
                    onClick={async () => {
                      if (!selectedStudent) return;
                      try {
                        await chatAPI.bulkReview({
                          studentId: selectedStudent,
                          status: 'approved',
                          filters: { type: filters.type, courseId: filters.courseId }
                        });
                        message.success('已全部通过');
                        const latestStudents = await fetchStudents();
                        const latestMsgs = await fetchMessagesByStudent(selectedStudent);
                        if (latestMsgs.length === 0) {
                          const idx = latestStudents.findIndex(s => (s.id || s._id || s.studentId) === selectedStudent);
                          const next = latestStudents[idx + 1] || latestStudents[0];
                          setSelectedStudent(next ? (next.id || next._id || next.studentId) : null);
                        }
                      } catch (e) {
                        console.error(e);
                        message.error('批量通过失败');
                      }
                    }}
                  >
                    全部通过
                  </Button>
                  <Button 
                    danger 
                    icon={<CloseCircleOutlined />}
                    disabled={!selectedStudent || messages.length === 0}
                    onClick={async () => {
                      if (!selectedStudent) return;
                      try {
                        await chatAPI.bulkReview({
                          studentId: selectedStudent,
                          status: 'rejected',
                          filters: { type: filters.type, courseId: filters.courseId }
                        });
                        message.success('已全部拒绝');
                        const latestStudents = await fetchStudents();
                        const latestMsgs = await fetchMessagesByStudent(selectedStudent);
                        if (latestMsgs.length === 0) {
                          const idx = latestStudents.findIndex(s => (s.id || s._id || s.studentId) === selectedStudent);
                          const next = latestStudents[idx + 1] || latestStudents[0];
                          setSelectedStudent(next ? (next.id || next._id || next.studentId) : null);
                        }
                      } catch (e) {
                        console.error(e);
                        message.error('批量拒绝失败');
                      }
                    }}
                  >
                    全部拒绝
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const params = {};
                        if (filters.type) params.type = filters.type;
                        if (filters.courseId) params.courseId = filters.courseId;
                        if (filters.grade) params.grade = filters.grade;
                        if (filters.className) params.className = filters.className;
                        await chatAPI.exportChatCSV(params);
                      } catch (e) {
                        console.error(e);
                        message.error('导出失败');
                      }
                    }}
                  >
                    导出全部对话
                  </Button>
                </Space>
              </Col>
            </Row>
          }
          bordered={false}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <Spin size="large" />
            </div>
          ) : selectedStudent && messages.length > 0 ? (
            <List
              dataSource={messages}
              renderItem={(message) => (
                <List.Item 
                  style={{ 
                    padding: '12px 0', 
                    borderBottom: '1px solid #f0f0f0',
                    transition: 'all 0.3s ease'
                  }}
                  key={message._id}
                >
                  <div style={{ width: '100%', background: 'white', borderRadius: '8px' }}>
                    <MessageItem
                      message={message}
                      showActions={true}
                      onApprove={() => handleApprove(message._id)}
                      onReject={() => handleReject(message._id)}
                      reviewEnabled={reviewEnabled}
                    />
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty 
              description={
                <span>
                  {selectedStudent ? "该学生没有待审核消息" : "请选择左侧学生以查看对话"}
                </span>
              }
            />
          )}
          
          {selectedStudent && messages.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: '20px' }}>
              <Pagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={handlePageChange}
                showSizeChanger
                showTotal={(total) => `共 ${total} 条消息`}
              />
            </div>
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default PendingReviews;