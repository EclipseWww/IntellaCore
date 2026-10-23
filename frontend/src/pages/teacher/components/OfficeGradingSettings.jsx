import React, { useState } from 'react';
import { Button, Card, Col, Collapse, Divider, Empty, InputNumber, Row, Space, Switch, Table, Tag, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

function requirement(rule) {
  if (rule.expected?.property === 'imageHash') return '使用参考答案中的背景图片';
  return (rule.summary || '—')
    .replace(/，(\d+) 个单元格／\d+ 项检查/g, '，$1 个单元格')
    .replace(/；独立尺寸项，题目要求时启用/g, '')
    .replace(/；可选参数，请按题目要求启用/g, '')
    .replace(/；每格须使用对应函数且计算结果正确；手填数字不得分/g, '；使用对应函数，计算结果正确');
}

export default function OfficeGradingSettings({ settings, groups, accept, busy, requireOriginal = false, onUpload, onDownload, onEnabledChange, onRegenerate, onSave, onRuleChange, onGroupChange, onTypeChange, getTypeLabel }) {
  const [uploading, setUploading] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const rules = settings.rules || [];
  const enabledScore = rules.filter(r=>r.enabled!==false).reduce((sum,r)=>sum+(Number(r.score)||0),0);
  const disabled = busy || uploading !== null || pendingAction !== null;
  const runAction = async (name, action) => {
    setPendingAction(name);
    try { await action(); }
    finally { setPendingAction(null); }
  };
  const columns = [
    { title:'启用', width:64, render:(_,r)=><Switch size="small" checked={r.enabled!==false} disabled={disabled} onChange={enabled=>onRuleChange(r.index,{enabled})} /> },
    { title:'得分点', dataIndex:'title', width:220 },
    { title:'要求', render:(_,r)=><div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:1.6}}>{requirement(r)}</div> },
    { title:'类型', width:90, render:(_,r)=>getTypeLabel(r.type,r) },
    { title:'分值', width:100, render:(_,r)=><InputNumber min={0} max={100} size="small" disabled={disabled} value={r.score} onChange={score=>onRuleChange(r.index,{score:score || 0})} /> }
  ];
  const upload = async (file, role) => {
    setUploading(role);
    try { await onUpload(file,role); }
    catch(e) { message.error(e.response?.data?.message || '上传失败'); }
    finally { setUploading(null); }
    return false;
  };
  return <Card title="自动批阅设置" type="inner" style={{marginBottom:24}} extra={<Space><span>启用</span><Switch size="small" checked={settings.enabled===true} disabled={disabled} onChange={onEnabledChange} /></Space>}>
    <Row gutter={[16,16]}>
      {['original','reference'].map(role=>{
        const file=settings[role==='original'?'originalFile':'referenceFile'];
        return <Col xs={24} sm={12} key={role}><Space direction="vertical" style={{width:'100%'}}>
          <strong>{role==='original'?'原始文件':'参考答案'}</strong>
          <div>{file?<Tag color={role==='original'?'blue':'green'} onClick={onDownload?()=>onDownload(role):undefined} style={{cursor:onDownload?'pointer':'default',whiteSpace:'normal',overflowWrap:'anywhere'}}>{file.originalName || file.filename}</Tag>:<Tag>未上传</Tag>}</div>
          <Upload accept={accept} showUploadList={false} disabled={disabled} beforeUpload={file=>upload(file,role)}><Button icon={<UploadOutlined />} loading={uploading===role} disabled={disabled && uploading!==role}>{role==='original'?'上传原始文件':'上传参考答案'}</Button></Upload>
        </Space></Col>;
      })}
    </Row>
    <Divider orientation="left" orientationMargin={0}>得分点</Divider>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:12}}>
      <span style={{color:'#666'}}>共 {rules.length} 个得分点，启用总分 {Number(enabledScore.toFixed(2))}</span>
      <Space wrap><Button disabled={disabled || !settings.referenceFile || (requireOriginal && !settings.originalFile)} loading={pendingAction==='regenerate'} onClick={()=>runAction('regenerate',onRegenerate)}>重新解析得分点</Button><Button type="primary" disabled={disabled} loading={pendingAction==='save'} onClick={()=>runAction('save',onSave)}>保存配置</Button></Space>
    </div>
    {groups.length ? <Collapse size="small" defaultActiveKey={groups.slice(0,2).map(g=>g.key)}>
      {groups.map(group=><Collapse.Panel key={group.key} header={<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <Space wrap><strong>{group.title}</strong>{group.types?.map(type=><Tag key={type} color={group.items.some(r=>getTypeLabel(r.type,r)===type && r.enabled!==false)?'blue':'default'} style={{cursor:'pointer'}} onClick={e=>{e.stopPropagation();if(!disabled)onTypeChange(group,type);}}>{type}</Tag>)}</Space>
        <Space><Switch size="small" disabled={disabled} checked={group.items.some(r=>r.enabled!==false)} onClick={(checked,e)=>{e.stopPropagation();onGroupChange(group,checked);}} /><span style={{color:'#666'}}>{group.items.filter(r=>r.enabled!==false).length}/{group.items.length} 项</span><Tag color="blue">{Number(group.items.filter(r=>r.enabled!==false).reduce((sum,r)=>sum+(Number(r.score)||0),0).toFixed(2))} 分</Tag></Space>
      </div>}>
        <Table size="small" rowKey={r=>r.id || r.key || r.index} columns={columns} dataSource={group.items} pagination={group.items.length>20?{pageSize:20}:false} scroll={{x:700}} expandable={{rowExpandable:r=>!!r.children?.length,expandedRowRender:r=><Table size="small" rowKey={(c,i)=>c.id || i} dataSource={r.children} pagination={{pageSize:10}} columns={[{title:'单元格／得分点',render:(_,c)=>c.address || c.title},{title:'属性／类型',render:(_,c)=>c.property || getTypeLabel(c.type,c)},{title:'要求',render:(_,c)=>requirement(c)}]} />}} />
      </Collapse.Panel>)}
    </Collapse>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无得分点" />}
  </Card>;
}
