# 部署与运维手册

- [新部署](#新部署)
- [构建和发布自己的镜像](#构建和发布自己的镜像)
- [已有部署更新与回退](#已有部署更新与回退)
- [课时与媒体迁移](#课时与媒体迁移)
- [Windows 宿主机代理](#windows-宿主机代理)

本文统一说明新部署、镜像发布与端口配置。已有实例更新请先阅读 本文的“已有部署更新与回退”章节，不要用新部署流程覆盖原数据。

## 配置文件选择

| 文件 | 用途 | 默认前端 / 后端端口 |
| --- | --- | --- |
| docker-compose.yml | 从源码构建并运行 | 3000 / 8080 |
| deploy/compose/docker-compose.build.yml | 构建并标记待发布镜像 | 不启动服务 |
| deploy/compose/docker-compose.deploy.yml | 拉取镜像，供宿主机代理访问 | 127.0.0.1:3001 / 127.0.0.1:8080 |
| deploy/compose/docker-compose.toolbox.yml | 兼容原有 Toolbox 部署 | 3001 / 8080 |

部署配置绑定本机地址时，应通过宿主机代理提供外部访问；相关说明见 本文的“Windows 宿主机代理”章节。已有部署以实际 Compose 文件为准，不要切换文件或项目名称。

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
docker compose --project-directory . -f deploy/compose/docker-compose.build.yml build
docker compose --project-directory . -f deploy/compose/docker-compose.build.yml push
```

推荐使用可回退的版本标签。构建完成不代表已经推送；推送完成不代表服务器已经更新。

新服务器放置部署 Compose 文件和本机 `.env` 后执行：

```sh
docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml config --quiet
docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml pull backend frontend
docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml up -d
```

Windows SSH 会话可能无法读取 Docker Desktop 的仓库凭据，出现登录会话错误时，在服务器交互桌面的 PowerShell 中完成 `docker login` 和 `pull`。

## 数据和验收

数据库、上传文件、公开媒体及日志应使用原有持久化挂载。备份须覆盖 MongoDB 和上传文件；课时传输暂存目录用途见 本文的“课时与媒体迁移”章节。不要执行 `down -v` 或删除数据目录来解决更新问题。

上线后验证首页、`/api/health`、登录、课程列表、历史作业下载和 AI 对话。管理员在“系统管理 → AI 模型设置下方”保存学生退出密码：允许 0 至 72 个字符，保存空密码后学生可直接确认退出；未配置与已保存空密码不同。

旧版 deploy 脚本可能仍含固定端口、镜像来源或历史权限处理逻辑，执行前应审阅；本文优先使用明确的 Compose 命令。

## 个人配置与公开示例

不带 `.example` 的个人镜像配置与脚本仅保留在本机，已加入 Git 忽略规则。现有维护者继续使用原命令，不必更换路径。其他使用者可直接在根目录运行 `docker compose up -d --build`，无需了解维护者镜像仓库。

需要自行发布镜像时，复制 `deploy/compose/docker-compose.build.example.yml` 为同目录的 `docker-compose.build.yml`，将示例镜像地址换成自己的地址，再执行上文命令。镜像部署和脚本同理：复制对应 `.example` 文件，删除文件名中的 `.example` 后按自己的环境填写。历史脚本只供参考，需先核对路径。

## 已有部署更新与回退


本次不修改数据卷名称、挂载目录、容器名称或端口。不要执行 `down -v`，也不要删除 data 目录。

### 首次更新

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

### 后续更新

保留机房根目录 `.env`，继续按原 Compose 文件 pull / up -d 即可。首次迁移保留原数据库密码：修改 MONGO_INITDB_ROOT_PASSWORD 不会自动修改已存在数据库用户的密码，不能直接换一个值后重建。JWT 密钥轮换会使已有登录失效，应在维护窗口进行。

### 回退

升级前记录前后端镜像 ID 并为旧镜像打本地保留标签。需要回退时使用旧镜像标签及相同 Compose 项目和数据挂载重建应用容器，不删除数据库和上传目录。不要把机房部署切换到新的 Compose 项目名称。

本地验证覆盖前端构建、配置解析及代码测试；未连接机房，无法替代上述上线验收。


## 课时与媒体迁移


编辑课时右上角可以选择完整包、内容包或媒体包。完整包包含正文引用的公开媒体，包括其他课时的公开媒体；内容包不包含公开媒体文件，普通活动附件仍随内容打包；媒体包只迁移公开媒体，不创建课时。

大视频建议分别导出内容包和媒体包。在目标服务器的单元「导入课时」入口分别导入，顺序不限。缺失媒体的数量和总大小会在内容导入后提示，也会显示在课时编辑页面。媒体包导入后自动关联，重新打开编辑页面即可刷新状态。媒体按 SHA-256 校验和复用，原服务器完整 URL 会转换为目标服务器的相对地址，保留查询参数及播放时间片段。

网页上传采用 8 MB 分片，单包最大 2 GB。中断后在同一浏览器重新选择同一文件可续传；不要清除浏览器本地存储。最后的 99% 是合并、校验与导入阶段。直接调用旧 multipart 导入接口的上限为 500 MB，网页导入不受单次 500 MB 限制。反向代理需允许至少 8 MB 请求，完成导入的代理超时建议 600 秒以上（现有 frontend/nginx.conf 已配置 600 秒）。实际处理超过代理超时时，可重选同一文件查询结果；完成记录避免重复创建课时。

媒体存储在 backend/uploads/public/media/portable，删除某个课时不会删除共享媒体，防止其他课时失效。该目录需要与其他公开媒体一起持久化及备份。传输分片及成功结果记录保存在 backend/temp/lesson-transfers；中断或失败上传会保留分片以便续传，需要定期清理长期不用的传输记录，清理前确认没有上传进行中。

旧课时 ZIP 仍可导入：系统从包内 media/lesson 与 media/questions 恢复并更新引用。旧包未包含的跨课时媒体无法凭空恢复，系统会明确报错；应在原服务器用新版重新导出。外部视频平台的 URL 保持原样，不会下载第三方视频。


## Windows 宿主机代理


### 背景

Windows Docker Desktop 不支持 host 网络模式，导致容器内的 nginx 无法获取真实客户端 IP。解决方案是在 Windows 宿主机上直接运行 nginx，由它获取真实 IP 后再代理到 Docker 容器。

### 端口说明

| 使用场景 | 宿主机 Nginx 端口 | 访问地址 |
|---------|------------------|---------|
| 默认配置 | 3000 | `http://服务器IP:3000` |
| 标准 HTTP | 80 | `http://服务器IP`（无需指定端口） |

#### 使用 80 端口

如果希望用户通过标准 HTTP 端口 80 访问平台，只需修改 nginx 配置中的 `listen` 端口：

```nginx
server {
    listen       80;    # 改为 80（原为 3000）
    server_name  _;
    # ... 其余配置不变
}
```

同时更新防火墙规则：
```powershell
# 以管理员身份运行
New-NetFirewallRule -DisplayName "Nginx HTTP 80" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

> **注意**：使用 80 端口需要确保没有其他程序占用该端口（如 IIS、Apache 等）。可以用 `netstat -an | findstr :80` 检查。

### 架构图

```
客户端 (客户端IP)
    ↓
Windows 宿主机 Nginx (:3000 或 :80)  ← 这里能获取到真实IP
    ↓
Docker 容器
    ├── frontend (:3001) - 静态文件
    └── backend (:8080) - API服务
```

### 步骤一：下载安装 Nginx for Windows

1. 访问 nginx 官网下载页面：https://nginx.org/en/download.html

2. 下载 **Stable version** 的 Windows 版本（如 `nginx-1.24.0.zip`）

3. 解压到一个**路径不含中文和空格**的目录，例如：
   ```
   C:\nginx
   ```

4. 目录结构应该是：
   ```
   C:\nginx\
   ├── conf\
   │   └── nginx.conf  ← 主配置文件
   ├── html\
   ├── logs\
   └── nginx.exe
   ```

### 步骤二：修改 Docker Compose 配置

修改 `docker-compose.deploy.yml`，将 frontend 端口改为 3001（避免与宿主机 nginx 冲突）：

```yaml
  frontend:
    image: <你的镜像仓库>/ai-chat-edu-frontend:<版本标签>
    container_name: frontend
    restart: always
    ports:
      - "127.0.0.1:3001:80"  # 改为3001，只监听本地
    environment:
      - REACT_APP_API_URL=
    depends_on:
      - backend
    networks:
      - app-network
```

同时确保 backend 的端口配置：
```yaml
    ports:
      - "127.0.0.1:8080:5003"  # 只监听本地，由宿主机nginx对外
```

### 步骤三：配置宿主机 Nginx

用以下内容**替换** `C:\nginx\conf\nginx.conf`：

```nginx
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # 日志格式 - 包含真实客户端IP
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  logs/access.log  main;
    error_log   logs/error.log;

    sendfile        on;
    keepalive_timeout  65;

    # 增加客户端请求体大小限制
    client_max_body_size 500M;

    server {
        listen       3000;  # 如需使用标准HTTP端口，改为 80
        server_name  _;

        # 静态文件 - 代理到 Docker frontend 容器
        location / {
            proxy_pass http://127.0.0.1:3001;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 媒体文件
        location /public/media/ {
            proxy_pass http://127.0.0.1:8080/public/media/;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_buffering off;
            proxy_cache_bypass $http_pragma;
            expires off;
        }

        # API 请求 - 代理到 Docker backend 容器
        location /api {
            proxy_pass http://127.0.0.1:8080;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;

            # ====== 关键：传递真实客户端IP ======
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            # ===================================

            proxy_cache_bypass $http_upgrade;

            # 超时设置
            proxy_read_timeout 600s;
            proxy_connect_timeout 600s;
            proxy_send_timeout 600s;

            # 缓冲区设置
            proxy_buffer_size 128k;
            proxy_buffers 4 256k;
            proxy_busy_buffers_size 256k;

            # SSE支持
            proxy_buffering off;
            proxy_request_buffering off;
        }
    }
}
```

### 步骤四：启动服务

#### 1. 重启 Docker 容器

```powershell
cd C:\Users\ghiopppq\Downloads\ai-chat-edu
docker-compose --project-directory . -f deploy/compose/docker-compose.deploy.yml down
docker-compose --project-directory . -f deploy/compose/docker-compose.deploy.yml up -d
```

#### 2. 启动宿主机 Nginx

```powershell
cd C:\nginx
.\nginx.exe
```

#### 3. 验证服务

- 访问前端：http://服务器IP:3000
- 登录后查看后端日志，确认IP获取正确

### Nginx 常用命令

在 `C:\nginx` 目录下执行：

```powershell
# 启动
.\nginx.exe

# 停止
.\nginx.exe -s stop

# 重新加载配置（修改配置后）
.\nginx.exe -s reload

# 检查配置语法
.\nginx.exe -t
```

### 设置 Nginx 开机自启（可选）

#### 方法1：使用 NSSM 工具

1. 下载 NSSM：https://nssm.cc/download
2. 解压后在命令行执行：
   ```powershell
   nssm install nginx C:\nginx\nginx.exe
   nssm set nginx AppDirectory C:\nginx
   nssm start nginx
   ```

#### 方法2：创建计划任务

1. 打开"任务计划程序"
2. 创建基本任务，触发器选"计算机启动时"
3. 操作选"启动程序"，程序填 `C:\nginx\nginx.exe`，起始位置填 `C:\nginx`

### 防火墙设置

确保 Windows 防火墙允许 3000 端口入站：

```powershell
# 以管理员身份运行
New-NetFirewallRule -DisplayName "Nginx HTTP" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 故障排查

#### 问题1：nginx 启动后立即退出

查看错误日志：`C:\nginx\logs\error.log`

常见原因：
- 端口被占用：换一个端口或关闭占用的程序
- 配置语法错误：运行 `.\nginx.exe -t` 检查

#### 问题2：无法访问

1. 检查 nginx 是否运行：
   ```powershell
   Get-Process nginx
   ```

2. 检查端口是否监听：
   ```powershell
   netstat -an | findstr 3000
   ```

3. 检查防火墙设置

#### 问题3：获取到的IP仍然不对

检查 `/api/auth/ip-debug` 返回的信息，确认 `x-real-ip` 头是否正确传递。

### 完整部署流程总结

```powershell
# 1. 修改 docker-compose.deploy.yml 中的端口配置
# 2. 重启 Docker 容器
cd C:\Users\ghiopppq\Downloads\ai-chat-edu
docker-compose --project-directory . -f deploy/compose/docker-compose.deploy.yml down
docker-compose --project-directory . -f deploy/compose/docker-compose.deploy.yml up -d

# 3. 配置并启动宿主机 nginx
cd C:\nginx
.\nginx.exe -t  # 检查配置
.\nginx.exe     # 启动

# 4. 验证
# 端口3000: http://服务器IP:3000
# 端口80:   http://服务器IP（需修改nginx.conf中listen为80）
```
