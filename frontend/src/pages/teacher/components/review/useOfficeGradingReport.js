import { useEffect, useState } from 'react';
import { reviewAPI } from '../../../../services/reviewAPI';
import { getAutoGrade } from '../../../../utils/submissionGrading';

export default function useOfficeGradingReport(submission, key, cache, setResult) {
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;setError('');
  const summary=getAutoGrade(submission,key);
  if(!summary){setResult(null);setLoading(false);return;}
  const saved=cache.current[submission._id];
  if(summary.detailsLoaded!==false){setResult(summary);setLoading(false);return;}
  if(saved && String(saved.gradedAt)===String(summary.gradedAt)){setResult(saved);setLoading(false);return;}
  setResult(null);setLoading(true);
  reviewAPI.getOfficeGradingReports(submission._id).then(response=>{
   if(cancelled)return;
   if(!response.success)throw new Error(response.message || '加载评阅详情失败');
   const report=getAutoGrade(response.data,key);if(report)cache.current[submission._id]=report;
   setResult(report);
  }).catch(error=>{if(!cancelled)setError(error.message || '加载评阅详情失败');})
   .finally(()=>{if(!cancelled)setLoading(false);});
  return ()=>{cancelled=true;};
 },[submission,key,cache,setResult]);
 return {loading,error};
}
