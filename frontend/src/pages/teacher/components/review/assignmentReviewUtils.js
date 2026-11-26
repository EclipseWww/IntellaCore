// 作业批阅页用到的纯函数（文件类型识别、班级名称、等级统计）

// 文件类型映射
export const getFileType = (mimeType, fileName) => {
  const mimeMap = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/python': 'py',
    'application/x-python': 'py'
  };

  // 首先尝试从 MIME 类型获取
  if (mimeType && mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }

  // 如果 MIME 类型不匹配，尝试从文件扩展名获取
  const extension = fileName.split('.').pop().toLowerCase();
  const extensionMap = {
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'docx',
    'xls': 'xlsx',
    'xlsx': 'xlsx',
    'ppt': 'ppt',
    'pptx': 'pptx',
    'txt': 'txt',
    'py': 'txt',  // Python 文件作为文本显示
    'js': 'txt',  // JavaScript 文件作为文本显示
    'json': 'txt', // JSON 文件作为文本显示
    'csv': 'csv'
  };

  return extensionMap[extension] || 'txt';  // 默认作为文本文件处理
};

// 添加格式化班级名称的函数
export const formatClassName = (grade, name) => {
  if (!grade || !name) return '未分配班级';
  return `${grade}级${name}班`;
};

// 计算各等级学生数量和未评阅作业数量
export const calculateStatistics = (submissions) => {
  const stats = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    F: 0,
    ungraded: 0
  };

  submissions.forEach(submission => {
    // 检查是否有教师评分或有效的AI评分
    const hasTeacherGrade = submission.status === 'graded' && (submission.grade?.score !== undefined || submission.grade?.bonusScore !== undefined);
    const hasAiGrade = submission.aiGrade && submission.aiGrade.score !== undefined;

    if (!hasTeacherGrade && !hasAiGrade) {
      stats.ungraded++;
    } else {
      // 优先使用教师评分，如果没有则使用AI评分
      let score;
      if (hasTeacherGrade) {
        score = submission.grade?.score !== undefined ? submission.grade.score : submission.grade?.bonusScore;
      } else {
        score = submission.aiGrade?.score;
      }

      if (score >= 9) stats.A++;
      else if (score >= 7) stats.B++;
      else if (score >= 5) stats.C++;
      else if (score >= 3) stats.D++;
      else if (score >= 1) stats.E++;
      else stats.F++;
    }
  });

  return stats;
};
