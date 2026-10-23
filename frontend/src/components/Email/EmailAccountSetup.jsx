import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Space, Alert, message } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, EditOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import emailAPI from '../../services/emailAPI';

const { Title, Text, Paragraph } = Typography;

/**
 * 邮箱账号注册组件
 */
const EmailAccountSetup = ({ onSuccess, domain = 'learnsite.edu' }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const result = await emailAPI.register(values.username, values.password, values.signature || '');
            message.success('邮箱注册成功！');
            if (onSuccess) {
                onSuccess(result.emailAddress);
            }
        } catch (error) {
            console.error('注册失败:', error);
            message.error(error.response?.data?.message || '注册失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            padding: '24px'
        }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: 480,
                    borderRadius: 12,
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
                }}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/student')}
                            style={{ marginBottom: 16 }}
                        >
                            返回
                        </Button>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <MailOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                        <Title level={3} style={{ margin: 0 }}>注册邮箱账号</Title>
                        <Paragraph type="secondary" style={{ marginTop: 8 }}>
                            创建您的个人邮箱，与同学和老师交流
                        </Paragraph>
                    </div>

                    <Alert
                        type="info"
                        showIcon
                        message="邮箱格式"
                        description={
                            <span>您的邮箱地址将是: <Text strong code>用户名@{domain}</Text></span>
                        }
                    />

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                        autoComplete="off"
                    >
                        <Form.Item
                            name="username"
                            label="邮箱用户名"
                            rules={[
                                { required: true, message: '请输入用户名' },
                                { pattern: /^[a-zA-Z][a-zA-Z0-9._-]{2,19}$/, message: '以字母开头，3-20位，可包含字母、数字、点、下划线、连字符' }
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="例如: zhangsan"
                                suffix={<Text type="secondary">@{domain}</Text>}
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            label="邮箱密码"
                            rules={[
                                { required: true, message: '请输入密码' },
                                { min: 6, message: '密码至少6位' }
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="设置邮箱密码"
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            label="确认密码"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: '请确认密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('两次密码不一致'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="再次输入密码"
                                size="large"
                            />
                        </Form.Item>

                        <Form.Item
                            name="signature"
                            label="个人签名（可选）"
                        >
                            <Input.TextArea
                                prefix={<EditOutlined />}
                                placeholder="例如: 此致敬礼！"
                                rows={2}
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                size="large"
                                block
                                icon={<MailOutlined />}
                            >
                                创建邮箱
                            </Button>
                        </Form.Item>
                    </Form>
                </Space>
            </Card>
        </div>
    );
};

export default EmailAccountSetup;
