import React, { useState } from 'react';
import { Button, message, Tooltip, Image } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

// 注册常用的编程语言
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('sql', sql);

const CodeBlock = ({ language, value, hideCopyButton }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // 优先使用 Clipboard API，如果不支持则降级到 execCommand
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // 降级方案，使用 document.execCommand
        const textArea = document.createElement('textarea');
        textArea.value = value;
        // 防止在 iOS 上滚动到底部
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!success) {
          throw new Error('复制失败');
        }
      }
      
      setCopied(true);
      message.success('代码已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      message.error('复制失败');
      console.error('复制失败:', err);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {!hideCopyButton && (
        <div 
          style={{ 
            position: 'absolute', 
            right: '10px', 
            top: '10px',
            zIndex: 1
          }}
        >
          <Tooltip title={copied ? "已复制" : "复制代码"}>
            <Button 
              type="text" 
              icon={copied ? <CheckOutlined /> : <CopyOutlined />} 
              onClick={handleCopy}
              style={{
                color: copied ? '#52c41a' : '#666',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                border: 'none',
                padding: '4px 8px',
                height: 'auto',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            />
          </Tooltip>
        </div>
      )}
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        customStyle={{
          margin: 0,
          borderRadius: '8px',
          padding: '16px',
          fontSize: '16px',
          backgroundColor: '#f8f9fc',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          border: '1px solid #eaecef'
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer = ({ content, hideCopyButton = false, onVideoLinkClick, compact = false, smallImages = false }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw]}
    components={{
      a({node, ...props}) {
        const href = props.href || '';
        const isVideoLink = /\.(mp4|webm|ogg|avi|mov|mkv)(\?.*)?$/i.test(href) 
          || (href.includes('/resources/') && /\.(mp4|webm|ogg|avi|mov|mkv)/i.test(href))
          || href.startsWith('/public/media/') && /\.(mp4|webm|ogg|avi|mov|mkv)/i.test(href);
        return (
          <a
            {...props}
            onClick={(e) => {
              if (isVideoLink && onVideoLinkClick) {
                e.preventDefault();
                onVideoLinkClick(href, props.title);
              }
            }}
            target={props.target || '_blank'}
            rel={props.rel || 'noopener noreferrer'}
          />
        );
      },
      img({node, ...props}) {
        if (smallImages) {
          return (
            <div style={{ marginBottom: compact ? '8px' : '16px' }}>
              <Image
                style={{
                  maxWidth: '100%',
                  maxHeight: '150px',
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain'
                }}
                src={props.src}
                alt={props.alt}
                preview={{
                  mask: <span style={{ fontSize: '14px' }}>点击放大</span>
                }}
              />
            </div>
          );
        }
        return (
          <img
            style={{
              maxWidth: '100%',
              height: 'auto',
              display: 'block'
            }}
            {...props}
          />
        );
      },
      video({node, ...props}) {
        return (
          <div style={{ marginBottom: '16px' }}>
            <video 
              style={{
                maxWidth: '100%',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              {...props}
              controls
            />
          </div>
        );
      },
      code({node, inline, className, children, ...props}) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : '';
        const value = String(children).replace(/\n$/, '');
        
        // 判断是否应该使用行内代码
        const shouldUseInline = inline || (
          !language && // 没有指定语言
          !value.includes('\n') && // 不包含换行符
          value.length < 50 // 长度小于50个字符
        );
        
        if (shouldUseInline) {
          return (
            <code
              className={className}
              style={{
                backgroundColor: '#f0f2f7',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '15px',
                fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                display: 'inline-block',
                verticalAlign: 'middle',
                lineHeight: '1.4',
                color: '#476582',
                border: '1px solid #e0e3e9'
              }}
              {...props}
            >
              {children}
            </code>
          );
        }
        
        return (
          <CodeBlock
            language={language}
            value={value}
            hideCopyButton={hideCopyButton}
          />
        );
      },
      p({children}) {
        return (
          <div style={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word',
            marginBottom: compact ? '0' : '16px', 
            lineHeight: '1.8',
            color: '#2c3e50',
            fontSize: '15px'
          }}>
            {children}
          </div>
        );
      },
      // 标题
      h1: ({node, ...props}) => (
        <h1 
          style={{
            fontSize: '1.8em', 
            marginBottom: '16px',
            borderBottom: '1px solid #eaecef',
            paddingBottom: '12px',
            color: '#273849',
            fontWeight: '600'
          }} 
          {...props} 
        />
      ),
      h2: ({node, ...props}) => (
        <h2 
          style={{
            fontSize: '1.5em', 
            marginBottom: '14px',
            borderBottom: '1px solid #eaecef',
            paddingBottom: '8px',
            color: '#273849',
            fontWeight: '600'
          }} 
          {...props} 
        />
      ),
      h3: ({node, ...props}) => (
        <h3 
          style={{
            fontSize: '1.3em', 
            marginBottom: '10px',
            color: '#273849',
            fontWeight: '600'
          }} 
          {...props} 
        />
      ),
      // 列表
      ul: ({node, ...props}) => (
        <ul 
          style={{
            marginLeft: '20px', 
            marginBottom: '16px',
            listStyleType: 'disc'
          }} 
          {...props} 
        />
      ),
      ol: ({node, ...props}) => (
        <ol 
          style={{
            marginLeft: '20px', 
            marginBottom: '16px',
            listStyleType: 'decimal'
          }} 
          {...props} 
        />
      ),
      li: ({node, ...props}) => (
        <li 
          style={{
            marginBottom: '4px',
            lineHeight: '1.6'
          }} 
          {...props} 
        />
      ),
      // 段落
      // p: ({node, ...props}) => (
      //   <p 
      //     style={{
      //       marginBottom: '16px', 
      //       lineHeight: '1.8',
      //       color: '#2c3e50'
      //     }} 
      //     {...props} 
      //   />
      // ),
      // 引用
      blockquote: ({node, ...props}) => (
        <blockquote
          style={{
            borderLeft: '4px solid #42b983',
            paddingLeft: '16px',
            marginLeft: '0',
            marginBottom: '16px',
            color: '#4e6e8e',
            backgroundColor: '#f8f8f8',
            borderRadius: '0 6px 6px 0',
            padding: '12px 16px 12px 20px',
            fontStyle: 'italic'
          }}
          {...props}
        />
      ),
      // 表格
      table: ({node, ...props}) => (
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              width: '100%',
              fontSize: '14px'
            }}
            {...props}
          />
        </div>
      ),
      th: ({node, ...props}) => (
        <th
          style={{
            border: '1px solid #ddd',
            padding: '12px 8px',
            backgroundColor: '#f5f7fa',
            fontWeight: '600',
            textAlign: 'left'
          }}
          {...props}
        />
      ),
      td: ({node, ...props}) => (
        <td
          style={{
            border: '1px solid #ddd',
            padding: '12px 8px',
            lineHeight: '1.5'
          }}
          {...props}
        />
      ),
      // 强调
      strong: ({node, ...props}) => (
        <strong 
          style={{
            fontWeight: '600',
            color: '#273849'
          }} 
          {...props} 
        />
      ),
      em: ({node, ...props}) => (
        <em 
          style={{
            fontStyle: 'italic',
            color: '#34495e'
          }} 
          {...props} 
        />
      ),
      // 添加分隔线样式
      hr: ({node, ...props}) => (
        <hr 
          style={{
            height: '1px',
            border: 'none',
            background: 'linear-gradient(to right, rgba(234, 236, 239, 0.2), rgba(234, 236, 239, 0.8), rgba(234, 236, 239, 0.2))',
            margin: '24px 0',
          }} 
          {...props} 
        />
      )
    }}
  >
    {content}
  </ReactMarkdown>
);

export default MarkdownRenderer;
