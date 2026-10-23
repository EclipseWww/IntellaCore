import React, { useState, useEffect } from 'react';
import {
  Typography, Button, Table, Form, Input, Select, 
  Space, Card, Spin, Alert, message, Modal, 
  Divider, InputNumber, Switch, Tabs, Image,
  DatePicker, Progress, Tag, Tooltip, Popconfirm,
  Checkbox, Row, Col, Statistic, Avatar, Badge, Empty,
  Radio, List, Comment
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  TeamOutlined, PlayCircleOutlined, CheckCircleOutlined,
  StopOutlined, CopyOutlined, WalletOutlined, UserOutlined,
  ShoppingOutlined, HistoryOutlined, PlusCircleOutlined,
  MinusCircleOutlined, MessageOutlined, WarningOutlined,
  CommentOutlined
} from '@ant-design/icons';
import {
  getShopItems,
  createShopItem,
  updateShopItem,
  deleteShopItem,
  getAllStudentRedemptions,
  getStudentsPointBalance
} from '../../services/pointShopService';
import {
  getCrowdfundingList,
  createCrowdfunding,
  batchCreateCrowdfunding,
  activateCrowdfunding,
  completeCrowdfunding,
  updateCrowdfunding,
  deleteCrowdfunding,
  getCrowdfundingContributions,
  deleteCrowdfundingContribution
} from '../../services/crowdfundingService';
import { getTeacherClasses, updateClassSettings } from '../../services/classService';
import { getStudentPointTransactions, addStudentPoints } from '../../services/achievementService';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

// 默认图片的base64编码，简单的灰色占位图
const DEFAULT_ITEM_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjYWFhIj7mmoLml6Dlm77niYc8L3RleHQ+PC9zdmc+';

