import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { classroomLayoutAPI } from '../../services/api';

const ClassroomLayoutManagement = () => {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLayout, setEditingLayout] = useState(null);
  const [form] = Form.useForm();

  // 获取机房布局列表
  const fetchLayouts = async () => {
    try {
      setLoading(true);
      const data = await classroomLayoutAPI.getLayouts();
      setLayouts(data);
    } catch (error) {
      message.error('获取机房布局列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayouts();
  }, []);

  // 处理表单提交
  const handleSubmit = async (values) => {
    try {
      if (editingLayout) {
        await classroomLayoutAPI.updateLayout(editingLayout._id, values);
        message.success('机房布局更新成功');
      } else {
        await classroomLayoutAPI.createLayout(values);
        message.success('机房布局创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingLayout(null);
      fetchLayouts();
    } catch (error) {
      message.error(editingLayout ? '更新失败' : '创建失败');
    }
  };

  // 处理编辑
  const handleEdit = (record) => {
    setEditingLayout(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 处理删除
  const handleDelete = async (id) => {
    try {
      await classroomLayoutAPI.deleteLayout(id);
      message.success('删除成功');
      fetchLayouts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '机房名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '行数',
      dataIndex: 'rows',
      key: 'rows',
    },
    {
      title: '列数',
      dataIndex: 'cols',
      key: 'cols',
    },
    {
      title: '座位数',
      dataIndex: 'seats',
      key: 'seats',
      render: (seats) => seats?.length || 0,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个机房布局吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingLayout(null);
            form.resetFields();
            setModalVisible(true);
          }}
        >
          新建机房
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={layouts}
        rowKey="_id"
        loading={loading}
      />

      <Modal
        title={editingLayout ? '编辑机房' : '新建机房'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingLayout(null);
          form.resetFields();
        }}
        onOk={form.submit}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="机房名称"
            rules={[{ required: true, message: '请输入机房名称' }]}
          >
            <Input placeholder="请输入机房名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入机房描述" />
          </Form.Item>

          <Form.Item
            name="rows"
            label="行数"
            rules={[{ required: true, message: '请输入行数' }]}
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="cols"
            label="列数"
            rules={[{ required: true, message: '请输入列数' }]}
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClassroomLayoutManagement; 