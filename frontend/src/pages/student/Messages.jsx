import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Badge, Button, Divider, Input, List, Modal, Segmented, Select, Space, Typography, Tooltip, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import api from '../../services/api';
import usePageTitle from '../../hooks/usePageTitle';
import imAPI from '../../services/userMessages';

const { Text } = Typography;

const Messages = () => {
  usePageTitle('消息');

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState('direct');
  const [targetUserId, setTargetUserId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [messagesData, setMessagesData] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 1, limit: 20, total: 0 });
  const [classmates, setClassmates] = useState([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSelected, setManageSelected] = useState([]);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);
  const classmatesById = useMemo(() => {
    const map = new Map();
    classmates.forEach(s => map.set(String(s._id), s));
    return map;
  }, [classmates]);

  const headerTitle = useMemo(() => {
    if (!activeConv) return '选择一个会话';
    if (activeConv.type === 'group') return activeConv.name || '群聊';
    const myId = String(user?._id || user?.id || '');
    const peerId = (activeConv.participants || []).map(String).find(id => id !== myId);
    const peer = peerId ? classmatesById.get(String(peerId)) : null;
    return peer?.name || '私聊';
  }, [activeConv, classmatesById, user]);

  const inputDisabled = !activeConv?._id;

  // 直接会话的未读计数（用于同学列表）
  const getDirectUnread = (peerId) => {
    const myId = String(user?._id || user?.id || '');
    const conv = (conversations || []).find(c => c.type === 'direct' && Array.isArray(c.participants) && c.participants.map(String).includes(myId) && c.participants.map(String).includes(String(peerId)) && c.participants.length === 2);
    return conv?.unreadCount || 0;
  };

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await imAPI.getConversations();
      setConversations(res?.data?.conversations || []);
    } catch (e) {
      message.error('加载会话失败');
    } finally {
      setLoading(false);
    }
  };

  const ensureClassId = async () => {
    // 如果本地 user 没有 classId，则调用 /auth/me 获取
    if (!user?.classId) {
      try {
        const resp = await api.get('/auth/me');
        const me = resp?.data;
        if (me?._id) {
          const merged = { ...(user || {}), _id: me._id, id: me._id, classId: me.classId };
          localStorage.setItem('user', JSON.stringify(merged));
          return me.classId;
        }
      } catch (e) {
        // 忽略错误，不阻断页面
      }
    }
    return user?.classId;
  };

  const loadClassmates = async () => {
    try {
      const classId = await ensureClassId();
      if (!classId) return;
      const res = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      const list = Array.isArray(data?.data?.students) ? data.data.students : [];
      const myId = String(user?._id || user?.id || '');
      setClassmates(list.filter(s => String(s._id) !== myId));
    } catch (e) {
      // 学生列表是可选的，不打断页面
    }
  };

  const loadMessages = async (conversationId, page = 1, limit = 20) => {
    if (!conversationId) return;
    try {
      const res = await imAPI.getMessages(conversationId, { page, limit });
      setMessagesData(res?.data?.messages || []);
      setPageInfo(res?.data?.pagination || { page, limit, total: 0 });
    } catch (e) {
      message.error('加载消息失败');
    }
  };

  useEffect(() => {
    loadConversations();
    loadClassmates();
  }, []);

  useEffect(() => {
    if (activeConv?._id) {
      loadMessages(activeConv._id, 1, 20);
      // 进入会话即标记已读
      imAPI.markRead(activeConv._id).catch(() => {});
      // 刷新会话列表以更新未读计数
      loadConversations();
    }
  }, [activeConv?._id]);

  // 轮询：打开某会话时每3秒拉取一次新消息
  useEffect(() => {
    if (!activeConv?._id) return;
    const id = setInterval(() => {
      loadMessages(activeConv._id, 1, 20);
    }, 3000);
    return () => clearInterval(id);
  }, [activeConv?._id]);

  // 轮询：每10秒刷新会话列表（便于群聊排序更新等）
  useEffect(() => {
    const id = setInterval(() => {
      loadConversations();
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const onSend = async () => {
    if (!text.trim()) return;
    if (!activeConv?._id) return;
    setSending(true);
    try {
      await imAPI.sendMessage({ conversationId: activeConv._id, content: text.trim() });
      setText('');
      await loadMessages(activeConv._id, pageInfo.page, pageInfo.limit);
      await loadConversations();
    } catch (e) {
      message.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // 简易表情列表（可后续替换专业库，如 emoji-mart）
  const emojis = ['😀','😁','😂','🤣','😄','😅','😊','😍','😘','😎','🤔','👍','👏','🙏','🎉','🔥','🌟','💯','✅','❌'];
  const insertEmoji = (em) => {
    const el = inputRef.current?.resizableTextArea?.textArea;
    if (!el) {
      setText((prev) => (prev || '') + em);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newValue = (text || '').slice(0, start) + em + (text || '').slice(end);
    setText(newValue);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + em.length;
    }, 0);
  };

  const onCreate = async () => {
    try {
      if (createType === 'direct') {
        if (!targetUserId.trim()) return message.warning('请输入对方用户ID');
        const res = await imAPI.createDirect(targetUserId.trim());
        setCreateModalOpen(false);
        setTargetUserId('');
        await loadConversations();
        setActiveConv(res?.data?.conversation || null);
      } else {
        if (!groupName.trim()) return message.warning('请输入群聊名称');
        const res = await imAPI.createGroup({ name: groupName.trim(), participantIds: groupMemberIds });
        setCreateModalOpen(false);
        setGroupName('');
        setGroupMemberIds([]);
        await loadConversations();
        setActiveConv(res?.data?.conversation || null);
      }
    } catch (e) {
      message.error('创建失败');
    }
  };

  const startDirectWith = async (peerId) => {
    try {
      const myId = String(user?._id || user?.id || '');
      const existing = (conversations || []).find(c => c.type === 'direct' &&
        Array.isArray(c.participants) && c.participants.map(String).includes(myId) && c.participants.map(String).includes(String(peerId)) && c.participants.length === 2);
      if (existing) {
        setActiveConv(existing);
        return;
      }
      const res = await imAPI.createDirect(peerId);
      await loadConversations();
      setActiveConv(res?.data?.conversation || null);
    } catch (e) {
      message.error('创建私聊失败');
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
      {/* 左侧会话列表与同班同学 */}
      <div style={{ width: 360, borderRight: '1px solid #eee', padding: 12, overflow: 'auto' }}>
        <Space style={{ marginBottom: 12 }}>
          <Button onClick={() => { setCreateType('group'); setCreateModalOpen(true); }}>新群聊</Button>
        </Space>
        <List
          loading={loading}
          dataSource={(conversations || []).filter(c => c.type === 'group')}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer', background: activeConv?._id === item._id ? '#f5f5f5' : undefined }}
              onClick={() => setActiveConv(item)}
            >
              <List.Item.Meta
                title={
                  <Badge count={item.unreadCount} overflowCount={99} offset={[8, 0]}>
                    <span>{item.name || '未命名群聊'}</span>
                  </Badge>
                }
                description={
                  <Space>
                    <Text type="secondary">成员数 {item.participants?.length || 0}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>本班同学</div>
          {/* 可在此处展示总未读，例如 sum(unread direct)；当前未引入direct未读，保持简单 */}
        </div>
        <List
          size="small"
          dataSource={classmates}
          renderItem={(stu) => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => startDirectWith(stu._id)}
              extra={
                getDirectUnread(stu._id) > 0 ? (
                  <Badge count={getDirectUnread(stu._id)} size="small" overflowCount={99} />
                ) : null
              }
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={<span>{stu.name}</span>}
              />
            </List.Item>
          )}
        />
      </div>

      {/* 右侧聊天窗口 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text strong>{headerTitle}</Text>
          {activeConv && activeConv.type === 'group' && (
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>成员数 {activeConv.participants?.length || 0}</Text>
              {Array.isArray(activeConv.admins) && activeConv.admins.map(String).includes(String(user?._id || user?.id)) && (
                <Button size="small" onClick={() => {
                  // 初始化管理选择：默认选中当前群成员中的同班同学
                  const myId = String(user?._id || user?.id || '');
                  const classmateIds = new Set(classmates.map(s => String(s._id)));
                  const currentIds = (activeConv.participants || []).map(String).filter(id => id !== myId && classmateIds.has(id));
                  setManageSelected(currentIds);
                  setManageOpen(true);
                }}>管理成员</Button>
              )}
            </Space>
          )}
        </div>
        <div style={{ flex: 1, padding: 12, overflow: 'auto', background: 'linear-gradient(180deg, #f7f9fc 0%, #ffffff 100%)' }}>
          {messagesData.map((msg) => {
            const mine = String(msg.sender?._id) === String(user?._id || user?.id);
            return (
              <div key={msg._id || msg.createdAt} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                {!mine && <Avatar size={32} icon={<UserOutlined />} style={{ marginRight: 8, background: '#e6f4ff', color: '#1677ff' }} />}
                <div style={{ maxWidth: '72%', background: mine ? '#1677ff' : '#fff', color: mine ? '#fff' : '#333', padding: '10px 14px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'relative' }}>
                  {!mine && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{msg.sender?.name || msg.sender?.username || msg.sender?._id}</div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  <div style={{ fontSize: 11, color: mine ? 'rgba(255,255,255,0.85)' : '#999', textAlign: 'right', marginTop: 6 }}>{new Date(msg.createdAt).toLocaleString()}</div>
                </div>
                {mine && <Avatar size={32} icon={<UserOutlined />} style={{ marginLeft: 8, background: '#f6ffed', color: '#52c41a' }} />}
              </div>
            );
          })}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #eee', background: '#fff' }}>
          {/* 工具栏 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, opacity: inputDisabled ? 0.5 : 1, pointerEvents: inputDisabled ? 'none' : 'auto' }}>
            <div>
              {emojis.map(em => (
                <Button key={em} type="text" size="small" onClick={() => insertEmoji(em)} style={{ fontSize: 18, lineHeight: 1 }}>{em}</Button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', color: '#999', fontSize: 12 }}>Enter发送，Shift+Enter换行</div>
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeyDown} autoSize={{ minRows: 2, maxRows: 6 }} placeholder={inputDisabled ? '请选择一个会话后再输入...' : '输入消息...'} disabled={inputDisabled} />
            <Button type="primary" loading={sending} onClick={onSend} disabled={inputDisabled}>发送</Button>
          </Space.Compact>
        </div>
      </div>

      <Modal
        title={createType === 'direct' ? '新建私聊' : '新建群聊'}
        open={createModalOpen}
        onOk={onCreate}
        onCancel={() => setCreateModalOpen(false)}
        okText="创建"
      >
        {createType === 'direct' ? (
          <Input value={targetUserId} onChange={e => setTargetUserId(e.target.value)} placeholder="输入对方用户ID" />
        ) : (
          <div>
            <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="输入群聊名称" style={{ marginBottom: 8 }} />
            <Select
              mode="multiple"
              allowClear
              style={{ width: '100%' }}
              placeholder="选择要邀请的同学（可选）"
              value={groupMemberIds}
              onChange={setGroupMemberIds}
              options={classmates.map(s => ({ label: s.name, value: s._id }))}
            />
          </div>
        )}
      </Modal>

      {/* 群成员管理 */}
      <Modal
        title="管理群成员"
        open={manageOpen}
        onCancel={() => setManageOpen(false)}
        onOk={async () => {
          try {
            if (!activeConv?._id) return;
            const myId = String(user?._id || user?.id || '');
            // 当前群成员中属于本班的同学（不含自己）
            const classmateIds = new Set(classmates.map(s => String(s._id)));
            const currentIds = new Set((activeConv.participants || []).map(String).filter(id => id !== myId && classmateIds.has(id)));
            const selectedIds = new Set((manageSelected || []).map(String));

            // 需要添加的
            const toAdd = Array.from(selectedIds).filter(id => !currentIds.has(id));
            // 需要移除的
            const toRemove = Array.from(currentIds).filter(id => !selectedIds.has(id));

            if (toAdd.length > 0) {
              await imAPI.addMembers(activeConv._id, toAdd);
            }
            for (const rid of toRemove) {
              await imAPI.removeMember(activeConv._id, rid);
            }

            await loadConversations();
            // 更新当前活动会话对象（从最新列表中取）
            const updated = (conversations || []).find(c => String(c._id) === String(activeConv._id));
            if (updated) setActiveConv(updated);
            setManageOpen(false);
            message.success('成员更新成功');
          } catch (e) {
            message.error('更新成员失败');
          }
        }}
        okText="保存"
      >
        <div style={{ marginBottom: 8 }}>可从本班同学中选择成员：</div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择群成员"
          value={manageSelected}
          onChange={setManageSelected}
          options={classmates.map(s => ({ label: s.name, value: s._id }))}
        />
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>提示：你始终是管理员，不能移除自己。</div>
      </Modal>
    </div>
  );
};

export default Messages;


