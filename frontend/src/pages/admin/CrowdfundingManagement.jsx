import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Tag, Space, Popconfirm, message, Card, 
  Form, Input, Select, DatePicker, Modal, InputNumber, Spin, 
  Typography, Progress, Tooltip 
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  PlayCircleOutlined, CheckCircleOutlined, EyeOutlined 
} from '@ant-design/icons';
import { 
  getCrowdfundingList, 
  createCrowdfunding, 
  activateCrowdfunding, 
  completeCrowdfunding 
} from '../../services/crowdfundingService';
import usePageTitle from '../../hooks/usePageTitle';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CrowdfundingManagement = () => {
  usePageTitle('众筹活动管理');
  
  const [crowdfundings, setCrowdfundings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  
  // 获取众筹活动列表
  const fetchCrowdfundings = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);
      const response = await getCrowdfundingList({
        page,
        limit: pageSize,
        // 管理员面板获取所有状态的众筹活动
      });
      
      setCrowdfundings(response.crowdfundings);
      setPagination({
        ...pagination,
        current: response.pagination.page,
        total: response.pagination.total,
        pageSize: pageSize
      });
    } catch (error) {
      console.error('获取众筹列表失败:', error);
      message.error('获取众筹列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchCrowdfundings();
  }, []);
  
  // 表格分页变化处理
  const handleTableChange = (pagination) => {
    fetchCrowdfundings(pagination.current, pagination.pageSize);
  };
  
  // 打开创建/编辑模态框
  const showModal = (record = null) => {
    setSelectedRecord(record);
    setModalVisible(true);
    
    if (record) {
      // 编辑模式，填充表单
      form.setFieldsValue({
        ...record,
        startDate: record.startDate ? dayjs(record.startDate) : null,
        endDate: record.endDate ? dayjs(record.endDate) : null,
        'reward.type': record.reward?.type || 'network_time',
        'reward.duration': record.reward?.duration || 0,
        'reward.description': record.reward?.description || ''
      });
    } else {
      // 创建模式，重置表单
      form.resetFields();
      form.setFieldsValue({
        type: 'network_time',
        'reward.type': 'network_time',
        status: 'pending',
        startDate: dayjs()
      });
    }
  };
  
  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      
      // 转换日期
      if (values.startDate) {
        values.startDate = values.startDate.toISOString();
      }
      if (values.endDate) {
        values.endDate = values.endDate.toISOString();
      }
      
      // 处理奖励对象
      if (values['reward.type']) {
        values.reward = {
          type: values['reward.type'],
          duration: values['reward.duration'] || 0,
          description: values['reward.description'] || ''
        };
        
        // 删除原始字段
        delete values['reward.type'];
        delete values['reward.duration'];
        delete values['reward.description'];
      }
      
      // 创建众筹活动
      await createCrowdfunding(values);
      
      message.success(selectedRecord ? '更新众筹活动成功' : '创建众筹活动成功');
      setModalVisible(false);
      fetchCrowdfundings(); // 刷新列表
    } catch (error) {
      console.error('提交众筹活动失败:', error);
      message.error('提交失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfirmLoading(false);
    }
  };
  
  // 激活众筹活动
  const handleActivate = async (id) => {
    try {
      await activateCrowdfunding(id);
      message.success('众筹活动已激活');
      fetchCrowdfundings();
    } catch (error) {
      console.error('激活众筹活动失败:', error);
      message.error('激活失败: ' + (error.response?.data?.message || error.message));
    }
  };
  
  // 完成众筹活动
  const handleComplete = async (id) => {
    try {
      await completeCrowdfunding(id);
      message.success('众筹活动已完成并发放奖励');
      fetchCrowdfundings();
    } catch (error) {
      console.error('完成众筹活动失败:', error);
      message.error('完成失败: ' + (error.response?.data?.message || error.message));
    }
  };
  
  // 查看详情
  const handleViewDetail = (record) => {
    setDetailRecord(record);
    setDetailVisible(true);
  };
  
  // 状态标签颜色映射
  const statusColorMap = {
    pending: 'default',
    active: 'green',
    completed: 'blue',
    expired: 'red'
  };
  
  // 状态中文名称映射
  const statusNameMap = {
    pending: '即将开始',
    active: '进行中',
    completed: '已完成',
    expired: '已过期'
  };
  
  // 表格列配置
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeMap = {
          network_time: '上网时间',
          game: '游戏',
          other: '其他'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '目标积分',
      dataIndex: 'targetPoints',
      key: 'targetPoints',
      sorter: (a, b) => a.targetPoints - b.targetPoints
    },
    {
      title: '进度',
      key: 'progress',
      render: (_, record) => (
        <Progress 
          percent={Math.round((record.currentPoints / record.targetPoints) * 100)} 
          size="small" 
          style={{ width: 120 }}
        />
      )
    },
    {
      title: '当前积分',
      dataIndex: 'currentPoints',
      key: 'currentPoints',
      sorter: (a, b) => a.currentPoints - b.currentPoints
    },
    {
      title: '参与人数',
      dataIndex: 'contributionsCount',
      key: 'contributionsCount',
      sorter: (a, b) => (a.contributionsCount || 0) - (b.contributionsCount || 0)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColorMap[status]}>
          {statusNameMap[status]}
        </Tag>
      ),
      filters: [
        { text: '即将开始', value: 'pending' },
        { text: '进行中', value: 'active' },
        { text: '已完成', value: 'completed' },
        { text: '已过期', value: 'expired' }
      ],
      onFilter: (value, record) => record.status === value
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.startDate) - new Date(b.startDate)
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.endDate) - new Date(b.endDate)
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewDetail(record)} 
            />
          </Tooltip>
          
          {record.status === 'pending' && (
            <Tooltip title="激活">
              <Button 
                type="text" 
                icon={<PlayCircleOutlined />} 
                onClick={() => handleActivate(record._id)}
              />
            </Tooltip>
          )}
          
          {record.status === 'completed' && (
            <Tooltip title="发放奖励">
              <Button 
                type="text" 
                icon={<CheckCircleOutlined />} 
                onClick={() => handleComplete(record._id)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];
  
  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>众筹活动管理</Title>
      
      <Card>
        <div style={{ marginBottom: '20px', textAlign: 'right' }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => showModal()}
          >
            新建众筹活动
          </Button>
        </div>
        
        <Table 
          dataSource={crowdfundings} 
          columns={columns} 
          rowKey="_id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
        />
      </Card>
      
      {/* 创建/编辑众筹活动表单 */}
      <Modal
        title={selectedRecord ? '编辑众筹活动' : '创建众筹活动'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={confirmLoading}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="title" 
            label="活动标题" 
            rules={[{ required: true, message: '请输入活动标题' }]}
          >
            <Input placeholder="请输入活动标题" />
          </Form.Item>
          
          <Form.Item 
            name="description" 
            label="活动描述"
          >
            <TextArea rows={4} placeholder="请输入活动描述" />
          </Form.Item>
          
          <Form.Item 
            name="targetPoints" 
            label="目标积分"
            rules={[{ required: true, message: '请输入目标积分' }]}
          >
            <InputNumber 
              min={100} 
              placeholder="请输入目标积分" 
              style={{ width: '100%' }} 
            />
          </Form.Item>
          
          <Form.Item 
            name="type" 
            label="活动类型"
            rules={[{ required: true, message: '请选择活动类型' }]}
          >
            <Select placeholder="请选择活动类型">
              <Option value="network_time">上网时间</Option>
              <Option value="game">游戏</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            name="image" 
            label="活动图片URL"
          >
            <Input placeholder="请输入活动图片URL" />
          </Form.Item>
          
          <div style={{ border: '1px solid #f0f0f0', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
            <Title level={5}>奖励设置</Title>
            
            <Form.Item 
              name="reward.type" 
              label="奖励类型"
              rules={[{ required: true, message: '请选择奖励类型' }]}
            >
              <Select placeholder="请选择奖励类型">
                <Option value="network_time">上网时间</Option>
                <Option value="game">游戏</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>
            
            <Form.Item 
              name="reward.duration" 
              label="奖励时长(分钟)"
              tooltip="仅适用于上网时间和游戏类型的奖励"
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item 
              name="reward.description" 
              label="奖励描述"
            >
              <Input placeholder="请输入奖励描述" />
            </Form.Item>
          </div>
          
          <Form.Item 
            name="startDate" 
            label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item 
            name="endDate" 
            label="结束日期"
            rules={[{ required: true, message: '请选择结束日期' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 众筹活动详情模态框 */}
      <Modal
        title="众筹活动详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="back" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {detailRecord ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              {detailRecord.image && (
                <img 
                  src={detailRecord.image} 
                  alt={detailRecord.title} 
                  style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'cover' }} 
                />
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <Title level={3}>{detailRecord.title}</Title>
              <Tag color={statusColorMap[detailRecord.status]}>
                {statusNameMap[detailRecord.status]}
              </Tag>
            </div>
            
            <p>{detailRecord.description}</p>
            
            <div style={{ marginTop: '20px' }}>
              <Title level={5}>众筹进度</Title>
              <Progress 
                percent={Math.round((detailRecord.currentPoints / detailRecord.targetPoints) * 100)}
                format={() => `${detailRecord.currentPoints}/${detailRecord.targetPoints}`}
              />
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap' }}>
              <div style={{ marginRight: '40px', marginBottom: '15px' }}>
                <Text type="secondary">目标积分</Text>
                <div>{detailRecord.targetPoints}</div>
              </div>
              
              <div style={{ marginRight: '40px', marginBottom: '15px' }}>
                <Text type="secondary">当前积分</Text>
                <div>{detailRecord.currentPoints}</div>
              </div>
              
              <div style={{ marginRight: '40px', marginBottom: '15px' }}>
                <Text type="secondary">参与人数</Text>
                <div>{detailRecord.participants?.length || 0}</div>
              </div>
              
              <div style={{ marginRight: '40px', marginBottom: '15px' }}>
                <Text type="secondary">贡献次数</Text>
                <div>{detailRecord.contributionsCount || 0}</div>
              </div>
              
              <div style={{ marginRight: '40px', marginBottom: '15px' }}>
                <Text type="secondary">开始日期</Text>
                <div>{new Date(detailRecord.startDate).toLocaleString()}</div>
              </div>
              
              <div style={{ marginRight: '40px', marginBottom: '15px' }}>
                <Text type="secondary">结束日期</Text>
                <div>{new Date(detailRecord.endDate).toLocaleString()}</div>
              </div>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <Title level={5}>奖励信息</Title>
              {detailRecord.reward ? (
                <ul>
                  <li>
                    <Text strong>类型：</Text> 
                    {detailRecord.reward.type === 'network_time' ? '上网时间' : 
                     detailRecord.reward.type === 'game' ? '游戏' : '其他'}
                  </li>
                  {detailRecord.reward.duration && (
                    <li>
                      <Text strong>时长：</Text> {detailRecord.reward.duration} 分钟
                    </li>
                  )}
                  {detailRecord.reward.description && (
                    <li>
                      <Text strong>描述：</Text> {detailRecord.reward.description}
                    </li>
                  )}
                </ul>
              ) : (
                <Text type="secondary">未设置奖励</Text>
              )}
            </div>
            
            {detailRecord.status === 'pending' && (
              <div style={{ marginTop: '20px' }}>
                <Button 
                  type="primary" 
                  onClick={() => {
                    handleActivate(detailRecord._id);
                    setDetailVisible(false);
                  }}
                >
                  激活众筹活动
                </Button>
              </div>
            )}
            
            {detailRecord.status === 'completed' && (
              <div style={{ marginTop: '20px' }}>
                <Button 
                  type="primary" 
                  onClick={() => {
                    handleComplete(detailRecord._id);
                    setDetailVisible(false);
                  }}
                >
                  发放奖励
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Spin />
        )}
      </Modal>
    </div>
  );
};

export default CrowdfundingManagement;