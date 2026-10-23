import React, { useState, useEffect } from 'react';
import { Card, List, message, Pagination, Row, Col } from 'antd';
import { getSettings, chatAPI } from '../../services/api';
import MessageItem from '../Chat/MessageItem';
import ReviewStats from './ReviewStats';

const ReviewHistory = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 获取审核设置
  useEffect(() => {
    const fetchReviewSetting = async () => {
      try {
        const response = await getSettings('reviewEnabled');
        setReviewEnabled(response?.value || false);
      } catch (error) {
        console.error('获取审核设置失败:', error);
      }
    };
    fetchReviewSetting();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [pagination.current, pagination.pageSize]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await chatAPI.getMessageHistory({
        status: ['approved', 'rejected'], // 获取已审核的消息
        page: pagination.current,
        limit: pagination.pageSize
      });

      if (response.success && response.data) {
        setMessages(response.data.messages || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.totalCount
        }));
      } else {
        setMessages([]);
        setPagination(prev => ({
          ...prev,
          total: 0
        }));
      }
    } catch (error) {
      console.error('获取审核历史失败:', error);
      message.error('获取审核历史失败');
      setMessages([]);
      setPagination(prev => ({
        ...prev,
        total: 0
      }));
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page, pageSize) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize
    }));
  };

  return (
    <Row gutter={24}>
      <Col span={16}>
        <Card title="审核历史">
          <List
            loading={loading}
            dataSource={messages}
            renderItem={(message) => (
              <List.Item>
                <MessageItem
                  message={message}
                  showActions={false}
                  reviewEnabled={reviewEnabled}
                />
              </List.Item>
            )}
          />
          <div style={{ textAlign: 'right', marginTop: '20px' }}>
            <Pagination
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onChange={handlePageChange}
              showSizeChanger
              showTotal={(total) => `共 ${total} 条记录`}
            />
          </div>
        </Card>
      </Col>
      <Col span={8}>
        <ReviewStats />
      </Col>
    </Row>
  );
};

export default ReviewHistory;