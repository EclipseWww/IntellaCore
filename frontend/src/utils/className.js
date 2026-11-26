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
