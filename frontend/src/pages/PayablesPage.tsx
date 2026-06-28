import { useCallback, useEffect, useMemo, useState } from "react";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
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

interface PayableRow {
  id: number;
  scope: Scope;
  description: string;
  category: string;
  beneficiary: string;
  amount: number;
  openAmount: number;
  dueDate: string;
  status: string;
  settlementTarget: SettlementTarget;
  accountLabel: string | null;
  plannedPaymentTypeId: number | null;
  plannedPaymentTypeName: string | null;
}

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

const parseLocalDate = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

export default function PayablesPage() {
  const [scope, setScope] = useState<Scope>("LOJA");
  const [filter, setFilter] = useState<PayableFilter>("EM_ABERTO");
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<PayableRow[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePayableId, setActivePayableId] = useState<number | null>(null);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlementTarget, setSettlementTarget] = useState<SettlementTarget>("BANCO");
  const [accountLabel, setAccountLabel] = useState("");
  const [plannedPaymentTypeId, setPlannedPaymentTypeId] = useState("");

  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceCode, setReferenceCode] = useState("");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setMessage("");
      const data = await getRequest(`/payables?scope=${scope}&status=${filter}`);
      setRows(data);
    } catch (error) {
      console.error("Erro ao buscar contas a pagar", error);
      setMessage("Não foi possível carregar as contas a pagar.");
    } finally {
      setLoading(false);
    }
  }, [filter, scope]);

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
    return rows.filter((row) => {
      const rowDate = parseLocalDate(row.dueDate);
      const matchesStartDate = !startDate || rowDate >= parseLocalDate(startDate);
      const matchesEndDate = !endDate || rowDate <= parseLocalDate(endDate, true);

      return matchesStartDate && matchesEndDate;
    });
  }, [endDate, rows, startDate]);

  const totalOpen = useMemo(
    () => filteredRows.reduce((acc, row) => acc + row.openAmount, 0),
    [filteredRows],
  );
  const totalAmount = useMemo(
    () => filteredRows.reduce((acc, row) => acc + row.amount, 0),
    [filteredRows],
  );

  const handleCreatePayable = async () => {
    try {
      await postRequest("/payables", {
        scope,
        description,
        category,
        beneficiary,
        amount: Number(amount),
        dueDate,
        settlementTarget,
        accountLabel: accountLabel || null,
        plannedPaymentTypeId: plannedPaymentTypeId ? Number(plannedPaymentTypeId) : null,
      });

      setDescription("");
      setCategory("");
      setBeneficiary("");
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
  };

  const handleRegisterPayment = async () => {
    if (!activePayableId) return;

    try {
      await postRequest(`/payables/${activePayableId}/payments`, {
        paymentTypeId: Number(paymentTypeId),
        amount: Number(paymentAmount),
        paidAt,
        referenceCode: referenceCode || null,
      });

      setMessage("Pagamento registrado com sucesso.");
      setActivePayableId(null);
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
            <label className="mb-1 block text-sm font-semibold text-primary">Descricao</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Categoria</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">Favorecido</label>
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
          <label className="mb-1 block text-sm font-semibold text-primary">Visao</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as PayableFilter)} className="h-11 min-w-52 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary">
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
            <label className="mb-1 block text-sm font-semibold text-primary">Ate</label>
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
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo em aberto</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalOpen)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Lancamentos</p>
          <p className="text-lg font-semibold text-primary">{filteredRows.length}</p>
        </div>
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
            <label className="mb-1 block text-sm font-semibold text-primary">Referencia</label>
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
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Descricao</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Favorecido</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Categoria</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Vencimento</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Forma</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Valor</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Saldo</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Acao</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-surface-lowest">
                <td colSpan={8} className="px-4 py-4 text-sm text-neutral-700">Carregando...</td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td colSpan={8} className="px-4 py-4 text-sm text-neutral-700">Nenhuma conta a pagar encontrada.</td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className="bg-surface-lowest">
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.description}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.beneficiary}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.category}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.plannedPaymentTypeName || "-"}</td>
                  <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">{formatCurrency(row.openAmount)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.openAmount > 0 ? (
                      <button type="button" onClick={() => handleOpenPayment(row)} className="rounded border border-outline-variant/60 bg-white px-3 py-1 text-xs font-medium text-primary">
                        Pagar
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
