import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';

// 代码编辑器（CodeMirror，约 490 KB）只在打开 Python 活动时才下载。
const CodeEditor = lazy(() => import('./CodeEditor'));

const fallback = (
  <div style={{ padding: 24, textAlign: 'center' }}>
    <Spin />
  </div>
);

const LazyCodeEditor = (props) => (
  <Suspense fallback={fallback}>
    <CodeEditor {...props} />
  </Suspense>
);

export default LazyCodeEditor;
