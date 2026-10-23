# Windows 宿主机 Nginx 代理配置指南

## 背景

Windows Docker Desktop 不支持 host 网络模式，导致容器内的 nginx 无法获取真实客户端 IP。解决方案是在 Windows 宿主机上直接运行 nginx，由它获取真实 IP 后再代理到 Docker 容器。

## 端口说明

| 使用场景 | 宿主机 Nginx 端口 | 访问地址 |
|---------|------------------|---------|
| 默认配置 | 3000 | `http://服务器IP:3000` |
| 标准 HTTP | 80 | `http://服务器IP`（无需指定端口） |

### 使用 80 端口

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

## 架构图

```
客户端 (客户端IP)
    ↓
Windows 宿主机 Nginx (:3000 或 :80)  ← 这里能获取到真实IP
    ↓
Docker 容器
    ├── frontend (:3001) - 静态文件
    └── backend (:8080) - API服务
```

## 步骤一：下载安装 Nginx for Windows

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

## 步骤二：修改 Docker Compose 配置

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

## 步骤三：配置宿主机 Nginx

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

## 步骤四：启动服务

### 1. 重启 Docker 容器

```powershell
cd C:\Users\ghiopppq\Downloads\ai-chat-edu
docker-compose -f docker-compose.deploy.yml down
docker-compose -f docker-compose.deploy.yml up -d
```

### 2. 启动宿主机 Nginx

```powershell
cd C:\nginx
.\nginx.exe
```

### 3. 验证服务

- 访问前端：http://服务器IP:3000
- 登录后查看后端日志，确认IP获取正确

## Nginx 常用命令

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

## 设置 Nginx 开机自启（可选）

### 方法1：使用 NSSM 工具

1. 下载 NSSM：https://nssm.cc/download
2. 解压后在命令行执行：
   ```powershell
   nssm install nginx C:\nginx\nginx.exe
   nssm set nginx AppDirectory C:\nginx
   nssm start nginx
   ```

### 方法2：创建计划任务

1. 打开"任务计划程序"
2. 创建基本任务，触发器选"计算机启动时"
3. 操作选"启动程序"，程序填 `C:\nginx\nginx.exe`，起始位置填 `C:\nginx`

## 防火墙设置

确保 Windows 防火墙允许 3000 端口入站：

```powershell
# 以管理员身份运行
New-NetFirewallRule -DisplayName "Nginx HTTP" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 故障排查

### 问题1：nginx 启动后立即退出

查看错误日志：`C:\nginx\logs\error.log`

常见原因：
- 端口被占用：换一个端口或关闭占用的程序
- 配置语法错误：运行 `.\nginx.exe -t` 检查

### 问题2：无法访问

1. 检查 nginx 是否运行：
   ```powershell
   Get-Process nginx
   ```

2. 检查端口是否监听：
   ```powershell
   netstat -an | findstr 3000
   ```

3. 检查防火墙设置

### 问题3：获取到的IP仍然不对

检查 `/api/auth/ip-debug` 返回的信息，确认 `x-real-ip` 头是否正确传递。

## 完整部署流程总结

```powershell
# 1. 修改 docker-compose.deploy.yml 中的端口配置
# 2. 重启 Docker 容器
cd C:\Users\ghiopppq\Downloads\ai-chat-edu
docker-compose -f docker-compose.deploy.yml down
docker-compose -f docker-compose.deploy.yml up -d

# 3. 配置并启动宿主机 nginx
cd C:\nginx
.\nginx.exe -t  # 检查配置
.\nginx.exe     # 启动

# 4. 验证
# 端口3000: http://服务器IP:3000
# 端口80:   http://服务器IP（需修改nginx.conf中listen为80）
```

