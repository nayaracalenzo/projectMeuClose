const AUTH_NOTICE_KEY = "auth_notice";

type AuthNotice = "expired" | "logged_out";

function normalizeToken(token?: string | null) {
  return token?.replace(/^"|"$/g, "").trim() || "";
}

function parseJwtPayload(token: string) {
  const [, payload] = token.split(".");

  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded = window.atob(padded);
    return JSON.parse(decoded) as { exp?: number };
  } catch {
    return null;
  }
}

export function getStoredToken() {
  return normalizeToken(localStorage.getItem("token"));
}

export function clearStoredToken() {
  localStorage.removeItem("token");
}

export function hasAuthToken() {
  return Boolean(getStoredToken());
}

export function isTokenExpired(token = getStoredToken()) {
  if (!token) return true;

  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;

  return payload.exp * 1000 <= Date.now();
}

export function setAuthNotice(notice: AuthNotice) {
  sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
}

export function consumeAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY) as AuthNotice | null;

  if (notice) {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }

  return notice;
}

export function logoutAndRedirect(notice: AuthNotice = "logged_out") {
  clearStoredToken();
  setAuthNotice(notice);

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}
