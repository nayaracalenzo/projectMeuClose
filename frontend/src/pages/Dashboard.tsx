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
    <div className=" p-5 bg-white md:bg-surface-low">
      <h1 className="mb-5 font-editorial text-4xl font-extralight leading-none tracking-tight text-primary">
        Olá, Lia. Bem-vinda de volta!
      </h1>

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <div className="mb-8 grid min-h-0 w-full grid-rows-[12rem_minmax(0,1fr)] gap-4">
        <div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <h2 className="text-[1.1rem] font-semibold text-neutral-700">Pedidos Pendentes</h2>
            <p className="font-editorial text-[2.5rem] leading-none text-primary">
              {loading ? "-" : summary.pendingOrders}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
              Itens a produzir
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[1.1rem] font-semibold text-neutral-700">
                Contas a Receber
              </h2>
              <button
                type="button"
                aria-label={
                  showFinancialValues ? "Ocultar valores" : "Mostrar valores"
                }
                onClick={() => setShowFinancialValues((current) => !current)}
                className="text-neutral-600 transition hover:text-primary"
              >
                {showFinancialValues ? <Eye size={18} /> : <EyeClosed size={18} />}
              </button>
            </div>
            <p className="font-editorial text-[2rem] leading-none text-primary">
              {loading
                ? "-"
                : showFinancialValues
                  ? formatCurrency(summary.monthlyReceivables.totalCardOpen)
                  : HIDDEN_VALUE}
            </p>
          
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              {loading ? "-" : formatReferenceMonth(summary.monthlyReceivables.referenceMonth)}
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 bg-surface-low p-5 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[1.1rem] font-semibold text-neutral-700">
                Contas a Pagar
              </h2>
              <button
                type="button"
                aria-label={
                  showFinancialValues ? "Ocultar valores" : "Mostrar valores"
                }
                onClick={() => setShowFinancialValues((current) => !current)}
                className="text-neutral-600 transition hover:text-primary"
              >
                {showFinancialValues ? <Eye size={18} /> : <EyeClosed size={18} />}
              </button>
            </div>
            <p className="font-editorial text-[2rem] leading-none text-primary">
              {loading
                ? "-"
                : showFinancialValues
                  ? formatCurrency(summary.monthlyPayables.totalCardOpen)
                  : HIDDEN_VALUE}
            </p>
            
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500">
              {loading ? "-" : formatReferenceMonth(summary.monthlyPayables.referenceMonth)}
            </p>
          </div>

          <div className="flex h-full flex-col justify-between bg-surface-low p-5 shadow-md">
            <h2 className="mb-3 text-lg font-semibold text-gray-700">Ações Rápidas</h2>
            <div className="grid gap-2">
              <Button
                variant="primary"
                size="md"
                className="px-5"
                onClick={() => navigate("/nova-venda")}
              >
                + Nova Venda
              </Button>
              <button
                type="button"
                onClick={() => navigate("/novo-cliente")}
                className="rounded border border-gray-300 bg-white px-5 py-2 text-center text-black shadow transition hover:cursor-pointer"
              >
                Novo Cliente
              </button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)]">
          <div className="min-h-0 bg-surface-low p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-editorial text-4xl font-semibold text-primary">
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
              <div className="overflow-hidden bg-surface-lowest">
                <div className="grid grid-cols-[minmax(0,1.3fr)_6rem_6rem] gap-3 border-b border-outline-variant/25 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <span>Cliente</span>
                  <span>Peças</span>
                  <span>Data</span>
                </div>
                <div className="divide-y divide-outline-variant/20">
                  {visibleUpcomingFittings.map((item, index) => (
                    <div
                      key={`${item.customer}-${item.testDate}-${index}`}
                      className="grid grid-cols-[minmax(0,1.3fr)_6rem_6rem] gap-3 px-4 py-3 text-sm text-neutral-800"
                    >
                      <span className="truncate uppercase">{item.customer}</span>
                      <span>{item.piecesCount}</span>
                      <span>{formatDay(item.testDate)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid min-h-0 gap-4">
            <aside className="min-h-0 border border-[#fee9ef] bg-surface-low p-5 shadow-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-editorial text-3xl font-semibold text-primary">
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
                        className="flex items-center justify-between rounded-lg bg-background/90 px-4 py-3"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium uppercase text-neutral-800">
                            {client.fullName}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                            {client.source === "customer" ? "Cliente" : "Colaborador"}
                          </span>
                        </div>

                        <span className="font-editorial text-2xl leading-none text-primary">
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="min-h-0 bg-surface-low p-5 shadow-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-editorial text-3xl font-semibold text-primary">
                  Pendências de Compras
                </h2>
                <span className="rounded-full bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-600">
                  {pendingPurchasesCount} abertas
                </span>
              </div>

              <div className="mb-4 flex gap-2">
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
                  className="h-10 flex-1 rounded border border-outline-variant/45 bg-white px-3 text-sm text-primary outline-none focus:border-primary"
                />
                <Button
                  variant="primary"
                  size="sm"
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
                      className="flex flex-col gap-3 rounded bg-surface-lowest px-4 py-3"
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

                      <div className="flex gap-2 self-end">
                        {editingId === item.id ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void handleSaveEdit(item.id)}
                              disabled={purchaseLoading || !editingTitle.trim()}
                            >
                              Salvar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
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
                              onClick={() => handleStartEdit(item)}
                              disabled={purchaseLoading}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
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
