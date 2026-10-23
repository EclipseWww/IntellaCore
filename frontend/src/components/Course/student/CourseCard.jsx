import React from 'react';
import { Card, Tag, Button, Typography } from 'antd';
import { ReadOutlined, RightOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;

// 课程类型映射
const courseTypeMap = {
  'software': { color: 'blue', label: '软件开发' },
  'programming': { color: 'purple', label: '编程语言' },
  'language': { color: 'magenta', label: '语言学习' },
  'design': { color: 'orange', label: '设计创作' },
  'business': { color: 'green', label: '商业管理' },
  'other': { color: 'default', label: '其他' }
};

// 自定义样式
const styles = {
  card: {
    width: '300px',
    height: '320px',
    borderRadius: '8px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    border: '1px solid #f0f0f0',
    margin: '12px',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #f0f0f0',
    background: 'linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%)'
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
    display: 'flex',
    alignItems: 'center'
  },
  icon: {
    fontSize: '22px',
    color: '#1890ff',
    marginRight: '12px'
  },
  content: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'space-between'
  },
  topContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  description: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    margin: '0 0 16px 0',
    color: '#666'
  },
  tagContainer: {
    marginBottom: '16px'
  },
  tag: {
    marginRight: 8,
    marginBottom: 4
  },
  buttonContainer: {
    marginTop: '8px'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonIcon: {
    marginLeft: '4px'
  }
};

const CourseCard = ({ course, onClick }) => {
  const { _id, title, description, type, tags } = course;

  // 获取课程类型信息
  const typeInfo = courseTypeMap[type] || courseTypeMap.other;

  return (
    <Card
      hoverable
      onClick={() => onClick(_id)}
      style={styles.card}
      bodyStyle={{
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
      className="course-card"
    >
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={styles.title}>
            <ReadOutlined style={styles.icon} />
            {title}
          </div>
          <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.topContent}>
          <Paragraph style={styles.description}>
            {description || `由此开始${title}的学习吧！`}
          </Paragraph>

          <div style={styles.tagContainer}>
            {tags?.map(tag => (
              <Tag key={tag} color="green" style={styles.tag}>
                {tag}
              </Tag>
            ))}
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <Button
            type="primary"
            block
            style={styles.button}
            onClick={(e) => {
              e.stopPropagation();
              onClick(_id);
            }}
          >
            开始学习 <RightOutlined style={styles.buttonIcon} />
          </Button>
        </div>
      </div>
    </Card>
  );
};

// 添加CSS样式
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = `
  .course-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;
document.head.appendChild(styleSheet);

export default CourseCard;
