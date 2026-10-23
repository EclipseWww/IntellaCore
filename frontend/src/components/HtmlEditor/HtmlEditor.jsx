import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Space, message as antMessage, Tooltip, Select, Modal, Input, Tabs, List, Card, Tag, Spin, Drawer, Collapse, Typography } from 'antd';
import {
    SaveOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    PlayCircleOutlined,
    CopyOutlined,
    CodeOutlined,
    EyeOutlined,
    FileAddOutlined,
    DownloadOutlined,
    ArrowLeftOutlined,
    HomeOutlined,
    EditOutlined,
    CloudUploadOutlined,
    LinkOutlined,
    GlobalOutlined,

    UserOutlined,
    BookOutlined
} from '@ant-design/icons';
import htmlProjectAPI from '../../services/htmlProjectAPI';
import { htmlTutorials } from './HtmlTutorials';
import './HtmlEditor.css';

const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Title: AntTitle, Paragraph, Text } = Typography;

/**
 * HtmlEditor - 在线HTML编辑器组件
 * 左侧代码编辑，右侧实时预览
 */
const HtmlEditor = ({
    initialCode = '',
    onChange,
    onSave,
    readOnly = false,
    loading = false,
    style = {},
    title = 'HTML 编辑器',
    // 导航相关 props
    onBack,
    onHome,
    onTitleChange,
    onTitleSave,
    editingTitle = false,
    setEditingTitle,
    // 发布和作业相关
    onPublish,
    isPublished = false,
    onLinkAssignment,
    linkedAssignment,
    onReturnToLesson
}) => {
    const [code, setCode] = useState(initialCode || getDefaultTemplate());
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [previewKey, setPreviewKey] = useState(0);
    const [splitRatio, setSplitRatio] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);

    // 链接插入相关状态
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkModalTab, setLinkModalTab] = useState('my');
    const [myProjects, setMyProjects] = useState([]);
    const [publishedProjects, setPublishedProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);

    const iframeRef = useRef(null);
    const containerRef = useRef(null);
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);

    // 默认HTML模板 - 简单空白页面
    function getDefaultTemplate() {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的网页</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>这是我的第一个网页！</p>
</body>
</html>`;
    }

    // 快速插入标签列表 - 显示名称和标签
    const quickTags = [
        { label: 'h1', tag: '<h1>标题</h1>' },
        { label: 'h2', tag: '<h2>标题</h2>' },
        { label: 'p', tag: '<p>段落文字</p>' },
        { label: 'a', tag: '<a href="#">链接</a>' },
        { label: 'img', tag: '<img src="" alt="">' },
        { label: 'ul', tag: '<ul>\n    <li>列表项</li>\n</ul>' },
        { label: 'li', tag: '<li>列表项</li>' },
        { label: 'button', tag: '<button>按钮</button>' },
        { label: 'div', tag: '<div>内容</div>' },
        { label: 'span', tag: '<span>文字</span>' },
        { label: 'b', tag: '<b>加粗</b>' },
        { label: 'i', tag: '<i>斜体</i>' },
        { label: 'br', tag: '<br>' },
        { label: 'hr', tag: '<hr>' },
    ];

    // 插入标签到光标位置
    const insertTag = (tag) => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newCode = code.substring(0, start) + tag + code.substring(end);
            setCode(newCode);
            setHasUnsavedChanges(true);

            // 设置光标位置到插入内容之后
            setTimeout(() => {
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = start + tag.length;
            }, 0);
        }
    };

    // 预设模板 - 适合初中生初学者的简单模板
    const templates = {
        blank: {
            name: '空白页面',
            code: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的网页</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>这是我的第一个网页！</p>
</body>
</html>`
        },
        intro: {
            name: '自我介绍',
            code: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>自我介绍</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            background-color: #f0f8ff;
            padding: 20px;
        }
        h1 { color: #333; }
        p { color: #666; }
        img { width: 100px; border-radius: 50%; }
    </style>
</head>
<body>
    <h1>👋 你好，我是小明</h1>
    <p>我今年14岁，是一名初中生。</p>
    <p>我的爱好是：</p>
    <ul>
        <li>🎮 玩游戏</li>
        <li>📚 看书</li>
        <li>⚽ 踢足球</li>
    </ul>
</body>
</html>`
        },
        colorful: {
            name: '彩色文字',
            code: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>彩色文字</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            text-align: center;
            padding: 50px;
        }
        .red { color: red; }
        .blue { color: blue; }
        .green { color: green; }
        .big { font-size: 30px; }
    </style>
</head>
<body>
    <h1>🌈 彩色文字</h1>
    <p class="red big">这是红色的大字</p>
    <p class="blue">这是蓝色的字</p>
    <p class="green">这是绿色的字</p>
</body>
</html>`
        },
        button: {
            name: '按钮样式',
            code: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>按钮样式</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            text-align: center;
            padding: 50px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            padding: 15px 30px;
            font-size: 18px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            margin: 10px;
        }
        button:hover {
            background-color: #45a049;
        }
        .blue { background-color: #2196F3; }
        .blue:hover { background-color: #1976D2; }
        .red { background-color: #f44336; }
        .red:hover { background-color: #d32f2f; }
    </style>
</head>
<body>
    <h1>🎯 漂亮的按钮</h1>
    <button>绿色按钮</button>
    <button class="blue">蓝色按钮</button>
    <button class="red">红色按钮</button>
</body>
</html>`
        },
        image: {
            name: '图片展示',
            code: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>图片展示</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            text-align: center;
            padding: 20px;
            background-color: #fafafa;
        }
        img {
            width: 300px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <h1>🖼️ 我的照片</h1>
    <img src="https://via.placeholder.com/300x200/667eea/ffffff?text=我的图片" alt="示例图片">
    <p>这是一张示例图片</p>
    <p>你可以把src换成真实的图片地址哦！</p>
</body>
</html>`
        },
        link: {
            name: '超链接',
            code: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>超链接</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            padding: 30px;
        }
        a {
            color: #1890ff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <h1>🔗 超链接示例</h1>
    <p>点击下面的链接可以跳转到其他网站：</p>
    <ul>
        <li><a href="https://www.baidu.com" target="_blank">百度</a></li>
        <li><a href="https://www.bilibili.com" target="_blank">哔哩哔哩</a></li>
    </ul>
    <p>提示：target="_blank" 表示在新窗口打开</p>
</body>
</html>`
        }
    };

    // 更新代码
    const handleCodeChange = (e) => {
        const newCode = e.target.value;
        setCode(newCode);
        setHasUnsavedChanges(true);
        if (onChange) {
            onChange(newCode);
        }
    };

    // 刷新预览
    const refreshPreview = useCallback(() => {
        setPreviewKey(prev => prev + 1);
    }, []);

    // 自动刷新预览
    useEffect(() => {
        if (autoRefresh) {
            const timer = setTimeout(() => {
                refreshPreview();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [code, autoRefresh, refreshPreview]);

    // iframe 内容现在通过 srcdoc 属性设置，不需要 useEffect

    // 初始化代码
    useEffect(() => {
        if (initialCode) {
            setCode(initialCode);
        }
    }, [initialCode]);

    // 手动保存
    const handleSave = async () => {
        if (onSave) {
            setIsSaving(true);
            try {
                await onSave(code);
                setHasUnsavedChanges(false);
                antMessage.success('保存成功');
            } catch (error) {
                console.error('HtmlEditor: Save error:', error);
                antMessage.error('保存失败');
            } finally {
                setIsSaving(false);
            }
        }
    };

    // 复制代码
    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            antMessage.success('代码已复制到剪贴板');
        }).catch(() => {
            antMessage.error('复制失败');
        });
    };

    // 下载HTML文件
    const handleDownload = () => {
        const blob = new Blob([code], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'index.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        antMessage.success('文件已下载');
    };

    // 全屏切换
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // 拖拽分隔条
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging || !containerRef.current) return;
            const container = containerRef.current;
            const rect = container.getBoundingClientRect();
            const newRatio = ((e.clientX - rect.left) / rect.width) * 100;
            setSplitRatio(Math.max(20, Math.min(80, newRatio)));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // 监听 iframe 消息 (链接跳转)
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'OPEN_LINK' && event.data.url) {
                window.open(event.data.url, '_blank');
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 应用模板
    const applyTemplate = (templateKey) => {
        if (templates[templateKey]) {
            setCode(templates[templateKey].code);
            setHasUnsavedChanges(true);
            setShowTemplateModal(false);
            antMessage.success(`已应用模板: ${templates[templateKey].name}`);
        }
    };

    // 处理Tab键
    const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newCode = code.substring(0, start) + '    ' + code.substring(end);
            setCode(newCode);
            setHasUnsavedChanges(true);

            // 设置光标位置
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }, 0);
        }

        // Ctrl+S 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    };

    // 同步行号滚动
    const handleScroll = (e) => {
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = e.target.scrollTop;
        }
    };

    // 打开链接插入弹窗
    const handleOpenLinkModal = () => {
        setShowLinkModal(true);
        fetchProjectsForLink('my');
    };

    // 获取用于插入的网页列表
    const fetchProjectsForLink = async (type) => {
        setProjectsLoading(true);
        setLinkModalTab(type);
        try {
            if (type === 'my') {
                const response = await htmlProjectAPI.getProjects();
                setMyProjects(response.data || []);
            } else {
                const response = await htmlProjectAPI.getPublishedProjects(1, 100); // 获取较多条目
                setPublishedProjects(response.data || []);
            }
        } catch (error) {
            antMessage.error('获取项目列表失败');
        } finally {
            setProjectsLoading(false);
        }
    };

    // 插入项目链接
    const insertProjectLink = (project) => {
        const linkUrl = `/student/html-gallery/${project._id || project.id}`; // 确保ID字段正确
        const linkTag = `<a href="${linkUrl}" target="_blank">${project.name || '网页'}</a>`;

        insertTag(linkTag);
        setShowLinkModal(false);
        antMessage.success('链接已插入');
    };

    if (loading) {
        return (
            <div className="html-editor-loading">
                <div className="loading-spinner"></div>
                <p>加载编辑器中...</p>
            </div>
        );
    }

    return (
        <div
            className="html-editor-container"
            style={style}
            ref={containerRef}
        >
            {/* 顶部工具栏 */}
            <div className="html-editor-toolbar">
                <div className="toolbar-left">
                    {onBack && (
                        <Tooltip title="返回列表">
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={onBack}
                                className="nav-btn"
                            />
                        </Tooltip>
                    )}
                    {linkedAssignment && onReturnToLesson && (
                        <Tooltip title="返回课程">
                            <Button
                                icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                onClick={onReturnToLesson}
                                className="nav-btn"
                                style={{ color: '#52c41a', borderColor: '#b7eb8f', background: '#f6ffed', marginRight: 8 }}
                            >
                                返回课程
                            </Button>
                        </Tooltip>
                    )}
                    {editingTitle && setEditingTitle ? (
                        <Space className="title-edit-space">
                            <Input
                                value={title}
                                onChange={(e) => onTitleChange && onTitleChange(e.target.value)}
                                style={{ width: 150 }}
                                onPressEnter={() => { onTitleSave && onTitleSave(); setEditingTitle(false); }}
                                autoFocus
                                size="small"
                            />
                            <Button type="primary" size="small" onClick={() => { onTitleSave && onTitleSave(); setEditingTitle(false); }}>确定</Button>
                            <Button size="small" onClick={() => setEditingTitle(false)}>取消</Button>
                        </Space>
                    ) : (
                        <span
                            className="editor-title"
                            onClick={() => setEditingTitle && setEditingTitle(true)}
                            style={{ cursor: setEditingTitle ? 'pointer' : 'default' }}
                        >
                            <CodeOutlined /> {title || '未命名网页'}
                            {setEditingTitle && <EditOutlined className="title-edit-icon" />}
                        </span>
                    )}
                </div>
                <div className="toolbar-center">
                    <Space>
                        <Tooltip title="选择模板">
                            <Button
                                icon={<FileAddOutlined />}
                                onClick={() => setShowTemplateModal(true)}
                                disabled={readOnly}
                            >
                                模板
                            </Button>
                        </Tooltip>
                        <Tooltip title="手动刷新预览">
                            <Button
                                icon={<PlayCircleOutlined />}
                                onClick={refreshPreview}
                            >
                                刷新
                            </Button>
                        </Tooltip>
                        <Tooltip title="复制代码">
                            <Button
                                icon={<CopyOutlined />}
                                onClick={handleCopy}
                            />
                        </Tooltip>
                        <Tooltip title="互动教程">
                            <Button
                                type="primary"
                                icon={<BookOutlined />}
                                onClick={() => setShowTutorial(true)}
                                style={{
                                    background: 'linear-gradient(45deg, #FF6B6B, #FF8E53)',
                                    borderColor: 'transparent',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 4px rgba(255, 107, 107, 0.3)'
                                }}
                            >
                                互动教程
                            </Button>
                        </Tooltip>
                        <Tooltip title="下载 HTML 文件">
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleDownload}
                            />
                        </Tooltip>
                        <div style={{ width: 1, height: 24, background: '#f0f0f0', margin: '0 8px' }} />
                        <Tooltip title="插入网页链接">
                            <Button
                                icon={<LinkOutlined />}
                                onClick={handleOpenLinkModal}
                            >
                                插入链接
                            </Button>
                        </Tooltip>
                    </Space>
                </div>
                <div className="toolbar-right">
                    <Space>
                        {!readOnly && onSave && (
                            <>
                                <Button
                                    type="primary"
                                    icon={<SaveOutlined />}
                                    onClick={handleSave}
                                    loading={isSaving}
                                >
                                    保存
                                </Button>
                                {hasUnsavedChanges ? (
                                    <span className="save-status unsaved">
                                        <ExclamationCircleOutlined /> 未保存
                                    </span>
                                ) : (
                                    <span className="save-status saved">
                                        <CheckCircleOutlined /> 已保存
                                    </span>
                                )}
                            </>
                        )}
                        {onLinkAssignment && (
                            <Tooltip title="关联作业">
                                <Button icon={<LinkOutlined />} onClick={onLinkAssignment}>
                                    提交作业
                                </Button>
                            </Tooltip>
                        )}
                        {onPublish && (
                            <Tooltip title={isPublished ? '已发布，其他同学可以看到' : '发布后其他同学可以看到'}>
                                <Button
                                    icon={<CloudUploadOutlined />}
                                    onClick={onPublish}
                                    type={isPublished ? 'default' : 'primary'}
                                    ghost={isPublished}
                                >
                                    {isPublished ? '已发布' : '发布'}
                                </Button>
                            </Tooltip>
                        )}
                        {onHome && (
                            <Tooltip title="返回首页">
                                <Button icon={<HomeOutlined />} onClick={onHome}>
                                    首页
                                </Button>
                            </Tooltip>
                        )}
                    </Space>
                </div>
            </div>

            {/* 编辑器主体 */}
            <div className="html-editor-main">
                {/* 左侧代码编辑区 */}
                <div className="editor-panel code-panel"
                    style={{ width: `${splitRatio}%` }}
                >
                    {/* 合并的工具栏 - 包含标题和快捷标签 */}
                    <div className="code-panel-header">
                        <span className="panel-title"><CodeOutlined /> 代码</span>
                        <div className="quick-tags-inline">
                            {quickTags.map((item, index) => (
                                <button
                                    key={index}
                                    className="quick-tag-btn"
                                    onClick={() => insertTag(item.tag)}
                                    title={item.tag}
                                >
                                    &lt;{item.label}&gt;
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="html-code-editor-wrapper">
                        <div className="html-line-numbers" ref={lineNumbersRef}>
                            {code.split('\n').map((_, index) => (
                                <div key={index} className="html-line-number">
                                    {index + 1}
                                </div>
                            ))}
                        </div>
                        <textarea
                            ref={textareaRef}
                            className="html-code-textarea"
                            value={code}
                            onChange={handleCodeChange}
                            onKeyDown={handleKeyDown}
                            onScroll={handleScroll}
                            readOnly={readOnly}
                            spellCheck={false}
                            placeholder="在此输入 HTML 代码..."
                        />
                    </div>
                </div>

                {/* 分隔条 */}
                <div
                    className={`editor-divider ${isDragging ? 'dragging' : ''}`}
                    onMouseDown={handleMouseDown}
                >
                    <div className="divider-handle"></div>
                </div>

                {/* 右侧预览区 */}
                <div
                    className="editor-panel preview-panel"
                    style={{ width: `${100 - splitRatio}%` }}
                >
                    <div className="panel-header">
                        <EyeOutlined /> 实时预览
                        <span className="auto-refresh-hint">
                            {autoRefresh ? '自动刷新已开启' : ''}
                        </span>
                    </div>
                    <div className="preview-wrapper">
                        <iframe
                            ref={iframeRef}
                            key={previewKey}
                            title="HTML Preview"
                            className="preview-iframe"
                            srcDoc={`
                                <!DOCTYPE html>
                                <html>
                                    <head>
                                        <base href="${window.location.origin}/" />
                                        <script>
                                            document.addEventListener('click', function(e) {
                                                var link = e.target.closest('a');
                                                if (link) {
                                                    // console.log('Link clicked:', link.href);
                                                    // 如果是新窗口打开，拦截并发送给父窗口
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
                                        ${code.replace(/<!DOCTYPE html>|<html>|<head>.*?<\/head>|<body>|<\/body>|<\/html>/gs, '')}
                                    </body>
                                </html>
                            `}
                            sandbox="allow-scripts allow-modals allow-forms allow-popups" // 不需要 escape-sandbox 了，因为由父窗口打开
                        />
                    </div>
                </div>
            </div>

            {/* 模板选择弹窗 */}
            <Modal
                title="选择模板"
                open={showTemplateModal}
                onCancel={() => setShowTemplateModal(false)}
                footer={null}
                width={600}
            >
                <div className="template-grid">
                    {Object.entries(templates).map(([key, template]) => (
                        <div
                            key={key}
                            className="template-item"
                            onClick={() => applyTemplate(key)}
                        >
                            <div className="template-icon">{template.name.charAt(0)}</div>
                            <div className="template-name">{template.name}</div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* 插入链接弹窗 */}
            <Modal
                title="插入网页链接"
                open={showLinkModal}
                onCancel={() => setShowLinkModal(false)}
                footer={null}
                width={600}
                className="link-insert-modal"
            >
                <Tabs
                    activeKey={linkModalTab}
                    onChange={(key) => fetchProjectsForLink(key)}
                    items={[
                        {
                            key: 'my',
                            label: <span><UserOutlined />我的作品</span>,
                            children: (
                                <Spin spinning={projectsLoading}>
                                    {myProjects.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                            暂无作品
                                        </div>
                                    ) : (
                                        <List
                                            dataSource={myProjects}
                                            renderItem={item => (
                                                <List.Item
                                                    className="project-list-item"
                                                    onClick={() => insertProjectLink(item)}
                                                    style={{ cursor: 'pointer', padding: '10px', borderBottom: '1px solid #f0f0f0' }}
                                                >
                                                    <div style={{ width: '100%' }}>
                                                        <div style={{ fontWeight: 500 }}>{item.name || '未命名网页'}</div>
                                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                                            更新于: {new Date(item.updatedAt).toLocaleDateString()}
                                                            {item.isPublished && <Tag color="green" style={{ marginLeft: 8 }}>已发布</Tag>}
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            )}
                                            style={{ maxHeight: '400px', overflowY: 'auto' }}
                                        />
                                    )}
                                </Spin>
                            )
                        },
                        {
                            key: 'published',
                            label: <span><GlobalOutlined />作品画廊</span>,
                            children: (
                                <Spin spinning={projectsLoading}>
                                    {publishedProjects.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                            暂无已发布作品
                                        </div>
                                    ) : (
                                        <List
                                            dataSource={publishedProjects}
                                            renderItem={item => (
                                                <List.Item
                                                    className="project-list-item"
                                                    onClick={() => insertProjectLink(item)}
                                                    style={{ cursor: 'pointer', padding: '10px', borderBottom: '1px solid #f0f0f0' }}
                                                >
                                                    <div style={{ width: '100%' }}>
                                                        <div style={{ fontWeight: 500 }}>{item.name || '未命名网页'}</div>
                                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                                            作者: {item.creatorName || '未知'} |
                                                            浏览: {item.viewCount || 0}
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            )}
                                            style={{ maxHeight: '400px', overflowY: 'auto' }}
                                        />
                                    )}
                                </Spin>
                            )
                        }
                    ]}
                />
            </Modal>

            {/* 教程抽屉 */}
            <Drawer
                title={
                    <Space>
                        <BookOutlined />
                        <span>HTML 互动教程</span>
                    </Space>
                }
                placement="right"
                width={480}
                onClose={() => setShowTutorial(false)}
                open={showTutorial}
                mask={false} // 允许同时操作编辑器
                extra={
                    <Button type="primary" size="small" onClick={() => insertTag(getDefaultTemplate())}>
                        重置代码
                    </Button>
                }
            >
                <Tabs defaultActiveKey="html">
                    {htmlTutorials.map(category => (
                        <TabPane tab={category.title} key={category.key}>
                            <Collapse accordion defaultActiveKey={['0']}>
                                {category.children.map((item, index) => (
                                    <Panel header={item.title} key={index}>
                                        <div className="tutorial-content">
                                            <div
                                                dangerouslySetInnerHTML={{ __html: item.content }}
                                                style={{ marginBottom: '12px', lineHeight: '1.6', color: '#555' }}
                                            />

                                            <div className="tutorial-code-block" style={{
                                                position: 'relative',
                                                background: '#f6f8fa',
                                                border: '1px solid #d0d7de',
                                                borderRadius: '6px',
                                                padding: '12px',
                                                marginBottom: '12px'
                                            }}>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', fontSize: '13px' }}>
                                                    {item.code}
                                                </pre>
                                            </div>

                                            <Space>
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<CodeOutlined />}
                                                    onClick={() => insertTag(item.code)}
                                                >
                                                    插入代码
                                                </Button>
                                                <Button
                                                    size="small"
                                                    icon={<CopyOutlined />}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.code);
                                                        antMessage.success('代码已复制');
                                                    }}
                                                >
                                                    复制
                                                </Button>
                                            </Space>
                                        </div>
                                    </Panel>
                                ))}
                            </Collapse>
                        </TabPane>
                    ))}
                </Tabs>
                <div style={{ marginTop: 20, padding: '10px', background: '#e6f7ff', borderRadius: 4, fontSize: 13 }}>
                    <p style={{ marginBottom: 5 }}><b>💡 学习提示：</b></p>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                        <li>点击"插入代码"会将代码添加到当前光标位置。</li>
                        <li>你可以尝试修改代码中的文字和数值。</li>
                        <li>随时点击"刷新"按钮查看最新效果。</li>
                    </ul>
                </div>
            </Drawer>
        </div>
    );
};

export default HtmlEditor;
