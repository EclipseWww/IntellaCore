import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const StartNode = memo(({ data, isConnectable }) => {
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
        minHeight: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '20px',
        background: '#52c41a',
        color: '#fff',
        border: '2px solid #389e0d',
        textAlign: 'center',
        fontWeight: 'bold',
        boxShadow: '0 2px 6px rgba(82, 196, 26, 0.3)',
      }}
    >
      <NodeResizer minWidth={50} minHeight={30} isVisible={data.selected} />
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
            color: '#fff',
            fontWeight: 'bold',
            outline: 'none',
            fontSize: '11px',
          }}
        />
      ) : (
        <div style={{ fontSize: '11px' }}>{label || '开始'}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: '#389e0d',
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
          background: '#389e0d',
          width: 10,
          height: 10,
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';

export default StartNode;

