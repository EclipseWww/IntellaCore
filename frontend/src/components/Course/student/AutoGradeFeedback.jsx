import React, { useState } from 'react';
import { Alert, Collapse, Progress, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getAutoGrade, sortGradeResults } from '../../../utils/submissionGrading';
import { presentGradeItem } from '../../../utils/studentGradePresentation';
import './AutoGradeFeedback.css';

const formatScore = value => value == null ? '—' : Number(Number(value).toFixed(2));
const statusOf = item => item.needsReview ? 'review' : item.passed ? 'passed' : 'failed';
const icons = { review: <ClockCircleOutlined />, passed: <CheckCircleOutlined />, failed: <CloseCircleOutlined /> };

function ResultItem({ item, scale = 1, compact = false, detail = false }) {
  const [showPassed,setShowPassed]=useState(false);
  const status=statusOf(item), view=presentGradeItem(item);
  const details=sortGradeResults(item.details || []), incorrect=details.filter(d=>!d.passed);
  const displayed=showPassed ? details : incorrect;
  return <article className={`grade-result-item grade-result-item--${status}${compact ? ' grade-result-item--compact' : ''}${detail ? ' grade-result-item--detail' : ''}`}>
    <div className="grade-result-item__top">
      <div className="grade-result-item__title"><span className="grade-result-item__icon">{icons[status]}</span><span>{view.title}</span></div>
      {!detail && <div className="grade-result-item__score"><strong>{formatScore(Number(item.score || 0)*scale)}</strong><span> / {formatScore(Number(item.maxScore || 0)*scale)} 分</span></div>}
    </div>
    {!detail && <div className="grade-result-item__location">{view.location}</div>}
    {status!=='passed' && <>
      {view.requirement && <div className="grade-result-item__instruction"><span>要求</span><div>{view.requirement}</div></div>}
      {view.actual && <div className="grade-result-item__instruction"><span>当前</span><div>{view.actual}</div></div>}
      {view.note && <div className="grade-result-item__requirement">{view.note}</div>}
      <div className="grade-result-item__advice">{status==='review' ? '此项结果待教师确认。' : view.hint}</div>
      {view.progress && <div className="grade-result-item__requirement">{view.progress}</div>}
    </>}
    {details.length > 0 && status!=='passed' && <Collapse ghost size="small" className="grade-result-item__details" items={[{
      key:'details',label: `查看需要修改的内容（${incorrect.length}项）`,
      children:<div className="grade-result-list">
        {displayed.map((child,index)=><ResultItem key={child.id || index} item={child} compact detail />)}
        {details.length>incorrect.length && <button type="button" className="grade-result-item__toggle" onClick={()=>setShowPassed(value=>!value)}>{showPassed?'仅看需要修改的内容':'同时查看已完成的内容'}</button>}
      </div>
    }]} />}
  </article>;
}

export default function AutoGradeFeedback({ submission }) {
  const result = getAutoGrade(submission, 'pptAutoGrade') || getAutoGrade(submission, 'excelAutoGrade');
  if (!result) return null;
  const items = sortGradeResults(result.results);
  const failed = items.filter(item => !item.passed && !item.needsReview);
  const review = items.filter(item => item.needsReview);
  const passed = items.filter(item => item.passed && !item.needsReview);
  const hasReview = review.length > 0;
  const weightTotal=items.reduce((sum,item)=>sum+Number(item.maxScore || 0),0);
  const scale=weightTotal>0?10/weightTotal:1;
  const manual = submission.grade?.source === 'manual' || submission.gradeSource === 'manual';
  return <section className="student-grade-feedback" aria-label="作业得分详情">
    <header className="student-grade-feedback__summary">
      <div className="student-grade-feedback__overview">
        <div className="student-grade-feedback__eyebrow">{manual ? '自动评阅记录' : '作业评阅结果'}<Tag color="blue">自动评阅</Tag></div>
        <div className="student-grade-feedback__number"><strong>{formatScore(result.score)}</strong><span>/ 10 分</span>{hasReview && <Tag color="orange">暂计</Tag>}</div>
        <p>{manual ? '最终成绩以教师评分为准' : hasReview ? '部分结果需要教师确认' : !items.length ? '暂无逐项评阅记录' : failed.length ? `先修改下方 ${failed.length} 个未通过的得分点` : '所有得分点均已通过'}</p>
      </div>
      <div className="student-grade-feedback__completion">
        <div className="student-grade-feedback__counts"><span><strong>{failed.length}</strong> 未通过</span>{review.length > 0 && <span><strong>{review.length}</strong> 需复核</span>}<span><strong>{passed.length}</strong> 已通过</span></div>
        <Progress percent={items.length ? Math.round(passed.length / items.length * 100) : 0} showInfo={false} strokeColor="#34a77c" trailColor="#e5ebf2" />
        <span className="student-grade-feedback__progress-label">已通过 {passed.length} / {items.length} 个得分点</span>
      </div>
    </header>
    {hasReview && <Alert type="warning" showIcon message="部分检查需教师复核，暂计分数不替代现有正式成绩。" />}
    <div className="student-grade-feedback__results">
      {failed.length > 0 && <div className="grade-result-group"><h4>优先修改 <span>{failed.length} 项</span></h4><div className="grade-result-list">{failed.map((item,index)=><ResultItem key={item.id || index} item={item} scale={scale} />)}</div></div>}
      {review.length > 0 && <div className="grade-result-group"><h4>待教师复核 <span>{review.length} 项</span></h4><div className="grade-result-list">{review.map((item,index)=><ResultItem key={item.id || index} item={item} />)}</div></div>}
      {passed.length > 0 && <Collapse ghost className="grade-result-group grade-result-group--passed" items={[{key:"passed",label:`已完成的内容（${passed.length}项）`,children:<div className="grade-result-list">{passed.map((item,index)=><ResultItem key={item.id || index} item={item} scale={scale} compact />)}</div>}]} />}
    </div>
  </section>;
}
