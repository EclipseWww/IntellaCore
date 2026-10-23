import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, message, Space, Typography, Tooltip, Switch, InputNumber, Tag, Select } from 'antd';
import { SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { classAPI } from '../../../services/api';
import { quizAPI } from '../../../services/quizAPI';
import FreePracticeSettings from './FreePracticeSettings';

const { Title } = Typography;

const formatClassName = (grade, name) => {
    return `${grade}级${name}班`;
};

// Debounced Input Component for smoother UX
const CellInputNumber = ({ value, onChange, ...props }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (val) => {
        setLocalValue(val);
    };

    const handleBlur = () => {
        if (localValue !== value) {
            onChange(localValue);
        }
    };

    return (
        <InputNumber
            {...props}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onPressEnter={handleBlur}
        />
    );
};

// Default tags from QuestionBank
const DEFAULT_TAGS = [
    '信息技术基础：信息概念与特征',
    '信息技术基础：计算机基础知识',
    '信息技术基础：数据存储与单位换算',
    '信息技术基础：计算机病毒与防护',
    '互联网：网络基础知识',
    '互联网：网络设备',
    '互联网：通信介质',
    '互联网：TCP/IP协议与IP地址',
    '互联网：浏览器使用、网络安全、网络道德',
    '人工智能',
    '物联网',
    'Python编程：变量命名规则',
    'Python编程：赋值语句',
    'Python编程：数据输入输出',
    'Python编程：数据类型与转换',
    'Python编程：算术运算符',
    'Python编程：关系运算符',
    'Python编程：逻辑运算符',
    'Python编程：条件语句',
    'Python编程：for循环语句',
    'Python编程：range函数'
];

const FreePracticeManagement = () => {
    const [classes, setClasses] = useState([]);
    const [settingsMap, setSettingsMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState({});
    const [settingsModalVisible, setSettingsModalVisible] = useState(false);
    const [bulkModalVisible, setBulkModalVisible] = useState(false);
    // currentClass removed as settings modal for single class is removed
    const [allTags, setAllTags] = useState(DEFAULT_TAGS);

    const fetchClasses = async () => {
        try {
            setLoading(true);
            const [classesRes, questionsRes] = await Promise.all([
                classAPI.getTeacherClasses(),
                quizAPI.questions.getList()
            ]);

            // Extract tags from questions
            const questionTags = new Set(DEFAULT_TAGS);
            if (questionsRes.success && Array.isArray(questionsRes.data)) {
                questionsRes.data.forEach(q => {
                    if (Array.isArray(q.tags)) {
                        q.tags.forEach(t => questionTags.add(t));
                    }
                });
            }
            setAllTags(Array.from(questionTags));

            // Sort classes: newer grade first, then class name ascending
            const sortedClasses = classesRes.data.sort((a, b) => {
                if (a.grade === b.grade) {
                    return a.name - b.name;
                }
                return b.grade - a.grade;
            });
            setClasses(sortedClasses);

            // Fetch settings for all classes
            const settingsPromises = sortedClasses.map(async (cls) => {
                try {
                    const res = await quizAPI.freePractice.getSettings(cls._id);
                    if (res.success) {
                        return { classId: cls._id, settings: res.data };
                    }
                } catch (error) {
                    console.error(`Failed to fetch settings for class ${cls._id}`, error);
                }
                return null;
            });

            const results = await Promise.all(settingsPromises);
            const newSettingsMap = {};
            results.forEach(item => {
                if (item) {
                    newSettingsMap[item.classId] = item.settings;
                }
            });
            setSettingsMap(newSettingsMap);

        } catch (error) {
            console.error('Fetch data failed', error);
            message.error('获取数据失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
    }, []);



    const handleBulkSave = async (settings) => {
        try {
            const classIds = classes.map(c => c._id);
            if (classIds.length === 0) {
                message.warning('没有可配置的班级');
                return;
            }

            const res = await quizAPI.freePractice.bulkUpdateSettings(classIds, settings);
            if (res.success) {
                message.success(`成功更新 ${res.data.modifiedCount} 个班级的配置`);
                setBulkModalVisible(false);

                // Update local state to reflect changes immediately
                setSettingsMap(prev => {
                    const next = { ...prev };
                    classIds.forEach(id => {
                        next[id] = { ...next[id], ...settings };
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('批量更新配置失败:', error);
            message.error('批量更新配置失败');
        }
    };

    const handleSettingUpdate = async (classId, key, value) => {
        const currentSettings = settingsMap[classId] || {};

        let apiValue = value;
        // If updating timeLimit, convert minutes to seconds
        if (key === 'timeLimit') {
            apiValue = value * 60;
        }

        // Optimistic update state
        const updatedSettings = { ...currentSettings, [key]: apiValue };

        setSettingsMap(prev => ({
            ...prev,
            [classId]: updatedSettings
        }));
        setSettingsLoading(prev => ({ ...prev, [classId]: true }));

        try {
            const res = await quizAPI.freePractice.updateSettings(classId, updatedSettings);
            if (!res.success) {
                throw new Error('Update failed');
            }
            message.success('配置已更新');
        } catch (error) {
            console.error('Update settings failed:', error);
            message.error('配置更新失败');
        } finally {
            setSettingsLoading(prev => ({ ...prev, [classId]: false }));
        }
    };

    const columns = [
        {
            title: '年级',
            dataIndex: 'grade',
            key: 'grade',
            render: (text) => `${text}级`,
            sorter: (a, b) => a.grade - b.grade,
            width: 80,
        },
        {
            title: '班级',
            dataIndex: 'name',
            key: 'name',
            render: (text) => `${text}班`,
            sorter: (a, b) => a.name - b.name,
            width: 80,
        },

        {
            title: '状态',
            key: 'status',
            width: 100,
            render: (_, record) => {
                const settings = settingsMap[record._id] || {};
                return (
                    <Switch
                        checked={settings.isEnabled !== false}
                        loading={settingsLoading[record._id]}
                        onChange={(checked) => handleSettingUpdate(record._id, 'isEnabled', checked)}
                        checkedChildren="开启"
                        unCheckedChildren="关闭"
                    />
                );
            }
        },
        {
            title: '题目数',
            key: 'questionCount',
            width: 100,
            render: (_, record) => {
                const settings = settingsMap[record._id] || {};
                return (
                    <CellInputNumber
                        min={5}
                        max={50}
                        value={settings.questionCount}
                        disabled={settingsLoading[record._id]}
                        onChange={(val) => {
                            if (!isNaN(val)) {
                                handleSettingUpdate(record._id, 'questionCount', val);
                            }
                        }}
                    />
                );
            }
        },
        {
            title: '限时(分)',
            key: 'timeLimit',
            width: 100,
            render: (_, record) => {
                const settings = settingsMap[record._id] || {};
                const minutes = settings.timeLimit ? Math.floor(settings.timeLimit / 60) : 5;
                return (
                    <CellInputNumber
                        min={1}
                        max={60}
                        value={minutes}
                        disabled={settingsLoading[record._id]}
                        onChange={(val) => {
                            if (!isNaN(val)) {
                                handleSettingUpdate(record._id, 'timeLimit', val);
                            }
                        }}
                    />
                );
            }
        },
        {
            title: '每题积分',
            key: 'points',
            width: 100,
            render: (_, record) => {
                const settings = settingsMap[record._id] || {};
                return (
                    <CellInputNumber
                        min={0}
                        max={100}
                        value={settings.pointsPerQuestion}
                        disabled={settingsLoading[record._id]}
                        onChange={(val) => {
                            if (!isNaN(val)) {
                                handleSettingUpdate(record._id, 'pointsPerQuestion', val);
                            }
                        }}
                    />
                );
            }
        },
        {
            title: '允许题型',
            key: 'allowedTypes',
            width: 250,
            render: (_, record) => {
                const settings = settingsMap[record._id] || {};
                return (
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        value={settings.allowedTypes || []}
                        loading={settingsLoading[record._id]}
                        onChange={(val) => handleSettingUpdate(record._id, 'allowedTypes', val)}
                        maxTagCount="responsive"
                    >
                        <Select.Option value="SINGLE_CHOICE">单选</Select.Option>
                        <Select.Option value="MULTIPLE_CHOICE">多选</Select.Option>
                        <Select.Option value="TRUE_FALSE">判断</Select.Option>
                    </Select>
                );
            }
        },
        {
            title: '知识点标签',
            key: 'allowedTags',
            width: 300,
            render: (_, record) => {
                const settings = settingsMap[record._id] || {};
                return (
                    <Select
                        mode="tags"
                        style={{ width: '100%' }}
                        placeholder="如果不选则包含所有"
                        value={settings.allowedTags || []}
                        loading={settingsLoading[record._id]}
                        onChange={(val) => handleSettingUpdate(record._id, 'allowedTags', val)}
                        maxTagCount="responsive"
                    >
                        {allTags.map(tag => (
                            <Select.Option key={tag} value={tag}>{tag}</Select.Option>
                        ))}
                    </Select>
                );
            }
        },
    ];

    return (
        <div className="free-practice-management">
            <Card
                title="自由练习管理"
                bordered={false}
                extra={
                    <Tooltip title="将统一配置应用到列表中所有班级">
                        <Button
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            onClick={() => setBulkModalVisible(true)}
                            disabled={classes.length === 0}
                        >
                            一键配置所有班级
                        </Button>
                    </Tooltip>
                }
            >
                <div style={{ marginBottom: 16 }}>
                    <Typography.Text type="secondary">
                        在此管理各班级的自由练习规则，包括题型范围、知识点标签限制、积分奖励等。
                    </Typography.Text>
                </div>

                <Table
                    columns={columns}
                    dataSource={classes}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>



            <Modal
                title="一键配置 - 所有班级"
                open={bulkModalVisible}
                onCancel={() => setBulkModalVisible(false)}
                footer={null}
                width={700}
                destroyOnClose
            >
                <FreePracticeSettings
                    isBulk={true}
                    initialValues={{
                        isEnabled: true,
                        timeLimit: 5,
                        questionCount: 10,
                        pointsPerQuestion: 5,
                        allowedTypes: ['SINGLE_CHOICE', 'TRUE_FALSE', 'MULTIPLE_CHOICE']
                    }}
                    onSave={handleBulkSave}
                />
            </Modal>
        </div>
    );
};

export default FreePracticeManagement;
