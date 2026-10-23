import React, { useEffect, useState, useMemo } from 'react';
import { Card, Typography, Space, Button, Tag, Spin, message, Row, Col, Statistic, Select, Input, Empty, Badge, Tooltip, Switch, Modal, Popconfirm, Drawer } from 'antd';
import { ReloadOutlined, FilterOutlined, WarningOutlined, CloseCircleOutlined, InfoCircleOutlined, BugOutlined, ClearOutlined, SearchOutlined, FileTextOutlined, DownloadOutlined, DeleteOutlined, ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import { logAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

const Logs = () => {
  usePageTitle('系统日志');
  const navigate = useNavigate();

  const [loadingFiles, setLoadingFiles] = useState(false);
  const [files, setFiles] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);

  // 筛选状态
  const [levelFilter, setLevelFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // 预览状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLogs, setPreviewLogs] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewInfo, setPreviewInfo] = useState(null);

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      const res = await logAPI.getLogFiles();
      if (res && res.success) {
        setFiles(res.data || []);
      } else {
        setFiles([]);
      }
    } catch (err) {
      message.error('获取日志文件失败');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchRecent = async () => {
    try {
      setLoadingRecent(true);
      const res = await logAPI.getRecentLogs(500);
      if (res && res.success) {
        setRecentLogs(res.data || []);
      } else {
        setRecentLogs([]);
      }
    } catch (err) {
      message.error('获取实时日志失败');
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchRecent();
  }, []);

  // 自动刷新
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchRecent, 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // 预览日志文件
  const handlePreview = async (filename) => {
    try {
      setPreviewLoading(true);
      setPreviewFile(filename);
      setPreviewVisible(true);
      setPreviewInfo(null);
      const res = await logAPI.getLogContent(filename);
      if (res && res.success) {
        setPreviewLogs(res.data?.logs || []);
        setPreviewInfo({
          totalLines: res.data?.totalLines || 0,
          displayedLines: res.data?.displayedLines || 0,
          fileSizeKB: res.data?.fileSizeKB || '0',
          truncated: res.data?.truncated || false
        });
      } else {
        setPreviewLogs([]);
      }
    } catch (err) {
      message.error('获取日志内容失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 下载日志文件
  const handleDownload = async (filename) => {
    try {
      const response = await logAPI.downloadLogFile(filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('下载成功');
    } catch (err) {
      message.error('下载失败');
    }
  };

  // 清空日志文件
  const handleClear = async (filename) => {
    try {
      await logAPI.clearLogFile(filename);
      message.success('日志已清空');
      fetchFiles();
      fetchRecent();
    } catch (err) {
      message.error('清空失败');
    }
  };

  // 批量清空所有日志
  const handleClearAll = async () => {
    try {
      const res = await logAPI.clearAllLogs();
      message.success(res.message || '所有日志已清空');
      fetchFiles();
      fetchRecent();
    } catch (err) {
      message.error('批量清空失败');
    }
  };

  // 日志统计
  const logStats = useMemo(() => {
    const stats = { total: 0, error: 0, warn: 0, info: 0, debug: 0 };
    recentLogs.forEach(log => {
      stats.total++;
      const level = (log.level || log?.meta?.level || 'info').toLowerCase();
      if (level.includes('error')) stats.error++;
      else if (level.includes('warn')) stats.warn++;
      else if (level.includes('debug')) stats.debug++;
      else stats.info++;
    });
    return stats;
  }, [recentLogs]);

  // 筛选后的日志
  const filteredLogs = useMemo(() => {
    return recentLogs.filter(log => {
      const level = (log.level || log?.meta?.level || 'info').toLowerCase();
      const content = log.message || log.raw || JSON.stringify(log);

      // 级别筛选
      if (levelFilter !== 'all') {
        if (levelFilter === 'error' && !level.includes('error')) return false;
        if (levelFilter === 'warn' && !level.includes('warn')) return false;
        if (levelFilter === 'info' && !level.includes('info') && !level.includes('debug')) return false;
      }

      // 搜索筛选
      if (searchText && !content.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [recentLogs, levelFilter, searchText]);

  // 日志级别配置
  const getLevelConfig = (level) => {
    const l = (level || 'info').toLowerCase();
    if (l.includes('error')) return { color: '#ff4d4f', bg: '#fff2f0', icon: <CloseCircleOutlined />, text: 'ERROR' };
    if (l.includes('warn')) return { color: '#faad14', bg: '#fffbe6', icon: <WarningOutlined />, text: 'WARN' };
    if (l.includes('debug')) return { color: '#8c8c8c', bg: '#fafafa', icon: <BugOutlined />, text: 'DEBUG' };
    return { color: '#1890ff', bg: '#e6f7ff', icon: <InfoCircleOutlined />, text: 'INFO' };
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          系统日志
        </Title>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin')}
        >
          返回管理后台
        </Button>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="总日志条数"
              value={logStats.total}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable style={{ borderLeft: '3px solid #ff4d4f' }}>
            <Statistic
              title="错误日志"
              value={logStats.error}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable style={{ borderLeft: '3px solid #faad14' }}>
            <Statistic
              title="警告日志"
              value={logStats.warn}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title="信息日志"
              value={logStats.info}
              valueStyle={{ color: '#52c41a' }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 日志文件卡片 */}
      <Card
        title={
          <Space>
            <span>日志文件</span>
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchFiles} loading={loadingFiles}>
              刷新
            </Button>
            <Popconfirm
              title="确定要清空所有日志文件吗？"
              description="此操作将清空所有日志文件，无法恢复"
              onConfirm={handleClearAll}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                批量清空
              </Button>
            </Popconfirm>
          </Space>
        }
        style={{ marginBottom: 24 }}
        bodyStyle={{ padding: files.length === 0 ? 24 : 0 }}
      >
        {loadingFiles ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : files.length === 0 ? (
          <Empty description="暂无日志文件" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16 }}>
            {files.map((item, index) => (
              <div
                key={index}
                onClick={() => handlePreview(item.name)}
                style={{
                  padding: '12px 16px',
                  background: '#fafafa',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  minWidth: 280,
                  flex: '1 1 280px',
                  maxWidth: 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#1890ff'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#f0f0f0'}
              >
                <div style={{ fontWeight: 500, marginBottom: 8 }}>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size="small">
                    <Tag>{(item.size / 1024).toFixed(1)} KB</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(item.updatedAt).toLocaleString()}
                    </Text>
                  </Space>
                  <Space size="small">
                    <Tooltip title="下载">
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => handleDownload(item.name)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定要清空此日志文件吗？"
                      description="清空后无法恢复"
                      onConfirm={() => handleClear(item.name)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Tooltip title="清空">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 实时日志卡片 */}
      <Card
        title={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <span>实时日志</span>
              <Badge count={filteredLogs.length} style={{ backgroundColor: '#1890ff' }} />
            </Space>
            <Space>
              <Tooltip title="自动刷新 (5秒)">
                <Switch
                  checkedChildren="自动"
                  unCheckedChildren="手动"
                  checked={autoRefresh}
                  onChange={setAutoRefresh}
                  size="small"
                />
              </Tooltip>
              <Button size="small" icon={<ReloadOutlined />} onClick={fetchRecent} loading={loadingRecent}>
                刷新
              </Button>
            </Space>
          </Space>
        }
        extra={
          <Space>
            <Select
              value={levelFilter}
              onChange={setLevelFilter}
              style={{ width: 120 }}
              size="small"
              suffixIcon={<FilterOutlined />}
            >
              <Option value="all">全部级别</Option>
              <Option value="error"><Tag color="red">ERROR</Tag></Option>
              <Option value="warn"><Tag color="orange">WARN</Tag></Option>
              <Option value="info"><Tag color="blue">INFO</Tag></Option>
            </Select>
            <Search
              placeholder="搜索日志..."
              allowClear
              size="small"
              style={{ width: 200 }}
              onSearch={setSearchText}
              onChange={(e) => !e.target.value && setSearchText('')}
            />
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={() => {
                setLevelFilter('all');
                setSearchText('');
              }}
            >
              清除筛选
            </Button>
          </Space>
        }
      >
        {loadingRecent ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : filteredLogs.length === 0 ? (
          <Empty description="暂无匹配的日志记录" />
        ) : (
          <div style={{
            maxHeight: 500,
            overflow: 'auto',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: 13
          }}>
            {filteredLogs.map((log, index) => {
              const level = log.level || log?.meta?.level || 'info';
              const config = getLevelConfig(level);
              const content = log.message || log.raw || JSON.stringify(log);
              const timestamp = log.timestamp;

              return (
                <div
                  key={index}
                  style={{
                    padding: '8px 12px',
                    borderLeft: `3px solid ${config.color}`,
                    background: index % 2 === 0 ? '#fff' : '#fafafa',
                    marginBottom: 1,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}
                >
                  <Tooltip title={formatDate(timestamp)}>
                    <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatTime(timestamp)}
                    </Text>
                  </Tooltip>
                  <Tag
                    color={config.color}
                    style={{ margin: 0, minWidth: 55, textAlign: 'center' }}
                  >
                    {config.text}
                  </Tag>
                  <div style={{
                    flex: 1,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    color: config.color === '#ff4d4f' ? '#cf1322' : 'inherit'
                  }}>
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 日志文件预览抽屉 */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            <span>{previewFile}</span>
          </Space>
        }
        width={800}
        open={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewFile(null);
          setPreviewLogs([]);
        }}
        extra={
          <Space>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => previewFile && handleDownload(previewFile)}
            >
              下载
            </Button>
            <Popconfirm
              title="确定要清空此日志文件吗？"
              onConfirm={() => {
                previewFile && handleClear(previewFile);
                setPreviewVisible(false);
              }}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                清空
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : previewLogs.length === 0 ? (
          <Empty description="日志文件为空" />
        ) : (
          <>
            {previewInfo && (
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Tag color="blue">文件大小: {previewInfo.fileSizeKB} KB</Tag>
                  <Tag color="green">显示: {previewInfo.displayedLines} 条</Tag>
                  {previewInfo.truncated && (
                    <Tag color="orange">总共 {previewInfo.totalLines} 条 (仅显示最新500条)</Tag>
                  )}
                </Space>
              </div>
            )}
            <div style={{
              background: '#1e1e1e',
              borderRadius: 8,
              maxHeight: 'calc(100vh - 250px)',
              overflow: 'auto'
            }}>
              {previewLogs.map((log, index) => {
                const level = log.level || log?.meta?.level || 'info';
                const config = getLevelConfig(level);
                const content = log.message || log.raw || JSON.stringify(log);
                const timestamp = log.timestamp;

                return (
                  <div
                    key={index}
                    style={{
                      padding: '6px 12px',
                      borderBottom: '1px solid #333',
                      fontFamily: 'Consolas, Monaco, monospace',
                      fontSize: 12
                    }}
                  >
                    <Space size="small" style={{ marginBottom: 4 }}>
                      <Text style={{ color: '#888' }}>{formatTime(timestamp)}</Text>
                      <Tag color={config.color} style={{ margin: 0 }}>{config.text}</Tag>
                    </Space>
                    <div style={{ color: config.color === '#ff4d4f' ? '#ff6b6b' : '#a8d8a8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {content}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default Logs;
