import { useEffect, useMemo, useState } from "react";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { getCategoryBadgeClassName } from "../utils/categoryBadge";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyToNumber,
} from "../utils/currency";
import {
  formatLegacyShortDateInput,
  maskLegacyShortDateInput,
} from "../utils/legacyDate";

interface BankRow {
  id: number;
  date: string;
  scope: "LOJA" | "PESSOAL";
  bank: string;
  accountLabel?: string | null;
  parcela?: string;
  category: string;
  financialCategoryId: number | null;
  description: string;
  paymentTypeName?: string | null;
  amountIn: number;
  amountOut: number;
  balance: number;
  sourceType: string;
  hasReversal?: boolean;
  canReverse: boolean;
}

interface BankListResponse {
  items: BankRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalIn: number;
    totalOut: number;
    balance: number;
  };
}

interface CashSessionSummary {
  id: number;
  openedAt: string;
  expectedBalance: number;
  notes: string | null;
  pendingPreviousDay: boolean;
}

interface CashSessionStatusResponse {
  currentSession: CashSessionSummary | null;
  lastClosedSession?: CashSessionSummary | null;
  hasOpenSession: boolean;
  pendingPreviousDay: boolean;
}

interface FinancialCategoryOption {
  id: number;
  description: string;
}

interface BankAccountOption {
  label: string;
  value: string;
}

type ToastState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

const EMPTY_TOAST: ToastState = {
  open: false,
  tone: "success",
  message: "",
};

const PAGE_SIZE = 10;

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentDateInputValue = () => formatDateInputValue(new Date());
const getCurrentSearchDateInputValue = () =>
  formatLegacyShortDateInput(getCurrentDateInputValue());

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

