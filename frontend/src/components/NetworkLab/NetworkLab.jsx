import React, { useState, useCallback } from 'react';
import { Button, message } from 'antd';
import {
    ArrowLeftOutlined,
    SendOutlined,
    GlobalOutlined,
    ApartmentOutlined,
    CloudServerOutlined,
    NodeIndexOutlined,
    CodeOutlined,
    TrophyOutlined,
    DownloadOutlined,
    CloseOutlined,
    RetweetOutlined
} from '@ant-design/icons';
import './NetworkLab.css';

// 导入各实验组件
import PacketSimulator from './PacketSimulator';
import ProtocolAnalyzer from './ProtocolAnalyzer';
import IPAddressLab from './IPAddressLab';
import DNSSimulator from './DNSSimulator';
import RoutingLab from './RoutingLab';

import NetworkCommands from './NetworkCommands';
import StoreForwardSimulator from './StoreForwardSimulator';

// 实验列表配置
const experiments = [
    {
        id: 'packet',
        title: '数据分包与传输',
        description: '观察数据如何被分成多个数据包，并通过网络传输重组。理解序列号和TCP可靠性。',
        icon: <SendOutlined />,
        color: 'linear-gradient(135deg, #667eea, #764ba2)',
        component: PacketSimulator
    },
    {
        id: 'protocol',
        title: '网络协议分析',
        description: '像Wireshark一样分析数据包，了解TCP/IP协议的分层结构和封装过程。',
        icon: <ApartmentOutlined />,
        color: 'linear-gradient(135deg, #f093fb, #f5576c)',
        component: ProtocolAnalyzer
    },
    {
        id: 'ip',
        title: 'IP地址实验',
        description: '学习IP地址配置、子网掩码计算，对比IPv4与IPv6的区别。',
        icon: <GlobalOutlined />,
        color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
        component: IPAddressLab
    },
    {
        id: 'dns',
        title: 'DNS域名解析',
        description: '模拟域名解析过程，了解DNS层级查询和缓存机制。',
        icon: <CloudServerOutlined />,
        color: 'linear-gradient(135deg, #43e97b, #38f9d7)',
        component: DNSSimulator
    },
    {
        id: 'routing',
        title: '路由算法实验',
        description: '探究路由路径选择算法，模拟链路故障和路径重算。',
        icon: <NodeIndexOutlined />,
        color: 'linear-gradient(135deg, #fa709a, #fee140)',
        component: RoutingLab
    },
    {
        id: 'coding',
        title: '网络指令实验',
        description: '使用ping、tracert等命令检测网络连通性，理解网络诊断工具。',
        icon: <CodeOutlined />,
        color: 'linear-gradient(135deg, #a8edea, #fed6e3)',
        component: NetworkCommands
    },
    {
        id: 'store-forward',
        title: '存储转发机制',
        description: '模拟数据包在网络节点间存储与转发的过程，理解分组交换原理。',
        icon: <RetweetOutlined />,
        color: 'linear-gradient(135deg, #ff9a9e, #fecfef)',
        component: StoreForwardSimulator
    }
];

// 实验报告组件
const ExperimentReport = ({ experiment, data, onClose, onDownload }) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <>
            <div className="report-overlay" onClick={onClose} />
            <div className="experiment-report">
                <div className="report-header">
                    <TrophyOutlined style={{ fontSize: 48, color: '#ffd700', marginBottom: 12 }} />
                    <h3>🎉 实验完成!</h3>
                    <div className="date">{dateStr}</div>
                </div>
                <div className="report-content">
                    <div className="report-item">
                        <span className="label">实验名称</span>
                        <span className="value">{experiment?.title}</span>
                    </div>
                    {data?.items?.map((item, index) => (
                        <div className="report-item" key={index}>
                            <span className="label">{item.label}</span>
                            <span className="value">{item.value}</span>
                        </div>
                    ))}
                </div>
                <div className="report-actions">
                    <Button icon={<DownloadOutlined />} onClick={onDownload}>
                        下载报告
                    </Button>
                    <Button type="primary" icon={<CloseOutlined />} onClick={onClose}>
                        关闭
                    </Button>
                </div>
            </div>
        </>
    );
};

const NetworkLab = () => {
    const [currentExperiment, setCurrentExperiment] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [reportData, setReportData] = useState(null);

    // 进入实验
    const enterExperiment = (experiment) => {
        setCurrentExperiment(experiment);
    };

    // 返回首页
    const backToHome = () => {
        setCurrentExperiment(null);
    };

    // 完成实验，显示报告
    const completeExperiment = useCallback((data) => {
        setReportData(data);
        setShowReport(true);
    }, []);

    // 关闭报告
    const closeReport = () => {
        setShowReport(false);
        setReportData(null);
    };

    // 下载报告
    const downloadReport = () => {
        const report = {
            experiment: currentExperiment?.title,
            date: new Date().toISOString(),
            data: reportData
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `实验报告_${currentExperiment?.title}_${new Date().toLocaleDateString('zh-CN')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        message.success('报告已下载');
    };

    // 渲染实验室首页
    const renderHome = () => (
        <div className="network-lab">
            <div className="network-lab-header">
                <h2>🌐 网络实验室</h2>
                <p>通过交互式实验，探索计算机网络的奥秘</p>
            </div>

            <div className="experiment-grid">
                {experiments.map(exp => (
                    <div
                        key={exp.id}
                        className="experiment-card"
                        onClick={() => enterExperiment(exp)}
                    >
                        <div
                            className="experiment-card-icon"
                            style={{ background: exp.color }}
                        >
                            {exp.icon}
                        </div>
                        <h3>{exp.title}</h3>
                        <p>{exp.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    // 渲染实验界面
    const renderExperiment = () => {
        const ExperimentComponent = currentExperiment.component;

        return (
            <div className="experiment-container">
                <div className="experiment-header">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={backToHome}
                        style={{ marginRight: 16 }}
                    >
                        返回
                    </Button>
                    <h2>{currentExperiment.title}</h2>
                </div>
                <div className="experiment-content">
                    <ExperimentComponent onComplete={completeExperiment} />
                </div>
            </div>
        );
    };

    return (
        <>
            {currentExperiment ? renderExperiment() : renderHome()}

            {showReport && (
                <ExperimentReport
                    experiment={currentExperiment}
                    data={reportData}
                    onClose={closeReport}
                    onDownload={downloadReport}
                />
            )}
        </>
    );
};

export default NetworkLab;
