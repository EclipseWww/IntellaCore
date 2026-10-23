const express = require('express');
const router = express.Router();
const crowdfundingController = require('../controllers/crowdfundingController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// 众筹活动相关路由

// 获取众筹活动列表 - 所有已登录用户可访问
router.get('/list', auth, crowdfundingController.getCrowdfundingList);

// 获取众筹活动详情 - 所有已登录用户可访问
router.get('/:id', auth, crowdfundingController.getCrowdfundingDetail);

// 参与众筹活动 - 学生用户可访问
router.post('/:id/contribute', auth, crowdfundingController.contributeToCrowdfunding);

// 获取我参与的众筹活动 - 学生用户可访问
router.get('/my/participations', auth, crowdfundingController.getMyParticipations);

// 管理员和教师路由 - 只有管理员和教师可访问
// 创建众筹活动
router.post('/create', auth, roleCheck(['admin', 'teacher']), crowdfundingController.createCrowdfunding);

// 批量创建众筹活动
router.post('/batch-create', auth, roleCheck(['admin', 'teacher']), crowdfundingController.batchCreateCrowdfunding);

// 更新众筹活动
router.put('/:id', auth, roleCheck(['admin', 'teacher']), crowdfundingController.updateCrowdfunding);

// 激活众筹活动
router.put('/:id/activate', auth, roleCheck(['admin', 'teacher']), crowdfundingController.activateCrowdfunding);

// 完成众筹活动并发放奖励
router.put('/:id/complete', auth, roleCheck(['admin', 'teacher']), crowdfundingController.completeCrowdfunding);

// 删除众筹活动
router.delete('/:id', auth, roleCheck(['admin', 'teacher']), crowdfundingController.deleteCrowdfunding);

// 获取众筹活动贡献记录 - 管理员和教师可访问
router.get('/:id/contributions', auth, roleCheck(['admin', 'teacher']), crowdfundingController.getCrowdfundingContributions);

// 删除众筹贡献记录 - 管理员和教师可访问
router.delete('/contribution/:id', auth, roleCheck(['admin', 'teacher']), crowdfundingController.deleteCrowdfundingContribution);

module.exports = router; 