import { getAccessToken, refreshAccessToken } from './auth.js';

const API_URL = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (token && !options.public) headers.set('Authorization', `Bearer ${token}`);

  const opts = { ...options, headers };
  const res = await fetch(`${API_URL}${path}`, opts);

  if (res.status === 401 && !options.skipAuthRetry && !options.public) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      headers.set('Authorization', `Bearer ${fresh}`);
      return fetch(`${API_URL}${path}`, { ...opts, headers });
    }
  }

  return res;
}

export function wsUrl() {
  return API_URL || undefined;
}
