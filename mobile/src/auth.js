// ─── Mobile auth helpers (JWT token management via localStorage) ───

const API_URL_KEY = 'snowify_api_url';
const ACCESS_TOKEN_KEY = 'snowify_access_token';
const REFRESH_TOKEN_KEY = 'snowify_refresh_token';
const USER_KEY = 'snowify_user';

export function getApiUrl() {
  return localStorage.getItem(API_URL_KEY) || '';
}

export function setApiUrl(url) {
  localStorage.setItem(API_URL_KEY, url);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isLoggedIn() {
  return !!localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAuthData(data) {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  if (data.user) setUser(data.user);
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
