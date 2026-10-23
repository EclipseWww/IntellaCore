import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Setup from './Setup';
import InitializationGate from '../../components/shared/InitializationGate';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = jest.fn().mockImplementation(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  api.get.mockReset(); api.post.mockReset();
  localStorage.clear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(element) {
  await act(async () => { root.render(<MemoryRouter initialEntries={['/setup']}><Routes>
    <Route path="/setup" element={element} /><Route path="/login" element={<div>登录页面</div>} />
  </Routes></MemoryRouter>); });
}

test('a new installation shows administrator fields without teacher verification', async () => {
  api.get.mockResolvedValue({ data: { initialized: false, requiresTeacherVerification: false } });
  await render(<Setup />);
  expect(container.textContent).toContain('首次使用');
  expect(container.querySelector('#username')).not.toBeNull();
  expect(container.querySelector('#confirmPassword')).not.toBeNull();
  expect(container.querySelector('#teacherUsername')).toBeNull();
});
test('an existing school shows teacher verification before administrator fields', async () => {
  api.get.mockResolvedValue({ data: { initialized: false, requiresTeacherVerification: true } });
  await render(<Setup />);
  expect(container.querySelector('#teacherUsername')).not.toBeNull();
  expect(container.querySelector('#teacherPassword')).not.toBeNull();
  expect(container.textContent).toContain('已有课程、班级和学生数据会保留');
});
test('completed setup redirects to login instead of showing a creation form', async () => {
  api.get.mockResolvedValue({ data: { initialized: true } });
  await render(<Setup />);
  expect(container.textContent).toContain('登录页面');
  expect(container.querySelector('#username')).toBeNull();
});
test('connection failures show a retry action and never allow creating an administrator', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  await render(<Setup />);
  expect(container.textContent).toContain('连接失败');
  expect(container.textContent).toContain('重试');
  expect(container.querySelector('#username')).toBeNull();
});
test('initialized installations retain the normal login page', async () => {
  api.get.mockResolvedValue({ data: { initialized: true } });
  await render(<InitializationGate><div>正常登录表单</div></InitializationGate>);
  expect(container.textContent).toContain('正常登录表单');
});

test('cached initialization skips the request and loading screen on login', async () => {
  localStorage.setItem('system.initialized.v1', 'true');
  await render(<InitializationGate><div>正常登录表单</div></InitializationGate>);
  expect(api.get).not.toHaveBeenCalled();
  expect(container.textContent).toContain('正常登录表单');
  expect(container.textContent).not.toContain('正在连接系统');
});

test('login stays visible while initialization is pending and when the check fails', async () => {
  let reject;
  api.get.mockReturnValue(new Promise((resolve, fail) => { reject = fail; }));
  await render(<InitializationGate><div>正常登录表单</div></InitializationGate>);
  expect(container.textContent).toContain('正常登录表单');
  await act(async () => { reject(new Error('offline')); });
  expect(container.textContent).toContain('正常登录表单');
  expect(container.textContent).not.toContain('连接失败');
});

test('login redirects to setup only after an explicit uninitialized response', async () => {
  api.get.mockResolvedValue({ data: { initialized: false, requiresTeacherVerification: false } });
  await act(async () => { root.render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<InitializationGate>正常登录表单</InitializationGate>} />
    <Route path="/setup" element={<div>首次设置页面</div>} />
  </Routes></MemoryRouter>); });
  expect(container.textContent).toContain('首次设置页面');
  expect(container.textContent).not.toContain('正常登录表单');
});

test('opening setup rechecks the server even when initialization was cached', async () => {
  localStorage.setItem('system.initialized.v1', 'true');
  api.get.mockResolvedValue({ data: { initialized: false, requiresTeacherVerification: true } });
  await render(<Setup />);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(container.querySelector('#teacherUsername')).not.toBeNull();
  expect(localStorage.getItem('system.initialized.v1')).toBeNull();
});

test('simultaneous initialization gates share a single status request', async () => {
  let resolve;
  api.get.mockReturnValue(new Promise(done => { resolve = done; }));
  await render(<><InitializationGate>入口一</InitializationGate><InitializationGate>入口二</InitializationGate></>);
  expect(api.get).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ data: { initialized: true } }); });
  expect(container.textContent).toContain('入口一');
  expect(container.textContent).toContain('入口二');
});

test('submitting the page creates the administrator and displays the login action', async () => {
  api.get.mockResolvedValue({ data: { initialized: false, requiresTeacherVerification: false } });
  api.post.mockResolvedValue({ data: { success: true, username: 'new-admin' } });
  localStorage.setItem('token', 'old-token');
  await render(<Setup />);
  await act(async () => {
    Simulate.change(container.querySelector('#username'), { target: { value: 'new-admin' } });
    Simulate.change(container.querySelector('#password'), { target: { value: 'abc123' } });
    Simulate.change(container.querySelector('#confirmPassword'), { target: { value: 'abc123' } });
  });
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  expect(api.post).toHaveBeenCalledWith('/auth/initialization', expect.objectContaining({ username: 'new-admin', password: 'abc123' }), { headers: { 'X-Setup-Request': '1' } });
  expect(container.textContent).toContain('设置完成');
  expect(container.textContent).toContain('进入登录页面');
  expect(localStorage.getItem('token')).toBeNull();
});

test('a mismatched confirmation blocks submission', async () => {
  api.get.mockResolvedValue({ data: { initialized: false, requiresTeacherVerification: false } });
  await render(<Setup />);
  await act(async () => {
    Simulate.change(container.querySelector('#username'), { target: { value: 'new-admin' } });
    Simulate.change(container.querySelector('#password'), { target: { value: 'new-admin-password' } });
    Simulate.change(container.querySelector('#confirmPassword'), { target: { value: 'different-password' } });
  });
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 50));
  });
  expect(api.post).not.toHaveBeenCalled();
  expect(container.textContent).toContain('两次输入的密码不一致');
});
