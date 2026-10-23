# 部署指南

本文统一说明新部署、镜像发布与端口配置。已有实例更新请先阅读 [更新与回退](DOCKER_UPGRADE.md)，不要用新部署流程覆盖原数据。

## 配置文件选择

| 文件 | 用途 | 默认前端 / 后端端口 |
| --- | --- | --- |
| docker-compose.yml | 从源码构建并运行 | 3000 / 8080 |
| docker-compose.build.yml | 构建并标记待发布镜像 | 不启动服务 |
| docker-compose.deploy.yml | 拉取镜像，供宿主机代理访问 | 127.0.0.1:3001 / 127.0.0.1:8080 |
| docker-compose.toolbox.yml | 兼容原有 Toolbox 部署 | 3001 / 8080 |

部署配置绑定本机地址时，应通过宿主机代理提供外部访问；相关说明见 [Windows Nginx](../deploy/docs/WINDOWS-NGINX-PROXY.md)。已有部署以实际 Compose 文件为准，不要切换文件或项目名称。

## 新部署

安装 Docker 与支持 BuildKit 的 Compose。在仓库根目录复制 `.env.example` 为 `.env`（PowerShell）：

```powershell
Copy-Item .env.example .env
```

编辑 `.env`，填写数据库密码、完整数据库 URI、JWT 密钥、主密码及需要的 AI 服务密钥。根目录 `.env` 用于 Compose 变量替换；本地开发的 `backend/.env` 是另一份配置。前端变量会进入公开构建，不得保存秘密。

`MONGODB_URI` 中的凭据须与 MongoDB 初始用户一致，特殊字符需进行 URI 编码。首次部署使用独立随机凭据，不能照抄占位符。通过 `ALLOWED_ORIGINS` 设置实际访问来源。

```sh
docker compose config --quiet
docker compose up -d --build
```

默认源码部署访问 `http://localhost:3000`，健康检查为 `http://localhost:8080/api/health`。先完成网站 `/setup` 管理员初始化，再提供给学生访问。

## 构建和发布自己的镜像

仓库构建配置保留了原维护者镜像地址以兼容既有部署。新使用者应先将 build 与 deploy 文件中的前后端 `image` 改为自己的仓库地址和同一个版本标签。不要向原维护者仓库推送。

```sh
docker login <你的镜像仓库域名>
docker compose -f docker-compose.build.yml build
docker compose -f docker-compose.build.yml push
```

推荐使用可回退的版本标签。构建完成不代表已经推送；推送完成不代表服务器已经更新。

新服务器放置部署 Compose 文件和本机 `.env` 后执行：

```sh
docker compose -f docker-compose.deploy.yml config --quiet
docker compose -f docker-compose.deploy.yml pull backend frontend
docker compose -f docker-compose.deploy.yml up -d
```

Windows SSH 会话可能无法读取 Docker Desktop 的仓库凭据，出现登录会话错误时，在服务器交互桌面的 PowerShell 中完成 `docker login` 和 `pull`。

## 数据和验收

数据库、上传文件、公开媒体及日志应使用原有持久化挂载。备份须覆盖 MongoDB 和上传文件；课时传输暂存目录用途见 [媒体迁移](LESSON-MEDIA-MIGRATION.md)。不要执行 `down -v` 或删除数据目录来解决更新问题。

上线后验证首页、`/api/health`、登录、课程列表、历史作业下载和 AI 对话。管理员在“系统管理 → AI 模型设置下方”保存学生退出密码：允许 0 至 72 个字符，保存空密码后学生可直接确认退出；未配置与已保存空密码不同。

旧版 deploy 脚本可能仍含固定端口、镜像来源或历史权限处理逻辑，执行前应审阅；本文优先使用明确的 Compose 命令。
