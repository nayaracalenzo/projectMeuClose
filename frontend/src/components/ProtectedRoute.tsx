import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getStoredToken } from "../utils/auth";

export default function ProtectedRoute() {
  const location = useLocation();
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
