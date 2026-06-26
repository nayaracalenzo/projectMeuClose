import { Navigate, Outlet, useLocation } from "react-router-dom";
import { hasAuthToken } from "../utils/auth";

export default function ProtectedRoute() {
  const location = useLocation();

  if (!hasAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
