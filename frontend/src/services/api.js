import axios from 'axios';
import { uploadLessonPackage } from './lessonTransfer';
import { message } from 'antd';

// API 基础配置
export const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 添加一个健康检查函数
export const checkBackendHealth = async () => {
  try {
    const response = await axios.get('/api/health');
    console.log('Backend health check:', response.data);
    return response.data;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return { status: 'error', message: error.message };
  }
};

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn('未找到token');
    }

    // 添加真实客户端IP到请求头
    try {
      // 尝试获取客户端真实IP
      const clientIP = window.location.hostname;
      // 如果是localhost或127.0.0.1，尝试获取本机真实IP
      if (clientIP === 'localhost' || clientIP === '127.0.0.1') {
        // 使用当前浏览器URL中的主机名
        const currentHost = window.location.host.split(':')[0];
        if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
          config.headers['X-Client-Real-IP'] = currentHost;
        } else {
          // 如果仍然是localhost，则尝试使用当前文档的URL
          const documentHost = document.location.host.split(':')[0];
          config.headers['X-Client-Real-IP'] = documentHost;
        }
      } else {
        config.headers['X-Client-Real-IP'] = clientIP;
      }
    } catch (error) {
      console.error('获取客户端IP失败:', error);
    }

    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('响应错误:', {
        url: error.config?.url,
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
      // 如果是认证错误，清除本地存储的 token
      // 排除登录请求相关的API，因为这些API不需要认证
      if (error.response.status === 401) {
        const isLoginRequestApi = error.config?.url?.includes('/login-requests/');
        if (!isLoginRequestApi) {
          console.warn('认证失败，清除token');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // 只有在非登录页面时才重定向
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      }
    } else if (error.request) {
      console.error('请求错误:', error.request);
    } else {
      console.error('错误:', error.message);
    }
    return Promise.reject(error);
  }
);

