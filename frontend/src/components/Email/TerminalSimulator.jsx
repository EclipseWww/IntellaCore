import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Space, Button, Tag, Divider, Alert, Collapse } from 'antd';
import {
    SendOutlined, InboxOutlined, CodeOutlined,
    CheckCircleOutlined, QuestionCircleOutlined, RightOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import emailAPI from '../../services/emailAPI';

const { Text, Title } = Typography;

/**
 * 命令行邮件协议模拟器 - 连接真实邮件系统
 */
const TerminalSimulator = ({ emailAddress, onSendSuccess, onExitTerminal, isTeacher }) => {
    const navigate = useNavigate();
    // 从邮箱地址提取用户名
    const emailUsername = emailAddress ? emailAddress.split('@')[0] : '';
    const [mode, setMode] = useState('smtp'); // 'smtp' or 'pop3'
    const [history, setHistory] = useState([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);

    // 命令历史记录
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // SMTP 状态
    const [smtpState, setSmtpState] = useState({
        heloSent: false,
        mailFrom: '',
        rcptTo: '',
        inDataMode: false,
        subject: '',
        body: []
    });

    // POP3 状态
    const [pop3State, setPop3State] = useState({
        user: '',
        emails: [],
        deletedIds: []
    });

    const terminalRef = useRef(null);
    const inputRef = useRef(null);

    // 滚动到底部
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [history]);

    // 聚焦输入框
    useEffect(() => {
        if (inputRef.current && connected) {
            inputRef.current.focus();
        }
    }, [connected, history]);

    // 重置状态
    const resetSimulation = () => {
        setHistory([]);
        setConnected(false);
        setAuthenticated(false);
        setSmtpState({
            heloSent: false,
            mailFrom: '',
            rcptTo: '',
            inDataMode: false,
            subject: '',
            body: []
        });
        setPop3State({
            user: '',
            emails: [],
            deletedIds: []
        });
        setInput('');
    };

    // 切换模式
    const handleModeChange = (newMode) => {
        setMode(newMode);
        resetSimulation();
    };

    // 连接服务器 - 通过命令输入
    const handleTelnetConnect = async (host, port) => {
        setConnected(true);
        if (mode === 'smtp') {
            setHistory(prev => [...prev,
            { type: 'system', text: `正在连接 ${host}:${port}...` },
            { type: 'response', text: '220 mail.learnsite.edu ESMTP Ready' }
            ]);
        } else {
            // POP3 模式 - 加载真实邮件
            try {
                const result = await emailAPI.getEmails('inbox', 1, 50);
                setPop3State(prev => ({ ...prev, emails: result.emails || [] }));
                setHistory(prev => [...prev,
                { type: 'system', text: `正在连接 ${host}:${port}...` },
                { type: 'response', text: '+OK POP3 server ready <mail.learnsite.edu>' }
                ]);
            } catch (error) {
                setHistory(prev => [...prev,
                { type: 'system', text: `正在连接 ${host}:${port}...` },
                { type: 'error', text: '-ERR Connection failed' }
                ]);
            }
        }
    };

    // 处理未连接状态下的命令
    const handlePreConnectCommand = (cmd) => {
        const lowerCmd = cmd.toLowerCase().trim();

        // telnet 命令
        if (lowerCmd.startsWith('telnet ')) {
            const parts = cmd.trim().split(/\s+/);
            const host = parts[1] ? parts[1].toLowerCase() : '';
            const port = parts[2] || (mode === 'smtp' ? '25' : '110');

            // 验证主机名 - 必须是 mail.learnsite.edu
            const validHost = 'mail.learnsite.edu';
            if (host !== validHost) {
                addToHistory('error', `无效的主机地址 "${parts[1] || ''}"。请使用: telnet ${validHost} ${mode === 'smtp' ? '25' : '110'}`);
                return;
            }

            // 验证端口号
            const expectedPort = mode === 'smtp' ? '25' : '110';
            if (port !== expectedPort) {
                addToHistory('system', `提示: ${mode === 'smtp' ? 'SMTP' : 'POP3'} 标准端口是 ${expectedPort}，您使用的是 ${port}`);
            }

            handleTelnetConnect(host, port);
            return;
        }

        // 帮助命令
        if (lowerCmd === 'help' || lowerCmd === '?') {
            addToHistory('system', `请使用 telnet 命令连接服务器:\n  telnet mail.learnsite.edu ${mode === 'smtp' ? '25' : '110'}`);
            return;
        }

        addToHistory('error', `请先连接服务器。输入: telnet mail.learnsite.edu ${mode === 'smtp' ? '25' : '110'}`);
    };

    // 添加命令到历史
    const addToHistory = (type, text) => {
        setHistory(prev => [...prev, { type, text }]);
    };

    // 处理 SMTP 命令
    const handleSmtpCommand = async (cmd) => {
        const upperCmd = cmd.toUpperCase();

        // DATA 模式下的处理
        if (smtpState.inDataMode) {
            if (cmd === '.') {
                // 结束 DATA 模式，发送邮件
                setSmtpState(prev => ({ ...prev, inDataMode: false }));
                addToHistory('response', '250 OK: Message queued for delivery');

                // 真正发送邮件
                try {
                    const content = smtpState.body.join('\n');
                    await emailAPI.sendEmail({
                        to: smtpState.rcptTo,
                        subject: smtpState.subject || '(无主题)',
                        content: content
                    });
                    addToHistory('success', '✓ 邮件已成功发送到 ' + smtpState.rcptTo);
                    if (onSendSuccess) onSendSuccess();
                } catch (error) {
                    addToHistory('error', '✗ 发送失败: ' + (error.response?.data?.message || error.message));
                }
            } else if (cmd.toLowerCase().startsWith('subject:')) {
                setSmtpState(prev => ({ ...prev, subject: cmd.substring(8).trim() }));
            } else {
                setSmtpState(prev => ({ ...prev, body: [...prev.body, cmd] }));
            }
            return;
        }

        // HELO / EHLO 命令
        if (upperCmd.startsWith('HELO ') || upperCmd.startsWith('EHLO ')) {
            const domain = cmd.split(/\s+/)[1];
            if (domain && domain.includes('.')) {
                setSmtpState(prev => ({ ...prev, heloSent: true }));
                addToHistory('response', `250 mail.learnsite.edu Hello ${domain}`);
            } else {
                addToHistory('error', '501 Syntax error in parameters - 需要提供有效域名');
            }
            return;
        }

        // MAIL FROM 命令 - 必须是当前登录用户的邮箱
        if (upperCmd.startsWith('MAIL FROM:')) {
            if (!smtpState.heloSent) {
                addToHistory('error', '503 Error: send HELO/EHLO first');
                return;
            }
            const match = cmd.match(/<?([\w.-]+@[\w.-]+)>?/i);
            if (match) {
                const senderEmail = match[1].toLowerCase();
                if (senderEmail !== emailAddress.toLowerCase()) {
                    addToHistory('error', `553 Error: 您只能使用自己的邮箱发送 (${emailAddress})`);
                    return;
                }
                setSmtpState(prev => ({ ...prev, mailFrom: match[1] }));
                addToHistory('response', '250 OK');
            } else {
                addToHistory('error', '501 Syntax error - 格式: MAIL FROM: <email@domain>');
            }
            return;
        }

        // RCPT TO 命令
        if (upperCmd.startsWith('RCPT TO:')) {
            if (!smtpState.mailFrom) {
                addToHistory('error', '503 Error: need MAIL command first');
                return;
            }
            const match = cmd.match(/<?([\w.-]+@[\w.-]+)>?/i);
            if (match) {
                setSmtpState(prev => ({ ...prev, rcptTo: match[1] }));
                addToHistory('response', '250 OK');
            } else {
                addToHistory('error', '501 Syntax error - 格式: RCPT TO: <email@domain>');
            }
            return;
        }

        // DATA 命令
        if (upperCmd === 'DATA') {
            if (!smtpState.rcptTo) {
                addToHistory('error', '503 Error: need RCPT command first');
                return;
            }
            setSmtpState(prev => ({ ...prev, inDataMode: true, subject: '', body: [] }));
            addToHistory('response', '354 Start mail input; end with <CRLF>.<CRLF>');
            addToHistory('system', '提示: 先输入 "Subject: 主题" 设置标题，然后输入正文，最后输入单独的 . 结束');
            return;
        }

        // QUIT 命令
        if (upperCmd === 'QUIT') {
            addToHistory('response', '221 Bye');
            setConnected(false);
            return;
        }

        // RSET 命令
        if (upperCmd === 'RSET') {
            setSmtpState(prev => ({ ...prev, mailFrom: '', rcptTo: '', subject: '', body: [] }));
            addToHistory('response', '250 OK');
            return;
        }

        // NOOP 命令
        if (upperCmd === 'NOOP') {
            addToHistory('response', '250 OK');
            return;
        }

        // 未知命令
        addToHistory('error', '500 Syntax error, command unrecognized');
    };

    // 处理 POP3 命令
    const handlePop3Command = async (cmd) => {
        const upperCmd = cmd.toUpperCase();
        const parts = cmd.split(/\s+/);
        const command = parts[0].toUpperCase();

        // USER 命令 - 必须匹配当前登录用户
        if (command === 'USER') {
            const username = parts[1];
            if (!username) {
                addToHistory('error', '-ERR Missing username');
                return;
            }
            // 验证用户名必须匹配当前登录用户
            if (username.toLowerCase() !== emailUsername.toLowerCase()) {
                addToHistory('error', `-ERR 用户名不匹配，您的用户名是: ${emailUsername}`);
                return;
            }
            setPop3State(prev => ({ ...prev, user: username }));
            addToHistory('response', '+OK User accepted');
            return;
        }

        // PASS 命令
        if (command === 'PASS') {
            if (!pop3State.user) {
                addToHistory('error', '-ERR No username given');
                return;
            }
            // 模拟密码验证 - 任何密码都接受（教学目的）
            setAuthenticated(true);
            addToHistory('response', '+OK Logged in');
            return;
        }

        // 以下命令需要认证
        if (!authenticated) {
            addToHistory('error', '-ERR Not authenticated');
            return;
        }

        // STAT 命令
        if (command === 'STAT') {
            const activeEmails = pop3State.emails.filter(e => !pop3State.deletedIds.includes(e._id));
            const totalSize = activeEmails.reduce((sum, e) => sum + (e.content?.length || 0), 0);
            addToHistory('response', `+OK ${activeEmails.length} ${totalSize}`);
            return;
        }

        // LIST 命令
        if (command === 'LIST') {
            const activeEmails = pop3State.emails.filter(e => !pop3State.deletedIds.includes(e._id));
            if (parts[1]) {
                const msgNum = parseInt(parts[1]);
                if (msgNum > 0 && msgNum <= activeEmails.length) {
                    const email = activeEmails[msgNum - 1];
                    addToHistory('response', `+OK ${msgNum} ${email.content?.length || 0}`);
                } else {
                    addToHistory('error', '-ERR No such message');
                }
            } else {
                let response = `+OK ${activeEmails.length} messages\n`;
                activeEmails.forEach((email, idx) => {
                    response += `${idx + 1} ${email.content?.length || 0}\n`;
                });
                response += '.';
                addToHistory('response', response);
            }
            return;
        }

        // RETR 命令 - 取回邮件
        if (command === 'RETR') {
            const msgNum = parseInt(parts[1]);
            const activeEmails = pop3State.emails.filter(e => !pop3State.deletedIds.includes(e._id));
            if (msgNum > 0 && msgNum <= activeEmails.length) {
                const email = activeEmails[msgNum - 1];
                // 获取完整邮件内容
                try {
                    const fullEmail = await emailAPI.getEmailById(email._id);
                    const emailText = `From: ${fullEmail.from}\nTo: ${fullEmail.to?.join(', ')}\nSubject: ${fullEmail.subject || '(无主题)'}\nDate: ${new Date(fullEmail.sentAt).toLocaleString()}\n\n${fullEmail.content || ''}\n.`;
                    addToHistory('response', '+OK Message follows');
                    addToHistory('email', emailText);
                } catch (error) {
                    addToHistory('error', '-ERR Failed to retrieve message');
                }
            } else {
                addToHistory('error', '-ERR No such message');
            }
            return;
        }

        // DELE 命令
        if (command === 'DELE') {
            const msgNum = parseInt(parts[1]);
            const activeEmails = pop3State.emails.filter(e => !pop3State.deletedIds.includes(e._id));
            if (msgNum > 0 && msgNum <= activeEmails.length) {
                const email = activeEmails[msgNum - 1];
                setPop3State(prev => ({ ...prev, deletedIds: [...prev.deletedIds, email._id] }));
                addToHistory('response', `+OK Message ${msgNum} marked for deletion`);
            } else {
                addToHistory('error', '-ERR No such message');
            }
            return;
        }

        // RSET 命令
        if (command === 'RSET') {
            setPop3State(prev => ({ ...prev, deletedIds: [] }));
            addToHistory('response', '+OK');
            return;
        }

        // QUIT 命令
        if (command === 'QUIT') {
            // 真正删除标记的邮件
            for (const id of pop3State.deletedIds) {
                try {
                    await emailAPI.deleteEmail(id);
                } catch (error) {
                    console.error('删除邮件失败:', error);
                }
            }
            addToHistory('response', '+OK Logging out');
            setConnected(false);
            setAuthenticated(false);
            if (onSendSuccess) onSendSuccess(); // 刷新邮件列表
            return;
        }

        // NOOP 命令
        if (command === 'NOOP') {
            addToHistory('response', '+OK');
            return;
        }

        // 未知命令
        addToHistory('error', '-ERR Unknown command');
    };

    // 处理命令输入
    const handleCommand = (e) => {
        // 上下键浏览历史命令
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
            return;
        }

        if (e.key !== 'Enter' || !input.trim()) return;

        const cmd = input.trim();

        // 记录命令历史
        setCommandHistory(prev => [...prev, cmd]);
        setHistoryIndex(-1);

        addToHistory('input', cmd);
        setInput('');

        // 未连接状态下处理 telnet 等命令
        if (!connected) {
            handlePreConnectCommand(cmd);
            return;
        }

        if (mode === 'smtp') {
            handleSmtpCommand(cmd);
        } else {
            handlePop3Command(cmd);
        }
    };

    // 获取当前提示
    const getCurrentHint = () => {
        // 未连接状态
        if (!connected) {
            return {
                hint: '使用 telnet 命令连接邮件服务器',
                examples: [`telnet mail.learnsite.edu ${mode === 'smtp' ? '25' : '110'}`]
            };
        }

        if (mode === 'smtp') {
            if (smtpState.inDataMode) {
                if (!smtpState.subject) {
                    return { hint: '先设置邮件主题（可选）', examples: ['Subject: 你好', '或直接输入正文'] };
                }
                return { hint: '输入邮件正文，输入 . 发送', examples: ['这是邮件正文', '可以多行', '.'] };
            }
            if (!smtpState.heloSent) {
                return { hint: '先向服务器打招呼', examples: ['HELO learnsite.edu', 'EHLO learnsite.edu'] };
            }
            if (!smtpState.mailFrom) {
                return { hint: '设置发件人', examples: [`MAIL FROM: <${emailAddress}>`] };
            }
            if (!smtpState.rcptTo) {
                return { hint: '设置收件人', examples: ['RCPT TO: <teacher@learnsite.edu>'] };
            }
            return { hint: '开始写邮件或退出', examples: ['DATA', 'QUIT'] };
        } else {
            if (!pop3State.user) {
                return { hint: '输入用户名', examples: [`USER ${emailUsername}`] };
            }
            if (!authenticated) {
                return { hint: '输入密码', examples: ['PASS 123456'] };
            }
            return { hint: '查看或操作邮件', examples: ['STAT', 'LIST', 'RETR 1', 'DELE 1', 'QUIT'] };
        }
    };

    const hint = getCurrentHint();

    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', background: '#1a1a2e' }}>
            {/* 左侧终端 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
                {/* 模式切换 */}
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                        <Button
                            type={mode === 'smtp' ? 'primary' : 'default'}
                            icon={<SendOutlined />}
                            onClick={() => handleModeChange('smtp')}
                        >
                            发送邮件 (SMTP)
                        </Button>
                        <Button
                            type={mode === 'pop3' ? 'primary' : 'default'}
                            icon={<InboxOutlined />}
                            onClick={() => handleModeChange('pop3')}
                        >
                            接收邮件 (POP3)
                        </Button>
                        <Button onClick={resetSimulation}>重置</Button>
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/student')}
                        >
                            返回首页
                        </Button>
                    </Space>
                    {isTeacher && onExitTerminal && (
                        <Button type="default" danger onClick={onExitTerminal}>
                            退出命令行模式
                        </Button>
                    )}
                </div>

                {/* 终端窗口 */}
                <div
                    ref={terminalRef}
                    onClick={() => inputRef.current?.focus()}
                    style={{
                        flex: 1,
                        background: '#0d0d1a',
                        borderRadius: 8,
                        padding: 16,
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: 14,
                        color: '#00ff00',
                        overflow: 'auto',
                        border: '1px solid #333',
                        cursor: 'text'
                    }}
                >
                    {!connected ? (
                        <>
                            {history.length === 0 && (
                                <div style={{ textAlign: 'center', paddingTop: 40 }}>
                                    <CodeOutlined style={{ fontSize: 48, color: '#666', marginBottom: 16 }} />
                                    <div style={{ color: '#888', marginBottom: 8 }}>
                                        {mode === 'smtp' ? 'SMTP 发信协议终端' : 'POP3 收信协议终端'}
                                    </div>
                                    <div style={{ color: '#00ff00', marginBottom: 8, fontFamily: 'Consolas, monospace' }}>
                                        请输入: telnet mail.learnsite.edu {mode === 'smtp' ? '25' : '110'}
                                    </div>
                                </div>
                            )}
                            {history.map((item, index) => (
                                <div key={index} style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                                    {item.type === 'input' && (
                                        <span style={{ color: '#00ff00' }}>
                                            <span style={{ color: '#888' }}>{'> '}</span>
                                            {item.text}
                                        </span>
                                    )}
                                    {item.type === 'response' && (
                                        <span style={{ color: '#00bfff' }}>{item.text}</span>
                                    )}
                                    {item.type === 'system' && (
                                        <span style={{ color: '#888' }}>{item.text}</span>
                                    )}
                                    {item.type === 'error' && (
                                        <span style={{ color: '#ff4444' }}>{item.text}</span>
                                    )}
                                </div>
                            ))}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ color: '#888' }}>{'> '}</span>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleCommand}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: '#00ff00',
                                        fontFamily: 'inherit',
                                        fontSize: 'inherit'
                                    }}
                                    autoFocus
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {history.map((item, index) => (
                                <div key={index} style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                                    {item.type === 'input' && (
                                        <span style={{ color: '#00ff00' }}>
                                            <span style={{ color: '#888' }}>{'> '}</span>
                                            {item.text}
                                        </span>
                                    )}
                                    {item.type === 'response' && (
                                        <span style={{ color: '#00bfff' }}>{item.text}</span>
                                    )}
                                    {item.type === 'system' && (
                                        <span style={{ color: '#888' }}>{item.text}</span>
                                    )}
                                    {item.type === 'error' && (
                                        <span style={{ color: '#ff4444' }}>{item.text}</span>
                                    )}
                                    {item.type === 'success' && (
                                        <span style={{ color: '#44ff44' }}>{item.text}</span>
                                    )}
                                    {item.type === 'email' && (
                                        <pre style={{ color: '#ffcc00', margin: '8px 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{item.text}</pre>
                                    )}
                                </div>
                            ))}

                            {connected && (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ color: '#888' }}>{'> '}</span>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleCommand}
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: '#00ff00',
                                            fontFamily: 'inherit',
                                            fontSize: 'inherit'
                                        }}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 右侧协议参考面板 */}
            <div style={{ width: 300, background: '#16213e', padding: 16, overflow: 'auto' }}>
                <Title level={5} style={{ color: '#fff', marginBottom: 16 }}>
                    <QuestionCircleOutlined /> 命令参考
                </Title>

                {/* 当前用户邮箱 */}
                <div style={{
                    padding: '8px 12px',
                    background: '#0d0d1a',
                    borderRadius: 4,
                    marginBottom: 16,
                    border: '1px solid #333'
                }}>
                    <Text style={{ color: '#888', fontSize: 12 }}>当前账户</Text>
                    <div style={{ color: '#00ff00', fontFamily: 'Consolas, monospace', marginTop: 4 }}>
                        {emailAddress}
                    </div>
                    <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                        用户名: {emailUsername}
                    </div>
                </div>

                <Alert
                    type="info"
                    showIcon
                    message={mode === 'smtp' ? 'SMTP 发信模式' : 'POP3 收信模式'}
                    description={mode === 'smtp'
                        ? '使用SMTP协议向真实邮箱发送邮件'
                        : '使用POP3协议查看和管理收件箱'}
                    style={{ marginBottom: 16 }}
                />

                {hint && (
                    <div style={{
                        padding: 12,
                        background: '#0d0d1a',
                        borderRadius: 4,
                        marginBottom: 16,
                        border: '1px solid #1890ff'
                    }}>
                        <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>💡 下一步</Text>
                        <div style={{ color: '#ccc', marginTop: 8 }}>{hint.hint}</div>
                        <div style={{ marginTop: 8 }}>
                            {hint.examples.map((ex, i) => (
                                <Tag key={i} color="green" style={{ marginBottom: 4 }}>{ex}</Tag>
                            ))}
                        </div>
                    </div>
                )}

                <Divider style={{ borderColor: '#333' }} />

                <Title level={5} style={{ color: '#fff', marginBottom: 12 }}>
                    {mode === 'smtp' ? 'SMTP 命令' : 'POP3 命令'}
                </Title>

                {mode === 'smtp' ? (
                    <Collapse
                        ghost
                        size="small"
                        expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} style={{ color: '#fff' }} />}
                        items={[
                            {
                                key: 'telnet',
                                label: <Text code style={{ color: '#00ff00' }}>telnet host port</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>连接到邮件服务器</p>
                                        <p><b>参数：</b>host=服务器地址, port=端口号(SMTP通常为25)</p>
                                        <p><b>示例：</b><Tag color="green">telnet mail.learnsite.edu 25</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'helo',
                                label: <Text code style={{ color: '#00ff00' }}>HELO domain</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>向邮件服务器打招呼，建立会话</p>
                                        <p><b>参数：</b>domain=您的域名或主机名</p>
                                        <p><b>响应：</b>250 OK 表示成功</p>
                                        <p><b>示例：</b><Tag color="green">HELO learnsite.edu</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'mailfrom',
                                label: <Text code style={{ color: '#00ff00' }}>MAIL FROM: &lt;email&gt;</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>指定发件人的邮箱地址</p>
                                        <p><b>格式：</b>邮箱地址需用尖括号包裹</p>
                                        <p><b>注意：</b>必须使用您的真实邮箱地址</p>
                                        <p><b>示例：</b><Tag color="green">MAIL FROM: &lt;{emailAddress}&gt;</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'rcptto',
                                label: <Text code style={{ color: '#00ff00' }}>RCPT TO: &lt;email&gt;</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>指定收件人的邮箱地址</p>
                                        <p><b>格式：</b>邮箱地址需用尖括号包裹</p>
                                        <p><b>多收件人：</b>可多次执行RCPT TO命令</p>
                                        <p><b>示例：</b><Tag color="green">RCPT TO: &lt;teacher@learnsite.edu&gt;</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'data',
                                label: <Text code style={{ color: '#00ff00' }}>DATA</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>开始输入邮件内容</p>
                                        <p><b>响应：</b>354 表示可以开始写信</p>
                                        <p><b>邮件头：</b>先输入 "Subject: 主题"</p>
                                        <p><b>邮件体：</b>空一行后输入正文</p>
                                        <p><b>结束：</b>单独输入 "." 结束并发送</p>
                                    </div>
                                )
                            },
                            {
                                key: 'quit',
                                label: <Text code style={{ color: '#00ff00' }}>QUIT</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>断开与服务器的连接</p>
                                        <p><b>响应：</b>221 Bye 表示断开成功</p>
                                    </div>
                                )
                            }
                        ]}
                    />
                ) : (
                    <Collapse
                        ghost
                        size="small"
                        expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} style={{ color: '#fff' }} />}
                        items={[
                            {
                                key: 'telnet',
                                label: <Text code style={{ color: '#00ff00' }}>telnet host port</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>连接到邮件服务器</p>
                                        <p><b>参数：</b>host=服务器地址, port=端口号(POP3通常为110)</p>
                                        <p><b>示例：</b><Tag color="green">telnet mail.learnsite.edu 110</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'user',
                                label: <Text code style={{ color: '#00ff00' }}>USER username</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>告诉服务器您的用户名</p>
                                        <p><b>参数：</b>您的邮箱用户名(不含@后缀)</p>
                                        <p><b>响应：</b>+OK 表示用户名被接受</p>
                                        <p><b>示例：</b><Tag color="green">USER {emailUsername}</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'pass',
                                label: <Text code style={{ color: '#00ff00' }}>PASS password</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>验证您的身份</p>
                                        <p><b>参数：</b>您的邮箱密码</p>
                                        <p><b>响应：</b>+OK Logged in 表示登录成功</p>
                                        <p><b>示例：</b><Tag color="green">PASS 123456</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'stat',
                                label: <Text code style={{ color: '#00ff00' }}>STAT</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>查看邮箱统计信息</p>
                                        <p><b>响应格式：</b>+OK 邮件数 总字节数</p>
                                        <p><b>示例响应：</b>+OK 5 12800 (表示5封邮件总12800字节)</p>
                                    </div>
                                )
                            },
                            {
                                key: 'list',
                                label: <Text code style={{ color: '#00ff00' }}>LIST [n]</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>列出邮件清单或查看某封邮件信息</p>
                                        <p><b>无参数：</b>列出所有邮件的编号和大小</p>
                                        <p><b>有参数：</b>查看第n封邮件的大小</p>
                                        <p><b>示例：</b><Tag color="green">LIST</Tag> 或 <Tag color="green">LIST 1</Tag></p>
                                    </div>
                                )
                            },
                            {
                                key: 'retr',
                                label: <Text code style={{ color: '#00ff00' }}>RETR n</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>读取第n封邮件的完整内容</p>
                                        <p><b>参数：</b>邮件编号(从1开始)</p>
                                        <p><b>响应：</b>显示邮件头和正文，以.结束</p>
                                        <p><b>示例：</b><Tag color="green">RETR 1</Tag> (读取第1封)</p>
                                    </div>
                                )
                            },
                            {
                                key: 'dele',
                                label: <Text code style={{ color: '#00ff00' }}>DELE n</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>标记第n封邮件为删除</p>
                                        <p><b>注意：</b>不会立即删除，QUIT后才执行</p>
                                        <p><b>撤销：</b>使用RSET命令可取消所有删除标记</p>
                                        <p><b>示例：</b><Tag color="green">DELE 2</Tag> (删除第2封)</p>
                                    </div>
                                )
                            },
                            {
                                key: 'quit',
                                label: <Text code style={{ color: '#00ff00' }}>QUIT</Text>,
                                children: (
                                    <div style={{ color: '#888', fontSize: 12 }}>
                                        <p><b>功能：</b>退出并执行删除操作</p>
                                        <p><b>重要：</b>此时才会真正删除DELE标记的邮件</p>
                                        <p><b>响应：</b>+OK Logging out</p>
                                    </div>
                                )
                            }
                        ]}
                    />
                )}
            </div>
        </div>
    );
};

export default TerminalSimulator;
