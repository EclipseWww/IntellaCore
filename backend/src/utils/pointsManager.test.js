const test=require('node:test');
const assert=require('node:assert/strict');
const Achievement=require('../models/Achievement');
const PointsManager=require('./pointsManager');
const copy=value=>JSON.parse(JSON.stringify(value));
function ledger(initial){
  let state=copy(initial); let writes=0;
  const original=Achievement.findOneAndUpdate;
  Achievement.findOneAndUpdate=async(filter,update)=>{
    await Promise.resolve();
    if(update.$setOnInsert)return copy(state);
    const tracker=Object.keys(filter).find(key=>key.startsWith('assignmentPoints.'));
    const key=tracker.slice('assignmentPoints.'.length),expected=filter[tracker],actual=state.assignmentPoints?.[key];
    if(state.totalPoints!==filter.totalPoints || state.pointTransactions.length!==filter.pointTransactions.$size || (typeof expected==='object' ? actual!==undefined : actual!==expected))return null;
    state.assignmentPoints={...state.assignmentPoints,[key]:update.$set[tracker]};
    if(update.$set.totalPoints!=null)state.totalPoints=update.$set.totalPoints;
    if(update.$push)state.pointTransactions=[...update.$push.pointTransactions.$each,...state.pointTransactions].slice(0,100);
    writes++;return copy(state);
  };
  return {state:()=>state,writes:()=>writes,restore:()=>{Achievement.findOneAndUpdate=original;}};
}
test('regrade reconciles decimal points, score reduction, clearing and repeat requests',async()=>{
 const db=ledger({_id:'ledger',totalPoints:150,pointTransactions:[{relatedId:'work',type:'task_completion',amount:100}],assignmentPoints:{}});
 try {
  await PointsManager.reconcileAssignmentPoints('student',33.3,'work','自动评分',100);
  assert.equal(db.state().totalPoints,83.3); assert.equal(db.state().assignmentPoints.work,33.3);
  await PointsManager.reconcileAssignmentPoints('student',33.3,'work','重评',100); assert.equal(db.writes(),1);
  await PointsManager.reconcileAssignmentPoints('student',80,'work','重评',33.3);assert.equal(db.state().totalPoints,130);
  await PointsManager.reconcileAssignmentPoints('student',0,'work','重交',80);assert.equal(db.state().totalPoints,50);
  await PointsManager.reconcileAssignmentPoints('student',44.4,'work','新文件');assert.equal(db.state().totalPoints,94.4);
 }finally{db.restore();}
});
test('concurrent identical grading awards points once',async()=>{
 const db=ledger({_id:'ledger',totalPoints:0,pointTransactions:[],assignmentPoints:{}});
 try {await Promise.all([1,2,3].map(()=>PointsManager.reconcileAssignmentPoints('student',88.8,'work','评分')));assert.equal(db.state().totalPoints,88.8);assert.equal(db.writes(),1);}finally{db.restore();}
});
test('per-assignment balance survives history truncation and legacy grades migrate',async()=>{
 const recent=Array.from({length:100},(_,i)=>({relatedId:'other'+i,type:'other',amount:1}));
 const db=ledger({_id:'ledger',totalPoints:160,pointTransactions:recent,assignmentPoints:{work:60}});
 try {
  await PointsManager.reconcileAssignmentPoints('student',33.3,'work','重评',100); assert.equal(db.state().totalPoints,133.3);
  await PointsManager.reconcileAssignmentPoints('student',40,'legacy','旧作业迁移',80);assert.equal(db.state().totalPoints,93.3);assert.equal(db.state().assignmentPoints.legacy,40);
  assert.equal(db.state().pointTransactions.length,100);
 }finally{db.restore();}
});

test('points synchronization follows the latest grade if it changes during award processing',async()=>{
 const Assignment=require('../models/AssignmentSubmission');
 const originalFind=Assignment.findById,originalReconcile=PointsManager.reconcileAssignmentPoints;
 let score=3.33;const targets=[];
 Assignment.findById=async()=>({_id:'work',student:'student',grade:{score}});
 PointsManager.reconcileAssignmentPoints=async(student,target)=>{targets.push(target);if(targets.length===1)score=9;return {totalPoints:target};};
 try{const synced=await PointsManager.syncAssignmentPoints('work');assert.deepEqual(targets,[33.3,90]);assert.equal(synced.totalPoints,90);}finally{Assignment.findById=originalFind;PointsManager.reconcileAssignmentPoints=originalReconcile;}
});


test('unchanged regrade cleans a legacy balance tail without adding a transaction',async()=>{
 const db=ledger({_id:'ledger',totalPoints:150.00000007,pointTransactions:[],assignmentPoints:{work:10}});
 try{
  await PointsManager.reconcileAssignmentPoints('student',10,'work');
  assert.equal(db.state().totalPoints,150);assert.equal(db.state().pointTransactions.length,0);assert.equal(db.state().assignmentPoints.work,10);
 }finally{db.restore();}
});
