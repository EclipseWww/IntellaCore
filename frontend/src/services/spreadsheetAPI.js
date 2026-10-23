import api from './api';

// Create a new spreadsheet
export const createSpreadsheet = async (data = {}) => {
    const response = await api.post('/spreadsheet', data);
    return response.data;
};

// Get all spreadsheets for current user
export const getSpreadsheets = async (params = {}) => {
    const response = await api.get('/spreadsheet', { params });
    return response.data;
};

// Get a single spreadsheet by ID
export const getSpreadsheet = async (id) => {
    const response = await api.get(`/spreadsheet/${id}`);
    return response.data;
};

// Update a spreadsheet
export const updateSpreadsheet = async (id, data) => {
    const response = await api.put(`/spreadsheet/${id}`, data);
    return response.data;
};

// Delete a spreadsheet
export const deleteSpreadsheet = async (id) => {
    const response = await api.delete(`/spreadsheet/${id}`);
    return response.data;
};

export default {
    createSpreadsheet,
    getSpreadsheets,
    getSpreadsheet,
    updateSpreadsheet,
    deleteSpreadsheet
};
