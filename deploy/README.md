# 部署文件

根目录仅保留日常使用的 docker-compose.yml。

- compose/：镜像构建、镜像部署及 Toolbox 兼容配置。
- scripts/build-and-push-windows.ps1：当前 Windows 构建推送入口，可在任意目录调用。
- scripts/：配置保留与历史部署脚本；历史脚本仍按原文件布局编写，执行前应审阅。
- 部署、更新和 Nginx 配置说明统一见 [部署与运维手册](../docs/DEPLOYMENT.md)。

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

## 个人配置与公开示例

不带 `.example` 的个人镜像配置与脚本仅保留在本机，已加入 Git 忽略规则。现有维护者继续使用原命令，不必更换路径。其他使用者可直接在根目录运行 `docker compose up -d --build`，无需了解维护者镜像仓库。

需要自行发布镜像时，复制 `deploy/compose/docker-compose.build.example.yml` 为同目录的 `docker-compose.build.yml`，将示例镜像地址换成自己的地址，再执行上文命令。镜像部署和脚本同理：复制对应 `.example` 文件，删除文件名中的 `.example` 后按自己的环境填写。历史脚本只供参考，需先核对路径。
