import React, { useState, useEffect } from 'react';
import { Form, InputNumber, Switch, Select, Button, Card, message, Spin, Typography, Alert } from 'antd';
import { quizAPI } from '../../../services/quizAPI';

const { Title, Text } = Typography;
const { Option } = Select;

const FreePracticeSettings = ({ classId, initialValues, onSave, isBulk = false }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (classId) {
            fetchSettings();
        } else if (initialValues) {
            // Bulk edit mode or manually provided values
            form.setFieldsValue(initialValues);
        }
    }, [classId, initialValues]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await quizAPI.freePractice.getSettings(classId);
            if (res.success) {
                // 处理默认值
                const settings = res.data;
                form.setFieldsValue({
                    isEnabled: settings.isEnabled !== false,
                    timeLimit: settings.timeLimit / 60, // 转换为分钟显示
                    questionCount: settings.questionCount || 10,
                    pointsPerQuestion: settings.pointsPerQuestion || 5,
                    allowedTypes: settings.allowedTypes || ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE'],
                    allowedTags: settings.allowedTags || []
                });
            }
        } catch (error) {
            console.error('获取配置失败:', error);
            message.error('获取配置失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values) => {
        try {
            setSaving(true);
            // 转换数据格式
            const settings = {
                ...values,
                timeLimit: values.timeLimit * 60, // 转换为秒存储
                // 其他字段保持原样
                allowedTags: values.allowedTags || []
            };

            if (onSave) {
                // If custom save handler is provided (e.g. for bulk update)
                await onSave(settings);
            } else {
                // Default behavior: save for single class
                const res = await quizAPI.freePractice.updateSettings(classId, settings);
                if (res.success) {
                    message.success('配置已保存');
                }
            }
        } catch (error) {
            console.error('保存配置失败:', error);
            message.error('保存配置失败');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Spin />;

    return (
        <Card title={isBulk ? "一键配置（所有班级）" : "自由练习配置"} bordered={false}>
            <Alert
                message="说明"
                description={isBulk
                    ? "在此统一设置所有选中班级的自由练习规则。提交后，这些设置将应用到所有选中的班级。"
                    : "在此设置该班级学生进行自由练习时的规则。学生每次练习将随机获取题目，题目范围受限于此处设置。"}
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Form
                form={form}
                layout="vertical"
                onFinish={handleSave}
                initialValues={{
                    isEnabled: true,
                    timeLimit: 5,
                    questionCount: 10,
                    pointsPerQuestion: 5,
                    allowedTypes: ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE']
                }}
            >
                <Form.Item name="isEnabled" label="开启自由练习" valuePropName="checked">
                    <Switch />
                </Form.Item>

                <Form.Item
                    name="questionCount"
                    label="每次练习题目数量"
                    rules={[{ required: true, message: '请输入题目数量' }]}
                >
                    <InputNumber min={5} max={50} />
                </Form.Item>

                <Form.Item
                    name="timeLimit"
                    label="练习限时 (分钟)"
                    rules={[{ required: true, message: '请输入限时' }]}
                >
                    <InputNumber min={1} max={60} />
                </Form.Item>

                <Form.Item
                    name="pointsPerQuestion"
                    label="每题积分奖励"
                    rules={[{ required: true, message: '请输入积分' }]}
                >
                    <InputNumber min={0} max={100} />
                </Form.Item>

                <Form.Item
                    name="allowedTypes"
                    label="允许的题型"
                >
                    <Select mode="multiple">
                        <Option value="SINGLE_CHOICE">单选题</Option>
                        <Option value="MULTIPLE_CHOICE">多选题</Option>
                        <Option value="TRUE_FALSE">判断题</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="allowedTags"
                    label="标签筛选 (选填，空表示不限制)"
                    help="输入标签后按回车确认"
                >
                    <Select mode="tags" placeholder="输入标签限制题目范围，例如：第一章, 网络基础" />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={saving}>
                        {isBulk ? "应用到所有班级" : "保存配置"}
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default FreePracticeSettings;
