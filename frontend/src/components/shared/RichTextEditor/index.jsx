import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import ImageResize from 'quill-image-resize-module-react';
import 'react-quill/dist/quill.snow.css';
import './style.css';

// 注册图片调整模块
if (typeof window !== 'undefined') {
  ReactQuill.Quill.register('modules/imageResize', ImageResize);
}

const RichTextEditor = ({ value, onChange, placeholder }) => {
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'font': [] }],
        [{ 'align': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    clipboard: {
      matchVisual: false
    },
    imageResize: {
      parchment: ReactQuill.Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize']
    }
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'font',
    'align',
    'list', 'bullet',
    'script',
    'blockquote', 'code-block',
    'link', 'image', 'video'
  ];

  // 处理图片上传
  function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        try {
          // 压缩图片
          const compressedImage = await compressImage(file);
          const reader = new FileReader();
          reader.onload = (e) => {
            const range = this.quill.getSelection(true);
            this.quill.insertEmbed(range.index, 'image', e.target.result);
          };
          reader.readAsDataURL(compressedImage);
        } catch (error) {
          console.error('Error uploading image:', error);
        }
      }
    };
  }

  // 图片压缩函数
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const maxWidth = 1920; // 最大宽度
      const maxHeight = 1080; // 最大高度
      const maxSizeMB = 2; // 最大文件大小（MB）
      const quality = 0.8; // 压缩质量

      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 调整尺寸
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为Blob
        canvas.toBlob(
          (blob) => {
            if (blob.size > maxSizeMB * 1024 * 1024) {
              // 如果还是太大，继续压缩
              canvas.toBlob(
                (finalBlob) => resolve(finalBlob),
                file.type,
                quality * 0.8
              );
            } else {
              resolve(blob);
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = reject;
    });
  };

  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        preserveWhitespace
      />
    </div>
  );
};

export default RichTextEditor;
