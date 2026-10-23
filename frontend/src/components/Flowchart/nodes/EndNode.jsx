import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const EndNode = memo(({ data, isConnectable }) => {
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
        background: '#ff4d4f',
        color: '#fff',
        border: '2px solid #cf1322',
        textAlign: 'center',
        fontWeight: 'bold',
        boxShadow: '0 2px 6px rgba(255, 77, 79, 0.3)',
      }}
    >
      <NodeResizer minWidth={50} minHeight={30} isVisible={data.selected} />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: '#cf1322',
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
          background: '#cf1322',
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
            color: '#fff',
            fontWeight: 'bold',
            outline: 'none',
            fontSize: '11px',
          }}
        />
      ) : (
        <div style={{ fontSize: '11px' }}>{label || '结束'}</div>
      )}
    </div>
  );
});

EndNode.displayName = 'EndNode';

export default EndNode;

