// ─── HTTP client for Snowify backend API ───

let _baseUrl = '';
let _accessToken = '';
let _refreshToken = '';
let _onTokensUpdated = null;

export function configure({ baseUrl, accessToken, refreshToken, onTokensUpdated }) {
  _baseUrl = baseUrl.replace(/\/$/, '');
  _accessToken = accessToken || '';
  _refreshToken = refreshToken || '';
  _onTokensUpdated = onTokensUpdated || null;
}

export function getTokens() {
  return { accessToken: _accessToken, refreshToken: _refreshToken };
}

export function setTokens(accessToken, refreshToken) {
  _accessToken = accessToken;
  _refreshToken = refreshToken;
}

export function clearTokens() {
  _accessToken = '';
  _refreshToken = '';
}

export function isConfigured() {
  return !!_baseUrl;
}

export function isAuthenticated() {
  return !!_accessToken;
}

async function refreshAccessToken() {
  if (!_refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${_baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: _refreshToken })
  });
  if (!res.ok) {
    clearTokens();
    throw new Error('Refresh failed');
  }
  const data = await res.json();
  _accessToken = data.accessToken;
  _refreshToken = data.refreshToken;
  if (_onTokensUpdated) _onTokensUpdated({ accessToken: _accessToken, refreshToken: _refreshToken });
  return _accessToken;
}

export async function apiFetch(path, options = {}) {
  if (!_baseUrl) throw new Error('API not configured');

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  let res = await fetch(`${_baseUrl}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && _refreshToken) {
    try {
      await refreshAccessToken();
      headers['Authorization'] = `Bearer ${_accessToken}`;
      res = await fetch(`${_baseUrl}${path}`, { ...options, headers });
    } catch {
      throw new Error('Authentication expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error ${res.status}`);
  }

  return res.json();
}

// ─── Auth endpoints ───

export async function register(username, email, password) {
  const res = await fetch(`${_baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Registration failed');
  }
  const data = await res.json();
  _accessToken = data.accessToken;
  _refreshToken = data.refreshToken;
  if (_onTokensUpdated) _onTokensUpdated({ accessToken: _accessToken, refreshToken: _refreshToken });
  return data;
}

export async function login(email, password) {
  const res = await fetch(`${_baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Login failed');
  }
  const data = await res.json();
  _accessToken = data.accessToken;
  _refreshToken = data.refreshToken;
  if (_onTokensUpdated) _onTokensUpdated({ accessToken: _accessToken, refreshToken: _refreshToken });
  return data;
}

export async function logout() {
  if (_refreshToken) {
    await fetch(`${_baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refreshToken })
    }).catch(() => {});
  }
  clearTokens();
}