// 聊天相关 API
export const chatAPI = {
  // 发送消息
  sendMessage: async (content, courseId, chapterId) => {
    try {
      const response = await api.post('/chat/send', { content, courseId, chapterId });
      return response.data;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  },

  // 获取聊天历史
  getMessageHistory: async (params) => {
    try {
      const response = await api.get('/chat/history', { params });
      return response.data;
    } catch (error) {
      console.error('获取聊天历史失败:', error);
      throw error;
    }
  },

  // 教师端：获取待审核学生汇总
  getPendingStudentsAggregate: async (params = {}) => {
    try {
      const response = await api.get('/chat/pending/students', { params });
      return response.data;
    } catch (error) {
      console.error('获取待审核学生汇总失败:', error);
      throw error;
    }
  },

  // 教师端：按学生获取该学生所有消息（可筛选，不分页）
  getMessagesByStudent: async (studentId, params = {}) => {
    try {
      const response = await api.get(`/chat/students/${studentId}/messages`, { params });
      return response.data;
    } catch (error) {
      console.error('按学生获取消息失败:', error);
      throw error;
    }
  },

  // 获取单个消息详情
  getMessageById: async (messageId) => {
    try {
      const response = await api.get(`/chat/message/${messageId}`);
      return response.data;
    } catch (error) {
      console.error('获取消息详情失败:', error);
      throw error;
    }
  },

  // 获取当前会话消息
  getCurrentSession: async () => {
    try {
      const response = await api.get('/chat/current-session');
      return response.data;
    } catch (error) {
      console.error('获取当前会话失败:', error);
      throw error;
    }
  },

  // 获取待审核消息
  getPendingMessages: async ({ page = 1, pageSize = 10 } = {}) => {
    try {
      const response = await api.get('/chat/messages/pending', {
        params: { page, pageSize }
      });
      return response.data;
    } catch (error) {
      console.error('获取待审核消息失败:', error);
      throw error;
    }
  },

  // 通过消息
  approveMessage: async (messageId) => {
    try {
      const response = await api.post(`/review/${messageId}`, {
        status: 'approved'
      });
      return response.data.message;
    } catch (error) {
      console.error('通过消息失败:', error);
      throw error;
    }
  },

  // 拒绝消息
  rejectMessage: async (messageId) => {
    try {
      const response = await api.post(`/review/${messageId}`, {
        status: 'rejected'
      });
      return response.data.message;
    } catch (error) {
      console.error('拒绝消息失败:', error);
      throw error;
    }
  }
  ,

  // 批量审核
  bulkReview: async ({ studentId, status, reviewComment, filters }) => {
    try {
      const response = await api.post('/review/bulk', { studentId, status, reviewComment, filters });
      return response.data;
    } catch (error) {
      console.error('批量审核失败:', error);
      throw error;
    }
  }
  ,

  // 导出聊天记录 CSV（教师/管理员/学生）
  exportChatCSV: async (params = {}) => {
    try {
      const token = localStorage.getItem('token');
      const query = new URLSearchParams(params).toString();
      const url = `/chat/export/csv${query ? `?${query}` : ''}`;
      const response = await api.get(url, { responseType: 'blob' });
      // 触发下载
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const href = window.URL.createObjectURL(blob);
      link.href = href;
      link.download = `chat_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(href);
      return { success: true };
    } catch (error) {
      console.error('导出聊天记录失败:', error);
      throw error;
    }
  }
};

// 获取设置
export const getSettings = async (key) => {
  try {
    const response = await api.get(`/settings/${key}`);
    return response.data;
  } catch (error) {
    console.error('获取设置失败:', error);
    throw error;
  }
};

// 更新设置
export const updateSetting = async (key, value) => {
  try {
    const response = await api.put(`/settings/${key}`, { value });
    return response.data;
  } catch (error) {
    console.error('更新设置失败:', error);
    throw error;
  }
};

// Poll short requests while maintenance work runs in the background.
const waitMaintenance = async (response) => {
  if (response.status !== 202 || !response.data.taskId) return response.data.data;
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const { data } = await api.get('/assignment/maintenance-tasks/' + response.data.taskId);
    if (data.status === 'completed') return data.result.data;
    if (data.status === 'failed') throw new Error(data.message || '维护任务失败');
  }
};

// 获取系统统计信息
export const getSystemStats = async () => {
  try {
    let response = await api.get('/settings/system-stats');
    while (response.status === 202 || response.data.cache?.refreshing) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      response = await api.get('/settings/system-stats');
    }
    return response.data;
  } catch (error) {
    console.error('获取系统统计信息失败:', error);
    throw error;
  }
};

// 获取消息列表
export const getMessages = async () => {
  try {
    const response = await api.get('/chat/messages');
    return response.data.messages || [];
  } catch (error) {
    console.error('获取消息失败:', error);
    return [];
  }
};

// 获取审核历史
export const getReviewHistory = async ({ page = 1, pageSize = 10 } = {}) => {
  try {
    const response = await api.get('/review/history', {
      params: { page, pageSize }
    });
    return response.data;
  } catch (error) {
    console.error('获取审核历史失败:', error);
    throw error;
  }
};

// 课程管理相关 API
export const courseManagementAPI = {
  // 获取教师的所有课程
  async getTeacherCourses() {
    const response = await api.get('/course-management');
    return response.data;
  },

  // 创建新课程
  async createCourse(courseData) {
    const response = await api.post('/course-management', courseData);
    return response.data;
  },

  // 更新课程
  async updateCourse(courseId, courseData) {
    const response = await api.put(`/course-management/${courseId}`, courseData);
    return response.data;
  },

  // 获取课程详情
  async getCourse(courseId) {
    const response = await api.get(`/course-management/${courseId}`);
    return response.data;
  },

  // 获取学生的课程详情（使用相同的端点，因为后端会根据用户角色返回适当的数据）
  async getCourseDetails(courseId) {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  },

  // 获取学生的课程详情（新API，专门为学生设计，包含单元和课时信息）
  async getStudentCourseDetails(courseId) {
    const response = await api.get(`/courses/${courseId}/student-details`);
    return response.data;
  },

  // 获取学生的课程进度
  async getCourseProgress(courseId) {
    const response = await api.get(`/courses/${courseId}/progress`);
    return response.data;
  },

  // 删除课程
  async deleteCourse(courseId) {
    const response = await api.delete(`/course-management/${courseId}`);
    return response.data;
  },

  // 获取课程单元
  async getUnits(courseId) {
    const response = await api.get(`/course-management/${courseId}/units`);
    return response.data;
  },

  // 创建单元
  async createUnit(courseId, unitData) {
    const response = await api.post(`/course-management/${courseId}/units`, unitData);
    return response.data;
  },

  // 更新单元
  async updateUnit(courseId, unitId, unitData) {
    const response = await api.put(`/course-management/${courseId}/units/${unitId}`, unitData);
    return response.data;
  },

  // 删除单元
  async deleteUnit(courseId, unitId) {
    const response = await api.delete(`/course-management/${courseId}/units/${unitId}`);
    return response.data;
  },

  // 更新单元顺序
  async updateUnitsOrder(courseId, orderData) {
    const response = await api.put(
      `/course-management/${courseId}/units/order-units`,
      { lessons: orderData }
    );
    return response.data;
  },

  // 获取课时列表
  getLessons(courseId, unitId) {
    return api.get(`/course-units/units/${unitId}/lessons`).then(response => response.data);
  },

  // 获取课时详情
  getLesson(courseId, unitId, lessonId) {
    return api.get(`/course-units/lessons/${lessonId}`).then(response => response.data);
  },

  // 创建课时
  createLesson(courseId, unitId, lessonData) {
    return api.post(`/course-units/units/${unitId}/lessons`, lessonData).then(response => response.data);
  },

  // 更新课时
  updateLesson(courseId, unitId, lessonId, lessonData) {
    return api.put(`/course-units/lessons/${lessonId}`, lessonData).then(response => response.data);
  },

  // 删除课时
  deleteLesson(courseId, unitId, lessonId) {
    return api.delete(
      `/course-management/${courseId}/units/${unitId}/lessons/${lessonId}`
    ).then(response => response.data);
  },

  // 上传活动资源
  uploadActivityResource(courseId, unitId, lessonId, formData) {
    return api.post(
      `/courses/${courseId}/units/${unitId}/lessons/${lessonId}/activities/resources`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ).then(response => response.data);
  },

  // 下载活动资源
  async downloadResource(courseId, unitId, lessonId, filename, originalName) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/download/resource/${filename}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('下载失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName; // 使用原始文件名
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载文件失败:', error);
      message.error('下载文件失败');
    }
  },

  // 删除活动资源
  deleteResource(courseId, unitId, lessonId, filename) {
    return api.delete(
      `/courses/${courseId}/units/${unitId}/lessons/${lessonId}/resources/${filename}`
    ).then(response => response.data);
  },

  // 更新课时顺序
  updateLessonsOrder: async (courseId, unitId, lessons) => {
    const response = await api.put(
      `/course-management/${courseId}/units/${unitId}/lessons/order`,
      { lessons }
    );
    return response.data;
  },

  submitAssignment: async (courseId, unitId, lessonId, activityId, formData, config = {}) => {
    const token = localStorage.getItem('token');
    const response = await api.post(
      `/courses/${courseId}/units/${unitId}/lessons/${lessonId}/activities/${activityId}/submit`,
      formData,
      {
        ...config,
        headers: {
          ...config.headers,
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.data;
  },

  // 获取作业提交历史
  getSubmissionHistory: async (courseId, unitId, lessonId, activityId) => {
    const response = await api.get(
      `/courses/${courseId}/units/${unitId}/lessons/${lessonId}/activities/${activityId}/submissions`
    );
    return response.data;
  },

  // 教师获取作业提交列表
  getTeacherSubmissions: async (courseId, unitId, lessonId, activityId) => {
    const response = await api.get(
      `/courses/${courseId}/units/${unitId}/lessons/${lessonId}/activities/${activityId}/teacher-submissions`
    );
    return response.data;
  },

  // 教师批阅作业
  gradeSubmission: async (submissionId, data) => {
    const response = await api.post(
      `/submissions/${submissionId}/grade`,
      data
    );
    return response.data;
  },

  // 下载作业文件
  downloadAssignment: async (filePath) => {
    try {
      const token = localStorage.getItem('token');
      // 移除路径中的 'uploads/assignments' 前缀
      const cleanPath = filePath.replace('uploads/assignments/', '');
      const response = await fetch(`${API_BASE_URL}/api/download/assignment/${cleanPath}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('下载失败');
      }

      return await response.blob();
    } catch (error) {
      console.error('下载文件失败:', error);
      throw error;
    }
  },

  // 更新活动详情（描述和参考答案）
  updateActivityDetails: async (lessonId, activityId, data) => {
    const response = await api.put(
      `/lessons/${lessonId}/activities/${activityId}/details`,
      data
    );
    return response.data;
  },

  // AI 评阅作业
  requestAIGrade: async (submissionId) => {
    try {
      const response = await api.post(`/submissions/${submissionId}/ai-grade`, {}, {
        timeout: 60000
      });
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('AI 评阅请求超时，请稍后重试');
      }
      console.error('AI 评阅请求失败:', error);
      throw error;
    }
  },

  // 获取学生的所有作业提交记录
  getStudentSubmissions: async () => {
    try {
      const response = await api.get('/assignments/student/submissions');
      return response.data;
    } catch (error) {
      console.error('获取作业提交记录失败:', error);
      throw error;
    }
  },

  // 更新课时状态
  updateLessonStatus: async (courseId, unitId, lessonId, status) => {
    try {
      const response = await api.put(
        `/course-management/${courseId}/units/${unitId}/lessons/${lessonId}/status`,
        { status }
      );
      return response.data;
    } catch (error) {
      console.error('更新课时状态失败:', error);
      throw error;
    }
  },

  // 获取作业评阅树形结构（优化后的单次请求）
  // 一次性获取所有课程-单元-课时-活动的级联结构
  async getAssignmentTree() {
    try {
      const response = await api.get('/teacher/assignment-tree');
      return response.data;
    } catch (error) {
      console.error('获取作业评阅树形结构失败:', error);
      throw error;
    }
  },

  // 获取待批改作业汇总
  // 返回教师所有课程中待批改的作业数量，按课程/单元/课时/活动分组
  async getPendingAssignmentsSummary() {
    try {
      const response = await api.get('/teacher/pending-summary');
      return response.data;
    } catch (error) {
      console.error('获取待批改作业汇总失败:', error);
      throw error;
    }
  }
};

