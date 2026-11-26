/**
 * 班级显示名：行政班为“2024级3班”，教学班（社团、选修）为其名称。
 * cls 可以是班级文档、lean 对象，或只含 grade/name/type/title 的对象。
 */
function formatClassName(cls, { fallback = '未知班级' } = {}) {
  if (!cls || typeof cls !== 'object') return fallback;
  if (cls.type === 'elective') return cls.title || '未命名教学班';
  if (cls.grade == null && cls.name == null) return fallback;
  return `${cls.grade}级${cls.name}班`;
}

module.exports = { formatClassName };
