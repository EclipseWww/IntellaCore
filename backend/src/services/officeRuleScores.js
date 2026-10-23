// Uniform legacy defaults can be rescaled without changing relative weights.
function normalizeOfficeRuleScores(rules = []) {
  const uniformTen = rules.length > 0 && rules.every(rule => Number(rule.score ?? 1) === 10);
  return rules.map(rule => ({ ...rule, score: uniformTen ? 1 : Number(rule.score ?? 1) }));
}
module.exports = { normalizeOfficeRuleScores };
