import {
  Banknote,
  Gift,
  HouseHeart,
  icons,
  // BookOpen,
  // ClipboardList,
  // SquarePen,
  LibraryBig,
  LogOut,
  Shirt,
  Store,
  UserLock,
  UsersRound,
  Wallet,
} from "lucide-react";
import logobrilhante from "../assets/logoMeuClose.png";
import vestido from "../assets/vestido.png";
// import { useAuth } from "../context/UseAuth";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  // const navigate = useNavigate()
  //   const handleLogout = () => {
  //     // exemplo: limpar token
  //     localStorage.removeItem("token");

  //     // redirecionar
  //     navigate("/login");
  //   };
    const navigation = [
      { title: "Home", path: "/home", icon: <HouseHeart size={25} /> },
      {
        title: "Pedidos",
        path: "/pedidos",
        icon: <img src={vestido} width={25} alt="icone vestido" />,
      },
      { title: "Clientes", path: "/clientes", icon: <UsersRound size={25} /> },
      { title: "Vendas", path: "/vendas", icon: <Gift size={25} /> },
      { title: "Banco", path: "/banco", icon: <Banknote size={25} /> },
      { title: "Caixa", path: "/caixa", icon: <Wallet size={25} /> },
      { title: "Estoque", path: "/estoque", icon: <Store size={25} /> },
      {
        title: "Administração",
        path: "/admin",
        icon: <UserLock size={25} />,
      },
    ];

  return (
    <aside className="w-60 bg-[#fff6f4]">
      <div className="p-3">
        <img className="" src={logobrilhante} width={150} />
      </div>
      <div className="w-full bg-cover  bg-[url(/bg-sidebar2.png)] rounded-xl flex pt-5 h-160 mr-2 flex-col space-y-8 md:flex md:space-x-6 md:space-y-0">
        <ul className="flex-1">
          {navigation.map((item, idx) => {
            return (
              <li
                key={idx}
                className="flex font-semibold text-(--text-secondary) w-full"
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `w-[90%] flex group items-center gap-3 px-3 py-2 rounded-r-lg transition-all
     ${
       isActive
         ? "bg-[#f9979a] font-bold"
         : "text-(--text-secondary) hover:bg-[#f9979a]"
     }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`h-6 w-1 rounded transition-all
          ${
            isActive
              ? "bg-pink-500 opacity-100"
              : "opacity-0 group-hover:opacity-100 bg-pink-400"
          }`}
                      ></span>

                      <span>{item.icon}</span>
                      {item.title}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
