import { useEffect, useState } from 'react';
import api from '../services/api';

const CACHE_KEY = 'system.initialized.v1';
let pendingRequest = null;
const ready = { loading: false, status: { initialized: true }, error: '' };
function isInitialized() {
  try { return localStorage.getItem(CACHE_KEY) === 'true'; } catch { return false; }
}
export function rememberInitialized() {
  try { localStorage.setItem(CACHE_KEY, 'true'); } catch { /* Storage may be disabled. */ }
}
function requestStatus() {
  if (!pendingRequest) {
    pendingRequest = api.get('/auth/initialization').then(({ data }) => {
      if (typeof data.initialized !== 'boolean') throw new Error('初始化状态无效');
      if (data.initialized) rememberInitialized();
      else { try { localStorage.removeItem(CACHE_KEY); } catch {} }
      return data;
    }).finally(() => { pendingRequest = null; });
  }
  return pendingRequest;
}

export default function useInitializationStatus({ force = false } = {}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState(() => !force && isInitialized()
    ? ready : { loading: true, status: null, error: '' });
  useEffect(() => {
    let active = true;
    if (!force && isInitialized()) { setState(ready); return; }
    setState({ loading: true, status: null, error: '' });
    requestStatus().then(data => {
      if (active) setState({ loading: false, status: data, error: '' });
    }).catch(() => {
      if (active) setState({ loading: false, status: null, error: '暂时无法连接系统，请检查服务是否启动后重试。' });
    });
    return () => { active = false; };
  }, [revision, force]);
  return { ...state, retry: () => setRevision(value => value + 1) };
}
