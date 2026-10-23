const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { generateExcelGradeRules, gradeExcelSubmission, analyzeExcel } = require('./excelAutoGradeService');
const { evaluateFormula } = require('./excelFormulaEvaluator');

test('移动工作表按标签顺序判分，错误位置与缺少工作表不通过', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'excel-sheet-order-'));
  try {
    const original=path.join(dir,'original.xlsx'),reference=path.join(dir,'reference.xlsx'),student=path.join(dir,'student.xlsx');
    const wb=new ExcelJS.Workbook();
    ['唐诗','明清小说','元曲','其他'].forEach(name=>wb.addWorksheet(name).getCell('A1').value=name);
    await wb.xlsx.writeFile(original);
    const order=names=>names.forEach((name,index)=>{wb.getWorksheet(name).orderNo=index;});
    order(['唐诗','元曲','明清小说','其他']);await wb.xlsx.writeFile(reference);
    const rules=(await generateExcelGradeRules({originalPath:original,referencePath:reference})).filter(r=>r.type==='sheet.previous');
    assert.ok(rules.some(r=>r.sheet==='明清小说' && r.expected==='元曲'));
    assert.equal((await gradeExcelSubmission({studentPath:reference,rules})).score,10);
    const unchanged=await gradeExcelSubmission({studentPath:original,rules});
    assert.equal(unchanged.results.find(r=>r.sheet==='明清小说').passed,false);
    order(['明清小说','唐诗','元曲','其他']);await wb.xlsx.writeFile(student);
    assert.equal((await gradeExcelSubmission({studentPath:student,rules})).results.find(r=>r.sheet==='明清小说').passed,false);
    wb.removeWorksheet('明清小说');await wb.xlsx.writeFile(student);
    assert.equal((await gradeExcelSubmission({studentPath:student,rules})).results.find(r=>r.sheet==='明清小说').passed,false);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('重算统计函数和算术，不信任缓存、不执行公式文本', () => {
  const sheets = { 数据: { cells: { A1: {value: 10}, A2: {value: 20}, A3: {value: 30}, B1: {formula:'SUM(A1:A3)',value:999} } } };
  const calc = formula => evaluateFormula(formula,'数据',sheets);
  assert.equal(calc('B1/2'),30);
  assert.equal(calc('AVERAGE(A1:A3)'),20);
  assert.equal(calc('SUM(A1:A3)/COUNT(A1:A3)'),20);
  assert.equal(calc('ROUND(10/3,2)'),3.33);
  assert.equal(calc('COUNTIF(A1:A3,">15")'),2);
  assert.equal(calc('MAX(A1:A3)-MIN(A1:A3)'),20);
  assert.equal(calc("'数据'!A1+5"),15);
  assert.throws(()=>calc('process.exit()'));
  sheets.数据.cells.B2 = {formula:'B2+1',value:0};
  assert.throws(()=>calc('B2'),/循环引用/);
});

test('细粒度得分、公式要求、删除工作表及局部错误', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'excel-grading-'));
  try {
    const original = path.join(dir,'original.xlsx'), reference = path.join(dir,'reference.xlsx'), student = path.join(dir,'student.xlsx');
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('成绩'); wb.addWorksheet('Sheet1');
    ws.addRows([['姓名','评委8'],['甲',91],['乙',85],['丙',95]]);
    await wb.xlsx.writeFile(original);
    ws.getCell('A1').font = {name:'黑体',size:18}; ws.getCell('A1').alignment = {horizontal:'centerContinuous'};
    ws.getCell('B5').value = {formula:'MIN(B2:B4)',result:85}; ws.getCell('B5').numFmt = '0.00';
    ws.getColumn(2).width = 16; ws.getRow(2).height = 80;
    ws.getCell('A2').border = {left:{style:'thin',color:{argb:'FF00B050'}},right:{style:'thin',color:{argb:'FF00B050'}}};
    wb.removeWorksheet('Sheet1'); await wb.xlsx.writeFile(reference);
    const rules = await generateExcelGradeRules({ originalPath: original, referencePath: reference });
    assert.ok(rules.some(r=>r.property==='font.size')); assert.ok(rules.some(r=>r.property==='font.name'));
    const atoms = rules.flatMap(r=>r.children || [r]);
    assert.ok(atoms.some(r=>r.property==='border.left')); assert.ok(atoms.some(r=>r.property==='border.right'));
    assert.equal((await gradeExcelSubmission({studentPath:reference,rules})).score,10);
    const unchanged = await gradeExcelSubmission({studentPath:original,rules}); assert.equal(unchanged.score,0);
    ws.getCell('A1').font = {name:'黑体',size:17}; ws.getCell('B5').value = 85;
    await wb.xlsx.writeFile(student);
    const graded = await gradeExcelSubmission({studentPath:student,rules});
    assert.equal(graded.results.find(r=>r.property==='font.name').passed,true);
    assert.equal(graded.results.find(r=>r.property==='font.size').passed,false);
    assert.equal(graded.results.find(r=>r.requireFormulaAndResult).score,0);
    assert.equal(graded.results.flatMap(r=>r.details || [r]).find(r=>r.property==='formula').passed,false);
    assert.equal(graded.results.flatMap(r=>r.details || [r]).find(r=>r.property==='value').passed,true);
    ws.getCell('B5').value = {formula:'min($B$2:$B$4)'}; await wb.xlsx.writeFile(student);
    const missingCache = await gradeExcelSubmission({studentPath:student,rules});
    assert.equal(missingCache.results.flatMap(r=>r.details || [r]).find(r=>r.property==='formula').passed,true);
    assert.equal(missingCache.results.find(r=>r.property==='value').passed,true);
    ws.getCell('B5').value = {formula:'SUMPRODUCT(B2:B4)', result:85}; await wb.xlsx.writeFile(student);
    const unsupported = await gradeExcelSubmission({studentPath:student,rules});
    assert.equal(unsupported.results.find(r=>r.property==='value').needsReview,false);
    await assert.rejects(gradeExcelSubmission({studentPath:student,rules:[]}),/没有启用/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test('110格格式压缩为少量得分点，单格错误只扣相应比例', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'excel-group-'));
  try {
    const original=path.join(dir,'original.xlsx'),reference=path.join(dir,'reference.xlsx'),student=path.join(dir,'student.xlsx');
    const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('统计表');
    for(let row=2;row<=12;row++) for(let col=1;col<=10;col++) ws.getCell(row,col).value=row*col;
    await wb.xlsx.writeFile(original);
    for(let row=2;row<=12;row++) for(let col=1;col<=10;col++) {
      const cell=ws.getCell(row,col);cell.font={name:'楷体',size:14};cell.alignment={horizontal:'center'};
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFADD8E6'}};
      cell.border=Object.fromEntries(['top','bottom','left','right'].map(side=>[side,{style:'thin'}]));
    }
    await wb.xlsx.writeFile(reference);
    const rules=await generateExcelGradeRules({originalPath:original,referencePath:reference});
    assert.equal(rules.length,5);
    assert.equal(rules.reduce((s,r)=>s+r.children.length,0),880);
    assert.equal((await gradeExcelSubmission({studentPath:reference,rules})).score,10);
    ws.getCell('D5').font={name:'楷体',size:12};await wb.xlsx.writeFile(student);
    const result=await gradeExcelSubmission({studentPath:student,rules});
    const size=result.results.find(r=>r.property==='font.size');
    assert.equal(result.score,9.98);
    assert.equal(size.passedCount,109);assert.equal(size.checkedCount,110);
    assert.equal(size.details.filter(r=>!r.passed)[0].address,'D5');
    assert.ok(size.score>0.99 && size.score<1);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('OOXML筛选条件、笔画排序和图表独立属性', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'excel-xml-'));
  try {
    const original = path.join(dir,'original.xlsx'), reference = path.join(dir,'reference.xlsx');
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('数据'); ws.addRows([['姓名','分数'],['甲',91],['乙',85]]); await wb.xlsx.writeFile(original);
    const zip = await JSZip.loadAsync(await fs.readFile(original));
    let xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    xml = xml.replace('</worksheet>', '<autoFilter ref="A1:B3"><filterColumn colId="1"><customFilters><customFilter operator="greaterThan" val="90"/></customFilters></filterColumn></autoFilter><sortState ref="A2:B3" sortMethod="stroke"><sortCondition ref="A2:A3" descending="1"/></sortState><drawing r:id="rId1"/></worksheet>');
    zip.file('xl/worksheets/sheet1.xml',xml);
    zip.file('xl/worksheets/_rels/sheet1.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
    zip.file('xl/drawings/_rels/drawing1.xml.rels','<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>');
    zip.file('xl/charts/chart1.xml','<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><a:t>专利申请数量图</a:t></c:title><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:ser><c:f>数据!$A$2:$A$3</c:f><c:f>数据!$B$2:$B$3</c:f></c:ser></c:barChart></c:chart></c:chartSpace>');
    await fs.writeFile(reference,await zip.generateAsync({type:'nodebuffer'}));
    const analysis = await analyzeExcel(reference); assert.equal(analysis.sheets['数据'].charts[0].title,'专利申请数量图');
    const rules = await generateExcelGradeRules({originalPath:original,referencePath:reference});
    assert.ok(rules.some(r=>r.type==='filter')); assert.ok(rules.some(r=>r.type==='sort'));
    assert.equal(rules.filter(r=>r.type==='chart').length,5);
    assert.equal((await gradeExcelSubmission({studentPath:reference,rules})).score,10);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});


test('IF 比较、逻辑条件与分支惰性计算，不使用过期缓存', async () => {
 const sheets={Sheet1:{cells:{G3:{value:80},J3:{value:80}}}};
 const calc=f=>evaluateFormula(f,'Sheet1',sheets);
 assert.equal(calc('IF(G3>=$J$3,"合格","不合格")'),'合格');
 assert.equal(calc('IF(AND(G3>=80,G3<90),"优秀","其他")'),'优秀');
 assert.equal(calc('IF(G3<>80,1/0,IF(G3=80,"等于","其他"))'),'等于');
 assert.equal(calc('IFERROR(1/0,0)'),0);
 assert.equal(calc('IF(FALSE,1/0,"安全")'),'安全');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'excel-if-'));
 try {
  const original=path.join(dir,'original.xlsx'),reference=path.join(dir,'reference.xlsx');
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Sheet1');ws.getCell('G3').value=80;ws.getCell('J3').value=80;
  await wb.xlsx.writeFile(original);ws.getCell('H3').value={formula:'IF(G3>=$J$3,"合格","不合格")',result:'错误缓存'};
  await wb.xlsx.writeFile(reference);const rules=await generateExcelGradeRules({originalPath:original,referencePath:reference});
  const result=await gradeExcelSubmission({studentPath:reference,rules});assert.equal(result.score,10);assert.ok(result.results.every(r=>!r.needsReview));
  ws.getCell('G3').value=79;ws.getCell('H3').value={formula:'IF(G3>=$J$3,"合格","不合格")',result:'合格'};const student=path.join(dir,'student.xlsx');await wb.xlsx.writeFile(student);
  assert.equal((await gradeExcelSubmission({studentPath:student,rules})).score,0);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});

