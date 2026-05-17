// Centralized API helper — automatically attaches JWT from localStorage
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('ot_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res  = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || 'An unexpected error occurred');
  }
  return data;
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register:      (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:         (body) => request('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:            ()     => request('/auth/me'),
  updateProfile: (body) => request('/auth/profile',  { method: 'PUT',  body: JSON.stringify(body) }),

  // ── OT Records ────────────────────────────────────────────────────────────
  getAll:  ()        => request('/ot'),
  create:  (body)    => request('/ot',       { method: 'POST',   body: JSON.stringify(body) }),
  update:  (id, b)   => request(`/ot/${id}`, { method: 'PUT',    body: JSON.stringify(b) }),
  remove:  (id)      => request(`/ot/${id}`, { method: 'DELETE' }),

  // ── Summary ───────────────────────────────────────────────────────────────
  getSummary: (year, month) => request(`/ot/summary?year=${year}&month=${month}`),
};
