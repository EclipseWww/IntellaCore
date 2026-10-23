// All point balances and deltas use two decimal places.
function roundPoints(value) {
 const number=Number(value ?? 0);
 if(!Number.isFinite(number))throw new Error('积分必须是有效数字');
 return Number(number.toFixed(2));
}
module.exports={roundPoints};
