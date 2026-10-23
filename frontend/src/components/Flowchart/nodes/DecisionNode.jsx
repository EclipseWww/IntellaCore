import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';

const DecisionNode = memo(({ data, isConnectable }) => {

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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <NodeResizer minWidth={60} minHeight={60} isVisible={data.selected} keepAspectRatio={true} />
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          position: 'relative',
        }}
      >
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
            d="M 50 0 L 100 50 L 50 100 L 0 50 Z"
            fill="#fffbe6"
            stroke="#faad14"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div style={{
          position: 'absolute',
          zIndex: 1,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70%',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
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
                color: '#d48806',
                fontWeight: 'bold',
                fontSize: '10px',
                outline: 'none',
              }}
            />
          ) : (
            <div
              style={{
                color: '#d48806',
                fontWeight: 'bold',
                wordBreak: 'break-word',
                fontSize: '10px',
                lineHeight: '1.2',
              }}
            >
              {label || '判断'}
            </div>
          )}
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: '#faad14',
          width: 8,
          height: 8,
          top: -4,
          left: '50%',
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: '#faad14',
          width: 8,
          height: 8,
          left: -4,
          top: '50%',
        }}
        isConnectable={isConnectable}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: '#faad14',
          width: 8,
          height: 8,
          bottom: -4,
          left: '50%',
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: '#faad14',
          width: 8,
          height: 8,
          right: -4,
          top: '50%',
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

DecisionNode.displayName = 'DecisionNode';

export default DecisionNode;

