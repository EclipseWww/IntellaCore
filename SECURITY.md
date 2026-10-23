# 安全与发布

请勿在公开 Issue 中提交密钥、账户、学生资料、作业或数据库备份。发现漏洞时请通过仓库维护者提供的私密渠道报告。

## 首次公开发布前

- 轮换曾出现在配置中的 AI 密钥、JWT 密钥、管理员主密码及数据库密码；修改文件不能撤销泄露。
- 旧 Git 提交仍可能包含原配置。现有机房依赖 pull，不应直接改写部署仓库历史。公开发布应使用单独的、经审查的源码快照仓库，并保留部署仓库用于原有更新流程。
- 本地 .env 文件保留用于运行，但不得上传。已被跟踪的环境文件不会因 gitignore 自动移除。
- 排除 data、uploads、logs、backups、离线分享包和学校个人数据。
- 管理员首次登录后设置学生退出密码。
- scripts 中存在演示账户密码；生产环境不要运行演示数据脚本。
- 检查第三方游戏、字体及资源的许可证；仓库许可证需由项目所有者确认后添加。

## 配置

本地后端复制 backend/.env.example 为 backend/.env 并填写独立随机凭据。Docker Compose 在根目录 .env 中配置 MONGO_ROOT_PASSWORD、MONGODB_URI、JWT_SECRET、MASTER_PASSWORD，可选 OPENAI_API_KEY 和 DASHSCOPE_API_KEY。数据库密码含特殊字符时须在连接 URI 中进行 URL 编码。