const PointShopManagement = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create, edit, view
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('1');
  
  // 众筹相关状态
  const [crowdfundings, setCrowdfundings] = useState([]);
  const [crowdfundingLoading, setCrowdfundingLoading] = useState(false);
  const [crowdfundingForm] = Form.useForm();
  const [crowdfundingModalVisible, setCrowdfundingModalVisible] = useState(false);
  const [crowdfundingModalMode, setCrowdfundingModalMode] = useState('create');
  const [selectedCrowdfunding, setSelectedCrowdfunding] = useState(null);
  const [crowdfundingDetailsModalVisible, setCrowdfundingDetailsModalVisible] = useState(false);
  const [batchCreateMode, setBatchCreateMode] = useState(false);
  
  // 班级相关状态
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [classFilter, setClassFilter] = useState(null);
  
  // 游戏中心设置状态
  const [gameCenterSettingsVisible, setGameCenterSettingsVisible] = useState(false);
  const [updatingGameCenter, setUpdatingGameCenter] = useState(false);
  const [updatingClassId, setUpdatingClassId] = useState(null);

  // 学生积分和兑换情况相关状态
  const [studentRedemptions, setStudentRedemptions] = useState([]);
  const [studentPoints, setStudentPoints] = useState([]);
  const [studentRedemptionsLoading, setStudentRedemptionsLoading] = useState(false);
  const [studentPointsLoading, setStudentPointsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 学生积分明细相关状态
  const [pointTransactionsModalVisible, setPointTransactionsModalVisible] = useState(false);
  const [pointTransactions, setPointTransactions] = useState([]);
  const [pointTransactionsLoading, setPointTransactionsLoading] = useState(false);
  const [pointTransactionsTotal, setPointTransactionsTotal] = useState(0);
  const [pointTransactionsPage, setPointTransactionsPage] = useState(1);
  const [pointTransactionsPageSize, setPointTransactionsPageSize] = useState(10);
  const [studentDetail, setStudentDetail] = useState(null);
  
  // 学生兑换记录模态框相关状态
  const [redemptionModalVisible, setRedemptionModalVisible] = useState(false);
  const [studentRedemptionModalLoading, setStudentRedemptionModalLoading] = useState(false);
  const [studentRedemptionModal, setStudentRedemptionModal] = useState([]);
  const [selectedStudentForRedemption, setSelectedStudentForRedemption] = useState(null);

  // 调整积分相关状态
  const [adjustPointsModalVisible, setAdjustPointsModalVisible] = useState(false);
  const [adjustPointsForm] = Form.useForm();
  const [adjustingStudent, setAdjustingStudent] = useState(null);
  const [adjustPointsLoading, setAdjustPointsLoading] = useState(false);

  // 众筹贡献详情相关状态
  const [contributionsModalVisible, setContributionsModalVisible] = useState(false);
  const [contributionsLoading, setContributionsLoading] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [selectedCrowdfundingForContributions, setSelectedCrowdfundingForContributions] = useState(null);

  const handleBatchUpdateGameCenter = async (checked) => {
    try {
      setUpdatingGameCenter(true);
      const updatePromises = classes.map(cls => updateClassSettings(cls._id, { allowGameCenter: checked }));
      await Promise.all(updatePromises);
      message.success(`已全部${checked ? '开启' : '关闭'}`);
      setClasses(prev => prev.map(c => ({ ...c, allowGameCenter: checked })));
    } catch (err) {
      message.error('批量操作失败，部分班级可能未更新');
    } finally {
      setUpdatingGameCenter(false);
    }
  };

  // 加载商品列表
  useEffect(() => {
    if (activeTab === '1') {
      fetchItems();
      // 提前加载班级列表以供游戏中心设置使用
      if (classes.length === 0) {
        fetchTeacherClasses();
      }
    }
  }, [activeTab]);
  
  // 加载众筹列表
  useEffect(() => {
    if (activeTab === '2') {
      fetchCrowdfundings();
    }
  }, [activeTab]);

  // 加载教师班级列表
  useEffect(() => {
    if (activeTab === '2') {
      fetchTeacherClasses();
    }
  }, [activeTab]);

  // 加载学生积分和兑换情况
  useEffect(() => {
    if (activeTab === '3') {
      fetchTeacherClasses();
      fetchStudentRedemptions();
      fetchStudentPoints();
    }
  }, [activeTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      // 获取商品列表
      const response = await getShopItems();
      if (response.success) {
        setItems(response.items);
      } else {
        setError('加载商品列表失败');
      }
    } catch (err) {
      console.error('加载商品列表失败:', err);
      setError('加载商品列表失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCrowdfundings = async (classId = null) => {
    try {
      setCrowdfundingLoading(true);
      const params = {};
      if (classId) {
        params.classId = classId;
      }
      const response = await getCrowdfundingList(params);
      if (response.success) {
        setCrowdfundings(response.crowdfundings);
      } else {
        setError('加载众筹活动列表失败');
      }
    } catch (err) {
      console.error('加载众筹活动列表失败:', err);
      setError('加载众筹活动列表失败，请稍后再试');
    } finally {
      setCrowdfundingLoading(false);
    }
  };

  // 获取教师的班级
  const fetchTeacherClasses = async () => {
    try {
      setClassesLoading(true);
      const response = await getTeacherClasses();
      if (response.success) {
        setClasses(response.data);
      } else {
        message.error('获取班级列表失败');
      }
    } catch (err) {
      console.error('获取班级列表失败:', err);
      message.error('获取班级列表失败');
    } finally {
      setClassesLoading(false);
    }
  };

  // 获取学生兑换记录
  const fetchStudentRedemptions = async (filters = {}) => {
    try {
      setStudentRedemptionsLoading(true);
      setError(null);
      const params = { ...filters };
      
      const response = await getAllStudentRedemptions(params);
      if (response.success) {
        setStudentRedemptions(response.records);
      } else {
        setError('加载学生兑换记录失败');
      }
    } catch (err) {
      console.error('加载学生兑换记录失败:', err);
      setError('加载学生兑换记录失败，请稍后再试');
    } finally {
      setStudentRedemptionsLoading(false);
    }
  };

  // 获取学生积分余额
  const fetchStudentPoints = async (filters = {}) => {
    try {
      setStudentPointsLoading(true);
      const params = { ...filters };
      if (filters.studentId) {
        params.studentId = filters.studentId;
      }
      
      const response = await getStudentsPointBalance(params);
      if (response.success) {
        setStudentPoints(response.students);
      } else {
        setError('加载学生积分余额失败');
      }
    } catch (err) {
      console.error('加载学生积分余额失败:', err);
      setError('加载学生积分余额失败，请稍后再试');
    } finally {
      setStudentPointsLoading(false);
    }
  };

  // 打开创建商品对话框
  const handleOpenCreateDialog = () => {
    form.resetFields();
    form.setFieldsValue({
      type: 'network_time',
      stock: -1,
      isActive: true,
      pointCost: 0,
      duration: 0
    });
    setDialogMode('create');
    setOpenDialog(true);
  };

  // 打开编辑商品对话框
  const handleOpenEditDialog = (item) => {
    setSelectedItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description || '',
      pointCost: item.pointCost,
      type: item.type,
      image: item.image || '',
      duration: item.duration || 0,
      gameUrl: item.gameUrl || '',
      stock: item.stock === undefined ? -1 : item.stock,
      isActive: item.isActive === undefined ? true : item.isActive
    });
    setDialogMode('edit');
    setOpenDialog(true);
  };

  // 打开查看商品详情对话框
  const handleOpenViewDialog = (item) => {
    setSelectedItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description || '',
      pointCost: item.pointCost,
      type: item.type,
      image: item.image || '',
      duration: item.duration || 0,
      gameUrl: item.gameUrl || '',
      stock: item.stock === undefined ? -1 : item.stock,
      isActive: item.isActive === undefined ? true : item.isActive
    });
    setDialogMode('view');
    setOpenDialog(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedItem(null);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (dialogMode === 'create') {
        // 创建新商品
        const response = await createShopItem(values);
        if (response.success) {
          setItems(prev => [...prev, response.item]);
          message.success('商品创建成功');
          handleCloseDialog();
        } else {
          message.error(response.message || '商品创建失败');
        }
      } else if (dialogMode === 'edit') {
        // 更新商品
        const response = await updateShopItem(selectedItem._id, values);
        if (response.success) {
          setItems(prev => 
            prev.map(item => 
              item._id === selectedItem._id ? response.item : item
            )
          );
          message.success('商品更新成功');
          handleCloseDialog();
        } else {
          message.error(response.message || '商品更新失败');
        }
      }
    } catch (error) {
      console.error('表单验证或提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除商品
  const handleDeleteItem = async (itemId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此商品吗？此操作不可恢复。',
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          const response = await deleteShopItem(itemId);

          if (response.success) {
            setItems(prev => prev.filter(item => item._id !== itemId));
            message.success('商品删除成功');
          } else {
            message.error(response.message || '商品删除失败');
          }
        } catch (err) {
          console.error('删除商品失败:', err);
          message.error('删除商品失败，请稍后再试');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 商品类型标签映射
  const typeLabels = {
    'network_time': '上网时间',
    'game': '小游戏',
    'badge': '徽章',
    'virtual_item': '虚拟物品',
    'crowdfunding': '众筹活动'
  };

  // 表格列定义
  const columns = [
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: type => typeLabels[type] || type
    },
    {
      title: '积分',
      dataIndex: 'pointCost',
      key: 'pointCost',
      align: 'right',
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      align: 'right',
      render: stock => stock === -1 ? '无限' : stock
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center',
      render: isActive => (
        <Text 
          style={{ 
            padding: '2px 8px', 
            borderRadius: '4px', 
            backgroundColor: isActive ? '#52c41a' : '#ff4d4f',
            color: 'white'
          }}
        >
          {isActive ? '上架' : '下架'}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EyeOutlined />} 
            onClick={() => handleOpenViewDialog(record)} 
          />
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleOpenEditDialog(record)} 
          />
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteItem(record._id)} 
          />
        </Space>
      ),
    },
  ];

  // 打开创建众筹活动对话框
  const handleOpenCreateCrowdfundingDialog = () => {
    crowdfundingForm.resetFields();
    crowdfundingForm.setFieldsValue({
      type: 'network_time',
      'reward.type': 'network_time',
      status: 'pending',
      targetPoints: 100,
    });
    setBatchCreateMode(false);
    setCrowdfundingModalMode('create');
    setCrowdfundingModalVisible(true);
  };

  // 打开批量创建众筹对话框
  const handleOpenBatchCreateCrowdfundingDialog = () => {
    crowdfundingForm.resetFields();
    crowdfundingForm.setFieldsValue({
      type: 'network_time',
      'reward.type': 'network_time',
      status: 'pending',
      targetPoints: 100,
    });
    setBatchCreateMode(true);
    setSelectedClassIds([]);
    setCrowdfundingModalMode('create');
    setCrowdfundingModalVisible(true);
  };

  // 打开编辑众筹活动对话框
  const handleOpenEditCrowdfundingDialog = (record) => {
    setSelectedCrowdfunding(record);
    setSelectedClassId(record.classId?._id);
    crowdfundingForm.setFieldsValue({
      title: record.title,
      description: record.description || '',
      type: record.type,
      targetPoints: record.targetPoints,
      image: record.image || '',
      'reward.type': record.reward?.type || 'network_time',
      'reward.duration': record.reward?.duration || 0,
      'reward.description': record.reward?.description || '',
      startDate: record.startDate ? dayjs(record.startDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null,
      classId: record.classId?._id
    });
    setBatchCreateMode(false);
    setCrowdfundingModalMode('edit');
    setCrowdfundingModalVisible(true);
  };

  // 打开众筹活动详情对话框
  const handleOpenViewCrowdfundingDialog = (record) => {
    setSelectedCrowdfunding(record);
    setCrowdfundingDetailsModalVisible(true);
  };

  // 关闭众筹活动对话框
  const handleCloseCrowdfundingDialog = () => {
    setCrowdfundingModalVisible(false);
    setSelectedCrowdfunding(null);
  };

  // 关闭众筹活动详情对话框
  const handleCloseCrowdfundingDetailsDialog = () => {
    setCrowdfundingDetailsModalVisible(false);
    setSelectedCrowdfunding(null);
  };

  // 创建众筹活动
  const handleSubmitCrowdfunding = async () => {
    try {
      const values = await crowdfundingForm.validateFields();
      setCrowdfundingLoading(true);
      
      // 处理日期
      if (values.startDate) {
        values.startDate = values.startDate.toISOString();
      }
      if (values.endDate) {
        values.endDate = values.endDate.toISOString();
      }
      
      // 处理奖励对象
      if (values['reward.type']) {
        values.reward = {
          type: values['reward.type'],
          duration: values['reward.duration'] || 0,
          description: values['reward.description'] || ''
        };
        
        // 删除原始字段
        delete values['reward.type'];
        delete values['reward.duration'];
        delete values['reward.description'];
      }
      
      if (batchCreateMode) {
        // 批量创建众筹活动
        if (!selectedClassIds || selectedClassIds.length === 0) {
          message.error('请至少选择一个班级');
          setCrowdfundingLoading(false);
          return;
        }
        
        values.classIds = selectedClassIds;
        const response = await batchCreateCrowdfunding(values);
        message.success(`成功为${selectedClassIds.length}个班级创建众筹活动`);
      } else if (crowdfundingModalMode === 'edit') {
        // 编辑众筹活动
        if (!values.classId) {
          message.error('请选择一个班级');
          setCrowdfundingLoading(false);
          return;
        }
        
        const response = await updateCrowdfunding(selectedCrowdfunding._id, values);
        if (response.success) {
          message.success('众筹活动更新成功');
        } else {
          message.error(response.message || '众筹活动更新失败');
        }
      } else {
        // 单个班级创建众筹活动
        if (!values.classId) {
          message.error('请选择一个班级');
          setCrowdfundingLoading(false);
          return;
        }
        
        await createCrowdfunding(values);
        message.success('众筹活动创建成功');
      }
      
      handleCloseCrowdfundingDialog();
      fetchCrowdfundings();
    } catch (error) {
      console.error('提交众筹活动失败:', error);
      message.error('提交失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setCrowdfundingLoading(false);
    }
  };

  // 激活众筹活动
  const handleActivateCrowdfunding = async (id) => {
    try {
      setCrowdfundingLoading(true);
      const response = await activateCrowdfunding(id);
      if (response.success) {
        message.success('众筹活动已激活');
        fetchCrowdfundings();
      } else {
        message.error(response.message || '激活众筹活动失败');
      }
    } catch (err) {
      console.error('激活众筹活动失败:', err);
      message.error('激活众筹活动失败：' + (err.response?.data?.message || err.message));
    } finally {
      setCrowdfundingLoading(false);
    }
  };

  // 完成众筹活动
  const handleCompleteCrowdfunding = async (id) => {
    try {
      setCrowdfundingLoading(true);
      const response = await completeCrowdfunding(id);
      if (response.success) {
        message.success('众筹活动已完成');
        fetchCrowdfundings();
      } else {
        message.error(response.message || '完成众筹活动失败');
      }
    } catch (err) {
      console.error('完成众筹活动失败:', err);
      message.error('完成众筹活动失败：' + (err.response?.data?.message || err.message));
    } finally {
      setCrowdfundingLoading(false);
    }
  };

  // 处理删除众筹活动
  const handleDeleteCrowdfunding = async (id) => {
    try {
      setCrowdfundingLoading(true);
      const response = await deleteCrowdfunding(id);
      if (response.success) {
        message.success('众筹活动已删除');
        fetchCrowdfundings();
      } else {
        message.error(response.message || '删除众筹活动失败');
      }
    } catch (err) {
      console.error('删除众筹活动失败:', err);
      message.error('删除众筹活动失败：' + (err.response?.data?.message || err.message));
    } finally {
      setCrowdfundingLoading(false);
    }
  };

  // 状态中文名称映射
  const statusNameMap = {
    'pending': '即将开始',
    'active': '进行中',
    'ready_to_complete': '达标待确认',
    'completed': '已完成',
    'expired': '已过期'
  };

  // 状态颜色映射
  const statusColorMap = {
    'pending': 'default',
    'active': 'green',
    'ready_to_complete': 'gold',
    'completed': 'blue',
    'expired': 'red'
  };

  // 处理班级过滤
  const handleClassFilterChange = (classId) => {
    setClassFilter(classId);
    fetchCrowdfundings(classId);
  };

  // 处理批量创建模式下的班级选择
  const handleBatchClassSelectionChange = (selectedClasses) => {
    setSelectedClassIds(selectedClasses);
  };

  // 学生积分余额表格列定义
  const studentPointsColumns = [
    {
      title: '学生姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar 
            style={{ backgroundColor: record.avatar ? 'transparent' : '#1890ff' }}
            src={record.avatar} 
            icon={!record.avatar && <UserOutlined />}
          />
          {text}
        </Space>
      ),
    },
    {
      title: '学号',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '班级',
      dataIndex: 'className',
      key: 'className',
      render: (_, record) => record.class ? `${record.class.grade}年级${record.class.name}班` : '-',
    },
    {
      title: '当前积分',
      dataIndex: 'totalPoints',
      key: 'totalPoints',
      sorter: (a, b) => a.totalPoints - b.totalPoints,
      render: (points) => (
        <Statistic 
          value={points || 0} 
          valueStyle={{ fontSize: '16px', color: points > 0 ? '#52c41a' : '#999' }}
          suffix="分"
        />
      ),
    },
    {
      title: '兑换次数',
      dataIndex: 'redemptionCount',
      key: 'redemptionCount',
      render: (count) => count || 0,
    },
    {
      title: '未使用兑换券',
      dataIndex: 'pendingRedemptions',
      key: 'pendingRedemptions',
      render: (count) => {
        return count ? (
          <Badge count={count} style={{ backgroundColor: '#faad14' }}>
            <Tag color="gold">待使用</Tag>
          </Badge>
        ) : (
          <Tag color="default">无</Tag>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            onClick={() => handleOpenRedemptionModal(record._id, record.name)}
          >
            查看兑换记录
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenPointTransactionsModal(record._id, record.name)}
          >
            查看积分明细
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenAdjustPointsModal(record)}
          >
            调整积分
          </Button>
        </Space>
      ),
    },
  ];

  // 众筹活动列表表格列定义
  const crowdfundingColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '班级',
      dataIndex: 'classId',
      key: 'classId',
      render: (classId) => {
        return classId ? `${classId.grade}年级${classId.name}班` : '未分配班级';
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeMap = {
          'network_time': '上网时间',
          'game': '小游戏',
          'other': '其他'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '目标积分',
      dataIndex: 'targetPoints',
      key: 'targetPoints',
    },
    {
      title: '当前积分',
      dataIndex: 'currentPoints',
      key: 'currentPoints',
      render: (currentPoints, record) => (
        <Tooltip title={`${currentPoints}/${record.targetPoints}`}>
          <Progress 
            percent={Math.round((currentPoints / record.targetPoints) * 100)} 
            status={currentPoints >= record.targetPoints ? "success" : "active"}
            size="small"
          />
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColorMap[status]}>
          {statusNameMap[status] || status}
        </Tag>
      )
    },
    {
      title: '开始时间',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '结束时间',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '参与人数',
      dataIndex: 'participantsCount',
      key: 'participantsCount',
      render: (count) => count || 0
    },
    {
      title: '贡献次数',
      dataIndex: 'contributionsCount',
      key: 'contributionsCount',
      render: (count) => count || 0
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EyeOutlined />} 
            size="small" 
            onClick={() => handleOpenViewCrowdfundingDialog(record)}
          />
          
          <Button
            icon={<CommentOutlined />}
            size="small"
            onClick={() => handleOpenContributionsDialog(record)}
          />
          
          {record.status !== 'completed' && (
            <Button 
              icon={<EditOutlined />} 
              size="small" 
              onClick={() => handleOpenEditCrowdfundingDialog(record)}
            />
          )}

          {record.status === 'pending' && (
            <Button 
              type="primary" 
              size="small" 
              onClick={() => handleActivateCrowdfunding(record._id)}
            >
              激活
            </Button>
          )}
          
          {record.status === 'ready_to_complete' && (
            <Button 
              type="primary" 
              size="small"
              onClick={() => handleCompleteCrowdfunding(record._id)}
            >
              确认完成
            </Button>
          )}
          
          <Popconfirm
            title="确定要删除此众筹活动吗？"
            description="删除后将无法恢复，且已参与的学生积分将不会退还。"
            onConfirm={() => handleDeleteCrowdfunding(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              icon={<DeleteOutlined />} 
              size="small" 
              danger
              disabled={record.status !== 'pending' && record.participants?.length > 0}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 学生兑换记录表格列定义
  const redemptionRecordsColumns = [
    {
      title: '商品名称',
      dataIndex: 'itemName',
      key: 'itemName',
      width: 200,
    },
    {
      title: '商品类型',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 120,
      filters: [
        { text: '上网时间', value: 'network_time' },
        { text: '小游戏', value: 'game' },
        { text: '徽章', value: 'badge' },
        { text: '虚拟物品', value: 'virtual_item' },
        { text: '众筹活动', value: 'crowdfunding' }
      ],
      onFilter: (value, record) => record.itemType === value,
      render: (type) => {
        const typeLabels = {
          'network_time': '上网时间',
          'game': '小游戏',
          'badge': '徽章',
          'virtual_item': '虚拟物品',
          'crowdfunding': '众筹活动'
        };
        return <Tag color={
          type === 'network_time' ? 'green' : 
          type === 'game' ? 'blue' : 
          type === 'badge' ? 'purple' : 
          type === 'crowdfunding' ? 'gold' : 'orange'
        }>{typeLabels[type] || type}</Tag>;
      }
    },
    {
      title: '消耗积分',
      dataIndex: 'pointCost',
      key: 'pointCost',
      width: 100,
      sorter: (a, b) => a.pointCost - b.pointCost,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '待使用', value: 'pending' },
        { text: '已使用', value: 'completed' },
        { text: '已过期', value: 'expired' }
      ],
      onFilter: (value, record) => record.status === value,
      render: (status, record) => {
        const statusMap = {
          'pending': { color: 'gold', text: '待使用' },
          'completed': { color: 'green', text: '已使用' },
          'expired': { color: 'red', text: '已过期' }
        };
        return <Tag color={statusMap[status]?.color || 'default'}>{statusMap[status]?.text || status}</Tag>;
      }
    },
    {
      title: '兑换/贡献时间',
      dataIndex: 'redeemTime',
      key: 'redeemTime',
      width: 180,
      sorter: (a, b) => new Date(a.redeemTime) - new Date(b.redeemTime),
      defaultSortOrder: 'descend',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '使用时间',
      dataIndex: 'useTime',
      key: 'useTime',
      width: 180,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
    },
    {
      title: '备注',
      dataIndex: 'message',
      key: 'message',
      render: (message, record) => {
        if (record.recordType === 'crowdfunding' && message) {
          return <Tooltip title={message}>
            <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {message}
            </div>
          </Tooltip>;
        }
        return '-';
      }
    }
  ];

  // 处理班级筛选变化 - 兑换管理
  const handleRedemptionClassFilterChange = (classId) => {
    const params = {};
    if (classId) {
      params.classId = classId;
    }
    fetchStudentRedemptions(params);
    fetchStudentPoints(params);
  };

  // 获取学生积分明细
  const fetchStudentPointTransactions = async (studentId, page = 1, pageSize = 10) => {
    if (!studentId) return;
    
    try {
      setPointTransactionsLoading(true);
      const skip = (page - 1) * pageSize;
      
      const response = await getStudentPointTransactions(studentId, {
        limit: pageSize,
        skip: skip
      });
      
      if (response.success) {
        setPointTransactions(response.transactions);
        setPointTransactionsTotal(response.totalCount);
        setStudentDetail(response.student);
      } else {
        message.error('获取学生积分明细失败');
      }
    } catch (err) {
      console.error('获取学生积分明细失败:', err);
      message.error('获取学生积分明细失败，请稍后再试');
    } finally {
      setPointTransactionsLoading(false);
    }
  };

  // 打开积分明细对话框
  const handleOpenPointTransactionsModal = (studentId, studentName) => {
    setPointTransactionsPage(1);
    setSelectedStudent({ id: studentId, name: studentName });
    setPointTransactionsModalVisible(true);
    fetchStudentPointTransactions(studentId, 1, pointTransactionsPageSize);
  };

  // 处理积分明细分页变化
  const handlePointTransactionsPageChange = (page, pageSize) => {
    setPointTransactionsPage(page);
    fetchStudentPointTransactions(selectedStudent.id, page, pageSize);
  };

  // 获取学生兑换记录（单个学生）
  const fetchStudentRedemptionRecords = async (studentId) => {
    if (!studentId) return;
    
    try {
      setStudentRedemptionModalLoading(true);
      
      const response = await getAllStudentRedemptions({ 
        studentId: studentId
      });
      
      if (response.success) {
        setStudentRedemptionModal(response.records);
      } else {
        message.error('获取学生兑换记录失败');
      }
    } catch (err) {
      console.error('获取学生兑换记录失败:', err);
      message.error('获取学生兑换记录失败，请稍后再试');
    } finally {
      setStudentRedemptionModalLoading(false);
    }
  };

  // 打开兑换记录对话框
  const handleOpenRedemptionModal = (studentId, studentName) => {
    setSelectedStudentForRedemption({ id: studentId, name: studentName });
    setRedemptionModalVisible(true);
    fetchStudentRedemptionRecords(studentId);
  };

  // 打开调整积分对话框
  const handleOpenAdjustPointsModal = (student) => {
    setAdjustingStudent(student);
    adjustPointsForm.resetFields();
    adjustPointsForm.setFieldsValue({
      operationType: 'add',
      amount: 10,
      reason: ''
    });
    setAdjustPointsModalVisible(true);
  };

  // 关闭调整积分对话框
  const handleCloseAdjustPointsModal = () => {
    setAdjustPointsModalVisible(false);
    setAdjustingStudent(null);
  };

  // 提交调整积分
  const handleSubmitAdjustPoints = async () => {
    try {
      const values = await adjustPointsForm.validateFields();
      
      if (!adjustingStudent) {
        message.error('未选择学生');
        return;
      }
      
      const { amount, reason, operationType } = values;
      
      if (!amount || amount <= 0) {
        message.error('请输入大于0的积分数值');
        return;
      }
      
      setAdjustPointsLoading(true);
      
      // 根据操作类型设置积分值（增加为正数，扣除为负数）
      const pointsAmount = operationType === 'add' ? amount : -amount;
      
      const response = await addStudentPoints(
        adjustingStudent._id,
        pointsAmount,
        reason || (pointsAmount > 0 ? '教师奖励积分' : '教师扣除积分')
      );
      
      if (response.success) {
        message.success(`积分${pointsAmount > 0 ? '增加' : '扣除'}成功，当前积分：${response.newBalance}`);
        
        // 更新学生列表中的积分数据
        setStudentPoints(prev => 
          prev.map(student => 
            student._id === adjustingStudent._id 
              ? { ...student, totalPoints: response.newBalance }
              : student
          )
        );
        
        // 如果此时学生详情对话框是打开的，同时更新详情中的积分
        if (studentDetail && studentDetail._id === adjustingStudent._id) {
          setStudentDetail({
            ...studentDetail,
            totalPoints: response.newBalance
          });
        }
        
        handleCloseAdjustPointsModal();
        
        // 重新获取学生积分明细
        if (selectedStudent && selectedStudent.id === adjustingStudent._id) {
          fetchStudentPointTransactions(selectedStudent.id, pointTransactionsPage, pointTransactionsPageSize);
        }
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('调整积分失败:', error);
      message.error('调整积分失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setAdjustPointsLoading(false);
    }
  };

  // 获取众筹活动的贡献记录
  const fetchCrowdfundingContributions = async (crowdfundingId) => {
    if (!crowdfundingId) return;
    
    try {
      setContributionsLoading(true);
      
      const response = await getCrowdfundingContributions(crowdfundingId);
      
      if (response.success) {
        setContributions(response.contributions);
      } else {
        message.error('获取众筹贡献记录失败');
      }
    } catch (err) {
      console.error('获取众筹贡献记录失败:', err);
      message.error('获取众筹贡献记录失败，请稍后再试');
    } finally {
      setContributionsLoading(false);
    }
  };

  // 打开众筹贡献详情对话框
  const handleOpenContributionsDialog = (record) => {
    setSelectedCrowdfundingForContributions(record);
    setContributionsModalVisible(true);
    fetchCrowdfundingContributions(record._id);
  };

  // 关闭众筹贡献详情对话框
  const handleCloseContributionsDialog = () => {
    setContributionsModalVisible(false);
    setSelectedCrowdfundingForContributions(null);
  };

  // 删除不文明众筹贡献
  const handleDeleteContribution = async (contributionId) => {
    Modal.confirm({
      title: '确认删除',
      icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
      content: '确定要删除这条众筹贡献记录吗？删除后学生积分将不会返还，请谨慎操作！',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setContributionsLoading(true);
          
          const response = await deleteCrowdfundingContribution(contributionId);
          
          if (response.success) {
            message.success('删除贡献记录成功');
            // 刷新列表
            if (selectedCrowdfundingForContributions) {
              fetchCrowdfundingContributions(selectedCrowdfundingForContributions._id);
              // 同时刷新众筹活动列表
              fetchCrowdfundings(classFilter);
            }
          } else {
            message.error(response.message || '删除贡献记录失败');
          }
        } catch (err) {
          console.error('删除贡献记录失败:', err);
          message.error('删除贡献记录失败：' + (err.response?.data?.message || err.message));
        } finally {
          setContributionsLoading(false);
        }
      }
    });
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="积分商品" key="1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={3}>积分商店管理</Title>
            <Space>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={() => setGameCenterSettingsVisible(true)}
              >
                游戏中心设置
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateDialog}
              >
                添加商品
              </Button>
            </Space>
          </div>

          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Card>
            <Table
              columns={columns}
              dataSource={items}
              rowKey="_id"
              loading={loading && items.length === 0}
              locale={{ emptyText: '暂无商品，请添加商品' }}
            />
          </Card>
        </TabPane>
        
        <TabPane tab={<span><TeamOutlined /> 积分众筹</span>} key="2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <Title level={3} style={{ margin: 0 }}>积分众筹管理</Title>
              <div style={{ marginTop: 8 }}>
                <span style={{ marginRight: 8 }}>班级筛选:</span>
                <Select 
                  placeholder="选择班级" 
                  style={{ width: 150 }} 
                  allowClear
                  onChange={handleClassFilterChange}
                  loading={classesLoading}
                >
                  {classes.map(cls => (
                    <Option key={cls._id} value={cls._id}>
                      {cls.grade}年级{cls.name}班
                    </Option>
                  ))}
                </Select>
              </div>
            </div>
            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={handleOpenBatchCreateCrowdfundingDialog}
              >
                批量创建
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateCrowdfundingDialog}
              >
                创建众筹活动
              </Button>
            </Space>
          </div>

          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Card>
            <Table
              columns={crowdfundingColumns}
              dataSource={crowdfundings}
              rowKey="_id"
              loading={crowdfundingLoading}
              locale={{ emptyText: '暂无众筹活动，请创建众筹活动' }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><WalletOutlined /> 学生积分</span>} key="3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={3}>学生积分情况</Title>
            <Space>
              <Select
                placeholder="选择班级"
                style={{ width: 150 }}
                allowClear
                onChange={handleRedemptionClassFilterChange}
                loading={classesLoading}
              >
                {classes.map(cls => (
                  <Option key={cls._id} value={cls._id}>
                    {cls.grade}年级{cls.name}班
                  </Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<HistoryOutlined />}
                onClick={() => {
                  fetchStudentPoints();
                  fetchStudentRedemptions();
                }}
              >
                刷新数据
              </Button>
            </Space>
          </div>

          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Card>
            <div style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="总学生数"
                      value={studentPoints.length}
                      prefix={<TeamOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="总积分"
                      value={studentPoints.reduce((sum, student) => sum + (student.totalPoints || 0), 0)}
                      prefix={<WalletOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="总兑换次数"
                      value={studentPoints.reduce((sum, student) => sum + (student.redemptionCount || 0), 0)}
                      prefix={<ShoppingOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="未使用兑换券"
                      value={studentPoints.reduce((sum, student) => sum + (student.pendingRedemptions || 0), 0)}
                      prefix={<HistoryOutlined />}
                    />
                  </Card>
                </Col>
              </Row>
            </div>
            
            <Table
              columns={studentPointsColumns}
              dataSource={studentPoints}
              rowKey="_id"
              loading={studentPointsLoading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '暂无学生积分数据' }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* 游戏中心设置对话框 */}
      <Modal
        title="游戏中心可见性设置"
        open={gameCenterSettingsVisible}
        onCancel={() => setGameCenterSettingsVisible(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setGameCenterSettingsVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">在此设置各个班级是否允许访问游戏中心</Text>
          <Space>
            <Button 
              size="small" 
              onClick={() => handleBatchUpdateGameCenter(true)}
              loading={updatingGameCenter}
            >
              全部开启
            </Button>
            <Button 
              size="small" 
              danger
              onClick={() => handleBatchUpdateGameCenter(false)}
              loading={updatingGameCenter}
            >
              全部关闭
            </Button>
          </Space>
        </div>
        <Table
          size="small"
          loading={classesLoading}
          dataSource={classes}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '年级',
              dataIndex: 'grade',
              key: 'grade',
              sorter: (a, b) => a.grade - b.grade,
              render: (grade) => `${grade}年级`
            },
            {
              title: '班级',
              dataIndex: 'name',
              key: 'name',
              sorter: (a, b) => a.name - b.name,
              render: (name) => `${name}班`
            },
            {
              title: '状态',
              key: 'status',
              render: (_, cls) => (
                <Tag color={cls.allowGameCenter !== false ? 'success' : 'default'}>
                  {cls.allowGameCenter !== false ? '允许访问' : '禁止访问'}
                </Tag>
              )
            },
            {
              title: '操作',
              key: 'action',
              render: (_, cls) => (
                <Switch
                  checked={cls.allowGameCenter !== false}
                  onChange={async (checked) => {
                    try {
                      setUpdatingClassId(cls._id);
                      await updateClassSettings(cls._id, { allowGameCenter: checked });
                      message.success(`已${checked ? '开启' : '关闭'} ${cls.grade}年级${cls.name}班 的游戏中心`);
                      setClasses(prev => prev.map(c => 
                        c._id === cls._id ? { ...c, allowGameCenter: checked } : c
                      ));
                    } catch (err) {
                      message.error('操作失败');
                    } finally {
                      setUpdatingClassId(null);
                    }
                  }}
                  loading={updatingClassId === cls._id || updatingGameCenter}
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                />
              )
            }
          ]}
        />
      </Modal>

      {/* 添加/编辑商品对话框 */}
      <Modal
        title={dialogMode === 'create' ? '添加商品' : dialogMode === 'edit' ? '编辑商品' : '商品详情'}
        open={openDialog}
        onCancel={handleCloseDialog}
        width={800}
        footer={
          dialogMode === 'view' 
            ? [
                <Button key="close" onClick={handleCloseDialog}>
                  关闭
                </Button>
              ]
            : [
                <Button key="cancel" onClick={handleCloseDialog}>
                  取消
                </Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                  保存
                </Button>
              ]
        }
      >
        <Form
          form={form}
          layout="vertical"
          disabled={dialogMode === 'view'}
        >
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <Form.Item
                name="name"
                label="商品名称"
                rules={[{ required: true, message: '请输入商品名称' }]}
              >
                <Input placeholder="请输入商品名称" />
              </Form.Item>
              
              <Form.Item
                name="type"
                label="商品类型"
                rules={[{ required: true, message: '请选择商品类型' }]}
              >
                <Select>
                  <Option value="network_time">上网时间</Option>
                  <Option value="game">小游戏</Option>
                  <Option value="badge">徽章</Option>
                  <Option value="virtual_item">虚拟物品</Option>
                </Select>
              </Form.Item>
              
              <Form.Item
                name="pointCost"
                label="所需积分"
                rules={[{ required: true, message: '请输入所需积分' }, 
                  { type: 'number', min: 1, message: '积分必须大于0' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="stock"
                label="库存数量（-1表示无限）"
              >
                <InputNumber min={-1} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
              >
                {({ getFieldValue }) => 
                  getFieldValue('type') === 'network_time' || getFieldValue('type') === 'game' ? (
                    <Form.Item
                      name="duration"
                      label={getFieldValue('type') === 'network_time' ? "上网时间（分钟）" : "游戏时间（分钟）"}
                      rules={[
                        { required: true, message: getFieldValue('type') === 'network_time' ? '请输入上网时间' : '请输入游戏时间' },
                        { type: 'number', min: 1, message: getFieldValue('type') === 'network_time' ? '上网时间必须大于0' : '游戏时间必须大于0' }
                      ]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </div>
            
            <div style={{ flex: 1 }}>
              <Form.Item
                name="image"
                label="商品图片URL"
                tooltip="支持相对路径，如 /images/shop/网络时间.png，图片建议使用正方形"
              >
                <Input placeholder="请输入商品图片URL，如 /images/shop/网络时间.png" />
              </Form.Item>
              
              <Form.Item
                name="description"
                label="商品描述"
              >
                <TextArea rows={4} placeholder="请输入商品描述" />
              </Form.Item>
              
              <Form.Item
                name="isActive"
                label="商品状态"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="上架" 
                  unCheckedChildren="下架" 
                />
              </Form.Item>
              
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => 
                  prevValues.name !== currentValues.name || 
                  prevValues.description !== currentValues.description || 
                  prevValues.image !== currentValues.image || 
                  prevValues.pointCost !== currentValues.pointCost
                }
              >
                {({ getFieldValue }) => {
                  const name = getFieldValue('name');
                  const description = getFieldValue('description');
                  const image = getFieldValue('image');
                  const pointCost = getFieldValue('pointCost');
                  
                  return name ? (
                    <div style={{ marginTop: 16 }}>
                      <Divider orientation="left">预览效果</Divider>
                      <div style={{ width: 240 }}>
                        <Card
                          hoverable
                          cover={
                            <div style={{ 
                              width: '100%', 
                              paddingTop: '100%', /* 1:1 宽高比 */
                              position: 'relative', 
                              overflow: 'hidden',
                              background: '#f5f5f5'
                            }}>
                              <img 
                                alt={name} 
                                src={image || DEFAULT_ITEM_IMAGE} 
                                style={{ 
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  // 防止无限重试，直接使用内置的base64占位图
                                  e.target.onerror = null; // 防止再次触发错误
                                  e.target.src = DEFAULT_ITEM_IMAGE;
                                }}
                              />
                            </div>
                          }
                          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                        >
                          <Card.Meta 
                            title={name}
                            description={
                              <div style={{ height: 60, overflow: 'hidden', marginBottom: 16, color: '#666' }}>
                                {description || '暂无描述'}
                              </div>
                            }
                          />
                          <div style={{ marginTop: 'auto' }}>
                            <Divider style={{ margin: '12px 0' }} />
                            <Text strong style={{ color: '#1890ff', fontSize: 18 }}>
                              {pointCost || 0} 积分
                            </Text>
                          </div>
                        </Card>
                      </div>
                    </div>
                  ) : null;
                }}
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>

      {/* 创建/编辑众筹活动对话框 */}
      <Modal
        title={batchCreateMode ? '批量创建众筹活动' : 
              crowdfundingModalMode === 'create' ? '创建众筹活动' : '编辑众筹活动'}
        open={crowdfundingModalVisible}
        onCancel={handleCloseCrowdfundingDialog}
        width={800}
        footer={[
          <Button key="cancel" onClick={handleCloseCrowdfundingDialog}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={crowdfundingLoading} onClick={handleSubmitCrowdfunding}>
            保存
          </Button>
        ]}
      >
        <Form
          form={crowdfundingForm}
          layout="vertical"
        >
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <Form.Item
                name="title"
                label="活动标题"
                rules={[{ required: true, message: '请输入活动标题' }]}
              >
                <Input placeholder="请输入活动标题" />
              </Form.Item>
              
              <Form.Item
                name="targetPoints"
                label="目标积分"
                rules={[
                  { required: true, message: '请输入目标积分' },
                  { type: 'number', min: 100, message: '目标积分最少100分' }
                ]}
              >
                <InputNumber min={100} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="type"
                label="众筹类型"
                rules={[{ required: true, message: '请选择众筹类型' }]}
              >
                <Select>
                  <Option value="network_time">上网时间</Option>
                  <Option value="game">小游戏</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
              
              <Form.Item
                name="reward.type"
                label="奖励类型"
                rules={[{ required: true, message: '请选择奖励类型' }]}
              >
                <Select>
                  <Option value="network_time">上网时间</Option>
                  <Option value="game">小游戏</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
              
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues['reward.type'] !== currentValues['reward.type']}
              >
                {({ getFieldValue }) => 
                  getFieldValue('reward.type') === 'network_time' ? (
                    <Form.Item
                      name="reward.duration"
                      label="奖励时间（分钟）"
                      rules={[
                        { required: true, message: '请输入奖励时间' },
                        { type: 'number', min: 1, message: '奖励时间必须大于0' }
                      ]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
              
              <Form.Item
                name="reward.description"
                label="奖励描述"
              >
                <Input placeholder="请输入奖励描述" />
              </Form.Item>

              <Divider orientation="left">班级设置</Divider>
              
              {batchCreateMode ? (
                <Form.Item
                  label="选择班级"
                  required
                  tooltip="请选择要创建众筹活动的班级"
                >
                  <Checkbox.Group 
                    style={{ width: '100%' }}
                    onChange={handleBatchClassSelectionChange}
                  >
                    <Row>
                      {classes.map(cls => (
                        <Col span={8} key={cls._id}>
                          <Checkbox value={cls._id}>
                            {cls.grade}年级{cls.name}班
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                  <div style={{ marginTop: 8, color: '#ff4d4f' }}>
                    {selectedClassIds.length === 0 && '请至少选择一个班级'}
                  </div>
                </Form.Item>
              ) : (
                <Form.Item
                  name="classId"
                  label="选择班级"
                  rules={[{ required: true, message: '请选择班级' }]}
                >
                  <Select
                    placeholder="请选择班级"
                    loading={classesLoading}
                    style={{ width: '100%' }}
                  >
                    {classes.map(cls => (
                      <Option key={cls._id} value={cls._id}>
                        {cls.grade}年级{cls.name}班
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
            </div>
            
            <div style={{ flex: 1 }}>
              <Form.Item
                name="startDate"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="endDate"
                label="结束时间"
                rules={[{ required: true, message: '请选择结束时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item
                name="image"
                label="活动图片URL"
              >
                <Input placeholder="请输入活动图片URL" />
              </Form.Item>
              
              <Form.Item
                name="description"
                label="活动描述"
              >
                <TextArea rows={4} placeholder="请输入活动描述" />
              </Form.Item>
            </div>
          </div>
        </Form>
      </Modal>

      {/* 众筹活动详情对话框 */}
      <Modal
        title="众筹活动详情"
        open={crowdfundingDetailsModalVisible}
        onCancel={handleCloseCrowdfundingDetailsDialog}
        footer={[
          <Button key="close" onClick={handleCloseCrowdfundingDetailsDialog}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedCrowdfunding && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              {selectedCrowdfunding.image ? (
                <img 
                  src={selectedCrowdfunding.image} 
                  alt={selectedCrowdfunding.title} 
                  style={{ maxWidth: '100%', maxHeight: 300 }} 
                />
              ) : (
                <div style={{ 
                  background: '#f0f2f5', 
                  height: 200, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}>
                  <Text type="secondary">暂无图片</Text>
                </div>
              )}
            </div>
            
            <Title level={4}>
              {selectedCrowdfunding.title}
              <Tag 
                color={
                  selectedCrowdfunding.status === 'active' ? 'green' : 
                  selectedCrowdfunding.status === 'completed' ? 'blue' : 
                  selectedCrowdfunding.status === 'expired' ? 'red' : 'default'
                }
                style={{ marginLeft: 8 }}
              >
                {selectedCrowdfunding.status === 'pending' ? '待开始' :
                 selectedCrowdfunding.status === 'active' ? '进行中' :
                 selectedCrowdfunding.status === 'completed' ? '已完成' : '已过期'}
              </Tag>
            </Title>
            
            <Paragraph>{selectedCrowdfunding.description || '暂无描述'}</Paragraph>
            
            <Divider />
            
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>进度</Title>
              <Progress 
                percent={Math.round((selectedCrowdfunding.currentPoints / selectedCrowdfunding.targetPoints) * 100)} 
                status={selectedCrowdfunding.currentPoints >= selectedCrowdfunding.targetPoints ? "success" : "active"} 
                format={() => `${selectedCrowdfunding.currentPoints}/${selectedCrowdfunding.targetPoints}`}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Text>参与人数: {selectedCrowdfunding.participantsCount || 0}</Text>
                <Text>贡献记录: {selectedCrowdfunding.contributionsCount || 0}</Text>
              </div>
            </div>
            
            <Divider />
            
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>奖励信息</Title>
              <div>
                <Text strong>类型: </Text>
                <Text>
                  {selectedCrowdfunding.reward?.type === 'network_time' ? '上网时间' :
                   selectedCrowdfunding.reward?.type === 'game' ? '小游戏' : '其他'}
                </Text>
              </div>
              {selectedCrowdfunding.reward?.duration > 0 && (
                <div>
                  <Text strong>时长: </Text>
                  <Text>{selectedCrowdfunding.reward.duration} 分钟</Text>
                </div>
              )}
              {selectedCrowdfunding.reward?.description && (
                <div>
                  <Text strong>描述: </Text>
                  <Text>{selectedCrowdfunding.reward.description}</Text>
                </div>
              )}
            </div>
            
            <Divider />
            
            <div>
              <Text strong>创建时间: </Text>
              <Text>{new Date(selectedCrowdfunding.createdAt).toLocaleString()}</Text>
            </div>
            <div>
              <Text strong>开始时间: </Text>
              <Text>{new Date(selectedCrowdfunding.startDate).toLocaleString()}</Text>
            </div>
            <div>
              <Text strong>结束时间: </Text>
              <Text>{new Date(selectedCrowdfunding.endDate).toLocaleString()}</Text>
            </div>
          </div>
        )}
      </Modal>

      {/* 学生积分明细对话框 */}
      <Modal
        title="学生积分明细"
        open={pointTransactionsModalVisible}
        onCancel={() => {
          setPointTransactionsModalVisible(false);
          setSelectedStudent(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPointTransactionsModalVisible(false);
            setSelectedStudent(null);
          }}>
            关闭
          </Button>
        ]}
        width={1000}
      >
        {selectedStudent && studentDetail && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Avatar 
                  size={64} 
                  src={studentDetail.avatar} 
                  icon={!studentDetail.avatar && <UserOutlined />}
                  style={{ marginRight: 16 }}
                />
                <div>
                  <Title level={4} style={{ margin: 0 }}>{studentDetail.name}</Title>
                  <div>
                    <Text type="secondary">学号：{studentDetail.username}</Text>
                  </div>
                  <div>
                    <Text type="secondary">
                      班级：{studentDetail.className ? `${studentDetail.grade}年级${studentDetail.className}班` : '未分配班级'}
                    </Text>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                  <Statistic 
                    title="当前积分" 
                    value={studentDetail.totalPoints} 
                    valueStyle={{ color: '#1890ff' }}
                  />
                </div>
              </div>
            </Card>
            
            <Divider>积分明细记录</Divider>
            
            <Table
              columns={[
                {
                  title: '积分来源/用途',
                  dataIndex: 'type',
                  key: 'type',
                  width: 280,
                  filters: [
                    { text: '完成任务', value: 'task_completion' },
                    { text: '完成测验', value: 'quiz_completion' },
                    { text: '出勤奖励', value: 'attendance' },
                    { text: '积分商城购买', value: 'shop_purchase' },
                    { text: '参与众筹活动', value: 'crowdfunding' },
                    { text: '系统奖励', value: 'system_reward' },
                    { text: '教师奖励', value: 'teacher_reward' },
                    { text: '其他', value: 'other' }
                  ],
                  onFilter: (value, record) => record.type === value,
                  render: (type, record) => {
                    // 积分交易类型映射
                    const typeMap = {
                      'task_completion': '完成任务',
                      'quiz_completion': '完成测验',
                      'attendance': '出勤奖励',
                      'shop_purchase': '积分商城购买',
                      'crowdfunding': '参与众筹活动',
                      'system_reward': '系统奖励',
                      'teacher_reward': '教师奖励',
                      'activity_completion': '完成活动',
                      'course_completion': '完成课程',
                      'achievement_unlock': '解锁成就',
                      'login_bonus': '登录奖励',
                      'streak_bonus': '连续学习奖励',
                      'other': '其他'
                    };
                    
                    return (
                      <div>
                        <div>
                          <Tag color={record.amount > 0 ? 'green' : 'red'}>
                            {typeMap[type] || type}
                          </Tag>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                            {record.description}
                          </Text>
                        </div>
                      </div>
                    );
                  }
                },
                {
                  title: '积分变动',
                  dataIndex: 'amount',
                  key: 'amount',
                  width: 120,
                  sorter: (a, b) => a.amount - b.amount,
                  render: (amount) => {
                    return (
                      <Text style={{ color: amount > 0 ? '#52c41a' : '#f5222d' }}>
                        {amount > 0 ? `+${amount}` : amount}
                      </Text>
                    );
                  }
                },
                {
                  title: '时间',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  width: 180,
                  sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
                  defaultSortOrder: 'descend',
                  render: (time) => new Date(time).toLocaleString('zh-CN'),
                },
              ]}
              dataSource={pointTransactions}
              rowKey="_id"
              loading={pointTransactionsLoading}
              pagination={{
                total: pointTransactionsTotal,
                current: pointTransactionsPage,
                pageSize: pointTransactionsPageSize,
                onChange: handlePointTransactionsPageChange
              }}
              locale={{ emptyText: '暂无积分明细' }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}
        
        {(!selectedStudent || !studentDetail) && !pointTransactionsLoading && (
          <Empty description="暂无学生数据" />
        )}
        
        {pointTransactionsLoading && !pointTransactions.length && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Spin tip="加载中..." />
          </div>
        )}
      </Modal>

      {/* 学生兑换记录模态框 */}
      <Modal
        title="学生兑换记录"
        open={redemptionModalVisible}
        onCancel={() => {
          setRedemptionModalVisible(false);
          setSelectedStudentForRedemption(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setRedemptionModalVisible(false);
            setSelectedStudentForRedemption(null);
          }}>
            关闭
          </Button>
        ]}
        width={1000}
      >
        {selectedStudentForRedemption && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{selectedStudentForRedemption.name}</Title>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">兑换记录</Text>
                  </div>
                </div>
              </div>
            </Card>
            
            <Divider>兑换记录列表</Divider>
            
            <Table
              columns={[
                {
                  title: '商品名称',
                  dataIndex: 'itemName',
                  key: 'itemName',
                  width: 200,
                },
                {
                  title: '商品类型',
                  dataIndex: 'itemType',
                  key: 'itemType',
                  width: 120,
                  filters: [
                    { text: '上网时间', value: 'network_time' },
                    { text: '小游戏', value: 'game' },
                    { text: '徽章', value: 'badge' },
                    { text: '虚拟物品', value: 'virtual_item' },
                    { text: '众筹活动', value: 'crowdfunding' }
                  ],
                  onFilter: (value, record) => record.itemType === value,
                  render: (type) => {
                    const typeLabels = {
                      'network_time': '上网时间',
                      'game': '小游戏',
                      'badge': '徽章',
                      'virtual_item': '虚拟物品',
                      'crowdfunding': '众筹活动'
                    };
                    return <Tag color={
                      type === 'network_time' ? 'green' : 
                      type === 'game' ? 'blue' : 
                      type === 'badge' ? 'purple' : 
                      type === 'crowdfunding' ? 'gold' : 'orange'
                    }>{typeLabels[type] || type}</Tag>;
                  }
                },
                {
                  title: '消耗积分',
                  dataIndex: 'pointCost',
                  key: 'pointCost',
                  width: 100,
                  sorter: (a, b) => a.pointCost - b.pointCost,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  filters: [
                    { text: '待使用', value: 'pending' },
                    { text: '已使用', value: 'completed' },
                    { text: '已过期', value: 'expired' }
                  ],
                  onFilter: (value, record) => record.status === value,
                  render: (status, record) => {
                    const statusMap = {
                      'pending': { color: 'gold', text: '待使用' },
                      'completed': { color: 'green', text: '已使用' },
                      'expired': { color: 'red', text: '已过期' }
                    };
                    return <Tag color={statusMap[status]?.color || 'default'}>{statusMap[status]?.text || status}</Tag>;
                  }
                },
                {
                  title: '兑换/贡献时间',
                  dataIndex: 'redeemTime',
                  key: 'redeemTime',
                  width: 180,
                  sorter: (a, b) => new Date(a.redeemTime) - new Date(b.redeemTime),
                  defaultSortOrder: 'descend',
                  render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
                },
                {
                  title: '使用时间',
                  dataIndex: 'useTime',
                  key: 'useTime',
                  width: 180,
                  render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-',
                },
                {
                  title: '备注',
                  dataIndex: 'message',
                  key: 'message',
                  render: (message, record) => {
                    if (record.recordType === 'crowdfunding' && message) {
                      return <Tooltip title={message}>
                        <div style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {message}
                        </div>
                      </Tooltip>;
                    }
                    return '-';
                  }
                }
              ]}
              dataSource={studentRedemptionModal}
              rowKey="_id"
              loading={studentRedemptionModalLoading}
              pagination={{ pageSize: 10 }}
              locale={{ emptyText: '暂无兑换记录' }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}
        
        {!selectedStudentForRedemption && !studentRedemptionModalLoading && (
          <Empty description="暂无学生数据" />
        )}
        
        {studentRedemptionModalLoading && !studentRedemptionModal.length && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Spin tip="加载中..." />
          </div>
        )}
      </Modal>

      {/* 调整积分对话框 */}
      <Modal
        title="调整学生积分"
        open={adjustPointsModalVisible}
        onCancel={handleCloseAdjustPointsModal}
        footer={[
          <Button key="cancel" onClick={handleCloseAdjustPointsModal}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={adjustPointsLoading} 
            onClick={handleSubmitAdjustPoints}
          >
            确定
          </Button>
        ]}
      >
        {adjustingStudent && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Avatar 
                size="large" 
                src={adjustingStudent.avatar} 
                icon={!adjustingStudent.avatar && <UserOutlined />}
                style={{ marginRight: 12 }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 'bold' }}>{adjustingStudent.name}</div>
                <div style={{ color: '#888' }}>
                  {adjustingStudent.class && `${adjustingStudent.class.grade}年级${adjustingStudent.class.name}班`}
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Statistic
                  title="当前积分"
                  value={adjustingStudent.totalPoints || 0}
                  valueStyle={{ color: '#1890ff' }}
                />
              </div>
            </div>
            
            <Form
              form={adjustPointsForm}
              layout="vertical"
            >
              <Form.Item
                name="operationType"
                label="操作类型"
                rules={[{ required: true, message: '请选择操作类型' }]}
                initialValue="add"
              >
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="add">
                    <PlusCircleOutlined /> 增加积分
                  </Radio.Button>
                  <Radio.Button value="deduct">
                    <MinusCircleOutlined /> 扣除积分
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item
                name="amount"
                label="积分数量"
                rules={[
                  { required: true, message: '请输入积分数量' },
                  { type: 'number', min: 1, message: '积分数量必须大于0' }
                ]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="请输入积分数量"
                />
              </Form.Item>
              
              <Form.Item
                name="reason"
                label="调整原因"
                rules={[{ required: true, message: '请输入调整原因' }]}
              >
                <Input.TextArea 
                  placeholder="请输入调整积分的原因"
                  rows={3}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 众筹贡献详情对话框 */}
      <Modal
        title="众筹贡献详情"
        open={contributionsModalVisible}
        onCancel={handleCloseContributionsDialog}
        footer={[
          <Button key="close" onClick={handleCloseContributionsDialog}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedCrowdfundingForContributions && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>{selectedCrowdfundingForContributions.title}</Title>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      目标积分: {selectedCrowdfundingForContributions.targetPoints} | 
                      当前进度: {selectedCrowdfundingForContributions.currentPoints}/{selectedCrowdfundingForContributions.targetPoints}
                    </Text>
                  </div>
                </div>
              </div>
            </Card>
            
            <Divider>学生贡献记录</Divider>
            
            <List
              loading={contributionsLoading}
              dataSource={contributions}
              locale={{ emptyText: '暂无贡献记录' }}
              pagination={{
                pageSize: 10,
                hideOnSinglePage: true
              }}
              renderItem={item => (
                <List.Item
                  key={item._id}
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="删除贡献记录"
                      description={
                        <div>
                          <p>此操作将永久删除此贡献记录。</p>
                          <p style={{ color: '#ff4d4f' }}>
                            <WarningOutlined /> 学生贡献的积分将<b>不会</b>返还！
                          </p>
                          <p>是否继续？</p>
                        </div>
                      }
                      onConfirm={() => handleDeleteContribution(item._id)}
                      okText="删除"
                      okType="danger"
                      cancelText="取消"
                    >
                      <Button 
                        danger 
                        type="text" 
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        src={item.studentId?.avatar} 
                        icon={!item.studentId?.avatar && <UserOutlined />}
                      />
                    }
                    title={
                      <div>
                        <Space>
                          <span>{item.studentId?.name}</span>
                          <Tag color="blue">{item.points} 积分</Tag>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {new Date(item.timestamp).toLocaleString('zh-CN')}
                          </Text>
                        </Space>
                      </div>
                    }
                    description={
                      item.message ? (
                        <div style={{ 
                          padding: '8px', 
                          background: '#f5f5f5', 
                          borderRadius: '4px',
                          marginTop: '4px'
                        }}>
                          {item.message}
                        </div>
                      ) : (
                        <Text type="secondary">无留言</Text>
                      )
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
        
        {!selectedCrowdfundingForContributions && !contributionsLoading && (
          <Empty description="未选择众筹活动" />
        )}
        
        {contributionsLoading && !contributions.length && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Spin tip="加载中..." />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PointShopManagement; 