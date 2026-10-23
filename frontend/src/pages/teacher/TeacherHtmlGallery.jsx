import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, message, Popconfirm, Input, Select, Row, Col, Modal, Empty } from 'antd';
import { DeleteOutlined, UndoOutlined, EyeOutlined, ReloadOutlined, CodeOutlined, FullscreenOutlined } from '@ant-design/icons';
import htmlProjectAPI from '../../services/htmlProjectAPI';

const { Search } = Input;

const TeacherHtmlGallery = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewProject, setPreviewProject] = useState(null);
    const [showSourceCode, setShowSourceCode] = useState(false);

    const fetchProjects = async (page = 1, limit = 20) => {
        setLoading(true);
        try {
            const response = await htmlProjectAPI.getPublishedProjects(page, limit);
            if (response.success) {
                setProjects(response.data || []);
                setPagination({
                    current: response.pagination?.page || 1,
                    pageSize: response.pagination?.limit || 20,
                    total: response.pagination?.total || 0
                });
            }
        } catch (error) {
            console.error('获取作品列表失败:', error);
            message.error('获取作品列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleTableChange = (paginationInfo) => {
        fetchProjects(paginationInfo.current, paginationInfo.pageSize);
    };

    const handleUnpublish = async (project) => {
        try {
            const response = await htmlProjectAPI.teacherUnpublishProject(project._id);
            if (response.success) {
                message.success('已取消发布');
                fetchProjects(pagination.current, pagination.pageSize);
            }
        } catch (error) {
            console.error('取消发布失败:', error);
            message.error('取消发布失败');
        }
    };

    const handleDelete = async (project) => {
        try {
            const response = await htmlProjectAPI.teacherDeleteProject(project._id);
            if (response.success) {
                message.success('删除成功');
                fetchProjects(pagination.current, pagination.pageSize);
            }
        } catch (error) {
            console.error('删除失败:', error);
            message.error('删除失败');
        }
    };

    const handlePreview = (project) => {
        setPreviewProject(project);
        setPreviewVisible(true);
    };

    const formatClassName = (creator) => {
        if (!creator?.classId) return '未分配班级';
        const { grade, name } = creator.classId;
        return `${grade || ''}级${name || ''}班`;
    };

    // Filter projects by search text
    const filteredProjects = projects.filter(p => {
        if (!searchText) return true;
        const lowerSearch = searchText.toLowerCase();
        return (
            p.name?.toLowerCase().includes(lowerSearch) ||
            p.creator?.name?.toLowerCase().includes(lowerSearch) ||
            formatClassName(p.creator).toLowerCase().includes(lowerSearch)
        );
    });

    const columns = [
        {
            title: '缩略图',
            dataIndex: 'thumbnail',
            key: 'thumbnail',
            width: 80,
            render: (thumbnail) => (
                <div style={{ width: 60, height: 45, background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
                    {thumbnail ? (
                        <img src={thumbnail} alt="缩略图" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
                    ) : (
                        <span style={{ color: '#bbb', fontSize: 12 }}>无</span>
                    )}
                </div>
            )
        },
        {
            title: '作品名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true
        },
        {
            title: '学生',
            dataIndex: 'creator',
            key: 'creator',
            render: (creator) => creator?.name || '未知'
        },
        {
            title: '班级',
            dataIndex: 'creator',
            key: 'class',
            render: (creator) => formatClassName(creator)
        },
        {
            title: '发布时间',
            dataIndex: 'publishedAt',
            key: 'publishedAt',
            width: 170,
            render: (date) => date ? new Date(date).toLocaleString('zh-CN') : '-'
        },
        {
            title: '浏览量',
            dataIndex: 'viewCount',
            key: 'viewCount',
            width: 80,
            render: (count) => count || 0
        },
        {
            title: '操作',
            key: 'actions',
            width: 150,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)} title="预览" />
                    <Popconfirm title="确定取消发布?" onConfirm={() => handleUnpublish(record)}>
                        <Button size="small" icon={<UndoOutlined />} title="取消发布" />
                    </Popconfirm>
                    <Popconfirm title="确定删除此作品?" onConfirm={() => handleDelete(record)} okButtonProps={{ danger: true }}>
                        <Button size="small" icon={<DeleteOutlined />} danger title="删除" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Card
                title="学生网页作品管理"
                extra={
                    <Space>
                        <Search
                            placeholder="搜索作品名/学生名/班级"
                            allowClear
                            style={{ width: 250 }}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => fetchProjects(pagination.current, pagination.pageSize)}>
                            刷新
                        </Button>
                    </Space>
                }
            >
                <Table
                    columns={columns}
                    dataSource={filteredProjects}
                    rowKey="_id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 个作品`
                    }}
                    onChange={handleTableChange}
                />
            </Card>

            {/* Preview Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 30 }}>
                        <span>{previewProject?.name || '作品预览'}</span>
                        <Space>
                            <Button
                                icon={showSourceCode ? <EyeOutlined /> : <CodeOutlined />}
                                onClick={() => setShowSourceCode(!showSourceCode)}
                                disabled={!previewProject?.code}
                            >
                                {showSourceCode ? '预览' : '源码'}
                            </Button>
                        </Space>
                    </div>
                }
                open={previewVisible}
                onCancel={() => { setPreviewVisible(false); setShowSourceCode(false); }}
                footer={null}
                width="90vw"
                style={{ top: 20 }}
                bodyStyle={{ padding: 0, height: 'calc(90vh - 100px)', overflow: 'hidden' }}
            >
                {previewProject && previewProject.code ? (
                    showSourceCode ? (
                        <pre style={{
                            width: '100%',
                            height: '100%',
                            margin: 0,
                            padding: 16,
                            overflow: 'auto',
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            fontSize: 13,
                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                        }}>
                            <code>{previewProject.code}</code>
                        </pre>
                    ) : (
                        <iframe
                            srcDoc={previewProject.code}
                            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                            title="Preview"
                            sandbox="allow-scripts"
                        />
                    )
                ) : (
                    <Empty description="无法加载预览" style={{ padding: 50 }} />
                )}
            </Modal>
        </div>
    );
};

export default TeacherHtmlGallery;
