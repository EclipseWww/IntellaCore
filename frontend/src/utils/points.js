// 积分统一保留两位小数显示，去掉浮点尾数（如 0.02999999999999936 → 0.03）
export const formatPoints = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
};
