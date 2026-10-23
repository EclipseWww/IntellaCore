# 开发手册

面向参与代码开发的维护者，按需阅读：

- [系统架构](#系统架构)
- [开发与维护](#开发与维护)
- [接口参考](#接口参考)
- [PPT 自动评分](#ppt-自动评分)
- [Excel 自动评分](#excel-自动评分)

## 系统架构


React + Ant Design 前端通过 services/api.js 调用 Express REST API；后端使用 Mongoose 访问 MongoDB，JWT 中间件负责认证，角色中间件限制管理操作。

### 目录职责

- frontend/src/pages：学生、教师、管理员页面。
- frontend/src/layouts：各角色页面框架。
- frontend/src/components：复用组件及教学功能组件。
- backend/src/routes：HTTP 路由和权限入口。
- backend/src/controllers：请求校验与业务编排。
- backend/src/services：评分、任务调度等业务服务。
- backend/src/models：MongoDB 数据模型。
- backend/src/middleware：认证及权限控制。
- backend/src/scripts：初始化与维护工具，执行前应审阅数据修改范围。
- deploy：部署脚本及历史部署配置。

### 数据和运行边界

数据库保存账户、课程、提交、设置等数据；上传文件、日志、备份位于运行数据目录，不应进入源码仓库。AI 服务凭据只由后端环境提供。前端环境变量会进入公开构建产物，不能保存秘密。

学生退出密码通过管理员控制台设置，使用 bcrypt 哈希存储。学生退出时后端验证密码，未配置时拒绝退出。此功能用于课堂交互约束，浏览器用户仍可主动清除本地存储。


## 开发与维护


日常开发入口见 [贡献指南](../CONTRIBUTING.md)。本文汇总初始化、数据一致性、构建及维护说明。

### 管理员初始化

#### 管理员初始化与本次升级

不需要修改 Docker Compose、MongoDB 5.0 镜像或现有数据库部署。更新代码/应用镜像后，兑换恢复任务会在后端启动时自动运行，每30秒继续处理未完成的兑换。

#### 首次设置管理员

打开平台网站，会自动进入“首次设置”页面（也可直接访问 `/setup`）：

1. 设置管理员账号、姓名和密码，确认密码。
2. 点击“完成设置”。
3. 点击“进入登录页面”，使用刚设置的账号登录管理后台。

密码至少6个字符、最多72字节。完成后初始化入口自动关闭，重启服务也不会重新开放；即使以后删除了管理员账号，也不能再次通过此页面初始化。公开注册始终关闭。后续由管理员后台创建教师，教师或管理员批量导入学生。

全新部署无需输入命令或修改 Docker 配置。首次设置应由部署者在可信的本机或机房网络完成，再将访问地址发给其他用户；全新空数据库没有现有身份可供校验，因此最先完成设置的人会成为管理员。

#### 可选的服务器初始化命令

保留命令行方式供维护人员或自动化部署使用，普通使用者不需要执行（将 backend 替换为实际 Compose 服务名）：

```sh
docker compose exec backend npm run init-admin
```

按提示设置用户名和密码，密码不会回显。密码至少6个字符、最多72字节。旧版 `docker-compose` 命令同样适用。本地开发在 backend 目录执行 `npm run init-admin`。

网页和脚本均将管理员保存为正常的数据库用户，沿用 User 模型的 bcrypt 加密逻辑；系统初始化后拒绝重复初始化，并发初始化也不会生成两个初始账号。

非交互环境可以通过 `INIT_ADMIN_USERNAME`、`INIT_ADMIN_PASSWORD` 注入初始化凭据，执行后应移除；不要将密码写入源码或命令行参数。

#### 已在使用的机房升级

旧版内置的 admin 账号不在数据库中。本次删除了该默认账号及 `ADMIN_PASSWORD` 登录旁路；如果数据库中尚无管理员，**更新后打开网站，按照首次设置页面的提示创建管理员即可**。已有教师时，页面要求先验证一个现有且启用的教师账号及密码，避免学生或陌生人抢先创建管理员。可以继续使用原管理员用户名，但必须自行设置符合要求的新密码。原教师、学生、班级、积分和作业数据不迁移、不清空。

如果数据库中已有正常管理员，直接用该账号登录，不需要初始化。旧的管理员令牌失效，需要重新登录；教师、学生的正常登录流程保留，学生的新会话与令牌均为两小时（旧会话按原有到期时间结束）。

#### 单机 MongoDB 下的兑换一致性

库存和积分分别使用带持久化回执的原子更新，处理记录保存在 ShopOperation。每个处理记录的库存和积分结果固定，重试不会重复扣减；库存不足不扣积分，积分不足则幂等归还库存。兑换券使用固定ID创建，数据库暂时不可用时接口返回202和“处理中”，恢复任务继续完成。

这是可恢复的多步处理，不是跨集合事务：处理中可能短暂看到库存或余额先变化，最终成功后才出现兑换券。数据库恢复前不要再次点击兑换。游戏时间发放与防重复回执在用户文档内同时写入，记录状态更新失败后重试不会重复发放。

回执用于跨重启去重，不能自行删除；商品“删除”改为下架并保留记录，以便恢复未完成兑换及使用已购买的券。现有商品和积分记录缺少新字段时自动按空回执处理，不需要数据迁移。

#### 验证

在 backend 目录执行 `npm test`。上线前建议在测试机用现有 MongoDB 5.0 实例检查兑换、断线恢复和管理员初始化；自动化用例模拟了数据库原子更新与中断，不能替代真实数据库验证。


### 测验与众筹一致性

#### 测验与众筹一致性

此轮修改无需更改 Docker、MongoDB 拓扑或人工执行数据迁移。新增字段、操作记录集合和索引由应用模型管理，旧记录保持兼容。

#### 测验

- 学生从已发布且可访问的课程活动进入测验，服务端校验活动关联的测验。
- 答题前不返回正确选项、解析或快照中的答案；题库接口限教师、管理员访问。
- 答题次数使用固定槽位和稀疏唯一索引约束，并发保存使用版本校验。
- 先保存答题记录及积分同步标记，再同步积分。同一测验按学生最高成绩奖励差额。
- 积分余额与已计奖成绩在同一个成就文档中原子更新。重复同步不重复奖励。
- 删除答题记录保留内部删除标记，页面和统计不展示，积分按剩余最高成绩重新同步。已消费积分的撤销不会使余额为负。
- 旧记录首次参与同步时作为既有奖励基线，避免重复奖励；不自动重算所有历史积分。

#### 众筹

- 仅允许所在班级的学生贡献正整数积分；封顶后的实际贡献可少于请求金额。
- 众筹文档原子预留剩余额度，积分文档原子检查余额并扣分，随后确认众筹进度、参与者和贡献记录。
- 每个操作使用固定身份，各资源同时保存处理凭据。断线后重试不会重复预留、扣分或确认。
- 余额不足时释放预留。正在处理的贡献或有预留的活动不能删除。
- 请求遇到中断时返回“处理中”，页面提示不要重复提交。

应用启动及每 30 秒扫描未完成的积分、众筹操作。恢复过程需要数据库重新可用。处理凭据不能随意裁剪，否则会破坏重试安全性。

#### 验证范围

回归测试覆盖控制器权限、索引定义、并发交错、原子更新表达式、提交保存失败及多个阶段丢失响应后的重试。当前未在真实 MongoDB 5.0 容器上执行故障注入测试，也未执行前端或 Docker build。


### 前端构建与缓存

#### Frontend Docker builds

The Dockerfile uses BuildKit cache mounts for npm downloads and CRA's Webpack/Babel/minimizer/ESLint cache. A source edit reruns compilation while preserving the previous compiler cache. Dependency installation retains npm install because the existing lockfile has an incomplete transitive peer-dependency entry and fails npm ci validation. npm download caching remains enabled; production optimization and ESLint remain enabled. Switch to npm ci only after repairing and validating the complete lockfile with the target container npm version.

On a Linux build host, run:

```sh
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose --project-directory . -f deploy/compose/docker-compose.build.yml build frontend
```

For the older Compose command, substitute docker-compose for docker compose. The build-and-push.sh script exports both variables automatically.

The first build after this change creates the caches. Compare the npm run build duration on the second build after a small source change, using the same builder. A completely unchanged build should reuse the build layer. Avoid routine docker builder prune/docker system prune or disposable builders, which may remove these caches. Cache mounts are local to the builder; pushing the runtime nginx image does not transfer compiler caches to another host.

BuildKit must support Dockerfile RUN --mount=type=cache. The runtime image and nginx settings are unchanged. No build-time ESLint or production minification checks are disabled.

If builds remain slow, inspect the host during compilation with docker stats, free -h and vmstat 1. Sustained swap usage suggests insufficient memory; fully utilized CPUs suggest compilation/minification limits. Measure before increasing the Node heap or changing CPU limits. The available memory and any configured container limits both matter.


### 维护脚本

#### 数据库清理脚本

本目录包含用于数据库维护和清理的脚本。

#### 打字记录清理脚本 (cleanTypingRecords.js)

该脚本用于清理打字记录表中的异常和重复数据。

#### 功能

1. 删除速度大于100字/分钟的异常记录
2. 去重，去掉同一用户在同一分钟内的重复记录，只保留其中一条

#### 使用方法

从项目根目录运行以下命令：

```bash
#### 进入后端目录
cd backend

#### 运行清理脚本
node src/scripts/cleanTypingRecords.js
```

#### 日志

脚本执行过程中的日志将保存在 `backend/logs` 目录下，包括：

- `combined-YYYY-MM-DD.log`: 包含所有级别的日志
- `error-YYYY-MM-DD.log`: 仅包含错误级别的日志

同时，日志也会在控制台输出。




## 接口参考


运行后可访问 `/api-docs` 查看由路由注释生成的 Swagger 文档。以下示例用于理解接口分组，权限和字段以当前路由及控制器实现为准。

### API 参考文档

### 基础配置

- 基础 URL: `http://localhost:5003/api`
- 所有请求需要在 header 中包含 `Authorization: Bearer {token}`
- 默认返回格式为 JSON

### 统一文件下载 API

#### 下载文件

```http
GET /download/:fileType/*
```

用于统一处理所有类型的文件下载，包括作业文件、教学资源和 PDF 预览等。

##### 参数说明

- `fileType`: 文件类型
  - `assignment`: 学生提交的作业
  - `resource`: 教师上传的资源
  - `preview`: PDF 预览文件
- `*`: 文件的相对路径

##### 示例

```http
### 下载作业文件
GET /download/assignment/67aa95861b8ed17ee5b54afe/67ad35a3b0cfd67b311a4eb7/67ad35a7b0cfd67b311a4ec0/67ad558f12b048f8b427e37d/1739839449696-223406997.docx

### 下载教学资源
GET /download/resource/course123/unit456/lesson789/resource.pdf

### 下载 PDF 预览
GET /download/preview/67aa95861b8ed17ee5b54afe/67ad35a3b0cfd67b311a4eb7/preview.pdf
```

##### 响应

- 成功：返回文件流
- 失败：返回错误信息
  ```json
  {
    "message": "文件不存在",
    "error": "错误详情"
  }
  ```

### 作业管理 API

#### 提交作业

```http
POST /courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/submit
```

用于学生提交作业。

##### 请求体

- `Content-Type: multipart/form-data`
- 参数：
  - `file`: 作业文件
  - `comment`: 提交说明（可选）

##### 响应

```json
{
  "success": true,
  "message": "作业提交成功",
  "data": {
    "id": "作业ID",
    "status": "submitted",
    "submittedAt": "提交时间"
  }
}
```

#### 获取作业提交列表（教师）

```http
GET /courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/teacher-submissions
```

用于教师获取学生的作业提交列表。

##### 响应

```json
[
  {
    "_id": "提交ID",
    "student": {
      "name": "学生姓名",
      "studentId": "学号",
      "grade": "年级",
      "className": "班级"
    },
    "content": {
      "files": [{
        "originalName": "原始文件名",
        "path": "文件路径",
        "pdfPreviewPath": "预览文件路径"
      }]
    },
    "status": "submitted/graded",
    "grade": {
      "score": "分数",
      "feedback": "评语"
    }
  }
]
```

#### 批阅作业

```http
POST /submissions/:submissionId/grade
```

用于教师批阅作业。

##### 请求体

```json
{
  "score": 10,
  "feedback": "评语内容"
}
```

##### 响应

```json
{
  "success": true,
  "message": "批阅成功",
  "data": {
    "id": "作业ID",
    "status": "graded",
    "grade": {
      "score": 10,
      "feedback": "评语内容",
      "gradedAt": "批阅时间"
    }
  }
}
```

### 课程资源 API

#### 上传课程资源

```http
POST /courses/:courseId/units/:unitId/lessons/:lessonId/activities/resources
```

用于教师上传课程资源。

##### 请求体

- `Content-Type: multipart/form-data`
- 参数：
  - `file`: 资源文件
  - `title`: 资源标题（可选）
  - `description`: 资源描述（可选）

##### 响应

```json
{
  "success": true,
  "message": "资源上传成功",
  "data": {
    "id": "资源ID",
    "filename": "文件名",
    "originalName": "原始文件名",
    "path": "文件路径",
    "uploadedAt": "上传时间"
  }
}
```

#### 删除课程资源

```http
DELETE /courses/:courseId/units/:unitId/lessons/:lessonId/resources/:filename
```

用于教师删除课程资源。

##### 响应

```json
{
  "success": true,
  "message": "资源删除成功"
}
```

### 错误响应

所有 API 在发生错误时都会返回统一格式的错误响应：

```json
{
  "message": "错误描述",
  "error": "详细错误信息（仅在开发环境中返回）"
}
```

常见错误状态码：
- 400: 请求参数错误
- 401: 未授权或 token 无效
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误

### 注意事项

1. 所有请求都需要携带有效的 JWT token
2. 文件上传大小限制为 20MB
3. 支持的文件类型：
   - 文档：.doc, .docx, .pdf, .txt
   - 表格：.xls, .xlsx
   - 演示：.ppt, .pptx
   - 代码：.py, .js
   - 其他：.json, .csv
### 课程单元与课时 API 文档

### 通用说明

- 基础路径: `/api/course-units`
- 认证要求: 所有接口都需要在请求头中包含 JWT Token
  ```
  Authorization: Bearer <your_token>
  ```
- 错误响应格式:
  ```json
  {
    "message": "错误信息"
  }
  ```

### 课程单元 API

#### 1. 获取课程的所有单元

获取指定课程的所有单元，包括其层级结构。

- **URL**: `/course/:courseId/units`
- **方法**: `GET`
- **URL 参数**:
  - `courseId`: 课程ID
- **成功响应** (200):
  ```json
  [
    {
      "_id": "单元ID",
      "title": "单元标题",
      "description": "单元描述",
      "type": "chapter",
      "order": 1,
      "children": [
        {
          "_id": "子单元ID",
          "title": "子单元标题",
          "type": "section",
          "order": 1,
          "children": []
        }
      ]
    }
  ]
  ```

#### 2. 创建课程单元

创建新的课程单元。

- **URL**: `/course/:courseId/units`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "title": "单元标题",
    "description": "单元描述",
    "type": "chapter|section|lesson",
    "order": 1,
    "parent": "父单元ID（可选）",
    "content": {
      "text": "内容文本",
      "resources": []
    }
  }
  ```
- **成功响应** (201):
  ```json
  {
    "_id": "新创建的单元ID",
    "title": "单元标题",
    "description": "单元描述",
    "type": "chapter",
    "order": 1
  }
  ```

#### 3. 获取单元详情

获取单个课程单元的详细信息。

- **URL**: `/units/:unitId`
- **方法**: `GET`
- **URL 参数**:
  - `unitId`: 单元ID
- **成功响应** (200):
  ```json
  {
    "_id": "单元ID",
    "title": "单元标题",
    "description": "单元描述",
    "type": "chapter",
    "order": 1,
    "parent": {
      "_id": "父单元ID",
      "title": "父单元标题"
    },
    "children": [],
    "lessonDetails": null
  }
  ```

#### 4. 更新课程单元

更新现有课程单元的信息。

- **URL**: `/units/:unitId`
- **方法**: `PUT`
- **请求体**:
  ```json
  {
    "title": "更新的标题",
    "description": "更新的描述",
    "content": {
      "text": "更新的内容"
    }
  }
  ```
- **成功响应** (200):
  ```json
  {
    "_id": "单元ID",
    "title": "更新的标题",
    "description": "更新的描述"
  }
  ```

#### 5. 删除课程单元

删除指定的课程单元。

- **URL**: `/units/:unitId`
- **方法**: `DELETE`
- **URL 参数**:
  - `unitId`: 单元ID
- **成功响应** (200):
  ```json
  {
    "message": "单元已删除"
  }
  ```

#### 6. 调整单元顺序

批量更新课程单元的顺序。

- **URL**: `/course/:courseId/units/reorder`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "units": [
      {
        "id": "单元1ID",
        "order": 1
      },
      {
        "id": "单元2ID",
        "order": 2
      }
    ]
  }
  ```
- **成功响应** (200):
  ```json
  {
    "message": "顺序已更新"
  }
  ```

### 课时 API

#### 1. 创建课时

为指定单元创建新的课时。

- **URL**: `/units/:unitId/lessons`
- **方法**: `POST`
- **请求体**:
  ```json
  {
    "title": "课时标题",
    "description": "课时描述",
    "order": 1,
    "teachingPlan": {
      "objectives": ["目标1", "目标2"],
      "prerequisites": ["预备知识1"],
      "steps": [
        {
          "title": "步骤1",
          "duration": 15,
          "type": "lecture",
          "content": "步骤内容"
        }
      ]
    },
    "resources": {
      "mainContent": {
        "type": "video",
        "content": "视频URL"
      }
    }
  }
  ```
- **成功响应** (201):
  ```json
  {
    "_id": "课时ID",
    "title": "课时标题",
    "description": "课时描述",
    "unit": "单元ID",
    "course": "课程ID"
  }
  ```

#### 2. 获取单元的所有课时

获取指定单元下的所有课时。

- **URL**: `/units/:unitId/lessons`
- **方法**: `GET`
- **URL 参数**:
  - `unitId`: 单元ID
- **成功响应** (200):
  ```json
  [
    {
      "_id": "课时ID",
      "title": "课时标题",
      "description": "课时描述",
      "order": 1
    }
  ]
  ```

#### 3. 获取课时详情

获取单个课时的详细信息。

- **URL**: `/lessons/:lessonId`
- **方法**: `GET`
- **URL 参数**:
  - `lessonId`: 课时ID
- **成功响应** (200):
  ```json
  {
    "_id": "课时ID",
    "title": "课时标题",
    "description": "课时描述",
    "teachingPlan": {},
    "resources": {},
    "unit": {
      "_id": "单元ID",
      "title": "单元标题"
    },
    "course": {
      "_id": "课程ID",
      "title": "课程标题"
    }
  }
  ```

#### 4. 更新课时

更新现有课时的信息。

- **URL**: `/lessons/:lessonId`
- **方法**: `PUT`
- **请求体**:
  ```json
  {
    "title": "更新的标题",
    "description": "更新的描述",
    "teachingPlan": {},
    "resources": {}
  }
  ```
- **成功响应** (200):
  ```json
  {
    "_id": "课时ID",
    "title": "更新的标题",
    "description": "更新的描述"
  }
  ```

#### 5. 删除课时

删除指定的课时。

- **URL**: `/lessons/:lessonId`
- **方法**: `DELETE`
- **URL 参数**:
  - `lessonId`: 课时ID
- **成功响应** (200):
  ```json
  {
    "message": "课时已删除"
  }
  ```

#### 6. 更新课时教学计划

更新课时的教学计划。

- **URL**: `/lessons/:lessonId/teaching-plan`
- **方法**: `PUT`
- **请求体**:
  ```json
  {
    "objectives": ["新目标1", "新目标2"],
    "prerequisites": ["新预备知识1"],
    "steps": [
      {
        "title": "新步骤1",
        "duration": 20,
        "type": "practice",
        "content": "新步骤内容"
      }
    ]
  }
  ```
- **成功响应** (200):
  ```json
  {
    "_id": "课时ID",
    "teachingPlan": {
      "objectives": ["新目标1", "新目标2"],
      "prerequisites": ["新预备知识1"],
      "steps": []
    }
  }
  ```

#### 7. 更新课时资源

更新课时的学习资源。

- **URL**: `/lessons/:lessonId/resources`
- **方法**: `PUT`
- **请求体**:
  ```json
  {
    "mainContent": {
      "type": "video",
      "content": "新视频URL"
    },
    "supplementary": [
      {
        "title": "补充资料1",
        "type": "document",
        "url": "文档URL"
      }
    ]
  }
  ```
- **成功响应** (200):
  ```json
  {
    "_id": "课时ID",
    "resources": {
      "mainContent": {},
      "supplementary": []
    }
  }
  ```

#### 8. 获取课时统计数据

获取课时的学习统计数据。

- **URL**: `/lessons/:lessonId/analytics`
- **方法**: `GET`
- **URL 参数**:
  - `lessonId`: 课时ID
- **成功响应** (200):
  ```json
  {
    "averageCompletionTime": 45,
    "difficultyRating": 3.5,
    "engagementRate": 0.85,
    "totalViews": 100,
    "averageRating": 4.2,
    "completionRate": 0.75,
    "commonQuestions": [
      {
        "question": "常见问题1",
        "frequency": 10
      }
    ]
  }
  ```

### 错误代码

- 400: 请求参数错误
- 401: 未认证或认证失败
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误



## PPT 自动评分


新配置通过重新解析得分点并保存生效。保留旧规则的评分入口，但需要重新解析才能获得新增考点。

当前读取演示文稿关系列表确定实际页序，读取 presProps.xml 中放映范围和循环设置。版式使用关联的 slideLayout；切换效果读取真实效果子节点；切换声音优先比较嵌入文件哈希，缺少文件时比较声音名称。超链接核对具体对象、网址、实际目标页和动作，不按数量替代目标检查。

动画根据预设节点关联目标对象，区分效果、方向子类型和开始方式。支持同数量动画的修改、指定对象动画删除。文字字体、字号、颜色、加粗、斜体分别评分，检查各文字段；显式段落对齐和行距也生成独立要求。

新增背景填充类型、图案、前景与背景色、图片内容哈希和透明度检查；新增表格每格文字样式、组合状态、对象形状、尺寸、现有对象相对叠放顺序和删除检查。宽高作为独立可选得分点，默认不启用，题目要求时单独启用；母版图片同样独立。图片识别和插入图片分不比较宽高。宽高容差0.01厘米。按用户要求不生成或评分任何x/y位置坐标，包括旧规则、组合子规则、文本图片匹配及母版图片；保留叠放顺序和字体字号检查。无文本动作按钮及空文本框保留在对象结构中。

### 等待WPS样例校准

测试使用构造的 OOXML。尚不能保证母版/主题继承、WPS扩展动画、内置声音的所有编码方式、复杂组合坐标或其他办公软件重写对象名称等情况完全兼容。音视频按具体对象及其播放时间树解析，用嵌入内容哈希匹配；同一对象的 videoFile/audioFile 与 p14:media 引用合并，封面图不额外作为插图计分。不同办公软件的扩展播放时间树仍需要实际样例校准。

插入幻灯片时按现有对象内容和图片哈希对应原始页，避免将后移的原有页当作删除和新增；内容重复的页面、页面同时大量改写等情况仍需核对。手动未改的继承格式、仅通过原始/参考文件推断题目意图、退出软件等不可直接证明的过程，不能保证自动识别。

中国传统节日样例校准发现并修复：切换声音和动画声音不再当独立媒体对象计分；动画声音绑定到预设效果，并通过音频内容哈希匹配。读取旋转角度参数，逆时针360度对应 -21600000；动画开始和时长作为可选参数默认禁用，题目要求时启用。母版图片按内容匹配并核对其关联到的各页，按正确页比例计分，反馈列出缺失页码；不判断坐标，尺寸另设默认关闭的独立项。

支持 criteriaGroup 规则，children 为子检查，scoringMode=all 时全部要求通过才能得到整组分数；结果保留子项详情。traditional-festival-calibration.json 是这组示例的核对配置，假设五个操作各2分、整步全部达标，复现样例2/4/10分；该假设不是通用默认评分方式，配置未自动写入任何课时。

运行：`node --test src/services/pptAutoGradeService.test.js`。

不生成幻灯片顺序得分点。


## Excel 自动评分


在课时的练习活动中允许 XLSX 提交，保存活动后上传原始工作簿及完成操作的参考答案。系统提取差异生成得分点，教师核对、禁用无关变化、调整权重并保存。评阅页支持单份、批量评阅和仅看错题，总分按启用得分点权重折算为 10 分。相同工作表、属性、目标格式的单元格合并为一个得分点；填充公式及对应结果按函数类别合并；相同线型颜色的各边框也合并。每组默认 1 分，内部逐项检查，按通过比例给分。配置和评阅结果均可展开查看具体单元格。旧配置需重新解析再保存，以启用分组；旧格式规则仍可正常评阅。

### 得分点

- 每个单元格的数据、公式、数字格式分别评分；字体名称、字号、颜色等分别评分。
- 水平与垂直对齐、自动换行、合并关系分别评分；跨列居中与合并居中区分。
- 每格每条边框分别评分（包括线型和颜色），填充、每列列宽、每行行高分别评分。
- 新增、删除、重命名工作表通过名称存在性检查，移动通过前置工作表检查。
- 复制、删除左移、序列填充、排序的数据结果通过相应单元格逐一比较；筛选及排序参数读取保存的 OOXML，笔画排序参数包含在检查中。
- 图表类型、方向、分组、标题和数据源分别评分。
- 条件格式检查应用区域、条件表达式及样式；忽略无意义的优先级编号差异，保留规则顺序。

### 计算与边界

支持重新计算四则运算、幂、百分比、跨表引用、SUM、AVERAGE、MIN、MAX、COUNT、COUNTA、COUNTIF、ROUND、IF、IFERROR、AND、OR、NOT、ABS 和 INT，比较运算及字符串连接。不执行任何工作簿代码。公式重算不会信任陈旧缓存；同一函数的等价表达式、SUM/COUNT 与 AVERAGE 可接受；单纯手填正确数值只能拿结果分。浮点结果采用相对容差 1e-8。

Excel 不产生人工复核状态；不支持的公式、循环引用或计算错误对应检查判为未通过，并显示计算失败原因，最终成绩和积分正常更新。支持 XLSX；旧版 XLS 请转换后提交。保存的最终文件无法证明学生是否退出软件、是否点击最适合行高；行高只核对最终值。主题色和直接 RGB 色按文件编码核对。图表定位及样式不在当前自动得分点范围内。

参考答案需要完整、准确。所有文件差异都可能成为得分点，教师必须检查题目未要求的变化，以及排序、复制等操作附带的格式变化。当前按同类要求分组，不会自动理解题目自然语言；教师仍应根据题目步骤调整各组权重。

样题素材和参考答案尚未提供，当前回归测试使用生成的 XLSX，并注入 OOXML 覆盖筛选、排序与图表结构。运行：`node --test src/services/excelAutoGradeService.test.js`。
