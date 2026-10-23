import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Empty, Button } from 'antd';
import { quizAPI } from '../../../services/quizAPI';

import PracticeReview from './PracticeReview';
import { EyeOutlined } from '@ant-design/icons';

const { Text } = Typography;

const PracticeHistory = () => {
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [viewingSessionId, setViewingSessionId] = useState(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    const fetchHistory = async (page = 1) => {
        try {
            setLoading(true);
            const res = await quizAPI.freePractice.getHistory(page);
            if (res.success) {
                setHistory(res.data.list);
                setPagination({
                    current: res.data.pagination.page,
                    pageSize: 10,
                    total: res.data.pagination.total
                });
            }
        } catch (error) {
            console.error('获取练习历史失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory(1);
    }, []);

    const handleTableChange = (pagination) => {
        fetchHistory(pagination.current);
    };

    if (viewingSessionId) {
        return <PracticeReview sessionId={viewingSessionId} onBack={() => setViewingSessionId(null)} />;
    }

    const columns = [
        {
            title: '练习时间',
            dataIndex: 'startTime',
            key: 'startTime',
            render: (text) => new Date(text).toLocaleString()
        },
        {
            title: '答对题数',
            key: 'score',
            render: (_, record) => (
                <span>
                    <Text type="success" strong>{record.correctCount}</Text>
                    <Text type="secondary"> / {record.totalQuestions}</Text>
                </span>
            )
        },
        {
            title: '获得积分',
            dataIndex: 'pointsEarned',
            key: 'pointsEarned',
            render: (points) => <Tag color="gold">+{points} 积分</Tag>
        },
        {
            title: '用时',
            key: 'duration',
            render: (_, record) => {
                if (!record.endTime) return '-';
                const start = new Date(record.startTime);
                const end = new Date(record.endTime);
                const diff = Math.floor((end - start) / 1000); // 秒
                const mins = Math.floor(diff / 60);
                const secs = diff % 60;
                return `${mins}分${secs}秒`;
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => setViewingSessionId(record._id)}
                >
                    查看详情
                </Button>
            )
        }
    ];

    return (
        <Table
            columns={columns}
            dataSource={history}
            rowKey="_id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            locale={{ emptyText: <Empty description="暂无练习记录" /> }}
        />
    );
};

export default PracticeHistory;
