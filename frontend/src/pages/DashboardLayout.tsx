import Header from "../components/Header";
import Sidebar from "../components/SideBar";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-linear-to-b from-[#fff7f5] to-[#fed2d5c2]">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <Header />
        <main className="p-6 h-full overflow-y-auto mt-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
