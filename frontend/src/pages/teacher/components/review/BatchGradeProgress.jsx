import React from 'react';
import { Progress } from 'antd';

export default function BatchGradeProgress({ progress }) {
    if (!progress) return null;
    const { total, processed, failed, current } = progress;
    const finished = processed === total;
    return <div role="status" aria-live="polite" style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{finished ? '批量评阅完成' : '正在批量评阅'} · {processed}/{total} 份{!finished && current ? ' · ' + current : ''}</span>
            <span>{failed ? failed + ' 份失败' : ''}</span>
        </div>
        <Progress percent={Math.round(processed / total * 100)} status={finished ? (failed ? 'exception' : 'success') : 'active'} size="small" />
    </div>;
}
