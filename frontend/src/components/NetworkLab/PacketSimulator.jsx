import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Slider, Switch, Steps, Collapse, Progress, Tag, message, Tooltip, Modal } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SendOutlined,
    DesktopOutlined,
    CloudServerOutlined,
    ReloadOutlined,
    ThunderboltOutlined,
    QuestionCircleOutlined,
    CheckCircleOutlined,
    FileTextOutlined,
    RightOutlined,
    PauseOutlined,
    CaretRightOutlined,
    DragOutlined
} from '@ant-design/icons';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { TextArea } = Input;
const { Panel } = Collapse;

// 可排序的 packet 组件
const SortablePacket = ({ packet }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: packet.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="sortable-item"
        >
            <div className="packet-seq">#{packet.seq}</div>
            <div className="packet-data">{packet.data}</div>
            <DragOutlined style={{ fontSize: 10, color: '#999', marginTop: 4 }} />
        </div>
    );
};

const PacketSimulator = ({ onComplete }) => {
    const [inputText, setInputText] = useState('Hello World!');
    const [packetSize, setPacketSize] = useState(4);
    const [packets, setPackets] = useState([]);
    const [receivedPackets, setReceivedPackets] = useState([]);
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showOutOfOrder, setShowOutOfOrder] = useState(true);
    const [simulateLoss, setSimulateLoss] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [transmissionProgress, setTransmissionProgress] = useState(0);
    const [experimentComplete, setExperimentComplete] = useState(false);
    const [isDragMode, setIsDragMode] = useState(false);
    const pauseRef = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const stepDescriptions = [
        { title: '输入数据', description: '输入文本并分包' },
        { title: '网络传输', description: '模拟网络传输过程' },
        { title: '接收重组', description: '拖拽数据包完成重排' },
        { title: '验证完成', description: '验证数据完整性' }
    ];

    // 分包逻辑 (返回生成的包以便立即使用)
    const generatePackets = (text, size) => {
        const newPackets = [];
        for (let i = 0; i < text.length; i += size) {
            newPackets.push({
                id: `pkt-${i}`,
                seq: Math.floor(i / size) + 1,
                data: text.substring(i, i + size),
                status: 'pending',
                x: 0
            });
        }
        return newPackets;
    };

    // 拖拽结束处理
    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setReceivedPackets((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // 验证重组结果
    const verifyReassembly = () => {
        const reassembled = receivedPackets.map(p => p.data).join('');
        const expect = inputText.trim();

        if (reassembled === expect) {
            message.success('恭喜！数据重组正确且完整！');
            setCurrentStep(3);
            setExperimentComplete(true);
        } else {
            Modal.error({
                title: '数据重组错误',
                content: (
                    <div>
                        <p>重组后的数据与原始数据不一致。</p>
                        <p><strong>预期:</strong> {expect}</p>
                        <p><strong>实际:</strong> {reassembled}</p>
                        <p>请检查数据包的序列号顺序是否正确。</p>
                    </div>
                )
            });
        }
    };

    // 传输逻辑
    const startTransmission = async () => {
        // 1. 准备数据
        let activePackets = packets;
        if (activePackets.length === 0) {
            const text = inputText.trim();
            if (!text) return;
            activePackets = generatePackets(text, packetSize);
            // 立即更新状态显示分包结果
            setPackets(activePackets);
            setReceivedPackets([]);
        }

        setIsTransmitting(true);
        setCurrentStep(1); // 移动到传输步骤
        setReceivedPackets([]);
        setTransmissionProgress(0);
        setIsDragMode(false);
        pauseRef.current = false;
        setIsPaused(false);

        // 2. 乱序逻辑
        let sendOrder = activePackets.map((_, i) => i);
        if (showOutOfOrder) {
            sendOrder.sort(() => Math.random() - 0.5);
        }

        // 3. 模拟传输循环
        const receivedBuffer = [];

        // 使用 activePackets 而不是依赖 state 中的 packets
        for (let i = 0; i < sendOrder.length; i++) {
            await new Promise(r => setTimeout(r, 800)); // 传输延迟

            const packetIndex = sendOrder[i];
            const packet = activePackets[packetIndex];

            // 更新发送端状态 (动画)
            setPackets(prev => prev.map((p, idx) =>
                idx === packetIndex ? { ...p, status: 'sent', x: 100 } : p
            ));

            // 更新接收端
            const receivedPacket = { ...packet, status: 'received' };
            receivedBuffer.push(receivedPacket);

            // 重要：这里需要更新 receivedPackets 状态以触发渲染
            setReceivedPackets([...receivedBuffer]);
            setTransmissionProgress(Math.round(((i + 1) / sendOrder.length) * 100));
        }

        // 4. 完成传输
        await new Promise(r => setTimeout(r, 500));
        setIsTransmitting(false);
        setIsDragMode(true);
        setCurrentStep(2);
        message.success('传输完成！请手动拖拽数据包进行重组。');
    };

    const exportReport = () => {
        if (onComplete) {
            onComplete({
                items: [
                    { label: '原始文本长度', value: `${inputText.length} 字符` },
                    { label: '数据包数量', value: `${packets.length} 个` },
                    { label: '每包大小', value: `${packetSize} 字符` },
                    { label: '乱序传输', value: showOutOfOrder ? '是' : '否' },
                    { label: '最终状态', value: '验证通过' }
                ]
            });
        }
    };

    return (
        <div className="lab-workspace">
            {/* 步骤条 */}
            <div className="lab-step-bar">
                <Steps
                    current={currentStep}
                    items={stepDescriptions.map(s => ({
                        title: <span style={{ color: '#fff' }}>{s.title}</span>,
                        description: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{s.description}</span>
                    }))}
                />
            </div>

            <div className="lab-main-content">
                {/* 左侧控制面板 */}
                <div className="lab-control-panel">
                    <div className="control-group">
                        <label>输入文本</label>
                        <TextArea
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            disabled={currentStep > 0 && !experimentComplete}
                            rows={3}
                            style={{ background: '#fff', color: '#000' }}
                        />
                    </div>

                    <div className="control-group">
                        <label>分包大小: {packetSize}</label>
                        <Slider
                            min={2}
                            max={10}
                            value={packetSize}
                            onChange={setPacketSize}
                            disabled={currentStep > 0}
                        />
                    </div>

                    <div className="switch-group">
                        <div className="switch-item">
                            <span>乱序传输</span>
                            <Switch checked={showOutOfOrder} onChange={setShowOutOfOrder} disabled={currentStep > 0} />
                        </div>
                    </div>

                    <div className="action-buttons" style={{ display: 'flex', gap: '12px' }}>
                        {currentStep === 0 && (
                            <Button type="primary" block style={{ flex: 1 }} onClick={startTransmission}>开始传输实验</Button>
                        )}
                        {currentStep === 2 && (
                            <Button type="primary" block style={{ flex: 1 }} onClick={verifyReassembly}>验证重组结果</Button>
                        )}
                        {experimentComplete && (
                            <Button type="primary" block style={{ flex: 1, background: '#52c41a', borderColor: '#52c41a' }} onClick={exportReport}>导出实验报告</Button>
                        )}
                        <Button block style={{ flex: 1 }} onClick={() => {
                            setPackets([]);
                            setReceivedPackets([]);
                            setCurrentStep(0);
                            setExperimentComplete(false);
                            setIsDragMode(false);
                        }}>重置实验</Button>
                    </div>

                    {/* 知识点说明 */}
                    <div className="knowledge-content" style={{ marginTop: 24 }}>
                        <h4 style={{ color: '#1890ff', marginBottom: 12 }}>📚 实验知识点</h4>
                        <ul className="knowledge-list">
                            <li><strong className="highlight">数据分包</strong>: 大数据块被分割成适合网络传输的小包(MTU限制)。</li>
                            <li><strong className="highlight">序列号</strong>: 每个TCP包都有序列号，用于接收端重组和乱序纠正。</li>
                            <li><strong className="highlight-warning">乱序到达</strong>: IP网络不保证顺序，TCP负责在接收端排序。</li>
                        </ul>
                    </div>
                </div>

                {/* 右侧交互区域 */}
                <div className="lab-interactive-area" style={{ display: 'flex', flexDirection: 'column' }}>

                    {/* 发送区域 (动画展示) */}
                    <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="section-title">
                            <DesktopOutlined /> 发送缓冲区
                            {isTransmitting && <Tag color="processing">正在发送...</Tag>}
                        </div>
                        {/* 简化展示发送队列 */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            {packets.map(p => (
                                <div key={p.id} className="sortable-item" style={{ opacity: p.status === 'sent' ? 0.5 : 1 }}>
                                    <div className="packet-seq">#{p.seq}</div>
                                    <div className="packet-data">{p.data}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 中间传输动画 (略，可后续增强) */}
                    {isTransmitting && (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                            <Progress percent={transmissionProgress} status="active" strokeColor="#1890ff" />
                            <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>数据包正在网络中飞奔... 🚀</div>
                        </div>
                    )}

                    {/* 接收重组区域 (拖拽交互核心) */}
                    <div className="receive-buffer-container" style={{ marginTop: 24 }}>
                        <div className="section-title" style={{ marginBottom: 16 }}>
                            <CloudServerOutlined /> 接收缓冲区 (重组区)
                            {isDragMode && !experimentComplete && (
                                <span className="instruction-badge">请拖拽数据包卡片，按序列号从小到大排列 →</span>
                            )}
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={receivedPackets.map(p => p.id)}
                                strategy={horizontalListSortingStrategy}
                            >
                                <div className={`droppable-area ${isDragMode ? 'active' : ''}`}>
                                    {receivedPackets.length === 0 && (
                                        <div className="buffer-placeholder">等待接收数据...</div>
                                    )}
                                    {receivedPackets.map((packet) => (
                                        <SortablePacket key={packet.id} packet={packet} />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    {/* 最终结果展示 */}
                    {experimentComplete && (
                        <div style={{ marginTop: 24, padding: 16, background: 'rgba(82, 196, 26, 0.1)', borderRadius: 8, border: '1px solid #52c41a' }}>
                            <h3 style={{ color: '#52c41a', textAlign: 'center', marginBottom: 0 }}>
                                <CheckCircleOutlined /> 实验成功！原始数据已完整还原
                            </h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PacketSimulator;
