import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";
import { downloadWeeklyOrdersPdf, type PrintableOrder } from "../utils/ordersWeeklyPdf";

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
  qtyStock: number;
  fabric: string | null;
  color: string | null;
  size: string | null;
  details: string;
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

interface BudgetRow {
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

interface BudgetsResponse {
  items: BudgetRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type OrdersViewMode = "orders" | "budgets";

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const toInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "BUDGET") return "Orçamento";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "CANCELLED") return "Cancelado";

  return value || "-";
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
  const [viewMode, setViewMode] = useState<OrdersViewMode>("orders");
  const [orders, setOrders] = useState<ProductOrderRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateOrder, setDateOrder] = useState("createdAtDesc");
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState("");
  const [pdfEndDate, setPdfEndDate] = useState("");
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
  }, [statusFilter, dateOrder, viewMode]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError("");

        if (viewMode === "budgets") {
          const params = new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
            status: "BUDGET",
          });

          const data = (await getRequest(`/sales?${params.toString()}`)) as BudgetsResponse;
          setBudgets(Array.isArray(data.items) ? data.items : []);
          setOrders([]);
          setTotalOrders(Number(data.total) || 0);
          setTotalPages(Number(data.totalPages) || 1);
          return;
        }

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
        setBudgets([]);
        setTotalOrders(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (err: unknown) {
        setError(getUserFacingApiErrorMessage(err));
        setOrders([]);
        setBudgets([]);
        setTotalOrders(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [dateOrder, page, pageSize, statusFilter, viewMode]);

  const handleOpenPdfModal = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    setPdfStartDate(toInputDate(startOfWeek));
    setPdfEndDate(toInputDate(endOfWeek));
    setPdfModalOpen(true);
  };

  const handleDownloadWeeklyPdf = async () => {
    try {
      if (!pdfStartDate || !pdfEndDate) {
        setError("Informe a data inicial e a data final para gerar o PDF.");
        return;
      }

      if (pdfStartDate > pdfEndDate) {
        setError("A data inicial não pode ser maior que a data final.");
        return;
      }

      setPdfLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        sortBy: "testDateAsc",
        startDate: pdfStartDate,
        endDate: pdfEndDate,
      });

      if (statusFilter !== "todos") {
        params.set("statusId", statusFilter);
      }

      const firstPage = (await getRequest(`/products?${params.toString()}`)) as OrdersResponse;
      let weeklyItems = Array.isArray(firstPage.items) ? [...firstPage.items] : [];
      const totalWeeklyPages = Number(firstPage.totalPages) || 1;

      for (let currentPage = 2; currentPage <= totalWeeklyPages; currentPage += 1) {
        params.set("page", String(currentPage));
        const nextPage = (await getRequest(`/products?${params.toString()}`)) as OrdersResponse;
        if (Array.isArray(nextPage.items)) {
          weeklyItems = [...weeklyItems, ...nextPage.items];
        }
      }

      if (!weeklyItems.length) {
        setError("Nenhum pedido foi encontrado no período informado para gerar o PDF.");
        return;
      }

      const printableOrders: PrintableOrder[] = weeklyItems.map((item) => ({
        id: item.id,
        customer: item.customer,
        kind: item.clothingType || item.productType || item.category || "Pedido",
        date: item.testDate || item.createdAt,
        status: item.status || "-",
        total: item.finalValue,
        items: [
          {
            name: item.description,
            quantity: item.qtyStock || 1,
            fabric: item.fabric || "-",
            color: item.color || "-",
            size: item.size || "-",
            notes: item.details || undefined,
          },
        ],
      }));

      const [startYear, startMonth, startDay] = pdfStartDate.split("-").map(Number);
      const [endYear, endMonth, endDay] = pdfEndDate.split("-").map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      const weekLabel = `${new Intl.DateTimeFormat("pt-BR").format(startDate)} a ${new Intl.DateTimeFormat(
        "pt-BR",
      ).format(endDate)}`;

      await downloadWeeklyOrdersPdf({
        orders: printableOrders,
        weekLabel,
      });
      setPdfModalOpen(false);
    } catch (err: unknown) {
      setError(getUserFacingApiErrorMessage(err, "Não foi possível gerar o PDF do período."));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex justify-center gap-4 md:justify-between">
        <div>
          <h1 className="pb-2 pt-12 text-6xl font-semibold text-primary md:text-4xl">
            Pedidos
          </h1>
          <p className="text-sm text-neutral-700">
            {loading
              ? viewMode === "budgets"
                ? "Carregando orçamentos..."
                : "Carregando pedidos..."
              : `${totalOrders} ${viewMode === "budgets" ? "orçamento(s)" : "pedido(s)"} encontrado(s).`}
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
          <Button
            variant="secondary"
            size="md"
            className="px-5"
            onClick={handleOpenPdfModal}
            disabled={viewMode !== "orders" || loading || pdfLoading}
          >
            <span className="flex items-center gap-2">
              <Printer size={16} />
              {pdfLoading ? "Gerando PDF..." : "Gerar PDF"}
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex md:hidden">
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={handleOpenPdfModal}
          disabled={viewMode !== "orders" || loading || pdfLoading}
        >
          <span className="flex items-center justify-center gap-2">
            <Printer size={16} />
            {pdfLoading ? "Gerando PDF..." : "Gerar PDF"}
          </span>
        </Button>
      </div>

      <div className="mb-5 border-b border-outline-variant/35">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("orders")}
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
            onClick={() => setViewMode("budgets")}
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

      {viewMode === "orders" ? (
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
      ) : null}

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <CustomerModal
        open={pdfModalOpen}
        onClose={() => {
          if (!pdfLoading) {
            setPdfModalOpen(false);
          }
        }}
        title="Gerar PDF de pedidos"
        subtitle="Selecione o intervalo da data de prova para montar o relatório."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="pdf-start-date" className="text-sm font-medium text-primary">
              Data de prova inicial
            </label>
            <input
              id="pdf-start-date"
              type="date"
              value={pdfStartDate}
              onChange={(event) => setPdfStartDate(event.target.value)}
              className="rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="pdf-end-date" className="text-sm font-medium text-primary">
              Data de prova final
            </label>
            <input
              id="pdf-end-date"
              type="date"
              value={pdfEndDate}
              onChange={(event) => setPdfEndDate(event.target.value)}
              className="rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setPdfModalOpen(false)}
            disabled={pdfLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleDownloadWeeklyPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? "Gerando PDF..." : "Gerar PDF"}
          </Button>
        </div>
      </CustomerModal>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            {viewMode === "orders" ? (
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
            ) : (
              <tr className="text-left">
                <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                  Orçamento
                </th>
                <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Cliente</th>
                <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                  Descrição
                </th>
                <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Itens</th>
                <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
                <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary text-right">
                  Valor
                </th>
              </tr>
            )}
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
            ) : viewMode === "orders" && orders.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum pedido cadastrado
                </td>
              </tr>
            ) : viewMode === "orders" ? (
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
            ) : budgets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum orçamento cadastrado
                </td>
              </tr>
            ) : (
              budgets.map((budget) => (
                <tr
                  key={budget.id}
                  className="cursor-pointer bg-surface-lowest transition-colors hover:bg-surface"
                  onClick={() => navigate(`/venda/${budget.id}`)}
                >
                  <td className="px-4 py-3 text-[14px] font-medium text-primary">
                    #{budget.id}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatCustomerName(budget.customerName)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {budget.firstItemDescription || "-"}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {budget.itemsCount}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatSaleStatusLabel(budget.status)}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {formatCurrency(budget.finalAmount)}
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
        ) : viewMode === "orders" && orders.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum pedido cadastrado
          </div>
        ) : viewMode === "orders" ? (
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
        ) : budgets.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum orçamento cadastrado
          </div>
        ) : (
          budgets.map((budget) => (
            <button
              key={budget.id}
              type="button"
              className="w-full px-4 py-4 text-left"
              onClick={() => navigate(`/venda/${budget.id}`)}
            >
              <p className="text-xs text-neutral-700">Orçamento #{budget.id}</p>
              <p className="text-sm font-semibold text-primary">
                {formatCustomerName(budget.customerName)}
              </p>
              <p className="text-xs text-neutral-700">
                Descrição: {budget.firstItemDescription || "-"}
              </p>
              <p className="text-xs text-neutral-700">Itens: {budget.itemsCount}</p>
              <p className="text-xs text-neutral-700">
                Status: {formatSaleStatusLabel(budget.status)}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {formatCurrency(budget.finalAmount)}
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
