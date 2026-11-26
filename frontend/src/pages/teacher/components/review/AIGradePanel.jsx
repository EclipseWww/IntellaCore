import React from 'react';
import {
  Card,
  Space,
  Button,
  Typography,
  Divider,
  Spin,
  Empty,
  Tag
} from 'antd';







const { Title } = Typography;

// AI 评阅结果面板（批阅页）
const AIGradePanel = ({ aiGrade, handleRequestAIGrade, loadingSubmissions, selectedSubmission, submissionTimes }) => {
  if (!selectedSubmission) return null;

  // 获取当前选中学生的加载状态
  const isLoading = loadingSubmissions[selectedSubmission._id] || false;

  // 获取当前选中学生的计时
  const currentTime = submissionTimes[selectedSubmission._id] || 0;

  // 检查 aiGrade 是否为有效的评阅结果
  const isValidAIGrade = aiGrade && (
    aiGrade.score !== undefined ||
    aiGrade.feedback ||
    (aiGrade.analysis && Object.keys(aiGrade.analysis).length > 0)
  );


  if (!isValidAIGrade) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large">
              <div style={{
                padding: '50px',
                background: 'rgba(255, 255, 255, 0.8)',
                borderRadius: '4px',
                marginBottom: '20px',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '16px'
              }}>
                <div style={{ fontSize: '16px', color: '#1890ff' }}>
                  AI 正在评阅作业...
                </div>
                <div style={{ color: '#666' }}>
                  预计需要 30-60 秒，请耐心等待
                </div>
                <div style={{
                  color: '#1890ff',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  marginTop: '8px'
                }}>
                  {currentTime} 秒
                </div>
              </div>
            </Spin>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Empty
              description={
                <span style={{ color: '#666', marginBottom: '16px', display: 'block' }}>
                  暂无 AI 评阅结果
                </span>
              }
            />
            <Button
              type="primary"
              onClick={() => handleRequestAIGrade(selectedSubmission)}
              disabled={!selectedSubmission}
              style={{ marginTop: '16px' }}
            >
              请求 AI 评阅
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>AI 评分：{aiGrade.score}</Title>
            <Spin spinning={isLoading} tip={isLoading ? `评阅中 ${currentTime}s` : ''}>
              <Button
                type="primary"
                size="small"
                onClick={() => handleRequestAIGrade(selectedSubmission)}
                disabled={isLoading}
              >
                重新评阅
              </Button>
            </Spin>
          </Space>
          <div style={{ marginBottom: '16px' }}>{aiGrade.feedback}</div>
        </Space>
      </div>

      <Divider>详细分析</Divider>

      {aiGrade.analysis && Object.entries(aiGrade.analysis).map(([key, analysis]) => {
        if (!analysis) return null;
        // 获取对应的中文名称
        let title;
        switch (key) {
          case 'codeQuality': title = '代码质量'; break;
          case 'functionality': title = '功能实现'; break;
          case 'basicConcepts': title = '基础概念掌握'; break;
          case 'logicClarity': title = '逻辑清晰度'; break;
          case 'readability': title = '代码可读性'; break; // 兼容旧版
          case 'efficiency': title = '代码效率'; break; // 兼容旧版
          default: title = key;
        }
        return (
          <Card
            key={key}
            size="small"
            title={
              <Space>
                {title}
                <Tag color="blue">{analysis.score} 分</Tag>
              </Space>
            }
            style={{ marginBottom: '12px' }}
          >
            {analysis.feedback}
          </Card>
        );
      })}

      {aiGrade.suggestions && aiGrade.suggestions.length > 0 && (
        <>
          <Divider>改进建议</Divider>
          <ul style={{ paddingLeft: '20px' }}>
            {aiGrade.suggestions.map((suggestion, index) => (
              <li key={index} style={{ marginBottom: '8px' }}>{suggestion}</li>
            ))}
          </ul>
        </>
      )}

      <div style={{ marginTop: '20px', color: '#888', fontSize: '12px' }}>
        评阅时间：{new Date(aiGrade.gradedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default AIGradePanel;
