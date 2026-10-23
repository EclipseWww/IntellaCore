import React, { useState, useEffect, useRef } from 'react';
import {
  Table,
  Card,
  Space,
  Typography,
  Tag,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  Button,
  message,
  Popconfirm
} from 'antd';
import { typingAPI } from '../../services/api';
import { DownloadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const TypingScoreManagement = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({
    averageSpeed: 0,
    averageAccuracy: 0,
    totalPractices: 0,
    passRate: 0
  });
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const requestSequence = useRef(0);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 加载打字记录和统计数据
  const loadData = async (newFilters = {}, page = 1, pageSize = 10, refreshStats = true) => {
    const sequence = ++requestSequence.current;
    try {
      setLoading(true);
      const [recordsResponse, statsResponse] = await Promise.all([
        typingAPI.getTypingRecords({ ...newFilters, page, pageSize }),
        refreshStats ? typingAPI.getTypingStats(newFilters) : Promise.resolve(null)
      ]);
      
      if (sequence !== requestSequence.current) return;
      setPagination({ current: recordsResponse.page, pageSize: recordsResponse.pageSize, total: recordsResponse.total });
      
      setRecords(recordsResponse.records || []);
      const activeClasses = (recordsResponse.classes || []).filter(c => c.status !== 'archived');
      setClasses(activeClasses);
      if (statsResponse) setStats(statsResponse || {
        averageSpeed: 0,
        averageAccuracy: 0,
        totalPractices: 0,
        passRate: 0
      });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      console.error('加载数据失败:', error);
      message.error('加载数据失败，请稍后重试');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filters);
  }, []);

  // 处理筛选条件变化
  const handleFiltersChange = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    loadData(updatedFilters, 1, pagination.pageSize);
  };

  // 处理导出
  const handleExport = async () => {
    try {
      const blob = await typingAPI.exportTypingRecords(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `打字成绩-${new Date().toLocaleDateString()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    }
  };

  // 处理删除打字记录
  const handleDeleteRecord = async (recordId) => {
    try {
      setDeleteLoading(true);
      await typingAPI.deleteTypingRecord(recordId);
      message.success('删除成功');
      
      // 重新加载数据
      const page = records.length === 1 ? Math.max(1, pagination.current - 1) : pagination.current;
      loadData(filters, page, pagination.pageSize);
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请稍后重试');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      title: '学生',
      dataIndex: ['student', 'name'],
      key: 'studentName',
    },
    {
      title: '练习文本',
      dataIndex: ['text', 'content'],
      key: 'textContent',
      ellipsis: true,
      width: 200,
    },
    {
      title: '速度(字/分)',
      dataIndex: 'speed',
      key: 'speed',
      sorter: (a, b) => a.speed - b.speed,
    },
    {
      title: '准确率',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy) => `${accuracy}%`,
      sorter: (a, b) => a.accuracy - b.accuracy,
    },
    {
      title: '达标状态',
      key: 'isPassed',
      dataIndex: 'isPassed',
      render: (isPassed) => (
        <Tag color={isPassed ? 'success' : 'error'}>
          {isPassed ? '达标' : '未达标'}
        </Tag>
      ),
      filters: [
        { text: '达标', value: true },
        { text: '未达标', value: false }
      ],
      onFilter: (value, record) => record.isPassed === value,
    },
    {
      title: '练习时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="确定要删除这条打字记录吗？"
          description="删除后无法恢复，请谨慎操作。"
          onConfirm={() => handleDeleteRecord(record._id)}
          okText="确定"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: deleteLoading }}
        >
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
          >
            删除
          </Button>
        </Popconfirm>
      ),
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>打字成绩管理</Title>
      
      <Row gutter={[16, 24]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均速度"
              value={stats.averageSpeed}
              suffix="字/分"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均准确率"
              value={stats.averageAccuracy}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总练习次数"
              value={stats.totalPractices}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="达标率"
              value={stats.passRate}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: '24px' }}>
        <Space style={{ marginBottom: 16 }}>
          <RangePicker
            onChange={(dates) => {
              if (dates) {
                handleFiltersChange({
                  startDate: dates[0].toISOString(),
                  endDate: dates[1].toISOString()
                });
              } else {
                // 清除日期筛选
                const { startDate, endDate, ...restFilters } = filters;
                handleFiltersChange(restFilters);
              }
            }}
          />
          <Select
            placeholder="选择班级"
            style={{ width: 200 }}
            onChange={(value) => {
              if (value) {
                handleFiltersChange({ classId: value });
              } else {
                // 清除班级筛选
                const { classId, ...restFilters } = filters;
                handleFiltersChange(restFilters);
              }
            }}
            allowClear
          >
            {classes.map(classItem => (
              <Select.Option key={classItem._id} value={classItem._id}>
                {classItem.name}
              </Select.Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出成绩
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={records}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 1000 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => loadData(filters, pageSize !== pagination.pageSize ? 1 : page, pageSize, false),
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      </Card>
    </div>
  );
};

export default TypingScoreManagement;