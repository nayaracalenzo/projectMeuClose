import { Navigate, Outlet } from "react-router-dom";
import { hasAuthToken } from "../utils/auth";

export default function PublicRoute() {
  if (hasAuthToken()) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