export default function BankPage() {
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState(getCurrentSearchDateInputValue());
  const [endDate, setEndDate] = useState(getCurrentSearchDateInputValue());
  const [rows, setRows] = useState<BankRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    totalIn: 0,
    totalOut: 0,
    balance: 0,
  });
  const [overallBankBalance, setOverallBankBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [financialCategories, setFinancialCategories] = useState<
    FinancialCategoryOption[]
  >([]);
  const [bankAccountOptions, setBankAccountOptions] = useState<
    BankAccountOption[]
  >([]);
  const [cashSessionStatus, setCashSessionStatus] =
    useState<CashSessionStatusResponse | null>(null);
  const [manualEntryModalOpen, setManualEntryModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [rolloverCashModalOpen, setRolloverCashModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [cashSessionNotes, setCashSessionNotes] = useState("");
  const [manualMovementType, setManualMovementType] = useState<"IN" | "OUT">(
    "IN",
  );
  const [manualFinancialCategoryId, setManualFinancialCategoryId] =
    useState("");
  const [manualAmountInput, setManualAmountInput] = useState("");
  const [manualDate, setManualDate] = useState(getCurrentDateInputValue());
  const [manualDescription, setManualDescription] = useState("");
  const [manualReferenceCode, setManualReferenceCode] = useState("");
  const [manualAccountLabel, setManualAccountLabel] = useState("");
  const [transferAmountInput, setTransferAmountInput] = useState("");
  const [transferDate, setTransferDate] = useState(getCurrentDateInputValue());
  const [transferDescription, setTransferDescription] = useState(
    "Transferencia do banco para o caixa",
  );
  const [transferReferenceCode, setTransferReferenceCode] = useState("");
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId],
  );

  const canOpenTransferModal = bankAccountOptions.length > 0;
  const currentCashLaunchDateLabel = formatDate(getCurrentDateInputValue());
  const previousCashLaunchDateLabel = cashSessionStatus?.currentSession
    ? formatDate(cashSessionStatus.currentSession.openedAt)
    : "-";
  const availableBankBalance = Number(overallBankBalance || 0);

  const fetchRows = async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    if (search.trim()) params.set("search", search.trim());
    if (accountFilter) params.set("accountLabel", accountFilter);
    if (categoryFilter) params.set("financialCategoryId", categoryFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const data = (await getRequest(
      `/bank?${params.toString()}`,
    )) as BankListResponse;
    setRows(Array.isArray(data.items) ? data.items : []);
    setTotalRows(Number(data.total) || 0);
    setTotalPages(Number(data.totalPages) || 1);
    setSummary({
      totalIn: Number(data.summary?.totalIn || 0),
      totalOut: Number(data.summary?.totalOut || 0),
      balance: Number(data.summary?.balance || 0),
    });
  };

  const fetchFinancialCategories = async () => {
    try {
      const data = await getRequest("/financial-categories");
      setFinancialCategories(
        Array.isArray(data) ? (data as FinancialCategoryOption[]) : [],
      );
    } catch {
      setFinancialCategories([]);
    }
  };

  const fetchBankAccountOptions = async () => {
    try {
      const data = await getRequest("/bank/account-options");
      setBankAccountOptions(
        Array.isArray(data) ? (data as BankAccountOption[]) : [],
      );
    } catch {
      setBankAccountOptions([]);
    }
  };

  const fetchCashSessionStatus = async () => {
    try {
      const data = await getRequest("/cash/session-status");
      setCashSessionStatus((data as CashSessionStatusResponse) || null);
    } catch {
      setCashSessionStatus(null);
    }
  };

  const fetchOverallBankBalance = async () => {
    try {
      const data = (await getRequest("/bank?page=1&pageSize=1")) as BankListResponse;
      setOverallBankBalance(Number(data.summary?.balance || 0));
    } catch {
      setOverallBankBalance(0);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [accountFilter, categoryFilter, search, startDate, endDate]);

  useEffect(() => {
    if (selectedRowId && !rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(null);
    }
  }, [rows, selectedRowId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        await fetchRows();
        void fetchFinancialCategories();
        void fetchBankAccountOptions();
        void fetchCashSessionStatus();
        void fetchOverallBankBalance();
      } catch (err: unknown) {
        setRows([]);
        setTotalRows(0);
        setTotalPages(1);
        setSummary({ totalIn: 0, totalOut: 0, balance: 0 });
        setOverallBankBalance(0);
        setError(
          getUserFacingApiErrorMessage(
            err,
            "Nao foi possivel carregar o banco.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [accountFilter, categoryFilter, endDate, page, search, startDate]);

  const resetManualEntryModal = () => {
    setManualMovementType("IN");
    setManualFinancialCategoryId("");
    setManualAmountInput("");
    setManualDate(getCurrentDateInputValue());
    setManualDescription("");
    setManualReferenceCode("");
    setManualAccountLabel("");
    setManualEntryModalOpen(false);
  };

  const resetTransferModal = () => {
    setTransferAmountInput("");
    setTransferDate(getCurrentDateInputValue());
    setTransferDescription("Transferencia do banco para o caixa");
    setTransferReferenceCode("");
    setTransferModalOpen(false);
  };

  const resetReverseModal = () => {
    setReverseReason("");
    setReverseModalOpen(false);
  };

  async function refreshData() {
    await Promise.all([
      fetchRows(),
      fetchBankAccountOptions(),
      fetchCashSessionStatus(),
      fetchOverallBankBalance(),
    ]);
  }

  async function handleCreateManualEntry() {
    try {
      setActionLoading(true);
      await postRequest("/bank/manual-entry", {
        movementType: manualMovementType,
        financialCategoryId: Number(manualFinancialCategoryId),
        amount: parseCurrencyToNumber(manualAmountInput),
        occurredAt: manualDate,
        description: manualDescription.trim(),
        referenceCode: manualReferenceCode.trim() || null,
        accountLabel: manualAccountLabel,
      });
      resetManualEntryModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Lancamento criado",
        message: "O lancamento manual no banco foi criado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel incluir",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel criar o lancamento manual no banco.",
        ),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransferToCash() {
    const transferAmount = parseCurrencyToNumber(transferAmountInput);

    if (transferAmount > availableBankBalance) {
      setToast({
        open: true,
        tone: "warning",
        title: "Saldo insuficiente",
        message: "A transferencia nao pode ser maior que o valor disponivel no banco.",
      });
      return;
    }

    if (!(await ensureCashSessionBeforeTransferToCash())) {
      return;
    }

    try {
      setActionLoading(true);
      await postRequest("/bank/transfers/to-cash", {
        amount: transferAmount,
        occurredAt: transferDate,
        description: transferDescription.trim(),
        referenceCode: transferReferenceCode.trim() || null,
      });
      resetTransferModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Transferencia registrada",
        message:
          "A saida do banco e a entrada no caixa foram registradas com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel transferir",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel registrar a transferencia para o caixa.",
        ),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function ensureCashSessionBeforeTransferToCash() {
    try {
      const data = await getRequest("/cash/session-status");
      const parsed = (data as CashSessionStatusResponse) || null;
      setCashSessionStatus(parsed);

      if (parsed?.currentSession?.pendingPreviousDay) {
        setCashSessionNotes(parsed.currentSession.notes || "");
        setRolloverCashModalOpen(true);
        return false;
      }

      if (!parsed?.hasOpenSession) {
        setCashSessionNotes("");
        setOpenCashModalOpen(true);
        return false;
      }

      return true;
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel validar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel validar o status do caixa.",
        ),
      });
      return false;
    }
  }

  async function handleRolloverCashSession() {
    try {
      setActionLoading(true);
      await postRequest("/cash/sessions/rollover", {
        notes: cashSessionNotes.trim() || null,
      });
      await refreshData();
      setRolloverCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa atualizado",
        message:
          "O caixa pendente foi encerrado e o caixa do dia foi aberto. Agora voce pode continuar com a transferencia.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel atualizar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel encerrar e abrir o caixa.",
        ),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleOpenCashSession() {
    try {
      setActionLoading(true);
      await postRequest("/cash/sessions/open", {
        notes: cashSessionNotes.trim() || null,
      });
      await refreshData();
      setOpenCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa aberto",
        message:
          "O caixa da loja foi aberto. Agora voce pode continuar com a transferencia.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel abrir",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel abrir o caixa.",
        ),
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReverseEntry() {
    if (!selectedRow) return;

    try {
      setActionLoading(true);
      await postRequest(`/bank/${selectedRow.id}/reverse`, {
        reason: reverseReason.trim(),
      });
      resetReverseModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Extorno registrado",
        message: "O extorno bancario foi registrado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel extornar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel extornar o lancamento bancario.",
        ),
      });
    } finally {
      setActionLoading(false);
    }
  }

  const handleSelectRow = (rowId: number) => {
    const row = rows.find((item) => item.id === rowId);

    if (!row?.canReverse) {
      return;
    }

    setSelectedRowId((current) => (current === rowId ? null : rowId));
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-3 pb-1 pt-8 font-editorial text-[2rem] font-extralight leading-[0.98] tracking-tight text-primary md:text-[2.35rem] md:leading-tight">
        Banco
      </h1>
      <section className="mb-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="bg-surface-lowest p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
              Saldo geral do banco
            </p>
            <p className="mt-2 text-[1.3rem] leading-none text-primary md:text-[1.5rem]">
              {formatCurrency(overallBankBalance)}
            </p>
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setManualEntryModalOpen(true)}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Incluir
        </button>
        <button
          type="button"
          onClick={() => setTransferModalOpen(true)}
          disabled={!canOpenTransferModal}
          className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
        >
          Transferir para caixa
        </button>
        <button
          type="button"
          onClick={() => setReverseModalOpen(true)}
          disabled={!selectedRow?.canReverse}
          className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
        >
          Extornar
        </button>
      </div>

      <div className="mb-5 flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Buscar movimentacao
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descricao, categoria ou banco"
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          />
        </div>
        <div className="md:min-w-56">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Conta
          </label>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          >
            <option value="">Todos</option>
            {bankAccountOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:min-w-56">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Categoria
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          >
            <option value="">Todos</option>
            {financialCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.description}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              De
            </label>
            <input
              value={startDate}
              onChange={(e) =>
                setStartDate(maskLegacyShortDateInput(e.target.value))
              }
              inputMode="numeric"
              maxLength={8}
              placeholder="dd/mm/aa"
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Ate
            </label>
            <input
              value={endDate}
              onChange={(e) =>
                setEndDate(maskLegacyShortDateInput(e.target.value))
              }
              inputMode="numeric"
              maxLength={8}
              placeholder="dd/mm/aa"
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Entradas</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summary.totalIn)}
          </p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saidas</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summary.totalOut)}
          </p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(summary.balance)}
          </p>
        </div>
      </div>

      <p className="mb-3 text-sm text-neutral-700">
        {loading
          ? "Carregando movimentacoes..."
          : `${totalRows} movimentacao(oes) encontrada(s).`}
      </p>

      <div className="hidden overflow-auto md:block">
        <table className="mt-2 min-w-275 w-full border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Data
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Parcela
              </th>
              <th className="w-45 px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Categoria
              </th>
              <th className="min-w-[320px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Historico
              </th>
              <th className="w-42.5 px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Forma pag.
              </th>
              <th className="whitespace-nowrap px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Entrada
              </th>
              <th className="whitespace-nowrap px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Saida
              </th>
              <th className="whitespace-nowrap px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Carregando movimentacoes...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhuma movimentacao bancaria cadastrada.
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
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRowId === row.id}
                      onChange={() => handleSelectRow(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      disabled={!row.canReverse}
                      aria-label={`Selecionar movimentacao bancaria ${row.description}`}
                      className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-[14px] uppercase text-neutral-700">
                    {row.parcela || "-"}
                  </td>
                  <td className="w-45 px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                        row.category,
                      )}`}
                    >
                      {row.category}
                    </span>
                  </td>
                  <td className="min-w-[320px] px-4 py-3 text-[14px] uppercase text-neutral-700">
                    {row.description}
                  </td>
                  <td className="w-42.5 whitespace-nowrap px-4 py-3 text-[14px] text-neutral-700">
                    {row.paymentTypeName || "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[14px] text-[#1f7a1f]">
                    {row.amountIn ? formatCurrency(row.amountIn) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[14px] text-[#b42318]">
                    {row.amountOut ? formatCurrency(row.amountOut) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {formatCurrency(row.balance)}
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
            Carregando movimentacoes...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhuma movimentacao bancaria cadastrada.
          </div>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => handleSelectRow(row.id)}
              disabled={!row.canReverse}
              className={`block w-full px-4 py-4 text-left ${
                selectedRowId === row.id ? "bg-surface" : "bg-white"
              } disabled:cursor-default disabled:opacity-100`}
            >
              <p className="text-sm font-semibold text-primary">
                {formatDate(row.date)}
              </p>
              <p className="text-xs uppercase text-neutral-700">
                Parcela: {row.parcela || "-"}
              </p>
              <p
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                  row.category,
                )}`}
              >
                {row.category}
              </p>
              <p className="text-xs uppercase text-neutral-700">
                {row.description}
              </p>
              <p className="text-xs text-neutral-700">
                Forma de pagamento: {row.paymentTypeName || "-"}
              </p>
              <p className="text-xs text-[#1f7a1f]">
                Entrada: {row.amountIn ? formatCurrency(row.amountIn) : "-"}
              </p>
              <p className="text-xs text-[#b42318]">
                Saida: {row.amountOut ? formatCurrency(row.amountOut) : "-"}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                Saldo: {formatCurrency(row.balance)}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading ? "Carregando..." : `Pagina ${page} de ${totalPages}`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
            className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm text-primary disabled:opacity-60"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={loading || page >= totalPages}
            className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm text-primary disabled:opacity-60"
          >
            Proxima
          </button>
        </div>
      </div>

      <CustomerModal
        open={manualEntryModalOpen}
        onClose={resetManualEntryModal}
        title="Incluir lancamento manual no banco"
        subtitle="Registre uma entrada ou saida em uma conta bancaria."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Tipo de movimentacao
            </label>
            <select
              value={manualMovementType}
              onChange={(e) =>
                setManualMovementType(e.target.value as "IN" | "OUT")
              }
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            >
              <option value="IN">Entrada</option>
              <option value="OUT">Saida</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Conta
            </label>
            <select
              value={manualAccountLabel}
              onChange={(e) => setManualAccountLabel(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            >
              <option value="">Selecione</option>
              {bankAccountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Categoria
            </label>
            <select
              value={manualFinancialCategoryId}
              onChange={(e) => setManualFinancialCategoryId(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            >
              <option value="">Selecione</option>
              {financialCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Valor
            </label>
            <input
              value={manualAmountInput}
              onChange={(e) =>
                setManualAmountInput(formatCurrencyInput(e.target.value))
              }
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Data
            </label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Descricao
            </label>
            <input
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Referencia
            </label>
            <input
              value={manualReferenceCode}
              onChange={(e) => setManualReferenceCode(e.target.value)}
              placeholder="Opcional"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateManualEntry}
              disabled={
                actionLoading ||
                !manualAccountLabel ||
                !manualFinancialCategoryId ||
                !manualAmountInput ||
                !manualDescription.trim()
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {actionLoading ? "Salvando..." : "Confirmar lancamento"}
            </button>
            <button
              type="button"
              onClick={resetManualEntryModal}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={transferModalOpen}
        onClose={resetTransferModal}
        title="Transferir banco para caixa"
        subtitle="Registre a saida do banco e a entrada correspondente no caixa."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Valor
            </label>
            <input
              value={transferAmountInput}
              onChange={(e) =>
                setTransferAmountInput(formatCurrencyInput(e.target.value))
              }
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
            <p className="mt-2 text-xs text-neutral-700">
              Saldo geral disponivel no banco:{" "}
              {formatCurrency(availableBankBalance)}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Data
            </label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Descricao
            </label>
            <input
              value={transferDescription}
              onChange={(e) => setTransferDescription(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Referencia
            </label>
            <input
              value={transferReferenceCode}
              onChange={(e) => setTransferReferenceCode(e.target.value)}
              placeholder="Opcional"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTransferToCash}
              disabled={
                actionLoading ||
                !transferAmountInput ||
                !transferDescription.trim()
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {actionLoading ? "Transferindo..." : "Confirmar transferencia"}
            </button>
            <button
              type="button"
              onClick={resetTransferModal}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={openCashModalOpen}
        onClose={() => setOpenCashModalOpen(false)}
        title="Abrir Caixa"
        subtitle="Confirme a abertura do caixa usando o saldo esperado."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
            <p>
              O caixa sera aberto automaticamente com o saldo esperado da ultima
              sessao fechada.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-primary">
              Observacoes
            </label>
            <textarea
              value={cashSessionNotes}
              onChange={(e) => setCashSessionNotes(e.target.value)}
              className="min-h-24 w-full rounded-lg border border-outline-variant/60 bg-white px-3 py-2 text-[15px] text-primary"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenCashSession}
              disabled={actionLoading}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {actionLoading ? "Abrindo..." : "Confirmar abertura"}
            </button>
            <button
              type="button"
              onClick={() => setOpenCashModalOpen(false)}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Voltar
            </button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={rolloverCashModalOpen}
        onClose={() => setRolloverCashModalOpen(false)}
        title="Encerrar e abrir caixa"
        subtitle={
          cashSessionStatus?.currentSession
            ? `Existe um caixa pendente aberto em ${formatDate(
                cashSessionStatus.currentSession.openedAt,
              )}.`
            : "Feche o caixa da loja para continuar."
        }
      >
        <div className="space-y-4">
          {cashSessionStatus?.currentSession ? (
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>
                Data do lancamento: {currentCashLaunchDateLabel} e maior que a
                data do ultimo lancamento: {previousCashLaunchDateLabel}.
              </p>
              <p className="mt-3">
                Confirma encerramento do(s) caixa\banco(s) anteriores ao dia{" "}
                {currentCashLaunchDateLabel}?
              </p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRolloverCashSession}
              disabled={actionLoading}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {actionLoading ? "Confirmando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setRolloverCashModalOpen(false)}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Voltar
            </button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={reverseModalOpen}
        onClose={resetReverseModal}
        title="Extornar lancamento bancario"
        subtitle="Confirme a criacao do lancamento inverso no banco."
      >
        <div className="space-y-4">
          {selectedRow ? (
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>Data: {formatDate(selectedRow.date)}</p>
              <p>Banco: {selectedRow.bank}</p>
              <p>Categoria: {selectedRow.category}</p>
              <p>Descricao: {selectedRow.description}</p>
              <p>Forma de pagamento: {selectedRow.paymentTypeName || "-"}</p>
              <p>
                Valor:{" "}
                {selectedRow.amountIn
                  ? formatCurrency(selectedRow.amountIn)
                  : formatCurrency(selectedRow.amountOut)}
              </p>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Motivo
            </label>
            <textarea
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              className="min-h-24 w-full rounded border border-outline-variant/50 bg-white px-4 py-3 text-[15px] text-primary"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReverseEntry}
              disabled={
                actionLoading ||
                !selectedRow?.canReverse ||
                !reverseReason.trim()
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {actionLoading ? "Extornando..." : "Confirmar extorno"}
            </button>
            <button
              type="button"
              onClick={resetReverseModal}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </CustomerModal>

      <NoticeToast
        open={toast.open}
        tone={toast.tone}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast(EMPTY_TOAST)}
      />
    </div>
  );
}
