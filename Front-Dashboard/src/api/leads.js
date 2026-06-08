import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

// Cabecera con el token de administrador (obtenido tras el login server-side)
const auth = () => ({ headers: { 'x-admin-token': sessionStorage.getItem('adminToken') || '' } });

export const loginAdmin = (password) => axios.post(`${API}/api/auth/login`, { password }).then(r => r.data);

export const getLeads    = (desde) => axios.get(`${API}/api/leads`, { params: desde ? { desde } : {} }).then(r => r.data);
export const getMetricas = () => axios.get(`${API}/api/leads/metricas`).then(r => r.data);
export const getMetricasTecnico = () => axios.get(`${API}/api/leads/metricas-tecnico`).then(r => r.data);
export const getTecnicos   = () => axios.get(`${API}/api/vendedores/tecnicos`).then(r => r.data);
export const getVendedores = () => axios.get(`${API}/api/vendedores`).then(r => r.data);
export const updateEstadoLead  = (id, estado, tecnico_id) => axios.patch(`${API}/api/leads/${id}/estado`, { estado, tecnico_id }, auth()).then(r => r.data);
export const updateTiemposLead = (id, tiempos) => axios.patch(`${API}/api/leads/${id}/tiempos`, tiempos, auth()).then(r => r.data);
export const deleteLead = (id) => axios.delete(`${API}/api/leads/${id}`, auth()).then(r => r.data);
export const updateVendedorLead = (id, vendedor_id) => axios.patch(`${API}/api/leads/${id}/vendedor`, { vendedor_id }, auth()).then(r => r.data);
export const updateInfoLead = (id, data) => axios.patch(`${API}/api/leads/${id}/info`, data, auth()).then(r => r.data);
export const createVendedor = (data) => axios.post(`${API}/api/vendedores`, data, auth()).then(r => r.data);
export const updateVendedor = (id, data) => axios.put(`${API}/api/vendedores/${id}`, data, auth()).then(r => r.data);
export const deleteVendedor = (id) => axios.delete(`${API}/api/vendedores/${id}`, auth()).then(r => r.data);
