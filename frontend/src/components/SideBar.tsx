import {
  ArrowDownCircle,
  ArrowUpCircle,
  Home,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigation: NavItem[] = useMemo(
    () => [
      { title: "Home", path: "/home", icon: Home },
      { title: "Vendas", path: "/vendas", icon: Wallet },
      { title: "Produção", path: "/producao", icon: Package },
      { title: "Clientes", path: "/clientes", icon: Users },
      { title: "A Receber", path: "/a-receber", icon: ArrowDownCircle },
      { title: "A Pagar", path: "/a-pagar", icon: ArrowUpCircle },
      { title: "Caixa", path: "/caixa", icon: Wallet },
      { title: "Administração", path: "/admin", icon: UserLock },
    ],
    [],
  );

  const requestNavigation = (path: string) => {
    const navigationEvent = new CustomEvent("app:navigate-intent", {
      cancelable: true,
      detail: { path },
    });

    const canNavigate = window.dispatchEvent(navigationEvent);

    if (canNavigate) {
      navigate(path);
    }

    return canNavigate;
  };

  return (
    <>
      <aside
        className={`hidden h-screen max-h-screen shrink-0 border-r border-outline-variant/35 bg-surface-lowest/95 backdrop-blur-sm transition-[width] duration-200 md:block ${
          isCollapsed ? "w-20" : "w-60"
        }`}
      >
        <div
          className={`flex h-full flex-col overflow-hidden pb-6 pt-6 transition-[padding] duration-200 ${
            isCollapsed ? "px-3" : "px-4"
          }`}
        >
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2"}`}>
            <img
              className={`${isCollapsed ? "h-11" : "h-16"} opacity-75`}
              src="/manequim.png"
              alt="logo"
            />
            <h1 className={`${isCollapsed ? "hidden" : "block"} whitespace-nowrap font-editorial text-[25px] uppercase tracking-[0.06em] text-primary`}>
              Meu Close
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className={`mt-2 flex h-9 w-9 items-center justify-center rounded text-neutral-700 transition hover:bg-surface hover:text-primary focus:outline-none ${
              isCollapsed ? "self-center" : "self-end"
            }`}
            aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={19} strokeWidth={2} />
            ) : (
              <PanelLeftClose size={19} strokeWidth={2} />
            )}
          </button>
          <p className={`${isCollapsed ? "hidden" : "block"} mt-2 text-[11px] uppercase tracking-[0.18em] text-neutral-700`}>
            Ateliê
          </p>

          <ul className={`${isCollapsed ? "mt-4" : "mt-3"} flex-1 space-y-1`}>
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.path} className="w-full">
                  <NavLink
                    to={item.path}
                    onClick={(event) => {
                      if (!requestNavigation(item.path)) {
                        event.preventDefault();
                      }
                    }}
                    aria-label={item.title}
                    title={isCollapsed ? item.title : undefined}
                    className={({ isActive }) =>
                      `flex items-center py-3.5 transition-colors ${
                        isCollapsed ? "justify-center px-2" : "gap-3 px-4"
                      } ${
                        isActive
                          ? "bg-surface text-primary"
                          : "text-neutral-700 hover:bg-surface hover:text-primary"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={isCollapsed ? 19 : 16} strokeWidth={2} />
                        <span
                          className={`${isCollapsed ? "hidden" : "block"} whitespace-nowrap text-[13px] uppercase tracking-[0.12em] ${
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

          <div className={`mt-auto pt-4 ${isCollapsed ? "px-0" : "px-4"}`}>
            <button
              type="button"
              onClick={() => logoutAndRedirect("logged_out")}
              className={`flex w-full items-center rounded py-3 text-[13px] font-medium uppercase tracking-[0.12em] text-neutral-700 transition hover:bg-surface hover:text-primary ${
                isCollapsed ? "justify-center px-2" : "gap-3 px-4"
              }`}
              aria-label="Sair"
              title={isCollapsed ? "Sair" : undefined}
            >
              <LogOut size={isCollapsed ? 19 : 16} strokeWidth={2} />
              <span className={isCollapsed ? "hidden" : "block"}>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="fixed top-0 left-0 right-0 z-50 border-b border-outline-variant/30 bg-surface-lowest/95 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <button
            type="button"
            onClick={() => requestNavigation("/home")}
            className="min-w-0 text-left"
          >
            <span className="block font-editorial text-[1.65rem] uppercase leading-none tracking-[0.06em] text-primary">
              Meu Close
            </span>
            <span className="block pt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-700">
              Ateliê
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="shrink-0 p-1 text-neutral-700 transition hover:text-primary"
            aria-expanded={isMobileMenuOpen}
            aria-label="Abrir menu"
          >
            {isMobileMenuOpen ? (
              <X size={22} strokeWidth={2} />
            ) : (
              <Menu size={22} strokeWidth={2} />
            )}
          </button>
        </div>

      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-[60] md:hidden ">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/28"
          />

          <div className="relative z-10 h-full w-[min(20rem,86vw)] overflow-y-auto border-r border-outline-variant/25 bg-surface px-3 pb-4 pt-[2.1rem] shadow-(--ambient-shadow)">
            <div className="mb-3 border-b border-outline-variant/20 px-3 pb-4">
              <span className="block font-editorial text-[1.9rem] uppercase leading-none tracking-[0.06em] text-primary">
                Meu Close
              </span>
              <span className="block pt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-700">
                Ateliê
              </span>
            </div>
            <div className="grid gap-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      requestNavigation(item.path);
                    }}
                    className={`flex w-full items-center gap-3 rounded px-3 py-3 text-left transition ${
                      isActive
                        ? "bg-surface text-primary"
                        : "text-neutral-700 hover:bg-surface hover:text-primary"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} />
                    <span
                      className={`text-[13px] uppercase tracking-[0.12em] ${
                        isActive ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {item.title}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logoutAndRedirect("logged_out");
                }}
                className="mt-2 flex w-full items-center gap-3 border-t border-outline-variant/25 px-3 py-3 text-left text-neutral-700 transition hover:bg-surface hover:text-primary"
              >
                <LogOut size={16} strokeWidth={2} />
                <span className="text-[13px] font-medium uppercase tracking-[0.12em]">
                  Sair
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
