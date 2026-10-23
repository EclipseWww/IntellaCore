import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, Typography, Button, Tabs, Alert, Modal, 
  Space, Spin, Grid, Divider, Empty, Table, Tag,
  List, Progress, Avatar, Row, Col, Badge
} from 'antd';
import { useNavigate } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { 
  getShopItems, 
  redeemItem, 
  getRedemptionRecords,
  useNetworkTime,
  updateGameRecord
} from '../../services/pointShopService';
import { 
  getCrowdfundingList,
  getMyParticipations 
} from '../../services/crowdfundingService';
import { getPointBalance, getPointTransactions } from '../../services/achievementService';
import { TeamOutlined, TrophyOutlined, CalendarOutlined, ShoppingOutlined, HistoryOutlined, WalletOutlined } from '@ant-design/icons';
import CrowdfundingListView from '../../components/Crowdfunding/CrowdfundingListView';
import CrowdfundingDetailView from '../../components/Crowdfunding/CrowdfundingDetailView';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Meta } = Card;
const { useBreakpoint } = Grid;

// 默认图片的base64编码，简单的灰色占位图
const DEFAULT_ITEM_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjYWFhIj7mmoLml6Dlm77niYc8L3RleHQ+PC9zdmc+';

// 状态映射常量
const STATUS_MAPS = {
  colors: {
    pending: 'default',
    active: 'green',
    completed: 'blue',
    expired: 'red'
  },
  names: {
    pending: '即将开始',
    active: '进行中',
    completed: '已完成',
    expired: '已过期'
  }
};

// 交易类型映射
const TRANSACTION_TYPE_MAPS = {
  task_completion: { color: 'green', text: '任务完成' },
  quiz_reward: { color: 'geekblue', text: '测验奖励' },
  course_completion: { color: 'purple', text: '课程完成' },
  shop_purchase: { color: 'red', text: '商店购买' },
  system_reward: { color: 'orange', text: '系统奖励' },
  crowdfunding: { color: 'cyan', text: '众筹活动' },
  default: { color: 'blue', text: '其他' }
};

// 商品卡片组件
const ItemCard = ({ item, onRedeem, userPoints }) => {
  const canRedeem = userPoints >= item.pointCost;
  
  return (
    <div className="item-card" style={{
      width: '100%',
      height: '100%',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      transition: 'all 0.3s',
      cursor: 'pointer',
      position: 'relative',
      border: '1px solid #eee',
      height: '310px' // 固定高度
    }}>
      {/* 图片容器 */}
        <div style={{ 
          width: '100%', 
        height: '160px',
          position: 'relative', 
          overflow: 'hidden',
        backgroundColor: '#f5f5f5'
        }}>
          <img 
            alt={item.name} 
            src={item.image || DEFAULT_ITEM_IMAGE} 
            style={{ 
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={(e) => {
            e.target.onerror = null;
              e.target.src = DEFAULT_ITEM_IMAGE;
            }}
          />
        </div>
      
      {/* 内容区域 */}
      <div style={{ 
        padding: '10px', 
        display: 'flex', 
        flexDirection: 'column',
        flex: 1
      }}>
        {/* 标题 */}
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '15px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: '6px'
        }}>
          {item.name}
          {(item.type === 'network_time' || item.type === 'game') && item.duration > 0 && (
            <span style={{ 
              fontSize: '12px', 
              color: '#52c41a', 
              marginLeft: '6px',
              border: '1px solid #52c41a',
              borderRadius: '3px',
              padding: '0 4px'
            }}>
              {item.duration}分钟
            </span>
          )}
        </div>
        
        {/* 描述 */}
        <div style={{ 
          fontSize: '13px',
          color: '#666',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          marginBottom: '8px',
          flex: 1,
          height: '40px'
        }}>
            {item.description || '暂无描述'}
          </div>
        
        {/* 分隔线 */}
        <div style={{ 
          height: '1px', 
          background: '#f0f0f0', 
          margin: '2px 0 8px' 
        }} />
        
        {/* 底部区域 */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* 积分 */}
          <div style={{ 
            color: '#1890ff', 
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {item.pointCost} 积分
          </div>
          
          {/* 兑换按钮 */}
          <Button 
            type={canRedeem ? "primary" : "default"}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRedeem(item);
            }}
            disabled={!canRedeem}
            style={{
              fontSize: '12px',
              height: '24px',
              padding: '0 8px'
            }}
          >
            {canRedeem ? '兑换' : '积分不足'}
          </Button>
        </div>
        
        {/* 库存信息 */}
        {item.stock !== -1 && (
          <div style={{ 
            fontSize: '12px', 
            color: '#999',
            marginTop: '4px'
          }}>
            库存: {item.stock}
          </div>
        )}
      </div>
    </div>
  );
};

