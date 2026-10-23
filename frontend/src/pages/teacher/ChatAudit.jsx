import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, List, Space, Tabs, Typography, message } from 'antd';
import imAPI from '../../services/userMessages';
import api, { classAPI } from '../../services/api';

const { Text } = Typography;

const ChatAudit = () => {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState();
  const [selectedStudentId, setSelectedStudentId] = useState();
  const [conversations, setConversations] = useState([]);
  const [groupConversations, setGroupConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await classAPI.getTeacherClasses();
        setClasses(res.data || []);
      } catch (e) {
        message.error('加载班级失败');
      }
    })();
  }, []);

  const loadStudents = async (classId) => {
    try {
      const res = await api.get(`/classes/${classId}`);
      setStudents(res?.data?.data?.students || []);
    } catch (e) {
      message.error('加载学生失败');
      setStudents([]);
    }
  };

  const loadConversations = async (studentId) => {
    try {
      const res = await imAPI.getStudentConversationsForTeacher(studentId);
      setConversations(res?.data?.conversations || []);
    } catch (e) {
      message.error('加载会话失败');
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const res = await imAPI.getConversationMessagesForTeacher(conversationId, { page: 1, limit: 50 });
      setMessages(res?.data?.messages || []);
    } catch (e) {
      message.error('加载消息失败');
    }
  };

  const loadClassGroups = async (classId) => {
    try {
      const res = await imAPI.getClassGroupConversationsForTeacher(classId);
      setGroupConversations(res?.data?.conversations || []);
    } catch (e) {
      message.error('加载班级群聊失败');
    }
  };

  return (
    <div style={{ padding: 16, display: 'flex', gap: 12, height: 'calc(100vh - 80px)' }}>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
         <Card size="small" title="选择班级">
          <Select style={{ width: '100%' }} placeholder="选择班级"
            value={selectedClassId}
             onChange={(v) => { setSelectedClassId(v); setSelectedStudentId(undefined); setSelectedConv(undefined); setMessages([]); loadStudents(v); loadClassGroups(v); }}
            options={(classes || []).map(c => ({ label: `${c.grade}级${c.name}班`, value: c._id }))}
          />
        </Card>
        <Card size="small" title="选择学生">
          <Select style={{ width: '100%' }} placeholder="选择学生"
            value={selectedStudentId}
            onChange={(v) => { setSelectedStudentId(v); setSelectedConv(undefined); setMessages([]); loadConversations(v); }}
            options={(students || []).map(s => ({ label: s.name || s.username, value: s._id }))}
          />
        </Card>
        <Tabs
          items={[
            {
              key: 'student-conv',
              label: '该学生的会话',
              children: (
                <Card size="small" bodyStyle={{ padding: 0 }}>
                  <List size="small" dataSource={conversations}
                    renderItem={(item) => {
                      let title = item.name || '群聊';
                      if (item.type === 'direct') {
                        const sid = String(selectedStudentId || '');
                        const peerId = (item.participants || []).map(String).find(id => id !== sid);
                        const peer = (students || []).find(s => String(s._id) === String(peerId));
                        title = peer?.name || peer?.username || '对方';
                      }
                      return (
                        <List.Item style={{ cursor: 'pointer', background: selectedConv?._id === item._id ? '#f5f5f5' : undefined }} onClick={() => { setSelectedConv(item); loadMessages(item._id); }}>
                          <List.Item.Meta title={title} description={<Text type="secondary">成员数 {item.participants?.length || 0}</Text>} />
                        </List.Item>
                      );
                    }}
                  />
                </Card>
              )
            },
            {
              key: 'class-groups',
              label: '班级群聊',
              children: (
                <Card size="small" bodyStyle={{ padding: 0 }}>
                  <List size="small" dataSource={groupConversations}
                    renderItem={(item) => (
                      <List.Item style={{ cursor: 'pointer', background: selectedConv?._id === item._id ? '#f5f5f5' : undefined }} onClick={() => { setSelectedConv(item); loadMessages(item._id); }}>
                        <List.Item.Meta title={item.name || '群聊'} description={<Text type="secondary">成员数 {item.participants?.length || 0}</Text>} />
                      </List.Item>
                    )}
                  />
                </Card>
              )
            }
          ]}
        />
      </div>
      <div style={{ flex: 1 }}>
        <Card size="small" title="消息记录">
          <List dataSource={messages}
            renderItem={(m) => (
              <List.Item>
                <List.Item.Meta title={<Space><Text>{m.sender?.name || m.sender?.username || m.sender?._id}</Text><Text type="secondary" style={{ fontSize: 12 }}>{new Date(m.createdAt).toLocaleString()}</Text></Space>} description={<div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>} />
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
};

export default ChatAudit;


