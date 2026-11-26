import React from 'react';
import {
  Space,
  Button,
  Spin,
  Empty,
  Tag,
  Drawer
} from 'antd';



import { FileSearchOutlined } from '@ant-design/icons';




// 待批改总览抽屉（批阅页）
const PendingSummaryDrawer = ({ fetchPendingSummary, handleClosePendingDrawer, handleJumpToActivity, pendingData, pendingDrawerVisible, pendingLoading, totalPending }) => {
  // 获取活动类型对应的颜色和名称
  const getActivityTypeInfo = (type) => {
    const typeMap = {
      'flowchart': { color: 'purple', name: '流程图' },
      'python': { color: 'blue', name: 'Python' },
      'spreadsheet': { color: 'green', name: '在线表格' },
      'fillblank': { color: 'orange', name: '填空' },
      'html': { color: 'cyan', name: 'HTML' },
      'quiz': { color: 'magenta', name: '测验' }
    };
    return typeMap[type] || { color: 'default', name: '作业' };
  };

  return (
    <Drawer
      title={
        <Space>
          <FileSearchOutlined />
          <span>待批改作业总览</span>
          {totalPending > 0 && (
            <Tag color="orange" style={{ marginLeft: 8 }}>共 {totalPending} 份待批改</Tag>
          )}
        </Space>
      }
      width={500}
      open={pendingDrawerVisible}
      onClose={handleClosePendingDrawer}
      extra={
        <Button onClick={fetchPendingSummary} loading={pendingLoading}>
          刷新
        </Button>
      }
    >
      <Spin spinning={pendingLoading}>
        {pendingData.length === 0 ? (
          <Empty description="暂无待批改作业" />
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {pendingData.map(course => (
              <div key={course.value} style={{ marginBottom: 16 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 15,
                  padding: '8px 12px',
                  background: '#fafafa',
                  borderRadius: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{course.label}</span>
                  <Tag color="orange">{course.pendingCount}</Tag>
                </div>
                {course.children?.map(unit => (
                  <div key={unit.value} style={{ marginLeft: 12, marginTop: 8 }}>
                    <div style={{
                      color: '#666',
                      fontSize: 13,
                      marginBottom: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>📁 {unit.label}</span>
                      <Tag color="default">{unit.pendingCount}</Tag>
                    </div>
                    {unit.children?.map(lesson => (
                      <div key={lesson.value} style={{ marginLeft: 12 }}>
                        <div style={{ color: '#888', fontSize: 12, marginBottom: 2 }}>
                          📄 {lesson.label}
                        </div>
                        {lesson.children?.map(activity => {
                          const typeInfo = getActivityTypeInfo(activity.type);
                          return (
                            <div
                              key={activity.value}
                              onClick={() => handleJumpToActivity(activity)}
                              style={{
                                marginLeft: 12,
                                padding: '6px 12px',
                                marginBottom: 4,
                                background: '#fff7e6',
                                borderRadius: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #ffe7ba',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fff1b8';
                                e.currentTarget.style.borderColor = '#ffd666';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff7e6';
                                e.currentTarget.style.borderColor = '#ffe7ba';
                              }}
                            >
                              <Space size={4}>
                                <Tag color={typeInfo.color} style={{ marginRight: 4 }}>{typeInfo.name}</Tag>
                                <span style={{ fontSize: 13 }}>{activity.label}</span>
                              </Space>
                              <Tag color="red">{activity.pendingCount} 待批改</Tag>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Spin>
    </Drawer>
  );
};

export default PendingSummaryDrawer;
