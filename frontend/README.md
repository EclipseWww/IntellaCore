# 前端开发

macOS、Windows 和 Linux 均在 `frontend` 目录运行：

```sh
npm start
```

默认端口为 3000，API 请求通过开发服务器代理到本机 5003 端口。
启动脚本保留原有的开发默认设置（监听 `0.0.0.0`、关闭 Fast Refresh 和主机名校验），不需要新增依赖。
热更新 WebSocket 默认使用浏览器当前页面的主机和端口，支持从其他设备访问。

可通过环境变量或未提交的 `frontend/.env.local` 覆盖设置。例如，德国 Mac mini 仅通过 Tailscale 提供开发访问：

```dotenv
HOST=100.119.175.107
PORT=3000
BROWSER=none
```

其他开发者请使用自己设备的地址；不要将此 IP 写入共享配置。
开发服务器应仅用于可信网络，不要向公网暴露。`WDS_SOCKET_HOST` 和 `WDS_SOCKET_PORT` 如有特殊代理需求仍可自行设置。

Docker 生产部署继续使用 `npm run build` 生成静态文件并由 Nginx 提供服务，不使用开发启动脚本。
