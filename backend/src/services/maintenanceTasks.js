const { randomUUID } = require('crypto');

// One process serves the Docker deployment. Results expire; interrupted jobs are
// deliberately not replayed after a restart, particularly destructive cleanup.
function createTaskStore({ ttl = 30 * 60 * 1000, limit = 2, now = Date.now } = {}) {
  const jobs = new Map();
  function prune() {
    if (jobs.size > 100) {
      for (const [id, job] of jobs) {
        if (job.finishedAt) jobs.delete(id);
        if (jobs.size <= 100) break;
      }
    }
    for (const [id, job] of jobs) {
      if (job.finishedAt && now() - job.finishedAt > ttl) jobs.delete(id);
    }
  }
  return {
    start(owner, kind, run) {
      prune();
      const active = [...jobs.values()].filter(job => job.status === 'running');
      const existing = active.find(job => job.kind === kind && (kind === 'cleanup-files' || job.owner === owner));
      if (existing) { const error = new Error('同类维护任务正在运行，请等待完成'); error.status = 429; throw error; }
      if (active.length >= limit) {
        const error = new Error('已有维护任务正在运行，请稍后重试');
        error.status = 429;
        throw error;
      }
      const job = { id: randomUUID(), owner, kind, status: 'running', startedAt: now() };
      jobs.set(job.id, job);
      setImmediate(async () => {
        try {
          job.result = await run();
          job.status = 'completed';
        } catch (error) {
          job.status = 'failed';
          job.error = error.message || '维护任务失败';
        } finally { job.finishedAt = now(); }
      });
      return job;
    },
    get(id, owner) {
      prune();
      const job = jobs.get(id);
      return job && job.owner === owner ? job : null;
    }
  };
}
const tasks = createTaskStore();
function runController(controller, req) {
  return new Promise((resolve, reject) => {
    let status = 200;
    const response = {
      status(code) { status = code; return this; },
      json(body) {
        if (status >= 400) reject(new Error(body.message || '维护任务失败'));
        else resolve(body);
        return this;
      }
    };
    Promise.resolve(controller(req, response)).catch(reject);
  });
}
function taskHandler(kind, controller) {
  return (req, res) => {
    try {
      // Express JSON request bodies contain JSON values only. Keep a detached
      // snapshot without requiring structuredClone (unavailable on Node 16).
      const snapshot = { body: JSON.parse(JSON.stringify(req.body || {})), user: { ...req.user } };
      const job = tasks.start(String(req.user.id || req.user._id), kind,
        async () => {
          try { return await runController(controller, snapshot); }
          finally {
            if (kind === 'cleanup-files') require('../controllers/settingController').invalidateStats();
          }
        });
      res.status(202).json({ taskId: job.id, status: job.status });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message });
    }
  };
}
function getTask(req, res) {
  const job = tasks.get(req.params.taskId, String(req.user.id || req.user._id));
  if (!job) return res.status(404).json({ message: '任务已过期或服务已重启，请重新预览检查清理结果' });
  res.set('Cache-Control', 'no-store');
  res.json({ status: job.status, result: job.result, message: job.error });
}
module.exports = { createTaskStore, runController, taskHandler, getTask };
