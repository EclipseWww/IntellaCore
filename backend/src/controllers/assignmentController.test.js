const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const ExcelJS=require('exceljs');
const Assignment=require('../models/AssignmentSubmission');
const Lesson=require('../models/Lesson');
const Points=require('../utils/pointsManager');
const logger=require('../utils/logger');
const controller=require('./assignmentController');
const clone=value=>structuredClone(value);
const ids={courseId:'111111111111111111111111',unitId:'222222222222222222222222',lessonId:'333333333333333333333333',activityId:'444444444444444444444444'};
async function scenario(operation){
 const dir=await fs.mkdtemp(path.join(__dirname,'../../uploads/assignments/auto-test-'));
 const originals={findOne:Assignment.findOne,findById:Assignment.findById,create:Assignment.create,update:Assignment.findOneAndUpdate,lesson:Lesson.findById,points:Points.reconcileAssignmentPoints};
 const logs={};for(const key of ['info','warn','error','debug']){logs[key]=logger[key];logger[key]=()=>{};}
 let stored=null,balance=0;const awards=new Map();
 const activity={excelGradingSettings:{enabled:true,referenceFile:{path:path.join(dir,'reference.xlsx')},rules:[{id:'value',type:'cell',sheet:'统计表',address:'A1',property:'value',expected:10,score:1,enabled:true}]}};
 const makeFile=async(name,value)=>{const wb=new ExcelJS.Workbook();wb.addWorksheet('统计表').getCell('A1').value=value;const filePath=path.join(dir,name);await wb.xlsx.writeFile(filePath);return {path:filePath,filename:name,originalname:name,mimetype:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size:100};};
 try{
  await makeFile('reference.xlsx',10);
  Lesson.findById=async()=>({course:ids.courseId,unit:ids.unitId,activities:{id:()=>activity}});
  Assignment.findOne=Assignment.findById=async()=>stored?clone(stored):null;
  Assignment.create=async value=>{stored={...clone(value),_id:'555555555555555555555555',submittedAt:new Date()};return clone(stored);};
  Assignment.findOneAndUpdate=async(filter,update)=>{
    if(!stored || (filter['content.file.filename']!=null && filter['content.file.filename']!==stored.content.file.filename) || (new Date(filter['grade.gradedAt'] ?? 0).getTime()!==new Date(stored.grade?.gradedAt ?? 0).getTime()))return null;
    for(const [key,value]of Object.entries(update.$set||{})){if(key==='content.file')stored.content.file=clone(value);else stored[key]=clone(value);}
    for(const key of Object.keys(update.$unset||{}))delete stored[key];return clone(stored);
  };
  Points.reconcileAssignmentPoints=async(student,target,id,description,legacy,initializeOnly)=>{
    if(initializeOnly && awards.has(id))return;
    const old=awards.get(id)??legacy??0;balance=Number((balance+target-old).toFixed(2));awards.set(id,target);
  };
  const upload=async(name,value)=>{
    const file=await makeFile(name,value);const req={params:ids,user:{_id:'student',id:'student',role:'student'},file};
    const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await controller.submitAssignment(req,res);return {res,file};
  };
  const manual=async score=>{const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await controller.gradeSubmission({params:{submissionId:stored._id},user:{_id:'teacher',id:'teacher',role:'teacher'},body:{grade:{score,feedback:'教师评分'}}},res);return res;};
  await operation({upload,manual,stored:()=>stored,balance:()=>balance});
 }finally{Assignment.findOne=originals.findOne;Assignment.findById=originals.findById;Assignment.create=originals.create;Assignment.findOneAndUpdate=originals.update;Lesson.findById=originals.lesson;Points.reconcileAssignmentPoints=originals.points;for(const [key,value]of Object.entries(logs))logger[key]=value;await fs.rm(dir,{recursive:true,force:true});}
}
test('student upload grades immediately; replacement resets old results and reconciles points',()=>scenario(async({upload,stored,balance})=>{
 const first=await upload('first.xlsx',10);assert.equal(first.res.code,200);assert.equal(first.res.body.submission.grade.source,'excel_auto');assert.equal(first.res.body.submission.grade.score,10);assert.equal(balance(),100);
 const second=await upload('second.xlsx',5);assert.equal(second.res.code,200);assert.equal(stored().grade.score,0);assert.equal(stored().excelAutoGrade.results[0].passed,false);assert.equal(balance(),0);await assert.rejects(fs.access(first.file.path));
 const third=await upload('third.xlsx',10);assert.equal(third.res.code,200);assert.equal(balance(),100);assert.equal(stored().grade.score,10);
}));
test('manual grade blocks overwriting while preserving file, feedback and awarded points',()=>scenario(async({upload,manual,stored,balance})=>{
 await upload('automatic.xlsx',10);const grade=await manual(8);assert.equal(grade.code,200);assert.equal(stored().grade.source,'manual');assert.equal(balance(),80);
 const original=stored().content.file.path;const rejected=await upload('blocked.xlsx',5);assert.equal(rejected.res.code,403);assert.equal(stored().content.file.path,original);assert.equal(balance(),80);await assert.rejects(fs.access(rejected.file.path));
}));
test('clearing a grade removes stale reports and points, then permits another upload',()=>scenario(async({upload,manual,stored,balance})=>{
 await upload('graded.xlsx',10);const cleared=await manual(null);assert.equal(cleared.code,200);assert.equal(stored().grade,null);assert.equal(stored().excelAutoGrade,null);assert.equal(stored().status,'submitted');assert.equal(balance(),0);
 assert.equal((await upload('after-clear.xlsx',10)).res.code,200);assert.equal(balance(),100);
}));

