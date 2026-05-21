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

  const opts = {
    ...options,
    headers,
    cache: 'no-store', // Prevent browser caching of API responses
  };

  const res  = await fetch(`${API_BASE}${path}`, opts);
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

  // ── Weekly Schedule ───────────────────────────────────────────────────────
  getSchedule:       ()              => request('/schedule'),
  setScheduleDay:    (dateKey, body) => request(`/schedule/${dateKey}`, { method: 'PUT',    body: JSON.stringify(body) }),
  deleteScheduleDay: (dateKey)       => request(`/schedule/${dateKey}`, { method: 'DELETE' }),

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminStats:        ()      => request('/admin/stats'),
  adminUsers:        ()      => request('/admin/users'),
  adminUserRecords:  (id)    => request(`/admin/users/${id}/records`),
  adminUserSchedule: (id)    => request(`/admin/users/${id}/schedule`),

  // ── Announcements ─────────────────────────────────────────────────────────
  getActiveAnnouncements:  ()     => request('/announcements/active'),
  acceptAnnouncement:      (id)   => request(`/announcements/${id}/accept`, { method: 'POST' }),
  unacceptAnnouncement:    (id)   => request(`/announcements/${id}/accept`, { method: 'DELETE' }),
  adminGetAnnouncements:   ()     => request('/admin/announcements'),
  adminCreateAnnouncement: (body) => request('/admin/announcements', { method: 'POST', body: JSON.stringify(body) }),
  adminDeleteAnnouncement: (id)   => request(`/admin/announcements/${id}`, { method: 'DELETE' }),
  adminGetAcceptances:     (id)   => request(`/admin/announcements/${id}/acceptances`),
};
