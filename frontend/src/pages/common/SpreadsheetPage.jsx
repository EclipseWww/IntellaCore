import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input, message, Space, Spin, Modal, Switch, Typography } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import SpreadsheetEditor from '../../components/Spreadsheet/SpreadsheetEditor';
import {
    getSpreadsheet,
    createSpreadsheet,
    updateSpreadsheet
} from '../../services/spreadsheetAPI';
import debounce from 'lodash/debounce';

const { Title } = Typography;

/**
 * SpreadsheetPage - 表格编辑页面
 * 支持创建新表格和编辑已有表格
 */
const SpreadsheetPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id || id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [spreadsheet, setSpreadsheet] = useState(null);
    const [name, setName] = useState('未命名表格');
    const [data, setData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [isPublic, setIsPublic] = useState(false);

    // 获取用户角色以确定返回路径
    const userRole = localStorage.getItem('userRole') || 'student';
    const backPath = userRole === 'teacher' ? '/teacher/spreadsheets' : '/student/spreadsheets';

    // 加载已有表格
    useEffect(() => {
        if (!isNew) {
            loadSpreadsheet();
        }
    }, [id, isNew]);

    const loadSpreadsheet = async () => {
        try {
            setLoading(true);
            const response = await getSpreadsheet(id);
            if (response.success) {
                setSpreadsheet(response.data);
                setName(response.data.name);
                setData(response.data.data);
                setIsPublic(response.data.isPublic);
            } else {
                message.error('加载表格失败');
                navigate(backPath);
            }
        } catch (error) {
            console.error('Load spreadsheet error:', error);
            message.error('加载表格失败: ' + (error.response?.data?.message || error.message));
            navigate(backPath);
        } finally {
            setLoading(false);
        }
    };

    // 处理数据变化
    const handleDataChange = useCallback((newData) => {
        setData(newData);
        setHasChanges(true);
    }, []);

    // 保存表格
    const handleSave = async () => {
        try {
            setSaving(true);

            if (isNew) {
                // 创建新表格
                const response = await createSpreadsheet({
                    name,
                    data,
                    isPublic
                });

                if (response.success) {
                    message.success('表格创建成功');
                    // 跳转到编辑页面
                    const newId = response.data._id;
                    navigate(`/${userRole}/spreadsheet/${newId}`, { replace: true });
                    setSpreadsheet(response.data);
                    setHasChanges(false);
                }
            } else {
                // 更新已有表格
                const response = await updateSpreadsheet(id, {
                    name,
                    data,
                    isPublic
                });

                if (response.success) {
                    message.success('保存成功');
                    setSpreadsheet(response.data);
                    setHasChanges(false);
                }
            }
        } catch (error) {
            console.error('Save spreadsheet error:', error);
            message.error('保存失败: ' + (error.response?.data?.message || error.message));
        } finally {
            setSaving(false);
        }
    };

    // 自动保存 (防抖)
    const debouncedSave = useCallback(
        debounce(() => {
            if (!isNew && hasChanges) {
                handleSave();
            }
        }, 30000), // 30秒自动保存
        [isNew, hasChanges, name, data]
    );

    useEffect(() => {
        if (hasChanges && !isNew) {
            debouncedSave();
        }
        return () => debouncedSave.cancel();
    }, [hasChanges, debouncedSave, isNew]);

    // 返回列表
    const handleBack = () => {
        if (hasChanges) {
            Modal.confirm({
                title: '确认离开？',
                content: '您有未保存的更改，确定要离开吗？',
                okText: '保存并离开',
                cancelText: '直接离开',
                onOk: async () => {
                    await handleSave();
                    navigate(backPath);
                },
                onCancel: () => {
                    navigate(backPath);
                }
            });
        } else {
            navigate(backPath);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" tip="加载中..." />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* 顶部工具栏 */}
            <Card
                size="small"
                style={{ marginBottom: 16 }}
                bodyStyle={{ padding: '12px 16px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={handleBack}
                        >
                            返回
                        </Button>
                        <Input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setHasChanges(true);
                            }}
                            style={{ width: 300 }}
                            placeholder="请输入表格名称"
                        />
                    </Space>

                    <Space>
                        {hasChanges && (
                            <span style={{ color: '#faad14', fontSize: 12 }}>● 未保存</span>
                        )}
                        <Button
                            icon={<SettingOutlined />}
                            onClick={() => setSettingsVisible(true)}
                        >
                            设置
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={saving}
                        >
                            保存
                        </Button>
                    </Space>
                </div>
            </Card>

            {/* 表格编辑器 */}
            <Card
                bodyStyle={{ padding: 0, flex: 1 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
                <SpreadsheetEditor
                    data={data}
                    onChange={handleDataChange}
                    style={{ height: 'calc(100vh - 180px)' }}
                />
            </Card>

            {/* 设置弹窗 */}
            <Modal
                title="表格设置"
                open={settingsVisible}
                onOk={() => setSettingsVisible(false)}
                onCancel={() => setSettingsVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setSettingsVisible(false)}>
                        关闭
                    </Button>
                ]}
            >
                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>
                        <strong>公开访问</strong>
                    </div>
                    <Switch
                        checked={isPublic}
                        onChange={(checked) => {
                            setIsPublic(checked);
                            setHasChanges(true);
                        }}
                    />
                    <span style={{ marginLeft: 8, color: '#666' }}>
                        {isPublic ? '其他用户可以查看此表格' : '仅自己可见'}
                    </span>
                </div>

                {spreadsheet && (
                    <div style={{ color: '#999', fontSize: 12 }}>
                        <div>创建时间: {new Date(spreadsheet.createdAt).toLocaleString()}</div>
                        <div>更新时间: {new Date(spreadsheet.updatedAt).toLocaleString()}</div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default SpreadsheetPage;
