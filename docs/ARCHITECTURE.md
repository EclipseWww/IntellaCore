# 项目架构

React + Ant Design 前端通过 services/api.js 调用 Express REST API；后端使用 Mongoose 访问 MongoDB，JWT 中间件负责认证，角色中间件限制管理操作。

## 目录职责

- frontend/src/pages：学生、教师、管理员页面。
- frontend/src/layouts：各角色页面框架。
- frontend/src/components：复用组件及教学功能组件。
- backend/src/routes：HTTP 路由和权限入口。
- backend/src/controllers：请求校验与业务编排。
- backend/src/services：评分、任务调度等业务服务。
- backend/src/models：MongoDB 数据模型。
- backend/src/middleware：认证及权限控制。
- backend/src/scripts：初始化与维护工具，执行前应审阅数据修改范围。
- deploy：部署脚本及历史部署配置。

## 数据和运行边界

数据库保存账户、课程、提交、设置等数据；上传文件、日志、备份位于运行数据目录，不应进入源码仓库。AI 服务凭据只由后端环境提供。前端环境变量会进入公开构建产物，不能保存秘密。

学生退出密码通过管理员控制台设置，使用 bcrypt 哈希存储。学生退出时后端验证密码，未配置时拒绝退出。此功能用于课堂交互约束，浏览器用户仍可主动清除本地存储。
