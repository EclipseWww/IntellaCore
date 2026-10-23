import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const DataNode = memo(({ data, isConnectable }) => {
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
        padding: '0 20px',
        width: '100%',
        height: '100%',
        minWidth: '50px',
        minHeight: '40px',
        display: 'block',
        position: 'relative',
      }}
    >
      <NodeResizer minWidth={50} minHeight={40} isVisible={data.selected} />

      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          overflow: 'visible',
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <path
          d="M 20 0 L 100 0 L 80 100 L 0 100 Z"
          fill="#f9f0ff"
          stroke="#722ed1"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div style={{
        position: 'absolute',
        zIndex: 1,
        width: '80%',
        textAlign: 'center',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{
            background: '#722ed1',
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
            background: '#722ed1',
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
              color: '#722ed1',
              fontWeight: '500',
              outline: 'none',
              fontSize: '11px',
            }}
          />
        ) : (
          <div style={{ fontSize: '11px', lineHeight: '1.2' }}>{label || '数据'}</div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: '#722ed1',
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
          background: '#722ed1',
          width: 10,
          height: 10,
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

DataNode.displayName = 'DataNode';

export default DataNode;

