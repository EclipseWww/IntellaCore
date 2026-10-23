const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const CourseUnit = require('../models/CourseUnit');
const Course = require('../models/Course');
const LessonController = require('./lessonController');
const Lesson = require('../models/Lesson');
const root = path.resolve(__dirname, '../../temp/lesson-transfers');
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_SIZE = 2 * 1024 * 1024 * 1024;

async function authorize(req, res, next) {
  try {
    const unit = await CourseUnit.findById(req.params.unitId);
    const course = unit && await Course.findById(unit.course);
    if (!course) return res.status(404).json({ message: '课程单元不存在' });
    if (req.user.role !== 'admin' && String(course.instructor) !== String(req.user._id)) return res.status(403).json({ message: '没有导入权限' });
    if (!/^[a-f0-9-]{36}$/.test(req.params.transferId)) return res.status(400).json({ message: '无效的上传标识' });
    req.transferDir = path.join(root, String(req.user._id), req.params.unitId, req.params.transferId);
    await fs.mkdir(req.transferDir, { recursive: true });
    next();
  } catch (error) { next(error); }
}
async function status(req, res, next) {
  try {
    try { return res.json({ completed: JSON.parse(await fs.readFile(path.join(req.transferDir, 'result.json'), 'utf8')) }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const files = await fs.readdir(req.transferDir);
    res.json({ chunks: files.filter(name => /^\d+\.part$/.test(name)).map(name => Number(name.split('.')[0])) });
  } catch (error) { next(error); }
}
async function chunk(req, res, next) {
  try {
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_SIZE / CHUNK_SIZE || !Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: '无效的分片' });
    const temporary = path.join(req.transferDir, `${index}.${crypto.randomUUID()}.tmp`);
    await fs.writeFile(temporary, req.body);
    await fs.rename(temporary, path.join(req.transferDir, `${index}.part`));
    res.json({ success: true });
  } catch (error) { next(error); }
}
async function complete(req, res, next) {
  let lock;
  let zipPath;
  try {
    try { return res.json(JSON.parse(await fs.readFile(path.join(req.transferDir, 'result.json'), 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const { size, count } = req.body;
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_SIZE || count !== Math.ceil(size / CHUNK_SIZE)) return res.status(400).json({ message: '资源包最大支持 2 GB' });
    try { lock = await fs.open(path.join(req.transferDir, 'assembling'), 'wx'); }
    catch (error) { if (error.code === 'EEXIST') return res.status(409).json({ message: '正在处理该上传，请稍候' }); throw error; }
    zipPath = path.join(req.transferDir, `${crypto.randomUUID()}.zip`);
    const output = await fs.open(zipPath, 'wx');
    try {
      for (let index = 0; index < count; index++) {
        const buffer = await fs.readFile(path.join(req.transferDir, `${index}.part`));
        if (buffer.length !== Math.min(CHUNK_SIZE, size - index * CHUNK_SIZE)) throw new Error('分片不完整，请重新上传');
        await output.writeFile(buffer);
      }
    } finally { await output.close(); }
    req.file = { path: zipPath };
    const sendJson = res.json.bind(res);
    let result;
    res.json = body => { result = body; return res; };
    try { await LessonController.importLesson(req, res); }
    finally { res.json = sendJson; }
    if (res.statusCode < 400 && result) await fs.writeFile(path.join(req.transferDir, 'result.json'), JSON.stringify(result));
    if (result) sendJson(result);
    // Failed imports keep chunks so reselecting the same file can retry.
    if (res.statusCode < 400) {
      for (let index = 0; index < count; index++) await fs.unlink(path.join(req.transferDir, `${index}.part`)).catch(() => {});
    }
  } catch (error) { next(error); }
  finally {
    if (zipPath) await fs.unlink(zipPath).catch(() => {});
    if (lock) { await lock.close(); await fs.unlink(path.join(req.transferDir, 'assembling')).catch(() => {}); }
  }
}
async function mediaStatus(req, res, next) {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    const unit = lesson && await CourseUnit.findById(lesson.unit);
    const course = unit && await Course.findById(unit.course);
    if (!course) return res.status(404).json({ message: '课时不存在' });
    if (req.user.role !== 'admin' && String(course.instructor) !== String(req.user._id)) return res.status(403).json({ message: '没有访问权限' });
    const missing = [];
    for (const asset of lesson.migrationMedia || []) {
      if (!/^[a-f0-9]{64}\.[a-z0-9]{1,10}$/.test(asset.name)) continue;
      try { await fs.access(path.resolve(__dirname, '../../uploads/public/media/portable', asset.name)); }
      catch { missing.push({ name: asset.name, size: asset.size }); }
    }
    res.json({ missing });
  } catch (error) { next(error); }
}
module.exports = { authorize, status, chunk, complete, mediaStatus };
