import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout, Card, Row, Col, Spin, Empty, Typography, Button, Tag, Space, message } from 'antd';
import {
    ArrowLeftOutlined,
    EyeOutlined,
    CodeOutlined,
    UserOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import * as htmlProjectAPI from '../../services/htmlProjectAPI';
import './HtmlGallery.css';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const HtmlGallery = () => {
    const navigate = useNavigate();
    const { id } = useParams();

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewProject, setViewProject] = useState(null);

    // 加载已发布项目
    const fetchPublishedProjects = async () => {
        try {
            setLoading(true);
            const result = await htmlProjectAPI.getPublishedProjects();
            if (result.success) {
                setProjects(result.data);
            }
        } catch (error) {
            console.error('获取作品失败:', error);
            message.error('获取作品列表失败');
        } finally {
            setLoading(false);
        }
    };

    // 查看单个项目
    const loadProject = async (projectId) => {
        try {
            setLoading(true);
            const result = await htmlProjectAPI.viewPublishedProject(projectId);
            if (result.success) {
                setViewProject(result.data);
            }
        } catch (error) {
            console.error('加载作品失败:', error);
            message.error('作品不存在或未发布');
            navigate('/student/html-gallery');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            loadProject(id);
        } else {
            fetchPublishedProjects();
        }
    }, [id]);

    // 监听 iframe 消息 (链接跳转) - 修复沙箱环境下的跳转问题
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'OPEN_LINK' && event.data.url) {
                window.open(event.data.url, '_blank');
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 返回
    const handleBack = () => {
        if (id) {
            navigate('/student/html-gallery');
        } else {
            navigate('/student/html-editor');
        }
    };

    // 查看作品
    const handleViewProject = (projectId) => {
        navigate(`/student/html-gallery/${projectId}`);
    };

    // 查看单个作品页面
    if (id && viewProject) {
        return (
            <Layout className="html-gallery-page">
                <Header className="gallery-header">
                    <div className="header-left">
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={handleBack}
                        >
                            返回
                        </Button>
                        <Title level={4} className="project-title">
                            {viewProject.name}
                        </Title>
                    </div>
                    <Space>
                        <Tag icon={<UserOutlined />}>
                            {viewProject.creator?.name || '匿名'}
                        </Tag>
                        <Tag icon={<EyeOutlined />}>
                            {viewProject.viewCount} 次浏览
                        </Tag>
                    </Space>
                </Header>
                <Content className="gallery-content view-content">
                    <iframe
                        srcDoc={`
                            <!DOCTYPE html>
                            <html>
                                <head>
                                    <base href="${window.location.origin}/" />
                                    <script>
                                        document.addEventListener('click', function(e) {
                                            var link = e.target.closest('a');
                                            if (link) {
                                                if (link.target === '_blank') {
                                                    e.preventDefault();
                                                    window.parent.postMessage({
                                                        type: 'OPEN_LINK',
                                                        url: link.href
                                                    }, '*');
                                                }
                                            }
                                        });
                                    </script>
                                </head>
                                <body>
                                    ${viewProject.code.replace(/<!DOCTYPE html>|<html>|<head>.*?<\/head>|<body>|<\/body>|<\/html>/gs, '')}
                                </body>
                            </html>
                        `}
                        title={viewProject.name}
                        className="project-preview-iframe"
                        sandbox="allow-scripts allow-modals allow-forms allow-popups"
                    />
                </Content>
            </Layout>
        );
    }

    // 作品列表页面
    return (
        <Layout className="html-gallery-page">
            <Header className="gallery-header">
                <div className="header-left">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBack}
                    >
                        返回
                    </Button>
                    <Title level={4} className="page-title">
                        🌟 作品展示
                    </Title>
                </div>
                <Text type="secondary">
                    共 {projects.length} 个作品
                </Text>
            </Header>

            <Content className="gallery-content list-content">
                <Spin spinning={loading}>
                    {projects.length === 0 ? (
                        <div className="empty-state">
                            <Empty
                                description="还没有同学发布作品哦~"
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            >
                                <Button type="primary" onClick={() => navigate('/student/html-editor')}>
                                    去创建你的第一个作品
                                </Button>
                            </Empty>
                        </div>
                    ) : (
                        <Row gutter={[24, 24]}>
                            {projects.map(project => (
                                <Col xs={24} sm={12} md={8} lg={6} key={project._id}>
                                    <Card
                                        hoverable
                                        className="gallery-card"
                                        onClick={() => handleViewProject(project._id)}
                                        cover={
                                            <div className="card-preview">
                                                <iframe
                                                    srcDoc={project.code || '<html><body><h1>预览</h1></body></html>'}
                                                    title={project.name}
                                                    className="preview-thumbnail"
                                                    sandbox="allow-scripts"
                                                />
                                                <div className="preview-overlay">
                                                    <EyeOutlined /> 点击查看
                                                </div>
                                            </div>
                                        }
                                    >
                                        <Card.Meta
                                            title={project.name}
                                            description={
                                                <Space direction="vertical" size={4}>
                                                    <Space>
                                                        <UserOutlined />
                                                        <Text type="secondary">
                                                            {project.creator?.name || '匿名'}
                                                        </Text>
                                                    </Space>
                                                    <Space>
                                                        <EyeOutlined />
                                                        <Text type="secondary">
                                                            {project.viewCount || 0} 次浏览
                                                        </Text>
                                                    </Space>
                                                </Space>
                                            }
                                        />
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    )}
                </Spin>
            </Content>
        </Layout>
    );
};

export default HtmlGallery;
