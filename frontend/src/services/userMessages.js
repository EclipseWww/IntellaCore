import api from './api';

const imAPI = {
  createDirect: async (userId) => {
    const { data } = await api.post('/im/conversations/direct', { userId });
    return data;
  },
  createGroup: async ({ name, participantIds = [] }) => {
    const { data } = await api.post('/im/conversations/group', { name, participantIds });
    return data;
  },
  getConversations: async () => {
    const { data } = await api.get('/im/conversations');
    return data;
  },
  getMessages: async (conversationId, params = {}) => {
    const { data } = await api.get(`/im/conversations/${conversationId}/messages`, { params });
    return data;
  },
  sendMessage: async ({ conversationId, content, mentions = [], attachments = [] }) => {
    const { data } = await api.post('/im/messages', { conversationId, content, mentions, attachments });
    return data;
  },
  addMembers: async (conversationId, memberIds) => {
    const { data } = await api.post(`/im/conversations/${conversationId}/members/add`, { memberIds });
    return data;
  },
  removeMember: async (conversationId, memberId) => {
    const { data } = await api.delete(`/im/conversations/${conversationId}/members/${memberId}`);
    return data;
  },
  leave: async (conversationId) => {
    const { data } = await api.post(`/im/conversations/${conversationId}/leave`);
    return data;
  },
  markRead: async (conversationId) => {
    const { data } = await api.post(`/im/conversations/${conversationId}/read`);
    return data;
  },
  // Teacher audit
  getStudentConversationsForTeacher: async (studentId) => {
    const { data } = await api.get(`/im/teacher/students/${studentId}/conversations`);
    return data;
  },
  getConversationMessagesForTeacher: async (conversationId, params = {}) => {
    const { data } = await api.get(`/im/teacher/conversations/${conversationId}/messages`, { params });
    return data;
  },
  getClassGroupConversationsForTeacher: async (classId) => {
    const { data } = await api.get(`/im/teacher/classes/${classId}/groups`);
    return data;
  }
};

export default imAPI;