// 课程相关 API
export const lessonAPI = {
  // 更新活动发布状态
  updateActivityPublishStatus(lessonId, activityId, isPublished) {
    return api.put(`/lessons/${lessonId}/activities/${activityId}/publish`, { isPublished })
      .then(response => {
        return response.data;
      })
      .catch(error => {
        console.error('更新活动发布状态失败:', error);
        message.error('更新活动发布状态失败');
        throw error;
      });
  },

  // 更新活动详情
  updateActivityDetails(lessonId, activityId, data) {
    return api.put(`/lessons/${lessonId}/activities/${activityId}/details`, data)
      .then(response => {
        return response.data;
      })
      .catch(error => {
        console.error('更新活动详情失败:', error);
        throw error;
      });
  },

  uploadPptGradingFile(lessonId, activityId, formData) {
    return api.post(`/lessons/${lessonId}/activities/${activityId}/ppt-grading/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(response => response.data);
  },

  updatePptGradingSettings(lessonId, activityId, data) {
    return api.put(`/lessons/${lessonId}/activities/${activityId}/ppt-grading/settings`, data)
      .then(response => response.data);
  },

  regeneratePptGradingRules(lessonId, activityId) {
    return api.post(`/lessons/${lessonId}/activities/${activityId}/ppt-grading/regenerate`)
      .then(response => response.data);
  },

  downloadPptGradingFile(lessonId, activityId, fileRole) {
    return api({
      url: `/lessons/${lessonId}/activities/${activityId}/ppt-grading/${fileRole}/download`,
      method: 'GET',
      responseType: 'blob'
    });
  },

  uploadExcelGradingFile(lessonId, activityId, formData) {
    return api.post(`/lessons/${lessonId}/activities/${activityId}/excel-grading/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(response => response.data);
  },

  updateExcelGradingSettings(lessonId, activityId, data) {
    return api.put(`/lessons/${lessonId}/activities/${activityId}/excel-grading/settings`, data)
      .then(response => response.data);
  },

  regenerateExcelGradingRules(lessonId, activityId) {
    return api.post(`/lessons/${lessonId}/activities/${activityId}/excel-grading/regenerate`)
      .then(response => response.data);
  },

  downloadExcelGradingFile(lessonId, activityId, fileRole) {
    return api({
      url: `/lessons/${lessonId}/activities/${activityId}/excel-grading/${fileRole}/download`,
      method: 'GET',
      responseType: 'blob'
    });
  },

  // 导出课时
  exportLesson(lessonId) {
    return api({
      url: `/lessons/${lessonId}/export`,
      method: 'GET',
      responseType: 'blob'
    })
      .then(response => {
        // 获取文件名
        const contentDisposition = response.headers['content-disposition'];
        let filename = 'lesson.zip';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        // 创建下载链接
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        return { success: true, filename };
      })
      .catch(error => {
        console.error('导出课时失败:', error);
        message.error('导出课时失败');
        throw error;
      });
  },

  // 导入课时到指定单元
  mediaStatus(lessonId) {
    return api.get(`/lessons/${lessonId}/media-status`).then(response => response.data);
  },
  importLesson(unitId, formData, onProgress) {
    return uploadLessonPackage(api, unitId, formData.get('lessonFile'), onProgress)
      .catch(error => {
        console.error('导入课时失败:', error);
        message.error('导入课时失败: ' + (error.response?.data?.message || error.message));
        throw error;
      });
  }
};

// 考试管理 API
export const examAPI = {
  // 获取教师的历史配置列表
  getTeacherConfigs: async () => {
    const response = await api.get('/exams');
    return response.data;
  },
  // 创建考试配置
  createExamConfig: async (data) => {
    const response = await api.post('/exams', data);
    return response.data;
  },
  // 获取考试配置
  getExamConfig: async (id) => {
    const response = await api.get(`/exams/${id}`);
    return response.data;
  },
  // 更新考试配置
  updateExamConfig: async (id, data) => {
    const response = await api.put(`/exams/${id}`, data);
    return response.data;
  },
  // 计算成绩
  calculateGrades: async (id) => {
    const response = await api.post(`/exams/${id}/calculate`);
    return response.data;
  },
  // 导出成绩
  exportGrades: async (id) => {
    const response = await api.get(`/exams/${id}/export`, { responseType: 'blob' });
    return response;
  }
};

// 课程单元相关API（学生端）
export const courseUnitAPI = {
  // 获取学生的所有课程
  async getStudentCourses() {
    const response = await api.get('/courses');
    return response.data;
  },

  // 获取学生课程的详细信息
  async getStudentCourseDetail(courseId) {
    const response = await api.get(`/courses/${courseId}`);
    return response.data;
  },

  // 获取课程的所有单元
  async getUnits(courseId) {
    const response = await api.get(`/course-units/course/${courseId}/units`);
    return response.data;
  },

  // 获取单元的所有课时
  async getLessons(courseId, unitId) {
    const response = await api.get(`/course-units/units/${unitId}/lessons`);
    return response.data;
  },

  // 获取课时详情
  async getLesson(courseId, unitId, lessonId) {
    const response = await api.get(`/course-units/lessons/${lessonId}`);
    return response.data;
  },

  // 获取教师的所有课程小节
  async getTeacherLessons() {
    const response = await api.get('/course-units/teacher/lessons');
    return response.data;
  }
};

// 班级管理相关 API
export const classAPI = {
  // 获取可用的班级列表（用于学生注册）
  async getAvailableClasses() {
    const response = await api.get('/classes/available');
    return response.data;
  },

  // 创建新班级
  async createClass(classData) {
    const response = await api.post('/classes', classData);
    return response.data;
  },

  // 获取教师的所有班级
  async getTeacherClasses() {
    const response = await api.get('/classes/teacher');
    return response.data;
  },

  // 获取班级详情
  async getClassDetails(classId) {
    const response = await api.get(`/classes/${classId}`);
    return response.data;
  },

  // 获取班级学生名单（含 name、username、seatNumber）
  async getClassStudents(classId) {
    const response = await api.get(`/classes/${classId}/students`);
    return response.data;
  },

  // 清空班级所有学生的座位号（仅教师）
  async clearClassSeats(classId) {
    const response = await api.post(`/classes/${classId}/clear-seats`);
    return response.data;
  },

  // 更新学生信息
  async updateStudent(studentId, studentData) {
    const response = await api.put(`/classes/students/${studentId}`, studentData);
    return response.data;
  },

  // 更新班级设置
  async updateClassSettings(classId, settings) {
    const response = await api.patch(`/classes/${classId}/settings`, settings);
    return response.data;
  },

  // 添加学生到班级
  async addStudentToClass(classId, studentData) {
    const response = await api.post(`/classes/${classId}/students`, studentData);
    return response.data;
  },

  // 从班级移除学生
  async removeStudentFromClass(classId, studentId) {
    const response = await api.delete(`/classes/${classId}/students/${studentId}`);
    return response.data;
  },

  // 获取学生登录历史
  async getStudentLoginHistory(studentId) {
    const response = await api.get(`/classes/students/${studentId}/login-history`);
    return response.data;
  },

  // 获取班级在线学生信息
  async getClassOnlineStudents(classId) {
    const response = await api.get(`/classes/${classId}/online-students`);
    return response.data;
  },

  // 教师强制下线学生
  async forceLogoutStudent(classId, studentId) {
    const response = await api.post(`/classes/${classId}/students/${studentId}/force-logout`);
    return response.data;
  },

  // 教师强制下线班级所有学生
  async forceLogoutAllStudents(classId) {
    const response = await api.post(`/classes/${classId}/force-logout-all`);
    return response.data;
  },

  // 批量导入学生
  async importStudents(formData) {
    const response = await api.post('/classes/students/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // 下载学生导入模板
  async downloadTemplate() {
    try {
      console.log('下载模板请求发送'); // 调试信息
      const response = await fetch(
        `${API_BASE_URL}/api/classes/template/students/download`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('下载模板失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '学生导入模板.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载模板失败:', error);
      message.error('下载模板失败');
    }
  },

  // 获取用户的班级设置
  async getUserClassSettings(userId) {
    const response = await api.get(`/users/${userId}/class-settings`);
    return response.data;
  },

  // 删除班级
  async deleteClass(classId) {
    const response = await api.delete(`/classes/${classId}`);
    return response.data;
  },

  // 批量删除学生
  async batchDeleteStudents(classId, studentIds) {
    const response = await api.delete(`/classes/${classId}/students/batch`, {
      data: { studentIds }
    });
    return response.data;
  }
};

// 打字练习相关 API
export const typingAPI = {
  // 文本管理
  createText: async (textData) => {
    const response = await api.post('/typing/texts', textData);
    return response.data;
  },

  getTexts: async (params = {}) => {
    const response = await api.get('/typing/texts', { params });
    return response.data;
  },

  getTextById: async (textId) => {
    const response = await api.get(`/typing/texts/${textId}`);
    return response.data;
  },

  updateText: async (textId, textData) => {
    const response = await api.put(`/typing/texts/${textId}`, textData);
    return response.data;
  },

  deleteText: async (textId) => {
    const response = await api.delete(`/typing/texts/${textId}`);
    return response.data;
  },

  // 练习记录 - 学生端
  recordTyping: async (recordData) => {
    const response = await api.post('/typing/records', recordData);
    return response.data;
  },

  getRecords: async (params = {}) => {
    const response = await api.get('/typing/records', { params });
    return response.data;
  },

  // 教师端 - 打字成绩管理
  getTypingRecords: async (filters = {}) => {
    const response = await api.get('/typing/teacher/records', { params: filters });
    return response.data;
  },

  getTypingStats: async (filters = {}) => {
    const response = await api.get('/typing/teacher/stats', { params: filters });
    return response.data;
  },

  exportTypingRecords: async (filters = {}) => {
    const response = await api.get('/typing/teacher/records/export', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  },

  deleteTypingRecord: async (recordId) => {
    const response = await api.delete(`/typing/teacher/records/${recordId}`);
    return response.data;
  },

  // 统计信息
  getStats: async (params = {}) => {
    const response = await api.get('/typing/stats', { params });
    return response.data;
  },

  // 排行榜 - 全校/班级
  getLeaderboard: async (params = {}) => {
    const response = await api.get('/typing/leaderboard', { params });
    return response.data;
  },

  // 排行榜 - 按文章
  getTextLeaderboard: async (textId, params = {}) => {
    const response = await api.get(`/typing/text-leaderboard/${textId}`, { params });
    return response.data;
  }
};

// 测验相关 API
export const quizAPI = {
  // 题目管理
  questions: {
    // 创建题目
    create: async (questionData) => {
      const response = await api.post('/quiz/questions', questionData);
      return response.data;
    },

    // 获取题目列表
    getList: async (params = {}) => {
      const response = await api.get('/quiz/questions', { params });
      return response.data;
    },

    // 获取单个题目
    getById: async (questionId) => {
      const response = await api.get(`/quiz/questions/${questionId}`);
      return response.data;
    },

    // 更新题目
    update: async (questionId, questionData) => {
      const response = await api.put(`/quiz/questions/${questionId}`, questionData);
      return response.data;
    },

    // 删除题目
    delete: async (questionId) => {
      const response = await api.delete(`/quiz/questions/${questionId}`);
      return response.data;
    },

    // AI 解析题目
    parseWithAI: async (text, type, defaultTags = []) => {
      try {
        const response = await api.post('/quiz/questions/ai/parse', { text, type, defaultTags });
        return response.data;
      } catch (error) {
        console.error('AI 解析题目失败:', error);
        throw error;
      }
    },

    // 上传题目媒体
    uploadMedia: async (formData) => {
      try {
        const response = await api.post('/quiz/media/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        return response.data;
      } catch (error) {
        console.error('上传题目媒体失败:', error);
        throw error;
      }
    },

    // 获取题目引用信息（被多少测验使用）
    getReferences: async (questionId) => {
      try {
        const response = await api.get(`/quiz/questions/${questionId}/references`);
        return response.data;
      } catch (error) {
        console.error('获取题目引用信息失败:', error);
        throw error;
      }
    },

    // 获取题目版本历史
    getVersionHistory: async (questionId) => {
      try {
        const response = await api.get(`/quiz/questions/${questionId}/versions`);
        return response.data;
      } catch (error) {
        console.error('获取题目版本历史失败:', error);
        throw error;
      }
    },

    // 获取已删除的题目列表（回收站）
    getDeleted: async (params = {}) => {
      try {
        const response = await api.get('/quiz/questions/deleted', { params });
        return response.data;
      } catch (error) {
        console.error('获取已删除题目列表失败:', error);
        throw error;
      }
    },

    // 还原已删除的题目
    restore: async (questionId) => {
      try {
        const response = await api.put(`/quiz/questions/${questionId}/restore`);
        return response.data;
      } catch (error) {
        console.error('还原题目失败:', error);
        throw error;
      }
    },

    // 永久删除题目
    permanentDelete: async (questionId) => {
      try {
        const response = await api.delete(`/quiz/questions/${questionId}/permanent`);
        return response.data;
      } catch (error) {
        console.error('永久删除题目失败:', error);
        throw error;
      }
    }
  },

  // 测验管理
  quizzes: {
    // 创建测验
    create: async (quizData) => {
      const response = await api.post('/quiz/quizzes', quizData);
      return response.data;
    },

    // 获取测验列表
    getList: async (params = {}) => {
      const response = await api.get('/quiz/quizzes', { params });
      return response.data;
    },

    // 获取单个测验
    getById: async (quizId) => {
      const response = await api.get(`/quiz/quizzes/${quizId}`);
      return response.data;
    },

    // 更新测验
    update: async (quizId, quizData) => {
      const response = await api.put(`/quiz/quizzes/${quizId}`, quizData);
      return response.data;
    },

    // 删除测验
    delete: async (quizId) => {
      const response = await api.delete(`/quiz/quizzes/${quizId}`);
      return response.data;
    },

    // 发布测验
    publish: async (quizId) => {
      const response = await api.put(`/quiz/quizzes/${quizId}/publish`);
      return response.data;
    },

    // 复制测验
    duplicate: async (quizId) => {
      const response = await api.post(`/quiz/quizzes/${quizId}/duplicate`);
      return response.data;
    },

    // 题目管理
    questions: {
      // 添加题目到测验
      add: async (quizId, questions) => {
        const response = await api.post(`/quiz/quizzes/${quizId}/questions`, { questions });
        return response.data;
      },

      // 更新题目顺序
      updateOrder: async (quizId, questions) => {
        const response = await api.put(`/quiz/quizzes/${quizId}/questions`, { questions });
        return response.data;
      },

      // 从测验中移除题目
      remove: async (quizId, questionId) => {
        const response = await api.delete(`/quiz/quizzes/${quizId}/questions/${questionId}`);
        return response.data;
      }
    }
  },

  // 答题管理
  submissions: {
    // 开始答题（创建或恢复进度）
    start: async (data) => {
      const response = await api.post('/quiz/submissions/start', data);
      return response.data;
    },

    // 保存答题进度
    saveProgress: async (submissionId, answers) => {
      const response = await api.put(`/quiz/submissions/${submissionId}/progress`, { answers });
      return response.data;
    },

    // 获取进行中的答题
    getInProgress: async (quizId, activityId = null) => {
      const params = activityId ? { activityId } : {};
      const response = await api.get(`/quiz/quizzes/${quizId}/in-progress`, { params });
      return response.data;
    },

    // 提交测验（包含所有答案）
    submit: async (data) => {
      const response = await api.post('/quiz/submissions/submit', data);
      return response.data;
    },

    // 获取答题记录
    getById: async (submissionId) => {
      const response = await api.get(`/quiz/submissions/${submissionId}`);
      return response.data;
    },

    // 获取测验的所有提交记录
    getByQuiz: async (quizId) => {
      const response = await api.get(`/quiz/quizzes/${quizId}/submissions`);
      return response.data;
    },

    // 获取班级测验提交记录
    getClassSubmissions: async (classId, quizId = null) => {
      let url = `/quiz/class/${classId}/submissions`;
      if (quizId) {
        url = `/quiz/class/${classId}/quiz/${quizId}/submissions`;
      }
      const response = await api.get(url);
      return response.data;
    },

    // 删除提交记录
    delete: async (submissionId) => {
      const response = await api.delete(`/quiz/submissions/${submissionId}`);
      return response.data;
    },

    // 导出测验提交记录到Excel
    exportToExcel: async (quizId, classId = null) => {
      const params = classId ? { classId } : {};
      const response = await api.get(`/quiz/quizzes/${quizId}/submissions/export`, {
        params,
        responseType: 'blob' // 重要：指定响应类型为blob
      });
      return response.data;
    }
  },

  // 分析相关
  analytics: {

    // 获取测验分析数据
    getQuizAnalytics: async (quizId, classId = null, refresh = undefined) => {
      try {
        const params = {};
        if (classId) params.classId = classId;
        if (refresh !== undefined) params.refresh = refresh;
        const response = await api.get(`/analytics/quizzes/${quizId}`, { params });
        return response.data;
      } catch (error) {
        console.error('获取测验分析数据失败:', error);
        throw error;
      }
    },

    // 获取问题分析数据
    getQuestionAnalytics: async (questionId) => {
      try {
        const response = await api.get(`/analytics/questions/${questionId}`);
        return response.data;
      } catch (error) {
        console.error('获取问题分析数据失败:', error);
        throw error;
      }
    },

    // 获取心理量表分析数据
    getScaleAnalytics: async (quizId) => {
      try {
        const response = await api.get(`/analytics/scales/${quizId}`);
        return response.data;
      } catch (error) {
        console.error('获取心理量表分析数据失败:', error);
        throw error;
      }
    }
  }
};

// 题目分析相关 API
export const questionAnalyticsAPI = {
  // 获取所有题目的分析数据列表
  getAllQuestionsAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/question-analytics/questions', { params });
      return response.data;
    } catch (error) {
      console.error('获取题目分析列表失败:', error);
      throw error;
    }
  },

  // 获取单个题目的详细分析数据
  getQuestionAnalytics: async (questionId) => {
    try {
      const response = await api.get(`/question-analytics/questions/${questionId}`);
      return response.data;
    } catch (error) {
      console.error('获取题目分析数据失败:', error);
      return { success: false };
    }
  }
};

// 日志相关 API
export const logAPI = {
  // 获取日志文件列表
  getLogFiles: async () => {
    const response = await api.get('/logs/files');
    return response.data;
  },

  // 获取指定日志文件的内容
  getLogContent: async (filename) => {
    const response = await api.get(`/logs/content/${filename}`);
    return response.data;
  },

  // 获取实时日志
  getRecentLogs: async (limit = 100) => {
    const response = await api.get('/logs/recent', { params: { limit } });
    return response.data;
  },

  // 下载日志文件
  downloadLogFile: async (filename) => {
    const response = await api.get(`/logs/download/${filename}`, {
      responseType: 'blob'
    });
    return response;
  },

  // 清空日志文件
  clearLogFile: async (filename) => {
    const response = await api.delete(`/logs/clear/${filename}`);
    return response.data;
  },

  // 批量清空所有日志
  clearAllLogs: async () => {
    const response = await api.delete('/logs/clear-all');
    return response.data;
  }
};

// 备份相关 API
export const backupAPI = {
  // 导出备份
  exportBackup: async (options = {}) => {
    try {
      const { includeAssignments = false } = options;
      const queryParams = new URLSearchParams();

      // 添加查询参数
      queryParams.append('includeAssignments', includeAssignments);

      const response = await api.get(`/backup/export?${queryParams.toString()}`, {
        responseType: 'blob',
        timeout: 600000 // 增加超时时间到10分钟
      });
      return response;
    } catch (error) {
      console.error('导出备份失败:', error);
      throw error;
    }
  },

  // 导入备份
  importBackup: async (formData, onProgress) => {
    try {
      console.log('开始上传备份文件...');
      console.log('FormData 内容:');
      for (let pair of formData.entries()) {
        // 不打印文件内容，只打印文件名
        if (pair[0] === 'backupFile') {
          console.log(pair[0], pair[1].name, pair[1].size, pair[1].type);
        } else {
          console.log(pair[0], pair[1]);
        }
      }

      // 确保formData中包含了文件
      if (!formData.has('backupFile')) {
        throw new Error('没有提供备份文件');
      }

      const response = await api.post('/backup/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 600000, // 增加超时时间到10分钟
        onUploadProgress: onProgress ? (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
          console.log(`上传进度: ${percentCompleted}%`);
        } : undefined
      });
      console.log('备份上传成功，服务器响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('导入备份失败:', error);
      // 添加更详细的错误日志
      if (error.response) {
        // 服务器响应了，但状态码不是2xx
        console.error('服务器响应错误:', {
          status: error.response.status,
          data: error.response.data
        });
        throw error.response.data || error;
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('未收到服务器响应:', error.request);
        throw new Error('服务器未响应，请检查网络连接或服务器状态');
      } else {
        // 设置请求时发生错误
        console.error('请求设置错误:', error.message);
        throw error;
      }
    }
  },

  // 创建备份（仅生成，不下载）
  createBackup: async (options = {}) => {
    try {
      const { includeAssignments = false } = options;
      const queryParams = new URLSearchParams();
      queryParams.append('includeAssignments', includeAssignments);

      const response = await api.post(`/backup/create?${queryParams.toString()}`, {}, {
        timeout: 600000 // 增加超时时间到10分钟
      });
      return response.data;
    } catch (error) {
      console.error('创建备份失败:', error);
      throw error;
    }
  },

  // 下载备份文件
  downloadBackup: async (filename) => {
    try {
      const response = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
        timeout: 600000 // 增加超时时间到10分钟
      });
      return response;
    } catch (error) {
      console.error('下载备份失败:', error);
      throw error;
    }
  }
};

// 机房布局相关 API
export const classroomLayoutAPI = {
  // 获取机房布局列表
  getLayouts: async () => {
    try {
      const response = await api.get('/classroom-layout');
      return response.data;
    } catch (error) {
      console.error('获取机房布局列表失败:', error);
      throw error;
    }
  },

  // 创建新的机房布局
  createLayout: async (layoutData) => {
    try {
      const response = await api.post('/classroom-layout', layoutData);
      return response.data;
    } catch (error) {
      console.error('创建机房布局失败:', error);
      throw error;
    }
  },

  // 获取单个机房布局详情
  getLayout: async (layoutId) => {
    try {
      const response = await api.get(`/classroom-layout/${layoutId}`);
      return response.data;
    } catch (error) {
      console.error('获取机房布局详情失败:', error);
      throw error;
    }
  },

  // 更新机房布局
  updateLayout: async (layoutId, layoutData) => {
    try {
      const response = await api.put(`/classroom-layout/${layoutId}`, layoutData);
      return response.data;
    } catch (error) {
      console.error('更新机房布局失败:', error);
      throw error;
    }
  },

  // 删除机房布局
  deleteLayout: async (layoutId) => {
    try {
      const response = await api.delete(`/classroom-layout/${layoutId}`);
      return response.data;
    } catch (error) {
      console.error('删除机房布局失败:', error);
      throw error;
    }
  }
};

/**
 * AI RAG API
 */
export const aiRagAPI = {


  /**
   * 生成教学方案（流式响应）
   * @param {Object} data - 请求数据
   * @param {Function} onMessage - 消息回调函数
   * @param {Function} onError - 错误回调函数
   * @param {Function} onComplete - 完成回调函数
   * @returns {EventSource} - 事件源对象
   */
  generateLessonPlan: (data, onMessage, onError, onComplete) => {
    // 获取认证 token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到认证 token');
      onError && onError({ error: '认证失败，请重新登录' });
      return null;
    }

    // 构建请求 URL，包含认证 token
    const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const apiUrl = `${baseUrl}/api/ai-rag/lesson-plan`;
    const url = new URL(apiUrl);
    url.searchParams.append('data', encodeURIComponent(JSON.stringify(data)));
    url.searchParams.append('token', token);

    // 创建 EventSource 实例
    const eventSource = new EventSource(url.toString());

    // 连接打开时的处理
    eventSource.onopen = (event) => {
      console.log('SSE 连接已建立');
    };

    // 消息处理
    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        console.log('收到 SSE 消息:', parsedData);

        if (parsedData.type === 'chunk') {
          onMessage && onMessage(parsedData.content);
        } else if (parsedData.type === 'complete') {
          onComplete && onComplete(parsedData.content);
          eventSource.close();
        } else if (parsedData.type === 'error') {
          // 检查是否是认证错误
          if (parsedData.content && parsedData.content.error &&
            (parsedData.content.error.includes('认证') ||
              parsedData.content.error.includes('token') ||
              parsedData.content.error.includes('auth'))) {
            // 清除本地存储的 token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // 重定向到登录页面
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }

          onError && onError(parsedData.content);
          eventSource.close();
        }
      } catch (error) {
        console.error('解析 SSE 消息失败:', error);
        onError && onError({ error: '解析消息失败' });
      }
    };

    // 错误处理
    eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);

      // 检查是否是认证错误（通常无法直接从 error 对象获取详细信息）
      // 因此我们关闭连接并通知调用者
      onError && onError({ error: 'SSE 连接错误，可能是认证失败' });
      eventSource.close();

      // 如果连续出现错误，可能是认证问题，尝试重定向到登录页面
      if (!window.location.pathname.includes('/login')) {
        // 这里可以添加一些逻辑来判断是否需要重定向
        // 例如，可以设置一个计数器，连续错误超过一定次数才重定向
      }
    };

    return eventSource;
  },

  /**
   * 生成题目（流式响应）
   * @param {Object} data - 请求数据
   * @param {Function} onMessage - 消息回调函数
   * @param {Function} onError - 错误回调函数
   * @param {Function} onComplete - 完成回调函数
   * @returns {EventSource} - 事件源对象
   */
  generateQuestions: (data, onMessage, onError, onComplete) => {
    // 获取认证 token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到认证 token');
      onError && onError({ error: '认证失败，请重新登录' });
      return null;
    }

    // 构建请求 URL，包含认证 token
    const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const apiUrl = `${baseUrl}/api/ai-rag/questions`;
    const url = new URL(apiUrl);
    url.searchParams.append('data', encodeURIComponent(JSON.stringify(data)));
    url.searchParams.append('token', token);

    // 创建 EventSource 实例
    const eventSource = new EventSource(url.toString());

    // 连接打开时的处理
    eventSource.onopen = (event) => {
      console.log('SSE 连接已建立');
    };

    // 消息处理
    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        console.log('收到 SSE 消息:', parsedData);

        if (parsedData.type === 'chunk') {
          onMessage && onMessage(parsedData.content);
        } else if (parsedData.type === 'complete') {
          onComplete && onComplete(parsedData.content);
          eventSource.close();
        } else if (parsedData.type === 'error') {
          // 检查是否是认证错误
          if (parsedData.content && parsedData.content.error &&
            (parsedData.content.error.includes('认证') ||
              parsedData.content.error.includes('token') ||
              parsedData.content.error.includes('auth'))) {
            // 清除本地存储的 token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // 重定向到登录页面
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }

          onError && onError(parsedData.content);
          eventSource.close();
        }
      } catch (error) {
        console.error('解析 SSE 消息失败:', error);
        onError && onError({ error: '解析消息失败' });
      }
    };

    // 错误处理
    eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);

      // 检查是否是认证错误（通常无法直接从 error 对象获取详细信息）
      // 因此我们关闭连接并通知调用者
      onError && onError({ error: 'SSE 连接错误，可能是认证失败' });
      eventSource.close();

      // 如果连续出现错误，可能是认证问题，尝试重定向到登录页面
      if (!window.location.pathname.includes('/login')) {
        // 这里可以添加一些逻辑来判断是否需要重定向
        // 例如，可以设置一个计数器，连续错误超过一定次数才重定向
      }
    };

    return eventSource;
  },

  /**
   * 获取知识库列表
   * @returns {Promise<Object>} - 响应数据
   */
  getKnowledgeBases: async () => {
    try {
      const response = await api.get('/ai-rag/knowledge-bases');
      return response.data;
    } catch (error) {
      console.error('获取知识库列表失败:', error);
      throw error;
    }
  },

  /**
   * 聊天
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} - 响应数据
   */
  chat: async (data) => {
    try {
      const response = await api.post('/ai-rag/chat', data);
      return response.data;
    } catch (error) {
      console.error('聊天失败:', error);
      throw error;
    }
  },

  /**
   * 流式聊天（使用 EventSource）
   * @param {Object} data - 请求数据
   * @param {Function} onMessage - 消息回调函数
   * @param {Function} onError - 错误回调函数
   * @param {Function} onComplete - 完成回调函数
   * @returns {EventSource} - 事件源对象
   */
  chatStream: (data, onMessage, onError, onComplete) => {
    // 获取认证 token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未找到认证 token');
      onError && onError({ error: '认证失败，请重新登录' });
      return null;
    }

    // 构建请求 URL，包含认证 token
    const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const apiUrl = `${baseUrl}/api/ai-rag/chat`;
    const url = new URL(apiUrl);
    url.searchParams.append('data', encodeURIComponent(JSON.stringify(data)));
    url.searchParams.append('token', token);

    // 创建 EventSource 实例
    const eventSource = new EventSource(url.toString());

    // 连接打开时的处理
    eventSource.onopen = (event) => {
      console.log('SSE 连接已建立');
    };

    // 消息处理
    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        console.log('收到 SSE 消息:', parsedData);

        if (parsedData.type === 'chunk') {
          onMessage && onMessage(parsedData.content);
        } else if (parsedData.type === 'complete') {
          onComplete && onComplete(parsedData.content);
          eventSource.close();
        } else if (parsedData.type === 'error') {
          // 检查是否是认证错误
          if (parsedData.content && parsedData.content.error &&
            (parsedData.content.error.includes('认证') ||
              parsedData.content.error.includes('token') ||
              parsedData.content.error.includes('auth'))) {
            // 清除本地存储的 token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // 重定向到登录页面
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }

          onError && onError(parsedData.content);
          eventSource.close();
        }
      } catch (error) {
        console.error('解析 SSE 消息失败:', error);
        onError && onError({ error: '解析消息失败' });
      }
    };

    // 错误处理
    eventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);

      // 检查是否是认证错误（通常无法直接从 error 对象获取详细信息）
      // 因此我们关闭连接并通知调用者
      onError && onError({ error: 'SSE 连接错误，可能是认证失败' });
      eventSource.close();

      // 如果连续出现错误，可能是认证问题，尝试重定向到登录页面
      if (!window.location.pathname.includes('/login')) {
        // 这里可以添加一些逻辑来判断是否需要重定向
        // 例如，可以设置一个计数器，连续错误超过一定次数才重定向
      }
    };

    return eventSource;
  },

  /**
   * 清理临时文件
   * @returns {Promise<Object>} - 响应数据
   */
  clearTemp: async () => {
    try {
      const response = await api.post('/ai-rag/clear-temp');
      return response.data;
    } catch (error) {
      console.error('清理临时文件失败:', error);
      throw error;
    }
  }
};

