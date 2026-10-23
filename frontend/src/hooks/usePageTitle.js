import { useEffect } from 'react';

const usePageTitle = (title) => {
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      // 构建用户标识（姓名+座位号）
      const userIdentifier = user.seatNumber 
        ? `${user.name}(${user.seatNumber})`
        : user.name;

      // 如果提供了特定标题，使用 "学生姓名(座位号) - 特定标题"
      if (title) {
        document.title = `${userIdentifier} - ${title}`;
      } else {
        // 如果没有提供标题，只使用 "学生姓名(座位号) - 学习平台"
        document.title = `${userIdentifier} - 学习平台`;
      }
    } else {
      // 如果没有用户信息，使用默认标题
      document.title = title || '学习平台';
    }

    // 清理函数：组件卸载时恢复默认标题
    return () => {
      document.title = '学习平台';
    };
  }, [title]);
};

export default usePageTitle; 