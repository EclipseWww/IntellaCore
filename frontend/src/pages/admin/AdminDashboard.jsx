import React, { useState, useEffect, useRef } from 'react';
import { Layout, Card, Row, Col, Statistic, Table, Button, message, Modal, Form, Input, Select, Popconfirm, Space, Tabs, Checkbox, Alert, DatePicker, Steps, Result, Spin, Typography, Tooltip, Tag, Upload, Divider } from 'antd';
import { UserOutlined, TeamOutlined, BookOutlined, SafetyCertificateOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, PlusOutlined, KeyOutlined, CloudDownloadOutlined, CloudUploadOutlined, DatabaseOutlined, ExclamationCircleOutlined, FileOutlined, HddOutlined, FolderOutlined, UploadOutlined, DownloadOutlined, CodeOutlined, PlayCircleOutlined, InboxOutlined, RollbackOutlined } from '@ant-design/icons';
import usePageTitle from '../../hooks/usePageTitle';
import api, { backupAPI, assignmentFilesAPI, courseManagementAPI, classAPI, getSystemStats, getSettings, updateSetting } from '../../services/api';
import { archiveGrade as archiveGradeAPI, restoreClass as restoreClassAPI, getArchivedClasses, deleteArchivedClassFiles } from '../../services/classService';
import moment from 'moment';

const { Header, Content } = Layout;
const { Option } = Select;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Step } = Steps;
const { Text } = Typography;

