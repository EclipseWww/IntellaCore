# 参与开发

分别在 backend 和 frontend 安装依赖；当前前端锁文件的兼容说明及构建细节见 [开发与维护手册](docs/DEVELOPMENT.md)，Dockerfile 当前使用 npm install。后端 npm run dev，前端 npm start。提交前在 backend 执行 npm test，在 frontend 执行 npm run build。

修改应遵循 routes → controllers → services/models 的职责划分；涉及权限和评分规则时补充回归测试。不要提交环境文件、运行数据或真实学生信息。
