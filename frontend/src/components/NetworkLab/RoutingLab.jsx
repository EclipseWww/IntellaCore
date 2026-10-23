import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button, InputNumber, Space, Tag, Select, message, Tooltip } from 'antd';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    PlayCircleOutlined,
    ReloadOutlined,
    DisconnectOutlined,
    NodeIndexOutlined,
    ThunderboltOutlined
} from '@ant-design/icons';

// 初始节点配置
const initialNodes = [
    { id: 'A', position: { x: 50, y: 150 }, data: { label: 'A\n(源)' }, style: { background: '#667eea', color: '#fff', borderRadius: 8, padding: 10 } },
    { id: 'B', position: { x: 200, y: 50 }, data: { label: 'B' }, style: { background: '#3498db', color: '#fff', borderRadius: 8, padding: 10 } },
    { id: 'C', position: { x: 200, y: 250 }, data: { label: 'C' }, style: { background: '#3498db', color: '#fff', borderRadius: 8, padding: 10 } },
    { id: 'D', position: { x: 350, y: 150 }, data: { label: 'D' }, style: { background: '#3498db', color: '#fff', borderRadius: 8, padding: 10 } },
    { id: 'E', position: { x: 500, y: 50 }, data: { label: 'E' }, style: { background: '#3498db', color: '#fff', borderRadius: 8, padding: 10 } },
    { id: 'F', position: { x: 500, y: 250 }, data: { label: 'F\n(目标)' }, style: { background: '#2ecc71', color: '#fff', borderRadius: 8, padding: 10 } }
];

// 初始边配置
const initialEdges = [
    { id: 'A-B', source: 'A', target: 'B', label: '2', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'A-C', source: 'A', target: 'C', label: '4', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'B-D', source: 'B', target: 'D', label: '3', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'C-D', source: 'C', target: 'D', label: '1', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'B-E', source: 'B', target: 'E', label: '5', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'D-E', source: 'D', target: 'E', label: '2', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'D-F', source: 'D', target: 'F', label: '4', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'E-F', source: 'E', target: 'F', label: '1', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } },
    { id: 'C-F', source: 'C', target: 'F', label: '6', type: 'default', animated: false, style: { stroke: '#00d4ff' }, labelStyle: { fill: '#fff', fontWeight: 700 }, labelBgStyle: { fill: 'rgba(0,0,0,0.7)' } }
];

