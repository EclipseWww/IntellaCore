import React, { useState, useEffect } from 'react';
import { Card, Button, message, Spin, Select } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { classroomLayoutAPI, classAPI } from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';

const { Option } = Select;

// 默认布局值，当API请求失败时使用
const DEFAULT_ROWS = 7;
const DEFAULT_COLS = 9;

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1000px',
    margin: '0 auto'
  },
  seatGrid: {
    display: 'grid',
    gap: '10px',
    marginTop: '20px'
  },
  seat: {
    width: '100%',
    aspectRatio: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    transition: 'all 0.3s'
  },
  occupiedSeat: {
    backgroundColor: '#fff7e6',
    borderColor: '#ffd591',
    color: '#595959',
    cursor: 'not-allowed'
  },
  selectedSeat: {
    backgroundColor: '#1890ff',
    color: 'white',
    border: '1px solid #1890ff'
  },
  seatNumberText: {
    fontWeight: 'bold'
  },
  occupantName: {
    fontSize: '12px',
    marginTop: '4px',
    color: '#555'
  },
  teacherDesk: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    marginBottom: '20px'
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '40px'
  },
  layoutSelector: {
    width: '200px',
    display: 'flex',
    alignItems: 'center'
  },
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: 0
  },
  layoutName: {
    fontWeight: 'normal', 
    fontSize: '14px', 
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    height: '32px'  // 与Select组件的默认高度保持一致
  }
};

const SeatSelection = () => {
  usePageTitle('选择座位');
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layoutList, setLayoutList] = useState([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState(null);
  const [layout, setLayout] = useState({
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS
  });
  const [seatMap, setSeatMap] = useState({}); // seatNumber -> { _id, name }
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  // 获取机房布局数据 + 班级占座（依据班级设置自动选择教室）
  useEffect(() => {
    const fetchClassroomLayout = async () => {
      try {
        setLoading(true);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(user || null);
        const layouts = await classroomLayoutAPI.getLayouts();
        setLayoutList(layouts || []);

        // 解析班级ID
        let classId = user?.classId;
        if (!classId && user?.id) {
          try {
            const classSettings = await classAPI.getUserClassSettings(user.id);
            classId = classSettings?._id || classId;
          } catch (e) {
            // 忽略，可能用户还未分班
          }
        }

        // 根据班级设置选择教室，否则默认第一个
        let selected = null;
        if (classId && layouts && layouts.length > 0) {
          try {
            const details = await classAPI.getClassDetails(classId);
            const data = details?.data || details;
            const layoutId = data?.selectedClassroomLayout?._id || null;
            if (layoutId) {
              selected = layouts.find(l => l._id === layoutId) || null;
            }
          } catch (e) {
            // 忽略错误，使用默认
          }
        }

        if (!selected && layouts && layouts.length > 0) {
          selected = layouts[0];
        }

        if (selected) {
          setSelectedLayoutId(selected._id);
          setLayout({ rows: selected.rows, cols: selected.cols, name: selected.name });
        } else {
          message.info('没有找到机房布局，使用默认配置');
          setLayout({ rows: DEFAULT_ROWS, cols: DEFAULT_COLS });
        }

        // 构建占座映射（seatNumber -> 学生）
        if (classId) {
          try {
            const result = await classAPI.getClassStudents(classId);
            const students = result?.data?.students || result?.students || [];
            const map = {};
            (students || []).forEach(s => {
              if (s.seatNumber) {
                map[s.seatNumber] = { _id: s._id, name: s.name };
              }
            });
            setSeatMap(map);
          } catch (e) {
            // 忽略占座加载失败
          }
        } else {
          setSeatMap({});
        }
      } catch (error) {
        console.error('获取机房布局失败:', error);
        message.error('获取机房布局失败，使用默认配置');
        setLayout({ rows: DEFAULT_ROWS, cols: DEFAULT_COLS });
      } finally {
        setLoading(false);
      }
    };

    fetchClassroomLayout();
  }, []);

  // 处理布局选择变化
  const handleLayoutChange = (layoutId) => {
    const selectedLayout = layoutList.find(item => item._id === layoutId);
    if (selectedLayout) {
      setSelectedLayoutId(layoutId);
      setLayout({
        rows: selectedLayout.rows,
        cols: selectedLayout.cols,
        name: selectedLayout.name
      });
      // 重置已选择的座位
      setSelectedSeat(null);
    }
  };

  const handleSeatClick = (col, row) => {
    const seatNumber = `${String.fromCharCode(65 + col)}${row + 1}`;
    const occupant = seatMap[seatNumber];
    if (occupant && occupant._id !== currentUser?.id) {
      message.warning('该座位已被占用');
      return;
    }
    setSelectedSeat(seatNumber);
  };

  const handleConfirm = async () => {
    if (!selectedSeat) {
      message.warning('请先选择一个座位');
      return;
    }

    try {
      const response = await api.post('/auth/update-seat', { seatNumber: selectedSeat });
      
      // 更新本地存储的用户信息
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = {
        ...user,
        seatNumber: selectedSeat
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      message.success('座位选择成功');
      
      // 检查是否需要自动跳转到课程页面
      const { classInfo } = response.data || {};
      if (classInfo?.autoRedirectToLesson && 
          classInfo.currentCourse && 
          classInfo.currentUnit && 
          classInfo.currentLesson) {
        // 跳转到具体的课程页面
        navigate(`/student/course/${classInfo.currentCourse}/unit/${classInfo.currentUnit}/lesson/${classInfo.currentLesson}`);
      } else {
        // 导航到学生主页
        navigate('/student');
      }
    } catch (error) {
      message.error(error.response?.data?.message || '座位选择失败');
    }
  };

  const renderSeat = (col, row) => {
    const seatNumber = `${String.fromCharCode(65 + col)}${row + 1}`;
    const isSelected = selectedSeat === seatNumber;
    const occupant = seatMap[seatNumber];
    const isOccupiedByOther = occupant && occupant._id !== currentUser?.id;

    return (
      <div
        key={`${col}-${row}`}
        style={{
          ...styles.seat,
          ...(isOccupiedByOther ? styles.occupiedSeat : {}),
          ...(isSelected ? styles.selectedSeat : {})
        }}
        onClick={() => handleSeatClick(col, row)}
      >
        <div style={styles.seatNumberText}>{seatNumber}</div>
        {occupant && (
          <div style={styles.occupantName}>{occupant.name}</div>
        )}
      </div>
    );
  };

  const renderGrid = () => {
    const grid = [];
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        grid.push(renderSeat(col, row));
      }
    }
    return grid;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <Card title="正在加载座位布局...">
          <div style={styles.loadingContainer}>
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Card>
        <div style={styles.headerContainer}>
          <h3 style={styles.title}>请选择你的座位</h3>
          
          {layout.name ? (
            <span style={styles.layoutName}>
              {layout.name}
            </span>
          ) : null}
        </div>
        
        <div style={styles.teacherDesk}>
          讲台
        </div>
        <div style={{
          ...styles.seatGrid,
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`
        }}>
          {renderGrid()}
        </div>
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            onClick={handleConfirm}
            disabled={!selectedSeat}
          >
            确认选择
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SeatSelection; 