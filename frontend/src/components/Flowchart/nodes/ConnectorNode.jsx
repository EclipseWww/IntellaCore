import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const ConnectorNode = memo(({ data, isConnectable }) => {
  return (
    <div
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#e6fffb',
        color: '#13c2c2',
        border: '2px solid #13c2c2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '12px',
        boxShadow: '0 2px 6px rgba(19, 194, 194, 0.2)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ 
          background: '#13c2c2',
          width: 8,
          height: 8,
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ 
          background: '#13c2c2',
          width: 8,
          height: 8,
        }}
        isConnectable={isConnectable}
      />
      <div style={{ fontSize: '10px' }}>{data.label || '○'}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ 
          background: '#13c2c2',
          width: 8,
          height: 8,
        }}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ 
          background: '#13c2c2',
          width: 8,
          height: 8,
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
});

ConnectorNode.displayName = 'ConnectorNode';

export default ConnectorNode;

