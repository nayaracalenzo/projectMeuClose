import { useEffect, useState } from "react";
import { getRequest } from "../services/request.ts";
import type { ICustomer } from "../interfaces/ICustomer.ts";
import { ChevronRight } from "lucide-react";
import { CircularProgress, FormControl, MenuItem, Select } from "@mui/material";
import { formatDocument } from "../utils/formatDocument.ts";
import { formatContact } from "../utils/formatContact.ts";
import { Button } from "../components/Button.tsx";
import { useNavigate } from "react-router-dom";

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ativo");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const pageSize = 5;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const data = await getRequest("/clients");
        const customer = data.map((customer: ICustomer) => ({
          id: Number(customer.id),
          "Nome do Cliente": customer.fullName ?? "",
          "CPF/CNPJ": formatDocument(customer.document),
          Contato: formatContact(customer.phone),
          Ativo: customer.active,
          email: customer.email?.trim() ?? "",
        }));
        setCustomers(customer);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer: any) => {
    const searchLower = search.toLowerCase();

    const matchSearch =
      customer["Nome do Cliente"].toLowerCase().includes(searchLower) ||
      customer["CPF/CNPJ"].toLowerCase().includes(searchLower);

    const matchStatus =
      statusFilter === "todos"
        ? true
        : statusFilter === "ativo"
          ? customer.Ativo === true
          : statusFilter === "inativo"
            ? customer.Ativo === false
            : customer.Bloqueado === "bloqueado";

    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize),
  );
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCustomers = filteredCustomers.slice(
    startIndex,
    startIndex + pageSize,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const catchIdFromTable = (e: number) => {
    if (selectedId === e) {
      setSelectedId(0);
    } else {
      setSelectedId(e);
    }
  };

  return (
    <>
      {loading ? (
        <div className="mt-50 flex w-full items-center justify-center">
          <CircularProgress />
        </div>
      ) : (
        <div className="w-full min-w-0 bg-white md:bg-surface-low p-3 sm:p-5">
          <div>
            <div className="mb-5 flex md:justify-between justify-center gap-4">
              <h1 className="pt-12 pb-6 text-6xl md:text-4xl font-semibold text-primary">
                Clientes
              </h1>
              <div className="hidden md:flex gap-2">
                <Button variant="primary" size="md" className="px-5">
                  + Novo Cliente
                </Button>
                <Button
                  variant="secondary"
                  disabled={!selectedId}
                  size="md"
                  className="px-5"
                  onClick={() =>
                    selectedId && navigate(`/cliente/${selectedId}`)
                  }
                >
                  Mostrar Detalhes
                </Button>
              </div>
            </div>
            <div className="mb-5 flex w-full min-w-0 flex-col gap-3 md:mb-0 md:flex-row">
              <input
                type="text"
                placeholder=" Buscar por nome ou CPF/CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="placeholder:text-2xl h-11 py-5 w-full min-w-0 flex-1 rounded-4xl md:rounded border border-gray-800 md:border-outline-variant/50 bg-white px-4 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
              />
              {!isMobile && (
                <FormControl size="medium" className="w-full md:w-auto">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    sx={{
                      padding: 2,
                      height: 44,
                      borderRadius: 1,
                      backgroundColor: "white",
                      width: { xs: "100%", md: "auto" },
                      minWidth: { md: 190 },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(112, 105, 106, 0.45)",
                      },
                    }}
                  >
                    <MenuItem value="ativo">Clientes Ativos</MenuItem>
                    <MenuItem value="inativo">Clientes Inativos</MenuItem>
                    <MenuItem value="todos">Todos</MenuItem>
                  </Select>
                </FormControl>
              )}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-separate border-spacing-y-2 mt-2">
              <thead>
                <tr className="text-left">
                  <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                    Nome
                  </th>
                  <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                    Contato
                  </th>
                  <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                    CPF/CNPJ
                  </th>
                  <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((customer: any) => (
                  <tr
                    key={customer.id}
                    onClick={() => catchIdFromTable(customer.id)}
                    className={`cursor-pointer bg-surface-lowest transition-colors hover:bg-surface ${
                      selectedId === customer.id ? "bg-surface" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-[17px] font-semibold text-primary">
                            {customer["Nome do Cliente"]}
                          </p>
                          <p className="text-[13px] tracking-[0.04em] text-neutral-700">
                            {customer.email
                              ? customer.email.toLowerCase()
                              : "Sem email cadastrado"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[14px] tracking-[0.04em] text-neutral-700">
                      {customer["Contato"]}
                    </td>
                    <td className="px-4 py-4 text-[14px] tracking-[0.04em] text-neutral-700">
                      {customer["CPF/CNPJ"]}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${
                          customer.Ativo
                            ? "bg-secondary text-primary"
                            : "bg-gray-200 text-neutral-700"
                        }`}
                      >
                        {customer.Ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:bg-surface-lowest  md:hidden">
            {filteredCustomers.map((customer: any) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => navigate(`/cliente/${customer.id}`)}
                className="flex w-full items-center justify-between px-4 py-10 text-left transition-colors hover:bg-surface"
              >
                <div className="min-w-0 pr-3 flex gap-2">
                  <p className="truncate text-lg font-semibold text-primary">
                    {customer["Nome do Cliente"]}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold uppercase tracking-[0.08em] ${
                      customer.Ativo
                        ? "bg-secondary text-primary"
                        : "bg-gray-200 text-neutral-700"
                    }`}
                  >
                    {customer.Ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ChevronRight size={16} className="text-neutral-700" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 hidden items-center justify-between md:flex">
            <p className="text-[13px] tracking-[0.04em] text-neutral-700">
              Exibindo {filteredCustomers.length === 0 ? 0 : startIndex + 1}-
              {Math.min(startIndex + pageSize, filteredCustomers.length)} de{" "}
              {filteredCustomers.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <span className="px-2 text-sm text-primary">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
