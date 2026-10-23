/**
 * 随机打乱数组
 * @param {Array} array 要打乱的数组
 * @returns {Array} 打乱后的新数组
 */
export const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}; 