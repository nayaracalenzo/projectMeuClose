import { useCallback, useEffect, useState } from "react";
import { Eye, EyeClosed } from "lucide-react";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import DatePickerInput from "../components/DatePickerInput";
import NoticeToast from "../components/NoticeToast";
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
} from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { getCategoryBadgeClassName } from "../utils/categoryBadge";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyToNumber,
} from "../utils/currency";

type Scope = "LOJA" | "PESSOAL";
type SettlementTarget = "BANCO" | "CAIXA";
type PayableAmountMode = "TOTAL" | "INSTALLMENT";
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

interface FinancialTargetHint {
  targetType: "CASH" | "BANK";
}

interface SupplierOption {
  id: number;
  name: string;
}

interface FinancialCategoryOption {
  id: number;
  description: string;
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

interface CreatePayableResponse {
  message: string;
  id: number | null;
  ids?: number[];
  installmentCount?: number;
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
const HIDDEN_VALUE = "R$ •••••";
const EMPTY_TOAST: ToastState = {
  open: false,
  tone: "success",
  message: "",
};

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

const getCurrentDateInputValue = () => new Date().toISOString().slice(0, 10);

const roundCurrency = (value: number) => Number(value.toFixed(2));

const addMonthsPreservingDay = (baseDate: Date, monthsToAdd: number) => {
  const year = baseDate.getFullYear();
  const monthIndex = baseDate.getMonth() + monthsToAdd;
  const day = baseDate.getDate();
  const lastDayOfTargetMonth = new Date(year, monthIndex + 1, 0).getDate();

  return new Date(
    year,
    monthIndex,
    Math.min(day, lastDayOfTargetMonth),
    0,
    0,
    0,
    0,
  );
};

const buildPayableInstallmentsPreview = (
  totalAmount: number,
  installmentCount: number,
  dueDateValue: string,
) => {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || installmentCount <= 0) {
    return [];
  }

  const baseDate = dueDateValue ? new Date(`${dueDateValue}T00:00:00`) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return [];
  }

  const amounts: number[] = [];
  let allocated = 0;

  for (let index = 0; index < installmentCount; index += 1) {
    const remainingInstallments = installmentCount - index;
    const remainingAmount = roundCurrency(totalAmount - allocated);
    const installmentAmount =
      remainingInstallments === 1
        ? remainingAmount
        : roundCurrency(remainingAmount / remainingInstallments);

    allocated = roundCurrency(allocated + installmentAmount);
    amounts.push(installmentAmount);
  }

  return amounts.map((value, index) => ({
    installmentNumber: index + 1,
    dueDate: addMonthsPreservingDay(baseDate, index).toISOString().slice(0, 10),
    amount: value,
  }));
};

const normalizeUppercasePayloadText = (value: string) =>
  String(value || "").trim().toUpperCase();

const normalizePaymentTypeLabel = (value: string) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const resolveSettlementTargetByPaymentTypeName = (
  paymentTypeName?: string | null,
): SettlementTarget => {
  const normalized = normalizePaymentTypeLabel(paymentTypeName || "");

  if (
    normalized === "DINHEIRO" ||
    normalized === "CARNE"
  ) {
    return "CAIXA";
  }

  return "BANCO";
};

