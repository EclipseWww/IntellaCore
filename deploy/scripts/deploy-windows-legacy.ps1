# 检查参数
param (
    [Parameter(Mandatory=$true)][string]$AliyunUsername,
    [Parameter(Mandatory=$false)][string]$ServerIP = "192.168.99.100"
)

$Registry = "crpi-d969wfixtu4c1nwy.cn-qingdao.personal.cr.aliyuncs.com"

# 更新服务器IP
(Get-Content docker-compose.deploy.legacy.yml) -replace '192.168.99.100', $ServerIP | Set-Content docker-compose.deploy.legacy.yml

# 创建必要的目录（Docker Toolbox 中可能不需要，因为我们使用了命名卷）
Write-Host "使用Docker Toolbox兼容模式..."

# 登录阿里云容器服务
Write-Host "登录阿里云容器服务..."
docker login --username=$AliyunUsername $Registry

# 拉取最新镜像
Write-Host "拉取最新镜像..."
docker-compose -f docker-compose.deploy.legacy.yml pull

# 启动服务
Write-Host "启动服务..."
docker-compose -f docker-compose.deploy.legacy.yml up -d

Write-Host "部署完成！"
$frontendUrl = "http://" + $ServerIP + ":4000"
$backendUrl = "http://" + $ServerIP + ":4001/api"
Write-Host "前端访问地址: $frontendUrl"
Write-Host "后端API地址: $backendUrl"
Write-Host ""
Write-Host "如果无法通过IP访问，请检查防火墙设置，确保端口4000和4001已开放"
Write-Host "您可能需要运行以下命令设置端口转发（需要管理员权限）："
Write-Host "netsh interface portproxy add v4tov4 listenaddress=<Windows服务器IP> listenport=4000 connectaddress=$ServerIP connectport=4000"
Write-Host "netsh interface portproxy add v4tov4 listenaddress=<Windows服务器IP> listenport=4001 connectaddress=$ServerIP connectport=4001"
