const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '学习平台 API 文档',
      version: '1.0.0',
      description: '这是学习平台的API文档，提供了所有可用的API接口说明',
      contact: {
        name: '技术支持',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5003/api',
        description: '开发服务器'
      }
    ],
    tags: [
      { name: '认证', description: '用户认证相关API' },
      { name: '课程', description: '课程相关API' },
      { name: '课时', description: '课时相关API' },
      { name: '资源', description: '资源相关API' },
      { name: '作业', description: '作业相关API' },
      { name: '班级', description: '班级相关API' },
      { name: '测验', description: '测验相关API' },
      { name: '用户', description: '用户相关API' },
      { name: '分析', description: '数据分析相关API' },
      { name: 'AI', description: 'AI相关API' },
      { name: '打字练习', description: '打字练习相关API' },
      { name: '备份', description: '系统备份相关API' },
      { name: '设置', description: '系统设置相关API' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '输入JWT令牌: Bearer {token}'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = swaggerDocs; 