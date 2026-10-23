import React, { useEffect, useRef, useCallback } from 'react';
import { Button, Space, Card, message, Alert } from 'antd';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import MarkdownRenderer from '../shared/MarkdownRenderer';

/**
 * MxGraphEditor - 使用 mxGraph 原生编辑器的组件
 * 通过新窗口或 iframe 打开编辑器
 * 
 * 编辑器会记录 lessonId 和 activityId，即使父页面被关闭也能独立保存
 */
const MxGraphEditor = ({
    mode = 'edit', // 'edit' | 'view'
    initialData = null,
    instructions = '',
    lessonId = null,      // 课时ID，用于独立保存
    activityId = null,    // 活动ID，用于独立保存
    onSave = null,        // 可选的保存回调
    onSubmit = null,      // 可选的提交回调
    readOnly = false,
    showSubmitButton = true,
}) => {
    const editorWindowRef = useRef(null);
    const iframeRef = useRef(null);

    // 使用 ref 保存回调函数，避免闭包问题
    const onSaveRef = useRef(onSave);
    const onSubmitRef = useRef(onSubmit);

    // 更新 ref 以始终指向最新的回调
    useEffect(() => {
        onSaveRef.current = onSave;
        onSubmitRef.current = onSubmit;
    }, [onSave, onSubmit]);

    // 发送消息给编辑器
    const sendMessage = useCallback((data) => {
        if (editorWindowRef.current && !editorWindowRef.current.closed) {
            editorWindowRef.current.postMessage(data, '*');
        }
        if (iframeRef.current) {
            iframeRef.current.contentWindow.postMessage(data, '*');
        }
    }, []);

    // 处理来自编辑器的消息（用于成功/失败反馈，编辑器会独立保存）
    useEffect(() => {
        const handleMessage = (event) => {
            const msg = event.data;
            if (!msg || !msg.type) return;

            switch (msg.type) {
                case 'ready':
                    console.log('mxGraph 编辑器已准备就绪');
                    break;
                case 'saveSuccess':
                    // 编辑器独立保存成功，刷新父页面数据（如果回调存在）
                    if (onSubmitRef.current) {
                        // 触发父页面刷新数据
                        onSubmitRef.current(msg.data, msg.duration).catch(err => {
                            console.error('刷新数据失败:', err);
                        });
                    }
                    break;
                case 'saveError':
                    console.error('保存失败:', msg.error);
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // 打开编辑器窗口
    const openEditor = useCallback(() => {
        // 构建 URL 参数 - 不再传递 data，改用 postMessage
        const params = new URLSearchParams();
        if (readOnly) params.set('readonly', '1');
        // 标记有初始数据，等待 postMessage
        if (initialData) params.set('hasData', '1');

        // 传递 lessonId 和 activityId 给编辑器，让它能独立保存
        if (lessonId) params.set('lessonId', lessonId);
        if (activityId) params.set('activityId', activityId);

        // 传递认证 token
        const token = localStorage.getItem('token');
        if (token) params.set('token', token);

        const url = `/mxgraph/editor.html?${params.toString()}`;

        // 打开新窗口
        const newWindow = window.open(
            url,
            'mxgraph_editor',
            'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
        );
        editorWindowRef.current = newWindow;

        // 如果有初始数据，等待编辑器准备好后发送
        if (initialData && newWindow) {
            const sendDataWhenReady = (event) => {
                if (event.data?.type === 'ready' && event.source === newWindow) {
                    newWindow.postMessage({ type: 'load', data: initialData }, '*');
                    window.removeEventListener('message', sendDataWhenReady);
                }
            };
            window.addEventListener('message', sendDataWhenReady);
        }
    }, [initialData, readOnly, lessonId, activityId]);

    // 打开只读查看器窗口
    const openViewer = useCallback(() => {
        const params = new URLSearchParams();
        params.set('readonly', '1');
        // 标记有初始数据，等待 postMessage
        if (initialData) params.set('hasData', '1');

        const url = `/mxgraph/editor.html?${params.toString()}`;

        const newWindow = window.open(
            url,
            'mxgraph_viewer',
            'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no'
        );

        // 如果有初始数据，等待编辑器准备好后发送
        if (initialData && newWindow) {
            const sendDataWhenReady = (event) => {
                if (event.data?.type === 'ready' && event.source === newWindow) {
                    newWindow.postMessage({ type: 'load', data: initialData }, '*');
                    window.removeEventListener('message', sendDataWhenReady);
                }
            };
            window.addEventListener('message', sendDataWhenReady);
        }
    }, [initialData]);

    // 只读模式 - 显示按钮打开查看器
    if (mode === 'view' || readOnly) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Card
                    size="small"
                    title="流程图作业"
                    style={{ marginBottom: 16 }}
                    type="inner"
                    extra={
                        <Button
                            type="primary"
                            icon={<EyeOutlined />}
                            onClick={openViewer}
                        >
                            查看流程图
                        </Button>
                    }
                >
                    {instructions ? (
                        <MarkdownRenderer content={instructions} />
                    ) : (
                        <div style={{ textAlign: 'center', color: '#999', padding: '12px 0' }}>
                            点击右上角按钮查看已提交的流程图
                        </div>
                    )}
                </Card>

                {initialData && (
                    <Alert
                        message="已有提交的流程图"
                        description="此作业已评分，仅可查看，无法修改"
                        type="success"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}
            </div>
        );
    }

    // 编辑模式 - 显示按钮打开编辑器
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Card
                size="small"
                title="绘制说明"
                style={{ marginBottom: 16 }}
                type="inner"
                extra={
                    <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={openEditor}
                    >
                        开始创作
                    </Button>
                }
            >
                {instructions ? (
                    <MarkdownRenderer content={instructions} />
                ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: '12px 0' }}>
                        点击右上角按钮开始绘制流程图
                    </div>
                )}
            </Card>

            {initialData && (
                <Alert
                    message="已有保存的流程图数据"
                    description="打开编辑器后将自动加载您之前保存的内容"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}
        </div>
    );
};

export default MxGraphEditor;
