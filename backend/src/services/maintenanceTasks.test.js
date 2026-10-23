const test = require('node:test');
const assert = require('node:assert/strict');
const { createTaskStore, runController } = require('./maintenanceTasks');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('preview and cleanup accept detached JSON snapshots without structuredClone on Node 16', async () => {
  const fs = require('fs');
  const vm = require('vm');
  let invalidations = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./maintenanceTasks'), 'utf8'), {
    module, exports: module.exports, setImmediate, structuredClone: undefined,
    require: name => {
      if (name === 'crypto') return require('crypto');
      if (name === '../controllers/settingController') return { invalidateStats: () => { invalidations++; } };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  });
  const { taskHandler, getTask } = module.exports;
  const response = () => ({ code: 200, status(code) { this.code = code; return this; },
    set() {}, json(body) { this.body = body; return this; } });
  for (const kind of ['preview-cleanup', 'cleanup-files']) {
    const req = { user: { id: 'admin' }, body: { classes: ['class-one'], filters: { archived: true } } };
    const res = response();
    taskHandler(kind, (snapshot, result) => {
      assert.equal(snapshot.body.classes[0], 'class-one');
      assert.equal(snapshot.body.filters.archived, true);
      result.json({ success: true });
    })(req, res);
    assert.equal(res.code, 202);
    req.body.classes[0] = 'changed';
    req.body.filters.archived = false;
    await tick();
    const status = response();
    getTask({ user: req.user, params: { taskId: res.body.taskId } }, status);
    assert.equal(status.body.status, 'completed');
    assert.equal(status.body.result.success, true);
  }
  assert.equal(invalidations, 1);
});

test('returns immediately, isolates owners, and retains completed results', async () => {
  const store = createTaskStore();
  let finish;
  const job = store.start('admin', 'cleanup', () => new Promise(resolve => { finish = resolve; }));
  assert.equal(job.status, 'running');
  assert.equal(store.get(job.id, 'teacher'), null);
  await tick();
  finish({ deletedCount: 2 });
  await tick();
  assert.equal(store.get(job.id, 'admin').status, 'completed');
  assert.deepEqual(job.result, { deletedCount: 2 });
});

test('rejects duplicate and excess tasks and reports failures', async () => {
  const store = createTaskStore({ limit: 1 });
  const job = store.start('admin', 'cleanup', async () => { throw new Error('disk error'); });
  assert.throws(() => store.start('admin', 'cleanup', async () => {}), { status: 429 });
  assert.throws(() => store.start('other', 'preview', async () => {}), { status: 429 });
  await tick();
  assert.equal(job.status, 'failed');
  assert.equal(job.error, 'disk error');
  assert.doesNotThrow(() => store.start('other', 'preview', async () => {}));
  await tick();
});

test('expires results without expiring running tasks', async () => {
  let clock = 100;
  const store = createTaskStore({ ttl: 10, now: () => clock });
  const complete = store.start('admin', 'preview', async () => 1);
  const running = store.start('admin', 'cleanup', () => new Promise(() => {}));
  await tick();
  clock = 111;
  assert.equal(store.get(complete.id, 'admin'), null);
  assert.equal(store.get(running.id, 'admin').status, 'running');
});

test('controller adapter preserves success and rejects error responses and throws', async () => {
  assert.deepEqual(await runController((req, res) => res.json({ success: true }), {}), { success: true });
  await assert.rejects(runController((req, res) => res.status(400).json({ message: 'invalid filters' }), {}), /invalid filters/);
  await assert.rejects(runController(async () => { throw new Error('database error'); }, {}), /database error/);
});
