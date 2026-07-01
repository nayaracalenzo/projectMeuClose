import Header from "../components/Header";
import Sidebar from "../components/SideBar";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          className="h-full min-h-0 overflow-y-auto bg-surface-low pb-20 md:pb-0"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
