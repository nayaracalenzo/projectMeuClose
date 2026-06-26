import { Navigate, Outlet, useLocation } from "react-router-dom";
import {
  clearStoredToken,
  getStoredToken,
  isTokenExpired,
  setAuthNotice,
} from "../utils/auth";

export default function ProtectedRoute() {
  const location = useLocation();
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isTokenExpired(token)) {
    clearStoredToken();
    setAuthNotice("expired");
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
