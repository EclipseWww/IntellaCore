import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Row,
  Col,
  Collapse,
  Typography,
  Form,
  Input,
  Select,
  Switch,
  Checkbox,
  Divider,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { courseManagementAPI } from '../../services/api';
import { classAPI } from '../../services/api';
import UnitList from './UnitList';

const { Panel } = Collapse;
const { Title } = Typography;
const { TextArea } = Input;

const CourseList = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [currentCourseId, setCurrentCourseId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [courseForm] = Form.useForm();
  const [unitForm] = Form.useForm();
  const unitListRefs = useRef({});
  const navigate = useNavigate();
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchTeacherClasses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await courseManagementAPI.getTeacherCourses();
      if (response.success) {
        // 确保每个课程对象都有必要的字段
        const processedCourses = response.data.map(course => ({
          ...course,
          lessons: course.lessons || [],
          type: course.type || 'other',
          level: course.level || '入门',
          isPublic: course.isPublic || false,
          accessibleClasses: course.accessibleClasses || []
        }));
        setCourses(processedCourses);
      } else {
        message.error('获取课程列表失败');
      }
    } catch (error) {
      console.error('获取课程列表失败:', error);
      message.error('获取课程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherClasses = async () => {
    try {
      setClassesLoading(true);
      const response = await classAPI.getTeacherClasses();
      if (response.success) {
        // 按年级排序，然后按班级名称排序
        const sortedClasses = response.data.sort((a, b) => {
          if (a.grade !== b.grade) {
            return a.grade - b.grade;
          }
          return a.name - b.name;
        });
        setTeacherClasses(sortedClasses);
      } else {
        message.error('获取班级列表失败');
      }
    } catch (error) {
      console.error('获取班级列表失败:', error);
      message.error('获取班级列表失败');
    } finally {
      setClassesLoading(false);
    }
  };

  const handleCreateCourse = () => {
    setEditingCourse(null);
    courseForm.resetFields();
    setCourseModalVisible(true);
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course);
    courseForm.setFieldsValue({
      title: course.title,
      type: course.type,
      description: course.description,
      isPublic: course.isPublic || false,
      accessibleClasses: course.accessibleClasses || []
    });
    setCourseModalVisible(true);
  };

  const handleCourseSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await courseForm.validateFields();

      // 打印表单值以进行调试
      console.log('表单提交的值:', values);

      if (editingCourse) {
        await courseManagementAPI.updateCourse(editingCourse._id, values);
        message.success('课程更新成功');
      } else {
        await courseManagementAPI.createCourse(values);
        message.success('课程创建成功');
      }

      setCourseModalVisible(false);
      setEditingCourse(null);
      courseForm.resetFields();
      fetchCourses();
    } catch (error) {
      if (error.errorFields) {
        return; // 表单验证错误，不处理
      }
      console.error('保存课程失败:', error);
      message.error('保存课程失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (courseId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此课程吗？如果课程下还有单元，需要先删除所有单元。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await courseManagementAPI.deleteCourse(courseId);
          message.success('课程删除成功');
          fetchCourses();
        } catch (error) {
          const errorMsg = error.response?.data?.message || '删除课程失败';
          message.error(errorMsg);
        }
      }
    });
  };

  const handleCreateUnit = (courseId) => {
    setCurrentCourseId(courseId);
    setExpandedCourseId(courseId);
    unitForm.resetFields();
    setUnitModalVisible(true);
  };

  const handleUnitSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await unitForm.validateFields();

      // 获取当前课程的单元数量，用于设置新单元的顺序
      const response = await courseManagementAPI.getUnits(currentCourseId);
      const currentUnits = response.data || [];
      const newOrder = currentUnits.length + 1;

      const unitData = {
        ...values,
        order: newOrder
      };

      console.log('Creating unit with data:', unitData);

      const result = await courseManagementAPI.createUnit(currentCourseId, unitData);

      if (result && result.success) {
        message.success('单元创建成功');
        setUnitModalVisible(false);
        unitForm.resetFields();

        // 刷新单元列表
        if (unitListRefs.current[currentCourseId]) {
          unitListRefs.current[currentCourseId].refresh();
        }
      } else {
        message.error(result?.message || '创建单元失败');
      }
    } catch (error) {
      console.error('创建单元失败:', error);
      if (error.errorFields) {
        const fieldErrors = error.errorFields.map(field => field.errors.join(', ')).join('; ');
        message.error(`表单验证失败: ${fieldErrors}`);
        return;
      }
      message.error(error.response?.data?.message || '创建单元失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLesson = (courseId, unitId) => {
    // 处理创建课时的逻辑
  };

  const handleLessonClick = (courseId, unitId, lessonId, e) => {
    // 防止点击按钮时触发导航
    if (e.target.tagName.toLowerCase() === 'button' ||
      e.target.closest('button') ||
      e.target.tagName.toLowerCase() === 'svg' ||
      e.target.tagName.toLowerCase() === 'path') {
      return;
    }
    navigate(`/teacher/courses/${courseId}/units/${unitId}/lessons/${lessonId}/edit`);
  };

  const handleQuickEditLesson = (lesson) => {
    // TODO: 实现快速编辑功能，可以弹出一个简单的modal来编辑基本属性
    message.info('快速编辑功能开发中');
  };

  const handleDeleteLesson = async (courseId, unitId, lessonId) => {
    try {
      await courseManagementAPI.deleteLesson(courseId, unitId, lessonId);
      message.success('课时删除成功');
      // 刷新单元列表
      if (unitListRefs.current[courseId]) {
        unitListRefs.current[courseId].refresh();
      }
    } catch (error) {
      console.error('删除课时失败:', error);
      message.error('删除课时失败');
    }
  };

  const renderCourseType = (type) => {
    const types = {
      // 新类型
      'programming': '编程',
      'design': '设计',
      'network': '网络',
      'ai': '人工智能',
      'other': '其他',
      // 旧类型兼容显示
      'software': '编程',  // 映射到编程
      'language': '其他',  // 映射到其他
      'business': '其他'   // 映射到其他
    };
    return <Tag color="blue">{types[type] || type}</Tag>;
  };

  const renderDifficulty = (level) => {
    const colors = {
      '入门': 'green',
      '初级': 'blue',
      '中级': 'orange',
      '高级': 'red'
    };
    return <Tag color={colors[level]}>{level}</Tag>;
  };

  const expandIcon = ({ expanded }) => {
    return expanded ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
  };

  const renderLessonList = (lessons) => {
    return lessons.map((lesson) => (
      <div
        key={lesson._id}
        style={{
          padding: '8px 16px',
          marginBottom: '8px',
          cursor: 'pointer',
          border: '1px solid #f0f0f0',
          borderRadius: '4px',
          backgroundColor: '#fff',
          transition: 'all 0.3s'
        }}
        onClick={(e) => handleLessonClick(currentCourseId, lesson.unitId, lesson._id, e)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>{lesson.title}</span>
          <Space>
            <Tag color="blue">{`${lesson.activities?.length || 0} 个活动`}</Tag>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleQuickEditLesson(lesson)}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                Modal.confirm({
                  title: '确认删除',
                  content: `确定要删除课时"${lesson.title}"吗？`,
                  okText: '确认',
                  cancelText: '取消',
                  onOk: () => handleDeleteLesson(currentCourseId, lesson.unitId, lesson._id)
                });
              }}
            />
          </Space>
        </div>
      </div>
    ));
  };

  const columns = [
    {
      title: '课程名称',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => setExpandedCourseId(expandedCourseId === record._id ? null : record._id)}>
          {text}
        </a>
      )
    },
    {
      title: '课程类型',
      dataIndex: 'type',
      key: 'type',
      render: renderCourseType
    },
    {
      title: '访问控制',
      key: 'access',
      render: (_, record) => {
        if (record.isPublic) {
          return <Tag color="green">公开</Tag>;
        } else if (record.accessibleClasses && record.accessibleClasses.length > 0) {
          // 获取可访问班级的名称
          const accessibleClassNames = record.accessibleClasses.map(cls => {
            // cls 可能是对象或者 ID 字符串
            if (typeof cls === 'object' && cls !== null) {
              return `${cls.grade}年级${cls.name}班`;
            }
            // 如果是 ID 字符串，从 teacherClasses 中查找
            const foundClass = teacherClasses.find(tc => tc._id === cls);
            return foundClass ? `${foundClass.grade}年级${foundClass.name}班` : cls;
          });

          const displayCount = 2; // 最多显示2个班级
          const displayNames = accessibleClassNames.slice(0, displayCount).join('、');
          const remainingCount = accessibleClassNames.length - displayCount;

          return (
            <Tooltip
              title={
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>可访问班级：</div>
                  {accessibleClassNames.map((name, idx) => (
                    <div key={idx}>• {name}</div>
                  ))}
                </div>
              }
            >
              <Tag color="orange" style={{ cursor: 'pointer' }}>
                {remainingCount > 0
                  ? `${displayNames} 等${accessibleClassNames.length}个班级`
                  : displayNames
                }
              </Tag>
            </Tooltip>
          );
        } else {
          return <Tag color="default">未发布</Tag>;
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleEditCourse(record);
            }}
          >
            编辑
          </Button>
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleCreateUnit(record._id);
            }}
          >
            添加单元
          </Button>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(record._id);
            }}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="teacher-course-list" style={{ padding: 16 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>我的课程</h2>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateCourse}
            >
              创建新课程
            </Button>
          </Col>
        </Row>
        <Table
          columns={columns}
          dataSource={courses}
          rowKey="_id"
          loading={loading}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 20px' }}>
                {/* 课程描述部分 */}
                {record.description && (
                  <div style={{
                    marginBottom: '16px',
                    fontSize: '14px',
                    color: '#8c8c8c',
                    fontStyle: 'italic'
                  }}>
                    {record.description}
                  </div>
                )}

                {/* 单元列表部分 */}
                <UnitList
                  ref={ref => unitListRefs.current[record._id] = ref}
                  courseId={record._id}
                  onCreateLesson={(unitId) => handleCreateLesson(record._id, unitId)}
                  renderLessonList={renderLessonList}
                />
              </div>
            ),
            expandIcon: expandIcon,
            expandedRowKeys: expandedCourseId ? [expandedCourseId] : [],
            onExpand: (expanded, record) => {
              setExpandedCourseId(expanded ? record._id : null);
            }
          }}
        />

      <Modal
        title={editingCourse ? "编辑课程" : "创建新课程"}
        open={courseModalVisible}
        onCancel={() => {
          setCourseModalVisible(false);
          setEditingCourse(null);
          courseForm.resetFields();
        }}
        onOk={handleCourseSubmit}
        confirmLoading={submitting}
        width={500}
      >
        <Form
          form={courseForm}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="课程名称"
            rules={[{ required: true, message: '请输入课程名称' }]}
          >
            <Input placeholder="请输入课程名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="课程类型"
            rules={[{ required: true, message: '请选择课程类型' }]}
          >
            <Select placeholder="请选择课程类型">
              <Select.Option value="programming">编程</Select.Option>
              <Select.Option value="design">设计</Select.Option>
              <Select.Option value="network">网络</Select.Option>
              <Select.Option value="ai">人工智能</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="课程描述"
          >
            <Input.TextArea rows={4} placeholder="请输入课程描述" />
          </Form.Item>

          <Form.Item
            name="isPublic"
            label="公开课程"
            valuePropName="checked"
            tooltip="公开课程将对所有学生可见，否则只有选定班级的学生可见"
          >
            <Switch
              checkedChildren="公开"
              unCheckedChildren="限制"
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.isPublic !== currentValues.isPublic}
          >
            {({ getFieldValue }) => {
              const isPublic = getFieldValue('isPublic');
              return !isPublic ? (
                <Form.Item
                  name="accessibleClasses"
                  label="可访问班级"
                >
                  <Checkbox.Group style={{ width: '100%' }}>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {classesLoading ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>加载班级列表中...</div>
                      ) : (
                        <>
                          {/* 按年级分组显示班级 */}
                          {Array.from(new Set(teacherClasses.map(cls => cls.grade))).sort().map(grade => (
                            <div key={grade} style={{ marginBottom: '16px' }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                {grade}年级
                              </div>
                              <Row gutter={[16, 8]}>
                                {teacherClasses
                                  .filter(cls => cls.grade === grade)
                                  .sort((a, b) => a.name - b.name)
                                  .map(cls => (
                                    <Col span={8} key={cls._id}>
                                      <Checkbox value={cls._id}>
                                        {cls.name}班
                                      </Checkbox>
                                    </Col>
                                  ))}
                              </Row>
                              <Divider style={{ margin: '12px 0' }} />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </Checkbox.Group>
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建新单元"
        open={unitModalVisible}
        onCancel={() => {
          setUnitModalVisible(false);
          unitForm.resetFields();
        }}
        onOk={handleUnitSubmit}
        confirmLoading={submitting}
        width={500}
      >
        <Form
          form={unitForm}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="单元标题"
            rules={[{ required: true, message: '请输入单元标题' }]}
          >
            <Input placeholder="请输入单元标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="单元描述"
          >
            <Input.TextArea rows={4} placeholder="请输入单元描述（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CourseList;
