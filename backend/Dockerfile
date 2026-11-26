# syntax=docker/dockerfile:1
# Node 22.13+：服务器 Python 判题依赖 Node 权限模型（--permission）隔离学生代码。
# bookworm-slim：Debian 12，仍在安全维护期；比原先的 bullseye 完整版小很多，拉取更快。
# 后端只会启动 node 子进程（管理脚本、Python 判题），不依赖其他系统命令。
FROM node:22-bookworm-slim

WORKDIR /app

# 容器默认是 UTC。设为北京时间：日志时间、按天切分日志、“今天”的统计范围、导出表格中的时间均按北京时间；
# 其他时区的学校可在 Compose 的 environment 中覆盖 TZ。Node 自带时区数据，无需安装 tzdata。
ENV TZ=Asia/Shanghai

# 先只复制依赖清单与内置的离线依赖包（vendor/），源码改动时可复用依赖层缓存
COPY package.json package-lock.json ./
COPY vendor ./vendor

# 按锁文件精确安装，不安装开发依赖（nodemon 等）
RUN --mount=type=cache,id=ai-chat-edu-backend-npm,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund

COPY . .

RUN mkdir -p uploads logs backups

EXPOSE 5003

# 直接运行 node（而不是 npm start），docker stop 发出的停止信号能直接交给后端完成优雅关闭
CMD ["node", "src/app.js"]
