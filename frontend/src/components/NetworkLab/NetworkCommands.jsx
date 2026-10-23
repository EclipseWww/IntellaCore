import React, { useState, useRef, useEffect } from 'react';
import { Tag, Tooltip } from 'antd';
import { motion } from 'framer-motion';

// 预设的网络拓扑（与 RoutingLab 对应）
const networkTopology = {
    nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
    links: {
        'A': { 'B': 2, 'C': 4 },
        'B': { 'A': 2, 'D': 3, 'E': 5 },
        'C': { 'A': 4, 'D': 1, 'F': 6 },
        'D': { 'B': 3, 'C': 1, 'E': 2, 'F': 4 },
        'E': { 'B': 5, 'D': 2, 'F': 1 },
        'F': { 'C': 6, 'D': 4, 'E': 1 }
    },
    nodeInfo: {
        'A': { ip: '192.168.1.1', name: 'Router-A' },
        'B': { ip: '192.168.1.2', name: 'Router-B' },
        'C': { ip: '192.168.1.3', name: 'Router-C' },
        'D': { ip: '192.168.1.4', name: 'Router-D' },
        'E': { ip: '192.168.1.5', name: 'Router-E' },
        'F': { ip: '10.0.0.1', name: 'Server-F' }
    }
};

// 模拟DNS记录
const dnsRecords = {
    'www.google.com': '142.250.80.100',
    'www.baidu.com': '220.181.38.148',
    'www.github.com': '140.82.121.4',
    'localhost': '127.0.0.1'
};

// 可用命令列表
const availableCommands = [
    { cmd: 'ping <ip/域名>', desc: '测试网络连通性' },
    { cmd: 'tracert <目标>', desc: '跟踪路由路径' },
    { cmd: 'ipconfig', desc: '显示本机网络配置' },
    { cmd: 'nslookup <域名>', desc: 'DNS域名查询' },
    { cmd: 'netstat', desc: '显示网络连接状态' },
    { cmd: 'arp -a', desc: '显示ARP缓存表' },
    { cmd: 'help', desc: '显示帮助信息' },
    { cmd: 'clear', desc: '清除屏幕' }
];

