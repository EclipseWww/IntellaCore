const { normalizeOfficeRuleScores } = require('./officeRuleScores');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { orderedSlides, showSettings, slideStructure } = require('./pptStructure');

const TEXT_TOLERANCE = 0.8;

function readUInt16LE(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

async function readZipEntries(filePath) {
  const buffer = await fs.readFile(filePath);
  const entries = new Map();
  let eocdOffset = -1;

  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (readUInt32LE(buffer, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('不是有效的PPTX文件：未找到ZIP目录');
  }

  const centralDirSize = readUInt32LE(buffer, eocdOffset + 12);
  const centralDirOffset = readUInt32LE(buffer, eocdOffset + 16);
  let offset = centralDirOffset;
  const end = centralDirOffset + centralDirSize;

  while (offset < end) {
    if (readUInt32LE(buffer, offset) !== 0x02014b50) break;

    const compression = readUInt16LE(buffer, offset + 10);
    const compressedSize = readUInt32LE(buffer, offset + 20);
    const uncompressedSize = readUInt32LE(buffer, offset + 24);
    const fileNameLength = readUInt16LE(buffer, offset + 28);
    const extraLength = readUInt16LE(buffer, offset + 30);
    const commentLength = readUInt16LE(buffer, offset + 32);
    const localHeaderOffset = readUInt32LE(buffer, offset + 42);
    const fileName = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    const localNameLength = readUInt16LE(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16LE(buffer, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataOffset, dataOffset + compressedSize);

    entries.set(fileName, {
      name: fileName,
      compression,
      compressedSize,
      uncompressedSize,
      getBuffer() {
        if (compression === 0) return compressed;
        if (compression === 8) return zlib.inflateRawSync(compressed);
        throw new Error(`不支持的ZIP压缩方式: ${compression}`);
      },
      getText() {
        return this.getBuffer().toString('utf8');
      }
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function decodeXml(text = '') {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractAttr(xml = '', attr) {
  const match = xml.match(new RegExp(`\\b${attr}="([^"]*)"`, 'i'));
  return match ? decodeXml(match[1]) : null;
}

function extractAll(xml = '', regex) {
  const values = [];
  let match;
  while ((match = regex.exec(xml))) values.push(match);
  return values;
}

function stripTags(xml = '') {
  return decodeXml(xml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

function normalizeText(text = '') {
  return text.replace(/\s+/g, '').trim();
}

function similarity(a = '', b = '') {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const dp = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) dp[i][0] = i;
  for (let j = 0; j <= right.length; j++) dp[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - dp[left.length][right.length] / Math.max(left.length, right.length);
}

function parseRelationships(entries, relPath) {
  const relEntry = entries.get(relPath);
  if (!relEntry) return {};
  const rels = {};
  const xml = relEntry.getText();
  const relationshipRegex = /<Relationship\b([^>]*)\/>/g;
  for (const [, attrs] of extractAll(xml, relationshipRegex)) {
    const id = extractAttr(attrs, 'Id');
    if (!id) continue;
    rels[id] = {
      id,
      type: extractAttr(attrs, 'Type') || '',
      target: extractAttr(attrs, 'Target') || '',
      targetMode: extractAttr(attrs, 'TargetMode') || ''
    };
  }
  return rels;
}

function parsePosition(xml = '') {
  const off = xml.match(/<a:off\b([^>]*)\/>/);
  const ext = xml.match(/<a:ext\b([^>]*)\/>/);
  return {
    x: off ? Number(extractAttr(off[1], 'x') || 0) : null,
    y: off ? Number(extractAttr(off[1], 'y') || 0) : null,
    cx: ext ? Number(extractAttr(ext[1], 'cx') || 0) : null,
    cy: ext ? Number(extractAttr(ext[1], 'cy') || 0) : null
  };
}

function parseColor(xml = '') {
  const srgb = xml.match(/<a:srgbClr\b[^>]*val="([^"]+)"/);
  if (srgb) return srgb[1].toUpperCase();
  const scheme = xml.match(/<a:schemeClr\b[^>]*val="([^"]+)"/);
  if (scheme) return `scheme:${scheme[1]}`;
  return null;
}

function parseTextRuns(shapeXml = '') {
  const runs = [];
  const runRegex = /<a:r\b[\s\S]*?<\/a:r>/g;
  for (const [runXml] of extractAll(shapeXml, runRegex)) {
    const text = extractAll(runXml, /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)
      .map(match => decodeXml(match[1]))
      .join('');
    if (!text) continue;
    const rPr = runXml.match(/<a:rPr\b([^>]*)>/);
    const rPrXml = rPr ? rPr[0] : '';
    const latin = runXml.match(/<a:latin\b([^>]*)\/>/);
    const ea = runXml.match(/<a:ea\b([^>]*)\/>/);
    runs.push({
      text,
      fontSize: rPr ? Number(extractAttr(rPr[1], 'sz') || 0) / 100 : null,
      fontFamily: ea ? extractAttr(ea[1], 'typeface') : (latin ? extractAttr(latin[1], 'typeface') : null),
      color: parseColor(runXml),
      bold: rPrXml.includes(' b="1"'),
      italic: rPrXml.includes(' i="1"')
    });
  }
  return runs;
}

function parseTextShapes(xml = '') {
  const shapes = [];
  const shapeRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let index = 0;
  for (const [shapeXml] of extractAll(xml, shapeRegex)) {
    const text = extractAll(shapeXml, /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)
      .map(match => decodeXml(match[1]))
      .join('');
    if (!normalizeText(text)) continue;

    const runs = parseTextRuns(shapeXml);
    const firstRun = runs[0] || {};
    const presetShape = shapeXml.match(/<a:prstGeom\b([^>]*)>/);
    const cNvPr = shapeXml.match(/<p:cNvPr\b([^>]*)/);
    shapes.push({
      index: index++,
      id: cNvPr ? extractAttr(cNvPr[1], 'id') : null,
      text,
      normalizedText: normalizeText(text),
      position: parsePosition(shapeXml),
      fontSize: firstRun.fontSize || null,
      fontFamily: firstRun.fontFamily || null,
      color: firstRun.color || parseColor(shapeXml),
      bold: firstRun.bold || false,
      italic: firstRun.italic || false,
      runs,
      paragraphAlignments: extractAll(shapeXml, /<a:pPr\b([^>]*)/g).map(m=>extractAttr(m[1],'algn') || 'l'),
      lineSpacings: extractAll(shapeXml, /<a:lnSpc\b[\s\S]*?<\/a:lnSpc>/g).map(m=>m[0].match(/<a:spcPct\b[^>]*val="([^"]+)"/)?.[1] || null),
      hasShadow: /<a:(outerShdw|innerShdw)\b/.test(shapeXml),
      hasInnerShadow: /<a:innerShdw\b/.test(shapeXml),
      hasWordArtEffect: /<a:(scene3d|sp3d|prstTxWarp|effectLst|effectDag)\b/.test(shapeXml),
      presetShape: presetShape ? extractAttr(presetShape[1], 'prst') : null,
      rawSignature: signature([
        normalizeText(text),
        firstRun.fontSize,
        firstRun.fontFamily,
        firstRun.color,
        /<a:innerShdw\b/.test(shapeXml),
        /<a:outerShdw\b/.test(shapeXml)
      ])
    });
  }
  return shapes;
}

function parsePictures(xml = '', rels = {}) {
  const pictures = [];
  const picRegex = /<p:pic\b[\s\S]*?<\/p:pic>/g;
  let index = 0;
  for (const [picXml] of extractAll(xml, picRegex)) {
    const blip = picXml.match(/<a:blip\b([^>]*)/);
    const embed = blip ? (extractAttr(blip[1], 'r:embed') || extractAttr(blip[1], 'embed')) : null;
    const rel = embed ? rels[embed] : null;
    const cNvPr = picXml.match(/<p:cNvPr\b([^>]*)/);
    pictures.push({
      index: index++,
      id: cNvPr ? extractAttr(cNvPr[1], 'id') : null,
      name: cNvPr ? extractAttr(cNvPr[1], 'name') : null,
      descr: cNvPr ? extractAttr(cNvPr[1], 'descr') : null,
      relationshipId: embed,
      target: rel?.target || null,
      mediaName: rel?.target ? path.basename(rel.target) : null,
      position: parsePosition(picXml),
      hasHyperlink: /<a:hlinkClick\b/.test(picXml),
      rawSignature: signature([
        rel?.target ? path.basename(rel.target) : '',
        cNvPr ? extractAttr(cNvPr[1], 'name') : '',
        cNvPr ? extractAttr(cNvPr[1], 'descr') : ''
      ])
    });
  }
  return pictures;
}

function parseHyperlinks(xml = '', rels = {}) {
  const links = [];
  const hyperlinkRegex = /<a:hlinkClick\b([^>]*)\/?>/g;
  for (const [, attrs] of extractAll(xml, hyperlinkRegex)) {
    const id = extractAttr(attrs, 'r:id') || extractAttr(attrs, 'id');
    const action = extractAttr(attrs, 'action');
    links.push({
      relationshipId: id,
      action,
      target: id && rels[id] ? rels[id].target : null,
      type: id && rels[id] ? rels[id].type : null
    });
  }
  return links;
}

function parseSound(segment = '', rels = {}) {
  const snd = segment.match(/<p:snd\b([^>]*)/);
  const embed = snd ? (extractAttr(snd[1], 'r:embed') || extractAttr(snd[1], 'embed')) : null;
  const rel = embed ? rels[embed] : null;
  return {
    hasSound: !!snd || /<p:sndAc\b/.test(segment),
    relationshipId: embed,
    target: rel?.target || null,
    name: rel?.target ? path.basename(rel.target) : null
  };
}

function parseTransition(xml = '', rels = {}) {
  const transition = xml.match(/<p:transition\b([\s\S]*?)(?:\/>|<\/p:transition>)/);
  if (!transition) return null;
  const segment = transition[0];
  const child = segment.match(/<p:([a-zA-Z0-9]+)\b([^>]*)/);
  const sound = parseSound(segment, rels);
  return {
    type: child ? child[1] : 'transition',
    attrs: transition[1] || '',
    direction: child ? (extractAttr(child[2], 'dir') || extractAttr(child[2], 'orient')) : null,
    thruBlk: child ? extractAttr(child[2], 'thruBlk') : null,
    speed: extractAttr(transition[1], 'spd'),
    duration: extractAttr(transition[1], 'dur'),
    sound: sound.hasSound,
    soundName: sound.name,
    soundTarget: sound.target
  };
}

function parseAnimations(xml = '') {
  const timing = xml.match(/<p:timing\b[\s\S]*?<\/p:timing>/);
  if (!timing) return [];
  const segment = timing[0];
  const effects = [];
  const sound = parseSound(segment, {});
  const animRegex = /<p:cTn\b([^>]*)>/g;
  for (const [, attrs] of extractAll(segment, animRegex)) {
    const presetClass = extractAttr(attrs, 'presetClass');
    const presetId = extractAttr(attrs, 'presetID');
    if (presetClass || presetId) {
      effects.push({
        presetClass,
        presetId,
        nodeType: extractAttr(attrs, 'nodeType'),
        duration: extractAttr(attrs, 'dur'),
        sound: sound.hasSound
      });
    }
  }
  const effectRegex = /<p:animEffect\b([^>]*)>/g;
  for (const [, attrs] of extractAll(segment, effectRegex)) {
    effects.push({
      transition: extractAttr(attrs, 'transition'),
      filter: extractAttr(attrs, 'filter'),
      direction: extractAttr(attrs, 'filter')?.split(';').pop()?.split(',').pop() || null,
      sound: sound.hasSound
    });
  }
  return effects;
}

function parseBackground(xml = '') {
  const bg = xml.match(/<p:bg\b[\s\S]*?<\/p:bg>/);
  if (!bg) return null;
  return {
    hasImage: /<a:blip\b/.test(bg[0]),
    color: parseColor(bg[0]),
    texture: extractAttr(bg[0], 'prst') || null,
    hiddenMasterShapes: /showMasterSp="0"|showMasterPhAnim="0"/.test(xml)
  };
}

const transitionNameMap = {
  blinds: '百叶窗',
  checker: '棋盘',
  comb: '梳理',
  dissolve: '溶解',
  fade: '淡出',
  push: '推动',
  wipe: '擦除',
  wheel: '轮子',
  split: '分割',
  randomBar: '随机线条',
  cover: '覆盖',
  uncover: '揭开'
};

const directionNameMap = {
  l: '自左侧',
  r: '自右侧',
  u: '自底部',
  d: '自顶部',
  horz: '水平',
  vert: '垂直',
  in: '向内',
  out: '向外',
  cw: '顺时针',
  ccw: '逆时针'
};

const mediaTypeNameMap = {
  audio: '音频',
  video: '视频'
};

function formatBool(value, yes, no) {
  return value ? yes : no;
}

function formatTransition(transition) {
  if (!transition) return '';
  const parts = [
    `名称：${transitionNameMap[transition.type] || transition.type || '未知'}`,
    transition.direction ? `方向：${directionNameMap[transition.direction] || transition.direction}` : null,
    transition.thruBlk ? `效果选项：${transition.thruBlk === '1' ? '穿过块' : transition.thruBlk}` : null,
    transition.speed ? `速度：${transition.speed}` : null,
    transition.duration ? `时长：${transition.duration}` : null,
    transition.sound ? `声音：${transition.soundName || '有声音'}` : '声音：无'
  ].filter(Boolean);
  return parts.join('；');
}

function formatAnimationItem(animation) {
  const parts = [
    animation.presetClass ? `类别：${animation.presetClass}` : null,
    animation.presetId ? `效果ID：${animation.presetId}` : null,
    animation.filter ? `效果：${animation.filter}` : null,
    animation.transition ? `方式：${animation.transition}` : null,
    animation.direction ? `方向：${directionNameMap[animation.direction] || animation.direction}` : null,
    animation.duration ? `时长：${animation.duration}` : null,
    animation.sound ? '声音：有声音' : null
  ].filter(Boolean);
  return parts.join('；') || '动画效果';
}

function formatAnimations(animations = []) {
  return animations.map((animation, index) => `${index + 1}. ${formatAnimationItem(animation)}`).join('\n');
}

function formatMediaItem(media) {
  return [
    `文件：${media.mediaName || '未知'}`,
    `类型：${mediaTypeNameMap[media.type] || media.type || '媒体'}`,
    `播放：${media.playMode === 'auto' ? '自动播放' : '单击时播放'}`,
    formatBool(media.loop, '循环播放', '不循环'),
    formatBool(media.hideWhileNotPlaying, '放映时/未播放时隐藏', '不隐藏'),
    media.rewind ? '播放完返回开头' : null
  ].filter(Boolean).join('；');
}

function formatMedia(mediaItems = []) {
  return mediaItems.map((media, index) => `${index + 1}. ${formatMediaItem(media)}`).join('\n');
}

function transitionDisplayName(transition) {
  return transitionNameMap[transition?.type] || transition?.type || '切换效果';
}

function animationDisplayName(animation) {
  if (animation?.filter) return animation.filter;
  if (animation?.presetClass || animation?.presetId) {
    return [animation.presetClass, animation.presetId].filter(Boolean).join('-');
  }
  return '动画效果';
}

function animationDirectionName(animation) {
  return directionNameMap[animation?.direction] || animation?.direction || null;
}

function pushFineRule(rules, rule) {
  rules.push({
    enabled: true,
    score: 1,
    ...rule
  });
}

function buildTransitionFineRules(rules, slideNumber, transition) {
  pushFineRule(rules, {
    type: 'transitionEffect',
    slideNumber,
    title: `第${slideNumber}张切换：效果`,
    summary: `切换效果：${transitionDisplayName(transition)}`,
    expected: transition
  });
  if (transition.direction || transition.thruBlk) {
    pushFineRule(rules, {
      type: 'transitionDirection',
      slideNumber,
      title: `第${slideNumber}张切换：方向/选项`,
      summary: [
        transition.direction ? `方向：${directionNameMap[transition.direction] || transition.direction}` : null,
        transition.thruBlk ? `效果选项：${transition.thruBlk === '1' ? '穿过块' : transition.thruBlk}` : null
      ].filter(Boolean).join('；'),
      expected: transition
    });
  }
  if (transition.speed || transition.duration) {
    pushFineRule(rules, {
      type: 'transitionTiming',
      slideNumber,
      title: `第${slideNumber}张切换：速度/时长`,
      summary: [transition.speed ? `速度：${transition.speed}` : null, transition.duration ? `时长：${transition.duration}` : null].filter(Boolean).join('；'),
      expected: transition
    });
  }
  pushFineRule(rules, {
    type: 'transitionSound',
    slideNumber,
    title: `第${slideNumber}张切换：声音`,
    summary: transition.sound ? `声音：${transition.soundName || '有声音'}` : '声音：无',
    expected: transition
  });
}

function buildAnimationFineRules(rules, slideNumber, animations = []) {
  animations.forEach((animation, index) => {
    const prefix = animations.length > 1 ? `第${slideNumber}张动画${index + 1}` : `第${slideNumber}张动画`;
    pushFineRule(rules, {
      type: 'animationEffect',
      slideNumber,
      title: `${prefix}：效果`,
      summary: `效果：${animationDisplayName(animation)}`,
      expected: animation
    });
    if (animation.direction || animation.filter) {
      pushFineRule(rules, {
        type: 'animationDirection',
        slideNumber,
        title: `${prefix}：方向`,
        summary: `方向：${animationDirectionName(animation) || animation.filter || '按参考答案'}`,
        expected: animation
      });
    }
    pushFineRule(rules, {
      type: 'animationSound',
      slideNumber,
      title: `${prefix}：声音`,
      summary: animation.sound ? '声音：有声音' : '声音：无',
      expected: animation
    });
  });
}

function buildMediaFineRules(rules, slideNumber, mediaItems = [], originalItems = []) {
  mediaItems.forEach((media, index) => {
    const before = findMedia(originalItems, media, ['type']);
    const start = rules.length;
    const prefix = mediaItems.length > 1 ? `第${slideNumber}张音视频${index + 1}` : `第${slideNumber}张音视频`;
    pushFineRule(rules, {
      type: 'mediaFile',
      slideNumber,
      title: `${prefix}：文件`,
      summary: `文件：${media.mediaName || '未知'}；类型：${mediaTypeNameMap[media.type] || media.type || '媒体'}`,
      expected: media
    });
    pushFineRule(rules, {
      type: 'mediaPlayMode',
      slideNumber,
      title: `${prefix}：播放方式`,
      summary: `播放：${media.playMode === 'auto' ? '自动播放' : '单击时播放'}`,
      expected: media
    });
    pushFineRule(rules, {
      type: 'mediaLoop',
      slideNumber,
      title: `${prefix}：循环`,
      summary: media.loop ? '循环播放' : '不循环',
      expected: media
    });
    pushFineRule(rules, {
      type: 'mediaVisibility',
      slideNumber,
      title: `${prefix}：隐藏设置`,
      summary: media.hideWhileNotPlaying ? '放映时/未播放时隐藏' : '不隐藏',
      expected: media
    });
    if (media.rewind || before?.rewind) {
      pushFineRule(rules, {
        type: 'mediaRewind',
        slideNumber,
        title: `${prefix}：返回开头`,
        summary: media.rewind ? '播放完返回开头' : '播放完不返回开头',
        expected: media
      });
    }
    if(media.type==='audio' && (media.playAcrossSlides || before?.playAcrossSlides)) {
      pushFineRule(rules,{type:'mediaAcrossSlides',slideNumber,title:`${prefix}：跨幻灯片播放`,summary:media.playAcrossSlides?'跨幻灯片播放（不限定结束页）':'仅当前幻灯片播放',expected:media});
      if(media.playAcrossSlides)pushFineRule(rules,{type:'mediaSlideCount',slideNumber,enabled:false,title:`${prefix}：跨页播放范围`,summary:`播放 ${media.slideCount} 张，从第 ${slideNumber} 张到第 ${slideNumber+media.slideCount-1} 张；仅题目明确要求范围时启用`,expected:media});
    }
    if(before) {
      const properties={mediaAcrossSlides:'playAcrossSlides',mediaSlideCount:'slideCount',mediaFile:'mediaHash',mediaPlayMode:'playMode',mediaLoop:'loop',mediaVisibility:'hideWhileNotPlaying',mediaRewind:'rewind'};
      for(let i=rules.length-1;i>=start;i--) {
        const property=properties[rules[i].type];
        if(property && before[property]===media[property])rules.splice(i,1);
      }
    }
  });
}

function buildBackgroundFineRules(rules, slideNumber, background) {
  if (background.hasImage) {
    pushFineRule(rules, {
      type: 'backgroundFill',
      slideNumber,
      title: `第${slideNumber}张背景：图片填充`,
      summary: '背景设置为图片',
      expected: background
    });
  }
  if (background.texture) {
    pushFineRule(rules, {
      type: 'backgroundTexture',
      slideNumber,
      title: `第${slideNumber}张背景：纹理`,
      summary: `纹理：${background.texture}`,
      expected: background
    });
  }
  if (background.color) {
    pushFineRule(rules, {
      type: 'backgroundColor',
      slideNumber,
      title: `第${slideNumber}张背景：颜色`,
      summary: `颜色：${background.color}`,
      expected: background
    });
  }
  if (background.hiddenMasterShapes) {
    pushFineRule(rules, {
      type: 'backgroundHideMaster',
      slideNumber,
      title: `第${slideNumber}张背景：隐藏背景图形`,
      summary: '隐藏主题模板的背景图形',
      expected: background
    });
  }
  if (!background.hasImage && !background.texture && !background.color && !background.hiddenMasterShapes) {
    pushFineRule(rules, {
      type: 'background',
      slideNumber,
      title: `第${slideNumber}张背景`,
      summary: formatBackground(background),
      expected: background,
      score: 1
    });
  }
}

function formatHyperlinks(links = []) {
  return links.map((link, index) => {
    if (link.target) return `${index + 1}. 目标：${link.target}`;
    if (link.action) return `${index + 1}. 动作：${link.action}`;
    return `${index + 1}. 超链接`;
  }).join('\n');
}

function formatBackground(background) {
  if (!background) return '';
  return [
    background.hasImage ? '图片背景' : null,
    background.texture ? `纹理：${background.texture}` : null,
    background.color ? `颜色：${background.color}` : null,
    background.hiddenMasterShapes ? '隐藏主题背景图形' : null
  ].filter(Boolean).join('；') || '背景已设置';
}

function formatPicture(picture) {
  return [
    picture.mediaName ? `文件：${picture.mediaName}` : null,
  ].filter(Boolean).join('；');
}

function formatTextShape(textShape) {
  return [
    `内容：${textShape.text}`,
    textShape.fontFamily ? `字体：${textShape.fontFamily}` : null,
    textShape.fontSize ? `字号：${textShape.fontSize}` : null,
    textShape.color ? `颜色：${textShape.color}` : null,
    textShape.hasShadow ? '阴影效果' : null,
    textShape.hasWordArtEffect ? '文本/艺术字效果' : null
  ].filter(Boolean).join('；');
}

function parseShowSettings(entries) {
  const presentation = entries.get('ppt/presentation.xml')?.getText() || '';
  const customShows = [];
  const customShowRegex = /<p:custShow\b([^>]*)>([\s\S]*?)<\/p:custShow>/g;
  for (const [, attrs, body] of extractAll(presentation, customShowRegex)) {
    customShows.push({
      name: extractAttr(attrs, 'name'),
      slideCount: extractAll(body, /<p:sld\b/g).length
    });
  }
  return {
    loop: /loop="1"/.test(presentation),
    kiosk: /<p:kiosk\b/.test(presentation),
    presenter: /<p:present\b/.test(presentation) || !/<p:kiosk\b/.test(presentation),
    useManualAdvance: /useTimings="0"/.test(presentation),
    customShows
  };
}

function signature(parts) {
  return parts.map(part => String(part ?? '')).join('|').toLowerCase();
}

function getSlideNumber(fileName) {
  const match = fileName.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

async function analyzePptx(filePath) {
  const entries = await readZipEntries(filePath);
  const ordered = orderedSlides(entries);
  const slideFiles = ordered.length ? ordered : Array.from(entries.keys())
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => getSlideNumber(a) - getSlideNumber(b));

  const slides = slideFiles.map((fileName, index) => {
    const slideNumber = index + 1;
    const xml = entries.get(fileName).getText();
    const rels = parseRelationships(entries, `ppt/slides/_rels/${path.basename(fileName)}.rels`);
    const structure = slideStructure(entries, fileName, slideFiles);
    return {
      slideNumber,
      sourceFile: fileName,
      textShapes: parseTextShapes(xml),
      pictures: parsePictures(xml, rels).filter(p=>!structure.media.some(m=>m.objectId===p.id)).map(p=>({...p,mediaHash:structure.objects.find(o=>o.id===p.id)?.mediaHash || null})),
      media: structure.media,
      hyperlinks: parseHyperlinks(xml, rels),
      transition: parseTransition(xml),
      animations: parseAnimations(xml),
      background: parseBackground(xml),
      ...structure
    };
  });

  const masters = Array.from(entries.keys())
    .filter(name => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name))
    .sort()
    .map(fileName => {
      const masterNumber = Number(fileName.match(/slideMaster(\d+)\.xml$/)?.[1] || 0);
      const xml = entries.get(fileName).getText();
      const rels = parseRelationships(entries, `ppt/slideMasters/_rels/slideMaster${masterNumber}.xml.rels`);
      const structure=slideStructure(entries,fileName,slideFiles);
      return {
        masterNumber,
        sourceFile:fileName,
        textShapes: parseTextShapes(xml),
        pictures: parsePictures(xml, rels).map(p=>({...p,mediaHash:structure.objects.find(o=>o.id===p.id)?.mediaHash || null}))
      };
    });

  return {
    filePath,
    slideCount: slides.length,
    slides,
    masters,
    showSettings: { ...parseShowSettings(entries), ...showSettings(entries) }
  };
}

function findMatchingTextShape(shapes, expected) {
  let best = null;
  let bestScore = 0;
  for (const shape of shapes) {
    const textScore = similarity(shape.text, expected.text);
    const sizeScore = expected.fontSize && shape.fontSize && Math.abs(expected.fontSize - shape.fontSize) <= 1 ? 0.08 : 0;
    const fontScore = expected.fontFamily && shape.fontFamily && expected.fontFamily.toLowerCase() === shape.fontFamily.toLowerCase() ? 0.05 : 0;
    const colorScore = expected.color && shape.color === expected.color ? 0.05 : 0;
    const totalScore = textScore + sizeScore + fontScore + colorScore;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = shape;
    }
  }
  return best && similarity(best.text, expected.text) >= TEXT_TOLERANCE ? best : null;
}

function scoreTextShape(expected, actual) {
  const checks = [];
  checks.push({ name: '文字内容', pass: similarity(expected.text, actual?.text || '') >= TEXT_TOLERANCE, weight: 3 });
  if (expected.fontSize) checks.push({ name: '字号', pass: actual?.fontSize && Math.abs(expected.fontSize - actual.fontSize) <= 1, weight: 1 });
  if (expected.fontFamily) checks.push({ name: '字体', pass: !!actual?.fontFamily && actual.fontFamily.toLowerCase() === expected.fontFamily.toLowerCase(), weight: 1 });
  if (expected.color) checks.push({ name: '颜色', pass: actual?.color === expected.color, weight: 1 });
  if (expected.hasInnerShadow || expected.hasShadow) checks.push({ name: '阴影/艺术字效果', pass: !!actual?.hasShadow, weight: 1 });
  if (expected.hasWordArtEffect) checks.push({ name: '文本效果', pass: !!actual?.hasWordArtEffect || !!actual?.hasShadow, weight: 1 });
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.filter(item => item.pass).reduce((sum, item) => sum + item.weight, 0);
  return { ratio: total ? earned / total : 1, checks };
}

function findPicture(pictures, expected) {
  const expectedMedia = expected.mediaName?.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const pic of pictures) {
    if (expected.mediaHash && pic.mediaHash !== expected.mediaHash) continue;
    if (!expected.mediaHash && expectedMedia && pic.mediaName?.toLowerCase() !== expectedMedia) continue;
    const mediaScore = expectedMedia && pic.mediaName?.toLowerCase() === expectedMedia ? 0.5 : 0;
    const totalScore = expected.mediaHash ? 1 : mediaScore || 0.5;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      best = pic;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function objectExistsInOriginal(originalSlide, kind, object) {
  if (!originalSlide) return false;
  if (kind === 'text') {
    return !!findMatchingTextShape(originalSlide.textShapes, object);
  }
  if (kind === 'picture') {
    return !!findPicture(originalSlide.pictures, object);
  }
  return false;
}

function sameObject(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.mediaHash || b.mediaHash) return !!a.mediaHash && a.mediaHash === b.mediaHash;
  if (a.text || b.text) return normalizeText(a.text || '') === normalizeText(b.text || '');
  return a.name === b.name;
}
function animationProperties(a) {
  return {presetClass:a.presetClass,presetId:a.presetId,subtype:a.subtype,filter:a.filter,transition:a.transition,start:a.start,duration:a.duration,rotation:a.rotation,sound:a.sound,soundName:a.soundName,soundHash:a.soundHash};
}
function animationValue(a, property) {
  if(property==='effect')return {presetClass:a.presetClass,presetId:a.presetId,transition:a.transition};
  if(property==='direction')return {subtype:a.subtype,filter:a.filter,rotation:a.rotation};
  if(property==='sound')return {hasSound:!!a.sound,identity:a.soundHash || a.soundName || null};
  if(property==='duration')return a.duration;
  return a.start;
}
function runStyles(shape, property) {
  const out=[];
  for(const run of shape?.runs || []) {
    const text=normalizeText(run.text);if(!text)continue;
    const value=run[property] ?? null;
    if(out.length && out[out.length-1].value===value)out[out.length-1].text+=text;
    else out.push({text,value});
  }
  return out;
}

function buildRules(originalAnalysis, referenceAnalysis) {
  const rules = [];

  if (referenceAnalysis.slideCount !== originalAnalysis?.slideCount) {
        rules.push({
          type: 'slideCount',
          title: '幻灯片数量',
          summary: `参考答案共 ${referenceAnalysis.slideCount} 张幻灯片`,
          expected: referenceAnalysis.slideCount,
          score: 1
        });
  }

  const matchedOriginal = new Set();
  for (const referenceSlide of referenceAnalysis.slides) {
    const originalSlides=originalAnalysis?.slides || [];
    const textOf=s=>normalizeText(s.textShapes.map(t=>t.text).join(''));
    const identity=s=>s.objects.filter(o=>o.kind!=='grpSp').map(o=>o.mediaHash || normalizeText(o.text || '')).filter(Boolean).sort().join('|');
    let originalSlide=originalSlides.find(s=>!matchedOriginal.has(s) && identity(s) && identity(s)===identity(referenceSlide));
    if(!originalSlide) originalSlide=originalSlides.find(s=>!matchedOriginal.has(s) && textOf(s) && textOf(s)===textOf(referenceSlide));
    if(!originalSlide && !identity(referenceSlide) && !textOf(referenceSlide))originalSlide=originalSlides.find(s=>s.sourceFile===referenceSlide.sourceFile && !matchedOriginal.has(s));
    if(!originalSlide && originalAnalysis?.slideCount===referenceAnalysis.slideCount) originalSlide=originalSlides.find(s=>s.slideNumber===referenceSlide.slideNumber && !matchedOriginal.has(s));
    if(originalSlide) matchedOriginal.add(originalSlide);
    if(referenceSlide.hideMasterShapes !== (originalSlide?.hideMasterShapes || false))pushFineRule(rules,{type:'backgroundProperty',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张隐藏主题背景图形`,summary:referenceSlide.hideMasterShapes?'隐藏主题背景图形':'显示主题背景图形',expected:{property:'hideMasterShapes',value:referenceSlide.hideMasterShapes}});

    for (const property of ['fillType','pattern','foreground','background','imageHash','opacity']) {
      const expected=referenceSlide.backgroundDetails?.[property] ?? null;
      if(JSON.stringify(expected)===JSON.stringify(originalSlide?.backgroundDetails?.[property] ?? null))continue;
      pushFineRule(rules,{type:'backgroundProperty',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张背景${{fillType:'填充方式',pattern:'图案',foreground:'前景色',background:'背景色',imageHash:'图片',opacity:'透明度'}[property]}`,summary:property==='opacity' && expected!==null?`透明度：${Math.round((1-expected)*100)}%`:`要求：${JSON.stringify(expected)}`,expected:{property,value:expected}});
    }
    for(const object of referenceSlide.objects.filter(o=>o.kind!=='grpSp')) {
      const before=originalSlide?.objects.find(o=>sameObject(o,object));
      for(const property of ['presetShape','group','cx','cy']) {
        const read=o=>property==='group'?!!o?.group:['cx','cy','x','y'].includes(property)?o?.position[property] ?? null:o?.[property] ?? null;
        const expected=read(object);if(expected===read(before) || expected===null)continue;
        const isSize=['cx','cy'].includes(property);
        pushFineRule(rules,{type:'objectProperty',enabled:!isSize,slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张“${object.text || object.name}”${{presetShape:'形状类型',group:'组合状态',cx:'宽度',cy:'高度'}[property]}`,summary:`要求：${isSize?`${(expected/360000).toFixed(2)}厘米；独立尺寸项，题目要求时启用`:JSON.stringify(expected)}`,expected:{object,property,value:expected}});
      }
    }
    const common=(originalSlide?.objects || []).filter(o=>o.kind!=='grpSp' && referenceSlide.objects.some(r=>sameObject(r,o)));
    const referenceOrder=referenceSlide.objects.filter(o=>common.some(r=>sameObject(r,o)));
    if(common.length>1 && !common.every((o,i)=>sameObject(o,referenceOrder[i]))) {
      pushFineRule(rules,{type:'objectOrder',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张对象叠放顺序`,summary:'按参考答案核对现有对象由底到顶的相对顺序',expected:referenceOrder});
    }
    referenceSlide.tables.forEach((table,index)=>table.forEach((row,r)=>row.forEach((cell,c)=>{
      const before=originalSlide?.tables[index]?.[r]?.[c];
      for(const property of ['fontFamily','fontSize','bold','italic','color','alignments']) {
        const read=cell=>property==='alignments'?cell?.alignments || []:(cell?.runs || []).map(run=>run[property]);
        const expected=read(cell);if(JSON.stringify(expected)===JSON.stringify(read(before)))continue;
        pushFineRule(rules,{type:'tableProperty',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张表格${index+1} 第${r+1}行第${c+1}列 ${property}`,summary:`要求：${JSON.stringify(expected)}`,expected:{table:index,row:r,column:c,property,value:expected}});
      }
    })));

    if (JSON.stringify(referenceSlide.layout) !== JSON.stringify(originalSlide?.layout)) {
      pushFineRule(rules,{type:'slideLayout',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张版式`,summary:`版式：${referenceSlide.layout?.name || referenceSlide.layout?.type || '无'}`,expected:referenceSlide.layout});
    }
    for (const object of originalSlide?.objects || []) {
      if (!referenceSlide.objects.some(o=>sameObject(o,object))) {
        // A group can disappear because it was ungrouped; its children remain.
        if (object.kind === 'grpSp') continue;
        pushFineRule(rules,{type:'objectDeleted',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张删除对象“${object.text || object.name || object.kind}”`,summary:'对应对象应已删除',expected:object});
      }
    }

    for (const textShape of referenceSlide.textShapes) {
      const originalTextShape = originalSlide ? findMatchingTextShape(originalSlide.textShapes, textShape) : null;
      if (!originalTextShape) {
        rules.push({
          type: 'textContent',
          slideNumber: referenceSlide.slideNumber,
          title: `第${referenceSlide.slideNumber}张文字“${textShape.text.slice(0, 20)}”`,
          summary: formatTextShape(textShape),
          expected: textShape,
          score: 1
        });
      }
      for (const property of ['fontSize','fontFamily','color','bold','italic','paragraphAlignments','lineSpacings']) {
        const styles=['fontSize','fontFamily','color','bold','italic'].includes(property)?runStyles(textShape,property):null;
        if (styles ? JSON.stringify(styles)===JSON.stringify(runStyles(originalTextShape,property)) : JSON.stringify(textShape[property]) === JSON.stringify(originalTextShape?.[property])) continue;
        if (textShape[property] === null || textShape[property] === undefined || (!originalTextShape && textShape[property]===false) || (Array.isArray(textShape[property]) && !textShape[property].length)) continue;
        pushFineRule(rules,{type:'textProperty',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张“${textShape.text.slice(0,20)}”${{fontSize:'字号',fontFamily:'字体',color:'颜色',bold:'加粗',italic:'斜体',paragraphAlignments:'段落对齐',lineSpacings:'行距'}[property]}`,summary:`要求：${JSON.stringify(styles || textShape[property])}`,expected:{object:textShape,property,value:textShape[property],styles}});
      }
    }

    for (const picture of referenceSlide.pictures) {
      const originalPicture = originalSlide ? findPicture(originalSlide.pictures, picture) : null;
      const changed = !originalPicture;
      if (changed) {
        rules.push({
          type: 'picture',
          slideNumber: referenceSlide.slideNumber,
          title: `第${referenceSlide.slideNumber}张图片${picture.mediaName ? `“${picture.mediaName}”` : ''}`,
          summary: formatPicture(picture),
          expected: picture,
          score: 1
        });
      }
    }

    if (JSON.stringify(referenceSlide.transition) !== JSON.stringify(originalSlide?.transition || null)) {
      if (referenceSlide.transition) buildTransitionFineRules(rules, referenceSlide.slideNumber, referenceSlide.transition);
      else pushFineRule(rules,{type:'transitionNone',slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张无切换`,summary:'切换效果：无',expected:null});
    }

    const targets=[...(originalSlide?.animations || []),...referenceSlide.animations].map(a=>a.object).filter(Boolean);
    const uniqueTargets=targets.filter((o,i)=>!targets.slice(0,i).some(t=>sameObject(t,o)));
    for(const object of uniqueTargets) {
      const before=(originalSlide?.animations || []).filter(a=>a.presetClass!=='mediacall' && sameObject(a.object,object));
      const after=referenceSlide.animations.filter(a=>a.presetClass!=='mediacall' && sameObject(a.object,object));
      const classes=[...new Set([...before,...after].map(a=>a.presetClass))];
      for(const presetClass of classes) {
        const oldEffects=before.filter(a=>a.presetClass===presetClass),newEffects=after.filter(a=>a.presetClass===presetClass);
        for(let ordinal=0;ordinal<Math.max(oldEffects.length,newEffects.length);ordinal++) {
          const previous=oldEffects[ordinal],current=newEffects[ordinal];
          for(const property of ['effect','direction','start','sound','duration']) {
            if(!current && property!=='effect')continue;
            if(property==='direction' && ![previous,current].some(a=>a && ((a.subtype && a.subtype!=='0') || a.filter || a.rotation)))continue;
            if(property==='sound' && !previous?.sound && !current?.sound)continue;
            if(property==='duration' && !previous?.duration && !current?.duration)continue;
            const value=a=>a?animationValue(a,property):null;
            if(JSON.stringify(value(previous))===JSON.stringify(value(current)))continue;
            const label={entr:'进入',exit:'退出',emph:'强调',path:'动作路径'}[presetClass] || presetClass || '其他';
            pushFineRule(rules,{type:'animationObject',enabled:!['start','duration'].includes(property),slideNumber:referenceSlide.slideNumber,title:`第${referenceSlide.slideNumber}张“${object.text || object.name}”${label}动画${ordinal+1}：${{effect:'效果',direction:'方向',start:'开始方式',sound:'声音',duration:'时长'}[property]}`,summary:(current?JSON.stringify(value(current)):'删除该动画')+(['start','duration'].includes(property)?'；可选参数，请按题目要求启用':''),expected:{object,property,presetClass,ordinal,animations:current?[animationProperties(current)]:[]}});
          }
        }
      }
    }

    buildMediaFineRules(rules, referenceSlide.slideNumber, referenceSlide.media, originalSlide?.media || []);

    if (JSON.stringify(referenceSlide.hyperlinks) !== JSON.stringify(originalSlide?.hyperlinks || [])) {
      rules.push({
        type: 'hyperlink',
        slideNumber: referenceSlide.slideNumber,
        title: `第${referenceSlide.slideNumber}张超链接`,
        summary: formatHyperlinks(referenceSlide.hyperlinks),
        expected: referenceSlide.hyperlinks,
        score: 1
      });
    }


  }

  const originalMasterPictures = new Set((originalAnalysis?.masters || []).flatMap(m => m.pictures.map(p => p.mediaHash || p.mediaName?.toLowerCase()).filter(Boolean)));
  const referenceMasterPictures = referenceAnalysis.masters.flatMap(m => m.pictures.map(p=>({...p,slideNumbers:referenceAnalysis.slides.filter(s=>s.masterPath===m.sourceFile).map(s=>s.slideNumber)})));
  for (const picture of referenceMasterPictures) {
    if (picture.mediaName && !originalMasterPictures.has(picture.mediaHash || picture.mediaName.toLowerCase()) && picture.slideNumbers.length) {
      rules.push({
        type: 'masterPicture',
        title: `母版图片“${picture.mediaName}”`,
        summary: formatPicture(picture),
        expected: picture,
        score: 1
      });
    }
    const before=findPicture((originalAnalysis?.masters || []).flatMap(m=>m.pictures),picture);
    for(const property of ['cx','cy']) {
      const expected=picture.position?.[property];
      if(!expected || expected===before?.position?.[property] || !picture.slideNumbers.length)continue;
      pushFineRule(rules,{type:'masterPictureSize',enabled:false,title:`母版图片“${picture.mediaName}”${property==='cx'?'宽度':'高度'}`,summary:`${(expected/360000).toFixed(2)}厘米；独立尺寸项，题目要求时启用`,expected:{picture,property,value:expected}});
    }
  }

  if(referenceAnalysis.showSettings.showType !== originalAnalysis?.showSettings.showType) {
    const value=referenceAnalysis.showSettings.showType;
    pushFineRule(rules,{type:'showProperty',title:'放映设置：放映类型',summary:`要求：${{presenter:'演讲者放映（全屏幕）',browse:'观众自行浏览（窗口）',kiosk:'展台自动循环放映（全屏幕）'}[value]}`,expected:{property:'showType',value}});
  }
  for (const property of ['loop','useManualAdvance','range','customShows','selectedCustomShow']) {
    if (JSON.stringify(referenceAnalysis.showSettings[property]) === JSON.stringify(originalAnalysis?.showSettings[property])) continue;
    pushFineRule(rules,{type:'showProperty',title:`放映设置：${{loop:'循环放映',kiosk:'放映类型',useManualAdvance:'手动换片',range:'放映范围',customShows:'自定义放映顺序',selectedCustomShow:'播放范围选择自定义放映'}[property]}`,summary:`要求：${JSON.stringify(referenceAnalysis.showSettings[property])}`,expected:{property,value:referenceAnalysis.showSettings[property]}});
  }

  return rules;
}

function gradeRule(rule, studentAnalysis) {
  const slide = studentAnalysis.slides.find(s => s.slideNumber === rule.slideNumber);
  if(rule.type==='criteriaGroup') {
    const details=(rule.children || []).filter(r=>r.enabled!==false).map(r=>gradeRule(r,studentAnalysis));
    const passed=details.length>0 && details.every(r=>r.passed);
    const ratio=rule.scoringMode==='all'?(passed?1:0):details.length?details.reduce((sum,r)=>sum+r.ratio,0)/details.length:0;
    return {...baseResult(rule,ratio),passed,details,message:`通过 ${details.filter(r=>r.passed).length}/${details.length} 个要求${passed?'':'；'+details.filter(r=>!r.passed).map(r=>r.title).join('、')}`};
  }
  if (rule.type === 'slideCount') {
    const pass = studentAnalysis.slideCount === rule.expected;
    return { ...baseResult(rule, pass ? 1 : 0), actual: studentAnalysis.slideCount };
  }
  if (rule.type === 'showProperty') {
    const pass=JSON.stringify(studentAnalysis.showSettings[rule.expected.property])===JSON.stringify(rule.expected.value);
    return {...baseResult(rule,pass?1:0),message:pass?'放映设置匹配':'放映设置不匹配'};
  }
  if (!slide && ['backgroundProperty','objectProperty','objectOrder','tableProperty'].includes(rule.type))return {...baseResult(rule,0),message:'未找到对应幻灯片'};
  if (rule.type === 'backgroundProperty') {
    const actual=rule.expected.property==='hideMasterShapes'?slide.hideMasterShapes:slide.backgroundDetails?.[rule.expected.property] ?? null;
    const pass=JSON.stringify(actual)===JSON.stringify(rule.expected.value);
    return {...baseResult(rule,pass?1:0),message:pass?'背景属性匹配':'背景属性不匹配'};
  }
  if (rule.type === 'objectProperty') {
    const {object,property,value}=rule.expected,actual=slide.objects.find(o=>sameObject(o,object));
    const got=property==='group'?!!actual?.group:['cx','cy','x','y'].includes(property)?actual?.position[property] ?? null:actual?.[property] ?? null;
    const pass=!!actual && (['cx','cy'].includes(property)?got!==null && Math.abs(got-value)<=3600:['x','y'].includes(property)?got!==null && Math.abs(got-value)<=360000:got===value);
    return {...baseResult(rule,pass?1:0),message:pass?'对象属性匹配':'对象属性不匹配'};
  }
  if (rule.type === 'objectOrder') {
    const actual=slide.objects.filter(o=>rule.expected.some(e=>sameObject(e,o)));
    const pass=actual.length===rule.expected.length && actual.every((o,i)=>sameObject(o,rule.expected[i]));
    return {...baseResult(rule,pass?1:0),message:pass?'叠放顺序匹配':'叠放顺序不匹配'};
  }
  if (rule.type === 'tableProperty') {
    const {table,row,column,property,value}=rule.expected,cell=slide.tables[table]?.[row]?.[column];
    const got=property==='alignments'?cell?.alignments:(cell?.runs || []).map(run=>run[property]);
    const pass=!!cell && JSON.stringify(got)===JSON.stringify(value);
    return {...baseResult(rule,pass?1:0),message:pass?'表格单元格属性匹配':'表格单元格属性不匹配'};
  }
  if (!slide && ['slideLayout','objectDeleted','transitionNone','animationObject','textProperty','textContent'].includes(rule.type)) return {...baseResult(rule,0),message:'未找到对应幻灯片'};
  if (rule.type === 'slideLayout') {
    const expected=rule.expected,actual=slide.layout;
    const pass=expected?.type && actual?.type ? expected.type===actual.type : JSON.stringify(expected)===JSON.stringify(actual);
    return {...baseResult(rule,pass?1:0),message:pass?'版式匹配':'版式不匹配'};
  }
  if (rule.type === 'objectDeleted') {
    const pass=!slide.objects.some(o=>sameObject(o,rule.expected));
    return {...baseResult(rule,pass?1:0),message:pass?'指定对象已删除':'指定对象仍存在'};
  }
  if (rule.type === 'transitionNone') {
    const pass=!slide.transition || slide.transition.type==='none';
    return {...baseResult(rule,pass?1:0),message:pass?'无切换':'仍设置了切换效果'};
  }
  if (rule.type === 'animationObject') {
    const {object,property,animations}=rule.expected;
    const candidates=slide.animations.filter(a=>a.presetClass!=='mediacall' && sameObject(a.object,object));
    const selected=rule.expected.ordinal===undefined?null:candidates.filter(a=>a.presetClass===rule.expected.presetClass)[rule.expected.ordinal];
    const actual=rule.expected.ordinal===undefined?candidates:selected?[selected]:[];
    const pick=a=>animationValue(a,property);
    const pass=JSON.stringify(actual.map(pick))===JSON.stringify(animations.map(pick));
    return {...baseResult(rule,pass?1:0),message:pass?'指定对象动画匹配':'指定对象动画不匹配'};
  }
  if (rule.type === 'textContent') {
    const pass=slide.textShapes.some(shape=>normalizeText(shape.text)===normalizeText(rule.expected.text));
    return {...baseResult(rule,pass?1:0),message:pass?'文字内容匹配':'文字内容不匹配'};
  }
  if (rule.type === 'textProperty') {
    const actual=findMatchingTextShape(slide.textShapes,rule.expected.object),{property,value}=rule.expected;
    const pass=!!actual && (rule.expected.styles?JSON.stringify(runStyles(actual,property))===JSON.stringify(rule.expected.styles):JSON.stringify(actual[property])===JSON.stringify(value));
    return {...baseResult(rule,pass?1:0),message:pass?'文字属性匹配':'文字属性不匹配'};
  }
  if (!slide && [
    'textShape', 'picture', 'hyperlink', 'background', 'backgroundFill', 'backgroundTexture', 'backgroundColor', 'backgroundHideMaster',
    'transitionEffect', 'transitionDirection', 'transitionTiming', 'transitionSound',
    'animationEffect', 'animationDirection', 'animationSound',
    'mediaFile', 'mediaPlayMode', 'mediaLoop', 'mediaVisibility', 'mediaRewind', 'mediaAcrossSlides', 'mediaSlideCount'
  ].includes(rule.type)) {
    return { ...baseResult(rule, 0), message: '未找到对应幻灯片' };
  }

  if (rule.type === 'textShape') {
    const actual = findMatchingTextShape(slide.textShapes, rule.expected);
    if (!actual) return { ...baseResult(rule, 0), message: '未找到对应文字对象' };
    const detail = scoreTextShape(rule.expected, actual);
    return {
      ...baseResult(rule, detail.ratio),
      passed: detail.ratio >= 0.75,
      message: detail.checks.filter(c => !c.pass).map(c => c.name).join('、') || '文字对象匹配',
      checks: detail.checks
    };
  }

  if (rule.type === 'picture') {
    const actual = findPicture(slide.pictures, rule.expected);
    const ratio = actual ? 1 : 0;
    return { ...baseResult(rule, ratio), message: actual ? '图片匹配' : '未找到对应图片' };
  }

  if (rule.type === 'transitionEffect') {
    const pass = !!slide.transition && slide.transition.type === rule.expected.type;
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '切换效果匹配' : '切换效果不匹配' };
  }

  if (rule.type === 'transitionDirection') {
    const pass = !!slide.transition &&
      (!rule.expected.direction || slide.transition.direction === rule.expected.direction) &&
      (!rule.expected.thruBlk || slide.transition.thruBlk === rule.expected.thruBlk);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '切换方向/选项匹配' : '切换方向/选项不匹配' };
  }

  if (rule.type === 'transitionTiming') {
    const pass = !!slide.transition &&
      (!rule.expected.speed || slide.transition.speed === rule.expected.speed) &&
      (!rule.expected.duration || slide.transition.duration === rule.expected.duration);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '切换速度/时长匹配' : '切换速度/时长不匹配' };
  }

  if (rule.type === 'transitionSound') {
    const pass = !!slide.transition && !!slide.transition.sound === !!rule.expected.sound && (!rule.expected.sound || (rule.expected.soundHash ? slide.transition.soundHash === rule.expected.soundHash : slide.transition.soundName === rule.expected.soundName));
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '切换声音匹配' : '切换声音不匹配' };
  }

  if (rule.type === 'animationEffect') {
    const pass = findAnimation(slide.animations, rule.expected, ['presetClass', 'presetId', 'filter', 'transition']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '动画效果匹配' : '动画效果不匹配' };
  }

  if (rule.type === 'animationDirection') {
    const pass = findAnimation(slide.animations, rule.expected, ['direction', 'filter']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '动画方向匹配' : '动画方向不匹配' };
  }

  if (rule.type === 'animationSound') {
    const pass = findAnimation(slide.animations, rule.expected, ['sound']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '动画声音匹配' : '动画声音不匹配' };
  }

  if (rule.type === 'mediaFile') {
    const pass = !!findMedia(slide.media, rule.expected, ['type']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '音视频文件匹配' : '音视频文件不匹配' };
  }

  if (rule.type === 'mediaAcrossSlides' || rule.type === 'mediaSlideCount') {
    const property=rule.type==='mediaAcrossSlides'?'playAcrossSlides':'slideCount';
    const pass=!!findMedia(slide.media,rule.expected,['mediaName','type',property]);
    return {...baseResult(rule,pass?1:0),message:pass?'跨页播放设置匹配':'跨页播放设置不匹配'};
  }
  if (rule.type === 'mediaPlayMode') {
    const pass = !!findMedia(slide.media, rule.expected, ['mediaName', 'type', 'playMode']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '播放方式匹配' : '播放方式不匹配' };
  }

  if (rule.type === 'mediaLoop') {
    const pass = !!findMedia(slide.media, rule.expected, ['mediaName', 'type', 'loop']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '循环设置匹配' : '循环设置不匹配' };
  }

  if (rule.type === 'mediaVisibility') {
    const pass = !!findMedia(slide.media, rule.expected, ['mediaName', 'type', 'hideWhileNotPlaying']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '隐藏设置匹配' : '隐藏设置不匹配' };
  }

  if (rule.type === 'mediaRewind') {
    const pass = !!findMedia(slide.media, rule.expected, ['mediaName', 'type', 'rewind']);
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '返回开头设置匹配' : '返回开头设置不匹配' };
  }

  if (rule.type === 'hyperlink') {
    const remaining=[...slide.hyperlinks];
    let matched=0;
    for(const expected of rule.expected) {
      const i=remaining.findIndex(actual=>actual.target===expected.target && actual.action===expected.action && (!expected.object || sameObject(actual.object,expected.object)));
      if(i>=0){matched++;remaining.splice(i,1);}
    }
    const ratio=rule.expected.length?matched/rule.expected.length:slide.hyperlinks.length===0?1:0;
    return { ...baseResult(rule, ratio), passed:ratio===1, message: `对象及链接目标匹配 ${matched}/${rule.expected.length}` };
  }

  if (rule.type === 'background') {
    const actual = slide.background;
    const ratio = actual && JSON.stringify(actual) === JSON.stringify(rule.expected) ? 1 : (actual ? 0.5 : 0);
    return { ...baseResult(rule, ratio), message: ratio === 1 ? '背景匹配' : '背景存在差异' };
  }

  if (rule.type === 'backgroundFill') {
    const pass = !!slide.background?.hasImage === !!rule.expected.hasImage;
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '背景图片匹配' : '背景图片不匹配' };
  }

  if (rule.type === 'backgroundTexture') {
    const pass = !!slide.background && slide.background.texture === rule.expected.texture;
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '背景纹理匹配' : '背景纹理不匹配' };
  }

  if (rule.type === 'backgroundColor') {
    const pass = !!slide.background && slide.background.color === rule.expected.color;
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '背景颜色匹配' : '背景颜色不匹配' };
  }

  if (rule.type === 'backgroundHideMaster') {
    const pass = !!slide.background?.hiddenMasterShapes === !!rule.expected.hiddenMasterShapes;
    return { ...baseResult(rule, pass ? 1 : 0), message: pass ? '隐藏背景图形匹配' : '隐藏背景图形不匹配' };
  }

  if (rule.type === 'masterPicture') {
    const expectedSlides=rule.expected.slideNumbers;
    if(!expectedSlides){const actual=findPicture(studentAnalysis.masters.flatMap(m=>m.pictures),rule.expected);return {...baseResult(rule,actual?1:0),message:actual?'母版图片匹配':'未找到母版图片'};}
    const passedSlides=expectedSlides.filter(number=>{const s=studentAnalysis.slides.find(s=>s.slideNumber===number),master=studentAnalysis.masters.find(m=>m.sourceFile===s?.masterPath);return !!master && !!findPicture(master.pictures,rule.expected);});
    const passed=passedSlides.length;
    const missing=expectedSlides.filter(number=>!passedSlides.includes(number));
    const ratio=expectedSlides.length?passed/expectedSlides.length:0;
    return {...baseResult(rule,ratio),passed:ratio===1,message:`母版图片已应用到 ${passed}/${expectedSlides.length} 张指定幻灯片${missing.length ? '；未通过：第'+missing.join('、')+'张' : ''}`};
  }
  if(rule.type==='masterPictureSize') {
    const {picture,property,value}=rule.expected;
    const numbers=picture.slideNumbers || [];
    const passed=numbers.filter(number=>{const s=studentAnalysis.slides.find(s=>s.slideNumber===number),master=studentAnalysis.masters.find(m=>m.sourceFile===s?.masterPath),actual=master && findPicture(master.pictures,picture);return actual?.position?.[property]!==undefined && Math.abs(actual.position[property]-value)<=3600;}).length;
    const ratio=numbers.length?passed/numbers.length:0;
    return {...baseResult(rule,ratio),passed:ratio===1,message:`母版图片${property==='cx'?'宽度':'高度'}匹配 ${passed}/${numbers.length} 页`};
  }

  if (rule.type === 'showSettings') {
    const expected = rule.expected;
    const actual = studentAnalysis.showSettings;
    const checks = ['loop', 'kiosk', 'useManualAdvance'].map(key => expected[key] === actual[key]);
    const ratio = checks.filter(Boolean).length / checks.length;
    return { ...baseResult(rule, ratio), message: ratio === 1 ? '放映设置匹配' : '放映设置存在差异' };
  }

  return { ...baseResult(rule, 0), message: '暂不支持的评分规则' };
}

function weightedRatio(checks) {
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.filter(check => check.pass).reduce((sum, check) => sum + check.weight, 0);
  return total ? earned / total : 1;
}

function valuesEqual(actual, expected, field) {
  if (field === 'mediaName') {
    return actual?.mediaName?.toLowerCase() === expected?.mediaName?.toLowerCase();
  }
  return actual?.[field] === expected?.[field];
}

function findAnimation(animations = [], expected, fields = []) {
  return animations.find(animation =>
    fields.every(field => expected?.[field] === undefined || valuesEqual(animation, expected, field))
  );
}

function findMedia(mediaItems = [], expected, fields = []) {
  const candidates=mediaItems.filter(media=>media.type===expected.type && (expected.mediaHash ? media.mediaHash===expected.mediaHash : media.mediaName?.toLowerCase()===expected.mediaName?.toLowerCase()));
  const media=candidates[expected.ordinal || 0];
  return media && fields.filter(field=>!(field==='mediaName' && expected.mediaHash)).every(field=>expected[field]===undefined || valuesEqual(media,expected,field)) ? media : null;
}

function scoreTransition(expected, actual) {
  const checks = [
    { name: '已设置切换效果', pass: !!actual, weight: 2 },
    { name: '切换名称', pass: !!actual && actual.type === expected.type, weight: 3 },
    { name: '方向/效果选项', pass: !expected.direction || (!!actual && actual.direction === expected.direction), weight: 2 },
    { name: '速度/时长', pass: (!expected.speed && !expected.duration) || (!!actual && actual.speed === expected.speed && actual.duration === expected.duration), weight: 1 },
    { name: '声音', pass: !expected.sound || (!!actual && actual.sound === expected.sound), weight: 2 }
  ];
  return { ratio: weightedRatio(checks), checks };
}

function animationSimilarity(expected, actual) {
  if (!actual) return 0;
  const checks = [
    { pass: !expected.presetClass || actual.presetClass === expected.presetClass, weight: 2 },
    { pass: !expected.presetId || actual.presetId === expected.presetId, weight: 2 },
    { pass: !expected.filter || actual.filter === expected.filter, weight: 2 },
    { pass: !expected.transition || actual.transition === expected.transition, weight: 1 },
    { pass: !expected.direction || actual.direction === expected.direction, weight: 1 },
    { pass: !expected.sound || actual.sound === expected.sound, weight: 1 }
  ];
  return weightedRatio(checks);
}

function scoreAnimations(expectedList = [], actualList = []) {
  const checks = [];
  let totalRatio = 0;

  expectedList.forEach((expected, index) => {
    let bestRatio = 0;
    for (const actual of actualList) {
      bestRatio = Math.max(bestRatio, animationSimilarity(expected, actual));
    }
    totalRatio += bestRatio;
    checks.push({
      name: `动画${index + 1}`,
      pass: bestRatio >= 0.75,
      weight: 1,
      ratio: Number(bestRatio.toFixed(2))
    });
  });

  return {
    ratio: expectedList.length ? totalRatio / expectedList.length : (actualList.length ? 1 : 0),
    checks
  };
}

function scoreMedia(expectedList = [], actualList = []) {
  const checks = [];
  let matched = 0;
  let totalRatio = 0;

  expectedList.forEach((expected, index) => {
    const expectedName = expected.mediaName?.toLowerCase();
    const candidates = actualList.filter(actual => {
      if (expectedName && actual.mediaName?.toLowerCase() === expectedName) return true;
      return actual.type === expected.type;
    });
    let bestRatio = 0;
    for (const actual of candidates) {
      const mediaChecks = [
        { pass: !expectedName || actual.mediaName?.toLowerCase() === expectedName, weight: 3 },
        { pass: actual.type === expected.type, weight: 2 },
        { pass: actual.playMode === expected.playMode, weight: 2 },
        { pass: actual.loop === expected.loop, weight: 1 },
        { pass: actual.hideWhileNotPlaying === expected.hideWhileNotPlaying, weight: 1 },
        { pass: !expected.rewind || actual.rewind === expected.rewind, weight: 1 }
      ];
      bestRatio = Math.max(bestRatio, weightedRatio(mediaChecks));
    }
    if (bestRatio >= 0.5) matched += 1;
    totalRatio += bestRatio;
    checks.push({
      name: `音视频${index + 1}`,
      pass: bestRatio >= 0.75,
      weight: 1,
      ratio: Number(bestRatio.toFixed(2))
    });
  });

  return {
    ratio: expectedList.length ? totalRatio / expectedList.length : (actualList.length ? 1 : 0),
    checks,
    matched
  };
}

function baseResult(rule, ratio) {
  const safeRatio = Math.max(0, Math.min(1, ratio || 0));
  return {
    type: rule.type,
    title: rule.title,
    summary: rule.summary,
    slideNumber: rule.slideNumber,
    score: Number((rule.score * safeRatio).toFixed(2)),
    maxScore: rule.score,
    passed: safeRatio >= 0.75,
    ratio: safeRatio
  };
}

async function generatePptGradeRules({ originalPath, referencePath }) {
  const [originalAnalysis, referenceAnalysis] = await Promise.all([
    originalPath ? analyzePptx(originalPath) : Promise.resolve(null),
    analyzePptx(referencePath)
  ]);

  return buildRules(originalAnalysis, referenceAnalysis);
}

async function gradePptSubmission({ originalPath, referencePath, studentPath, rules }) {
  const [generatedRules, studentAnalysis] = await Promise.all([
    rules && rules.length ? Promise.resolve(rules) : generatePptGradeRules({ originalPath, referencePath }),
    analyzePptx(studentPath)
  ]);

  const withoutCoordinates = rules => rules.filter(rule=>!(rule.type==='objectProperty' && ['x','y'].includes(rule.expected?.property))).map(rule=>rule.type==='criteriaGroup'?{...rule,children:withoutCoordinates(rule.children || [])}:rule).filter(rule=>rule.type!=='criteriaGroup' || rule.children.length);
  const enabledRules = withoutCoordinates(normalizeOfficeRuleScores(generatedRules)).filter(rule=>rule.enabled!==false && Number(rule.score)>0);
  if(!enabledRules.length)throw new Error('没有启用的PPT得分点，请核对并保存配置');
  const results = enabledRules.map(rule => gradeRule(rule, studentAnalysis));
  const maxScore = results.reduce((sum, item) => sum + item.maxScore, 0) || 100;
  const rawScore = results.reduce((sum, item) => sum + item.score, 0);
  const score = Number(((rawScore / maxScore) * 10).toFixed(2));

  return {
    score,
    maxScore,
    rawScore: Number(rawScore.toFixed(2)),
    passedCount: results.filter(item => item.passed).length,
    totalRules: results.length,
    feedback: buildFeedback(score, results),
    results,
    generatedRules,
    gradedAt: new Date()
  };
}

function buildFeedback(score, results) {
  const failed = results.filter(item => !item.passed).slice(0, 5);
  if (failed.length === 0) return `PPT自动批阅完成，得分 ${score}/10。所有检测项均达到参考答案要求。`;
  return `PPT自动批阅完成，得分 ${score}/10。需重点检查：${failed.map(item => item.title).join('；')}。`;
}

module.exports = {
  analyzePptx,
  generatePptGradeRules,
  gradePptSubmission
};
