import React, { useState, useEffect, useRef } from 'react';
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import './style.css';
import { message, Modal, Slider, Form, InputNumber, Row, Col, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { mediaAPI, API_BASE_URL } from '../../../services/api';

// 初始化Markdown解析器
const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

/**
 * Markdown编辑器组件
 * 替代原有的富文本编辑器
 */
const MarkdownEditor = ({ 
  value, 
  onChange, 
  placeholder, 
  height, 
  view = 'md-and-html', 
  mediaContext,
  fullToolbar = false 
}) => {
  const { courseId, unitId, lessonId } = useParams();
  const mdEditorRef = useRef(null);
  
  // 添加图片调整相关状态
  const [imageResizeModalVisible, setImageResizeModalVisible] = useState(false);
  const [imageToResize, setImageToResize] = useState(null);
  const [previewImage, setPreviewImage] = useState('');
  const [imageScale, setImageScale] = useState(100);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef(null);
  const uploadPromiseRef = useRef({ resolve: null, reject: null });
  
  // 处理编辑器内容变化
  const handleEditorChange = ({ text }) => {
    onChange?.(text);
  };

  // 处理图片上传前的预览和调整
  const handleImageBeforeUpload = (file) => {
    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('请选择图片文件');
      return Promise.reject(new Error('不是图片文件'));
    }

    // 文件大小校验
    const maxSizeImage = 10 * 1024 * 1024; // 图片最大10MB
    if (file.size > maxSizeImage) {
      message.error('图片大小不能超过10MB');
      return Promise.reject(new Error('图片太大'));
    }

    return new Promise((resolve, reject) => {
      // 存储promise的resolve和reject函数
      uploadPromiseRef.current = { resolve, reject };
      
      // 先存储文件信息
      setImageToResize(file);
      
      // 创建图片的URL
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const img = new Image();
        img.src = reader.result;
        img.onload = () => {
          // 设置原始尺寸
          setOriginalImageSize({ width: img.width, height: img.height });
          setImageWidth(img.width);
          setImageHeight(img.height);
          setPreviewImage(reader.result);
          setImageScale(100);
          setImageResizeModalVisible(true);
        };
      };
    });
  };

  // 处理图片上传（调整后）
  const handleResizedImageUpload = async () => {
    if (!imageToResize || !canvasRef.current) {
      setImageResizeModalVisible(false);
      return;
    }

    try {
      // 创建canvas绘制调整后的图片
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // 设置canvas尺寸为调整后的尺寸
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      
      // 在canvas上绘制调整后的图片
      const img = new Image();
      img.src = previewImage;
      
      img.onload = async () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
        
        // 将canvas转换为Blob
        canvas.toBlob(async (blob) => {
          // 创建文件对象
          const resizedFile = new File([blob], imageToResize.name, {
            type: imageToResize.type,
            lastModified: Date.now()
          });
          
          // 关闭Modal
          setImageResizeModalVisible(false);
          
          // 调用实际的媒体上传功能来处理调整后的文件
          try {
            const result = await handleMediaUpload(resizedFile);
            if (result && uploadPromiseRef.current.resolve) {
              uploadPromiseRef.current.resolve(result);
            }
          } catch (error) {
            if (uploadPromiseRef.current.reject) {
              uploadPromiseRef.current.reject(error);
            }
          } finally {
            // 清除状态
            setImageToResize(null);
            uploadPromiseRef.current = { resolve: null, reject: null };
          }
        }, imageToResize.type);
      };
    } catch (error) {
      console.error('处理图片失败:', error);
      if (uploadPromiseRef.current.reject) {
        uploadPromiseRef.current.reject(error);
      }
      setImageResizeModalVisible(false);
      setImageToResize(null);
    }
  };

  // 取消图片调整
  const handleCancelResize = () => {
    if (uploadPromiseRef.current.reject) {
      uploadPromiseRef.current.reject(new Error('已取消'));
    }
    setImageResizeModalVisible(false);
    setImageToResize(null);
  };

  // 处理图片比例变化
  const handleScaleChange = (value) => {
    setImageScale(value);
    const newWidth = Math.round(originalImageSize.width * (value / 100));
    const newHeight = Math.round(originalImageSize.height * (value / 100));
    setImageWidth(newWidth);
    setImageHeight(newHeight);
  };

  // 处理宽度变化，保持宽高比
  const handleWidthChange = (value) => {
    if (!value) return;
    setImageWidth(value);
    const aspectRatio = originalImageSize.height / originalImageSize.width;
    const newHeight = Math.round(value * aspectRatio);
    setImageHeight(newHeight);
    const newScale = (value / originalImageSize.width) * 100;
    setImageScale(newScale);
  };

  // 处理高度变化，保持宽高比
  const handleHeightChange = (value) => {
    if (!value) return;
    setImageHeight(value);
    const aspectRatio = originalImageSize.width / originalImageSize.height;
    const newWidth = Math.round(value * aspectRatio);
    setImageWidth(newWidth);
    const newScale = (value / originalImageSize.height) * 100;
    setImageScale(newScale);
  };

  // 处理媒体文件上传
  const handleMediaUpload = async (file) => {
    // 获取文件扩展名
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    // 定义允许的文件类型
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv', 'video/x-matroska'];
    
    // 判断文件类型
    const isImage = allowedImageTypes.includes(file.type);
    const isVideo = allowedVideoTypes.includes(file.type);
    
    if (!isImage && !isVideo) {
      message.error('只支持图片(JPG、PNG、GIF、WEBP、SVG)和视频(MP4、WEBM、OGG、MOV、AVI、WMV、FLV、MKV)格式');
      return;
    }

    // 文件大小校验
    const maxSizeImage = 10 * 1024 * 1024; // 图片最大10MB
    const maxSizeVideo = 100 * 1024 * 1024; // 视频最大100MB
    
    if (isImage && file.size > maxSizeImage) {
      message.error('图片大小不能超过10MB');
      return;
    }
    
    if (isVideo && file.size > maxSizeVideo) {
      message.error('视频大小不能超过100MB');
      return;
    }

    try {
      let cId, uId, lId;
      
      // 使用传入的媒体上下文参数优先判断
      if (mediaContext) {
        // 如果组件传入了明确的媒体上下文，则使用它
        cId = mediaContext.moduleId || 'common';
        uId = mediaContext.sectionId || 'media';
        lId = mediaContext.itemId || 'content';
      } else if (courseId && unitId && lessonId) {
        // 使用正常的课程/单元/课时ID
        cId = courseId;
        uId = unitId;
        lId = lessonId;
      } else {
        // 如果没有明确的上下文，使用默认值
        message.info('媒体文件将存储在通用目录中');
        cId = 'common';
        uId = 'media';
        lId = 'content';
      }

      const formData = new FormData();
      formData.append('media', file);

      const response = await mediaAPI.uploadMedia(cId, uId, lId, formData);
      
      if (response.success) {
        // 使用相对路径，不需要添加API_BASE_URL前缀
        const mediaUrl = response.data.path;
        
        if (response.data.mediaType === 'video') {
          message.success('视频上传成功');
          return {
            url: mediaUrl,
            isVideo: true
          };
        } else {
          message.success('图片上传成功');
          return mediaUrl;
        }
      } else {
        message.error('媒体文件上传失败');
        return null;
      }
    } catch (error) {
      console.error('媒体文件上传失败:', error);
      message.error('媒体文件上传失败: ' + (error.response?.data?.message || error.message));
      return null;
    }
  };

  // 自定义处理图片插入
  const handleImageUpload = (file) => {
    // 如果是图片，先进入调整尺寸流程
    if (file.type.startsWith('image/')) {
      return handleImageBeforeUpload(file).then(result => {
        // result 已经是处理过尺寸并上传后的结果
        return result;
      }).catch(error => {
        console.error('图片处理失败:', error);
        return null;
      });
    }
    
    // 如果是视频或其他类型，走原来的逻辑
    return handleMediaUpload(file).then(result => {
      if (result && result.isVideo) {
        // 完全绕过编辑器的默认图片插入逻辑
        
        // 创建视频HTML标签
        const videoHtml = `<video controls width="100%" src="${result.url}"></video>`;
        
        // 延迟处理，确保编辑器已准备好
        setTimeout(() => {
          if (mdEditorRef.current) {
            try {
              // 获取当前内容
              const currentContent = mdEditorRef.current.getMdValue();
              
              // 尝试在当前光标位置插入视频标签
              // react-markdown-editor-lite 似乎没有提供直接在光标处插入的API，
              // 我们可以尝试在文档末尾添加
              const newContent = currentContent ? 
                (currentContent + '\n\n' + videoHtml) : 
                videoHtml;
                
              // 直接更新整个编辑器内容
              mdEditorRef.current.setText(newContent);
              
              // 更新外部状态
              if (onChange) {
                onChange(newContent);
              }
              
              message.success('视频已插入到内容中');
            } catch (error) {
              console.error('视频插入失败:', error);
              message.error('视频插入失败，请尝试手动复制粘贴');
            }
          }
        }, 100);
        
        // 阻止默认处理
        return null;
      }
      
      // 正常返回图片URL，让编辑器处理图片插入
      return result;
    });
  };

  return (
    <div className={`markdown-editor ${fullToolbar ? 'full-toolbar' : ''}`}>
      <MdEditor
        ref={mdEditorRef}
        value={value || ''}
        style={{ height: height || '400px' }}
        renderHTML={(text) => mdParser.render(text)}
        onChange={handleEditorChange}
        placeholder={placeholder}
        view={typeof view === 'string' ? 
          { menu: true, md: true, html: view === 'md-and-html' } : 
          view}
        plugins={[
          'header',
          'font-bold',
          'font-italic',
          'font-underline',
          'font-strikethrough',
          'list-unordered',
          'list-ordered',
          'block-quote',
          'block-code-inline',
          'block-code-block',
          'table',
          'image',
          'link',
          'clear',
          'logger',
          'mode-toggle',
          'full-screen',
        ]}
        onImageUpload={handleImageUpload}
        highlightEnable={false}
      />
      
      {/* 图片尺寸调整对话框 */}
      <Modal
        title="调整图片尺寸"
        open={imageResizeModalVisible}
        onOk={handleResizedImageUpload}
        onCancel={handleCancelResize}
        okText="上传"
        cancelText="取消"
        width={700}
        destroyOnClose={true}
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
    </div>
  );
};

export default MarkdownEditor; 