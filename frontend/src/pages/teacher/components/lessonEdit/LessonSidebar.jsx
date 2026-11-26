import React from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Col,
  Tag,
  Empty,
  Menu
} from 'antd';
import {
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';

const { TextArea } = Input;

// 课时编辑：左侧课时信息与活动列表
const LessonSidebar = ({ activities, form, handleActivitySelect, handleAddActivity, handleMoveDown, handleMoveUp, handleSubmit, loading, selectedActivityIndex }) => (
  <Col span={6}>
    <div className="left-sidebar">
      {/* 课时基本信息卡片 */}
      <Card
        title={<span style={{ fontWeight: 'bold' }}>课时基本信息</span>}
        className="info-card"
        style={{ marginBottom: 24 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="课时标题"
            rules={[{ required: true, message: '请输入课时标题' }]}
          >
            <Input placeholder="请输入课时标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="课时描述"
          >
            <TextArea rows={4} placeholder="请输入课时描述" />
          </Form.Item>

          <Form.Item
            name="objectives"
            label="学习目标"
          >
            <Select
              mode="tags"
              placeholder="请输入学习目标（回车添加）"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              保存课时信息
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 活动列表卡片 */}
      <Card
        title={<span style={{ fontWeight: 'bold' }}>活动列表</span>}
        className="activities-card"
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddActivity}
          >
            添加活动
          </Button>
        }
      >
        <div className="activities-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {activities.length > 0 ? (
            <Menu
              mode="vertical"
              selectedKeys={[selectedActivityIndex.toString()]}
              style={{ border: 'none' }}
            >
              {activities.map((activity, index) => (
                <Menu.Item
                  key={index.toString()}
                  onClick={() => handleActivitySelect(index)}
                  style={{
                    margin: '4px 0',
                    padding: '0',
                    borderRadius: '4px',
                    background: selectedActivityIndex === index ? '#e6f7ff' : 'transparent',
                    height: 'auto',
                    lineHeight: 'normal'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    padding: '8px 16px',
                    minHeight: '40px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexGrow: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <Tag color={
                        activity.type === 'reading' ? 'blue' :
                          activity.type === 'quiz' ? 'green' :
                            activity.type === 'discussion' ? 'orange' :
                              activity.type === 'practice' ? 'purple' :
                                activity.type === 'typing' ? 'cyan' :
                                  activity.type === 'flowchart' ? 'magenta' :
                                    activity.type === 'spreadsheet' ? 'lime' :
                                      activity.type === 'html' ? 'volcano' :
                                        activity.type === 'fillblank' ? 'geekblue' :
                                          activity.type === 'python' ? 'gold' : 'default'
                      }>
                        {activity.type === 'reading' ? '阅读' :
                          activity.type === 'quiz' ? '测验' :
                            activity.type === 'discussion' ? '讨论' :
                              activity.type === 'practice' ? '练习' :
                                activity.type === 'typing' ? '打字' :
                                  activity.type === 'flowchart' ? '流程图' :
                                    activity.type === 'spreadsheet' ? '表格' :
                                      activity.type === 'html' ? 'HTML' :
                                        activity.type === 'fillblank' ? '填空' :
                                          activity.type === 'python' ? 'Python' : '活动'}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{activity.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveUp(index);
                        }}
                      />
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={index === activities.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDown(index);
                        }}
                      />
                    </div>
                  </div>
                </Menu.Item>
              ))}
            </Menu>
          ) : (
            <Empty
              description="暂无活动"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ margin: '30px 0' }}
            />
          )}
        </div>
      </Card>
    </div>
  </Col>
);

export default LessonSidebar;
