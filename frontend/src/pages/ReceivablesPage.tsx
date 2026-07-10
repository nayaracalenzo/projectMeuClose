import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
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
  customerId: number | null;
  supplierId: number | null;
  debtorType: string;
  operatorLabel: string | null;
  customerName: string;
  supplierName: string | null;
  originType: "CUSTOMER" | "SUPPLIER" | "CARD_OPERATOR";
  originName: string;
  saleId: number | null;
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

interface ReceivablesResponse {
  items: ReceivableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalOpen: number;
    totalReceived: number;
  };
}

const PAGE_SIZE = 10;
const MONTHLY_INTEREST_RATE = 0.06;

const filterOptions: Array<{ value: ReceivableFilter; label: string }> = [
  { value: "A_RECEBER", label: "A Receber" },
  { value: "ATRASADAS", label: "Atrasadas" },
  { value: "VENCE_HOJE", label: "Vence Hoje" },
  { value: "A_VENCER", label: "A Vencer" },
  { value: "RECEBIDAS", label: "Recebidas" },
  { value: "TODAS", label: "Todas" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const getReceivableOriginName = (row: ReceivableRow) =>
  row.originName || row.supplierName || row.operatorLabel || row.customerName;

const renderStatus = (row: ReceivableRow) => {
  if (row.filter === "RECEBIDAS") return "Recebida";
  if (row.filter === "VENCE_HOJE") return "Vence hoje";
  if (row.filter === "A_VENCER") return "A vencer";
  if (row.filter === "ATRASADAS") return "Atrasada";
  return "A receber";
};

const getHistoryLabel = (row: ReceivableRow) => {
  if (row.saleId) {
    return `VENDA ${row.saleId} - SALDO`;
  }

  return `PARCELA ${row.parcela} - SALDO`;
};

const calculateOverdueDays = (dueDate: string, paymentDate: string) => {
  const due = new Date(dueDate);
  const paid = new Date(paymentDate);
  due.setHours(0, 0, 0, 0);
  paid.setHours(0, 0, 0, 0);

  const diff = paid.getTime() - due.getTime();
  if (diff <= 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export default function ReceivablesPage() {
  const [filter, setFilter] = useState<ReceivableFilter>("A_RECEBER");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalOpen: 0, totalReceived: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [quitModalOpen, setQuitModalOpen] = useState(false);
  const [receiptPaymentTypeId, setReceiptPaymentTypeId] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptPaidAt, setReceiptPaidAt] = useState(() => toIsoDate(new Date()));
  const [receiptReferenceCode, setReceiptReferenceCode] = useState("");

  useEffect(() => {
    setPage(1);
  }, [filter, search, startDate, endDate]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const params = new URLSearchParams({
        status: filter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (search.trim()) params.set("search", search.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const data = (await getRequest(
        `/receivables?${params.toString()}`,
      )) as ReceivablesResponse;

      setRows(Array.isArray(data.items) ? data.items : []);
      setTotalRows(Number(data.total) || 0);
      setTotalPages(Number(data.totalPages) || 1);
      setSummary({
        totalOpen: Number(data.summary?.totalOpen || 0),
        totalReceived: Number(data.summary?.totalReceived || 0),
      });
    } catch (error) {
      console.error("Erro ao buscar contas a receber", error);
      setRows([]);
      setTotalRows(0);
      setTotalPages(1);
      setSummary({ totalOpen: 0, totalReceived: 0 });
      setMessage("Não foi possível carregar os recebimentos.");
    } finally {
      setLoading(false);
    }
  }, [endDate, filter, page, search, startDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const data = (await getRequest("/payment-types")) as PaymentTypeOption[];
        setPaymentTypes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar formas de pagamento", error);
      }
    };

    fetchPaymentTypes();
  }, []);

  useEffect(() => {
    if (selectedRowId && !rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(null);
      setQuitModalOpen(false);
    }
  }, [rows, selectedRowId]);

  const selectedRow = rows.find((row) => row.id === selectedRowId) || null;

  const overdueDays = useMemo(() => {
    if (!selectedRow) return 0;
    return calculateOverdueDays(selectedRow.dueDate, receiptPaidAt);
  }, [receiptPaidAt, selectedRow]);

  const currentInterest = useMemo(() => {
    if (!selectedRow || overdueDays <= 0) return 0;
    const dailyRate = MONTHLY_INTEREST_RATE / 30;
    return Number((selectedRow.openAmount * dailyRate * overdueDays).toFixed(2));
  }, [overdueDays, selectedRow]);

  const totalSettlementAmount = useMemo(() => {
    const baseAmount = Number(receiptAmount || 0);
    return Number((baseAmount + currentInterest).toFixed(2));
  }, [currentInterest, receiptAmount]);

  const handleSelectRow = (rowId: number) => {
    setSelectedRowId((current) => (current === rowId ? null : rowId));
  };

  const handleOpenQuitModal = () => {
    if (!selectedRow) return;

    setReceiptPaymentTypeId(selectedRow.paymentTypeId ? String(selectedRow.paymentTypeId) : "");
    setReceiptAmount(String(selectedRow.openAmount.toFixed(2)));
    setReceiptPaidAt(toIsoDate(new Date()));
    setReceiptReferenceCode("");
    setQuitModalOpen(true);
  };

  const handleRegisterReceipt = async () => {
    if (!selectedRow) return;

    if (!receiptPaymentTypeId) {
      setMessage("Selecione a forma de pagamento para quitar o recebimento.");
      return;
    }

    if (!receiptPaidAt) {
      setMessage("Informe a data do pagamento.");
      return;
    }

    if (Number(receiptAmount) <= 0) {
      setMessage("Informe um valor base maior que zero.");
      return;
    }

    try {
      await postRequest(`/receivables/${selectedRow.id}/receipts`, {
        paymentTypeId: Number(receiptPaymentTypeId),
        amount: totalSettlementAmount,
        paidAt: receiptPaidAt,
        referenceCode: receiptReferenceCode || null,
      });

      setMessage("Recebimento quitado com sucesso.");
      setQuitModalOpen(false);
      setSelectedRowId(null);
      await fetchRows();
    } catch (error: unknown) {
      setMessage(
        getUserFacingApiErrorMessage(error, "Não foi possível quitar o recebimento."),
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
          <label className="text-sm font-semibold text-primary">Visão</label>
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
            placeholder="Origem, parcela ou forma de pagamento"
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
            <label className="mb-2 block text-sm font-semibold text-primary">Até</label>
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
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summary.totalOpen)}
          </p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Recebido</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summary.totalReceived)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading ? "Carregando recebimentos..." : `${totalRows} recebimento(s) encontrado(s).`}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenQuitModal}
          disabled={!selectedRow || selectedRow.openAmount <= 0}
        >
          Quitar
        </Button>
      </div>

      {message ? <p className="mb-4 text-sm text-neutral-700">{message}</p> : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Origem</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Parcela</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Vencimento
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Forma</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">
                Valor
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">
                Recebido
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-surface-lowest">
                <td colSpan={8} className="px-4 py-4 text-sm text-neutral-700">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td colSpan={8} className="px-4 py-4 text-sm text-neutral-700">
                  Nenhum recebimento encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => handleSelectRow(row.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedRowId === row.id
                      ? "bg-surface"
                      : "bg-surface-lowest hover:bg-surface"
                  }`}
                >
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {getReceivableOriginName(row)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.parcela}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{renderStatus(row)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {row.paymentTypeName || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">
                    {formatCurrency(row.paidAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {formatCurrency(row.openAmount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

      <CustomerModal
        open={quitModalOpen && Boolean(selectedRow)}
        onClose={() => setQuitModalOpen(false)}
        title="Quitação de Conta a Receber"
        subtitle="Confira os dados da conta e informe os dados do pagamento."
      >
        {selectedRow ? (
          <div className="space-y-6">
            <section className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                Dados
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Data emissão
                  </label>
                  <input
                    value={formatDate(selectedRow.dueDate)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">Conta</label>
                  <input
                    value="RECEITAS DE VENDAS"
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Tipo doc.
                  </label>
                  <input
                    value={selectedRow.paymentTypeName || "-"}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">Nr. doc.</label>
                  <input
                    value={selectedRow.parcela}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">Cliente</label>
                  <input
                    value={getReceivableOriginName(selectedRow)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Histórico
                  </label>
                  <input
                    value={getHistoryLabel(selectedRow)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Data venc.
                  </label>
                  <input
                    value={formatDate(selectedRow.dueDate)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">Valor</label>
                  <input
                    value={formatCurrency(selectedRow.openAmount)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                Dados do pagamento
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Data pgto
                  </label>
                  <input
                    type="date"
                    value={receiptPaidAt}
                    onChange={(e) => setReceiptPaidAt(e.target.value)}
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-[#9F1D1D]">
                    Dias de atraso: <span className="font-semibold">{overdueDays}</span>
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Juros atual
                  </label>
                  <input
                    value={formatCurrency(currentInterest)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-[#1E4FA3]">
                    Taxa mensal: <span className="font-semibold">6,00%</span>
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Valor base
                  </label>
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
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Valor pago
                  </label>
                  <input
                    value={formatCurrency(totalSettlementAmount)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] font-semibold text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Portador
                  </label>
                  <input
                    value={getReceivableOriginName(selectedRow)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Forma de pgto
                  </label>
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
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Referência
                  </label>
                  <input
                    value={receiptReferenceCode}
                    onChange={(e) => setReceiptReferenceCode(e.target.value)}
                    placeholder="Opcional"
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
              </div>
            </section>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleRegisterReceipt}
                disabled={!receiptPaymentTypeId || totalSettlementAmount <= 0}
              >
                Gravar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setQuitModalOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </CustomerModal>
    </div>
  );
}
