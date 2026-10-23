import React, { useState, useEffect, useCallback } from 'react';
import {
    Card, Table, Select, Space, Typography, Tag, Tabs, DatePicker,
    Spin, Empty, Segmented, Row, Col, Statistic
} from 'antd';
import {
    TrophyOutlined,
    HistoryOutlined,
    UserOutlined,
    FireOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { quizAPI } from '../../../services/quizAPI';
import { classAPI } from '../../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const FreePracticeRecords = () => {
    const [activeTab, setActiveTab] = useState('records');
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState([]);
    const [classesLoading, setClassesLoading] = useState(false);

    // 筛选条件
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [dateRange, setDateRange] = useState(null);
    const [timeRange, setTimeRange] = useState('all');

    // 数据
    const [records, setRecords] = useState([]);
    const [recordsPagination, setRecordsPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [leaderboard, setLeaderboard] = useState([]);

    // 获取班级列表
    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            setClassesLoading(true);
            const response = await classAPI.getTeacherClasses();
            if (response.success) {
                const sorted = (response.data || []).sort((a, b) => {
                    if (a.grade !== b.grade) return a.grade - b.grade;
                    return a.name - b.name;
                });
                setClasses(sorted);
            }
        } catch (error) {
            console.error('获取班级列表失败:', error);
        } finally {
            setClassesLoading(false);
        }
    };

    // 获取练习记录
    const fetchRecords = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = {
                page,
                limit: recordsPagination.pageSize,
            };
            if (selectedClass) params.classId = selectedClass;
            else if (selectedGrade) params.grade = selectedGrade;
            if (dateRange && dateRange[0] && dateRange[1]) {
                params.startDate = dateRange[0].format('YYYY-MM-DD');
                params.endDate = dateRange[1].format('YYYY-MM-DD');
            }

            const response = await quizAPI.freePractice.getStudentRecords(params);
            if (response.success) {
                setRecords(response.data.list || []);
                setRecordsPagination(prev => ({
                    ...prev,
                    current: response.data.page,
                    total: response.data.total
                }));
            }
        } catch (error) {
            console.error('获取记录失败:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedClass, selectedGrade, dateRange, recordsPagination.pageSize]);

    // 获取排行榜
    const fetchLeaderboard = useCallback(async () => {
        try {
            setLoading(true);
            const params = { timeRange };
            if (selectedClass) params.classId = selectedClass;
            else if (selectedGrade) params.grade = selectedGrade;

            const response = await quizAPI.freePractice.getLeaderboard(params);
            if (response.success) {
                setLeaderboard(response.data || []);
            }
        } catch (error) {
            console.error('获取排行榜失败:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedClass, selectedGrade, timeRange]);

    // 切换标签或筛选条件变化时刷新数据
    useEffect(() => {
        if (activeTab === 'records') {
            fetchRecords(1);
        } else {
            fetchLeaderboard();
        }
    }, [activeTab, selectedClass, selectedGrade, dateRange, timeRange]);

    // 获取可用年级
    const grades = [...new Set(classes.map(c => c.grade))].sort((a, b) => a - b);

    // 根据年级筛选班级
    const filteredClasses = selectedGrade
        ? classes.filter(c => c.grade === selectedGrade)
        : classes;

    // 练习记录表格列
    const recordsColumns = [
        {
            title: '学生',
            dataIndex: 'studentName',
            key: 'studentName',
            render: (text) => (
                <Space>
                    <UserOutlined />
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: '班级',
            dataIndex: 'className',
            key: 'className',
            render: (text) => <Tag color="blue">{text}</Tag>
        },
        {
            title: '正确率',
            key: 'accuracy',
            render: (_, record) => {
                const accuracy = record.accuracy || 0;
                const color = accuracy >= 80 ? 'green' : accuracy >= 60 ? 'orange' : 'red';
                return <Tag color={color}>{accuracy}%</Tag>;
            }
        },
        {
            title: '得分',
            key: 'score',
            render: (_, record) => (
                <Text>{record.correctCount}/{record.totalQuestions}</Text>
            )
        },
        {
            title: '获得积分',
            dataIndex: 'pointsEarned',
            key: 'pointsEarned',
            render: (points) => <Text type="warning" strong>+{points}</Text>
        },
        {
            title: '完成时间',
            dataIndex: 'endTime',
            key: 'endTime',
            render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
        }
    ];

    // 排行榜表格列
    const leaderboardColumns = [
        {
            title: '排名',
            dataIndex: 'rank',
            key: 'rank',
            width: 80,
            render: (rank) => {
                if (rank === 1) return <Tag color="gold" icon={<TrophyOutlined />}>🥇 第1名</Tag>;
                if (rank === 2) return <Tag color="silver">🥈 第2名</Tag>;
                if (rank === 3) return <Tag color="#cd7f32">🥉 第3名</Tag>;
                return <Text type="secondary">第{rank}名</Text>;
            }
        },
        {
            title: '学生',
            dataIndex: 'studentName',
            key: 'studentName',
            render: (text) => (
                <Space>
                    <UserOutlined />
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: '班级',
            dataIndex: 'className',
            key: 'className',
            render: (text) => <Tag color="blue">{text}</Tag>
        },
        {
            title: '练习次数',
            dataIndex: 'practiceCount',
            key: 'practiceCount',
            render: (count) => (
                <Space>
                    <FireOutlined style={{ color: '#fa8c16' }} />
                    <Text>{count}次</Text>
                </Space>
            )
        },
        {
            title: '总积分',
            dataIndex: 'totalPoints',
            key: 'totalPoints',
            sorter: (a, b) => a.totalPoints - b.totalPoints,
            defaultSortOrder: 'descend',
            render: (points) => <Text type="warning" strong>{points}</Text>
        },
        {
            title: '平均正确率',
            dataIndex: 'accuracy',
            key: 'accuracy',
            render: (accuracy) => {
                const color = accuracy >= 80 ? 'green' : accuracy >= 60 ? 'orange' : 'red';
                return <Tag color={color} icon={<CheckCircleOutlined />}>{accuracy}%</Tag>;
            }
        }
    ];

    // 筛选器组件
    const renderFilters = () => (
        <Space wrap style={{ marginBottom: 16 }}>
            <Select
                placeholder="选择年级"
                allowClear
                style={{ width: 120 }}
                value={selectedGrade}
                onChange={(val) => {
                    setSelectedGrade(val);
                    setSelectedClass(null); // 重置班级选择
                }}
                loading={classesLoading}
            >
                {grades.map(g => (
                    <Select.Option key={g} value={g}>{g}年级</Select.Option>
                ))}
            </Select>
            <Select
                placeholder="选择班级"
                allowClear
                style={{ width: 150 }}
                value={selectedClass}
                onChange={setSelectedClass}
                loading={classesLoading}
            >
                {filteredClasses.map(c => (
                    <Select.Option key={c._id} value={c._id}>
                        {c.grade}年级{c.name}班
                    </Select.Option>
                ))}
            </Select>
            {activeTab === 'records' && (
                <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    placeholder={['开始日期', '结束日期']}
                />
            )}
            {activeTab === 'leaderboard' && (
                <Segmented
                    value={timeRange}
                    onChange={setTimeRange}
                    options={[
                        { label: '全部', value: 'all' },
                        { label: '本周', value: 'week' },
                        { label: '本月', value: 'month' }
                    ]}
                />
            )}
        </Space>
    );

    // 统计信息
    const renderStats = () => {
        if (activeTab !== 'leaderboard' || leaderboard.length === 0) return null;

        const totalPoints = leaderboard.reduce((sum, s) => sum + s.totalPoints, 0);
        const totalPractice = leaderboard.reduce((sum, s) => sum + s.practiceCount, 0);
        const avgAccuracy = leaderboard.length > 0
            ? Math.round(leaderboard.reduce((sum, s) => sum + s.accuracy, 0) / leaderboard.length)
            : 0;

        return (
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                    <Card size="small">
                        <Statistic
                            title="参与学生"
                            value={leaderboard.length}
                            suffix="人"
                            prefix={<UserOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Statistic
                            title="总练习次数"
                            value={totalPractice}
                            suffix="次"
                            prefix={<FireOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small">
                        <Statistic
                            title="平均正确率"
                            value={avgAccuracy}
                            suffix="%"
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>
        );
    };

    const tabItems = [
        {
            key: 'records',
            label: (
                <span>
                    <HistoryOutlined />
                    练习记录
                </span>
            ),
            children: (
                <Spin spinning={loading}>
                    {renderFilters()}
                    <Table
                        dataSource={records}
                        columns={recordsColumns}
                        rowKey="_id"
                        pagination={{
                            ...recordsPagination,
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 条记录`,
                            onChange: (page, pageSize) => {
                                setRecordsPagination(prev => ({ ...prev, pageSize }));
                                fetchRecords(page);
                            }
                        }}
                        locale={{ emptyText: <Empty description="暂无练习记录" /> }}
                    />
                </Spin>
            )
        },
        {
            key: 'leaderboard',
            label: (
                <span>
                    <TrophyOutlined />
                    排行榜
                </span>
            ),
            children: (
                <Spin spinning={loading}>
                    {renderFilters()}
                    {renderStats()}
                    <Table
                        dataSource={leaderboard}
                        columns={leaderboardColumns}
                        rowKey="studentId"
                        pagination={false}
                        locale={{ emptyText: <Empty description="暂无排行数据" /> }}
                    />
                </Spin>
            )
        }
    ];

    return (
        <Card
            title={
                <Space>
                    <FireOutlined style={{ color: '#fa8c16' }} />
                    <Title level={4} style={{ margin: 0 }}>自由练习记录</Title>
                </Space>
            }
            style={{ borderRadius: 8 }}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
            />
        </Card>
    );
};

export default FreePracticeRecords;
