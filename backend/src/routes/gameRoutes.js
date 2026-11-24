const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/gameController');

// 剩余时长
router.get('/time', auth, c.getRemainingTime);
router.put('/time', auth, c.updateRemainingTime);

// 游戏会话：开始 / 心跳 / 关闭
router.post('/session', auth, c.openSession);
router.post('/session/heartbeat', auth, c.heartbeat);
router.delete('/session', auth, c.closeSession);

// 热度榜
router.get('/stats', auth, c.getStats);
router.get('/progress', auth, c.getProgress);
router.put('/disabled', auth, c.setDisabledGames);

// 封面（公开）
router.get('/cover/:gameId', c.cover);

// 游戏文件：以游戏票（Cookie）鉴权，不使用登录令牌
router.get('/play/_alive', c.alive);
router.get('/play/_save', c.loadSave);
router.put('/play/_save', c.writeSave);
router.get('/play/:gameId/*', c.serveGameFile);
router.get('/play/:gameId', (req, res) => res.redirect(`/api/games/play/${encodeURIComponent(req.params.gameId)}/index.html`));

module.exports = router;
