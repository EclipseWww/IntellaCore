import api from './api';

const unwrap = (p) => p.then(r => r.data);

export const scheduleAPI = {
  getConfig: () => unwrap(api.get('/schedule/config')),
  updateConfig: (data) => unwrap(api.put('/schedule/config', data)),

  listSlots: () => unwrap(api.get('/schedule/slots')),
  saveSlot: (data) => unwrap(api.put('/schedule/slots', data)),
  deleteSlot: (id) => unwrap(api.delete(`/schedule/slots/${id}`)),

  createAdjustment: (data) => unwrap(api.post('/schedule/adjustments', data)),
  deleteAdjustment: (id) => unwrap(api.delete(`/schedule/adjustments/${id}`)),

  listOccurrences: (from, to) => unwrap(api.get('/schedule/occurrences', { params: { from, to } })),
  startOccurrence: (data) => unwrap(api.post('/schedule/occurrences/start', data)),
  skipOccurrence: (data) => unwrap(api.post('/schedule/occurrences/skip', data)),
  recordOccurrence: (data) => unwrap(api.post('/schedule/occurrences/record', data)),

  listSessions: (params) => unwrap(api.get('/schedule/sessions', { params })),
  getSession: (id) => unwrap(api.get(`/schedule/sessions/${id}`)),
  updateSession: (id, data) => unwrap(api.patch(`/schedule/sessions/${id}`, data)),
  unskip: (id) => unwrap(api.delete(`/schedule/sessions/${id}/skip`)),
  setJudgement: (id, state) => unwrap(api.put(`/schedule/sessions/${id}/judgement`, { state })),
  saveAttendance: (id, records) => unwrap(api.put(`/schedule/sessions/${id}/attendance`, { records })),

  listCourseLessons: (courseId) => unwrap(api.get(`/schedule/courses/${courseId}/lessons`)),
  getProgress: (classId) => unwrap(api.get('/schedule/progress', { params: { classId } })),

  async exportRoster(params) {
    const res = await api.get('/schedule/export/roster', { params, responseType: 'blob' });
    return res.data;
  }
};

export default scheduleAPI;
