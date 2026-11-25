import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';

// 表格编辑器（@fortune-sheet，约 3.5 MB）只在真正显示表格时才下载，
// 避免学生打开任意课时、教师打开批改页都要先加载它。
const SpreadsheetEditor = lazy(() => import('./SpreadsheetEditor'));

const fallback = (
  <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
    <Spin />
    <div style={{ marginTop: 12 }}>表格编辑器加载中…</div>
  </div>
);

const LazySpreadsheetEditor = (props) => (
  <Suspense fallback={fallback}>
    <SpreadsheetEditor {...props} />
  </Suspense>
);

export default LazySpreadsheetEditor;
