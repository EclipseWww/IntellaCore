import React from 'react';
import ReactMarkdown from 'react-markdown';
import '../MarkdownEditor/style.css';

/**
 * Markdown渲染组件
 * 用于显示Markdown内容
 */
const MarkdownRenderer = ({ content }) => {
  if (!content) {
    return <div className="markdown-content">暂无内容</div>;
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 