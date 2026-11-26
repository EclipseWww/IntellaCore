import React from 'react';
import {
  Tag,
  Tooltip
} from 'antd';





import { formatClassName, calculateStatistics } from './assignmentReviewUtils';


// 批阅页顶部的等级统计
const ReviewStatistics = ({ allSubmissions, fillBlankSubmissions, flowchartSubmissions, isFillBlankActivity, isFlowchartActivity, selectedClass, submissions }) => {
  // 根据当前活动类型和班级筛选，选择使用的数据
  let dataToUse = [];

  if (isFlowchartActivity) {
    dataToUse = flowchartSubmissions;
  } else if (isFillBlankActivity) {
    dataToUse = fillBlankSubmissions;
  } else {
    dataToUse = selectedClass ? submissions : allSubmissions;
  }

  // 如果是 Flowchart 或 FillBlank，手动应用班级筛选
  if ((isFlowchartActivity || isFillBlankActivity) && selectedClass) {
    dataToUse = dataToUse.filter(s => {
      // 兼容不同数据结构的班级信息获取
      const student = s.student || s.studentId;
      const grade = student?.grade || student?.classId?.grade;
      const className = student?.className || student?.classId?.name;
      return formatClassName(grade, className) === selectedClass;
    });
  }

  const stats = calculateStatistics(dataToUse);
  const total = dataToUse.length;

  // 计算已评阅的百分比
  const gradedPercentage = total > 0 ? Math.round(((total - stats.ungraded) / total) * 100) : 0;

  return (
    <div style={{
      marginBottom: '10px',
      background: '#f9f9f9',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', marginRight: '8px' }}>作业统计:</span>
          {selectedClass && <Tag color="blue" size="small" style={{ marginRight: '8px' }}>{selectedClass}</Tag>}
          <span>
            评阅进度:
            <span style={{
              fontWeight: 'bold',
              margin: '0 4px',
              color: gradedPercentage >= 80 ? '#52c41a' : gradedPercentage >= 50 ? '#faad14' : '#ff4d4f'
            }}>
              {gradedPercentage}%
            </span>
            ({total - stats.ungraded}/{total})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '8px', fontWeight: 'bold', color: '#722ed1' }}>
            未评阅: {stats.ungraded}
          </span>
          <span>|</span>
          <div style={{ display: 'flex', marginLeft: '8px' }}>
            <Tooltip title={`A等级: ${stats.A}人 (${total > 0 ? Math.round((stats.A / total) * 100) : 0}%)`}>
              <Tag color="#52c41a" style={{ margin: '0 2px' }}>A: {stats.A}</Tag>
            </Tooltip>
            <Tooltip title={`B等级: ${stats.B}人 (${total > 0 ? Math.round((stats.B / total) * 100) : 0}%)`}>
              <Tag color="#1890ff" style={{ margin: '0 2px' }}>B: {stats.B}</Tag>
            </Tooltip>
            <Tooltip title={`C等级: ${stats.C}人 (${total > 0 ? Math.round((stats.C / total) * 100) : 0}%)`}>
              <Tag color="#faad14" style={{ margin: '0 2px' }}>C: {stats.C}</Tag>
            </Tooltip>
            <Tooltip title={`D等级: ${stats.D}人 (${total > 0 ? Math.round((stats.D / total) * 100) : 0}%)`}>
              <Tag color="#ff7a45" style={{ margin: '0 2px' }}>D: {stats.D}</Tag>
            </Tooltip>
            <Tooltip title={`E等级: ${stats.E}人 (${total > 0 ? Math.round((stats.E / total) * 100) : 0}%)`}>
              <Tag color="#ff4d4f" style={{ margin: '0 2px' }}>E: {stats.E}</Tag>
            </Tooltip>
            <Tooltip title={`F等级: ${stats.F}人 (${total > 0 ? Math.round((stats.F / total) * 100) : 0}%)`}>
              <Tag color="#f5222d" style={{ margin: '0 2px' }}>F: {stats.F}</Tag>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div style={{
        height: '4px',
        background: '#f0f0f0',
        borderRadius: '2px',
        overflow: 'hidden',
        marginTop: '6px'
      }}>
        <div style={{
          height: '100%',
          width: `${gradedPercentage}%`,
          background: gradedPercentage >= 80 ? '#52c41a' : gradedPercentage >= 50 ? '#faad14' : '#ff4d4f',
          borderRadius: '2px',
          transition: 'width 0.5s'
        }} />
      </div>
    </div>
  );
};

export default ReviewStatistics;
