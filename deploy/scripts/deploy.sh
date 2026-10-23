#!/bin/bash

# 检查参数
if [ $# -lt 1 ]; then
    echo "Usage: $0 <aliyun-username> [server-ip]"
    echo "Example: $0 eclipsew 192.168.1.100"
    exit 1
fi

ALIYUN_USERNAME=$1
SERVER_IP=${2:-$(hostname -I | awk '{print $1}')}
REGISTRY="crpi-d969wfixtu4c1nwy.cn-qingdao.personal.cr.aliyuncs.com"

# 更新服务器IP (修复MacOS上的sed命令)
sed -i '' "s|\${SERVER_IP}|${SERVER_IP}|g" docker-compose.deploy.yml

# 创建必要的目录
mkdir -p data/mongodb/db data/mongodb/configdb data/backend/uploads data/backend/logs

# 设置目录权限
chmod -R 777 data

# 登录阿里云容器服务
echo "登录阿里云容器服务..."
docker login --username=${ALIYUN_USERNAME} ${REGISTRY}

# 拉取最新镜像
echo "拉取最新镜像..."
# 使用环境变量传递SERVER_IP
SERVER_IP=${SERVER_IP} docker-compose -f docker-compose.deploy.yml pull

# 启动服务
echo "启动服务..."
# 使用环境变量传递SERVER_IP
SERVER_IP=${SERVER_IP} docker-compose -f docker-compose.deploy.yml up -d

echo "部署完成！"
echo "前端访问地址: http://${SERVER_IP}:4000"
echo "后端API地址: http://${SERVER_IP}:4001/api"
echo ""
echo "如果无法通过IP访问，请检查防火墙设置，确保端口4000和4001已开放"
