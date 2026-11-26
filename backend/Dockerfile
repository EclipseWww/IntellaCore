# Node 22.13+：服务器 Python 判题依赖 Node 权限模型（--permission）隔离学生代码
FROM node:22-bullseye

# 换源为清华源
RUN sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list && \
    sed -i 's/security.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list

WORKDIR /app

# 容器默认是 UTC。设为北京时间：日志时间、按天切分日志、“今天”的统计范围、导出表格中的时间均按北京时间；
# 其他时区的学校可在 Compose 的 environment 中覆盖 TZ
ENV TZ=Asia/Shanghai




# 其余部分保持不变...

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .



# Create upload directory
RUN mkdir -p uploads logs

# Expose the port
EXPOSE 5003

# Start the application
CMD ["npm", "start"]