const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getRemainingTime, updateRemainingTime } = require('../controllers/gameController');

// 需要认证
router.get('/time', auth, getRemainingTime);
router.put('/time', auth, updateRemainingTime);

module.exports = router;








