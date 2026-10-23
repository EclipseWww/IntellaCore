const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const controller = require('./lessonController');
const transfer = require('./lessonTransferController');
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
}
const fail = error => { throw error; };

test('320 MB package uploads in chunks, resumes, and completion is idempotent', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lesson-transfer-'));
  const original = controller.importLesson;
  let imported = 0;
  try {
    const size = 8 * 1024 * 1024;
    const count = 40;
    const buffer = Buffer.alloc(size, 7);
    // Simulate interruption and a status request after the first chunk.
    for (let index = 0; index < count; index++) {
      await transfer.chunk({ transferDir: directory, params: { index: String(index) }, body: buffer }, response(), fail);
      if (index === 0) {
        const status = response();
        await transfer.status({ transferDir: directory }, status, fail);
        assert.deepEqual(status.data.chunks, [0]);
      }
    }
    controller.importLesson = async (req, res) => {
      imported++;
      assert.equal((await fs.stat(req.file.path)).size, size * count);
      const file = await fs.open(req.file.path, 'r');
      try {
        const tail = Buffer.alloc(1);
        await file.read(tail, 0, 1, size * count - 1);
        assert.equal(tail[0], 7);
      } finally { await file.close(); }
      res.json({ success: true, lessonId: 'new-lesson' });
    };
    const req = { transferDir: directory, body: { size: size * count, count } };
    const res = response();
    await transfer.complete(req, res, fail);
    assert.equal(res.data.lessonId, 'new-lesson');
    assert.equal((await fs.readdir(directory)).filter(name => name.endsWith('.part')).length, 0);
    await transfer.complete(req, response(), fail);
    assert.equal(imported, 1);
    const status = response();
    await transfer.status({ transferDir: directory }, status, fail);
    assert.equal(status.data.completed.lessonId, 'new-lesson');
  } finally {
    controller.importLesson = original;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('invalid chunks and oversized completion are rejected', async () => {
  const res = response();
  await transfer.chunk({ params: { index: '-1' }, body: Buffer.from('x') }, res, fail);
  assert.equal(res.statusCode, 400);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lesson-transfer-invalid-'));
  try {
    const oversized = response();
    await transfer.complete({ transferDir: directory, body: { size: 3 * 1024 ** 3, count: 384 } }, oversized, fail);
    assert.equal(oversized.statusCode, 400);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('export modes create valid full/content/media ZIPs with cross-lesson dependencies', async () => {
  const models = ['Lesson', 'Quiz', 'Question', 'TypingText'].map(name => require(`../models/${name}`));
  const originals = models.map(model => ({ find: model.find, findById: model.findById }));
  const media = require('../services/portableMedia');
  const id = require('crypto').randomUUID();
  const sourceUrl = `/public/media/export-test-${id}/other-lesson.mp4`;
  const source = media.localPath(sourceUrl);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lesson-export-test-'));
  try {
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, 'test video');
    const data = { _id: 'source-lesson', title: 'test', unit: { _id: 'unit', course: { _id: 'course', instructor: 'owner' } }, activities: [{ description: `[视频](https://old.example${sourceUrl})` }] };
    models[0].findById = () => ({ populate: async () => ({ ...data, toObject: () => data }) });
    for (const model of models.slice(1)) model.find = async () => [];
    for (const mode of ['full', 'content', 'media']) {
      let downloaded;
      const res = response();
      res.download = (file, filename, done) => {
        downloaded = (async () => {
          const extracted = path.join(directory, mode);
          await require('extract-zip')(file, { dir: extracted });
          const manifest = JSON.parse(await fs.readFile(path.join(extracted, 'media_manifest.json')));
          assert.equal(manifest.mediaOnly, mode === 'media');
          assert.equal(manifest.assets.length, 1);
          const exists = filePath => fs.access(filePath).then(() => true, () => false);
          assert.equal(await exists(path.join(extracted, 'lesson_data.json')), mode !== 'media');
          assert.equal(await exists(path.join(extracted, 'assets', manifest.assets[0].name)), mode !== 'content');
          assert.ok(filename.endsWith(`_${mode}.zip`));
        })().finally(() => done());
      };
      await controller.exportLesson({ params: { lessonId: 'source-lesson' }, query: { mode }, user: { _id: 'owner', role: 'teacher' } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.data));
      assert.ok(downloaded);
      await downloaded;
    }
  } finally {
    models.forEach((model, index) => Object.assign(model, originals[index]));
    await fs.unlink(source).catch(() => {});
    await fs.rmdir(path.dirname(source)).catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
});
