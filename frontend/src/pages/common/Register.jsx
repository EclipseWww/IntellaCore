import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Radio, message, Select } from 'antd';
import { UserOutlined, LockOutlined, UserAddOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api, { classAPI } from '../../services/api';

const { Option } = Select;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('student');
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // 获取班级列表
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);
        const response = await classAPI.getAvailableClasses();
        // 按年级对班级进行分组
        const groupedClasses = response.data.reduce((acc, cls) => {
          if (!acc[cls.grade]) {
            acc[cls.grade] = [];
          }
          acc[cls.grade].push(cls);
          return acc;
        }, {});
        setClasses(groupedClasses);
      } catch (error) {
        console.error('获取班级列表失败:', error);
        message.error('获取班级列表失败');
      } finally {
        setLoadingClasses(false);
      }
    };

    if (role === 'student') {
      fetchClasses();
    }
  }, [role]);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/register', values);
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      message.success('注册成功');
      
      if (response.data.user.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 当角色改变时重置表单相关字段
  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    setRole(newRole);
    form.setFieldsValue({
      username: '',
      classId: undefined
    });
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto' }}>
      <Card title="注册新账号" bordered={false}>
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="role"
            label="账号类型"
            rules={[{ required: true, message: '请选择账号类型' }]}
            initialValue="student"
          >
            <Radio.Group onChange={handleRoleChange}>
              <Radio value="student">学生</Radio>
              <Radio value="teacher" >教师</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="name"
            label="姓名"
            rules={[
              { required: true, message: '请输入姓名' },
              { max: 20, message: '姓名最多20个字符' }
            ]}
          >
            <Input 
              prefix={<UserAddOutlined />} 
              placeholder="请输入姓名" 
            />
          </Form.Item>

          <Form.Item
            name="username"
            label={role === 'student' ? '学号' : '工号'}
            rules={[
              { required: true, message: `请输入${role === 'student' ? '学号' : '工号'}` }
             
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder={`请输入${role === 'student' ? '学号' : '工号'}`}
            />
          </Form.Item>

          {role === 'student' && (
            <Form.Item
              name="classId"
              label="班级"
              rules={[{ required: true, message: '请选择班级' }]}
            >
              <Select
                loading={loadingClasses}
                placeholder="请选择班级"
                showSearch
                optionFilterProp="children"
              >
                {Object.entries(classes).map(([grade, gradeClasses]) => (
                  <Select.OptGroup key={grade} label={grade}>
                    {gradeClasses.map(cls => (
                      <Option key={cls._id} value={cls._id}>
                        {cls.name}
                      </Option>
                    ))}
                  </Select.OptGroup>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="gender"
            label="性别"
            rules={[{ required: true, message: '请选择性别' }]}
          >
            <Radio.Group>
              <Radio value="male">男</Radio>
              <Radio value="female">女</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请输入密码" 
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
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请再次输入密码" 
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            已有账号？ <Link to="/login">立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register; 