/**
 * Python错误消息中文翻译器
 * 将Python/Brython的英文错误消息翻译为中文，并明确指出错误位置
 */

// 错误类型翻译
const errorTypeTranslations = {
    'SyntaxError': '语法错误',
    'IndentationError': '缩进错误',
    'TabError': '制表符错误',
    'NameError': '名称错误',
    'TypeError': '类型错误',
    'ValueError': '值错误',
    'IndexError': '索引错误',
    'KeyError': '键错误',
    'AttributeError': '属性错误',
    'ImportError': '导入错误',
    'ModuleNotFoundError': '模块未找到',
    'ZeroDivisionError': '除零错误',
    'FileNotFoundError': '文件未找到',
    'RuntimeError': '运行时错误',
    'RecursionError': '递归错误',
    'MemoryError': '内存错误',
    'OverflowError': '溢出错误',
    'StopIteration': '迭代停止',
    'AssertionError': '断言错误',
    'UnboundLocalError': '未绑定局部变量',
    'EOFError': '文件结束错误',
    'NotImplementedError': '未实现错误',
    'OSError': '操作系统错误',
    'PermissionError': '权限错误',
    'TimeoutError': '超时错误',
    'UnicodeError': '编码错误',
    'UnicodeDecodeError': 'Unicode解码错误',
    'UnicodeEncodeError': 'Unicode编码错误'
};

