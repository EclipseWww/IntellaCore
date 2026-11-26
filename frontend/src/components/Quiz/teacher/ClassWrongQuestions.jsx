import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Segmented, Space, Table, Tag, Typography, Progress, Empty, Tooltip, message } from 'antd';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { quizAPI } from '../../../services/quizAPI';
import { classAPI } from '../../../services/api';

const { Text, Title } = Typography;

const TYPE_LABELS = { SINGLE_CHOICE: '单选', TRUE_FALSE: '判断', MULTIPLE_CHOICE: '多选' };

// 错误率颜色：越高越红
const rateColor = (rate) => (rate >= 60 ? '#ff4d4f' : rate >= 30 ? '#fa8c16' : '#1677ff');

// 展开行：题目全文、各选项被选人次、仍未掌握的学生
const QuestionDetail = ({ item }) => {
    const wrongTotal = item.wrongAttempts || 1;
    return (
        <div style={{ padding: '8px 16px' }}>
            <ReactMarkdown>{item.content}</ReactMarkdown>
            <div style={{ margin: '12px 0' }}>
                {item.options.map(opt => (
                    <div
                        key={opt._id}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', marginBottom: 6, borderRadius: 4,
                            border: `1px solid ${opt.isCorrect ? '#b7eb8f' : '#f0f0f0'}`,
                            background: opt.isCorrect ? '#f6ffed' : '#fff'
                        }}
                    >
                        <span style={{ flex: 1 }}>
                            {opt.content}
                            {opt.isCorrect && <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>正确答案</Tag>}
                        </span>
                        {!opt.isCorrect && (
                            <span style={{ width: 220 }}>
                                <Progress
                                    percent={Math.round((opt.wrongCount / wrongTotal) * 100)}
                                    size="small"
                                    strokeColor="#ff7875"
                                    format={() => `${opt.wrongCount} 人次`}
                                />
                            </span>
                        )}
                    </div>
                ))}
                {item.unansweredCount > 0 && <Text type="secondary">另有 {item.unansweredCount} 人次未作答</Text>}
            </div>
            {item.explanation && (
                <div style={{ background: '#fafafa', padding: 12, borderRadius: 4, marginBottom: 12 }}>
                    <Text strong>解析：</Text>
                    <ReactMarkdown>{item.explanation}</ReactMarkdown>
                </div>
            )}
            <div>
                <Text strong>仍未掌握（{item.unmasteredStudents.length} 人）：</Text>
                {item.unmasteredStudents.length > 0
                    ? item.unmasteredStudents.map(name => <Tag key={name} style={{ marginBottom: 4 }}>{name}</Tag>)
                    : <Text type="secondary">都已在之后的练习中答对</Text>}
            </div>
        </div>
    );
};

const ClassWrongQuestions = () => {
    const [classes, setClasses] = useState([]);
    const [classId, setClassId] = useState(null);
    const [days, setDays] = useState(30);
    const [source, setSource] = useState('all');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({ list: [], studentCount: 0 });

    useEffect(() => {
        (async () => {
            try {
                const response = await classAPI.getTeacherClasses();
                const sorted = (response.data || []).slice().sort((a, b) => (a.grade - b.grade) || (a.name - b.name));
                setClasses(sorted);
                if (sorted.length > 0) setClassId(sorted[0]._id);
            } catch (error) {
                message.error('获取班级列表失败');
            }
        })();
    }, []);

    const fetchStats = useCallback(async () => {
        if (!classId) return;
        try {
            setLoading(true);
            const res = await quizAPI.freePractice.getClassWrongQuestions(classId, { days: days || undefined, source });
            if (res.success) setData(res.data);
        } catch (error) {
            message.error(error.response?.data?.message || '获取班级错题失败');
        } finally {
            setLoading(false);
        }
    }, [classId, days, source]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const columns = [
        {
            title: '#',
            key: 'rank',
            width: 50,
            render: (_, __, index) => index + 1
        },
        {
            title: '题目',
            key: 'content',
            render: (_, item) => (
                <div>
                    <Space size={4} wrap style={{ marginBottom: 4 }}>
                        <Tag>{TYPE_LABELS[item.type] || '选择'}</Tag>
                        {item.tags.map(tag => <Tag key={tag} color="blue">{tag}</Tag>)}
                    </Space>
                    <div style={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || (item.content || '').replace(/[#*`>\n]/g, ' ').slice(0, 80)}
                    </div>
                </div>
            )
        },
        {
            title: '错误率',
            dataIndex: 'errorRate',
            key: 'errorRate',
            width: 160,
            render: (rate, item) => (
                <Tooltip title={`共 ${item.attempts} 人次作答，答错 ${item.wrongAttempts} 人次`}>
                    <Progress percent={rate} size="small" strokeColor={rateColor(rate)} format={p => `${p}%`} />
                </Tooltip>
            )
        },
        {
            title: '答错人数',
            key: 'students',
            width: 110,
            render: (_, item) => `${item.wrongStudentCount} / ${item.studentCount} 人`
        },
        {
            title: '最常选的错误选项',
            key: 'wrongOption',
            width: 220,
            render: (_, item) => (item.wrongOptions[0]
                ? <span><Text type="danger">{item.wrongOptions[0].content}</Text><Text type="secondary">（{item.wrongOptions[0].count} 人次）</Text></span>
                : <Text type="secondary">-</Text>)
        },
        {
            title: '仍未掌握',
            key: 'unmastered',
            width: 90,
            render: (_, item) => <Tag color={item.unmasteredStudents.length ? 'red' : 'green'}>{item.unmasteredStudents.length} 人</Tag>
        }
    ];

    return (
        <Card bordered={false}>
            <Title level={4} style={{ marginTop: 0 }}>班级高频错题</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                汇总本班学生在课程测验和自由练习中答错的选择题，按错误率排序；展开可看到各错误选项被选的人次和仍未掌握的学生，便于下节课针对讲解。错误率不含错题重练（重练只出错题）。
            </Text>
            <Space wrap style={{ marginBottom: 16 }}>
                <Select
                    style={{ width: 160 }}
                    placeholder="选择班级"
                    value={classId}
                    onChange={setClassId}
                    options={classes.map(c => ({ value: c._id, label: `${c.grade}级${c.name}班` }))}
                />
                <Segmented
                    value={days}
                    onChange={setDays}
                    options={[
                        { label: '最近 7 天', value: 7 },
                        { label: '最近 30 天', value: 30 },
                        { label: '全部', value: 0 }
                    ]}
                />
                <Segmented
                    value={source}
                    onChange={setSource}
                    options={[
                        { label: '全部来源', value: 'all' },
                        { label: '课程测验', value: 'quiz' },
                        { label: '自由练习', value: 'practice' }
                    ]}
                />
                <ReloadOutlined onClick={fetchStats} style={{ cursor: 'pointer', color: '#1677ff' }} title="刷新" />
            </Space>
            <Table
                rowKey="questionId"
                loading={loading}
                columns={columns}
                dataSource={data.list}
                expandable={{ expandedRowRender: item => <QuestionDetail item={item} /> }}
                pagination={{ pageSize: 20, showTotal: total => `共 ${total} 道错题（最多显示 100 道）` }}
                locale={{ emptyText: <Empty description={classId ? '所选范围内没有答错的题' : '请先选择班级'} /> }}
            />
        </Card>
    );
};

export default ClassWrongQuestions;
