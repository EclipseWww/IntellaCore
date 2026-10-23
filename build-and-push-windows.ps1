# 检查参数
param (
        [Parameter(Mandatory=$true)][string]$AliyunUsername
)

$Registry = "crpi-d969wfixtu4c1nwy.cn-qingdao.personal.cr.aliyuncs.com"

# 登录阿里云容器服务
Write-Host "登录阿里云容器服务..."
docker login --username=$AliyunUsername $Registry

# 构建镜像
Write-Host "构建镜像..."
docker-compose -f docker-compose.build.yml build

# 推送镜像到阿里云
Write-Host "推送镜像到阿里云..."
docker-compose -f docker-compose.build.yml push

Write-Host "镜像已成功构建并推送到阿里云容器服务"
Write-Host "前端镜像: $Registry/eclipsew/ai-chat-edu-frontend:latest"
Write-Host "后端镜像: $Registry/eclipsew/ai-chat-edu-backend:latest"
Write-Host ""
Write-Host "现在您可以使用 deploy-windows.ps1 脚本在目标服务器上部署应用"