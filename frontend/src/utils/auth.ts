export function getStoredToken() {
  return localStorage.getItem("token")?.replace(/^"|"$/g, "").trim() || "";
}

export function hasAuthToken() {
  return Boolean(getStoredToken());
}
