import React, { useState } from 'react';
import { Card, Tabs, Typography, Row, Col } from 'antd';
import { FormOutlined, UnorderedListOutlined, HistoryOutlined } from '@ant-design/icons';
import FreePractice from './FreePractice';
import PendingQuizzes from './PendingQuizzes';
import PracticeHistory from './PracticeHistory';

const { Paragraph } = Typography;

const QuizPracticeModule = () => {
    const [activeTab, setActiveTab] = useState('free-practice');

    const items = [
        {
            key: 'free-practice',
            label: (
                <span>
                    <FormOutlined />
                    自由练习
                </span>
            ),
            children: (
                <div>

                    <FreePractice />
                </div>
            ),
        },
        {
            key: 'practice-history',
            label: (
                <span>
                    <HistoryOutlined />
                    练习记录
                </span>
            ),
            children: (
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 0' }}>
                    <PracticeHistory />
                </div>
            )
        },
        {
            key: 'pending-quizzes',
            label: (
                <span>
                    <UnorderedListOutlined />
                    未完成测验
                </span>
            ),
            children: (
                <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 0' }}>
                    <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                        这里列出了你在课程中尚未完成的测验任务。
                    </Paragraph>
                    <PendingQuizzes />
                </div>
            ),
        },
    ];

    return (
        <div style={{ padding: '0 24px 24px' }}>

            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                    minHeight: 600
                }}
                bodyStyle={{ padding: '0 24px 24px' }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={items}
                    size="large"
                    centered
                    animated
                />
            </Card>
        </div>
    );
};

export default QuizPracticeModule;
