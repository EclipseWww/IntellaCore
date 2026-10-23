import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Card, Button, Space, Typography, message, Modal, Input,
  Tooltip, Popconfirm, Tag, Divider, Row, Col, Alert
} from 'antd';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import {
  SaveOutlined,
  SendOutlined,
  DeleteOutlined,
  PlusOutlined,
  UndoOutlined,
  RedoOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  QuestionCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';

import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import ProcessNode from './nodes/ProcessNode';
import DecisionNode from './nodes/DecisionNode';
import DataNode from './nodes/DataNode';
import TextNode from './nodes/TextNode';


const { Title, Text } = Typography;
const { TextArea } = Input;

// 节点类型映射
const nodeTypes = {
  start: StartNode,
  end: EndNode,
  process: ProcessNode,
  decision: DecisionNode,
  data: DataNode,
  text: TextNode,
};

// 节点类型配置
const nodeTypeConfigs = [
  { type: 'start', label: '开始', color: '#52c41a', description: '流程的起点' },
  { type: 'end', label: '结束', color: '#ff4d4f', description: '流程的终点' },
  { type: 'process', label: '处理', color: '#1890ff', description: '执行操作或处理步骤' },
  { type: 'decision', label: '判断', color: '#faad14', description: '条件判断分支' },
  { type: 'data', label: '数据', color: '#722ed1', description: '输入/输出数据' },
  { type: 'text', label: '文本', color: '#8c8c8c', description: '添加说明文字或注释' },
];

// 默认边样式
const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: '#666',
  },
  style: {
    strokeWidth: 2,
    stroke: '#666',
  },
};

let nodeId = 0;
const getId = () => `node_${nodeId++}`;

