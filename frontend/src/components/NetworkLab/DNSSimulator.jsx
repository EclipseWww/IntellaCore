import React, { useState, useRef } from 'react';
import { Button, Input, Tag, Space, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SearchOutlined,
    CloudServerOutlined,
    GlobalOutlined,
    DatabaseOutlined,
    HomeOutlined,
    ClockCircleOutlined,
    ThunderboltOutlined,
    DeleteOutlined
} from '@ant-design/icons';

// DNS服务器配置
const dnsServers = [
    { id: 'local', name: '本地DNS缓存', icon: <HomeOutlined />, color: '#3498db' },
    { id: 'isp', name: 'ISP DNS服务器', icon: <CloudServerOutlined />, color: '#9b59b6' },
    { id: 'root', name: '根域名服务器', icon: <GlobalOutlined />, color: '#e74c3c' },
    { id: 'tld', name: '顶级域名服务器', icon: <DatabaseOutlined />, color: '#f39c12' },
    { id: 'auth', name: '权威域名服务器', icon: <CloudServerOutlined />, color: '#2ecc71' }
];

// 模拟的DNS记录
const dnsRecords = {
    'www.google.com': { ip: '142.250.80.100', ttl: 300 },
    'www.baidu.com': { ip: '220.181.38.148', ttl: 600 },
    'www.github.com': { ip: '140.82.121.4', ttl: 60 },
    'www.example.com': { ip: '93.184.216.34', ttl: 3600 },
    'mail.qq.com': { ip: '183.3.226.35', ttl: 120 }
};

