import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { StopOutlined } from '@ant-design/icons';

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

export default TurtleWindow;
