# 检查参数
param (
    [Parameter(Mandatory=$true)][string]$AliyunUsername,
    [Parameter(Mandatory=$false)][string]$ServerIP = $(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Ethernet | Select-Object -ExpandProperty IPAddress)
)

$Registry = "crpi-d969wfixtu4c1nwy.cn-qingdao.personal.cr.aliyuncs.com"

# 更新镜像名称和服务器IP
(Get-Content docker-compose.deploy.yml) -replace 'registry.cn-hangzhou.aliyuncs.com/your-namespace/', "$Registry/" | Set-Content docker-compose.deploy.yml
(Get-Content docker-compose.deploy.yml) -replace '\${SERVER_IP}', $ServerIP | Set-Content docker-compose.deploy.yml

# 创建必要的目录
New-Item -ItemType Directory -Force -Path data/mongodb/db
New-Item -ItemType Directory -Force -Path data/mongodb/configdb
New-Item -ItemType Directory -Force -Path data/backend/uploads
New-Item -ItemType Directory -Force -Path data/backend/logs

# 登录阿里云容器服务
Write-Host "登录阿里云容器服务..."
docker login --username=$AliyunUsername $Registry

# 拉取最新镜像
Write-Host "拉取最新镜像..."
docker-compose -f docker-compose.deploy.yml pull

# 启动服务
Write-Host "启动服务..."
docker-compose -f docker-compose.deploy.yml up -d

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Docker 容器部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "【重要】需要配置宿主机 Nginx 才能获取真实客户端IP" -ForegroundColor Yellow
Write-Host "请参考文档: deploy/docs/WINDOWS-NGINX-PROXY.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "Docker 容器端口（仅本地访问）："
Write-Host "  - Frontend: http://127.0.0.1:3001"
Write-Host "  - Backend:  http://127.0.0.1:8080"
Write-Host ""
Write-Host "配置宿主机 Nginx 后，外部访问地址："
Write-Host "  - 前端: http://$ServerIP`:3000"
Write-Host "  - API:  http://$ServerIP`:3000/api"
Write-Host ""
Write-Host "快速启动宿主机 Nginx："
Write-Host "  cd C:\nginx"
Write-Host "  .\nginx.exe"
