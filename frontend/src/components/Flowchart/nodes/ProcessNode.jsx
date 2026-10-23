import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const ProcessNode = memo(({ data, isConnectable }) => {
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
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: '50px',
        minHeight: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        background: '#e6f7ff',
        color: '#1890ff',
        border: '2px solid #1890ff',
        textAlign: 'center',
        fontWeight: '500',
        boxShadow: '0 2px 6px rgba(24, 144, 255, 0.2)',
      }}
    >
      <NodeResizer minWidth={50} minHeight={40} isVisible={data.selected} />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: '#1890ff',
          width: 10,
          height: 10,
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: '#1890ff',
          width: 10,
          height: 10,
        }}
        isConnectable={isConnectable}
      />
      {data.isEditing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            textAlign: 'center',
            color: '#1890ff',
            fontWeight: '500',
            outline: 'none',
            fontSize: '11px',
          }}
        />
      ) : (
        <div style={{ fontSize: '11px' }}>{label || '处理'}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: '#1890ff',
          width: 10,
          height: 10,
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: '#1890ff',
          width: 10,
          height: 10,
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

ProcessNode.displayName = 'ProcessNode';

export default ProcessNode;

