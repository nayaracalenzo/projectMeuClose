import { useEffect, useState } from "react";
import { getRequest } from "../services/request.ts";
import type { ICustomer } from "../interfaces/ICustomer.ts";
import { ChevronRight } from "lucide-react";
import { CircularProgress, FormControl, MenuItem, Select } from "@mui/material";
import { formatDocument } from "../utils/formatDocument.ts";
import { formatContact } from "../utils/formatContact.ts";
import { Button } from "../components/Button.tsx";
import { useNavigate } from "react-router-dom";

type CustomerRow = {
  id: number;
  "Nome do Cliente": string;
  "CPF/CNPJ": string;
  Contato: string;
  Ativo: boolean;
  Bloqueado: boolean;
  email: string;
};

interface CustomersResponse {
  items: ICustomer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ativo");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          status: statusFilter,
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const data = (await getRequest(`/clients?${params.toString()}`)) as CustomersResponse;
        const items = Array.isArray(data.items) ? data.items : [];
        const customer = items.map((customer: ICustomer) => ({
          id: Number(customer.id),
          "Nome do Cliente": customer.fullName ?? "",
          "CPF/CNPJ": formatDocument(customer.document),
          Contato: formatContact(customer.phone),
          Ativo: customer.active,
          Bloqueado: Boolean(customer.blocked),
          email: customer.email?.trim() ?? "",
        }));

        setCustomers(customer);
        setTotalCustomers(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (error) {
        console.error(error);
        setCustomers([]);
        setTotalCustomers(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [currentPage, search, statusFilter]);

  const catchIdFromTable = (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
      return;
    }

    setSelectedId(id);
  };

  return (
    <>
      {loading ? (
        <div className="mt-50 flex w-full items-center justify-center">
          <CircularProgress />
        </div>
      ) : (
        <div className="w-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
          <div>
            <div className="mb-5 flex justify-center gap-4 md:justify-between">
              <h1 className="pb-6 pt-12 text-6xl font-semibold text-primary md:text-4xl">
                Clientes
              </h1>
              <div className="hidden gap-2 md:flex">
                <Button
                  variant="primary"
                  size="md"
                  className="px-5"
                  onClick={() => navigate("/novo-cliente")}
                >
                  + Novo Cliente
                </Button>
                <Button
                  variant="secondary"
                  disabled={!selectedId}
                  size="md"
                  className="px-5"
                  onClick={() => selectedId && navigate(`/cliente/${selectedId}`)}
                >
                  Mostrar Detalhes
                </Button>
              </div>
            </div>
            <div className="mb-5 flex w-full min-w-0 flex-col gap-3 md:mb-0 md:flex-row">
              <input
                type="text"
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full min-w-0 flex-1 rounded-4xl border border-gray-800 bg-white px-4 py-5 text-[18px] text-primary placeholder:text-xl focus:outline-none focus:ring-2 focus:ring-secondary/70 md:rounded md:border-outline-variant/50"
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
                    <MenuItem value="bloqueado">Clientes Bloqueados</MenuItem>
                    <MenuItem value="todos">Todos</MenuItem>
                  </Select>
                </FormControl>
              )}
            </div>
          </div>

          <p className="mb-4 mt-4 text-[13px] tracking-[0.04em] text-neutral-700">
            {totalCustomers} cliente(s) encontrado(s).
          </p>

          <div className="hidden overflow-x-auto md:block">
            <table className="mt-2 w-full border-separate border-spacing-y-2">
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
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => catchIdFromTable(customer.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedId === customer.id
                        ? "bg-surface"
                        : "bg-surface-lowest hover:bg-surface"
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
                          customer.Bloqueado
                            ? "bg-[#F8D7DA] text-[#7A1717]"
                            : customer.Ativo
                              ? "bg-secondary text-primary"
                              : "bg-gray-200 text-neutral-700"
                        }`}
                      >
                        {customer.Bloqueado
                          ? "Bloqueado"
                          : customer.Ativo
                            ? "Ativo"
                            : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => navigate(`/cliente/${customer.id}`)}
                className="flex w-full items-center justify-between px-4 py-10 text-left transition-colors hover:bg-surface"
              >
                <div className="flex min-w-0 gap-2 pr-3">
                  <p className="truncate text-lg font-semibold text-primary">
                    {customer["Nome do Cliente"]}
                  </p>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold uppercase tracking-[0.08em] ${
                      customer.Bloqueado
                        ? "bg-[#F8D7DA] text-[#7A1717]"
                        : customer.Ativo
                          ? "bg-secondary text-primary"
                          : "bg-gray-200 text-neutral-700"
                    }`}
                  >
                    {customer.Bloqueado
                      ? "Bloqueado"
                      : customer.Ativo
                        ? "Ativo"
                        : "Inativo"}
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
              Página {currentPage} de {totalPages}
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
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
