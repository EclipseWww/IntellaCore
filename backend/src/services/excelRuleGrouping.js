const labels = { value:'计算或数据结果', formula:'函数公式', 'font.name':'字体', 'font.size':'字号', 'font.color':'文字颜色', 'font.italic':'斜体', 'font.bold':'加粗', 'alignment.horizontal':'水平对齐', 'alignment.vertical':'垂直对齐', fill:'底纹颜色', merge:'合并单元格', height:'行高', width:'列宽' };
function compactExcelRules(rules) {
  const groups = new Map(), output = [];
  const formulaAt = new Map(rules.filter(r=>r.type==='cell' && r.property==='formula').map(r=>[`${r.sheet}!${r.address}`,r.expected]));
  for (const rule of rules) {
    if (!['cell','row','column'].includes(rule.type)) { output.push(rule); continue; }
    let family = '';
    if (rule.property === 'formula' || rule.property === 'value') {
      const formula = formulaAt.get(`${rule.sheet}!${rule.address}`);
      family = formula ? (formula.match(/([A-Z][A-Z0-9.]*)\(/)?.[1] || '算术') : '数据变化';
    } else family = JSON.stringify(rule.expected);
    const functionCalculation = ['formula','value'].includes(rule.property) && !!formulaAt.get(`${rule.sheet}!${rule.address}`);
    const property = functionCalculation ? 'calculation' : rule.property?.startsWith('border.') ? 'border.all' : rule.property;
    const key = JSON.stringify([rule.sheet,rule.type,property,family,rule.enabled !== false]);
    if (!groups.has(key)) { const group={ ...rule, type:'group', children:[], score:1, requireFormulaAndResult:functionCalculation }; groups.set(key,group); output.push(group); }
    groups.get(key).children.push(rule);
  }
  return output.map((group,index)=> {
    if (!group.children) return group;
    const first=group.children[0];
    const addresses=[...new Set(group.children.map(c=>c.address))];
    const ranges = [];
    // Compress contiguous cells within each column, without implying unchecked holes.
    if(first.type==='cell') {
      const columns=new Map();
      addresses.forEach(a=> {const m=a.match(/^([A-Z]+)(\d+)$/); if(!columns.has(m[1]))columns.set(m[1],[]);columns.get(m[1]).push(Number(m[2]));});
      for(const [col,rows] of columns){rows.sort((a,b)=>a-b);let start=rows[0],end=start;for(const row of [...rows.slice(1),Infinity]){if(row===end+1){end=row;continue;}ranges.push(start===end?`${col}${start}`:`${col}${start}:${col}${end}`);start=end=row;}}
    } else ranges.push(...addresses);
    const location=ranges.join('、');
    const short=location.length>90 ? location.slice(0,90)+'…' : location;
    const func=['formula','value'].includes(first.property) ? formulaAt.get(`${first.sheet}!${first.address}`)?.match(/([A-Z][A-Z0-9.]*)\(/)?.[1] : null;
    const label=group.requireFormulaAndResult ? '函数计算' : first.property?.startsWith('border.') ? '边框' : labels[first.property] || first.property;
    return {...group,id:`excel-group-${index}`,title:`${first.sheet} ${label}${func ? `（${func}）` : ''}`,summary:`${short}，${addresses.length} 个单元格／${group.children.length} 项检查；${group.requireFormulaAndResult ? '每格须使用对应函数且计算结果正确；手填数字不得分' : first.property==='value' ? '逐格核对数据结果' : first.summary}`,checkCount:group.children.length};
  });
}
module.exports={compactExcelRules};
