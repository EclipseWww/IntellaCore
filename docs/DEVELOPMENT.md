# 开发与维护手册

日常开发入口见 [贡献指南](../CONTRIBUTING.md)。本文汇总初始化、数据一致性、构建及维护说明。

## 管理员初始化

### 管理员初始化与本次升级

不需要修改 Docker Compose、MongoDB 5.0 镜像或现有数据库部署。更新代码/应用镜像后，兑换恢复任务会在后端启动时自动运行，每30秒继续处理未完成的兑换。

### 首次设置管理员

打开平台网站，会自动进入“首次设置”页面（也可直接访问 `/setup`）：

1. 设置管理员账号、姓名和密码，确认密码。
2. 点击“完成设置”。
3. 点击“进入登录页面”，使用刚设置的账号登录管理后台。

密码至少6个字符、最多72字节。完成后初始化入口自动关闭，重启服务也不会重新开放；即使以后删除了管理员账号，也不能再次通过此页面初始化。公开注册始终关闭。后续由管理员后台创建教师，教师或管理员批量导入学生。

全新部署无需输入命令或修改 Docker 配置。首次设置应由部署者在可信的本机或机房网络完成，再将访问地址发给其他用户；全新空数据库没有现有身份可供校验，因此最先完成设置的人会成为管理员。

### 可选的服务器初始化命令

保留命令行方式供维护人员或自动化部署使用，普通使用者不需要执行（将 backend 替换为实际 Compose 服务名）：

```sh
docker compose exec backend npm run init-admin
```

按提示设置用户名和密码，密码不会回显。密码至少6个字符、最多72字节。旧版 `docker-compose` 命令同样适用。本地开发在 backend 目录执行 `npm run init-admin`。

网页和脚本均将管理员保存为正常的数据库用户，沿用 User 模型的 bcrypt 加密逻辑；系统初始化后拒绝重复初始化，并发初始化也不会生成两个初始账号。

非交互环境可以通过 `INIT_ADMIN_USERNAME`、`INIT_ADMIN_PASSWORD` 注入初始化凭据，执行后应移除；不要将密码写入源码或命令行参数。

### 已在使用的机房升级

旧版内置的 admin 账号不在数据库中。本次删除了该默认账号及 `ADMIN_PASSWORD` 登录旁路；如果数据库中尚无管理员，**更新后打开网站，按照首次设置页面的提示创建管理员即可**。已有教师时，页面要求先验证一个现有且启用的教师账号及密码，避免学生或陌生人抢先创建管理员。可以继续使用原管理员用户名，但必须自行设置符合要求的新密码。原教师、学生、班级、积分和作业数据不迁移、不清空。

如果数据库中已有正常管理员，直接用该账号登录，不需要初始化。旧的管理员令牌失效，需要重新登录；教师、学生的正常登录流程保留，学生的新会话与令牌均为两小时（旧会话按原有到期时间结束）。

### 单机 MongoDB 下的兑换一致性

库存和积分分别使用带持久化回执的原子更新，处理记录保存在 ShopOperation。每个处理记录的库存和积分结果固定，重试不会重复扣减；库存不足不扣积分，积分不足则幂等归还库存。兑换券使用固定ID创建，数据库暂时不可用时接口返回202和“处理中”，恢复任务继续完成。

这是可恢复的多步处理，不是跨集合事务：处理中可能短暂看到库存或余额先变化，最终成功后才出现兑换券。数据库恢复前不要再次点击兑换。游戏时间发放与防重复回执在用户文档内同时写入，记录状态更新失败后重试不会重复发放。

回执用于跨重启去重，不能自行删除；商品“删除”改为下架并保留记录，以便恢复未完成兑换及使用已购买的券。现有商品和积分记录缺少新字段时自动按空回执处理，不需要数据迁移。

### 验证

在 backend 目录执行 `npm test`。上线前建议在测试机用现有 MongoDB 5.0 实例检查兑换、断线恢复和管理员初始化；自动化用例模拟了数据库原子更新与中断，不能替代真实数据库验证。


## 测验与众筹一致性

### 测验与众筹一致性