const NetworkCommands = ({ onComplete }) => {
    const [commandHistory, setCommandHistory] = useState([]);
    const [currentInput, setCurrentInput] = useState('');
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [inputHistory, setInputHistory] = useState([]);
    const [highlightedPath, setHighlightedPath] = useState([]);
    const terminalRef = useRef(null);
    const inputRef = useRef(null);

    // 滚动到底部
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [commandHistory]);

    // 添加输出
    const addOutput = (content, type = 'normal') => {
        setCommandHistory(prev => [...prev, { content, type }]);
    };

    // 模拟ping命令
    const executePing = async (target) => {
        const ip = dnsRecords[target] || target;
        const isValidIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);

        if (!isValidIP && !dnsRecords[target]) {
            addOutput(`Ping 请求找不到主机 ${target}。请检查该名称，然后重试。`, 'error');
            return;
        }

        addOutput(`\n正在 Ping ${target} [${ip}] 具有 32 字节的数据:`, 'info');

        for (let i = 0; i < 4; i++) {
            await new Promise(r => setTimeout(r, 300));
            const time = Math.floor(Math.random() * 50) + 10;
            const ttl = 64 - Math.floor(Math.random() * 10);
            addOutput(`来自 ${ip} 的回复: 字节=32 时间=${time}ms TTL=${ttl}`, 'success');
        }

        await new Promise(r => setTimeout(r, 200));
        addOutput(`\n${ip} 的 Ping 统计信息:`, 'info');
        addOutput(`    数据包: 已发送 = 4，已接收 = 4，丢失 = 0 (0% 丢失)`, 'normal');
        addOutput(`往返行程的估计时间(以毫秒为单位):`, 'normal');
        addOutput(`    最短 = 12ms，最长 = 45ms，平均 = 28ms`, 'normal');
    };

    // 模拟tracert命令（与拓扑联动）
    const executeTracert = async (target) => {
        // 使用Dijkstra找到从A到目标的路径
        const findPath = (start, end) => {
            const distances = {};
            const previous = {};
            const unvisited = new Set(networkTopology.nodes);

            networkTopology.nodes.forEach(node => {
                distances[node] = Infinity;
                previous[node] = null;
            });
            distances[start] = 0;

            while (unvisited.size > 0) {
                let minNode = null;
                let minDist = Infinity;
                unvisited.forEach(node => {
                    if (distances[node] < minDist) {
                        minDist = distances[node];
                        minNode = node;
                    }
                });

                if (minNode === null || minNode === end) break;
                unvisited.delete(minNode);

                for (const neighbor in networkTopology.links[minNode]) {
                    if (unvisited.has(neighbor)) {
                        const newDist = distances[minNode] + networkTopology.links[minNode][neighbor];
                        if (newDist < distances[neighbor]) {
                            distances[neighbor] = newDist;
                            previous[neighbor] = minNode;
                        }
                    }
                }
            }

            const path = [];
            let current = end;
            while (current !== null) {
                path.unshift(current);
                current = previous[current];
            }
            return path[0] === start ? path : [];
        };

        // 确定目标节点
        let targetNode = 'F'; // 默认目标
        if (target.includes('10.0.0.1') || target.toLowerCase().includes('server')) {
            targetNode = 'F';
        }

        const path = findPath('A', targetNode);
        setHighlightedPath(path);

        const ip = dnsRecords[target] || networkTopology.nodeInfo[targetNode]?.ip || target;
        addOutput(`\n通过最多 30 个跃点跟踪到 ${target} [${ip}] 的路由:\n`, 'info');

        for (let i = 0; i < path.length; i++) {
            await new Promise(r => setTimeout(r, 500));
            const node = path[i];
            const nodeInfo = networkTopology.nodeInfo[node];
            const time1 = Math.floor(Math.random() * 20) + 5;
            const time2 = Math.floor(Math.random() * 20) + 5;
            const time3 = Math.floor(Math.random() * 20) + 5;

            addOutput(
                `  ${(i + 1).toString().padStart(2)}    ${time1.toString().padStart(3)} ms   ${time2.toString().padStart(3)} ms   ${time3.toString().padStart(3)} ms  ${nodeInfo.ip} [${nodeInfo.name}]`,
                'success'
            );
        }

        addOutput(`\n跟踪完成。`, 'info');

        // 完成实验
        if (onComplete) {
            onComplete({
                items: [
                    { label: '执行命令', value: `tracert ${target}` },
                    { label: '跃点数', value: path.length },
                    { label: '路径', value: path.join(' → ') }
                ]
            });
        }
    };

    // 模拟ipconfig命令
    const executeIpconfig = () => {
        addOutput('\nWindows IP 配置\n', 'info');
        addOutput('以太网适配器 本地连接:', 'normal');
        addOutput('', 'normal');
        addOutput('   连接特定的 DNS 后缀 . . . . . . . : localdomain', 'normal');
        addOutput('   本地链接 IPv6 地址. . . . . . . . : fe80::1234:5678:abcd:ef01%12', 'normal');
        addOutput('   IPv4 地址 . . . . . . . . . . . . : 192.168.1.100', 'success');
        addOutput('   子网掩码  . . . . . . . . . . . . : 255.255.255.0', 'normal');
        addOutput('   默认网关. . . . . . . . . . . . . : 192.168.1.1', 'normal');
        addOutput('', 'normal');
        addOutput('无线局域网适配器 WLAN:', 'normal');
        addOutput('', 'normal');
        addOutput('   媒体状态  . . . . . . . . . . . . : 媒体已断开连接', 'normal');
        addOutput('   连接特定的 DNS 后缀 . . . . . . . : ', 'normal');
    };

    // 模拟nslookup命令
    const executeNslookup = async (domain) => {
        if (!domain) {
            addOutput('用法: nslookup <域名>', 'error');
            return;
        }

        addOutput('\n服务器:  dns.localdomain', 'normal');
        addOutput('Address:  8.8.8.8\n', 'normal');

        await new Promise(r => setTimeout(r, 500));

        const ip = dnsRecords[domain];
        if (ip) {
            addOutput('非权威应答:', 'info');
            addOutput(`名称:    ${domain}`, 'normal');
            addOutput(`Address:  ${ip}`, 'success');
        } else {
            addOutput(`*** dns.localdomain 找不到 ${domain}: Non-existent domain`, 'error');
        }
    };

    // 模拟netstat命令
    const executeNetstat = () => {
        addOutput('\n活动连接\n', 'info');
        addOutput('  协议  本地地址          外部地址        状态', 'normal');
        addOutput('  TCP    192.168.1.100:3389   192.168.1.50:52431   ESTABLISHED', 'success');
        addOutput('  TCP    192.168.1.100:80     142.250.80.100:443   ESTABLISHED', 'success');
        addOutput('  TCP    192.168.1.100:443    0.0.0.0:0            LISTENING', 'normal');
        addOutput('  TCP    192.168.1.100:3306   0.0.0.0:0            LISTENING', 'normal');
        addOutput('  UDP    192.168.1.100:53     *:*', 'normal');
        addOutput('  UDP    192.168.1.100:137    *:*', 'normal');
    };

    // 模拟arp -a命令
    const executeArp = () => {
        addOutput('\n接口: 192.168.1.100 --- 0xc', 'info');
        addOutput('  Internet 地址         物理地址              类型', 'normal');
        addOutput('  192.168.1.1          aa-bb-cc-dd-ee-ff     动态', 'success');
        addOutput('  192.168.1.50         11-22-33-44-55-66     动态', 'normal');
        addOutput('  192.168.1.255        ff-ff-ff-ff-ff-ff     静态', 'normal');
        addOutput('  224.0.0.22           01-00-5e-00-00-16     静态', 'normal');
        addOutput('  255.255.255.255      ff-ff-ff-ff-ff-ff     静态', 'normal');
    };

    // 显示帮助
    const showHelp = () => {
        addOutput('\n可用命令:', 'info');
        availableCommands.forEach(cmd => {
            addOutput(`  ${cmd.cmd.padEnd(20)} - ${cmd.desc}`, 'normal');
        });
        addOutput('', 'normal');
    };

    // 处理命令
    const handleCommand = async (cmd) => {
        const trimmedCmd = cmd.trim().toLowerCase();
        if (!trimmedCmd) return;

        addOutput(`C:\\> ${cmd}`, 'prompt');
        setInputHistory(prev => [...prev, cmd]);
        setHistoryIndex(-1);

        const parts = trimmedCmd.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        switch (command) {
            case 'ping':
                if (args.length === 0) {
                    addOutput('用法: ping <IP地址或域名>', 'error');
                } else {
                    await executePing(args[0]);
                }
                break;

            case 'tracert':
            case 'traceroute':
                if (args.length === 0) {
                    addOutput('用法: tracert <目标>', 'error');
                } else {
                    await executeTracert(args[0]);
                }
                break;

            case 'ipconfig':
                executeIpconfig();
                break;

            case 'nslookup':
                await executeNslookup(args[0]);
                break;

            case 'netstat':
                executeNetstat();
                break;

            case 'arp':
                executeArp();
                break;

            case 'help':
            case '?':
                showHelp();
                break;

            case 'clear':
            case 'cls':
                setCommandHistory([]);
                break;

            default:
                addOutput(`'${command}' 不是内部或外部命令，也不是可运行的程序。`, 'error');
                addOutput('输入 help 查看可用命令。', 'info');
        }
    };

    // 处理按键
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleCommand(currentInput);
            setCurrentInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (inputHistory.length > 0) {
                const newIndex = historyIndex < inputHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setCurrentInput(inputHistory[inputHistory.length - 1 - newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCurrentInput(inputHistory[inputHistory.length - 1 - newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCurrentInput('');
            }
        }
    };

    // 点击终端时聚焦输入框
    const focusInput = () => {
        inputRef.current?.focus();
    };

    return (
        <div className="network-commands">
            {/* 终端区域 */}
            <div className="terminal-section">
                <div className="terminal" onClick={focusInput}>
                    <div className="terminal-header">
                        <span className="dot red"></span>
                        <span className="dot yellow"></span>
                        <span className="dot green"></span>
                        <span className="title">命令提示符 - 网络诊断模拟器</span>
                    </div>
                    <div className="terminal-body" ref={terminalRef}>
                        <div className="terminal-output">
                            <div style={{ marginBottom: 16 }}>
                                Microsoft Windows [版本 10.0.19045.3803]
                                <br />
                                (c) Microsoft Corporation。保留所有权利。
                                <br />
                                <br />
                                <span className="info">网络诊断模拟器已启动。输入 help 查看可用命令。</span>
                            </div>

                            {commandHistory.map((item, index) => (
                                <div
                                    key={index}
                                    className={item.type}
                                    style={{ whiteSpace: 'pre-wrap' }}
                                >
                                    {item.content}
                                </div>
                            ))}
                        </div>

                        <div className="terminal-input-line">
                            <span className="prompt">C:\&gt;</span>
                            <input
                                ref={inputRef}
                                value={currentInput}
                                onChange={(e) => setCurrentInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧帮助面板 */}
            <div className="command-help">
                <h4>📖 命令参考</h4>
                {availableCommands.map((cmd, index) => (
                    <div
                        className="command-item"
                        key={index}
                        onClick={() => setCurrentInput(cmd.cmd.split(' ')[0] + ' ')}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="cmd">{cmd.cmd}</div>
                        <div className="desc">{cmd.desc}</div>
                    </div>
                ))}

                {/* 小地图 - tracert路径联动 */}
                <div className="mini-topology">
                    <h4>🗺️ 网络拓扑 (tracert 联动)</h4>
                    <svg width="100%" height="140" viewBox="0 0 260 130">
                        {/* 连线 */}
                        <line x1="30" y1="65" x2="80" y2="30" stroke="#444" strokeWidth="2" />
                        <line x1="30" y1="65" x2="80" y2="100" stroke="#444" strokeWidth="2" />
                        <line x1="80" y1="30" x2="130" y2="65" stroke="#444" strokeWidth="2" />
                        <line x1="80" y1="100" x2="130" y2="65" stroke="#444" strokeWidth="2" />
                        <line x1="80" y1="30" x2="180" y2="30" stroke="#444" strokeWidth="2" />
                        <line x1="130" y1="65" x2="180" y2="30" stroke="#444" strokeWidth="2" />
                        <line x1="130" y1="65" x2="230" y2="100" stroke="#444" strokeWidth="2" />
                        <line x1="180" y1="30" x2="230" y2="100" stroke="#444" strokeWidth="2" />
                        <line x1="80" y1="100" x2="230" y2="100" stroke="#444" strokeWidth="2" />

                        {/* 节点 */}
                        {[
                            { id: 'A', x: 30, y: 65 },
                            { id: 'B', x: 80, y: 30 },
                            { id: 'C', x: 80, y: 100 },
                            { id: 'D', x: 130, y: 65 },
                            { id: 'E', x: 180, y: 30 },
                            { id: 'F', x: 230, y: 100 }
                        ].map(node => (
                            <g key={node.id}>
                                <motion.circle
                                    cx={node.x}
                                    cy={node.y}
                                    r="16"
                                    fill={highlightedPath.includes(node.id) ? '#2ecc71' : '#3498db'}
                                    animate={{
                                        scale: highlightedPath.includes(node.id) ? [1, 1.2, 1] : 1
                                    }}
                                    transition={{ duration: 0.5, repeat: highlightedPath.includes(node.id) ? Infinity : 0 }}
                                />
                                <text
                                    x={node.x}
                                    y={node.y + 5}
                                    textAnchor="middle"
                                    fill="#fff"
                                    fontSize="12"
                                    fontWeight="bold"
                                >
                                    {node.id}
                                </text>
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default NetworkCommands;
