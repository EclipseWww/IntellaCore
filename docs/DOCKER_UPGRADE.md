# 机房 Docker 更新

本次不修改数据卷名称、挂载目录、容器名称或端口。不要执行 `down -v`，也不要删除 data 目录。

## 首次更新

1. 保持旧容器运行，先做好数据库及上传文件备份。
2. 拉取本次源码后，**先不要重建或停止容器**。在项目根目录执行：

   ```sh
   python3 deploy/scripts/preserve-config.py
   ```

   脚本读取现有 backend、mongodb 容器配置，只在根目录没有 `.env` 时创建文件，不输出凭据、不更改容器。需要 Docker 访问权限。若已有根目录 `.env`，脚本会停止，需核对其包含 `.env.example` 中的配置项。请勿把 `.env` 提交到 Git。

3. 按你原来使用的 Compose 文件校验：

   ```sh
   docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml config --quiet
   ```

4. 镜像部署方式：需要先将本次代码构建为前后端新镜像并推送到你原用的镜像仓库，然后在机房执行：

   ```sh
   docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml pull
   docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml up -d
   ```

   `git pull` 只更新源码；`docker compose pull` 只更新已发布镜像。两者都不会自动构建新镜像。若机房使用源码构建的 docker-compose.yml，则执行 `docker compose up -d --build`，继续使用原配置文件以保留原端口及数据挂载。

5. 管理员登录，在控制台设置新的学生退出密码（0至72字符，允许空密码和短密码）。未设置时学生退出会提示联系管理员。原先前端中的固定密码不再生效。
6. 检查教师/学生登录、课程列表、历史作业下载、AI 对话、学生退出和数据库持久化。确认无误后再做凭据轮换。

## 后续更新

保留机房根目录 `.env`，继续按原 Compose 文件 pull / up -d 即可。首次迁移保留原数据库密码：修改 MONGO_INITDB_ROOT_PASSWORD 不会自动修改已存在数据库用户的密码，不能直接换一个值后重建。JWT 密钥轮换会使已有登录失效，应在维护窗口进行。

## 回退

升级前记录前后端镜像 ID 并为旧镜像打本地保留标签。需要回退时使用旧镜像标签及相同 Compose 项目和数据挂载重建应用容器，不删除数据库和上传目录。不要把机房部署切换到新的 Compose 项目名称。

本地验证覆盖前端构建、配置解析及代码测试；未连接机房，无法替代上述上线验收。
