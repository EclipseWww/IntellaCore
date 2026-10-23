const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const media = require('./portableMedia');

test('cross-lesson absolute and relative references survive content-first migration and deduplicate', async () => {
  const id = crypto.randomUUID();
  const sourceUrl = `/public/media/test-${id}/other-lesson/video.mp4`;
  const source = media.localPath(sourceUrl);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portable-media-'));
  let target;
  try {
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, crypto.randomBytes(128));
    const data = { lesson: { activities: [{ description: `[视频](https://old.example${sourceUrl}#t=12)`, nested: { answer: `<video src="${sourceUrl}?v=1"></video>` } }] }, questions: [{ content: `![图](${sourceUrl})` }] };
    const manifest = await media.collect(data, directory, false);
    assert.equal(manifest.assets.length, 2);
    target = media.localPath(`/public/media/portable/${manifest.assets[0].name}`);
    let restored = await media.restore(manifest, directory);
    assert.equal(restored.missing.length, 1);
    const rewritten = restored.rewrite(data);
    assert.match(rewritten.lesson.activities[0].description, /\/public\/media\/portable\/[a-f0-9]{64}\.mp4#t=12/);
    assert.ok(!JSON.stringify(rewritten).includes('old.example'));
    assert.match(rewritten.lesson.activities[0].nested.answer, /\.mp4\?v=1/);
    await media.collect(data, directory, true);
    restored = await media.restore(manifest, directory);
    assert.equal(restored.missing.length, 0);
    assert.equal(await media.hash(target), manifest.assets[0].sha256);
    // Media-first migration reuses the already imported resource even without assets in the content package.
    const empty = await fs.mkdtemp(path.join(directory, 'empty-'));
    assert.equal((await media.restore(manifest, empty)).missing.length, 0);
  } finally {
    await fs.unlink(source).catch(() => {});
    await fs.rmdir(path.dirname(source)).catch(() => {});
    await fs.rmdir(path.dirname(path.dirname(source))).catch(() => {});
    if (target) await fs.unlink(target).catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('rejects traversal, corrupt media and invalid manifests', async () => {
  assert.throws(() => media.localPath('/public/media/%2e%2e/secret.mp4'), /非法/);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portable-corrupt-'));
  try {
    const sha256 = 'a'.repeat(64);
    const name = `${sha256}.mp4`;
    await fs.mkdir(path.join(directory, 'assets'));
    await fs.writeFile(path.join(directory, 'assets', name), 'corrupted');
    await assert.rejects(media.restore({ version: 1, assets: [{ name, sha256, source: '/public/media/test.mp4' }] }, directory), /校验失败/);
    await assert.rejects(media.restore({ version: 1, assets: [{ name: '../x.mp4' }] }, directory), /非法/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('old lesson package rewrites nested question and activity references', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'portable-legacy-'));
  let target;
  try {
    const url = '/public/media/old-course/old-unit/old-lesson/video.mp4';
    const data = { lesson: { _id: 'old-lesson', unit: { _id: 'old-unit', course: { _id: 'old-course' } }, activities: [{ description: `[视频](${url})` }] } };
    await fs.mkdir(path.join(directory, 'media/lesson'), { recursive: true });
    await fs.writeFile(path.join(directory, 'media/lesson/video.mp4'), crypto.randomBytes(64));
    const manifest = await media.legacyManifest(data, directory);
    target = media.localPath(`/public/media/portable/${manifest.assets[0].name}`);
    const restored = await media.restore(manifest, directory);
    assert.equal(restored.missing.length, 0);
    assert.match(restored.rewrite(data).lesson.activities[0].description, /\/portable\//);
  } finally {
    if (target) await fs.unlink(target).catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  }
});