const RoutingLab = ({ onComplete }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [sourceNode, setSourceNode] = useState('A');
    const [targetNode, setTargetNode] = useState('F');
    const [isCalculating, setIsCalculating] = useState(false);
    const [shortestPath, setShortestPath] = useState(null);
    const [pathCost, setPathCost] = useState(0);
    const [algorithmSteps, setAlgorithmSteps] = useState([]);
    const [disabledEdges, setDisabledEdges] = useState(new Set());

    // 构建邻接表
    const buildGraph = useCallback(() => {
        const graph = {};
        nodes.forEach(node => {
            graph[node.id] = {};
        });

        edges.forEach(edge => {
            if (!disabledEdges.has(edge.id)) {
                const weight = parseInt(edge.label) || 1;
                graph[edge.source][edge.target] = weight;
                graph[edge.target][edge.source] = weight; // 无向图
            }
        });

        return graph;
    }, [nodes, edges, disabledEdges]);

    // Dijkstra算法
    const dijkstra = useCallback(async (start, end) => {
        const graph = buildGraph();
        const distances = {};
        const previous = {};
        const unvisited = new Set();
        const steps = [];

        // 初始化
        nodes.forEach(node => {
            distances[node.id] = Infinity;
            previous[node.id] = null;
            unvisited.add(node.id);
        });
        distances[start] = 0;

        steps.push({ type: 'init', text: `初始化: 源节点 ${start} 距离设为 0，其他节点设为 ∞` });

        while (unvisited.size > 0) {
            // 找到距离最小的未访问节点
            let minNode = null;
            let minDist = Infinity;
            unvisited.forEach(node => {
                if (distances[node] < minDist) {
                    minDist = distances[node];
                    minNode = node;
                }
            });

            if (minNode === null || minDist === Infinity) break;
            if (minNode === end) {
                steps.push({ type: 'found', text: `✓ 到达目标节点 ${end}!` });
                break;
            }

            unvisited.delete(minNode);
            steps.push({ type: 'visit', text: `访问节点 ${minNode} (当前距离: ${distances[minNode]})` });

            // 更新相邻节点
            for (const neighbor in graph[minNode]) {
                if (unvisited.has(neighbor)) {
                    const newDist = distances[minNode] + graph[minNode][neighbor];
                    if (newDist < distances[neighbor]) {
                        distances[neighbor] = newDist;
                        previous[neighbor] = minNode;
                        steps.push({
                            type: 'update',
                            text: `  更新 ${neighbor}: ${distances[neighbor] === Infinity ? '∞' : distances[neighbor]} → ${newDist} (经过 ${minNode})`
                        });
                    }
                }
            }

            // 可视化当前节点
            setAlgorithmSteps([...steps]);
            await new Promise(r => setTimeout(r, 500));
        }

        // 重建路径
        const path = [];
        let current = end;
        while (current !== null) {
            path.unshift(current);
            current = previous[current];
        }

        if (path[0] !== start) {
            steps.push({ type: 'error', text: `✗ 无法找到从 ${start} 到 ${end} 的路径` });
            return { path: [], cost: Infinity, steps };
        }

        steps.push({ type: 'result', text: `最短路径: ${path.join(' → ')} (总距离: ${distances[end]})` });
        return { path, cost: distances[end], steps };
    }, [buildGraph, nodes]);

    // 运行算法
    const runAlgorithm = async () => {
        setIsCalculating(true);
        setShortestPath(null);
        setAlgorithmSteps([]);

        // 重置边的样式
        setEdges(eds => eds.map(e => ({
            ...e,
            animated: false,
            style: {
                ...e.style,
                stroke: disabledEdges.has(e.id) ? '#666' : '#00d4ff',
                strokeWidth: 2,
                strokeDasharray: disabledEdges.has(e.id) ? '5,5' : 'none'
            }
        })));

        const result = await dijkstra(sourceNode, targetNode);

        if (result.path.length > 0) {
            setShortestPath(result.path);
            setPathCost(result.cost);

            // 高亮路径上的边
            const pathEdges = [];
            for (let i = 0; i < result.path.length - 1; i++) {
                const from = result.path[i];
                const to = result.path[i + 1];
                pathEdges.push(`${from}-${to}`);
                pathEdges.push(`${to}-${from}`);
            }

            setEdges(eds => eds.map(e => ({
                ...e,
                animated: pathEdges.includes(e.id),
                style: {
                    ...e.style,
                    stroke: pathEdges.includes(e.id) ? '#2ecc71' : (disabledEdges.has(e.id) ? '#666' : '#00d4ff'),
                    strokeWidth: pathEdges.includes(e.id) ? 4 : 2
                }
            })));

            // 高亮路径上的节点
            setNodes(nds => nds.map(n => ({
                ...n,
                style: {
                    ...n.style,
                    background: result.path.includes(n.id) ? '#2ecc71' :
                        n.id === sourceNode ? '#667eea' :
                            n.id === targetNode ? '#2ecc71' : '#3498db',
                    boxShadow: result.path.includes(n.id) ? '0 0 15px #2ecc71' : 'none'
                }
            })));
        }

        setAlgorithmSteps(result.steps);
        setIsCalculating(false);

        if (onComplete && result.path.length > 0) {
            onComplete({
                items: [
                    { label: '源节点', value: sourceNode },
                    { label: '目标节点', value: targetNode },
                    { label: '最短路径', value: result.path.join(' → ') },
                    { label: '路径总权重', value: result.cost },
                    { label: '使用算法', value: 'Dijkstra' }
                ]
            });
        }
    };

    // 切换边的禁用状态（模拟链路故障）
    const toggleEdgeDisabled = (edgeId) => {
        setDisabledEdges(prev => {
            const newSet = new Set(prev);
            if (newSet.has(edgeId)) {
                newSet.delete(edgeId);
            } else {
                newSet.add(edgeId);
            }
            return newSet;
        });

        setEdges(eds => eds.map(e => ({
            ...e,
            style: {
                ...e.style,
                stroke: disabledEdges.has(e.id) && e.id !== edgeId ? '#666' :
                    !disabledEdges.has(e.id) && e.id === edgeId ? '#666' : '#00d4ff',
                strokeDasharray: (disabledEdges.has(e.id) && e.id !== edgeId) ||
                    (!disabledEdges.has(e.id) && e.id === edgeId) ? '5,5' : 'none'
            }
        })));

        setShortestPath(null);
        setAlgorithmSteps([]);
    };

    // 重置
    const reset = () => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        setDisabledEdges(new Set());
        setShortestPath(null);
        setPathCost(0);
        setAlgorithmSteps([]);
    };

    const nodeOptions = nodes.map(n => ({ value: n.id, label: n.id }));

    return (
        <div className="routing-lab">
            {/* 工具栏 */}
            <div className="routing-toolbar">
                <Space wrap>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>源节点:</span>
                    <Select
                        value={sourceNode}
                        onChange={setSourceNode}
                        options={nodeOptions}
                        style={{ width: 80 }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>目标节点:</span>
                    <Select
                        value={targetNode}
                        onChange={setTargetNode}
                        options={nodeOptions}
                        style={{ width: 80 }}
                    />
                    <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={runAlgorithm}
                        loading={isCalculating}
                    >
                        运行 Dijkstra
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={reset}
                    >
                        重置
                    </Button>
                </Space>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DisconnectOutlined style={{ color: '#e74c3c' }} />
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                        点击下方链路切断连接，模拟故障
                    </span>
                </div>
            </div>

            {/* 网络拓扑图 */}
            <div className="routing-canvas">
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onEdgeClick={(_, edge) => toggleEdgeDisabled(edge.id)}
                        fitView
                        attributionPosition="bottom-left"
                        style={{ background: 'rgba(0,0,0,0.3)' }}
                    >
                        <Controls />
                        <Background color="#444" gap={16} />
                    </ReactFlow>
                </ReactFlowProvider>
            </div>

            {/* 结果显示 */}
            <div className="routing-info">
                <div style={{ display: 'flex', gap: 24 }}>
                    {/* 算法步骤 */}
                    <div style={{ flex: 1 }}>
                        <h4 style={{ color: '#00d4ff', marginBottom: 12 }}>
                            <NodeIndexOutlined style={{ marginRight: 8 }} />
                            算法执行步骤
                        </h4>
                        <div style={{
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: 8,
                            padding: 12,
                            maxHeight: 200,
                            overflow: 'auto',
                            fontSize: 12,
                            fontFamily: 'Consolas, monospace'
                        }}>
                            {algorithmSteps.map((step, index) => (
                                <div
                                    key={index}
                                    style={{
                                        color: step.type === 'found' || step.type === 'result' ? '#2ecc71' :
                                            step.type === 'error' ? '#e74c3c' :
                                                step.type === 'update' ? '#f1c40f' :
                                                    'rgba(255,255,255,0.8)',
                                        marginBottom: 4
                                    }}
                                >
                                    {step.text}
                                </div>
                            ))}
                            {algorithmSteps.length === 0 && (
                                <div style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    点击"运行 Dijkstra"查看算法执行过程
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 最短路径 */}
                    <div style={{ flex: 1 }}>
                        <h4 style={{ color: '#00d4ff', marginBottom: 12 }}>
                            <ThunderboltOutlined style={{ marginRight: 8 }} />
                            最短路径
                        </h4>
                        {shortestPath ? (
                            <div>
                                <div className="routing-path">
                                    {shortestPath.map((node, index) => (
                                        <React.Fragment key={node}>
                                            <span className="node">{node}</span>
                                            {index < shortestPath.length - 1 && (
                                                <span className="arrow">→</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div style={{ marginTop: 12 }}>
                                    <Tag color="green" style={{ fontSize: 14 }}>
                                        总距离: {pathCost}
                                    </Tag>
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: 'rgba(255,255,255,0.4)' }}>
                                尚未计算
                            </div>
                        )}

                        {/* 已禁用的链路 */}
                        {disabledEdges.size > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <div style={{ color: '#e74c3c', marginBottom: 8 }}>
                                    <DisconnectOutlined style={{ marginRight: 8 }} />
                                    已断开的链路:
                                </div>
                                <Space wrap>
                                    {Array.from(disabledEdges).map(edgeId => (
                                        <Tag
                                            key={edgeId}
                                            color="error"
                                            closable
                                            onClose={() => toggleEdgeDisabled(edgeId)}
                                        >
                                            {edgeId}
                                        </Tag>
                                    ))}
                                </Space>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoutingLab;
