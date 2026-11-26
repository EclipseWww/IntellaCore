import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Button, message, Form, Input, Select, Popconfirm, Space, Alert } from 'antd';
import { DeleteOutlined, ReloadOutlined, InboxOutlined, RollbackOutlined } from '@ant-design/icons';
import { archiveGrade as archiveGradeAPI, restoreClass as restoreClassAPI, getArchivedClasses, deleteArchivedClassFiles } from '../../../services/classService';

const { Option } = Select;

// 归档管理：active 为 true（切换到该标签页）时刷新已归档班级
const ArchiveTab = ({ active, classes }) => {
  // 归档管理相关状态
  const [archivedClasses, setArchivedClasses] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archiveForm] = Form.useForm();
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!active) return;
    (async () => {
      setArchivedLoading(true);
      try {
        const res = await getArchivedClasses();
        setArchivedClasses(res.data || []);
      } catch (e) { message.error('获取归档班级失败'); }
      finally { setArchivedLoading(false); }
    })();
  }, [active]);

  return (
    <Row gutter={24}>
      {/* 左側：按年级归档操作区 */}
      <Col span={10}>
        <Card
          title={<span><InboxOutlined style={{ color: '#fa8c16', marginRight: 8 }} />年级归档</span>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Alert
            message="归档说明"
            description={
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                <li>归档后，该年级所有班级的学生无法登录系统</li>
                <li>学生的作业、成绩、积分等历史数据完整保留</li>
                <li>教师可查看已归档班级的历史成绩</li>
                <li>归档后可选择清理作业文件节省存储</li>
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={archiveForm} layout="vertical">
            <Form.Item
              name="grade"
              label="入学年份（选择要归档的年级）"
              rules={[{ required: true, message: '请选择要归档的年级' }]}
            >
              <Select
                placeholder="请选择需要归档的年级"
                style={{ width: 200 }}
                allowClear
              >
                {[...new Set(classes.filter(c => c.status !== 'archived').map(c => c.grade))]
                  .filter(Boolean)
                  .sort((a, b) => b - a)
                  .map(g => (
                    <Option key={g} value={g}>{g} 级</Option>
                  ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="graduationYear"
              label="毕业学年（可选，如 2025-2026）"
            >
              <Input placeholder="例如：2025-2026" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item>
              <Popconfirm
                title="确认归档"
                description={"归档后该年级所有学生将无法登录，确定执行？"}
                okText="确定归档"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try {
                    const vals = await archiveForm.validateFields();
                    setArchiving(true);
                    const result = await archiveGradeAPI(Number(vals.grade), vals.graduationYear);
                    message.success(result.message);
                    archiveForm.resetFields();
                    // 刷新归档列表
                    const res = await getArchivedClasses();
                    setArchivedClasses(res.data || []);
                  } catch (e) {
                    if (!e.errorFields) message.error(e?.response?.data?.message || '归档失败');
                  } finally { setArchiving(false); }
                }}
              >
                <Button type="primary" danger loading={archiving} icon={<InboxOutlined />}>
                  执行年级归档
                </Button>
              </Popconfirm>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      {/* 右側：已归档班级列表 */}
      <Col span={14}>
        <Card
          title={<span>已归档班级列表</span>}
          size="small"
          extra={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={async () => {
                setArchivedLoading(true);
                try {
                  const res = await getArchivedClasses();
                  setArchivedClasses(res.data || []);
                } catch (e) { message.error('获取失败'); }
                finally { setArchivedLoading(false); }
              }}
            >刷新</Button>
          }
        >
          <Table
            dataSource={archivedClasses}
            loading={archivedLoading}
            rowKey="_id"
            size="small"
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: '班级',
                key: 'class',
                render: (_, r) => `${r.grade}届${r.name}班`
              },
              {
                title: '学生数',
                dataIndex: 'studentCount',
                key: 'studentCount',
                render: (v) => `${v || 0} 人`
              },
              {
                title: '归档时间',
                dataIndex: 'archivedAt',
                key: 'archivedAt',
                render: (d) => d ? new Date(d).toLocaleDateString() : '-'
              },
              {
                title: '毕业学年',
                dataIndex: 'graduationYear',
                key: 'graduationYear',
                render: (v) => v || '-'
              },
              {
                title: '操作',
                key: 'actions',
                render: (_, r) => (
                  <Space size="small">
                    <Popconfirm
                      title="确定恢复此班级为活跃状态？"
                      okText="确定"
                      cancelText="取消"
                      onConfirm={async () => {
                        try {
                          const res = await restoreClassAPI(r._id);
                          message.success(res.message);
                          const listRes = await getArchivedClasses();
                          setArchivedClasses(listRes.data || []);
                        } catch (e) { message.error('恢复失败'); }
                      }}
                    >
                      <Button type="link" size="small" icon={<RollbackOutlined />}>恢复</Button>
                    </Popconfirm>
                    <Popconfirm
                      title="确定删除该班级学生的所有作业文件？"
                      description="删除后文件不可恢复，成绩、评语等数据不受影响"
                      okText="确定删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={async () => {
                        try {
                          const res = await deleteArchivedClassFiles(r._id);
                          message.success(res.message);
                        } catch (e) { message.error('清理失败'); }
                      }}
                    >
                      <Button type="link" size="small" danger icon={<DeleteOutlined />}>清理文件</Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default ArchiveTab;
