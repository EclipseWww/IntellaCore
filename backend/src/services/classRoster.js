/**
 * 班级名单与“学生当前所在班级”的统一入口。
 *
 * - 行政班：学生账号的 User.classId 指向它（一个学生只有一个行政班）。
 * - 教学班（社团课、选修课）：成员记在 ClassMembership 中，学生可以参加多个。
 * - 学生登录时选择的班级记在 User.sessionClassId，本次登录期间的上课状态、课时跳转、
 *   AI 与游戏开关、自由练习设置等都按这个班级；为空表示行政班。
 */
const mongoose = require('mongoose');
const Class = require('../models/Class');
const User = require('../models/User');
const ClassMembership = require('../models/ClassMembership');
const logger = require('../utils/logger');

const HANDOFF_FALLBACK_MS = 45 * 60 * 1000;

const toId = v => (v && typeof v === 'object' && v._id ? v._id : v);
const sameId = (a, b) => a != null && b != null && String(toId(a)) === String(toId(b));
const isElective = cls => !!cls && cls.type === 'elective';

function normalizeIds(classIds) {
  const list = Array.isArray(classIds) ? classIds : [classIds];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const id = toId(raw);
    if (id == null || !mongoose.isValidObjectId(id)) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(new mongoose.Types.ObjectId(key));
  }
  return out;
}

/** 把班级 ID 分成行政班和教学班两组（不存在的 ID 归入行政班，查询时自然为空） */
async function splitClassIds(classIds) {
  const ids = normalizeIds(classIds);
  if (!ids.length) return { adminIds: [], electiveIds: [] };
  const electives = await Class.find({ _id: { $in: ids }, type: 'elective' }).select('_id').lean();
  const electiveSet = new Set(electives.map(c => String(c._id)));
  return {
    adminIds: ids.filter(id => !electiveSet.has(String(id))),
    electiveIds: ids.filter(id => electiveSet.has(String(id)))
  };
}

/** 教学班成员的学生 ID */
async function memberIdsOf(electiveIds) {
  if (!electiveIds.length) return [];
  return ClassMembership.find({ class: { $in: electiveIds } }).distinct('student');
}

/**
 * 查询这些班级学生用的 User 过滤条件（不含 role，调用方自行加上）。
 * 只有行政班时与原来的 { classId } 写法等价。
 */
