const test = require('node:test');
const assert = require('node:assert/strict');
const { getClientIp } = require('./getClientIp');

const req = (headers, peer) => ({ headers, socket: { remoteAddress: peer } });

test('使用 Nginx 设置的 X-Real-IP', () => {
  assert.equal(getClientIp(req({ 'x-real-ip': '192.168.1.23', 'x-forwarded-for': '6.6.6.6' }, '172.18.0.3')), '192.168.1.23');
  assert.equal(getClientIp(req({ 'x-real-ip': '::ffff:10.0.0.8' }, '172.18.0.3')), '10.0.0.8');
});

test('忽略浏览器可伪造的请求头', () => {
  const forged = { 'cf-connecting-ip': '1.1.1.1', 'true-client-ip': '2.2.2.2', 'x-forwarded-for': '3.3.3.3' };
  assert.equal(getClientIp(req(forged, '::ffff:192.168.1.50')), '192.168.1.50');
});

test('仅本机代理（开发时 npm start）转发的 X-Forwarded-For 被采用', () => {
  assert.equal(getClientIp(req({ 'x-forwarded-for': '192.168.1.60, 127.0.0.1' }, '::1')), '192.168.1.60');
  assert.equal(getClientIp(req({ 'x-forwarded-for': '192.168.1.60' }, '::ffff:127.0.0.1')), '192.168.1.60');
  assert.equal(getClientIp(req({}, '127.0.0.1')), '127.0.0.1');
});
