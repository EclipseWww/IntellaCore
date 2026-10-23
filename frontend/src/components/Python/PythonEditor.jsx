import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Space, Card, Spin, message, Tooltip, Divider, Modal, Dropdown } from 'antd';
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
    FontSizeOutlined
} from '@ant-design/icons';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { translatePythonError } from './pythonErrorTranslator';
import './PythonEditor.css';

// 注册Python语言
SyntaxHighlighter.registerLanguage('python', python);

// Turtle图形显示窗口组件 - 支持动画版
const TurtleWindow = ({ visible, onClose, commands, runId }) => {
    const [position, setPosition] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const trailCanvasRef = useRef(null); // 轨迹画布
    const spriteCanvasRef = useRef(null); // 乌龟图标画布
    const commandsRef = useRef(commands); // 保持最新引用
    const reqRef = useRef(null);

    // 渲染状态
    const stateRef = useRef({
        x: 209, y: 200, angle: 0, penDown: true, color: 'black', speed: 6,
        cmdIndex: 0,
        isBusy: false,
        remaining: 0, // 剩余需要移动的距离或角度
        stepSize: 0,  // 每帧移动量
        mode: null,   // 'move' | 'turn' | 'wait'
        penSize: 2,   // 画笔粗细
        visible: true, // 乌龟是否可见
        fillColor: 'black', // 填充颜色
        fillPath: []  // 填充路径点
    });

    // 更新命令引用并检测重置
    useEffect(() => {
        // 如果 runId 改变，强制重置
        if (runId !== stateRef.current.lastRunId) {
            stateRef.current.cmdIndex = 0;
            stateRef.current.isBusy = false;
            stateRef.current.remaining = 0;
            stateRef.current.mode = null;
            stateRef.current.lastRunId = runId;
        }
        commandsRef.current = commands;
    }, [commands, runId]);

    // 拖拽逻辑 - 修复 className 报错问题
    const handleMouseDown = (e) => {
        // 使用 closest 查找 header，避免 e.target 是 SVG 或其它元素导致 className.includes 报错
        if (e.target.closest('.turtle-window-header')) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    // 核心动画循环
    useEffect(() => {
        if (!visible) return;

        const animate = () => {
            if (!trailCanvasRef.current || !spriteCanvasRef.current) {
                reqRef.current = requestAnimationFrame(animate);
                return;
            }

            const ctx = trailCanvasRef.current.getContext('2d');
            const sCtx = spriteCanvasRef.current.getContext('2d');
            const width = trailCanvasRef.current.width;
            const height = trailCanvasRef.current.height;
            const state = stateRef.current;
            const currentCommands = commandsRef.current;

            // 1. 处理重置逻辑 (hacky check: if first command is init/reset and we haven't processed it)
            // 更稳健的方式：如果 cmdIndex 为 0，且有命令，先初始化
            if (currentCommands.length > 0 &&
                (currentCommands[0].cmd === 'init' || currentCommands[0].cmd === 'reset') &&
                state.cmdIndex === 0 && !state.isBusy) {

                ctx.clearRect(0, 0, width, height);
                // 绘制坐标轴
                ctx.strokeStyle = '#f0f0f0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
                ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
                ctx.stroke();

                // 重置状态
                state.x = width / 2;
                state.y = height / 2;
                state.angle = 0;
                state.penDown = true;
                state.color = 'black';
                state.speed = 6;
                state.cmdIndex++; // 跳过 init 命令
            }

            // 2. 如果不忙，获取下一条命令
            if (!state.isBusy && state.cmdIndex < currentCommands.length) {
                const { cmd, args } = currentCommands[state.cmdIndex];
                state.cmdIndex++;

                // 设置任务
                switch (cmd) {
                    case 'forward':
                        state.mode = 'move';
                        state.remaining = Math.abs(args.d);
                        state.moveDir = Math.sign(args.d); // 1 or -1
                        break;
                    case 'right':
                    case 'left':
                        state.mode = 'turn';
                        state.remaining = Math.abs(args.a);
                        state.turnDir = cmd === 'right' ? -1 : 1; // Canvas angle: clockwise is positive? No, usually math.
                        // Wait, my impl: right -> angle -= a. So clockwise visual is angle decreasing? 
                        // Standard math: 0 is right. 90 is up. -90 is down.
                        // Canvas Y is down. So:
                        // 0 deg = right (1, 0)
                        // 90 deg = down (0, 1) if we interpret angle normally? 
                        // Let's stick to: cos(a), -sin(a) means math convention (counter-clockwise positive).
                        // So 'right' means turn clockwise -> angle decreases. Correct.
                        state.turnDir = -1; // right means decrease angle
                        break;
                    case 'goto':
                        state.mode = 'goto';
                        const destX = width / 2 + args.x;
                        const destY = height / 2 - args.y;
                        const dx = destX - state.x;
                        const dy = destY - state.y;
                        state.remaining = Math.sqrt(dx * dx + dy * dy);
                        state.destX = destX;
                        state.destY = destY;
                        state.startX = state.x;
                        state.startY = state.y;
                        break;
                    case 'penup':
                        state.penDown = false;
                        break;
                    case 'pendown':
                        state.penDown = true;
                        break;
                    case 'color':
                        state.color = args.c;
                        break;
                    case 'speed':
                        state.speed = args.s;
                        break;
                    case 'clear':
                        ctx.clearRect(0, 0, width, height); // 重绘坐标轴？
                        ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1; ctx.beginPath();
                        ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
                        ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height); ctx.stroke();
                        break;
                    case 'write':
                        ctx.fillStyle = state.color;
                        ctx.font = args.font || '12px Arial';
                        ctx.textAlign = args.align || 'left';
                        ctx.fillText(args.text, state.x, state.y);
                        break;
                    case 'circle':
                        state.mode = 'circle';
                        state.remaining = args.extent || 360;
                        state.radius = args.r;
                        break;
                    case 'dot':
                        // 绘制圆点（填充圆）
                        const dotSize = args.size || Math.max(state.penSize + 4, state.penSize * 2);
                        ctx.fillStyle = args.color || state.color;
                        ctx.beginPath();
                        ctx.arc(state.x, state.y, dotSize / 2, 0, 2 * Math.PI);
                        ctx.fill();
                        break;
                    case 'pensize':
                        state.penSize = args.w;
                        break;
                    case 'hideturtle':
                        state.visible = false;
                        break;
                    case 'showturtle':
                        state.visible = true;
                        break;
                    case 'setheading':
                        state.angle = args.a;
                        break;
                    case 'home':
                        // 回到中心，方向朝右
                        if (state.penDown) {
                            ctx.strokeStyle = state.color;
                            ctx.lineWidth = state.penSize;
                            ctx.beginPath();
                            ctx.moveTo(state.x, state.y);
                            ctx.lineTo(width / 2, height / 2);
                            ctx.stroke();
                        }
                        state.x = width / 2;
                        state.y = height / 2;
                        state.angle = 0;
                        break;
                    case 'setx':
                        const newSX = width / 2 + args.x;
                        if (state.penDown) {
                            ctx.strokeStyle = state.color;
                            ctx.lineWidth = state.penSize;
                            ctx.beginPath();
                            ctx.moveTo(state.x, state.y);
                            ctx.lineTo(newSX, state.y);
                            ctx.stroke();
                        }
                        state.x = newSX;
                        break;
                    case 'sety':
                        const newSY = height / 2 - args.y;
                        if (state.penDown) {
                            ctx.strokeStyle = state.color;
                            ctx.lineWidth = state.penSize;
                            ctx.beginPath();
                            ctx.moveTo(state.x, state.y);
                            ctx.lineTo(state.x, newSY);
                            ctx.stroke();
                        }
                        state.y = newSY;
                        break;
                    case 'fillcolor':
                        state.fillColor = args.c;
                        break;
                    case 'begin_fill':
                        state.fillPath = [{ x: state.x, y: state.y }];
                        break;
                    case 'end_fill':
                        if (state.fillPath && state.fillPath.length > 2) {
                            ctx.fillStyle = state.fillColor;
                            ctx.beginPath();
                            ctx.moveTo(state.fillPath[0].x, state.fillPath[0].y);
                            for (let i = 1; i < state.fillPath.length; i++) {
                                ctx.lineTo(state.fillPath[i].x, state.fillPath[i].y);
                            }
                            ctx.closePath();
                            ctx.fill();
                        }
                        state.fillPath = [];
                        break;
                    case 'stamp':
                        // 画一个乌龟印记
                        ctx.save();
                        ctx.translate(state.x, state.y);
                        ctx.rotate(-state.angle * Math.PI / 180);
                        ctx.fillStyle = state.color;
                        ctx.beginPath();
                        ctx.moveTo(10, 0);
                        ctx.lineTo(-8, 7);
                        ctx.lineTo(-8, -7);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                        break;
                }

                // 计算步长
                if (['move', 'turn', 'goto', 'circle'].includes(state.mode)) {
                    state.isBusy = true;
                    // speed 0 = instant, 1 = slow, 10 = fast
                    // 60fps. speed 1 = 10px/sec? 
                    if (state.speed === 0) {
                        state.stepSize = state.remaining;
                    } else {
                        // speed 1: 2px/frame? Speed 10: 20px/frame?
                        state.stepSize = Math.max(1, state.speed * 2);
                        if (state.mode === 'turn' || state.mode === 'circle') state.stepSize = Math.max(2, state.speed * 4); // degrees
                    }
                }
            }

            // 3. 执行当前动画帧
            if (state.isBusy) {
                const step = Math.min(state.remaining, state.stepSize);
                state.remaining -= step;

                if (state.mode === 'move') {
                    const dist = step * state.moveDir;
                    const rad = state.angle * Math.PI / 180;
                    const newX = state.x + dist * Math.cos(rad);
                    const newY = state.y - dist * Math.sin(rad);

                    if (state.penDown) {
                        ctx.strokeStyle = state.color;
                        ctx.lineWidth = state.penSize;
                        ctx.beginPath();
                        ctx.moveTo(state.x, state.y);
                        ctx.lineTo(newX, newY);
                        ctx.stroke();
                    }
                    // 记录填充路径
                    if (state.fillPath && state.fillPath.length > 0) {
                        state.fillPath.push({ x: newX, y: newY });
                    }
                    state.x = newX;
                    state.y = newY;
                } else if (state.mode === 'turn') {
                    state.angle += step * state.turnDir;
                } else if (state.mode === 'goto') {
                    // Linear interpolation
                    // We need total distance to interpolate correctly?
                    // Simplified: move along vector
                    const dx = state.destX - state.startX;
                    const dy = state.destY - state.startY;
                    const totalDist = Math.sqrt(dx * dx + dy * dy);
                    if (totalDist > 0) {
                        const traveled = totalDist - state.remaining; // actually remaining is decremented
                        // Re-calculate pos
                        // This is tricky if we decrement remaining. 
                        // Simpler: Just move towards target by 'step' pixels.
                        const angleToTarget = Math.atan2(state.destY - state.y, state.destX - state.x); // standard canvas coords? Y down
                        // destY - state.y is usually positive if dest is lower.
                        // Math.atan2(y, x).
                        const mx = step * Math.cos(angleToTarget);
                        const my = step * Math.sin(angleToTarget);

                        if (state.penDown) {
                            ctx.strokeStyle = state.color;
                            ctx.lineWidth = state.penSize;
                            ctx.beginPath();
                            ctx.moveTo(state.x, state.y);
                            ctx.lineTo(state.x + mx, state.y + my);
                            ctx.stroke();
                        }
                        // 记录填充路径
                        if (state.fillPath && state.fillPath.length > 0) {
                            state.fillPath.push({ x: state.x + mx, y: state.y + my });
                        }
                        state.x += mx;
                        state.y += my;
                    }
                } else if (state.mode === 'circle') {
                    // 模拟画圆：前进并左转 (step 是角度)
                    const arcLen = (2 * Math.PI * state.radius * step) / 360;
                    const moveRad = state.angle * Math.PI / 180;

                    const newX = state.x + arcLen * Math.cos(moveRad);
                    const newY = state.y - arcLen * Math.sin(moveRad);

                    if (state.penDown) {
                        ctx.strokeStyle = state.color;
                        ctx.lineWidth = state.penSize;
                        ctx.beginPath();
                        ctx.moveTo(state.x, state.y);
                        ctx.lineTo(newX, newY);
                        ctx.stroke();
                    }
                    // 记录填充路径
                    if (state.fillPath && state.fillPath.length > 0) {
                        state.fillPath.push({ x: newX, y: newY });
                    }
                    state.x = newX;
                    state.y = newY;
                    state.angle += step;
                }

                if (state.remaining <= 0.01) {
                    state.isBusy = false;
                    state.mode = null;
                    // 强制对齐
                    if (state.destX !== undefined) {
                        // state.x = state.destX; state.y = state.destY; 
                        // cleanup
                        state.destX = undefined;
                    }
                }
            }

            // 4. 绘制 Sprite
            sCtx.clearRect(0, 0, width, height);

            // 只有在可见时才绘制乌龟
            if (state.visible) {
                sCtx.save();
                sCtx.translate(state.x, state.y);
                sCtx.rotate(-state.angle * Math.PI / 180);

                // Draw Turtle
                sCtx.fillStyle = state.color;
                sCtx.beginPath();
                sCtx.moveTo(10, 0);
                sCtx.lineTo(-8, 7);
                sCtx.lineTo(-8, -7);
                sCtx.closePath();
                sCtx.fill();
                sCtx.restore();
            }

            reqRef.current = requestAnimationFrame(animate);
        };

        reqRef.current = requestAnimationFrame(animate);
        return () => {
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: 420,
                height: 450,
                backgroundColor: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '8px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #d9d9d9'
            }}
        >
            <div
                className="turtle-window-header"
                onMouseDown={handleMouseDown}
                style={{
                    padding: '10px 16px',
                    background: '#f5f5f5',
                    borderBottom: '1px solid #d9d9d9',
                    borderRadius: '8px 8px 0 0',
                    cursor: 'move',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    userSelect: 'none'
                }}
            >
                <div style={{ fontWeight: 500 }}>🐢 Turtle 绘图</div>
                <Button type="text" size="small" icon={<StopOutlined />} onClick={onClose} />
            </div>
            <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
                {/* 轨迹层 */}
                <canvas
                    ref={trailCanvasRef}
                    width={418}
                    height={400}
                    style={{ position: 'absolute', left: 0, top: 0, zIndex: 1 }}
                />
                {/* 动画层 (Sprite) */}
                <canvas
                    ref={spriteCanvasRef}
                    width={418}
                    height={400}
                    style={{ position: 'absolute', left: 0, top: 0, zIndex: 2 }}
                />
            </div>
        </div>
    );
};

