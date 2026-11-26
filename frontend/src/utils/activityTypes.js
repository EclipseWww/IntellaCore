// 课时活动类型的统一配置：新增活动类型时只需在这里加一项
// - shortLabel：活动列表、活动详情标题中的标签文字
// - label：活动类型下拉框、学生端课时页中的完整名称
// - color：Ant Design Tag 颜色
// - summary / description：下拉框中的简介与悬停说明
// - common：在下拉框中排在前面的常用类型
export const ACTIVITY_TYPES = [
  {
    value: 'reading', shortLabel: '阅读', label: '阅读', color: 'blue', common: true,
    summary: '文本阅读材料',
    description: '学生阅读教师提供的文本内容，支持Markdown格式，可嵌入图片、视频等多媒体资源。适合理论知识学习和预习材料。'
  },
  {
    value: 'typing', shortLabel: '打字', label: '打字练习', color: 'cyan', common: true,
    summary: '打字速度训练',
    description: '学生进行打字速度和准确率训练，可设置目标速度、准确率和时间限制。系统自动统计打字成绩，适合信息技术课程的打字基础训练。'
  },
  {
    value: 'practice', shortLabel: '练习', label: '练习', color: 'purple', common: true,
    summary: '实践练习任务',
    description: '学生根据要求完成实践任务并提交作业文件（如Word、PPT、Excel等）。教师可设置允许的文件格式，适合需要学生动手操作的作业。'
  },
  {
    value: 'python', shortLabel: 'Python', label: 'Python编程', color: 'gold', common: true,
    summary: 'Python代码编写',
    description: '学生在在线编程环境中编写Python代码，支持代码运行和测试用例验证。教师可设置初始代码模板和测试用例，系统自动评分。'
  },
  {
    value: 'quiz', shortLabel: '测验', label: '测验', color: 'green',
    summary: '选择题测验',
    description: '在线选择题测验，支持单选题和多选题。可设置时间限制、随机题目顺序、是否显示答案等。系统自动批改计分。'
  },
  {
    value: 'fillblank', shortLabel: '填空', label: '填空', color: 'geekblue',
    summary: '填空问答',
    description: '学生根据题目要求填写答案，支持多个填空位置和标准答案设置。系统可自动批改，也可教师手动评分。'
  },
  {
    value: 'flowchart', shortLabel: '流程图', label: '流程图', color: 'magenta',
    summary: '逻辑流程设计',
    description: '学生使用在线流程图工具绘制逻辑流程图，适合算法设计、程序流程分析等。教师可设置参考答案进行对比评分。'
  },
  {
    value: 'spreadsheet', shortLabel: '表格', label: '在线表格', color: 'lime',
    summary: 'Excel表格编辑',
    description: '学生使用在线表格编辑器完成Excel相关任务，支持公式、格式设置等功能。适合电子表格操作练习和数据处理。'
  },
  {
    value: 'html', shortLabel: 'HTML', label: 'HTML网页', color: 'volcano',
    summary: '网页代码编写',
    description: '学生在在线代码编辑器中编写HTML/CSS/JavaScript代码，实时预览网页效果。适合Web前端开发入门和网页设计学习。'
  },
  {
    value: 'discussion', shortLabel: '讨论', label: '讨论', color: 'orange',
    summary: '互动讨论话题',
    description: '创建讨论话题，学生可以发表观点和互相回复。适合课堂互动、思考题讨论和课后交流。'
  }
];

// 旧课时中可能存在、但已不能新建的类型
const LEGACY_TYPES = { video: { shortLabel: '视频', label: '视频', color: 'default' } };

const TYPE_MAP = Object.fromEntries(ACTIVITY_TYPES.map(type => [type.value, type]));

const lookup = (type) => TYPE_MAP[type] || LEGACY_TYPES[type];

/** 标签颜色，未知类型返回 default */
export const getActivityTypeColor = (type) => (TYPE_MAP[type] ? TYPE_MAP[type].color : 'default');

/** 简短名称（活动列表标签），未知类型返回 fallback */
export const getActivityTypeShortLabel = (type, fallback = '活动') => (TYPE_MAP[type] ? TYPE_MAP[type].shortLabel : fallback);

/** 完整名称（下拉框、学生端），包括旧的“视频”类型 */
export const getActivityTypeLabel = (type, fallback = '活动') => lookup(type)?.label || fallback;
