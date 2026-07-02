import { useEffect, useMemo, useState } from "react";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
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
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<CashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionStatus, setSessionStatus] = useState<CashSessionStatusResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [closeSessionModal, setCloseSessionModal] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [countedBalanceInput, setCountedBalanceInput] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  const fetchRows = async () => {
    const params = new URLSearchParams({
      scope,
    });

    if (search.trim()) params.set("search", search.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    const data = await getRequest(`/cash?${params.toString()}`);
    setRows(Array.isArray(data) ? (data as CashRow[]) : []);
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
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([fetchRows(), fetchSessionStatus()]);
      } catch (err: unknown) {
        setRows([]);
        setError(getUserFacingApiErrorMessage(err, "Nao foi possivel carregar o caixa."));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endDate, scope, search, startDate]);

  const rowsWithBalance = useMemo(() => {
    const ordered = [...rows].reverse();
    let balance = 0;

    const computed = ordered.map((row) => {
      balance += Number(row.amountIn || 0) - Number(row.amountOut || 0);
      return {
        ...row,
        balance,
      };
    });

    return computed.reverse();
  }, [rows]);

  const totalIn = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.amountIn || 0), 0),
    [rows],
  );
  const totalOut = useMemo(
    () => rows.reduce((acc, row) => acc + Number(row.amountOut || 0), 0),
    [rows],
  );

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
        message: getUserFacingApiErrorMessage(err, "Nao foi possivel fechar o caixa."),
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
                <p className="mt-1 text-sm text-neutral-700">Carregando sessao...</p>
              ) : currentSession ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-primary">
                    Aberto em {formatDateTime(currentSession.openedAt)}
                  </p>
                  <p className="text-sm text-neutral-700">
                    Saldo inicial: {formatCurrency(currentSession.openingBalance)} | Entradas:{" "}
                    {formatCurrency(currentSession.totalIn)} | Saidas:{" "}
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
                    setCountedBalanceInput(formatCurrencyInput(String(currentSession.expectedBalance)));
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
                  O caixa da loja iniciado em {formatDate(currentSession!.openedAt)} ainda nao foi
                  fechado. Deseja fechar esse caixa agora?
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCountedBalanceInput(
                      formatCurrencyInput(String(currentSession!.expectedBalance)),
                    );
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
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalIn)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saidas</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(totalOut)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(totalIn - totalOut)}
          </p>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
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
            ) : rowsWithBalance.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum lancamento de caixa cadastrado.
                </td>
              </tr>
            ) : (
              rowsWithBalance.map((row) => (
                <tr key={row.id} className="bg-surface-lowest">
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <p>{row.description}</p>
                    <p className="text-xs uppercase tracking-[0.08em] text-neutral-500">
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
        ) : rowsWithBalance.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum lancamento de caixa cadastrado.
          </div>
        ) : (
          rowsWithBalance.map((row) => (
            <div key={row.id} className="px-4 py-4">
              <p className="text-sm font-semibold text-primary">{formatDate(row.date)}</p>
              <p className="text-xs text-neutral-700">{row.description}</p>
              <p className="text-xs uppercase tracking-[0.08em] text-neutral-500">
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
