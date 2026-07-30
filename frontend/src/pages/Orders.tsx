import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";
import {
  downloadWeeklyOrdersPdf,
  type PrintableOrder,
} from "../utils/ordersWeeklyPdf";

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
  measurementsSummary?: string;
}

interface StatusOption {
  id: number;
  desc: string;
}

interface ProductionResponse {
  items: ProductOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const parseDateOnly = (value?: string | null) => {
  const base = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    0,
    0,
    0,
  );
};

const formatDate = (value?: string | null) => {
  const date = parseDateOnly(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const toInputDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatCustomerName = (value?: string | null) => {
  const normalized = String(value || "").trim();
  return normalized || "Sem cliente";
};

const formatProductionType = (item: ProductOrderRow) => {
  const normalizedProductType = String(item.productType || "").trim().toLowerCase();

  if (normalizedProductType === "roupa pronta") return "Pronta";
  if (normalizedProductType === "roupa sob medida") return "Sob medida";
  if (normalizedProductType === "sob medida") return "Sob medida";
  if (normalizedProductType === "ajuste") return "Ajuste";
  if (normalizedProductType === "reforma") return "Reforma";

  return item.productType || "-";
};

const getProductionStatusBadgeClassName = (status?: string | null) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (normalized === "entregue") {
    return "bg-[#DFF4E4] text-[#17663A]";
  }

  if (normalized === "produzida") {
    return "bg-[#DDEBFF] text-[#1F4F99]";
  }

  if (normalized === "a produzir") {
    return "bg-[#F5E6A9] text-[#6D5200]";
  }

  if (normalized === "cancelada" || normalized === "atrasada") {
    return "bg-[#F8D7DA] text-[#7A1717]";
  }

  return "bg-gray-200 text-neutral-700";
};

export default function Orders() {
  const pageSize = 10;
  const navigate = useNavigate();
  const [productionItems, setProductionItems] = useState<ProductOrderRow[]>([]);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateOrder, setDateOrder] = useState("createdAtDesc");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState("");
  const [pdfEndDate, setPdfEndDate] = useState("");
  const [pdfValueMode, setPdfValueMode] = useState<
    "withoutValue" | "withValue"
  >("withoutValue");
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

    void fetchStatuses();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateOrder]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          sortBy: dateOrder,
          productionOnly: "true",
        });

        if (statusFilter !== "todos") {
          params.set("statusId", statusFilter);
        }

        const data = (await getRequest(
          `/products?${params.toString()}`,
        )) as ProductionResponse;
        setProductionItems(Array.isArray(data.items) ? data.items : []);
        setTotalItems(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
      } catch (err: unknown) {
        setError(getUserFacingApiErrorMessage(err));
        setProductionItems([]);
        setTotalItems(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    void fetchItems();
  }, [dateOrder, page, pageSize, statusFilter]);

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
    setPdfValueMode("withoutValue");
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
        productionOnly: "true",
      });

      if (statusFilter !== "todos") {
        params.set("statusId", statusFilter);
      }

      const firstPage = (await getRequest(
        `/products?${params.toString()}`,
      )) as ProductionResponse;
      let weeklyItems = Array.isArray(firstPage.items)
        ? [...firstPage.items]
        : [];
      const totalWeeklyPages = Number(firstPage.totalPages) || 1;

      for (
        let currentPage = 2;
        currentPage <= totalWeeklyPages;
        currentPage += 1
      ) {
        params.set("page", String(currentPage));
        const nextPage = (await getRequest(
          `/products?${params.toString()}`,
        )) as ProductionResponse;
        if (Array.isArray(nextPage.items)) {
          weeklyItems = [...weeklyItems, ...nextPage.items];
        }
      }

      if (!weeklyItems.length) {
        setError(
          "Nenhum item de produção foi encontrado no período informado para gerar o PDF.",
        );
        return;
      }

      const printableOrders: PrintableOrder[] = weeklyItems.map((item) => ({
        id: item.id,
        customer: item.customer,
        kind:
          item.clothingType || item.productType || item.category || "Produção",
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
            seamstress: item.seamstress || "-",
            notes: item.details || undefined,
            measurements: item.measurementsSummary || undefined,
          },
        ],
      }));

      const [startYear, startMonth, startDay] = pdfStartDate
        .split("-")
        .map(Number);
      const [endYear, endMonth, endDay] = pdfEndDate.split("-").map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const endDate = new Date(endYear, endMonth - 1, endDay);
      const weekLabel = `${new Intl.DateTimeFormat("pt-BR").format(startDate)} a ${new Intl.DateTimeFormat(
        "pt-BR",
      ).format(endDate)}`;

      await downloadWeeklyOrdersPdf({
        orders: printableOrders,
        weekLabel,
        logoUrl: "/manequim.png",
        includeValues: pdfValueMode === "withValue",
      });
      setPdfModalOpen(false);
    } catch (err: unknown) {
      setError(
        getUserFacingApiErrorMessage(
          err,
          "Não foi possível gerar o PDF do período.",
        ),
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const headingText = loading
    ? "Carregando produção..."
    : `${totalItems} item(ns) de produção encontrado(s).`;

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0 text-left">
          <h1 className="pb-1 pt-8 font-editorial text-[2rem] font-extralight leading-[0.98] tracking-tight text-primary md:text-[2.35rem] md:leading-tight">
            Produção
          </h1>
          <p className="text-sm text-neutral-700">{headingText}</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Button
            variant="primary"
            size="md"
            className="px-5"
            onClick={handleOpenPdfModal}
            disabled={loading || pdfLoading}
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
          disabled={loading || pdfLoading}
        >
          <span className="flex items-center justify-center gap-2">
            <Printer size={16} />
            {pdfLoading ? "Gerando PDF..." : "Gerar PDF"}
          </span>
        </Button>
      </div>

      <div className="mb-4 grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="orders-status-filter"
            className="text-sm font-medium text-primary"
          >
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
          <label
            htmlFor="orders-date-order"
            className="text-sm font-medium text-primary"
          >
            Ordenar por data
          </label>
          <select
            id="orders-date-order"
            value={dateOrder}
            onChange={(event) => setDateOrder(event.target.value)}
            className="rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary"
          >
            <option value="createdAtDesc">Pedidos mais recentes</option>
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

      <CustomerModal
        open={pdfModalOpen}
        onClose={() => {
          if (!pdfLoading) {
            setPdfModalOpen(false);
          }
        }}
        title="Gerar PDF de produção"
        subtitle="Selecione o intervalo da data de prova para montar o relatório."
      >
        <div className="my-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-primary">
            Exibir valores no PDF
          </span>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name="pdf-value-mode"
                value="withoutValue"
                checked={pdfValueMode === "withoutValue"}
                onChange={() => setPdfValueMode("withoutValue")}
                className="h-4 w-4  border-outline-variant/45 text-primary focus:ring-primary"
              />
              Sem valor
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name="pdf-value-mode"
                value="withValue"
                checked={pdfValueMode === "withValue"}
                onChange={() => setPdfValueMode("withValue")}
                className="h-4 w-4 border-outline-variant/45 text-primary focus:ring-primary"
              />
              Com valor
            </label>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="pdf-start-date"
              className="text-sm font-medium text-primary"
            >
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
            <label
              htmlFor="pdf-end-date"
              className="text-sm font-medium text-primary"
            >
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

      <div className="hidden w-full overflow-x-auto md:block">
        <table className="mt-2 min-w-[1180px] border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="w-[280px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Descrição
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Tipo
              </th>
              <th className="w-[260px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Cliente
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Data Prova
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Costureira
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Status
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Carregando produção...
                </td>
              </tr>
            ) : productionItems.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum item em produção cadastrado
                </td>
              </tr>
            ) : (
              productionItems.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer bg-surface-lowest transition-colors hover:bg-surface"
                  onClick={() => navigate(`/pedido/${order.id}`)}
                >
                  <td className="px-4 py-3 text-[14px] uppercase text-neutral-700">
                    <div
                      className="max-w-[280px] truncate whitespace-nowrap"
                      title={order.description || "-"}
                    >
                      {order.description || "-"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] font-semibold uppercase text-neutral-700">
                    {formatProductionType(order)}
                  </td>
                  <td className="px-4 py-3 text-[14px] uppercase text-neutral-700">
                    <div
                      className="max-w-[260px] truncate whitespace-nowrap"
                      title={formatCustomerName(order.customer)}
                    >
                      {formatCustomerName(order.customer)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(order.testDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] uppercase text-neutral-700">
                    {order.seamstress || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${getProductionStatusBadgeClassName(
                        order.status,
                      )}`}
                    >
                      {order.status || "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[14px] font-semibold text-primary">
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
            Carregando produção...
          </div>
        ) : productionItems.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum item em produção cadastrado
          </div>
        ) : (
          productionItems.map((order) => (
            <button
              key={order.id}
              type="button"
              className="w-full px-4 py-4 text-left"
              onClick={() => navigate(`/pedido/${order.id}`)}
            >
              <p className="text-xs uppercase text-neutral-700">
                Descrição: {order.description || "-"}
              </p>
              <p className="text-sm font-semibold uppercase text-primary">
                {formatCustomerName(order.customer)}
              </p>
              <p className="text-xs font-semibold uppercase text-neutral-700">
                Tipo produção: {formatProductionType(order)}
              </p>
              <p className="text-xs text-neutral-700">
                Data Prova: {formatDate(order.testDate)}
              </p>
              <p className="text-xs uppercase text-neutral-700">
                Costureira: {order.seamstress || "-"}
              </p>
              <p className="text-xs text-neutral-700">
                Status:{" "}
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getProductionStatusBadgeClassName(
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
