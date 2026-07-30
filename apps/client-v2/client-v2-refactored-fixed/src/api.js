import { apiOrigin } from './runtime';

const TOKEN_KEY = 'verdant-token';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent('verdant-auth-change', { detail: { authenticated: Boolean(token) } }));
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${apiOrigin}${path}`, { ...options, headers });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(navigator.onLine === false ? 'You are offline.' : 'Network request failed.');
  }

  if (response.status === 204) return {};
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().then((text) => text ? { message: text } : {}).catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent('verdant-session-expired'));
    throw new ApiError(data.error || data.message || `Request failed (${response.status})`, { status: response.status, data });
  }
  return data;
}

export function assetUrl(value) {
  if (!value) return null;
  if (/^(?:https?:|blob:|data:)/i.test(value)) return value;
  return value.startsWith('/') ? `${apiOrigin}${value}` : value;
}
