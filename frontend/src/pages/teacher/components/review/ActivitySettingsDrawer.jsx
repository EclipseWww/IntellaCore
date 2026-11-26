import React from 'react';
import {
  Space,
  Button,
  Form,
  Input,
  Spin,
  Drawer
} from 'antd';



import { SettingOutlined, SaveOutlined, EditOutlined } from '@ant-design/icons';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';


const { TextArea } = Input;

// 活动详情设置抽屉（批阅页）
const ActivitySettingsDrawer = ({ activityDetails, activitySettingsVisible, editingActivityDetails, handleActivityDetailsChange, handleCloseActivitySettings, loadingActivityDetails, setEditingActivityDetails, updateActivityDetails }) => {
  return (
    <Drawer
      title={
        <Space>
          <SettingOutlined />
          <span>Python作业设置</span>
        </Space>
      }
      width={500}
      open={activitySettingsVisible}
      onClose={handleCloseActivitySettings}
      maskClosable={!loadingActivityDetails}
      extra={
        <Space>
          {editingActivityDetails ? (
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={updateActivityDetails}
                loading={loadingActivityDetails}
              >
                保存
              </Button>
              <Button
                onClick={() => setEditingActivityDetails(false)}
                disabled={loadingActivityDetails}
              >
                取消
              </Button>
            </>
          ) : (
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditingActivityDetails(true)}
              disabled={loadingActivityDetails}
            >
              编辑
            </Button>
          )}
        </Space>
      }
    >
      <Spin spinning={loadingActivityDetails}>
        <Form layout="vertical">
          <Form.Item label="活动描述">
            {editingActivityDetails ? (
              <TextArea
                value={activityDetails.description}
                onChange={e => handleActivityDetailsChange('description', e.target.value)}
                autoSize={{ minRows: 3, maxRows: 8 }}
                placeholder="请输入活动描述"
              />
            ) : (
              <div style={{
                border: '1px solid #f0f0f0',
                padding: '8px 12px',
                borderRadius: '4px',
                minHeight: '80px',
                maxHeight: '200px',
                overflowY: 'auto',
                background: '#fafafa'
              }}>
                {activityDetails.description || '暂无描述'}
              </div>
            )}
          </Form.Item>

          <Form.Item label="参考答案">
            {editingActivityDetails ? (
              <TextArea
                value={activityDetails.referenceAnswer}
                onChange={e => handleActivityDetailsChange('referenceAnswer', e.target.value)}
                autoSize={{ minRows: 6, maxRows: 15 }}
                placeholder="请输入参考答案（Python代码）"
              />
            ) : (
              <div>
                {activityDetails.referenceAnswer ? (
                  <SyntaxHighlighter
                    language="python"
                    style={github}
                    showLineNumbers={true}
                    customStyle={{
                      margin: 0,
                      borderRadius: '4px',
                      maxHeight: '400px',
                      overflow: 'auto'
                    }}
                  >
                    {activityDetails.referenceAnswer}
                  </SyntaxHighlighter>
                ) : (
                  <div style={{
                    border: '1px solid #f0f0f0',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    minHeight: '80px',
                    background: '#fafafa'
                  }}>
                    暂无参考答案
                  </div>
                )}
              </div>
            )}
          </Form.Item>
        </Form>
      </Spin>
    </Drawer>
  );
};

export default ActivitySettingsDrawer;