test('clearing an AI-only score revokes the assignment award too',()=>scenario(async({upload,manual,stored,balance})=>{
 await upload('ai-only.xlsx',10);stored().grade=undefined;stored().aiGrade={score:6,feedback:'AI评语'};
 const cleared=await manual(null);assert.equal(cleared.code,200);assert.equal(stored().status,'submitted');assert.equal(balance(),0);
}));


test('teacher list excludes per-cell reports and history; selected report loads separately',async()=>{
 const User=require('../models/User'),Class=require('../models/Class');
 const original={find:Assignment.find,byId:Assignment.findById,userFind:User.find,classFind:Class.find};
 const student={_id:'student',name:'学生',classId:null};
 const summary={score:8,gradedAt:'2026-10-10',totalRules:20};
 const detail={...summary,results:[{id:'rule',details:Array.from({length:1000},(_,i)=>({address:'A'+i,expected:'格式要求',actual:'学生结果'}))}]};
 const response=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 try{
  Assignment.find=()=>({select(fields){assert.ok(fields.includes('-excelAutoGrade.results'));assert.ok(fields.includes('-pptAutoGrade.results'));assert.ok(fields.includes('-previousVersions'));return this;},populate(){return this;},sort:async()=>[{student,toObject:()=>({_id:'submission',student:{...student},excelAutoGrade:summary})}]});
  User.find=()=>({select:async()=>[]});Class.find=()=>({select:async()=>[]});
  const res=response();await controller.getSubmissionsByTeacher({params:ids,user:{_id:'teacher',role:'teacher'}},res);
  assert.equal(res.code,200);assert.equal(res.body[0].excelAutoGrade.detailsLoaded,false);assert.deepEqual(res.body[0].excelAutoGrade.results,[]);
  assert.ok(JSON.stringify(res.body).length<JSON.stringify(detail).length/50);
  Assignment.findById=()=>({select:async fields=>{assert.equal(fields,'pptAutoGrade excelAutoGrade');return {excelAutoGrade:detail};}});
  const loaded=response();await controller.getOfficeGradingReports({params:{submissionId:'submission'},user:{role:'teacher'}},loaded);assert.equal(loaded.body.data.excelAutoGrade.results[0].details.length,1000);
  const denied=response();await controller.getOfficeGradingReports({params:{submissionId:'submission'},user:{role:'student'}},denied);assert.equal(denied.code,403);
 }finally{Assignment.find=original.find;Assignment.findById=original.byId;User.find=original.userFind;Class.find=original.classFind;}
});
