// 选择题（单选 / 判断 / 多选）答案的统一判分与读取

const toIdList = (raw) => {
  const list = Array.isArray(raw) ? raw : (raw != null && raw !== '' ? [raw] : []);
  return list.map(v => String(v));
};

/**
 * 根据题目判分。raw 可以是单个选项 ID 或选项 ID 数组。
 * 只保留属于该题的选项 ID，未作答返回 null。
 * 多选题要求所选集合与正确选项集合完全一致才算对。
 */
const gradeChoiceAnswer = (question, raw) => {
  const options = question?.options || [];
  const validIds = new Set(options.map(opt => String(opt._id)));
  const ids = [...new Set(toIdList(raw))].filter(id => validIds.has(id));
  if (ids.length === 0) return null;

  const correctIds = options.filter(opt => opt.isCorrect).map(opt => String(opt._id));

  if (question.type === 'MULTIPLE_CHOICE') {
    const isCorrect = correctIds.length > 0 &&
      ids.length === correctIds.length &&
      ids.every(id => correctIds.includes(id));
    return { selectedOption: ids[0], selectedOptions: ids, isCorrect };
  }

  return { selectedOption: ids[0], selectedOptions: undefined, isCorrect: correctIds.includes(ids[0]) };
};

/** 读取已保存答案选中的全部选项 ID（兼容只有 selectedOption 的旧记录） */
const getSelectedOptionIds = (answer) => {
  if (!answer) return [];
  if (Array.isArray(answer.selectedOptions) && answer.selectedOptions.length > 0) {
    return answer.selectedOptions.map(id => String(id));
  }
  return answer.selectedOption ? [String(answer.selectedOption)] : [];
};

module.exports = { gradeChoiceAnswer, getSelectedOptionIds };