test('条件格式识别区域、条件和样式，优先级编号重排不影响判分',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'excel-cf-'));
 try {
  const original=path.join(dir,'original.xlsx'),reference=path.join(dir,'reference.xlsx'),student=path.join(dir,'student.xlsx');
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('Sheet1');ws.getCell('A1').value=90;await wb.xlsx.writeFile(original);
  const rule={type:'cellIs',operator:'greaterThanOrEqual',formulae:['80'],priority:1,style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFF0000'}}}};
  ws.addConditionalFormatting({ref:'A1:A10',rules:[rule]});await wb.xlsx.writeFile(reference);
  const rules=(await generateExcelGradeRules({originalPath:original,referencePath:reference})).filter(r=>r.type==='conditionalFormatting');assert.equal(rules.length,1);
  assert.equal((await gradeExcelSubmission({studentPath:reference,rules})).score,10);
  rule.priority=5;await wb.xlsx.writeFile(student);assert.equal((await gradeExcelSubmission({studentPath:student,rules})).score,10);
  rule.formulae=['90'];await wb.xlsx.writeFile(student);assert.equal((await gradeExcelSubmission({studentPath:student,rules})).score,0);
  rule.formulae=['80'];rule.style.fill.fgColor.argb='FF00FF00';await wb.xlsx.writeFile(student);assert.equal((await gradeExcelSubmission({studentPath:student,rules})).score,0);
  ws.conditionalFormattings=[];await wb.xlsx.writeFile(student);assert.equal((await gradeExcelSubmission({studentPath:student,rules})).score,0);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});


