import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Space, Card, Spin, Tooltip, Divider, Modal, Dropdown, Switch, Input } from 'antd';
import {
    PlayCircleOutlined,
    ClearOutlined,
    ExpandOutlined,
    CompressOutlined,
    StopOutlined,
    LoadingOutlined,
    BookOutlined,
    PlusOutlined,
    MinusOutlined,
    FontSizeOutlined,
    UndoOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import CodeEditor from './LazyCodeEditor';
import TurtleWindow from './TurtleWindow';
import syntaxReferences from './syntaxReferences';
import { pythonRunner } from './pythonRunner';
import { formatPythonError } from './pythonErrorTranslator';
import './PythonEditor.css';

// 控制台最多保留的字符数，超出后丢弃最早的输出，避免大量 print 拖垮页面
const MAX_CONSOLE_CHARS = 300 * 1024;
const CONSOLE_TRIMMED_NOTICE = '…（前面的输出过多，已省略）\n';

const codeBlockStyle = {
    background: '#1e1e1e',
    padding: '12px 16px',
    borderRadius: 8,
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 14,
    color: '#d4d4d4',
    whiteSpace: 'pre-wrap'
};

/**
 * Python代码编辑器组件
 * 代码在 Web Worker 中由 Pyodide (WebAssembly CPython) 执行，支持交互式 input()、turtle 绘图。
 */
const PythonEditor = ({
    initialCode = '# 在这里编写你的Python代码\nprint("Hello, World!")\n',
    starterCode = null,      // 提供时显示“重置为初始代码”按钮
    readOnly = false,
    onCodeChange,
    onExecutionComplete,
    onSave,                  // Ctrl+S 快捷键
    height = '400px',
    scoreTag = null,         // 得分标签（显示在运行按钮之前）
    extraButtons = null      // 额外的按钮（如保存、提交，显示在运行按钮之后）
}) => {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [runnerStatus, setRunnerStatus] = useState(pythonRunner.status);
    const [runnerError, setRunnerError] = useState(pythonRunner.error);
    const [waitingForInput, setWaitingForInput] = useState(false);
    const [currentInput, setCurrentInput] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const [currentLine, setCurrentLine] = useState(1);
    const [errorLine, setErrorLine] = useState(null);
    const [presetInputEnabled, setPresetInputEnabled] = useState(false);
    const [presetInput, setPresetInput] = useState('');

    const [syntaxModalVisible, setSyntaxModalVisible] = useState(false);
    const [selectedSyntax, setSelectedSyntax] = useState(null);

    // Turtle：命令数组原地追加，动画循环每帧读取；每次运行换新数组并递增 runId 触发重置
    const turtleCommandsRef = useRef([]);
    const [turtleRunId, setTurtleRunId] = useState(0);
    const [showTurtlePopup, setShowTurtlePopup] = useState(false);

    const outputRef = useRef(null);
    const inputRef = useRef(null);
    const consoleRef = useRef('');
    const flushFrameRef = useRef(null);
    const runningRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => pythonRunner.subscribe((status, error) => {
        setRunnerStatus(status);
        setRunnerError(error);
    }), []);

    useEffect(() => {
        pythonRunner.ensure().catch(() => {});
        return () => {
            mountedRef.current = false;
            if (flushFrameRef.current) cancelAnimationFrame(flushFrameRef.current);
            if (runningRef.current) pythonRunner.stop();
        };
    }, []);

    useEffect(() => {
        setCode(initialCode);
    }, [initialCode]);

    useEffect(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, [output, waitingForInput]);

    useEffect(() => {
        if (waitingForInput) inputRef.current?.focus();
    }, [waitingForInput]);

    // 输出先写入缓冲，每帧最多刷新一次界面
    const scheduleFlush = useCallback(() => {
        if (flushFrameRef.current) return;
        flushFrameRef.current = requestAnimationFrame(() => {
            flushFrameRef.current = null;
            if (mountedRef.current) setOutput(consoleRef.current);
        });
    }, []);

    const appendOutput = useCallback((text) => {
        let next = consoleRef.current + text;
        if (next.length > MAX_CONSOLE_CHARS) {
            next = CONSOLE_TRIMMED_NOTICE + next.slice(next.length - MAX_CONSOLE_CHARS);
        }
        consoleRef.current = next;
        scheduleFlush();
    }, [scheduleFlush]);

    const resetOutput = useCallback(() => {
        consoleRef.current = '';
        setOutput('');
    }, []);

    const handleCodeChange = useCallback((newCode) => {
        setCode(newCode);
        onCodeChange?.(newCode);
    }, [onCodeChange]);

    const handleTurtle = useCallback((cmds) => {
        for (const command of cmds) {
            if (command.cmd === 'init') {
                // 同一次运行只在第一次创建乌龟时清空画布
                if (turtleCommandsRef.current.started) continue;
                const fresh = [];
                fresh.started = true;
                turtleCommandsRef.current = fresh;
                setTurtleRunId(id => id + 1);
                setShowTurtlePopup(true);
            }
            turtleCommandsRef.current.push(command);
        }
    }, []);

    const runCode = useCallback(async () => {
        if (runningRef.current || readOnly) return;
        runningRef.current = true;
        setIsRunning(true);
        setWaitingForInput(false);
        setErrorLine(null);
        resetOutput();
        turtleCommandsRef.current = [];

        const preset = presetInputEnabled ? presetInput.replace(/\r\n?/g, '\n').split('\n') : [];
        if (preset.length && preset[preset.length - 1] === '') preset.pop();

        if (pythonRunner.status !== 'ready') appendOutput('正在加载 Python 运行环境，请稍候…\n');
        let result;
        try {
            result = await pythonRunner.run(code, {
                onStdout: appendOutput,
                onTurtle: handleTurtle,
                onInputRequest: () => {
                    if (preset.length) {
                        const value = preset.shift();
                        appendOutput(`${value}\n`);
                        pythonRunner.sendInput(value);
                    } else {
                        setWaitingForInput(true);
                    }
                }
            });
        } catch (error) {
            result = { error: { type: 'InternalError', message: error.message || '无法启动 Python 运行环境' } };
        }
        if (!mountedRef.current) return;

        if (result.stopped) {
            appendOutput('\n\n⛔ 程序已停止');
        } else if (result.error) {
            appendOutput(`${consoleRef.current && !consoleRef.current.endsWith('\n') ? '\n' : ''}\n${formatPythonError(result.error)}`);
            setErrorLine(result.error.line || null);
        } else {
            if (result.truncated) appendOutput('\n…输出过多，程序已被停止');
            appendOutput('\n✅ 程序执行完成');
        }
        runningRef.current = false;
        setIsRunning(false);
        setWaitingForInput(false);
        onExecutionComplete?.(consoleRef.current, !!result.error);
    }, [code, readOnly, presetInputEnabled, presetInput, appendOutput, resetOutput, handleTurtle, onExecutionComplete]);

    const stopExecution = useCallback(() => {
        pythonRunner.stop();
    }, []);

    const handleInputSubmit = useCallback(() => {
        const value = currentInput;
        appendOutput(`${value}\n`);
        setCurrentInput('');
        setWaitingForInput(false);
        pythonRunner.sendInput(value);
    }, [currentInput, appendOutput]);

    const handleReset = useCallback(() => {
        Modal.confirm({
            title: '重置为初始代码？',
            content: '当前编辑器中的代码将被替换为老师提供的初始代码（已保存或已提交的版本不受影响）。',
            okText: '重置',
            cancelText: '取消',
            onOk: () => handleCodeChange(starterCode || ''),
        });
    }, [starterCode, handleCodeChange]);

    const adjustFontSize = (delta) => setFontSize(prev => Math.max(12, Math.min(28, prev + delta)));

    const statusLabel = (() => {
        if (runnerStatus === 'loading') {
            return (
                <span style={{ color: '#999', fontSize: 12 }}>
                    <LoadingOutlined style={{ marginRight: 4 }} />
                    加载Python环境中...
                </span>
            );
        }
        if (runnerStatus === 'ready') return <span style={{ color: '#52c41a', fontSize: 12 }}>● 已就绪</span>;
        if (runnerStatus === 'error') {
            return (
                <Tooltip title={runnerError}>
                    <span style={{ color: '#ff4d4f', fontSize: 12 }}>
                        ● 加载失败
                        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => pythonRunner.restart()}>重试</Button>
                    </span>
                </Tooltip>
            );
        }
        return null;
    })();

    return (
        <div className={`python-editor-container ${isFullscreen ? 'fullscreen' : ''}`} style={{ height: isFullscreen ? undefined : height }}>
            <Card
                title={
                    <Space>
                        <span>🐍 Python代码编辑器</span>
                        {statusLabel}
                    </Space>
                }
                extra={
                    <Space>
                        {scoreTag}
                        {isRunning ? (
                            <Tooltip title="停止执行">
                                <Button danger icon={<StopOutlined />} onClick={stopExecution}>停止</Button>
                            </Tooltip>
                        ) : (
                            <Tooltip title="运行代码 (Ctrl+Enter)">
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={runCode}
                                    disabled={readOnly || runnerStatus === 'error'}
                                >
                                    运行
                                </Button>
                            </Tooltip>
                        )}
                        {extraButtons}
                        <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
                            <Button
                                icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                                onClick={() => setIsFullscreen(v => !v)}
                            />
                        </Tooltip>
                    </Space>
                }
                className="python-editor-card"
                bodyStyle={{ padding: 0 }}
            >
                <div className="python-editor-body">
                    <div className="code-editor-wrapper">
                        <div className="code-editor-toolbar">
                            <Space size="small" wrap>
                                <Dropdown
                                    menu={{
                                        items: syntaxReferences.map(s => ({ key: s.key, label: s.label })),
                                        onClick: ({ key }) => {
                                            setSelectedSyntax(syntaxReferences.find(s => s.key === key) || null);
                                            setSyntaxModalVisible(true);
                                        }
                                    }}
                                    trigger={['click']}
                                >
                                    <Button size="small" icon={<BookOutlined />}>语法参考</Button>
                                </Dropdown>
                                <Tooltip title="缩小字体 (最小12px)">
                                    <Button size="small" icon={<MinusOutlined />} onClick={() => adjustFontSize(-2)} disabled={fontSize <= 12} />
                                </Tooltip>
                                <span className="font-size-display">
                                    <FontSizeOutlined /> {fontSize}px
                                </span>
                                <Tooltip title="放大字体 (最大28px)">
                                    <Button size="small" icon={<PlusOutlined />} onClick={() => adjustFontSize(2)} disabled={fontSize >= 28} />
                                </Tooltip>
                                {starterCode !== null && !readOnly && (
                                    <Tooltip title="把编辑器中的代码恢复为老师给的初始代码">
                                        <Button size="small" icon={<UndoOutlined />} onClick={handleReset}>重置代码</Button>
                                    </Tooltip>
                                )}
                                <Divider type="vertical" />
                                <span className="current-line-display">第 {currentLine} 行</span>
                            </Space>
                        </div>
                        <div className="code-editor-inner">
                            <CodeEditor
                                value={code}
                                onChange={handleCodeChange}
                                readOnly={readOnly}
                                fontSize={fontSize}
                                errorLine={errorLine}
                                onCursorLine={setCurrentLine}
                                onRunShortcut={runCode}
                                onSaveShortcut={onSave}
                            />
                        </div>
                    </div>

                    <div className="output-panel">
                        <div className="terminal-wrapper">
                            <div className="terminal-header">
                                <span>控制台</span>
                                {isRunning && <Spin size="small" style={{ marginLeft: 8 }} />}
                                <span style={{ flex: 1 }} />
                                <Tooltip title="开启后，程序中的 input() 依次读取下面填写的每一行，读完后再等待手动输入">
                                    <span className="preset-input-toggle">
                                        预设输入
                                        <Switch size="small" checked={presetInputEnabled} onChange={setPresetInputEnabled} style={{ marginLeft: 6 }} />
                                    </span>
                                </Tooltip>
                                <Tooltip title="清空控制台">
                                    <Button type="text" size="small" icon={<ClearOutlined />} onClick={resetOutput} style={{ color: '#ccc', marginLeft: 8 }} />
                                </Tooltip>
                            </div>
                            {presetInputEnabled && (
                                <div className="preset-input-panel">
                                    <Input.TextArea
                                        value={presetInput}
                                        onChange={e => setPresetInput(e.target.value)}
                                        autoSize={{ minRows: 2, maxRows: 6 }}
                                        placeholder={'每行对应一次 input()，例如：\n5\n10'}
                                        className="preset-input-textarea"
                                    />
                                </div>
                            )}
                            <div className="terminal-body" ref={outputRef}>
                                <pre className="terminal-output">
                                    {output || '点击"运行"按钮（或按 Ctrl+Enter）执行代码...'}
                                </pre>
                                {waitingForInput && (
                                    <div className="terminal-input-container">
                                        <div className="terminal-input-label">
                                            <span className="terminal-input-icon">⌨️</span>
                                            <span>程序等待您的输入</span>
                                        </div>
                                        <div className="terminal-input-line">
                                            <span className="terminal-input-prompt">&gt;&gt;&gt;</span>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                className="terminal-input"
                                                value={currentInput}
                                                onChange={(e) => setCurrentInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                                        e.preventDefault();
                                                        handleInputSubmit();
                                                    }
                                                }}
                                                autoFocus
                                                placeholder="请在此输入..."
                                            />
                                        </div>
                                        <div className="terminal-input-hint">
                                            <span>输入完成后按</span>
                                            <kbd>Enter</kbd>
                                            <span>键确认</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BookOutlined style={{ color: '#1890ff' }} />
                        <span>语法参考</span>
                    </div>
                }
                open={syntaxModalVisible}
                onCancel={() => setSyntaxModalVisible(false)}
                footer={null}
                width={600}
                className="syntax-reference-modal"
            >
                {selectedSyntax && (
                    <div className="syntax-reference-content">
                        <h3 style={{ color: '#1890ff', marginBottom: 8 }}>{selectedSyntax.title}</h3>
                        <p style={{ color: '#666', marginBottom: 16 }}>{selectedSyntax.description}</p>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 500, marginBottom: 8, color: '#333' }}>📌 基本语法</div>
                            <div style={codeBlockStyle}>{selectedSyntax.syntax}</div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 500, marginBottom: 8, color: '#333' }}>💡 示例</div>
                            {selectedSyntax.examples.map((example, idx) => (
                                <div key={idx} style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{example.title}</div>
                                    <div style={codeBlockStyle}>{example.code}</div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div style={{ fontWeight: 500, marginBottom: 8, color: '#333' }}>⚠️ 注意事项</div>
                            <ul style={{ margin: 0, paddingLeft: 20, color: '#666' }}>
                                {selectedSyntax.tips.map((tip, idx) => (
                                    <li key={idx} style={{ marginBottom: 4 }}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </Modal>

            <TurtleWindow
                visible={showTurtlePopup}
                onClose={() => setShowTurtlePopup(false)}
                commands={turtleCommandsRef.current}
                runId={turtleRunId}
            />
        </div>
    );
};

export default PythonEditor;