// 作业文件清理相关API
export const assignmentFilesAPI = {
  // 获取作业文件统计信息
  getFilesStats: async () => {
    try {
      const response = await api.get('/assignment/files-stats');
      return response.data.data;
    } catch (error) {
      console.error('获取作业文件统计失败:', error);
      message.error('获取作业文件统计失败');
      throw error;
    }
  },

  // 预览将删除的文件
  previewCleanup: async (filters, options) => {
    try {
      const response = await api.post('/assignment/preview-cleanup', { filters, options });
      return await waitMaintenance(response);
    } catch (error) {
      console.error('预览文件清理失败:', error);
      message.error('预览文件清理失败: ' + (error.response?.data?.message || error.message));
      throw error;
    }
  },

  // 执行文件清理
  cleanupFiles: async (filters, options) => {
    try {
      const response = await api.post('/assignment/cleanup-files', { filters, options });
      return await waitMaintenance(response);
    } catch (error) {
      console.error('文件清理失败:', error);
      message.error('文件清理失败: ' + (error.response?.data?.message || error.message));
      throw error;
    }
  }
};

export const mediaAPI = {
  // 上传媒体文件（图片或视频）- 不需要token就能访问的媒体文件
  uploadMedia(courseId, unitId, lessonId, formData) {
    return api.post(
      `/media/courses/${courseId}/units/${unitId}/lessons/${lessonId}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ).then(response => response.data);
  },

  // 获取课程下的所有公开媒体文件
  getCourseMedias(courseId) {
    return api.get(`/media/courses/${courseId}/media`)
      .then(response => response.data);
  },

  // 获取单元下的所有公开媒体文件
  getUnitMedias(courseId, unitId) {
    return api.get(`/media/courses/${courseId}/units/${unitId}/media`)
      .then(response => response.data);
  },

  // 获取课时下的所有公开媒体文件
  getLessonMedias(courseId, unitId, lessonId) {
    return api.get(`/media/courses/${courseId}/units/${unitId}/lessons/${lessonId}/media`)
      .then(response => response.data);
  },

  // 删除指定的公开媒体文件
  deleteMedia(courseId, unitId, lessonId, filename) {
    return api.delete(`/media/courses/${courseId}/units/${unitId}/lessons/${lessonId}/media/${filename}`)
      .then(response => response.data);
  }
};

// 学习统计相关 API
export const learningStatsAPI = {
  // 获取学生打字记录统计
  async getStudentTypingStats(studentId) {
    const response = await api.get(`/analytics/student/${studentId}/typing`);
    return response.data;
  },

  // 获取学生测验提交统计
  async getStudentQuizStats(studentId) {
    const response = await api.get(`/analytics/student/${studentId}/quizzes`);
    return response.data;
  },

  // 获取学生作业提交统计
  async getStudentAssignmentStats(studentId) {
    const response = await api.get(`/analytics/student/${studentId}/assignments`);
    return response.data;
  },

  // 获取学生综合学习统计
  async getStudentLearningStats(studentId) {
    const response = await api.get(`/analytics/student/${studentId}/learning`);
    return response.data;
  },

  // 获取班级学生的学习统计
  async getClassLearningStats(classId) {
    const response = await api.get(`/analytics/class/${classId}/learning`);
    return response.data;
  },

  // 获取学生平日成绩
  async getStudentDailyScore(studentId, params = {}) {
    const response = await api.get(`/analytics/student/${studentId}/daily-score`, { params });
    return response.data;
  },

  // 获取班级学生平日成绩
  async getClassDailyScores(classId, params = {}) {
    const response = await api.get(`/analytics/class/${classId}/daily-scores`, { params });
    return response.data;
  }
};

// 流程图活动相关 API
export const flowchartAPI = {
  // 提交流程图
  submit: async (data) => {
    const response = await api.post('/flowchart/submit', data);
    return response.data;
  },

  // 保存流程图草稿
  saveDraft: async (data) => {
    const response = await api.post('/flowchart/draft', data);
    return response.data;
  },

  // 获取用户的流程图提交记录
  getSubmission: async (lessonId, activityId) => {
    const response = await api.get('/flowchart/submission', {
      params: { lessonId, activityId }
    });
    return response.data;
  },

  // 教师端 - 获取活动的所有提交记录
  getActivitySubmissions: async (lessonId, activityId, classId = null) => {
    const params = { lessonId, activityId };
    if (classId) params.classId = classId;
    const response = await api.get('/flowchart/teacher/submissions', { params });
    return response.data;
  },

  // 教师端 - 评分流程图
  gradeSubmission: async (submissionId, score, feedback = '') => {
    const response = await api.post(`/flowchart/teacher/grade/${submissionId}`, {
      score,
      feedback
    });
    return response.data;
  },

  // 教师端 - 获取班级流程图统计
  getClassStats: async (lessonId, activityId, classId) => {
    const response = await api.get('/flowchart/teacher/stats', {
      params: { lessonId, activityId, classId }
    });
    return response.data;
  },

  // 教师端 - 删除提交记录
  deleteSubmission: async (submissionId) => {
    const response = await api.delete(`/flowchart/teacher/submissions/${submissionId}`);
    return response.data;
  }
};

// 在线表格活动相关 API
export const spreadsheetActivityAPI = {
  // 获取或创建学生自己的提交记录
  getOrCreateSubmission: async (lessonId, activityId) => {
    const response = await api.get(`/spreadsheet-submissions/lesson/${lessonId}/activity/${activityId}`);
    return response.data;
  },

  // 更新提交记录
  updateSubmission: async (id, data) => {
    const response = await api.put(`/spreadsheet-submissions/${id}`, data);
    return response.data;
  },

  // 教师端 - 获取活动的所有提交记录
  getActivitySubmissions: async (lessonId, activityId) => {
    const response = await api.get(`/spreadsheet-submissions/lesson/${lessonId}/activity/${activityId}/all`);
    return response.data;
  }
};

// 填空活动相关 API
export const fillBlankAPI = {
  // 获取学生的填空提交记录
  getSubmission: async (lessonId, activityId) => {
    const response = await api.get(`/fillblank/${lessonId}/${activityId}/submission`);
    return response.data;
  },

  // 保存草稿
  saveDraft: async (lessonId, activityId, answers) => {
    const response = await api.post(`/fillblank/${lessonId}/${activityId}/save`, { answers });
    return response.data;
  },

  // 提交填空答案
  submit: async (lessonId, activityId, answers) => {
    const response = await api.post(`/fillblank/${lessonId}/${activityId}/submit`, { answers });
    return response.data;
  },

  // 教师端 - 获取所有学生提交
  getActivitySubmissions: async (lessonId, activityId) => {
    const response = await api.get(`/fillblank/${lessonId}/${activityId}/submissions`);
    return response.data;
  },

  // 学生撤回提交，重新填写
  withdraw: async (lessonId, activityId) => {
    const response = await api.post(`/fillblank/${lessonId}/${activityId}/withdraw`);
    return response.data;
  },

  // 教师评分
  gradeSubmission: async (submissionId, bonusScore, feedback) => {
    const response = await api.post(`/fillblank/grade/${submissionId}`, { bonusScore, feedback });
    return response.data;
  }
};

// HTML Project API
export const htmlProjectAPI = {
  // Check if project name exists
  checkName: (name) => {
    return api.post('/html-projects/check-name', { name }).then(response => response.data);
  },

  // Create project
  createProject: (data) => {
    return api.post('/html-projects', data).then(response => response.data);
  },

  // Get project details
  getProject: (id) => {
    return api.get(`/html-projects/${id}`).then(response => response.data);
  },

  // Update project
  updateProject: (id, data) => {
    return api.put(`/html-projects/${id}`, data).then(response => response.data);
  },

  // Delete project
  deleteProject: (id) => {
    return api.delete(`/html-projects/${id}`).then(response => response.data);
  },

  // Get user's projects
  getProjects: () => {
    return api.get('/html-projects').then(response => response.data);
  },

  // Publish project
  publishProject: (id) => {
    return api.put(`/html-projects/${id}/publish`).then(response => response.data);
  },

  // Unpublish project
  unpublishProject: (id) => {
    return api.put(`/html-projects/${id}/unpublish`).then(response => response.data);
  },

  // Get all published projects (public)
  getPublishedProjects: (params) => {
    return api.get('/html-projects/published', { params }).then(response => response.data);
  },

  // View published project
  viewPublishedProject: (id) => {
    return api.get(`/html-projects/published/${id}`).then(response => response.data);
  },

  // Link project to assignment
  linkAssignment: (id, data) => {
    return api.put(`/html-projects/${id}/link-assignment`, data).then(response => response.data);
  },

  // Teacher: Get projects by lesson/activity
  getProjectsByLesson: (lessonId, activityId) => {
    return api.get(`/html-projects/assignment/${lessonId}/${activityId}`).then(response => response.data);
  },

  // Teacher: Delete student project
  teacherDeleteProject: (projectId) => {
    return api.delete(`/html-projects/${projectId}`).then(response => response.data);
  },

  // Teacher: Unpublish student project
  teacherUnpublishProject: (projectId) => {
    return api.put(`/html-projects/${projectId}/unpublish`).then(response => response.data);
  },

  // Teacher: Publish student project (no points/quota)
  teacherPublishProject: (projectId) => {
    return api.put(`/html-projects/${projectId}/teacher-publish`).then(response => response.data);
  }
};

// 登录请求相关 API
export const loginRequestAPI = {
  // 学生发起登录请求 (后端路由已配置无需认证)
  createRequest: async (data) => {
    const response = await api.post('/login-requests/request', data);
    return response.data;
  },

  // 学生查询请求状态 (后端路由已配置无需认证)
  getRequestStatus: async (requestId) => {
    const response = await api.get(`/login-requests/status/${requestId}`);
    return response.data;
  },

  // 教师获取班级的待处理登录请求
  getPendingRequests: async (classId) => {
    const response = await api.get(`/login-requests/pending/${classId}`);
    return response.data;
  },

  // 教师同意登录请求
  approveRequest: async (requestId) => {
    const response = await api.post(`/login-requests/approve/${requestId}`);
    return response.data;
  },

  // 教师拒绝登录请求
  rejectRequest: async (requestId) => {
    const response = await api.post(`/login-requests/reject/${requestId}`);
    return response.data;
  },

  // 批量同意班级所有待处理请求
  bulkApprove: async (classId) => {
    const response = await api.post('/login-requests/bulk-approve', { classId });
    return response.data;
  },

  // 批量拒绝班级所有待处理请求
  bulkReject: async (classId) => {
    const response = await api.post('/login-requests/bulk-reject', { classId });
    return response.data;
  }
};

// Python编程活动相关 API - 从独立模块重新导出以保持向后兼容
export { pythonAPI } from './pythonAPI';

export default api;
