import React from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Modal,
  Select,
  Checkbox,
  Row,
  Col,
  Tag,
  InputNumber,
  Switch,
  Divider,
  Alert
} from 'antd';
import {
  PlusOutlined,
  MinusCircleOutlined
} from '@ant-design/icons';
import MarkdownEditor from '../../../../components/shared/MarkdownEditor';


// 课时编辑：按活动类型显示的设置项（阅读、测验、打字、流程图、表格、填空、Python 等）
const ActivityTypeSettings = ({ handlePublishQuiz, handleQuizChange, loadingQuizDetails, quizDetails, quizzes, spreadsheets, typingTexts }) => (
  <Form.Item
    noStyle
    shouldUpdate={(prevValues, currentValues) =>
      prevValues.type !== currentValues.type
    }
  >
    {({ getFieldValue }) => {
      const activityType = getFieldValue('type');
      if (activityType === 'typing') {
        return (
          <Card
            title="打字练习设置"
            style={{ marginBottom: 24 }}
            type="inner"
          >
            <Form.Item
              name={['typingSettings', 'text']}
              label="练习文本"
              rules={[{ required: true, message: '请选择练习文本' }]}
            >
              <Select
                placeholder="请选择练习文本"
                showSearch
                optionFilterProp="children"
              >
                {typingTexts.map(text => (
                  <Select.Option key={text._id} value={text._id}>
                    {text.content.substring(0, 30)}...
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name={['typingSettings', 'targetSpeed']}
                  label="目标速度(字/分钟)"
                  rules={[{ required: true, message: '请设置目标速度' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['typingSettings', 'targetAccuracy']}
                  label="目标准确率(%)"
                  rules={[{ required: true, message: '请设置目标准确率' }]}
                >
                  <InputNumber min={1} max={100} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={['typingSettings', 'timeLimit']}
                  label="时间限制(分钟)"
                  rules={[{ required: true, message: '请设置时间限制' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name={['typingSettings', 'allowOnce']}
                  valuePropName="checked"
                  label=""
                >
                  <Checkbox>只允许完成一次（完成后不可再次练习）</Checkbox>
                </Form.Item>
              </Col>
            </Row>
          </Card>
        );
      } else if (activityType === 'quiz') {
        return (
          <Card
            title="测验设置"
            style={{ marginBottom: 24 }}
            type="inner"
            loading={loadingQuizDetails}
          >
            <Form.Item
              name={['quizSettings', 'quiz']}
              label="选择测验"
              rules={[{ required: true, message: '请选择测验' }]}
            >
              <Select
                placeholder="请选择测验"
                showSearch
                optionFilterProp="children"
                onChange={handleQuizChange}
              >
                {quizzes.map(quiz => (
                  <Select.Option key={quiz._id} value={quiz._id}>
                    {quiz.title}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {/* 选择测验后显示更多设置 */}
            {quizDetails && (
              <>
                <Divider orientation="left">测验配置</Divider>



                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Tag color={
                      quizDetails.status === 'DRAFT' ? 'default' :
                        quizDetails.status === 'PUBLISHED' ? 'green' :
                          quizDetails.status === 'IN_PROGRESS' ? 'blue' :
                            quizDetails.status === 'ENDED' ? 'red' : 'default'
                    }>
                      {
                        quizDetails.status === 'DRAFT' ? '草稿' :
                          quizDetails.status === 'PUBLISHED' ? '已发布' :
                            quizDetails.status === 'IN_PROGRESS' ? '进行中' :
                              quizDetails.status === 'ENDED' ? '已结束' : quizDetails.status
                      }
                    </Tag>
                    {quizDetails.questions?.length > 0 ? (
                      <Tag color="blue" style={{ marginLeft: '8px' }}>
                        题目数量: {quizDetails.questions.length}
                      </Tag>
                    ) : (
                      <Tag color="red" style={{ marginLeft: '8px' }}>
                        未添加题目
                      </Tag>
                    )}
                  </div>
                  {quizDetails.status === 'DRAFT' && quizDetails.questions?.length > 0 && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => {
                        Modal.confirm({
                          title: '确认发布测验',
                          content: '发布后测验将对学生可见，确定要发布吗？',
                          onOk: () => handlePublishQuiz(quizDetails._id)
                        });
                      }}
                    >
                      发布测验
                    </Button>
                  )}
                  {quizDetails.status === 'PUBLISHED' && (
                    <Button
                      danger
                      size="small"
                      onClick={() => {
                        Modal.confirm({
                          title: '确认撤回测验',
                          content: '撤回后测验将变为草稿状态，不再对学生可见，确定要撤回吗？',
                          onOk: () => handlePublishQuiz(quizDetails._id)
                        });
                      }}
                    >
                      撤回测验
                    </Button>
                  )}
                </div>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['quizSettings', 'timeLimit']}
                      label="时间限制(分钟)"
                      extra="0表示无时间限制"
                    >
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="允许多次尝试"
                      style={{ marginBottom: 0 }}
                    >
                      <Space>
                        <Form.Item
                          name={['quizSettings', 'allowMultipleAttempts']}
                          valuePropName="checked"
                          style={{ marginBottom: 0 }}
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item
                          noStyle
                          shouldUpdate={(prevValues, currentValues) => {
                            return prevValues.quizSettings?.allowMultipleAttempts !==
                              currentValues.quizSettings?.allowMultipleAttempts;
                          }}
                        >
                          {({ getFieldValue }) => {
                            const allowMultiple = getFieldValue(['quizSettings', 'allowMultipleAttempts']);
                            return allowMultiple ? (
                              <Form.Item
                                name={['quizSettings', 'maxAttempts']}
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber
                                  min={1}
                                  placeholder="最大次数"
                                  style={{ width: '100px' }}
                                />
                              </Form.Item>
                            ) : null;
                          }}
                        </Form.Item>
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['quizSettings', 'randomizeQuestions']}
                      label="随机题目顺序"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['quizSettings', 'randomizeOptions']}
                      label="随机选项顺序"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name={['quizSettings', 'showAnswerAfterSubmit']}
                      label="提交后显示答案"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['quizSettings', 'showScoreAfterSubmit']}
                      label="提交后显示分数"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>


              </>
            )}
          </Card>
        );
      } else if (activityType === 'flowchart') {
        return (
          <Card
            title="流程图设置"
            style={{ marginBottom: 24 }}
            type="inner"
          >
            <Form.Item
              name={['flowchartSettings', 'instructions']}
              label="绘制说明"
              extra="向学生说明流程图的绘制要求"
            >
              <MarkdownEditor
                placeholder="请输入流程图绘制说明，支持Markdown格式"
                height={300}
              />
            </Form.Item>

            <Form.Item
              name={['flowchartSettings', 'allowedNodeTypes']}
              label="允许的节点类型"
              extra="不选择则允许所有类型"
            >
              <Select
                mode="multiple"
                placeholder="选择允许使用的节点类型（可多选）"
                allowClear
              >
                <Select.Option value="start">开始</Select.Option>
                <Select.Option value="end">结束</Select.Option>
                <Select.Option value="process">处理</Select.Option>
                <Select.Option value="decision">判断</Select.Option>
                <Select.Option value="data">数据</Select.Option>
                <Select.Option value="connector">连接器</Select.Option>
              </Select>
            </Form.Item>

            <Alert
              type="info"
              message="流程图活动说明"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>学生将在学习页面看到流程图编辑器</li>
                  <li>学生可以拖拽节点、连接节点来绘制流程图</li>
                  <li>提交后教师可以在课堂管理中查看和评分</li>
                </ul>
              }
              style={{ marginTop: 16 }}
            />
          </Card>
        );
      } else if (activityType === 'spreadsheet') {
        return (
          <Card
            title="在线表格设置"
            style={{ marginBottom: 24 }}
            type="inner"
          >
            <Form.Item
              name={['spreadsheetSettings', 'instructions']}
              label="活动说明"
              extra="向学生说明表格处理的要求"
            >
              <MarkdownEditor
                placeholder="请输入活动说明，支持Markdown格式"
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name={['spreadsheetSettings', 'spreadsheetId']}
                  label="模板表格 (可选)"
                  extra="如果选择了模板，学生将基于该模板开始"
                >
                  <Select
                    placeholder="请选择模板表格"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    {spreadsheets.map(ss => (
                      <Select.Option key={ss._id} value={ss._id}>
                        {ss.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name={['spreadsheetSettings', 'timeLimit']}
                  label="时间限制(分钟)"
                  extra="0表示无时间限制"
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        );
      } else if (activityType === 'fillblank') {
        return (
          <Card
            title="填空设置"
            style={{ marginBottom: 24 }}
            type="inner"
          >
            <Form.Item
              name={['fillBlankSettings', 'instructions']}
              label="活动说明"
              extra="向学生说明填空的要求"
            >
              <MarkdownEditor
                placeholder="请输入活动说明，支持Markdown格式"
                height={150}
              />
            </Form.Item>

            <Form.Item
              name={['fillBlankSettings', 'content']}
              label="填空内容"
              rules={[{ required: true, message: '请输入填空内容' }]}
              extra={
                <div style={{ marginTop: 8 }}>
                  <strong>使用方法：</strong> 在需要挖空的位置使用 <code>{'{{blank:正确答案}}'}</code> 标记。<br />
                  <strong>示例：</strong> <code>{'HTTP协议的默认端口号是{{blank:80}}，HTTPS协议的默认端口号是{{blank:443}}。'}</code>
                </div>
              }
            >
              <MarkdownEditor
                placeholder="请输入带有填空标记的内容..."
                height={400}
              />
            </Form.Item>

            <Form.Item
              name={['fillBlankSettings', 'showCorrectAfterSubmit']}
              label="提交后显示正确答案"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch />
            </Form.Item>

            <Alert
              type="info"
              message="填空活动说明"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>学生将看到带有输入框的文本，需要填写空白处</li>
                  <li>提交后系统将自动对比答案并计算得分</li>
                  <li>支持文本填空和Markdown表格填空</li>
                </ul>
              }
              style={{ marginTop: 16 }}
            />
          </Card>
        );
      } else if (activityType === 'python') {
        return (
          <Card
            title="Python编程设置"
            style={{ marginBottom: 24 }}
            type="inner"
          >
            <Form.Item
              name={['pythonSettings', 'instructions']}
              label="活动说明"
              extra="向学生说明编程任务的要求"
            >
              <MarkdownEditor
                placeholder="请输入活动说明，支持Markdown格式"
                height={200}
              />
            </Form.Item>

            <Form.Item
              name={['pythonSettings', 'starterCode']}
              label="初始代码"
              extra="学生开始编程时看到的代码模板"
            >
              <Input.TextArea
                rows={8}
                placeholder="# 在这里编写你的Python代码"
                style={{ fontFamily: 'Consolas, Monaco, monospace' }}
              />
            </Form.Item>

            <Form.Item
              name={['pythonSettings', 'maxAttempts']}
              label="最多提交次数"
              extra="0 表示不限；有测试点时每次提交都会在服务器重新评测"
            >
              <InputNumber min={0} max={100} precision={0} style={{ width: 160 }} />
            </Form.Item>

            <Divider orientation="left">测试用例（OJ自动评测）</Divider>

            <Form.List name={['pythonSettings', 'testCases']}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }, index) => (
                    <Card
                      key={key}
                      size="small"
                      title={`测试点 ${index + 1}`}
                      style={{ marginBottom: 12 }}
                      extra={
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                        >
                          删除
                        </Button>
                      }
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'input']}
                            label="输入数据"
                            extra="每行对应一次 input() 的返回值；输入用完后 input() 返回空字符串"
                          >
                            <Input.TextArea
                              rows={3}
                              placeholder="例如：\n5\n10"
                              style={{ fontFamily: 'Consolas, Monaco, monospace' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            {...restField}
                            name={[name, 'expectedOutput']}
                            label="预期输出"
                            rules={[{ required: true, message: '请输入预期输出' }]}
                          >
                            <Input.TextArea
                              rows={3}
                              placeholder="程序应输出的结果"
                              style={{ fontFamily: 'Consolas, Monaco, monospace' }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        {...restField}
                        name={[name, 'isHidden']}
                        valuePropName="checked"
                        style={{ marginBottom: 0 }}
                      >
                        <Checkbox>隐藏测试点（学生看不到具体输入输出）</Checkbox>
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ input: '', expectedOutput: '', isHidden: false })}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加测试点
                  </Button>
                </>
              )}
            </Form.List>

            <Alert
              type="info"
              message="Python编程活动说明"
              description={
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>学生将在浏览器中直接编写和运行Python代码</li>
                  <li>支持Python基础语法和常用库（无需安装Python环境）</li>
                  <li>开启turtle图形后，学生可以使用turtle库绘制图形</li>
                  <li>错误消息将以中文显示，便于学生理解</li>
                  <li><strong>添加测试用例后，学生可点击"测评"按钮自动评测代码</strong></li>
                </ul>
              }
              style={{ marginTop: 16 }}
            />
          </Card>
        );
      } else {
        return (
          <Form.Item
            name="content"
            label="活动内容"
          >
            <MarkdownEditor placeholder="请输入活动内容..." height="600px" />
          </Form.Item>
        );
      }
    }}
  </Form.Item>
);

export default ActivityTypeSettings;
