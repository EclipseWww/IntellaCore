/**
 * 可运行脚本配置
 * 定义管理员可以通过系统管理界面运行的脚本
 * 
 * 注意：脚本文件应放在同一目录下 (backend/src/scripts/)
 */

module.exports = [
    {
        id: 'fix-duplicate-activity-ids',
        name: '修复重复活动ID',
        description: '修复由于课时导入导致的重复活动ID问题，同时更新关联的提交记录',
        file: 'fixDuplicateActivityIds.js',
        dangerous: true,
        requiresConfirmation: true
    },
    {
        id: 'clean-orphaned-submissions',
        name: '清理孤立提交',
        description: '清理没有关联课时或活动的孤立提交记录',
        file: 'cleanOrphanedSubmissions.js',
        dangerous: true,
        requiresConfirmation: true
    },
    {
        id: 'clean-typing-records',
        name: '清理打字记录',
        description: '清理过期或异常的打字练习记录',
        file: 'cleanTypingRecords.js',
        dangerous: true,
        requiresConfirmation: true
    },
    {
        id: 'fix-negative-durations',
        name: '修复测验异常时间记录',
        description: '修复因前端时间错误导致的负数用时以及开始时间被篡改到未来的异常记录。脚本会根据创建时间恢复正确的开始时间。',
        file: 'fixNegativeDurations.js',
        dangerous: true,
        requiresConfirmation: true
    }
];
