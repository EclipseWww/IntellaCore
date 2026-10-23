import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Space,
  Modal,
  message,
  Card,
  Row,
  Col,
  Form,
  Input,
  List,
  Popconfirm,
  Typography,
  Collapse,
  Tabs,
  Spin,
  Empty,
  Dropdown,
  Menu,
  Upload,
  Progress
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MenuOutlined,
  ReadOutlined,
  HolderOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ImportOutlined
} from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { courseManagementAPI, lessonAPI } from '../../services/api';

const { TextArea } = Input;
const { Panel } = Collapse;
const { TabPane } = Tabs;

// 课时编辑弹出框组件
const LessonEditModal = ({ visible, onCancel, onSubmit, initialValues, loading }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && initialValues) {
      form.setFieldsValue(initialValues);
    } else {
      form.resetFields();
    }
  }, [visible, initialValues]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      onSubmit(values);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Modal
      title={initialValues ? "编辑课时" : "创建课时"}
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
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
          <TextArea rows={4} placeholder="请输入课时描述（选填）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// 可排序的课时项组件
const SortableLesson = ({ lesson, onEdit, onDelete, courseId, unitId, onStatusChange }) => {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lesson._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    padding: '8px 16px',
    background: '#fafafa',
    borderRadius: '4px',
    marginBottom: '8px',
    boxShadow: isDragging ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
    border: isDragging ? '1px dashed #1890ff' : '1px solid transparent'
  };

  // 根据课时状态获取对应的图标和颜色
  const getStatusIcon = () => {
    switch (lesson.status) {
      case 'published':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'archived':
        return <StopOutlined style={{ color: '#faad14' }} />;
      case 'draft':
      default:
        return <EditOutlined style={{ color: '#1890ff' }} />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (lesson.status) {
      case 'published':
        return '已发布';
      case 'archived':
        return '已归档';
      case 'draft':
      default:
        return '草稿';
    }
  };

  // 状态切换菜单项
  const statusMenuItems = [
    {
      key: 'draft',
      label: '草稿',
      icon: <EditOutlined />,
      disabled: lesson.status === 'draft'
    },
    {
      key: 'published',
      label: '发布',
      icon: <CheckCircleOutlined />,
      disabled: lesson.status === 'published'
    },
    {
      key: 'archived',
      label: '归档',
      icon: <StopOutlined />,
      disabled: lesson.status === 'archived'
    }
  ];

  return (
    <div ref={setNodeRef} style={style}>
      <List.Item
        style={{
          padding: 0,
          background: 'transparent',
          borderRadius: '4px',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        actions={[
          <Dropdown
            key="status"
            menu={{
              items: statusMenuItems,
              onClick: ({ key }) => onStatusChange(lesson._id, key)
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              icon={getStatusIcon()}
              style={{ display: 'flex', alignItems: 'center', height: '32px' }}
            >
              {getStatusText()}
            </Button>
          </Dropdown>,
          <Button
            key="edit"
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(lesson);
            }}
            style={{ display: 'flex', alignItems: 'center', height: '32px' }}
          >
            编辑
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除这个课时吗？"
            onConfirm={(e) => {
              e.stopPropagation();
              onDelete(lesson._id);
            }}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              style={{ display: 'flex', alignItems: 'center', height: '32px' }}
            >
              删除
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          avatar={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              paddingTop: '2px'
            }}>
              <div
                {...attributes}
                {...listeners}
                style={{
                  cursor: 'move',
                  marginRight: '8px',
                  color: '#999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <MenuOutlined style={{ fontSize: '16px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ReadOutlined
                  style={{
                    fontSize: '16px',
                    color: '#1890ff',
                    marginRight: '8px'
                  }}
                />
              </div>
            </div>
          }
          title={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '22px',
              marginBottom: lesson.description ? '4px' : '0'
            }}>
              <a
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/teacher/course/${courseId}/unit/${unitId}/lesson/${lesson._id}/edit`);
                }}
                style={{ fontSize: '14px', fontWeight: '500' }}
              >
                {lesson.title}
              </a>
            </div>
          }
          description={
            lesson.description && (
              <div style={{ fontSize: '13px', color: '#666', marginTop: '0' }}>
                {lesson.description}
              </div>
            )
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '0'
          }}
        />
      </List.Item>
    </div>
  );
};

// 可排序的单元卡片组件
const SortableUnit = ({ unit, onEdit, onDelete, onCreateLesson, courseId }) => {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: unit._id });

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lessonModalVisible, setLessonModalVisible] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 添加传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchLessons();
  }, [unit._id]);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const response = await courseManagementAPI.getLessons(courseId, unit._id);
      if (response.success) {
        // 按 order 字段排序
        const sortedLessons = response.data ? response.data.sort((a, b) => a.order - b.order) : [];
        setLessons(sortedLessons);
      } else {
        message.error('获取课时列表失败');
      }
    } catch (error) {
      console.error('获取课时列表失败:', error);
      message.error('获取课时列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = () => {
    setEditingLesson(null);
    setLessonModalVisible(true);
  };

  const handleEditLesson = (lesson) => {
    setEditingLesson(lesson);
    setLessonModalVisible(true);
  };

  const handleDeleteLesson = async (lessonId) => {
    try {
      await courseManagementAPI.deleteLesson(courseId, unit._id, lessonId);
      message.success('课时删除成功');
      fetchLessons();
    } catch (error) {
      console.error('删除课时失败:', error);
      const errorMsg = error.response?.data?.message || '删除课时失败';
      message.error(errorMsg);
    }
  };

  const handleLessonSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (editingLesson) {
        await courseManagementAPI.updateLesson(courseId, unit._id, editingLesson._id, values);
        message.success('课时更新成功');
      } else {
        await courseManagementAPI.createLesson(courseId, unit._id, values);
        message.success('课时创建成功');
      }
      setLessonModalVisible(false);
      setEditingLesson(null);
      fetchLessons();
    } catch (error) {
      console.error('保存课时失败:', error);
      message.error('保存课时失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLessonStatusChange = async (lessonId, status) => {
    try {
      await courseManagementAPI.updateLessonStatus(courseId, unit._id, lessonId, status);
      message.success('课时状态更新成功');
      fetchLessons();
    } catch (error) {
      console.error('更新课时状态失败:', error);
      message.error('更新课时状态失败');
    }
  };

  // 处理课时拖拽结束事件
  const handleLessonDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = lessons.findIndex((lesson) => lesson._id === active.id);
      const newIndex = lessons.findIndex((lesson) => lesson._id === over.id);

      const newLessons = arrayMove(lessons, oldIndex, newIndex);
      setLessons(newLessons);

      try {
        const updatedLessons = newLessons.map((lesson, index) => ({
          lessonId: lesson._id,
          order: index + 1
        }));

        await courseManagementAPI.updateLessonsOrder(courseId, unit._id, updatedLessons);
        message.success('课时顺序更新成功');
      } catch (error) {
        console.error('更新课时顺序失败:', error);
        message.error('更新课时顺序失败');
        fetchLessons();
      }
    }
  };

  const handleImportLesson = () => {
    setImportModalVisible(true);
  };

  const handleFileUpload = async (file) => {
    try {
      setImportLoading(true);
      const formData = new FormData();
      formData.append('lessonFile', file);

      const result = await lessonAPI.importLesson(unit._id, formData, (progress) => {
        setUploadProgress(progress);
      });

      setImportModalVisible(false);
      fetchLessons(); // 刷新课时列表
      if (result.missingMedia?.length) {
        const totalMB = (result.missingMedia.reduce((sum, item) => sum + item.size, 0) / 1024 / 1024).toFixed(1);
        Modal.info({ title: '课时内容已导入，等待补充媒体', content: `缺少 ${result.missingMedia.length} 个媒体文件，共 ${totalMB} MB。请在此入口继续导入对应媒体包，系统会自动关联，无需修改正文。` });
      } else message.success(result.message || '导入成功');
    } catch (error) {
      console.error('导入课时失败:', error);
    } finally {
      setImportLoading(false);
      setUploadProgress(0);
    }
    return false; // 阻止默认上传行为
  };

  const style = {
    backgroundColor: '#fff',
    marginBottom: '12px',
    borderRadius: '8px',
    border: '1px solid #e6e9ed',
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.3s ease'
  };

  const dragHandleStyle = {
    cursor: 'move',
    color: '#999',
    fontSize: '16px',
    padding: '16px',
    borderRight: '1px solid #e6e9ed',
    display: 'flex',
    alignItems: 'center'
  };

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div style={style}>
        <Row wrap={false} align="stretch">
          <div style={dragHandleStyle} {...attributes} {...listeners}>
            <HolderOutlined />
          </div>

          <Col flex="auto" style={{ padding: '16px' }}>
            <Row justify="space-between" align="middle">
              <Col flex="auto">
                <div style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#333',
                  marginBottom: '4px'
                }}>
                  {unit.title}
                </div>
                {unit.description && (
                  <div style={{
                    fontSize: '14px',
                    color: '#666',
                    marginTop: '4px'
                  }}>
                    {unit.description}
                  </div>
                )}
              </Col>
              <Col style={{ marginLeft: '16px' }}>
                <Space>
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={handleCreateLesson}
                  >
                    添加课时
                  </Button>
                  <Button
                    type="text"
                    icon={<ImportOutlined />}
                    onClick={handleImportLesson}
                  >
                    导入课时
                  </Button>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(unit);
                    }}
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定要删除这个单元吗？"
                    description="如果单元下还有课时，需要先删除所有课时才能删除此单元。"
                    onConfirm={(e) => {
                      e.stopPropagation();
                      onDelete(unit._id);
                    }}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </Col>
            </Row>

            {/* 课时列表 */}
            {lessons && lessons.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleLessonDragEnd}
                >
                  <SortableContext
                    items={lessons.map((lesson) => lesson._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <List
                      size="small"
                      loading={loading}
                      dataSource={lessons}
                      locale={{
                        emptyText: '暂无课时，点击"添加课时"按钮创建'
                      }}
                      renderItem={(lesson) => (
                        <SortableLesson
                          key={lesson._id}
                          lesson={lesson}
                          onEdit={handleEditLesson}
                          onDelete={handleDeleteLesson}
                          onStatusChange={handleLessonStatusChange}
                          courseId={courseId}
                          unitId={unit._id}
                        />
                      )}
                    />
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </Col>
        </Row>
      </div>

      <LessonEditModal
        visible={lessonModalVisible}
        onCancel={() => {
          setLessonModalVisible(false);
          setEditingLesson(null);
        }}
        onSubmit={handleLessonSubmit}
        initialValues={editingLesson}
        loading={submitting}
      />

      <Modal
        title="导入课时"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
      >
        <p>请选择完整课时包、内容包或媒体包（.zip）。内容包与媒体包可分开导入，顺序不限。</p>
        <Upload.Dragger
          name="file"
          accept=".zip"
          beforeUpload={handleFileUpload}
          showUploadList={false}
          disabled={importLoading}
        >
          <p className="ant-upload-drag-icon">
            <ImportOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">最大 2 GB，分片上传；中断后重新选择同一文件可继续。上传至 99% 后正在校验和导入。</p>
        </Upload.Dragger>
        {importLoading && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8 }}>上传进度: {uploadProgress}%</div>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}
      </Modal>
    </div>
  );
};

const UnitList = forwardRef(({ courseId, onCreateLesson }, ref) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingUnit, setEditingUnit] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [form] = Form.useForm();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchUnits();
  }, [courseId, refreshKey]);

  useEffect(() => {
    if (unitModalVisible && editingUnit) {
      form.setFieldsValue(editingUnit);
    } else if (!unitModalVisible) {
      form.resetFields();
    }
  }, [unitModalVisible, editingUnit, form]);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await courseManagementAPI.getUnits(courseId);
      if (response.success) {
        // 按 order 字段排序
        const sortedUnits = response.data.sort((a, b) => a.order - b.order);
        console.log('获取到的单元数据:', sortedUnits);
        setUnits(sortedUnits);
      } else {
        message.error('获取单元列表失败');
        setUnits([]);
      }
    } catch (error) {
      console.error('获取单元列表失败:', error);
      message.error('获取单元列表失败');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = units.findIndex((unit) => unit._id === active.id);
      const newIndex = units.findIndex((unit) => unit._id === over.id);

      const newUnits = arrayMove(units, oldIndex, newIndex);
      setUnits(newUnits);

      try {
        const updatedUnits = newUnits.map((unit, index) => ({
          unitId: unit._id,
          order: index + 1
        }));

        await courseManagementAPI.updateUnitsOrder(courseId, updatedUnits);
        message.success('单元顺序更新成功');
      } catch (error) {
        console.error('更新单元顺序失败:', error);
        message.error('更新单元顺序失败');
        fetchUnits();
      }
    }
  };

  const handleEditUnit = (unit) => {
    setEditingUnit(unit);
    form.setFieldsValue({
      title: unit.title,
      description: unit.description
    });
    setUnitModalVisible(true);
  };

  const handleUnitSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();

      if (editingUnit) {
        await courseManagementAPI.updateUnit(courseId, editingUnit._id, values);
        message.success('单元更新成功');
      } else {
        // 创建新单元时，自动计算 order
        const maxOrder = units.length > 0 ? Math.max(...units.map(u => u.order)) : 0;
        const newUnitData = {
          ...values,
          order: maxOrder + 1
        };
        await courseManagementAPI.createUnit(courseId, newUnitData);
        message.success('单元创建成功');
      }

      setUnitModalVisible(false);
      setEditingUnit(null);
      form.resetFields();
      setRefreshKey(k => k + 1);
    } catch (error) {
      if (error.errorFields) {
        return; // 表单验证错误，不处理
      }
      console.error('保存单元失败:', error);
      message.error('保存单元失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unitId) => {
    try {
      await courseManagementAPI.deleteUnit(courseId, unitId);
      message.success('单元删除成功');
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error('删除单元失败:', error);
      const errorMsg = error.response?.data?.message || '删除单元失败';
      message.error(errorMsg);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: () => setRefreshKey(k => k + 1)
  }));

  return (
    <div style={{
      background: '#f7f9fc',
      borderRadius: '8px',
      padding: '20px',
      minHeight: '100px'
    }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={units.map((unit) => unit._id)}
            strategy={verticalListSortingStrategy}
          >
            {Array.isArray(units) && units.length > 0 ? (
              units.map((unit) => (
                <SortableUnit
                  key={unit._id}
                  unit={unit}
                  onEdit={handleEditUnit}
                  onDelete={handleDeleteUnit}
                  onCreateLesson={onCreateLesson}
                  courseId={courseId}
                />
              ))
            ) : (
              <Empty
                description="暂无课程单元"
                style={{
                  background: '#fff',
                  padding: '24px',
                  borderRadius: '8px'
                }}
              />
            )}
          </SortableContext>
        </DndContext>
      )}

      <Modal
        title={editingUnit ? "编辑单元" : "创建新单元"}
        open={unitModalVisible}
        onCancel={() => {
          setUnitModalVisible(false);
          setEditingUnit(null);
          form.resetFields();
        }}
        onOk={handleUnitSubmit}
        confirmLoading={submitting}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ display: unitModalVisible ? 'block' : 'none' }}
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
});

export default UnitList;
