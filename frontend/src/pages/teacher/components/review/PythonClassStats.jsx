import React, { useMemo } from 'react';
import { Empty, Progress, Space, Statistic, Table, Tag, Row, Col } from 'antd';
import { STATUS_LABELS, errorTypeOf, statusOf } from '../../../../components/Python/outputDiff';

const ERROR_TYPE_NAMES = {
    SyntaxError: '语法错误',
    IndentationError: '缩进错误',
    NameError: '名称错误（变量未定义）',
    TypeError: '类型错误',
    ValueError: '值错误（如 int() 转换失败）',
    IndexError: '索引越界',
    KeyError: '键不存在',
    ZeroDivisionError: '除以零',
    AttributeError: '属性错误',
    RecursionError: '递归过深',
    EOFError: '输入不足',
    Crash: '程序崩溃'
};

/** 汇总班级提交：各测试点通过率、结果分布、常见报错 */
export function buildClassStats(submissions, testCases) {
    const judged = submissions.filter(s => s.testResults?.totalCount > 0);
    const caseCount = Math.max(testCases.length, ...judged.map(s => s.testResults.totalCount), 0);
    const cases = Array.from({ length: caseCount }, (_, index) => ({
        index,
        isHidden: !!testCases[index]?.isHidden,
        total: 0,
        statuses: {}
    }));
    const errorCounts = {};
    let fullMarks = 0;
    let attemptsSum = 0;

    for (const submission of judged) {
        const { results = [], passedCount, totalCount } = submission.testResults;
        if (passedCount === totalCount) fullMarks++;
        const errorTypesInSubmission = new Set();
        results.forEach((result, i) => {
            const target = cases[result.index ?? i];
            if (!target) return;
            const status = statusOf(result);
            target.total++;
            target.statuses[status] = (target.statuses[status] || 0) + 1;
            const errorType = status === 'RE' ? errorTypeOf(result) : null;
            if (errorType) errorTypesInSubmission.add(errorType);
            if (status === 'TLE') errorTypesInSubmission.add('超时（死循环）');
        });
        // 每个学生的同类错误只计一次
        errorTypesInSubmission.forEach(type => { errorCounts[type] = (errorCounts[type] || 0) + 1; });
    }
    for (const submission of submissions) attemptsSum += submission.attempts?.length || 0;

    return {
        judgedCount: judged.length,
        fullMarks,
        averageAttempts: submissions.length ? attemptsSum / submissions.length : 0,
        cases,
        errors: Object.entries(errorCounts)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
    };
}

const PythonClassStats = ({ submissions = [], testCases = [] }) => {
    const stats = useMemo(() => buildClassStats(submissions, testCases), [submissions, testCases]);

    if (stats.judgedCount === 0) {
        return <Empty description="暂无自动评测数据（活动没有测试点，或还没有学生提交）" />;
    }

    const caseColumns = [
        {
            title: '测试点',
            dataIndex: 'index',
            render: (index, row) => (
                <Space>
                    <span>测试点 {index + 1}</span>
                    {row.isHidden && <Tag>隐藏</Tag>}
                </Space>
            )
        },
        {
            title: '通过率',
            render: (_, row) => {
                const passed = row.statuses.AC || 0;
                const percent = row.total ? Math.round((passed / row.total) * 100) : 0;
                return (
                    <div style={{ minWidth: 160 }}>
                        <Progress percent={percent} size="small" status={percent < 60 ? 'exception' : 'normal'} />
                        <span style={{ fontSize: 12, color: '#999' }}>{passed}/{row.total} 人</span>
                    </div>
                );
            }
        },
        {
            title: '未通过原因',
            render: (_, row) => (
                <Space wrap size={[4, 4]}>
                    {Object.entries(row.statuses)
                        .filter(([status]) => status !== 'AC')
                        .sort((a, b) => b[1] - a[1])
                        .map(([status, count]) => (
                            <Tag key={status} color={STATUS_LABELS[status]?.color}>
                                {STATUS_LABELS[status]?.text || status} {count}
                            </Tag>
                        ))}
                </Space>
            )
        }
    ];

    return (
        <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}><Statistic title="已自动评测" value={stats.judgedCount} suffix="人" /></Col>
                <Col span={8}><Statistic title="全部通过" value={stats.fullMarks} suffix={`/ ${stats.judgedCount} 人`} /></Col>
                <Col span={8}><Statistic title="平均提交次数" value={stats.averageAttempts} precision={1} suffix="次" /></Col>
            </Row>
            <Table
                size="small"
                rowKey="index"
                pagination={false}
                columns={caseColumns}
                dataSource={stats.cases}
                style={{ marginBottom: 16 }}
            />
            <div style={{ fontWeight: 500, marginBottom: 8 }}>常见问题（按出现的学生人数）</div>
            {stats.errors.length === 0 ? (
                <span style={{ color: '#999' }}>没有运行错误或超时</span>
            ) : (
                <Space wrap>
                    {stats.errors.slice(0, 10).map(({ type, count }) => (
                        <Tag key={type} color="volcano" style={{ fontSize: 13, padding: '2px 8px' }}>
                            {ERROR_TYPE_NAMES[type] || type}：{count} 人
                        </Tag>
                    ))}
                </Space>
            )}
        </div>
    );
};

export default PythonClassStats;
