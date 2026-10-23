const test=require('node:test');
const assert=require('node:assert/strict');
const Achievement=require('./Achievement');
const {roundPoints}=require('../utils/pointPrecision');
const studentId='111111111111111111111111';
test('atomic transactions round both deltas and balance; concurrent awards keep every transaction',async()=>{
 const original=Achievement.findOneAndUpdate;let balance=99.00000007,transactions=[];
 try{
  Achievement.findOneAndUpdate=async(filter,pipeline,options)=>{
   assert.equal(options.upsert,true);assert.ok(Array.isArray(pipeline));
   const update=pipeline[0].$set;
   assert.deepEqual(update.totalPoints.$round[0].$add[0],{$ifNull:['$totalPoints',0]});assert.equal(update.totalPoints.$round[1],2);
   assert.equal(update.pointTransactions.$slice[1],100);
   await Promise.resolve();
   balance=roundPoints(balance+update.totalPoints.$round[0].$add[1]);
   transactions=[...update.pointTransactions.$slice[0].$concatArrays[0].$literal,...transactions].slice(0,100);
   return {totalPoints:balance};
  };
  await Achievement.addPointTransaction(studentId,0.1000000007,'other','$description');assert.equal(balance,99.1);assert.equal(transactions[0].amount,0.1);assert.equal(transactions[0].description,'$description');
  await Promise.all(Array.from({length:150},()=>Achievement.addPointTransaction(studentId,0.1,'other')));assert.equal(balance,114.1);assert.equal(transactions.length,100);
  await Achievement.addPointTransaction(studentId,-0.10000000007,'other');assert.equal(balance,114);
  await assert.rejects(Achievement.addPointTransaction(studentId,NaN,'other'),/有效数字/);
 }finally{Achievement.findOneAndUpdate=original;}
});
test('legacy tails are cleaned for JSON but raw CAS comparison values stay intact',()=>{
 const model=new Achievement({studentId,totalPoints:123.00000007,pointTransactions:[{amount:0.30000000004,type:'other'}]});
 const json=model.toJSON();assert.equal(json.totalPoints,123);assert.equal(json.pointTransactions[0].amount,0.3);
 assert.equal(model.totalPoints,123.00000007);assert.equal(model.getPointBalance(),123);
 assert.equal(roundPoints(123.89),123.89);
});
