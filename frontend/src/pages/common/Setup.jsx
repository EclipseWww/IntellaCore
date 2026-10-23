import React, { useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, Result, Spin, Typography } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import api from '../../services/api';
import useInitializationStatus, { rememberInitialized } from '../../hooks/useInitializationStatus';

const { Title, Paragraph, Text } = Typography;
const frame = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', background: '#f0f4fa' };

export default function Setup() {
  const { loading, status, error: connectionError, retry } = useInitializationStatus({ force: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdUsername, setCreatedUsername] = useState('');
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const submit = async values => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/auth/initialization', values, { headers: { 'X-Setup-Request': '1' } });
      // Old synthetic administrator credentials must not be reused after setup.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      form.resetFields();
      rememberInitialized();
      setCreatedUsername(data.username);
    } catch (failure) {
      setError(failure.response?.data?.message || '暂时无法完成设置，请检查网络后重试。');
      if (failure.response?.status === 409 || failure.response?.status === 503) retry();
    } finally { setSubmitting(false); }
  };

  if (createdUsername) return <div style={frame}><Card style={{ width: '100%', maxWidth: 520, borderRadius: 16 }}>
    <Result status="success" title="设置完成" subTitle={`管理员账号：${createdUsername}。现在可以登录，创建教师账号并导入学生。`}
      extra={<Button type="primary" size="large" onClick={() => navigate('/login', { replace: true })}>进入登录页面</Button>} />
  </Card></div>;
  if (!loading && status?.initialized) return <Navigate to="/login" replace />;

  return <div style={frame}><Card style={{ width: '100%', maxWidth: 520, borderRadius: 16 }}>
    <SafetyCertificateOutlined style={{ fontSize: 36, color: '#4158d0' }} />
    <Title level={2} style={{ marginTop: 16 }}>欢迎使用 AI 辅助教育平台</Title>
    <Paragraph type="secondary">首次使用，请设置管理员账号。完成后，你可以在后台创建教师账号，由教师或管理员批量导入学生。</Paragraph>
    {loading ? <Spin tip="正在检查系统状态…"><div style={{ height: 120 }} /></Spin> : connectionError ?
      <Alert type="error" showIcon message="连接失败" description={connectionError} action={<Button onClick={retry}>重试</Button>} /> : <>
      {status?.requiresTeacherVerification && <Alert type="info" showIcon style={{ marginBottom: 20 }} message="检测到已有教师账号"
        description="请先验证一个现有教师账号，再设置管理员。已有课程、班级和学生数据会保留。" />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 20 }} />}
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ name: '系统管理员' }} disabled={submitting} requiredMark={false}>
        {status?.requiresTeacherVerification && <>
          <Form.Item name="teacherUsername" label="现有教师账号" rules={[{ required: true, whitespace: true, message: '请输入现有教师账号' }]}>
            <Input autoComplete="off" maxLength={64} />
          </Form.Item>
          <Form.Item name="teacherPassword" label="教师密码" rules={[{ required: true, message: '请输入教师密码' }]}>
            <Input.Password autoComplete="off" />
          </Form.Item>
          <Divider>设置管理员</Divider>
        </>}
        <Form.Item name="username" label="管理员账号" rules={[{ required: true, whitespace: true, message: '请设置管理员账号' }, { max: 64, message: '账号不能超过64个字符' }]}>
          <Input autoComplete="username" placeholder="例如：admin" maxLength={64} />
        </Form.Item>
        <Form.Item name="name" label="管理员姓名" rules={[{ required: true, whitespace: true, message: '请输入管理员姓名' }, { max: 64, message: '姓名不能超过64个字符' }]}>
          <Input maxLength={64} autoComplete="name" />
        </Form.Item>
        <Form.Item name="password" label="管理员密码" extra="至少6个字符，建议组合使用字母、数字和符号。" rules={[
          { required: true, message: '请设置管理员密码' }, { min: 6, message: '密码至少需要6个字符' },
          { validator: (_, value) => !value || new Blob([value]).size <= 72 ? Promise.resolve() : Promise.reject(new Error('密码不能超过72字节')) }
        ]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="confirmPassword" label="确认密码" dependencies={['password']} rules={[
          { required: true, message: '请再次输入密码' },
          ({ getFieldValue }) => ({ validator: (_, value) => !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致')) })
        ]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={submitting}>完成设置</Button>
      </Form>
      <Paragraph style={{ marginTop: 16, marginBottom: 0 }}><Text type="secondary">此页面仅用于首次设置，完成后将自动关闭。请妥善保存管理员账号和密码。</Text></Paragraph>
    </>}
  </Card></div>;
}