// 兑换记录卡片组件
const RedemptionCard = ({ record, onUseNetworkTime, onAddGameTime }) => {
  const isNetworkTime = record.itemType === 'network_time';
  const isGame = record.itemType === 'game';
  const isPending = record.status === 'pending';
  const isExpired = record.status === 'expired';
  const isCompleted = record.status === 'completed';
  
  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 确定卡片的背景色和状态标签
  const getCardStyle = () => {
    if (isExpired) {
      return { 
        background: '#f5f5f5', 
        filter: 'grayscale(0.8)',
        borderColor: '#d9d9d9'
      };
    } else if (isCompleted) {
      return { 
        background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
        borderColor: '#91d5ff'
      };
    } else {
      return { 
        background: 'linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)',
        borderColor: '#ffa940'
      };
    }
  };

  return (
    <div 
      style={{
        width: '100%',
        maxWidth: '550px',
        marginBottom: 15,
        position: 'relative',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.09)',
        overflow: 'hidden',
        margin: '0 auto'
      }}
    >
      {/* 上半部分 */}
      <div 
        style={{
          padding: '16px',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          position: 'relative',
          ...getCardStyle()
        }}
      >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{record.itemName}</Text>
              <Tag color={
                  record.itemType === 'network_time' ? '#1890ff' :
                  record.itemType === 'game' ? '#52c41a' :
                  record.itemType === 'badge' ? '#722ed1' : '#fa8c16'
                } style={{ marginLeft: 8 }}>
                  {record.itemType === 'network_time' ? '上网时间' :
                   record.itemType === 'game' ? '游戏时长' :
                   record.itemType === 'badge' ? '徽章' : '虚拟物品'}
                </Tag>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>兑换编号: {record._id.substring(0, 8).toUpperCase()}</Text>
            </div>
          </div>
          <Tag 
            color={
              isExpired ? 'red' : 
              isCompleted ? 'blue' : 
              'green'
            }
            style={{ padding: '0 8px', fontSize: 12, height: 22, lineHeight: '22px' }}
        >
          {isExpired ? '已过期' : isCompleted ? '已使用' : '待使用'}
          </Tag>
      </div>
        
        <div 
          style={{
            height: '1px',
            background: 'repeating-linear-gradient(to right, rgba(0,0,0,0.12), rgba(0,0,0,0.12) 4px, transparent 4px, transparent 8px)',
            margin: '12px 0 14px',
            width: '100%'
          }}
        />
        
        <Row gutter={12}>
          <Col span={12}>
            <div style={{ fontSize: 13 }}>
              <Text style={{ color: '#666' }}>价值:</Text>
              <div style={{ marginTop: 2 }}><Text strong style={{ color: '#1890ff' }}>{record.pointCost}</Text> 积分</div>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 13 }}>
              {(record.itemType === 'network_time' || record.itemType === 'game') && record.duration > 0 ? (
                <>
                  <Text style={{ color: '#666' }}>时长:</Text>
                  <div><Text strong style={{ color: '#52c41a' }}>{record.duration}</Text> 分钟</div>
                </>
              ) : (
                <div style={{ height: '36px' }}></div> // 占位符，保持高度一致
              )}
            </div>
          </Col>
        </Row>
      </div>
      
      {/* 锯齿边界 - 改进实现方式，使用波浪线代替 */}
      <div style={{ 
        height: '6px', 
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'white'
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '-5px',
          height: '10px',
          backgroundImage: 'radial-gradient(circle at 3px 3px, transparent 0, transparent 2px, white 2px, white)',
          backgroundSize: '6px 6px',
          backgroundPosition: 'center top',
          zIndex: 2
        }} />
      </div>

      {/* 下半部分 */}
      <div
        style={{
          padding: '12px 16px',
          background: '#fff',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ fontSize: 13 }}>
            <Text style={{ color: '#666' }}>兑换时间:</Text>
            <div style={{ marginTop: 2 }}>{formatDate(record.redeemTime)}</div>
          </div>
          
          {isCompleted && record.useTime && (
            <div style={{ fontSize: 13 }}>
              <Text style={{ color: '#666' }}>使用时间:</Text>
              <div style={{ marginTop: 2 }}>{formatDate(record.useTime)}</div>
            </div>
          )}
        </div>
        <div>
      {isNetworkTime && isPending && (
        <Button 
          type="primary" 
              icon={<CalendarOutlined />}
          onClick={() => onUseNetworkTime(record._id)}
              size="small"
        >
          使用上网时间
        </Button>
      )}
      
      {isGame && isPending && (
        <Button 
          type="primary" 
              icon={<TrophyOutlined />}
          onClick={() => onAddGameTime(record._id)}
              size="small"
        >
          增加游戏时长
        </Button>
      )}

      {isPending && !isNetworkTime && !isGame && (
        <Button 
          type="primary" 
          onClick={() => onUseNetworkTime(record._id)}
          size="small"
        >
          确认使用
        </Button>
      )}
        </div>
      </div>
      
      {/* 圆形边角装饰 */}
      <div 
        style={{ 
          position: 'absolute', 
          left: -8, 
          top: 'calc(50% - 8px)', 
          width: 16, 
          height: 16, 
          borderRadius: '50%', 
          background: '#fff',
          boxShadow: 'inset 0 0 3px rgba(0,0,0,0.1)',
          zIndex: 2
        }} 
      />
      <div 
        style={{ 
          position: 'absolute', 
          right: -8, 
          top: 'calc(50% - 8px)', 
          width: 16, 
          height: 16, 
          borderRadius: '50%', 
          background: '#fff',
          boxShadow: 'inset 0 0 3px rgba(0,0,0,0.1)',
          zIndex: 2
        }} 
      />
    </div>
  );
};

