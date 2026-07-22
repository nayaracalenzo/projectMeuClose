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

type Scope = "LOJA" | "PESSOAL";

interface CashRow {
  id: number;
  date: string;
  scope: Scope;
  parcela?: string;
  description: string;
  category: string;
  financialCategoryId: number | null;
  movementType: "IN" | "OUT";
  amountIn: number;
  amountOut: number;
  balance: number;
  canReverse: boolean;
  hasReversal?: boolean;
  sourceType: string;
}

interface CashListResponse {
  items: CashRow[];
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
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  expectedBalance: number;
  countedBalance: number | null;
  differenceAmount: number | null;
  notes: string | null;
  pendingPreviousDay: boolean;
}

interface CashSessionStatusResponse {
  currentSession: CashSessionSummary | null;
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

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentDateInputValue = () => formatDateInputValue(new Date());

const getCurrentMonthDateRange = () => {
  const now = new Date();
  return {
    startDate: formatDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: formatDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

const formatDateTime = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString));

export default function Registers() {
  const pageSize = 10;
  const currentMonthDateRange = getCurrentMonthDateRange();
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(currentMonthDateRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthDateRange.endDate);
  const [rows, setRows] = useState<CashRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    totalIn: 0,
    totalOut: 0,
    balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionStatus, setSessionStatus] =
    useState<CashSessionStatusResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [closeSessionModal, setCloseSessionModal] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [manualEntryModalOpen, setManualEntryModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [countedBalanceInput, setCountedBalanceInput] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [transferAmountInput, setTransferAmountInput] = useState("");
  const [transferDate, setTransferDate] = useState(getCurrentDateInputValue());
  const [transferDescription, setTransferDescription] = useState(
    "Transferencia do caixa para o banco",
  );
  const [transferReferenceCode, setTransferReferenceCode] = useState("");
  const [transferFinancialCategoryId, setTransferFinancialCategoryId] = useState("");
  const [transferAccountLabel, setTransferAccountLabel] = useState("");
  const [manualMovementType, setManualMovementType] = useState<"IN" | "OUT">("IN");
  const [manualFinancialCategoryId, setManualFinancialCategoryId] = useState("");
  const [manualAmountInput, setManualAmountInput] = useState("");
  const [manualDate, setManualDate] = useState(getCurrentDateInputValue());
  const [manualDescription, setManualDescription] = useState("");
  const [manualReferenceCode, setManualReferenceCode] = useState("");
  const [financialCategories, setFinancialCategories] = useState<
    FinancialCategoryOption[]
  >([]);
  const [bankAccountOptions, setBankAccountOptions] = useState<BankAccountOption[]>([]);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedRowId) || null,
    [rows, selectedRowId],
  );

  const currentSession = sessionStatus?.currentSession || null;
  const previousDayWarningVisible =
    scope === "LOJA" && Boolean(currentSession?.pendingPreviousDay);
  const requiresOpenStoreSession = scope === "LOJA" && !currentSession;
  const canOpenTransferModal =
    scope === "LOJA" ? !requiresOpenStoreSession : bankAccountOptions.length > 0;

  const fetchRows = async () => {
    const params = new URLSearchParams({
      scope,
      page: String(page),
      pageSize: String(pageSize),
    });

    if (search.trim()) params.set("search", search.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const data = (await getRequest(`/cash?${params.toString()}`)) as CashListResponse;
    setRows(Array.isArray(data.items) ? data.items : []);
    setTotalRows(Number(data.total) || 0);
    setTotalPages(Number(data.totalPages) || 1);
    setSummary({
      totalIn: Number(data.summary?.totalIn || 0),
      totalOut: Number(data.summary?.totalOut || 0),
      balance: Number(data.summary?.balance || 0),
    });
  };

  const fetchSessionStatus = async () => {
    if (scope !== "LOJA") {
      setSessionStatus(null);
      return;
    }

    setSessionLoading(true);

    try {
      const data = await getRequest("/cash/session-status");
      setSessionStatus((data as CashSessionStatusResponse) || null);
    } catch (err: unknown) {
      setSessionStatus(null);
    } finally {
      setSessionLoading(false);
    }
  };

  const fetchFinancialCategories = async () => {
    try {
      const data = await getRequest("/financial-categories");
      setFinancialCategories(Array.isArray(data) ? (data as FinancialCategoryOption[]) : []);
    } catch {
      setFinancialCategories([]);
    }
  };

  const fetchBankAccountOptions = async () => {
    try {
      const data = await getRequest("/bank/account-options?scope=PESSOAL");
      setBankAccountOptions(Array.isArray(data) ? (data as BankAccountOption[]) : []);
    } catch {
      setBankAccountOptions([]);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [scope, search, startDate, endDate]);

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
        void fetchSessionStatus();
        void fetchFinancialCategories();
        void fetchBankAccountOptions();
      } catch (err: unknown) {
        setRows([]);
        setTotalRows(0);
        setTotalPages(1);
        setSummary({ totalIn: 0, totalOut: 0, balance: 0 });
        setError(getUserFacingApiErrorMessage(err, "Nao foi possivel carregar o caixa."));
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [endDate, page, scope, search, startDate]);

  const resetOpenModal = () => {
    setOpeningBalanceInput("");
    setSessionNotes("");
    setOpenSessionModal(false);
  };

  const resetCloseModal = () => {
    setCountedBalanceInput("");
    setSessionNotes("");
    setCloseSessionModal(false);
  };

  const resetTransferModal = () => {
    setTransferAmountInput("");
    setTransferDate(getCurrentDateInputValue());
    setTransferDescription("Transferencia do caixa para o banco");
    setTransferReferenceCode("");
    setTransferFinancialCategoryId("");
    setTransferAccountLabel("");
    setTransferModalOpen(false);
  };

  const resetManualEntryModal = () => {
    setManualMovementType("IN");
    setManualFinancialCategoryId("");
    setManualAmountInput("");
    setManualDate(getCurrentDateInputValue());
    setManualDescription("");
    setManualReferenceCode("");
    setManualEntryModalOpen(false);
  };

  const resetReverseModal = () => {
    setReverseReason("");
    setReverseModalOpen(false);
  };

  async function refreshData() {
    await Promise.all([fetchRows(), fetchSessionStatus(), fetchBankAccountOptions()]);
  }

  async function handleOpenSession() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/sessions/open", {
        openingBalance: parseCurrencyToNumber(openingBalanceInput),
        notes: sessionNotes.trim() || null,
      });
      resetOpenModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Caixa aberto",
        message: "O caixa da loja foi aberto com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel abrir",
        message: getUserFacingApiErrorMessage(err, "Nao foi possivel abrir o caixa."),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleCloseSession() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/sessions/current/close", {
        countedBalance: parseCurrencyToNumber(countedBalanceInput),
        notes: sessionNotes.trim() || null,
      });
      resetCloseModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Caixa fechado",
        message: "O caixa da loja foi fechado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel fechar",
        message: getUserFacingApiErrorMessage(err, "Nao foi possivel fechar o caixa."),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleTransferToBank() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/transfers/to-bank", {
        scope,
        amount: parseCurrencyToNumber(transferAmountInput),
        occurredAt: transferDate,
        description: transferDescription.trim(),
        referenceCode: transferReferenceCode.trim() || null,
        financialCategoryId: Number(transferFinancialCategoryId),
        accountLabel: scope === "PESSOAL" ? transferAccountLabel : null,
      });
      resetTransferModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Transferencia registrada",
        message: "A saida do caixa e a entrada no banco foram registradas com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel transferir",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel registrar a transferencia para o banco.",
        ),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleCreateManualEntry() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/manual-entry", {
        scope,
        movementType: manualMovementType,
        financialCategoryId: Number(manualFinancialCategoryId),
        amount: parseCurrencyToNumber(manualAmountInput),
        occurredAt: manualDate,
        description: manualDescription.trim(),
        referenceCode: manualReferenceCode.trim() || null,
      });
      resetManualEntryModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Lancamento criado",
        message: "O lancamento manual foi criado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel incluir",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel criar o lancamento manual.",
        ),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleReverseEntry() {
    if (!selectedRow) return;

    try {
      setSessionActionLoading(true);
      await postRequest(`/cash/${selectedRow.id}/reverse`, {
        reason: reverseReason.trim(),
      });
      resetReverseModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Extorno registrado",
        message: "O extorno foi registrado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel extornar",
        message: getUserFacingApiErrorMessage(err, "Nao foi possivel extornar o lancamento."),
      });
    } finally {
      setSessionActionLoading(false);
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
      <h1 className="mb-5 pb-6 pt-12 text-6xl font-semibold text-primary md:text-4xl">
        Caixa
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
            Caixa da Loja
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
            Caixa Pessoal
          </button>
        </div>
      </div>

      {scope === "LOJA" ? (
        <section className="mb-5 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/35 bg-white p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                Sessao do Caixa da Loja
              </p>
              {sessionLoading ? (
                <p className="mt-1 text-sm text-neutral-700">Carregando sessao...</p>
              ) : currentSession ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    Aberto em {formatDateTime(currentSession.openedAt)}
                  </p>
                  <p className="text-sm text-neutral-700">
                    Saldo inicial: {formatCurrency(currentSession.openingBalance)} |
                    Entradas: {formatCurrency(currentSession.totalIn)} | Saidas:{" "}
                    {formatCurrency(currentSession.totalOut)}
                  </p>
                  <p className="text-sm text-neutral-700">
                    Saldo esperado: {formatCurrency(currentSession.expectedBalance)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-neutral-700">
                  Nenhum caixa da loja aberto no momento.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!currentSession ? (
                <button
                  type="button"
                  onClick={() => setOpenSessionModal(true)}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
                >
                  Abrir Caixa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCountedBalanceInput(formatCurrencyInput("0"));
                    setSessionNotes(currentSession.notes || "");
                    setCloseSessionModal(true);
                  }}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
                >
                  Fechar Caixa
                </button>
              )}
            </div>
          </div>

          {previousDayWarningVisible ? (
            <div className="rounded-xl border border-[#c6a33a] bg-[#fff8df] px-4 py-3 text-sm text-[#6d5600]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  O caixa da loja iniciado em {formatDate(currentSession!.openedAt)} ainda
                  nao foi fechado. Deseja fechar esse caixa agora?
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCountedBalanceInput(formatCurrencyInput("0"));
                    setSessionNotes(currentSession?.notes || "");
                    setCloseSessionModal(true);
                  }}
                  className="rounded border border-[#c6a33a] bg-white px-4 py-2 text-sm font-medium text-[#6d5600]"
                >
                  Fechar caixa de {formatDate(currentSession!.openedAt)}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setManualEntryModalOpen(true)}
          disabled={scope === "LOJA" && requiresOpenStoreSession}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Incluir
        </button>
        <button
          type="button"
          onClick={() => setTransferModalOpen(true)}
          disabled={!canOpenTransferModal}
          className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
        >
          Transferir para banco
        </button>
        <button
          type="button"
          onClick={() => setReverseModalOpen(true)}
          disabled={!selectedRow?.canReverse || (scope === "LOJA" && requiresOpenStoreSession)}
          className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm font-medium text-primary disabled:opacity-60"
        >
          Extornar
        </button>
      </div>

      <div className="mb-5 flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Buscar historico
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descricao do lancamento"
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Ate</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Parcela</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Categoria
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Historico
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">
                Entrada
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">
                Saida
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Carregando lancamentos...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum lancamento de caixa cadastrado.
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
                      aria-label={`Selecionar lancamento de caixa ${row.description}`}
                      className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-[14px] uppercase text-neutral-700">
                    {row.parcela || "-"}
                  </td>
                  <td className="w-[240px] px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                        row.category,
                      )}`}
                    >
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] uppercase text-neutral-700">
                    {row.description}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-[#1f7a1f]">
                    {row.amountIn ? formatCurrency(row.amountIn) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-[#b42318]">
                    {row.amountOut ? formatCurrency(row.amountOut) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
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
            Carregando lancamentos...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum lancamento de caixa cadastrado.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="px-4 py-4">
              <button
                type="button"
                onClick={() => handleSelectRow(row.id)}
                disabled={!row.canReverse}
                className="block w-full text-left disabled:cursor-default disabled:opacity-100"
              >
                <p className="text-sm font-semibold text-primary">{formatDate(row.date)}</p>
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
              <p className="text-xs uppercase text-neutral-700">{row.description}</p>
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
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading ? "Carregando..." : `${totalRows} lancamento(s) | Pagina ${page} de ${totalPages}`}
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
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || page >= totalPages}
            className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm text-primary disabled:opacity-60"
          >
            Proxima
          </button>
        </div>
      </div>

      <CustomerModal
        open={transferModalOpen}
        onClose={resetTransferModal}
        title={scope === "LOJA" ? "Transferir Caixa da Loja para Banco" : "Transferir Caixa Pessoal para Banco"}
        subtitle={
          scope === "LOJA"
            ? "Registre a saida do caixa da loja e a entrada correspondente no banco."
            : "Registre a saida do caixa pessoal e selecione o banco de destino."
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Categoria</label>
            <select
              value={transferFinancialCategoryId}
              onChange={(e) => setTransferFinancialCategoryId(e.target.value)}
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

          {scope === "PESSOAL" ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-primary">
                Banco de destino
              </label>
              <select
                value={transferAccountLabel}
                onChange={(e) => setTransferAccountLabel(e.target.value)}
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
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Valor</label>
            <input
              value={transferAmountInput}
              onChange={(e) => setTransferAmountInput(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Data</label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Descricao</label>
            <input
              value={transferDescription}
              onChange={(e) => setTransferDescription(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Referencia</label>
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
              onClick={handleTransferToBank}
              disabled={
                sessionActionLoading ||
                !transferFinancialCategoryId ||
                !transferAmountInput ||
                !transferDescription.trim() ||
                (scope === "PESSOAL" && !transferAccountLabel)
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Transferindo..." : "Confirmar transferencia"}
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
        open={manualEntryModalOpen}
        onClose={resetManualEntryModal}
        title="Incluir lancamento manual"
        subtitle="Registre uma entrada ou saida no caixa selecionado."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Tipo de movimentacao
            </label>
            <select
              value={manualMovementType}
              onChange={(e) => setManualMovementType(e.target.value as "IN" | "OUT")}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            >
              <option value="IN">Entrada</option>
              <option value="OUT">Saida</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Categoria</label>
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
            <label className="mb-2 block text-sm font-semibold text-primary">Valor</label>
            <input
              value={manualAmountInput}
              onChange={(e) => setManualAmountInput(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Data</label>
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Descricao</label>
            <input
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Referencia</label>
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
                sessionActionLoading ||
                !manualFinancialCategoryId ||
                !manualAmountInput ||
                !manualDescription.trim()
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Salvando..." : "Confirmar lancamento"}
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
        open={reverseModalOpen}
        onClose={resetReverseModal}
        title="Extornar lancamento"
        subtitle="Confirme a criacao do lancamento inverso no caixa."
      >
        <div className="space-y-4">
          {selectedRow ? (
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>Data: {formatDate(selectedRow.date)}</p>
              <p>Categoria: {selectedRow.category}</p>
              <p>Descricao: {selectedRow.description}</p>
              <p>
                Valor:{" "}
                {selectedRow.amountIn
                  ? formatCurrency(selectedRow.amountIn)
                  : formatCurrency(selectedRow.amountOut)}
              </p>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Motivo</label>
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
                sessionActionLoading || !selectedRow?.canReverse || !reverseReason.trim()
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Extornando..." : "Confirmar extorno"}
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

      <CustomerModal
        open={openSessionModal}
        onClose={resetOpenModal}
        title="Abrir Caixa da Loja"
        subtitle="Informe o saldo inicial para iniciar a sessao de caixa."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Saldo inicial
            </label>
            <input
              value={openingBalanceInput}
              onChange={(e) => setOpeningBalanceInput(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Observacoes
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className="min-h-24 w-full rounded border border-outline-variant/50 bg-white px-4 py-3 text-[15px] text-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenSession}
              disabled={sessionActionLoading}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Abrindo..." : "Confirmar abertura"}
            </button>
            <button
              type="button"
              onClick={resetOpenModal}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={closeSessionModal}
        onClose={resetCloseModal}
        title="Fechar Caixa da Loja"
        subtitle={
          currentSession
            ? `Sessao aberta em ${formatDateTime(currentSession.openedAt)}.`
            : "Confirme o fechamento do caixa."
        }
      >
        <div className="space-y-4">
          {currentSession ? (
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>Saldo inicial: {formatCurrency(currentSession.openingBalance)}</p>
              <p>Entradas: {formatCurrency(currentSession.totalIn)}</p>
              <p>Saidas: {formatCurrency(currentSession.totalOut)}</p>
              <p className="font-semibold text-primary">
                Saldo esperado: {formatCurrency(currentSession.expectedBalance)}
              </p>
            </div>
          ) : null}
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Saldo contado
            </label>
            <input
              value={countedBalanceInput}
              onChange={(e) => setCountedBalanceInput(formatCurrencyInput(e.target.value))}
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Observacoes
            </label>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              className="min-h-24 w-full rounded border border-outline-variant/50 bg-white px-4 py-3 text-[15px] text-primary"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCloseSession}
              disabled={sessionActionLoading}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Fechando..." : "Confirmar fechamento"}
            </button>
            <button
              type="button"
              onClick={resetCloseModal}
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
