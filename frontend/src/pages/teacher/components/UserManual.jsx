import React from 'react';
import './UserManual.css';
import { Tabs, Typography, Card, Grid, Steps, Divider, List, Alert, Tag, Row, Col, Timeline } from 'antd';
import {
    RocketOutlined,
    DesktopOutlined,
    BookOutlined,
    FormOutlined,
    EditOutlined,
    FileTextOutlined,
    BarChartOutlined,
    TeamOutlined,
    RobotOutlined,
    ShoppingOutlined,
    LayoutOutlined,
    CheckCircleFilled

} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;

const UserManual = () => {
    const screens = Grid.useBreakpoint();
    return (
        <div className="teacher-manual">
            <header className="teacher-manual-header">
            <Title level={2}>平台使用手册</Title>
            <Paragraph>
                欢迎使用教师工作台。本手册将帮助您快速上手平台的各项功能，提高教学效率。
            </Paragraph>

            </header>
            <div className="teacher-manual-body">
                <Tabs defaultActiveKey="quick-start" tabPosition={screens.md ? 'left' : 'top'}>
                    {/* 1. 快速开始 */}
                    <TabPane
                        tab={<span><RocketOutlined /> 快速开始</span>}
                        key="quick-start"
                    >
                        <Title level={3}>快速开始指南</Title>
                        <Paragraph>
                            教师工作台是您的教学指挥中心。以下是您每天开始工作时的建议流程：
                        </Paragraph>
                        <Steps
                            direction="vertical"
                            current={-1}
                            items={[
                                {
                                    title: '选择班级',
                                    description: '进入"上课"模块，在左上角选择当前授课的班级。',
                                },
                                {
                                    title: '设定课程内容',
                                    description: '使用级联选择器（课程-单元-课时）加载今天的教学内容。',
                                },
                                {
                                    title: '管理学生状态',
                                    description: '处理"登录请求"，查看学生在线状态，开始授课。',
                                },
                                {
                                    title: '课后跟进',
                                    description: '使用"作业批阅"和"学习统计"查看学生掌握情况。',
                                },
                            ]}
                        />
                    </TabPane>

                    {/* 2. 上课模块 */}
                    <TabPane
                        tab={<span><DesktopOutlined /> 上课管理</span>}
                        key="classroom"
                    >
                        <Title level={3}>上课管理 (Classroom)</Title>
                        <Paragraph>
                            "上课"是您使用频率最高的模块，集成了课堂实时的所有核心功能。
                        </Paragraph>

                        <Divider orientation="left">实时状态监控 (Real-time Status)</Divider>
                        <Paragraph>
                            系统并通过高频心跳包 (Heartbeat) 维护学生的在线状态：
                        </Paragraph>
                        <ul>
                            <li><Tag color="green">Online</Tag> <strong>活跃</strong>：Session 有效且 60秒内 有活动信号。</li>
                            <li><Tag color="cyan">Idle</Tag> <strong>挂机</strong>：Session 有效但超过 5分钟 无操作。</li>
                            <li><Tag color="default">Offline</Tag> <strong>离线</strong>：Session 过期或主动登出。</li>
                        </ul>
                        <Paragraph>
                            <Text type="secondary">注：状态延迟通常小于 30秒。</Text>
                        </Paragraph>

                        <Divider orientation="left">课堂控制开关 (Classroom Control)</Divider>
                        <List
                            itemLayout="horizontal"
                            dataSource={[
                                {
                                    title: '允许 IP 变更 (Allow IP Change)',
                                    desc: '开启后，对于一般性的 IP 变动请求，系统将自动放行，不再弹出人工审批窗口。（仅推荐在网络环境不稳定时开启）'
                                },
                                {
                                    title: '上课模式 (In-Class Mode)',
                                    desc: '强制锁定。开启后，学生端首页将自动重定向至当前选中的课时，且禁止访问其他非课程页面（如游戏中心）。'
                                },
                                {
                                    title: '允许 AI 辅助 (Allow AI)',
                                    desc: '全局开关。关闭后，学生在作业界面将无法调用 AI 助手进行提示或代码生成。'
                                }
                            ]}
                            renderItem={item => (
                                <List.Item>
                                    <List.Item.Meta
                                        title={<Text strong>{item.title}</Text>}
                                        description={item.desc}
                                    />
                                </List.Item>
                            )}
                        />

                        <Divider orientation="left">常用操作流程</Divider>
                        <Title level={5}>如何开始一节课？</Title>
                        <ol>
                            <li>点击左侧菜单的 <strong>上课</strong>。</li>
                            <li>在页面左上角选择当前班级。</li>
                            <li>在上方选择本节课的 <strong>课程</strong>、<strong>单元</strong> 和 <strong>课时</strong>。</li>
                            <li>等待学生登录，处理右侧弹出的 <strong>登录请求</strong>。</li>
                        </ol>

                        <Divider orientation="left">登录请求处理机理</Divider>
                        <Paragraph>
                            系统对登录安全有严格的校验逻辑，具体处理规则如下：
                        </Paragraph>
                        <ul>
                            <li><strong>IP 变更 (IP Change)</strong>：监测到学生尝试从新 IP 登录。批准后，系统会更新该生的<strong>登录历史记录</strong>，将最新记录的 IP 指向新地址。</li>
                            <li><strong>设备冲突 (Device Conflict)</strong>：监测到帐号在另一台设备活跃 (Session 有效)。批准后，系统会<strong>强制清除旧设备的 Session</strong>，立即使其下线，从而允许新设备登录。</li>
                        </ul>
                        <Paragraph>
                            <Text type="secondary">注：若遇到"组合冲突"（同时变更 IP 和设备），系统会同时执行上述两个操作。</Text>
                        </Paragraph>

                        <Alert
                            message="小技巧"
                            description="选择课时后，若该课时包含打字或测验活动，系统会自动开始尝试获取学生的实时提交记录。"
                            type="info"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    </TabPane>

                    {/* 3. 课程管理 */}
                    <TabPane
                        tab={<span><BookOutlined /> 课程管理</span>}
                        key="course"
                    >
                        <Title level={3}>课程管理 (Course Management)</Title>
                        <Paragraph>
                            课程系统采用三级结构：<Text strong>课程 (Course) &gt; 单元 (Unit) &gt; 课时 (Lesson)</Text>。
                            教师可在此构建包含多种交互形式的数字化教材。
                        </Paragraph>

                        <Divider orientation="left">1. 教师端配置 (Teacher Configuration)</Divider>
                        <Paragraph>
                            在 <Text code>LessonEdit.jsx</Text> 编辑器中，支持以下核心功能：
                        </Paragraph>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Card size="small" title="活动类型 (Activity Types)" className="feature-card">
                                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                                        <li><Tag color="green">Reading</Tag> Markdown 图文混排，支持代码高亮。</li>
                                        <li><Tag color="geekblue">Video</Tag> 视频教学，支持上传或外链。</li>
                                        <li><Tag color="gold">Python</Tag> 在线编程环境，内置自动评测 (Test Cases)。</li>
                                        <li><Tag color="purple">Quiz</Tag> 嵌入式随堂测验，支持即时反馈。</li>
                                        <li><Tag color="cyan">Typing</Tag> 打字练习，自定义目标速度与准确率。</li>
                                        <li><Tag color="magenta">Flowchart</Tag> 流程图绘制工具 (MxGraph)。</li>
                                    </ul>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" title="高级设置 (Advanced Settings)" className="feature-card">
                                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                                        <li><strong>作业提交 (Submission)</strong>: 勾选 <Text code>Require Submission</Text> 后，学生必须上传文件或提交代码。</li>
                                        <li><strong>参考答案 (Reference)</strong>: 可为编程题预置参考代码，仅在教师端可见。</li>
                                        <li><strong>资源附件</strong>: 支持随课时下发 PDF, ZIP 等课件供学生下载。</li>
                                        <li><strong>课时导出</strong>: 支持将整个课时及其资源打包导出 (.zip)，便于迁移。</li>
                                    </ul>
                                </Card>
                            </Col>
                        </Row>

                        <Divider orientation="left">2. 学生端体验 (Student Experience)</Divider>
                        <Paragraph>
                            学生通过 <Text code>LessonDetail.jsx</Text> 进行沉浸式学习，界面包含：
                        </Paragraph>
                        <ul>
                            <li><strong>侧边导航栏</strong>：动态显示活动列表及完成状态图标。
                                <ul>
                                    <li><CheckCircleFilled style={{ color: '#52c41a' }} /> <strong>已完成/已提交</strong></li>
                                    <li><div style={{ display: 'inline-block', width: 12, height: 12, border: '1px solid #d9d9d9', borderRadius: '50%' }} /> <strong>待完成</strong></li>
                                </ul>
                            </li>
                            <li><strong>AI 学习助手</strong>：右下角常驻 AI 助手，支持划词提问 (Selection Popup)。系统会限制 AI 仅提供思路而非直接代码。</li>
                            <li><strong>提交历史 (History)</strong>：学生可随时查看之前的代码版本、评测结果及教师反馈。</li>
                        </ul>

                        <Alert
                            message="权限控制与安全"
                            description={
                                <ul>
                                    <li><strong>访问白名单 (Access Control)</strong>: 课程仅对"已授权"班级的学生开放。</li>
                                    <li><strong>防作弊 (Anti-Cheat)</strong>: 切换页面或离开编辑器时，系统会自动记录日志；Python 编程题禁止直接复制外部代码（Paste Detection）。</li>
                                    <li><strong>深度导出 (Deep Export)</strong>: 导出的 .zip 包自动递归抓取所有依赖资源（图片/题库/附件），确保离线/跨服迁移时内容完整。</li>
                                </ul>
                            }
                            type="warning"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    </TabPane>

                    {/* 4. 测验模块 */}
                    <TabPane
                        tab={<span><FormOutlined /> 测验模块</span>}
                        key="quiz"
                    >
                        <Title level={3}>测验模块 (Quiz Module)</Title>
                        <Paragraph>
                            创建和发布交互式测验，支持单选、多选、判断和心理量表题。
                        </Paragraph>
                        <Paragraph>
                            <strong>关键特性：</strong> 题目支持 Markdown 渲染（包含代码块和图片）。发布测验后，即时生效。
                        </Paragraph>
                        <Divider orientation="left">出题与发布规则</Divider>
                        <Paragraph>
                            测验系统包含严格的状态流转与数据保护机制：
                        </Paragraph>
                        <ul>
                            <li><strong>状态锁定 (State Lock)</strong>：测验一旦发布 (<Text code>Published</Text>)，将<strong>锁定</strong>所有题目引用。若需修改题目或调整顺序，必须先撤回发布 (Revert to Draft)。</li>
                            <li><strong>题目安全 (Soft Delete)</strong>：从题库删除题目不会影响已发布的试卷。系统执行"软删除"，确保历史成绩数据的完整性。</li>
                            <li><strong>类型隔离</strong>：心理量表 (Scale) 是特殊的测验类型，只能包含量表题，不可与普通知识题混排。</li>
                        </ul>

                        <Divider orientation="left">AI 智能辅助</Divider>
                        <Paragraph>
                            在题库中点击"AI 导入"，粘贴纯文本（如 Word 文档内容），AI 会自动识别：
                        </Paragraph>
                        <ul>
                            <li><strong>题型识别</strong>：自动区分单选、判断或量表题。</li>
                            <li><strong>自动解析</strong>：提取正确答案和解析说明。</li>
                            <li><strong>Markdown</strong>：保留题目中的代码块和公式格式。</li>
                        </ul>
                    </TabPane>

                    {/* 5. 打字模块 */}
                    <TabPane
                        tab={<span><EditOutlined /> 打字模块</span>}
                        key="typing"
                    >
                        <Title level={3}>打字模块 (Typing Module)</Title>
                        <Paragraph>
                            管理打字练习文章。系统会自动计算学生的速度 (WPM) 和准确率。
                        </Paragraph>
                        <Paragraph>
                            <strong>计分规则：</strong> 此模块的成绩会计入"平时表现"积分系统。
                        </Paragraph>
                        <ul>
                            <li><strong>文本管理</strong>：上传或录入供学生练习的文章，支持中英文。</li>
                            <li><strong>打字记录</strong>：查看学生的打字速度 (WPM) 和准确率。支持按班级筛选排名。</li>
                        </ul>
                    </TabPane>

                    {/* 6. 作业批阅 */}
                    <TabPane
                        tab={<span><FileTextOutlined /> 作业批阅</span>}
                        key="assignment"
                    >
                        <Title level={3}>作业批阅 (Assignment Review)</Title>
                        <Paragraph>
                            集中处理各类作业提交。支持 AI 辅助批改。
                        </Paragraph>
                        <Paragraph>
                            <strong>作业类型支持：</strong> Python 代码、流程图设计、HTML 网页、电子表格任务。
                        </Paragraph>

                        <Divider orientation="left">特殊作业类型 (Specialized Types)</Divider>
                        <Paragraph>
                            不同类型的作业有特定的处理逻辑：
                        </Paragraph>
                        <ul>
                            <li><strong>Python 编程</strong>：
                                <ul>
                                    <li><strong>实时评测</strong>：提交时立即运行测试用例（Test Cases）。</li>
                                    <li><strong>沙箱环境</strong>：代码在隔离容器中通过 `pythonController` 执行，禁止网络访问。</li>
                                </ul>
                            </li>
                            <li><strong>HTML 网页制作</strong>：
                                <ul>
                                    <li><strong>作品发布</strong>：学生可消耗 <Text type="danger">500 积分</Text> 将作品发布到公共画廊（限发布 2 个）。教师发布无限制。</li>
                                    <li><strong>格式限制</strong>：仅支持单页应用，资源需内联或引用允许的外部 CDN。</li>
                                </ul>
                            </li>
                            <li><strong>流程图 (Flowchart)</strong>：
                                <ul>
                                    <li><strong>奖励机制</strong>：首次提交奖励 <Text type="success">50 积分</Text>。</li>
                                    <li><strong>兼容性</strong>：系统解析 JSON (ReactFlow) 和 XML (mxGraph) 两种格式。</li>
                                </ul>
                            </li>
                            <li><strong>电子表格 (Spreadsheet)</strong>：
                                <ul>
                                    <li><strong>存储格式</strong>：LuckySheet JSON 格式。仅支持人工评分，不支持公式自动校验。</li>
                                </ul>
                            </li>
                        </ul>

                        <Divider orientation="left">技术原理：AI 自动与辅助批改</Divider>
                        <Paragraph>
                            系统根据作业类型采用不同的批改策略：
                        </Paragraph>
                        <ul>
                            <li><strong>Python/编程自动评测 (Instant Auto-grade)</strong>：
                                <ul>
                                    <li><strong>触发时机</strong>：学生点击"提交"瞬间，前端运行测试用例。</li>
                                    <li><strong>计分逻辑</strong>：系统直接将自动评测得分写入数据库，状态标记为"已提交（自动评测）"。教师可随时覆盖此分数。</li>
                                </ul>
                            </li>
                            <li><strong>主观题 AI 预评 (AI Suggestion)</strong>：
                                <ul>
                                    <li><strong>触发时机</strong>：作业提交后，后台 AI 服务异步分析内容。</li>
                                    <li><strong>生效机制</strong>：AI 给出的分数仅作为<strong>建议 (aiGrade)</strong>。当教师未进行人工评分时，系统计算总成绩时会兜底使用 AI 分数；一旦教师评分，则完全以教师评分为准。</li>
                                </ul>
                            </li>
                        </ul>

                        <Divider orientation="left">分数与积分同步</Divider>
                        <Paragraph>
                            作业评分直接关联学生的激励体系。
                            <br />
                            <strong>同步公式：</strong> <Text code>Points = Score × 10</Text>
                            <br />
                            <Text type="secondary">例如：作业得 8.5 分，学生积分商店账户将自动增加 85 积分。重新评分会自动多退少补。</Text>
                        </Paragraph>
                    </TabPane>

                    {/* 7. 学习统计 */}
                    <TabPane
                        tab={<span><BarChartOutlined /> 学习统计</span>}
                        key="stats"
                    >
                        <Title level={3}>学习统计与算法说明</Title>
                        <Paragraph>
                            本模块展示基于严格算法计算的学情数据。以下是核心指标的计算逻辑：
                        </Paragraph>

                        <Divider orientation="left">1. 平日成绩 (Daily Performance) 计算模型</Divider>
                        <Paragraph>
                            平日成绩是一个<strong>累加积分</strong>系统，而非简单的平均分。它鼓励持续参与。
                            <br />
                            <strong>积分公式：</strong> <Text code>Total = Σ Max(ActivityScore, 10)</Text>
                        </Paragraph>
                        <ul>
                            <li><strong>活动积分制</strong>：每个独立的教学活动（如一篇打字练习、一个测验）满分均为 <strong>10分</strong>。</li>
                            <li><strong>取最高分</strong>：对于允许多次提交的活动，系统自动抓取该生在统计周期内的<strong>最高得分</strong>计入总分。</li>
                            <li><strong>组件包括</strong>：打字 (Typing), 测验 (Quiz), 作业 (Assignment), 流程图 (Flowchart), Python, 填空 (FillBlank), 表格 (Spreadsheet)。</li>
                        </ul>

                        <Divider orientation="left">2. 相对评价等级 (Relative Grading Curve)</Divider>
                        <Paragraph>
                            系统采用<strong>正态分布 (Standard Deviation)</strong> 算法对班级平日成绩进行评级，确保排名的科学性。
                        </Paragraph>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #f0f0f0', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>等级 (Grade)</th>
                                    <th style={{ padding: '8px' }}>判定标准 (Criteria)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style={{ padding: '8px' }}><strong>A+</strong></td><td style={{ padding: '8px' }}>&ge; 平均分 + 1.5倍标准差</td></tr>
                                <tr><td style={{ padding: '8px' }}><strong>A</strong></td><td style={{ padding: '8px' }}>&ge; 平均分 + 1.0倍标准差</td></tr>
                                <tr><td style={{ padding: '8px' }}><strong>B+</strong></td><td style={{ padding: '8px' }}>&ge; 平均分 + 0.5倍标准差</td></tr>
                                <tr><td style={{ padding: '8px' }}><strong>B</strong></td><td style={{ padding: '8px' }}>&ge; 平均分</td></tr>
                                <tr><td style={{ padding: '8px' }}><strong>C/D/F</strong></td><td style={{ padding: '8px' }}>&lt; 平均分 (按 -0.5, -1.0, -1.5 倍标准差递减)</td></tr>
                            </tbody>
                        </table>
                        <Alert
                            message="小班保护机制 (Small Class Fallback)"
                            description="若班级人数过少（N < 2，无法计算方差）或标准差为0，系统将自动回退到绝对分数标准：A (≥80), B (≥70), C (≥60)。"
                            type="info"
                            showIcon
                        />

                        <Divider orientation="left">3. 考试成绩导出 (Exam Score Export)</Divider>
                        <Paragraph>
                            <Text strong>功能定位：</Text> 此功能用于期末或阶段性考核。它将分散在各个课时中的活动（作业、测验、打字）成绩聚合，结合该生平时的"表现积分"等级，计算出最终的加权总成绩，并导出为 Excel 报表。
                        </Paragraph>

                        <Alert
                            message="操作流程 (Workflow)"
                            description={
                                <Steps
                                    current={1}
                                    size="small"
                                    style={{ marginTop: 12, marginBottom: 12 }}
                                    items={[
                                        {
                                            title: '选择范围 (Scope)',
                                            description: '指定计算分数的班级与课程。',
                                        },
                                        {
                                            title: '配置权重 (Weighting)',
                                            description: '设定平时分占比(Daily) 与 各课时/活动占比。',
                                        },
                                        {
                                            title: '计算与导出 (Export)',
                                            description: '系统自动拉取所有数据，生成 Excel。',
                                        },
                                    ]}
                                />
                            }
                            type="info"
                        />

                        <Paragraph>
                            <strong>3.1 核心算分机制 (Technical Mechanics):</strong>
                        </Paragraph>
                        <Paragraph>
                            当您点击"导出"时，前端组件 (<Text code>ExamConfiguration.jsx</Text>) 会执行以下逻辑：
                        </Paragraph>
                        <ol>
                            <li><strong>等级数字化 (Grade Mapping)</strong>: 首先调用 <Text code>analyticsController</Text> 获取学生的平时表现等级 (A+/A/B...)，并按如下标准映射为基础分：</li>
                        </ol>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '13px', textAlign: 'center' }}>
                            <thead>
                                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                                    <th style={{ padding: '8px' }}>等级</th>
                                    <th style={{ padding: '8px' }}>折算分 (Score)</th>
                                    <th style={{ padding: '8px' }}>等级</th>
                                    <th style={{ padding: '8px' }}>折算分</th>
                                    <th style={{ padding: '8px' }}>等级</th>
                                    <th style={{ padding: '8px' }}>折算分</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><Tag color="green">A+</Tag></td><td><strong>100</strong></td>
                                    <td><Tag color="cyan">B+</Tag></td><td><strong>85</strong></td>
                                    <td><Tag color="orange">C+</Tag></td><td><strong>75</strong></td>
                                </tr>
                                <tr>
                                    <td><Tag color="green">A</Tag></td><td><strong>90</strong></td>
                                    <td><Tag color="cyan">B</Tag></td><td><strong>80</strong></td>
                                    <td><Tag color="orange">C</Tag></td><td><strong>70</strong></td>
                                </tr>
                                <tr>
                                    <td><Tag color="green">A-</Tag></td><td><strong>88</strong></td>
                                    <td><Tag color="cyan">B-</Tag></td><td><strong>78</strong></td>
                                    <td><Tag color="orange">C-</Tag></td><td><strong>68</strong></td>
                                </tr>
                                <tr>
                                    <td colSpan={2}></td>
                                    <td colSpan={2}></td>
                                    <td><Tag color="red">D/F</Tag></td><td><strong>60/40</strong></td>
                                </tr>
                            </tbody>
                        </table>

                        <ol start="2">
                            <li><strong>权重聚合 (Weighted Aggregation)</strong>: 系统遍历您选择的每一个课时 (Lesson) 和活动 (Activity)，提取该学生的最高得分记录。</li>
                            <li><strong>最终合成 (Final Formula)</strong>:</li>
                        </ol>

                        <Alert
                            message="Calculation Logic"
                            description={
                                <div>
                                    <Text code style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                                        FinalScore = (Map(Grade) × DailyWeight%) + Σ(ActivityScore × ActivityWeight%)
                                    </Text>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        <li><strong>Map(Grade)</strong>: 上表中的折算分（如 A → 90）。</li>
                                        <li><strong>ActivityScore</strong>: 学生的实际卷面得分 (0-100)。</li>
                                        <li><strong>Weight%</strong>: 您在第二步"配置权重"界面手动输入的百分比。</li>
                                    </ul>
                                </div>
                            }
                            type="info"
                            showIcon
                        />
                        <Paragraph style={{ marginTop: 12 }}>
                            <Text type="secondary">注：Excel 文件生成完全在浏览器端 (<Text code>SheetJS</Text>) 完成，数据来源于后端 <Text code>examController.calculateGrades</Text> 接口返回的包含完整得分详情的 JSON 对象。</Text>
                        </Paragraph>
                    </TabPane>


                    {/* 8. 班级管理 */}
                    <TabPane
                        tab={<span><TeamOutlined /> 班级管理</span>}
                        key="class"
                    >
                        <Title level={3}>班级管理 (Class Management)</Title>
                        <Paragraph>
                            <Text strong>批量导入逻辑：</Text> 系统根据 Excel 中的 <Text code>grade</Text> (年级) 和 <Text code>class</Text> (班级号) 自动分组。
                            若对应的班级不存在，系统会自动为您创建新班级。
                        </Paragraph>
                        <Alert
                            message="Excel 模板要求"
                            description={
                                <ul>
                                    <li><strong>必要列名</strong>：username (学号), name (姓名), password (密码, 至少6位), grade (年份, 如 2024), class (班号)</li>
                                    <li><strong>格式校验</strong>：Grade 必须为 4 位数字年份。</li>
                                </ul>
                            }
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Divider orientation="left">关键操作风险提示</Divider>
                        <Alert
                            message="删除学生是不可逆操作"
                            description="点击'删除学生'后，系统将执行级联删除：该学生的所有作业提交、测验成绩、打字记录以及账号本身都将被永久清除，且无法恢复。"
                            type="error"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Paragraph>
                            <strong>其他功能：</strong>
                        </Paragraph>
                        <ul>
                            <li><strong>清空座位</strong>：一键清除全班学生的座位绑定，用于新学期重新排座。</li>
                            <li><strong>在线状态</strong>：
                                <ul>
                                    <li><Tag color="green">Online</Tag>：当前 Session 有效且未过期。</li>
                                    <li><Tag color="red">Absent</Tag>：今日未登录或 Session 已过期。</li>
                                </ul>
                            </li>
                        </ul>
                    </TabPane>

                    {/* 9. 机房管理 */}
                    <TabPane
                        tab={<span><LayoutOutlined /> 机房管理</span>}
                        key="classroom-layout"
                    >
                        <Title level={3}>机房管理 (Classroom Layout)</Title>
                        <Paragraph>
                            配置机房的物理布局（行/列），用于上课页面的座位表显示。
                        </Paragraph>
                        <ul>
                            <li><strong>新建布局</strong>：输入机房名称（如"第一机房"）和行列数（如 6行 x 8列）。</li>
                            <li><strong>座位映射</strong>：系统会根据行数和列数自动生成网格座位表。在上课时选择对应的机房布局，学生登录后会自动填充到座位上（或由学生手动选择座位）。</li>
                        </ul>
                    </TabPane>

                    {/* 10. 积分商店 */}
                    <TabPane
                        tab={<span><ShoppingOutlined /> 积分商店</span>}
                        key="point-shop"
                    >
                        <Title level={3}>积分商店 (Point Shop)</Title>
                        <Paragraph>
                            通过积分奖励机制激励学生学习。学生通过完成作业、打字练习等获得积分，并可在此消耗积分兑换奖励。
                        </Paragraph>

                        <Divider orientation="left">积分运行机制</Divider>
                        <Alert
                            message="重要：商品可见性规则"
                            description="学生只能看到【本班班主任】发布的商品。请确保您的账号已正确关联到对应班级。"
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />

                        <Tabs defaultActiveKey="1">
                            <Tabs.TabPane tab="商品管理与兑换" key="1">
                                <Paragraph>
                                    <strong>自动交付类型：</strong>
                                </Paragraph>
                                <ul>
                                    <li><strong>网络时间 (Network Time)</strong>：学生兑换并使用后，系统会自动解禁其上网权限（默认60分钟）。</li>
                                    <li><strong>游戏时间 (Game Time)</strong>：兑换后自动增加"游戏中心"的剩余时长，立即生效。</li>
                                    <li><strong>无限库存</strong>：设置库存为 <Text code>-1</Text> 即代表无限量供应。</li>
                                </ul>
                            </Tabs.TabPane>
                            <Tabs.TabPane tab="众筹活动 (Crowdfunding)" key="2">
                                <Paragraph>
                                    全班共同参与的集体目标（如"全班看电影"）。
                                </Paragraph>
                                <ul>
                                    <li><strong>扣分机制</strong>：学生点击"贡献"时，积分会<strong>立即扣除</strong>，而非等目标达成后再扣。</li>
                                    <li><strong>目标达成</strong>：当总贡献分 &ge; 目标分时，状态变为"待完成"，教师需手动点击"完成"以确认奖励履行。</li>
                                </ul>
                            </Tabs.TabPane>
                            <Tabs.TabPane tab="积分管理" key="3">
                                <Paragraph>
                                    管理员可手动干预积分。
                                </Paragraph>
                                <ul>
                                    <li><strong>奖惩操作</strong>：在"班级管理"或此处可手动增减学生积分（"奖励"或"违纪扣分"）。</li>
                                    <li><strong>流水记录</strong>：所有系统的积分变动（作业、兑换、众筹）均有不可篡改的流水日志。</li>
                                </ul>
                            </Tabs.TabPane>
                        </Tabs>
                    </TabPane>

                    {/* 11. AI & 智能特性 */}
                    <TabPane
                        tab={<span><RobotOutlined /> AI & 智能特性</span>}
                        key="ai-features"
                    >
                        <Title level={3}>AI & 智能特性 (AI & Smart Features)</Title>
                        <Paragraph>
                            平台集成了基于 RAG (检索增强生成) 的 AI 助手，服务于备课与辅导场景。
                        </Paragraph>

                        <Divider orientation="left">1. 学生 AI 助教 (Student Assistant)</Divider>
                        <ul>
                            <li><strong>上下文记忆</strong>：AI 仅保留最近 <strong>3轮 (6条)</strong> 对话记录，确保回答聚焦当前问题。</li>
                            <li><strong>防作弊指令 (System Prompt)</strong>：系统预置提示词明确禁止 AI 直接提供完整代码，仅允许提供思路引导或伪代码。</li>
                            <li><strong>教师监管</strong>：所有学生与 AI 的对话默认为 <Tag color="warning">Pending</Tag> 状态，教师可在后台实时审查。</li>
                        </ul>

                        <Divider orientation="left">2. 智能备课 (AI Prep with RAG)</Divider>
                        <Paragraph>
                            利用 RAG 技术结合本地知识库辅助教学设计。
                        </Paragraph>
                        <ul>
                            <li><strong>教案生成</strong>：检索 Top-5 相关文档片段 (Threshold 0.3)，生成结构化教案。</li>
                            <li><strong>智能出题</strong>：检索 Top-10 相关片段 (Threshold 0.2)，输出 JSON 格式的习题集。</li>
                            <li><strong>输出限制</strong>：单次生成最大支持 <strong>4096 Tokens</strong>。</li>
                        </ul>

                        <Divider orientation="left">3. 通讯安全 (Communication Safety)</Divider>
                        <Alert
                            message="代码防抄袭机制 (Anti-Plagiarism)"
                            description="为防止学生抄袭，系统在私聊 (Direct) 和群聊 (Group) 中强制拦截 Python 代码分享。"
                            type="info"
                            showIcon
                        />
                        <div className="teacher-manual-rules">
                            <strong>拦截规则</strong>：
                            <ul>
                                <li>检测到 <Text code>.py</Text> 文件上传。</li>
                                <li>检测到 <Text code>def / class / import</Text> 等高频代码关键字组合。</li>
                            </ul>
                        </div>
                    </TabPane>
                    {/* 12. 自主练习 & 防作弊 */}
                    <TabPane
                        tab={<span><FormOutlined /> 自主练习</span>}
                        key="free-practice"
                    >
                        <Title level={3}>自主练习 (Self-Directed Practice)</Title>
                        <Paragraph>
                            包括打字练习和自由刷题，旨在鼓励学生利用课余时间提升技能。为防止滥用，系统设有严格的积分与反作弊限制。
                        </Paragraph>

                        <Divider orientation="left">1. 打字练习 (Typing)</Divider>
                        <ul>
                            <li><strong>积分公式</strong>：<Text code>Points = Min(100, (Speed / TargetSpeed) * 100)</Text></li>
                            <li><strong>每日上限</strong>：每人每日最多获得 <strong>500 积分</strong>。达到上限后继续练习不再加分。</li>
                            <li><strong>有效性门槛</strong>：准确率低于 <strong>50%</strong> 的记录将被系统判定为无效提交，不予记录也不加分。</li>
                        </ul>

                        <Divider orientation="left">2. 自由刷题 (Quiz Practice)</Divider>
                        <ul>
                            <li><strong>安全机制</strong>：题目下发时自动剔除答案字段，防止前端抓包作弊。</li>
                            <li><strong>每日上限</strong>：与打字练习独立，每日最多获得 <strong>500 积分</strong>。</li>
                            <li><strong>配置管理</strong>：教师可按班级设定题目类型、难度范围及每日单题分值（默认 5分/题）。</li>
                        </ul>

                        <Divider orientation="left">3. 教师监管</Divider>
                        <Paragraph>
                            教师有权<strong>删除</strong>任何异常的练习记录。删除记录时，系统会自动<strong>追回 (Deduct)</strong> 该记录产生的积分，并通知学生。
                        </Paragraph>
                    </TabPane>
                    {/* 13. 系统维护 & 备份 */}
                    <TabPane
                        tab={<span><LayoutOutlined /> 系统维护</span>}
                        key="system-maintenance"
                    >
                        <Title level={3}>系统维护 (System Maintenance)</Title>
                        <Paragraph>
                            提供数据备份、日志审计及系统状态监控功能，确保平台稳定运行。
                        </Paragraph>

                        <Divider orientation="left">1. 数据备份 (Backup & Restore)</Divider>
                        <Alert
                            message="高风险操作警告"
                            description="在使用【导入备份】功能时，系统将清空当前所有数据库记录并替换为备份文件中的数据。此操作不可撤销，请谨慎使用。"
                            type="error"
                            showIcon
                        />
                        <ul>
                            <li><strong>导出备份</strong>：生成包含所有数据库记录 (JSON) 及 <Text code>uploads/resources</Text> 资源的 ZIP 包。可选包含学生作业文件 (Assignments)。</li>
                            <li><strong>导入恢复</strong>：上传 ZIP 包还原数据。系统会自动处理数据库重置与文件恢复。</li>
                            <li><strong>后台执行</strong>：备份生成是在后台异步进行的，无需让页面一直加载等待。</li>
                        </ul>

                        <Divider orientation="left">2. 日志审计 (System Logs)</Divider>
                        <Paragraph>
                            系统按天生成日志文件，分为 <Text code>combined</Text> (所有日志) 和 <Text code>error</Text> (错误日志)。
                        </Paragraph>
                        <ul>
                            <li><strong>实时监控</strong>：支持查看最近 100 条实时日志，用于排查突发问题。</li>
                            <li><strong>空间管理</strong>：支持按文件下载或清空旧日志以释放磁盘空间。</li>
                        </ul>

                        <Divider orientation="left">3. 资源监控 (Resource Monitor)</Divider>
                        <Paragraph>
                            监控 <Text code>uploads</Text> 目录的磁盘占用情况，并按课程/班级统计文件分布，帮助教师清理不再需要的作业存档。
                        </Paragraph>
                    </TabPane>
                    {/* 14. 更新日志 */}
                    <TabPane
                        tab={<span><FileTextOutlined /> 更新日志</span>}
                        key="changelog"
                    >
                        <Title level={3}>更新日志 (Changelog)</Title>
                        <Paragraph>
                            以下是平台每一次更新的具体内容及对应的提交日期。当前版本：<Tag color="blue">v1.5.3</Tag>
                        </Paragraph>

                        <div style={{ marginTop: 24 }}>
                            <Timeline>
                                <Timeline.Item color="green">
                                    <strong>v1.5.3 (2026-10-16)</strong>
                                    <ul>
                                        <li>统一教师工作台的松绿色主题、导航与表格样式，顶部图标改用同色 SVG；当前模块名称随菜单切换，并与侧边栏边界对齐。</li>
                                        <li>教师端主体改为连续白色工作区，移除外围留白、圆角和重复标题，简化课程列表与学习统计筛选栏的嵌套边框，修正侧边栏折叠按钮的宽度对齐。</li>
                                        <li>优化平台手册布局，取消最大宽度限制与多余卡片，压缩目录间距，小屏幕使用横向目录；统一浅色提示背景，修复试卷分析无测验时被显示为错误及空状态重复提示的问题。</li>
                                        <li>修复学生遇到 IP 变更、设备在线冲突或两者同时发生时，因日志引用未定义 IP 变量而无法发送登录请求的问题。</li>
                                        <li>教师打字记录改为后端分页，支持调整每页条数、筛选后回到首页及删除末页记录后自动回退；翻页不重复加载统计，统计改由数据库汇总，并保留课堂页获取完整活动记录的行为。</li>
                                        <li>完善 PPT 动画自动评阅，同一对象的进入、退出等动画分别判分，缺少某类动画或声音设置错误不会影响其他动画的得分。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="green">
                                    <strong>v1.5.2 (2026-10-12)</strong>
                                    <ul>
                                        <li>课时新增完整包、内容包和媒体包三种导出方式，大视频可与内容分开迁移；内容包与媒体包导入顺序不限，系统自动关联媒体并更新 Markdown 引用。</li>
                                        <li>导出自动收集跨课时引用的公开媒体，兼容旧课时包和原服务器完整链接；媒体按文件哈希校验与去重，导入后及课时编辑页提示缺失媒体数量和大小。</li>
                                        <li>课时资源包支持 8 MB 分片上传，单包最大 2 GB，中断后重新选择同一文件可继续；重复完成请求避免重复创建课时。</li>
                                        <li>修复 Node 16 Docker 环境下文件清理预览及清理任务因缺少 structuredClone 而报错的问题。</li>
                                        <li>登录页默认直接显示，仅在后台明确检测到未初始化时跳转设置页；缓存已初始化状态并合并并发检查，优化居中加载卡片并延后显示，减少闪屏。</li>
                                        <li>修复已有教师账号的数据库在网页初始化时因用户名索引重复声明而失败的问题，保留原有用户名唯一约束。</li>
                                        <li>新增网页初始化向导，首次使用可直接创建管理员账号；关闭公开注册，教师由管理员创建，学生由教师或管理员批量导入，密码最少 6 位。</li>
                                        <li>优化磁盘统计缓存与后台扫描，文件清理改为后台任务并显示处理状态，减少大量文件导致的请求超时。</li>
                                        <li>完善登录审批、题库、课时、文件下载及积分商店的权限校验，修复学生提前获取测验答案和重复答案提交的问题。</li>
                                        <li>完善测验次数限制、重复提交处理和积分结算恢复；积分兑换及众筹增加库存、余额和失败恢复保护，兼容现有单机 MongoDB 部署。</li>
                                        <li>自由测验正确率达到 60% 才奖励积分，低于 60% 不加积分并显示原因；按实际题数计算正确率，保留每日 500 分上限。</li>
                                        <li>优化页面按需加载、日志敏感信息隐藏及邮件路由，完善 PPT 自动评阅与作业格式校验，补充回归测试和运维说明。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="green">
                                    <strong>v1.5.1 (2026-10-10)</strong>
                                    <ul>
                                        <li>优化教师作业批阅加载速度，提交列表只加载成绩摘要，选中学生后按需加载评阅详情并缓存；Excel 预览在打开预览页签时加载。</li>
                                        <li>完善 Excel 公式重算，支持 IF、比较运算和常用逻辑函数，取消 Excel 人工复核状态；无法计算的公式显示明确的未通过原因。</li>
                                        <li>新增条件格式判分，修复同一排序列因单格与范围写法不同而误判的问题，支持等价的条件格式区域拆分和颜色编码。</li>
                                        <li>优化 PPT、Excel 学生端得分详情，展示操作要求、当前结果和修改建议，隐藏技术字段；未通过项优先显示，已通过项默认折叠，单项分值统一折算到满分 10 分。</li>
                                        <li>Excel 批阅默认开启“仅看错题”，便于快速定位需要修改的内容。</li>
                                        <li>修复积分累加产生过长小数的问题，积分余额与流水统一保留两位小数，兼容已有浮点尾差；学生顶部积分仅显示整数部分，实际余额仍保留小数。</li>
                                    </ul>
                                </Timeline.Item>


                                <Timeline.Item color="green">
                                    <strong>v1.5.0 (2026-10-09)</strong>
                                    <ul>
                                        <li>新增 Excel 自动评阅，可通过原稿与参考答案自动分析得分点，检查函数、计算结果、格式、图表及工作表操作，并按区域完成比例给分。</li>
                                        <li>完善 PPT 自动评阅，支持动画、切换、背景、母版图片、音视频等考点；尺寸独立计分，移除位置与幻灯片顺序得分点，修复同一音视频重复生成得分点的问题。</li>
                                        <li>统一 PPT 与 Excel 的题目设置和批阅界面，支持批量重新评阅已批阅作业，显示批阅进度，并修复班级筛选重置及评阅记录显示问题。</li>
                                        <li>教师启用自动评阅后，学生上传作业即可获得评阅反馈；自动评分作业可在课时详情重新提交，教师人工评分后不可覆盖提交。</li>
                                        <li>作业成绩统一按 10 分显示并支持小数；重新评阅按新旧成绩差额调整积分，避免重复累计。</li>
                                        <li>优化学生首页与课时详情的得分展示，统一得分详情样式，将未通过项优先展示，并简化提交历史弹窗。</li>
                                    </ul>
                                </Timeline.Item>


                                <Timeline.Item color="green">
                                    <strong>v1.4.1 (2026-09-28)</strong>
                                    <ul>
                                        <li>积分商店新增“游戏中心设置”，支持按班级独立开启或关闭游戏中心的可见性，提供批量管理能力。</li>
                                        <li>作业批阅模块新增全局分数排序功能，支持按升序/降序排列学生列表。</li>
                                        <li>作业批阅模块新增 PPT 和 Excel 作业的批量下载功能，并自动按“年级-班级-学号-姓名”规范化重命名。</li>
                                        <li>课时编辑器新增作业提交格式校验，防止不兼容的专用解析格式混选。</li>
                                    </ul>
                                </Timeline.Item>
                                
                                <Timeline.Item color="blue">
                                    <strong>v1.4.0 (2026-09-17)</strong>
                                    <ul>
                                        <li>添加负时长数据修复脚本。</li>
                                        <li>更新多个核心组件和控制器。</li>
                                    </ul>
                                </Timeline.Item>
                                
                                <Timeline.Item color="blue">
                                    <strong>v1.3.8 (2026-09-09)</strong>
                                    <ul>
                                        <li>新增班级归档系统，支持已毕业学生数据归档。</li>
                                        <li>修复 Express 路由（/archived 等）加载顺序冲突问题。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.3.7 (2026-01-22)</strong>
                                    <ul>
                                        <li>新增 <Text code>PythonReview</Text> 组件，提供 Python 代码打分功能。</li>
                                        <li>上线动态机房排座系统，支持物理网格布局、自动绑定学生及座位积分操作。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="gray">
                                    <strong>v1.3.6 (2025-10-28)</strong>
                                    <ul>
                                        <li>增加全局视频预览功能。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="gray">
                                    <strong>v1.3.5 (2025-10-11)</strong>
                                    <ul>
                                        <li>优化大模型 Prompt 提示词。</li>
                                        <li>新增内部消息系统。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.3.0 (2025-09-15)</strong>
                                    <ul>
                                        <li>新增 <Text code>AdminDashboard</Text> 控制台，包含操作日志记录和资源审核。</li>
                                        <li>重构心理量表模块逻辑。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="gray">
                                    <strong>v1.2.5 (2025-05-20)</strong>
                                    <ul>
                                        <li>小恐龙游戏支持离线模式。</li>
                                        <li>优化测验结果显示：隐藏答案时展示所有选项，优化代码块边框样式。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.2.4 (2025-04-27)</strong>
                                    <ul>
                                        <li>完善学生删除功能：同步清理其历史测验和打字记录。</li>
                                        <li>修复后台 API 路径并添加日志记录机制。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.2.3 (2025-04-08)</strong>
                                    <ul>
                                        <li>学生登录时增加确认座位流程。</li>
                                        <li>教师可在批改作业时直接修改参考答案。</li>
                                        <li>课时编辑支持直接修改测验设置。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.2.2 (2025-04-07)</strong>
                                    <ul>
                                        <li>优化座位图界面布局和响应式设计。</li>
                                        <li>游戏中心更新：增加推箱子和太空打字。</li>
                                        <li>测验界面 UI 优化，合并多次尝试选项。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.2.0 (2025-04-01)</strong>
                                    <ul>
                                        <li>打字练习增加最低 50% 准确率拦截。</li>
                                        <li>删除控制台调试输出，防止测验抓包泄露答案。</li>
                                        <li>清理未使用的数据模型，更新备份系统机制。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="gray">
                                    <strong>v1.1.5 (2025-03-31)</strong>
                                    <ul>
                                        <li>添加俄罗斯方块游戏。</li>
                                        <li>修复积分商店商品卡片排版。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.1.4 (2025-03-26 ~ 30)</strong>
                                    <ul>
                                        <li>上线积分商店系统及打字练习自动积分。</li>
                                        <li>添加学习统计及成绩展示看板。</li>
                                        <li>教师登录凭证延长至 12 小时有效。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="gray">
                                    <strong>v1.1.3 (2025-03-12 ~ 25)</strong>
                                    <ul>
                                        <li>增加 Swagger API 文档集成。</li>
                                        <li>优化 HTML 全屏预览。</li>
                                        <li>优化座位图格子尺寸及作业提交统计显示。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.1.0 (2025-03-04 ~ 06)</strong>
                                    <ul>
                                        <li>增加状态监控页面和文件自动清理机制。</li>
                                        <li>提供全套 Docker 部署支持和文档。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.0.5 (2025-02-26 ~ 28)</strong>
                                    <ul>
                                        <li>添加班级上课模式。</li>
                                        <li>题库管理强化：支持 AI 自动解析、知识点标签。</li>
                                        <li>新增 AI RAG 备课和知识库问答辅助功能。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.0.1 (2025-02-20 ~ 25)</strong>
                                    <ul>
                                        <li>实现基于 IP 地址的座位自动绑定。</li>
                                        <li>优化作业历史显示，增加 Python 语法高亮和代码下载。</li>
                                    </ul>
                                </Timeline.Item>

                                <Timeline.Item color="blue">
                                    <strong>v1.0.0 (2025-02-11 ~ 19)</strong>
                                    <ul>
                                        <li>初始项目框架提交。</li>
                                        <li>建立基础的课程、单元管理功能及 AI 助手面板组件。</li>
                                    </ul>
                                </Timeline.Item>
                            </Timeline>
                        </div>
                    </TabPane>
                </Tabs>
            </div>
        </div >
    );
};

export default UserManual;
