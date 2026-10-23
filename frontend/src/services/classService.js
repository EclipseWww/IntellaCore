import api from './api';

// 获取教师的所有班级
export const getTeacherClasses = async () => {
  try {
    const response = await api.get('/classes/teacher');
    return response.data;
  } catch (error) {
    console.error('获取教师班级列表失败:', error);
    throw error;
  }
};

// 获取班级详情
export const getClassDetails = async (classId) => {
  try {
    const response = await api.get(`/classes/${classId}`);
    return response.data;
  } catch (error) {
    console.error('获取班级详情失败:', error);
    throw error;
  }
};

// 更新班级设置
export const updateClassSettings = async (classId, settings) => {
  try {
    const response = await api.patch(`/classes/${classId}/settings`, settings);
    return response.data;
  } catch (error) {
    console.error('更新班级设置失败:', error);
    throw error;
  }
};

// 添加学生到班级
export const addStudentToClass = async (classId, studentData) => {
  try {
    const response = await api.post(`/classes/${classId}/students`, studentData);
    return response.data;
  } catch (error) {
    console.error('添加学生到班级失败:', error);
    throw error;
  }
};

// 从班级移除学生
export const removeStudentFromClass = async (classId, studentId) => {
  try {
    const response = await api.delete(`/classes/${classId}/students/${studentId}`);
    return response.data;
  } catch (error) {
    console.error('从班级移除学生失败:', error);
    throw error;
  }
};

// 获取班级在线学生信息
export const getClassOnlineStudents = async (classId) => {
  try {
    const response = await api.get(`/classes/${classId}/online-students`);
    return response.data;
  } catch (error) {
    console.error('获取班级在线学生失败:', error);
    throw error;
  }
};

// 创建新班级
export const createClass = async (classData) => {
  try {
    const response = await api.post('/classes', classData);
    return response.data;
  } catch (error) {
    console.error('创建班级失败:', error);
    throw error;
  }
};

// 批量导入学生
export const importStudents = async (formData) => {
  try {
    const response = await api.post('/classes/students/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('批量导入学生失败:', error);
    throw error;
  }
};

// ============================================================
// 归档相关 API（管理员操作）
// ============================================================

/**
 * 按入学年级批量归档班级（管理员）
 * @param {number} grade - 入学年份（如 2023）
 * @param {string} graduationYear - 毕业学年（如 "2025-2026"）
 */
export const archiveGrade = async (grade, graduationYear) => {
  try {
    const response = await api.post('/classes/archive/grade', { grade, graduationYear });
    return response.data;
  } catch (error) {
    console.error('归档年级失败:', error);
    throw error;
  }
};

/**
 * 恢复已归档班级（管理员）
 * @param {string} classId - 班级ID
 */
export const restoreClass = async (classId) => {
  try {
    const response = await api.post(`/classes/${classId}/restore`);
    return response.data;
  } catch (error) {
    console.error('恢复班级失败:', error);
    throw error;
  }
};

/**
 * 获取所有已归档班级列表
 */
export const getArchivedClasses = async () => {
  try {
    const response = await api.get('/classes/archived');
    return response.data;
  } catch (error) {
    console.error('获取归档班级失败:', error);
    throw error;
  }
};

/**
 * 删除归档班级下学生的作业文件（节省存储）
 * @param {string} classId - 班级ID
 */
export const deleteArchivedClassFiles = async (classId) => {
  try {
    const response = await api.delete(`/classes/${classId}/files`);
    return response.data;
  } catch (error) {
    console.error('清理归档文件失败:', error);
    throw error;
  }
}; 