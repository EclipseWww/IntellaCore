# 部署与运维手册

- [npm 源码部署](#npm-源码部署无需-docker)
- [Docker 部署](#docker-部署)
- [更新与回退](#更新与回退)
- [课时与媒体迁移](#课时与媒体迁移)
- [Windows 宿主机代理](#windows-宿主机代理)

本文说明 npm 与 Docker 两种部署方式，以及日常更新、回退和运维流程。

## npm 源码部署（无需 Docker）

这是独立于 Docker 的部署方式，不需要访问 Docker 镜像仓库。需要先安装 Node.js（含 npm）、Git 和 MongoDB，并启动本机 MongoDB 服务。npm 不会自动安装或启动数据库。下面以 Windows PowerShell 为例，先按下面步骤验证基本运行，再按“生产运行与开机自启”改为后台部署。

### 1. 下载源码

```powershell
git clone https://github.com/EclipseWww/IntellaCore.git
cd IntellaCore
```

已有源码时，在现有项目根目录开始即可，不必重复克隆。确认 `node -v`、`npm -v` 可以输出版本号，本机 MongoDB 监听 `127.0.0.1:27017`。

### 2. 配置并启动后端（终端一）

```powershell
cd backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

在打开的文件中保留以下设置，并把两个占位密码换成自己的随机字符串：

```dotenv
PORT=5003
MONGODB_URI=mongodb://127.0.0.1:27017/student-ai-chat
JWT_SECRET=replace-with-random-secret
MASTER_PASSWORD=replace-with-strong-password
ALLOWED_ORIGINS=http://localhost:3000
```

这是无数据库认证的本机体验示例；若 MongoDB 已启用认证，须填写实际连接 URI。AI Key 可以先留空，不影响先体验账户、课程等功能；AI 对话需要之后配置有效的服务凭据。

保存文件，关闭记事本，再执行：

```powershell
npm start
```

浏览器访问 `http://localhost:5003/api/health`，应返回 `status: ok`。后端持续运行后再启动前端。

### 3. 启动前端（终端二）

新开 PowerShell，进入同一份源码根目录，再执行：

```powershell
cd frontend
npm install
$env:PORT = '3000'
$env:REACT_APP_API_URL = ''
npm start
```

打开 `http://localhost:3000`。前端开发服务器会把 API 请求代理到本机 5003 端口，无需 Nginx。请在提示端口被占用时先停止旧实例，避免浏览器打开另一份服务。

当前 `frontend/package.json` 的 `start` 使用 Windows 命令语法。macOS/Linux 在 frontend 目录安装依赖后使用：

```sh
PORT=3000 HOST=localhost REACT_APP_API_URL= npx react-scripts start
```

### 4. 首次使用

1. 访问 `http://localhost:3000/setup`，创建自己的管理员账号；没有公开的默认管理员密码。
2. 管理员创建教师，再由教师或管理员创建班级、导入学生和课程。全新数据库不会自动生成演示课程和学生。
3. 在“系统管理”配置 AI 模型和 API；没有自己的 Key 时可先跳过 AI 对话。
4. 在 AI 模型设置下方保存学生退出密码。允许空密码和短密码，但空密码也要明确点击保存；未配置时学生不能通过退出验证。

手动停止服务时，在前后端两个终端分别按 Ctrl+C。再次运行只需分别进入 backend 和 frontend 启动服务，不要反复覆盖 .env。数据保存在 MongoDB，作业等文件保存在 backend/uploads，停止应用不会清空它们。

### 常见问题

- 数据库连接失败：检查 MongoDB 服务是否启动、URI 和认证是否正确。
- API 代理报错或登录失败：先确认 5003 健康检查通过，再检查前端进程的 REACT_APP_API_URL 是否为空，修改变量后重启前端。
- npm 安装失败：保留完整错误信息核对依赖和 Node.js 版本，不要直接使用 npm audit fix --force 修改依赖树。
- npm 和 Docker 都可部署。长期运行时使用下文的前端生产构建与开机任务，不长期运行 React 开发服务器。

### 生产运行与开机自启（Windows）

在 backend/.env 中设置 NODE_ENV=production。npm 部署长期使用时，前端应先生成生产文件，由 Nginx 提供网页并代理 API；后端运行 Node.js，数据库作为 Windows 服务。无需 Docker。以下示例将源码放在 C:\IntellaCore，Nginx 放在 C:\nginx；请将路径改为自己的实际路径。

#### 1. 构建前端

先停止 frontend 中的 npm start，释放 3000 端口。在源码根目录打开 PowerShell：

```powershell
cd frontend
npm install
$env:REACT_APP_API_URL = ''
npm run build
```

生成 frontend/build 后，不再需要前端 npm start 进程。AI Key 和数据库配置仍只放在 backend/.env。

#### 2. 配置本机 Nginx

下载并解压 Windows Nginx 到 C:\nginx。将仓库内 deploy/npm/nginx.example.conf 复制为 C:\nginx\conf\nginx.conf，编辑其中 root 为实际 frontend/build 绝对路径（Nginx 内使用正斜杠）。示例已包含 SPA 路由、API、公开媒体和上传超时配置。

```powershell
cd C:\nginx
.\nginx.exe -t
```

先确认配置检查成功。示例对外端口为 3000；使用学生电脑访问时，ALLOWED_ORIGINS 中加入实际服务器来源，例如 http://服务器IP:3000，并在 Windows 防火墙仅对需要的机房网络放行 TCP 3000。后台和 MongoDB 不必对学生开放端口。若已有代理，合并配置，避免启动第二个进程抢占端口。

#### 3. MongoDB 自动启动

MongoDB 安装时选择作为 Windows 服务运行。管理员 PowerShell 检查：

```powershell
Get-Service *Mongo*
```

若服务名为 MongoDB：

```powershell
Set-Service MongoDB -StartupType Automatic
Start-Service MongoDB
```

若服务不存在，先使用 MongoDB 安装程序配置数据库服务，不要仅创建一个空任务。数据库数据目录独立于 Git 源码，升级时保留。

#### 4. 为后端和网页服务创建启动任务

先停止之前手动运行的后端，避免重复占用 5003。通过开始菜单打开“任务计划程序”，选择“创建任务”（不是仅创建登录快捷方式）。分别创建两个任务：

| 设置 | IntellaCore-Backend | IntellaCore-Web |
| --- | --- | --- |
| 常规：运行账户 | 有权访问源码、.env、uploads 和日志目录的本机账户 | 有权读取前端构建及 Nginx 配置、写入 Nginx 日志的本机账户 |
| 常规：运行方式 | 不管用户是否登录都要运行 | 不管用户是否登录都要运行 |
| 触发器 | 启动时，延迟 1 分钟 | 启动时，延迟 1 分钟 |
| 操作：程序 | node.exe 的完整路径 | C:\nginx\nginx.exe |
| 操作：参数 | src/app.js | -p C:/nginx/ -c conf/nginx.conf -g "daemon off;" |
| 操作：起始于 | C:\IntellaCore\backend | C:\nginx |

node.exe 路径可在 PowerShell 使用 (Get-Command node.exe).Source 查询，常见为 C:\Program Files\nodejs\node.exe。起始目录必须填写，否则后端可能读不到 .env。任务参数中不要填写密钥或账户密码；任务保存时由 Windows 本地提示输入运行账户密码。

两个任务的“设置”均选择：

- 允许按需运行；失败后每 1 分钟重试，最多 999 次。
- 已在运行时“不启动新实例”。
- 取消“运行超过指定时间后停止”，避免默认数天后停服。
- 取消仅交流电源启动、切换电池即停止的条件（如使用笔记本）。

如学校策略禁止保存任务账户凭据，请由管理员按本机策略配置服务账户。不要用仅“用户登录时”触发来代替真正的开机启动。

首次分别右键两个任务选择“运行”，确认 http://localhost:3000 和 http://localhost:3000/api/health 正常。随后在维护时间重启电脑，未登录前从另一台电脑访问 http://服务器IP:3000 验证。只有完成这次重启验收，才能确认自启动在目标电脑生效。

停止时分别“结束”这两个任务。Nginx 使用 daemon off 保持任务进程运行，便于任务计划程序跟踪；不要额外手工启动第二个 Nginx。修改 Nginx 配置后先执行 nginx.exe -t，再重启网页任务。后端日志位于 backend/logs。

### npm 部署如何更新

不是只运行 git pull 就立即生效。先备份数据库、backend/uploads 和 backend/.env，再在维护时间执行：

1. 先禁用 IntellaCore-Backend、IntellaCore-Web 两个任务，再结束正在运行的任务，避免失败重试在维护期间自动启动；保持 MongoDB 服务运行。
2. 在源码根目录拉取更新；如有本地修改，先处理，不要强制覆盖。

```powershell
git pull --ff-only
npm install --prefix backend
npm install --prefix frontend
$env:REACT_APP_API_URL = ''
npm run build --prefix frontend
```

3. 上述命令每条都应成功后，重新启用并启动后端和网页两个任务；有任何失败先排查，不要把未完成的构建当作成功版本。
4. 核对首页、登录、课程、历史文件下载及 AI 对话。通常无需重新设置管理员或覆盖 .env。

更新失败时恢复更新前代码并重新安装对应依赖和构建前端；保留数据库及上传目录。涉及数据结构变更时先阅读该版本升级说明。任务设置中的失败重试可能在维护期间启动进程，较长维护先禁用任务，更新结束后重新启用。

## Docker 部署

适合已具备 Docker 环境的电脑或服务器。Docker 与 npm 源码部署是两种独立方式，选择一种即可；不要在相同端口同时启动两套实例。

### 1. 准备环境和源码

安装 Docker Engine 或可运行 Linux 容器的 Docker Desktop，以及 Compose V2。Windows 需先启动 Docker Desktop 的 Linux 容器引擎。

```powershell
docker version
docker compose version
git clone https://github.com/EclipseWww/IntellaCore.git
cd IntellaCore
```

已有源码时不必重复克隆。docker version 应同时显示客户端和服务端信息，只有客户端说明 Docker 引擎尚不可用。

中国大陆网络可能无法拉取 MongoDB、Node、Nginx 基础镜像。首次构建前确认所有基础镜像可下载；有单位提供的可信镜像服务时按单位说明配置。自建应用镜像仓库不能自动解决 Dockerfile 基础镜像的拉取问题。不要随意执行来源不明的镜像加速脚本；网络条件不具备时可选择前文的 npm 部署。

### 2. 配置根目录 .env

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

设置 MONGO_ROOT_PASSWORD、MONGODB_URI、JWT_SECRET、MASTER_PASSWORD；AI Key 可先留空。MongoDB URI 必须使用容器服务名 mongodb，而不是 localhost 或 127.0.0.1，例如：

```dotenv
MONGO_ROOT_PASSWORD=replace-with-your-own-password
MONGODB_URI=mongodb://admin:replace-with-your-own-password@mongodb:27017/student-ai-chat?authSource=admin
JWT_SECRET=replace-with-your-own-random-secret
MASTER_PASSWORD=replace-with-your-own-master-password
OPENAI_API_KEY=
DASHSCOPE_API_KEY=
ALLOWED_ORIGINS=http://localhost:3000
```

占位值必须自行替换，密码在两个位置保持一致，URI 中的特殊字符须编码。学生通过局域网访问时，将 ALLOWED_ORIGINS 改为实际访问地址，例如 http://服务器IP:3000。不要覆盖已有实例的 .env；数据库已有数据时更改初始化密码不会自动修改数据库用户密码。

根目录 .env 用于 Compose；不必额外创建 backend/.env，也不要把环境文件打包到镜像中。

### 3. 从源码构建并启动

公开仓库默认从源码构建，不需要维护者的个人镜像地址：

```powershell
docker compose config --quiet
docker compose build backend frontend
docker compose up -d
```

逐条执行，上一步成功再继续。首次构建需要下载基础镜像及 npm 依赖，可能较慢。

### 4. 检查服务并完成初始化

```powershell
docker compose ps
docker compose logs --tail 100 backend
```

确认三个服务都在运行；仅显示容器 Up 不代表数据库已经连接成功。

- 前端：http://localhost:3000。
- 后端健康检查：http://localhost:8080/api/health。
- 经前端代理的健康检查：http://localhost:3000/api/health。
- 首次设置：http://localhost:3000/setup。

创建自己的管理员账号，再创建教师、班级并导入学生和课程；没有公开默认管理员密码。管理员在系统管理中配置 AI 模型和 Key，并保存学生退出密码。允许空密码和短密码，留空也须点击保存。最后实际验证登录、历史文件下载和 AI 对话。

学生电脑通过 http://服务器IP:3000 访问，防火墙仅向需要的机房网络开放网页端口。根目录 Compose 默认还映射了数据库和后端端口；不需要外部直连时限制其防火墙访问，不要将数据库直接暴露到互联网。

### 5. 数据、停止和开机恢复

默认持久化数据位于源码根目录 data/mongodb 和 data/backend；备份须包含数据库及上传文件、公开媒体，不能只备份源码或镜像。不要执行 down -v 或删除数据目录来解决更新问题。

```powershell
# 临时停止，保留容器及数据
docker compose stop
# 再次启动
docker compose start
```

配置使用 restart: always，Docker 引擎运行后会恢复容器，但它不能让尚未启动的 Docker 引擎自行运行。Windows Docker Desktop 的登录启动不等于无人登录时的开机可用；有此需求时应验证目标系统的引擎启动方式，或选择前文 npm 的开机任务方案。Linux 则需配置 Docker 服务开机启动。上线前在维护窗口重启电脑，从学生电脑验证服务恢复。

### 6. 源码构建方式更新

先备份数据库、上传文件及 .env，在原目录执行：

```powershell
git pull --ff-only
docker compose config --quiet
docker compose build backend frontend
docker compose up -d --no-deps backend frontend
```

构建成功后再重建应用容器，避免构建失败时先停止旧服务。MongoDB 不参与最后一步重建。git pull 不会自动重新构建镜像；若版本修改了数据库服务配置，应另外审阅升级说明。更新后重复健康检查和业务验收。

### 7. 可选：发布到自己的镜像仓库

仅在需要“一台机器构建、多台机器拉取”时使用，不是普通部署的必需步骤。公开仓库提供占位符示例，个人实际配置被 Git 忽略。

```powershell
Copy-Item deploy/compose/docker-compose.build.example.yml deploy/compose/docker-compose.build.yml
Copy-Item deploy/compose/docker-compose.deploy.example.yml deploy/compose/docker-compose.deploy.yml
```

仅在目标文件不存在时复制，避免覆盖个人配置。编辑两份文件，将前后端 image 改成自己的仓库地址和相同版本标签；基础数据库镜像也需选择可访问、可信的来源。推荐版本标签以便回退。

```powershell
docker login <你的镜像仓库域名>
docker compose --project-directory . -f deploy/compose/docker-compose.build.yml build
docker compose --project-directory . -f deploy/compose/docker-compose.build.yml push
```

在目标服务器保留对应源码目录结构、部署配置及自己的根目录 .env 后，使用：

```powershell
docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml config --quiet
docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml pull
docker compose --project-directory . -f deploy/compose/docker-compose.deploy.yml up -d
```

此示例前端绑定 127.0.0.1:3001、后端绑定 127.0.0.1:8080，外部访问需要本文的 Windows 宿主机代理，不能照搬源码构建方式的 3000 端口。已有机房以其实际文件路径、端口和 Compose 项目名称为准，不要为了统一文档移动数据目录。

后续镜像更新先 pull backend frontend，成功后 up -d --no-deps backend frontend。Windows SSH 会话若无法读取 Docker Desktop 仓库凭据，应在服务器交互桌面的 PowerShell 中完成登录和拉取。构建、推送、拉取和重建是独立步骤，不会彼此自动执行。

### 常见故障

- 无法连接 Docker daemon：先启动 Docker 引擎并确认 docker version 显示服务端。
- 拉取超时或拒绝访问：区分基础镜像网络问题和私有仓库登录问题，保留原容器，不要删除数据。
- MongoDB 登录失败：核对现有数据库用户与 .env，初始化密码只对空数据目录生效。
- 端口占用：检查是否还运行着 npm 实例或另一套容器，不能同时占用 3000/8080。
- backend 一直重启：查看 backend 和 mongodb 日志；Linux 挂载目录还需检查写入权限。
- 镜像已拉取但页面未更新：确认已重建前端容器，浏览器刷新后检查实际镜像版本。

## 更新与回退

本文面向当前版本及后续版本的使用者。日常更新按部署方式选择前文“npm 部署如何更新”或“源码构建方式更新”；使用镜像仓库时按“发布到自己的镜像仓库”的流程拉取并重建应用容器。

### 更新前准备

- 阅读目标版本的发布说明，确认是否有额外的数据迁移或配置要求。
- 备份数据库、上传文件和本机配置；源码仓库不能替代业务数据备份。
- 记录当前 Git 提交或镜像版本，保留可用的旧版本及其配置。镜像使用明确的版本标签，避免只有一个不断变化的 latest。
- 保留原 .env、数据目录、端口和 Compose 项目名称；新增配置按版本说明补充，不要直接覆盖整份配置。

### 更新后检查

确认首页和健康检查正常，再检查教师/学生登录、课程、历史文件下载、AI 对话和学生退出。通常不需要重新初始化管理员或重新设置已有密码。

### 更新失败时回退

npm 部署恢复更新前的源码版本及对应依赖，重新构建前端并重启服务。Docker 部署使用保留的旧镜像重建应用容器，继续使用相同数据挂载和项目名称。不要通过删除 data 目录或执行 down -v 回退。

如目标版本执行了不兼容的数据迁移，仅回退代码或镜像可能无法恢复，须按该版本说明使用升级前备份恢复；恢复备份会丢失备份之后的新数据，应先停止写入并确认恢复范围。

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
