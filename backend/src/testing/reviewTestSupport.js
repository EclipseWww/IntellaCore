const fs = require('node:fs');
const vm = require('node:vm');
// 与下方静音 console 一致：未单独提供时给日志模块一个静音替身
const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };
// 班级名单服务的简单替身：只有行政班、没有教学班（需要时测试可单独提供）
const rosterStub = {
  isElective: cls => !!cls && cls.type === 'elective',
  sameId: (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b),
  contextClassId: user => (user ? (user.sessionClassId || user.classId || null) : null),
  rosterFilter: async ids => ({ classId: { $in: [].concat(ids) } }),
  rosterStudentIds: async () => [],
  rosterIdSet: async () => new Set(),
  findRoster: async () => [],
  classIdsOfStudent: async student => (student && student.classId ? [student.classId] : []),
  classMapOf: async () => new Map(),
  removeStudentsEverywhere: async () => 0
};
function load(file, mocks) {
  mocks = { '../utils/logger': silentLogger, '../services/classRoster': rosterStub, './classRoster': rosterStub, ...mocks };
  const context = { __dirname: require('node:path').dirname(file), module: { exports: {} }, exports: {}, require: name => {
    if (!(name in mocks)) throw new Error('Unexpected dependency: ' + name);
    return mocks[name];
  }, console: { log() {}, warn() {}, error() {} }, Date, Map, Set, Object, Math, Promise, setInterval };
  context.exports = context.module.exports;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context.module.exports;
}
function get(doc, key) { return key.split('.').reduce((value, part) => value?.[part], doc); }
function evaluate(value, doc) {
  if (typeof value === 'string' && value.startsWith('$')) return get(doc, value.slice(1));
  if (Array.isArray(value)) return value.map(item => evaluate(item, doc));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if ('$literal' in value) return value.$literal;
  if (value._bsontype || Object.keys(value).length === 0) return value;
  const operator = Object.keys(value)[0];
  if (!operator.startsWith('$')) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, evaluate(item, doc)]));
  const args = evaluate(value[operator], doc);
  switch (operator) {
    case '$eq': return args[0] === args[1];
    case '$ne': return args[0] !== args[1];
    case '$gt': return args[0] > args[1];
    case '$gte': return args[0] >= args[1];
    case '$lte': return args[0] <= args[1];
    case '$and': return args.every(Boolean);
    case '$or': return args.some(Boolean);
    case '$ifNull': return args[0] ?? args[1];
    case '$cond': return args[0] ? args[1] : args[2];
    case '$concatArrays': return args.flat();
    case '$subtract': return args[0] - args[1];
    case '$add': return args[0] + args[1];
    case '$multiply': return args[0] * args[1];
    case '$max': return Math.max(...args);
    case '$min': return Math.min(...args);
    case '$round': return Math.round(args[0] * 100) / 100;
    case '$slice': return args[0].slice(0, args[1]);
    case '$setUnion': return [...new Set(args.flat())];
    default: throw new Error('Unhandled operator ' + operator);
  }
}
function apply(doc, pipeline) {
  const updates = evaluate(pipeline[0].$set, doc);
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split('.'); let target = doc;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    target[parts.at(-1)] = value;
  }
}
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
module.exports = { rosterStub, load, apply, logger, response };
