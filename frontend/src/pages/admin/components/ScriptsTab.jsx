import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, message, Modal, Select, Space, Alert, Typography, Tag } from 'antd';
import { ReloadOutlined, ExclamationCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../../../services/api';

const { Option } = Select;
const { Text } = Typography;

// 系统管理 → 脚本运行：active 为 true（切换到该标签页）时刷新脚本列表
const ScriptsTab = ({ active }) => {
  // 脚本运行相关状态
  const [scripts, setScripts] = useState([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptOutput, setScriptOutput] = useState('');

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

  useEffect(() => {
    if (active) fetchScripts();
  }, [active]);

  return (
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
  );
};

export default ScriptsTab;
