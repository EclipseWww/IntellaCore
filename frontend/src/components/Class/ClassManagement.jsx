import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, message, Space, Popconfirm, InputNumber, Menu, Layout, List, Tag, Radio, Upload, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined, GroupOutlined, HistoryOutlined, UploadOutlined, BarChartOutlined } from '@ant-design/icons';
import { classAPI } from '../../services/api';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;

// 格式化班级显示
const formatClassName = (grade, name) => {
  return `${grade}级${name}班`;
};

const ClassManagement = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [addStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [editStudentModalVisible, setEditStudentModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [addStudentForm] = Form.useForm();
  const [editStudentForm] = Form.useForm();
  const [editingClass, setEditingClass] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loginHistoryVisible, setLoginHistoryVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // 获取班级列表
  const fetchClasses = async () => {
    try {
      setLoading(true);
      const response = await classAPI.getTeacherClasses();
      // 对班级进行排序 - 年级降序（较新的年级在前面），班级号升序
      const sortedClasses = response.data.sort((a, b) => {
        if (a.grade === b.grade) {
          return a.name - b.name; // 按班级号升序
        }
        return b.grade - a.grade; // 按年级降序，较新的年级在前
      });
      setClasses(sortedClasses);
      // 如果有班级且没有选中的班级，默认选中第一个
      if (sortedClasses.length > 0 && !selectedClass) {
        setSelectedClass(sortedClasses[0]._id);
        fetchClassDetails(sortedClasses[0]._id);
      }
    } catch (error) {
      message.error('获取班级列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取班级详情
  const fetchClassDetails = async (classId) => {
    try {
      setLoadingStudents(true);
      const response = await classAPI.getClassDetails(classId);
      setStudents(response.data.students || []);
    } catch (error) {
      message.error('获取班级学生信息失败');
    } finally {
      setLoadingStudents(false);
    }
  };

  // 获取学生登录历史
  const fetchLoginHistory = async (studentId) => {
    try {
      setLoadingHistory(true);
      const response = await classAPI.getStudentLoginHistory(studentId);
      setLoginHistory(response.data || []);
    } catch (error) {
      message.error('获取登录历史失败');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // 处理创建/编辑班级
  const handleSubmit = async (values) => {
    try {
      const { grade, name } = values;
      // 确保输入的是数字
      const classData = {
        grade: parseInt(grade),
        name: parseInt(name)
      };

      if (editingClass) {
        // TODO: 实现编辑班级功能
        message.success('班级更新成功');
      } else {
        await classAPI.createClass(classData);
        message.success('班级创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchClasses();
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 处理删除班级
  const handleDelete = async (classId) => {
    try {
      const selectedClassInfo = classes.find(c => c._id === classId);
      const classDisplayName = selectedClassInfo ?
        formatClassName(selectedClassInfo.grade, selectedClassInfo.name) :
        '选中的班级';

      // 显示确认对话框替代Popconfirm
      let confirmText = '';

      Modal.confirm({
        title: '确认删除班级',
        content: (
          <div>
            <p>删除班级 {formatClassName(selectedClassInfo.grade, selectedClassInfo.name)} 将同时删除该班级的所有学生及其所有数据（包括作业、测验记录、打字记录等），此操作不可恢复。</p>
            <p>请输入"删除"以确认:</p>
            <Input
              onChange={(e) => { confirmText = e.target.value }}
              placeholder="请输入'删除'确认"
            />
          </div>
        ),
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          // 检查用户输入的确认文字
          if (confirmText !== '删除') {
            message.error('请输入"删除"以确认操作');
            return false; // 返回false阻止对话框关闭
          }

          try {
            // 调用删除班级API
            const response = await classAPI.deleteClass(classId);
            message.success(`${formatClassName(selectedClassInfo.grade, selectedClassInfo.name)} 删除成功`);

            // 显示删除的记录数量
            if (response.data) {
              Modal.success({
                title: '班级数据清理完成',
                content: (
                  <div>
                    <p>已成功删除 {response.data.deletedStudentsCount} 名学生的以下数据：</p>
                    <ul>
                      <li>作业提交记录：{response.data.deletedSubmissionsCount} 条</li>
                      <li>测验提交记录：{response.data.deletedQuizSubmissionsCount} 条</li>
                      <li>打字练习记录：{response.data.deletedTypingRecordsCount} 条</li>
                    </ul>
                  </div>
                ),
              });
            }

            // 刷新班级列表
            fetchClasses();

            // 如果当前选中的就是被删除的班级，清空选中状态
            if (selectedClass === classId) {
              setSelectedClass(null);
              setStudents([]);
            }
          } catch (error) {
            message.error(error.response?.data?.message || '删除班级失败');
          }
        }
      });
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 处理批量创建班级
  const handleBatchCreate = async (values) => {
    try {
      const { grade, startNum, endNum } = values;
      const createPromises = [];

      for (let i = startNum; i <= endNum; i++) {
        const classData = {
          grade: parseInt(grade),
          name: i
        };
        createPromises.push(classAPI.createClass(classData));
      }

      await Promise.all(createPromises);
      message.success('批量创建班级成功');
      setBatchModalVisible(false);
      batchForm.resetFields();
      fetchClasses();
    } catch (error) {
      message.error(error.response?.data?.message || '批量创建班级失败');
    }
  };

  // 处理菜单选择
  const handleMenuSelect = ({ key }) => {
    setSelectedClass(key);
    fetchClassDetails(key);
  };

  // 处理查看登录历史
  const handleViewHistory = (student) => {
    setSelectedStudent(student);
    setLoginHistoryVisible(true);
    fetchLoginHistory(student._id);
  };

  // 处理移除学生
  const handleRemoveStudent = async (studentId) => {
    try {
      const response = await classAPI.removeStudentFromClass(selectedClass, studentId);
      message.success('学生移除成功');

      // 显示删除的记录数量
      if (response.deletedData) {
        Modal.success({
          title: '学生数据清理完成',
          content: (
            <div>
              <p>已成功删除以下数据：</p>
              <ul>
                <li>作业提交记录：{response.deletedData.submissions} 条</li>
                <li>测验提交记录：{response.deletedData.quizSubmissions} 条</li>
                <li>打字练习记录：{response.deletedData.typingRecords} 条</li>
              </ul>
            </div>
          ),
        });
      }

      fetchClassDetails(selectedClass);
    } catch (error) {
      message.error('移除学生失败');
    }
  };

  // 处理添加学生
  const handleAddStudent = async (values) => {
    try {
      const { username, name, gender, password } = values;
      await classAPI.addStudentToClass(selectedClass, {
        username,
        name,
        gender,
        password,
        role: 'student'
      });
      message.success('添加学生成功');
      setAddStudentModalVisible(false);
      addStudentForm.resetFields();
      fetchClassDetails(selectedClass);
    } catch (error) {
      message.error(error.response?.data?.message || '添加学生失败');
    }
  };

  // 处理编辑学生
  const handleEditStudent = async (values) => {
    try {
      const { username, name, password, classId } = values;
      await classAPI.updateStudent(editingStudent._id, {
        username,
        name,
        ...(password ? { password } : {}),
        ...(classId && classId !== editingStudent.classId ? { classId } : {})
      });
      message.success('更新学生信息成功');
      setEditStudentModalVisible(false);
      editStudentForm.resetFields();
      fetchClassDetails(selectedClass);
    } catch (error) {
      message.error(error.response?.data?.message || '更新学生信息失败');
    }
  };

  // 打开编辑学生模态框
  const handleEditStudentClick = (student) => {
    setEditingStudent(student);
    editStudentForm.setFieldsValue({
      username: student.username,
      name: student.name,
      classId: student.classId
    });
    setEditStudentModalVisible(true);
  };

  // 处理文件上传
  const handleFileUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await classAPI.importStudents(formData);
      message.success(response.message);
      setImportModalVisible(false);
      setFileList([]);
      // 刷新班级列表和当前班级的学生数据
      await fetchClasses();
      if (selectedClass) {
        await fetchClassDetails(selectedClass);
      }
    } catch (error) {
      message.error(error.response?.data?.message || '导入学生失败');
    }
  };

  // 处理文件列表改变
  const handleFileListChange = ({ fileList }) => {
    // 修改文件状态为 done
    const newFileList = fileList.map(file => ({
      ...file,
      status: 'done'
    }));
    setFileList(newFileList.slice(-1)); // 只保留最后一个文件
  };

  // 处理文件上传前的检查
  const beforeUpload = (file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上传 Excel 文件！');
      return false;
    }
    return true;
  };

  // 学生列表列定义
  const studentColumns = [
    {
      title: '学号',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditStudentClick(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            登录历史
          </Button>
          <Popconfirm
            title="确定要删除该学生吗？"
            description="此操作将永久删除该学生的所有数据（包括作业、测验记录、打字记录等）且不可恢复"
            onConfirm={() => handleRemoveStudent(record._id)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除学生
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 处理批量删除学生
  const handleBatchDeleteStudents = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的学生');
      return;
    }

    try {
      Modal.confirm({
        title: '确认批量删除学生',
        content: `确定要删除选中的 ${selectedRowKeys.length} 名学生吗？此操作将永久删除这些学生的所有数据（包括作业、测验记录、打字记录等）且不可恢复。`,
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            // 调用批量删除学生API
            const response = await classAPI.batchDeleteStudents(selectedClass, selectedRowKeys);
            message.success(`已成功删除 ${selectedRowKeys.length} 名学生`);

            // 显示删除的记录数量
            if (response.data) {
              Modal.success({
                title: '学生数据清理完成',
                content: (
                  <div>
                    <p>已成功删除 {response.data.deletedStudents} 名学生的以下数据：</p>
                    <ul>
                      <li>作业提交记录：{response.data.deletedSubmissions} 条</li>
                      <li>测验提交记录：{response.data.deletedQuizSubmissions} 条</li>
                      <li>打字练习记录：{response.data.deletedTypingRecords} 条</li>
                      <li>相关文件：{response.data.deletedFiles} 个</li>
                    </ul>
                  </div>
                ),
              });
            }

            // 清空选中状态并刷新学生列表
            setSelectedRowKeys([]);
            fetchClassDetails(selectedClass);
          } catch (error) {
            console.error('批量删除失败:', error);
            message.error(error.response?.data?.message || '批量删除学生失败');
          }
        }
      });
    } catch (error) {
      message.error('操作失败');
    }
  };

  return (
    <Layout style={{ background: '#fff' }}>
      <Sider width={250} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Button
              type="primary"
              icon={<GroupOutlined />}
              onClick={() => setBatchModalVisible(true)}
            >
              批量创建
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingClass(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              创建班级
            </Button>
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedClass]}
          onSelect={handleMenuSelect}
          items={classes.map(cls => ({
            key: cls._id,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{formatClassName(cls.grade, cls.name)}</span>
                <Popconfirm
                  title="确定要删除该班级吗？"
                  onConfirm={() => handleRemoveClass(cls._id)}
                  okText="确定删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={(e) => e.stopPropagation()} // 阻止事件冒泡
                    style={{ marginLeft: '5px' }}
                  />
                </Popconfirm>
              </div>
            ),
          }))}
          style={{ height: 'calc(100vh - 120px)', overflowY: 'auto' }}
        />
      </Sider>
      <Content style={{ padding: '24px', minHeight: 280 }}>
        {selectedClass && (
          <Card
            title={`${formatClassName(
              classes.find(c => c._id === selectedClass)?.grade,
              classes.find(c => c._id === selectedClass)?.name
            )} - 学生列表`}
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setImportModalVisible(true)}
                >
                  批量导入
                </Button>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => setAddStudentModalVisible(true)}
                >
                  添加学生
                </Button>
              </Space>
            }
          >
            {selectedRowKeys.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>已选择 {selectedRowKeys.length} 名学生</div>
                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleBatchDeleteStudents}
                >
                  批量删除选中学生
                </Button>
              </div>
            )}
            <Table
              columns={studentColumns}
              dataSource={students}
              rowKey="_id"
              loading={loadingStudents}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
            />
          </Card>
        )}
      </Content>

      {/* 登录历史记录模态框 */}
      <Modal
        title={`${selectedStudent?.name || ''} 的登录历史`}
        open={loginHistoryVisible}
        onCancel={() => {
          setLoginHistoryVisible(false);
          setSelectedStudent(null);
          setLoginHistory([]);
        }}
        footer={null}
        width={600}
      >
        <List
          loading={loadingHistory}
          dataSource={loginHistory}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={moment(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                description={
                  <Space direction="vertical">
                    <div>IP地址：{item.ip}</div>
                    <div>设备信息：{item.userAgent}</div>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无登录记录' }}
        />
      </Modal>

      {/* 单个创建/编辑班级的模态框 */}
      <Modal
        title={editingClass ? '编辑班级' : '创建班级'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="grade"
            label="年级"
            rules={[
              { required: true, message: '请输入年级' },
              { pattern: /^\d+$/, message: '年级必须是数字' }
            ]}
          >
            <InputNumber
              min={2000}
              max={2100}
              style={{ width: '100%' }}
              placeholder="例如：2024"
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="班级号"
            rules={[
              { required: true, message: '请输入班级号' },
              { pattern: /^\d+$/, message: '班级号必须是数字' }
            ]}
          >
            <InputNumber
              min={1}
              max={99}
              style={{ width: '100%' }}
              placeholder="例如：1"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量创建班级的模态框 */}
      <Modal
        title="批量创建班级"
        open={batchModalVisible}
        onCancel={() => {
          setBatchModalVisible(false);
          batchForm.resetFields();
        }}
        onOk={() => batchForm.submit()}
      >
        <Form
          form={batchForm}
          onFinish={handleBatchCreate}
          layout="vertical"
        >
          <Form.Item
            name="grade"
            label="年级"
            rules={[
              { required: true, message: '请输入年级' },
              { pattern: /^\d+$/, message: '年级必须是数字' }
            ]}
          >
            <InputNumber
              min={2000}
              max={2100}
              style={{ width: '100%' }}
              placeholder="例如：2024"
            />
          </Form.Item>
          <Form.Item
            name="startNum"
            label="起始班号"
            rules={[{ required: true, message: '请输入起始班号' }]}
          >
            <InputNumber min={1} max={99} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="endNum"
            label="结束班号"
            rules={[
              { required: true, message: '请输入结束班号' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('startNum') <= value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('结束班号必须大于或等于起始班号'));
                },
              }),
            ]}
          >
            <InputNumber min={1} max={99} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加学生的模态框 */}
      <Modal
        title="添加学生"
        open={addStudentModalVisible}
        onCancel={() => {
          setAddStudentModalVisible(false);
          addStudentForm.resetFields();
        }}
        onOk={() => addStudentForm.submit()}
      >
        <Form
          form={addStudentForm}
          onFinish={handleAddStudent}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="学号"
            rules={[
              { required: true, message: '请输入学号' },
              { pattern: /^\d+$/, message: '学号必须是数字' }
            ]}
          >
            <Input placeholder="请输入学号" />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
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
              { min: 6, message: '密码长度至少6位' }
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入学生的模态框 */}
      <Modal
        title="批量导入学生"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setFileList([]);
        }}
        onOk={() => {
          if (fileList[0]) {
            handleFileUpload(fileList[0].originFileObj);
          }
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <p>请下载模板文件，按照模板格式填写学生信息后上传：</p>
          <Button
            type="link"
            onClick={() => classAPI.downloadTemplate()}
          >
            下载模板
          </Button>
        </div>
        <Upload
          beforeUpload={beforeUpload}
          onChange={handleFileListChange}
          fileList={fileList}
          maxCount={1}
          customRequest={({ file, onSuccess }) => {
            // 立即将文件状态标记为成功
            onSuccess();
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <div style={{ marginTop: 16 }}>
          <p>注意事项：</p>
          <ul>
            <li>仅支持 Excel 文件格式（.xlsx, .xls）</li>
            <li>请严格按照模板格式填写</li>
            <li>学号必须是唯一的</li>
            <li>密码长度至少6位</li>
            <li>年级和班级必须是整数</li>
            <li>如果班级不存在会自动创建</li>
          </ul>
        </div>
      </Modal>

      {/* 编辑学生的模态框 */}
      <Modal
        title="编辑学生信息"
        open={editStudentModalVisible}
        onCancel={() => {
          setEditStudentModalVisible(false);
          setEditingStudent(null);
          editStudentForm.resetFields();
        }}
        onOk={() => editStudentForm.submit()}
      >
        <Form
          form={editStudentForm}
          onFinish={handleEditStudent}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="学号"
            rules={[
              { required: true, message: '请输入学号' },
              { pattern: /^\d+$/, message: '学号必须是数字' }
            ]}
          >
            <Input placeholder="请输入学号" />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="classId"
            label="班级"
          >
            <Select placeholder="请选择班级">
              {classes.map(cls => (
                <Select.Option key={cls._id} value={cls._id}>
                  {formatClassName(cls.grade, cls.name)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { min: 6, message: '密码长度至少6位' }
            ]}
            extra="如不修改密码请留空"
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout >
  );
};

export default ClassManagement;