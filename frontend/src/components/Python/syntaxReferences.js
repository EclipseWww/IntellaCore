// Python 编辑器“语法参考”弹窗内容
const syntaxReferences = [
    {
        key: 'print',
        label: '📤 print 输出',
        title: 'print 输出语句',
        description: 'print() 函数用于将内容输出到控制台，是Python中最常用的输出方式。',
        syntax: 'print(内容)',
        examples: [
            { title: '输出文字', code: 'print("Hello, World!")' },
            { title: '输出变量', code: 'name = "小明"\nprint(name)' },
            { title: '输出多个内容', code: 'print("姓名:", "小明", "年龄:", 12)' }
        ],
        tips: ['字符串要用引号括起来', '多个内容用逗号分隔']
    },
    {
        key: 'input',
        label: '📥 input 输入',
        title: 'input 输入语句',
        description: 'input() 函数用于接收用户的键盘输入，返回值是字符串类型。',
        syntax: '变量 = input("提示信息")',
        examples: [
            { title: '基本输入', code: 'name = input("请输入你的名字: ")\nprint("你好,", name)' },
            { title: '输入数字', code: 'age = int(input("请输入年龄: "))\nprint("明年你", age + 1, "岁")' }
        ],
        tips: ['input() 返回的是字符串', '如需数字运算，要用 int() 或 float() 转换']
    },
    {
        key: 'if',
        label: '🔀 if 判断',
        title: 'if 条件判断',
        description: 'if语句用于根据条件执行不同的代码块。',
        syntax: 'if 条件:\n    代码块\nelif 其他条件:\n    代码块\nelse:\n    代码块',
        examples: [
            { title: '简单判断', code: 'age = 18\nif age >= 18:\n    print("成年人")\nelse:\n    print("未成年")' },
            { title: '多条件判断', code: 'score = 85\nif score >= 90:\n    print("优秀")\nelif score >= 60:\n    print("及格")\nelse:\n    print("不及格")' }
        ],
        tips: ['条件后面要加冒号 :', '代码块需要缩进（4个空格）', 'elif 和 else 是可选的']
    },
    {
        key: 'for',
        label: '🔁 for 循环',
        title: 'for 循环语句',
        description: 'for循环用于遍历序列（如列表、字符串、range等）中的每个元素。',
        syntax: 'for 变量 in 序列:\n    循环体',
        examples: [
            { title: '遍历数字', code: 'for i in range(5):\n    print(i)  # 输出 0,1,2,3,4' },
            { title: '指定范围', code: 'for i in range(1, 6):\n    print(i)  # 输出 1,2,3,4,5' },
            { title: '遍历列表', code: 'fruits = ["苹果", "香蕉", "橙子"]\nfor fruit in fruits:\n    print(fruit)' }
        ],
        tips: ['range(n) 产生 0 到 n-1 的数字', 'range(a, b) 产生 a 到 b-1 的数字', '循环体需要缩进']
    },
    {
        key: 'while',
        label: '🔄 while 循环',
        title: 'while 循环语句',
        description: 'while循环在条件为真时重复执行代码块，适合不确定循环次数的场景。',
        syntax: 'while 条件:\n    循环体',
        examples: [
            { title: '计数循环', code: 'count = 0\nwhile count < 5:\n    print(count)\n    count += 1' },
            { title: '累加求和', code: 'total = 0\nn = 1\nwhile n <= 100:\n    total += n\n    n += 1\nprint("1到100的和:", total)' }
        ],
        tips: ['确保条件最终会变为 False，否则会死循环', '可用 break 提前退出循环', '可用 continue 跳过本次循环']
    }
];

export default syntaxReferences;
