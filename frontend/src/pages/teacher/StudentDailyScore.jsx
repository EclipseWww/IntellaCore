import React, { useState, useEffect } from 'react';
import {
  Card, Spin, Alert, Row, Col, Statistic, Button, Typography,
  Descriptions, Tag, Divider, Progress, Modal, Table
} from 'antd';
import {
  UserOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, FormOutlined, LeftOutlined, RightOutlined, CalendarOutlined
} from '@ant-design/icons';
import { learningStatsAPI, classAPI, userAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';

const { Title, Text, Paragraph } = Typography;

const StudentDailyScoreComponent = ({
  studentId,
  classId,
  onGoBack,
  onPrevStudent,
  onNextStudent,
  hideNavigation = false,
  semester
}) => {
  usePageTitle('学生平日成绩');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dailyScore, setDailyScore] = useState(null);
  const [studentList, setStudentList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [semesterLabel, setSemesterLabel] = useState('');
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 获取学生信息和成绩
  useEffect(() => {
    const fetchStudentDailyScore = async () => {
      setLoading(true);
      try {
        const response = await learningStatsAPI.getStudentDailyScore(studentId, { semester });
        if (response.success) {
          setDailyScore(response.data);

          // 设置学期标签
          if (response.data?.semester) {
            setSemesterLabel(formatSemesterLabel(response.data.semester));
          } else {
            setSemesterLabel('全部学期');
          }

          setError(null);
        }
      } catch (err) {
        console.error('获取学生平日成绩失败:', err);
        setError('获取学生平日成绩数据失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };

    // 如果有班级ID，获取班级学生列表以支持上一个/下一个导航
    const fetchClassStudents = async () => {
      if (classId) {
        try {
          // 改为获取班级平日成绩，这样可以按照成绩排序
          const response = await learningStatsAPI.getClassDailyScores(classId, { semester });
          if (response.success && response.data.studentsScores) {
            // 提取学生列表并按照平日成绩降序排序（和表格默认排序一致）
            const sortedStudents = response.data.studentsScores.map(score => ({
              _id: score.student.id,
              name: score.student.name
            }));

            setStudentList(sortedStudents);

            // 找到当前学生在列表中的位置
            const index = sortedStudents.findIndex(student => student._id === studentId);
            setCurrentIndex(index);
          }
        } catch (err) {
          console.error('获取班级成绩列表失败:', err);
          setStudentList([]);
        }
      }
    };

    fetchStudentDailyScore();
    fetchClassStudents();
  }, [studentId, classId, semester]);

  // 更新页面标题
  useEffect(() => {
    if (dailyScore?.student?.name) {
      document.title = `${dailyScore.student.name} - 平日成绩`;
    }
  }, [dailyScore]);

  // 计算上一个和下一个学生ID
  const getAdjacentStudents = () => {
    if (!studentList.length) return { prev: null, next: null };

    const currentIndex = studentList.findIndex(s => s._id === studentId);
    if (currentIndex === -1) return { prev: null, next: null };

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : null;
    const nextIndex = currentIndex < studentList.length - 1 ? currentIndex + 1 : null;

    return {
      prev: prevIndex !== null ? studentList[prevIndex]._id : null,
      next: nextIndex !== null ? studentList[nextIndex]._id : null
    };
  };

  const { prev, next } = getAdjacentStudents();

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    }
  };

  const handlePrevStudent = () => {
    if (prev && onPrevStudent) {
      onPrevStudent(prev);
    }
  };

  const handleNextStudent = () => {
    if (next && onNextStudent) {
      onNextStudent(next);
    }
  };

  // 根据分数获取对应的颜色
  const getScoreColor = (score) => {
    if (score >= 90) return '#52c41a';
    if (score >= 80) return '#1890ff';
    if (score >= 70) return '#faad14';
    if (score >= 60) return '#fa8c16';
    return '#f5222d';
  };

  // 获取等级对应的颜色
  const getGradeColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return '#52c41a';
    if (grade === 'B+' || grade === 'B') return '#1890ff';
    if (grade === 'C+' || grade === 'C') return '#faad14';
    if (grade === 'D') return '#fa8c16';
    return '#f5222d';
  };

  // 获取等级对应的标签颜色
  const getGradeTagColor = (grade) => {
    if (grade === 'A+' || grade === 'A') return 'success';
    if (grade === 'B+' || grade === 'B') return 'processing';
    if (grade === 'C+' || grade === 'C') return 'warning';
    if (grade === 'D') return 'orange';
    if (grade === 'F') return 'error';
    return 'default';
  };

  // 根据等级获取对应的描述
  const getGradeDescription = (grade) => {
    if (grade === 'A+') return '表现优异，继续保持！';
    if (grade === 'A') return '表现出色，继续保持！';
    if (grade === 'B+' || grade === 'B') return '整体表现良好，仍有提升空间。';
    if (grade === 'C+' || grade === 'C') return '基本合格，需要进一步巩固。';
    if (grade === 'D') return '未达到合格要求，需要加强练习。';
    if (grade === 'F') return '成绩不合格，请认真复习并及时补救。';
    return '暂无评价';
  };

  // 获取等级对应的中文名称
  const getGradeName = (grade) => {
    if (grade === 'A+') return '优秀+';
    if (grade === 'A') return '优秀';
    if (grade === 'B+') return '良好+';
    if (grade === 'B') return '良好';
    if (grade === 'C+') return '合格+';
    if (grade === 'C') return '合格';
    if (grade === 'D') return '不合格';
    if (grade === 'F') return '不合格';
    return '未评级';
  };

  // 准备雷达图数据
  const prepareRadarData = () => {
    if (!dailyScore) return [];

    // 计算活动类总分
    const activityScore = (dailyScore.assignment?.score || 0) +
      (dailyScore.flowchart?.score || 0) +
      (dailyScore.python?.score || 0) +
      (dailyScore.fillblank?.score || 0) +
      (dailyScore.spreadsheet?.score || 0);

    return [
      { subject: '打字', score: dailyScore.typing?.score || 0, fullMark: 50 },
      { subject: '活动', score: Math.round(activityScore * 10) / 10, fullMark: 50 },
      { subject: '测验', score: dailyScore.quiz?.score || 0, fullMark: 50 }
    ];
  };

  // 格式化学期标签显示
  const formatSemesterLabel = (semesterValue) => {
    if (!semesterValue || semesterValue === '全部学期') return '全部学期';

    try {
      const parts = semesterValue.split('-');
      if (parts.length === 3) {
        const academicYear = `${parts[0]}-${parts[1]}`;
        const semesterNum = parts[2];
        return `${academicYear} 学年 第${semesterNum}学期`;
      }
      return semesterValue;
    } catch (err) {
      console.error('格式化学期标签出错:', err);
      return semesterValue;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Card>
          <Spin tip="加载中...">
            <div style={{ minHeight: '300px' }} />
          </Spin>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message={error} type="error" />
      </div>
    );
  }

  if (!dailyScore) {
    return (
      <div style={{ padding: '20px' }}>
        <Alert message="暂无学生平日成绩数据" type="info" />
      </div>
    );
  }

  // 判断使用哪种评分方式展示
  const hasGrade = !!dailyScore.grade;
  const gradeColor = hasGrade ? getGradeColor(dailyScore.grade) : getScoreColor(dailyScore.dailyScore);
  const gradeTagColor = hasGrade ? getGradeTagColor(dailyScore.grade) :
    (dailyScore.dailyScore >= 90 ? 'success' :
      dailyScore.dailyScore >= 80 ? 'processing' :
        dailyScore.dailyScore >= 70 ? 'warning' :
          dailyScore.dailyScore >= 60 ? 'orange' : 'error');
  const gradeLevel = hasGrade ? getGradeName(dailyScore.grade) :
    (dailyScore.dailyScore >= 90 ? '优秀' :
      dailyScore.dailyScore >= 80 ? '良好' :
        dailyScore.dailyScore >= 60 ? '合格' : '不合格');
  const gradeDesc = hasGrade ? getGradeDescription(dailyScore.grade) :
    (dailyScore.dailyScore >= 90 ? '表现出色，继续保持！' :
      dailyScore.dailyScore >= 80 ? '整体表现良好，仍有提升空间。' :
        dailyScore.dailyScore >= 60 ? '基本合格，需要更多练习和提高。' : '需要加强练习，多参与课堂活动。');

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {!hideNavigation && (
            <Button onClick={handleGoBack} icon={<LeftOutlined />} style={{ marginRight: '10px' }}>
              返回班级成绩
            </Button>
          )}
          <Title level={3} style={{ display: 'inline-block', margin: 0 }}>
            {dailyScore?.student?.name} - 平日成绩详情
          </Title>
          {semesterLabel && (
            <Tag color="blue" style={{ marginLeft: 10 }}>
              <CalendarOutlined /> {semesterLabel}
            </Tag>
          )}
        </div>

        {!hideNavigation && studentList.length > 1 && (
          <div>
            <Button
              onClick={handlePrevStudent}
              disabled={currentIndex <= 0}
              icon={<LeftOutlined />}
              style={{ marginRight: '10px' }}
            >
              上一位学生
            </Button>
            <Button
              onClick={handleNextStudent}
              disabled={currentIndex >= studentList.length - 1}
              icon={<RightOutlined />}
            >
              下一位学生
            </Button>
          </div>
        )}
      </div>

      {/* 成绩概览卡片 */}
      <Card style={{ marginBottom: '20px' }} bordered={false}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: gradeColor
              }}>
                {dailyScore.dailyScore}
              </div>
              <Tag color={gradeTagColor} style={{ padding: '4px 8px', margin: '10px 0', fontSize: '16px' }}>
                {hasGrade ? dailyScore.grade : gradeLevel}
              </Tag>
              <div style={{ marginTop: '10px' }}>
                <Text type="secondary">{gradeDesc}</Text>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={16}>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={prepareRadarData()}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis domain={[0, 100]} />
                <RechartsTooltip
                  formatter={(value) => [`${value}分`, '']}
                  labelFormatter={(label) => label}
                />
                <Radar
                  name="成绩"
                  dataKey="score"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>

      {/* 成绩详情卡片 */}
      <Card title="成绩详情" bordered={false} style={{ marginBottom: '20px' }}>
        <Descriptions layout="vertical" column={{ xs: 1, sm: 3 }}>
          <Descriptions.Item label={<span><TrophyOutlined /> 平日成绩</span>}>
            <Statistic
              value={dailyScore.dailyScore}
              precision={1}
              valueStyle={{ color: gradeColor }}
              suffix="分"
            />
            <div style={{ marginTop: '10px' }}>
              <Tag color={dailyScore.isPassing ? 'success' : 'error'}>
                {hasGrade ? getGradeName(dailyScore.grade) : gradeLevel}
              </Tag>
              <Tag color={gradeTagColor}>{hasGrade ? dailyScore.grade : '未评级'}</Tag>
            </div>
            <Text type="secondary">综合评定</Text>
          </Descriptions.Item>

          <Descriptions.Item label={<span>成绩构成</span>}>
            {(() => {
              // 计算三大类
              const typingData = dailyScore.typing || { score: 0, count: 0 };
              const quizData = dailyScore.quiz || { score: 0, count: 0 };
              const activityData = {
                score: (dailyScore.assignment?.score || 0) +
                  (dailyScore.flowchart?.score || 0) +
                  (dailyScore.python?.score || 0) +
                  (dailyScore.fillblank?.score || 0) +
                  (dailyScore.spreadsheet?.score || 0),
                count: (dailyScore.assignment?.count || 0) +
                  (dailyScore.flowchart?.count || 0) +
                  (dailyScore.python?.count || 0) +
                  (dailyScore.fillblank?.count || 0) +
                  (dailyScore.spreadsheet?.count || 0)
              };

              return (
                <div>
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                        <div style={{ color: '#666', marginBottom: '4px' }}>打字</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(typingData.score) }}>
                          {typingData.score}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{typingData.count} 个活动</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                        <div style={{ color: '#666', marginBottom: '4px' }}>活动</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(activityData.score) }}>
                          {Math.round(activityData.score * 10) / 10}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{activityData.count} 个活动</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ textAlign: 'center', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                        <div style={{ color: '#666', marginBottom: '4px' }}>测验</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(quizData.score) }}>
                          {quizData.score}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{quizData.count} 个活动</div>
                      </div>
                    </Col>
                  </Row>
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <Button type="link" onClick={() => setDetailModalVisible(true)}>查看详情</Button>
                  </div>
                </div>
              );
            })()}
          </Descriptions.Item>

          <Descriptions.Item label={<span>班级比较</span>}>
            {dailyScore.classStats && (
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ color: '#666', fontSize: '12px' }}>班级平均</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {Math.round(dailyScore.classStats.avg * 10) / 10}
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ color: '#666', fontSize: '12px' }}>标准差</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {Math.round(dailyScore.classStats.stdDev * 10) / 10}
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ color: '#666', fontSize: '12px' }}>班级人数</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {dailyScore.classStats.count || 'N/A'}
                  </div>
                </div>
              </div>
            )}
            {!dailyScore.classStats && (
              <Text type="secondary">无班级数据可比较</Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* 打字成绩详情 */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>
            <FileTextOutlined /> 打字成绩
          </Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="打字记录总数"
                  value={dailyScore.typing.details?.totalRecords || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="打字总分"
                  value={dailyScore.typing.score || 0}
                  valueStyle={{ color: '#52c41a' }}
                  suffix="分"
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="平均每次得分"
                  value={dailyScore.typing.count > 0 ? (dailyScore.typing.score / dailyScore.typing.count).toFixed(1) : 0}
                  precision={1}
                  valueStyle={{ color: '#faad14' }}
                  suffix="分"
                />
              </Card>
            </Col>
          </Row>
          <Paragraph style={{ marginTop: '8px' }}>
            <Text type="secondary">
              注: 打字成绩 = 每个活动的最高分之和，单活动得分 = min(10, 实际速度/目标速度*10)
            </Text>
          </Paragraph>
        </div>

        {/* 作业成绩详情 */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={4}>
            <FormOutlined /> 作业成绩
          </Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="有评分作业"
                  value={dailyScore.assignment.count || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="作业总分"
                  value={dailyScore.assignment.score}
                  precision={1}
                  valueStyle={{ color: getScoreColor(dailyScore.assignment.score) }}
                  suffix="分"
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="平均每次得分"
                  value={dailyScore.assignment.count > 0 ? (dailyScore.assignment.score / dailyScore.assignment.count).toFixed(1) : 0}
                  precision={1}
                  valueStyle={{ color: '#faad14' }}
                  suffix="分"
                />
              </Card>
            </Col>
          </Row>
          <Paragraph style={{ marginTop: '8px' }}>
            <Text type="secondary">
              注: 作业成绩计算方式 = 所有作业分数的和（同时存在AI评分和教师评分时，以教师评分为准）
            </Text>
          </Paragraph>
        </div>

        {/* 测验成绩详情 */}
        <div>
          <Title level={4}>
            <FormOutlined /> 测验成绩
          </Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="完成不同测验数"
                  value={dailyScore.quiz.count || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="测验总分"
                  value={dailyScore.quiz.score}
                  precision={1}
                  valueStyle={{ color: getScoreColor(dailyScore.quiz.score) }}
                  suffix="分"
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered={false} size="small">
                <Statistic
                  title="平均每个测验得分"
                  value={dailyScore.quiz.count > 0 ? (dailyScore.quiz.score / dailyScore.quiz.count).toFixed(1) : 0}
                  precision={1}
                  valueStyle={{ color: '#faad14' }}
                  suffix="分"
                />
              </Card>
            </Col>
          </Row>
          <Paragraph style={{ marginTop: '8px' }}>
            <Text type="secondary">
              注: 测验成绩计算方式 = 所有测验的(实际得分/总分*10)的和，同一个测验多次提交只计算最高分
            </Text>
          </Paragraph>
        </div>
      </Card>

      {/* 成绩详情弹窗 */}
      <Modal
        title="成绩详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {dailyScore && (
          <Table
            dataSource={[
              { key: 'typing', category: '打字', type: '打字练习', score: dailyScore.typing?.score || 0, count: dailyScore.typing?.count || 0 },
              { key: 'assignment', category: '活动', type: '作业提交', score: dailyScore.assignment?.score || 0, count: dailyScore.assignment?.count || 0 },
              { key: 'flowchart', category: '活动', type: '流程图', score: dailyScore.flowchart?.score || 0, count: dailyScore.flowchart?.count || 0 },
              { key: 'python', category: '活动', type: 'Python编程', score: dailyScore.python?.score || 0, count: dailyScore.python?.count || 0 },
              { key: 'fillblank', category: '活动', type: '填空题', score: dailyScore.fillblank?.score || 0, count: dailyScore.fillblank?.count || 0 },
              { key: 'spreadsheet', category: '活动', type: '电子表格', score: dailyScore.spreadsheet?.score || 0, count: dailyScore.spreadsheet?.count || 0 },
              { key: 'quiz', category: '测验', type: '课堂测验', score: dailyScore.quiz?.score || 0, count: dailyScore.quiz?.count || 0 },
            ]}
            columns={[
              { title: '类别', dataIndex: 'category', key: 'category', width: 80 },
              { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
              {
                title: '得分', dataIndex: 'score', key: 'score', width: 100,
                render: (score) => <span style={{ fontWeight: 'bold', color: getScoreColor(score) }}>{score}</span>
              },
              { title: '活动数', dataIndex: 'count', key: 'count', width: 80 },
            ]}
            pagination={false}
            size="small"
            summary={() => (
              <Table.Summary.Row style={{ background: '#fafafa' }}>
                <Table.Summary.Cell index={0} colSpan={2}><strong>总计</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <strong style={{ color: getScoreColor(dailyScore.dailyScore) }}>{dailyScore.dailyScore}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  {(dailyScore.typing?.count || 0) +
                    (dailyScore.assignment?.count || 0) +
                    (dailyScore.flowchart?.count || 0) +
                    (dailyScore.python?.count || 0) +
                    (dailyScore.fillblank?.count || 0) +
                    (dailyScore.spreadsheet?.count || 0) +
                    (dailyScore.quiz?.count || 0)}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        )}
        <div style={{ marginTop: '16px', color: '#999', fontSize: '12px' }}>
          <p>说明：</p>
          <ul style={{ paddingLeft: '16px' }}>
            <li>打字：按章节活动统计，每活动最高分计入</li>
            <li>活动：包括作业、流程图、Python、填空、表格</li>
            <li>测验：按章节活动统计，每活动最高分计入</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};

export default StudentDailyScoreComponent; 