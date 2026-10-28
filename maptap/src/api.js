// Client for the /api Worker + the locally stored cloud identity { id, username, key }.
import { CLOUD_KEY } from './config.js';

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export const KEY_RE = /^[0-9a-f]{16}\.[0-9a-f]{48}$/;
export const CODE_RE = /^[a-z0-9]{10}$/;

export function createApi({ getKey, fetchFn = (...a) => fetch(...a), base = '' }) {
  async function call(method, path, body, auth = true) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (auth) {
      const key = getKey();
      if (!key) throw new ApiError('You are not signed in.', 401);
      headers.authorization = `Bearer ${key}`;
    }
    let res;
    try {
      res = await fetchFn(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
    }
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error page */ }
    if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
    return data;
  }
  const enc = encodeURIComponent;
  return {
    createProfile: (username) => call('POST', '/api/profile', { username }, false),
    me: () => call('GET', '/api/me'),
    rename: (username) => call('PATCH', '/api/me', { username }),
    deleteMe: () => call('DELETE', '/api/me'),
    putResult: (day, r) => call('PUT', `/api/results/${day}`, r),
    importResults: (results) => call('POST', '/api/results', { results }),
    groups: () => call('GET', '/api/groups'),
    createGroup: (name) => call('POST', '/api/groups', { name }),
    preview: (code) => call('GET', `/api/groups/preview?code=${enc(code)}`, undefined, false),
    join: (code) => call('POST', '/api/groups/join', { code }),
    group: (id, period, date) => call('GET', `/api/groups/${enc(id)}?period=${period}${date ? `&date=${date}` : ''}`),
    leave: (id) => call('POST', `/api/groups/${enc(id)}/leave`, {}),
    deleteGroup: (id) => call('DELETE', `/api/groups/${enc(id)}`),
    removeMember: (id, pid) => call('DELETE', `/api/groups/${enc(id)}/members/${enc(pid)}`),
  };
}

export function loadCloud(storage) {
  try {
    const c = JSON.parse(storage.getItem(CLOUD_KEY) || 'null');
    if (c && typeof c.key === 'string' && KEY_RE.test(c.key)) {
      return { id: c.key.split('.')[0], key: c.key, username: typeof c.username === 'string' ? c.username.slice(0, 40) : '' };
    }
  } catch { /* corrupt */ }
  return null;
}
export function saveCloud(storage, c) {
  try {
    if (c) storage.setItem(CLOUD_KEY, JSON.stringify({ key: c.key, username: c.username }));
    else storage.removeItem(CLOUD_KEY);
    return true;
  } catch { return false; }
}

// Pull an invite code out of a pasted link ("…#join/abcdefghjk") or a bare code.
export function parseInvite(text) {
  const t = String(text).trim().toLowerCase();
  const m = /(?:join\/)?([a-z0-9]{10})\/?$/.exec(t);
  return m ? m[1] : null;
}
