import React from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Row,
  Col
} from 'antd';


// 课时编辑：练习类活动的提交与自动评分设置
const PracticeSubmissionSettings = ({}) => (
  <Form.Item
    noStyle
    shouldUpdate={(prevValues, currentValues) =>
      prevValues.type !== currentValues.type
    }
  >
    {({ getFieldValue }) => {
      const activityType = getFieldValue('type');
      // 只有练习类型才显示文件提交设置
      if (activityType === 'practice') {
        return (
          <Card
            title="文件提交设置"
            style={{ marginBottom: 24 }}
            type="inner"
          >
            <Form.Item
              name="allowedFormats"
              label="允许的文件格式"
              rules={[
                { required: true, message: '请选择允许的文件格式' },
                {
                  validator: (_, value) => {
                    if (!value || value.length <= 1) return Promise.resolve();
                                          
                    const hasPpt = value.some(v => v.includes('PPT'));
                    const hasExcel = value.some(v => v.includes('XLS'));
                    const hasWord = value.some(v => v.includes('DOC'));
                    const hasPython = value.some(v => v === 'PY');
                                          
                    const typesCount = [hasPpt, hasExcel, hasWord, hasPython].filter(Boolean).length;
                    if (typesCount > 1) {
                      return Promise.reject(new Error('批阅系统限制：不能同时选择多种需专门解析的格式（如 PPT 和 Excel 不能混选）'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Select mode="multiple" placeholder="请选择允许的文件格式">
                <Select.Option value="DOC">DOC</Select.Option>
                <Select.Option value="DOCX">DOCX</Select.Option>
                <Select.Option value="PDF">PDF</Select.Option>
                <Select.Option value="PPT">PPT</Select.Option>
                <Select.Option value="PPTX">PPTX</Select.Option>
                <Select.Option value="XLS">XLS</Select.Option>
                <Select.Option value="XLSX">XLSX</Select.Option>
                <Select.Option value="ZIP">ZIP</Select.Option>
                <Select.Option value="RAR">RAR</Select.Option>
                <Select.Option value="PY">PY</Select.Option>
                <Select.Option value="TXT">TXT</Select.Option>
                <Select.Option value="C">C</Select.Option>
                <Select.Option value="CPP">CPP</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => {
                const prevFormats = prevValues.allowedFormats || [];
                const currentFormats = currentValues.allowedFormats || [];
                return prevFormats.includes('PY') !== currentFormats.includes('PY');
              }}
            >
              {({ getFieldValue }) => {
                const allowedFormats = getFieldValue('allowedFormats') || [];
                return allowedFormats.includes('PY') ? (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="description"
                        label="AI提示词"
                        extra="为AI提供的指导信息，用于评估学生的代码"
                      >
                        <Input.TextArea
                          rows={4}
                          placeholder="请输入AI提示词（可描述评分标准、关键点等）"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="referenceAnswer"
                        label="参考答案"
                        extra="用于Python编程题的参考答案代码"
                      >
                        <Input.TextArea
                          rows={4}
                          placeholder="请输入Python代码参考答案（选填）"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : null;
              }}
            </Form.Item>
          </Card>
        );
      }
      return null;
    }}
  </Form.Item>
);

export default PracticeSubmissionSettings;
