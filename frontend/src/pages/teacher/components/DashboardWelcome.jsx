import React from 'react';
import { Result, Typography, Card } from 'antd';
import { SmileOutlined, AppstoreOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const DashboardWelcome = () => {
    return (
        <div style={{
            height: '100%',
            minHeight: '600px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            borderRadius: '8px',
            padding: '40px'
        }}>
            <Result
                icon={<AppstoreOutlined style={{ color: '#1890ff', fontSize: '72px' }} />}
                title={
                    <Title level={2} style={{ marginBottom: '16px' }}>
                        欢迎来到教师工作台
                    </Title>
                }
                subTitle={
                    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                        <Text type="secondary" style={{ fontSize: '16px', display: 'block', marginBottom: '8px' }}>
                            请在左侧菜单栏选择相应的功能模块进行操作
                        </Text>
                        <Text type="secondary">
                            这里提供了课程管理、作业批阅、题目分析等全方位的教学辅助工具
                        </Text>
                    </div>
                }
            />
        </div>
    );
};

export default DashboardWelcome;
