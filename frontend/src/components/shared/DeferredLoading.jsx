import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import './DeferredLoading.css';

export default function DeferredLoading() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <div className="page-loading" role="status" aria-live="polite">
    <div className="page-loading-card">
      <div className="page-loading-icon" aria-hidden="true"><Spin size="large" /></div>
      <div className="page-loading-title">正在准备页面</div>
      <div className="page-loading-description">稍等片刻，马上就好</div>
    </div>
  </div> : null;
}