const FlowchartEditor = ({
  mode = 'edit', // 'edit' | 'view' | 'template'
  initialData = null,
  template = null,
  referenceAnswer = null,
  instructions = '',
  allowedNodeTypes = null,
  maxNodes = 50,
  onSave = null,
  onSubmit = null,
  readOnly = false,
  showSubmitButton = true,
  lessonId = null,
  activityId = null,
}) => {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showReference, setShowReference] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [startTime] = useState(Date.now());

  // 初始化流程图数据
  useEffect(() => {
    if (initialData) {
      try {
        const data = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
        // 更新节点ID计数器
        const maxId = data.nodes?.reduce((max, node) => {
          const id = parseInt(node.id.replace('node_', ''));
          return isNaN(id) ? max : Math.max(max, id);
        }, 0) || 0;
        nodeId = maxId + 1;
      } catch (e) {
        console.error('解析流程图数据失败:', e);
      }
    } else if (template) {
      try {
        const data = typeof template === 'string' ? JSON.parse(template) : template;
        if (data.nodes) setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
        const maxId = data.nodes?.reduce((max, node) => {
          const id = parseInt(node.id.replace('node_', ''));
          return isNaN(id) ? max : Math.max(max, id);
        }, 0) || 0;
        nodeId = maxId + 1;
      } catch (e) {
        console.error('解析模板数据失败:', e);
      }
    }
  }, [initialData, template, setNodes, setEdges]);

  // 保存历史记录
  const saveHistory = useCallback(() => {
    const currentState = { nodes: [...nodes], edges: [...edges] };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // 连接节点
  const onConnect = useCallback(
    (params) => {
      if (readOnly) return;
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
      saveHistory();
    },
    [setEdges, readOnly, saveHistory]
  );

  // 拖拽放置节点
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (readOnly) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      // 检查节点数量限制
      if (nodes.length >= maxNodes) {
        message.warning(`最多只能添加 ${maxNodes} 个节点`);
        return;
      }

      // 检查节点类型是否允许
      if (allowedNodeTypes && allowedNodeTypes.length > 0 && !allowedNodeTypes.includes(type)) {
        message.warning('此活动不允许使用该类型的节点');
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const config = nodeTypeConfigs.find(c => c.type === type);
      const newNode = {
        id: getId(),
        type,
        position,
        data: {
          label: config?.label || type,
          onLabelChange: handleLabelChange,
        },
        style: {
          width: type === 'decision' ? 50 : type === 'data' ? 70 : type === 'text' ? 60 : 60,
          height: type === 'decision' ? 50 : type === 'data' ? 35 : type === 'text' ? 24 : 28,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      saveHistory();
    },
    [reactFlowInstance, nodes.length, maxNodes, allowedNodeTypes, setNodes, readOnly, saveHistory]
  );

  // 添加节点（通过按钮）
  const handleAddNode = (type) => {
    if (readOnly) return;

    if (nodes.length >= maxNodes) {
      message.warning(`最多只能添加 ${maxNodes} 个节点`);
      return;
    }

    if (allowedNodeTypes && allowedNodeTypes.length > 0 && !allowedNodeTypes.includes(type)) {
      message.warning('此活动不允许使用该类型的节点');
      return;
    }

    const config = nodeTypeConfigs.find(c => c.type === type);
    const newNode = {
      id: getId(),
      type,
      position: {
        x: Math.random() * 300 + 50,
        y: Math.random() * 200 + 50
      },
      data: {
        label: config?.label || type,
        onLabelChange: handleLabelChange,
      },
      style: {
        width: type === 'decision' ? 50 : type === 'data' ? 70 : type === 'text' ? 60 : 60,
        height: type === 'decision' ? 50 : type === 'data' ? 35 : type === 'text' ? 24 : 28,
      },
    };

    setNodes((nds) => nds.concat(newNode));
    saveHistory();
  };

  // 节点标签变更
  const handleLabelChange = useCallback((nodeId, newLabel) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel,
              isEditing: false
            }
          };
        }
        return node;
      })
    );
    saveHistory();
  }, [setNodes, saveHistory]);

  // 删除选中的节点
  const handleDeleteSelected = () => {
    if (readOnly) return;

    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
    saveHistory();
  };

  // 清空画布
  const handleClear = () => {
    if (readOnly) return;
    setNodes([]);
    setEdges([]);
    nodeId = 0;
    saveHistory();
  };

  // 获取流程图数据
  const getFlowchartData = () => {
    return JSON.stringify({
      nodes: nodes.map(n => ({
        ...n,
        data: { label: n.data.label } // 只保存label，移除函数
      })),
      edges,
    });
  };

  // 保存草稿
  const handleSave = async () => {
    if (onSave) {
      const data = getFlowchartData();
      await onSave(data);
    }
  };

  // 提交流程图
  const handleSubmit = async () => {
    if (nodes.length === 0) {
      message.warning('请先绘制流程图');
      return;
    }

    // 检查是否有开始和结束节点
    const hasStart = nodes.some(n => n.type === 'start');
    const hasEnd = nodes.some(n => n.type === 'end');

    if (!hasStart || !hasEnd) {
      Modal.confirm({
        title: '提示',
        content: '流程图中缺少开始或结束节点，是否继续提交？',
        onOk: async () => {
          if (onSubmit) {
            const data = getFlowchartData();
            const duration = Math.round((Date.now() - startTime) / 1000);
            await onSubmit(data, duration);
          }
        },
      });
      return;
    }

    if (onSubmit) {
      const data = getFlowchartData();
      const duration = Math.round((Date.now() - startTime) / 1000);
      await onSubmit(data, duration);
    }
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 节点拖拽开始
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // 双击节点进入编辑模式
  const onNodeDoubleClick = useCallback((event, node) => {
    if (readOnly) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            data: { ...n.data, isEditing: true }
          };
        }
        // 当点击一个节点时，取消其他节点的编辑状态
        return {
          ...n,
          data: { ...n.data, isEditing: false }
        };
      })
    );
  }, [readOnly, setNodes]);

  // 过滤可用的节点类型
  const availableNodeTypes = allowedNodeTypes && allowedNodeTypes.length > 0
    ? nodeTypeConfigs.filter(config => allowedNodeTypes.includes(config.type))
    : nodeTypeConfigs;

  return (
    <div
      className={`flowchart-editor ${isFullscreen ? 'fullscreen' : ''}`}
      style={{
        height: isFullscreen ? '100vh' : '600px',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 1000 : 'auto',
        background: '#fff',
      }}
    >
      {/* 说明区域 */}
      {instructions && (
        <Card
          size="small"
          title="绘制说明"
          style={{ marginBottom: 16 }}
          type="inner"
        >
          <MarkdownRenderer content={instructions} />
        </Card>
      )}

      <Row gutter={16} style={{ height: isFullscreen ? '100%' : 'calc(100% - 60px)' }}>
        {/* 节点工具栏 */}
        {!readOnly && (
          <Col span={4}>
            <Card
              title="节点工具"
              size="small"
              style={{ height: '100%', overflowY: 'auto' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {availableNodeTypes.map((config) => (
                  <Tooltip key={config.type} title={config.description} placement="right">
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, config.type)}
                      onClick={() => handleAddNode(config.type)}
                      style={{
                        padding: '10px',
                        marginBottom: '10px',
                        cursor: 'grab',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '60px',
                        transition: 'all 0.3s',
                      }}
                      className="node-tool-item"
                    >
                      {/* 根据不同类型渲染不同形状 */}
                      {config.type === 'start' || config.type === 'end' ? (
                        <div style={{
                          width: '100%',
                          height: '40px',
                          borderRadius: '20px',
                          border: `2px solid ${config.color}`,
                          background: `${config.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: config.color,
                          fontWeight: 'bold',
                        }}>
                          {config.label}
                        </div>
                      ) : config.type === 'decision' ? (
                        <div style={{
                          width: '40px',
                          height: '40px',
                          transform: 'rotate(45deg)',
                          border: `2px solid ${config.color}`,
                          background: `${config.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <div style={{
                            transform: 'rotate(-45deg)',
                            color: config.color,
                            fontWeight: 'bold',
                            fontSize: '12px',
                            width: '60px',
                            textAlign: 'center'
                          }}>
                            {config.label}
                          </div>
                        </div>
                      ) : config.type === 'data' ? (
                        <div style={{
                          width: '90%',
                          height: '40px',
                          transform: 'skew(-20deg)',
                          border: `2px solid ${config.color}`,
                          background: `${config.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: '10px'
                        }}>
                          <div style={{
                            transform: 'skew(20deg)',
                            color: config.color,
                            fontWeight: 'bold',
                          }}>
                            {config.label}
                          </div>
                        </div>
                      ) : config.type === 'text' ? (
                        // Text annotation - no border/background
                        <div style={{
                          width: '100%',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: config.color,
                          fontWeight: 'bold',
                          fontStyle: 'italic',
                        }}>
                          T 文本
                        </div>
                      ) : (
                        // Default process rectangle
                        <div style={{
                          width: '100%',
                          height: '40px',
                          borderRadius: '4px',
                          border: `2px solid ${config.color}`,
                          background: `${config.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: config.color,
                          fontWeight: 'bold',
                        }}>
                          {config.label}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                ))}
              </Space>

              <Divider />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  💡 拖拽节点到画布或点击添加
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  💡 双击节点可编辑文字
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  💡 从节点边缘拖出连线
                </Text>
              </Space>
            </Card>
          </Col>
        )}

        {/* 流程图画布 */}
        <Col span={readOnly ? 24 : 20}>
          <Card
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ height: 'calc(100% - 48px)', padding: 0 }}
            title={
              <Space>
                <span>流程图画布</span>
                <Tag color="blue">节点: {nodes.length}/{maxNodes}</Tag>
                <Tag color="green">连线: {edges.length}</Tag>
              </Space>
            }
            extra={
              <Space>
                {!readOnly && (
                  <>
                    <Tooltip title="撤销">
                      <Button
                        icon={<UndoOutlined />}
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                      />
                    </Tooltip>
                    <Tooltip title="重做">
                      <Button
                        icon={<RedoOutlined />}
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                      />
                    </Tooltip>
                    <Tooltip title="删除选中">
                      <Button
                        icon={<DeleteOutlined />}
                        onClick={handleDeleteSelected}
                        danger
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定要清空画布吗？"
                      onConfirm={handleClear}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button danger>清空</Button>
                    </Popconfirm>
                  </>
                )}
                {referenceAnswer && (
                  <Tooltip title={showReference ? '隐藏参考答案' : '查看参考答案'}>
                    <Button
                      icon={showReference ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={() => setShowReference(!showReference)}
                    >
                      参考答案
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
                  <Button
                    icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    onClick={toggleFullscreen}
                  />
                </Tooltip>
              </Space>
            }
          >
            <div ref={reactFlowWrapper} style={{ height: '100%' }}>
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes.map(n => ({
                    ...n,
                    ...n,
                    data: { ...n.data, onLabelChange: handleLabelChange }
                  }))}
                  edges={edges}
                  onNodesChange={readOnly ? undefined : onNodesChange}
                  onEdgesChange={readOnly ? undefined : onEdgesChange}
                  onConnect={onConnect}
                  onInit={setReactFlowInstance}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onNodeDoubleClick={onNodeDoubleClick}
                  // 点击画布空白处取消编辑状态
                  onPaneClick={() => {
                    setNodes((nds) =>
                      nds.map(n => ({
                        ...n,
                        data: { ...n.data, isEditing: false }
                      }))
                    );
                  }}
                  nodeTypes={nodeTypes}
                  defaultEdgeOptions={defaultEdgeOptions}
                  fitView
                  snapToGrid
                  snapGrid={[15, 15]}
                  deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
                  selectionKeyCode={readOnly ? null : 'Shift'}
                  nodesDraggable={!readOnly}
                  nodesConnectable={!readOnly}
                  connectionRadius={30}
                  elementsSelectable={!readOnly}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
                  minZoom={0.3}
                  maxZoom={2}
                >
                  <Controls showInteractive={!readOnly} />
                  <Background variant="dots" gap={15} size={1} />
                  <MiniMap
                    nodeStrokeWidth={3}
                    zoomable
                    pannable
                  />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 底部操作栏 */}
      {
        !readOnly && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              {onSave && (
                <Button icon={<SaveOutlined />} onClick={handleSave}>
                  保存草稿
                </Button>
              )}
              {showSubmitButton && onSubmit && (
                <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit}>
                  提交流程图
                </Button>
              )}
            </Space>
          </div>
        )
      }



      {/* 参考答案弹窗 */}
      <Modal
        title="参考答案"
        open={showReference}
        onCancel={() => setShowReference(false)}
        footer={null}
        width={800}
      >
        {referenceAnswer && (
          <div style={{ height: 500 }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={(() => {
                  try {
                    const data = typeof referenceAnswer === 'string'
                      ? JSON.parse(referenceAnswer)
                      : referenceAnswer;
                    return data.nodes || [];
                  } catch {
                    return [];
                  }
                })()}
                edges={(() => {
                  try {
                    const data = typeof referenceAnswer === 'string'
                      ? JSON.parse(referenceAnswer)
                      : referenceAnswer;
                    return data.edges || [];
                  } catch {
                    return [];
                  }
                })()}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
              >
                <Controls showInteractive={false} />
                <Background variant="dots" gap={15} size={1} />
              </ReactFlow>
            </ReactFlowProvider>
          </div>
        )}
      </Modal>

      <style>{`
        .flowchart-editor.fullscreen {
          padding: 16px;
          background: #f0f2f5;
        }
        .react-flow__node {
          cursor: pointer;
        }
        .react-flow__node.selected {
          box-shadow: 0 0 0 2px #1890ff;
        }
      `}</style>
    </div >
  );
};

export default FlowchartEditor;

