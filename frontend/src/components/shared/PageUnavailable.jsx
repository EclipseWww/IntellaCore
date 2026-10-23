import React from 'react';
import { Button } from 'antd';
import './PageUnavailable.css';

export function homePath() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return localStorage.getItem('token') && ['admin', 'teacher', 'student'].includes(user?.role)
      ? `/${user.role}` : '/login';
  } catch {
    return '/login';
  }
}

export default function PageUnavailable({ failed = false }) {
  return (
    <main className="page-unavailable">
      <section className="page-unavailable-card" aria-labelledby="unavailable-title">
        <span className="page-unavailable-label">AI · 学习空间</span>
        <div className="page-unavailable-number" aria-hidden="true">{failed ? '···' : '404'}</div>
        <h1 id="unavailable-title">{failed ? '页面暂时未能加载' : '这页暂时找不到了'}</h1>
        <p>{failed ? '加载遇到了一点问题，请重新加载后继续。' : '页面可能已移动，或链接地址有误。回到首页，继续探索与学习。'}</p>
        <div className="page-unavailable-actions">
          <Button type="primary" size="large" onClick={() => failed ? window.location.reload() : window.location.assign(homePath())}>
            {failed ? '重新加载' : '返回首页'}
          </Button>
          {failed && <Button size="large" onClick={() => window.location.assign(homePath())}>返回首页</Button>}
        </div>
        <span className="page-unavailable-footer">每一次探索，都离新知更近一步</span>
      </section>
    </main>
  );
}
