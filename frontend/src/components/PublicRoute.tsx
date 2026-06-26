import { Navigate, Outlet } from "react-router-dom";
import { clearStoredToken, getStoredToken, isTokenExpired } from "../utils/auth";

export default function PublicRoute() {
  const token = getStoredToken();

  if (!token) {
    return <Outlet />;
  }

  if (isTokenExpired(token)) {
    clearStoredToken();
    return <Outlet />;
  }

  return <Navigate to="/home" replace />;
}
