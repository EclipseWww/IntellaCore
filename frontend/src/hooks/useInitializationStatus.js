import { useEffect, useState } from 'react';
import api from '../services/api';

// Share only in-flight requests; initialization belongs to the current server.
let pendingRequest = null;
function requestStatus() {
  if (!pendingRequest) {
    pendingRequest = api.get('/auth/initialization').then(({ data }) => {
      if (typeof data.initialized !== 'boolean') throw new Error('初始化状态无效');
      return data;
    }).finally(() => { pendingRequest = null; });
  }
  return pendingRequest;
}

export default function useInitializationStatus() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, status: null, error: '' });
  useEffect(() => {
    let active = true;
    setState({ loading: true, status: null, error: '' });
    requestStatus().then(data => {
      if (active) setState({ loading: false, status: data, error: '' });
    }).catch(() => {
      if (active) setState({ loading: false, status: null, error: '暂时无法连接系统，请检查服务是否启动后重试。' });
    });
    return () => { active = false; };
  }, [revision]);
  return { ...state, retry: () => setRevision(value => value + 1) };
}