const AdminDashboard = () => {
  const [logoutPassword, setLogoutPassword] = useState('');
  usePageTitle('管理员控制台');

  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState({});
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 筛选相关状态
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [availableClassesForFilter, setAvailableClassesForFilter] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    role: 'all',
    search: ''
  });

  // 模态框状态
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  const [resetPasswordForm] = Form.useForm();

  // 备份相关状态
  const [backupLoading, setBackupLoading] = useState(false);
  const [includeAssignments, setIncludeAssignments] = useState(true);
  const fileInputRef = useRef(null);

  // 备份列表相关状态
  const [backupList, setBackupList] = useState([]);
  const [backupListLoading, setBackupListLoading] = useState(false);

  // 教师班级分配相关状态
  const [teacherAssignModalVisible, setTeacherAssignModalVisible] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [assignmentForm] = Form.useForm();

  // 新建班级相关状态
  const [createClassModalVisible, setCreateClassModalVisible] = useState(false);
  const [createClassForm] = Form.useForm();

  // 批量分配相关状态
  const [batchAssignModalVisible, setBatchAssignModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [teacherOwnedClasses, setTeacherOwnedClasses] = useState([]);
  const [batchAssignForm] = Form.useForm();

  // 批量导入学生相关状态
  const [importStudentModalVisible, setImportStudentModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);

  // 文件清理相关状态
  const [cleanupModalVisible, setCleanupModalVisible] = useState(false);
  const [cleanupForm] = Form.useForm();
  const [cleanupStep, setCleanupStep] = useState(1);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [validatedFormValues, setValidatedFormValues] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [systemStatsLoading, setSystemStatsLoading] = useState(false);

  // AI 配置状态
  const [aiLoading, setAiLoading] = useState(false);
  const [aiForm] = Form.useForm();

  // 脚本运行相关状态
  const [scripts, setScripts] = useState([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptOutput, setScriptOutput] = useState('');

  // 归档管理相关状态
  const [archivedClasses, setArchivedClasses] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archiveForm] = Form.useForm();
  const [archiving, setArchiving] = useState(false);

  // 获取可用脚本列表
  const fetchScripts = async () => {
    try {
      setScriptsLoading(true);
      const response = await api.get('/admin/scripts');
      setScripts(response.data.data || []);
    } catch (error) {
      console.error('获取脚本列表失败:', error);
      message.error('获取脚本列表失败');
    } finally {
      setScriptsLoading(false);
    }
  };

  // 运行脚本
  const handleRunScript = async () => {
    if (!selectedScript) {
      message.warning('请先选择一个脚本');
      return;
    }

    const script = scripts.find(s => s.id === selectedScript);
    if (!script) return;

    if (script.dangerous) {
      Modal.confirm({
        title: '危险操作确认',
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <Alert
              message="警告"
              description={`您即将运行的脚本「${script.name}」可能会修改数据库数据，请确保在运行前已备份数据！`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <p><strong>脚本描述:</strong> {script.description}</p>
          </div>
        ),
        okText: '确认运行',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => executeScript(script.id, true)
      });
    } else {
      executeScript(script.id, false);
    }
  };

  const executeScript = async (scriptId, confirmed) => {
    try {
      setScriptRunning(true);
      setScriptOutput('正在运行脚本...');

      const response = await api.post('/admin/scripts/run', {
        scriptId,
        confirmed
      });

      if (response.data.success) {
        setScriptOutput(response.data.data.output || '脚本运行完成（无输出）');
        message.success('脚本运行成功');
      } else {
        setScriptOutput(`错误: ${response.data.data?.errors || response.data.message}`);
        message.error('脚本运行失败');
      }
    } catch (error) {
      console.error('运行脚本失败:', error);
      setScriptOutput(`运行失败: ${error.response?.data?.message || error.message}`);
      message.error('运行脚本失败');
    } finally {
      setScriptRunning(false);
    }
  };

  const fetchAISettings = async () => {
    try {
      setAiLoading(true);
      const [baseUrl, apiKey, model] = await Promise.all([
        getSettings('ai.baseUrl').catch(() => null),
        getSettings('ai.apiKey').catch(() => null),
        getSettings('ai.model').catch(() => null)
      ]);
      aiForm.setFieldsValue({
        aiBaseUrl: baseUrl?.value || '',
        aiApiKey: apiKey?.value || '',
        aiModel: model?.value || ''
      });
    } catch (e) {
      console.error(e);
      message.error('获取AI设置失败');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAISettings = async (values) => {
    try {
      setAiLoading(true);
      await Promise.all([
        updateSetting('ai.baseUrl', values.aiBaseUrl),
        updateSetting('ai.apiKey', values.aiApiKey),
        updateSetting('ai.model', values.aiModel)
      ]);
      message.success('AI 设置已保存');
    } catch (e) {
      console.error(e);
      message.error('保存AI设置失败');
    } finally {
      setAiLoading(false);
    }
  };

  // 初次加载自动拉取一次（避免首次进入为空）
  useEffect(() => {
    fetchAISettings();
  }, []);

  // 获取系统概览
  const fetchOverview = async () => {
    try {
      const response = await api.get('/admin/overview');
      setOverview(response.data);
    } catch (error) {
      message.error('获取系统概览失败');
    }
  };

  // 获取用户列表
  const fetchUsers = async (page = 1, pageSize = 10, role = 'all', search = '') => {
    try {
      setUsersLoading(true);
      const params = {
        page,
        limit: pageSize,
        role: role !== 'all' ? role : undefined,
        search: search || undefined
      };

      const response = await api.get('/admin/users', { params });
      const allUsers = response.data.users;

      // 分离学生和教师
      const studentsData = allUsers.filter(user => user.role === 'student');
      const teachersData = allUsers.filter(user => user.role === 'teacher');

      setUsers(allUsers);
      setStudents(studentsData);
      setTeachers(teachersData);

      setPagination({
        current: response.data.page,
        pageSize: pageSize,
        total: response.data.total
      });

    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setUsersLoading(false);
    }
  };

  // 获取所有学生数据（用于年级筛选选项）
  const fetchAllStudentsForGrades = async () => {
    try {
      const response = await api.get('/admin/users', {
        params: {
          role: 'student',
          limit: 10000 // 获取所有学生
        }
      });

      const allStudents = response.data.users;

      // 提取可用的年级列表
      const grades = [...new Set(allStudents
        .filter(student => student.classId && student.classId.grade)
        .map(student => student.classId.grade)
      )].sort((a, b) => b - a); // 降序排列

      setAvailableGrades(grades);

    } catch (error) {
      console.error('获取年级选项失败:', error);
    }
  };

  // 获取学生数据（带筛选和分页）
  const fetchStudents = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true);

      // 如果有筛选条件，获取所有学生然后前端分页
      if (selectedGrade || selectedClass) {
        const params = {
          role: 'student',
          limit: 10000 // 获取所有学生
        };

        // 添加搜索条件
        if (filters.search) {
          params.search = filters.search;
        }

        const response = await api.get('/admin/users', { params });
        let allStudents = response.data.users;

        // 应用筛选
        if (selectedGrade) {
          allStudents = allStudents.filter(student =>
            student.classId && student.classId.grade === selectedGrade
          );
        }

        if (selectedClass) {
          allStudents = allStudents.filter(student =>
            student.classId && student.classId._id === selectedClass
          );
        }

        // 前端分页
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedStudents = allStudents.slice(startIndex, endIndex);

        setStudents(paginatedStudents);
        setPagination({
          current: page,
          pageSize: pageSize,
          total: allStudents.length
        });

      } else {
        // 没有筛选条件，使用后端分页
        const params = {
          page,
          limit: pageSize,
          role: 'student'
        };

        // 添加搜索条件
        if (filters.search) {
          params.search = filters.search;
        }

        const response = await api.get('/admin/users', { params });
        setStudents(response.data.users);
        setPagination({
          current: response.data.page,
          pageSize: pageSize,
          total: response.data.total
        });
      }

    } catch (error) {
      message.error('获取学生列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取班级列表
  const fetchClasses = async () => {
    try {
      const response = await api.get('/admin/classes');
      setClasses(response.data);
      setAvailableClassesForFilter(response.data);
    } catch (error) {
      message.error('获取班级列表失败');
    }
  };

  // 处理年级筛选变化
  const handleGradeChange = (grade) => {
    setSelectedGrade(grade);
    setSelectedClass(null); // 清空班级选择

    if (grade) {
      // 筛选出该年级的班级
      const classesForGrade = classes.filter(cls => cls.grade === grade);
      setAvailableClassesForFilter(classesForGrade);
    } else {
      // 显示所有班级
      setAvailableClassesForFilter(classes);
    }

    // 重新获取学生数据
    fetchStudents(1, pagination.pageSize);
  };

  // 处理班级筛选变化
  const handleClassChange = (classId) => {
    setSelectedClass(classId);
    // 重新获取学生数据
    fetchStudents(1, pagination.pageSize);
  };

  // 获取教师数据
  const fetchTeachersData = async () => {
    try {
      const response = await api.get('/admin/users', {
        params: {
          role: 'teacher',
          limit: 1000
        }
      });
      setTeachers(response.data.users);
    } catch (error) {
      message.error('获取教师列表失败');
    }
  };

  // 获取课程列表
  const fetchCourses = async () => {
    try {
      const response = await api.get('/admin/courses');
      setCourses(response.data);
    } catch (error) {
      message.error('获取课程列表失败');
    }
  };

  // 获取系统统计
  const fetchSystemStats = async () => {
    try {
      setSystemStatsLoading(true);
      const data = await getSystemStats();
      setSystemStats(data);
    } catch (error) {
      console.error('获取系统统计失败:', error);
      message.error('获取系统统计失败');
    } finally {
      setSystemStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchStudents(); // 获取学生数据和分页
    fetchTeachersData(); // 获取教师数据
    fetchClasses();
    fetchCourses();
    fetchSystemStats();
    fetchBackupList();
    fetchAllStudentsForGrades(); // 获取所有学生的年级信息
  }, []);

  // 处理筛选变化
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // 重新获取学生数据（搜索功能）
    if (key === 'search') {
      fetchStudents(1, pagination.pageSize);
    }
  };

  // 处理分页变化
  const handleTableChange = (paginationInfo) => {
    fetchUsers(paginationInfo.current, paginationInfo.pageSize, filters.role, filters.search);
  };

  // 创建/编辑用户
  const handleUserSubmit = async (values) => {
    try {
      if (editingUser) {
        // 编辑用户
        await api.put(`/admin/users/${editingUser._id}`, values);
        message.success('用户更新成功');
      } else {
        // 创建用户
        await api.post('/admin/users', values);
        message.success('用户创建成功');
      }

      setUserModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers(pagination.current, pagination.pageSize, filters.role, filters.search);
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      message.success('用户删除成功');
      fetchUsers(pagination.current, pagination.pageSize, filters.role, filters.search);
    } catch (error) {
      message.error('删除用户失败');
    }
  };

  // 重置密码
  const handleResetPassword = async (values) => {
    try {
      await api.post(`/admin/users/${editingUser._id}/reset-password`, values);
      message.success('密码重置成功');
      setResetPasswordModalVisible(false);
      setEditingUser(null);
      resetPasswordForm.resetFields();
    } catch (error) {
      message.error(error.response?.data?.message || '重置密码失败');
    }
  };

  // 创建备份（后台异步执行，立即返回）
  const handleCreateBackup = async () => {
    try {
      setBackupLoading(true);

      const options = {
        includeAssignments
      };

      const result = await backupAPI.createBackup(options);
      message.success(result.message || '备份已开始生成，请稍后刷新列表查看');
    } catch (error) {
      console.error('创建备份失败:', error);
      message.error(`创建备份失败: ${error.message}`);
    } finally {
      setBackupLoading(false);
    }
  };

  // 下载备份
  const handleDownloadBackup = async (filename) => {
    try {
      message.info('开始下载备份文件...');
      const response = await backupAPI.downloadBackup(filename);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('备份下载成功');
    } catch (error) {
      console.error('下载备份失败:', error);
      message.error(`下载备份失败: ${error.message}`);
    }
  };

  // 导入备份
  const handleImportBackup = (file) => {
    Modal.confirm({
      title: '确认导入备份',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Alert
            message="重要警告"
            description="导入备份将覆盖当前系统中的所有数据，此操作不可撤销。确定要继续吗？"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <p>将使用以下设置导入备份：</p>
          <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
            <li>资源文件：<span style={{ fontWeight: 'bold', color: '#1890ff' }}>始终导入</span></li>
            <li>作业文件：<span style={{ fontWeight: 'bold', color: includeAssignments ? '#52c41a' : '#f5222d' }}>{includeAssignments ? '导入' : '不导入'}</span></li>
          </ul>
        </div>
      ),
      onOk: async () => {
        try {
          setBackupLoading(true);
          message.loading({ content: '正在上传备份文件...', key: 'importBackup', duration: 0 });

          const formData = new FormData();
          formData.append('backupFile', file);
          formData.append('includeAssignments', includeAssignments.toString());

          const onProgress = (percent) => {
            message.loading({
              content: `正在上传备份文件... ${percent}%`,
              key: 'importBackup',
              duration: 0
            });
          };

          await backupAPI.importBackup(formData, onProgress);
          message.success({ content: '备份导入成功！', key: 'importBackup' });

          // 刷新数据
          fetchOverview();
          fetchUsers();
          fetchClasses();
          fetchCourses();
          fetchBackupList(); // 刷新备份列表
        } catch (error) {
          console.error('导入备份失败:', error);
          message.error({ content: '导入备份失败', key: 'importBackup' });
        } finally {
          setBackupLoading(false);
        }
      },
      width: 500
    });
  };

  // 处理文件选择
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleImportBackup(file);
      event.target.value = null;
    }
  };

  // 获取备份列表
  const fetchBackupList = async () => {
    try {
      setBackupListLoading(true);
      const response = await api.get('/backup/list');
      setBackupList(response.data.backups || []);
    } catch (error) {
      console.error('获取备份列表失败:', error);
      message.error('获取备份列表失败');
    } finally {
      setBackupListLoading(false);
    }
  };

  // 删除备份
  const handleDeleteBackup = async (filename) => {
    try {
      await api.delete(`/backup/${filename}`);
      message.success('备份文件删除成功');
      fetchBackupList(); // 刷新列表
    } catch (error) {
      console.error('删除备份失败:', error);
      message.error('删除备份失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 确认删除备份
  const confirmDeleteBackup = (backup) => {
    Modal.confirm({
      title: '确认删除备份',
      content: (
        <div>
          <p>确定要删除备份文件吗？</p>
          <p><strong>文件名:</strong> {backup.name}</p>
          <p><strong>大小:</strong> {backup.sizeFormatted}</p>
          <p><strong>创建时间:</strong> {new Date(backup.createdAt).toLocaleString()}</p>
          <p style={{ color: '#ff4d4f', marginTop: 16 }}>
            <strong>注意：此操作不可撤销！</strong>
          </p>
        </div>
      ),
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => handleDeleteBackup(backup.name)
    });
  };

  // 获取教师列表
  const fetchTeachers = async () => {
    try {
      setTeachersLoading(true);
      const response = await api.get('/admin/teachers');
      setTeachers(response.data || []);
    } catch (error) {
      console.error('获取教师列表失败:', error);
      message.error('获取教师列表失败');
    } finally {
      setTeachersLoading(false);
    }
  };

  // 打开教师分配模态框
  const openTeacherAssignModal = async (classItem) => {
    await fetchTeachers();
    assignmentForm.setFieldsValue({
      classId: classItem._id,
      teacherId: classItem.teacher?._id
    });
    setTeacherAssignModalVisible(true);
  };

  // 分配教师到班级
  const handleTeacherAssignment = async (values) => {
    try {
      await api.post('/admin/assign-teacher', {
        classId: values.classId,
        teacherId: values.teacherId
      });
      message.success('教师分配成功');
      setTeacherAssignModalVisible(false);
      assignmentForm.resetFields();
      fetchClasses(); // 刷新班级列表
    } catch (error) {
      console.error('分配教师失败:', error);
      message.error('分配教师失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 创建新班级
  const handleCreateClass = async (values) => {
    try {
      await api.post('/admin/class', values);
      message.success('班级创建成功');
      setCreateClassModalVisible(false);
      createClassForm.resetFields();
      fetchClasses(); // 刷新班级列表
    } catch (error) {
      console.error('创建班级失败:', error);
      message.error('创建班级失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 打开批量分配模态框
  const openBatchAssignModal = async () => {
    try {
      await fetchTeachers();
      setBatchAssignModalVisible(true);
    } catch (error) {
      console.error('打开批量分配模态框失败:', error);
    }
  };

  // 选择教师后获取相关班级信息
  const handleTeacherSelect = async (teacherId) => {
    try {
      const teacher = teachers.find(t => t._id === teacherId);
      setSelectedTeacher(teacher);

      // 获取该教师负责的班级
      const teacherClassesResponse = await api.get(`/admin/teacher/${teacherId}/classes`);
      setTeacherOwnedClasses(teacherClassesResponse.data.classes || []);

      // 获取所有班级（包括已分配给其他教师的）
      const allClassesResponse = await api.get('/admin/classes');
      const allClasses = allClassesResponse.data || [];

      // 按年级分组，然后按班级名称排序
      const sortedClasses = allClasses.sort((a, b) => {
        // 先按年级排序（降序，新年级在前）
        if (a.grade !== b.grade) {
          return b.grade - a.grade;
        }
        // 年级相同时按班级名称排序（升序）
        return a.name - b.name;
      });

      setAvailableClasses(sortedClasses);

      // 设置表单初始值
      const currentlyAssigned = allClasses
        .filter(cls => cls.teacher && cls.teacher._id === teacherId)
        .map(cls => cls._id);

      batchAssignForm.setFieldsValue({
        teacherId: teacherId,
        assignedClasses: currentlyAssigned
      });
    } catch (error) {
      console.error('获取教师班级信息失败:', error);
      message.error('获取教师班级信息失败');
    }
  };

  // 批量分配教师
  const handleBatchAssign = async (values) => {
    try {
      const { teacherId, assignedClasses } = values;

      // 计算要分配和取消分配的班级
      const currentAssigned = teacherOwnedClasses.map(cls => cls._id);
      const newAssigned = assignedClasses || [];

      const assignClassIds = newAssigned.filter(id => !currentAssigned.includes(id));
      const unassignClassIds = currentAssigned.filter(id => !newAssigned.includes(id));

      const response = await api.post('/admin/batch-assign-teacher', {
        teacherId,
        assignClassIds,
        unassignClassIds
      });

      const { results } = response.data;

      // 显示操作结果
      let successMsg = [];
      if (results.assigned.length > 0) {
        successMsg.push(`成功分配: ${results.assigned.join(', ')}`);
      }
      if (results.unassigned.length > 0) {
        successMsg.push(`成功取消分配: ${results.unassigned.join(', ')}`);
      }

      if (successMsg.length > 0) {
        message.success(successMsg.join('; '));
      }

      if (results.errors.length > 0) {
        message.warning(`部分操作失败: ${results.errors.join('; ')}`);
      }

      setBatchAssignModalVisible(false);
      batchAssignForm.resetFields();
      setSelectedTeacher(null);
      setAvailableClasses([]);
      setTeacherOwnedClasses([]);
      fetchClasses(); // 刷新班级列表
    } catch (error) {
      console.error('批量分配失败:', error);
      message.error('批量分配失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 下载学生导入模板
  const downloadStudentTemplate = async () => {
    try {
      const response = await api.get('/admin/template/students/download', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '学生导入模板.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('模板下载成功');
    } catch (error) {
      console.error('下载模板失败:', error);
      message.error('下载模板失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 处理文件列表改变
  const handleFileListChange = ({ fileList }) => {
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

  // 处理文件上传
  const handleFileUpload = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/admin/students/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      message.success(response.data.message);
      setImportStudentModalVisible(false);
      setFileList([]);

      // 刷新相关数据
      fetchClasses();
      fetchUsers();
      fetchOverview();
    } catch (error) {
      console.error('导入学生失败:', error);
      message.error('导入学生失败: ' + (error.response?.data?.message || error.message));
    }
  };

  // 文件清理相关函数
  const openCleanupModal = async () => {
    try {
      // 获取课程和班级数据（管理员可以看到所有数据）
      const [courseResponse, classResponse] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/classes')
      ]);

      // 处理课程数据
      const coursesData = courseResponse.data || [];
      setCourses(coursesData.map(course => ({
        _id: course._id,
        title: course.title,
        instructor: course.instructor
      })));

      // 处理班级数据
      const classesData = classResponse.data || [];
      const sortedClasses = classesData.sort((a, b) => {
        if (a.grade === b.grade) {
          return a.name - b.name;
        }
        return a.grade - b.grade;
      });
      setClasses(sortedClasses);

      setCleanupModalVisible(true);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    }
  };

  const handlePreviewCleanup = async () => {
    try {
      await cleanupForm.validateFields();
      const values = cleanupForm.getFieldsValue();
      setValidatedFormValues(values);

      if (!values.deleteOriginals && !values.deletePreviews) {
        message.error('请至少选择一种要删除的文件类型');
        return;
      }

      setCleanupLoading(true);

      const filters = {
        courseIds: values.courseIds,
        classIds: values.classIds,
        dateRange: values.dateRange ? [
          values.dateRange[0].format('YYYY-MM-DD'),
          values.dateRange[1].format('YYYY-MM-DD')
        ] : undefined
      };

      const options = {
        deleteOriginals: values.deleteOriginals,
        deletePreviews: values.deletePreviews
      };

      try {
        const data = await assignmentFilesAPI.previewCleanup(filters, options);
        setPreviewData(data);
        setCleanupLoading(false);
        setCleanupStep(2);
      } catch (error) {
        setCleanupLoading(false);
        message.error('预览清理失败');
      }
    } catch (error) {
      message.error('表单验证失败');
    }
  };

  const handleExecuteCleanup = async () => {
    setCleanupLoading(true);

    const values = validatedFormValues;
    const filters = {
      courseIds: values.courseIds,
      classIds: values.classIds,
      dateRange: values.dateRange ? [
        values.dateRange[0].format('YYYY-MM-DD'),
        values.dateRange[1].format('YYYY-MM-DD')
      ] : undefined
    };

    const options = {
      deleteOriginals: values.deleteOriginals,
      deletePreviews: values.deletePreviews
    };

    try {
      const data = await assignmentFilesAPI.cleanupFiles(filters, options);
      setCleanupResult(data);
      setCleanupLoading(false);
      setCleanupStep(3);

      // 刷新系统概览和统计
      fetchOverview();
      fetchSystemStats();
    } catch (error) {
      setCleanupLoading(false);
      message.error('执行清理失败');
    }
  };

  const resetCleanup = () => {
    setCleanupStep(1);
    setPreviewData(null);
    setCleanupResult(null);
    cleanupForm.resetFields();
  };

  const handleCleanupModalClose = () => {
    if (cleanupLoading) return;

    if (cleanupStep !== 1) {
      Modal.confirm({
        title: '确认取消',
        icon: <ExclamationCircleOutlined />,
        content: '取消操作将丢失当前进度，确定要退出吗？',
        onOk() {
          resetCleanup();
          setCleanupModalVisible(false);
        }
      });
    } else {
      resetCleanup();
      setCleanupModalVisible(false);
    }
  };

  // 用户表格列定义
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 80,
      render: (role) => {
        const roleMap = {
          student: '学生',
          teacher: '教师',
          admin: '管理员'
        };
        return roleMap[role] || role;
      }
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 60,
      render: (gender) => {
        const genderMap = {
          male: '男',
          female: '女',
          other: '其他'
        };
        return genderMap[gender] || '未知';
      }
    },
    {
      title: '班级',
      dataIndex: 'classId',
      key: 'classId',
      width: 120,
      render: (classId) => classId?.name || '未分配'
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive) => isActive ? '激活' : '禁用'
    },
    {
      title: '最后登录',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleString() : '从未登录'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingUser(record);
              form.setFieldsValue({
                name: record.name,
                role: record.role,
                gender: record.gender,
                classId: record.classId?._id,
                isActive: record.isActive
              });
              setUserModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              setEditingUser(record);
              setResetPasswordModalVisible(true);
            }}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDeleteUser(record._id)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
            <SafetyCertificateOutlined style={{ marginRight: 8 }} />
            系统管理员控制台
          </h1>
          <Space>
            <Button
              icon={<FileOutlined />}
              onClick={() => {
                window.location.href = '/admin/logs';
              }}
            >
              系统日志
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchOverview();
                fetchUsers(pagination.current, pagination.pageSize, filters.role, filters.search);
              }}
            >
              刷新数据
            </Button>
            <Button
              type="primary"
              danger
              icon={<SafetyCertificateOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认退出',
                  content: '您确定要退出管理员控制台吗？',
                  okText: '确定退出',
                  cancelText: '取消',
                  onOk: () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userInfo');
                    window.location.href = '/login';
                  }
                });
              }}
            >
              退出系统
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: '24px' }}>


        {/* 系统概览卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总用户数"
                value={overview.totalUsers || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="学生数量"
                value={overview.totalStudents || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="教师数量"
                value={overview.totalTeachers || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="班级数量"
                value={overview.totalClasses || 0}
                prefix={<BookOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 管理功能标签页 */}
        <Card>
        <Tabs defaultActiveKey="students" onChange={async (key) => {
            if (key === 'system') {
              fetchAISettings();
            } else if (key === 'scripts') {
              fetchScripts();
            } else if (key === 'archive') {
              setArchivedLoading(true);
              try {
                const res = await getArchivedClasses();
                setArchivedClasses(res.data || []);
              } catch (e) { message.error('获取归档班级失败'); }
              finally { setArchivedLoading(false); }
            }
          }}>
            <TabPane tab="学生管理" key="students">
              <div style={{ marginBottom: 16 }}>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Select
                      placeholder="选择年级"
                      style={{ width: '100%' }}
                      value={selectedGrade}
                      onChange={handleGradeChange}
                      allowClear
                    >
                      {availableGrades.map(grade => (
                        <Option key={grade} value={grade}>{grade}级</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Select
                      placeholder="选择班级"
                      style={{ width: '100%' }}
                      value={selectedClass}
                      onChange={handleClassChange}
                      allowClear
                      disabled={!selectedGrade}
                    >
                      {availableClassesForFilter
                        .filter(cls => !selectedGrade || cls.grade === selectedGrade)
                        .map(cls => (
                          <Option key={cls._id} value={cls._id}>
                            {cls.grade}级{cls.name}班
                          </Option>
                        ))}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Input.Search
                      placeholder="搜索学号或姓名"
                      onSearch={(value) => handleFilterChange('search', value)}
                      allowClear
                    />
                  </Col>
                  <Col span={6}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingUser(null);
                        form.setFieldsValue({ role: 'student' });
                        setUserModalVisible(true);
                      }}
                    >
                      新增学生
                    </Button>
                  </Col>
                </Row>
              </div>
              <Table
                dataSource={students}
                loading={loading}
                rowKey="_id"
                pagination={{
                  ...pagination,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
                  onChange: (page, pageSize) => {
                    fetchStudents(page, pageSize);
                  },
                  onShowSizeChange: (current, size) => {
                    fetchStudents(1, size);
                  }
                }}
                columns={[
                  { title: '学号', dataIndex: 'username', key: 'username', width: 120 },
                  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
                  {
                    title: '年级',
                    key: 'grade',
                    width: 80,
                    render: (_, record) => record.classId?.grade || '-'
                  },
                  {
                    title: '班级',
                    key: 'class',
                    width: 100,
                    render: (_, record) => record.classId ?
                      `${record.classId.grade}级${record.classId.name}班` : '-'
                  },
                  {
                    title: '座位号',
                    dataIndex: 'seatNumber',
                    key: 'seatNumber',
                    width: 80,
                    render: (seat) => seat || '-'
                  },
                  {
                    title: '性别',
                    dataIndex: 'gender',
                    key: 'gender',
                    width: 60,
                    render: (gender) => {
                      const genderMap = { male: '男', female: '女', other: '-' };
                      return genderMap[gender] || '-';
                    }
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    width: 150,
                    render: (date) => new Date(date).toLocaleString()
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    width: 200,
                    fixed: 'right',
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingUser(record);
                            form.setFieldsValue({
                              name: record.name,
                              role: record.role,
                              gender: record.gender,
                              classId: record.classId?._id,
                              seatNumber: record.seatNumber
                            });
                            setUserModalVisible(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          icon={<KeyOutlined />}
                          onClick={() => {
                            setEditingUser(record);
                            setResetPasswordModalVisible(true);
                          }}
                        >
                          重置密码
                        </Button>
                        <Popconfirm
                          title="确定要删除这个学生吗？"
                          onConfirm={() => deleteUser(record._id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
                scroll={{ x: 1200 }}
              />
            </TabPane>

            <TabPane tab="教师管理" key="teachers">
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Input.Search
                  placeholder="搜索工号或姓名"
                  style={{ width: 300 }}
                  onSearch={(value) => handleFilterChange('search', value)}
                  allowClear
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingUser(null);
                    form.setFieldsValue({ role: 'teacher' });
                    setUserModalVisible(true);
                  }}
                >
                  新增教师
                </Button>
              </div>
              <Table
                dataSource={teachers}
                loading={loading}
                rowKey="_id"
                pagination={{
                  ...pagination,
                  total: teachers.length,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
                }}
                columns={[
                  { title: '工号', dataIndex: 'username', key: 'username', width: 120 },
                  { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
                  {
                    title: '负责班级',
                    key: 'classes',
                    width: 200,
                    render: (_, record) => {
                      const teacherClasses = classes.filter(cls => cls.teacher?._id === record._id);
                      return teacherClasses.length > 0 ?
                        teacherClasses.map(cls => `${cls.grade}级${cls.name}班`).join(', ') :
                        <Text type="secondary">未分配班级</Text>;
                    }
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    width: 150,
                    render: (date) => new Date(date).toLocaleString()
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    width: 200,
                    fixed: 'right',
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingUser(record);
                            form.setFieldsValue({
                              name: record.name,
                              role: record.role,
                              gender: record.gender
                            });
                            setUserModalVisible(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          icon={<KeyOutlined />}
                          onClick={() => {
                            setEditingUser(record);
                            setResetPasswordModalVisible(true);
                          }}
                        >
                          重置密码
                        </Button>
                        <Popconfirm
                          title="确定要删除这个教师吗？"
                          onConfirm={() => deleteUser(record._id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
                scroll={{ x: 1000 }}
              />
            </TabPane>

            <TabPane tab="班级管理" key="classes">
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={async () => {
                    await fetchTeachers();
                    setCreateClassModalVisible(true);
                  }}
                >
                  新建班级
                </Button>
                <Button
                  icon={<TeamOutlined />}
                  onClick={openBatchAssignModal}
                >
                  批量分配教师
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setImportStudentModalVisible(true)}
                >
                  批量导入学生
                </Button>
              </div>
              <Table
                dataSource={classes}
                rowKey="_id"
                columns={[
                  {
                    title: '班级名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name, record) => `${record.grade}级${name}班`
                  },
                  {
                    title: '任课教师',
                    dataIndex: 'teacher',
                    key: 'teacher',
                    render: (teacher) => teacher?.name || (
                      <Text type="secondary">未分配</Text>
                    )
                  },
                  {
                    title: '学生数量',
                    dataIndex: 'studentCount',
                    key: 'studentCount'
                  },
                  {
                    title: '创建时间',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    render: (date) => new Date(date).toLocaleString()
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="link"
                          icon={<TeamOutlined />}
                          onClick={() => openTeacherAssignModal(record)}
                          size="small"
                        >
                          分配教师
                        </Button>
                      </Space>
                    )
                  }
                ]}
              />
            </TabPane>

            <TabPane tab="课程管理" key="courses">
              <Table
                dataSource={courses}
                rowKey="_id"
                columns={[
                  { title: '课程名称', dataIndex: 'title', key: 'title' },
                  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
                  { title: '任课教师', dataIndex: 'instructor', key: 'instructor', render: (instructor) => instructor?.name || '未分配' },
                  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (date) => new Date(date).toLocaleString() }
                ]}
              />
            </TabPane>

            <TabPane tab="系统管理" key="system">
              <Card title={<><SafetyCertificateOutlined /> AI 模型设置</>} style={{ marginBottom: 24 }}>
                <Form
                  form={aiForm}
                  layout="vertical"
                  onFinish={saveAISettings}
                  initialValues={{ aiBaseUrl: '', aiApiKey: '', aiModel: '' }}
                >
                  <Row gutter={16}>
                    <Col span={10}>
                      <Form.Item
                        label="Base URL"
                        name="aiBaseUrl"
                        rules={[{ required: true, message: '请输入 Base URL' }]}
                      >
                        <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="模型名称"
                        name="aiModel"
                        rules={[{ required: true, message: '请输入模型名称' }]}
                      >
                        <Input placeholder="gpt-4o-mini 或其他" allowClear />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item label=" ">
                        <Space>
                          <Button onClick={fetchAISettings} loading={aiLoading} icon={<ReloadOutlined />}>刷新</Button>
                          <Button type="primary" htmlType="submit" loading={aiLoading}>保存</Button>
                        </Space>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        label="API Key"
                        name="aiApiKey"
                        rules={[{ required: true, message: '请输入 API Key' }]}
                      >
                        <Input.Password placeholder="请输入 API Key" visibilityToggle allowClear />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Alert type="info" showIcon style={{ marginTop: 8 }}
                    message="保存后新配置将在约60秒内自动生效（服务端缓存）。" />
                </Form>
              </Card>
        <Card title="学生退出密码" style={{ marginBottom: 24 }}>
          <p>允许空密码和短密码；保存空密码后，学生无需输入密码即可确认退出。</p>
          <Space><Input.Password placeholder="可留空，最多72个字符" maxLength={72} value={logoutPassword} onChange={e => setLogoutPassword(e.target.value)} />
          <Button onClick={async () => { try { await updateSetting('studentLogoutPassword', logoutPassword); setLogoutPassword(''); message.success('退出密码已更新'); } catch { message.error('保存失败'); } }}>保存退出密码</Button></Space>
        </Card>
              <Card title={<><DatabaseOutlined /> 系统备份与恢复</>} style={{ marginBottom: 24 }}>
                <Alert
                  message="重要提示"
                  description="系统备份包含所有用户数据、课程内容和文件。导入备份将完全覆盖当前系统数据，请谨慎操作。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <div style={{ marginBottom: 16 }}>
                  <h4>备份选项：</h4>
                  <Row>
                    <Col span={24}>
                      <Checkbox
                        checked={includeAssignments}
                        onChange={(e) => setIncludeAssignments(e.target.checked)}
                        style={{ marginBottom: 8 }}
                      >
                        包含作业文件
                      </Checkbox>
                      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                        注意：数据库数据和资源文件将始终被包含在备份中
                      </div>
                    </Col>
                  </Row>
                </div>

                <Space size="large">
                  <Button
                    type="primary"
                    icon={<CloudDownloadOutlined />}
                    onClick={handleCreateBackup}
                    loading={backupLoading}
                    size="large"
                  >
                    生成备份
                  </Button>
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                    loading={backupLoading}
                    size="large"
                  >
                    导入系统备份
                  </Button>
                </Space>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                  accept=".zip"
                />

                {/* 备份列表 */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4 style={{ margin: 0 }}>备份文件列表</h4>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={fetchBackupList}
                      loading={backupListLoading}
                      size="small"
                    >
                      刷新
                    </Button>
                  </div>

                  <Table
                    dataSource={backupList}
                    loading={backupListLoading}
                    rowKey="name"
                    size="small"
                    pagination={false}
                    scroll={{ y: 300 }}
                    columns={[
                      {
                        title: '文件名',
                        dataIndex: 'name',
                        key: 'name',
                        ellipsis: true,
                        width: '40%'
                      },
                      {
                        title: '文件大小',
                        dataIndex: 'sizeFormatted',
                        key: 'size',
                        width: '15%'
                      },
                      {
                        title: '创建时间',
                        dataIndex: 'createdAt',
                        key: 'createdAt',
                        width: '25%',
                        render: (date) => new Date(date).toLocaleString()
                      },
                      {
                        title: '操作',
                        key: 'actions',
                        width: '20%',
                        render: (_, backup) => (
                          <Space size="small">
                            <Button
                              type="link"
                              icon={<CloudDownloadOutlined />}
                              onClick={() => handleDownloadBackup(backup.name)}
                              size="small"
                            >
                              下载
                            </Button>
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => confirmDeleteBackup(backup)}
                              size="small"
                            >
                              删除
                            </Button>
                          </Space>
                        )
                      }
                    ]}
                    locale={{
                      emptyText: backupListLoading ? '加载中...' : '暂无备份文件'
                    }}
                  />
                </div>
              </Card>

              <Card title={<><FileOutlined /> 文件清理管理</>}>
                <Alert
                  message="文件清理功能"
                  description="可以按条件清理旧的作业文件和PDF预览文件以释放磁盘空间。此操作不可逆，请谨慎使用。"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="系统总文件"
                      value={systemStats?.uploadsStats?.totalFileCount || 0}
                      prefix={<FileOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="占用空间"
                      value={systemStats?.uploadsStats?.totalSizeFormatted || '0 MB'}
                      prefix={<HddOutlined />}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="文件夹"
                      value={systemStats?.uploadsStats ? Object.keys(systemStats.uploadsStats.folders).length : 0}
                      prefix={<FolderOutlined />}
                    />
                  </Col>
                </Row>

                {/* 按班级和课程分类显示 */}
                <Row gutter={16} style={{ marginTop: 24 }}>
                  <Col span={12}>
                    <Card size="small" title={<><BookOutlined /> 按课程统计</>} style={{ height: 300, overflow: 'auto' }}>
                      {systemStatsLoading ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '250px'
                        }}>
                          <Spin size="large" />
                          <Text type="secondary" style={{ marginTop: 16 }}>
                            正在统计文件信息，请稍候...
                          </Text>
                        </div>
                      ) : systemStats?.fileStatsByClass?.courses && Object.keys(systemStats.fileStatsByClass.courses).length > 0 ? (
                        Object.entries(systemStats.fileStatsByClass.courses).map(([courseTitle, stats]) => (
                          <div key={courseTitle} style={{
                            padding: '8px 0',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <Text strong>{courseTitle}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {stats.instructor || '未知教师'}
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div><Text>{stats.fileCount || 0} 个文件</Text></div>
                              <div><Text type="secondary">{stats.sizeFormatted || '0 B'}</Text></div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                          暂无课程数据
                        </div>
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={<><TeamOutlined /> 按班级统计</>} style={{ height: 300, overflow: 'auto' }}>
                      {systemStatsLoading ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '250px'
                        }}>
                          <Spin size="large" />
                          <Text type="secondary" style={{ marginTop: 16 }}>
                            正在统计文件信息，请稍候...
                          </Text>
                        </div>
                      ) : systemStats?.fileStatsByClass?.classes && Object.keys(systemStats.fileStatsByClass.classes).length > 0 ? (
                        Object.entries(systemStats.fileStatsByClass.classes).map(([className, stats]) => (
                          <div key={className} style={{
                            padding: '8px 0',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <Text strong>{className}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {stats.studentCount || 0} 名学生
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div><Text>{stats.fileCount || 0} 个文件</Text></div>
                              <div><Text type="secondary">{stats.sizeFormatted || '0 B'}</Text></div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                          暂无班级数据
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>

                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Space size="middle">
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={fetchSystemStats}
                      loading={systemStatsLoading}
                      size="large"
                    >
                      刷新统计
                    </Button>
                    <Button
                      type="primary"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={openCleanupModal}
                      size="large"
                      disabled={systemStatsLoading}
                    >
                      文件清理
                    </Button>
                  </Space>
                </div>
              </Card>
            </TabPane>

            <TabPane tab={<><CodeOutlined /> 脚本运行</>} key="scripts">
              <Card title="系统维护脚本" bordered={false}>
                <Alert
                  message="注意"
                  description="这里列出的是系统维护脚本，部分脚本可能会修改数据库数据。请在运行前确保已备份重要数据。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={12}>
                    <Select
                      placeholder="选择要运行的脚本"
                      style={{ width: '100%' }}
                      value={selectedScript}
                      onChange={(value) => {
                        setSelectedScript(value);
                        setScriptOutput('');
                      }}
                      loading={scriptsLoading}
                    >
                      {scripts.map(script => (
                        <Option key={script.id} value={script.id}>
                          <Space>
                            {script.name}
                            {script.dangerous && <Tag color="red">危险</Tag>}
                          </Space>
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={handleRunScript}
                      loading={scriptRunning}
                      disabled={!selectedScript}
                    >
                      运行脚本
                    </Button>
                  </Col>
                  <Col span={6}>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={fetchScripts}
                      loading={scriptsLoading}
                    >
                      刷新列表
                    </Button>
                  </Col>
                </Row>

                {selectedScript && (
                  <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                    <Text strong>脚本说明: </Text>
                    <Text>{scripts.find(s => s.id === selectedScript)?.description}</Text>
                  </Card>
                )}

                {scriptOutput && (
                  <Card
                    size="small"
                    title="运行输出"
                    style={{ background: '#1e1e1e' }}
                    headStyle={{ color: '#fff', background: '#333' }}
                  >
                    <pre style={{
                      background: '#1e1e1e',
                      color: '#0f0',
                      padding: 16,
                      borderRadius: 4,
                      maxHeight: 400,
                      overflow: 'auto',
                      margin: 0,
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {scriptOutput}
                    </pre>
                  </Card>
                )}
              </Card>
            </TabPane>

            {/* 归档管理 Tab */}
            <TabPane tab={<span><InboxOutlined /> 归档管理</span>} key="archive">
              <Row gutter={24}>
                {/* 左側：按年级归档操作区 */}
                <Col span={10}>
                  <Card
                    title={<span><InboxOutlined style={{ color: '#fa8c16', marginRight: 8 }} />年级归档</span>}
                    size="small"
                    style={{ marginBottom: 16 }}
                  >
                    <Alert
                      message="归档说明"
                      description={
                        <ul style={{ paddingLeft: 16, margin: 0 }}>
                          <li>归档后，该年级所有班级的学生无法登录系统</li>
                          <li>学生的作业、成绩、积分等历史数据完整保留</li>
                          <li>教师可查看已归档班级的历史成绩</li>
                          <li>归档后可选择清理作业文件节省存储</li>
                        </ul>
                      }
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <Form form={archiveForm} layout="vertical">
                      <Form.Item
                        name="grade"
                        label="入学年份（选择要归档的年级）"
                        rules={[{ required: true, message: '请选择要归档的年级' }]}
                      >
                        <Select
                          placeholder="请选择需要归档的年级"
                          style={{ width: 200 }}
                          allowClear
                        >
                          {[...new Set(classes.filter(c => c.status !== 'archived').map(c => c.grade))]
                            .filter(Boolean)
                            .sort((a, b) => b - a)
                            .map(g => (
                              <Option key={g} value={g}>{g} 级</Option>
                            ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        name="graduationYear"
                        label="毕业学年（可选，如 2025-2026）"
                      >
                        <Input placeholder="例如：2025-2026" style={{ width: 200 }} />
                      </Form.Item>
                      <Form.Item>
                        <Popconfirm
                          title="确认归档"
                          description={"归档后该年级所有学生将无法登录，确定执行？"}
                          okText="确定归档"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                          onConfirm={async () => {
                            try {
                              const vals = await archiveForm.validateFields();
                              setArchiving(true);
                              const result = await archiveGradeAPI(Number(vals.grade), vals.graduationYear);
                              message.success(result.message);
                              archiveForm.resetFields();
                              // 刷新归档列表
                              const res = await getArchivedClasses();
                              setArchivedClasses(res.data || []);
                            } catch (e) {
                              if (!e.errorFields) message.error(e?.response?.data?.message || '归档失败');
                            } finally { setArchiving(false); }
                          }}
                        >
                          <Button type="primary" danger loading={archiving} icon={<InboxOutlined />}>
                            执行年级归档
                          </Button>
                        </Popconfirm>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>

                {/* 右側：已归档班级列表 */}
                <Col span={14}>
                  <Card
                    title={<span>已归档班级列表</span>}
                    size="small"
                    extra={
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={async () => {
                          setArchivedLoading(true);
                          try {
                            const res = await getArchivedClasses();
                            setArchivedClasses(res.data || []);
                          } catch (e) { message.error('获取失败'); }
                          finally { setArchivedLoading(false); }
                        }}
                      >刷新</Button>
                    }
                  >
                    <Table
                      dataSource={archivedClasses}
                      loading={archivedLoading}
                      rowKey="_id"
                      size="small"
                      pagination={{ pageSize: 8 }}
                      columns={[
                        {
                          title: '班级',
                          key: 'class',
                          render: (_, r) => `${r.grade}届${r.name}班`
                        },
                        {
                          title: '学生数',
                          dataIndex: 'studentCount',
                          key: 'studentCount',
                          render: (v) => `${v || 0} 人`
                        },
                        {
                          title: '归档时间',
                          dataIndex: 'archivedAt',
                          key: 'archivedAt',
                          render: (d) => d ? new Date(d).toLocaleDateString() : '-'
                        },
                        {
                          title: '毕业学年',
                          dataIndex: 'graduationYear',
                          key: 'graduationYear',
                          render: (v) => v || '-'
                        },
                        {
                          title: '操作',
                          key: 'actions',
                          render: (_, r) => (
                            <Space size="small">
                              <Popconfirm
                                title="确定恢复此班级为活跃状态？"
                                okText="确定"
                                cancelText="取消"
                                onConfirm={async () => {
                                  try {
                                    const res = await restoreClassAPI(r._id);
                                    message.success(res.message);
                                    const listRes = await getArchivedClasses();
                                    setArchivedClasses(listRes.data || []);
                                  } catch (e) { message.error('恢复失败'); }
                                }}
                              >
                                <Button type="link" size="small" icon={<RollbackOutlined />}>恢复</Button>
                              </Popconfirm>
                              <Popconfirm
                                title="确定删除该班级学生的所有作业文件？"
                                description="删除后文件不可恢复，成绩、评语等数据不受影响"
                                okText="确定删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                onConfirm={async () => {
                                  try {
                                    const res = await deleteArchivedClassFiles(r._id);
                                    message.success(res.message);
                                  } catch (e) { message.error('清理失败'); }
                                }}
                              >
                                <Button type="link" size="small" danger icon={<DeleteOutlined />}>清理文件</Button>
                              </Popconfirm>
                            </Space>
                          )
                        }
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

          </Tabs>
        </Card>
      </Content>

      {/* 教师分配模态框 */}
      <Modal
        title="分配教师"
        open={teacherAssignModalVisible}
        onCancel={() => {
          setTeacherAssignModalVisible(false);
          assignmentForm.resetFields();
        }}
        onOk={() => assignmentForm.submit()}
        confirmLoading={teachersLoading}
        width={500}
      >
        <Form
          form={assignmentForm}
          layout="vertical"
          onFinish={handleTeacherAssignment}
        >
          <Form.Item name="classId" style={{ display: 'none' }}>
            <Input type="hidden" />
          </Form.Item>

          <Form.Item
            name="teacherId"
            label="选择教师"
            rules={[{ required: true, message: '请选择教师' }]}
          >
            <Select
              placeholder="请选择教师"
              loading={teachersLoading}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {teachers.map(teacher => (
                <Option key={teacher._id} value={teacher._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{teacher.name} ({teacher.username})</span>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      负责 {teacher.classCount} 个班级
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Alert
            message="提示"
            description="分配教师后，该教师将成为此班级的班主任，可以管理班级学生和查看班级相关数据。"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>

      {/* 新建班级模态框 */}
      <Modal
        title="新建班级"
        open={createClassModalVisible}
        onCancel={() => {
          setCreateClassModalVisible(false);
          createClassForm.resetFields();
        }}
        onOk={() => createClassForm.submit()}
        width={500}
      >
        <Form
          form={createClassForm}
          layout="vertical"
          onFinish={handleCreateClass}
        >
          <Form.Item
            name="grade"
            label="年级"
            rules={[
              { required: true, message: '请输入年级' },
              {
                pattern: /^\d{4}$/,
                message: '年级必须是四位数年份，例如：2024'
              }
            ]}
          >
            <Input
              placeholder="请输入年级，例如：2024"
              maxLength={4}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="班级编号"
            rules={[
              { required: true, message: '请输入班级编号' },
              {
                pattern: /^\d+$/,
                message: '班级编号必须是数字'
              }
            ]}
          >
            <Input
              placeholder="请输入班级编号，例如：1"
              maxLength={2}
            />
          </Form.Item>

          <Form.Item
            name="teacherId"
            label="班主任（可选）"
          >
            <Select
              placeholder="请选择班主任（可不选）"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {teachers.map(teacher => (
                <Option key={teacher._id} value={teacher._id}>
                  {teacher.name} ({teacher.username})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Alert
            message="提示"
            description="创建班级后，可以通过班级管理页面为班级分配或更换班主任。"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>

      {/* 批量分配教师模态框 */}
      <Modal
        title="批量分配教师"
        open={batchAssignModalVisible}
        onCancel={() => {
          setBatchAssignModalVisible(false);
          batchAssignForm.resetFields();
          setSelectedTeacher(null);
          setAvailableClasses([]);
          setTeacherOwnedClasses([]);
        }}
        onOk={() => batchAssignForm.submit()}
        width={700}
      >
        <Form
          form={batchAssignForm}
          layout="vertical"
          onFinish={handleBatchAssign}
        >
          <Form.Item
            name="teacherId"
            label="选择教师"
            rules={[{ required: true, message: '请选择教师' }]}
          >
            <Select
              placeholder="请选择要分配班级的教师"
              loading={teachersLoading}
              showSearch
              onChange={handleTeacherSelect}
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {teachers.map(teacher => (
                <Option key={teacher._id} value={teacher._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{teacher.name} ({teacher.username})</span>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      当前负责 {teacher.classCount} 个班级
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedTeacher && (
            <>
              <Alert
                message={`当前选择教师: ${selectedTeacher.name}`}
                description={`当前负责 ${teacherOwnedClasses.length} 个班级`}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="assignedClasses"
                label="分配班级"
                extra="选中的班级将分配给该教师，取消选中将取消分配"
              >
                <Checkbox.Group style={{ width: '100%' }}>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {(() => {
                      // 按年级分组
                      const groupedClasses = availableClasses.reduce((groups, classItem) => {
                        const grade = classItem.grade;
                        if (!groups[grade]) {
                          groups[grade] = [];
                        }
                        groups[grade].push(classItem);
                        return groups;
                      }, {});

                      // 按年级排序（降序）
                      const sortedGrades = Object.keys(groupedClasses).sort((a, b) => b - a);

                      return sortedGrades.map(grade => (
                        <div key={grade} style={{ marginBottom: 24 }}>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginBottom: 12,
                            color: '#1890ff',
                            borderBottom: '1px solid #f0f0f0',
                            paddingBottom: 8
                          }}>
                            {grade} 级
                          </div>
                          <Row gutter={[16, 12]}>
                            {groupedClasses[grade].map(classItem => {
                              const isCurrentlyAssigned = classItem.teacher && classItem.teacher._id === selectedTeacher._id;
                              const isAssignedToOther = classItem.teacher && classItem.teacher._id !== selectedTeacher._id;

                              return (
                                <Col span={8} key={classItem._id}>
                                  <div style={{
                                    border: '1px solid #d9d9d9',
                                    borderRadius: '6px',
                                    padding: '12px',
                                    backgroundColor: isAssignedToOther ? '#f5f5f5' : (isCurrentlyAssigned ? '#f6ffed' : '#fff'),
                                    transition: 'all 0.3s'
                                  }}>
                                    <Checkbox
                                      value={classItem._id}
                                      disabled={isAssignedToOther}
                                      style={{ width: '100%' }}
                                    >
                                      <div style={{ marginLeft: 8 }}>
                                        <div style={{
                                          fontSize: '14px',
                                          fontWeight: '500',
                                          color: isAssignedToOther ? '#999' : '#333'
                                        }}>
                                          {classItem.name}班
                                        </div>
                                        <div style={{
                                          fontSize: '12px',
                                          color: '#666',
                                          marginTop: 4
                                        }}>
                                          {classItem.studentCount || 0} 名学生
                                        </div>
                                        <div style={{
                                          fontSize: '11px',
                                          marginTop: 4,
                                          height: '16px'
                                        }}>
                                          {isAssignedToOther && (
                                            <Tag color="orange" size="small">
                                              {classItem.teacher?.name || '其他教师'}
                                            </Tag>
                                          )}
                                          {isCurrentlyAssigned && (
                                            <Tag color="green" size="small">
                                              当前负责
                                            </Tag>
                                          )}
                                          {!classItem.teacher && (
                                            <Tag color="default" size="small">
                                              未分配
                                            </Tag>
                                          )}
                                        </div>
                                      </div>
                                    </Checkbox>
                                  </div>
                                </Col>
                              );
                            })}
                          </Row>
                        </div>
                      ));
                    })()}
                  </div>
                </Checkbox.Group>
              </Form.Item>

              <Alert
                message="操作说明"
                description={
                  <div>
                    <p>• 勾选班级表示分配给该教师，取消勾选表示取消分配</p>
                    <p>• 已分配给其他教师的班级显示为灰色且无法选择</p>
                    <p>• 班级按年级分组显示，同年级内按班级编号排序</p>
                    <p>• 标签颜色说明：<Tag color="green" size="small">当前负责</Tag> <Tag color="orange" size="small">其他教师</Tag> <Tag color="default" size="small">未分配</Tag></p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </Form>
      </Modal>

      {/* 批量导入学生模态框 */}
      <Modal
        title="批量导入学生"
        open={importStudentModalVisible}
        onCancel={() => {
          setImportStudentModalVisible(false);
          setFileList([]);
        }}
        onOk={() => {
          if (fileList[0]) {
            handleFileUpload(fileList[0].originFileObj);
          } else {
            message.warning('请选择要上传的文件');
          }
        }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p>请下载模板文件，按照模板格式填写学生信息后上传：</p>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={downloadStudentTemplate}
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
          <Alert
            message="注意事项"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                <li>仅支持 Excel 文件格式（.xlsx, .xls）</li>
                <li>请严格按照模板格式填写</li>
                <li>学号必须是唯一的，不能与现有学生重复</li>
                <li>密码长度至少6位</li>
                <li>年级必须是四位数年份（如2024）</li>
                <li>班级必须是整数</li>
                <li>如果班级不存在会自动创建（无班主任）</li>
                <li>管理员可以为任何班级导入学生</li>
              </ul>
            }
            type="info"
            showIcon
          />
        </div>
      </Modal>

      {/* 用户编辑模态框 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={userModalVisible}
        onCancel={() => {
          setUserModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUserSubmit}
        >
          {!editingUser && (
            <>
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6个字符' }]}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="student">学生</Option>
              <Option value="teacher">教师</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="gender"
            label="性别"
          >
            <Select placeholder="请选择性别">
              <Option value="male">男</Option>
              <Option value="female">女</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="classId"
            label="班级"
          >
            <Select placeholder="请选择班级" allowClear>
              {classes.map(cls => (
                <Option key={cls._id} value={cls._id}>{cls.name}</Option>
              ))}
            </Select>
          </Form.Item>

          {editingUser && (
            <Form.Item
              name="isActive"
              label="账户状态"
              valuePropName="checked"
            >
              <Select>
                <Option value={true}>激活</Option>
                <Option value={false}>禁用</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setUserModalVisible(false);
                setEditingUser(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码模态框 */}
      <Modal
        title="重置密码"
        open={resetPasswordModalVisible}
        onCancel={() => {
          setResetPasswordModalVisible(false);
          setEditingUser(null);
          resetPasswordForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={resetPasswordForm}
          layout="vertical"
          onFinish={handleResetPassword}
        >
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => {
                setResetPasswordModalVisible(false);
                setEditingUser(null);
                resetPasswordForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                重置密码
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件清理模态框 */}
      <Modal
        title="作业文件清理"
        open={cleanupModalVisible}
        onCancel={handleCleanupModalClose}
        footer={
          cleanupStep === 3 ? null : [
            <Button
              key="cancel"
              onClick={handleCleanupModalClose}
              disabled={cleanupLoading}
            >
              取消
            </Button>,
            cleanupStep === 2 && (
              <Button
                key="back"
                onClick={() => setCleanupStep(1)}
                disabled={cleanupLoading}
              >
                上一步
              </Button>
            ),
            <Button
              key="next"
              type={cleanupStep === 2 ? "primary" : "default"}
              danger={cleanupStep === 2}
              onClick={cleanupStep === 1 ? handlePreviewCleanup : handleExecuteCleanup}
              loading={cleanupLoading}
            >
              {cleanupStep === 1 ? '下一步' : '执行清理'}
            </Button>
          ]
        }
        width={800}
        maskClosable={false}
        closable={!cleanupLoading}
        destroyOnClose
      >
        <Steps current={cleanupStep - 1} style={{ marginBottom: 24 }}>
          <Step title="选择条件" />
          <Step title="预览" />
          <Step title="完成" />
        </Steps>

        {cleanupLoading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>
              {cleanupStep === 1 ? '正在后台分析文件，文件较多时请耐心等待...' : '正在后台清理文件，请勿重复提交...'}
            </p>
          </div>
        ) : cleanupStep === 1 ? (
          <>
            <Alert
              message="作业文件清理"
              description="您可以按条件清理旧的作业文件以释放磁盘空间。此操作不可逆，请谨慎选择。"
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={cleanupForm}
              layout="vertical"
              initialValues={{
                deleteOriginals: true,
                deletePreviews: true
              }}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="courseIds" label="选择课程">
                    <Select
                      mode="multiple"
                      placeholder="选择要清理的课程"
                      allowClear
                      style={{ width: '100%' }}
                    >
                      {courses.map(course => (
                        <Option key={course._id} value={course._id}>
                          {course.title} <Tag color="blue">{course.instructor?.name || '未知教师'}</Tag>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="classIds" label="选择班级">
                    <Select
                      mode="multiple"
                      placeholder="选择要清理的班级"
                      allowClear
                      style={{ width: '100%' }}
                    >
                      {classes.map(cls => (
                        <Option key={cls._id} value={cls._id}>{cls.grade}级{cls.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="dateRange" label="提交日期区间">
                <RangePicker
                  style={{ width: '100%' }}
                  ranges={{
                    '过去30天': [moment().subtract(30, 'days'), moment()],
                    '过去90天': [moment().subtract(90, 'days'), moment()],
                    '过去半年': [moment().subtract(6, 'months'), moment()],
                    '过去一年': [moment().subtract(1, 'year'), moment()]
                  }}
                />
              </Form.Item>

              <Typography.Title level={5}>删除选项</Typography.Title>
              <Row gutter={[24, 16]}>
                <Col span={12}>
                  <Form.Item name="deleteOriginals" valuePropName="checked">
                    <Checkbox>删除原始作业文件</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="deletePreviews" valuePropName="checked">
                    <Checkbox>删除PDF预览文件</Checkbox>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </>
        ) : cleanupStep === 2 ? (
          <>
            <Alert
              message="清理预览"
              description={`将删除 ${previewData?.totalCount || 0} 个文件，预计释放 ${previewData?.totalSizeFormatted || '0'} 空间。`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {/* 详细统计信息 */}
            {previewData?.statistics && (
              <div style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="按课程统计">
                      {previewData.statistics.byCourse && Object.entries(previewData.statistics.byCourse).map(([courseTitle, stats]) => (
                        <div key={courseTitle} style={{ marginBottom: 8 }}>
                          <Text strong>{courseTitle}</Text>
                          <br />
                          <Text type="secondary">
                            {stats.count} 个文件 ({stats.sizeFormatted})
                          </Text>
                        </div>
                      ))}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="按班级统计">
                      {previewData.statistics.byClass && Object.entries(previewData.statistics.byClass).map(([className, stats]) => (
                        <div key={className} style={{ marginBottom: 8 }}>
                          <Text strong>{className}</Text>
                          <br />
                          <Text type="secondary">
                            {stats.count} 个文件 ({stats.sizeFormatted})
                          </Text>
                        </div>
                      ))}
                    </Card>
                  </Col>
                </Row>
              </div>
            )}

            <Table
              dataSource={previewData?.files || []}
              columns={[
                {
                  title: '文件名',
                  dataIndex: 'fileName',
                  key: 'fileName',
                  ellipsis: true,
                },
                {
                  title: '学生',
                  dataIndex: 'studentName',
                  key: 'studentName',
                },
                {
                  title: '课程',
                  dataIndex: 'courseTitle',
                  key: 'courseTitle',
                },
                {
                  title: '提交时间',
                  dataIndex: 'submissionDate',
                  render: date => new Date(date).toLocaleString(),
                },
                {
                  title: '文件类型',
                  dataIndex: 'type',
                  render: type => type === 'original' ? '原始文件' : 'PDF预览',
                },
                {
                  title: '文件大小',
                  dataIndex: 'sizeFormatted',
                  key: 'sizeFormatted',
                }
              ]}
              size="small"
              pagination={{ pageSize: 10 }}
              rowKey={(record) => `${record.submissionId}-${record.path || ''}`}
            />

            <Typography.Paragraph type="danger" style={{ marginTop: 16 }}>
              <ExclamationCircleOutlined style={{ marginRight: 8 }} />
              警告: 此操作不可撤销，删除的文件将无法恢复。
            </Typography.Paragraph>
          </>
        ) : (
          <Result
            status="success"
            title="文件清理完成"
            subTitle={`已成功清理 ${cleanupResult?.deletedCount || 0} 个文件，释放 ${cleanupResult?.deletedSizeFormatted || '0'} 空间。`}
            extra={[
              <Button
                type="primary"
                key="done"
                onClick={() => {
                  resetCleanup();
                  setCleanupModalVisible(false);
                }}
              >
                完成
              </Button>
            ]}
          />
        )}
      </Modal>
    </Layout>
  );
};

export default AdminDashboard;