export default function PayablesPage() {
  const [filter, setFilter] = useState<PayableFilter>("EM_ABERTO");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<PayableRow[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [financialCategories, setFinancialCategories] = useState<
    FinancialCategoryOption[]
  >([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSummaryValues, setShowSummaryValues] = useState(false);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalAmount: 0, totalOpen: 0 });
  const [selectedPayableId, setSelectedPayableId] = useState<number | null>(
    null,
  );
  const [activePayableId, setActivePayableId] = useState<number | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [payableFormMode, setPayableFormMode] = useState<"create" | "edit">(
    "create",
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOptionsOpen, setCategoryOptionsOpen] = useState(false);
  const [beneficiary, setBeneficiary] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [amountMode, setAmountMode] = useState<PayableAmountMode>("INSTALLMENT");
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [dueDate, setDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [plannedPaymentTypeId, setPlannedPaymentTypeId] = useState("");

  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [referenceCode, setReferenceCode] = useState("");
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [cashSessionStatus, setCashSessionStatus] =
    useState<CashSessionStatusResponse | null>(null);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [rolloverCashModalOpen, setRolloverCashModalOpen] = useState(false);
  const [cashSessionNotes, setCashSessionNotes] = useState("");
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const currentCashLaunchDateLabel = formatDate(getCurrentDateInputValue());
  const previousCashLaunchDateLabel = cashSessionStatus?.currentSession
    ? formatDate(cashSessionStatus.currentSession.openedAt)
    : "-";
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);
  const filteredCategoryOptions = category.trim()
    ? financialCategories.filter((item) =>
        item.description.toLowerCase().includes(category.trim().toLowerCase()),
      )
    : financialCategories;

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, filter, search, startDate, endDate]);

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
      if (categoryFilter) params.set("category", categoryFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const data = (await getRequest(
        `/payables?${params.toString()}`,
      )) as PayablesResponse;
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
  }, [categoryFilter, endDate, filter, page, search, startDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (
      selectedPayableId &&
      !rows.some((row) => row.id === selectedPayableId)
    ) {
      setSelectedPayableId(null);
      setDeleteConfirmOpen(false);
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
    const fetchFinancialCategories = async () => {
      try {
        const data = (await getRequest(
          "/financial-categories",
        )) as FinancialCategoryOption[];
        setFinancialCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar categorias financeiras", error);
        setFinancialCategories([]);
      }
    };

    fetchFinancialCategories();
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

  const selectedRow = rows.find((row) => row.id === selectedPayableId) || null;
  const canManageSelectedPayable = Boolean(
    selectedRow &&
    selectedRow.id > 0 &&
    selectedRow.paidAmount <= 0 &&
    selectedRow.openAmount === selectedRow.amount,
  );

  const resetPayableForm = () => {
    setDescription("");
    setCategory("");
    setCategoryOptionsOpen(false);
    setBeneficiary("");
    setSupplierId("");
    setAmountMode("INSTALLMENT");
    setAmount("");
    setInstallmentCount("1");
    setDueDate(new Date().toISOString().slice(0, 10));
    setPlannedPaymentTypeId("");
    setPayableFormMode("create");
  };

  const handleOpenCreatePayable = () => {
    resetPayableForm();
    setIsCreateFormOpen(true);
  };

  const handleOpenEditPayable = () => {
    if (!selectedRow || !canManageSelectedPayable) return;

    setPayableFormMode("edit");
    setDescription(selectedRow.description);
    setCategory(selectedRow.category);
    setBeneficiary(selectedRow.supplierName ? "" : selectedRow.beneficiary);
    setSupplierId(selectedRow.supplierId ? String(selectedRow.supplierId) : "");
    setAmountMode("TOTAL");
    setAmount(formatCurrencyInput(String(selectedRow.amount.toFixed(2))));
    setInstallmentCount("1");
    setDueDate(selectedRow.dueDate.slice(0, 10));
    setPlannedPaymentTypeId(
      selectedRow.plannedPaymentTypeId
        ? String(selectedRow.plannedPaymentTypeId)
        : "",
    );
    setIsCreateFormOpen(true);
  };

  const handleSubmitPayable = async () => {
    try {
      const parsedInstallmentCount = Math.max(1, Number(installmentCount) || 1);
      const rawAmount = parseCurrencyToNumber(amount);
      const effectiveTotalAmount =
        payableFormMode === "create" && amountMode === "INSTALLMENT"
          ? roundCurrency(rawAmount * parsedInstallmentCount)
          : rawAmount;
      const payload = {
        scope: "LOJA" as Scope,
        description: normalizeUppercasePayloadText(description),
        category: normalizeUppercasePayloadText(category),
        beneficiary: normalizeUppercasePayloadText(beneficiary),
        supplierId: supplierId ? Number(supplierId) : null,
        amount: effectiveTotalAmount,
        installmentCount: parsedInstallmentCount,
        dueDate,
        plannedPaymentTypeId: plannedPaymentTypeId
          ? Number(plannedPaymentTypeId)
          : null,
      };

      if (payableFormMode === "create") {
        const data = (await postRequest("/payables", payload)) as CreatePayableResponse;
        setToast({
          open: true,
          tone: "success",
          title: "Conta a pagar",
          message: data?.message || "Conta a pagar criada com sucesso.",
        });
      } else {
        if (!selectedRow) return;
        await updateRequest(`/payables/${selectedRow.id}`, payload);
        setToast({
          open: true,
          tone: "success",
          title: "Conta a pagar",
          message: "Conta a pagar alterada com sucesso.",
        });
      }

      resetPayableForm();
      setIsCreateFormOpen(false);
      setSelectedPayableId(null);
      await fetchRows();
    } catch (error: unknown) {
      setPaymentConfirmOpen(false);
      setToast({
        open: true,
        tone: "error",
        title: "Conta a pagar",
        message: getUserFacingApiErrorMessage(
          error,
          payableFormMode === "create"
            ? "Não foi possível criar a conta a pagar."
            : "Não foi possível alterar a conta a pagar.",
        ),
      });
    }
  };

  const handleDeletePayable = () => {
    if (!selectedRow || !canManageSelectedPayable) return;
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeletePayable = async () => {
    if (!selectedRow || !canManageSelectedPayable) return;

    try {
      await deleteRequest(`/payables/${selectedRow.id}`, {});
      setToast({
        open: true,
        tone: "success",
        title: "Conta a pagar",
        message: "Conta a pagar excluída com sucesso.",
      });
      setDeleteConfirmOpen(false);
      setSelectedPayableId(null);
      setIsCreateFormOpen(false);
      resetPayableForm();
      await fetchRows();
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Conta a pagar",
        message: getUserFacingApiErrorMessage(
          error,
          "Não foi possível excluir a conta a pagar.",
        ),
      });
    }
  };

  const handleOpenPayment = (row: PayableRow) => {
    setActivePayableId(row.id);
    setPaymentTypeId(
      row.plannedPaymentTypeId ? String(row.plannedPaymentTypeId) : "",
    );
    setPaymentAmount(formatCurrencyInput(String(row.openAmount.toFixed(2))));
    setPaidAt(new Date().toISOString().slice(0, 10));
    setReferenceCode("");
    setPaymentConfirmOpen(false);
  };

  const resetPaymentFlow = () => {
    setPaymentConfirmOpen(false);
    setActivePayableId(null);
    setPaymentTypeId("");
    setPaymentAmount("");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setReferenceCode("");
  };

  const handleSelectRow = (rowId: number) => {
    setSelectedPayableId((current) => (current === rowId ? null : rowId));
  };

  const handleToggleRowSelection = (rowId: number) => {
    setSelectedPayableId((current) => (current === rowId ? null : rowId));
  };

  const handleOpenPaymentForm = () => {
    if (!selectedPayableId) return;

    const row = rows.find((item) => item.id === selectedPayableId) || null;
    if (!row || row.filter === "PAGAS" || row.openAmount <= 0) {
      return;
    }

    handleOpenPayment(row);
  };

  const handleRegisterPayment = () => {
    if (!activePayableId) return;
    if (!paymentTypeId) {
      setToast({
        open: true,
        tone: "warning",
        title: "Conta a pagar",
        message: "Selecione a forma de pagamento.",
      });
      return;
    }

    void (async () => {
      const selectedPaymentType =
        paymentTypes.find((item) => String(item.id) === paymentTypeId) || null;
      const selectedSettlementTarget = resolveSettlementTargetByPaymentTypeName(
        selectedPaymentType?.name,
      );

      if (
        !(await ensureCashSessionBeforeStoreCashSettlement(
          selectedSettlementTarget === "CAIXA" ? { targetType: "CASH" } : null,
        ))
      ) {
        return;
      }

      setPaymentConfirmOpen(true);
    })();
  };

  const ensureCashSessionBeforeStoreCashSettlement = async (
    financialAccount: FinancialTargetHint | null,
  ) => {
    if (
      !financialAccount ||
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
        title: "Conta a pagar",
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

  const handleCreateFinancialCategory = async () => {
    const normalizedDescription = newCategoryDescription.trim();
    if (!normalizedDescription) {
      setToast({
        open: true,
        tone: "warning",
        title: "Categoria",
        message: "Informe uma descricao para a categoria.",
      });
      return;
    }

    try {
      setCreatingCategory(true);
      const created = (await postRequest("/admin/financial-categories", {
        description: normalizedDescription,
      })) as { idFinancialCategory?: number; description?: string };

      const data = (await getRequest(
        "/financial-categories",
      )) as FinancialCategoryOption[];
      const nextCategories = Array.isArray(data) ? data : [];
      setFinancialCategories(nextCategories);
      setCategory(created?.description || normalizedDescription);
      setCategoryModalOpen(false);
      setNewCategoryDescription("");
      setToast({
        open: true,
        tone: "success",
        title: "Categoria",
        message: "Categoria criada com sucesso.",
      });
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Categoria",
        message: getUserFacingApiErrorMessage(
          error,
          "Nao foi possivel criar a categoria.",
        ),
      });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleConfirmRegisterPayment = async () => {
    if (!activePayableId) return;

    try {
      const data = (await postRequest(`/payables/${activePayableId}/payments`, {
        paymentTypeId: Number(paymentTypeId),
        amount: parseCurrencyToNumber(paymentAmount),
        paidAt,
        referenceCode: referenceCode || null,
      })) as RegisterPaymentResponse;

      setToast({
        open: true,
        tone: "success",
        title: "Conta a pagar",
        message: data?.message || "Pagamento registrado com sucesso.",
      });
      resetPaymentFlow();
      setSelectedPayableId(null);
      await fetchRows();
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Conta a pagar",
        message: getUserFacingApiErrorMessage(
          error,
          "Não foi possível registrar o pagamento.",
        ),
      });
    }
  };

  const parsedRawAmount = parseCurrencyToNumber(amount);
  const parsedInstallmentCount = Math.max(1, Number(installmentCount) || 1);
  const parsedTotalAmount =
    payableFormMode === "create" && amountMode === "INSTALLMENT"
      ? roundCurrency(parsedRawAmount * parsedInstallmentCount)
      : parsedRawAmount;
  const installmentsPreview =
    payableFormMode === "create"
      ? buildPayableInstallmentsPreview(
          parsedTotalAmount,
          parsedInstallmentCount,
          dueDate,
        )
      : [];
  const previewMidpoint = Math.ceil(installmentsPreview.length / 2);
  const leftInstallmentsPreview = installmentsPreview.slice(0, previewMidpoint);
  const rightInstallmentsPreview = installmentsPreview.slice(previewMidpoint);

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-3 pb-1 pt-8 font-editorial text-[2rem] font-extralight leading-[0.98] tracking-tight text-primary md:text-[2.35rem] md:leading-tight">
        A Pagar
      </h1>

      <CustomerModal
        open={isCreateFormOpen}
        onClose={() => {
          setIsCreateFormOpen(false);
          resetPayableForm();
        }}
        title={
          payableFormMode === "create"
            ? "Nova Conta a Pagar"
            : "Editar Conta a Pagar"
        }
        subtitle="Preencha os dados da conta a pagar."
      >
        <div className="space-y-4">
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-lowest px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-primary">
                  Descrição
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-primary">
                  Categoria
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setCategoryOptionsOpen(true);
                      }}
                      onFocus={() => setCategoryOptionsOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setCategoryOptionsOpen(false);
                        }, 120);
                      }}
                      placeholder="Digite ou selecione..."
                      className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                    />
                    {categoryOptionsOpen && filteredCategoryOptions.length > 0 ? (
                      <div className="absolute top-full z-20 mt-1 w-full overflow-hidden border border-outline-variant/60 bg-white shadow-lg">
                        <div className="max-h-56 overflow-y-auto">
                          {filteredCategoryOptions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setCategory(item.description);
                                setCategoryOptionsOpen(false);
                              }}
                              className="block w-full border-b border-outline-variant/30 px-3 py-3 text-left text-[15px] text-primary last:border-b-0 hover:bg-surface-low"
                            >
                              {item.description}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryDescription(category.trim());
                      setCategoryModalOpen(true);
                    }}
                    className="h-11 rounded border border-outline-variant/60 bg-white px-4 text-lg font-semibold text-primary"
                    aria-label="Adicionar categoria"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-primary">
                  Fornecedor
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                >
                  <option value="">Selecione...</option>
                  {suppliers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className=" bg-white px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {payableFormMode === "create" ? (
                <div className="md:col-span-2">
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-sm font-medium text-primary">
                      <input
                        type="radio"
                        name="payable-amount-mode"
                        checked={amountMode === "INSTALLMENT"}
                        onChange={() => setAmountMode("INSTALLMENT")}
                        className="h-4 w-4 border-outline-variant/60 text-primary focus:ring-primary"
                      />
                      Valor da parcela
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-primary">
                      <input
                        type="radio"
                        name="payable-amount-mode"
                        checked={amountMode === "TOTAL"}
                        onChange={() => setAmountMode("TOTAL")}
                        className="h-4 w-4 border-outline-variant/60 text-primary focus:ring-primary"
                      />
                      Valor total
                    </label>
                  </div>
                </div>
              ) : null}
              {payableFormMode === "create" ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-primary">
                    Quantidade de parcelas
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={installmentCount}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      if (!nextValue) {
                        setInstallmentCount("");
                        return;
                      }

                      setInstallmentCount(
                        String(Math.max(1, Number(nextValue) || 1)),
                      );
                    }}
                    className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                  />
                </div>
              ) : null}
              <div>
                <label className="mb-1 block text-sm font-semibold text-primary">
                  {payableFormMode === "create"
                    ? amountMode === "INSTALLMENT"
                      ? "Valor da parcela"
                      : "Valor total"
                    : "Valor"}
                </label>
                <input
                  value={amount}
                  onChange={(e) =>
                    setAmount(formatCurrencyInput(e.target.value))
                  }
                  placeholder="R$ 0,00"
                  className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                />
                {payableFormMode === "create" ? (
                  <p className="mt-1 text-xs text-neutral-700">
                    {amountMode === "INSTALLMENT"
                      ? `Total calculado automaticamente: ${formatCurrency(parsedTotalAmount)}`
                      : "O valor total será distribuído entre as parcelas."}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-primary">
                  {payableFormMode === "create"
                    ? "Primeiro vencimento"
                    : "Vencimento"}
                </label>
                <DatePickerInput
                  value={dueDate}
                  onChange={setDueDate}
                  format="iso"
                  className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-primary">
                  Forma de pagamento
                </label>
                <select
                  value={plannedPaymentTypeId}
                  onChange={(e) => setPlannedPaymentTypeId(e.target.value)}
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
            </div>
          </section>
          {payableFormMode === "create" && installmentsPreview.length > 0 ? (
            <div className="md:col-span-2 rounded border border-outline-variant/60 bg-white px-3 py-3">
              <p className="text-sm font-semibold text-primary">
                Prévia das parcelas
              </p>
              <p className="mt-1 text-sm text-neutral-700">
                {amountMode === "INSTALLMENT"
                  ? `${parsedInstallmentCount} parcelas de ${formatCurrency(parsedRawAmount)} cada. Total final: ${formatCurrency(parsedTotalAmount)}.`
                  : `${parsedInstallmentCount} parcelas geradas a partir do total de ${formatCurrency(parsedTotalAmount)}.`}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  {leftInstallmentsPreview.map((item) => (
                    <div
                      key={`${item.installmentNumber}-${item.dueDate}`}
                      className="rounded bg-surface-lowest px-3 py-2 text-sm text-primary"
                    >
                      <span className="font-semibold">
                        {item.installmentNumber}/{parsedInstallmentCount}
                      </span>{" "}
                      • {formatCurrency(item.amount)} • vence em{" "}
                      {formatDate(item.dueDate)}
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  {rightInstallmentsPreview.map((item) => (
                    <div
                      key={`${item.installmentNumber}-${item.dueDate}`}
                      className="rounded bg-surface-lowest px-3 py-2 text-sm text-primary"
                    >
                      <span className="font-semibold">
                        {item.installmentNumber}/{parsedInstallmentCount}
                      </span>{" "}
                      • {formatCurrency(item.amount)} • vence em{" "}
                      {formatDate(item.dueDate)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmitPayable}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              {payableFormMode === "create"
                ? "Adicionar conta a pagar"
                : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreateFormOpen(false);
                resetPayableForm();
              }}
              className="rounded border border-outline-variant/60 bg-white px-4 py-2 text-sm font-medium text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      </CustomerModal>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <label className="mb-1 block text-sm font-semibold text-primary">
            Visão
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as PayableFilter)}
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
          <label className="mb-1 block text-sm font-semibold text-primary">
            Buscar
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Fornecedor, categoria ou descrição"
            className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
          />
        </div>

        <div className="md:min-w-52">
          <label className="mb-1 block text-sm font-semibold text-primary">
            Categoria
          </label>
          <input
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            list="payables-category-filter-options"
            placeholder="Digite para filtrar"
            className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
          />
          <datalist id="payables-category-filter-options">
            {financialCategories.map((item) => (
              <option key={item.id} value={item.description} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              De
            </label>
            <DatePickerInput
              value={startDate}
              onChange={setStartDate}
              format="short"
              placeholder="dd/mm/aa"
              className="h-11 min-w-44 rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Até
            </label>
            <DatePickerInput
              value={endDate}
              onChange={setEndDate}
              format="short"
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="bg-surface-lowest p-4">
            <p className="text-xs uppercase text-neutral-700">Valor total</p>
            <p className="text-lg font-semibold text-primary">
              {showSummaryValues
                ? formatCurrency(summary.totalAmount)
                : HIDDEN_VALUE}
            </p>
          </div>
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
            <p className="text-xs uppercase text-neutral-700">Lançamentos</p>
            <p className="text-lg font-semibold text-primary">{totalRows}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading
            ? "Carregando contas a pagar..."
            : `${totalRows} conta(s) a pagar encontrada(s).`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={handleOpenCreatePayable}>
            Incluir
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenEditPayable}
            disabled={!canManageSelectedPayable}
          >
            Alterar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDeletePayable}
            disabled={!canManageSelectedPayable}
          >
            Excluir
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenPaymentForm}
            disabled={
              !selectedPayableId ||
              !rows.some(
                (row) =>
                  row.id === selectedPayableId &&
                  row.filter !== "PAGAS" &&
                  row.openAmount > 0,
              )
            }
          >
            Quitar
          </Button>
        </div>
      </div>

      {message && <p className="mb-4 text-sm text-neutral-700">{message}</p>}

      <div className="grid gap-3 md:hidden">
        {loading ? (
          <div className="rounded border border-outline-variant/45 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
            Carregando...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded border border-outline-variant/45 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
            Nenhuma conta a pagar encontrada.
          </div>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => handleSelectRow(row.id)}
              className={`rounded border px-4 py-4 text-left transition-colors ${
                selectedPayableId === row.id
                  ? "border-primary/50 bg-surface"
                  : "border-outline-variant/45 bg-surface-lowest"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {row.description}
                  </p>
                  <p className="mt-1 truncate text-sm text-neutral-700">
                    {row.supplierName || row.beneficiary}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedPayableId === row.id}
                  onChange={() => handleToggleRowSelection(row.id)}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Selecionar conta a pagar ${row.description}`}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                    row.category,
                  )}`}
                >
                  {row.category}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                    Vencimento
                  </p>
                  <p className="mt-1 text-primary">{formatDate(row.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                    Forma
                  </p>
                  <p className="mt-1 text-primary">
                    {row.plannedPaymentTypeName || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                    Valor
                  </p>
                  <p className="mt-1 text-primary">{formatCurrency(row.amount)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                    Pago
                  </p>
                  <p className="mt-1 text-primary">
                    {formatCurrency(row.paidAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
                  Saldo
                </p>
                <p className="mt-1 text-base font-semibold text-primary">
                  {formatCurrency(row.openAmount)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead className="bg-[#dbd1d1] rounded-t-md">
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Descrição
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Fornecedor
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Categoria
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Vencimento
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Forma
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Valor
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Pago
              </th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.2rem] text-primary">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="bg-surface-lowest">
                <td colSpan={9} className="px-4 py-4 text-sm text-neutral-700">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td colSpan={9} className="px-4 py-4 text-sm text-neutral-700">
                  Nenhuma conta a pagar encontrada.
                </td>
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
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {row.description}
                  </td>
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
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {row.plannedPaymentTypeName || "-"}
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
        open={Boolean(activePayableId)}
        onClose={resetPaymentFlow}
        title="Quitar Conta"
        subtitle="Informe os dados do pagamento da conta a pagar."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Forma paga
            </label>
            <select
              value={paymentTypeId}
              onChange={(e) => setPaymentTypeId(e.target.value)}
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
              type="text"
              inputMode="numeric"
              value={paymentAmount}
              onChange={(e) =>
                setPaymentAmount(formatCurrencyInput(e.target.value))
              }
              placeholder="R$ 0,00"
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Data
            </label>
            <DatePickerInput
              value={paidAt}
              onChange={setPaidAt}
              format="iso"
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Referência
            </label>
            <input
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRegisterPayment}
              disabled={!paymentTypeId}
            >
              Confirmar pagamento
            </Button>
            <Button variant="secondary" size="sm" onClick={resetPaymentFlow}>
              Cancelar
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={paymentConfirmOpen && Boolean(activePayableId)}
        onClose={resetPaymentFlow}
        title="Confirmar quitação"
        subtitle="Confirme o pagamento da conta a pagar."
        size="sm"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
            <p className="text-sm text-primary">
              Deseja confirmar o pagamento informado?
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmRegisterPayment}
            >
              Confirmar
            </Button>
            <Button variant="secondary" size="sm" onClick={resetPaymentFlow}>
              Cancelar
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={deleteConfirmOpen && Boolean(selectedRow)}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirmar exclusão"
        subtitle="Confirme a exclusão da conta a pagar."
        size="sm"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4">
            <p className="text-sm text-primary">
              Deseja excluir a conta a pagar selecionada?
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmDeletePayable}
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
      </CustomerModal>

      <CustomerModal
        open={categoryModalOpen}
        onClose={() => {
          if (creatingCategory) return;
          setCategoryModalOpen(false);
          setNewCategoryDescription("");
        }}
        title="Nova Categoria"
        subtitle="Cadastre uma categoria financeira para usar no A Pagar."
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-primary">
              Categoria
            </label>
            <input
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              className="h-11 w-full rounded border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
              placeholder="Informe a categoria"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCreateFinancialCategory()}
              isLoading={creatingCategory}
            >
              Salvar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCategoryModalOpen(false);
                setNewCategoryDescription("");
              }}
              disabled={creatingCategory}
            >
              Cancelar
            </Button>
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
