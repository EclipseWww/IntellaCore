import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Typography, Button, Empty, List, Tag, Modal, message, Alert, Badge, Segmented, Tooltip } from 'antd';
import { ClockCircleOutlined, TrophyOutlined, InfoCircleOutlined, LockOutlined, FireOutlined } from '@ant-design/icons';
import GameContainer from './GameContainer';
import gameService from '../../services/gameService';
import { LOCAL_GAMES, formatPlayTime } from './gameCatalog';

const { Title, Text, Paragraph } = Typography;

// 默认图片的base64编码，简单的灰色占位图
const DEFAULT_GAME_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzE4OTBmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjZmZmIj7psbzmuZbpl7Q8L3RleHQ+PC9zdmc+';

// 默认游戏时间限制（分钟）
const DEFAULT_GAME_TIME_LIMIT = 15;

// 本地存储键名
const TOTAL_GAME_TIME_KEY = 'total_game_time';
const GAME_START_TIME_KEY = 'game_start_time';


const GameCenter = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [disabled, setDisabled] = useState([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [sortMode, setSortMode] = useState('hot');

  // 热度：每个游戏累计被玩的时长
  useEffect(() => {
    gameService.getStats()
      .then(res => {
        setStats(Object.fromEntries((res.data || []).map(x => [x.gameId, x])));
        setDisabled(res.disabled || []);
        setTotalSeconds(res.totalSeconds || 0);
      })
      .catch(() => {});
  }, []);

  const rankedGames = useMemo(() => {
    const withHeat = LOCAL_GAMES.filter(g => !disabled.includes(g._id)).map((g, i) => ({ ...g, order: i, heat: stats[g._id]?.totalSeconds || 0, players: stats[g._id]?.playerCount || 0 }));
    const byHeat = [...withHeat].sort((a, b) => b.heat - a.heat || a.order - b.order);
    const rank = new Map(byHeat.filter(g => g.heat > 0).map((g, i) => [g._id, i + 1]));
    return (sortMode === 'hot' ? byHeat : withHeat).map(g => ({ ...g, rank: rank.get(g._id) }));
  }, [stats, sortMode, disabled]);
  const [error, setError] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [hasInitializedTime, setHasInitializedTime] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const saveTimerRef = useRef(null);
  const lastSyncedSecondsRef = useRef(null); // 记录最近一次从后端获取或成功保存的秒数
  const isDirtyRef = useRef(false); // 标记本地剩余时间是否相对后端发生变化
  const persistIntervalRef = useRef(null); // 节流：定期持久化
  const remainingTimeRef = useRef(0); // 供 interval 读取最新值

  // 加载游戏时间（从后端）
  useEffect(() => {
    const initializeTime = async () => {
      try {
        setLoading(true);
        setError(null);
        await initializeGameTime();
      } catch (err) {
        console.error('加载游戏时间失败:', err);
        setError('加载游戏时间失败，请稍后再试');
      } finally {
        setLoading(false);
      }
    };

    initializeTime();

    // 清理函数：当组件卸载时，保存当前剩余时间
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
      }
      // 仅在确有变更时才回写后端，避免把后端有效值覆盖为0
      if (isDirtyRef.current && lastSyncedSecondsRef.current !== remainingTime) {
        persistRemainingTime();
      }
    };
  }, []);

  // 跟踪最新剩余时间供 interval 使用
  useEffect(() => {
    remainingTimeRef.current = remainingTime;
  }, [remainingTime]);

  // 当开始/结束游戏时，启动/清理节流持久化（每10秒）
  useEffect(() => {
    if (activeGame) {
      // 启动节流定时器
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
      }
      persistIntervalRef.current = setInterval(() => {
        if (isDirtyRef.current && lastSyncedSecondsRef.current !== remainingTimeRef.current) {
          persistRemainingTime();
        }
      }, 10000); // 每10秒持久化一次
    } else {
      // 结束游戏时清理
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
        persistIntervalRef.current = null;
      }
    }

    return () => {
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
        persistIntervalRef.current = null;
      }
    };
  }, [activeGame]);

  // 初始化或加载总游戏时间（后端优先，本地为兜底）
  const initializeGameTime = async () => {
    if (hasInitializedTime) return;

    try {
      const res = await gameService.getRemainingTime();
      if (res && res.success) {
        const serverSeconds = Number(res.remainingSeconds) || 0;
        setRemainingTime(serverSeconds);
        lastSyncedSecondsRef.current = serverSeconds;
        // 处理锁定状态
        if (res.isLocked) {
          setIsLocked(true);
          setLockMessage(res.lockMessage || '游戏暂时不可用');
        } else {
          setIsLocked(false);
          setLockMessage('');
        }
        // 同步到本地作为兜底（避免闪烁）
        if (serverSeconds > 0) {
          localStorage.setItem(TOTAL_GAME_TIME_KEY, String(serverSeconds));
        } else {
          localStorage.removeItem(TOTAL_GAME_TIME_KEY);
        }
      } else {
        // 失败则退回本地缓存
        const storedTimeStr = localStorage.getItem(TOTAL_GAME_TIME_KEY);
        const storedTime = storedTimeStr ? parseInt(storedTimeStr, 10) : 0;
        setRemainingTime(isNaN(storedTime) || storedTime < 0 ? 0 : storedTime);
      }
    } catch (err) {
      console.error('从后端加载游戏时间失败，回退本地:', err);
      const storedTimeStr = localStorage.getItem(TOTAL_GAME_TIME_KEY);
      const storedTime = storedTimeStr ? parseInt(storedTimeStr, 10) : 0;
      const fallback = isNaN(storedTime) || storedTime < 0 ? 0 : storedTime;
      setRemainingTime(fallback);
      lastSyncedSecondsRef.current = fallback; // 作为基准，避免无变化也写回
    }

    // 清理旧的开始时间键
    if (localStorage.getItem(GAME_START_TIME_KEY)) {
      localStorage.removeItem(GAME_START_TIME_KEY);
    }

    setHasInitializedTime(true);
  };

  // 立即持久化至后端（并同步本地）
  const persistRemainingTime = async () => {
    try {
      // 使用 ref 中的最新值，避免闭包读取到旧值
      const seconds = Math.max(0, Number(remainingTimeRef.current) || 0);
      await gameService.updateRemainingTime(seconds);
      if (seconds > 0) {
        localStorage.setItem(TOTAL_GAME_TIME_KEY, String(seconds));
      } else {
        localStorage.removeItem(TOTAL_GAME_TIME_KEY);
      }
      // 更新基准并清除脏标记
      lastSyncedSecondsRef.current = seconds;
      isDirtyRef.current = false;
    } catch (err) {
      console.error('保存游戏剩余时间失败:', err);
    }
  };

  // 去抖保存（避免每秒请求）
  const schedulePersist = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        persistRemainingTime();
      }
    }, 3000); // 3秒去抖
  };

  // 更新游戏剩余时间
  const handleUpdateGameTime = (newRemainingTime) => {
    // 确保时间值有效
    if (typeof newRemainingTime !== 'number' || isNaN(newRemainingTime)) {
      console.error('无效的剩余时间值:', newRemainingTime);
      return;
    }

    // 更新状态
    setRemainingTime(newRemainingTime);
    // 标记为脏并去抖保存到后端和本地
    isDirtyRef.current = true;
    schedulePersist();
  };

  // 自动处理游戏时间用完
  const handleGameTimeUp = async () => {
    try {
      setRemainingTime(0);
      await persistRemainingTime();

      // 显示提示消息
      message.info('游戏时间已用完，请前往积分商店兑换更多游戏时间');

      // 关闭活动游戏
      setActiveGame(null);
    } catch (err) {
      console.error('处理游戏时间用完失败:', err);
    }
  };

  // 启动游戏
  const handleStartGame = async () => {
    if (!selectedGame) return;

    try {
      // 关闭确认对话框
      setShowConfirmModal(false);

      // 检查是否有剩余时间
      if (remainingTime <= 0) {
        message.error('游戏时间已用完，请前往积分商店兑换更多游戏时间');
        return;
      }

      // 设置活动游戏
      setActiveGame(selectedGame);
    } catch (err) {
      console.error('启动游戏失败:', err);
      message.error('启动游戏失败，请稍后再试');
    }
  };

  // 处理游戏结束
  const handleGameEnd = async () => {
    if (!activeGame) return;

    try {
      await persistRemainingTime();

      // 显示提示
      if (remainingTime <= 0) {
        message.success('游戏时间已用完');
      } else {
        message.success('游戏已暂停，剩余时间保存成功');
      }
    } catch (err) {
      console.error('处理游戏结束失败:', err);
      message.error('处理游戏结束失败，请稍后再试');
    } finally {
      // 关闭游戏
      setActiveGame(null);
    }
  };

  // 处理手动关闭游戏
  const handleCloseGame = () => {
    Modal.confirm({
      title: '确认关闭游戏',
      content: '关闭后您还可以继续游玩剩余时间',
      onOk: handleGameEnd,
      okText: '确认',
      cancelText: '取消'
    });
  };

  // 打开游戏确认对话框
  const handleOpenGameConfirm = (game) => {
    setSelectedGame(game);
    setShowConfirmModal(true);
  };

  // 如果正在加载中
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>;
  }

  // 如果有活动游戏，显示游戏界面
  if (activeGame) {
    return (
      <GameContainer
        gameId={activeGame._id}
        gameName={activeGame.itemName}
        gameUrl={`/games/${LOCAL_GAMES.some(g => g._id === activeGame._id) ? activeGame._id : getGamePathFromName(activeGame.itemName)}/index.html`}
        initialTimeRemaining={remainingTime}
        onTimeUpdate={handleUpdateGameTime}
        onClose={handleCloseGame}
        onTimeUp={handleGameTimeUp}
      />
    );
  }

  // 获取游戏剩余时间显示
  const getGameTimeDisplay = () => {
    if (remainingTime <= 0) return '时间已用完';

    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    return `${minutes}分${seconds > 0 ? seconds + '秒' : ''}`;
  };

  return (
    <div>
      <Title level={2}>游戏中心</Title>

      {error && (
        <Paragraph type="danger" style={{ marginBottom: 16 }}>
          错误: {error}
        </Paragraph>
      )}

      {/* 登录时间锁定提示 */}
      {isLocked && (
        <Alert
          message="游戏中心暂时锁定"
          description={lockMessage}
          type="warning"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* 共享游戏时间显示 - 锁定时隐藏 */}
      {!isLocked && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong style={{ fontSize: 16 }}>总游戏时间:</Text>
              <Tag color="blue" icon={<ClockCircleOutlined />} style={{ marginLeft: 8, fontSize: 14 }}>
                {getGameTimeDisplay()}
              </Tag>
            </div>
            {remainingTime <= 0 && (
              <Button
                type="primary"
                onClick={() => window.location.href = '/student/point-shop'}
              >
                前往商店兑换
              </Button>
            )}
          </div>
        </Card>
      )}

      {!isLocked && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text type="secondary"><FireOutlined style={{ color: '#fa541c' }} /> 全校同学在游戏中心累计玩了 <Text strong>{formatPlayTime(totalSeconds)}</Text></Text>
          <Segmented
            value={sortMode}
            onChange={setSortMode}
            options={[{ label: <span><FireOutlined /> 按热度</span>, value: 'hot' }, { label: '默认顺序', value: 'default' }]}
          />
        </div>
      )}

      {/* 显示本地游戏列表 - 锁定时隐藏 */}
      {!isLocked && (
        <List
          grid={{
            gutter: 24,
            xs: 1,
            sm: 2,
            md: 3,
            lg: 4,
            xl: 4,
            xxl: 6
          }}
          dataSource={rankedGames}
          renderItem={game => (
            <List.Item>
              <Badge.Ribbon
                text={<span><TrophyOutlined /> 热度第 {game.rank}</span>}
                color={['#f5222d', '#fa8c16', '#faad14'][game.rank - 1]}
                style={{ display: game.rank && game.rank <= 3 ? undefined : 'none' }}
              >
              <Card
                hoverable
                style={{ width: '100%' }}
                cover={
                  <div style={{
                    height: 180,
                    width: '100%',
                    background: '#1890ff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    fontSize: 24,
                    overflow: 'hidden'
                  }}>
                    <img
                      src={game.image || DEFAULT_GAME_IMAGE}
                      alt={game.itemName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null; // 防止再次触发错误
                        e.target.src = DEFAULT_GAME_IMAGE;
                      }}
                    />
                  </div>
                }
                actions={[
                  <Button
                    type="primary"
                    onClick={() => handleOpenGameConfirm(game)}
                    disabled={isLocked || remainingTime <= 0}
                    style={{ width: '80%' }}
                  >
                    {isLocked ? '游戏锁定中' : (remainingTime > 0 ? '开始游戏' : '时间已用完')}
                  </Button>
                ]}
              >
                <Card.Meta
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 'bold' }}>{game.itemName}</span>
                      <Tooltip title={game.heat ? `全校同学累计玩了 ${formatPlayTime(game.heat)}，${game.players} 人玩过` : '还没人玩过'}>
                        <Tag color={game.heat ? 'volcano' : 'default'} icon={<FireOutlined />} style={{ marginRight: 0, fontWeight: 'normal' }}>
                          {game.heat ? formatPlayTime(game.heat) : '新'}
                        </Tag>
                      </Tooltip>
                    </div>
                  }
                  description={
                    <div style={{ height: 72, overflow: 'hidden' }}>
                      <div style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.65)' }}>{game.description}</div>
                    </div>
                  }
                />
              </Card>
              </Badge.Ribbon>
            </List.Item>
          )}
        />
      )}

      {/* 游戏确认对话框 */}
      <Modal
        title="开始游戏"
        open={showConfirmModal}
        onOk={handleStartGame}
        onCancel={() => setShowConfirmModal(false)}
        okText="开始"
        cancelText="取消"
      >
        {selectedGame && (
          <>
            <Paragraph>
              您即将开始 <Text strong>{selectedGame.itemName}</Text>
            </Paragraph>
            <Paragraph>
              <InfoCircleOutlined /> 游戏剩余时间: <Text strong>{getGameTimeDisplay()}</Text>
            </Paragraph>
            <Paragraph type="warning">
              注意：所有游戏共享总游戏时间，请珍惜游戏时间！
            </Paragraph>
          </>
        )}
      </Modal>
    </div>
  );
};

