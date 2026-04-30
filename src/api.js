const BASE = import.meta.env.VITE_API_URL || (
  window.location.hostname.endsWith('github.io')
    ? 'https://mvptsjsankxtaccppizm.supabase.co/functions/v1/api'
    : '/api'
);

function token() {
  return localStorage.getItem('metrik_token') || '';
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  put: (p, b) => req('PUT', p, b),
  del: (p) => req('DELETE', p),
  setToken(t) {
    if (t) localStorage.setItem('metrik_token', t);
    else localStorage.removeItem('metrik_token');
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem('metrik_user') || 'null'); }
    catch { return null; }
  },
  setUser(u) {
    if (u) localStorage.setItem('metrik_user', JSON.stringify(u));
    else localStorage.removeItem('metrik_user');
  }
};
