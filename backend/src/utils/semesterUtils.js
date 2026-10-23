/**
 * 学期工具函数
 * 用于解析学期参数和生成对应的日期范围
 */
const logger = require('./logger');

/**
 * 解析学期字符串，返回学期的开始日期和结束日期
 * 格式: "2024-2025-1" 或 "2024-2025-2"，表示2024-2025学年第一或第二学期
 * 规则: 8-次年1月是第一学期，2-7月是第二学期
 * @param {string} semesterStr - 学期字符串，格式为"academicYear-semester"，例如"2024-2025-1"
 * @returns {Object} 包含开始和结束日期的对象
 */
exports.parseSemesterDateRange = (semesterStr) => {
  try {
    if (!semesterStr) {
      logger.warn('未提供学期参数，将返回不限日期范围');
      return { startDate: null, endDate: null };
    }

    // 解析学期参数
    const parts = semesterStr.split('-');
    if (parts.length !== 3) {
      logger.error('学期格式错误', { semesterStr });
      return { startDate: null, endDate: null };
    }

    const startYear = parseInt(parts[0]);
    const endYear = parseInt(parts[1]);
    const semesterNumber = parseInt(parts[2]);

    // 验证参数有效性
    if (isNaN(startYear) || isNaN(endYear) || isNaN(semesterNumber) || 
        semesterNumber < 1 || semesterNumber > 2 || 
        endYear !== startYear + 1) {
      logger.error('学期参数无效', { startYear, endYear, semesterNumber });
      return { startDate: null, endDate: null };
    }

    let startDate, endDate;

    if (semesterNumber === 1) {
      // 第一学期：8月1日 - 次年1月31日
      startDate = new Date(startYear, 7, 1); // 月份从0开始，7表示8月
      endDate = new Date(endYear, 1, 0); // 次年1月的最后一天
    } else {
      // 第二学期：2月1日 - 7月31日
      startDate = new Date(endYear, 1, 1); // 次年2月1日
      endDate = new Date(endYear, 7, 0); // 次年7月的最后一天
    }

    logger.info('解析学期日期范围', { 
      semesterStr, 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString() 
    });

    return { startDate, endDate };
  } catch (error) {
    logger.error('解析学期日期范围失败', { error: error.message, stack: error.stack });
    return { startDate: null, endDate: null };
  }
};

/**
 * 获取当前学期
 * @returns {string} 当前学期字符串，格式为"academicYear-semester"，例如"2024-2025-1"
 */
exports.getCurrentSemester = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 月份从0开始计数
  
  let academicYear, semester;
  
  if (currentMonth >= 8) {
    // 8-12月，当前学年的第一学期
    academicYear = `${currentYear}-${currentYear + 1}`;
    semester = 1;
  } else if (currentMonth >= 2 && currentMonth <= 7) {
    // 2-7月，上一学年的第二学期
    academicYear = `${currentYear - 1}-${currentYear}`;
    semester = 2;
  } else {
    // 1月，上一学年的第一学期
    academicYear = `${currentYear - 1}-${currentYear}`;
    semester = 1;
  }
  
  return `${academicYear}-${semester}`;
};

/**
 * 获取当前学期有效的年级列表
 * 规则：当前和前两个年级，例如2024-2025学年会返回[2024, 2023, 2022]
 * @returns {Array<number>} 当前学期有效的年级列表（数组）
 */
exports.getCurrentValidGrades = () => {
  try {
    const currentSemester = exports.getCurrentSemester();
    const parts = currentSemester.split('-');
    const startYear = parseInt(parts[0]);
    
    // 当前及前两届年级
    const validGrades = [startYear, startYear - 1, startYear - 2];
    
    logger.info('当前有效年级列表', { currentSemester, validGrades });
    return validGrades;
  } catch (error) {
    logger.error('获取有效年级列表失败', { error: error.message, stack: error.stack });
    // 出错时返回空数组
    return [];
  }
}; 