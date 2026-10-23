import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

/**
 * TextNode - 文本节点
 * 用于在流程图中添加说明文字或注释
 */
const TextNode = memo(({ data, isConnectable }) => {
    const [label, setLabel] = useState(data.label);
    const inputRef = useRef(null);

    useEffect(() => {
        setLabel(data.label);
    }, [data.label]);

    useEffect(() => {
        if (data.isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [data.isEditing]);

    const handleBlur = () => {
        if (data.onLabelChange) {
            data.onLabelChange(data.id, label);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleBlur();
        }
    };

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                minWidth: '60px',
                minHeight: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '4px 8px',
                color: '#333',
            }}
        >
            <NodeResizer minWidth={80} minHeight={30} isVisible={data.selected} />
            {/* 文本节点不需要连接点，但为了一致性保留option的连接点 */}
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                style={{
                    background: '#faad14',
                    width: 6,
                    height: 6,
                    opacity: 0.5,
                }}
                isConnectable={isConnectable}
            />
            {data.isEditing ? (
                <textarea
                    ref={inputRef}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    style={{
                        width: '100%',
                        height: '100%',
                        minHeight: '30px',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'center',
                        color: '#8c6d1f',
                        fontSize: '11px',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                    }}
                />
            ) : (
                <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {label || '文本'}
                </div>
            )}
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                style={{
                    background: '#faad14',
                    width: 6,
                    height: 6,
                    opacity: 0.5,
                }}
                isConnectable={isConnectable}
            />
        </div>
    );
});

TextNode.displayName = 'TextNode';

export default TextNode;
