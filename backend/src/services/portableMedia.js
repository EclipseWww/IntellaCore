const fs = require('fs').promises;
const { createReadStream } = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../../uploads/public/media');
const pattern = /(?:https?:\/\/[^\s<>"'()]+)?\/public\/media\/[^\s<>"'()?#]+/g;

function transform(value, rewrite) {
  if (typeof value === 'string') return value.replace(pattern, rewrite);
  if (Array.isArray(value)) return value.map(item => transform(item, rewrite));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, transform(item, rewrite)]));
  return value;
}
function localPath(url) {
  const raw = url.slice(url.indexOf('/public/media/') + 14);
  const resolved = path.resolve(root, decodeURIComponent(raw));
  if (!resolved.startsWith(root + path.sep)) throw new Error('非法媒体路径');
  return resolved;
}
async function hash(file) {
  const digest = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
async function collect(data, directory, includeFiles) {
  const urls = new Set();
  transform(data, url => { urls.add(url); return url; });
  const assets = [];
  for (const url of urls) {
    const file = localPath(url);
    let stat;
    try { stat = await fs.stat(file); } catch { throw new Error(`引用的媒体不存在：${url}`); }
    if (!stat.isFile()) throw new Error(`媒体不是文件：${url}`);
    const sha256 = await hash(file);
    const extension = path.extname(file).toLowerCase();
    if (!/^\.[a-z0-9]{1,10}$/.test(extension)) throw new Error('不支持的媒体扩展名');
    const name = `${sha256}${extension}`;
    assets.push({ source: url, name, sha256, size: stat.size });
    if (includeFiles) {
      await fs.mkdir(path.join(directory, 'assets'), { recursive: true });
      await fs.copyFile(file, path.join(directory, 'assets', name));
    }
  }
  return { version: 1, assets };
}
async function restore(manifest, directory) {
  if (manifest.version !== 1 || !Array.isArray(manifest.assets)) throw new Error('媒体清单格式不正确');
  const missing = [];
  const mapping = new Map();
  await fs.mkdir(path.join(root, 'portable'), { recursive: true });
  for (const asset of manifest.assets) {
    if (!/^[a-f0-9]{64}\.[a-z0-9]{1,10}$/.test(asset.name) || asset.name.split('.')[0] !== asset.sha256) throw new Error('非法媒体清单');
    const dest = path.join(root, 'portable', asset.name);
    const source = path.join(directory, 'assets', asset.name);
    let available = false;
    try { available = await hash(dest) === asset.sha256; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!available) {
      try {
        if (await hash(source) !== asset.sha256) throw new Error(`媒体校验失败：${asset.name}`);
        // Publish only a fully copied file, so concurrent imports never expose partial video data.
        const temporary = `${dest}.${crypto.randomUUID()}.tmp`;
        try { await fs.copyFile(source, temporary); await fs.rename(temporary, dest); }
        finally { await fs.unlink(temporary).catch(() => {}); }
        available = true;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!available) missing.push({ name: asset.name, size: asset.size });
    mapping.set(asset.source, `/public/media/portable/${asset.name}`);
  }
  return { missing: [...new Map(missing.map(item => [item.name, item])).values()], rewrite: data => transform(data, url => mapping.get(url) || url) };
}
async function legacyManifest(data, directory) {
  const lesson = data.lesson;
  const unit = lesson.unit;
  const course = unit?.course;
  const prefix = `/public/media/${course?._id || course}/${unit?._id || unit}/${lesson._id}/`;
  const urls = new Set();
  transform(data, url => { urls.add(url); return url; });
  const assets = [];
  for (const url of urls) {
    const relative = url.slice(url.indexOf('/public/media/'));
    let source;
    if (relative.startsWith(prefix)) source = path.join(directory, 'media/lesson', path.basename(localPath(url)));
    else {
      const match = relative.match(/^\/public\/media\/question-bank\/[^/]+\/([a-f0-9]{24})\/([^/]+)$/i);
      if (match) source = path.join(directory, 'media/questions', match[1], path.basename(localPath(url)));
    }
    if (!source) throw new Error(`旧资源包未包含引用的媒体，请在原服务器重新导出：${url}`);
    let sha256;
    try { sha256 = await hash(source); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`旧资源包缺少媒体，请在原服务器重新导出：${url}`); throw error; }
    const name = `${sha256}${path.extname(source).toLowerCase()}`;
    await fs.mkdir(path.join(directory, 'assets'), { recursive: true });
    await fs.copyFile(source, path.join(directory, 'assets', name));
    assets.push({ source: url, name, sha256, size: (await fs.stat(source)).size });
  }
  return { version: 1, assets };
}
module.exports = { collect, restore, transform, hash, localPath, legacyManifest };
