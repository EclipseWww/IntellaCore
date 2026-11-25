const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const ExcelJS = require('exceljs');
const TypingRecord = require('../models/TypingRecord');
const Class = require('../models/Class');
const User = require('../models/User');
const typingController = require('./typingController');

const chain = value => { const q = { populate: () => q, sort: () => q, select: () => q, skip: () => q, limit: () => q, lean: () => q, then: (ok, bad) => Promise.resolve(value).then(ok, bad) }; return q; };

test('teacher export produces an xlsx with the same records as the list', async () => {
  const saved = { rf: TypingRecord.find, cf: Class.find, uf: User.find };
  const created = new Date('2026-11-20T02:30:00Z');
  TypingRecord.find = () => chain([
    { _id: 'r1', userId: { _id: 'u1', name: '张三' }, textId: { content: '春眠不觉晓' }, speed: 42, accuracy: 96, isPassed: true, createdAt: created },
    { _id: 'r2', userId: { _id: 'u2', name: '李四' }, textId: { content: 'x'.repeat(80) }, speed: 20, accuracy: 70, isPassed: false, createdAt: created }
  ]);
  Class.find = () => chain([]);
  User.find = () => chain([{ _id: 'u1', classId: { grade: 7, name: '3' } }, { _id: 'u2', classId: null }]);
  const out = new PassThrough(); const chunks = []; out.on('data', c => chunks.push(c));
  const headers = {};
  Object.assign(out, { headersSent: false, setHeader: (k, v) => { headers[k] = v; }, status() { return this; }, json() { throw new Error('unexpected json'); } });
  try {
    await typingController.exportTeacherRecords({ query: { page: '2', pageSize: '10' }, user: { _id: 't1', role: 'teacher' } }, out);
  } finally { Object.assign(TypingRecord, { find: saved.rf }); Class.find = saved.cf; User.find = saved.uf; }
  assert.match(headers['Content-Type'], /spreadsheetml/);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.concat(chunks));
  const rows = wb.getWorksheet('打字成绩').getSheetValues().slice(1).map(r => r.slice(1));
  assert.deepEqual(rows[0], ['班级', '学生', '练习文本', '速度(字/分)', '准确率(%)', '达标状态', '练习时间']);
  assert.deepEqual(rows[1].slice(0, 6), ['7年级3班', '张三', '春眠不觉晓', 42, 96, '达标']);
  assert.match(rows[1][6], /2026\/11\/20 10:30/);
  assert.equal(rows[2][0], ''); assert.equal(rows[2][5], '未达标'); assert.equal(rows[2][2].length, 51);
  assert.equal(rows.length, 3); // 导出全部记录，不受分页参数影响
});
