import api from './api';

// Create a new HTML project
export const createProject = async (data = {}) => {
    const response = await api.post('/html-projects', data);
    return response.data;
};

// Get all projects for current user
export const getProjects = async () => {
    const response = await api.get('/html-projects');
    return response.data;
};

// Get a single project by ID
export const getProject = async (id) => {
    const response = await api.get(`/html-projects/${id}`);
    return response.data;
};

// Update a project
export const updateProject = async (id, data) => {
    const response = await api.put(`/html-projects/${id}`, data);
    return response.data;
};

// Delete a project
export const deleteProject = async (id) => {
    const response = await api.delete(`/html-projects/${id}`);
    return response.data;
};

// Publish a project
export const publishProject = async (id) => {
    const response = await api.put(`/html-projects/${id}/publish`);
    return response.data;
};

// Unpublish a project
export const unpublishProject = async (id) => {
    const response = await api.put(`/html-projects/${id}/unpublish`);
    return response.data;
};

// Get all published projects (public)
export const getPublishedProjects = async (page = 1, limit = 20) => {
    const response = await api.get(`/html-projects/published?page=${page}&limit=${limit}`);
    return response.data;
};

// View a published project (public)
export const viewPublishedProject = async (id) => {
    const response = await api.get(`/html-projects/published/${id}`);
    return response.data;
};

// Link project to assignment
export const linkAssignment = async (id, assignmentData) => {
    const response = await api.put(`/html-projects/${id}/link-assignment`, assignmentData);
    return response.data;
};

// Teacher: Get projects by lesson/activity
export const getProjectsByLesson = async (lessonId, activityId) => {
    const response = await api.get(`/html-projects/assignment/${lessonId}/${activityId}`);
    return response.data;
};

// Teacher: Delete student project (reuses deleteProject but with teacher auth)
export const teacherDeleteProject = async (projectId) => {
    const response = await api.delete(`/html-projects/${projectId}`);
    return response.data;
};

// Teacher: Unpublish student project
export const teacherUnpublishProject = async (projectId) => {
    const response = await api.put(`/html-projects/${projectId}/unpublish`);
    return response.data;
};

// Teacher: Publish student project (no points/quota)
export const teacherPublishProject = async (projectId) => {
    const response = await api.put(`/html-projects/${projectId}/teacher-publish`);
    return response.data;
};

export default {
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    publishProject,
    unpublishProject,
    getPublishedProjects,
    viewPublishedProject,
    linkAssignment,
    getProjectsByLesson,
    teacherDeleteProject,
    teacherUnpublishProject,
    teacherPublishProject
};
