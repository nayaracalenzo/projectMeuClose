import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { getCategoryBadgeClassName } from "../utils/categoryBadge";
import { formatCurrency } from "../utils/currency";

type Scope = "LOJA" | "PESSOAL";
type SettlementTarget = "BANCO" | "CAIXA";
type PayableFilter =
  | "EM_ABERTO"
  | "ATRASADAS"
  | "VENCE_HOJE"
  | "A_VENCER"
  | "PAGAS"
  | "TODAS";

interface PaymentTypeOption {
  id: number;
  name: string;
}

interface SupplierOption {
  id: number;
  name: string;
}

interface PayableRow {
  id: number;
  scope: Scope;
  description: string;
  category: string;
  beneficiary: string;
  supplierId: number | null;
  supplierName: string | null;
  amount: number;
  paidAmount: number;
  openAmount: number;
  dueDate: string;
  status: string;
  settlementTarget: SettlementTarget;
  accountLabel: string | null;
  plannedPaymentTypeId: number | null;
  plannedPaymentTypeName: string | null;
  filter: PayableFilter;
}

interface PayablesResponse {
  items: PayableRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalAmount: number;
    totalOpen: number;
  };
}

interface RegisterPaymentResponse {
  message: string;
  paymentId: number;
}

const PAGE_SIZE = 10;

const filterOptions: Array<{ value: PayableFilter; label: string }> = [
  { value: "EM_ABERTO", label: "Em Aberto" },
  { value: "ATRASADAS", label: "Atrasadas" },
  { value: "VENCE_HOJE", label: "Vence Hoje" },
  { value: "A_VENCER", label: "A Vencer" },
  { value: "PAGAS", label: "Pagas" },
  { value: "TODAS", label: "Todas" },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(value));

