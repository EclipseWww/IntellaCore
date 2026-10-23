export const htmlTutorials = [
    {
        title: 'HTML 基础 (结构)',
        key: 'html',
        children: [
            {
                title: '1. HTML 初探',
                content: `
                    <p><b>什么是 HTML？</b></p>
                    <p>HTML (HyperText Markup Language) 是构建网页的骨架。</p>
                    <p><b>基本结构解析：</b></p>
                    <ul>
                        <li><code>&lt;!DOCTYPE html&gt;</code>: 告诉浏览器这是一个 HTML5 文档。</li>
                        <li><code>&lt;html&gt;</code>: 根元素，包含整个页面。</li>
                        <li><code>&lt;head&gt;</code>: 头部区域，包含网页标题、字符集等元信息（用户看不到）。</li>
                        <li><code>&lt;body&gt;</code>: 主体区域，包含网页的所有可见内容。</li>
                    </ul>
                `,
                code: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>我的第一个网页</title>
</head>
<body>
    <h1>你好，世界！</h1>
    <p>这是我的第一个 HTML 网页。</p>
</body>
</html>`
            },
            {
                title: '2. 文本排版',
                content: `
                    <p><b>常用文本标签：</b></p>
                    <ul>
                        <li><code>h1</code> - <code>h6</code>: 标题，h1 最大，h6 最小。</li>
                        <li><code>p</code>: 段落 (Paragraph)，文字会自动换行。</li>
                        <li><code>strong</code>: <strong>加粗强调</strong>（重要内容）。</li>
                        <li><code>em</code>: <em>斜体强调</em>（语气加强）。</li>
                        <li><code>br</code>: 换行 (Break)。</li>
                        <li><code>hr</code>: 水平分割线 (Horizontal Rule)。</li>
                    </ul>
                `,
                code: `<h1>一级标题 (最重要的)</h1>
<h2>二级标题</h2>
<h3>三级标题</h3>

<p>这是一个段落。<br>这是同一段落内的换行。</p>

<hr>

<p>这是一段包含 <strong>加粗文字</strong> 和 <em>斜体文字</em> 的内容。</p>
<p>H<sub>2</sub>O (下标) 和 X<sup>2</sup> (上标)</p>`
            },
            {
                title: '3. 列表大全',
                content: `
                    <p>HTML 提供了三种列表形式：</p>
                    <ul>
                        <li><b>无序列表 (ul)</b>: 项目符号通常是圆点。</li>
                        <li><b>有序列表 (ol)</b>: 项目符号是数字或字母。</li>
                        <li><b>自定义列表 (dl)</b>: 包含术语 (dt) 和描述 (dd)。</li>
                        <li><code>li</code>: 列表项 (List Item)，用于 ul 和 ol 中。</li>
                    </ul>
                `,
                code: `<h3>购物清单 (无序)</h3>
<ul>
    <li>苹果 🍎</li>
    <li>香蕉 🍌</li>
    <li>牛奶 🥛</li>
</ul>

<h3>排名榜 (有序)</h3>
<ol>
    <li>第一名: 小明</li>
    <li>第二名: 小红</li>
    <li>第三名: 小刚</li>
</ol>

<h3>名词解释 (自定义)</h3>
<dl>
    <dt>HTML</dt>
    <dd>超文本标记语言</dd>
    <dt>CSS</dt>
    <dd>层叠样式表</dd>
</dl>`
            },
            {
                title: '4. 多媒体元素',
                content: `
                    <p><b>图片 (img)：</b></p>
                    <ul>
                        <li><code>src</code>: 图片地址 (必须)。</li>
                        <li><code>alt</code>: 替代文本 (图片加载失败时显示)。</li>
                        <li><code>width/height</code>: 宽度和高度。</li>
                    </ul>
                    <p><b>音频 (audio) 和 视频 (video)：</b></p>
                    <ul>
                        <li><code>controls</code>: 显示播放控件。</li>
                        <li><code>autoplay</code>: 自动播放。</li>
                    </ul>
                `,
                code: `<!-- 图片 -->
<h3>可爱的小猫</h3>
<img src="https://via.placeholder.com/300x200?text=Cat" alt="一只小猫" width="300">

<!-- 视频 (示例地址) -->
<h3>视频播放</h3>
<video width="320" height="240" controls>
  <source src="https://www.w3schools.com/html/movie.mp4" type="video/mp4">
  您的浏览器不支持 video 标签。
</video>

<!-- 音频 (示例地址) -->
<h3>背景音乐</h3>
<audio controls>
  <source src="https://www.w3schools.com/html/horse.mp3" type="audio/mpeg">
  您的浏览器不支持 audio 标签。
</audio>`
            },
            {
                title: '5. 超链接',
                content: `
                    <p>使用 <code>&lt;a&gt;</code> 标签创建链接。</p>
                    <ul>
                        <li><code>href</code>: 目标网址。</li>
                        <li><code>target="_blank"</code>: 在新标签页打开。</li>
                        <li>锚点链接: 跳转到页面内部的某个 ID。</li>
                    </ul>
                `,
                code: `<!-- 外部链接 -->
<p>访问 <a href="https://www.baidu.com" target="_blank">百度</a> 搜索一下。</p>

<!-- 图片链接 -->
<a href="https://example.com">
    <img src="https://via.placeholder.com/100x50?text=ClickMe" alt="点击我">
</a>

<!-- 锚点链接 -->
<p><a href="#footer">跳转到底部</a></p>

<div style="height: 200px; background: #f0f0f0; margin: 20px 0;">
    (这里是很长的内容占位符...)
</div>

<div id="footer">这里是页面的底部</div>`
            },
            {
                title: '6. 表格制作',
                content: `
                    <p>表格由 <code>&lt;table&gt;</code> 标签定义。</p>
                    <ul>
                        <li><code>tr</code>: 表格行 (Table Row)。</li>
                        <li><code>th</code>: 表头单元格 (Table Header)，通常加粗居中。</li>
                        <li><code>td</code>: 标准单元格 (Table Data)。</li>
                        <li><code>border</code>: 边框属性。</li>
                        <li><code>rowspan/colspan</code>: 合并行/合并列。</li>
                    </ul>
                `,
                code: `<table border="1" width="100%" cellpadding="10">
    <!-- 表头 -->
    <thead>
        <tr style="background-color: #eee;">
            <th>姓名</th>
            <th>科目</th>
            <th>分数</th>
        </tr>
    </thead>
    <!-- 表格内容 -->
    <tbody>
        <tr>
            <td rowspan="2">小明</td> <!-- 合并行 -->
            <td>语文</td>
            <td>90</td>
        </tr>
        <tr>
            <!-- 小明的第二行 -->
            <td>数学</td>
            <td>95</td>
        </tr>
        <tr>
            <td>小红</td>
            <td>英语</td>
            <td>98</td>
        </tr>
    </tbody>
    <!-- 表格底部 -->
    <tfoot>
        <tr>
            <td colspan="2">平均分</td> <!-- 合并列 -->
            <td>94.3</td>
        </tr>
    </tfoot>
</table>`
            },
            {
                title: '7. 表单交互',
                content: `
                    <p>表单 <code>&lt;form&gt;</code> 用于收集用户输入。</p>
                    <p><b>常用控件：</b></p>
                    <ul>
                        <li><code>input type="text"</code>: 文本输入。</li>
                        <li><code>input type="password"</code>: 密码输入。</li>
                        <li><code>input type="radio"</code>: 单选框。</li>
                        <li><code>input type="checkbox"</code>: 复选框。</li>
                        <li><code>select/option</code>: 下拉菜单。</li>
                        <li><code>textarea</code>: 多行文本。</li>
                    </ul>
                `,
                code: `<form>
    <!-- 文本框 -->
    <p>
        <label>用户名: <input type="text" placeholder="请输入用户名"></label>
    </p>
    
    <!-- 密码框 -->
    <p>
        <label>密码: <input type="password"></label>
    </p>
    
    <!-- 单选框 (name属性必须相同) -->
    <p>性别: 
        <label><input type="radio" name="gender" value="male"> 男</label>
        <label><input type="radio" name="gender" value="female"> 女</label>
    </p>
    
    <!-- 复选框 -->
    <p>爱好:
        <label><input type="checkbox" name="hobby" value="game"> 游戏</label>
        <label><input type="checkbox" name="hobby" value="read"> 阅读</label>
    </p>
    
    <!-- 下拉菜单 -->
    <p>年级:
        <select>
            <option value="7">七年级</option>
            <option value="8">八年级</option>
            <option value="9">九年级</option>
        </select>
    </p>
    
    <!-- 提交按钮 -->
    <button type="button" onclick="alert('提交成功！')">注册</button>
</form>`
            },
            {
                title: '8. 语义化标签',
                content: `
                    <p>使用语义化标签让网页结构更清晰，利于 SEO 和阅读。</p>
                    <ul>
                        <li><code>header</code>: 头部。</li>
                        <li><code>nav</code>: 导航链接。</li>
                        <li><code>main</code>: 主要内容。</li>
                        <li><code>article</code>: 独立文章内容。</li>
                        <li><code>section</code>: 文档中的节的分区。</li>
                        <li><code>aside</code>: 侧边栏。</li>
                        <li><code>footer</code>: 底部。</li>
                    </ul>
                `,
                code: `<header style="background: #333; color: white; padding: 10px;">
    <h1>我的博客</h1>
    <nav>
        <a href="#" style="color:white">首页</a> | 
        <a href="#" style="color:white">关于我</a>
    </nav>
</header>

<div style="display: flex; margin-top: 10px;">
    <main style="flex: 70%; padding: 10px;">
        <article>
            <h2>文章标题</h2>
            <p>这是文章的主要内容...</p>
        </article>
    </main>
    
    <aside style="flex: 30%; background: #eee; padding: 10px;">
        <h3>侧边栏</h3>
        <p>这里放一些相关链接或广告。</p>
    </aside>
</div>

<footer style="background: #333; color: white; padding: 10px; margin-top: 10px; text-align: center;">
    <p>版权所有 &copy; 2024</p>
</footer>`
            }
        ]
    },
    {
        title: 'CSS 美化 (样式)',
        key: 'css',
        children: [
            {
                title: '1. CSS 基础',
                content: `
                    <p><b>什么是 CSS？</b></p>
                    <p>CSS (Cascading Style Sheets) 用于控制网页的样式和布局。</p>
                    <p><b>常用选择器：</b></p>
                    <ul>
                        <li><b>元素选择器</b>: <code>h1 { color: red; }</code> (选中所有 h1)</li>
                        <li><b>类选择器</b>: <code>.my-class { ... }</code> (最常用，选中 class="my-class")</li>
                        <li><b>ID 选择器</b>: <code>#my-id { ... }</code> (选中 id="my-id")</li>
                    </ul>
                `,
                code: `<style>
    /* 元素选择器 */
    h2 {
        color: navy;
        border-bottom: 2px solid navy;
    }
    
    /* 类选择器 */
    .highlight {
        background-color: yellow;
        font-weight: bold;
    }
    
    /* ID 选择器 */
    #special {
        color: red;
        font-size: 24px;
    }
</style>

<h2>CSS 基础演示</h2>
<p>这是普通段落。</p>
<p class="highlight">这是带有 highlight 类的段落。</p>
<p id="special">这是 ID 为 special 的段落。</p>`
            },
            {
                title: '2. 文本样式',
                content: `
                    <p>美化文字是 CSS 最基本的功能。</p>
                    <ul>
                        <li><code>color</code>: 字体颜色 (red, #ff0000, rgb(255,0,0))。</li>
                        <li><code>font-size</code>: 字体大小 (px, em, rem)。</li>
                        <li><code>font-family</code>: 字体系列。</li>
                        <li><code>font-weight</code>: 粗细 (bold, normal, 100-900)。</li>
                        <li><code>text-align</code>: 对齐方式 (left, center, right)。</li>
                        <li><code>line-height</code>: 行高。</li>
                    </ul>
                `,
                code: `<style>
    .beautiful-text {
        font-family: 'Microsoft YaHei', sans-serif;
        color: #333;
        line-height: 1.6;
    }
    .title {
        text-align: center;
        color: #0084ff;
        font-size: 28px;
        text-decoration: underline; /* 下划线 */
    }
    .content {
        text-indent: 2em; /* 首行缩进 */
    }
</style>

<div class="beautiful-text">
    <h3 class="title">匆匆</h3>
    <p class="content">燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。但是，聪明的，你告诉我，我们的日子为什么一去不复返呢？</p>
</div>`
            },
            {
                title: '3. 背景与边框',
                content: `
                    <p><b>背景 (Background)：</b></p>
                    <ul>
                        <li><code>background-color</code>: 背景色。</li>
                        <li><code>background-image</code>: 背景图片。</li>
                        <li><code>background-size</code>: 图片大小 (cover, contain)。</li>
                    </ul>
                    <p><b>边框 (Border)：</b></p>
                    <ul>
                        <li><code>border: width style color</code>: 简写 (e.g., 1px solid red)。</li>
                        <li><code>border-radius</code>: 圆角。</li>
                        <li><code>box-shadow</code>: 阴影。</li>
                    </ul>
                `,
                code: `<style>
    .card {
        width: 300px;
        padding: 20px;
        background-color: #fff;
        border: 2px solid #ddd;
        border-radius: 12px; /* 圆角 */
        box-shadow: 0 4px 8px rgba(0,0,0,0.1); /* 阴影 */
        margin: 20px;
    }
    .circle {
        width: 100px;
        height: 100px;
        background-color: #ff6b6b;
        border-radius: 50%; /* 圆形 */
        text-align: center;
        line-height: 100px;
        color: white;
    }
</style>

<div class="card">
    <h3>精美卡片</h3>
    <p>这是一个带有圆角和阴影的卡片效果。</p>
</div>

<div class="circle">圆形</div>`
            },
            {
                title: '4. 盒子模型',
                content: `
                    <p>网页中的每个元素都是一个矩形盒子。</p>
                    <ul>
                        <li><b>Content (内容)</b>: 实际的文字或图片。</li>
                        <li><b>Padding (内边距)</b>: 内容与边框之间的距离。</li>
                        <li><b>Border (边框)</b>: 包裹内边距和内容的线条。</li>
                        <li><b>Margin (外边距)</b>: 盒子与其他元素之间的距离。</li>
                    </ul>
                    <p><em>提示：使用 <code>box-sizing: border-box</code> 可以让宽度包含 padding 和 border。</em></p>
                `,
                code: `<style>
    .box-demo {
        width: 200px; /* 内容宽度 */
        padding: 20px; /* 内边距 */
        border: 10px solid #4CAF50; /* 边框 */
        margin: 30px; /* 外边距 */
        background-color: #f9f9f9;
    }
</style>

<div class="box-demo">
    这是一个盒子模型演示。
    <br>此时总宽度 = 200 + 40(padding) + 20(border) = 260px
</div>`
            },
            {
                title: '5. 布局基础',
                content: `
                    <p><b>Display 属性：</b></p>
                    <ul>
                        <li><code>block</code>: 块级元素 (占满一行，如 div, p, h1)。</li>
                        <li><code>inline</code>: 内联元素 (不占满一行，宽高无效，如 span, a)。</li>
                        <li><code>inline-block</code>: 行内块 (不占满一行，但可以设置宽高，如 img, button)。</li>
                        <li><code>none</code>: 隐藏元素 (不占位)。</li>
                    </ul>
                `,
                code: `<style>
    .block {
        display: block;
        background: #ffcccc;
        margin-bottom: 5px;
    }
    .inline {
        display: inline;
        background: #ccffcc;
        padding: 5px;
    }
    .inline-block {
        display: inline-block;
        width: 100px;
        height: 50px;
        background: #ccccff;
        text-align: center;
        line-height: 50px;
    }
</style>

<div class="block">块级元素 1</div>
<div class="block">块级元素 2</div>

<div class="inline">内联 1</div>
<div class="inline">内联 2</div>
<br><br>
<div class="inline-block">行内块 1</div>
<div class="inline-block">行内块 2</div>`
            },
            {
                title: '6. Flexbox 布局',
                content: `
                    <p>Flexbox 是最强大的现代一维布局工具。</p>
                    <p><b>容器属性：</b></p>
                    <ul>
                        <li><code>display: flex</code>: 启用 Flex 布局。</li>
                        <li><code>justify-content</code>: 主轴对齐 (flex-start, center, space-between)。</li>
                        <li><code>align-items</code>: 交叉轴对齐 (stretch, center, flex-start)。</li>
                    </ul>
                `,
                code: `<style>
    .container {
        display: flex;
        justify-content: space-around; /* 均匀分布 */
        align-items: center; /* 垂直居中 */
        height: 100px;
        background-color: #eee;
        padding: 10px;
    }
    .item {
        width: 60px;
        height: 60px;
        background-color: #008CBA;
        color: white;
        text-align: center;
        line-height: 60px;
        border-radius: 5px;
    }
</style>

<h3>Flexbox 演示</h3>
<div class="container">
    <div class="item">1</div>
    <div class="item">2</div>
    <div class="item">3</div>
</div>`
            },
            {
                title: '7. 定位机制',
                content: `
                    <p>使用 <code>position</code> 属性控制元素位置。</p>
                    <ul>
                        <li><code>static</code>: 默认值。</li>
                        <li><code>relative</code>: 相对定位 (相对于自己原来的位置)。</li>
                        <li><code>absolute</code>: 绝对定位 (相对于最近的非 static 父元素)。</li>
                        <li><code>fixed</code>: 固定定位 (相对于浏览器窗口，常用于导航栏)。</li>
                    </ul>
                `,
                code: `<style>
    .relative-box {
        position: relative;
        width: 300px;
        height: 150px;
        background-color: #f0f0f0;
        border: 1px solid #999;
    }
    .absolute-box {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 80px;
        height: 80px;
        background-color: red;
        color: white;
        padding: 10px;
    }
</style>

<div class="relative-box">
    我是相对定位的父盒子
    <div class="absolute-box">
        我是绝对定位的子盒子
    </div>
</div>`
            },
            {
                title: '8. 伪类与特效',
                content: `
                    <p>让网页动起来！</p>
                    <ul>
                        <li><code>:hover</code>: 鼠标悬停状态。</li>
                        <li><code>cursor</code>: 鼠标样式 (pointer, wait)。</li>
                        <li><code>transition</code>: 过渡动画 (平滑变化)。</li>
                        <li><code>transform</code>: 变形 (scale, rotate)。</li>
                    </ul>
                `,
                code: `<style>
    .cool-btn {
        background-color: #4CAF50;
        color: white;
        padding: 15px 32px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer; /* 小手光标 */
        transition: all 0.3s; /* 所有属性平滑过渡 0.3秒 */
    }
    
    .cool-btn:hover {
        background-color: #45a049;
        transform: scale(1.1); /* 放大 1.1 倍 */
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
</style>

<button class="cool-btn">悬停看效果</button>`
            }
        ]
    },
    {
        title: 'JS 交互 (逻辑)',
        key: 'js',
        children: [
            {
                title: '1. JS 初体验',
                content: `
                    <p><b>什么是 JavaScript？</b></p>
                    <p>JavaScript (JS) 是网页的脚本语言，用于实现动态交互功能。</p>
                    <p><b>基本用法：</b></p>
                    <ul>
                        <li>可以写在 <code>&lt;script&gt;</code> 标签中。</li>
                        <li>使用 <code>alert()</code> 弹出警告框。</li>
                        <li>使用 <code>console.log()</code> 在控制台输出调试信息（按F12查看）。</li>
                    </ul>
                `,
                code: `<h1>JS 初体验</h1>
<button onclick="sayHello()">点我打招呼</button>

<script>
    // 这是一个 JavaScript 函数
    function sayHello() {
        alert("你好！欢迎学习编程！");
        console.log("用户点击了按钮");
    }
</script>`
            },
            {
                title: '2. 变量与数据',
                content: `
                    <p><b>变量声明：</b></p>
                    <ul>
                        <li><code>let</code>: 声明变量（推荐），可以修改。</li>
                        <li><code>const</code>: 声明常量，不可以修改。</li>
                    </ul>
                    <p><b>基本数据类型：</b></p>
                    <ul>
                        <li><b>字符串 (String)</b>: "Hello", 'World'</li>
                        <li><b>数字 (Number)</b>: 123, 3.14</li>
                        <li><b>布尔值 (Boolean)</b>: true, false</li>
                    </ul>
                `,
                code: `<p>请点击按钮查看变量演示结果</p>
<button onclick="demoVariables()">运行变量演示</button>
<div id="output"></div>

<script>
    function demoVariables() {
        let name = "小明";
        let age = 14;
        const isStudent = true;
        
        let message = "姓名: " + name + ", 年龄: " + age;
        
        // 修改变量
        age = 15;
        message += "<br>过了一年，年龄变成了: " + age;
        
        document.getElementById("output").innerHTML = message;
    }
</script>`
            },
            {
                title: '3. 基础运算',
                content: `
                    <p><b>算术运算符：</b> <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>%</code> (取余)。</p>
                    <p><b>比较运算符：</b> <code>></code>, <code>&lt;</code>, <code>===</code> (相等), <code>!==</code> (不等)。</p>
                    <p><b>逻辑运算符：</b> <code>&&</code> (和), <code>||</code> (或), <code>!</code> (非)。</p>
                `,
                code: `<p>简单计算器</p>
<button onclick="calc(10, 5)">计算 10 和 5</button>
<p id="calc-res"></p>

<script>
    function calc(a, b) {
        let sum = a + b;
        let diff = a - b;
        let product = a * b;
        let isGreater = a > b;
        
        let result = "和: " + sum + "<br>" +
                     "差: " + diff + "<br>" +
                     "积: " + product + "<br>" +
                     "a 是否大于 b? " + (isGreater ? "是" : "否");
                     
        document.getElementById("calc-res").innerHTML = result;
    }
</script>`
            },
            {
                title: '4. 条件判断',
                content: `
                    <p>让程序根据不同情况执行不同代码。</p>
                    <ul>
                        <li><code>if (条件) { ... } else { ... }</code></li>
                        <li><code>else if</code>: 多重条件。</li>
                    </ul>
                `,
                code: `<input type="number" id="score" placeholder="输入分数 (0-100)">
<button onclick="checkScore()">评级</button>
<p id="grade-result"></p>

<script>
    function checkScore() {
        let score = Number(document.getElementById("score").value);
        let result = "";
        
        if (score >= 90) {
            result = "优秀 (A)";
            document.getElementById("grade-result").style.color = "green";
        } else if (score >= 60) {
            result = "及格 (B)";
            document.getElementById("grade-result").style.color = "blue";
        } else {
            result = "不及格 (C)";
            document.getElementById("grade-result").style.color = "red";
        }
        
        document.getElementById("grade-result").innerText = result;
    }
</script>`
            },
            {
                title: '5. 函数定义',
                content: `
                    <p>函数是一段可以重复使用的代码块。</p>
                    <ul>
                        <li><b>定义：</b> <code>function name(params) { ... }</code></li>
                        <li><b>调用：</b> <code>name(args)</code></li>
                        <li><b>返回值：</b> 使用 <code>return</code> 语句。</li>
                    </ul>
                `,
                code: `<p>计算两个数的面积：</p>
<button onclick="showArea()">计算 5x8 的面积</button>

<script>
    // 定义一个计算面积的函数
    function getRectArea(width, height) {
        return width * height;
    }

    function showArea() {
        let area = getRectArea(5, 8);
        alert("面积是: " + area);
    }
</script>`
            },
            {
                title: '6. DOM 操作 (上)',
                content: `
                    <p>DOM (Document Object Model) 允许 JS 操作网页元素。</p>
                    <ul>
                        <li><code>document.getElementById("id")</code>: 获取元素。</li>
                        <li><code>element.innerText</code>: 修改文本。</li>
                        <li><code>element.innerHTML</code>: 修改 HTML 内容。</li>
                        <li><code>element.style.color</code>: 修改样式。</li>
                    </ul>
                `,
                code: `<h2 id="title">原来的标题</h2>
<button onclick="changeTitle()">修改标题</button>
<button onclick="changeColor()">改变颜色</button>

<script>
    function changeTitle() {
        let title = document.getElementById("title");
        title.innerText = "标题被 JS 修改啦！";
    }
    
    function changeColor() {
        let title = document.getElementById("title");
        title.style.color = "purple";
        title.style.backgroundColor = "#ddd";
        title.style.padding = "10px";
    }
</script>`
            },
            {
                title: '7. DOM 操作 (下)',
                content: `
                    <p>常用的交互操作。</p>
                    <ul>
                        <li><code>value</code>: 获取输入框的值。</li>
                        <li><code>src</code>: 修改图片路径。</li>
                        <li><code>hidden</code>: 隐藏/显示元素。</li>
                    </ul>
                `,
                code: `<img id="lamp" src="https://www.w3schools.com/js/pic_bulboff.gif" width="100">
<br>
<button onclick="switchLamp(true)">开灯</button>
<button onclick="switchLamp(false)">关灯</button>

<script>
    function switchLamp(turnOn) {
        let img = document.getElementById("lamp");
        if (turnOn) {
            img.src = "https://www.w3schools.com/js/pic_bulbon.gif";
        } else {
            img.src = "https://www.w3schools.com/js/pic_bulboff.gif";
        }
    }
</script>`
            },
            {
                title: '8. 简单逻辑 (循环)',
                content: `
                    <p><b>Loop (循环)：</b> 重复执行代码。</p>
                    <p><code>for (let i=0; i&lt;n; i++) { ... }</code></p>
                `,
                code: `<button onclick="countNumber()">数数 (1-10)</button>
<p id="numbers"></p>

<script>
    function countNumber() {
        let output = "";
        
        // 循环从 1 到 10
        for (let i = 1; i <= 10; i++) {
            output += i + " ";
        }
        
        document.getElementById("numbers").innerText = output;
    }
</script>`
            }
        ]
    },
    {
        title: '实战小项目',
        key: 'projects',
        children: [
            {
                title: '1. 个人名片',
                content: `
                    <p><b>项目目标：</b> 制作一个漂亮的个人信息卡片。</p>
                    <p><b>知识点：</b> 盒子模型、阴影、文本样式、Flex 居中。</p>
                `,
                code: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { background-color: #f3f4f6; display: flex; justify-content: center; height: 100vh; align-items: center; }
        .card {
            background: white;
            padding: 20px;
            width: 300px;
            border-radius: 15px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            text-align: center;
        }
        .avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin-bottom: 10px;
        }
        .name { font-size: 24px; font-weight: bold; margin: 5px 0; }
        .title { color: #666; margin-bottom: 15px; }
        .btn {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="card">
        <img class="avatar" src="https://via.placeholder.com/150" alt="Avatar">
        <div class="name">李小明</div>
        <div class="title">前端初学者</div>
        <p>热爱编程，喜欢创造有趣的东西。</p>
        <button class="btn" onclick="alert('感谢关注！')">关注我</button>
    </div>
</body>
</html>`
            },
            {
                title: '2. 精美导航栏',
                content: `
                    <p><b>项目目标：</b> 制作一个响应鼠标悬停的网站导航栏。</p>
                    <p><b>知识点：</b> Flex 布局、伪类 :hover、过渡效果。</p>
                `,
                code: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        nav {
            background-color: #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 20px;
        }
        .logo { color: white; font-weight: bold; font-size: 20px; }
        .links a {
            color: #ccc;
            text-decoration: none;
            padding: 15px;
            display: inline-block;
            transition: color 0.3s;
        }
        .links a:hover {
            color: white;
            background-color: #444;
        }
    </style>
</head>
<body>
    <nav>
        <div class="logo">MyWebsite</div>
        <div class="links">
            <a href="#">首页</a>
            <a href="#">课程</a>
            <a href="#">博客</a>
            <a href="#">关于</a>
        </div>
    </nav>
    <div style="padding: 20px">
        <h1>欢迎来到我的网站</h1>
        <p>试试把鼠标放在导航栏上。</p>
    </div>
</body>
</html>`
            },
            {
                title: '3. 图片画廊',
                content: `
                    <p><b>项目目标：</b> 展示一排精美的图片，并且有悬停放大效果。</p>
                    <p><b>知识点：</b> Flex/Grid 排版、图片样式、Transform 变形。</p>
                `,
                code: `<!DOCTYPE html>
<html>
<head>
    <style>
        .gallery {
            display: flex;
            gap: 15px;
            padding: 20px;
            flex-wrap: wrap; /* 允许换行 */
        }
        .photo {
            flex: 1;
            min-width: 200px; /* 最小宽度 */
            height: 150px;
            border-radius: 10px;
            overflow: hidden; /* 隐藏溢出部分 */
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            cursor: pointer;
        }
        .photo img {
            width: 100%;
            height: 100%;
            object-fit: cover; /* 填充模式 */
            transition: transform 0.5s;
        }
        .photo:hover img {
            transform: scale(1.1); /* 放大 */
        }
    </style>
</head>
<body>
    <h2>我的相册</h2>
    <div class="gallery">
        <div class="photo"><img src="https://via.placeholder.com/300x200?text=Photo+1" alt="1"></div>
        <div class="photo"><img src="https://via.placeholder.com/300x200?text=Photo+2" alt="2"></div>
        <div class="photo"><img src="https://via.placeholder.com/300x200?text=Photo+3" alt="3"></div>
        <div class="photo"><img src="https://via.placeholder.com/300x200?text=Photo+4" alt="4"></div>
    </div>
</body>
</html>`
            },
            {
                title: '4. 简易计算器',
                content: `
                    <p><b>项目目标：</b> 制作一个可以进行加减乘除的计算器 UI，并实现简单逻辑。</p>
                `,
                code: `<!DOCTYPE html>
<html>
<head>
    <style>
        .calc {
            width: 200px;
            padding: 10px;
            background: #222;
            border-radius: 10px;
            margin: 20px auto;
        }
        input {
            width: 100%;
            height: 40px;
            margin-bottom: 10px;
            font-size: 20px;
            text-align: right;
            border: none;
            background: #eee;
        }
        .buttons {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        }
        button {
            padding: 10px;
            font-size: 16px;
            border: none;
            background: #444;
            color: white;
            cursor: pointer;
            border-radius: 3px;
        }
        button:hover { background: #666; }
        .equal { background: #007bff; grid-column: span 2; }
    </style>
</head>
<body>
    <div class="calc">
        <input type="text" id="display" readonly>
        <div class="buttons">
            <button onclick="append('1')">1</button>
            <button onclick="append('2')">2</button>
            <button onclick="append('3')">3</button>
            <button onclick="append('+')">+</button>
            
            <button onclick="append('4')">4</button>
            <button onclick="append('5')">5</button>
            <button onclick="append('6')">6</button>
            <button onclick="append('-')">-</button>
            
            <button onclick="append('7')">7</button>
            <button onclick="append('8')">8</button>
            <button onclick="append('9')">9</button>
            <button onclick="append('*')">*</button>
            
            <button onclick="append('0')">0</button>
            <button onclick="cls()">C</button>
            <button class="equal" onclick="calculate()">=</button>
        </div>
    </div>

    <script>
        let display = document.getElementById("display");
        
        function append(val) {
            display.value += val;
        }
        
        function cls() {
            display.value = "";
        }
        
        function calculate() {
            try {
                // 注意：eval 在实际开发中要慎用，这里为了教学简便
                display.value = eval(display.value);
            } catch (e) {
                display.value = "Error";
            }
        }
    </script>
</body>
</html>`
            },
            {
                title: '5. 待办事项 (ToDo)',
                content: `
                    <p><b>项目目标：</b> 制作一个可以添加任务的清单。</p>
                    <p><b>知识点：</b> DOM 元素创建 (createElement, appendChild)。</p>
                `,
                code: `<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; max-width: 400px; margin: 20px auto; }
        h2 { text-align: center; color: #333; }
        .input-group { display: flex; gap: 5px; margin-bottom: 20px; }
        input { flex: 1; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; }
        button { padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; }
        ul { list-style: none; padding: 0; }
        li { background: #f9f9f9; padding: 10px; margin-bottom: 5px; border-left: 4px solid #10b981; display: flex; justify-content: space-between; }
        .del { color: red; cursor: pointer; font-size: 12px; }
    </style>
</head>
<body>
    <h2>📝 待办清单</h2>
    <div class="input-group">
        <input type="text" id="taskInput" placeholder="今天要做什么？">
        <button onclick="addTask()">添加</button>
    </div>
    <ul id="taskList">
        <li>示例任务 <span class="del" onclick="this.parentElement.remove()">删除</span></li>
    </ul>

    <script>
        function addTask() {
            let input = document.getElementById("taskInput");
            let text = input.value;
            if (text === "") return;
            
            let ul = document.getElementById("taskList");
            let li = document.createElement("li");
            li.innerHTML = text + ' <span class="del" onclick="this.parentElement.remove()">删除</span>';
            ul.appendChild(li);
            
            input.value = ""; // 清空输入框
        }
    </script>
</body>
</html>`
            },
            {
                title: '6. 深色模式切换',
                content: `
                    <p><b>项目目标：</b> 点击按钮切换网页的深色/浅色主题。</p>
                    <p><b>知识点：</b> CSS 变量、Body 类名切换。</p>
                `,
                code: `<!DOCTYPE html>
<html>
<head>
    <style>
        /* 定义颜色变量 */
        :root {
            --bg-color: white;
            --text-color: #333;
            --box-bg: #eee;
        }
        
        /* 深色模式的变量值 */
        .dark-mode {
            --bg-color: #222;
            --text-color: #fff;
            --box-bg: #444;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            transition: all 0.3s;
            padding: 30px;
            font-family: sans-serif;
        }
        
        .box {
            background-color: var(--box-bg);
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        
        button {
            font-size: 20px;
            padding: 10px 20px;
            border-radius: 20px;
            border: none;
            cursor: pointer;
            background: #007bff;
            color: white;
        }
    </style>
</head>
<body>
    <button onclick="toggleTheme()">🌙 切换模式</button>
    
    <h1>主题切换演示</h1>
    <p>点击上方按钮体验深色模式。</p>
    
    <div class="box">
        <h3>这是一个内容区域</h3>
        <p>背景和文字颜色都会跟随主题变化。</p>
    </div>

    <script>
        function toggleTheme() {
            let body = document.body;
            body.classList.toggle("dark-mode");
            
            let btn = document.querySelector("button");
            if (body.classList.contains("dark-mode")) {
                btn.innerText = "☀️ 切换模式";
                btn.style.background = "orange";
            } else {
                btn.innerText = "🌙 切换模式";
                btn.style.background = "#007bff";
            }
        }
    </script>
</body>
</html>`
            }
        ]
    }
];