const PointShop = () => {
  usePageTitle('积分商店');
  const navigate = useNavigate();
  const screens = useBreakpoint();
  
  // 基本状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tabKey, setTabKey] = useState('1');
  const [userPoints, setUserPoints] = useState(0);
  
  // 数据状态
  const [items, setItems] = useState([]);
  const [records, setRecords] = useState([]);
  const [pointTransactions, setPointTransactions] = useState([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [crowdfundings, setCrowdfundings] = useState([]);
  const [myParticipations, setMyParticipations] = useState([]);
  
  // 加载状态
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [pointsLoaded, setPointsLoaded] = useState(false);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [crowdfundingsLoaded, setCrowdfundingsLoaded] = useState(false);
  const [participationsLoaded, setParticipationsLoaded] = useState(false);
  
  // 分页状态
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(10);
  
  // 交互状态
  const [selectedCrowdfunding, setSelectedCrowdfunding] = useState(null);
  
  // 对话框状态
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    item: null
  });
  
  const [resultDialog, setResultDialog] = useState({
    open: false,
    success: false,
    message: '',
    networkDuration: 0,
    gameDuration: 0
  });

  // 分类商品的备忘录
  const categorizedItems = useMemo(() => {
    return {
      networkTimeItems: items.filter(item => item.type === 'network_time'),
      gameItems: items.filter(item => item.type === 'game'),
      badgeItems: items.filter(item => item.type === 'badge'),
      virtualItems: items.filter(item => item.type === 'virtual_item')
    };
  }, [items]);
  
  // 加载基础数据（商品列表、兑换记录、积分余额）
  const loadBaseData = async () => {
    try {
          setLoading(true);
        setError(null);
        
      // 并行加载数据
      const [itemsRes, recordsRes, pointsRes] = await Promise.all([
        !itemsLoaded ? getShopItems() : { success: true, items },
        !recordsLoaded ? getRedemptionRecords() : { success: true, records },
        !pointsLoaded ? getPointBalance() : { success: true, totalPoints: userPoints }
      ]);
      
      if (itemsRes.success) {
        setItems(itemsRes.items);
        setItemsLoaded(true);
      }
      
      if (recordsRes.success) {
        setRecords(recordsRes.records);
        setRecordsLoaded(true);
      }
      
      if (pointsRes.success) {
        setUserPoints(pointsRes.totalPoints);
        setPointsLoaded(true);
          }
        } catch (err) {
      console.error('加载基础数据失败:', err);
      setError('加载数据失败，请稍后再试');
      
      // 从本地存储获取用户积分作为备选
      try {
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          if (userData.totalPoints) {
            setUserPoints(userData.totalPoints);
        }
      } catch (e) {
        console.error('解析本地用户数据失败:', e);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // 加载交易记录
  const loadPointTransactions = async (page = transactionPage, pageSize = transactionPageSize) => {
    if (transactionsLoaded && page === transactionPage) return;
    
    try {
      setLoading(true);
      const skip = (page - 1) * pageSize;
      const response = await getPointTransactions({ limit: pageSize, skip });
      
      if (response.success) {
        setPointTransactions(response.transactions);
        setTransactionTotal(response.totalCount);
        setTransactionsLoaded(true);
      } else {
        setError('获取积分交易记录失败');
      }
      } catch (err) {
      console.error('加载积分交易记录失败:', err);
      setError('加载积分交易记录失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };
  
  // 加载众筹活动
  const loadCrowdfundings = async () => {
    if (crowdfundingsLoaded) return;
    
    try {
      setLoading(true);
      const response = await getCrowdfundingList({
        includeCompleted: true,
        includeExpired: true
      });
      
      if (response.success) {
        setCrowdfundings(response.crowdfundings);
        setCrowdfundingsLoaded(true);
      }
    } catch (error) {
      console.error('获取众筹活动列表失败:', error);
      setError('获取众筹活动列表失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };
  
  // 加载我参与的众筹记录
  const loadMyParticipations = async () => {
    if (participationsLoaded) return;
    
    try {
      setLoading(true);
      const response = await getMyParticipations();
      
      if (response.success) {
        setMyParticipations(response.participations);
        setParticipationsLoaded(true);
      }
    } catch (error) {
      console.error('获取我的参与记录失败:', error);
      setError('获取我的参与记录失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始化加载基础数据
  useEffect(() => {
    loadBaseData();
  }, []);
  
  // 预加载即将显示的标签页数据
  useEffect(() => {
    // 当前标签页数据加载
    switch (tabKey) {
      case '1': // 商品列表
        if (!itemsLoaded) loadBaseData();
        if (!crowdfundingsLoaded) loadCrowdfundings();
        break;
      case '2': // 我的兑换
        if (!recordsLoaded) loadBaseData();
        break;
      case '3': // 积分明细
        loadPointTransactions();
        break;
      default:
        break;
    }
    
    // 预加载下一个可能的标签页
    switch (tabKey) {
      case '1':
        if (!recordsLoaded) loadBaseData(); // 预加载兑换记录
        break;
      case '2':
        if (!transactionsLoaded) loadPointTransactions(); // 预加载积分明细
        break;
      default:
        break;
    }
  }, [tabKey]);

  // 处理标签切换
  const handleTabChange = (key) => {
    setTabKey(key);
  };
  
  // 打开确认兑换对话框
  const handleOpenConfirmDialog = (item) => {
    setConfirmDialog({
      open: true,
      item
    });
  };
  
  // 关闭确认兑换对话框
  const handleCloseConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      item: null
    });
  };
  
  // 处理兑换商品
  const handleRedeemItem = async () => {
    try {
      setLoading(true);
      const item = confirmDialog.item;
      
      // 关闭确认对话框
      handleCloseConfirmDialog();
      
      // 调用兑换API
      const response = await redeemItem(item._id);
      
      if (response.success) {
        // 更新积分
        setUserPoints(prev => prev - item.pointCost);
        
        // 更新商品库存
        setItems(prev => 
          prev.map(i => 
            i._id === item._id && i.stock !== -1 
              ? { ...i, stock: i.stock - 1 } 
              : i
          )
        );
        
        // 更新兑换记录
        setRecords(prev => [response.record, ...prev]);
        
        // 显示成功消息
        setResultDialog({
          open: true,
          success: true,
          message: '商品兑换成功！'
        });
      } else {
        // 显示错误消息
        setResultDialog({
          open: true,
          success: false,
          message: response.message || '兑换失败，请稍后再试'
        });
      }
    } catch (err) {
      console.error('兑换商品失败:', err);
      
      // 显示错误消息
      setResultDialog({
        open: true,
        success: false,
        message: '兑换失败，请稍后再试'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 关闭结果对话框
  const handleCloseResultDialog = () => {
    setResultDialog({
      ...resultDialog,
      open: false
    });
  };
  
  // 处理使用网络时间或其他类型兑换券
  const handleUseNetworkTime = async (recordId) => {
    try {
      setLoading(true);
      
      // 获取当前记录
      const currentRecord = records.find(record => record._id === recordId);
      const isNetworkTime = currentRecord && currentRecord.itemType === 'network_time';
      
      // 调用使用接口
      const response = await useNetworkTime(recordId);
      
      if (response.success) {
        // 更新兑换记录状态
        setRecords(prev => 
          prev.map(record => 
            record._id === recordId
              ? { ...record, status: 'completed', useTime: new Date() }
              : record
          )
        );
        
        // 显示成功消息
        setResultDialog({
          open: true,
          success: true,
          message: response.message || '兑换券已使用！',
          networkDuration: isNetworkTime ? (response.networkDuration || 0) : 0
        });
      } else {
        // 显示错误消息
        setResultDialog({
          open: true,
          success: false,
          message: response.message || '操作失败，请稍后再试'
        });
      }
    } catch (err) {
      console.error('使用兑换券失败:', err);
      
      // 显示错误消息
      setResultDialog({
        open: true,
        success: false,
        message: '操作失败，请稍后再试'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 处理增加游戏时长
  const handleAddGameTime = async (recordId) => {
    try {
      setLoading(true);
      
      // 调用更新游戏记录API
      const response = await updateGameRecord(recordId);
      
      if (response.success) {
        // 更新兑换记录状态
        setRecords(prev => 
          prev.map(record => 
            record._id === recordId
              ? { ...record, status: 'completed', useTime: new Date() }
              : record
          )
        );
        
        // 获取游戏时长
        const gameDuration = response.gameDuration || 15; // 默认15分钟

        // 以后端为准同步本地剩余时长（若提供）
        const TOTAL_GAME_TIME_KEY = 'total_game_time';
        const serverRemaining = Number(response.remainingSeconds);
        if (typeof serverRemaining === 'number' && !isNaN(serverRemaining) && serverRemaining >= 0) {
          localStorage.setItem(TOTAL_GAME_TIME_KEY, String(Math.floor(serverRemaining)));
        } else {
          // 兼容旧后端：本地累加
          const currentTime = parseInt(localStorage.getItem(TOTAL_GAME_TIME_KEY) || '0');
          localStorage.setItem(TOTAL_GAME_TIME_KEY, (currentTime + gameDuration * 60).toString());
        }
        
        // 显示成功消息
        setResultDialog({
          open: true,
          success: true,
          message: '游戏时长已增加！',
          gameDuration: gameDuration
        });
      } else {
        // 显示错误消息
        setResultDialog({
          open: true,
          success: false,
          message: response.message || '操作失败，请稍后再试'
        });
      }
    } catch (err) {
      console.error('增加游戏时长失败:', err);
      
      // 显示错误消息
      setResultDialog({
        open: true,
        success: false,
        message: '操作失败，请稍后再试'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染商品类别
  const renderItemCategory = (title, items, icon) => {
    if (items.length === 0) return null;
    
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 16,
          borderLeft: '4px solid #1890ff',
          paddingLeft: 10
        }}>
          {icon}
          <Title level={4} style={{ margin: 0, marginLeft: 8 }}>{title}</Title>
        </div>
        <Row gutter={[16, 24]}>
          {items.map(item => (
            <Col key={item._id} xs={24} sm={12} md={8} lg={6} xl={6} xxl={4}>
              <div style={{ height: '310px' }}>
                <ItemCard 
                  item={item} 
                  onRedeem={handleOpenConfirmDialog}
                  userPoints={userPoints}
                />
              </div>
            </Col>
          ))}
        </Row>
      </div>
    );
  };
  
  // 确定每行显示的卡片数量
  const getColSpan = () => {
    if (screens.xxl) return 6;
    if (screens.xl) return 6;
    if (screens.lg) return 8;
    if (screens.md) return 8;
    if (screens.sm) return 12;
    return 24;
  };
  
  const colSpan = getColSpan();

  // 处理查看众筹详情
  const handleViewCrowdfundingDetail = (crowdfunding) => {
    setSelectedCrowdfunding(crowdfunding);
  };

  // 处理返回众筹列表
  const handleBackToCrowdfundingList = () => {
    setSelectedCrowdfunding(null);
  };

  // 渲染众筹活动分类
  const renderCrowdfundingCategory = () => {
    if (!crowdfundingsLoaded || crowdfundings.length === 0) return null;
    
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 16,
          borderLeft: '4px solid #1890ff',
          paddingLeft: 10
        }}>
          <TeamOutlined />
          <Title level={4} style={{ margin: 0, marginLeft: 8 }}>积分众筹</Title>
        </div>
        
        {selectedCrowdfunding ? (
          <div>
            <CrowdfundingDetailView 
              crowdfundingId={selectedCrowdfunding._id} 
              onBack={handleBackToCrowdfundingList}
            />
          </div>
        ) : (
          <CrowdfundingListView 
            onViewDetails={handleViewCrowdfundingDetail} 
            isEmbedded={true}
            maxDisplay={3}
          />
        )}
      </div>
    );
  };

  // Tab项配置
  const tabItems = [
    {
      key: '1',
      label: <span><ShoppingOutlined /> 积分消费</span>,
      children: (
        <div>
          {loading && !itemsLoaded ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Spin size="large" />
              <p style={{ marginTop: 10 }}>加载商品中...</p>
            </div>
          ) : (
            <>
              {renderCrowdfundingCategory()}
              {renderItemCategory('上网时间', categorizedItems.networkTimeItems, <CalendarOutlined />)}
              {renderItemCategory('小游戏', categorizedItems.gameItems, <TrophyOutlined />)}
              {renderItemCategory('徽章', categorizedItems.badgeItems, <Badge count={categorizedItems.badgeItems.length} style={{ backgroundColor: '#52c41a' }} />)}
              {renderItemCategory('虚拟物品', categorizedItems.virtualItems, <ShoppingOutlined />)}
              
              {items.length === 0 && crowdfundings.length === 0 && !loading && itemsLoaded && crowdfundingsLoaded && (
                <Empty 
                  description="暂无商品" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ margin: '40px 0' }}
                />
              )}
            </>
          )}
        </div>
      )
    },
    {
      key: '2',
      label: <span><HistoryOutlined /> 我的兑换</span>,
      children: (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 10px' }}>
          {records.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {records
                .sort((a, b) => {
                  // 优先级：pending(待使用) > completed(已使用) > expired(已过期)
                  const statusOrder = { 
                    'pending': 0, 
                    'completed': 1, 
                    'expired': 2
                  };
                  // 先按状态排序
                  if (statusOrder[a.status] !== statusOrder[b.status]) {
                    return statusOrder[a.status] - statusOrder[b.status];
                  }
                  // 状态相同时按兑换时间倒序排列（新的在前）
                  return new Date(b.redeemTime) - new Date(a.redeemTime);
                })
                .map(record => (
                  <RedemptionCard 
                    key={record._id} 
                    record={record}
                    onUseNetworkTime={handleUseNetworkTime}
                    onAddGameTime={handleAddGameTime}
                  />
                ))}
            </div>
          ) : (
            <Empty 
              description="暂无兑换记录" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '40px 0', background: '#f9f9f9', padding: '40px', borderRadius: '8px' }}
            />
          )}
        </div>
      )
    },
    {
      key: '3',
      label: <span><WalletOutlined /> 积分明细</span>,
      children: (
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Table
            dataSource={pointTransactions}
            rowKey={(record) => record._id || record.timestamp}
            loading={loading}
            pagination={{
              current: transactionPage,
              pageSize: transactionPageSize,
              total: transactionTotal,
              onChange: (page, pageSize) => {
                setTransactionPage(page);
                setTransactionPageSize(pageSize);
                loadPointTransactions(page, pageSize);
              },
              showSizeChanger: true
            }}
            columns={[
              {
                title: '时间',
                dataIndex: 'timestamp',
                key: 'timestamp',
                render: (text) => new Date(text).toLocaleString('zh-CN')
              },
              {
                title: '积分变动',
                dataIndex: 'amount',
                key: 'amount',
                render: (amount) => (
                  <span style={{ color: amount > 0 ? '#52c41a' : '#f5222d' }}>
                    {amount > 0 ? `+${amount}` : amount}
                  </span>
                )
              },
              {
                title: '类型',
                dataIndex: 'type',
                key: 'type',
                render: (type) => {
                  const typeInfo = TRANSACTION_TYPE_MAPS[type] || TRANSACTION_TYPE_MAPS.default;
                  return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
                }
              },
              {
                title: '描述',
                dataIndex: 'description',
                key: 'description'
              }
            ]}
          />
        </div>
      )
    }
  ];

  if (loading && !itemsLoaded) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <Spin size="large" />
        <p style={{ marginTop: 10 }}>加载中...</p>
                            </div>
    );
  }
  
  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16,
        background: '#f5f5f5',
        padding: '12px 16px',
        borderRadius: '8px'
      }}>
        <Title level={3} style={{ margin: 0 }}>积分商店</Title>
        <div style={{ 
          background: '#e6f7ff', 
          padding: '8px 16px', 
          borderRadius: '4px',
          border: '1px solid #91d5ff'
        }}>
          <Text style={{ fontSize: 16 }}>
            当前积分: <Text style={{ color: '#1890ff', fontWeight: 'bold', fontSize: 18 }}>{userPoints}</Text>
          </Text>
                        </div>
      </div>
      
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}
      
      <Tabs 
        activeKey={tabKey} 
        onChange={handleTabChange}
        type="card"
        items={tabItems}
      />
      
      {/* 确认兑换对话框 */}
      <Modal
        title="确认兑换"
        open={confirmDialog.open}
        onOk={handleRedeemItem}
        onCancel={handleCloseConfirmDialog}
        okText="确认兑换"
        cancelText="取消"
      >
        {confirmDialog.item && (
          <div>
            <p>您确定要兑换 <Text strong>{confirmDialog.item.name}</Text> 吗？</p>
            <p>这将消耗您 <Text style={{ color: '#1890ff' }}>{confirmDialog.item.pointCost}</Text> 积分。</p>
            <p>您当前有 <Text style={{ color: '#1890ff' }}>{userPoints}</Text> 积分。</p>
          </div>
        )}
      </Modal>
      
      {/* 结果对话框 */}
      <Modal
        title={resultDialog.success ? "操作成功" : "操作失败"}
        open={resultDialog.open}
        onOk={handleCloseResultDialog}
        onCancel={handleCloseResultDialog}
        footer={[
          <Button key="ok" type="primary" onClick={handleCloseResultDialog}>
            确定
          </Button>
        ]}
      >
        <div>
          <Alert
            message={resultDialog.success ? "成功" : "失败"}
            description={resultDialog.message}
            type={resultDialog.success ? "success" : "error"}
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          {resultDialog.success && resultDialog.networkDuration > 0 && (
            <Text>
              您已获得 <Text strong>{resultDialog.networkDuration}</Text> 分钟的上网时间！
            </Text>
          )}
          
          {resultDialog.success && resultDialog.gameDuration > 0 && (
            <Text>
              您已增加 <Text strong>{resultDialog.gameDuration}</Text> 分钟的游戏时间！
            </Text>
          )}
        </div>
      </Modal>
      
      {/* 全局加载中遮罩 */}
      {loading && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.3)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  );
};

export default PointShop;