# 部署文件

根目录仅保留日常使用的 docker-compose.yml。

- compose/：镜像构建、镜像部署及 Toolbox 兼容配置。
- scripts/build-and-push-windows.ps1：当前 Windows 构建推送入口，可在任意目录调用。
- scripts/：配置保留与历史部署脚本；历史脚本仍按原文件布局编写，执行前应审阅。
- docs/：旧文档跳转及 Nginx 专题。

完整说明见 [部署指南](../docs/DEPLOYMENT.md)。

在仓库根目录执行构建：

```powershell
.\deploy\scripts\build-and-push-windows.ps1 -AliyunUsername <你的仓库用户名>
```

直接使用子目录 Compose 时，必须从仓库根目录加 --project-directory .，使构建上下文、.env 和数据目录继续相对于项目根目录解析：

```sh
docker compose --project-directory . -f deploy/compose/docker-compose.build.yml build
```

机房现有 E 盘项目根目录的 docker-compose.yml 不移动。机房继续按原命令更新，不需跟随源码中的归档布局调整。旧机房如果只部署 Compose 文件，DOCKER_UPGRADE 文档中的 -f 路径应替换为该机房实际文件路径。
