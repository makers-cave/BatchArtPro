import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Templates
export const templatesApi = {
  getAll: () => api.get('/templates'),
  getOne: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  download: (id) => api.get(`/templates/${id}/download`, { responseType: 'blob' }),
  import: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/templates/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Data Sources
export const dataSourcesApi = {
  getAll: () => api.get('/datasources'),
  getOne: (id) => api.get(`/datasources/${id}`),
  create: (data) => api.post('/datasources', data),
  delete: (id) => api.delete(`/datasources/${id}`),
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/datasources/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  fetchApi: (config) => api.post('/datasources/api', config),
};

// Export
export const exportApi = {
  generate: (data) => api.post('/export', data),
};

// History
export const historyApi = {
  save: (templateId, action, snapshot) => 
    api.post(`/history?templateId=${templateId}&action=${action}`, snapshot),
  get: (templateId, limit = 50) => api.get(`/history/${templateId}?limit=${limit}`),
  clear: (templateId) => api.delete(`/history/${templateId}`),
};

export default api;