const DNSSimulator = ({ onComplete }) => {
    const [domain, setDomain] = useState('www.google.com');
    const [isResolving, setIsResolving] = useState(false);
    const [currentServer, setCurrentServer] = useState(null);
    const [resolveSteps, setResolveSteps] = useState([]);
    const [cache, setCache] = useState({});
    const [resolveTime, setResolveTime] = useState(0);
    const [result, setResult] = useState(null);
    const timeRef = useRef(null);

    // 添加解析步骤
    const addStep = (step) => {
        setResolveSteps(prev => [...prev, step]);
    };

    // 模拟DNS解析
    const resolveDNS = async () => {
        const queryDomain = domain.toLowerCase().trim();
        if (!queryDomain) {
            message.warning('请输入域名');
            return;
        }

        setIsResolving(true);
        setResolveSteps([]);
        setResult(null);
        setResolveTime(0);

        let totalTime = 0;
        const startTime = Date.now();

        // 启动计时器
        timeRef.current = setInterval(() => {
            setResolveTime(Date.now() - startTime);
        }, 50);

        addStep({ type: 'info', text: `开始解析域名: ${queryDomain}` });
        await new Promise(r => setTimeout(r, 300));

        // 步骤1：检查本地缓存
        setCurrentServer('local');
        addStep({ type: 'query', text: '查询本地DNS缓存...' });
        await new Promise(r => setTimeout(r, 500));

        if (cache[queryDomain]) {
            // 缓存命中
            addStep({ type: 'success', text: `✓ 缓存命中! IP: ${cache[queryDomain].ip}` });
            totalTime = 50; // 缓存命中很快

            clearInterval(timeRef.current);
            setResolveTime(totalTime);
            setResult({ ip: cache[queryDomain].ip, cached: true });
            setCurrentServer(null);
            setIsResolving(false);

            if (onComplete) {
                onComplete({
                    items: [
                        { label: '查询域名', value: queryDomain },
                        { label: '解析结果', value: cache[queryDomain].ip },
                        { label: '缓存命中', value: '是' },
                        { label: '解析耗时', value: `${totalTime}ms` }
                    ]
                });
            }
            return;
        }

        addStep({ type: 'miss', text: '✗ 本地缓存未命中' });
        await new Promise(r => setTimeout(r, 300));

        // 步骤2：查询ISP DNS
        setCurrentServer('isp');
        addStep({ type: 'query', text: '查询ISP DNS服务器...' });
        await new Promise(r => setTimeout(r, 600));
        addStep({ type: 'miss', text: '✗ ISP DNS无记录，开始递归查询' });
        await new Promise(r => setTimeout(r, 300));

        // 步骤3：查询根域名服务器
        setCurrentServer('root');
        addStep({ type: 'query', text: '查询根域名服务器 (.)...' });
        await new Promise(r => setTimeout(r, 800));

        const tld = queryDomain.split('.').pop(); // 获取顶级域名
        addStep({ type: 'response', text: `← 返回 .${tld} 顶级域名服务器地址` });
        await new Promise(r => setTimeout(r, 400));

        // 步骤4：查询顶级域名服务器
        setCurrentServer('tld');
        addStep({ type: 'query', text: `查询 .${tld} 顶级域名服务器...` });
        await new Promise(r => setTimeout(r, 700));

        const sld = queryDomain.split('.').slice(-2).join('.'); // 二级域名
        addStep({ type: 'response', text: `← 返回 ${sld} 权威服务器地址` });
        await new Promise(r => setTimeout(r, 400));

        // 步骤5：查询权威域名服务器
        setCurrentServer('auth');
        addStep({ type: 'query', text: `查询 ${sld} 权威域名服务器...` });
        await new Promise(r => setTimeout(r, 600));

        const record = dnsRecords[queryDomain] || { ip: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`, ttl: 300 };
        addStep({ type: 'success', text: `✓ 找到记录! A记录: ${record.ip}` });
        await new Promise(r => setTimeout(r, 300));

        // 缓存结果
        setCache(prev => ({
            ...prev,
            [queryDomain]: { ip: record.ip, ttl: record.ttl, timestamp: Date.now() }
        }));
        addStep({ type: 'cache', text: `将结果缓存 (TTL: ${record.ttl}秒)` });

        clearInterval(timeRef.current);
        totalTime = Date.now() - startTime;
        setResolveTime(totalTime);
        setResult({ ip: record.ip, cached: false });
        setCurrentServer(null);
        setIsResolving(false);

        if (onComplete) {
            onComplete({
                items: [
                    { label: '查询域名', value: queryDomain },
                    { label: '解析结果', value: record.ip },
                    { label: '缓存命中', value: '否' },
                    { label: '解析耗时', value: `${totalTime}ms` }
                ]
            });
        }
    };

    // 清除缓存
    const clearCache = () => {
        setCache({});
        message.success('缓存已清除');
    };

    return (
        <div className="dns-simulator">
            {/* 输入区域 */}
            <div className="dns-input-section">
                <div className="input-group">
                    <label>输入域名:</label>
                    <Input
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="例如: www.google.com"
                        prefix={<GlobalOutlined />}
                        onPressEnter={resolveDNS}
                        disabled={isResolving}
                    />
                </div>
                <Space>
                    <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={resolveDNS}
                        loading={isResolving}
                    >
                        解析
                    </Button>
                    <Button
                        icon={<DeleteOutlined />}
                        onClick={clearCache}
                        disabled={isResolving || Object.keys(cache).length === 0}
                    >
                        清除缓存
                    </Button>
                </Space>
            </div>

            {/* DNS服务器可视化 */}
            <div className="dns-visualization">
                <div className="dns-servers">
                    {dnsServers.map((server, index) => (
                        <motion.div
                            key={server.id}
                            className="dns-server"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <motion.div
                                className={`dns-server-icon ${currentServer === server.id ? 'active' : ''} ${cache[domain] && server.id === 'local' ? 'cached' : ''}`}
                                style={{ background: server.color }}
                                animate={{
                                    scale: currentServer === server.id ? [1, 1.2, 1] : 1,
                                    boxShadow: currentServer === server.id
                                        ? `0 0 30px ${server.color}80`
                                        : 'none'
                                }}
                                transition={{ duration: 0.3 }}
                            >
                                {server.icon}
                            </motion.div>
                            <span className="name">{server.name}</span>
                            {server.id === 'local' && Object.keys(cache).length > 0 && (
                                <Tag color="cyan" style={{ marginTop: 4 }}>
                                    {Object.keys(cache).length} 条缓存
                                </Tag>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* 解析过程日志 */}
                <div style={{
                    marginTop: 24,
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 8,
                    padding: 16,
                    minHeight: 200,
                    maxHeight: 300,
                    overflow: 'auto'
                }}>
                    <h4 style={{ color: '#00d4ff', marginBottom: 12 }}>📋 解析过程</h4>
                    <AnimatePresence>
                        {resolveSteps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{
                                    padding: '8px 12px',
                                    marginBottom: 4,
                                    borderRadius: 4,
                                    background: step.type === 'success' ? 'rgba(46, 204, 113, 0.1)' :
                                        step.type === 'miss' ? 'rgba(231, 76, 60, 0.1)' :
                                            step.type === 'query' ? 'rgba(52, 152, 219, 0.1)' :
                                                step.type === 'response' ? 'rgba(155, 89, 182, 0.1)' :
                                                    step.type === 'cache' ? 'rgba(241, 196, 15, 0.1)' :
                                                        'rgba(255,255,255,0.05)',
                                    color: step.type === 'success' ? '#2ecc71' :
                                        step.type === 'miss' ? '#e74c3c' :
                                            step.type === 'query' ? '#3498db' :
                                                step.type === 'response' ? '#9b59b6' :
                                                    step.type === 'cache' ? '#f1c40f' :
                                                        'rgba(255,255,255,0.8)',
                                    fontSize: 13,
                                    fontFamily: 'Consolas, monospace'
                                }}
                            >
                                {step.text}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {resolveSteps.length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40 }}>
                            点击"解析"按钮开始DNS查询
                        </div>
                    )}
                </div>

                {/* 耗时显示 */}
                <div className="dns-time-display">
                    <ClockCircleOutlined style={{ fontSize: 24, marginBottom: 8, color: 'rgba(255,255,255,0.5)' }} />
                    <div className="time">{resolveTime} ms</div>
                    <div className="label">
                        {result?.cached ? (
                            <Tag color="green" icon={<ThunderboltOutlined />}>缓存命中 - 极速响应</Tag>
                        ) : result ? (
                            <Tag color="blue">递归查询完成</Tag>
                        ) : (
                            '解析耗时'
                        )}
                    </div>
                </div>

                {/* 解析结果 */}
                {result && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            marginTop: 24,
                            padding: 20,
                            background: result.cached ? 'rgba(46, 204, 113, 0.1)' : 'rgba(52, 152, 219, 0.1)',
                            border: `1px solid ${result.cached ? 'rgba(46, 204, 113, 0.3)' : 'rgba(52, 152, 219, 0.3)'}`,
                            borderRadius: 12,
                            textAlign: 'center'
                        }}
                    >
                        <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                            {domain} 解析结果
                        </div>
                        <div style={{
                            fontSize: 28,
                            fontWeight: 'bold',
                            color: result.cached ? '#2ecc71' : '#3498db',
                            fontFamily: 'Consolas, monospace'
                        }}>
                            {result.ip}
                        </div>
                    </motion.div>
                )}

                {/* DNS缓存列表 */}
                {Object.keys(cache).length > 0 && (
                    <div className="dns-cache">
                        <h4>
                            <DatabaseOutlined style={{ marginRight: 8 }} />
                            本地DNS缓存
                        </h4>
                        {Object.entries(cache).map(([domain, record]) => (
                            <div className="dns-cache-item" key={domain}>
                                <span className="domain">{domain}</span>
                                <span className="ip">{record.ip}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 知识点 */}
            <div style={{
                marginTop: 24,
                padding: 20,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 12
            }}>
                <h4 style={{ color: '#00d4ff', marginBottom: 12 }}>📚 DNS解析过程</h4>
                <ol style={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 2, paddingLeft: 20 }}>
                    <li><strong>本地缓存</strong>: 首先检查本地DNS缓存</li>
                    <li><strong>递归查询</strong>: 若缓存未命中，向ISP DNS服务器发起递归查询</li>
                    <li><strong>根服务器</strong>: 查询根域名服务器获取顶级域服务器地址</li>
                    <li><strong>顶级域服务器</strong>: 获取权威服务器地址</li>
                    <li><strong>权威服务器</strong>: 获取最终的IP地址</li>
                    <li><strong>缓存结果</strong>: 将结果缓存以加速后续查询</li>
                </ol>
            </div>
        </div>
    );
};

export default DNSSimulator;
