const { normalizeSort, compareConditionalFormatting } = require('./excelComparison');
const { normalizeOfficeRuleScores } = require('./officeRuleScores');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { SaxesParser } = require('saxes');
const fs = require('fs').promises;
const path = require('path').posix;
const { evaluateFormula } = require('./excelFormulaEvaluator');
const { compactExcelRules } = require('./excelRuleGrouping');

// Parse namespace-independent OOXML; attribute ordering and relationship IDs are not answers.
function xmlTree(xml) {
  const root = { children: [] }, stack = [root];
  const parser = new SaxesParser({ xmlns: true });
  parser.on('opentag', tag => {
    const node = { name: tag.local, attrs: {}, children: [], text: '' };
    Object.values(tag.attributes).forEach(a => { if (a.prefix !== 'xmlns' && a.name !== 'xmlns') node.attrs[a.local] = a.value; });
    stack[stack.length - 1].children.push(node); stack.push(node);
  });
  parser.on('text', text => { stack[stack.length - 1].text += text; });
  parser.on('closetag', () => stack.pop());
  parser.write(xml).close();
  return root.children[0];
}
const nodes = (node, name) => !node ? [] : [...(node.name === name ? [node] : []), ...node.children.flatMap(n => nodes(n, name))];
const stable = value => JSON.stringify(value, function(k, v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v; });
function equal(a, b) {
  if (a === undefined || b === undefined) return a === b;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
  return stable(a ?? null) === stable(b ?? null);
}
function valueOf(cell) {
  const v = cell.value;
  if (v && typeof v === 'object') {
    if ('formula' in v || 'sharedFormula' in v) return v.result ?? null;
    if (v.richText) return v.richText.map(r => r.text).join('');
    if (v instanceof Date) return v.toISOString();
    if (v.text !== undefined) return v.text;
  }
  return v ?? null;
}
function cellProperties(cell) {
  const result = { value: valueOf(cell), formula: cell.formula ? cell.formula.replace(/^=/, '').split(/("(?:[^"]|"")*")/g).map((part,i) => i % 2 ? part : part.replace(/\s+/g, '').replace(/\$/g, '').toUpperCase()).join('') : null, numFmt: cell.numFmt || 'General' };
  for (const [group, fields] of Object.entries({ font: ['name','size','bold','italic','underline','strike','color'], alignment: ['horizontal','vertical','wrapText','textRotation','indent','shrinkToFit'], border: ['top','bottom','left','right','diagonal'] })) {
    fields.forEach(field => { result[`${group}.${field}`] = cell[group]?.[field] ?? (['bold','italic','strike','wrapText','shrinkToFit'].includes(field) ? false : null); });
  }
  result.fill = cell.fill?.pattern === 'none' || !cell.fill ? null : cell.fill;
  result.merge = cell.isMerged ? cell.master.address : null;
  return result;
}
async function analyzeExcel(filePath) {
  const data = await fs.readFile(filePath);
  if (data.length > 100 * 1024 * 1024) throw new Error('Excel文件超过100MB');
  const zip = await JSZip.loadAsync(data);
  const read = async name => zip.file(name) ? xmlTree(await zip.file(name).async('string')) : null;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(data, { ignoreNodes: ['drawing'] });
  const rels = nodes(await read('xl/_rels/workbook.xml.rels'), 'Relationship');
  const sheetDefs = nodes(await read('xl/workbook.xml'), 'sheet');
  const sheets = {};
  for (const ws of workbook.worksheets) {
    const def = sheetDefs.find(s => s.attrs.name === ws.name);
    const target = rels.find(r => r.attrs.Id === def?.attrs.id)?.attrs.Target;
    const filename = target?.startsWith('/') ? target.slice(1) : path.normalize(path.join('xl', target || ''));
    const tree = await read(filename);
    const cells = {};
    ws.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => { cells[cell.address] = cellProperties(cell); }));
    const rows = {}, columns = {}, explicitRowHeights = {};
    const defaultRowHeight = Number(nodes(tree, 'sheetFormatPr')[0]?.attrs.defaultRowHeight || 15);
    nodes(tree, 'row').forEach(r => { rows[r.attrs.r] = { height: Number(r.attrs.ht || ws.properties.defaultRowHeight || 15), hidden: r.attrs.hidden === '1' }; });
    nodes(tree, 'row').forEach(r => { explicitRowHeights[r.attrs.r] = r.attrs.customHeight === '1'; });
    nodes(tree, 'col').forEach(c => { for (let i = Number(c.attrs.min); i <= Number(c.attrs.max); i++) columns[i] = { width: Number(c.attrs.width || 8.43), hidden: c.attrs.hidden === '1' }; });
    const charts = [];
    const sheetRels = nodes(await read(path.join(path.dirname(filename), '_rels', path.basename(filename) + '.rels')), 'Relationship');
    for (const drawing of sheetRels.filter(r => /\/drawing$/.test(r.attrs.Type))) {
      const dp = path.normalize(path.join(path.dirname(filename), drawing.attrs.Target));
      const dr = nodes(await read(path.join(path.dirname(dp), '_rels', path.basename(dp) + '.rels')), 'Relationship');
      for (const cr of dr.filter(r => /\/chart$/.test(r.attrs.Type))) {
        const chart = await read(path.normalize(path.join(path.dirname(dp), cr.attrs.Target)));
        charts.push({ type: nodes(chart, 'barChart').length ? 'bar' : nodes(chart, 'lineChart').length ? 'line' : 'other', direction: nodes(chart, 'barDir')[0]?.attrs.val, grouping: nodes(chart, 'grouping')[0]?.attrs.val, title: nodes(nodes(chart, 'title')[0], 't').map(n => n.text).join(''), sources: nodes(chart, 'f').map(n => n.text.replace(/\$/g, '')).sort() });
      }
    }
    sheets[ws.name] = { cells, rows, columns, defaultRowHeight, explicitRowHeights, filter: nodes(tree, 'autoFilter')[0] || null, sort: nodes(tree, 'sortState')[0] || null, charts, conditionalFormatting: (ws.conditionalFormattings || []).flatMap(cf => cf.rules.map(rule=>({ref:cf.ref,rule}))).sort((a,b)=>(a.rule.priority || 0)-(b.rule.priority || 0)).map(({ref,rule:{priority,...rule}})=>({ref:ref.replace(/\$/g,'').trim().split(/\s+/).sort().join(' '),rules:[rule]})) };
  }
  for (const [name, sheet] of Object.entries(sheets)) {
    sheet.calculationErrors = {};
    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (!cell.formula) continue;
      try { cell.value = evaluateFormula(cell.formula, name, sheets); }
      catch (error) { sheet.calculationErrors[address] = error.message; }
    }
  }
  return { names: workbook.worksheets.map(w => w.name), sheets };
}
const blank = cellProperties({ value: null });
function getActual(analysis, rule) {
  if (rule.type === 'sheet.exists') return !!analysis.sheets[rule.sheet];
  if (rule.type === 'sheet.previous') return analysis.names.includes(rule.sheet) ? analysis.names[analysis.names.indexOf(rule.sheet) - 1] ?? null : undefined;
  const sheet = analysis.sheets[rule.sheet];
  if (!sheet) return undefined;
  if (rule.type === 'cell') return (sheet.cells[rule.address] || blank)[rule.property];
  if (rule.type === 'row') return (sheet.rows[rule.address] || { height: sheet.defaultRowHeight, hidden: false })[rule.property];
  if (rule.type === 'column') return (sheet.columns[rule.address] || { width: 8.43, hidden: false })[rule.property];
  if (rule.type === 'chart') return sheet.charts[rule.address]?.[rule.property];
  return sheet[rule.type];
}
async function generateExcelGradeRules({ originalPath, referencePath }) {
  if (!originalPath) throw new Error('请上传原始Excel，才能准确提取操作得分点');
  const [original, reference] = await Promise.all([analyzeExcel(originalPath), analyzeExcel(referencePath)]);
  const rules = [];
  const add = (type, sheet, address, property, expected) => {
    const rule = { id: `excel-${rules.length}`, type, sheet, address, property, expected, enabled: true, score: 1, title: `${sheet} ${address ?? ''} ${property || type}`, summary: `要求：${stable(expected)}` };
    if (type === 'conditionalFormatting') {
      rule.title = `${sheet} 条件格式`;
      rule.summary = '应用区域、规则条件及格式须与参考答案一致';
    }
    if (type === 'sheet.previous') {
      rule.title = `${sheet} 工作表顺序`;
      rule.summary = expected === null ? `“${sheet}”位于第一个工作表` : `“${sheet}”紧接在“${expected}”工作表后面`;
    }
    if (type === 'cell' && ['value','formula'].includes(property) && reference.sheets[sheet]?.cells[address]?.merge && reference.sheets[sheet].cells[address].merge !== address) return;
    if (type === 'row' && property === 'height' && !reference.sheets[sheet]?.explicitRowHeights[address]) {
      rule.enabled = false;
      rule.summary += '；未记录手动行高，可能随字体或布局自动变化，默认不计分，可手动启用';
      rule.inference = 'incidental';
    }
    const originalValue=getActual(original,rule);
    if (type==='sort' ? !equal(normalizeSort(originalValue),normalizeSort(expected)) : !equal(originalValue,expected)) rules.push(rule);
  };
  for (const sheet of new Set([...original.names, ...reference.names])) {
    add('sheet.exists', sheet, null, null, !!reference.sheets[sheet]);
    const ref = reference.sheets[sheet]; if (!ref) continue;
    add('sheet.previous', sheet, null, null, reference.names[reference.names.indexOf(sheet) - 1] ?? null);
    for (const address of new Set([...Object.keys(original.sheets[sheet]?.cells || {}), ...Object.keys(ref.cells)])) {
      const props = ref.cells[address] || blank;
      Object.entries(props).forEach(([property, expected]) => add('cell', sheet, address, property, expected));
    }
    for (const type of ['row', 'column']) {
      const key = type === 'row' ? 'rows' : 'columns';
      for (const address of new Set([...Object.keys(original.sheets[sheet]?.[key] || {}), ...Object.keys(ref[key])])) {
        const props = ref[key][address] || (type === 'row' ? { height: ref.defaultRowHeight, hidden: false } : { width: 8.43, hidden: false });
        Object.entries(props).forEach(([property, expected]) => add(type, sheet, address, property, expected));
      }
    }
    ['filter', 'sort', 'conditionalFormatting'].forEach(type => add(type, sheet, null, null, ref[type]));
    ref.charts.forEach((chart, index) => Object.entries(chart).forEach(([property, expected]) => add('chart', sheet, index, property, expected)));
  }
  // Fill holes only when every cell in the inferred rectangle has the exact
  // same reference style. Do not expand data/formulas, blank resets or sparse regions.
  const styleGroups = new Map();
  for (const rule of rules.filter(r=>r.type==='cell' && !['value','formula','merge'].includes(r.property) && r.expected !== null)) {
    const key=stable([rule.sheet,rule.property,rule.expected]);
    if(!styleGroups.has(key)) styleGroups.set(key,[]);
    styleGroups.get(key).push(rule);
  }
  for(const group of styleGroups.values()) {
    if(group.length<2) continue;
    const coords=group.map(r=>{const m=r.address.match(/^([A-Z]+)(\d+)$/);return [m[1].split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),Number(m[2])];});
    const minC=Math.min(...coords.map(c=>c[0])),maxC=Math.max(...coords.map(c=>c[0])),minR=Math.min(...coords.map(c=>c[1])),maxR=Math.max(...coords.map(c=>c[1]));
    const area=(maxC-minC+1)*(maxR-minR+1);if(area>10000 || group.length/area<0.25)continue;
    const letter=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;};
    const addresses=[];for(let r=minR;r<=maxR;r++)for(let c=minC;c<=maxC;c++)addresses.push(letter(c)+r);
    const first=group[0],cells=reference.sheets[first.sheet].cells;
    if(!addresses.every(a=>cells[a] && equal(cells[a][first.property],first.expected)))continue;
    const existing=new Set(group.map(r=>r.address));
    for(const address of addresses.filter(a=>!existing.has(a)))rules.push({...first,id:`excel-${rules.length}`,address,inference:'uniform-region',summary:first.summary+'；统一格式区域内原本已符合的单元格'});
  }
  return compactExcelRules(rules);
}
async function gradeExcelSubmission({ studentPath, rules }) {
  const enabled = normalizeOfficeRuleScores(rules || []).filter(r => r.enabled !== false && Number(r.score) > 0);
  if (!enabled.length) throw new Error('没有启用的Excel得分点，请先解析并保存配置');
  const analysis = await analyzeExcel(studentPath);
  const gradeRule = rule => {
    if (rule.type === 'group') {
      const details = (rule.children || []).map(child => gradeRule({ ...child, score: 1 }));
      const units = rule.requireFormulaAndResult ? [...new Set(details.map(r=>r.address))].map(address => {
        const checks=details.filter(r=>r.address===address);
        return checks.some(r=>r.property==='formula') && checks.every(r=>r.passed);
      }) : details.map(r=>r.passed);
      const passedCount = units.filter(Boolean).length;
      const ratio = units.length ? passedCount/units.length : 0;
      const failures = details.filter(r=>!r.passed);
      return { ...rule, children: undefined, details, maxScore:Number(rule.score), score:Number((Number(rule.score)*ratio).toFixed(4)), passed:units.length > 0 && passedCount===units.length, needsReview:false, checkedCount:units.length, passedCount, message:`通过 ${passedCount}/${units.length} 项${failures.length ? `；未通过：${failures.slice(0,8).map(r=>r.address).join('、')}${failures.length>8 ? '…' : ''}` : ''}` };
    }
    const actual = getActual(analysis, rule);
    let calculationError = rule.type === 'cell' && rule.property === 'value' ? analysis.sheets[rule.sheet]?.calculationErrors[rule.address] : null;
    let passed = !calculationError && equal(actual, rule.expected);
    if(rule.type==='sort') passed=equal(normalizeSort(actual),normalizeSort(rule.expected));
    if(rule.type==='conditionalFormatting'){try{passed=compareConditionalFormatting(actual,rule.expected);}catch(error){calculationError=error.message;passed=false;}}
    if (!passed && rule.type === 'cell' && rule.property === 'formula' && actual && rule.expected) {
      try {
        const required = [...rule.expected.matchAll(/([A-Z][A-Z0-9.]*)\(/g)].map(m=>m[1]);
        const used = [...actual.matchAll(/([A-Z][A-Z0-9.]*)\(/g)].map(m=>m[1]);
        passed = required.every(name => used.includes(name) || (name === 'AVERAGE' && used.includes('SUM') && used.includes('COUNT'))) && equal(evaluateFormula(actual,rule.sheet,analysis.sheets),evaluateFormula(rule.expected,rule.sheet,analysis.sheets));
      } catch (error) { calculationError = error.message; }
    }
    return { ...rule, actual, maxScore: Number(rule.score), score: passed ? Number(rule.score) : 0, passed, needsReview:false, message: calculationError ? `公式计算未通过：${calculationError}` : passed ? '通过' : `实际：${stable(actual)}；${rule.summary}` };
  };
  const results = enabled.map(gradeRule);
  const maxScore = results.reduce((s,r) => s+r.maxScore,0), rawScore = results.reduce((s,r) => s+r.score,0);
  const score = Number((10*rawScore/maxScore).toFixed(2));
  return { score, maxScore, rawScore, results, passedCount: results.filter(r=>r.passed).length, totalRules: results.length, gradedAt: new Date(), feedback: `Excel自动批阅：${score}/10，通过${results.filter(r=>r.passed).length}/${results.length}项。` };
}
module.exports = { analyzeExcel, generateExcelGradeRules, gradeExcelSubmission };
