import React, { useState } from 'react';
import { Drawer, Table, Tag, Tooltip, Space, Button, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

// 上课页“作业提交情况”抽屉：按学生 × 活动显示提交、得分与打字/测验等完成情况
const SubmissionStatusDrawer = ({
  open,
  onClose,
  loading,
  refreshing,
  onRefresh,
  updatedAt,
  currentLesson,
  students,
  activities,
  assignmentSubmissions,
  typingRecords,
  quizSubmissions,
  spreadsheetSubmissions,
  fillBlankSubmissions,
  pythonSubmissions,
  flowchartSubmissions
}) => {
  const [drawerWidth, setDrawerWidth] = useState(600); // Drawer 宽度随表格列数变化

  // 修改 getSubmissionTableData 函数以包含打字数据
  const getSubmissionTableData = () => {
    if (!students.length) return [];

    // 获取当前课时的所有需要提交的活动
    const activityList = [];

    // 首先从当前选择的课时中获取标记为需要提交的活动（包括流程图活动）
    const requiredActivities = activities.filter(activity => activity.requireSubmission || activity.type === 'flowchart');

    // 如果当前课时有标记为需要提交的活动，添加到活动列表中
    requiredActivities.forEach(activity => {
      if (activity._id && !activityList.some(a => a.id === activity._id)) {
        activityList.push({
          id: activity._id,
          title: activity.title || '未命名活动'
        });
      }
    });

    // 然后从已有提交记录中添加活动
    if (assignmentSubmissions.length > 0) {
      // 从提交记录中提取活动信息
      const activityMap = {};
      assignmentSubmissions.forEach(submission => {
        if (submission.activityId && !activityMap[submission.activityId]) {
          activityMap[submission.activityId] = {
            id: submission.activityId,
            title: submission.activityTitle || '未知作业'
          };
        }
      });

      // 添加不在活动列表中的活动
      Object.values(activityMap).forEach(activity => {
        if (!activityList.some(a => a.id === activity.id)) {
          activityList.push(activity);
        }
      });
    }

    // 检查是否有任何需要显示列的活动
    const hasDisplayableActivities = activities.some(activity =>
      activity.type === 'typing' ||
      activity.type === 'quiz' ||
      activity.type === 'spreadsheet' ||
      activity.type === 'fillblank' ||
      activity.type === 'python' ||
      activity.type === 'flowchart' ||
      activity.requireSubmission
    );

    // 如果没有可显示的活动，返回空数组
    if (!hasDisplayableActivities && activityList.length === 0) return [];

    // 为每个学生创建一条记录，每个活动作为一个字段
    return students.map(student => {
      const rowData = {
        key: student._id || student.name,
        studentName: student.name || '未知学生',
      };

      // 为每个活动添加一个字段
      activityList.forEach(activity => {
        const submission = assignmentSubmissions.find(
          s => s.student?._id === student._id && s.activityId === activity.id
        );

        rowData[`activity_${activity.id}`] = {
          status: submission ? submission.status : 'not_submitted',
          grade: submission ? submission.grade : null,
          aiGrade: submission ? submission.aiGrade : null,
          submittedAt: submission ? submission.submittedAt : null,
          activityTitle: activity.title
        };
      });

      // 添加打字活动数据（按活动分组）
      const typingActivitiesForData = activities.filter(a => a.type === 'typing');
      typingActivitiesForData.forEach(activity => {
        const typingData = typingRecords[student._id]?.[activity._id];
        rowData[`typing_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '打字练习',
          hasRecord: typingData?.hasRecord || false,
          count: typingData?.count || 0,
          speed: typingData?.speed || 0,
          accuracy: typingData?.accuracy || 0
        };
      });

      // 添加测验提交情况
      const quizActivities = activities.filter(a => a.type === 'quiz');
      if (quizActivities.length > 0) {
        // 获取当前课时quiz活动对应的测验ID（处理quiz可能是对象或字符串ID的情况）
        const quizIds = quizActivities
          .map(a => {
            const quiz = a.quizSettings?.quiz;
            return typeof quiz === 'object' ? quiz?._id : quiz;
          })
          .filter(Boolean);

        // 构建测验标题映射
        const quizTitles = {};
        quizActivities.forEach(activity => {
          if (activity.quizSettings && activity.quizSettings.quiz) {
            const quizId = typeof activity.quizSettings.quiz === 'object'
              ? activity.quizSettings.quiz._id
              : activity.quizSettings.quiz;
            quizTitles[quizId] = activity.title || '未命名测验';
          }
        });

        // 计算学生提交的测验
        if (student._id && quizSubmissions[student._id]) {
          const studentQuizSubmissions = quizSubmissions[student._id];

          // 按测验ID归类最新的提交
          const latestSubmissionsByQuiz = {};

          studentQuizSubmissions.forEach(submission => {
            const quizId = submission.quizId;

            // 如果这是第一次看到这个测验ID，或者提交时间比之前记录的更晚
            if (!latestSubmissionsByQuiz[quizId] ||
              new Date(submission.submitTime) > new Date(latestSubmissionsByQuiz[quizId].submitTime)) {
              latestSubmissionsByQuiz[quizId] = submission;
            }
          });

          // 根据当前课时的测验ID过滤
          let relevantSubmissions = [];
          if (quizIds.length > 0) {
            relevantSubmissions = quizIds
              .filter(id => latestSubmissionsByQuiz[id])
              .map(id => latestSubmissionsByQuiz[id]);
          } else if (Object.keys(latestSubmissionsByQuiz).length > 0) {
            // 如果找不到具体的quizId但有提交记录，使用所有提交
            relevantSubmissions = Object.values(latestSubmissionsByQuiz);
          }

          // 添加每个测验的提交情况
          relevantSubmissions.forEach(submission => {
            const quizId = submission.quizId;
            rowData[`quiz_${quizId}`] = {
              quizId: quizId,
              quizTitle: quizTitles[quizId] || submission.quizTitle || '未知测验',
              score: submission.score,
              accuracy: submission.accuracy,
              correctCount: submission.correctCount,
              totalQuestions: submission.totalQuestions,
              submitTime: submission.submitTime,
              attemptNumber: submission.attemptNumber
            };
          });

          // 如果没有特定测验的提交，但有提交记录，添加一个汇总项
          if (relevantSubmissions.length === 0 && studentQuizSubmissions.length > 0) {
            rowData[`quiz_summary`] = {
              count: studentQuizSubmissions.length,
              lastSubmitTime: studentQuizSubmissions[0].submitTime
            };
          }
        }
      }

      // 添加spreadsheet活动提交情况
      const spreadsheetActivitiesForData = activities.filter(a => a.type === 'spreadsheet');
      spreadsheetActivitiesForData.forEach(activity => {
        const submissionData = spreadsheetSubmissions[student._id]?.[activity._id];
        rowData[`spreadsheet_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '在线表格',
          hasSubmission: submissionData?.hasSubmission || false,
          submission: submissionData?.submission
        };
      });

      // 添加fillblank活动提交情况
      const fillBlankActivitiesForData = activities.filter(a => a.type === 'fillblank');
      fillBlankActivitiesForData.forEach(activity => {
        const submissionData = fillBlankSubmissions[student._id]?.[activity._id];
        rowData[`fillblank_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '填空练习',
          hasSubmission: submissionData?.hasSubmission || false,
          submission: submissionData?.submission
        };
      });

      // 添加python活动提交情况
      const pythonActivitiesForData = activities.filter(a => a.type === 'python');
      pythonActivitiesForData.forEach(activity => {
        const submissionData = pythonSubmissions[student._id]?.[activity._id];
        rowData[`python_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || 'Python编程',
          hasSubmission: submissionData?.hasSubmission || false,
          submission: submissionData?.submission
        };
      });

      // 添加flowchart活动提交情况
      const flowchartActivitiesForData = activities.filter(a => a.type === 'flowchart');
      flowchartActivitiesForData.forEach(activity => {
        const submissionData = flowchartSubmissions[student._id]?.[activity._id];
        rowData[`flowchart_${activity._id}`] = {
          activityId: activity._id,
          activityTitle: activity.title || '流程图',
          hasSubmission: submissionData?.hasSubmission || false,
          status: submissionData?.status,
          submission: submissionData?.submission
        };
      });

      return rowData;
    });
  };

  // 修改 getTableColumns 函数以按照课程活动顺序显示
  const getTableColumns = () => {
    const baseColumns = [
      {
        title: '学生姓名',
        dataIndex: 'studentName',
        key: 'studentName',
        width: 100,
        fixed: 'left',
        sorter: (a, b) => a.studentName.localeCompare(b.studentName),
        sortDirections: ['ascend', 'descend']
      }
    ];

    // 按照活动在课程中的顺序生成列
    const activityColumns = activities.map(activity => {
      switch (activity.type) {
        case 'typing':
          return {
            title: activity.title || '打字练习',
            dataIndex: `typing_${activity._id}`,
            key: `typing_${activity._id}`,
            width: 120,
            sorter: (a, b) => {
              const speedA = a[`typing_${activity._id}`]?.speed || 0;
              const speedB = b[`typing_${activity._id}`]?.speed || 0;
              return speedB - speedA;
            },
            render: (value) => {
              if (!value || !value.hasRecord || value.count === 0) {
                return <Tag color="default">未练习</Tag>;
              }
              return (
                <Tooltip title={`${value.count} 次练习, 平均速度: ${value.speed}字/分钟, 准确率: ${value.accuracy}%`}>
                  <Tag color="blue">{value.speed}字/分钟</Tag>
                </Tooltip>
              );
            }
          };

        case 'quiz':
          const quizId = activity.quizSettings?.quiz?._id || activity.quizSettings?.quiz;
          return {
            title: activity.title || '测验',
            dataIndex: `quiz_${quizId}`,
            key: `quiz_${activity._id}`,
            width: 120,
            sorter: (a, b) => {
              const dataA = a[`quiz_${quizId}`];
              const dataB = b[`quiz_${quizId}`];
              if (dataA && dataB) {
                return (dataB.accuracy || 0) - (dataA.accuracy || 0);
              }
              return dataA ? -1 : (dataB ? 1 : 0);
            },
            render: (value) => {
              if (!value) {
                return <Tag color="default">未完成</Tag>;
              }
              return (
                <Tooltip title={`正确率: ${value.accuracy}% (${value.correctCount}/${value.totalQuestions})\n提交时间: ${new Date(value.submitTime).toLocaleString()}\n提交次数: ${value.attemptNumber}`}>
                  <Tag color={value.accuracy >= 80 ? 'success' :
                    value.accuracy >= 60 ? 'processing' :
                      value.accuracy >= 40 ? 'warning' : 'error'}>
                    {value.accuracy}%
                  </Tag>
                </Tooltip>
              );
            }
          };

        case 'spreadsheet':
          return {
            title: activity.title || '在线表格',
            dataIndex: `spreadsheet_${activity._id}`,
            key: `spreadsheet_${activity._id}`,
            width: 100,
            sorter: (a, b) => {
              const valA = a[`spreadsheet_${activity._id}`];
              const valB = b[`spreadsheet_${activity._id}`];
              const scoreA = valA?.hasSubmission ? 1 : 0;
              const scoreB = valB?.hasSubmission ? 1 : 0;
              return scoreA - scoreB;
            },
            render: (value) => {
              if (!value) return <Tag color="default">未知</Tag>;
              return value.hasSubmission
                ? <Tag color="success">已保存</Tag>
                : <Tag color="default">未保存</Tag>;
            }
          };

        case 'fillblank':
          return {
            title: activity.title || '填空练习',
            dataIndex: `fillblank_${activity._id}`,
            key: `fillblank_${activity._id}`,
            width: 100,
            sorter: (a, b) => {
              const valA = a[`fillblank_${activity._id}`];
              const valB = b[`fillblank_${activity._id}`];
              const scoreA = valA?.hasSubmission ? (valA.submission?.score ?? -1) : -2;
              const scoreB = valB?.hasSubmission ? (valB.submission?.score ?? -1) : -2;
              return scoreA - scoreB;
            },
            render: (value) => {
              if (!value) return <Tag color="default">未知</Tag>;
              if (value.hasSubmission) {
                const submission = value.submission;
                if (submission?.score !== undefined) {
                  return (
                    <Tooltip title={`得分: ${submission.score}`}>
                      <Tag color="success">已提交: {submission.score}分</Tag>
                    </Tooltip>
                  );
                }
                return <Tag color="success">已提交</Tag>;
              }
              return <Tag color="default">未完成</Tag>;
            }
          };

        case 'python':
          return {
            title: activity.title || 'Python编程',
            dataIndex: `python_${activity._id}`,
            key: `python_${activity._id}`,
            width: 100,
            sorter: (a, b) => {
              const valA = a[`python_${activity._id}`];
              const valB = b[`python_${activity._id}`];
              const scoreA = valA?.hasSubmission ? (valA.submission?.score ?? -1) : -2;
              const scoreB = valB?.hasSubmission ? (valB.submission?.score ?? -1) : -2;
              return scoreA - scoreB;
            },
            render: (value) => {
              if (!value) return <Tag color="default">未知</Tag>;
              if (value.hasSubmission) {
                const submission = value.submission;
                if (submission?.score !== undefined) {
                  return (
                    <Tooltip title={`得分: ${submission.score}`}>
                      <Tag color="success">已提交: {submission.score}分</Tag>
                    </Tooltip>
                  );
                }
                return <Tag color="success">已提交</Tag>;
              }
              return <Tag color="default">未完成</Tag>;
            }
          };

        case 'flowchart':
          return {
            title: activity.title || '流程图',
            dataIndex: `flowchart_${activity._id}`,
            key: `flowchart_${activity._id}`,
            width: 120,
            sorter: (a, b) => {
              const valA = a[`flowchart_${activity._id}`];
              const valB = b[`flowchart_${activity._id}`];
              
              const getScore = (val) => {
                if (!val) return -2;
                if (val.status === 'graded') {
                   return val.submission?.grade?.score ?? -1;
                }
                if (val.hasSubmission) return -1;
                return -2;
              };
              return getScore(valA) - getScore(valB);
            },
            render: (value) => {
              if (!value) return <Tag color="default">未保存</Tag>;
              if (value.status === 'graded') {
                const submission = value.submission;
                const score = submission?.grade?.score !== undefined ? submission.grade.score : 'N/A';
                return <Tag color="success">已批阅: {score}</Tag>;
              }
              if (value.hasSubmission) {
                return <Tag color="processing">已保存</Tag>;
              }
              return <Tag color="error">未保存</Tag>;
            }
          };

        // 默认: 需要提交的活动 (practice, html等)
        default:
          if (activity.requireSubmission) {
            return {
              title: activity.title || '作业',
              dataIndex: `activity_${activity._id}`,
              key: `activity_${activity._id}`,
              width: 120,
              sorter: (a, b) => {
                const valA = a[`activity_${activity._id}`];
                const valB = b[`activity_${activity._id}`];
                
                const getScore = (val) => {
                  if (!val || val.status === 'not_submitted') return -2;
                  if (val.status === 'graded') {
                    const score = val.grade?.score !== undefined ? val.grade.score :
                      val.aiGrade?.score !== undefined ? val.aiGrade.score : -1;
                    return score;
                  }
                  if (val.status === 'submitted') return -1;
                  return -2;
                };
                return getScore(valA) - getScore(valB);
              },
              render: (value) => {
                if (!value) return <Tag color="default">未知</Tag>;
                let color = 'default';
                let text = '未知';
                switch (value.status) {
                  case 'graded':
                    color = 'success';
                    const score = value.grade?.score !== undefined ? value.grade.score :
                      value.aiGrade?.score !== undefined ? value.aiGrade.score : 'N/A';
                    text = `已批阅: ${score}`;
                    break;
                  case 'submitted':
                    color = 'processing';
                    text = '已提交';
                    break;
                  case 'not_submitted':
                  default:
                    color = 'error';
                    text = '未提交';
                    break;
                }
                const tooltipTitle = value.submittedAt ? `提交时间: ${new Date(value.submittedAt).toLocaleString()}` : '';
                return (
                  <Tooltip title={tooltipTitle}>
                    <Tag color={color}>{text}</Tag>
                  </Tooltip>
                );
              }
            };
          }
          return null; // 不需要提交的活动（如reading, video）不显示列
      }
    }).filter(col => col !== null); // 过滤掉null

    const columns = [...baseColumns, ...activityColumns];

    // 计算表格总宽度，用于设置Drawer宽度
    const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);
    // 设置最小宽度为600，最大宽度为窗口宽度的80%
    const windowWidth = window.innerWidth;
    const calculatedWidth = Math.min(Math.max(totalWidth + 48, 600), windowWidth * 0.8);

    // 更新Drawer宽度
    setTimeout(() => {
      setDrawerWidth(calculatedWidth);
    }, 0);

    return columns;
  };

  return (
  <Drawer
    title="作业提交情况"
    placement="right"
    onClose={onClose}
    open={open}
    extra={currentLesson && (
      <Space>
        {updatedAt && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            每 20 秒自动刷新 · 更新于 {updatedAt.toLocaleTimeString('zh-CN', { hour12: false })}
          </Text>
        )}
        <Button size="small" icon={<ReloadOutlined />} loading={refreshing} onClick={onRefresh}>
          刷新
        </Button>
      </Space>
    )}
    width={drawerWidth}
    bodyStyle={{ padding: '12px' }}
  >
    {loading ? (
      <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
    ) : currentLesson ? (
      <Table
        columns={getTableColumns()}
        dataSource={getSubmissionTableData()}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: '当前课时没有需要提交的作业' }}
        style={{ flex: 1 }}
      />
    ) : (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        请先选择课时
      </div>
    )}
  </Drawer>
  );
};

export default SubmissionStatusDrawer;
