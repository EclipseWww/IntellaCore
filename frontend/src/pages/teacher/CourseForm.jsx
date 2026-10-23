import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  message,
  Space,
  Divider,
  Row,
  Col,
  Typography,
  Switch
} from 'antd';
import { courseManagementAPI, classAPI } from '../../services/api';
import UnitList from './UnitList';
import { PlusOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

const CourseForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  useEffect(() => {
    fetchClasses();
    if (isEdit) {
      fetchCourse();
    }
  }, [id]);

  const fetchClasses = async () => {
    try {
      const response = await classAPI.getTeacherClasses();
      if (response.success) {
        setClasses(response.classes || []);
      } else {
        message.error('获取班级列表失败');
      }
    } catch (error) {
      console.error('获取班级列表失败:', error);
      message.error('获取班级列表失败');
    }
  };

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const response = await courseManagementAPI.getCourse(id);
      if (response.data && response.data.success) {
        const courseData = response.data.data.course;
        form.setFieldsValue({
          ...courseData,
          accessibleClasses: courseData.accessibleClasses?.map(c => c._id || c) || []
        });
        setIsPublic(courseData.isPublic || false);
      } else {
        message.error('获取课程信息失败');
      }
    } catch (error) {
      console.error('获取课程信息失败:', error);
      message.error('获取课程信息失败');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      if (isEdit) {
        await courseManagementAPI.updateCourse(id, values);
        message.success('课程更新成功');
      } else {
        await courseManagementAPI.createCourse(values);
        message.success('课程创建成功');
      }
      navigate('/teacher/courses');
    } catch (error) {
      message.error(isEdit ? '更新课程失败' : '创建课程失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePublicChange = (checked) => {
    setIsPublic(checked);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title={isEdit ? '编辑课程' : '创建新课程'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            type: 'programming',
            level: '入门',
            isPublic: false,
            accessibleClasses: []
          }}
        >
          <Form.Item
            name="title"
            label="课程名称"
            rules={[{ required: true, message: '请输入课程名称' }]}
          >
            <Input placeholder="请输入课程名称" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="课程类型"
                rules={[{ required: true, message: '请选择课程类型' }]}
              >
                <Select>
                  <Option value="programming">编程</Option>
                  <Option value="design">设计</Option>
                  <Option value="network">网络</Option>
                  <Option value="ai">人工智能</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="level"
                label="难度等级"
                rules={[{ required: true, message: '请选择难度等级' }]}
              >
                <Select>
                  <Option value="入门">入门</Option>
                  <Option value="初级">初级</Option>
                  <Option value="中级">中级</Option>
                  <Option value="高级">高级</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="课程描述"
            rules={[{ required: true, message: '请输入课程描述' }]}
          >
            <TextArea rows={4} placeholder="请输入课程描述" />
          </Form.Item>

          <Divider orientation="left">课程访问控制</Divider>

          <Form.Item
            name="isPublic"
            label="是否公开课程"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="公开"
              unCheckedChildren="限制访问"
              onChange={handlePublicChange}
            />
          </Form.Item>

          <Form.Item
            name="accessibleClasses"
            label="可访问班级"
            tooltip="选择可以访问此课程的班级，如果课程设为公开，则所有班级都可访问"
            rules={[
              {
                validator: (_, value) => {
                  if (!isPublic && (!value || value.length === 0)) {
                    return Promise.reject('请至少选择一个班级或将课程设为公开');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="请选择可访问班级"
              disabled={isPublic}
              style={{ width: '100%' }}
            >
              {classes.map(cls => (
                <Option key={cls._id} value={cls._id}>
                  {cls.grade}年级{cls.name}班
                </Option>
              ))}
            </Select>
          </Form.Item>

          {isEdit && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #f0f0f0',
              marginBottom: '24px',
              paddingBottom: '8px'
            }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                课程单元管理
              </Typography.Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (form.current) {
                    form.current.resetFields();
                  }
                }}
              >
                添加单元
              </Button>
            </div>
          )}

          {isEdit && (
            <UnitList courseId={id} />
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {isEdit ? '更新课程' : '创建课程'}
              </Button>
              <Button onClick={() => navigate('/teacher/courses')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default CourseForm;