test('排序按同一列判定单格与范围等价，方向及列错误仍扣分',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'excel-sort-semantic-'));
 try{
  const student=path.join(dir,'student.xlsx');const wb=new ExcelJS.Workbook();wb.addWorksheet('Sheet1').addRows([['标题'],['姓名','分数'],['甲',80]]);const buffer=await wb.xlsx.writeBuffer();
  const sort=ref=>({name:'sortState',attrs:{ref:'A3:H12'},children:[{name:'sortCondition',attrs:{ref,descending:'1'},children:[],text:''}],text:''});
  const zip=await JSZip.loadAsync(buffer);zip.file('xl/worksheets/sheet1.xml',(await zip.file('xl/worksheets/sheet1.xml').async('string')).replace('</worksheet>','<sortState ref="A3:H12"><sortCondition ref="G3:G12" descending="1"/></sortState></worksheet>'));await fs.writeFile(student,await zip.generateAsync({type:'nodebuffer'}));
  const rule={type:'sort',sheet:'Sheet1',score:1,expected:sort('G6')};assert.equal((await gradeExcelSubmission({studentPath:student,rules:[rule]})).score,10);
  rule.expected=sort('F6');assert.equal((await gradeExcelSubmission({studentPath:student,rules:[rule]})).score,0);
  rule.expected=sort('G6');rule.expected.children[0].attrs.descending='0';assert.equal((await gradeExcelSubmission({studentPath:student,rules:[rule]})).score,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('条件格式拆分区域、规则存储顺序和固色编码等价，忽略题目区域外规则',()=>{
 const {compareConditionalFormatting}=require('./excelComparison');
 const rule={type:'cellIs',operator:'lessThan',formulae:['80'],style:{fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FFFFC7CE'}},font:{color:{argb:'FF9C0006'}}}};
 const required=[{ref:'B3:E12',rules:[rule]}];
 const alternate=structuredClone(rule);alternate.style.fill.bgColor=alternate.style.fill.fgColor;delete alternate.style.fill.fgColor;alternate.style.border=null;
 assert.ok(compareConditionalFormatting([{ref:'H23',rules:[alternate]},{ref:'D3:F12',rules:[alternate]},{ref:'B3:C12',rules:[alternate]}],required));
 assert.equal(compareConditionalFormatting([{ref:'B3:E11',rules:[rule]}],required),false);
 const wrong=structuredClone(rule);wrong.operator='greaterThan';wrong.formulae=['90'];assert.equal(compareConditionalFormatting([{ref:'B3:F12',rules:[wrong]}],required),false);
});
