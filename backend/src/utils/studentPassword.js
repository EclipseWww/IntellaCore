const crypto = require('crypto');

/**
 * 学生账号的密码。学生只能在班级上课时登录，并且免密码，密码实际不使用；
 * 但账号要求有密码，没填时随机生成一个。填了则至少 6 位、不超过 72 位。
 * 返回 { password } 或 { error }。
 */
function studentPassword(input) {
  if (input === undefined || input === null || String(input).trim() === '') {
    return { password: crypto.randomBytes(12).toString('hex') };
  }
  const password = String(input);
  if (password.length < 6) return { error: '密码长度至少6位（学生密码可以不填）' };
  if (password.length > 72) return { error: '密码不能超过72位' };
  return { password };
}

module.exports = { studentPassword };
