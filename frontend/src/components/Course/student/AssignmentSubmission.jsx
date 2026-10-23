import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Upload, 
  Button, 
  message, 
  Space,
  Typography 
} from 'antd';
import { UploadOutlined, SendOutlined } from '@ant-design/icons';
import { courseManagementAPI } from '../../../services/api';

const { TextArea } = Input;
const { Title, Text } = Typography;

const AssignmentSubmission = ({ 
  courseId, 
  unitId, 
  lessonId, 
  activityId, 
  assignmentInfo, 
  onSubmitSuccess 
}) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [comment, setComment] = useState('');

  const handleSubmit = async () => {
    if (!selectedFile) {
      message.error('请选择要上传的文件');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('comment', comment);

    try {
      const result = await courseManagementAPI.submitAssignment(
        courseId,
        unitId,
        lessonId,
        activityId,
        formData
      );

      if (result.success) {
        onSubmitSuccess();  // 只在这里触发一次成功回调
        setSelectedFile(null);
        setComment('');
      }
    } catch (error) {
      console.error('提交作业失败:', error);
      message.error('提交作业失败');  // 只在这里显示一次错误提示
    } finally {
      setUploading(false);
    }
  };

  const beforeUpload = (file) => {
    // 检查文件类型
    const fileExtension = file.name.split('.').pop().toUpperCase();
    if (!assignmentInfo.allowedFormats.includes(fileExtension)) {
      message.error(`只允许上传 ${assignmentInfo.allowedFormats.join(', ')} 格式的文件`);
      return false;
    }

    // 检查文件大小（从环境变量获取限制，默认20MB）
    const maxFileSize = (process.env.REACT_APP_MAX_ASSIGNMENT_FILE_SIZE || 20) * 1024 * 1024;
    const isLtMax = file.size / 1024 / 1024 < maxFileSize;
    if (!isLtMax) {
      message.error(`文件大小不能超过${maxFileSize / 1024 / 1024}MB`);
      return false;
    }

    // 使用 antd Upload 组件的文件对象
    setFileList([{
      uid: file.uid,
      name: file.name,
      status: 'done',
      originFileObj: file,
    }]);
    setSelectedFile(file);
    return false; // 阻止自动上传
  };

  return (
    <Card className="assignment-submission">
      <Title level={4}>提交作业</Title>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {assignmentInfo.description && (
          <div style={{ marginBottom: 16 }}>
            <Text strong>作业要求：</Text>
            <div>{assignmentInfo.description}</div>
          </div>
        )}
        
        <Form.Item
          name="file"
          label="作业文件"
          rules={[{ required: true, message: '请上传作业文件' }]}
        >
          <Upload
            beforeUpload={beforeUpload}
            fileList={fileList}
            onRemove={() => setFileList([])}
            accept={assignmentInfo.allowedFormats.map(format => `.${format.toLowerCase()}`).join(',')}
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
        </Form.Item>

        <Form.Item
          name="comment"
          label="备注"
        >
          <Input.TextArea
            placeholder="请输入备注信息（选填）"
            maxLength={500}
            showCount
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={uploading}
            disabled={fileList.length === 0}
          >
            提交作业
          </Button>
        </Form.Item>
      </Form>
      
      <div>
        <Text type="secondary">
          允许的文件格式：{assignmentInfo.allowedFormats.join(', ')}
        </Text>
      </div>
    </Card>
  );
};

export default AssignmentSubmission;
