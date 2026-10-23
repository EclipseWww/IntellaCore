import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, Space, message, Modal, Input, Spin, Card, Row, Col, Empty, Typography, Tooltip, Select, Tag } from 'antd';
import {
    ArrowLeftOutlined,
    HomeOutlined,
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    CodeOutlined,
    CloudUploadOutlined,
    EyeOutlined,
    GlobalOutlined
} from '@ant-design/icons';
import HtmlEditor from '../../components/HtmlEditor';
import * as htmlProjectAPI from '../../services/htmlProjectAPI';
import api from '../../services/api';
import './HtmlEditorPage.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const HtmlEditorPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [projects, setProjects] = useState([]);
    const [currentProject, setCurrentProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [projectName, setProjectName] = useState('');

    // 作业关联相关状态
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [activities, setActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);

    // 获取项目列表
    const fetchProjects = async () => {
        try {
            const result = await htmlProjectAPI.getProjects();
            if (result.success) {
                setProjects(result.data);
            }
        } catch (error) {
            console.error('获取项目失败:', error);
            message.error('获取项目列表失败');
        }
    };

    // 加载项目
    const loadProject = async (projectId) => {
        try {
            setLoading(true);
            const result = await htmlProjectAPI.getProject(projectId);
            if (result.success) {
                setCurrentProject(result.data);
                setProjectName(result.data.name);
            }
        } catch (error) {
            console.error('加载项目失败:', error);
            message.error('加载项目失败');
        } finally {
            setLoading(false);
        }
    };

    // 初始化加载
    useEffect(() => {
        fetchProjects();
        if (id) {
            loadProject(id);
        } else {
            setLoading(false);
        }
    }, [id]);

    // 创建新项目
    const handleCreateProject = async () => {
        try {
            setLoading(true);
            const result = await htmlProjectAPI.createProject({ name: '我的网页' });
            if (result.success) {
                message.success('创建成功！');
                navigate(`/student/html-editor/${result.data._id}`);
            }
        } catch (error) {
            console.error('创建项目失败:', error);
            message.error('创建项目失败');
        } finally {
            setLoading(false);
        }
    };

    // 打开项目
    const handleOpenProject = (projectId) => {
        navigate(`/student/html-editor/${projectId}`);
    };

    // 保存项目
    const handleSave = async (code) => {
        if (!currentProject) return;

        try {
            const result = await htmlProjectAPI.updateProject(currentProject._id, {
                code,
                name: projectName || currentProject.name
            });
            if (result.success) {
                setCurrentProject(result.data);
                fetchProjects();
            }
        } catch (error) {
            console.error('保存失败:', error);
            throw error;
        }
    };

    // 删除项目
    const handleDelete = async (projectId, e) => {
        e.stopPropagation();
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个网页吗？删除后无法恢复。',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await htmlProjectAPI.deleteProject(projectId);
                    message.success('已删除');
                    fetchProjects();
                    if (currentProject && currentProject._id === projectId) {
                        navigate('/student/html-editor');
                    }
                } catch (error) {
                    message.error('删除失败');
                }
            }
        });
    };

    // 返回首页
    const handleBack = () => {
        navigate('/student?tab=dashboard');
    };

    // 返回列表
    const handleBackToList = () => {
        navigate('/student/html-editor');
    };

    // 更新名称
    const handleUpdateName = async () => {
        if (!currentProject || !projectName.trim()) return;
        try {
            await htmlProjectAPI.updateProject(currentProject._id, { name: projectName });
            setEditingName(false);
            fetchProjects();
            message.success('名称已更新');
        } catch (error) {
            message.error('更新失败');
        }
    };

    // 发布/取消发布
    const handlePublish = async () => {
        if (!currentProject) return;

        // 如果是取消发布，直接执行
        if (currentProject.isPublished) {
            try {
                const result = await htmlProjectAPI.unpublishProject(currentProject._id);
                if (result.success) {
                    setCurrentProject(result.data);
                    message.success(result.message);
                }
            } catch (error) {
                message.error('操作失败');
            }
            return;
        }

        // 如果是发布，显示积分确认
        Modal.confirm({
            title: '发布作品确认',
            content: (
                <div>
                    <p>发布作品将消耗 <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>500</span> 积分。</p>
                    <p>每个人最多只能发布 2 个作品。</p>
                    <p>确定要发布吗？</p>
                </div>
            ),
            onOk: async () => {
                try {
                    const result = await htmlProjectAPI.publishProject(currentProject._id);
                    if (result.success) {
                        setCurrentProject(result.data);
                        message.success(result.message);
                    }
                } catch (error) {
                    // 处理后端返回的错误消息
                    if (error.response && error.response.data) {
                        message.error(error.response.data.message);
                    } else {
                        message.error('发布失败');
                    }
                }
            }
        });
    };

    // 打开作业关联弹窗 - 直接加载所有 HTML 活动
    const handleOpenAssignmentModal = async () => {
        setShowAssignmentModal(true);
        try {
            const response = await api.get('/courses/html-activities');
            if (response.data.success) {
                const activities = response.data.data || [];
                setActivities(activities);

                // 自动选中已关联的活动
                if (currentProject.linkedAssignment) {
                    const linkedActivityId = currentProject.linkedAssignment.activityId;
                    const linkedActivity = activities.find(a => a.activityId === linkedActivityId);
                    if (linkedActivity) {
                        setSelectedActivity(linkedActivity);
                    }
                }
            }
        } catch (error) {
            console.error('获取HTML活动失败:', error);
            setActivities([]);
        }
    };

    // 提交作业
    const handleSubmitAssignment = async () => {
        if (!selectedActivity || !currentProject) {
            message.warning('请选择要提交的作业');
            return;
        }

        try {
            const result = await htmlProjectAPI.linkAssignment(currentProject._id, {
                courseId: selectedActivity.courseId,
                unitId: selectedActivity.unitId,
                lessonId: selectedActivity.lessonId,
                activityId: selectedActivity.activityId
            });
            if (result.success) {
                setCurrentProject(result.data);
                message.success('作业提交成功！');
                setShowAssignmentModal(false);
            }
        } catch (error) {
            message.error('提交失败');
        }
    };

    // 跳转到作品展示
    const handleViewGallery = () => {
        navigate('/student/html-gallery');
    };

    // 项目列表视图
    if (!id) {
        return (
            <Layout className="html-editor-page">
                <Header className="html-editor-header">
                    <div className="header-left">
                        <Button
                            icon={<HomeOutlined />}
                            onClick={handleBack}
                            className="back-btn"
                        >
                            返回首页
                        </Button>
                        <Title level={4} className="page-title">
                            <CodeOutlined /> 我的网页
                        </Title>
                    </div>
                    <Space>
                        <Button
                            icon={<GlobalOutlined />}
                            onClick={handleViewGallery}
                        >
                            作品展示
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreateProject}
                            loading={loading}
                            size="large"
                        >
                            新建网页
                        </Button>
                    </Space>
                </Header>

                <Content className="html-editor-content project-list-content">
                    <Spin spinning={loading}>
                        {projects.length === 0 ? (
                            <div className="empty-state">
                                <Empty
                                    description="还没有创建网页哦~"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                >
                                    <Button type="primary" size="large" onClick={handleCreateProject}>
                                        创建我的第一个网页
                                    </Button>
                                </Empty>
                            </div>
                        ) : (
                            <Row gutter={[24, 24]}>
                                {projects.map(project => (
                                    <Col xs={24} sm={12} md={8} lg={6} xl={4} key={project._id}>
                                        <Card
                                            hoverable
                                            className="project-card"
                                            onClick={() => handleOpenProject(project._id)}
                                            actions={[
                                                <Tooltip title="删除">
                                                    <DeleteOutlined
                                                        key="delete"
                                                        onClick={(e) => handleDelete(project._id, e)}
                                                        style={{ color: '#ff4d4f' }}
                                                    />
                                                </Tooltip>
                                            ]}
                                        >
                                            <div className="project-icon">
                                                <CodeOutlined />
                                            </div>
                                            <div className="project-info">
                                                <Text strong ellipsis className="project-name">
                                                    {project.name}
                                                </Text>
                                                <div className="project-meta">
                                                    <Text type="secondary" className="project-time">
                                                        {new Date(project.updatedAt).toLocaleDateString()}
                                                    </Text>
                                                    {project.isPublished && (
                                                        <Tag color="green" size="small">
                                                            <EyeOutlined /> {project.viewCount || 0}
                                                        </Tag>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </Spin>
                </Content>
            </Layout>
        );
    }

    // 返回课程
    const handleReturnToLesson = () => {
        if (currentProject?.linkedAssignment) {
            const { course, unit, lesson } = currentProject.linkedAssignment;
            navigate(`/student/course/${course}/unit/${unit}/lesson/${lesson}`);
        }
    };

    // 编辑器视图
    if (loading) {
        return (
            <Layout className="html-editor-page">
                <div className="loading-container">
                    <Spin size="large" tip="加载中..." />
                </div>
            </Layout>
        );
    }

    return (
        <Layout className="html-editor-page">
            <Content className="html-editor-content editor-content no-header">
                {currentProject && (
                    <HtmlEditor
                        initialCode={currentProject.code}
                        onSave={handleSave}
                        title={projectName}
                        style={{ height: '100%' }}
                        onBack={handleBackToList}
                        onHome={handleBack}
                        onTitleChange={(name) => setProjectName(name)}
                        onTitleSave={handleUpdateName}
                        editingTitle={editingName}
                        setEditingTitle={setEditingName}
                        onPublish={handlePublish}
                        isPublished={currentProject.isPublished}
                        onLinkAssignment={handleOpenAssignmentModal}
                        linkedAssignment={currentProject.linkedAssignment}
                        onReturnToLesson={handleReturnToLesson}
                    />
                )}
            </Content>

            {/* 作业关联弹窗 */}
            <Modal
                title="提交作业"
                open={showAssignmentModal}
                onCancel={() => setShowAssignmentModal(false)}
                onOk={handleSubmitAssignment}
                okText="提交"
                cancelText="取消"
            >
                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">将当前网页作为作业提交到课程活动</Text>
                </div>
                {activities.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无可提交的HTML活动"
                    />
                ) : (
                    <div style={{ marginBottom: 16 }}>
                        <Text strong>选择活动：</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="请选择HTML活动"
                            onChange={(value) => {
                                const activity = activities.find(a => a.activityId === value);
                                setSelectedActivity(activity);
                            }}
                        >
                            {activities.map(activity => (
                                <Select.Option key={activity.activityId} value={activity.activityId}>
                                    <span style={{ fontWeight: 500 }}>{activity.title}</span>
                                    <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>
                                        {activity.courseName} - {activity.lessonName}
                                    </span>
                                </Select.Option>
                            ))}
                        </Select>
                    </div>
                )}
                {currentProject?.linkedAssignment?.submittedAt && (
                    <div style={{ marginTop: 16 }}>
                        <Tag color="green">
                            已提交于 {new Date(currentProject.linkedAssignment.submittedAt).toLocaleString()}
                        </Tag>
                    </div>
                )}
            </Modal>
        </Layout>
    );
};

export default HtmlEditorPage;

