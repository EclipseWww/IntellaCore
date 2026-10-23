import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Card,
  Typography,
  Tag
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { typingAPI } from '../../services/api';

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

const TypingTextManagement = () => {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  const [selectedText, setSelectedText] = useState(null);

  // 加载文本列表
  const loadTexts = async () => {
    try {
      setLoading(true);
      const data = await typingAPI.getTexts();
      setTexts(data);
    } catch (error) {
      message.error('加载文本列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTexts();
  }, []);

  // 处理文本格式化
  const formatText = (text) => {
    if (!text) return '';
    return text
      .replace(/[\r\n]+/g, ' ')  // 替换换行为空格
      .replace(/\s+/g, ' ')      // 多个空格合并为一个
      .trim();                   // 去掉首尾空格
  };

  // 处理表单提交
  const handleSubmit = async (values) => {
    try {
      // 格式化文本内容
      const formattedValues = {
        ...values,
        content: formatText(values.content),
        category: values.category || 'article'  // 设置默认类型
      };

      if (editingId) {
        await typingAPI.updateText(editingId, formattedValues);
        message.success('文本更新成功');
      } else {
        await typingAPI.createText(formattedValues);
        message.success('文本创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingId(null);
      loadTexts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 编辑文本
  const handleEdit = (record) => {
    setEditingId(record._id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 删除文本
  const handleDelete = async (id) => {
    try {
      await typingAPI.deleteText(id);
      message.success('文本删除成功');
      if (selectedText?._id === id) {
        setSelectedText(null);
      }
      loadTexts();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const categoryMap = {
    'programming': '编程代码',
    'article': '文章',
    'other': '其他'
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {texts.map((text, index) => (
            <Tag
              key={text._id}
              color={selectedText?._id === text._id ? 'blue' : 'default'}
              style={{ 
                padding: '4px 12px', 
                cursor: 'pointer',
                fontSize: '16px'
              }}
              onClick={() => setSelectedText(text)}
            >
              {index + 1}
            </Tag>
          ))}
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null);
            form.resetFields();
            form.setFieldsValue({ category: 'article' });
            setModalVisible(true);
          }}
        >
          添加文本
        </Button>
      </div>

      <Card>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16 
        }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>文本内容</Title>
            {selectedText && (
              <Tag color="blue">{categoryMap[selectedText.category]}</Tag>
            )}
          </Space>
          {selectedText && (
            <Space>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => handleEdit(selectedText)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定要删除这个文本吗？"
                onConfirm={() => handleDelete(selectedText._id)}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          )}
        </div>
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            padding: '16px',
            minHeight: '400px',
            maxHeight: '600px',
            overflowY: 'auto',
            backgroundColor: '#fafafa',
            fontSize: '16px',
            lineHeight: '1.8'
          }}
        >
          {selectedText ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{selectedText.content}</div>
          ) : (
            <div style={{ color: '#999', textAlign: 'center', marginTop: '180px' }}>
              请选择要查看的文本
            </div>
          )}
        </div>
      </Card>

      <Modal
        title={editingId ? '编辑文本' : '添加文本'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingId(null);
        }}
        onOk={() => form.submit()}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ category: 'article' }}
        >
          <Form.Item
            name="content"
            label="文本内容"
            rules={[{ required: true, message: '请输入文本内容' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="请输入练习文本内容"
              showCount
              maxLength={1000}
              onChange={(e) => {
                const formatted = formatText(e.target.value);
                form.setFieldsValue({ content: formatted });
              }}
            />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择文本分类">
              <Option value="programming">编程代码</Option>
              <Option value="article">文章</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TypingTextManagement; 