import React, { useState, useEffect } from 'react';
import { Button, Input, Table, Tag, Row, Col, Tooltip, Slider } from 'antd';
import { motion } from 'framer-motion';
import {
    BulbOutlined,
    CalculatorOutlined,
    SwapOutlined,
    CheckCircleOutlined,
    AppstoreOutlined,
    PartitionOutlined
} from '@ant-design/icons';

const IP_CLASSES = [
    { name: 'A', range: '1.0.0.0 - 126.255.255.255', bits: '0...', networkBits: 8, hostBits: 24, desc: '大型网络' },
    { name: 'B', range: '128.0.0.0 - 191.255.255.255', bits: '10...', networkBits: 16, hostBits: 16, desc: '中型网络' },
    { name: 'C', range: '192.0.0.0 - 223.255.255.255', bits: '110...', networkBits: 24, hostBits: 8, desc: '小型网络' },
    { name: 'D', range: '224.0.0.0 - 239.255.255.255', bits: '1110...', networkBits: null, hostBits: null, desc: '多播地址' },
    { name: 'E', range: '240.0.0.0 - 255.255.255.255', bits: '1111...', networkBits: null, hostBits: null, desc: '保留实验' },
];

const IPAddressLab = ({ onComplete }) => {
    // 灯泡游戏状态
    const [bulbs, setBulbs] = useState([0, 0, 0, 0, 0, 0, 0, 0]);

    // IP计算器状态
    const [ipOctets, setIpOctets] = useState(['192', '168', '1', '100']);
    const [maskBits, setMaskBits] = useState(24);
    const [calculatedResults, setCalculatedResults] = useState(null);
    const [selectedClass, setSelectedClass] = useState('C');

    // Effect: 当 Class 改变时，自动设置默认掩码和示例 IP
    useEffect(() => {
        const cls = IP_CLASSES.find(c => c.name === selectedClass);
        if (cls && cls.networkBits) {
            setMaskBits(cls.networkBits);
            // 简单设置一个示例 IP
            if (selectedClass === 'A') setIpOctets(['10', '0', '0', '1']);
            if (selectedClass === 'B') setIpOctets(['172', '16', '0', '1']);
            if (selectedClass === 'C') setIpOctets(['192', '168', '1', '100']);
        }
    }, [selectedClass]);

    // Effect: 当 maskBits 改变时自动计算
    useEffect(() => {
        calculateIP();
    }, [maskBits, ipOctets]);

    // 计算灯泡的十进制值
    const binaryToDecimal = () => {
        return bulbs.reduce((acc, bit, index) => {
            return acc + bit * Math.pow(2, 7 - index);
        }, 0);
    };

    // 切换灯泡
    const toggleBulb = (index) => {
        setBulbs(prev => {
            const newBulbs = [...prev];
            newBulbs[index] = newBulbs[index] === 0 ? 1 : 0;
            return newBulbs;
        });
    };

    // IP地址计算
    const calculateIP = () => {
        const ip = ipOctets.map(o => parseInt(o) || 0);
        const maskOctets = [];

        // 计算子网掩码
        let remainingBits = maskBits;
        for (let i = 0; i < 4; i++) {
            if (remainingBits >= 8) {
                maskOctets.push(255);
                remainingBits -= 8;
            } else if (remainingBits > 0) {
                maskOctets.push(256 - Math.pow(2, 8 - remainingBits));
                remainingBits = 0;
            } else {
                maskOctets.push(0);
            }
        }

        // 计算网络地址
        const networkAddr = ip.map((octet, i) => octet & maskOctets[i]);

        // 计算广播地址
        const wildcardMask = maskOctets.map(o => 255 - o);
        const broadcastAddr = networkAddr.map((octet, i) => octet | wildcardMask[i]);

        // 主机范围
        const firstHost = [...networkAddr];
        firstHost[3] += 1;

        const lastHost = [...broadcastAddr];
        lastHost[3] -= 1;

        // 可用主机数
        const hostBits = 32 - maskBits;
        const totalHosts = maskBits === 32 ? 0 : maskBits === 31 ? 0 : Math.pow(2, hostBits) - 2;


        setCalculatedResults({
            subnetMask: maskOctets.join('.'),
            networkAddress: networkAddr.join('.'),
            broadcastAddress: broadcastAddr.join('.'),
            firstHost: firstHost.join('.'),
            lastHost: lastHost.join('.'),
            totalHosts: totalHosts > 0 ? totalHosts : 0,
            maskBinary: maskOctets.map(o => o.toString(2).padStart(8, '0')).join('.')
        });
    };

    // IPv4 vs IPv6 对比数据
    const comparisonData = [
        { key: '1', feature: '地址长度', ipv4: '32位（4字节）', ipv6: '128位（16字节）' },
        { key: '2', feature: '地址数量', ipv4: '约43亿', ipv6: '约3.4×10³⁸' },
        { key: '3', feature: '表示方式', ipv4: '点分十进制', ipv6: '冒号分隔十六进制' },
        { key: '4', feature: '示例', ipv4: '192.168.1.1', ipv6: '2001:0db8::1' },
    ];

    const comparisonColumns = [
        { title: '特性', dataIndex: 'feature', key: 'feature' },
        {
            title: 'IPv4',
            dataIndex: 'ipv4',
            key: 'ipv4',
            render: (text) => <span style={{ color: '#3498db' }}>{text}</span>
        },
        {
            title: 'IPv6',
            dataIndex: 'ipv6',
            key: 'ipv6',
            render: (text) => <span style={{ color: '#2ecc71' }}>{text}</span>
        }
    ];

    return (
        <div className="ip-lab">
            {/* 左侧：可视化实验室 - 宽度增加以容纳更多视觉元素 */}
            <div className="ip-section" style={{ flex: 1.5 }}>

                {/* 1. IP类别选择 */}
                <div className="ip-classes-container">
                    {IP_CLASSES.map(cls => (
                        <div
                            key={cls.name}
                            className={`ip-class-card ${selectedClass === cls.name ? 'active' : ''}`}
                            onClick={() => setSelectedClass(cls.name)}
                        >
                            <div className="class-header">
                                <h4>Class {cls.name}</h4>
                                <Tag color={selectedClass === cls.name ? 'blue' : 'default'}>{cls.desc}</Tag>
                            </div>
                            <div className="class-range">{cls.range}</div>

                            {/* 简单的位图示 */}
                            <div className="class-bits">
                                <div className="bit-segment" style={{ width: '100%', background: '#5c5c5c' }}>
                                    <div style={{ width: `${(cls.networkBits / 32) * 100}%`, background: '#1890ff', height: '100%' }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 2. 可视化 IP 结构图 */}
                <div className="ip-structure-visual">
                    <h3><PartitionOutlined style={{ marginRight: 8 }} /> IP结构可视化</h3>

                    <div className="structure-bar-container">
                        {/* 刻度背景 */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} style={{ flex: 1, borderRight: i < 3 ? '1px dashed rgba(255,255,255,0.1)' : 'none' }}></div>
                            ))}
                        </div>

                        {/* 实际的 IP 条 */}
                        <div className="structure-bar">
                            <div
                                className="structure-segment"
                                style={{
                                    width: `${(maskBits / 32) * 100}%`,
                                    background: 'linear-gradient(90deg, #1890ff, #36cfc9)'
                                }}
                            >
                                <span className="structure-label">网络位 ({maskBits})</span>
                            </div>
                            <div
                                className="structure-segment"
                                style={{
                                    width: `${((32 - maskBits) / 32) * 100}%`,
                                    background: 'linear-gradient(90deg, #52c41a, #a0d911)'
                                }}
                            >
                                <span className="structure-label">主机位 ({32 - maskBits})</span>
                            </div>
                        </div>

                        {/* 显示对应的 IP 八位组数值 */}
                        <div style={{ display: 'flex', marginTop: 8 }}>
                            {ipOctets.map((octet, i) => (
                                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                                    <span className="octet-value">{octet}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 滑动调整掩码 */}
                    <div className="subnet-slider-container">
                        <span style={{ color: '#fff', marginRight: 12 }}>子网掩码 / {maskBits}</span>
                        <Slider
                            min={selectedClass === 'A' ? 8 : selectedClass === 'B' ? 16 : selectedClass === 'C' ? 24 : 1}
                            max={30}
                            value={maskBits}
                            onChange={(val) => setMaskBits(val)}
                            tooltipVisible
                        />
                    </div>
                </div>

                {/* 3. 输入与计算结果展示 */}
                <Row gutter={24}>
                    <Col span={12}>
                        <div className="ip-calculator">
                            <h3><CalculatorOutlined style={{ marginRight: 8 }} /> 参数设置</h3>
                            <div className="ip-input-group">
                                <label>IP地址:</label>
                                {ipOctets.map((octet, index) => (
                                    <React.Fragment key={index}>
                                        <Input
                                            className="ip-octet"
                                            value={octet}
                                            onChange={(e) => {
                                                const newOctets = [...ipOctets];
                                                const val = e.target.value.replace(/\D/g, '');
                                                newOctets[index] = val.slice(0, 3);
                                                if (parseInt(val) > 255) newOctets[index] = '255';
                                                setIpOctets(newOctets);
                                            }}
                                            maxLength={3}
                                        />
                                        {index < 3 && <span className="ip-dot">.</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </Col>

                    <Col span={12}>
                        {calculatedResults && (
                            <div className="ip-results" style={{ marginTop: 0 }}>
                                <div className="ip-result-row">
                                    <span className="label">网络地址</span>
                                    <span className="value">{calculatedResults.networkAddress}</span>
                                </div>
                                <div className="ip-result-row">
                                    <span className="label">广播地址</span>
                                    <span className="value">{calculatedResults.broadcastAddress}</span>
                                </div>
                                <div className="ip-result-row">
                                    <span className="label">可用主机数</span>
                                    <span className="value" style={{ color: '#2ecc71', fontSize: 16 }}>
                                        {calculatedResults.totalHosts.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        )}
                    </Col>
                </Row>


                {/* 4. 子网划分可视化 (仅当掩码 > 默认掩码时显示) */}
                {(() => {
                    const defaultBits = selectedClass === 'A' ? 8 : selectedClass === 'B' ? 16 : selectedClass === 'C' ? 24 : 0;
                    const borrowed = maskBits - defaultBits;
                    if (borrowed > 0 && borrowed <= 8) {
                        const subnets = Math.pow(2, borrowed);
                        return (
                            <div style={{ marginTop: 24 }}>
                                <h3><AppstoreOutlined style={{ marginRight: 8 }} /> 子网划分演示 (借用 {borrowed} 位)</h3>
                                <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                                    将一个 Class {selectedClass} 网络划分为 {subnets} 个子网
                                </p>
                                <div className="subnet-visualizer">
                                    {[...Array(Math.min(subnets, 64))].map((_, i) => (
                                        <Tooltip key={i} title={`子网 #${i + 1}`}>
                                            <div className="subnet-block">
                                                {i + 1}
                                            </div>
                                        </Tooltip>
                                    ))}
                                    {subnets > 64 && <div style={{ color: '#fff', padding: 8 }}>... 共 {subnets} 个</div>}
                                </div>
                            </div>
                        );
                    }
                })()}

            </div>

            {/* 右侧：辅助工具与知识 */}
            <div className="ip-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* 知识点 */}
                <div style={{
                    marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8
                }}>
                    <h4 style={{ color: '#00d4ff', marginBottom: 12 }}>📚 知识点</h4>
                    <ul style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 2, paddingLeft: 20 }}>
                        <li><strong>网络位</strong>: 决定网段归属</li>
                        <li><strong>主机位</strong>: 决定网段内容量</li>
                        <li><strong>CIDR</strong>: 通过掩码长度 /N 灵活划分</li>
                    </ul>
                </div>

                {/* 灯泡游戏 (保留但精简，作为辅助练习) */}
                <div className="binary-game" style={{ flex: 1 }}>
                    <h3><BulbOutlined style={{ marginRight: 8 }} /> 二进制练习</h3>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>点击灯泡组合数值</p>
                    <div className="binary-byte" style={{ transform: 'scale(0.9)' }}>
                        {bulbs.map((bit, index) => (
                            <Tooltip key={index} title={`权值: ${Math.pow(2, 7 - index)}`}>
                                <div
                                    className={`binary-bulb ${bit === 1 ? 'on' : ''}`}
                                    onClick={() => toggleBulb(index)}
                                    style={{ width: 40, height: 60 }}
                                >
                                    <span className="value" style={{ fontSize: 18 }}>{bit}</span>
                                    <span className="weight">{Math.pow(2, 7 - index)}</span>
                                </div>
                            </Tooltip>
                        ))}
                    </div>
                    <div className="binary-result">
                        <span className="label">十进制:</span>
                        <span className="value">{binaryToDecimal()}</span>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Button size="small" onClick={() => setBulbs([1, 1, 0, 0, 0, 0, 0, 0])}>192 (C类)</Button>
                        <Button size="small" onClick={() => setBulbs([1, 1, 1, 1, 1, 1, 1, 1])}>255 (掩码)</Button>
                        <Button size="small" onClick={() => setBulbs([0, 0, 0, 0, 0, 0, 0, 0])}>重置</Button>
                    </div>
                </div>

                {/* IPv4 vs IPv6 对比精简版 */}
                <div style={{ marginTop: 24 }}>
                    <h3><SwapOutlined style={{ marginRight: 8 }} /> IPv4 vs IPv6</h3>
                    <Table
                        dataSource={comparisonData}
                        columns={comparisonColumns}
                        pagination={false}
                        size="small"
                        showHeader={false}
                        style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}
                    />
                </div>
            </div>
        </div>
    );
};

export default IPAddressLab;
