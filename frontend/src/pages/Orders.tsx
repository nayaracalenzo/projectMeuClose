import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "../components/Button";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

interface ProductOrderRow {
  id: number;
  saleId: number | null;
  description: string;
  customer: string;
  category: string | null;
  productType: string | null;
  clothingType: string | null;
  seamstress: string | null;
  status: string | null;
  finalValue: number;
  testDate: string | null;
  createdAt: string;
}

interface StatusOption {
  id: number;
  desc: string;
}

interface OrdersResponse {
  items: ProductOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const formatCustomerName = (value?: string | null) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "Sem cliente";

  return parts.slice(0, 2).join(" ");
};

const getStatusBadgeClassName = (status?: string | null) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "entregue") {
    return "bg-secondary text-primary";
  }

  if (normalized === "a produzir") {
    return "bg-[#F5E6A9] text-[#6D5200]";
  }

  if (normalized === "cancelada") {
    return "bg-[#F8D7DA] text-[#7A1717]";
  }

  if (normalized === "atrasada") {
    return "bg-[#F8D7DA] text-[#7A1717]";
  }

  return "bg-gray-200 text-neutral-700";
};

export default function Orders() {
  const pageSize = 10;
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductOrderRow[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateOrder, setDateOrder] = useState("createdAtDesc");
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const data = await getRequest("/products/status-options");
        setStatusOptions(Array.isArray(data) ? data : []);
      } catch {
        setStatusOptions([]);
      }
    };

    fetchStatuses();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateOrder]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          sortBy: dateOrder,
        });

        if (statusFilter !== "todos") {
          params.set("statusId", statusFilter);
        }

        const data = (await getRequest(`/products?${params.toString()}`)) as OrdersResponse;

        setOrders(Array.isArray(data.items) ? data.items : []);
        setTotalOrders(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (err: unknown) {
        setError(getUserFacingApiErrorMessage(err));
        setOrders([]);
        setTotalOrders(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [dateOrder, page, pageSize, statusFilter]);

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex justify-center gap-4 md:justify-between">
        <div>
          <h1 className="pb-2 pt-12 text-6xl font-semibold text-primary md:text-4xl">
            Pedidos
          </h1>
          <p className="text-sm text-neutral-700">
            {loading ? "Carregando pedidos..." : `${totalOrders} pedido(s) encontrado(s).`}
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Button
            variant="primary"
            size="md"
            className="px-5"
            onClick={() => navigate("/nova-venda")}
          >
            + Novo Pedido
          </Button>
          <Button variant="secondary" size="md" className="px-5" disabled>
            <span className="flex items-center gap-2">
              <Printer size={16} />
              PDF da semana
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex md:hidden">
        <Button variant="secondary" size="md" className="w-full" disabled>
          <span className="flex items-center justify-center gap-2">
            <Printer size={16} />
            Gerar PDF da semana
          </span>
        </Button>
      </div>

      <div className="mb-4 grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="orders-status-filter" className="text-sm font-medium text-primary">
            Filtrar por situação
          </label>
          <select
            id="orders-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary"
          >
            <option value="todos">Todos</option>
            {statusOptions.map((status) => (
              <option key={status.id} value={status.id}>
                {status.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="orders-date-order" className="text-sm font-medium text-primary">
            Ordenar por data
          </label>
          <select
            id="orders-date-order"
            value={dateOrder}
            onChange={(event) => setDateOrder(event.target.value)}
            className="rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary"
          >
            <option value="createdAtDesc">Mais recentes</option>
            <option value="testDateAsc">Data de prova mais antiga</option>
            <option value="testDateDesc">Data de prova mais recente</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Descrição
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Cliente</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Data Prova
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Costureira
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Carregando pedidos...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum pedido cadastrado
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer bg-surface-lowest transition-colors hover:bg-surface"
                  onClick={() => navigate(`/pedido/${order.id}`)}
                >
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {order.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatCustomerName(order.customer)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(order.testDate)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {order.seamstress || "-"}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${getStatusBadgeClassName(
                        order.status,
                      )}`}
                    >
                      {order.status || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {formatCurrency(order.finalValue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Carregando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum pedido cadastrado
          </div>
        ) : (
          orders.map((order) => (
            <button
              key={order.id}
              type="button"
              className="w-full px-4 py-4 text-left"
              onClick={() => navigate(`/pedido/${order.id}`)}
            >
              <p className="text-xs text-neutral-700">Descrição: {order.description || "-"}</p>
              <p className="text-sm font-semibold text-primary">
                {formatCustomerName(order.customer)}
              </p>
              <p className="text-xs text-neutral-700">
                Data Prova: {formatDate(order.testDate)}
              </p>
              <p className="text-xs text-neutral-700">
                Costureira: {order.seamstress || "-"}
              </p>
              <p className="text-xs text-neutral-700">
                Status:{" "}
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getStatusBadgeClassName(
                    order.status,
                  )}`}
                >
                  {order.status || "-"}
                </span>
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {formatCurrency(order.finalValue)}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          Página {page} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
