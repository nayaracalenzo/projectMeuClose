import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeClosed } from "lucide-react";
import { Button } from "../components/Button";
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
} from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";

interface BirthdayClient {
  id: number;
  fullName: string;
  birthDate: string;
  source: "customer" | "employee";
}

interface UpcomingFitting {
  customer: string;
  piecesCount: number;
  testDate: string;
}

interface DashboardSummary {
  pendingOrders: number;
  upcomingFittings: UpcomingFitting[];
  monthlyReceivables: {
    totalAmount: number;
    totalOpen: number;
    totalReceived: number;
    totalCardOpen: number;
    totalOverdue: number;
    referenceMonth: string;
    referenceStartDate: string;
    referenceEndDate: string;
  };
  monthlyPayables: {
    totalAmount: number;
    totalOpen: number;
    totalPaid: number;
    totalCardOpen: number;
    totalOverdue: number;
    referenceMonth: string;
    referenceStartDate: string;
    referenceEndDate: string;
  };
}

interface PurchasePending {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
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

const formatDay = (value?: string | null) => {
  const date = parseDateOnly(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
};

const getDateOnlyTimestamp = (value?: string | null) => {
  if (!value) return Number.POSITIVE_INFINITY;

  const base = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return Number.POSITIVE_INFINITY;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatReferenceMonth = (value?: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const HIDDEN_VALUE = "R$ •••••";

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<BirthdayClient[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>({
    pendingOrders: 0,
    upcomingFittings: [],
    monthlyReceivables: {
      totalAmount: 0,
      totalOpen: 0,
      totalReceived: 0,
      totalCardOpen: 0,
      totalOverdue: 0,
      referenceMonth: "",
      referenceStartDate: "",
      referenceEndDate: "",
    },
    monthlyPayables: {
      totalAmount: 0,
      totalOpen: 0,
      totalPaid: 0,
      totalCardOpen: 0,
      totalOverdue: 0,
      referenceMonth: "",
      referenceStartDate: "",
      referenceEndDate: "",
    },
  });
  const [purchasePendings, setPurchasePendings] = useState<PurchasePending[]>([]);
  const [newPendingTitle, setNewPendingTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFinancialValues, setShowFinancialValues] = useState(false);

  const getBirthDay = (birthDate?: string) => {
    const base = String(birthDate || "").slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
    if (!match) return "-";
    return String(Number(match[3]));
  };

  const pendingPurchasesCount = useMemo(
    () => purchasePendings.filter((item) => !item.done).length,
    [purchasePendings],
  );

  const visibleUpcomingFittings = useMemo(() => {
    const today = new Date();
    const todayTimestamp = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
      0,
    ).getTime();

    return summary.upcomingFittings
      .filter((item) => getDateOnlyTimestamp(item.testDate) >= todayTimestamp)
      .sort((first, second) => {
        const firstTimestamp = getDateOnlyTimestamp(first.testDate);
        const secondTimestamp = getDateOnlyTimestamp(second.testDate);

        if (firstTimestamp !== secondTimestamp) {
          return firstTimestamp - secondTimestamp;
        }

        return first.customer.localeCompare(second.customer, "pt-BR");
      })
      .slice(0, 5);
  }, [summary.upcomingFittings]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError("");

        const [birthdaysData, summaryData, purchasePendingsData] = await Promise.all([
          getRequest("/clients/birthdays/week"),
          getRequest("/dashboard/summary"),
          getRequest("/dashboard/purchase-pendings"),
        ]);

        setClients(Array.isArray(birthdaysData) ? birthdaysData : []);
        setSummary(
          summaryData && typeof summaryData === "object"
            ? (summaryData as DashboardSummary)
            : {
                pendingOrders: 0,
                upcomingFittings: [],
                monthlyReceivables: {
                  totalAmount: 0,
                  totalOpen: 0,
                  totalReceived: 0,
                  totalCardOpen: 0,
                  totalOverdue: 0,
                  referenceMonth: "",
                  referenceStartDate: "",
                  referenceEndDate: "",
                },
                monthlyPayables: {
                  totalAmount: 0,
                  totalOpen: 0,
                  totalPaid: 0,
                  totalCardOpen: 0,
                  totalOverdue: 0,
                  referenceMonth: "",
                  referenceStartDate: "",
                  referenceEndDate: "",
                },
              },
        );
        setPurchasePendings(Array.isArray(purchasePendingsData) ? purchasePendingsData : []);
      } catch (err: unknown) {
        setError(getUserFacingApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const handleCreatePending = async () => {
    const normalizedTitle = newPendingTitle.trim();
    if (!normalizedTitle) return;

    try {
      setPurchaseLoading(true);
      const created = (await postRequest("/dashboard/purchase-pendings", {
        title: normalizedTitle,
      })) as PurchasePending;

      setPurchasePendings((current) => [created, ...current]);
      setNewPendingTitle("");
    } catch (err: unknown) {
      setError(getUserFacingApiErrorMessage(err));
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleTogglePending = async (item: PurchasePending) => {
    try {
      setPurchaseLoading(true);
      const updated = (await updateRequest(`/dashboard/purchase-pendings/${item.id}`, {
        done: !item.done,
      })) as PurchasePending;

      setPurchasePendings((current) =>
        current.map((pending) => (pending.id === updated.id ? updated : pending)),
      );
    } catch (err: unknown) {
      setError(getUserFacingApiErrorMessage(err));
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleStartEdit = (item: PurchasePending) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveEdit = async (id: number) => {
    const normalizedTitle = editingTitle.trim();
    if (!normalizedTitle) return;

    try {
      setPurchaseLoading(true);
      const updated = (await updateRequest(`/dashboard/purchase-pendings/${id}`, {
        title: normalizedTitle,
      })) as PurchasePending;

      setPurchasePendings((current) =>
        current.map((pending) => (pending.id === updated.id ? updated : pending)),
      );
      setEditingId(null);
      setEditingTitle("");
    } catch (err: unknown) {
      setError(getUserFacingApiErrorMessage(err));
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleDeletePending = async (id: number) => {
    try {
      setPurchaseLoading(true);
      await deleteRequest(`/dashboard/purchase-pendings/${id}`, {});
      setPurchasePendings((current) => current.filter((item) => item.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setEditingTitle("");
      }
    } catch (err: unknown) {
      setError(getUserFacingApiErrorMessage(err));
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden bg-white p-2.5 sm:p-5 md:bg-surface-low">
      <h1 className="mb-4 pr-1 font-editorial text-[1.75rem] font-extralight leading-[0.98] tracking-tight text-primary sm:mb-5 sm:max-w-none sm:pr-2 sm:text-4xl sm:leading-tight">
        Olá, Lia. Bem-vinda de volta!
      </h1>

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid min-h-0 w-full min-w-0 gap-2.5 sm:mb-8 sm:gap-4">
        <div className="grid w-full min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <div className="flex min-w-0 h-full flex-col gap-2 bg-surface-low p-3 shadow-md sm:gap-3 sm:p-5">
            <h2 className="text-base font-semibold text-neutral-700 sm:text-[1.1rem]">Pedidos Pendentes</h2>
            <p className="font-editorial text-[2rem] leading-none text-primary sm:text-[2.5rem]">
              {loading ? "-" : summary.pendingOrders}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 sm:text-xs">
              Itens a produzir
            </p>
          </div>

          <div className="flex min-w-0 h-full flex-col gap-2 bg-surface-low p-3 shadow-md sm:gap-3 sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h2 className="min-w-0 text-base font-semibold text-neutral-700 sm:text-[1.1rem]">
                Contas a Receber
              </h2>
              <button
                type="button"
                aria-label={
                  showFinancialValues ? "Ocultar valores" : "Mostrar valores"
                }
                onClick={() => setShowFinancialValues((current) => !current)}
                className="shrink-0 text-neutral-600 transition hover:text-primary"
              >
                {showFinancialValues ? <Eye size={18} /> : <EyeClosed size={18} />}
              </button>
            </div>
            <p className="min-w-0 break-all font-editorial text-[1.55rem] leading-none text-primary sm:break-words sm:text-[2rem]">
              {loading
                ? "-"
                : showFinancialValues
                  ? formatCurrency(summary.monthlyReceivables.totalCardOpen)
                  : HIDDEN_VALUE}
            </p>
          
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500 sm:text-[11px]">
              {loading ? "-" : formatReferenceMonth(summary.monthlyReceivables.referenceMonth)}
            </p>
          </div>

          <div className="flex min-w-0 h-full flex-col gap-2 bg-surface-low p-3 shadow-md sm:gap-3 sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <h2 className="min-w-0 text-base font-semibold text-neutral-700 sm:text-[1.1rem]">
                Contas a Pagar
              </h2>
              <button
                type="button"
                aria-label={
                  showFinancialValues ? "Ocultar valores" : "Mostrar valores"
                }
                onClick={() => setShowFinancialValues((current) => !current)}
                className="shrink-0 text-neutral-600 transition hover:text-primary"
              >
                {showFinancialValues ? <Eye size={18} /> : <EyeClosed size={18} />}
              </button>
            </div>
            <p className="min-w-0 break-all font-editorial text-[1.55rem] leading-none text-primary sm:break-words sm:text-[2rem]">
              {loading
                ? "-"
                : showFinancialValues
                  ? formatCurrency(summary.monthlyPayables.totalCardOpen)
                  : HIDDEN_VALUE}
            </p>
            
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500 sm:text-[11px]">
              {loading ? "-" : formatReferenceMonth(summary.monthlyPayables.referenceMonth)}
            </p>
          </div>

          <div className="flex min-w-0 h-full flex-col justify-between bg-surface-low p-3 shadow-md sm:col-span-2 sm:p-5 xl:col-span-1">
            <h2 className="mb-3 text-base font-semibold text-gray-700 sm:text-lg">Ações Rápidas</h2>
            <div className="grid gap-2">
              <Button
                variant="primary"
                size="md"
                className="w-full px-5"
                onClick={() => navigate("/nova-venda")}
              >
                + Nova Venda
              </Button>
              <button
                type="button"
                onClick={() => navigate("/novo-cliente")}
                className="w-full rounded border border-gray-300 bg-white px-5 py-2 text-center text-black shadow transition hover:cursor-pointer"
              >
                Novo Cliente
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
          <div className="min-h-0 min-w-0 bg-surface-low p-3 sm:p-5">
            <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="font-editorial text-[2rem] font-semibold text-primary sm:text-4xl">
                Próximas Provas
              </h2>
              <button
                type="button"
                onClick={() => navigate("/producao")}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Ver todos
              </button>
            </div>

            {loading ? (
              <div className="bg-surface-lowest px-4 py-6 text-sm text-neutral-700">
                Carregando próximas provas...
              </div>
            ) : visibleUpcomingFittings.length === 0 ? (
              <div className="bg-surface-lowest px-4 py-6 text-sm text-neutral-700">
                Nenhuma prova cadastrada para os próximos dias.
              </div>
            ) : (
              <div className="overflow-x-auto bg-surface-lowest">
                <div className="min-w-[20rem] sm:min-w-[22rem]">
                  <div className="grid grid-cols-[minmax(8.5rem,1.3fr)_4rem_4rem] gap-2 border-b border-outline-variant/25 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 sm:grid-cols-[minmax(12rem,1.3fr)_5rem_5rem] sm:gap-3 sm:px-4 sm:text-xs">
                    <span>Cliente</span>
                    <span>Peças</span>
                    <span>Data</span>
                  </div>
                  <div className="divide-y divide-outline-variant/20">
                    {visibleUpcomingFittings.map((item, index) => (
                      <div
                        key={`${item.customer}-${item.testDate}-${index}`}
                        className="grid grid-cols-[minmax(8.5rem,1.3fr)_4rem_4rem] gap-2 px-3 py-3 text-[13px] text-neutral-800 sm:grid-cols-[minmax(12rem,1.3fr)_5rem_5rem] sm:gap-3 sm:px-4 sm:text-sm"
                      >
                        <span className="truncate uppercase">{item.customer}</span>
                        <span>{item.piecesCount}</span>
                        <span>{formatDay(item.testDate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid min-h-0 min-w-0 gap-4">
            <aside className="min-h-0 min-w-0 border border-[#fee9ef] bg-surface-low p-3 shadow-md sm:p-5">
              <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <h2 className="font-editorial text-[1.8rem] font-semibold text-primary sm:text-3xl">
                  Aniversariantes da Semana
                </h2>
                <span className="rounded-full bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
                  {clients.length}
                </span>
              </div>

              {clients.length === 0 ? (
                <p className="text-sm font-medium text-neutral-700">
                  Nenhum aniversariante nesta semana.
                </p>
              ) : (
                <div className="flex max-h-[16rem] flex-col gap-3 overflow-auto pr-1">
                  {clients.map((client) => {
                    const day = getBirthDay(client.birthDate);

                    return (
                      <div
                        key={`${client.source}-${client.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg bg-background/90 px-3 py-3 sm:px-4"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-[13px] font-medium uppercase text-neutral-800 sm:text-sm">
                            {client.fullName}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                            {client.source === "customer" ? "Cliente" : "Colaborador"}
                          </span>
                        </div>

                        <span className="shrink-0 font-editorial text-[1.6rem] leading-none text-primary sm:text-2xl">
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="min-h-0 min-w-0 bg-surface-low p-3 shadow-md sm:p-5">
              <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <h2 className="font-editorial text-[1.8rem] font-semibold text-primary sm:text-3xl">
                  Pendências de Compras
                </h2>
                <span className="rounded-full bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
                  {pendingPurchasesCount} abertas
                </span>
              </div>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newPendingTitle}
                  onChange={(event) => setNewPendingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreatePending();
                    }
                  }}
                  placeholder="Adicionar item para comprar..."
                  className="flex-1 rounded border border-outline-variant/45 bg-white px-3 py-3 text-sm text-primary outline-none focus:border-primary"
                />
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => void handleCreatePending()}
                  disabled={purchaseLoading || !newPendingTitle.trim()}
                >
                  Adicionar
                </Button>
              </div>

              {purchasePendings.length === 0 ? (
                <div className="rounded bg-surface-lowest px-4 py-6 text-sm text-neutral-700">
                  Nenhuma pendência de compra cadastrada.
                </div>
              ) : (
                <div className="flex max-h-[20rem] flex-col gap-2 overflow-auto pr-1">
                  {purchasePendings.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded bg-surface-lowest px-3 py-3 sm:px-4"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => void handleTogglePending(item)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />

                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            className="h-9 flex-1 rounded border border-outline-variant/45 bg-white px-3 text-sm text-primary outline-none focus:border-primary"
                          />
                        ) : (
                          <p
                            className={`flex-1 text-sm uppercase ${
                              item.done ? "text-neutral-500 line-through" : "text-neutral-800"
                            }`}
                          >
                            {item.title}
                          </p>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-2 self-end sm:w-auto sm:flex-row">
                        {editingId === item.id ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => void handleSaveEdit(item.id)}
                              disabled={purchaseLoading || !editingTitle.trim()}
                            >
                              Salvar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => {
                                setEditingId(null);
                                setEditingTitle("");
                              }}
                              disabled={purchaseLoading}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => handleStartEdit(item)}
                              disabled={purchaseLoading}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => void handleDeletePending(item.id)}
                              disabled={purchaseLoading}
                            >
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
