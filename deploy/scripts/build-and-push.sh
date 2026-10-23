#!/bin/bash

# 检查参数
if [ $# -lt 1 ]; then
    echo "Usage: $0 <aliyun-username>"
    echo "Example: $0 eclipsew"
    exit 1
fi

ALIYUN_USERNAME=$1
REGISTRY="crpi-d969wfixtu4c1nwy.cn-qingdao.personal.cr.aliyuncs.com"

# 登录阿里云容器服务
echo "登录阿里云容器服务..."
docker login --username=${ALIYUN_USERNAME} ${REGISTRY}

# 构建镜像（启用持久编译缓存）
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
echo "构建镜像..."
docker-compose --project-directory . -f deploy/compose/docker-compose.build.yml build

# 推送镜像到阿里云
echo "推送镜像到阿里云..."
docker-compose --project-directory . -f deploy/compose/docker-compose.build.yml push

echo "镜像已成功构建并推送到阿里云容器服务"
echo "前端镜像: ${REGISTRY}/eclipsew/ai-chat-edu-frontend:latest"
echo "后端镜像: ${REGISTRY}/eclipsew/ai-chat-edu-backend:latest"
echo ""
echo "现在您可以使用 deploy.sh 脚本在目标服务器上部署应用"