// ... PythonEditor main component ...

/**
 * Python代码编辑器组件
 * 使用Pyodide (WebAssembly CPython) 在浏览器中执行Python代码
 * 支持真正的交互式输入
 */
const PythonEditor = ({
    initialCode = '# 在这里编写你的Python代码\nprint("Hello, World!")\n',
    enableTurtle = false,
    readOnly = false,
    onCodeChange,
    onExecutionComplete,
    height = '400px',
    scoreTag = null,     // 得分标签（显示在运行按钮之前）
    extraButtons = null  // 额外的按钮（如保存、提交，显示在运行按钮之后）
}) => {
    // Turtle 状态
    const [turtleCommands, setTurtleCommands] = useState([]);
    const [showTurtlePopup, setShowTurtlePopup] = useState(false);
    const [runId, setRunId] = useState(0);

    // Turtle 命令队列 Ref
    const commandsRef = useRef([]);

    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTurtle, setShowTurtle] = useState(enableTurtle);
    const [pyodideLoaded, setPyodideLoaded] = useState(false);
    const [pyodideLoading, setPyodideLoading] = useState(false);
    const [waitingForInput, setWaitingForInput] = useState(false);
    const [currentInput, setCurrentInput] = useState('');
    const [fontSize, setFontSize] = useState(16); // 字体大小
    const [currentLine, setCurrentLine] = useState(1); // 当前行号

    // 语法参考弹窗状态
    const [syntaxModalVisible, setSyntaxModalVisible] = useState(false);
    const [selectedSyntax, setSelectedSyntax] = useState(null);

    // 语法参考定义
    const syntaxReferences = [
        {
            key: 'print',
            label: '📤 print 输出',
            title: 'print 输出语句',
            description: 'print() 函数用于将内容输出到控制台，是Python中最常用的输出方式。',
            syntax: 'print(内容)',
            examples: [
                { title: '输出文字', code: 'print("Hello, World!")' },
                { title: '输出变量', code: 'name = "小明"\nprint(name)' },
                { title: '输出多个内容', code: 'print("姓名:", "小明", "年龄:", 12)' }
            ],
            tips: ['字符串要用引号括起来', '多个内容用逗号分隔']
        },
        {
            key: 'input',
            label: '📥 input 输入',
            title: 'input 输入语句',
            description: 'input() 函数用于接收用户的键盘输入，返回值是字符串类型。',
            syntax: '变量 = input("提示信息")',
            examples: [
                { title: '基本输入', code: 'name = input("请输入你的名字: ")\nprint("你好,", name)' },
                { title: '输入数字', code: 'age = int(input("请输入年龄: "))\nprint("明年你", age + 1, "岁")' }
            ],
            tips: ['input() 返回的是字符串', '如需数字运算，要用 int() 或 float() 转换']
        },
        {
            key: 'if',
            label: '🔀 if 判断',
            title: 'if 条件判断',
            description: 'if语句用于根据条件执行不同的代码块。',
            syntax: 'if 条件:\n    代码块\nelif 其他条件:\n    代码块\nelse:\n    代码块',
            examples: [
                { title: '简单判断', code: 'age = 18\nif age >= 18:\n    print("成年人")\nelse:\n    print("未成年")' },
                { title: '多条件判断', code: 'score = 85\nif score >= 90:\n    print("优秀")\nelif score >= 60:\n    print("及格")\nelse:\n    print("不及格")' }
            ],
            tips: ['条件后面要加冒号 :', '代码块需要缩进（4个空格）', 'elif 和 else 是可选的']
        },
        {
            key: 'for',
            label: '🔁 for 循环',
            title: 'for 循环语句',
            description: 'for循环用于遍历序列（如列表、字符串、range等）中的每个元素。',
            syntax: 'for 变量 in 序列:\n    循环体',
            examples: [
                { title: '遍历数字', code: 'for i in range(5):\n    print(i)  # 输出 0,1,2,3,4' },
                { title: '指定范围', code: 'for i in range(1, 6):\n    print(i)  # 输出 1,2,3,4,5' },
                { title: '遍历列表', code: 'fruits = ["苹果", "香蕉", "橙子"]\nfor fruit in fruits:\n    print(fruit)' }
            ],
            tips: ['range(n) 产生 0 到 n-1 的数字', 'range(a, b) 产生 a 到 b-1 的数字', '循环体需要缩进']
        },
        {
            key: 'while',
            label: '🔄 while 循环',
            title: 'while 循环语句',
            description: 'while循环在条件为真时重复执行代码块，适合不确定循环次数的场景。',
            syntax: 'while 条件:\n    循环体',
            examples: [
                { title: '计数循环', code: 'count = 0\nwhile count < 5:\n    print(count)\n    count += 1' },
                { title: '累加求和', code: 'total = 0\nn = 1\nwhile n <= 100:\n    total += n\n    n += 1\nprint("1到100的和:", total)' }
            ],
            tips: ['确保条件最终会变为 False，否则会死循环', '可用 break 提前退出循环', '可用 continue 跳过本次循环']
        }
    ];

    const editorRef = useRef(null);
    const outputRef = useRef(null);
    const inputRef = useRef(null);
    const pyodideRef = useRef(null);
    const inputResolveRef = useRef(null);
    const runningRef = useRef(false);

    // 加载Pyodide
    useEffect(() => {
        const loadPyodide = async () => {
            if (pyodideRef.current || pyodideLoading) return;

            setPyodideLoading(true);

            try {
                // 检查是否已经加载了Pyodide脚本
                if (!window.loadPyodide) {
                    console.log('正在加载Pyodide...');
                    const script = document.createElement('script');
                    script.src = '/libs/pyodide/pyodide.js';  // 使用本地路径
                    script.async = true;

                    await new Promise((resolve, reject) => {
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                console.log('正在初始化Pyodide...');
                const pyodide = await window.loadPyodide({
                    indexURL: '/libs/pyodide/'  // 使用本地路径
                });

                // 注入 turtle.py shim - 完整版本
                const turtleShim = `
import js
import math
import json

class Turtle:
    def __init__(self):
        self._x = 0
        self._y = 0
        self._heading = 0
        self._pensize = 1
        self._visible = True
        self._pendown = True
        self._color = "black"
        self._fillcolor = "black"
        self._filling = False
        js.window._turtle_cmd("init", "{}")

    def _send(self, cmd, args):
        js.window._turtle_cmd(cmd, json.dumps(args))

    def forward(self, d):
        self._send("forward", {"d": float(d)})
    
    def fd(self, d):
        self.forward(d)
        
    def backward(self, d):
        self._send("forward", {"d": -float(d)})
        
    def bk(self, d):
        self.backward(d)
    
    def back(self, d):
        self.backward(d)

    def right(self, a):
        self._send("right", {"a": float(a)})
        
    def rt(self, a):
        self.right(a)

    def left(self, a):
        self._send("right", {"a": -float(a)})
        
    def lt(self, a):
        self.left(a)
        
    def penup(self):
        self._pendown = False
        self._send("penup", {})
        
    def pu(self):
        self.penup()
    
    def up(self):
        self.penup()
        
    def pendown(self):
        self._pendown = True
        self._send("pendown", {})
        
    def pd(self):
        self.pendown()
    
    def down(self):
        self.pendown()
        
    def color(self, *args):
        if len(args) == 1:
            c = args[0]
            self._color = c
            self._fillcolor = c
            self._send("color", {"c": c})
        elif len(args) == 2:
            self._color = args[0]
            self._fillcolor = args[1]
            self._send("color", {"c": args[0]})
            self._send("fillcolor", {"c": args[1]})
        
    def pencolor(self, c=None):
        if c is None:
            return self._color
        self._color = c
        self._send("color", {"c": c})

    def speed(self, s=None):
        if s is None:
            return 6
        self._send("speed", {"s": s})
        
    def goto(self, x, y=None):
        if y is None and hasattr(x, '__iter__'):
            x, y = x[0], x[1]
        self._send("goto", {"x": float(x), "y": float(y)})
        
    def setpos(self, x, y=None):
        self.goto(x, y)
    
    def setposition(self, x, y=None):
        self.goto(x, y)
        
    def setx(self, x):
        self._send("setx", {"x": float(x)})
    
    def sety(self, y):
        self._send("sety", {"y": float(y)})
        
    def circle(self, radius, extent=None, steps=None):
        self._send("circle", {"r": float(radius), "extent": extent, "steps": steps})

    def dot(self, size=None, *color):
        if size is None:
            size = max(self._pensize + 4, 2 * self._pensize)
        c = self._color
        if color:
            c = color[0] if len(color) == 1 else color
        self._send("dot", {"size": float(size), "color": str(c)})

    def write(self, arg, move=False, align="left", font=("Arial", 8, "normal")):
        font_str = f"{font[1]}px {font[0]}"
        self._send("write", {"text": str(arg), "align": align, "font": font_str})
        
    def clear(self):
        self._send("clear", {})

    def reset(self):
        self._x = 0
        self._y = 0
        self._heading = 0
        self._send("reset", {})
    
    def home(self):
        self._send("home", {})
        self._x = 0
        self._y = 0
        self._heading = 0
    
    def pensize(self, width=None):
        if width is None:
            return self._pensize
        self._pensize = width
        self._send("pensize", {"w": float(width)})
    
    def width(self, width=None):
        return self.pensize(width)
    
    def hideturtle(self):
        self._visible = False
        self._send("hideturtle", {})
    
    def ht(self):
        self.hideturtle()
    
    def showturtle(self):
        self._visible = True
        self._send("showturtle", {})
    
    def st(self):
        self.showturtle()
    
    def isvisible(self):
        return self._visible
    
    def setheading(self, angle):
        self._heading = angle
        self._send("setheading", {"a": float(angle)})
    
    def seth(self, angle):
        self.setheading(angle)
    
    def heading(self):
        return self._heading
    
    def position(self):
        return (self._x, self._y)
    
    def pos(self):
        return self.position()
    
    def xcor(self):
        return self._x
    
    def ycor(self):
        return self._y
    
    def towards(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        dx = x - self._x
        dy = y - self._y
        return math.degrees(math.atan2(dy, dx))
    
    def distance(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        return math.sqrt((x - self._x)**2 + (y - self._y)**2)
    
    def begin_fill(self):
        self._filling = True
        self._send("begin_fill", {})
    
    def end_fill(self):
        self._filling = False
        self._send("end_fill", {})
    
    def filling(self):
        return self._filling
    
    def fillcolor(self, c=None):
        if c is None:
            return self._fillcolor
        self._fillcolor = c
        self._send("fillcolor", {"c": c})
    
    def stamp(self):
        self._send("stamp", {})
        return 0
    
    def shape(self, name=None):
        if name is None:
            return "classic"
        self._send("shape", {"name": name})

# Pen 是 Turtle 的别名
Pen = Turtle
        
_t = Turtle()

# 模块级函数
def forward(d): _t.forward(d)
def fd(d): _t.fd(d)
def backward(d): _t.backward(d)
def bk(d): _t.bk(d)
def back(d): _t.back(d)
def right(a): _t.right(a)
def rt(a): _t.rt(a)
def left(a): _t.left(a)
def lt(a): _t.lt(a)
def penup(): _t.penup()
def pu(): _t.pu()
def up(): _t.up()
def pendown(): _t.pendown()
def pd(): _t.pd()
def down(): _t.down()
def color(*args): _t.color(*args)
def pencolor(c=None): return _t.pencolor(c)
def speed(s=None): return _t.speed(s)
def goto(x, y=None): _t.goto(x, y)
def setpos(x, y=None): _t.setpos(x, y)
def setposition(x, y=None): _t.setposition(x, y)
def setx(x): _t.setx(x)
def sety(y): _t.sety(y)
def circle(r, extent=None, steps=None): _t.circle(r, extent, steps)
def dot(size=None, *color): _t.dot(size, *color)
def write(arg, move=False, align="left", font=("Arial", 8, "normal")): _t.write(arg, move, align, font)
def clear(): _t.clear()
def reset(): _t.reset()
def home(): _t.home()
def pensize(width=None): return _t.pensize(width)
def width(w=None): return _t.width(w)
def hideturtle(): _t.hideturtle()
def ht(): _t.ht()
def showturtle(): _t.showturtle()
def st(): _t.st()
def isvisible(): return _t.isvisible()
def setheading(a): _t.setheading(a)
def seth(a): _t.seth(a)
def heading(): return _t.heading()
def position(): return _t.position()
def pos(): return _t.pos()
def xcor(): return _t.xcor()
def ycor(): return _t.ycor()
def towards(x, y=None): return _t.towards(x, y)
def distance(x, y=None): return _t.distance(x, y)
def begin_fill(): _t.begin_fill()
def end_fill(): _t.end_fill()
def filling(): return _t.filling()
def fillcolor(c=None): return _t.fillcolor(c)
def stamp(): return _t.stamp()
def shape(name=None): return _t.shape(name)

# 屏幕控制函数
def done(): pass
def mainloop(): pass
def exitonclick(): pass
def bye(): pass
def Screen(): return None
`;
                pyodide.FS.writeFile('turtle.py', turtleShim);

                pyodideRef.current = pyodide;
                setPyodideLoaded(true);
                console.log('Pyodide加载完成');

            } catch (error) {
                console.error('加载Pyodide失败:', error);
                message.error('加载Python运行环境失败');
            } finally {
                setPyodideLoading(false);
            }
        };

        loadPyodide();
    }, []);

    // 当初始代码改变时更新
    useEffect(() => {
        setCode(initialCode);
    }, [initialCode]);

    // 自动滚动到底部
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    // 聚焦到输入框
    useEffect(() => {
        if (waitingForInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [waitingForInput]);

    // 监听来自Python的输入请求
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data && event.data.type === 'python_input_request') {
                setWaitingForInput(true);
                // 聚焦输入框
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                    }
                }, 50);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 处理代码变化
    const handleCodeChange = useCallback((e) => {
        const newCode = e.target.value;
        setCode(newCode);
        if (onCodeChange) {
            onCodeChange(newCode);
        }
    }, [onCodeChange]);

    // 更新当前行号
    const updateCurrentLine = useCallback((textarea) => {
        if (!textarea) return;
        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = code.substring(0, cursorPos);
        const lineNumber = textBeforeCursor.split('\n').length;
        setCurrentLine(lineNumber);
    }, [code]);

    // 处理光标位置变化
    const handleCursorChange = useCallback((e) => {
        updateCurrentLine(e.target);
    }, [updateCurrentLine]);

    // 打开语法参考弹窗
    const openSyntaxReference = useCallback((syntax) => {
        setSelectedSyntax(syntax);
        setSyntaxModalVisible(true);
    }, []);

    // 调整字体大小
    const adjustFontSize = useCallback((delta) => {
        setFontSize(prev => {
            const newSize = prev + delta;
            // 限制字体大小范围在 12-28px
            return Math.max(12, Math.min(28, newSize));
        });
    }, []);

    // 处理Tab键和Enter自动缩进
    const handleKeyDown = (e) => {
        const textarea = e.target;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                // Shift+Tab: 减少缩进
                const beforeCursor = code.substring(0, start);
                const lineStart = beforeCursor.lastIndexOf('\n') + 1;
                const lineIndent = code.substring(lineStart, start);

                // 检查行首是否有4个空格可以删除
                if (lineIndent.startsWith('    ')) {
                    const newCode = code.substring(0, lineStart) + code.substring(lineStart + 4);
                    setCode(newCode);
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
                    }, 0);
                }
            } else {
                // Tab: 增加缩进
                const newCode = code.substring(0, start) + '    ' + code.substring(end);
                setCode(newCode);
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + 4;
                }, 0);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();

            // 获取当前行
            const beforeCursor = code.substring(0, start);
            const lineStart = beforeCursor.lastIndexOf('\n') + 1;
            const currentLine = beforeCursor.substring(lineStart);

            // 获取当前行的缩进
            const indentMatch = currentLine.match(/^(\s*)/);
            let currentIndent = indentMatch ? indentMatch[1] : '';

            // 检查当前行是否以冒号结尾（去除注释和空白）
            const lineContent = currentLine.replace(/#.*$/, '').trimEnd();
            const endsWithColon = lineContent.endsWith(':');

            // 检查是否是减少缩进的关键字行
            const trimmedLine = currentLine.trim();
            const dedentKeywords = ['return', 'break', 'continue', 'pass', 'raise'];
            const shouldDedent = dedentKeywords.some(kw =>
                trimmedLine === kw ||
                trimmedLine.startsWith(kw + ' ') ||
                trimmedLine.startsWith(kw + '(')
            );

            // 计算新行的缩进
            let newIndent = currentIndent;
            if (endsWithColon) {
                // 冒号结尾：增加缩进
                newIndent = currentIndent + '    ';
            } else if (shouldDedent && currentIndent.length >= 4) {
                // 减少缩进的关键字后：保持原缩进（不在这里减少，因为用户可能还要继续在同一块中写代码）
                newIndent = currentIndent;
            }

            // 插入换行和缩进
            const newCode = code.substring(0, start) + '\n' + newIndent + code.substring(end);
            setCode(newCode);

            // 更新光标位置
            const newCursorPos = start + 1 + newIndent.length;
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = newCursorPos;
                // 确保光标位置可见
                textarea.scrollTop = textarea.scrollHeight;
            }, 0);

            // 通知外部代码变化
            if (onCodeChange) {
                onCodeChange(newCode);
            }
        } else if (e.key === 'Backspace') {
            // 智能退格：如果光标前是4个空格（且是行首缩进的一部分），一次删除4个
            const beforeCursor = code.substring(0, start);
            const lineStart = beforeCursor.lastIndexOf('\n') + 1;
            const textBeforeCursor = beforeCursor.substring(lineStart);

            // 检查是否只有空格在光标前（即光标在缩进区域）
            if (textBeforeCursor.length >= 4 &&
                textBeforeCursor === ' '.repeat(textBeforeCursor.length) &&
                textBeforeCursor.length % 4 === 0) {
                e.preventDefault();
                const newCode = code.substring(0, start - 4) + code.substring(end);
                setCode(newCode);
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start - 4;
                }, 0);
                if (onCodeChange) {
                    onCodeChange(newCode);
                }
            }
        }
    };

    // 处理输入提交
    const handleInputSubmit = useCallback(() => {
        const inputValue = currentInput;
        setOutput(prev => prev + inputValue + '\n');
        setCurrentInput('');
        setWaitingForInput(false);

        // 设置全局变量通知Python
        window._pyodideInputValue = inputValue;
        window._pyodideInputReady = true;
    }, [currentInput]);

    // 处理输入框键盘事件
    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleInputSubmit();
        }
    };

    // 添加输出
    const appendOutput = useCallback((text) => {
        setOutput(prev => prev + text);
    }, []);

    // 停止执行
    const stopExecution = useCallback(() => {
        runningRef.current = false;
        setIsRunning(false);
        setWaitingForInput(false);
        if (inputResolveRef.current) {
            inputResolveRef.current('');
            inputResolveRef.current = null;
        }
        appendOutput('\n\n⛔ 程序已停止');
    }, [appendOutput]);

    // 执行Python代码
    const runCode = useCallback(async () => {
        if (!pyodideRef.current) {
            message.warning('Python运行环境正在加载中...');
            return;
        }

        setIsRunning(true);
        runningRef.current = true;
        setOutput('');
        setWaitingForInput(false);
        setRunId(prev => prev + 1);

        const pyodide = pyodideRef.current;

        try {
            // 设置全局输出回调函数
            window._pyodideOutput = (text) => {
                if (runningRef.current) {
                    appendOutput(text);
                }
            };

            // 设置 Turtle 回调
            window._turtle_cmd = (cmd, argsStr) => {
                let args = {};
                try {
                    // Python 传过来的是 JSON 字符串，解析为 JS 对象
                    // 这样避免了 Pyodide Proxy 被销毁的问题
                    args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
                } catch (e) {
                    console.error("Invalid turtle args:", argsStr);
                }

                // 如果是初始化命令，显示窗口
                if (cmd === 'init' || cmd === 'reset') {
                    setShowTurtlePopup(true);
                    commandsRef.current = [];
                    setTurtleCommands([]);
                }
                commandsRef.current.push({ cmd, args });
                setTurtleCommands([...commandsRef.current]);
            };

            // 挂载翻译函数供 Python 调用
            window._translatePythonError = translatePythonError;

            // 设置全局输入回调
            window._pyodideInputCallback = null;
            window._pyodideInputReady = false;
            window._pyodideInputValue = '';

            // 运行用户代码
            const userCode = code.trim() || 'pass';

            // 先执行一段初始化代码设置输出和输入函数
            const setupCode = `
import sys
import js
import asyncio

# 重定向stdout到JavaScript
class JSOutput:
    def write(self, text):
        if text:
            js.window._pyodideOutput(str(text))
    def flush(self):
        pass

sys.stdout = JSOutput()
sys.stderr = JSOutput()

# 自定义输入函数 - 使用消息传递
async def _async_input(prompt=''):
    if prompt:
        print(prompt, end='', flush=True)
    
    # 发送输入请求
    js.window.postMessage(js.JSON.parse('{"type": "python_input_request"}'), '*')
    
    # 等待输入
    js.window._pyodideInputReady = False
    while not js.window._pyodideInputReady:
        await asyncio.sleep(0.05)
    
    result = str(js.window._pyodideInputValue)
    js.window._pyodideInputReady = False
    return result

# 设置全局input函数
import builtins
_original_input = builtins.input
`;

            await pyodide.runPythonAsync(setupCode);

            // 转换用户代码 - 将所有 input( 替换为 await _async_input(
            // 这里我们不需要转义换行符，因为我们将直接把代码字符串传给 Pyodide 全局变量

            // 1. 准备代码字符串：添加缩进并放入 async 函数中
            const indentedCode = userCode.split('\n').map(line => '    ' + line).join('\n');
            const transformedCode = indentedCode.replace(/input\s*\(/g, 'await _async_input(');

            // 构造 wrapper 代码字符串
            const wrapperCode = `async def _user_main():\n${transformedCode}`;

            // 2. 将代码字符串传递给 Python 全局变量
            pyodide.globals.set('_user_code_str', wrapperCode);

            // 3. 执行固定的 harness 代码
            const runHarness = `
async def _run_safe():
    try:
        # 执行定义 _user_main 的代码
        # 这可能会抛出 SyntaxError (比如用户代码中有语法错误)
        exec(_user_code_str, globals())
        
        # 如果定义成功，则运行它
        await _user_main()
        return True
        
    except SyntaxError as e:
        # line 1 is "async def _user_main():", line 2 is User Code Line 1
        # So e.lineno - 1 is the user's line number
        line_num = e.lineno - 1 if e.lineno else 0
        line_info = f" (第 {line_num} 行)" if line_num > 0 else ""
        msg = e.msg
        
        # 常见语法错误翻译
        if "invalid syntax" in msg:
            msg = "语法无效\\n  💡 常见原因：\\n    • for/if/while语句末尾缺少冒号(:)\\n    • for循环中 in 拼写错误\\n    • 括号/引号未匹配"
        elif "'(' was never closed" in msg:
            msg = "括号 '(' 未闭合，请检查是否缺少右括号"
        elif "'[' was never closed" in msg:
            msg = "中括号 '[' 未闭合，请检查是否缺少右中括号"
        elif "'{' was never closed" in msg:
            msg = "大括号 '{' 未闭合，请检查是否缺少右大括号"
        elif "unexpected EOF while parsing" in msg:
            msg = "代码不完整，可能缺少括号或缩进"
        elif "invalid character" in msg:
            msg = "存在无效字符"
        elif "unexpected indent" in msg:
            msg = "缩进错误：此处不应有缩进"
        elif "expected an indented block" in msg:
            msg = "缩进错误：此处应有缩进"
        elif "unindent does not match any outer indentation level" in msg:
            msg = "缩进错误：缩进层级不匹配"
        elif "expected ':'" in msg:
            msg = "缺少冒号(:)\\n  💡 if/for/while/def/class语句末尾需要加冒号"
        else:
            # 尝试通用的预期字符翻译
            import re
            match = re.search(r"expected '([^']+)'", msg)
            if match:
                msg = f"语法错误：缺少 '{match.group(1)}'"
            
        # 检查代码行中是否有中文符号
        if e.text:
            if '（' in e.text or '）' in e.text:
                msg += "，检测到中文括号，请使用英文括号 ()"
            elif '“' in e.text or '”' in e.text or '‘' in e.text or '’' in e.text:
                msg += "，检测到中文引号，请使用英文引号 '' 或 \"\""
            elif '：' in e.text:
                msg += "，检测到中文冒号，请使用英文冒号 :"
            elif '，' in e.text:
                msg += "，检测到中文逗号，请使用英文逗号 ,"
        
        # 将行号显示在单独一行，更明显
        if line_num > 0:
            print(f"\\n❌ 语法错误: {msg}\\n📍 错误位置: 第 {line_num} 行")
        else:
            print(f"\\n❌ 语法错误: {msg}")
        return False
    except Exception as e:
        # 获取行号 - 对于运行时错误，需要查找 traceback 中最后一行属于用户代码的行号
        user_line = 0
        try:
            import traceback
            tb = traceback.extract_tb(e.__traceback__)
            for frame in tb:
                # 寻找在 exec 中的代码行
                if frame.filename == '<string>' and frame.name == '_user_main':
                    user_line = frame.lineno - 1 # 减去 def _user_main(): 这一行
        except:
            pass

        import js
        # 使用 JS 的翻译器进行完整翻译
        error_type = type(e).__name__
        full_error = f"{error_type}: {str(e)}"
        
        # 如果获取到了行号，添加到错误信息中以便 JS 翻译器可能用到（虽然我们的 JS 翻译器主要正则匹配 message）
        # 这里我们手动把行号加上
        translated = js.window._translatePythonError(full_error)
        
        line_info = f"\\n📍 错误位置: 第 {user_line} 行" if user_line > 0 else ""
        print(f"\\n❌ {translated}{line_info}")
        return False

await _run_safe()
`;

            const success = await pyodide.runPythonAsync(runHarness);

            // 清理
            pyodide.globals.delete('_user_code_str');

            if (runningRef.current && success !== false) {
                appendOutput('\n✅ 程序执行完成');
            }

        } catch (error) {
            console.error('执行代码时出错:', error);
            if (runningRef.current) {
                const translatedError = translatePythonError(error.toString());
                appendOutput(`\n❌ 错误: ${translatedError}`);
            }
        } finally {
            setIsRunning(false);
            runningRef.current = false;
            setWaitingForInput(false);

            // 通知父组件执行完成，传递最终输出
            if (onExecutionComplete) {
                // 使用 setTimeout 确保 output state 已更新
                setTimeout(() => {
                    const finalOutput = outputRef.current?.querySelector('.terminal-output')?.textContent || '';
                    onExecutionComplete(finalOutput, false);
                }, 100);
            }
        }
    }, [code, appendOutput, onExecutionComplete]);

    // 清空输出
    const clearOutput = () => {
        setOutput('');
    };

    // 切换全屏
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    return (
        <div className={`python-editor-container ${isFullscreen ? 'fullscreen' : ''}`}>
            <Card
                title={
                    <Space>
                        <span>🐍 Python代码编辑器</span>
                        {pyodideLoading && (
                            <span style={{ color: '#999', fontSize: 12 }}>
                                <LoadingOutlined style={{ marginRight: 4 }} />
                                加载Python环境中...
                            </span>
                        )}
                        {pyodideLoaded && (
                            <span style={{ color: '#52c41a', fontSize: 12 }}>● 已就绪</span>
                        )}
                    </Space>
                }
                extra={
                    <Space>
                        {scoreTag}
                        {isRunning ? (
                            <Tooltip title="停止执行">
                                <Button
                                    danger
                                    icon={<StopOutlined />}
                                    onClick={stopExecution}
                                >
                                    停止
                                </Button>
                            </Tooltip>
                        ) : (
                            <Tooltip title="运行代码">
                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={runCode}
                                    disabled={readOnly || !pyodideLoaded}
                                    loading={pyodideLoading}
                                >
                                    运行
                                </Button>
                            </Tooltip>
                        )}
                        {extraButtons}
                        <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
                            <Button
                                icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                                onClick={toggleFullscreen}
                            />
                        </Tooltip>
                    </Space>
                }
                className="python-editor-card"
                bodyStyle={{ padding: 0 }}
            >
                <div className="python-editor-body">
                    {/* 左侧代码编辑区 */}
                    <div className="code-editor-wrapper">
                        {/* 编辑器工具栏 */}
                        <div className="code-editor-toolbar">
                            <Space size="small">
                                <Dropdown
                                    menu={{
                                        items: syntaxReferences.map(s => ({
                                            key: s.key,
                                            label: s.label
                                        })),
                                        onClick: ({ key }) => {
                                            const syntax = syntaxReferences.find(s => s.key === key);
                                            if (syntax) openSyntaxReference(syntax);
                                        }
                                    }}
                                    trigger={['click']}
                                >
                                    <Button size="small" icon={<BookOutlined />}>
                                        语法参考
                                    </Button>
                                </Dropdown>
                                <Tooltip title="缩小字体 (最小12px)">
                                    <Button
                                        size="small"
                                        icon={<MinusOutlined />}
                                        onClick={() => adjustFontSize(-2)}
                                        disabled={fontSize <= 12}
                                    />
                                </Tooltip>
                                <span className="font-size-display">
                                    <FontSizeOutlined /> {fontSize}px
                                </span>
                                <Tooltip title="放大字体 (最大28px)">
                                    <Button
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={() => adjustFontSize(2)}
                                        disabled={fontSize >= 28}
                                    />
                                </Tooltip>
                                <Divider type="vertical" />
                                <span className="current-line-display">
                                    第 {currentLine} 行
                                </span>
                            </Space>
                        </div>
                        <div className="code-editor-inner">
                            <div className="line-numbers" style={{ fontSize: `${fontSize}px` }}>
                                {code.split('\n').map((_, index) => (
                                    <div
                                        key={index}
                                        className={`line-number ${index + 1 === currentLine ? 'active' : ''}`}
                                    >
                                        {index + 1}
                                    </div>
                                ))}
                            </div>
                            <div className="code-highlight-container">
                                {/* 当前行高亮层 */}
                                <div
                                    className="current-line-highlight"
                                    style={{
                                        top: `${12 + (currentLine - 1) * fontSize * 1.5}px`,
                                        height: `${fontSize * 1.5}px`
                                    }}
                                />
                                {/* 语法高亮层（只读，显示在下层） */}
                                <SyntaxHighlighter
                                    language="python"
                                    style={vs2015}
                                    showLineNumbers={false}
                                    wrapLines={false}
                                    className="code-highlight-layer"
                                    customStyle={{
                                        margin: 0,
                                        padding: '12px',
                                        background: 'transparent',
                                        fontSize: `${fontSize}px`,
                                        lineHeight: '1.5',
                                        fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                                        whiteSpace: 'pre',
                                        overflow: 'hidden',
                                        pointerEvents: 'none'
                                    }}
                                >
                                    {code || ' '}
                                </SyntaxHighlighter>
                                {/* 透明编辑层（可编辑，显示在上层） */}
                                <textarea
                                    ref={editorRef}
                                    className="code-textarea-overlay"
                                    style={{ fontSize: `${fontSize}px` }}
                                    value={code}
                                    onChange={handleCodeChange}
                                    onKeyDown={handleKeyDown}
                                    onKeyUp={handleCursorChange}
                                    onClick={handleCursorChange}
                                    onSelect={handleCursorChange}
                                    spellCheck={false}
                                    readOnly={readOnly}
                                    placeholder="在这里输入Python代码..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* 右侧终端面板 */}
                    <div className="output-panel">
                        {/* 终端输出区 */}
                        <div className="terminal-wrapper">
                            <div className="terminal-header">
                                <span>控制台</span>
                                {isRunning && <Spin size="small" style={{ marginLeft: 8 }} />}
                            </div>
                            <div className="terminal-body" ref={outputRef}>
                                <pre className="terminal-output">
                                    {output || '点击"运行"按钮执行代码...'}
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
                                                onKeyDown={handleInputKeyDown}
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

            {/* 语法参考弹窗 */}
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
                            <div style={{
                                background: '#1e1e1e',
                                padding: '12px 16px',
                                borderRadius: 8,
                                fontFamily: 'Consolas, Monaco, monospace',
                                fontSize: 14,
                                color: '#d4d4d4',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {selectedSyntax.syntax}
                            </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 500, marginBottom: 8, color: '#333' }}>💡 示例</div>
                            {selectedSyntax.examples.map((example, idx) => (
                                <div key={idx} style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{example.title}</div>
                                    <div style={{
                                        background: '#1e1e1e',
                                        padding: '12px 16px',
                                        borderRadius: 8,
                                        fontFamily: 'Consolas, Monaco, monospace',
                                        fontSize: 14,
                                        color: '#d4d4d4',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {example.code}
                                    </div>
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

            {/* Turtle 悬浮窗口 */}
            <TurtleWindow
                visible={showTurtlePopup}
                onClose={() => setShowTurtlePopup(false)}
                commands={turtleCommands}
                runId={runId}
            />
        </div>
    );
};

export default PythonEditor;
