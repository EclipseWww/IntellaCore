import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    Button,
    Table,
    Space,
    Modal,
    message,
    Empty,
    Typography,
    Tooltip,
    Popconfirm
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    FileExcelOutlined,
    EyeOutlined,
    GlobalOutlined,
    LockOutlined
} from '@ant-design/icons';
import { getSpreadsheets, deleteSpreadsheet } from '../../services/spreadsheetAPI';

const { Title } = Typography;

/**
 * SpreadsheetList - 表格列表页面
 * 显示用户所有的表格，支持创建、编辑和删除
 */
const SpreadsheetList = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [spreadsheets, setSpreadsheets] = useState([]);

    // 获取用户角色
    const userRole = localStorage.getItem('userRole') || 'student';

    // 加载表格列表
    useEffect(() => {
        loadSpreadsheets();
    }, []);

    const loadSpreadsheets = async () => {
        try {
            setLoading(true);
            const response = await getSpreadsheets();
            if (response.success) {
                setSpreadsheets(response.data);
            }
        } catch (error) {
            console.error('Load spreadsheets error:', error);
            message.error('加载表格列表失败');
        } finally {
            setLoading(false);
        }
    };

    // 创建新表格
    const handleCreate = () => {
        navigate(`/${userRole}/spreadsheet/new`);
    };

    // 编辑表格
    const handleEdit = (record) => {
        navigate(`/${userRole}/spreadsheet/${record._id}`);
    };

    // 删除表格
    const handleDelete = async (id) => {
        try {
            const response = await deleteSpreadsheet(id);
            if (response.success) {
                message.success('删除成功');
                loadSpreadsheets();
            }
        } catch (error) {
            console.error('Delete spreadsheet error:', error);
            message.error('删除失败: ' + (error.response?.data?.message || error.message));
        }
    };

    // 表格列定义
    const columns = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    <a onClick={() => handleEdit(record)}>{text}</a>
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'isPublic',
            key: 'isPublic',
            width: 100,
            render: (isPublic) => (
                <Tooltip title={isPublic ? '公开' : '私有'}>
                    {isPublic ? (
                        <GlobalOutlined style={{ color: '#1890ff' }} />
                    ) : (
                        <LockOutlined style={{ color: '#999' }} />
                    )}
                </Tooltip>
            ),
        },
        {
            title: '更新时间',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString('zh-CN'),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (text) => new Date(text).toLocaleString('zh-CN'),
        },
        {
            title: '操作',
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="编辑">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="确定删除此表格？"
                        description="删除后无法恢复"
                        onConfirm={() => handleDelete(record._id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Tooltip title="删除">
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 24
                }}>
                    <Title level={4} style={{ margin: 0 }}>
                        <FileExcelOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                        在线表格
                    </Title>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                    >
                        新建表格
                    </Button>
                </div>

                <Table
                    columns={columns}
                    dataSource={spreadsheets}
                    rowKey="_id"
                    loading={loading}
                    locale={{
                        emptyText: (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description="暂无表格"
                            >
                                <Button type="primary" onClick={handleCreate}>
                                    创建第一个表格
                                </Button>
                            </Empty>
                        )
                    }}
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 个表格`
                    }}
                />
            </Card>
        </div>
    );
};

export default SpreadsheetList;
