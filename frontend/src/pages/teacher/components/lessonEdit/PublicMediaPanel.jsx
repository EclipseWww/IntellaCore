import React from 'react';
import {
  Button,
  message,
  Space,
  Typography,
  Table,
  Empty,
  Upload,
  Popconfirm
} from 'antd';
import {
  DeleteOutlined,
  UploadOutlined,
  CopyOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import { mediaAPI } from '../../../../services/api';


// 课时编辑：“公开媒体”标签页内容
const PublicMediaPanel = ({ copyMarkdownMediaCode, copyMediaUrlToClipboard, courseId, formatFileSize, getMediaPreview, handleDeletePublicMedia, handleImageBeforeUpload, lessonId, loadPublicMedias, loadingMedias, publicMedias, setLoadingMedias, unitId }) => (
  <>
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
      <Space>
        <Upload
          customRequest={() => { }}
          beforeUpload={handleImageBeforeUpload}
          showUploadList={false}
          accept="image/*"
        >
          <Button
            type="primary"
            icon={<UploadOutlined />}
          >
            上传图片
          </Button>
        </Upload>
        <Upload
          customRequest={async ({ file }) => {
            // 直接走媒体上传接口
            const formData = new FormData();
            formData.append('media', file);
            try {
              setLoadingMedias(true);
              const resp = await mediaAPI.uploadMedia(courseId, unitId, lessonId, formData);
              if (resp.success) {
                message.success('视频上传成功');
                loadPublicMedias();
              } else {
                message.error('视频上传失败');
              }
            } catch (err) {
              console.error('视频上传失败:', err);
              message.error('视频上传失败: ' + (err.response?.data?.message || err.message));
            } finally {
              setLoadingMedias(false);
            }
          }}
          showUploadList={false}
          accept="video/*"
        >
          <Button
            type="default"
            icon={<UploadOutlined />}
          >
            上传视频
          </Button>
        </Upload>
        <Button
          onClick={loadPublicMedias}
          icon={<FileImageOutlined />}
        >
          刷新媒体列表
        </Button>
      </Space>
      <Typography.Text type="secondary">
        公开媒体可以在所有活动中通过Markdown引用
      </Typography.Text>
    </div>
    <Table
      loading={loadingMedias}
      dataSource={publicMedias.map(media => ({ ...media, key: media.path }))}
      columns={[
        {
          title: '预览',
          key: 'preview',
          width: 80,
          render: (_, record) => getMediaPreview(record)
        },
        {
          title: '类型',
          dataIndex: 'mediaType',
          key: 'mediaType',
          width: 80,
          render: (type) => type === 'video' ? '视频' : '图片'
        },
        {
          title: '文件名',
          dataIndex: 'filename',
          key: 'filename',
          ellipsis: true,
          width: '30%'
        },
        {
          title: '大小',
          dataIndex: 'size',
          key: 'size',
          width: 100,
          render: (size) => formatFileSize(size)
        },
        {
          title: '操作',
          key: 'action',
          width: 180,
          render: (_, record) => (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyMediaUrlToClipboard(record)}
                title="复制URL"
              >
                URL
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => copyMarkdownMediaCode(record)}
                title="复制Markdown"
              >
                MD
              </Button>
              <Popconfirm
                title={`确定要删除这${record.mediaType === 'video' ? '个视频' : '张图片'}吗？`}
                onConfirm={() => handleDeletePublicMedia(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  title={`删除${record.mediaType === 'video' ? '视频' : '图片'}`}
                />
              </Popconfirm>
            </Space>
          )
        }
      ]}
      pagination={{ pageSize: 5, size: 'small' }}
      size="small"
      scroll={{ x: 'max-content' }}
    />
    {publicMedias.length === 0 && !loadingMedias && (
      <Empty description="暂无公开媒体文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
    )}
  </>
);

export default PublicMediaPanel;
