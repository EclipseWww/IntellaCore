import React from 'react';
import {
  Form,
  Typography,
  Modal,
  Row,
  Col,
  InputNumber,
  Slider
} from 'antd';


// 课时编辑：图片尺寸调整对话框
const ImageResizeModal = ({ canvasRef, handleHeightChange, handleResizedImageUpload, handleScaleChange, handleWidthChange, imageHeight, imageResizeModalVisible, imageScale, imageWidth, originalImageSize, previewImage, setImageResizeModalVisible }) => (
  <Modal
    title="调整图片尺寸"
    open={imageResizeModalVisible}
    onOk={handleResizedImageUpload}
    onCancel={() => setImageResizeModalVisible(false)}
    okText="上传"
    cancelText="取消"
    width={700}
  >
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {previewImage && (
        <div style={{ marginBottom: 16, border: '1px solid #d9d9d9', padding: 8, borderRadius: 4 }}>
          <img
            src={previewImage}
            alt="预览"
            style={{
              maxWidth: '100%',
              maxHeight: '400px',
              width: `${imageWidth}px`,
              height: `${imageHeight}px`
            }}
          />
        </div>
      )}

      <div style={{ width: '100%', marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="调整比例">
            <Slider
              min={10}
              max={200}
              value={imageScale}
              onChange={handleScaleChange}
              tipFormatter={value => `${value}%`}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="宽度(像素)">
                <InputNumber
                  min={10}
                  max={5000}
                  value={imageWidth}
                  onChange={handleWidthChange}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="高度(像素)">
                <InputNumber
                  min={10}
                  max={5000}
                  value={imageHeight}
                  onChange={handleHeightChange}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">
              原始尺寸: {originalImageSize.width} x {originalImageSize.height} 像素
            </Typography.Text>
          </div>
        </Form>
      </div>
    </div>

    {/* 隐藏的canvas用于绘制和导出调整后的图片 */}
    <canvas ref={canvasRef} style={{ display: 'none' }} />
  </Modal>
);

export default ImageResizeModal;
