import { useEffect, useState } from "react";
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
  description: string;
  category: string;
  movementType: "IN" | "OUT";
  amountIn: number;
  amountOut: number;
  balance: number;
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

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

const formatDateTime = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString));

export default function Registers() {
  const pageSize = 10;
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<CashRow[]>([]);
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
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [countedBalanceInput, setCountedBalanceInput] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [transferAmountInput, setTransferAmountInput] = useState("");
  const [transferDate, setTransferDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [transferDescription, setTransferDescription] = useState(
    "Transferência do caixa para o banco",
  );
  const [transferReferenceCode, setTransferReferenceCode] = useState("");
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  const fetchRows = async () => {
    const params = new URLSearchParams({
      scope,
      page: String(page),
      pageSize: String(pageSize),
    });

    if (search.trim()) params.set("search", search.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const data = (await getRequest(
      `/cash?${params.toString()}`,
    )) as CashListResponse;
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
      setError(
        getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel carregar a sessao do caixa da loja.",
        ),
      );
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [scope, search, startDate, endDate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([fetchRows(), fetchSessionStatus()]);
      } catch (err: unknown) {
        setRows([]);
        setTotalRows(0);
        setTotalPages(1);
        setSummary({ totalIn: 0, totalOut: 0, balance: 0 });
        setError(
          getUserFacingApiErrorMessage(
            err,
            "Nao foi possivel carregar o caixa.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endDate, page, scope, search, startDate]);

  const currentSession = sessionStatus?.currentSession || null;

  const previousDayWarningVisible =
    scope === "LOJA" && Boolean(currentSession?.pendingPreviousDay);

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
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferDescription("Transferência do caixa para o banco");
    setTransferReferenceCode("");
    setTransferModalOpen(false);
  };

  async function handleOpenSession() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/sessions/open", {
        openingBalance: parseCurrencyToNumber(openingBalanceInput),
        notes: sessionNotes.trim() || null,
      });
      resetOpenModal();
      await Promise.all([fetchRows(), fetchSessionStatus()]);
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
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel abrir o caixa.",
        ),
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
      await Promise.all([fetchRows(), fetchSessionStatus()]);
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
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel fechar o caixa.",
        ),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

  async function handleTransferToBank() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/transfers/to-bank", {
        amount: parseCurrencyToNumber(transferAmountInput),
        occurredAt: transferDate,
        description: transferDescription.trim(),
        referenceCode: transferReferenceCode.trim() || null,
      });
      resetTransferModal();
      await Promise.all([fetchRows(), fetchSessionStatus()]);
      setToast({
        open: true,
        tone: "success",
        title: "Transferência registrada",
        message:
          "A saída do caixa e a entrada no banco foram registradas com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Não foi possível transferir",
        message: getUserFacingApiErrorMessage(
          err,
          "Não foi possível registrar a transferência para o banco.",
        ),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

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
                <p className="mt-1 text-sm text-neutral-700">
                  Carregando sessao...
                </p>
              ) : currentSession ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    Aberto em {formatDateTime(currentSession.openedAt)}
                  </p>
                  <p className="text-sm text-neutral-700">
                    Saldo inicial:{" "}
                    {formatCurrency(currentSession.openingBalance)} | Entradas:{" "}
                    {formatCurrency(currentSession.totalIn)} | Saidas:{" "}
                    {formatCurrency(currentSession.totalOut)}
                  </p>
                  <p className="text-sm text-neutral-700">
                    Saldo esperado:{" "}
                    {formatCurrency(currentSession.expectedBalance)}
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
                <>
                  <button
                    type="button"
                    onClick={() => setTransferModalOpen(true)}
                    className="rounded border border-outline-variant/50 bg-white px-4 py-2 text-sm font-medium text-primary"
                  >
                    Transferir para banco
                  </button>
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
                </>
              )}
            </div>
          </div>

          {previousDayWarningVisible ? (
            <div className="rounded-xl border border-[#c6a33a] bg-[#fff8df] px-4 py-3 text-sm text-[#6d5600]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  O caixa da loja iniciado em{" "}
                  {formatDate(currentSession!.openedAt)} ainda nao foi fechado.
                  Deseja fechar esse caixa agora?
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

      <div className="mb-5 flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Buscar historico
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descrição do lancamento"
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              De
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Ate
            </label>
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
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Data
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
                  colSpan={5}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Carregando lancamentos...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum lancamento de caixa cadastrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="bg-surface-lowest">
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <p>{row.description}</p>
                    <p
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                        row.category,
                      )}`}
                    >
                      {row.category}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-primary">
                    {row.amountIn ? formatCurrency(row.amountIn) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-primary">
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
              <p className="text-sm font-semibold text-primary">
                {formatDate(row.date)}
              </p>
              <p className="text-xs text-neutral-700">{row.description}</p>
              <p
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                  row.category,
                )}`}
              >
                {row.category}
              </p>
              <p className="text-xs text-neutral-700">
                Entrada: {row.amountIn ? formatCurrency(row.amountIn) : "-"}
              </p>
              <p className="text-xs text-neutral-700">
                Saida: {row.amountOut ? formatCurrency(row.amountOut) : "-"}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                Saldo: {formatCurrency(row.balance)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading
            ? "Carregando..."
            : `${totalRows} lançamento(s) | Página ${page} de ${totalPages}`}
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
            Próxima
          </button>
        </div>
      </div>

      <CustomerModal
        open={transferModalOpen}
        onClose={resetTransferModal}
        title="Transferir Caixa para Banco"
        subtitle="Registre a saída do caixa da loja e a entrada correspondente no banco."
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
              Descrição
            </label>
            <input
              value={transferDescription}
              onChange={(e) => setTransferDescription(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Referência
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
              onClick={handleTransferToBank}
              disabled={sessionActionLoading}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading
                ? "Transferindo..."
                : "Confirmar transferência"}
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
              onChange={(e) =>
                setOpeningBalanceInput(formatCurrencyInput(e.target.value))
              }
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
              <p>
                Saldo inicial: {formatCurrency(currentSession.openingBalance)}
              </p>
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
              onChange={(e) =>
                setCountedBalanceInput(formatCurrencyInput(e.target.value))
              }
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
