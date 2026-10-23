import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { UserAddOutlined, DeleteOutlined } from '@ant-design/icons';
import { classAPI } from '../../services/api';
import { useParams } from 'react-router-dom';

const StudentManagement = () => {
  const { classId } = useParams();
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 获取班级详情
  const fetchClassDetails = async () => {
    try {
      setLoading(true);
      const response = await classAPI.getClassDetails(classId);
      setClassInfo(response.data);
    } catch (error) {
      message.error('获取班级信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (classId) {
      fetchClassDetails();
    }
  }, [classId]);

  // 处理添加学生
  const handleAddStudent = async (values) => {
    try {
      await classAPI.addStudentToClass(classId, values.studentId);
      message.success('学生添加成功');
      setModalVisible(false);
      form.resetFields();
      fetchClassDetails();
    } catch (error) {
      message.error(error.response?.data?.message || '添加学生失败');
    }
  };

  // 处理移除学生
  const handleRemoveStudent = async (studentId) => {
    try {
      await classAPI.removeStudentFromClass(classId, studentId);
      message.success('学生删除成功');
      fetchClassDetails();
    } catch (error) {
      message.error('删除学生失败');
    }
  };

  const columns = [
    {
      title: '学号',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender) => gender === 'male' ? '男' : '女',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确定要删除该学生吗？此操作将永久删除该学生的所有数据且不可恢复"
            onConfirm={() => handleRemoveStudent(record._id)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除学生
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={`${classInfo?.grade} ${classInfo?.name} - 学生管理`}
        extra={
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            onClick={() => setModalVisible(true)}
          >
            添加学生
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={classInfo?.students || []}
          rowKey="_id"
          loading={loading}
        />
      </Card>

      <Modal
        title="添加学生"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          onFinish={handleAddStudent}
          layout="vertical"
        >
          <Form.Item
            name="studentId"
            label="学号"
            rules={[
              { required: true, message: '请输入学生学号' },
              { pattern: /^\d+$/, message: '学号只能包含数字' }
            ]}
          >
            <Input placeholder="请输入学生学号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentManagement; 