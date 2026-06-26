import Header from "../components/Header";
import Sidebar from "../components/SideBar";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <div className="flex ">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />
        <main
          className="bg-surface-low h-full overflow-y-auto pb-20 md:pb-0
      "
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
