import { useEffect, useMemo, useState } from "react";
import CustomerModal from "../components/CustomerModal";
import DatePickerInput from "../components/DatePickerInput";
import NoticeToast from "../components/NoticeToast";
import { getRequest, postRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { getCategoryBadgeClassName } from "../utils/categoryBadge";
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyToNumber,
} from "../utils/currency";
import { formatLegacyShortDateInput } from "../utils/legacyDate";

interface CashRow {
  id: number;
  date: string;
  scope: "LOJA" | "PESSOAL";
  accountLabel?: string | null;
  parcela?: string;
  description: string;
  paymentTypeName?: string | null;
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

interface FinancialListSummary {
  totalIn: number;
  totalOut: number;
  balance: number;
  previousBalance: number;
}

interface CashListResponse {
  items: CashRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: FinancialListSummary;
}

interface BankListResponse {
  items: BankRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: FinancialListSummary;
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

interface PaymentTypeOption {
  id: number;
  name: string;
  kind: string | null;
  active: boolean;
  requiresDueDate: boolean;
  allowsEntryAmount: boolean;
  allowedEntryPaymentKinds: string[];
  allowsInstallments: boolean;
  maxInstallments: number | null;
  defaultInstallments: number;
  financialFlow: "IMMEDIATE_CASH" | "FUTURE_CUSTOMER";
}

type UnifiedRow = {
  key: string;
  id: number;
  origin: "cash" | "bank";
  originLabel: "Caixa" | "Banco";
  sourceType: string;
  date: string;
  accountLabel?: string | null;
  bank?: string;
  parcela?: string;
  description: string;
  paymentTypeName?: string | null;
  category: string;
  financialCategoryId: number | null;
  movementType?: "IN" | "OUT";
  amountIn: number;
  amountOut: number;
  balance: number;
  canReverse: boolean;
};

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
const FETCH_BATCH_SIZE = 200;

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
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(dateString),
  );

const normalizePaymentTypeName = (value?: string | null) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const isCashPaymentType = (paymentType: PaymentTypeOption | null) =>
  normalizePaymentTypeName(paymentType?.name) === "DINHEIRO" ||
  (paymentType?.kind === "CASH" &&
    paymentType.financialFlow === "IMMEDIATE_CASH");

const resolveUnifiedPaymentTypeName = (
  origin: "cash" | "bank",
  sourceType: string,
  paymentTypeName?: string | null,
) => {
  if (String(paymentTypeName || "").trim()) {
    return paymentTypeName;
  }

  if (String(sourceType || "").trim().toUpperCase() === "MANUAL") {
    return "DINHEIRO";
  }

  return origin === "cash" ? "DINHEIRO" : null;
};

const buildFinancialQueryParams = ({
  search,
  categoryFilter,
  startDate,
  endDate,
  page,
  pageSize,
}: {
  search: string;
  categoryFilter: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
}) => {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (search.trim()) params.set("search", search.trim());
  if (categoryFilter) params.set("financialCategoryId", categoryFilter);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  return params;
};

async function fetchAllRows<T extends { items: unknown[]; totalPages: number }>(
  endpoint: "/cash" | "/bank",
  filters: {
    search: string;
    categoryFilter: string;
    startDate: string;
    endDate: string;
  },
) {
  const firstParams = buildFinancialQueryParams({
    ...filters,
    page: 1,
    pageSize: FETCH_BATCH_SIZE,
  });
  const firstResponse = (await getRequest(
    `${endpoint}?${firstParams.toString()}`,
  )) as T;
  const items = Array.isArray(firstResponse.items)
    ? [...firstResponse.items]
    : [];
  const totalPages = Math.max(1, Number(firstResponse.totalPages) || 1);

  for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
    const nextParams = buildFinancialQueryParams({
      ...filters,
      page: currentPage,
      pageSize: FETCH_BATCH_SIZE,
    });
    const nextResponse = (await getRequest(
      `${endpoint}?${nextParams.toString()}`,
    )) as T;

    if (Array.isArray(nextResponse.items)) {
      items.push(...nextResponse.items);
    }
  }

