import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// 全面抑制 ResizeObserver 警告 - 这是一个已知的浏览器行为，在使用 React Flow 的 NodeResizer 时常见
// 方法1: 捕获 window error 事件
const resizeObserverErr = (e) => {
  if (e.message && (
    e.message.includes('ResizeObserver loop') ||
    e.message.includes('ResizeObserver loop completed with undelivered notifications')
  )) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
};
window.addEventListener('error', resizeObserverErr);

// 方法2: 修补 ResizeObserver 以防止错误抛出
const OriginalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
  constructor(callback) {
    super((entries, observer) => {
      // 使用 requestAnimationFrame 延迟回调，避免循环错误
      window.requestAnimationFrame(() => {
        try {
          callback(entries, observer);
        } catch (e) {
          // 忽略错误
        }
      });
    });
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 