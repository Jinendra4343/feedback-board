const API_URL = import.meta.env.VITE_API_URL || '';

export function api(path, options = {}) {
  return fetch(`${API_URL}${path}`, options);
}

export function wsUrl() {
  return API_URL || undefined;
}