// 根据游戏名称获取对应的路径
function getGamePathFromName(name) {
  // 返回游戏ID作为路径，因为已经标准化
  if (typeof name === 'string') {
    const simpleName = name.toLowerCase().trim();

    if (simpleName.includes('贪吃蛇')) {
      return 'snake';
    } else if (simpleName.includes('记忆') || simpleName.includes('配对') || simpleName.includes('坦克')) {
      return 'memory';
    } else if (simpleName.includes('恐龙') || simpleName.includes('chrome')) {
      return 'dino';
    } else if (simpleName.includes('2048')) {
      return '2048';
    } else if (simpleName.includes('数独') || simpleName.includes('sudoku')) {
      return 'sudoku';
    } else if (simpleName.includes('俄罗斯方块') || simpleName.includes('tetris')) {
      return 'tetris';
    } else if (simpleName.includes('推箱子') || simpleName.includes('sokoban')) {
      return 'sokoban';
    } else if (simpleName.includes('打字') || simpleName.includes('ztype')) {
      return 'ztype';
    } else if (simpleName.includes('像素画') || simpleName.includes('pixelartmaker')) {
      return 'pixelartmaker';
    } else if (simpleName.includes('打砖块') || simpleName.includes('breakout')) {
      return 'breakout';
    } else if (simpleName.includes('扫雷') || simpleName.includes('minesweeper')) {
      return 'minesweeper';
    } else if (simpleName.includes('五子棋') || simpleName.includes('gomoku')) {
      return 'gomoku';
    } else if (simpleName.includes('华容道') || simpleName.includes('klotski')) {
      return 'klotski';
    } else if (simpleName.includes('二进制') || simpleName.includes('binary')) {
      return 'binary';
    } else if (simpleName.includes('连连看') || simpleName.includes('linkup')) {
      return 'linkup';
    } else if (simpleName.includes('机器人') || simpleName.includes('robot')) {
      return 'robot';
    }
  }

  // 如果是ID，直接返回
  return name._id || name;
}

export default GameCenter; 