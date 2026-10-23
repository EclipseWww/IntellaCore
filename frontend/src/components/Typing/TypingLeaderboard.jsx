import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Table,
    Tabs,
    Select,
    Space,
    Typography,
    Spin,
    Empty,
    Tag,
    message,
    Statistic,
    Row,
    Col
} from 'antd';
import {
    TrophyOutlined,
    TeamOutlined,
    FileTextOutlined,
    CrownOutlined,
    UserOutlined
} from '@ant-design/icons';
import { typingAPI } from '../../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const TypingLeaderboard = ({ currentTextId = null, onClose }) => {
    const [activeTab, setActiveTab] = useState('school');
    const [timeRange, setTimeRange] = useState('all');
    const [loading, setLoading] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);
    const [currentUserRank, setCurrentUserRank] = useState(null);
    const [texts, setTexts] = useState([]);
    const [selectedTextId, setSelectedTextId] = useState(currentTextId);
    const [textLeaderboard, setTextLeaderboard] = useState([]);
    const [textPreview, setTextPreview] = useState('');

    // 获取全校/班级排行榜
    const fetchLeaderboard = useCallback(async (scope, range) => {
        try {
            setLoading(true);
            const response = await typingAPI.getLeaderboard({ scope, timeRange: range });
            if (response.success) {
                setLeaderboard(response.data || []);
                setCurrentUserRank(response.currentUserRank || null);
            }
        } catch (error) {
            console.error('获取排行榜失败:', error);
            message.error('获取排行榜失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 获取文章列表
    const fetchTexts = useCallback(async () => {
        try {
            const response = await typingAPI.getTexts();
            setTexts(response || []);
        } catch (error) {
            console.error('获取文章列表失败:', error);
        }
    }, []);

    // 获取文章排行榜
    const fetchTextLeaderboard = useCallback(async (textId, range) => {
        if (!textId) return;
        try {
            setLoading(true);
            const response = await typingAPI.getTextLeaderboard(textId, { timeRange: range });
            if (response.success) {
                setTextLeaderboard(response.data || []);
                setTextPreview(response.textPreview || '');
            }
        } catch (error) {
            console.error('获取文章排行榜失败:', error);
            message.error('获取文章排行榜失败');
        } finally {
            setLoading(false);
        }
    }, []);

    // 初始化加载
    useEffect(() => {
        fetchTexts();
        if (activeTab === 'school' || activeTab === 'class') {
            fetchLeaderboard(activeTab, timeRange);
        }
    }, []);

    // 切换 Tab 时加载数据
    useEffect(() => {
        if (activeTab === 'school' || activeTab === 'class') {
            fetchLeaderboard(activeTab, timeRange);
        } else if (activeTab === 'text' && selectedTextId) {
            fetchTextLeaderboard(selectedTextId, timeRange);
        }
    }, [activeTab, timeRange, fetchLeaderboard, fetchTextLeaderboard, selectedTextId]);

    // 排行榜通用列配置
    const baseColumns = [
        {
            title: '排名',
            dataIndex: 'rank',
            key: 'rank',
            width: 70,
            align: 'center',
            render: (rank, record) => {
                if (rank <= 3) {
                    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                    return (
                        <Tag
                            color={colors[rank - 1]}
                            style={{
                                fontWeight: 'bold',
                                minWidth: 32,
                                textAlign: 'center'
                            }}
                        >
                            {rank === 1 && <CrownOutlined style={{ marginRight: 4 }} />}
                            {rank}
                        </Tag>
                    );
                }
                return <Text type="secondary">{rank}</Text>;
            }
        },
        {
            title: '学生',
            dataIndex: 'studentName',
            key: 'studentName',
            render: (name, record) => (
                <Space>
                    {record.isCurrentUser ? (
                        <Tag color="blue" icon={<UserOutlined />}>{name} (我)</Tag>
                    ) : (
                        <Text>{name}</Text>
                    )}
                </Space>
            )
        },
        {
            title: '班级',
            dataIndex: 'gradeClassName',
            key: 'gradeClassName',
            render: (text) => <Text type="secondary">{text}</Text>
        },
        {
            title: '最高速度',
            dataIndex: 'maxSpeed',
            key: 'maxSpeed',
            sorter: (a, b) => a.maxSpeed - b.maxSpeed,
            render: (speed) => (
                <Text strong style={{ color: '#1890ff' }}>
                    {speed} 字/分
                </Text>
            )
        },
        {
            title: '平均准确率',
            dataIndex: 'avgAccuracy',
            key: 'avgAccuracy',
            render: (accuracy) => (
                <Text style={{ color: accuracy >= 90 ? '#52c41a' : '#faad14' }}>
                    {accuracy}%
                </Text>
            )
        },
        {
            title: '练习次数',
            dataIndex: 'practiceCount',
            key: 'practiceCount',
            render: (count) => <Text type="secondary">{count} 次</Text>
        }
    ];

    // 文章排行榜列配置
    const textColumns = [
        ...baseColumns.slice(0, 4),
        {
            title: '最高准确率',
            dataIndex: 'bestAccuracy',
            key: 'bestAccuracy',
            render: (accuracy) => (
                <Text style={{ color: accuracy >= 90 ? '#52c41a' : '#faad14' }}>
                    {accuracy}%
                </Text>
            )
        },
        baseColumns[5] // 练习次数
    ];

    // 渲染当前用户排名卡片
    const renderCurrentUserRank = () => {
        if (!currentUserRank) return null;

        return (
            <Card
                size="small"
                style={{
                    marginBottom: 16,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 8
                }}
            >
                <Row gutter={16} align="middle">
                    <Col>
                        <Statistic
                            title={<Text style={{ color: 'rgba(255,255,255,0.8)' }}>我的排名</Text>}
                            value={currentUserRank.rank}
                            valueStyle={{ color: '#fff', fontSize: 28 }}
                            prefix={<TrophyOutlined />}
                        />
                    </Col>
                    <Col>
                        <Statistic
                            title={<Text style={{ color: 'rgba(255,255,255,0.8)' }}>最高速度</Text>}
                            value={currentUserRank.maxSpeed}
                            suffix="字/分"
                            valueStyle={{ color: '#fff' }}
                        />
                    </Col>
                    <Col>
                        <Statistic
                            title={<Text style={{ color: 'rgba(255,255,255,0.8)' }}>平均准确率</Text>}
                            value={currentUserRank.avgAccuracy}
                            suffix="%"
                            valueStyle={{ color: '#fff' }}
                        />
                    </Col>
                    <Col>
                        <Statistic
                            title={<Text style={{ color: 'rgba(255,255,255,0.8)' }}>练习次数</Text>}
                            value={currentUserRank.practiceCount}
                            suffix="次"
                            valueStyle={{ color: '#fff' }}
                        />
                    </Col>
                </Row>
            </Card>
        );
    };

    // 时间范围选择器
    const timeRangeSelector = (
        <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 100 }}
            size="small"
        >
            <Select.Option value="week">本周</Select.Option>
            <Select.Option value="month">本月</Select.Option>
            <Select.Option value="all">全部</Select.Option>
        </Select>
    );

    return (
        <Card
            title={
                <Space>
                    <TrophyOutlined style={{ color: '#faad14' }} />
                    <span>打字排行榜</span>
                </Space>
            }
            extra={timeRangeSelector}
            style={{ height: '100%' }}
            bodyStyle={{ padding: '12px 16px' }}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                size="small"
            >
                <TabPane
                    tab={<span><TeamOutlined /> 全校排行</span>}
                    key="school"
                >
                    {renderCurrentUserRank()}
                    <Spin spinning={loading}>
                        {leaderboard.length > 0 ? (
                            <Table
                                dataSource={leaderboard}
                                columns={baseColumns}
                                rowKey="studentId"
                                size="small"
                                pagination={{ pageSize: 10, showSizeChanger: false }}
                                scroll={{ x: 600 }}
                                rowClassName={(record) => record.isCurrentUser ? 'highlight-row' : ''}
                            />
                        ) : (
                            <Empty description="暂无排行数据" />
                        )}
                    </Spin>
                </TabPane>

                <TabPane
                    tab={<span><UserOutlined /> 班级排行</span>}
                    key="class"
                >
                    {renderCurrentUserRank()}
                    <Spin spinning={loading}>
                        {leaderboard.length > 0 ? (
                            <Table
                                dataSource={leaderboard}
                                columns={baseColumns}
                                rowKey="studentId"
                                size="small"
                                pagination={{ pageSize: 10, showSizeChanger: false }}
                                scroll={{ x: 600 }}
                                rowClassName={(record) => record.isCurrentUser ? 'highlight-row' : ''}
                            />
                        ) : (
                            <Empty description="暂无排行数据" />
                        )}
                    </Spin>
                </TabPane>

                <TabPane
                    tab={<span><FileTextOutlined /> 文章排行</span>}
                    key="text"
                >
                    <Space style={{ marginBottom: 16 }} wrap>
                        <Text>选择文章：</Text>
                        <Select
                            placeholder="请选择文章"
                            value={selectedTextId}
                            onChange={(value) => {
                                setSelectedTextId(value);
                                fetchTextLeaderboard(value, timeRange);
                            }}
                            style={{ width: 300 }}
                            size="small"
                        >
                            {texts.map((text, index) => (
                                <Select.Option key={text._id} value={text._id}>
                                    文章 {index + 1}: {text.content?.substring(0, 30)}...
                                </Select.Option>
                            ))}
                        </Select>
                    </Space>

                    {textPreview && (
                        <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                            <Text type="secondary">{textPreview}...</Text>
                        </Card>
                    )}

                    <Spin spinning={loading}>
                        {textLeaderboard.length > 0 ? (
                            <Table
                                dataSource={textLeaderboard}
                                columns={textColumns}
                                rowKey="studentId"
                                size="small"
                                pagination={{ pageSize: 10, showSizeChanger: false }}
                                scroll={{ x: 600 }}
                                rowClassName={(record) => record.isCurrentUser ? 'highlight-row' : ''}
                            />
                        ) : (
                            <Empty description={selectedTextId ? "暂无排行数据" : "请先选择文章"} />
                        )}
                    </Spin>
                </TabPane>
            </Tabs>

            <style>{`
        .highlight-row {
          background-color: #e6f7ff !important;
        }
        .highlight-row:hover > td {
          background-color: #bae7ff !important;
        }
      `}</style>
        </Card>
    );
};

export default TypingLeaderboard;
