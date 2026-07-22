import { Navigate, Outlet } from "react-router-dom";
import { getStoredToken, isTokenExpired } from "../utils/auth";

export default function PublicRoute() {
  const token = getStoredToken();

  if (!token) {
    return <Outlet />;
  }

  if (isTokenExpired(token)) {
    return <Outlet />;
  }

  return <Navigate to="/home" replace />;
}
