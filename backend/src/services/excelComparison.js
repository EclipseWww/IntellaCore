const canonical = value => JSON.stringify(value, (key,v) => v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
function normalizeSort(sort) {
 if(!sort) return null;
 const truth=value=>['1','true'].includes(String(value));
 const attrs=sort.attrs || {};
 return {range:attrs.ref?.replace(/\$/g,'').toUpperCase(),caseSensitive:truth(attrs.caseSensitive),columnSort:truth(attrs.columnSort),sortMethod:attrs.sortMethod || 'pinYin',conditions:(sort.children || []).filter(child=>child.name==='sortCondition').map(child=>{
  const {ref,descending,sortBy,...other}=child.attrs || {};
  const columns=(ref || '').replace(/\$/g,'').toUpperCase().split(':').map(part=>part.match(/^[A-Z]+/)?.[0]);
  return {columns:[...new Set(columns)],descending:truth(descending),sortBy:sortBy || 'value',...other};
 })};
}
function cleanStyle(value) {
 if(Array.isArray(value)) return value.map(cleanStyle);
 if(!value || typeof value!=='object') return value;
 const result={};for(const [key,item] of Object.entries(value)){if(item!==null && item!==undefined)result[key]=cleanStyle(item);}
 if(result.type==='pattern' && result.pattern==='solid') {result.fgColor=result.fgColor || result.bgColor;delete result.bgColor;}
 return result;
}
function conditionalCells(formats) {
 const cells=new Map();
 for(const format of formats || []) for(const ref of format.ref.replace(/\$/g,'').split(/\s+/)) {
  const match=ref.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);if(!match)throw new Error('不支持的条件格式区域：'+ref);
  const col=s=>s.toUpperCase().split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
  const a=col(match[1]),b=col(match[3] || match[1]),first=+match[2],last=+(match[4] || match[2]);
  if((b-a+1)*(last-first+1)>100000)throw new Error('条件格式区域过大');
  const rules=(format.rules || []).map(rule=>canonical(cleanStyle(rule)));
  for(let c=a;c<=b;c++)for(let r=first;r<=last;r++){const key=c+':'+r;cells.set(key,[...new Set([...(cells.get(key) || []),...rules])]);}
 }
 return cells;
}
function compareConditionalFormatting(actual,expected) {
 const required=conditionalCells(expected),submitted=conditionalCells(actual);
 if(!required.size)return !submitted.size;
 return [...required].every(([cell,rules])=>canonical(submitted.get(cell) || [])===canonical(rules));
}
module.exports={normalizeSort,compareConditionalFormatting};
