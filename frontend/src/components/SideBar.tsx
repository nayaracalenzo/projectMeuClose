import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  UserLock,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { logoutAndRedirect } from "../utils/auth";

type NavItem = {
  title: string;
  path: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const navigation: NavItem[] = useMemo(
    () => [
      { title: "Home", path: "/home", icon: Home },
      { title: "Vendas", path: "/vendas", icon: Wallet },
      { title: "Produção", path: "/producao", icon: Package },
      { title: "Clientes", path: "/clientes", icon: Users },
      { title: "A Receber", path: "/a-receber", icon: ArrowDownCircle },
      { title: "A Pagar", path: "/a-pagar", icon: ArrowUpCircle },
      { title: "Banco", path: "/banco", icon: Banknote },
      { title: "Caixa", path: "/caixa", icon: Wallet },
      { title: "Administração", path: "/admin", icon: UserLock },
    ],
    [],
  );

  const primaryMobileItems = {
    home: navigation.find((item) => item.path === "/home")!,
    clients: navigation.find((item) => item.path === "/clientes")!,
  };

  const secondaryMobileItems = navigation.filter(
    (item) => item.path !== "/home" && item.path !== "/clientes",
  );

  return (
    <>
      <aside className="hidden h-screen max-h-screen w-60 shrink-0 border-r border-outline-variant/35 bg-surface-lowest/95 backdrop-blur-sm md:block">
        <div className="flex h-full flex-col overflow-hidden px-4 pb-6 pt-8">
          <div className="flex items-center gap-2">
            <img className="h-16 opacity-75" src="/manequim.png" alt="logo" />
            <h1 className="font-editorial text-[31px] uppercase tracking-[0.06em] text-primary">
              Meu Close
            </h1>
          </div>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-neutral-700">
            Ateliê
          </p>
        
          <ul className="flex-1 space-y-1 mt-3">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.path} className="w-full">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      ` flex items-center gap-3 px-4 py-3.5 transition-colors ${
                        isActive
                          ? "bg-surface text-primary"
                          : "text-neutral-700 hover:bg-surface hover:text-primary"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={16} strokeWidth={2} />
                        <span
                          className={`text-[13px] uppercase tracking-[0.12em] ${
                            isActive ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {item.title}
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto px-4 pt-4">
            <button
              type="button"
              onClick={() => logoutAndRedirect("logged_out")}
              className="flex w-full items-center gap-3 rounded px-4 py-3 text-[13px] font-medium uppercase tracking-[0.12em] text-neutral-700 transition hover:bg-surface hover:text-primary"
            >
              <LogOut size={16} strokeWidth={2} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/30 bg-surface-lowest py-3 backdrop-blur-3xl md:hidden">
        {isQuickCreateOpen && (
          <div className="absolute bottom-full left-1/2 mb-2 w-44 -translate-x-1/2 bg-surface-lowest p-2 shadow-(--ambient-shadow)">
            <button
              type="button"
              onClick={() => {
                setIsQuickCreateOpen(false);
                navigate(primaryMobileItems.clients.path);
              }}
              className="w-full px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-surface"
            >
              Novo cliente
            </button>
            <button
              type="button"
              onClick={() => {
                setIsQuickCreateOpen(false);
                navigate("/nova-venda");
              }}
              className="w-full px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-surface"
            >
              Nova venda
            </button>
          </div>
        )}

        {isMoreMenuOpen && (
          <div className="absolute bottom-full right-2 mb-2 w-52 bg-surface-lowest p-2 shadow-(--ambient-shadow)">
            {secondaryMobileItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  navigate(item.path);
                }}
                className="w-full px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-surface"
              >
                {item.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsMoreMenuOpen(false);
                logoutAndRedirect("logged_out");
              }}
              className="w-full px-3 py-2 text-left text-[13px] font-medium text-primary hover:bg-surface"
            >
              Sair
            </button>
          </div>
        )}

        <div className="grid h-16 grid-cols-3 items-center px-2">
          <button
            type="button"
            onClick={() => {
              setIsQuickCreateOpen(false);
              setIsMoreMenuOpen(false);
              navigate(primaryMobileItems.home.path);
            }}
            className={`flex flex-col items-center justify-center gap-1 ${
              location.pathname === primaryMobileItems.home.path
                ? "text-primary"
                : "text-neutral-700"
            }`}
          >
            <Home size={30} strokeWidth={2} />
            <span className="text-[18px] uppercase tracking-[0.12em]">Início</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsQuickCreateOpen((prev) => !prev);
              setIsMoreMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center gap-1 ${
              isQuickCreateOpen ? "text-primary" : "text-neutral-700"
            }`}
          >
            {isQuickCreateOpen ? (
              <X size={30} strokeWidth={2} />
            ) : (
              <Plus size={30} strokeWidth={2} />
            )}
            <span className="text-[18px] uppercase tracking-[0.12em]">Novo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMoreMenuOpen((prev) => !prev);
              setIsQuickCreateOpen(false);
            }}
            className={`flex flex-col items-center justify-center gap-1 ${
              isMoreMenuOpen ? "text-primary" : "text-neutral-700"
            }`}
          >
            <Menu size={30} strokeWidth={2} />
            <span className="text-[18px] uppercase tracking-[0.12em]">Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
}