export default function PayablesPage() {
  const [scope, setScope] = useState<Scope>("LOJA");
  const [filter, setFilter] = useState<PayableFilter>("EM_ABERTO");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<PayableRow[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalAmount: 0, totalOpen: 0 });
  const [selectedPayableId, setSelectedPayableId] = useState<number | null>(null);
  const [activePayableId, setActivePayableId] = useState<number | null>(null);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlementTarget, setSettlementTarget] = useState<SettlementTarget>("BANCO");
  const [accountLabel, setAccountLabel] = useState("");
  const [plannedPaymentTypeId, setPlannedPaymentTypeId] = useState("");

  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceCode, setReferenceCode] = useState("");
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [scope, filter, search, startDate, endDate]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");

      const params = new URLSearchParams({
        scope,
        status: filter,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (search.trim()) params.set("search", search.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const data = (await getRequest(`/payables?${params.toString()}`)) as PayablesResponse;
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotalRows(Number(data.total) || 0);
      setTotalPages(Number(data.totalPages) || 1);
      setSummary({
        totalAmount: Number(data.summary?.totalAmount || 0),
        totalOpen: Number(data.summary?.totalOpen || 0),
      });
    } catch (error) {
      console.error("Erro ao buscar contas a pagar", error);
      setRows([]);
      setTotalRows(0);
      setTotalPages(1);
      setSummary({ totalAmount: 0, totalOpen: 0 });
      setMessage("Não foi possível carregar as contas a pagar.");
    } finally {
      setLoading(false);
    }
  }, [endDate, filter, page, scope, search, startDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (selectedPayableId && !rows.some((row) => row.id === selectedPayableId)) {
      setSelectedPayableId(null);
    }

    if (activePayableId && !rows.some((row) => row.id === activePayableId)) {
      setActivePayableId(null);
    }
  }, [activePayableId, rows, selectedPayableId]);

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

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const data = await getRequest("/admin/suppliers");
        setSuppliers(
          data
            .filter(
              (item: Record<string, unknown>) =>
                item.active !== false && item.blocked !== true,
            )
            .map((item: Record<string, unknown>) => ({
              id: Number(item.idSupplier),
              name: String(item.tradeName || item.fullName || item.idSupplier),
            })),
        );
      } catch (error) {
        console.error("Erro ao buscar fornecedores", error);
      }
    };

    fetchSuppliers();
  }, []);

  const handleCreatePayable = async () => {
    try {
      await postRequest("/payables", {
        scope,
        description,
        category,
        beneficiary,
        supplierId: supplierId ? Number(supplierId) : null,
        amount: Number(amount),
        dueDate,
        settlementTarget,
        accountLabel: accountLabel || null,
        plannedPaymentTypeId: plannedPaymentTypeId ? Number(plannedPaymentTypeId) : null,
      });

      setDescription("");
      setCategory("");
      setBeneficiary("");
      setSupplierId("");
      setAmount("");
      setAccountLabel("");
      setPlannedPaymentTypeId("");
      setIsCreateFormOpen(false);
      setMessage("Conta a pagar criada com sucesso.");
      await fetchRows();
    } catch (error: unknown) {
      setMessage(getUserFacingApiErrorMessage(error, "Não foi possível criar a conta a pagar."));
    }
  };

  const handleOpenPayment = (row: PayableRow) => {
    setActivePayableId(row.id);
    setPaymentTypeId(row.plannedPaymentTypeId ? String(row.plannedPaymentTypeId) : "");
    setPaymentAmount(String(row.openAmount.toFixed(2)));
    setPaidAt(new Date().toISOString().slice(0, 10));
    setReferenceCode("");
    setPaymentConfirmOpen(false);
  };

  const handleSelectRow = (rowId: number) => {
    setSelectedPayableId((current) => (current === rowId ? null : rowId));
  };

  const handleToggleRowSelection = (rowId: number) => {
    setSelectedPayableId((current) => (current === rowId ? null : rowId));
  };

  const handleOpenPaymentForm = () => {
    if (!selectedPayableId) return;

    const selectedRow = rows.find((row) => row.id === selectedPayableId) || null;
    if (!selectedRow || selectedRow.filter === "PAGAS" || selectedRow.openAmount <= 0) {
      return;
    }

    handleOpenPayment(selectedRow);
  };

  const handleRegisterPayment = async () => {
    if (!activePayableId) return;
    setPaymentConfirmOpen(true);
  };

  const handleConfirmRegisterPayment = async () => {
    if (!activePayableId) return;
    const normalizedPaymentAmount = Number(paymentAmount);

    try {
      const data = (await postRequest(`/payables/${activePayableId}/payments`, {
        paymentTypeId: Number(paymentTypeId),
        amount: normalizedPaymentAmount,
        paidAt,
        referenceCode: referenceCode || null,
      })) as RegisterPaymentResponse;

      setMessage(data?.message || "Pagamento registrado com sucesso.");
      setPaymentConfirmOpen(false);
      setActivePayableId(null);
      setSelectedPayableId(null);
      await fetchRows();
    } catch (error: unknown) {
      setMessage(getUserFacingApiErrorMessage(error, "Não foi possível registrar o pagamento."));
    }
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-5 pb-6 pt-12 text-6xl font-semibold text-primary md:text-4xl">
        A Pagar
      </h1>

      <div className="mb-5 border-b border-outline-variant/35">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScope("LOJA")}
            className={`px-4 py-2 text-sm uppercase tracking-[0.08em] ${
              scope === "LOJA"
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-neutral-700"
            }`}
          >
            Loja
          </button>
          <button
            type="button"
            onClick={() => setScope("PESSOAL")}
            className={`px-4 py-2 text-sm uppercase tracking-[0.08em] ${
              scope === "PESSOAL"
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-neutral-700"
            }`}
          >
            Pessoal
          </button>
        </div>
      </div>

      <div className="mb-5">
        <button
          type="button"
          onClick={() => setIsCreateFormOpen((current) => !current)}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          {isCreateFormOpen ? "Fechar novo registro" : "Novo registro"}
        </button>
      </div>

      {isCreateFormOpen && (
        <div className="mb-5 grid grid-cols-1 gap-3 border border-outline-variant/45 bg-white p-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Descrição</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Categoria</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Fornecedor</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary">
              <option value="">Selecione...</option>
              {suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Favorecido livre</label>
            <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Valor</label>
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Vencimento</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Destino previsto</label>
            <select value={settlementTarget} onChange={(e) => setSettlementTarget(e.target.value as SettlementTarget)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary">
              <option value="BANCO">Banco</option>
              <option value="CAIXA">Caixa</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Conta vinculada</label>
            <input value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Forma prevista</label>
            <select value={plannedPaymentTypeId} onChange={(e) => setPlannedPaymentTypeId(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary">
              <option value="">Selecione...</option>
              {paymentTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 md:col-span-4">
            <button type="button" onClick={handleCreatePayable} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white">
              Adicionar conta a pagar
            </button>
            <button
              type="button"
              onClick={() => setIsCreateFormOpen(false)}
              className="rounded border border-outline-variant/60 bg-white px-4 py-2 text-sm font-medium text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <label className="mb-1 block text-sm font-semibold text-primary">Visão</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as PayableFilter)} className="h-11 min-w-52 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary">
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:max-w-md">
          <label className="mb-1 block text-sm font-semibold text-primary">Buscar</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Fornecedor, categoria ou descrição"
            className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
          />
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Até</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Valor total</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(summary.totalAmount)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo em aberto</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(summary.totalOpen)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Lançamentos</p>
          <p className="text-lg font-semibold text-primary">{totalRows}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading ? "Carregando contas a pagar..." : `${totalRows} conta(s) a pagar encontrada(s).`}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenPaymentForm}
          disabled={
            !selectedPayableId ||
            !rows.some(
              (row) =>
                row.id === selectedPayableId && row.filter !== "PAGAS" && row.openAmount > 0,
            )
          }
        >
          Quitar
        </Button>
      </div>

      {message && <p className="mb-4 text-sm text-neutral-700">{message}</p>}

      {activePayableId && (
        <div className="mb-4 grid grid-cols-1 gap-3 border border-outline-variant/45 bg-white p-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Forma paga</label>
            <select value={paymentTypeId} onChange={(e) => setPaymentTypeId(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary">
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
            <input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Data</label>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Referência</label>
            <input value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div className="flex gap-2 md:col-span-4">
            <button type="button" onClick={handleRegisterPayment} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white">
              Confirmar pagamento
            </button>
            <button type="button" onClick={() => setActivePayableId(null)} className="rounded border border-outline-variant/60 bg-white px-4 py-2 text-sm font-medium text-primary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Descrição</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Fornecedor</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Categoria</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Vencimento</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Forma</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Valor</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Pago</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-surface-lowest">
                <td colSpan={9} className="px-4 py-4 text-sm text-neutral-700">Carregando...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td colSpan={9} className="px-4 py-4 text-sm text-neutral-700">Nenhuma conta a pagar encontrada.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => handleSelectRow(row.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedPayableId === row.id
                      ? "bg-surface"
                      : "bg-surface-lowest hover:bg-surface"
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPayableId === row.id}
                      onChange={() => handleToggleRowSelection(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Selecionar conta a pagar ${row.description}`}
                      className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.description}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {row.supplierName || row.beneficiary}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                        row.category,
                      )}`}
                    >
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.plannedPaymentTypeName || "-"}</td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{formatCurrency(row.paidAmount)}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">{formatCurrency(row.openAmount)}</td>
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
        open={paymentConfirmOpen && Boolean(activePayableId)}
        onClose={() => setPaymentConfirmOpen(false)}
        title="Confirmar quitação"
        subtitle="Confirme o pagamento da conta a pagar."
        size="sm"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
            <p className="text-sm text-primary">Deseja confirmar o pagamento informado?</p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleConfirmRegisterPayment}>
              Confirmar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPaymentConfirmOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </CustomerModal>
    </div>
  );
}
