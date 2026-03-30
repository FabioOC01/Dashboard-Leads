import axios from 'axios';

const API = import.meta.env.VITE_API_URL;

export const getLeads    = (desde) => axios.get(`${API}/api/leads`, { params: desde ? { desde } : {} }).then(r => r.data);
export const getMetricas = () => axios.get(`${API}/api/leads/metricas`).then(r => r.data);
export const updateEstadoLead = (id, estado) => axios.patch(`${API}/api/leads/${id}/estado`, { estado }).then(r => r.data);
