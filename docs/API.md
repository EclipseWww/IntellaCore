# API 参考

运行后可访问 `/api-docs` 查看由路由注释生成的 Swagger 文档。以下示例用于理解接口分组，权限和字段以当前路由及控制器实现为准。

## API 参考文档

## 基础配置

- 基础 URL: `http://localhost:5003/api`
- 所有请求需要在 header 中包含 `Authorization: Bearer {token}`
- 默认返回格式为 JSON

## 统一文件下载 API

### 下载文件

```http
GET /download/:fileType/*
```

用于统一处理所有类型的文件下载，包括作业文件、教学资源和 PDF 预览等。

#### 参数说明

- `fileType`: 文件类型
  - `assignment`: 学生提交的作业
  - `resource`: 教师上传的资源
  - `preview`: PDF 预览文件
- `*`: 文件的相对路径

#### 示例

```http
## 下载作业文件
GET /download/assignment/67aa95861b8ed17ee5b54afe/67ad35a3b0cfd67b311a4eb7/67ad35a7b0cfd67b311a4ec0/67ad558f12b048f8b427e37d/1739839449696-223406997.docx

## 下载教学资源
GET /download/resource/course123/unit456/lesson789/resource.pdf

## 下载 PDF 预览
GET /download/preview/67aa95861b8ed17ee5b54afe/67ad35a3b0cfd67b311a4eb7/preview.pdf
```

#### 响应

- 成功：返回文件流
- 失败：返回错误信息
  ```json
  {
    "message": "文件不存在",
    "error": "错误详情"
  }
  ```

## 作业管理 API

### 提交作业

```http
POST /courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/submit
```

用于学生提交作业。

#### 请求体

- `Content-Type: multipart/form-data`
- 参数：
  - `file`: 作业文件
  - `comment`: 提交说明（可选）

#### 响应

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

### 获取作业提交列表（教师）

```http
GET /courses/:courseId/units/:unitId/lessons/:lessonId/activities/:activityId/teacher-submissions
```

用于教师获取学生的作业提交列表。

#### 响应

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

### 批阅作业

```http
POST /submissions/:submissionId/grade
```

用于教师批阅作业。

#### 请求体

```json
{
  "score": 10,
  "feedback": "评语内容"
}
```

#### 响应

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

## 课程资源 API

### 上传课程资源

```http
POST /courses/:courseId/units/:unitId/lessons/:lessonId/activities/resources
```

用于教师上传课程资源。

#### 请求体

- `Content-Type: multipart/form-data`
- 参数：
  - `file`: 资源文件
  - `title`: 资源标题（可选）
  - `description`: 资源描述（可选）

#### 响应

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

### 删除课程资源

```http
DELETE /courses/:courseId/units/:unitId/lessons/:lessonId/resources/:filename
```

用于教师删除课程资源。

#### 响应

```json
{
  "success": true,
  "message": "资源删除成功"
}
```

## 错误响应

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

## 注意事项

1. 所有请求都需要携带有效的 JWT token
2. 文件上传大小限制为 20MB
3. 支持的文件类型：
   - 文档：.doc, .docx, .pdf, .txt
   - 表格：.xls, .xlsx
   - 演示：.ppt, .pptx
   - 代码：.py, .js
   - 其他：.json, .csv 
## 课程单元与课时 API 文档

## 通用说明

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

## 课程单元 API

### 1. 获取课程的所有单元

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

### 2. 创建课程单元

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

### 3. 获取单元详情

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

### 4. 更新课程单元

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

### 5. 删除课程单元

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

### 6. 调整单元顺序

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

## 课时 API

### 1. 创建课时

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

### 2. 获取单元的所有课时

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

### 3. 获取课时详情

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

### 4. 更新课时

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

### 5. 删除课时

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

### 6. 更新课时教学计划

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

### 7. 更新课时资源

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

### 8. 获取课时统计数据

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

## 错误代码

- 400: 请求参数错误
- 401: 未认证或认证失败
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器内部错误

