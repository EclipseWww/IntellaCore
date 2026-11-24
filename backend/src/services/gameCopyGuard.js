/**
 * 检测学生网页作品是否是从游戏中心复制的游戏代码。
 *
 * 做法：把每个游戏自己的 HTML/JS/CSS 切成「连续 10 个词法单元」的片段并取哈希（代码指纹）。
 * 学生作品同样切片后，看有多少片段与某个游戏相同。
 * - 只比较词法单元，改缩进、换行、注释、压缩空白都不影响
 * - 跳过 jQuery、Bootstrap 等通用库（学生可以正常使用），以及过大的引擎运行库
 * 另外，作品里直接引用游戏地址（/api/games/play/...、/games/xxx/）也判为复制。
 */
const fs = require('fs');
const path = require('path');
const { GAMES_ROOT, listGameIds } = require('./gameAccess');

const SHINGLE = 10;
const MIN_MATCHES = 120;         // 至少这么多片段相同（约几十行代码），避免误伤普通网页
const MIN_RATIO = 0.3;           // 且占作品代码的 30% 以上，或占游戏代码的 30% 以上
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const VENDOR = /(^|[\\/])(jquery|bootstrap|html2canvas|pako|base64|sanitizer|mxclient)[^\\/]*\.(js|css)$|\.min\.(js|css)$/i;

/** 去掉注释后切成词法单元 */
function tokenize(code) {
  const stripped = String(code)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ');
  return stripped.match(/[A-Za-z_$一-龥][\w$一-龥]*|\d+(?:\.\d+)?|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`|[^\s\w]/g) || [];
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function shingles(code) {
  const t = tokenize(code);
  const set = new Set();
  for (let i = 0; i + SHINGLE <= t.length; i++) set.add(fnv1a(t.slice(i, i + SHINGLE).join('\u0001')));
  return set;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html?|js|css)$/i.test(e.name) && !VENDOR.test(p)) out.push(p);
  }
  return out;
}

let fingerprints = null;
function getFingerprints() {
  if (fingerprints) return fingerprints;
  fingerprints = new Map();
  for (const id of listGameIds()) {
    const set = new Set();
    for (const f of walk(path.join(GAMES_ROOT, id))) {
      try {
        if (fs.statSync(f).size > MAX_FILE_BYTES) continue;
        for (const h of shingles(fs.readFileSync(f, 'utf8'))) set.add(h);
      } catch { /* 读不了的文件忽略 */ }
    }
    if (set.size) fingerprints.set(id, set);
  }
  return fingerprints;
}

/**
 * @returns {null | { gameId, matched, ratio, coverage, reason }}
 */
function detectGameCopy(code) {
  if (!code || typeof code !== 'string') return null;
  const ref = /\/api\/games\/play\/([a-z0-9_-]+)|["'(\s=]\/?games\/([a-z0-9_-]+)\/[\w./-]*\.(?:html|js|css)/i.exec(code);
  if (ref && listGameIds().includes((ref[1] || ref[2] || '').toLowerCase())) {
    return { gameId: (ref[1] || ref[2]).toLowerCase(), matched: 0, ratio: 1, coverage: 0, reason: 'reference' };
  }
  const mine = shingles(code);
  if (mine.size < MIN_MATCHES) return null;
  let best = null;
  for (const [gameId, set] of getFingerprints()) {
    let matched = 0;
    for (const h of mine) if (set.has(h)) matched++;
    if (matched < MIN_MATCHES) continue;
    const ratio = matched / mine.size, coverage = matched / set.size;
    if ((ratio >= MIN_RATIO || coverage >= MIN_RATIO) && (!best || matched > best.matched)) {
      best = { gameId, matched, ratio: Math.round(ratio * 100) / 100, coverage: Math.round(coverage * 100) / 100, reason: 'similar' };
    }
  }
  return best;
}

// 判定结果缓存（作品广场列表频繁读取）：键为 作品id + 更新时间
const cache = new Map();
function isGameCopyCached(project) {
  const key = `${project._id}:${project.updatedAt ? new Date(project.updatedAt).getTime() : ''}`;
  if (!cache.has(key)) {
    if (cache.size > 2000) cache.clear();
    cache.set(key, !!detectGameCopy(project.code));
  }
  return cache.get(key);
}

const COPY_MESSAGE = '这个网页包含游戏中心里的游戏代码，不能发布。请发布自己创作的作品。';

module.exports = { tokenize, shingles, detectGameCopy, isGameCopyCached, getFingerprints, COPY_MESSAGE, MIN_MATCHES, MIN_RATIO };
