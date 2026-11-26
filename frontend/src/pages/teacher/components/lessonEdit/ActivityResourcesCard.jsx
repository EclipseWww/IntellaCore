import React from 'react';
import {
  Card,
  Button,
  Space,
  Table,
  Empty,
  Upload
} from 'antd';
import {
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined
} from '@ant-design/icons';


// 课时编辑：活动资源卡片
const ActivityResourcesCard = ({ activities, formatFileSize, handleDeleteResource, handleDownloadResource, handleUpload, selectedActivityIndex }) => (
  <Card
    title="活动资源"
    style={{ marginBottom: 24 }}
    type="inner"
    extra={
      <Upload
        customRequest={async ({ file }) => await handleUpload(file, selectedActivityIndex)}
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />}>上传资源</Button>
      </Upload>
    }
  >
    {activities[selectedActivityIndex]?.resources?.length > 0 ? (
      <Table
        dataSource={activities[selectedActivityIndex].resources.map(r => ({ ...r, key: r._id || r.path }))}
        columns={[
          {
            title: '文件名',
            dataIndex: 'filename',
            key: 'filename',
            ellipsis: true,
          },
          {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
          },
          {
            title: '大小',
            dataIndex: 'size',
            key: 'size',
            width: 100,
            render: (size) => formatFileSize(size)
          },
          {
            title: '上传时间',
            dataIndex: 'uploadTime',
            key: 'uploadTime',
            width: 180,
            render: (time) => new Date(time).toLocaleString()
          },
          {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_, record) => (
              <Space size="small">
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleDownloadResource(record)}
                  icon={<DownloadOutlined />}
                >
                  下载
                </Button>
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => handleDeleteResource(record)}
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </Space>
            )
          }
        ]}
        pagination={false}
        size="small"
      />
    ) : (
      <Empty
        description="暂无活动资源"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ margin: '16px 0' }}
      >
        <Upload
          customRequest={async ({ file }) => await handleUpload(file, selectedActivityIndex)}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>上传资源</Button>
        </Upload>
      </Empty>
    )}
  </Card>
);

export default ActivityResourcesCard;
