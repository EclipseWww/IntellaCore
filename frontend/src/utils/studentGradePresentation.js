const properties = {'font.name':'字体','font.size':'字号','font.color':'文字颜色','font.bold':'加粗','font.italic':'斜体','font.underline':'下划线','alignment.horizontal':'水平对齐','alignment.vertical':'垂直对齐','alignment.wrapText':'自动换行',fill:'填充颜色',merge:'合并单元格',numFmt:'数字格式',width:'列宽',height:'行高',value:'计算结果',formula:'函数使用'};
const words={center:'居中',centerContinuous:'跨列居中',left:'左对齐',right:'右对齐',middle:'垂直居中',top:'顶端对齐',bottom:'底端对齐',solid:'纯色填充',image:'图片填充',pattern:'图案填充',none:'无',col:'柱形图',bar:'条形图',line:'折线图',clustered:'簇状',auto:'自动播放',click:'单击时播放',withEffect:'与上一动画同时',afterEffect:'上一动画之后',clickEffect:'单击时开始'};
const colors={'FF0000':'红色','00FF00':'绿色','008000':'绿色','000000':'黑色','FFFFFF':'白色','00B0F0':'浅蓝色','FFFF00':'黄色','92D050':'浅绿色','FFC7CE':'浅红色','9C0006':'深红色'};
export function readableValue(value,property='') {
 if(value===null || value===undefined)return property==='formula'?'未使用公式':'未设置';
 if(typeof value==='boolean')return value?'开启':'关闭';
 if(typeof value==='number')return String(Number(value.toFixed(4)));
 if(typeof value==='string'){
  if(/[a-f0-9]{64}/i.test(value))return '题目指定的图片或媒体';
  if(property==='formula'){const names=[...new Set([...value.matchAll(/([A-Z][A-Z0-9.]*)\(/gi)].map(m=>m[1].toUpperCase()))];return names.length?'使用 '+names.join('、')+' 函数':'使用计算公式';}
  return words[value] || colors[value.replace(/^#/,'').replace(/^FF(?=[a-f0-9]{6}$)/i,'').toUpperCase()] || value;
 }
 if(Array.isArray(value))return [...new Set(value.map(v=>readableValue(v,property)))].join('、');
 if(value.argb)return colors[value.argb.slice(-6).toUpperCase()] || '题目指定的颜色';
 if(value.fgColor || value.bgColor)return readableValue(value.fgColor || value.bgColor,property);
 if(value.type==='pattern')return readableValue(value.fgColor || value.bgColor,'fill');
 if(value.style)return ({thin:'细实线',medium:'中实线',thick:'粗实线',dashed:'虚线'})[value.style] || '题目指定的边框';
 if(value.theme!=null || value.indexed!=null)return '题目指定的颜色';
 return '按题目要求设置';
}
function safeText(text){text=typeof text==='string'?text.split(/[；;]/).filter(part=>!/(位置|大小|坐标|x=|y=|cx=|cy=|效果ID|类别：)/.test(part)).join('；'):text;return typeof text==='string' && !/[{}\[\]]|[a-f0-9]{64}|presetId|sortState/i.test(text)?text.replace(/要求：/g,'').replace(/；独立尺寸项.*|；可选参数.*/g,'').trim():'';}
function propertyName(property){return property?.startsWith('border.')?'边框':properties[property] || property || '设置';}
function parseSummary(summary){try{return JSON.parse(summary.replace(/^要求：/,'').split('；可选参数')[0]);}catch(error){return undefined;}}
export function presentGradeItem(item){
 const children=item.details || [];
 const sample=children[0] || item;
 const sheet=item.sheet || sample.sheet;
 const location=sheet ? '工作表「'+sheet+'」'+(item.address ? ' · '+item.address : '') : item.slideNumber ? '第 '+item.slideNumber+' 张幻灯片' : '演示文稿';
 let title=item.title || propertyName(item.property);
 if(sheet) title=title.replace(sheet,'').trim();
 title=title.replace(/sheet\.exists/g,'工作表是否存在').replace(/sheet\.previous/g,'工作表顺序').replace(/conditionalFormatting/g,'条件格式').replace(/\bsort\b/g,'数据排序').replace(/\bfilter\b/g,'数据筛选').replace(/\bfontSize\b/g,'字号').replace(/\bfontFamily\b/g,'字体').replace(/\bbold\b/g,'加粗').replace(/\bitalic\b/g,'斜体').replace(/\bcolor\b/g,'文字颜色').replace(/\balignments\b/g,'对齐方式').replace(/\bvalue\b/g,'计算结果').replace(/\bformula\b/g,'函数使用');
 for(const [key,label] of Object.entries(properties))title=title.split(key).join(label);
 title=title.replace(/border\.(?:top|bottom|left|right|all)/g,'边框');
 if(item.property && (!item.title || item.type==='cell'))title=(item.address?item.address+' · ':'')+propertyName(item.property);
 let requirement='',actual='',hint='请对照题目，检查这一项操作。';
 if(sheet && item.requireFormulaAndResult){const formula=children.find(c=>c.property==='formula');requirement=formula?readableValue(formula.expected,'formula')+'，并确保计算结果正确。':'使用函数计算，并确保结果正确。';hint='检查公式引用范围和计算条件，修改后填充到需要的单元格。';}
 else if(sheet && item.type==='sort'){const attrs=item.expected?.attrs || {},condition=item.expected?.children?.find(c=>c.name==='sortCondition')?.attrs || {};requirement='将 '+(attrs.ref || '数据区域')+' 按 '+(condition.ref?.match(/[A-Z]+/i)?.[0] || '指定')+' 列'+(['1','true'].includes(String(condition.descending))?'降序（从大到小）':'升序（从小到大）')+'排序';hint='选中完整数据区域，核对排序列和升降序。';}
 else if(sheet && item.type==='conditionalFormatting'){const formats=item.expected || [];requirement=formats.map(cf=>cf.ref+'：'+(cf.rules || []).map(r=>({lessThan:'小于',greaterThan:'大于',equal:'等于',lessThanOrEqual:'小于或等于',greaterThanOrEqual:'大于或等于',between:'介于',notBetween:'不介于',notEqual:'不等于'})[r.operator]?( {lessThan:'小于',greaterThan:'大于',equal:'等于',lessThanOrEqual:'小于或等于',greaterThanOrEqual:'大于或等于',between:'介于',notBetween:'不介于',notEqual:'不等于'}[r.operator]+' '+(r.formulae || []).join('、')+'；'+(r.style?.fill?'填充'+readableValue(r.style.fill)+'，':'')+(r.style?.font?.color?'文字'+readableValue(r.style.font.color):'')):'按题目设置规则').join('；')).join('；');hint='在“条件格式”中核对应用区域、条件数值、填充色和文字颜色。';}
 else if(sheet && sample.property){requirement=propertyName(sample.property)+'：'+readableValue(sample.expected,sample.property);if(item.actual!==undefined || item.type==='cell')actual=readableValue(item.actual,item.property);hint=sample.property==='formula'?'请使用题目要求的函数，不能只输入答案。':sample.property==='value'?'检查计算公式及引用的单元格。':'选中要求的区域，重新设置'+propertyName(sample.property)+'。';}
 else {requirement=safeText(item.summary);const parsed=parseSummary(item.summary || '');if(parsed!==undefined && !/animation|picture/i.test(item.type || ''))requirement=readableValue(parsed);}
 if(item.type==='chart'){title=({type:'图表类型',direction:'图表方向',grouping:'图表样式',title:'图表标题',sources:'图表数据区域'})[item.property] || '图表设置';requirement=item.property==='type' && item.expected==='bar'?'柱形图或条形图（方向见图表方向要求）':readableValue(item.expected,item.property);hint='选中图表，检查'+title+'。';}
 if(item.type==='sheet.exists'){title=item.expected?'保留或添加工作表':'删除工作表';requirement=item.expected?'应存在工作表「'+sheet+'」':'删除工作表「'+sheet+'」';hint=requirement+'。';}
 if(item.type==='sheet.previous'){title='工作表顺序';requirement=item.expected?'将「'+sheet+'」移到「'+item.expected+'」后面':'将「'+sheet+'」移到第一个位置';hint='拖动工作表标签，'+requirement+'。';}
 if(['picture','backgroundImage'].includes(item.type))requirement=requirement || '使用题目指定的图片';
 if(item.slideNumber)title=title.replace(/^第\d+张/, '').trim();
 if(/animation/i.test(item.type || ''))hint='选中对应图片或文字，在“动画”中检查'+(/方向/.test(title)?'效果选项和方向':/声音/.test(title)?'效果选项中的声音':/开始/.test(title)?'开始方式':'动画效果')+'。';
 else if(/transition/i.test(item.type || ''))hint='选中对应幻灯片，在“切换”中检查'+(/声音/.test(title)?'声音设置':'切换效果及效果选项')+'。';
 else if(/background/i.test(item.type || ''))hint='打开该页“设置背景格式”，检查'+(/图片/.test(title)?'背景图片':/透明度/.test(title)?'透明度':/隐藏/.test(title)?'隐藏背景图形选项':'背景填充设置')+'。';
 else if(/masterPicture/i.test(item.type || '')){title=title.replace(/“[^”]+”/g,'');requirement=requirement || '在幻灯片母版中插入题目指定的图片';hint='进入“视图 → 幻灯片母版”，检查图片及应用到的幻灯片。';}
 else if(/media/i.test(item.type || ''))hint='选中音视频，在“播放”中检查播放方式及循环设置，并确认插入的文件正确。';
 else if(item.type==='slideLayout')hint='选中该页，打开“版式”，选择题目要求的版式。';
 else if(item.type==='hyperlink')hint='选中对应文字、图片或按钮，检查超链接的目标。';
 else if(item.type==='objectOrder')hint='选中对应对象，在“排列”中调整叠放次序。';
 else if(item.type==='objectDeleted')hint='找到题目要求删除的对象并删除。';
 const checks=item.checkedCount ?? children.length,done=item.passedCount ?? children.filter(c=>c.passed).length;
 const progress=checks ? (item.requireFormulaAndResult ? checks+' 个单元格中，'+done+' 个已完成，'+(checks-done)+' 个需修改' : done+' / '+checks+' 项要求已完成') : '';
 const note=/未找到|已应用到|公式计算未通过|循环引用|除数为零/.test(item.message || '')?safeText(item.message):'';
 return {title,location,requirement,actual,hint,progress,note};
}
