import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

interface SaleRow {
  id: number;
  status: string;
  customerName: string;
  paymentTypeName: string | null;
  itemsCount: number;
  firstItemDescription: string | null;
  finalAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface SalesResponse {
  items: SaleRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface SalesCountResponse {
  total: number;
}

type SalesViewMode = "orders" | "budgets";
type SalesStatusFilter = "DEFAULT" | "COMPLETED" | "BUDGET" | "CANCELLED";

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

const formatSaleStatusLabel = (value?: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "BUDGET") return "Orçamento";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "CANCELLED") return "Cancelado";

  return value || "-";
};

const getSaleStatusBadgeClassName = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "CANCELLED") {
    return "border border-[#d8a2ab] bg-[#f7d9dd] text-[#8a1f2d]";
  }

  if (normalized === "BUDGET") {
    return "border border-[#d7c27a] bg-[#f4ebc7] text-[#6b5600]";
  }

  if (normalized === "COMPLETED") {
    return "border border-[#9cc7ad] bg-[#d9efe0] text-[#1f5f3a]";
  }

  return "border border-outline-variant/40 bg-secondary text-primary";
};

export default function SalesPage() {
  const pageSize = 10;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [viewMode, setViewMode] = useState<SalesViewMode>("orders");
  const [statusFilter, setStatusFilter] =
    useState<SalesStatusFilter>("DEFAULT");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const highlightedSaleId = useMemo(() => {
    const value = Number(searchParams.get("highlight"));
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [searchParams]);

  const hasExplicitTabParam = useMemo(
    () => searchParams.has("tab"),
    [searchParams],
  );

  useEffect(() => {
    if (requestedTab === "budgets" || requestedTab === "orders") {
      setViewMode(requestedTab);
      return;
    }

    setViewMode("orders");
  }, [requestedTab]);

  useEffect(() => {
    setPage(1);
    setStatusFilter("DEFAULT");
  }, [viewMode]);

  const effectiveStatus =
    statusFilter === "DEFAULT"
      ? viewMode === "budgets"
        ? undefined
        : undefined
      : statusFilter;

  const statusOptions =
    viewMode === "budgets"
      ? [
          { value: "DEFAULT", label: "Todos os orçamentos" },
          { value: "BUDGET", label: "Orçamento" },
          { value: "CANCELLED", label: "Cancelado" },
        ]
      : [
          { value: "DEFAULT", label: "Todos os pedidos" },
          { value: "COMPLETED", label: "Concluído" },
          { value: "CANCELLED", label: "Cancelado" },
        ];

  useEffect(() => {
    if (hasExplicitTabParam) {
      return;
    }

    const resolveDefaultTab = async () => {
      try {
        const [completedData, budgetData] = await Promise.all([
          getRequest(
            "/sales?page=1&pageSize=1&status=COMPLETED",
          ) as Promise<SalesCountResponse>,
          getRequest(
            "/sales?page=1&pageSize=1&status=BUDGET",
          ) as Promise<SalesCountResponse>,
        ]);

        const completedTotal = Number(completedData?.total) || 0;
        const budgetTotal = Number(budgetData?.total) || 0;

        if (completedTotal === 0 && budgetTotal > 0) {
          setViewMode("budgets");
          setSearchParams(
            (current) => {
              const next = new URLSearchParams(current);
              next.set("tab", "budgets");
              return next;
            },
            { replace: true },
          );
        }
      } catch {
        // Keep the default tab when counts cannot be loaded.
      }
    };

    void resolveDefaultTab();
  }, [hasExplicitTabParam, setSearchParams]);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });

        if (effectiveStatus) {
          params.set("status", effectiveStatus);
        }

        const data = (await getRequest(
          `/sales?${params.toString()}`,
        )) as SalesResponse;
        setSales(
          Array.isArray(data.items)
            ? [...data.items].sort((left, right) => Number(right.id) - Number(left.id))
            : [],
        );
        setTotalItems(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (err: unknown) {
        setError(getUserFacingApiErrorMessage(err));
        setSales([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    void fetchSales();
  }, [effectiveStatus, page, pageSize]);

  const headingText = loading
    ? viewMode === "budgets"
      ? "Carregando orçamentos..."
      : "Carregando pedidos..."
    : `${totalItems} ${viewMode === "budgets" ? "orçamento(s)" : "pedido(s)"} encontrado(s).`;

  const changeTab = (nextTab: SalesViewMode) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);

    if (nextTab !== "budgets") {
      nextParams.delete("highlight");
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex justify-center gap-4 md:justify-between">
        <div>
          <h1 className="pb-2 pt-12 text-6xl font-semibold text-primary md:text-4xl">
            Vendas
          </h1>
          <p className="text-sm text-neutral-700">{headingText}</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Button
            variant="primary"
            size="md"
            className="px-5"
            onClick={() => navigate("/nova-venda")}
          >
            + Nova Venda/Orçamento
          </Button>
        </div>
      </div>

      <div className="mb-5 border-b border-outline-variant/35">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeTab("orders")}
            className={`px-4 py-2 text-sm uppercase tracking-[0.08em] ${
              viewMode === "orders"
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-neutral-700"
            }`}
          >
            Pedidos
          </button>
          <button
            type="button"
            onClick={() => changeTab("budgets")}
            className={`px-4 py-2 text-sm uppercase tracking-[0.08em] ${
              viewMode === "budgets"
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-neutral-700"
            }`}
          >
            Orçamentos
          </button>
        </div>
      </div>

      <div className="mb-5 flex w-full justify-end">
        <label className="flex w-full max-w-[260px] flex-col gap-2 text-sm text-neutral-700">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as SalesStatusFilter)
            }
            className="h-11 rounded border border-outline-variant bg-white px-3 text-sm text-primary outline-none transition-colors focus:border-primary"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
                {viewMode === "budgets" ? "Orçamento" : "Pedido"}
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Cliente
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Itens
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Data
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Status
              </th>
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
                  Carregando vendas...
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  {viewMode === "budgets"
                    ? "Nenhum orçamento cadastrado"
                    : "Nenhum pedido cadastrado"}
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr
                  key={sale.id}
                  className={`cursor-pointer bg-surface-lowest transition-colors hover:bg-surface ${
                    highlightedSaleId === sale.id ? "ring-2 ring-secondary" : ""
                  }`}
                  onClick={() => navigate(`/venda/${sale.id}`)}
                >
                  <td className="px-4 py-3 text-[14px] font-medium text-primary">
                    #{sale.id}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatCustomerName(sale.customerName)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {sale.itemsCount}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(sale.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${getSaleStatusBadgeClassName(
                        sale.status,
                      )}`}
                    >
                      {formatSaleStatusLabel(sale.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {formatCurrency(sale.finalAmount)}
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
            Carregando vendas...
          </div>
        ) : sales.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            {viewMode === "budgets"
              ? "Nenhum orçamento cadastrado"
              : "Nenhum pedido cadastrado"}
          </div>
        ) : (
          sales.map((sale) => (
            <button
              key={sale.id}
              type="button"
              className={`w-full px-4 py-4 text-left ${
                highlightedSaleId === sale.id ? "bg-secondary/15" : ""
              }`}
              onClick={() => navigate(`/venda/${sale.id}`)}
            >
              <p className="text-xs text-neutral-700">
                {viewMode === "budgets" ? "Orçamento" : "Pedido"} #{sale.id}
              </p>
              <p className="text-sm font-semibold text-primary">
                {formatCustomerName(sale.customerName)}
              </p>
              <p className="text-xs text-neutral-700">
                Itens: {sale.itemsCount}
              </p>
              <p className="text-xs text-neutral-700">
                Data: {formatDate(sale.createdAt)}
              </p>
              <p className="text-xs text-neutral-700">
                Status:{" "}
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getSaleStatusBadgeClassName(
                    sale.status,
                  )}`}
                >
                  {formatSaleStatusLabel(sale.status)}
                </span>
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {formatCurrency(sale.finalAmount)}
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
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={loading || page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
