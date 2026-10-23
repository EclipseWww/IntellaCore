const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { safeDownloadPath } = require('./safeDownloadPath');
const { redactLog } = require('./redactLog');

test('downloads allow nested files and reject traversal, Windows paths and missing files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'download-boundary-'));
  try {
    const root = path.join(dir, 'uploads'); await fs.mkdir(path.join(root, 'nested'), { recursive: true });
    await fs.writeFile(path.join(root, 'nested', 'test.txt'), 'test');
    assert.equal(await safeDownloadPath(root, 'nested/test.txt'), await fs.realpath(path.join(root, 'nested', 'test.txt')));
    for (const value of ['../outside', '..\\outside', '/etc/passwd', 'C:\\Windows\\test', '\\\\server\\share', 'a\0b']) {
      await assert.rejects(safeDownloadPath(root, value), error => error.status === 403);
    }
    await assert.rejects(safeDownloadPath(root, 'missing'), error => error.code === 'ENOENT');
    // Windows directory junctions need no administrator rights.
    await fs.mkdir(path.join(dir, 'outside')); await fs.writeFile(path.join(dir, 'outside', 'file'), 'private');
    await fs.symlink(path.join(dir, 'outside'), path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(safeDownloadPath(root, 'link/file'), error => error.status === 403);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('log redaction removes nested credentials without changing input', () => {
  const source = { username: 'teacher', body: { password: 'private', newPassword: 'private', Authorization: 'Bearer secret' }, token: 'private' };
  const result = redactLog(source);
  assert.equal(result.body.password, '[REDACTED]'); assert.equal(result.body.Authorization, '[REDACTED]');
  assert.equal(result.token, '[REDACTED]'); assert.equal(result.username, 'teacher'); assert.equal(source.body.password, 'private');
});
