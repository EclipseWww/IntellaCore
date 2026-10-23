import React, { useState, useEffect, useMemo } from 'react';
import {
    Card, Form, Select, Button, InputNumber,
    Table, Divider, Checkbox,
    message, Spin, Row, Col, Alert,
    Tree, Tag, Steps, Progress, Tooltip, Modal, Empty
} from 'antd';
import {
    SaveOutlined, CalculatorOutlined,
    DownloadOutlined, CheckCircleFilled,
    InfoCircleOutlined, ThunderboltOutlined,
    BarChartOutlined, FileTextOutlined,
    HistoryOutlined, DeleteOutlined
} from '@ant-design/icons';
import {
    classAPI, courseManagementAPI, examAPI
} from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import * as XLSX from 'xlsx';
import './ExamConfiguration.css';

const { Option } = Select;

// Scorable activity types
const SCORABLE_TYPES = [
    'typing', 'quiz', 'assignment', 'flowchart', 'python', 'fillblank', 'spreadsheet', 'practice', 'html'
];

const ExamConfiguration = () => {
    usePageTitle('考试成绩导出');
    const [form] = Form.useForm();

    // State
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState([]);
    const [courses, setCourses] = useState([]);
    const [units, setUnits] = useState([]);

    // Selection
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);

    // Tree Data for Lesson Selection
    const [treeData, setTreeData] = useState([]);
    const [checkedKeys, setCheckedKeys] = useState([]);

    // Config ID
    const [configId, setConfigId] = useState(null);

    // Weights
    const [lessonWeights, setLessonWeights] = useState({});
    const [activityWeights, setActivityWeights] = useState({});

    // Daily Performance Weight (from form, tracked for validation)
    const [dailyWeight, setDailyWeight] = useState(0);

    // Results
    const [gradeResults, setGradeResults] = useState([]);

    // Semesters
    const [semesterOptions, setSemesterOptions] = useState([]);

    // Saved Configs
    const [savedConfigs, setSavedConfigs] = useState([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);

    // Current Step for Steps component
    const currentStep = useMemo(() => {
        if (gradeResults.length > 0) return 2;
        if (selectedCourse && checkedKeys.length > 0) return 1;
        return 0;
    }, [selectedCourse, checkedKeys, gradeResults]);

    // Statistics
    const statistics = useMemo(() => {
        if (gradeResults.length === 0) return null;
        const scores = gradeResults.map(r => r.finalScore || 0);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        const passCount = scores.filter(s => s >= 60).length;
        const passRate = (passCount / scores.length) * 100;
        return {
            avg: avg.toFixed(1),
            max: max.toFixed(1),
            min: min.toFixed(1),
            passRate: passRate.toFixed(1),
            total: scores.length
        };
    }, [gradeResults]);

    // Load initial data
    useEffect(() => {
        fetchClasses();
        fetchCourses();
        generateSemesterOptions();
        fetchSavedConfigs();
    }, []);

    // Fetch saved configs
    const fetchSavedConfigs = async () => {
        setLoadingConfigs(true);
        try {
            const res = await examAPI.getTeacherConfigs();
            if (res.success) setSavedConfigs(res.data);
        } catch (err) {
            console.error('获取历史配置失败', err);
        } finally {
            setLoadingConfigs(false);
        }
    };

    // Load a saved config
    const handleLoadConfig = async (configIdToLoad) => {
        if (!configIdToLoad) return;
        setLoading(true);
        try {
            const res = await examAPI.getExamConfig(configIdToLoad);
            if (res.success) {
                const cfg = res.data;
                setConfigId(cfg._id);

                // Set classes
                const classIds = cfg.classes?.map(c => c._id || c) || [];
                setSelectedClasses(classIds);
                form.setFieldsValue({ classes: classIds });

                // Set course
                const courseId = cfg.course?._id || cfg.course;
                setSelectedCourse(courseId);
                form.setFieldsValue({ course: courseId });

                // Wait for course content to load
                await fetchCourseContent(courseId);

                // Set checked lessons
                if (cfg.lessonConfigs?.length > 0) {
                    const lessonIds = cfg.lessonConfigs.map(lc => lc.lessonId?._id || lc.lessonId);
                    setCheckedKeys(lessonIds);

                    // Set lesson weights
                    const lWeights = {};
                    const aWeights = {};
                    cfg.lessonConfigs.forEach(lc => {
                        const lessonId = lc.lessonId?._id || lc.lessonId;
                        lWeights[lessonId] = lc.weight || 0;
                        lc.activityConfigs?.forEach(ac => {
                            aWeights[`${lessonId}_${ac.activityId}`] = ac.weight || 0;
                        });
                    });
                    setLessonWeights(lWeights);
                    setActivityWeights(aWeights);
                }

                // Set daily weight and semester
                const dw = cfg.dailyPerformanceWeight || 30;
                setDailyWeight(dw);
                form.setFieldsValue({
                    dailyPerformanceWeight: dw,
                    semester: cfg.semester || semesterOptions[0]?.value
                });

                message.success('配置加载成功');
            }
        } catch (err) {
            console.error('加载配置失败', err);
            message.error('加载配置失败');
        } finally {
            setLoading(false);
        }
    };

    const generateSemesterOptions = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Define Logic: 8-1 is sem 1, 2-7 is sem 2
        let currentYear, currentSemNum;

        if (month >= 8) {
            currentYear = year;
            currentSemNum = 1;
        } else if (month >= 2) {
            currentYear = year - 1;
            currentSemNum = 2;
        } else {
            currentYear = year - 1;
            currentSemNum = 1;
        }

        const options = [];
        // Generate current + 3 previous
        for (let i = 0; i < 4; i++) {
            const semStr = `${currentYear}-${currentYear + 1}-${currentSemNum}`;
            let label = i === 0 ? `当前学期 (${semStr})` : `${semStr}`;

            options.push({ label, value: semStr });

            // Move back
            if (currentSemNum === 2) {
                currentSemNum = 1;
            } else {
                currentSemNum = 2;
                currentYear--;
            }
        }

        setSemesterOptions(options);

        // Default to current
        form.setFieldsValue({ semester: options[0].value });
    };

    const fetchClasses = async () => {
        try {
            const res = await classAPI.getTeacherClasses();
            if (res.success) setClasses(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCourses = async () => {
        try {
            const res = await courseManagementAPI.getTeacherCourses();
            if (res.success) setCourses(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    // Fetch Lessons when Course changes
    useEffect(() => {
        if (selectedCourse) {
            fetchCourseContent(selectedCourse);
        }
    }, [selectedCourse]);

    const fetchCourseContent = async (courseId) => {
        setLoading(true);
        try {
            const unitsRes = await courseManagementAPI.getUnits(courseId);
            if (unitsRes.success) {
                const unitsData = unitsRes.data;
                const unitsWithLessons = await Promise.all(unitsData.map(async (unit) => {
                    const lessonsRes = await courseManagementAPI.getLessons(courseId, unit._id);
                    return {
                        ...unit,
                        lessons: lessonsRes.success ? lessonsRes.data : []
                    };
                }));
                setUnits(unitsWithLessons);

                const tree = unitsWithLessons.map(unit => ({
                    title: unit.title,
                    key: `unit_${unit._id}`,
                    children: unit.lessons.map(lesson => ({
                        title: `${lesson.title} (${lesson.activities?.filter(isScorable).length || 0}个活动)`,
                        key: lesson._id,
                        isLeaf: true
                    }))
                }));
                setTreeData(tree);
                setCheckedKeys([]);
            }
        } catch (err) {
            message.error("获取课程内容失败");
        } finally {
            setLoading(false);
        }
    };

    const isScorable = (activity) => {
        const type = activity.type?.type || activity.type;
        return SCORABLE_TYPES.includes(type);
    };

    const getSelectedLessonObjects = () => {
        const allLessons = [];
        units.forEach(u => {
            if (u.lessons) allLessons.push(...u.lessons);
        });
        const lessonIds = checkedKeys.filter(k => !k.startsWith('unit_'));
        return allLessons.filter(l => lessonIds.includes(l._id));
    };

    const onCheck = (checkedKeysValue) => {
        setCheckedKeys(checkedKeysValue);
    };

    // Quick distribute weights evenly
    const distributeWeightsEvenly = () => {
        const lessonObjs = getSelectedLessonObjects();
        if (lessonObjs.length === 0) {
            message.warning("请先选择课时");
            return;
        }

        let currentDaily = form.getFieldValue('dailyPerformanceWeight') || 30;
        setDailyWeight(currentDaily); // Update state to trigger re-render
        const remaining = 100 - currentDaily;
        const perLesson = Math.floor((remaining / lessonObjs.length) * 10) / 10;

        // Adjust last lesson to make sum exact
        const newLessonWeights = {};
        lessonObjs.forEach((l, index) => {
            if (index === lessonObjs.length - 1) {
                const currentSum = Object.values(newLessonWeights).reduce((a, b) => a + b, 0);
                newLessonWeights[l._id] = Math.round((remaining - currentSum) * 10) / 10;
            } else {
                newLessonWeights[l._id] = perLesson;
            }
        });
        setLessonWeights(newLessonWeights);

        // Distribute activity weights within each lesson
        const newActivityWeights = {};
        lessonObjs.forEach(lesson => {
            const validActs = lesson.activities?.filter(isScorable) || [];
            if (validActs.length > 0) {
                const perAct = Math.floor((100 / validActs.length) * 10) / 10;
                validActs.forEach((act, index) => {
                    const key = `${lesson._id}_${act._id || act.activityId}`;
                    if (index === validActs.length - 1) {
                        const currentSum = validActs.slice(0, -1).reduce((sum) => sum + perAct, 0);
                        newActivityWeights[key] = Math.round((100 - currentSum) * 10) / 10;
                    } else {
                        newActivityWeights[key] = perAct;
                    }
                });
            }
        });
        setActivityWeights(newActivityWeights);

        message.success("已均分所有权重");
    };

    // Auto-distribute weights when selection changes
    useEffect(() => {
        const lessonObjs = getSelectedLessonObjects();
        if (lessonObjs.length === 0) return;

        // 1. Distribute lesson weights
        let currentDaily = form.getFieldValue('dailyPerformanceWeight');
        if (currentDaily === undefined) {
            form.setFieldsValue({ dailyPerformanceWeight: 30 });
            setDailyWeight(30);
            currentDaily = 30;
        }

        const remaining = 100 - currentDaily;
        const perLesson = lessonObjs.length > 0 ? Math.floor((remaining / lessonObjs.length) * 10) / 10 : 0;

        setLessonWeights(prev => {
            const newWeights = { ...prev };
            let changed = false;
            lessonObjs.forEach((l) => {
                // Only set if not already set (or if previously 0 which might mean uninit)
                if (newWeights[l._id] === undefined || newWeights[l._id] === 0) {
                    newWeights[l._id] = perLesson;
                    changed = true;
                }
            });
            return changed ? newWeights : prev;
        });

        // 2. Distribute activity weights within lessons
        setActivityWeights(prev => {
            const newWeights = { ...prev };
            let changed = false;

            lessonObjs.forEach(lesson => {
                const validActs = lesson.activities?.filter(isScorable) || [];
                if (validActs.length > 0) {
                    const perAct = Math.floor((100 / validActs.length) * 10) / 10;
                    validActs.forEach(act => {
                        const key = `${lesson._id}_${act._id || act.activityId}`;
                        if (newWeights[key] === undefined || newWeights[key] === 0) {
                            newWeights[key] = perAct;
                            changed = true;
                        }
                    });
                }
            });
            return changed ? newWeights : prev;
        });

    }, [checkedKeys, dailyWeight, units]);

    // Validation Helper (Updated for Flat Weighting)
    const validateWeights = (lessonObjs, currentDailyWeight) => {
        // 1. Validate Total Sum (Daily + Lessons) = 100
        const totalLessonWeight = lessonObjs.reduce((sum, l) => sum + (lessonWeights[l._id] || 0), 0);
        const totalWeight = totalLessonWeight + currentDailyWeight;

        if (Math.abs(totalWeight - 100) > 0.1) {
            message.error(`总权重必须为 100% (当前平时分 ${currentDailyWeight}% + 课时总和 ${totalLessonWeight}% = ${totalWeight}%)`);
            return false;
        }

        // 2. Validate Activity Weights Per Lesson
        for (const lesson of lessonObjs) {
            const validActivities = lesson.activities?.filter(isScorable) || [];
            if (validActivities.length > 0) {
                const totalActivityWeight = validActivities.reduce((sum, act) => {
                    return sum + (activityWeights[`${lesson._id}_${act._id || act.activityId}`] || 0);
                }, 0);

                if (Math.abs(totalActivityWeight - 100) > 0.1) {
                    message.error(`课时 \"${lesson.title}\" 内的活动权重之和必须为 100% (当前: ${totalActivityWeight}%)`);
                    return false;
                }
            }
        }
        return true;
    };

    // Handle Save
    const handleSave = async (values) => {
        const lessonObjs = getSelectedLessonObjects();
        const dWeight = values.dailyPerformanceWeight || 0;
        setDailyWeight(dWeight);

        if (!validateWeights(lessonObjs, dWeight)) {
            return;
        }

        setLoading(true);
        try {
            const lessonConfigs = lessonObjs.map(lesson => {
                const lessonWeight = lessonWeights[lesson._id] || 0;
                const validActivities = lesson.activities?.filter(isScorable) || [];

                const activityConfigs = validActivities.map(act => ({
                    activityId: act._id || act.activityId,
                    weight: activityWeights[`${lesson._id}_${act._id || act.activityId}`] || 0
                }));

                return {
                    lessonId: lesson._id,
                    weight: lessonWeight,
                    activityConfigs
                };
            });

            const payload = {
                title: values.title || '期末考试',
                classes: selectedClasses,
                course: selectedCourse,
                dailyPerformanceWeight: dWeight,
                dailyScoreSource: values.dailyScoreSource,
                semester: values.semester,
                lessonConfigs
            };

            let res;
            if (configId) {
                res = await examAPI.updateExamConfig(configId, payload);
            } else {
                res = await examAPI.createExamConfig(payload);
            }

            if (res.success) {
                message.success("保存配置成功");
                setConfigId(res.data._id);
                // Refresh saved configs list
                fetchSavedConfigs();
            }
        } catch (err) {
            console.error(err);
            message.error("保存失败");
        } finally {
            setLoading(false);
        }
    };

    const handleCalculate = async () => {
        if (!configId) {
            message.warning("请先保存配置");
            return;
        }

        Modal.confirm({
            title: '确认计算成绩',
            content: '将按照当前配置计算所有学生的成绩，确定继续吗？',
            okText: '确定计算',
            cancelText: '取消',
            onOk: async () => {
                setLoading(true);
                try {
                    const res = await examAPI.calculateGrades(configId);
                    if (res.success) {
                        setGradeResults(res.data);
                        message.success("计算完成");
                    }
                } catch (err) {
                    message.error("计算失败");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // Updated Export using Frontend Data (XLSX)
    const handleExport = () => {
        if (gradeResults.length === 0) {
            message.warning("暂无数据可导出");
            return;
        }

        Modal.confirm({
            title: '确认导出成绩单',
            content: `将导出 ${gradeResults.length} 名学生的成绩到 Excel 文件，确定继续吗？`,
            okText: '确定导出',
            cancelText: '取消',
            onOk: () => {
                try {
                    // Prepare Data for Excel
                    const lessons = getSelectedLessonObjects();
                    const exportData = gradeResults.map(r => {
                        const row = {
                            '班级': r.className || '未分配',
                            '姓名': r.student?.name || '',
                            '学号': r.student?.username || '',
                            '平时成绩': r.dailyScore,
                            '平时折算': r.dailyContribution,
                        };

                        // Add Activity Scores
                        lessons.forEach(lesson => {
                            const validActivities = lesson.activities?.filter(isScorable) || [];
                            validActivities.forEach(act => {
                                const key = `${lesson.title} - ${act.title}`;
                                const res = r.activityScores && r.activityScores[act._id || act.activityId];
                                row[key] = res ? res.score : 0;
                            });
                        });

                        // Add Totals
                        row['考试部分总分'] = r.examPartScore;
                        row['总成绩'] = r.finalScore;

                        return row;
                    });

                    const ws = XLSX.utils.json_to_sheet(exportData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "成绩单");
                    XLSX.writeFile(wb, "期末考试成绩.xlsx");
                    message.success("导出成功");
                } catch (err) {
                    console.error(err);
                    message.error("导出失败");
                }
            }
        });
    };

    const selectedLessonObjs = getSelectedLessonObjects();
    const selectedLessonCount = checkedKeys.filter(k => !k.startsWith('unit_')).length;

    // Calculate Total Weight for Display
    const currentTotalWeight = (dailyWeight || 0) + selectedLessonObjs.reduce((s, l) => s + (lessonWeights[l._id] || 0), 0);
    const weightIsValid = Math.abs(currentTotalWeight - 100) < 0.1;

    // Columns
    const lessonColumns = [
        { title: '课时名称', dataIndex: 'title', key: 'title' },
        {
            title: (
                <span>
                    成绩占比 (%)
                    <Tooltip title="每个课时在总成绩中的占比，所有课时加平时分必须等于100%">
                        <InfoCircleOutlined style={{ marginLeft: 6, color: '#1890ff' }} />
                    </Tooltip>
                </span>
            ),
            key: 'weight',
            render: (_, r) => (
                <InputNumber
                    min={0} max={100}
                    value={lessonWeights[r._id]}
                    onChange={v => setLessonWeights(prev => ({ ...prev, [r._id]: v }))}
                    placeholder="占比"
                    style={{ width: 100 }}
                />
            ),
            width: 180
        },
        {
            title: '包含活动数',
            render: (_, r) => (
                <Tag color="blue">{r.activities?.filter(isScorable).length || 0} 个</Tag>
            )
        }
    ];

    const activityColumns = (lessonId) => {
        const validActs = units.flatMap(u => u.lessons || [])
            .find(l => l._id === lessonId)?.activities?.filter(isScorable) || [];

        const currentSum = validActs.reduce((sum, act) =>
            sum + (activityWeights[`${lessonId}_${act._id || act.activityId}`] || 0), 0);

        return [
            { title: '活动名称', dataIndex: 'title', key: 'title' },
            {
                title: '类型',
                key: 'type',
                render: (_, r) => <Tag>{r.type?.type || r.type}</Tag>
            },
            {
                title: (
                    <span>
                        课时内分配 (%)
                        <span style={{
                            marginLeft: 8,
                            fontSize: 12,
                            color: Math.abs(currentSum - 100) < 0.1 ? '#52c41a' : '#ff4d4f',
                            fontWeight: 600
                        }}>
                            (总和: {currentSum.toFixed(1)}%)
                        </span>
                    </span>
                ),
                key: 'weight',
                render: (_, r) => (
                    <InputNumber
                        min={0} max={100}
                        value={activityWeights[`${lessonId}_${r._id}`]}
                        onChange={v => setActivityWeights(prev => ({ ...prev, [`${lessonId}_${r._id}`]: v }))}
                        placeholder="权重"
                        style={{ width: 80 }}
                    />
                ),
                width: 200
            }
        ];
    };

    const expandedRowRender = (lesson) => {
        const validActivities = lesson.activities?.filter(isScorable) || [];
        if (validActivities.length === 0) return <Alert message="该课时无计分活动" type="warning" />;

        return (
            <Table
                columns={activityColumns(lesson._id)}
                dataSource={validActivities}
                pagination={false}
                rowKey="_id"
                size="small"
                bordered={false}
            />
        );
    };

    const resultColumns = [
        { title: '班级', dataIndex: 'className', key: 'className' },
        { title: '姓名', dataIndex: ['student', 'name'], key: 'name' },
        {
            title: '平时成绩',
            key: 'daily',
            render: (_, r) => (
                <div>
                    <span style={{ fontWeight: 600 }}>{r.dailyScore}</span>
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>(×{r.dailyWeight}%)</span>
                </div>
            )
        },
        {
            title: '课时总分',
            key: 'exam',
            render: (_, r) => (
                <span>{r.examPartScore ? r.examPartScore.toFixed(1) : 0}</span>
            )
        },
        {
            title: '总分',
            dataIndex: 'finalScore',
            key: 'finalScore',
            render: txt => (
                <span style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: txt >= 60 ? '#52c41a' : '#ff4d4f'
                }}>
                    {txt}
                </span>
            ),
            sorter: (a, b) => a.finalScore - b.finalScore
        }
    ];

    const resultExpandedRowRender = (record) => {
        const columns = [
            { title: '课时 - 活动', dataIndex: 'title', key: 'title' },
            { title: '类型', dataIndex: 'type', key: 'type', render: t => <Tag>{t}</Tag>, width: 100 },
            { title: '原始分(0-100)', dataIndex: 'score', key: 'score', width: 120 },
            { title: '权重(%)', dataIndex: 'weight', key: 'weight', width: 100 },
            { title: '折合分', dataIndex: 'contribution', key: 'contribution', render: v => v?.toFixed(2), width: 100 }
        ];
        const data = [];
        selectedLessonObjs.forEach(lesson => {
            const validActivities = lesson.activities?.filter(isScorable) || [];
            validActivities.forEach(act => {
                const res = record.activityScores && record.activityScores[act._id || act.activityId];
                const contribution = res ? res.score * (res.weight / 100) : 0;
                data.push({
                    key: `${lesson._id}_${act._id}`,
                    title: `${lesson.title} - ${act.title}`,
                    type: act.type?.type || act.type,
                    score: res ? res.score : 0,
                    weight: res ? res.weight : 0,
                    contribution
                });
            });
        });
        return <Table columns={columns} dataSource={data} pagination={false} size="small" />;
    };

    return (
        <div className="exam-configuration">
            <Card
                title={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChartOutlined style={{ color: '#1890ff' }} />
                        考试成绩导出
                    </span>
                }
                extra={<Button onClick={() => window.history.back()}>返回</Button>}
            >
                {/* Steps Navigation */}
                <div className="exam-steps">
                    <Steps
                        current={currentStep}
                        items={[
                            {
                                title: '选择范围',
                                description: '班级和课程',
                                icon: currentStep > 0 ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : undefined
                            },
                            {
                                title: '配置权重',
                                description: '分配成绩占比',
                                icon: currentStep > 1 ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : undefined
                            },
                            {
                                title: '计算预览',
                                description: '查看并导出'
                            }
                        ]}
                    />
                </div>

                {/* History Config Selector */}
                {savedConfigs.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <Alert
                            type="info"
                            showIcon
                            icon={<HistoryOutlined />}
                            message={
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span>加载历史配置：</span>
                                    <Select
                                        style={{ minWidth: 300 }}
                                        placeholder="选择已保存的配置"
                                        loading={loadingConfigs}
                                        onChange={handleLoadConfig}
                                        value={configId}
                                        allowClear
                                        onClear={() => {
                                            setConfigId(null);
                                            setSelectedClasses([]);
                                            setSelectedCourse(null);
                                            setCheckedKeys([]);
                                            setLessonWeights({});
                                            setActivityWeights({});
                                            setGradeResults([]);
                                            form.resetFields();
                                        }}
                                    >
                                        {savedConfigs.map(cfg => (
                                            <Option key={cfg._id} value={cfg._id}>
                                                {cfg.course?.title || '未知课程'} - {cfg.classes?.map(c => c.name).join(', ') || '未选班级'}
                                                <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                                                    ({new Date(cfg.updatedAt).toLocaleDateString()})
                                                </span>
                                            </Option>
                                        ))}
                                    </Select>
                                    {configId && (
                                        <span style={{ color: '#52c41a', fontSize: 12 }}>
                                            ✓ 已加载配置
                                        </span>
                                    )}
                                </div>
                            }
                        />
                    </div>
                )}

                <Form form={form} layout="vertical" onFinish={handleSave}
                    onValuesChange={(changed, all) => {
                        if (changed.dailyPerformanceWeight !== undefined) {
                            setDailyWeight(changed.dailyPerformanceWeight);
                        }
                    }}
                >
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item name="classes" label="选择班级 (可多选)" rules={[{ required: true, message: '请选择班级' }]}>
                                <Select
                                    mode="multiple"
                                    onChange={setSelectedClasses}
                                    placeholder="选择一个或多个班级"
                                    optionFilterProp="children"
                                    size="large"
                                >
                                    {Object.entries(classes.reduce((acc, c) => {
                                        const g = c.grade || '其他';
                                        if (!acc[g]) acc[g] = [];
                                        acc[g].push(c);
                                        return acc;
                                    }, {})).sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([grade, list]) => (
                                        <Select.OptGroup key={grade} label={`${grade}级`}>
                                            {list.map(c => (
                                                <Option key={c._id} value={c._id}>
                                                    {c.name} ({grade}级)
                                                </Option>
                                            ))}
                                        </Select.OptGroup>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="course" label="选择课程" rules={[{ required: true, message: '请选择课程' }]}>
                                <Select onChange={setSelectedCourse} placeholder="选择课程" size="large">
                                    {courses.map(c => <Option key={c._id} value={c._id}>{c.title}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    {selectedCourse && (
                        <>
                            {/* Weight Progress Card */}
                            <div className="weight-progress-card">
                                <div className="weight-title">总权重分配</div>
                                <div className="weight-value">
                                    {currentTotalWeight.toFixed(1)}%
                                    {weightIsValid && <CheckCircleFilled style={{ marginLeft: 12, fontSize: 20 }} />}
                                </div>
                                <Progress
                                    percent={Math.min(currentTotalWeight, 100)}
                                    showInfo={false}
                                    status={weightIsValid ? 'success' : 'exception'}
                                    strokeWidth={8}
                                />
                                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                                    平时分 {dailyWeight}% + 课时 {(currentTotalWeight - dailyWeight).toFixed(1)}%
                                    {!weightIsValid && <span style={{ marginLeft: 12 }}>（需要调整为100%）</span>}
                                </div>
                            </div>

                            <Row gutter={24}>
                                <Col span={8}>
                                    <Card
                                        type="inner"
                                        title="1. 选择考核课时"
                                        className="selection-card"
                                        extra={
                                            selectedLessonCount > 0 && (
                                                <Tag color="blue">{selectedLessonCount} 个已选</Tag>
                                            )
                                        }
                                    >
                                        <div className="lesson-tree-container">
                                            {loading ? (
                                                <div style={{ textAlign: 'center', padding: 40 }}>
                                                    <Spin tip="加载中..." />
                                                </div>
                                            ) : treeData.length > 0 ? (
                                                <Tree
                                                    checkable
                                                    onCheck={onCheck}
                                                    checkedKeys={checkedKeys}
                                                    treeData={treeData}
                                                    defaultExpandAll
                                                />
                                            ) : (
                                                <Empty
                                                    description="暂无课时数据"
                                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                />
                                            )}
                                        </div>
                                    </Card>
                                </Col>
                                <Col span={16}>
                                    <Card
                                        type="inner"
                                        title="2. 分数权重配置"
                                        className="selection-card"
                                        extra={
                                            <Button
                                                icon={<ThunderboltOutlined />}
                                                onClick={distributeWeightsEvenly}
                                                disabled={selectedLessonObjs.length === 0}
                                                size="small"
                                            >
                                                一键均分权重
                                            </Button>
                                        }
                                    >
                                        <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                                            <Col span={8}>
                                                <Form.Item name="semester" label="选择学期" rules={[{ required: true, message: '请选择学期' }]} style={{ marginBottom: 0 }}>
                                                    <Select placeholder="选择学期">
                                                        {semesterOptions.map(opt => (
                                                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                                                        ))}
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col span={8}>
                                                <Form.Item
                                                    name="dailyPerformanceWeight"
                                                    label={
                                                        <span>
                                                            平时成绩占比 (%)
                                                            <Tooltip title="平时成绩来自系统学情分析模块的自动计算">
                                                                <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c', cursor: 'help' }} />
                                                            </Tooltip>
                                                        </span>
                                                    }
                                                    rules={[{ required: true, message: '请输入占比' }]}
                                                    initialValue={30}
                                                    style={{ marginBottom: 0 }}
                                                >
                                                    <InputNumber min={0} max={100} style={{ width: '100%' }} />
                                                </Form.Item>
                                            </Col>
                                            <Col span={8} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }}>
                                                <Tooltip title={
                                                    <div>
                                                        <div>• 总成绩 = 平时成绩×占比 + 课时得分×占比</div>
                                                        <div>• 平时分 + 课时权重之和 = 100%</div>
                                                        <div>• 每个课时内活动权重之和 = 100%</div>
                                                    </div>
                                                }>
                                                    <Button
                                                        type="link"
                                                        icon={<InfoCircleOutlined />}
                                                        style={{ color: '#8c8c8c', padding: '0 8px' }}
                                                    >
                                                        权重说明
                                                    </Button>
                                                </Tooltip>
                                            </Col>
                                        </Row>

                                        {selectedLessonObjs.length > 0 ? (
                                            <Table
                                                dataSource={selectedLessonObjs}
                                                columns={lessonColumns}
                                                rowKey="_id"
                                                pagination={false}
                                                expandable={{ expandedRowRender }}
                                                size="middle"
                                                scroll={{ y: 280 }}
                                            />
                                        ) : (
                                            <Empty
                                                description="请在左侧选择要考核的课时"
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                style={{ padding: 40 }}
                                            />
                                        )}
                                    </Card>
                                </Col>
                            </Row>
                        </>
                    )}

                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            loading={loading}
                            size="large"
                        >
                            保存配置
                        </Button>
                        <Button
                            type="default"
                            onClick={handleCalculate}
                            icon={<CalculatorOutlined />}
                            disabled={!configId}
                            loading={loading}
                            size="large"
                        >
                            计算成绩
                        </Button>
                        <Button
                            type="default"
                            onClick={handleExport}
                            icon={<DownloadOutlined />}
                            disabled={gradeResults.length === 0}
                            size="large"
                        >
                            导出成绩单
                        </Button>
                    </div>
                </Form>

                {/* Results Section */}
                {
                    gradeResults.length > 0 && (
                        <div className="results-section">
                            <h3>
                                <FileTextOutlined style={{ color: '#1890ff' }} />
                                成绩预览
                            </h3>

                            {/* Statistics Cards */}
                            {statistics && (
                                <div className="stats-container">
                                    <div className="stat-card avg">
                                        <div className="stat-value">{statistics.avg}</div>
                                        <div className="stat-label">平均分</div>
                                    </div>
                                    <div className="stat-card max">
                                        <div className="stat-value">{statistics.max}</div>
                                        <div className="stat-label">最高分</div>
                                    </div>
                                    <div className="stat-card min">
                                        <div className="stat-value">{statistics.min}</div>
                                        <div className="stat-label">最低分</div>
                                    </div>
                                    <div className="stat-card pass">
                                        <div className="stat-value">{statistics.passRate}%</div>
                                        <div className="stat-label">及格率 ({statistics.total}人)</div>
                                    </div>
                                </div>
                            )}

                            <Table
                                dataSource={gradeResults}
                                columns={resultColumns}
                                rowKey={(r) => r.student._id}
                                expandable={{ expandedRowRender: resultExpandedRowRender }}
                            />
                        </div>
                    )
                }
            </Card >
        </div >
    );
};

export default ExamConfiguration;
