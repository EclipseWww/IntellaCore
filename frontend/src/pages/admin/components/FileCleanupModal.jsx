import React, { useState } from 'react';
import { Card, Row, Col, Table, Button, message, Modal, Form, Select, Checkbox, Alert, DatePicker, Steps, Result, Spin, Typography, Tag } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { assignmentFilesAPI } from '../../../services/api';
import moment from 'moment';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Step } = Steps;
const { Text } = Typography;

// 作业文件清理（三步：选择范围 → 预览 → 结果）。open/onClose 由控制台控制，清理完成后调用 onCleaned 刷新统计
const FileCleanupModal = ({ open, onClose, courses, classes, onCleaned }) => {
  const cleanupModalVisible = open;
  const setCleanupModalVisible = (visible) => { if (!visible) onClose(); };
  const [cleanupForm] = Form.useForm();
  const [cleanupStep, setCleanupStep] = useState(1);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [validatedFormValues, setValidatedFormValues] = useState(null);

  const handlePreviewCleanup = async () => {
    try {
      await cleanupForm.validateFields();
      const values = cleanupForm.getFieldsValue();
      setValidatedFormValues(values);

      if (!values.deleteOriginals && !values.deletePreviews) {
        message.error('请至少选择一种要删除的文件类型');
        return;
      }

      setCleanupLoading(true);

      const filters = {
        courseIds: values.courseIds,
        classIds: values.classIds,
        dateRange: values.dateRange ? [
          values.dateRange[0].format('YYYY-MM-DD'),
          values.dateRange[1].format('YYYY-MM-DD')
        ] : undefined
      };

      const options = {
        deleteOriginals: values.deleteOriginals,
        deletePreviews: values.deletePreviews
      };

      try {
        const data = await assignmentFilesAPI.previewCleanup(filters, options);
        setPreviewData(data);
        setCleanupLoading(false);
        setCleanupStep(2);
      } catch (error) {
        setCleanupLoading(false);
        message.error('预览清理失败');
      }
    } catch (error) {
      message.error('表单验证失败');
    }
  };

  const handleExecuteCleanup = async () => {
    setCleanupLoading(true);

    const values = validatedFormValues;
    const filters = {
      courseIds: values.courseIds,
      classIds: values.classIds,
      dateRange: values.dateRange ? [
        values.dateRange[0].format('YYYY-MM-DD'),
        values.dateRange[1].format('YYYY-MM-DD')
      ] : undefined
    };

    const options = {
      deleteOriginals: values.deleteOriginals,
      deletePreviews: values.deletePreviews
    };

    try {
      const data = await assignmentFilesAPI.cleanupFiles(filters, options);
      setCleanupResult(data);
      setCleanupLoading(false);
      setCleanupStep(3);

      // 刷新系统概览和统计
      onCleaned && onCleaned();
    } catch (error) {
      setCleanupLoading(false);
      message.error('执行清理失败');
    }
  };

  const resetCleanup = () => {
    setCleanupStep(1);
    setPreviewData(null);
    setCleanupResult(null);
    cleanupForm.resetFields();
  };

  const handleCleanupModalClose = () => {
    if (cleanupLoading) return;

    if (cleanupStep !== 1) {
      Modal.confirm({
        title: '确认取消',
        icon: <ExclamationCircleOutlined />,
        content: '取消操作将丢失当前进度，确定要退出吗？',
        onOk() {
          resetCleanup();
          setCleanupModalVisible(false);
        }
      });
    } else {
      resetCleanup();
      setCleanupModalVisible(false);
    }
  };

  return (
  <Modal
    title="作业文件清理"
    open={cleanupModalVisible}
    onCancel={handleCleanupModalClose}
    footer={
      cleanupStep === 3 ? null : [
        <Button
          key="cancel"
          onClick={handleCleanupModalClose}
          disabled={cleanupLoading}
        >
          取消
        </Button>,
        cleanupStep === 2 && (
          <Button
            key="back"
            onClick={() => setCleanupStep(1)}
            disabled={cleanupLoading}
          >
            上一步
          </Button>
        ),
        <Button
          key="next"
          type={cleanupStep === 2 ? "primary" : "default"}
          danger={cleanupStep === 2}
          onClick={cleanupStep === 1 ? handlePreviewCleanup : handleExecuteCleanup}
          loading={cleanupLoading}
        >
          {cleanupStep === 1 ? '下一步' : '执行清理'}
        </Button>
      ]
    }
    width={800}
    maskClosable={false}
    closable={!cleanupLoading}
    destroyOnClose
  >
    <Steps current={cleanupStep - 1} style={{ marginBottom: 24 }}>
      <Step title="选择条件" />
      <Step title="预览" />
      <Step title="完成" />
    </Steps>

    {cleanupLoading ? (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>
          {cleanupStep === 1 ? '正在后台分析文件，文件较多时请耐心等待...' : '正在后台清理文件，请勿重复提交...'}
        </p>
      </div>
    ) : cleanupStep === 1 ? (
      <>
        <Alert
          message="作业文件清理"
          description="您可以按条件清理旧的作业文件以释放磁盘空间。此操作不可逆，请谨慎选择。"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={cleanupForm}
          layout="vertical"
          initialValues={{
            deleteOriginals: true,
            deletePreviews: true
          }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="courseIds" label="选择课程">
                <Select
                  mode="multiple"
                  placeholder="选择要清理的课程"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {courses.map(course => (
                    <Option key={course._id} value={course._id}>
                      {course.title} <Tag color="blue">{course.instructor?.name || '未知教师'}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="classIds" label="选择班级">
                <Select
                  mode="multiple"
                  placeholder="选择要清理的班级"
                  allowClear
                  style={{ width: '100%' }}
                >
                  {classes.filter(cls => cls.type !== 'elective').map(cls => (
                    <Option key={cls._id} value={cls._id}>{cls.grade}级{cls.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dateRange" label="提交日期区间">
            <RangePicker
              style={{ width: '100%' }}
              ranges={{
                '过去30天': [moment().subtract(30, 'days'), moment()],
                '过去90天': [moment().subtract(90, 'days'), moment()],
                '过去半年': [moment().subtract(6, 'months'), moment()],
                '过去一年': [moment().subtract(1, 'year'), moment()]
              }}
            />
          </Form.Item>

          <Typography.Title level={5}>删除选项</Typography.Title>
          <Row gutter={[24, 16]}>
            <Col span={12}>
              <Form.Item name="deleteOriginals" valuePropName="checked">
                <Checkbox>删除原始作业文件</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deletePreviews" valuePropName="checked">
                <Checkbox>删除PDF预览文件</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </>
    ) : cleanupStep === 2 ? (
      <>
        <Alert
          message="清理预览"
          description={`将删除 ${previewData?.totalCount || 0} 个文件，预计释放 ${previewData?.totalSizeFormatted || '0'} 空间。`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 详细统计信息 */}
        {previewData?.statistics && (
          <div style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="按课程统计">
                  {previewData.statistics.byCourse && Object.entries(previewData.statistics.byCourse).map(([courseTitle, stats]) => (
                    <div key={courseTitle} style={{ marginBottom: 8 }}>
                      <Text strong>{courseTitle}</Text>
                      <br />
                      <Text type="secondary">
                        {stats.count} 个文件 ({stats.sizeFormatted})
                      </Text>
                    </div>
                  ))}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="按班级统计">
                  {previewData.statistics.byClass && Object.entries(previewData.statistics.byClass).map(([className, stats]) => (
                    <div key={className} style={{ marginBottom: 8 }}>
                      <Text strong>{className}</Text>
                      <br />
                      <Text type="secondary">
                        {stats.count} 个文件 ({stats.sizeFormatted})
                      </Text>
                    </div>
                  ))}
                </Card>
              </Col>
            </Row>
          </div>
        )}

        <Table
          dataSource={previewData?.files || []}
          columns={[
            {
              title: '文件名',
              dataIndex: 'fileName',
              key: 'fileName',
              ellipsis: true,
            },
            {
              title: '学生',
              dataIndex: 'studentName',
              key: 'studentName',
            },
            {
              title: '课程',
              dataIndex: 'courseTitle',
              key: 'courseTitle',
            },
            {
              title: '提交时间',
              dataIndex: 'submissionDate',
              render: date => new Date(date).toLocaleString(),
            },
            {
              title: '文件类型',
              dataIndex: 'type',
              render: type => type === 'original' ? '原始文件' : 'PDF预览',
            },
            {
              title: '文件大小',
              dataIndex: 'sizeFormatted',
              key: 'sizeFormatted',
            }
          ]}
          size="small"
          pagination={{ pageSize: 10 }}
          rowKey={(record) => `${record.submissionId}-${record.path || ''}`}
        />

        <Typography.Paragraph type="danger" style={{ marginTop: 16 }}>
          <ExclamationCircleOutlined style={{ marginRight: 8 }} />
          警告: 此操作不可撤销，删除的文件将无法恢复。
        </Typography.Paragraph>
      </>
    ) : (
      <Result
        status="success"
        title="文件清理完成"
        subTitle={`已成功清理 ${cleanupResult?.deletedCount || 0} 个文件，释放 ${cleanupResult?.deletedSizeFormatted || '0'} 空间。`}
        extra={[
          <Button
            type="primary"
            key="done"
            onClick={() => {
              resetCleanup();
              setCleanupModalVisible(false);
            }}
          >
            完成
          </Button>
        ]}
      />
    )}
  </Modal>
  );
};

export default FileCleanupModal;
