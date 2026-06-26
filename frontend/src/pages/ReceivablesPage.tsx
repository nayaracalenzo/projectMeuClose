import { useCallback, useEffect, useMemo, useState } from "react";
import { getRequest, postRequest } from "../services/request";
import { formatCurrency } from "../utils/currency";

type ReceivableFilter =
  | "A_RECEBER"
  | "ATRASADAS"
  | "VENCE_HOJE"
  | "A_VENCER"
  | "RECEBIDAS"
  | "TODAS";

interface ReceivableRow {
  id: number;
  customerName: string;
  parcela: string;
  dueDate: string;
  status: string;
  filter: ReceivableFilter;
  paymentTypeId: number | null;
  paymentTypeName: string | null;
  amount: number;
  paidAmount: number;
  openAmount: number;
}

interface PaymentTypeOption {
  id: number;
  name: string;
}

const filterOptions: Array<{ value: ReceivableFilter; label: string }> = [
  { value: "A_RECEBER", label: "A Receber" },
  { value: "ATRASADAS", label: "Atrasadas" },
  { value: "VENCE_HOJE", label: "Vence Hoje" },
  { value: "A_VENCER", label: "A Vencer" },
  { value: "RECEBIDAS", label: "Recebidas" },
  { value: "TODAS", label: "Todas" },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(value));

const parseLocalDate = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

const renderStatus = (row: ReceivableRow) => {
  if (row.filter === "RECEBIDAS") return "Recebida";
  if (row.filter === "VENCE_HOJE") return "Vence hoje";
  if (row.filter === "A_VENCER") return "A vencer";
  if (row.filter === "ATRASADAS") return "Atrasada";
  return "A receber";
};

export default function ReceivablesPage() {
  const [filter, setFilter] = useState<ReceivableFilter>("A_RECEBER");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeReceiptId, setActiveReceiptId] = useState<number | null>(null);
  const [receiptPaymentTypeId, setReceiptPaymentTypeId] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptPaidAt, setReceiptPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptReferenceCode, setReceiptReferenceCode] = useState("");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const data = await getRequest(`/receivables?status=${filter}`);
      setRows(data);
    } catch (error) {
      console.error("Erro ao buscar contas a receber", error);
      setMessage("Não foi possível carregar os recebimentos.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const data = await getRequest("/payment-types");
        setPaymentTypes(data);
      } catch (error) {
        console.error("Erro ao buscar formas de pagamento", error);
      }
    };

    fetchPaymentTypes();
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const rowDate = parseLocalDate(row.dueDate);
      const matchesStartDate = !startDate || rowDate >= parseLocalDate(startDate);
      const matchesEndDate = !endDate || rowDate <= parseLocalDate(endDate, true);

      if (!matchesStartDate || !matchesEndDate) {
        return false;
      }

      if (!term) return true;

      return (
        row.customerName.toLowerCase().includes(term) ||
        row.parcela.toLowerCase().includes(term) ||
        String(row.paymentTypeName || "").toLowerCase().includes(term)
      );
    });
  }, [endDate, rows, search, startDate]);

  const totalOpen = filteredRows.reduce((acc, row) => acc + row.openAmount, 0);
  const totalReceived = filteredRows.reduce((acc, row) => acc + row.paidAmount, 0);
  const activeRow = filteredRows.find((row) => row.id === activeReceiptId) || null;

  const handleOpenReceipt = (row: ReceivableRow) => {
    setActiveReceiptId(row.id);
    setReceiptPaymentTypeId(row.paymentTypeId ? String(row.paymentTypeId) : "");
    setReceiptAmount(String(row.openAmount.toFixed(2)));
    setReceiptPaidAt(new Date().toISOString().slice(0, 10));
    setReceiptReferenceCode("");
  };

  const handleRegisterReceipt = async () => {
    if (!activeRow) return;

    try {
      await postRequest(`/receivables/${activeRow.id}/receipts`, {
        paymentTypeId: Number(receiptPaymentTypeId),
        amount: Number(receiptAmount),
        paidAt: receiptPaidAt,
        referenceCode: receiptReferenceCode || null,
      });

      setMessage("Recebimento registrado com sucesso.");
      setActiveReceiptId(null);
      await fetchRows();
    } catch (error: unknown) {
      const maybeAxiosError = error as {
        response?: { data?: { message?: string } };
      };
      setMessage(
        maybeAxiosError.response?.data?.message ||
          "Não foi possível registrar o recebimento.",
      );
    }
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-5 pb-6 pt-12 text-6xl font-semibold text-primary md:text-4xl">
        A Receber
      </h1>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-primary">Visao</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ReceivableFilter)}
            className="h-11 min-w-52 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:max-w-md">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Buscar recebimento
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente, parcela ou forma de pagamento"
            className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Ate</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo em aberto</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalOpen)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Recebido</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalReceived)}</p>
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-neutral-700">{message}</p>}

      {activeRow && (
        <div className="mb-4 grid grid-cols-1 gap-3 border border-outline-variant/45 bg-white p-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Forma recebida</label>
            <select
              value={receiptPaymentTypeId}
              onChange={(e) => setReceiptPaymentTypeId(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            >
              <option value="">Selecione...</option>
              {paymentTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Valor</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={receiptAmount}
              onChange={(e) => setReceiptAmount(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Data</label>
            <input
              type="date"
              value={receiptPaidAt}
              onChange={(e) => setReceiptPaidAt(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Referencia</label>
            <input
              value={receiptReferenceCode}
              onChange={(e) => setReceiptReferenceCode(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div className="flex gap-2 md:col-span-4">
            <button
              type="button"
              onClick={handleRegisterReceipt}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Confirmar recebimento
            </button>
            <button
              type="button"
              onClick={() => setActiveReceiptId(null)}
              className="rounded border border-outline-variant/60 bg-white px-4 py-2 text-sm font-medium text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Cliente</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Parcela</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Vencimento</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Forma</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Valor</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Recebido</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Saldo</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Acao</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-surface-lowest">
                <td colSpan={9} className="px-4 py-4 text-sm text-neutral-700">Carregando...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td colSpan={9} className="px-4 py-4 text-sm text-neutral-700">Nenhum recebimento encontrado.</td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="bg-surface-lowest">
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.customerName}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.parcela}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{renderStatus(row)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.paymentTypeName || "-"}</td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{formatCurrency(row.paidAmount)}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">{formatCurrency(row.openAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.openAmount > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenReceipt(row)}
                        className="rounded border border-outline-variant/60 bg-white px-3 py-1 text-xs font-medium text-primary"
                      >
                        Receber
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-500">Baixado</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
