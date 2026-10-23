# syntax=docker/dockerfile:1
FROM node:16-alpine as build

# 设置 npm 使用淘宝镜像
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /app

# 使用 package.json 和 package-lock.json 来利用 Docker 缓存
COPY package*.json ./

# 安装依赖
RUN --mount=type=cache,id=ai-chat-edu-frontend-npm,target=/root/.npm,sharing=locked \
    npm install --prefer-offline --no-audit --no-fund

# Only copy build inputs; nginx/docs changes should not invalidate compilation.
COPY .env.production ./
COPY public ./public
COPY src ./src

# 创建.env文件
RUN echo "REACT_APP_API_URL=" > .env

# 构建应用
ENV GENERATE_SOURCEMAP=false
# Keep Webpack, Babel, minimizer and ESLint caches across source changes.
RUN --mount=type=cache,id=ai-chat-edu-frontend-compile-node16,target=/app/node_modules/.cache,sharing=locked \
    npm run build

# 生产环境
FROM nginx:alpine

# 从构建阶段复制构建文件
COPY --from=build /app/build /usr/share/nginx/html

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]