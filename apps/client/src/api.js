import { apiOrigin } from './runtime';

export const getToken = () => localStorage.getItem('verdant-token');
export const setToken = (token) => token
  ? localStorage.setItem('verdant-token', token)
  : localStorage.removeItem('verdant-token');

export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiOrigin}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
