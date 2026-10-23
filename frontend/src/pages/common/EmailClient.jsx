import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layout, Menu, List, Card, Button, Input, Space, Typography, Avatar,
    Badge, Tag, Tooltip, Empty, Spin, Modal, Form, Upload, Select,
    message, Divider, Switch, Popconfirm, AutoComplete, Tabs, Alert
} from 'antd';
import {
    InboxOutlined, SendOutlined, DeleteOutlined, StarOutlined, StarFilled,
    MailOutlined, EditOutlined, ReloadOutlined, SearchOutlined, PaperClipOutlined,
    DownloadOutlined, SettingOutlined, PoweroffOutlined, UserOutlined,
    RollbackOutlined, ShareAltOutlined, FileTextOutlined, ContactsOutlined,
    PlusOutlined, BookOutlined, HddOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import emailAPI from '../../services/emailAPI';
import EmailAccountSetup from '../../components/Email/EmailAccountSetup';
import TerminalSimulator from '../../components/Email/TerminalSimulator';
import usePageTitle from '../../hooks/usePageTitle';

const { Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const EmailClient = () => {
    usePageTitle('邮件');
    const navigate = useNavigate();

    // 状态
    const [loading, setLoading] = useState(true);
    const [systemEnabled, setSystemEnabled] = useState(true);
    const [terminalMode, setTerminalMode] = useState(false);
    const [hasAccount, setHasAccount] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [domain, setDomain] = useState('learnsite.edu');

    const [currentFolder, setCurrentFolder] = useState('inbox');
    const [emails, setEmails] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [composeVisible, setComposeVisible] = useState(false);
    const [composeMode, setComposeMode] = useState('new'); // 'new', 'reply', 'forward'
    const [replyToEmail, setReplyToEmail] = useState(null);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [composeForm] = Form.useForm();
    const [sendLoading, setSendLoading] = useState(false);
    const [attachments, setAttachments] = useState([]);

    const [searchOptions, setSearchOptions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // 搜索邮件相关状态
    const [emailSearchQuery, setEmailSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // 群发相关状态
    const [broadcastVisible, setBroadcastVisible] = useState(false);
    const [broadcastForm] = Form.useForm();
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [classList, setClassList] = useState([]);
    const [broadcastAttachments, setBroadcastAttachments] = useState([]);

    // 联系人管理
    const [contactsVisible, setContactsVisible] = useState(false);
    const [contacts, setContacts] = useState([]);
    const [contactForm] = Form.useForm();

    // 模板管理
    const [templatesVisible, setTemplatesVisible] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [templateForm] = Form.useForm();

    // 附件管理状态
    const [attachmentStats, setAttachmentStats] = useState({ totalSize: '0 B', count: 0 });
    const [attachmentManagerVisible, setAttachmentManagerVisible] = useState(false);

    // 写邮件内容（用于ReactQuill）
    const [composeContent, setComposeContent] = useState('');

    // 获取用户角色
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isTeacherOrAdmin = user.role === 'teacher' || user.role === 'admin';

    // 初始化
    useEffect(() => {
        loadSystemStatus();
    }, []);

    useEffect(() => {
        if (hasAccount) {
            loadEmails();
            loadUnreadCount();
        }
    }, [hasAccount, currentFolder, page]);

    const loadSystemStatus = async () => {
        setLoading(true);
        try {
            const status = await emailAPI.getSystemStatus();
            setSystemEnabled(status.enabled);
            setTerminalMode(status.terminalMode || false);
            setHasAccount(status.hasAccount);
            setEmailAddress(status.emailAddress || '');
            setDomain(status.domain || 'learnsite.edu');
        } catch (error) {
            console.error('获取邮件系统状态失败:', error);
            message.error('获取邮件系统状态失败');
        } finally {
            setLoading(false);
        }
    };

    const loadEmails = async () => {
        try {
            const result = await emailAPI.getEmails(currentFolder, page, 20);
            setEmails(result.emails || []);
            setTotal(result.total || 0);
        } catch (error) {
            console.error('获取邮件失败:', error);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const result = await emailAPI.getUnreadCount();
            setUnreadCount(result.count || 0);
        } catch (error) {
            console.error('获取未读数量失败:', error);
        }
    };

    const handleSelectEmail = async (email) => {
        try {
            const detail = await emailAPI.getEmailById(email._id);
            setSelectedEmail(detail);
            if (!email.isRead) {
                loadEmails();
                loadUnreadCount();
            }
        } catch (error) {
            console.error('获取邮件详情失败:', error);
        }
    };

    const handleToggleStar = async (emailId, e) => {
        e.stopPropagation();
        try {
            await emailAPI.toggleStar(emailId);
            loadEmails();
            if (selectedEmail?._id === emailId) {
                setSelectedEmail(prev => ({ ...prev, isStarred: !prev.isStarred }));
            }
        } catch (error) {
            message.error('操作失败');
        }
    };

    const handleDeleteEmail = async (emailId) => {
        try {
            await emailAPI.deleteEmail(emailId);
            message.success('邮件已删除');
            if (selectedEmail?._id === emailId) {
                setSelectedEmail(null);
            }
            loadEmails();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleSendEmail = async (values) => {
        setSendLoading(true);
        try {
            await emailAPI.sendEmail({
                to: values.to,
                cc: values.cc,
                subject: values.subject,
                content: composeContent
            }, attachments);

            message.success('邮件发送成功');
            setComposeVisible(false);
            composeForm.resetFields();
            setAttachments([]);
            setComposeContent('');
            setComposeMode('new');
            setReplyToEmail(null);

            if (currentFolder === 'sent') {
                loadEmails();
            }
        } catch (error) {
            console.error('发送失败:', error);
            message.error(error.response?.data?.message || '发送失败');
        } finally {
            setSendLoading(false);
        }
    };

    // 打开新邮件
    const openNewCompose = () => {
        setComposeMode('new');
        setReplyToEmail(null);
        composeForm.resetFields();
        setAttachments([]);
        setComposeContent('');
        setComposeVisible(true);
    };

    // 回复邮件
    const handleReply = (email) => {
        setComposeMode('reply');
        setReplyToEmail(email);
        composeForm.setFieldsValue({
            to: email.from,
            subject: `回复: ${email.subject || '(无主题)'}`
        });
        setComposeContent(`<br><br><br>---------- 原邮件 ----------<br>发件人: ${email.senderName || email.from}<br>时间: ${new Date(email.sentAt).toLocaleString()}<br>主题: ${email.subject}<br><br>${email.content || ''}`);
        setAttachments([]);
        setComposeVisible(true);
    };

    // 转发邮件
    const handleForward = (email) => {
        setComposeMode('forward');
        setReplyToEmail(email);
        composeForm.setFieldsValue({
            to: '',
            subject: `转发: ${email.subject || '(无主题)'}`
        });
        setComposeContent(`<br><br><br>---------- 转发邮件 ----------<br>发件人: ${email.senderName || email.from}<br>时间: ${new Date(email.sentAt).toLocaleString()}<br>主题: ${email.subject}<br><br>${email.content || ''}`);
        setAttachments([]);
        setComposeVisible(true);
    };

    // 搜索邮件
    const handleEmailSearch = async () => {
        if (!emailSearchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const result = await emailAPI.searchEmails(emailSearchQuery);
            setSearchResults(result.emails || []);
        } catch (error) {
            console.error('搜索邮件失败:', error);
            message.error('搜索失败');
        }
    };

    // 清除搜索
    const clearSearch = () => {
        setEmailSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    };

    // 保存草稿
    const handleSaveDraft = async () => {
        try {
            const values = composeForm.getFieldsValue();
            await emailAPI.saveDraft({
                to: values.to,
                cc: values.cc,
                subject: values.subject,
                content: composeContent
            });
            message.success('草稿已保存');
            setComposeVisible(false);
            composeForm.resetFields();
            setAttachments([]);
            setComposeContent('');
            setComposeMode('new');
            setReplyToEmail(null);
            if (currentFolder === 'drafts') {
                loadEmails();
            }
        } catch (error) {
            console.error('保存草稿失败:', error);
            message.error('保存失败');
        }
    };

    const handleSearchEmail = async (value) => {
        if (!value || value.length < 1) {
            setSearchOptions([]);
            return;
        }

        setSearchLoading(true);
        try {
            const results = await emailAPI.searchAccounts(value);
            setSearchOptions(results.map(r => ({
                value: r.emailAddress,
                label: (
                    <Space>
                        <Avatar size="small" icon={<UserOutlined />} />
                        <span>{r.name}</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.emailAddress}</Text>
                    </Space>
                )
            })));
        } catch (error) {
            console.error('搜索失败:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleToggleSystem = async (enabled) => {
        try {
            await emailAPI.setSystemStatus(enabled);
            setSystemEnabled(enabled);
            message.success(enabled ? '邮件系统已启用' : '邮件系统已禁用');
        } catch (error) {
            message.error('操作失败');
        }
    };

    // ========== 联系人管理 ==========
    const loadContacts = async () => {
        try {
            const data = await emailAPI.getContacts();
            setContacts(data);
        } catch (error) {
            console.error('获取联系人失败:', error);
        }
    };

    const handleAddContact = async (values) => {
        try {
            await emailAPI.addContact(values);
            message.success('联系人已添加');
            contactForm.resetFields();
            loadContacts();
        } catch (error) {
            message.error(error.response?.data?.message || '添加失败');
        }
    };

    const handleDeleteContact = async (id) => {
        try {
            await emailAPI.deleteContact(id);
            message.success('联系人已删除');
            loadContacts();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleSelectContact = (email) => {
        const currentTo = composeForm.getFieldValue('to') || '';
        const newTo = currentTo ? `${currentTo}, ${email}` : email;
        composeForm.setFieldsValue({ to: newTo });
        setContactsVisible(false);
        message.success('已添加到收件人');
    };

    // ========== 模板管理 ==========
    const loadTemplates = async () => {
        try {
            const data = await emailAPI.getTemplates();
            setTemplates(data);
        } catch (error) {
            console.error('获取模板失败:', error);
        }
    };

    const handleCreateTemplate = async (values) => {
        try {
            await emailAPI.createTemplate(values);
            message.success('模板已创建');
            templateForm.resetFields();
            loadTemplates();
        } catch (error) {
            message.error('创建失败');
        }
    };

    const handleDeleteTemplate = async (id) => {
        try {
            await emailAPI.deleteTemplate(id);
            message.success('模板已删除');
            loadTemplates();
        } catch (error) {
            message.error('删除失败');
        }
    };

    const handleApplyTemplate = (template) => {
        composeForm.setFieldsValue({
            subject: template.subject,
        });
        setComposeContent(template.content);
        setTemplatesVisible(false);
        message.success('模板已应用');
    };

    // 加载班级列表（教师群发用）
    const loadClasses = async () => {
        try {
            const classes = await emailAPI.getTeacherClasses();
            setClassList(classes);
        } catch (error) {
            console.error('加载班级列表失败:', error);
        }
    };

    // 打开群发弹窗
    const handleOpenBroadcast = () => {
        loadClasses();
        setBroadcastVisible(true);
    };

    // 发送群发邮件
    const handleSendBroadcast = async (values) => {
        setBroadcastLoading(true);
        try {
            const result = await emailAPI.sendBroadcast(
                values.classId,
                values.subject,
                values.content,
                values.attachments
            );
            message.success(result.message);
            setBroadcastVisible(false);
            broadcastForm.resetFields();
            setBroadcastAttachments([]);
            if (currentFolder === 'sent') {
                loadEmails();
            }
        } catch (error) {
            console.error('群发失败:', error);
            message.error(error.response?.data?.message || '群发失败');
        } finally {
            setBroadcastLoading(false);
        }
    };

    // 加载附件统计
    const loadAttachmentStats = async () => {
        try {
            const stats = await emailAPI.getAttachmentStats();
            setAttachmentStats(stats);
        } catch (error) {
            console.error('加载附件统计失败:', error);
        }
    };

    // 清理附件
    const handleClearAttachments = async (type) => {
        try {
            const result = await emailAPI.clearAttachments(type);
            message.success(`${result.message}，释放空间: ${result.details.freedSpace}`);
            loadAttachmentStats();
        } catch (error) {
            message.error('清理失败');
        }
    };

    const handleAccountCreated = (newEmailAddress) => {
        setHasAccount(true);
        setEmailAddress(newEmailAddress);
    };

    // 文件夹菜单项
    const folderItems = [
        { key: 'inbox', icon: <InboxOutlined />, label: '收件箱', badge: unreadCount },
        { key: 'sent', icon: <SendOutlined />, label: '已发送' },
        { key: 'drafts', icon: <FileTextOutlined />, label: '草稿箱' },
        { key: 'trash', icon: <DeleteOutlined />, label: '回收站' },
    ];

    // 加载中
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Spin size="large" />
            </div>
        );
    }



    // 未注册邮箱
    if (!hasAccount) {
        return <EmailAccountSetup onSuccess={handleAccountCreated} domain={domain} />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            {!systemEnabled && !isTeacherOrAdmin && (
                <Alert
                    message="系统维护中"
                    description="当前仅允许向老师发送邮件"
                    type="warning"
                    banner
                    showIcon
                />
            )}
            <Layout style={{ flex: 1, overflow: 'hidden', background: terminalMode ? '#1a1a2e' : '#f5f5f5' }}>
                {/* 左侧文件夹列表 - 命令行模式时隐藏 */}
                {!terminalMode && (
                    <Sider
                        width={200}
                        style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
                    >
                        <div style={{ padding: 16 }}>
                            <Button
                                icon={<ArrowLeftOutlined />}
                                block
                                onClick={() => navigate('/student')}
                                style={{ marginBottom: 8 }}
                            >
                                返回
                            </Button>
                            <Button
                                type="primary"
                                icon={<EditOutlined />}
                                block
                                onClick={openNewCompose}
                            >
                                写邮件
                            </Button>
                            {isTeacherOrAdmin && (
                                <Button
                                    style={{ marginTop: 8 }}
                                    icon={<SendOutlined />}
                                    block
                                    onClick={handleOpenBroadcast}
                                >
                                    班级群发
                                </Button>
                            )}
                            {isTeacherOrAdmin && (
                                <Button
                                    style={{ marginTop: 8 }}
                                    icon={<HddOutlined />}
                                    block
                                    onClick={() => { setAttachmentManagerVisible(true); loadAttachmentStats(); }}
                                >
                                    附件管理
                                </Button>
                            )}
                        </div>

                        <Menu
                            mode="inline"
                            selectedKeys={[currentFolder]}
                            onClick={({ key }) => { setCurrentFolder(key); setPage(1); setSelectedEmail(null); }}
                            items={folderItems.map(item => ({
                                ...item,
                                label: (
                                    <Space>
                                        {item.label}
                                        {item.badge > 0 && <Badge count={item.badge} size="small" />}
                                    </Space>
                                )
                            }))}
                        />

                        <Divider />

                        <div style={{ padding: '0 16px' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>我的邮箱</Text>
                            <Paragraph style={{ margin: '8px 0', wordBreak: 'break-all' }}>
                                <Text strong style={{ fontSize: 13 }}>{emailAddress}</Text>
                            </Paragraph>
                        </div>

                        {isTeacherOrAdmin && (
                            <>
                                <Divider />
                                <div style={{ padding: '0 16px' }}>
                                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                        <Space>
                                            <Text>教学模式</Text>
                                            <Switch
                                                checked={terminalMode}
                                                onChange={async (checked) => {
                                                    try {
                                                        await emailAPI.setTerminalMode(checked);
                                                        setTerminalMode(checked);
                                                        message.success(checked ? '已切换到命令行模式' : '已切换到现代模式');
                                                    } catch (error) {
                                                        message.error('切换失败');
                                                    }
                                                }}
                                                checkedChildren="命令行"
                                                unCheckedChildren="现代"
                                            />
                                        </Space>
                                        <Space>
                                            <Text>邮件系统</Text>
                                            <Switch
                                                checked={systemEnabled}
                                                onChange={handleToggleSystem}
                                                checkedChildren="开"
                                                unCheckedChildren="关"
                                            />
                                        </Space>
                                    </Space>
                                </div>
                            </>
                        )}
                    </Sider>
                )}

                {/* 邮件列表或命令行模拟器 */}
                <Content style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {terminalMode ? (
                        <TerminalSimulator
                            emailAddress={emailAddress}
                            onSendSuccess={loadEmails}
                            isTeacher={isTeacherOrAdmin}
                            onExitTerminal={async () => {
                                try {
                                    await emailAPI.setTerminalMode(false);
                                    setTerminalMode(false);
                                    message.success('已切换到现代模式');
                                } catch (error) {
                                    message.error('切换失败');
                                }
                            }}
                        />
                    ) : (
                        <>
                            <div style={{ width: 360, background: '#fff', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Title level={5} style={{ margin: 0 }}>
                                            {isSearching ? '搜索结果' : folderItems.find(f => f.key === currentFolder)?.label}
                                        </Title>
                                        {isSearching ? (
                                            <Button size="small" onClick={clearSearch}>清除</Button>
                                        ) : (
                                            <Button icon={<ReloadOutlined />} size="small" onClick={loadEmails}>刷新</Button>
                                        )}
                                    </div>
                                    <Input.Search
                                        placeholder="搜索邮件..."
                                        value={emailSearchQuery}
                                        onChange={e => setEmailSearchQuery(e.target.value)}
                                        onSearch={handleEmailSearch}
                                        allowClear
                                        size="small"
                                    />
                                </div>

                                {(isSearching ? searchResults : emails).length === 0 ? (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description={isSearching ? "未找到匹配邮件" : "暂无邮件"}
                                        style={{ marginTop: 60 }}
                                    />
                                ) : (
                                    <List
                                        dataSource={isSearching ? searchResults : emails}
                                        renderItem={(email) => (
                                            <List.Item
                                                key={email._id}
                                                onClick={() => handleSelectEmail(email)}
                                                style={{
                                                    padding: '12px 16px',
                                                    cursor: 'pointer',
                                                    background: selectedEmail?._id === email._id ? '#e6f7ff' : (email.isRead ? '#fff' : '#fafafa'),
                                                    borderLeft: selectedEmail?._id === email._id ? '3px solid #1890ff' : '3px solid transparent'
                                                }}
                                            >
                                                <div style={{ width: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                        <Text strong={!email.isRead} ellipsis style={{ maxWidth: 200 }}>
                                                            {currentFolder === 'sent'
                                                                ? (email.recipients?.[0]?.name || email.to[0])
                                                                : (email.senderName || email.from)}
                                                        </Text>
                                                        <Space size={4}>
                                                            <Tooltip title={email.isStarred ? '取消标星' : '标星'}>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={email.isStarred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                                                                    onClick={(e) => handleToggleStar(email._id, e)}
                                                                />
                                                            </Tooltip>
                                                        </Space>
                                                    </div>
                                                    <Text
                                                        style={{ fontSize: 13, fontWeight: email.isRead ? 'normal' : 600 }}
                                                        ellipsis
                                                    >
                                                        {email.subject || '(无主题)'}
                                                    </Text>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            {new Date(email.sentAt).toLocaleDateString()}
                                                        </Text>
                                                        {email.attachments?.length > 0 && (
                                                            <PaperClipOutlined style={{ color: '#999' }} />
                                                        )}
                                                    </div>
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                )}
                            </div>

                            {/* 邮件详情 */}
                            <div style={{ flex: 1, background: '#fff', overflow: 'auto', padding: 24 }}>
                                {selectedEmail ? (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                            <Title level={4} style={{ margin: 0 }}>{selectedEmail.subject || '(无主题)'}</Title>
                                            <Space>
                                                <Tooltip title="回复">
                                                    <Button
                                                        icon={<RollbackOutlined />}
                                                        onClick={() => handleReply(selectedEmail)}
                                                    />
                                                </Tooltip>
                                                <Tooltip title="转发">
                                                    <Button
                                                        icon={<ShareAltOutlined />}
                                                        onClick={() => handleForward(selectedEmail)}
                                                    />
                                                </Tooltip>
                                                <Tooltip title={selectedEmail.isStarred ? '取消标星' : '标星'}>
                                                    <Button
                                                        icon={selectedEmail.isStarred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                                                        onClick={(e) => handleToggleStar(selectedEmail._id, e)}
                                                    />
                                                </Tooltip>
                                                <Popconfirm
                                                    title="确定删除这封邮件吗？"
                                                    onConfirm={() => handleDeleteEmail(selectedEmail._id)}
                                                >
                                                    <Button icon={<DeleteOutlined />} danger />
                                                </Popconfirm>
                                            </Space>
                                        </div>

                                        <div style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
                                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                                <div>
                                                    <Text type="secondary">发件人: </Text>
                                                    <Text strong>{selectedEmail.senderName || selectedEmail.from}</Text>
                                                    {selectedEmail.senderName && (
                                                        <Text type="secondary" style={{ marginLeft: 8 }}>({selectedEmail.from})</Text>
                                                    )}
                                                </div>
                                                <div>
                                                    <Text type="secondary">收件人: </Text>
                                                    <Text>
                                                        {selectedEmail.recipients?.length > 0
                                                            ? selectedEmail.recipients.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')
                                                            : selectedEmail.to.join(', ')}
                                                    </Text>
                                                </div>
                                                {(selectedEmail.ccRecipients?.length > 0 || selectedEmail.cc?.length > 0) && (
                                                    <div>
                                                        <Text type="secondary">抄送: </Text>
                                                        <Text>
                                                            {selectedEmail.ccRecipients?.length > 0
                                                                ? selectedEmail.ccRecipients.map(r => r.name ? `${r.name} (${r.email})` : r.email).join(', ')
                                                                : selectedEmail.cc.join(', ')}
                                                        </Text>
                                                    </div>
                                                )}
                                                <div>
                                                    <Text type="secondary">时间: </Text>
                                                    <Text>{new Date(selectedEmail.sentAt).toLocaleString()}</Text>
                                                </div>
                                            </Space>
                                        </div>

                                        {selectedEmail.attachments?.length > 0 && (
                                            <div style={{ marginBottom: 16 }}>
                                                <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>附件:</Text>
                                                <Space wrap>
                                                    {selectedEmail.attachments.map((att, idx) => (
                                                        <Tag key={idx} icon={<PaperClipOutlined />}>
                                                            <a
                                                                href={emailAPI.getAttachmentUrl(att.filename)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                {att.originalName} ({(att.size / 1024).toFixed(1)} KB)
                                                            </a>
                                                        </Tag>
                                                    ))}
                                                </Space>
                                            </div>
                                        )}

                                        <Divider />

                                        <div
                                            style={{ minHeight: 200, lineHeight: 1.8 }}
                                            dangerouslySetInnerHTML={{ __html: selectedEmail.content?.replace(/\n/g, '<br/>') || '' }}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description="选择一封邮件查看详情"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Content>

                {/* 写邮件弹窗 */}
                <Modal
                    title={composeMode === 'reply' ? '回复邮件' : composeMode === 'forward' ? '转发邮件' : '写邮件'}
                    open={composeVisible}
                    onCancel={() => { setComposeVisible(false); composeForm.resetFields(); setAttachments([]); setComposeMode('new'); setReplyToEmail(null); }}
                    footer={null}
                    width={700}
                    destroyOnClose
                >
                    <Form form={composeForm} layout="vertical" onFinish={handleSendEmail}>
                        <Form.Item
                            name="to"
                            label="收件人"
                            rules={[{ required: true, message: '请输入收件人邮箱' }]}
                        >
                            <AutoComplete
                                options={searchOptions}
                                onSearch={handleSearchEmail}
                                placeholder="输入邮箱地址搜索"
                                notFoundContent={searchLoading ? <Spin size="small" /> : null}
                            />
                        </Form.Item>

                        <Form.Item name="cc" label="抄送">
                            <AutoComplete
                                options={searchOptions}
                                onSearch={handleSearchEmail}
                                placeholder="输入邮箱地址搜索（可选）"
                                notFoundContent={searchLoading ? <Spin size="small" /> : null}
                            />
                        </Form.Item>

                        <Form.Item
                            name="subject"
                            label={
                                <Space>
                                    <span>主题</span>
                                    <Button size="small" icon={<ContactsOutlined />} onClick={() => { loadContacts(); setContactsVisible(true); }}>
                                        联系人
                                    </Button>
                                    <Button size="small" icon={<BookOutlined />} onClick={() => { loadTemplates(); setTemplatesVisible(true); }}>
                                        模板
                                    </Button>
                                </Space>
                            }
                            rules={[{ required: true, message: '请输入邮件主题' }]}
                        >
                            <Input placeholder="邮件主题" />
                        </Form.Item>

                        <Form.Item label="正文">
                            <ReactQuill
                                theme="snow"
                                value={composeContent}
                                onChange={setComposeContent}
                                placeholder="邮件正文..."
                                style={{ height: 200, marginBottom: 42 }}
                            />
                        </Form.Item>

                        <Form.Item label="附件">
                            <Upload
                                multiple
                                maxCount={5}
                                beforeUpload={(file) => {
                                    if (file.size > 10 * 1024 * 1024) {
                                        message.error('文件大小不能超过10MB');
                                        return false;
                                    }
                                    setAttachments(prev => [...prev, file]);
                                    return false;
                                }}
                                onRemove={(file) => {
                                    setAttachments(prev => prev.filter(f => f.uid !== file.uid));
                                }}
                                fileList={attachments}
                            >
                                <Button icon={<PaperClipOutlined />}>添加附件</Button>
                            </Upload>
                            <Text type="secondary" style={{ fontSize: 12 }}>最多5个附件，每个不超过10MB</Text>
                        </Form.Item>

                        <Form.Item>
                            <Space>
                                <Button type="primary" htmlType="submit" loading={sendLoading} icon={<SendOutlined />}>
                                    发送
                                </Button>
                                <Button icon={<FileTextOutlined />} onClick={handleSaveDraft}>
                                    保存草稿
                                </Button>
                                <Button onClick={() => { setComposeVisible(false); composeForm.resetFields(); setAttachments([]); setComposeMode('new'); setReplyToEmail(null); }}>
                                    取消
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* 群发邮件弹窗 */}
                <Modal
                    title="班级群发邮件"
                    open={broadcastVisible}
                    onCancel={() => { setBroadcastVisible(false); broadcastForm.resetFields(); setBroadcastAttachments([]); }}
                    footer={null}
                    width={700}
                    destroyOnClose
                >
                    <Form form={broadcastForm} layout="vertical" onFinish={handleSendBroadcast}>
                        <Form.Item
                            name="classId"
                            label="选择班级"
                            rules={[{ required: true, message: '请选择要群发的班级' }]}
                        >
                            <Select
                                placeholder="选择班级"
                                showSearch
                                optionFilterProp="children"
                            >
                                {classList.map(cls => (
                                    <Select.Option key={cls._id} value={cls._id}>
                                        {cls.name} {cls.grade && `(${cls.grade})`}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="subject"
                            label="主题"
                            rules={[{ required: true, message: '请输入邮件主题' }]}
                        >
                            <Input placeholder="邮件主题" />
                        </Form.Item>

                        <Form.Item name="content" label="正文">
                            <TextArea rows={8} placeholder="邮件正文..." />
                        </Form.Item>

                        <Form.Item label="附件">
                            <Upload
                                multiple
                                maxCount={5}
                                beforeUpload={(file) => {
                                    if (file.size > 10 * 1024 * 1024) {
                                        message.error('文件大小不能超过10MB');
                                        return false;
                                    }
                                    setBroadcastAttachments(prev => [...prev, file]);
                                    return false;
                                }}
                                onRemove={(file) => {
                                    setBroadcastAttachments(prev => prev.filter(f => f.uid !== file.uid));
                                }}
                                fileList={broadcastAttachments}
                            >
                                <Button icon={<PaperClipOutlined />}>添加附件</Button>
                            </Upload>
                            <Text type="secondary" style={{ fontSize: 12 }}>最多5个附件，每个不超过10MB</Text>
                        </Form.Item>

                        <Form.Item>
                            <Space>
                                <Button type="primary" htmlType="submit" loading={broadcastLoading} icon={<SendOutlined />}>
                                    群发
                                </Button>
                                <Button onClick={() => { setBroadcastVisible(false); broadcastForm.resetFields(); setBroadcastAttachments([]); }}>
                                    取消
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* 联系人管理弹窗 */}
                <Modal
                    title="联系人"
                    open={contactsVisible}
                    onCancel={() => setContactsVisible(false)}
                    footer={null}
                    width={500}
                >
                    <Form form={contactForm} layout="inline" onFinish={handleAddContact} style={{ marginBottom: 16 }}>
                        <Form.Item name="name" rules={[{ required: true }]}>
                            <Input placeholder="姓名" style={{ width: 100 }} />
                        </Form.Item>
                        <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
                            <Input placeholder="邮箱地址" style={{ width: 180 }} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>添加</Button>
                        </Form.Item>
                    </Form>
                    <List
                        size="small"
                        dataSource={contacts}
                        locale={{ emptyText: '暂无联系人' }}
                        renderItem={contact => (
                            <List.Item
                                actions={[
                                    <Button size="small" onClick={() => handleSelectContact(contact.email)}>选择</Button>,
                                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteContact(contact._id)}>
                                        <Button size="small" danger>删除</Button>
                                    </Popconfirm>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<Avatar size="small" icon={<UserOutlined />} />}
                                    title={contact.name}
                                    description={contact.email}
                                />
                            </List.Item>
                        )}
                    />
                </Modal>

                {/* 模板管理弹窗 */}
                <Modal
                    title="邮件模板"
                    open={templatesVisible}
                    onCancel={() => setTemplatesVisible(false)}
                    footer={null}
                    width={600}
                >
                    <Form form={templateForm} layout="inline" onFinish={handleCreateTemplate} style={{ marginBottom: 16 }}>
                        <Form.Item name="name" rules={[{ required: true }]}>
                            <Input placeholder="模板名称" style={{ width: 120 }} />
                        </Form.Item>
                        <Form.Item name="subject">
                            <Input placeholder="主题" style={{ width: 150 }} />
                        </Form.Item>
                        <Form.Item name="content">
                            <Input placeholder="内容" style={{ width: 150 }} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建</Button>
                        </Form.Item>
                    </Form>
                    <List
                        size="small"
                        dataSource={templates}
                        locale={{ emptyText: '暂无模板' }}
                        renderItem={template => (
                            <List.Item
                                actions={[
                                    <Button size="small" onClick={() => handleApplyTemplate(template)}>应用</Button>,
                                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTemplate(template._id)}>
                                        <Button size="small" danger>删除</Button>
                                    </Popconfirm>
                                ]}
                            >
                                <List.Item.Meta
                                    title={template.name}
                                    description={`主题: ${template.subject || '(无)'}`}
                                />
                            </List.Item>
                        )}
                    />
                </Modal>

                {/* 附件管理弹窗 */}
                <Modal
                    title="附件空间管理"
                    open={attachmentManagerVisible}
                    onCancel={() => setAttachmentManagerVisible(false)}
                    footer={null}
                    width={400}
                >
                    <div style={{ textAlign: 'center', marginBottom: 24, marginTop: 16 }}>
                        <HddOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                        <Title level={2} style={{ margin: 0 }}>{attachmentStats.totalSize}</Title>
                        <Text type="secondary">附件总数: {attachmentStats.count} 个</Text>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Popconfirm
                            title="确定清理3个月前的附件？"
                            description="这将删除所有超过3个月的附件文件，无法恢复。"
                            onConfirm={() => handleClearAttachments('olderThan3M')}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button block>清理3个月前的附件</Button>
                        </Popconfirm>
                        <Popconfirm
                            title="确定清理所有附件？"
                            description="警告：这将删除服务器上的所有附件文件，历史邮件的附件将无法下载。"
                            onConfirm={() => handleClearAttachments('all')}
                            okText="确定删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                        >
                            <Button block danger>清理所有附件 (慎用)</Button>
                        </Popconfirm>
                    </Space>
                </Modal>
            </Layout>
        </div>
    );
};

export default EmailClient;