// 常见错误消息翻译
const errorMessagePatterns = [
    // 名称错误
    { pattern: /name '(.+)' is not defined/, replacement: (m, name) => `变量 '${name}' 未定义` },
    { pattern: /global name '(.+)' is not defined/, replacement: (m, name) => `全局变量 '${name}' 未定义` },

    // 语法错误 - 提供更详细的提示
    { pattern: /invalid syntax/, replacement: () => '语法无效\n  💡 提示：检查是否有以下问题：\n    • for/if/while/def等语句末尾是否缺少冒号(:)\n    • 括号()、引号""是否匹配\n    • 是否使用了中文标点' },
    { pattern: /unexpected EOF while parsing/, replacement: () => '代码不完整\n  💡 提示：检查括号()、引号""、冒号:是否完整匹配' },
    { pattern: /expected an indented block/, replacement: () => '需要缩进块\n  💡 提示：if/for/while/def/class语句后的代码需要缩进（按Tab或4个空格）' },
    { pattern: /unexpected indent/, replacement: () => '意外的缩进\n  💡 提示：此行不应该有缩进，或缩进与上下文不一致' },
    { pattern: /unindent does not match any outer indentation level/, replacement: () => '缩进不匹配\n  💡 提示：请使用统一的缩进方式（推荐4个空格）' },
    { pattern: /EOL while scanning string literal/, replacement: () => '字符串未正确闭合\n  💡 提示：请检查字符串的引号是否配对' },
    { pattern: /Missing parentheses in call to '(.+)'/, replacement: (m, func) => `调用 '${func}' 时缺少括号\n  💡 提示：Python 3中需要使用 ${func}()` },
    { pattern: /invalid character/, replacement: () => '无效字符\n  💡 提示：请检查是否使用了中文标点符号（如：，。；等）' },
    { pattern: /expected ':'/, replacement: () => '缺少冒号 \":\"\n  💡 提示：if/for/while/def/class语句末尾需要加冒号' },
    { pattern: /can't assign to function call/, replacement: () => '不能给函数调用赋值' },
    { pattern: /can't assign to literal/, replacement: () => '不能给字面值赋值\n  💡 提示：= 左边应该是变量名，不是数字或字符串' },

    // 类型错误
    { pattern: /unsupported operand type\(s\) for (.+): '(.+)' and '(.+)'/, replacement: (m, op, t1, t2) => `运算符 ${op} 不支持类型 '${t1}' 和 '${t2}'` },
    { pattern: /can only concatenate (.+) \(not "(.+)"\) to (.+)/, replacement: (m, t1, t2, t3) => `只能将 ${t1} 与 ${t1} 拼接，不能与 ${t2} 拼接` },
    { pattern: /'(.+)' not supported between instances of '(.+)' and '(.+)'/, replacement: (m, op, t1, t2) => `运算符 '${op}' 不支持 '${t1}' 和 '${t2}' 类型之间的比较\n  💡 提示：如果要比较数字，请确保两边都是数字类型。可以使用 int() 或 float() 转换字符串为数字` },
    { pattern: /'(.+)' object cannot be interpreted as an integer/, replacement: (m, type) => `'${type}' 类型不能作为整数使用\n  💡 提示：range() 的参数必须是整数，请使用 int() 转换。例如：range(int(2.0), 3)` },
    { pattern: /(.+) is not callable/, replacement: (m, type) => `${type} 类型不可调用` },
    { pattern: /(.+) object is not callable/, replacement: (m, type) => `${type} 类型对象不可调用` },
    { pattern: /(.+) object is not iterable/, replacement: (m, type) => `${type} 类型对象不可迭代` },
    { pattern: /(.+) object is not subscriptable/, replacement: (m, type) => `${type} 类型对象不支持索引访问` },
    { pattern: /(.+) takes (.+) positional arguments? but (.+) (?:was|were) given/, replacement: (m, func, expected, got) => `${func} 需要 ${expected} 个参数，但传入了 ${got} 个` },
    { pattern: /missing (\d+) required positional arguments?/, replacement: (m, count) => `缺少 ${count} 个必需参数` },
    { pattern: /argument of type '(.+)' is not iterable/, replacement: (m, type) => `类型 '${type}' 的参数不可迭代` },

    // 值错误
    { pattern: /invalid literal for int\(\) with base (\d+): '(.+)'/, replacement: (m, base, val) => `'${val}' 无法转换为 ${base} 进制整数` },
    { pattern: /could not convert string to float: '(.+)'/, replacement: (m, val) => `无法将字符串 '${val}' 转换为浮点数` },
    { pattern: /list.remove\(x\): x not in list/, replacement: () => '要删除的元素不在列表中' },
    { pattern: /substring not found/, replacement: () => '未找到子字符串' },
    { pattern: /math domain error/, replacement: () => '数学域错误（如负数开平方）' },

    // 索引错误
    { pattern: /list index out of range/, replacement: () => '列表索引超出范围' },
    { pattern: /string index out of range/, replacement: () => '字符串索引超出范围' },
    { pattern: /tuple index out of range/, replacement: () => '元组索引超出范围' },
    { pattern: /index out of range/, replacement: () => '索引超出范围' },

    // 键错误
    { pattern: /KeyError: (.+)/, replacement: (m, key) => `键 ${key} 不存在` },

    // 属性错误
    { pattern: /'(.+)' object has no attribute '(.+)'/, replacement: (m, type, attr) => `'${type}' 类型对象没有属性 '${attr}'` },

    // 导入错误
    { pattern: /No module named '(.+)'/, replacement: (m, mod) => `找不到模块 '${mod}'` },
    { pattern: /cannot import name '(.+)' from '(.+)'/, replacement: (m, name, mod) => `无法从 '${mod}' 导入 '${name}'` },

    // 除零错误
    { pattern: /division by zero/, replacement: () => '不能除以零' },
    { pattern: /integer division or modulo by zero/, replacement: () => '整数除法或取模运算中不能除以零' },

    // 递归错误
    { pattern: /maximum recursion depth exceeded/, replacement: () => '超过最大递归深度（可能是无限递归）' },

    // 文件错误
    { pattern: /\[Errno 2\] No such file or directory: '(.+)'/, replacement: (m, file) => `文件或目录不存在: '${file}'` },

    // Brython 特有错误
    { pattern: /unknown encoding/, replacement: () => '未知编码格式' },
    { pattern: /line (\d+)/, replacement: (m, line) => `第 ${line} 行` }
];

/**
 * 从错误消息中提取行号
 */
function extractLineNumber(errorMessage) {
    // 尝试多种格式
    const patterns = [
        /line (\d+)/i,
        /Line (\d+)/i,
        /:(\d+):/,
        /at line (\d+)/i,
        /第 ?(\d+) ?行/
    ];

    for (const pattern of patterns) {
        const match = errorMessage.match(pattern);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    return null;
}

/**
 * 从错误消息中提取错误类型
 */
function extractErrorType(errorMessage) {
    const match = errorMessage.match(/(\w+Error|\w+Exception)/);
    if (match) {
        return match[1];
    }
    return null;
}

/**
 * 翻译错误消息
 */
function translateErrorMessage(message) {
    for (const { pattern, replacement } of errorMessagePatterns) {
        const match = message.match(pattern);
        if (match) {
            return replacement(...match);
        }
    }
    return message; // 如果没有匹配的模式，返回原消息
}

/**
 * 翻译完整的Python错误
 * @param {string} errorOutput - 原始错误输出
 * @returns {string} - 翻译后的中文错误消息
 */
export function translatePythonError(errorOutput) {
    if (!errorOutput) return '';

    const lines = errorOutput.split('\n');
    const translatedLines = [];

    let lineNumber = extractLineNumber(errorOutput);
    let errorType = extractErrorType(errorOutput);

    // 翻译错误类型
    const translatedType = errorType ? (errorTypeTranslations[errorType] || errorType) : '';

    // 提取并翻译错误消息
    let errorMessage = '';
    for (const line of lines) {
        if (line.includes('Error:') || line.includes('Exception:')) {
            const parts = line.split(/Error:|Exception:/);
            if (parts.length > 1) {
                errorMessage = parts[1].trim();
            }
        }
    }

    const translatedMessage = translateErrorMessage(errorMessage);

    // 构建最终的错误消息
    if (lineNumber && translatedType) {
        translatedLines.push(`第${lineNumber}行：${translatedType}`);
        if (translatedMessage) {
            translatedLines.push(`  原因：${translatedMessage}`);
        }
    } else if (translatedType) {
        translatedLines.push(`${translatedType}`);
        if (translatedMessage) {
            translatedLines.push(`  原因：${translatedMessage}`);
        }
    } else {
        // 如果无法解析，返回原始消息但尝试翻译部分内容
        for (const line of lines) {
            if (line.trim()) {
                let translated = line;
                // 尝试翻译行号
                translated = translated.replace(/line (\d+)/gi, '第 $1 行');
                // 尝试翻译错误类型
                for (const [en, zh] of Object.entries(errorTypeTranslations)) {
                    translated = translated.replace(new RegExp(en, 'g'), zh);
                }
                translatedLines.push(translated);
            }
        }
    }

    return translatedLines.join('\n');
}

/**
 * 格式化执行结果
 * @param {string} output - 标准输出
 * @param {string} error - 错误输出
 * @returns {{ success: boolean, output: string, translatedError: string }}
 */
export function formatExecutionResult(output, error) {
    if (error) {
        return {
            success: false,
            output: output || '',
            translatedError: translatePythonError(error)
        };
    }
    return {
        success: true,
        output: output || '',
        translatedError: ''
    };
}

export default {
    translatePythonError,
    formatExecutionResult
};