  return items;
}

export default function Registers() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState(getCurrentSearchDateInputValue());
  const [endDate, setEndDate] = useState(getCurrentSearchDateInputValue());
  const [cashRows, setCashRows] = useState<CashRow[]>([]);
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [overallCashBalance, setOverallCashBalance] = useState(0);
  const [overallBankBalance, setOverallBankBalance] = useState(0);
  const [combinedPreviousBalance, setCombinedPreviousBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionStatus, setSessionStatus] =
    useState<CashSessionStatusResponse | null>(null);
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [manualEntryModalOpen, setManualEntryModalOpen] = useState(false);
  const [rolloverCashModalOpen, setRolloverCashModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [pendingManualCashEntry, setPendingManualCashEntry] = useState(false);
  const [pendingManualLaunchDate, setPendingManualLaunchDate] = useState<
    string | null
  >(null);
  const [manualMovementType, setManualMovementType] = useState<"IN" | "OUT">(
    "IN",
  );
  const [manualFinancialCategoryId, setManualFinancialCategoryId] =
    useState("");
  const [manualFinancialCategoryInput, setManualFinancialCategoryInput] =
    useState("");
  const [manualFinancialCategoryOpen, setManualFinancialCategoryOpen] =
    useState(false);
  const [manualPaymentTypeId, setManualPaymentTypeId] = useState("");
  const [manualAmountInput, setManualAmountInput] = useState("");
  const [manualDate, setManualDate] = useState(getCurrentDateInputValue());
  const [manualDescription, setManualDescription] = useState("");
  const [manualReferenceCode, setManualReferenceCode] = useState("");
  const [financialCategories, setFinancialCategories] = useState<
    FinancialCategoryOption[]
  >([]);
  const [bankAccountOptions, setBankAccountOptions] = useState<
    BankAccountOption[]
  >([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  const filters = useMemo(
    () => ({
      search,
      categoryFilter,
      startDate,
      endDate,
    }),
    [categoryFilter, endDate, search, startDate],
  );

  const selectedPaymentType = useMemo(
    () =>
      paymentTypes.find((item) => String(item.id) === manualPaymentTypeId) ||
      null,
    [manualPaymentTypeId, paymentTypes],
  );

  const filteredManualFinancialCategories = useMemo(() => {
    const normalizedValue = manualFinancialCategoryInput.trim().toLowerCase();

    if (!normalizedValue) {
      return financialCategories;
    }

    return financialCategories.filter((category) =>
      category.description.toLowerCase().includes(normalizedValue),
    );
  }, [financialCategories, manualFinancialCategoryInput]);

  const unifiedRows = useMemo<UnifiedRow[]>(
    () =>
      [
        ...cashRows.map((row) => ({
          key: `cash-${row.id}`,
          id: row.id,
          origin: "cash" as const,
          originLabel: "Caixa" as const,
          sourceType: row.sourceType,
          date: row.date,
          accountLabel: row.accountLabel,
          parcela: row.parcela,
          description: row.description,
          paymentTypeName: resolveUnifiedPaymentTypeName(
            "cash",
            row.sourceType,
            row.paymentTypeName,
          ),
          category: row.category,
          financialCategoryId: row.financialCategoryId,
          movementType: row.movementType,
          amountIn: Number(row.amountIn || 0),
          amountOut: Number(row.amountOut || 0),
          balance: 0,
          canReverse: Boolean(row.canReverse),
        })),
        ...bankRows.map((row) => ({
          key: `bank-${row.id}`,
          id: row.id,
          origin: "bank" as const,
          originLabel: "Banco" as const,
          sourceType: row.sourceType,
          date: row.date,
          accountLabel: row.accountLabel,
          bank: row.bank,
          parcela: row.parcela,
          description: row.description,
          paymentTypeName: resolveUnifiedPaymentTypeName(
            "bank",
            row.sourceType,
            row.paymentTypeName,
          ),
          category: row.category,
          financialCategoryId: row.financialCategoryId,
          amountIn: Number(row.amountIn || 0),
          amountOut: Number(row.amountOut || 0),
          balance: 0,
          canReverse: Boolean(row.canReverse),
        })),
      ]
        .sort((left, right) => {
          const dateDifference =
            new Date(left.date).getTime() - new Date(right.date).getTime();

          if (dateDifference !== 0) {
            return dateDifference;
          }

          return left.id - right.id;
        })
        .reduce<UnifiedRow[]>((accumulator, row) => {
          const previousBalance =
            accumulator[accumulator.length - 1]?.balance || 0;
          const currentBalance =
            previousBalance + Number(row.amountIn || 0) - Number(row.amountOut || 0);

          accumulator.push({
            ...row,
            balance: currentBalance,
          });

          return accumulator;
        }, [])
        .reverse(),
    [bankRows, cashRows],
  );

  const selectedRow = useMemo(
    () => unifiedRows.find((row) => row.key === selectedRowKey) || null,
    [selectedRowKey, unifiedRows],
  );

  const currentSession = sessionStatus?.currentSession || null;
  const requiresOpenStoreSession = !currentSession;
  const currentCashLaunchDateLabel = formatDate(
    pendingManualLaunchDate || getCurrentDateInputValue(),
  );
  const previousCashLaunchDateLabel = currentSession
    ? formatDate(currentSession.openedAt)
    : "-";
  const totalRows = unifiedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => unifiedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, unifiedRows],
  );

  const periodSummary = useMemo(() => {
    const totalIn = unifiedRows.reduce((sum, row) => sum + row.amountIn, 0);
    const totalOut = unifiedRows.reduce((sum, row) => sum + row.amountOut, 0);

    return {
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
    };
  }, [unifiedRows]);

  const totalCombinedBalance = useMemo(
    () => overallCashBalance + overallBankBalance,
    [overallBankBalance, overallCashBalance],
  );

  const defaultBankAccount = bankAccountOptions[0]?.value || "";

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, endDate, search, startDate]);

  useEffect(() => {
    if (
      selectedRowKey &&
      !unifiedRows.some((row) => row.key === selectedRowKey)
    ) {
      setSelectedRowKey(null);
    }
  }, [selectedRowKey, unifiedRows]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const fetchSessionStatus = async () => {
    try {
      const data = await getRequest("/cash/session-status");
      setSessionStatus((data as CashSessionStatusResponse) || null);
    } catch {
      setSessionStatus(null);
    }
  };

  const fetchOverallCashBalance = async () => {
    try {
      const data = (await getRequest("/cash?page=1&pageSize=1")) as CashListResponse;
      setOverallCashBalance(Number(data.summary?.balance || 0));
    } catch {
      setOverallCashBalance(0);
    }
  };

  const fetchOverallBankBalance = async () => {
    try {
      const data = (await getRequest("/bank?page=1&pageSize=1")) as BankListResponse;
      const latestRowBalance = Array.isArray(data.items)
        ? Number(data.items[0]?.balance || 0)
        : 0;
      setOverallBankBalance(
        latestRowBalance || Number(data.summary?.balance || 0),
      );
    } catch {
      setOverallBankBalance(0);
    }
  };

  const fetchCombinedPreviousBalance = async () => {
    try {
      const cashParams = buildFinancialQueryParams({
        ...filters,
        page: 1,
        pageSize: 1,
      });
      const bankParams = buildFinancialQueryParams({
        ...filters,
        page: 1,
        pageSize: 1,
      });

      const [cashData, bankData] = await Promise.all([
        getRequest(`/cash?${cashParams.toString()}`) as Promise<CashListResponse>,
        getRequest(`/bank?${bankParams.toString()}`) as Promise<BankListResponse>,
      ]);

      setCombinedPreviousBalance(
        Number(cashData.summary?.previousBalance || 0) +
          Number(bankData.summary?.previousBalance || 0),
      );
    } catch {
      setCombinedPreviousBalance(0);
    }
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

  const fetchPaymentTypes = async () => {
    try {
      const data = await getRequest("/payment-types");
      setPaymentTypes(
        ((Array.isArray(data) ? data : []) as PaymentTypeOption[])
          .map((item) => ({
            id: Number(item.id),
            name: item.name,
            kind: item.kind,
            active: Boolean(item.active),
            requiresDueDate: Boolean(item.requiresDueDate),
            allowsEntryAmount: Boolean(item.allowsEntryAmount),
            allowedEntryPaymentKinds: item.allowedEntryPaymentKinds || [],
            allowsInstallments: Boolean(item.allowsInstallments),
            maxInstallments:
              item.maxInstallments === null || item.maxInstallments === undefined
                ? null
                : Number(item.maxInstallments),
            defaultInstallments: Number(item.defaultInstallments || 1),
            financialFlow: item.financialFlow,
          }))
          .filter((item) => item.active),
      );
    } catch {
      setPaymentTypes([]);
    }
  };

  const fetchFinancialData = async () => {
    const [cashData, bankData] = await Promise.all([
      fetchAllRows<CashListResponse>("/cash", filters),
      fetchAllRows<BankListResponse>("/bank", filters),
    ]);

    setCashRows(cashData as CashRow[]);
    setBankRows(bankData as BankRow[]);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        await fetchFinancialData();
        void fetchSessionStatus();
        void fetchFinancialCategories();
        void fetchBankAccountOptions();
        void fetchPaymentTypes();
        void fetchOverallCashBalance();
        void fetchOverallBankBalance();
        void fetchCombinedPreviousBalance();
      } catch (err: unknown) {
        setCashRows([]);
        setBankRows([]);
        setOverallCashBalance(0);
        setOverallBankBalance(0);
        setCombinedPreviousBalance(0);
        setError(
          getUserFacingApiErrorMessage(
            err,
            "Nao foi possivel carregar as movimentacoes financeiras.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [filters]);

  const resetOpenModal = () => {
    setSessionNotes("");
    setOpenSessionModal(false);
  };

  const resetManualEntryModal = () => {
    setManualMovementType("IN");
    setManualFinancialCategoryId("");
    setManualFinancialCategoryInput("");
    setManualFinancialCategoryOpen(false);
    setManualPaymentTypeId("");
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

  const handleManualFinancialCategoryChange = (nextValue: string) => {
    setManualFinancialCategoryInput(nextValue);
    setManualFinancialCategoryOpen(true);

    const normalizedValue = String(nextValue || "").trim().toLowerCase();
    const matchedCategory = financialCategories.find(
      (category) => category.description.trim().toLowerCase() === normalizedValue,
    );

    setManualFinancialCategoryId(
      matchedCategory ? String(matchedCategory.id) : "",
    );
  };

  const handleSelectManualFinancialCategory = (
    selectedCategory: FinancialCategoryOption,
  ) => {
    setManualFinancialCategoryInput(selectedCategory.description);
    setManualFinancialCategoryId(String(selectedCategory.id));
    setManualFinancialCategoryOpen(false);
  };

  async function refreshData() {
    await Promise.all([
      fetchFinancialData(),
      fetchSessionStatus(),
      fetchBankAccountOptions(),
      fetchPaymentTypes(),
      fetchOverallCashBalance(),
      fetchOverallBankBalance(),
      fetchCombinedPreviousBalance(),
    ]);
  }

  async function ensureCashSessionBeforeManualEntry() {
    try {
      const params = new URLSearchParams();
      if (manualDate) {
        params.set("referenceDate", manualDate);
      }

      const data = await getRequest(
        `/cash/session-status${params.size ? `?${params.toString()}` : ""}`,
      );
      const parsed = (data as CashSessionStatusResponse) || null;
      setSessionStatus(parsed);

      if (parsed?.currentSession?.pendingPreviousDay) {
        setPendingManualCashEntry(true);
        setPendingManualLaunchDate(manualDate);
        setRolloverCashModalOpen(true);
        return false;
      }

      if (!parsed?.hasOpenSession || !parsed.currentSession) {
        setPendingManualCashEntry(true);
        setPendingManualLaunchDate(manualDate);
        setOpenSessionModal(true);
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

  async function handleOpenSession() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/sessions/open", {
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

      if (pendingManualCashEntry) {
        setPendingManualCashEntry(false);
        await handleCreateManualEntry({ skipCashValidation: true });
      }
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

  async function handleCreateManualEntry(options?: { skipCashValidation?: boolean }) {
    const shouldCreateInCash = isCashPaymentType(selectedPaymentType);

    if (shouldCreateInCash && !options?.skipCashValidation) {
      if (!(await ensureCashSessionBeforeManualEntry())) {
        return;
      }
    }

    if (!shouldCreateInCash && !defaultBankAccount) {
      setToast({
        open: true,
        tone: "warning",
        title: "Conta bancaria nao encontrada",
        message:
          "Nao foi encontrada uma conta bancaria disponivel para esse lancamento.",
      });
      return;
    }

    const manualLaunchDate = manualDate;

    try {
      setSessionActionLoading(true);

      if (shouldCreateInCash) {
        await postRequest("/cash/manual-entry", {
          movementType: manualMovementType,
          financialCategoryId: Number(manualFinancialCategoryId),
          amount: parseCurrencyToNumber(manualAmountInput),
          occurredAt: manualDate,
          description: manualDescription.trim(),
          referenceCode: manualReferenceCode.trim() || null,
        });
      } else {
        await postRequest("/bank/manual-entry", {
          movementType: manualMovementType,
          financialCategoryId: Number(manualFinancialCategoryId),
          amount: parseCurrencyToNumber(manualAmountInput),
          occurredAt: manualDate,
          description: manualDescription.trim(),
          referenceCode: manualReferenceCode.trim() || null,
          accountLabel: defaultBankAccount,
        });
      }

      setStartDate(formatLegacyShortDateInput(manualLaunchDate));
      setEndDate(getCurrentSearchDateInputValue());
      setPage(1);
      setPendingManualCashEntry(false);
      setPendingManualLaunchDate(null);
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

  async function handleRolloverCashSession() {
    try {
      setSessionActionLoading(true);
      await postRequest("/cash/sessions/rollover", {
        notes: null,
      });

      await refreshData();
      setRolloverCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa atualizado",
        message:
          "O caixa pendente foi encerrado e o caixa do dia foi aberto.",
      });

      if (pendingManualCashEntry) {
        setPendingManualCashEntry(false);
        await handleCreateManualEntry({ skipCashValidation: true });
      }
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
      setSessionActionLoading(false);
    }
  }

  async function handleReverseEntry() {
    if (!selectedRow) return;

    try {
      setSessionActionLoading(true);
      await postRequest(`/${selectedRow.origin}/${selectedRow.id}/reverse`, {
        reason: reverseReason.trim(),
      });
      resetReverseModal();
      await refreshData();
      setToast({
        open: true,
        tone: "success",
        title: "Extorno registrado",
        message:
          selectedRow.origin === "cash"
            ? "O extorno do caixa foi registrado com sucesso."
            : "O extorno bancario foi registrado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel extornar",
        message: getUserFacingApiErrorMessage(
          err,
          selectedRow.origin === "cash"
            ? "Nao foi possivel extornar o lancamento do caixa."
            : "Nao foi possivel extornar o lancamento bancario.",
        ),
      });
    } finally {
      setSessionActionLoading(false);
    }
  }

  const handleSelectRow = (rowKey: string) => {
    const row = unifiedRows.find((item) => item.key === rowKey);

    if (!row?.canReverse) {
      return;
    }

    setSelectedRowKey((current) => (current === rowKey ? null : rowKey));
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-3 pb-1 pt-8 font-editorial text-[2rem] font-extralight leading-[0.98] tracking-tight text-primary md:text-[2.35rem] md:leading-tight">
        Caixa
      </h1>

      <section className="mb-5">
        <div className="w-[30%]">
          <div className="bg-surface-lowest p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-neutral-700">
              Saldo geral
            </p>
            <p className="mt-2 text-[1.3rem] leading-none text-primary md:text-[1.5rem]">
              {formatCurrency(totalCombinedBalance)}
            </p>
          </div>
        </div>
      </section>

      {requiresOpenStoreSession ? (
        <div className="mb-5 flex flex-col gap-3 rounded border border-outline-variant/40 bg-surface-lowest p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">
              Caixa da loja fechado
            </p>
            <p className="text-sm text-neutral-700">
              Lancamentos em dinheiro exigem um caixa aberto.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenSessionModal(true)}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Abrir caixa
          </button>
        </div>
      ) : null}

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
            Buscar historico
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descricao, categoria, banco ou forma de pagamento"
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          />
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
            <DatePickerInput
              value={startDate}
              onChange={setStartDate}
              format="short"
              placeholder="dd/mm/aa"
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">
              Ate
            </label>
            <DatePickerInput
              value={endDate}
              onChange={setEndDate}
              format="short"
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
          <p className="text-xs uppercase text-neutral-700">Entradas no periodo</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(periodSummary.totalIn)}
          </p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saidas no periodo</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(periodSummary.totalOut)}
          </p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo no periodo</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(periodSummary.balance)}
          </p>
        </div>
      </div>

      <div className="hidden overflow-auto md:block">
        <table className="mt-2 min-w-[1220px] w-full border-separate border-spacing-y-2">
          <thead className="rounded-t-md bg-[#dbd1d1]">
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Data
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Parcela
              </th>
              <th className="w-[180px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Categoria
              </th>
              <th className="min-w-[320px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
                Historico
              </th>
              <th className="w-[170px] px-4 pt-2 font-editorial text-[1.2rem] text-primary">
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
                  Carregando lancamentos...
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhuma movimentacao encontrada.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr
                  key={row.key}
                  onClick={() => handleSelectRow(row.key)}
                  className={`cursor-pointer transition-colors ${
                    selectedRowKey === row.key
                      ? "bg-surface"
                      : "bg-surface-lowest hover:bg-surface"
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRowKey === row.key}
                      onChange={() => handleSelectRow(row.key)}
                      onClick={(event) => event.stopPropagation()}
                      disabled={!row.canReverse}
                      aria-label={`Selecionar lancamento ${row.description}`}
                      className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-4 py-3 text-[14px] uppercase text-neutral-700">
                    {row.parcela || "-"}
                  </td>
                  <td className="w-[180px] px-4 py-3 text-[14px] text-neutral-700">
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
                  <td className="w-[170px] whitespace-nowrap px-4 py-3 text-[14px] text-neutral-700">
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
            Carregando lancamentos...
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhuma movimentacao encontrada.
          </div>
        ) : (
          paginatedRows.map((row) => (
            <div key={row.key} className="px-4 py-4">
              <button
                type="button"
                onClick={() => handleSelectRow(row.key)}
                disabled={!row.canReverse}
                className="block w-full text-left disabled:cursor-default disabled:opacity-100"
              >
                <p className="mb-2 text-sm font-semibold text-primary">
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
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          {loading
            ? "Carregando..."
            : `${totalRows} lancamento(s) | Pagina ${page} de ${totalPages}`}
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

      <div className="mt-2 flex justify-end">
        <p className="text-sm font-semibold text-primary">
          Saldo anterior: {formatCurrency(combinedPreviousBalance)}
        </p>
      </div>

      <CustomerModal
        open={manualEntryModalOpen}
        onClose={resetManualEntryModal}
        title="Incluir lancamento manual"
        subtitle="Registre uma entrada ou saida e escolha a forma de pagamento."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                Forma de pagamento
              </label>
              <select
                value={manualPaymentTypeId}
                onChange={(e) => setManualPaymentTypeId(e.target.value)}
                className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
              >
                <option value="">Selecione</option>
                {paymentTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-primary">
                Categoria
              </label>
              <div className="relative">
                <input
                  value={manualFinancialCategoryInput}
                  onChange={(e) =>
                    handleManualFinancialCategoryChange(e.target.value)
                  }
                  onFocus={() => setManualFinancialCategoryOpen(true)}
                  onBlur={() => {
                    window.setTimeout(() => {
                      setManualFinancialCategoryOpen(false);
                    }, 120);
                  }}
                  placeholder="Digite ou selecione"
                  className="h-11 w-full rounded border border-outline-variant/50 bg-white px-4 text-[15px] text-primary"
                />
                {manualFinancialCategoryOpen &&
                filteredManualFinancialCategories.length > 0 ? (
                  <div className="absolute top-full z-20 mt-1 w-full overflow-hidden border border-outline-variant/50 bg-white shadow-lg">
                    <div className="max-h-56 overflow-y-auto">
                      {filteredManualFinancialCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSelectManualFinancialCategory(category);
                          }}
                          className="block w-full border-b border-outline-variant/30 px-4 py-3 text-left text-[15px] text-primary last:border-b-0 hover:bg-surface-low"
                        >
                          {category.description}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
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
              <DatePickerInput
                value={manualDate}
                onChange={setManualDate}
                format="iso"
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

            <div className="md:col-span-2">
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
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreateManualEntry()}
              disabled={
                sessionActionLoading ||
                !manualPaymentTypeId ||
                !manualFinancialCategoryId ||
                !manualAmountInput ||
                !manualDescription.trim()
              }
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Salvando..." : "Confirmar"}
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
        title={
          selectedRow?.origin === "bank"
            ? "Extornar lancamento bancario"
            : "Extornar lancamento"
        }
        subtitle={
          selectedRow?.origin === "bank"
            ? "Confirme a criacao do lancamento inverso no banco."
            : "Confirme a criacao do lancamento inverso no caixa."
        }
      >
        <div className="space-y-4">
          {selectedRow ? (
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>Origem: {selectedRow.originLabel}</p>
              <p>Data: {formatDate(selectedRow.date)}</p>
              <p>Categoria: {selectedRow.category}</p>
              <p>Descricao: {selectedRow.description}</p>
              <p>Conta: {selectedRow.accountLabel || selectedRow.bank || "-"}</p>
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
              onClick={() => void handleReverseEntry()}
              disabled={
                sessionActionLoading ||
                !selectedRow?.canReverse ||
                !reverseReason.trim()
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
              onClick={() => void handleOpenSession()}
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
        open={rolloverCashModalOpen}
        onClose={() => {
          setRolloverCashModalOpen(false);
          setPendingManualCashEntry(false);
          setPendingManualLaunchDate(null);
        }}
        title="Encerrar e abrir caixa da loja"
        subtitle={
          currentSession
            ? `Existe um caixa pendente aberto em ${formatDate(
                currentSession.openedAt,
              )}.`
            : "Feche o caixa da loja para continuar."
        }
      >
        <div className="space-y-4">
          {currentSession ? (
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
              onClick={() => void handleRolloverCashSession()}
              disabled={sessionActionLoading}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {sessionActionLoading ? "Confirmando..." : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRolloverCashModalOpen(false);
                setPendingManualCashEntry(false);
                setPendingManualLaunchDate(null);
              }}
              className="rounded border border-outline-variant/50 px-4 py-2 text-sm text-primary"
            >
              Voltar
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
