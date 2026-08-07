import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeClosed } from "lucide-react";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
} from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyToNumber,
} from "../utils/currency";
import {
  maskLegacyShortDateInput,
} from "../utils/legacyDate";

type ReceivableFilter =
  | "A_RECEBER"
  | "ATRASADAS"
  | "VENCE_HOJE"
  | "A_VENCER"
  | "RECEBIDAS"
  | "TODAS";

interface ReceivableRow {
  id: number;
  receivableCreatedAt: string | null;
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
  interestBaseDate: string;
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

interface FinancialAccountOption {
  id: number;
  label: string;
  value: string;
  scope: "LOJA" | "PESSOAL";
  targetType: "CASH" | "BANK";
}

interface CustomerOption {
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

interface InstallmentReceiptOption {
  id: number;
  amount: number;
  paidAt: string;
  referenceCode: string | null;
  receiptType: string;
  paymentType: {
    id: number;
    name: string;
  } | null;
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

type ToastState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

const PAGE_SIZE = 10;
const MONTHLY_INTEREST_RATE = 0.06;
const HIDDEN_VALUE = "R$ •••••";
const EMPTY_TOAST: ToastState = {
  open: false,
  tone: "success",
  message: "",
};

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

const getCurrentDateInputValue = () => toIsoDate(new Date());

const formatFinancialAccountLabel = (account: FinancialAccountOption) =>
  `${account.label} (${account.targetType === "CASH" ? "Caixa" : "Banco"})`;

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const normalizeCustomerDisplayName = (value: string | null | undefined) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.toUpperCase() : "SEM NOME";
};

const getReceivableOriginName = (row: ReceivableRow) =>
  normalizeCustomerDisplayName(
    row.originName || row.supplierName || row.operatorLabel || row.customerName,
  );

const getReceivableHistoryColumnValue = (row: ReceivableRow) =>
  row.saleId ? `VENDA ${row.saleId}` : "-";

const renderStatus = (row: ReceivableRow) => {
  if (row.status === "CANCELLED") return "Cancelada";
  if (row.filter === "RECEBIDAS") return "Recebida";
  if (row.filter === "VENCE_HOJE") return "Vence hoje";
  if (row.filter === "A_VENCER") return "A vencer";
  if (row.filter === "ATRASADAS") return "Atrasada";
  return "A receber";
};

const getStatusTagClassName = (row: ReceivableRow) => {
  if (row.status === "CANCELLED") {
    return "border border-neutral-300 bg-neutral-100 text-neutral-600";
  }

  if (row.filter === "RECEBIDAS") {
    return "border border-[#B8D9C0] bg-[#E7F6EB] text-[#21663B]";
  }

  if (row.filter === "ATRASADAS") {
    return "border border-[#E8B8BE] bg-[#FBE8EB] text-[#A12837]";
  }

  return "border border-[#B8D2F6] bg-[#E8F1FF] text-[#1E5AA5]";
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
  const [searchParams] = useSearchParams();
  const initialSearchParam = String(searchParams.get("search") || "").trim();
  const [filter, setFilter] = useState<ReceivableFilter>("A_RECEBER");
  const [search, setSearch] = useState(initialSearchParam);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<
    FinancialAccountOption[]
  >([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalOpen: 0, totalReceived: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);
  const [showSummaryValues, setShowSummaryValues] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [receivableFormOpen, setReceivableFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [receivableFormMode, setReceivableFormMode] = useState<
    "create" | "edit"
  >("create");
  const [quitModalOpen, setQuitModalOpen] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPaymentTypeId, setFormPaymentTypeId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState(() => toIsoDate(new Date()));
  const [receiptPaymentTypeId, setReceiptPaymentTypeId] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptPaidAt, setReceiptPaidAt] = useState(() =>
    toIsoDate(new Date()),
  );
  const [receiptReferenceCode, setReceiptReferenceCode] = useState("");
  const [receiptFinancialAccountId, setReceiptFinancialAccountId] =
    useState("");
  const [discardInterest, setDiscardInterest] = useState(false);
  const [receiptConfirmOpen, setReceiptConfirmOpen] = useState(false);
  const [cashSessionStatus, setCashSessionStatus] =
    useState<CashSessionStatusResponse | null>(null);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [rolloverCashModalOpen, setRolloverCashModalOpen] = useState(false);
  const [cashSessionNotes, setCashSessionNotes] = useState("");
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [reverseReceiptModalOpen, setReverseReceiptModalOpen] = useState(false);
  const [reverseReceiptReason, setReverseReceiptReason] = useState("");
  const [reverseReceiptOptions, setReverseReceiptOptions] = useState<
    InstallmentReceiptOption[]
  >([]);
  const [reverseReceiptId, setReverseReceiptId] = useState("");
  const currentCashLaunchDateLabel = formatDate(getCurrentDateInputValue());
  const previousCashLaunchDateLabel = cashSessionStatus?.currentSession
    ? formatDate(cashSessionStatus.currentSession.openedAt)
    : "-";

  useEffect(() => {
    const nextSearch = String(searchParams.get("search") || "").trim();
    setSearch(nextSearch);
  }, [searchParams]);

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
        const data = (await getRequest(
          "/payment-types",
        )) as PaymentTypeOption[];
        setPaymentTypes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar formas de pagamento", error);
      }
    };

