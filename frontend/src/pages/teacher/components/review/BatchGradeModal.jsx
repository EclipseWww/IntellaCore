import React from 'react';
import {
  Button,
  Modal,
  Tag,
  Radio
} from 'antd';



import { CheckCircleOutlined } from '@ant-design/icons';




// 一键评分对话框（批阅页）
const BatchGradeModal = ({ batchGradeModalVisible, batchGradeProgress, batchGradeScore, batchGradeTotal, batchGrading, getUngradedSubmissions, handleBatchGrade, handleCloseBatchGradeModal, selectedClass, setBatchGradeScore }) => {
  const ungradedCount = getUngradedSubmissions().length;
  const progressPercent = batchGradeTotal > 0 ? Math.round((batchGradeProgress / batchGradeTotal) * 100) : 0;

  return (
    <Modal
      title="一键评分"
      open={batchGradeModalVisible}
      onCancel={handleCloseBatchGradeModal}
      footer={[
        <Button key="cancel" onClick={handleCloseBatchGradeModal} disabled={batchGrading}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={handleBatchGrade}
          loading={batchGrading}
          disabled={ungradedCount === 0}
        >
          确认评分
        </Button>
      ]}
      maskClosable={!batchGrading}
      closable={!batchGrading}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          当前有 <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{ungradedCount}</span> 份未评阅作业
          {selectedClass && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedClass}</Tag>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: '#666' }}>选择评分等级：</div>
          <Radio.Group
            value={batchGradeScore}
            onChange={(e) => setBatchGradeScore(e.target.value)}
            disabled={batchGrading}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Radio.Button value="A" style={{ textAlign: 'center' }}>A (10分)</Radio.Button>
              <Radio.Button value="B" style={{ textAlign: 'center' }}>B (8分)</Radio.Button>
              <Radio.Button value="C" style={{ textAlign: 'center' }}>C (6分)</Radio.Button>
              <Radio.Button value="D" style={{ textAlign: 'center' }}>D (4分)</Radio.Button>
              <Radio.Button value="E" style={{ textAlign: 'center' }}>E (2分)</Radio.Button>
              <Radio.Button value="F" style={{ textAlign: 'center' }}>F (0分)</Radio.Button>
            </div>
          </Radio.Group>
        </div>

        {batchGrading && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, color: '#666' }}>
              评分进度: {batchGradeProgress} / {batchGradeTotal}
            </div>
            <div style={{
              height: '8px',
              background: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: '#52c41a',
                borderRadius: '4px',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BatchGradeModal;
