/**
 * 脚本运行控制器
 * 提供列出和运行维护脚本的功能
 */

const { spawn } = require('child_process');
const path = require('path');
const scriptRegistry = require('../scripts/registry');

/**
 * 获取可用脚本列表
 */
exports.listScripts = async (req, res) => {
    try {
        // 检查管理员权限
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以访问此功能'
            });
        }

        res.status(200).json({
            success: true,
            data: scriptRegistry.map(script => ({
                id: script.id,
                name: script.name,
                description: script.description,
                dangerous: script.dangerous,
                requiresConfirmation: script.requiresConfirmation
            }))
        });
    } catch (error) {
        console.error('获取脚本列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取脚本列表失败',
            error: error.message
        });
    }
};

/**
 * 运行指定脚本
 */
exports.runScript = async (req, res) => {
    try {
        // 检查管理员权限
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以运行脚本'
            });
        }

        const { scriptId, confirmed } = req.body;

        // 查找脚本
        const script = scriptRegistry.find(s => s.id === scriptId);
        if (!script) {
            return res.status(404).json({
                success: false,
                message: '脚本不存在'
            });
        }

        // 检查是否需要确认
        if (script.requiresConfirmation && !confirmed) {
            return res.status(400).json({
                success: false,
                message: '此脚本需要确认才能运行',
                requiresConfirmation: true
            });
        }

        // 脚本文件路径 - 脚本在 src/scripts 目录下
        const scriptPath = path.join(__dirname, '../scripts', script.file);

        // 使用 spawn 运行脚本
        const output = [];
        const errors = [];

        const result = await new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath], {
                cwd: path.join(__dirname, '../..'),  // backend 目录
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // 自动发送 'y' 确认
            if (script.requiresConfirmation) {
                setTimeout(() => {
                    child.stdin.write('y\n');
                    child.stdin.end();
                }, 500);
            } else {
                child.stdin.end();
            }

            child.stdout.on('data', (data) => {
                output.push(data.toString());
            });

            child.stderr.on('data', (data) => {
                errors.push(data.toString());
            });

            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    output: output.join(''),
                    errors: errors.join('')
                });
            });

            child.on('error', (error) => {
                reject(error);
            });

            // 设置超时（60秒）
            setTimeout(() => {
                child.kill();
                reject(new Error('脚本执行超时'));
            }, 60000);
        });

        res.status(200).json({
            success: result.exitCode === 0,
            data: {
                exitCode: result.exitCode,
                output: result.output,
                errors: result.errors
            }
        });

    } catch (error) {
        console.error('运行脚本失败:', error);
        res.status(500).json({
            success: false,
            message: '运行脚本失败',
            error: error.message
        });
    }
};
