import React, { useState, useEffect, useRef } from 'react';
import { Button, Steps, Select, Input, Card, Tag, message, Divider, Collapse, Table } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CodeOutlined,
    ApartmentOutlined,
    SearchOutlined,
    ConsoleSqlOutlined,
    ArrowRightOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    GlobalOutlined,
    SwapOutlined,
    WifiOutlined,
    LinkOutlined,
    ThunderboltOutlined,
    ShoppingOutlined,
    CarOutlined,
    FileTextOutlined,
    DropboxOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

const ProtocolAnalyzer = ({ onComplete }) => {
    const [currentStage, setCurrentStage] = useState(0);

    // --- Stage 1: Encoding State ---
    const [encodingInput, setEncodingInput] = useState('Hello');
    const [senderProtocol, setSenderProtocol] = useState('utf8');
    const [receiverProtocol, setReceiverProtocol] = useState('utf8');
    const [encodedData, setEncodedData] = useState('');
    const [decodedData, setDecodedData] = useState('');
    const [encodingStatus, setEncodingStatus] = useState('idle');

    // --- Stage 2: Layering State ---
    const [layeringStep, setLayeringStep] = useState(0);

    // --- Stage 3: Analysis State ---
    const [selectedPacketId, setSelectedPacketId] = useState('http');

    // --- Stage 4: Netstat State ---
    const [terminalInput, setTerminalInput] = useState('');
    const [terminalOutput, setTerminalOutput] = useState([]);
    const terminalEndRef = useRef(null);

    // --- Logic: Stage 1 Encoding ---
    const handleEncodingSend = () => {
        if (!encodingInput) return message.warning('请输入要发送的信息');
        setEncodingStatus('sent');

        // Simulate Encoding
        let binary = '';
        if (senderProtocol === 'utf8') {
            for (let i = 0; i < encodingInput.length; i++) {
                binary += encodingInput.charCodeAt(i).toString(2).padStart(8, '0') + ' ';
            }
        } else if (senderProtocol === 'custom1') {
            // Simple Shift
            for (let i = 0; i < encodingInput.length; i++) {
                binary += (encodingInput.charCodeAt(i) + 1).toString(2).padStart(8, '0') + ' ';
            }
        }
        setEncodedData(binary.trim());

        setTimeout(() => {
            if (senderProtocol === receiverProtocol) {
                setDecodedData(encodingInput);
                message.success('通信成功！协议一致。');
            } else {
                // Garbage generation
                let garbage = '';
                for (let i = 0; i < encodingInput.length; i++) {
                    garbage += String.fromCharCode(Math.floor(Math.random() * 26) + 65); // Random A-Z
                }
                setDecodedData(garbage + ' (乱码??)');
                message.error('通信失败！解码规则不匹配。');
            }
            setEncodingStatus('received');
        }, 1200);
    };

    // --- Logic: Stage 4 Netstat ---
    const handleTerminalCommand = (e) => {
        if (e.key === 'Enter') {
            const cmd = terminalInput.trim().toLowerCase();
            const newOutput = [...terminalOutput, `C:\\Users\\Student> ${terminalInput}`];

            if (cmd === 'netstat -an') {
                newOutput.push(
                    'Active Connections',
                    '',
                    '  Proto  Local Address          Foreign Address        State',
                    '  TCP    192.168.1.105:52431    203.0.113.1:80         ESTABLISHED',
                    '  TCP    192.168.1.105:52432    198.51.100.2:443       TIME_WAIT',
                    '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING',
                    '  UDP    0.0.0.0:445            *:*                    ',
                    '  UDP    127.0.0.1:1900         *:*                    '
                );
            } else if (cmd === 'help') {
                newOutput.push('可用命令: netstat -an, cls (清屏)');
            } else if (cmd === 'cls') {
                setTerminalOutput([]);
                setTerminalInput('');
                return;
            } else {
                newOutput.push(`'${cmd}' 不是内部或外部命令，也不是可运行的程序。`);
            }

            setTerminalOutput(newOutput);
            setTerminalInput('');

            // Auto scroll
            setTimeout(() => {
                terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    };

    // --- Renderers (Refined for Dark Theme) ---

    // Common Card Style for Dark Theme
    const cardStyle = {
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#fff'
    };

    const renderStage1 = () => (
        <div className="stage-content" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
            <div className="textbook-activity-header">
                <Tag color="#1890ff" style={{ fontSize: 14, padding: '4px 10px' }}>活动 1</Tag>
                <div style={{ flex: 1 }}>
                    <div className="title" style={{ color: '#fff', fontSize: 18 }}>网络协议的作用：编码与解码</div>
                    <div className="desc" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>
                        计算机底层只认识0和1。不同设备间要通信，必须约定好“如何把文字变成01（编码）”和“如何把01变回文字（解码）”，这个约定就是协议。
                    </div>
                </div>
            </div>

            <div className="encoding-lab-container" style={{ display: 'flex', gap: 24, alignItems: 'stretch', marginTop: 24 }}>
                <Card title={<span style={{ color: '#fff' }}>发送者 (Sender)</span>} style={{ ...cardStyle, flex: 1 }} headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }} bodyStyle={{ minHeight: 280 }}>
                    <div style={{ marginBottom: 20 }}>
                        <span className="label" style={{ color: '#40a9ff', display: 'block', marginBottom: 8 }}>输入信息:</span>
                        <Input
                            value={encodingInput}
                            onChange={e => setEncodingInput(e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid #434343', color: '#fff' }}
                        />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <span className="label" style={{ color: '#40a9ff', display: 'block', marginBottom: 8 }}>编码协议:</span>
                        <Select
                            value={senderProtocol}
                            onChange={setSenderProtocol}
                            style={{ width: '100%' }}
                            dropdownStyle={{ background: '#1f1f2e', border: '1px solid #30303d' }}
                            popupClassName="protocol-lab-dropdown"
                        >
                            <Option value="utf8">标准协议 (UTF-8)</Option>
                            <Option value="custom1">自定义协议 (移位)</Option>
                        </Select>
                    </div>
                    {encodingStatus !== 'idle' && (
                        <div className="binary-stream">
                            <div className="code-label" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>生成的二进制流:</div>
                            <div className="code-content" style={{ color: '#52c41a', fontFamily: 'monospace', wordBreak: 'break-all' }}>{encodedData}</div>
                        </div>
                    )}
                </Card>

                <div className="transmission-arrow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 100 }}>
                    {encodingStatus === 'idle' ? (
                        <div
                            onClick={handleEncodingSend}
                            style={{
                                width: 60, height: 60, borderRadius: '50%', background: '#1890ff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 0 15px rgba(24,144,255,0.5)',
                                transition: 'all 0.3s'
                            }}
                        >
                            <ArrowRightOutlined style={{ fontSize: 24, color: '#fff' }} />
                        </div>
                    ) : (
                        <div className={`status-icon ${encodingStatus}`} style={{ textAlign: 'center' }}>
                            {encodingStatus === 'sent' ? (
                                <div style={{ color: '#1890ff' }}>传送中...</div>
                            ) : (
                                senderProtocol === receiverProtocol ?
                                    <div style={{ textAlign: 'center' }}>
                                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 32, marginBottom: 8 }} />
                                        <div style={{ color: '#52c41a' }}>成功</div>
                                    </div>
                                    :
                                    <div style={{ textAlign: 'center' }}>
                                        <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 32, marginBottom: 8 }} />
                                        <div style={{ color: '#ff4d4f' }}>失败</div>
                                    </div>
                            )}
                            {encodingStatus === 'received' && (
                                <Button size="small" type="ghost" onClick={() => setEncodingStatus('idle')} style={{ marginTop: 12, color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)' }}>重置</Button>
                            )}
                        </div>
                    )}
                </div>

                <Card title={<span style={{ color: '#fff' }}>接收者 (Receiver)</span>} style={{ ...cardStyle, flex: 1 }} headStyle={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }} bodyStyle={{ minHeight: 280 }}>
                    <div style={{ marginBottom: 20 }}>
                        <span className="label" style={{ color: '#40a9ff', display: 'block', marginBottom: 8 }}>解码协议:</span>
                        <Select
                            value={receiverProtocol}
                            onChange={setReceiverProtocol}
                            style={{ width: '100%' }}
                            dropdownStyle={{ background: '#1f1f2e', border: '1px solid #30303d' }}
                            popupClassName="protocol-lab-dropdown"
                        >
                            <Option value="utf8">标准协议 (UTF-8)</Option>
                            <Option value="custom1">自定义协议 (移位)</Option>
                        </Select>
                    </div>
                    <div className="receive-box">
                        <span className="label" style={{ color: '#40a9ff', display: 'block', marginBottom: 8 }}>解码结果:</span>
                        <div className={`result-display`} style={{
                            minHeight: 40, padding: 10, borderRadius: 4,
                            background: encodingStatus === 'received' ? (senderProtocol === receiverProtocol ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)') : 'rgba(0,0,0,0.2)',
                            border: `1px solid ${encodingStatus === 'received' ? (senderProtocol === receiverProtocol ? '#52c41a' : '#ff4d4f') : 'rgba(255,255,255,0.1)'}`,
                            color: '#fff'
                        }}>
                            {encodingStatus === 'received' ? decodedData : <span style={{ color: 'rgba(255,255,255,0.3)' }}>等待接收...</span>}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="concept-card">
                <div className="concept-title"><CodeOutlined /> 知识点：字符集与编码</div>
                <div className="concept-text">
                    计算机内部所有信息最终都表示为一个二进制字符串。每一个二进制位（bit）有0和1两种状态。
                    <b>UTF-8</b> 是一种变长字符编码，可以表示世界上几乎所有的字符。如果发送方和接收方使用的“密码本”（协议）不一致，就会出现乱码。
                </div>
            </div>
        </div>
    );

    const renderStage2 = () => {
        const layers = [
            { name: '应用层 (Data)', color: '#ff7875', icon: <ShoppingOutlined />, analogy: '商品: 书籍' }, // Red-ish
            { name: '传输层 (TCP)', color: '#ffc53d', icon: <DropboxOutlined />, analogy: '包裹: 防震填充' }, // Yellow
            { name: '网络层 (IP)', color: '#bae637', icon: <FileTextOutlined />, analogy: '快递单: 地址信息' }, // Lime
            { name: '接口层 (Frame)', color: '#36cfc9', icon: <CarOutlined />, analogy: '运输车: 物理送达' }, // Cyan
        ];

        return (
            <div className="stage-content" style={{ background: 'transparent', padding: 0 }}>
                <div className="textbook-activity-header">
                    <Tag color="#1890ff" style={{ fontSize: 14, padding: '4px 10px' }}>活动 2</Tag>
                    <div style={{ flex: 1 }}>
                        <div className="title" style={{ color: '#fff', fontSize: 18 }}>网络分层思想：快递包裹的旅程</div>
                        <div className="desc" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>
                            为了解决复杂的通信问题，我们将网络分为多层。
                            这就像发快递：商品(数据) &rarr; 打包(传输层) &rarr; 贴单(网络层) &rarr; 装车(接口层)。每一层都给数据加一个“信封”(头部)。
                        </div>
                    </div>
                </div>

                <div className="layer-comparison">
                    <div className="layer-stack network">
                        <h4 style={{ color: '#fff', textAlign: 'center', marginBottom: 16 }}>计算机网络协议 (TCP/IP)</h4>
                        {layers.map((l, i) => (
                            <div key={i} className={`layer-box ${layeringStep >= i ? 'active' : ''}`} style={{
                                borderColor: l.color,
                                background: layeringStep >= i ? `linear-gradient(90deg, ${l.color}22, transparent)` : 'transparent',
                                opacity: layeringStep >= i ? 1 : 0.3
                            }}>
                                <span className="layer-icon" style={{ background: l.color, color: '#000' }}>{l.icon}</span>
                                <span className="layer-name" style={{ color: '#fff' }}>{l.name}</span>
                            </div>
                        ))}
                    </div>

                    <div className="layer-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Button type="primary" shape="circle" icon={<ArrowRightOutlined rotate={90} />} size="large" onClick={() => setLayeringStep(p => p < 3 ? p + 1 : 0)} style={{ marginBottom: 16 }} />
                        <div style={{ color: 'rgba(255,255,255,0.8)' }}>{layeringStep === 3 ? '重新打包' : '下一步封装'}</div>
                    </div>

                    <div className="layer-stack analogy">
                        <h4 style={{ color: '#fff', textAlign: 'center', marginBottom: 16 }}>生活类比 (快递配送)</h4>
                        {layers.map((l, i) => (
                            <div key={i} className={`layer-box ${layeringStep >= i ? 'active' : ''}`} style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', opacity: layeringStep >= i ? 1 : 0.3 }}>
                                <span className="layer-name" style={{ color: '#fff' }}>{l.analogy}</span>
                                {layeringStep >= i && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 'auto' }} />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="concept-card">
                    <div className="concept-title"><ApartmentOutlined /> 知识点：封装与分层</div>
                    <div className="concept-text">
                        <b>封装 (Encapsulation)</b>：就像寄快递要套纸箱、贴运单一样，数据在发送前需要经过层层包装，每经过一层及其协议，就加上该层的“头部信息”。
                        <br />
                        TCP/IP 模型通常分为四层，从上到下分别是：应用层（处理数据）、传输层（保证可靠传输）、网络层（负责寻址IP）、接口层（物理传输）。
                    </div>
                </div>
            </div>
        );
    };

    const renderStage3 = () => (
        <div className="stage-content" style={{ background: 'transparent', padding: 0 }}>
            <div className="textbook-activity-header">
                <Tag color="#1890ff" style={{ fontSize: 14, padding: '4px 10px' }}>活动 3</Tag>
                <div style={{ flex: 1 }}>
                    <div className="title" style={{ color: '#fff', fontSize: 18 }}>网络协议分析：识别数据包</div>
                    <div className="desc" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>
                        数据包在网络中传输时，包含了各层的头部信息。我们可以通过分析这些头部，知道是谁发的(IP)、什么程序发的(Port)以及要做什么(Protocol)。
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
                <div style={{ width: 240 }}>
                    <div style={{ color: '#40a9ff', marginBottom: 8 }}>选择抓取的数据包:</div>
                    <Select
                        value={selectedPacketId}
                        onChange={setSelectedPacketId}
                        style={{ width: '100%' }}
                        dropdownStyle={{ background: '#1f1f2e', border: '1px solid #30303d' }}
                        popupClassName="protocol-lab-dropdown"
                    >
                        <Option value="http">HTTP 网页请求包</Option>
                        <Option value="dns">DNS 域名查询包</Option>
                    </Select>
                </div>
                <div style={{ flex: 1, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, background: 'rgba(0,0,0,0.2)' }}>
                    {selectedPacketId === 'http' ? (
                        <div className="packet-viewer">
                            <div className="packet-layer" style={{ background: 'rgba(54, 207, 201, 0.2)', border: '1px solid #36cfc9' }}>
                                <div className="p-title" style={{ color: '#36cfc9' }}><LinkOutlined /> 接口层 (Ethernet)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>源MAC: A1-B2-C3... &rarr; 目的MAC: D4-E5-F6...</div>
                            </div>
                            <div className="packet-layer" style={{ background: 'rgba(186, 230, 55, 0.2)', border: '1px solid #bae637' }}>
                                <div className="p-title" style={{ color: '#bae637' }}><WifiOutlined /> 网络层 (IP)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>源IP: 192.168.1.5 &rarr; 目的IP: 142.250.1.1</div>
                            </div>
                            <div className="packet-layer" style={{ background: 'rgba(255, 236, 61, 0.2)', border: '1px solid #ffec3d' }}>
                                <div className="p-title" style={{ color: '#ffec3d' }}><SwapOutlined /> 传输层 (TCP)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>源端口: 53210 &rarr; 目的端口: 80 (HTTP)</div>
                            </div>
                            <div className="packet-layer" style={{ background: 'rgba(255, 120, 117, 0.2)', border: '1px solid #ff7875' }}>
                                <div className="p-title" style={{ color: '#ff7875' }}><GlobalOutlined /> 应用层 (HTTP)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>GET /index.html HTTP/1.1</div>
                            </div>
                        </div>
                    ) : (
                        <div className="packet-viewer">
                            <div className="packet-layer" style={{ background: 'rgba(54, 207, 201, 0.2)', border: '1px solid #36cfc9' }}>
                                <div className="p-title" style={{ color: '#36cfc9' }}><LinkOutlined /> 接口层 (Ethernet)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>源MAC: ... &rarr; 目的MAC: ...</div>
                            </div>
                            <div className="packet-layer" style={{ background: 'rgba(186, 230, 55, 0.2)', border: '1px solid #bae637' }}>
                                <div className="p-title" style={{ color: '#bae637' }}><WifiOutlined /> 网络层 (IP)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>源IP: 192.168.1.5 &rarr; 目的IP: 8.8.8.8</div>
                            </div>
                            <div className="packet-layer" style={{ background: 'rgba(255, 236, 61, 0.2)', border: '1px solid #ffec3d' }}>
                                <div className="p-title" style={{ color: '#ffec3d' }}><SwapOutlined /> 传输层 (UDP)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>源端口: 45678 &rarr; 目的端口: 53 (DNS)</div>
                            </div>
                            <div className="packet-layer" style={{ background: 'rgba(255, 120, 117, 0.2)', border: '1px solid #ff7875' }}>
                                <div className="p-title" style={{ color: '#ff7875' }}><GlobalOutlined /> 应用层 (DNS)</div>
                                <div className="p-detail" style={{ color: '#fff' }}>Query: www.google.com (Type A)</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="concept-card">
                <div className="concept-title"><SearchOutlined /> 知识点：协议识别</div>
                <div className="concept-text">
                    计算机如何知道接收到的这一串0和1是图片、网页还是邮件？秘密就在<b>端口号</b>和<b>协议头</b>。
                    例如，<b>Port 80</b> 通常对应 <b>HTTP</b> (网页)，<b>Port 53</b> 对应 <b>DNS</b> (域名解析)。
                </div>
            </div>
        </div>
    );

    const renderStage4 = () => (
        <div className="stage-content" style={{ background: 'transparent', padding: 0 }}>
            <div className="textbook-activity-header">
                <Tag color="#1890ff" style={{ fontSize: 14, padding: '4px 10px' }}>活动 4</Tag>
                <div style={{ flex: 1 }}>
                    <div className="title" style={{ color: '#fff', fontSize: 18 }}>查看网络状态 (Netstat)</div>
                    <div className="desc" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>
                        想知道你的电脑正在和谁通信吗？在终端输入 <code>netstat -an</code> 命令，可以列出所有正在建立的连接。
                    </div>
                </div>
            </div>

            <div className="netstat-container">
                <div className="terminal-window">
                    <div className="terminal-header">
                        <div className="circle red"></div>
                        <div className="circle yellow"></div>
                        <div className="circle green"></div>
                        <span style={{ marginLeft: 10, fontFamily: 'monospace' }}>Command Prompt - Administrator</span>
                    </div>
                    <div className="terminal-body" onClick={() => document.getElementById('cmd-input')?.focus()} style={{ color: '#ccc' }}>
                        {terminalOutput.map((line, i) => (
                            <div key={i} className="terminal-line"><pre>{line}</pre></div>
                        ))}
                        <div className="input-line">
                            <span>C:\Users\Student&gt;</span>
                            <input
                                id="cmd-input"
                                type="text"
                                value={terminalInput}
                                onChange={e => setTerminalInput(e.target.value)}
                                onKeyDown={handleTerminalCommand}
                                autoComplete="off"
                                autoFocus
                                style={{ caretColor: '#fff', color: '#fff' }}
                            />
                        </div>
                        <div ref={terminalEndRef}></div>
                    </div>
                </div>

                <div className="analysis-panel">
                    <div className="analysis-card">
                        <h5><ConsoleSqlOutlined /> 结果解读指南</h5>
                        <p>
                            <span className="highlight-term">Active Connections</span>: 当前活动的连接列表。<br /><br />
                            <span className="highlight-term">Proto</span>: 协议类型 (TCP/UDP)。TCP 是可靠连接，UDP 是快速传输。<br /><br />
                            <span className="highlight-term">Local Address</span>: 本机地址。IP:端口 (例如 192.168.1.105:52431)。<br /><br />
                            <span className="highlight-term">Foreign Address</span>: 远程地址。你正在连接的目标。<br /><br />
                            <span className="highlight-term">State</span>: 连接状态。<br />
                            - <b>ESTABLISHED</b>: 已建立连接，正在通信。<br />
                            - <b>LISTENING</b>: 正在监听，等待别人连接。<br />
                            - <b>TIME_WAIT</b>: 连接已关闭，正在等待结束。
                        </p>
                    </div>
                    <div className="concept-card" style={{ marginTop: 0, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <div className="concept-title" style={{ fontSize: 13 }}>小贴士</div>
                        <div className="concept-text">
                            如果你发现有奇怪的 <b>Foreign Address</b> 连接，或者大量 <b>ESTABLISHED</b> 状态的未知连接，可能需要警惕网络安全风险哦！
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const stages = [
        { title: '协议基础', icon: <CodeOutlined /> },
        { title: '分层思想', icon: <ApartmentOutlined /> },
        { title: '协议分析', icon: <SearchOutlined /> },
        { title: '网络状态', icon: <ConsoleSqlOutlined /> },
    ];

    return (
        <div className="lab-workspace protocol-lab">

            {/* Steps Navigation */}
            <div className="lab-step-bar">
                <Steps current={currentStage} onChange={setCurrentStage} items={stages} />
            </div>

            {/* Main Content Area */}
            <div className="lab-main-content">
                {currentStage === 0 && renderStage1()}
                {currentStage === 1 && renderStage2()}
                {currentStage === 2 && renderStage3()}
                {currentStage === 3 && renderStage4()}
            </div>

            {/* Footer Navigation */}
            <div className="lab-footer">
                {currentStage > 0 && (
                    <Button onClick={() => setCurrentStage(c => c - 1)}>上一步</Button>
                )}
                {currentStage < stages.length - 1 && (
                    <Button type="primary" onClick={() => setCurrentStage(c => c + 1)}>下一步: {stages[currentStage + 1].title}</Button>
                )}
                {currentStage === stages.length - 1 && (
                    <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => onComplete && onComplete({})}>完成实验</Button>
                )}
            </div>

            {/* Inline CSS for this page (scoped to class) */}
            <style jsx>{`
                /* Global overrides for this component's dropdowns via overlay class */
                :global(.protocol-lab-dropdown .ant-select-item) {
                    color: #ffffff !important;
                    background: transparent;
                }
                :global(.protocol-lab-dropdown .ant-select-item-option) {
                    color: #ffffff !important;
                }
                :global(.protocol-lab-dropdown .ant-select-item-option-content) {
                    color: #ffffff !important;
                }
                :global(.protocol-lab-dropdown .ant-select-item-option-selected) {
                    background-color: #1890ff !important;
                    color: #ffffff !important;
                }
                :global(.protocol-lab-dropdown .ant-select-item-option-active) {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                    color: #ffffff !important;
                }
                :global(.protocol-lab-dropdown) {
                    background-color: #1f1f2e !important;
                    border: 1px solid #30303d;
                }

                .protocol-lab .lab-main-content {
                    padding: 24px;
                    overflow-y: auto;
                    background: transparent; /* Inherit global dark background */
                }
                .stage-content {
                    background: transparent;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: none;
                    min-height: 100%;
                    color: #fff;
                }
                .textbook-activity-header {
                    margin-bottom: 24px;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                }
                .textbook-activity-header .title {
                    font-size: 22px;
                    font-weight: bold;
                    color: #fff;
                    margin-bottom: 8px;
                }
                .textbook-activity-header .desc {
                    color: rgba(255, 255, 255, 0.85);
                    font-size: 15px;
                    line-height: 1.6;
                }
                
                .concept-card {
                    background: rgba(24, 144, 255, 0.1);
                    border: 1px solid rgba(24, 144, 255, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    margin-top: 20px;
                }
                .concept-title {
                    color: #40a9ff;
                    font-weight: bold;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .concept-text {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 13px;
                }

                /* Stage 1 */
                .binary-stream {
                    margin-top: 12px;
                    background: rgba(0, 0, 0, 0.2);
                    padding: 8px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 12px;
                    word-break: break-all;
                    color: #52c41a;
                }
                .transmission-arrow {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 120px;
                }
                
                /* Stage 2 */
                .layer-comparison {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 40px;
                    margin-top: 30px;
                }
                .layer-stack {
                    width: 280px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .layer-stack h4 { text-align: center; margin-bottom: 15px; color: #fff; font-size: 16px; }
                .layer-box {
                    padding: 14px;
                    border: 2px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    opacity: 0.3;
                    transition: all 0.3s;
                    background: rgba(255,255,255,0.02);
                }
                .layer-box.active {
                    opacity: 1;
                    transform: scale(1.02);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }
                .layer-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }
                .layer-name {
                    color: #fff;
                    font-weight: 500;
                }

                /* Stage 3 */
                .packet-viewer {
                    display: flex;
                    flex-direction: column-reverse; /* Physical at bottom, App at top */
                    gap: 6px;
                }
                .packet-layer {
                    padding: 14px;
                    border-radius: 6px;
                    color: #000;
                    margin-bottom: 2px;
                }
                .p-title { font-weight: bold; margin-bottom: 6px; font-size: 14px; }
                .p-detail { font-size: 13px; opacity: 0.95; font-family: 'Consolas', monospace; }

                /* Stage 4: Netstat Split Layout */
                .netstat-container {
                    display: flex;
                    gap: 24px;
                    align-items: flex-start;
                }
                .terminal-window {
                    flex: 2;
                    background: #1e1e1e;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    font-family: 'Consolas', monospace;
                    width: 100%;
                    border: 1px solid #333;
                }
                .terminal-header {
                    background: #2d2d2d;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #ccc;
                    font-size: 12px;
                    border-bottom: 1px solid #333;
                }
                .circle { width: 10px; height: 10px; border-radius: 50%; }
                .red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }
                .terminal-body {
                    padding: 12px;
                    min-height: 350px;
                    max-height: 450px;
                    overflow-y: auto;
                    color: #f1f1f1;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .terminal-line pre { 
                     margin: 0; 
                     white-space: pre-wrap; 
                     font-family: inherit;
                     line-height: 1.4;
                }
                .input-line { display: flex; align-items: center; margin-top: 4px; }
                .input-line input {
                    background: transparent !important;
                    border: none !important;
                    color: #fff;
                    flex: 1;
                    margin-left: 8px;
                    outline: none !important;
                    font-family: inherit;
                    caret-color: #fff;
                    box-shadow: none !important;
                }
                .analysis-panel {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .analysis-card {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 16px;
                }
                .analysis-card h5 {
                    color: #40a9ff;
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .analysis-card p {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 13px;
                    margin: 0;
                    line-height: 1.5;
                }
                .highlight-term {
                    color: #bae637;
                    font-family: monospace;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 0 4px;
                    border-radius: 2px;
                }

                .lab-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 20px;
                    padding: 20px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(0, 0, 0, 0.2);
                }
            `}</style>
        </div>
    );
};

export default ProtocolAnalyzer;