此轮修改无需更改 Docker、MongoDB 拓扑或人工执行数据迁移。新增字段、操作记录集合和索引由应用模型管理，旧记录保持兼容。

### 测验

- 学生从已发布且可访问的课程活动进入测验，服务端校验活动关联的测验。
- 答题前不返回正确选项、解析或快照中的答案；题库接口限教师、管理员访问。
- 答题次数使用固定槽位和稀疏唯一索引约束，并发保存使用版本校验。
- 先保存答题记录及积分同步标记，再同步积分。同一测验按学生最高成绩奖励差额。
- 积分余额与已计奖成绩在同一个成就文档中原子更新。重复同步不重复奖励。
- 删除答题记录保留内部删除标记，页面和统计不展示，积分按剩余最高成绩重新同步。已消费积分的撤销不会使余额为负。
- 旧记录首次参与同步时作为既有奖励基线，避免重复奖励；不自动重算所有历史积分。

### 众筹

- 仅允许所在班级的学生贡献正整数积分；封顶后的实际贡献可少于请求金额。
- 众筹文档原子预留剩余额度，积分文档原子检查余额并扣分，随后确认众筹进度、参与者和贡献记录。
- 每个操作使用固定身份，各资源同时保存处理凭据。断线后重试不会重复预留、扣分或确认。
- 余额不足时释放预留。正在处理的贡献或有预留的活动不能删除。
- 请求遇到中断时返回“处理中”，页面提示不要重复提交。

应用启动及每 30 秒扫描未完成的积分、众筹操作。恢复过程需要数据库重新可用。处理凭据不能随意裁剪，否则会破坏重试安全性。

### 验证范围

回归测试覆盖控制器权限、索引定义、并发交错、原子更新表达式、提交保存失败及多个阶段丢失响应后的重试。当前未在真实 MongoDB 5.0 容器上执行故障注入测试，也未执行前端或 Docker build。


## 前端构建与缓存

### Frontend Docker builds

The Dockerfile uses BuildKit cache mounts for npm downloads and CRA's Webpack/Babel/minimizer/ESLint cache. A source edit reruns compilation while preserving the previous compiler cache. Dependency installation retains npm install because the existing lockfile has an incomplete transitive peer-dependency entry and fails npm ci validation. npm download caching remains enabled; production optimization and ESLint remain enabled. Switch to npm ci only after repairing and validating the complete lockfile with the target container npm version.

On a Linux build host, run:

```sh
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose -f docker-compose.build.yml build frontend
```

For the older Compose command, substitute docker-compose for docker compose. The build-and-push.sh script exports both variables automatically.

The first build after this change creates the caches. Compare the npm run build duration on the second build after a small source change, using the same builder. A completely unchanged build should reuse the build layer. Avoid routine docker builder prune/docker system prune or disposable builders, which may remove these caches. Cache mounts are local to the builder; pushing the runtime nginx image does not transfer compiler caches to another host.

BuildKit must support Dockerfile RUN --mount=type=cache. The runtime image and nginx settings are unchanged. No build-time ESLint or production minification checks are disabled.

If builds remain slow, inspect the host during compilation with docker stats, free -h and vmstat 1. Sustained swap usage suggests insufficient memory; fully utilized CPUs suggest compilation/minification limits. Measure before increasing the Node heap or changing CPU limits. The available memory and any configured container limits both matter.


## 维护脚本

### 数据库清理脚本

本目录包含用于数据库维护和清理的脚本。

### 打字记录清理脚本 (cleanTypingRecords.js)

该脚本用于清理打字记录表中的异常和重复数据。

### 功能

1. 删除速度大于100字/分钟的异常记录
2. 去重，去掉同一用户在同一分钟内的重复记录，只保留其中一条

### 使用方法

从项目根目录运行以下命令：

```bash
### 进入后端目录
cd backend

### 运行清理脚本
node src/scripts/cleanTypingRecords.js
```

### 日志

脚本执行过程中的日志将保存在 `backend/logs` 目录下，包括：

- `combined-YYYY-MM-DD.log`: 包含所有级别的日志
- `error-YYYY-MM-DD.log`: 仅包含错误级别的日志

同时，日志也会在控制台输出。


