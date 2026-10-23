import React, { useState } from 'react';
import { message } from 'antd';
import { lessonAPI } from '../../../services/api';
import OfficeGradingSettings from './OfficeGradingSettings';

const typeLabel = (type, rule) => {
  if (rule.requireFormulaAndResult) return '函数';
  if (rule.property?.startsWith('font.')) return '字体';
  if (rule.property?.startsWith('alignment.')) return '对齐';
  if (rule.property?.startsWith('border.')) return '边框';
  if (rule.property === 'fill') return '底纹';
  if (rule.property === 'merge') return '合并';
  if (rule.property === 'value') return '数据';
  if (rule.property === 'formula') return '公式';
  if (rule.property === 'width') return '列宽';
  if (rule.property === 'height') return '行高';
  if (type?.startsWith('sheet.')) return '工作表';
  return ({chart:'图表',filter:'筛选',sort:'排序',conditionalFormatting:'条件格式'})[type] || '格式';
};

export default function ExcelGradingSettings({ lessonId, activity, onChange }) {
  const [busy, setBusy] = useState(false);
  const settings = activity?.excelGradingSettings || {};
  const rules = settings.rules || [];
  const run = async action => {
    if (!activity?._id) return message.warning('请先保存活动');
    setBusy(true);
    try { const response = await action(); if (response.success) { onChange(response.data); message.success(response.message || '保存成功'); } }
    catch (e) { message.error(e.response?.data?.error || e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  const upload = (file, fileRole) => run(() => { const form = new FormData(); form.append('file', file); form.append('fileRole', fileRole); return lessonAPI.uploadExcelGradingFile(lessonId, activity._id, form); });
  const patch = (index, value) => onChange({ ...settings, rules: rules.map((r,i) => i === index ? { ...r, ...value } : r) });
  const batch = (items, enabled) => {
    const indexes = new Set(items.map(r=>r.index));
    onChange({...settings,rules:rules.map((r,i)=>indexes.has(i)?{...r,enabled}:r)});
  };
  const groupMap = new Map();
  rules.forEach((rule,index)=>{
    const key=rule.sheet || 'global';
    if(!groupMap.has(key))groupMap.set(key,{key,title:rule.sheet || '工作簿',items:[]});
    groupMap.get(key).items.push({...rule,index});
  });
  const groups=[...groupMap.values()].map(group=>({...group,types:[...new Set(group.items.map(r=>typeLabel(r.type,r)))]}));
  const download = async role => {
    const file=settings[role==='original'?'originalFile':'referenceFile'];
    try {
      const response=await lessonAPI.downloadExcelGradingFile(lessonId,activity._id,role);
      const url=URL.createObjectURL(new Blob([response.data]));
      const link=document.createElement('a');link.href=url;link.download=file.originalName || file.filename;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    } catch(e) {message.error('下载失败');}
  };
  return <OfficeGradingSettings settings={settings} groups={groups} accept=".xlsx" busy={busy} requireOriginal
    onUpload={upload} onDownload={download} onEnabledChange={enabled=>onChange({...settings,enabled})}
    onRegenerate={()=>run(()=>lessonAPI.regenerateExcelGradingRules(lessonId,activity._id))}
    onSave={()=>run(()=>lessonAPI.updateExcelGradingSettings(lessonId,activity._id,settings))}
    onRuleChange={patch} onGroupChange={(group,enabled)=>batch(group.items,enabled)}
    onTypeChange={(group,type)=>{const items=group.items.filter(r=>typeLabel(r.type,r)===type);batch(items,!items.some(r=>r.enabled!==false));}}
    getTypeLabel={typeLabel} />;
}
