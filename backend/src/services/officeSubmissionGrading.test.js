const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const AssignmentSubmission=require('../models/AssignmentSubmission');
const PointsManager=require('../utils/pointsManager');
const ppt=require('./pptAutoGradeService'),excel=require('./excelAutoGradeService');
let result;
const originals=[ppt.gradePptSubmission,excel.gradeExcelSubmission];
ppt.gradePptSubmission=excel.gradeExcelSubmission=async()=>result;
const {runOfficeAutoGrade}=require('./officeSubmissionGrading');
[ppt.gradePptSubmission,excel.gradeExcelSubmission]=originals;
const copy=value=>JSON.parse(JSON.stringify(value));
async function fixture(operation){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'office-auto-'));
 const originalUpdate=AssignmentSubmission.findOneAndUpdate,originalPoints=PointsManager.reconcileAssignmentPoints,originalFind=AssignmentSubmission.findById;
 const points=[];
 try{
  const file=path.join(dir,'student.xlsx'),reference=path.join(dir,'reference.xlsx');await fs.writeFile(file,'fixture');await fs.writeFile(reference,'fixture');
  const submission={_id:'work',student:'student',content:{file:{filename:'student.xlsx',path:file}},status:'submitted'};
  let stored=copy(submission);
  AssignmentSubmission.findOneAndUpdate=async(filter,update)=>{
   if(filter['content.file.filename']!==stored.content.file.filename || (filter['grade.gradedAt'] && new Date(filter['grade.gradedAt']).getTime()!==new Date(stored.grade?.gradedAt).getTime()))return null;
   Object.assign(stored,update.$set);return copy(stored);
  };
  AssignmentSubmission.findById=async()=>copy(stored);
  PointsManager.reconcileAssignmentPoints=async(...args)=>points.push(args);
  result={score:4.44,rawScore:4,maxScore:9,feedback:'评阅完成',passedCount:4,totalRules:9,results:[{title:'测试',score:1,maxScore:1,passed:true}],gradedAt:new Date()};
  const activity={pptGradingSettings:{enabled:true,referenceFile:{path:reference}},excelGradingSettings:{enabled:true,referenceFile:{path:reference}}};
  await operation({submission,activity,points,getStored:()=>stored,setStored:value=>{stored=value;}});
 }finally{AssignmentSubmission.findOneAndUpdate=originalUpdate;AssignmentSubmission.findById=originalFind;PointsManager.reconcileAssignmentPoints=originalPoints;await fs.rm(dir,{recursive:true,force:true});}
}
test('PPT and Excel save complete reports, automatic provenance and decimal points',()=>fixture(async({submission,activity,points})=>{
 for(const kind of ['ppt','excel']){
  const graded=await runOfficeAutoGrade(submission,activity,kind);
  assert.equal(graded.submission.grade.source,kind+'_auto');assert.equal(graded.submission.grade.score,4.44);assert.equal(graded.submission[kind+'AutoGrade'].results.length,1);
  assert.equal(points.at(-1)[1],44.4);assert.equal(points.at(-1)[2],'work');
  submission.grade=graded.submission.grade;
 }
}));
test('Excel review-required results are saved without a formal grade or new award',()=>fixture(async({submission,activity,points})=>{
 result.results[0].needsReview=true;
 const graded=await runOfficeAutoGrade(submission,activity,'excel');assert.equal(graded.requiresReview,true);assert.equal(graded.submission.grade,undefined);assert.equal(graded.submission.status,'submitted');
 assert.ok(points.every(args=>args[5]===true));
}));
test('a newer upload or manual grade blocks stale results and points',()=>fixture(async({submission,activity,points,setStored})=>{
 setStored({...submission,content:{file:{filename:'new.xlsx'}}});
 await assert.rejects(runOfficeAutoGrade(submission,activity,'excel'),/已更新/);assert.ok(points.every(args=>args[5]===true));
 setStored({...submission,grade:{score:10,source:'manual',gradedAt:new Date()}});
 AssignmentSubmission.findOneAndUpdate=async()=>null;
 await assert.rejects(runOfficeAutoGrade(submission,activity,'ppt'),/已更新/);assert.ok(points.every(args=>args[5]===true));
}));
