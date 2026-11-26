import React from 'react';
import {
  Space,
  Button,
  Modal,
  Tag,
  Radio,
  Progress
} from 'antd';



import { ThunderboltOutlined } from '@ant-design/icons';

import { formatClassName } from './assignmentReviewUtils';


// 批量 AI 评阅对话框（批阅页）
const BatchAIGradeModal = ({ allSubmissions, batchAICompleted, batchAIModalVisible, batchAIProgress, batchAIResults, batchAIRunning, batchAITotal, batchAIType, batchProcessStatus, handleBatchAIGrade, handleCloseBatchAIModal, selectedClass, setBatchAIType, submissions }) => {
  // 计算各类型作业的数量
  const counts = {
    ungraded: allSubmissions.filter(s => {
      const teacherScore = s.grade?.score;
      const aiScore = s.aiGrade?.score;
      return teacherScore === undefined && aiScore === undefined;
    }).length,

    aigraded: allSubmissions.filter(s => {
      const teacherScore = s.grade?.score;
      const aiScore = s.aiGrade?.score;
      return teacherScore === undefined && aiScore !== undefined;
    }).length,

    all: allSubmissions.length
  };

  // 如果有班级筛选，计算筛选后的数量
  const filteredCounts = selectedClass ? {
    ungraded: submissions.filter(s => {
      const teacherScore = s.grade?.score;
      const aiScore = s.aiGrade?.score;
      return teacherScore === undefined && aiScore === undefined;
    }).length,

    aigraded: submissions.filter(s => {
      const teacherScore = s.grade?.score;
      const aiScore = s.aiGrade?.score;
      return teacherScore === undefined && aiScore !== undefined;
    }).length,

    all: submissions.length
  } : counts;

  // 使用实际会处理的数量
  const displayCounts = selectedClass ? filteredCounts : counts;

  // 记录实际成功和失败的提交数量
  const finalResults = Object.values(batchProcessStatus).reduce(
    (acc, status) => {
      if (status === 'success') acc.success++;
      else if (status === 'failed') acc.failed++;
      return acc;
    },
    { success: 0, failed: 0 }
  );

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThunderboltOutlined style={{ color: '#1890ff', marginRight: 8 }} />
          批量AI评阅Python作业
          {selectedClass && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedClass}</Tag>}
        </div>
      }
      open={batchAIModalVisible}
      onCancel={handleCloseBatchAIModal}
      footer={[
        <Button
          key="cancel"
          onClick={handleCloseBatchAIModal}
          disabled={batchAIRunning}
        >
          {batchAICompleted ? '完成' : '取消'}
        </Button>,
        !batchAICompleted && (
          <Button
            key="submit"
            type="primary"
            onClick={handleBatchAIGrade}
            loading={batchAIRunning}
            disabled={batchAIRunning}
          >
            开始评阅
          </Button>
        )
      ]}
      width={600}
    >
      <div>
        {!batchAICompleted && !batchAIRunning && (
          <div style={{ marginBottom: 16 }}>
            <Radio.Group
              value={batchAIType}
              onChange={e => setBatchAIType(e.target.value)}
              disabled={batchAIRunning}
            >
              <Space direction="vertical">
                <Radio value="ungraded">
                  仅评阅未评分作业
                  <Tag color={displayCounts.ungraded > 0 ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                    {displayCounts.ungraded} 份
                  </Tag>
                </Radio>
                <Radio value="aigraded">
                  重新评阅已有AI评分的作业
                  <Tag color={displayCounts.aigraded > 0 ? 'cyan' : 'default'} style={{ marginLeft: 8 }}>
                    {displayCounts.aigraded} 份
                  </Tag>
                </Radio>
                <Radio value="all">
                  评阅{selectedClass ? '当前班级' : '所有'}作业
                  <Tag color={displayCounts.all > 0 ? 'green' : 'default'} style={{ marginLeft: 8 }}>
                    {displayCounts.all} 份
                  </Tag>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
        )}

        {(batchAIRunning || batchAICompleted) && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>评阅进度：{batchAIProgress}/{batchAITotal}</span>
              <span>
                <Tag color="green">成功: {batchAICompleted ? finalResults.success : batchAIResults.success}</Tag>
                <Tag color="red">失败: {batchAICompleted ? finalResults.failed : batchAIResults.failed}</Tag>
                {!batchAICompleted && (
                  <Tag color="blue">进行中: {batchAIResults.processing}</Tag>
                )}
              </span>
            </div>
            <Progress
              percent={Math.round((batchAIProgress / batchAITotal) * 100)}
              status={batchAIProgress === batchAITotal ? 'success' : 'active'}
            />

            {batchAICompleted && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: '#52c41a', fontWeight: 'bold' }}>
                  批量评阅已完成
                </div>
                <div style={{ marginTop: 8 }}>
                  共处理 {batchAITotal} 份作业，成功 {finalResults.success} 份，失败 {finalResults.failed} 份
                </div>
              </div>
            )}

            <div style={{
              marginTop: 16,
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: 4,
              padding: 8
            }}>
              {/* 只显示有处理状态的提交 */}
              {Object.entries(batchProcessStatus).map(([submissionId, status]) => {
                // 从提交列表中找出对应的提交对象
                const submission = [...allSubmissions].find(s => s._id === submissionId);
                if (!submission) return null;

                let statusTag;

                if (status === 'pending') {
                  statusTag = <Tag>等待中</Tag>;
                } else if (status === 'processing') {
                  statusTag = <Tag color="blue">处理中</Tag>;
                } else if (status === 'success') {
                  statusTag = <Tag color="green">成功</Tag>;
                } else if (status === 'failed') {
                  statusTag = <Tag color="red">失败</Tag>;
                }

                return (
                  <div key={submissionId} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{submission.student?.name} - {formatClassName(submission.student?.grade, submission.student?.className)}</span>
                    {statusTag}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
          注意：批量评阅将会同时发送多个请求，可能需要一些时间来完成所有评阅。
        </div>
      </div>
    </Modal>
  );
};

export default BatchAIGradeModal;