async function rosterFilter(classIds) {
  const { adminIds, electiveIds } = await splitClassIds(classIds);
  const conditions = [];
  if (adminIds.length) conditions.push({ classId: adminIds.length === 1 ? adminIds[0] : { $in: adminIds } });
  if (electiveIds.length) conditions.push({ _id: { $in: await memberIdsOf(electiveIds) } });
  if (!conditions.length) return { _id: { $in: [] } };
  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

/** 这些班级的全部学生 ID */
async function rosterStudentIds(classIds) {
  const filter = await rosterFilter(classIds);
  return User.find({ ...filter, role: 'student' }).distinct('_id');
}

/** 这些班级学生 ID 的字符串集合，便于在内存中筛选已查出的记录 */
async function rosterIdSet(classIds) {
  return new Set((await rosterStudentIds(classIds)).map(String));
}

/**
 * 班级学生名单。教学班的座位号取成员记录中的座位（与行政班座位分开）。
 * select 为 User 字段；返回 lean 对象。
 */
async function findRoster(classOrId, { select = 'name username seatNumber', sort = null, extra = {} } = {}) {
  const cls = classOrId && classOrId.type ? classOrId : await Class.findById(toId(classOrId)).select('type').lean();
  if (!cls) return [];
  const id = toId(classOrId);
  if (!isElective(cls)) {
    let q = User.find({ classId: id, role: 'student', ...extra }).select(select);
    if (sort) q = q.sort(sort);
    return q.lean();
  }
  const memberships = await ClassMembership.find({ class: id }).select('student seatNumber').lean();
  const seatOf = new Map(memberships.map(m => [String(m.student), m.seatNumber || null]));
  let q = User.find({ _id: { $in: memberships.map(m => m.student) }, role: 'student', ...extra }).select(select);
  if (sort) q = q.sort(sort);
  const students = await q.lean();
  const wantsSeat = !select || String(select).split(/\s+/).includes('seatNumber');
  return students.map(s => (wantsSeat ? { ...s, seatNumber: seatOf.get(String(s._id)) || undefined } : s));
}

/** 学生所属的全部班级（行政班 + 参加的教学班） */
async function classIdsOfStudent(studentOrId) {
  let student = studentOrId;
  if (!student || !student.classId) {
    student = await User.findById(toId(studentOrId)).select('classId').lean();
  }
  const ids = [];
  if (student && student.classId) ids.push(toId(student.classId));
  const electiveIds = await ClassMembership.find({ student: toId(studentOrId) }).distinct('class');
  return normalizeIds([...ids, ...electiveIds]);
}

/** 学生本次登录所属的班级 ID（没有记录时为行政班） */
function contextClassId(user) {
  if (!user) return null;
  return toId(user.sessionClassId) || toId(user.classId) || null;
}

/** 读取学生本次登录所属的班级文档 */
async function contextClass(userOrId, select) {
  let user = userOrId;
  if (!user || user.sessionClassId === undefined || user.classId === undefined) {
    user = await User.findById(toId(userOrId)).select('classId sessionClassId').lean();
  }
  const id = contextClassId(user);
  if (!id) return null;
  let q = Class.findById(id);
  if (select) q = q.select(select);
  return q.lean();
}

/** 学生是否属于该班级（行政班看 User.classId，教学班看成员记录） */
async function isStudentInClass(studentOrId, classObj) {
  if (!classObj) return false;
  if (!isElective(classObj)) {
    const student = studentOrId && studentOrId.classId !== undefined
      ? studentOrId
      : await User.findById(toId(studentOrId)).select('classId').lean();
    return !!student && sameId(student.classId, classObj._id);
  }
  return !!await ClassMembership.exists({ class: classObj._id, student: toId(studentOrId) });
}

/** 学生在某班级绑定的登录 IP：行政班取最近一次在行政班登录的 IP，教学班取成员记录中的 IP */
function boundIpFor(user, classObj, membership) {
  if (isElective(classObj)) return (membership && membership.boundIp) || null;
  const rec = (user.loginHistory || []).find(r => !r.classId || sameId(r.classId, user.classId));
  return rec ? rec.ip : null;
}

/** 教师同意 IP 变更后，更新学生在该班级绑定的 IP */
async function setBoundIp(studentId, classId, ip) {
  const cls = await Class.findById(classId).select('type').lean();
  if (isElective(cls)) {
    await ClassMembership.updateOne({ class: classId, student: studentId }, { $set: { boundIp: ip } });
    return;
  }
  const user = await User.findById(studentId).select('classId loginHistory').lean();
  if (!user) return;
  const index = (user.loginHistory || []).findIndex(r => !r.classId || sameId(r.classId, user.classId));
  if (index >= 0) await User.updateOne({ _id: studentId }, { $set: { [`loginHistory.${index}.ip`]: ip } });
}

/**
 * 班级开始上课时：把名单里“正从别的班级登录着”的学生踢下线，让他们重新登录到这个班。
 * - 教学班开始上课：不论原来的班级是否已下课都踢掉。
 * - 行政班开始上课：只踢掉原来班级已经下课的学生，不打断同一时间仍在进行的教学班。
 * 被踢的学生在原来那台电脑上登录这个班时不需要审批（一次性放行，到这节课下课为止）。
 */
async function signOutFromOtherClasses(classId, { now = new Date() } = {}) {
  const cls = await Class.findById(classId).select('type scheduledEndTime').lean();
  if (!cls) return 0;
  const studentIds = await rosterStudentIds([classId]);
  if (!studentIds.length) return 0;
  const online = await User.find({
    _id: { $in: studentIds },
    role: 'student',
    sessionId: { $nin: [null, ''] },
    sessionExpiresAt: { $gt: now }
  }).select('classId sessionClassId sessionId loginHistory').lean();
  const sessionClass = u => String(contextClassId(u));
  let targets = online.filter(u => sessionClass(u) !== String(classId));
  if (!targets.length) return 0;

  if (!isElective(cls)) {
    const live = new Set((await Class.find({
      _id: { $in: [...new Set(targets.map(sessionClass))] },
      isInClass: true
    }).select('_id').lean()).map(c => String(c._id)));
    targets = targets.filter(u => !live.has(sessionClass(u)));
    if (!targets.length) return 0;
  }

  const end = cls.scheduledEndTime && new Date(cls.scheduledEndTime) > now
    ? new Date(cls.scheduledEndTime)
    : new Date(now.getTime() + HANDOFF_FALLBACK_MS);
  const result = await User.bulkWrite(targets.map(u => ({
    updateOne: {
      // 带上原会话 ID：学生恰好在这一刻重新登录到本班时不会被误踢
      filter: { _id: u._id, sessionId: u.sessionId },
      update: {
        $unset: { sessionId: 1, sessionExpiresAt: 1 },
        $set: { loginHandoff: { classId: cls._id, ip: (u.loginHistory && u.loginHistory[0] && u.loginHistory[0].ip) || null, expiresAt: end } }
      }
    }
  })), { ordered: false });
  const count = result.modifiedCount || 0;
  if (count) logger.info('班级开始上课，已让从其他班级登录的学生重新登录', { classId: String(classId), count });
  return count;
}

/** 一次性放行是否适用于这次登录 */
function handoffApplies(user, classId, ip, now = new Date()) {
  const h = user && user.loginHandoff;
  return !!h && sameId(h.classId, classId) && !!h.ip && h.ip === ip && h.expiresAt && new Date(h.expiresAt) > now;
}

/** 班级 ID → 班级（含 displayName），用于给学生标注所在行政班 */
async function classMapOf(classIds) {
  const ids = normalizeIds(classIds);
  if (!ids.length) return new Map();
  const { formatClassName } = require('../utils/className');
  const classes = await Class.find({ _id: { $in: ids } }).select('grade name type title status').lean();
  return new Map(classes.map(c => [String(c._id), { ...c, displayName: formatClassName(c) }]));
}

/** 删除学生账号时清理其教学班成员记录 */
async function removeStudentsEverywhere(studentIds) {
  const ids = normalizeIds(studentIds);
  if (!ids.length) return 0;
  const r = await ClassMembership.deleteMany({ student: { $in: ids } });
  return r.deletedCount || 0;
}

module.exports = {
  isElective,
  sameId,
  splitClassIds,
  rosterFilter,
  rosterStudentIds,
  rosterIdSet,
  findRoster,
  classIdsOfStudent,
  contextClassId,
  contextClass,
  isStudentInClass,
  boundIpFor,
  setBoundIp,
  signOutFromOtherClasses,
  handoffApplies,
  removeStudentsEverywhere,
  classMapOf
};
