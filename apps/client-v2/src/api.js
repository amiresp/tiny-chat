import { apiOrigin } from './runtime';

export const getToken = () => localStorage.getItem('verdant-token');

export function setToken(token) {
  if (token) localStorage.setItem('verdant-token', token);
  else localStorage.removeItem('verdant-token');
  window.dispatchEvent(new CustomEvent('verdant-auth-change', { detail: { authenticated: Boolean(token) } }));
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiOrigin}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function assetUrl(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}