    fetchPaymentTypes();
  }, []);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = (await getRequest(
          "/clients?page=1&pageSize=100&status=ativo",
        )) as {
          items?: Array<{
            id: number;
            fullName?: string | null;
            companyName?: string | null;
          }>;
        };

        const items = Array.isArray(data?.items) ? data.items : [];
        setCustomers(
          items.map((item) => ({
            id: Number(item.id),
            name: normalizeCustomerDisplayName(
              item.fullName || item.companyName || `Cliente ${item.id}`,
            ),
          })),
        );
      } catch (error) {
        console.error("Erro ao buscar clientes", error);
        setCustomers([]);
      }
    };

    fetchCustomers();
  }, []);

  useEffect(() => {
    const fetchFinancialAccounts = async () => {
      try {
        const data = (await getRequest(
          "/financial-accounts/options",
        )) as FinancialAccountOption[];
        setFinancialAccounts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar contas financeiras", error);
        setFinancialAccounts([]);
      }
    };

    fetchFinancialAccounts();
  }, []);

  useEffect(() => {
    if (selectedRowId && !rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(null);
      setQuitModalOpen(false);
    }
  }, [rows, selectedRowId]);

  const selectedRow = rows.find((row) => row.id === selectedRowId) || null;
  const canManageSelectedRow = Boolean(
    selectedRow &&
    selectedRow.id > 0 &&
    !selectedRow.saleId &&
    selectedRow.paidAmount <= 0 &&
    selectedRow.openAmount === selectedRow.amount,
  );
  const canReverseSelectedReceipt = Boolean(
    selectedRow &&
    selectedRow.id > 0 &&
    selectedRow.saleId &&
    selectedRow.paidAmount > 0,
  );

  const overdueDays = useMemo(() => {
    if (!selectedRow) return 0;
    return calculateOverdueDays(
      selectedRow.interestBaseDate || selectedRow.dueDate,
      receiptPaidAt,
    );
  }, [receiptPaidAt, selectedRow]);

  const currentInterest = useMemo(() => {
    if (!selectedRow || discardInterest || overdueDays <= 0) return 0;
    const dailyRate = MONTHLY_INTEREST_RATE / 30;
    return Number(
      (selectedRow.openAmount * dailyRate * overdueDays).toFixed(2),
    );
  }, [discardInterest, overdueDays, selectedRow]);

  const amountDue = useMemo(() => {
    if (!selectedRow) return 0;
    return Number((selectedRow.openAmount + currentInterest).toFixed(2));
  }, [currentInterest, selectedRow]);

  const settledAmount = useMemo(() => {
    const paidAmount = parseCurrencyToNumber(receiptAmount);
    return Number(Math.min(Math.max(paidAmount, 0), amountDue).toFixed(2));
  }, [amountDue, receiptAmount]);

  const changeAmount = useMemo(() => {
    const paidAmount = parseCurrencyToNumber(receiptAmount);
    return Number(Math.max(paidAmount - amountDue, 0).toFixed(2));
  }, [amountDue, receiptAmount]);

  const principalRemainingAfterPayment = useMemo(() => {
    if (!selectedRow) return 0;
    return Number(
      Math.max(selectedRow.openAmount - settledAmount, 0).toFixed(2),
    );
  }, [selectedRow, settledAmount]);

  const handleSelectRow = (rowId: number) => {
    setSelectedRowId((current) => (current === rowId ? null : rowId));
  };

  const handleToggleRowSelection = (rowId: number) => {
    setSelectedRowId((current) => (current === rowId ? null : rowId));
  };

  const resetReceivableForm = () => {
    setFormCustomerId("");
    setFormPaymentTypeId("");
    setFormAmount("");
    setFormDueDate(toIsoDate(new Date()));
    setReceivableFormMode("create");
  };

  const handleOpenCreateReceivable = () => {
    resetReceivableForm();
    setReceivableFormOpen(true);
  };

  const handleOpenEditReceivable = () => {
    if (!selectedRow || !canManageSelectedRow) return;

    setReceivableFormMode("edit");
    setFormCustomerId(
      selectedRow.customerId ? String(selectedRow.customerId) : "",
    );
    setFormPaymentTypeId(
      selectedRow.paymentTypeId ? String(selectedRow.paymentTypeId) : "",
    );
    setFormAmount(String(selectedRow.amount.toFixed(2)));
    setFormDueDate(selectedRow.dueDate.slice(0, 10));
    setReceivableFormOpen(true);
  };

  const handleSubmitReceivable = async () => {
    if (!formCustomerId || !formPaymentTypeId || !formAmount || !formDueDate) {
      setMessage("Informe cliente, forma, valor e vencimento.");
      return;
    }

    try {
      if (receivableFormMode === "create") {
        await postRequest("/receivables", {
          customerId: Number(formCustomerId),
          paymentTypeId: Number(formPaymentTypeId),
          amount: Number(formAmount),
          dueDate: formDueDate,
        });
        setMessage("Conta a receber criada com sucesso.");
      } else {
        if (!selectedRow) return;

        await updateRequest(`/receivables/${selectedRow.id}`, {
          customerId: Number(formCustomerId),
          paymentTypeId: Number(formPaymentTypeId),
          amount: Number(formAmount),
          dueDate: formDueDate,
        });
        setMessage("Conta a receber alterada com sucesso.");
      }

      setReceivableFormOpen(false);
      setSelectedRowId(null);
      resetReceivableForm();
      await fetchRows();
    } catch (error: unknown) {
      setMessage(
        getUserFacingApiErrorMessage(
          error,
          receivableFormMode === "create"
            ? "Não foi possível criar a conta a receber."
            : "Não foi possível alterar a conta a receber.",
        ),
      );
    }
  };

  const handleDeleteReceivable = async () => {
    if (!selectedRow || !canManageSelectedRow) return;

    setDeleteConfirmOpen(true);
    return;

    try {
      await deleteRequest(`/receivables/${selectedRow!.id}`, {});
      setMessage("Conta a receber excluída com sucesso.");
      setReceivableFormOpen(false);
      setSelectedRowId(null);
      resetReceivableForm();
      await fetchRows();
    } catch (error: unknown) {
      setMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível excluir a conta a receber.",
        ),
      );
    }
  };

  const handleConfirmDeleteReceivable = async () => {
    if (!selectedRow || !canManageSelectedRow) return;

    try {
      await deleteRequest(`/receivables/${selectedRow.id}`, {});
      setMessage("Conta a receber excluída com sucesso.");
      setDeleteConfirmOpen(false);
      setReceivableFormOpen(false);
      setSelectedRowId(null);
      resetReceivableForm();
      await fetchRows();
    } catch (error: unknown) {
      setMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível excluir a conta a receber.",
        ),
      );
    }
  };

  const handleOpenQuitModal = () => {
    if (!selectedRow) return;

    const today = toIsoDate(new Date());
    setReceiptPaymentTypeId(
      selectedRow.paymentTypeId ? String(selectedRow.paymentTypeId) : "",
    );
    setReceiptPaidAt(today);
    setDiscardInterest(false);
    setReceiptAmount("");
    setReceiptReferenceCode("");
    setReceiptFinancialAccountId("");
    setReceiptConfirmOpen(false);
    setQuitModalOpen(true);
  };

  const handleReverseLatestReceipt = async () => {
    if (!selectedRow || !canReverseSelectedReceipt) return;

    try {
      await postRequest(
        `/receivables/${selectedRow.id}/reverse-latest-receipt`,
        {
          reason: reverseReceiptReason.trim(),
          paymentReceiptId: reverseReceiptId ? Number(reverseReceiptId) : null,
        },
      );
      setMessage("Baixa ajustada com sucesso.");
      setReverseReceiptModalOpen(false);
      setReverseReceiptReason("");
      setReverseReceiptId("");
      setReverseReceiptOptions([]);
      setSelectedRowId(null);
      await fetchRows();
    } catch (error: unknown) {
      setMessage(
        getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel ajustar a baixa do recebimento.",
        ),
      );
    }
  };

  const resetQuitFlow = () => {
    setReceiptConfirmOpen(false);
    setQuitModalOpen(false);
    setSelectedRowId(null);
    setReceiptPaymentTypeId("");
    setReceiptAmount("");
    setReceiptReferenceCode("");
    setReceiptFinancialAccountId("");
    setDiscardInterest(false);
  };

  // const handleOpenReverseReceiptModal = async () => {
  //   if (!selectedRow || !canReverseSelectedReceipt) return;

  //   try {
  //     const data = (await getRequest(
  //       `/receivables/${selectedRow.id}/receipts`,
  //     )) as {
  //       receipts?: InstallmentReceiptOption[];
  //     };
  //     const receipts = Array.isArray(data?.receipts) ? data.receipts : [];
  //     setReverseReceiptOptions(receipts);
  //     setReverseReceiptId(receipts[0]?.id ? String(receipts[0].id) : "");
  //     setReverseReceiptReason("");
  //     setReverseReceiptModalOpen(true);
  //   } catch (error: unknown) {
  //     setMessage(
  //       getUserFacingApiErrorMessage(
  //         error,
  //         "Nao foi possivel carregar os recebimentos da parcela.",
  //       ),
  //     );
  //   }
  // };

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

    if (parseCurrencyToNumber(receiptAmount) <= 0) {
      setMessage("Informe um valor pago maior que zero.");
      return;
    }

    if (!receiptFinancialAccountId) {
      setMessage("Selecione onde o valor foi recebido.");
      return;
    }

    const selectedFinancialAccount =
      financialAccounts.find(
        (item) => String(item.id) === receiptFinancialAccountId,
      ) || null;

    if (
      !(await ensureCashSessionBeforeStoreCashSettlement(
        selectedFinancialAccount,
      ))
    ) {
      return;
    }

    setReceiptConfirmOpen(true);
  };

  const ensureCashSessionBeforeStoreCashSettlement = async (
    financialAccount: FinancialAccountOption | null,
  ) => {
    if (
      !financialAccount ||
      financialAccount.scope !== "LOJA" ||
      financialAccount.targetType !== "CASH"
    ) {
      return true;
    }

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
    } catch (error: unknown) {
      setCashSessionStatus(null);
      setToast({
        open: true,
        tone: "error",
        title: "Conta a receber",
        message: getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel verificar o caixa.",
        ),
      });
      return false;
    }
  };

  const handleRolloverCashSession = async () => {
    try {
      setCashSessionLoading(true);
      await postRequest("/cash/sessions/rollover", {
        notes: cashSessionNotes.trim() || null,
      });

      const updated = await getRequest("/cash/session-status");
      setCashSessionStatus((updated as CashSessionStatusResponse) || null);
      setRolloverCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa atualizado",
        message:
          "O caixa pendente foi encerrado e o caixa do dia foi aberto. Agora voce pode continuar com a quitacao.",
      });
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel atualizar",
        message: getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel encerrar e abrir o caixa.",
        ),
      });
    } finally {
      setCashSessionLoading(false);
    }
  };

  const handleOpenCashSession = async () => {
    try {
      setCashSessionLoading(true);
      await postRequest("/cash/sessions/open", {
        notes: cashSessionNotes.trim() || null,
      });

      const updated = await getRequest("/cash/session-status");
      setCashSessionStatus((updated as CashSessionStatusResponse) || null);
      setOpenCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa aberto",
        message:
          "O caixa da loja foi aberto. Agora voce pode continuar com a quitacao.",
      });
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel abrir",
        message: getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel abrir o caixa.",
        ),
      });
    } finally {
      setCashSessionLoading(false);
    }
  };

  const handleConfirmRegisterReceipt = async () => {
    if (!selectedRow) return;

    try {
      await postRequest(`/receivables/${selectedRow.id}/receipts`, {
        paymentTypeId: Number(receiptPaymentTypeId),
        financialAccountId: Number(receiptFinancialAccountId),
        amount: settledAmount,
        paidAt: receiptPaidAt,
        referenceCode: receiptReferenceCode || null,
        discardInterest,
      });

      setToast({
        open: true,
        tone: "success",
        title: "Conta a receber",
        message: "Recebimento quitado com sucesso.",
      });
      resetQuitFlow();
      await fetchRows();
    } catch (error: unknown) {
      setReceiptConfirmOpen(false);
      setToast({
        open: true,
        tone: "error",
        title: "Conta a receber",
        message: getUserFacingApiErrorMessage(
          error,
          "Não foi possível quitar o recebimento.",
        ),
      });
      setMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível quitar o recebimento.",
        ),
      );
    }
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-3 pb-1 pt-8 font-editorial text-[2rem] font-extralight leading-[0.98] tracking-tight text-primary md:text-[2.35rem] md:leading-tight">
        A Receber
      </h1>

      {receivableFormOpen ? (
        <div className="mb-5 grid grid-cols-1 gap-3 border border-outline-variant/45 bg-white p-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Cliente
            </label>
            <select
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            >
              <option value="">Selecione...</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Forma prevista
            </label>
            <select
              value={formPaymentTypeId}
              onChange={(e) => setFormPaymentTypeId(e.target.value)}
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
            <label className="mb-1 block text-sm font-semibold text-primary">
              Valor
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Vencimento
            </label>
            <input
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div className="flex gap-2 md:col-span-4">
            <button
              type="button"
              onClick={handleSubmitReceivable}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              {receivableFormMode === "create"
                ? "Gravar conta a receber"
                : "Salvar alteração"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReceivableFormOpen(false);
                resetReceivableForm();
              }}
              className="rounded border border-outline-variant/60 bg-white px-4 py-2 text-sm font-medium text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

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
            <label className="mb-2 block text-sm font-semibold text-primary">
              De
            </label>
            <input
              value={startDate}
              onChange={(e) => setStartDate(maskLegacyShortDateInput(e.target.value))}
              inputMode="numeric"
              maxLength={8}
              placeholder="dd/mm/aa"
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Até
            </label>
            <input
              value={endDate}
              onChange={(e) => setEndDate(maskLegacyShortDateInput(e.target.value))}
              inputMode="numeric"
              maxLength={8}
              placeholder="dd/mm/aa"
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label={
              showSummaryValues ? "Ocultar valores" : "Mostrar valores"
            }
            onClick={() => setShowSummaryValues((current) => !current)}
            className="text-neutral-600 transition hover:text-primary"
          >
            {showSummaryValues ? <Eye size={18} /> : <EyeClosed size={18} />}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="bg-surface-lowest p-4">
            <p className="text-xs uppercase text-neutral-700">
              Saldo em aberto
            </p>
            <p className="text-lg font-semibold text-primary">
              {showSummaryValues
                ? formatCurrency(summary.totalOpen)
                : HIDDEN_VALUE}
            </p>
          </div>
          <div className="bg-surface-lowest p-4">
            <p className="text-xs uppercase text-neutral-700">Recebido</p>
            <p className="text-lg font-semibold text-primary">
              {showSummaryValues
                ? formatCurrency(summary.totalReceived)
                : HIDDEN_VALUE}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading
            ? "Carregando recebimentos..."
            : `${totalRows} recebimento(s) encontrado(s).`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenCreateReceivable}
          >
            Incluir
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenEditReceivable}
            disabled={!canManageSelectedRow}
          >
            Alterar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeleteReceivable}
            disabled={!canManageSelectedRow}
          >
            Excluir
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenQuitModal}
            disabled={!selectedRow || selectedRow.openAmount <= 0}
          >
            Quitar
          </Button>
          {/* <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenReverseReceiptModal}
            disabled={!canReverseSelectedReceipt}
          >
            Ajustar baixa
          </Button> */}
        </div>
      </div>

      {message ? (
        <p className="mb-4 text-sm text-neutral-700">{message}</p>
      ) : null}

      <div className="hidden overflow-x-hidden md:block">
        <table className="mt-2 w-full table-fixed border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="w-[140px] whitespace-nowrap px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Histórico
              </th>
              <th className="w-[24%] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Origem
              </th>
              <th className="w-[90px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Parcela
              </th>
              <th className="w-[130px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Vencimento
              </th>
              <th className="w-[120px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Status
              </th>
              <th className="w-[100px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Forma
              </th>
              <th className="w-[110px] px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Valor
              </th>
              <th className="w-[120px] px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Recebido
              </th>
              <th className="w-[120px] px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-surface-lowest">
                <td colSpan={10} className="px-4 py-4 text-sm text-neutral-700">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td colSpan={10} className="px-4 py-4 text-sm text-neutral-700">
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
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRowId === row.id}
                      onChange={() => handleToggleRowSelection(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Selecionar recebimento ${getReceivableOriginName(row)}`}
                      className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] text-neutral-700">
                    {getReceivableHistoryColumnValue(row)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                      {getReceivableOriginName(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {row.parcela}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.dueDate)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex min-w-20 whitespace-nowrap justify-center rounded-full px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] ${getStatusTagClassName(
                        row,
                      )}`}
                    >
                      {renderStatus(row)}
                    </span>
                  </td>
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
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            disabled={loading || page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>

      <CustomerModal
        open={quitModalOpen && Boolean(selectedRow)}
        onClose={resetQuitFlow}
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
                    value={formatDate(selectedRow.receivableCreatedAt)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Conta
                  </label>
                  <input
                    value="VENDA"
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
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Nr. doc.
                  </label>
                  <input
                    value={selectedRow.parcela}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Cliente
                  </label>
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
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Valor
                  </label>
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
                    Dias de atraso:{" "}
                    <span className="font-semibold">{overdueDays}</span>
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
                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    <input
                      type="checkbox"
                      checked={discardInterest}
                      onChange={(e) => setDiscardInterest(e.target.checked)}
                      className="h-4 w-4 rounded border border-outline-variant/60 accent-primary"
                    />
                    Descartar juros
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Valor devido
                  </label>
                  <input
                    value={formatCurrency(amountDue)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Valor pago
                  </label>
                  <input
                    value={receiptAmount}
                    onChange={(e) =>
                      setReceiptAmount(formatCurrencyInput(e.target.value))
                    }
                    placeholder="R$ 0,00"
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] font-semibold text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Troco
                  </label>
                  <input
                    value={formatCurrency(changeAmount)}
                    readOnly
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
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
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Recebido em
                  </label>
                  <select
                    value={receiptFinancialAccountId}
                    onChange={(e) =>
                      setReceiptFinancialAccountId(e.target.value)
                    }
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  >
                    <option value="">Selecione...</option>
                    {financialAccounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatFinancialAccountLabel(item)}
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
                disabled={
                  !receiptPaymentTypeId ||
                  !receiptFinancialAccountId ||
                  settledAmount <= 0
                }
              >
                Gravar
              </Button>
              <Button variant="secondary" size="sm" onClick={resetQuitFlow}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </CustomerModal>

      <CustomerModal
        open={receiptConfirmOpen && Boolean(selectedRow)}
        onClose={resetQuitFlow}
        title="Confirmar quitação"
        size="sm"
        subtitle={
          selectedRow && principalRemainingAfterPayment > 0
            ? "O valor pago é menor que o saldo principal e vai gerar saldo restante."
            : "Confirme a quitação da conta a receber."
        }
      >
        {selectedRow ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
              <p className="text-sm text-primary">
                {principalRemainingAfterPayment > 0
                  ? `O pagamento de ${formatCurrency(settledAmount)} deixará saldo restante de ${formatCurrency(principalRemainingAfterPayment)}. Deseja continuar?`
                  : `O pagamento de ${formatCurrency(settledAmount)} quitará a conta selecionada. Deseja continuar?`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRegisterReceipt}
                disabled={
                  !receiptPaymentTypeId ||
                  !receiptFinancialAccountId ||
                  settledAmount <= 0
                }
              >
                Confirmar
              </Button>
              <Button variant="secondary" size="sm" onClick={resetQuitFlow}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </CustomerModal>

      <CustomerModal
        open={reverseReceiptModalOpen && Boolean(selectedRow)}
        onClose={() => {
          setReverseReceiptModalOpen(false);
          setReverseReceiptReason("");
          setReverseReceiptId("");
          setReverseReceiptOptions([]);
        }}
        title="Ajustar baixa"
        size="sm"
        subtitle="Selecione qual recebimento deve ser removido do historico. A parcela sera reaberta e o financeiro sera estornado na data de hoje."
      >
        {selectedRow ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>Cliente: {getReceivableOriginName(selectedRow)}</p>
              <p>Parcela: {selectedRow.parcela}</p>
              <p>Recebido atual: {formatCurrency(selectedRow.paidAmount)}</p>
              <p>Saldo atual: {formatCurrency(selectedRow.openAmount)}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-primary">
                Recebimento a reverter
              </label>
              <select
                value={reverseReceiptId}
                onChange={(e) => setReverseReceiptId(e.target.value)}
                className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
              >
                <option value="">Selecione...</option>
                {reverseReceiptOptions.map((receipt) => (
                  <option key={receipt.id} value={receipt.id}>
                    {`${formatDate(receipt.paidAt)} - ${formatCurrency(receipt.amount)} - ${
                      receipt.paymentType?.name || "Forma nao identificada"
                    }${receipt.referenceCode ? ` - Ref. ${receipt.referenceCode}` : ""}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-primary">
                Motivo do ajuste
              </label>
              <textarea
                value={reverseReceiptReason}
                onChange={(e) => setReverseReceiptReason(e.target.value)}
                rows={4}
                className="w-full rounded border border-outline-variant/60 bg-white px-3 py-2 text-[15px] text-primary"
                placeholder="Explique o motivo da correcao da baixa."
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleReverseLatestReceipt}
                disabled={!reverseReceiptReason.trim() || !reverseReceiptId}
              >
                Confirmar ajuste
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReverseReceiptModalOpen(false);
                  setReverseReceiptReason("");
                  setReverseReceiptId("");
                  setReverseReceiptOptions([]);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </CustomerModal>

      <CustomerModal
        open={deleteConfirmOpen && Boolean(selectedRow)}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirmar exclusão"
        size="sm"
        subtitle="Confirme a exclusão da conta a receber selecionada."
      >
        {selectedRow ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
              <p className="text-sm text-primary">
                Deseja realmente excluir a conta a receber de{" "}
                {getReceivableOriginName(selectedRow)} com parcela{" "}
                {selectedRow.parcela}?
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDeleteReceivable}
              >
                Confirmar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
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
            <Button
              type="button"
              onClick={handleOpenCashSession}
              isLoading={cashSessionLoading}
            >
              Confirmar abertura
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpenCashModalOpen(false)}
            >
              Voltar
            </Button>
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
                Data do lançamento: {currentCashLaunchDateLabel} é maior que a
                data do último lançamento: {previousCashLaunchDateLabel}.
              </p>
              <p className="mt-3">
                Confirma encerramento do(s) caixa\banco(s) anteriores ao dia{" "}
                {currentCashLaunchDateLabel}?
              </p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleRolloverCashSession}
              isLoading={cashSessionLoading}
            >
              Confirmar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRolloverCashModalOpen(false)}
            >
              Voltar
            </Button>
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
