import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Slider, Card, message, Divider, Tag } from 'antd';
import {
    PlayCircleOutlined,
    ReloadOutlined,
    CloudServerOutlined,
    DesktopOutlined,
    DatabaseOutlined,
    InfoCircleOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';

const StoreForwardSimulator = ({ onComplete }) => {
    const [messageText, setMessageText] = useState('HELLO');
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationSpeed, setSimulationSpeed] = useState(1);
    const [packets, setPackets] = useState([]);
    const [step, setStep] = useState(0); // 0: input, 1: simulation, 2: complete
    const [logs, setLogs] = useState([]);
    const [activePath, setActivePath] = useState([]);

    // Mesh Topology Definition
    /**
     * Layout:
     *      Router A (1) -- Router C (3)
     *     /               /     \
     * Sender (0) ---- Router B (2) ----- Receiver (5)
     *                     \     /
     *                      Router D (4)
     */
    const nodes = [
        { id: 0, label: '发送者', type: 'host', x: 50, y: 150, color: '#1890ff' },
        { id: 1, label: '路由器 A', type: 'router', x: 250, y: 80, color: '#fa8c16' },
        { id: 2, label: '路由器 B', type: 'router', x: 250, y: 220, color: '#fa8c16' },
        { id: 3, label: '路由器 C', type: 'router', x: 450, y: 80, color: '#fa8c16' },
        { id: 4, label: '路由器 D', type: 'router', x: 450, y: 220, color: '#fa8c16' },
        { id: 5, label: '接收者', type: 'host', x: 650, y: 150, color: '#52c41a' },
    ];

    const links = [
        { source: 0, target: 1 }, // S -> A
        { source: 0, target: 2 }, // S -> B
        { source: 1, target: 3 }, // A -> C
        { source: 2, target: 3 }, // B -> C
        { source: 2, target: 4 }, // B -> D
        { source: 3, target: 5 }, // C -> R
        { source: 4, target: 5 }, // D -> R
    ];

    // Defined paths for simulation
    const availablePaths = [
        { id: 'path1', nodes: [0, 1, 3, 5], desc: 'Sender -> Router A -> Router C -> Receiver' },
        { id: 'path2', nodes: [0, 2, 3, 5], desc: 'Sender -> Router B -> Router C -> Receiver' },
        { id: 'path3', nodes: [0, 2, 4, 5], desc: 'Sender -> Router B -> Router D -> Receiver' }
    ];

    const timerRef = useRef(null);

    useEffect(() => {
        if (logs.length === 0) {
            addLog('system', '网络拓扑构建完成。就绪。');
        }
    }, []);

    const addLog = (type, content) => {
        setLogs(prev => [{
            id: Date.now() + Math.random(),
            time: new Date().toLocaleTimeString(),
            type,
            content
        }, ...prev]);
    };

    const startSimulation = () => {
        if (!messageText.trim()) {
            message.warning('请输入要传输的数据');
            return;
        }

        setIsSimulating(true);
        setStep(1);
        setLogs([]);
        setActivePath([]);

        // Randomly select a path
        const randomPathIndex = Math.floor(Math.random() * availablePaths.length);
        const selectedPath = availablePaths[randomPathIndex];

        addLog('system', '开始存储转发实验...');
        addLog('action', `路由算法正在计算最佳路径...`);

        // Simulate a small "calculation" delay before starting
        setTimeout(() => {
            addLog('success', `路径确立: ${selectedPath.desc}`);
            addLog('info', `源数据: "${messageText}" 已准备发送`);
            simulateTransmission(selectedPath.nodes);
        }, 800);
    };

    const simulateTransmission = async (pathNodes) => {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms / simulationSpeed));

        // Loop through the path
        for (let i = 0; i < pathNodes.length - 1; i++) {
            const currentNodeId = pathNodes[i];
            const nextNodeId = pathNodes[i + 1];
            const startNode = nodes.find(n => n.id === currentNodeId);
            const endNode = nodes.find(n => n.id === nextNodeId);

            // 1. Transiting Phase (Link)
            setPackets([{
                id: 'pkt-1',
                text: messageText,
                fromNode: startNode,
                targetNode: endNode,
                status: 'transiting',
                progress: 0
            }]);

            // Mark link as active
            setActivePath(prev => [...prev, `${currentNodeId}-${nextNodeId}`]);
            addLog('action', `${startNode.label} 正在转发数据到 ${endNode.label}...`);

            // Animation loop for transit
            for (let p = 0; p <= 100; p += 2) {
                setPackets(prev => [{ ...prev[0], progress: p }]);
                await sleep(20);
            }

            // 2. Storing Phase (Node)
            setPackets([{
                id: 'pkt-1',
                text: messageText,
                currentNode: endNode,
                status: 'stored'
            }]);

            addLog('info', `${endNode.label} 已接收数据。`);

            if (i < pathNodes.length - 2) {
                // Add jitter to storage time (1000ms - 2000ms)
                const storageDelay = 1000 + Math.random() * 1000;
                addLog('loading', `${endNode.label} 正在存储并查询路由表... (预计耗时 ${(storageDelay / 1000).toFixed(1)}s)`);
                await sleep(storageDelay);
            } else {
                // Final destination
                addLog('success', `${endNode.label} 接收并重组数据成功！`);
                await sleep(500);
            }
        }

        finishSimulation(pathNodes);
    };

    const finishSimulation = (pathNodes) => {
        setIsSimulating(false);
        setStep(2);

        // Construct path string from IDs
        const pathStr = pathNodes.map(id => nodes.find(n => n.id === id).label).join(' -> ');

        message.success('传输完成！');
        // onComplete callback removed to disable popup report
    };

    const resetSimulation = () => {
        setIsSimulating(false);
        setStep(0);
        setPackets([]);
        setLogs([]);
        setActivePath([]);
        addLog('system', '实验已重置。');
    };

    return (
        <div className="store-forward-lab">
            {/* Control Panel */}
            <Card className="lab-control-card" bordered={false} style={{ marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="control-item">
                        <span className="label">发送数据: </span>
                        <Input
                            value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                            disabled={isSimulating || step === 2}
                            style={{ width: 180 }}
                            placeholder="输入简短文本"
                        />
                    </div>

                    <div className="control-item">
                        <span className="label">演示速度: x{simulationSpeed}</span>
                        <Slider
                            min={0.5}
                            max={3}
                            step={0.5}
                            value={simulationSpeed}
                            onChange={setSimulationSpeed}
                            style={{ width: 100, display: 'inline-block', marginLeft: 10, verticalAlign: 'middle' }}
                            disabled={isSimulating}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                        {!isSimulating && step === 0 && (
                            <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={startSimulation}>
                                开始传输
                            </Button>
                        )}
                        {(isSimulating || step === 2) && (
                            <Button size="large" icon={<ReloadOutlined />} onClick={resetSimulation}>
                                重置实验
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <div style={{ display: 'flex', gap: 20 }}>
                {/* Visualization Area */}
                <div className="simulation-area" style={{
                    flex: 2,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #eee',
                    height: 400,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 5 }}>
                        <Tag color="blue">拓扑结构: 网状网 (Mesh)</Tag>
                    </div>

                    {/* SVG Layer for Links */}
                    <svg style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#ccc" />
                            </marker>
                        </defs>
                        {links.map((link, i) => {
                            const sourceNode = nodes.find(n => n.id === link.source);
                            const targetNode = nodes.find(n => n.id === link.target);

                            // Check if this link is part of active path
                            // We need to check both directions or strictly defined? 
                            // Our link definition is directional but logic is simple S->T
                            const isActive = activePath.includes(`${link.source}-${link.target}`);

                            return (
                                <line
                                    key={`link-${i}`}
                                    x1={sourceNode.x}
                                    y1={sourceNode.y}
                                    x2={targetNode.x}
                                    y2={targetNode.y}
                                    stroke={isActive ? '#1890ff' : '#e8e8e8'}
                                    strokeWidth={isActive ? 3 : 2}
                                    strokeDasharray={isActive ? 'none' : '5 5'}
                                    transition="all 0.3s"
                                />
                            );
                        })}
                    </svg>

                    {/* Nodes Layer */}
                    {nodes.map(node => (
                        <div
                            key={node.id}
                            style={{
                                position: 'absolute',
                                left: node.x,
                                top: node.y,
                                transform: 'translate(-50%, -50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                zIndex: 10
                            }}
                        >
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                background: '#fff',
                                border: `2px solid ${node.color}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                color: node.color,
                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                                position: 'relative'
                            }}>
                                {node.type === 'host' ? <DesktopOutlined /> : <CloudServerOutlined />}

                                {/* Storage Indicator */}
                                {packets.length > 0 && packets[0].currentNode && packets[0].currentNode.id === node.id && packets[0].status === 'stored' && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="storage-badge"
                                        style={{
                                            position: 'absolute',
                                            top: -10,
                                            right: -10,
                                            width: 20,
                                            height: 20,
                                            background: '#ff4d4f',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontSize: 10
                                        }}
                                    >
                                        <DatabaseOutlined />
                                    </motion.div>
                                )}
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12, color: '#666', fontWeight: 500, background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: 4 }}>
                                {node.label}
                            </div>
                        </div>
                    ))}

                    {/* Packet Layer */}
                    <AnimatePresence>
                        {packets.map(packet => {
                            let left = 0;
                            let top = 0;

                            if (packet.status === 'stored') {
                                left = packet.currentNode.x;
                                top = packet.currentNode.y;
                            } else {
                                // Interpolate
                                const from = packet.fromNode;
                                const to = packet.targetNode;
                                left = from.x + (to.x - from.x) * (packet.progress / 100);
                                top = from.y + (to.y - from.y) * (packet.progress / 100);
                            }

                            return (
                                <motion.div
                                    key={packet.id}
                                    style={{
                                        position: 'absolute',
                                        left,
                                        top,
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 20
                                    }}
                                >
                                    <div style={{
                                        background: '#1890ff',
                                        color: '#fff',
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        boxShadow: '0 2px 8px rgba(24,144,255,0.4)',
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <DatabaseOutlined /> {packet.text}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Logs Area */}
                <div className="logs-panel" style={{
                    flex: 1,
                    background: '#fafafa',
                    borderRadius: 12,
                    border: '1px solid #eee',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#333' }}>
                        <InfoCircleOutlined style={{ marginRight: 8 }} />
                        实验日志
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                        {logs.map(log => (
                            <div key={log.id} style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.5 }}>
                                <span style={{ color: '#999', marginRight: 8 }}>{log.time}</span>
                                <span style={{
                                    color: log.type === 'error' ? '#ff4d4f' :
                                        log.type === 'success' ? '#52c41a' :
                                            log.type === 'action' ? '#1890ff' :
                                                log.type === 'loading' ? '#fa8c16' : '#333'
                                }}>
                                    {log.content}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Principles */}
            <div style={{ marginTop: 24, padding: 20, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
                <h4 style={{ color: '#389e0d', marginBottom: 8, display: 'flex', alignItems: 'center' }}>
                    <CheckCircleOutlined style={{ marginRight: 8 }} />
                    知识点：网状拓扑与存储转发
                </h4>
                <p style={{ color: '#666', fontSize: 13, marginBottom: 0 }}>
                    在复杂的网状网络中，数据包从发送者到接收者可能存在多条路径。路由器(Router)负责：
                    1. <strong>接收 (Receive)</strong> 并暂存数据包。
                    2. <strong>存储 (Store)</strong> 数据以进行完整性校验（查错）。
                    3. <strong>查表 (Lookup)</strong> 路由表，选择最佳的下一跳路径。
                    4. <strong>转发 (Forward)</strong> 数据包到下一个节点。
                    这种机制确保了数据即便在繁忙或复杂的网络中也能准确送达。
                </p>
            </div>
        </div>
    );
};

export default StoreForwardSimulator;
