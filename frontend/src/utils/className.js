// 班级显示名：行政班为“2024级3班”，教学班（社团课、选修课）为其名称
export const isElective = (cls) => !!cls && cls.type === 'elective';

export const formatClassName = (cls, fallback = '未知班级') => {
  if (!cls || typeof cls !== 'object') return fallback;
  if (cls.type === 'elective') return cls.title || cls.displayName || '未命名教学班';
  if (cls.displayName) return cls.displayName;
  if (cls.grade == null && cls.name == null) return fallback;
  return `${cls.grade}级${cls.name}班`;
};

// 班级类型的中文名
export const classTypeLabel = (cls) => (isElective(cls) ? '社团/选修' : '行政班');

// 下拉框分组用的键与标题：行政班按年级，社团/选修单独一组
export const classGroupKey = (cls) => (isElective(cls) ? 'elective' : String(cls.grade));
export const classGroupLabel = (key) => (key === 'elective' ? '社团 / 选修' : `${key}级`);

// 分组排序：年级从新到旧，社团/选修在最后
export const compareClassGroupKeys = (a, b) =>
  (a === 'elective') - (b === 'elective') || Number(b) - Number(a);

// 班级排序：行政班按年级从新到旧、班号从小到大；社团/选修在后面，按名称
export const compareClasses = (a, b) => {
  const ea = isElective(a), eb = isElective(b);
  if (ea !== eb) return ea ? 1 : -1;
  if (ea) return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
  return (Number(b.grade) - Number(a.grade)) || (Number(a.name) - Number(b.name));
};

// 登录页的班级分组：正在上课的在最前；其余行政班按年级（新到旧），社团/选修放在最后
export const groupLoginClasses = (list, isLive = () => false) => {
  const groups = [];
  const live = list.filter(isLive).sort(compareClasses);
  if (live.length) groups.push({ key: 'live', label: '正在上课', items: live });
  const byKey = list.filter(c => !isLive(c)).sort(compareClasses).reduce((acc, cls) => {
    const key = classGroupKey(cls);
    (acc[key] = acc[key] || []).push(cls);
    return acc;
  }, {});
  Object.keys(byKey).sort(compareClassGroupKeys)
    .forEach(key => groups.push({ key: `g${key}`, label: classGroupLabel(key), items: byKey[key] }));
  return groups;
};

// 解析教学班新建学生名单：每行“学号 姓名”（学生上课时免密码登录，多出的列忽略）
export const parseNewStudents = (text) => String(text || '')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const [username = '', name = ''] = line.split(/[\s,，;；]+/);
    return { username, name };
  });
