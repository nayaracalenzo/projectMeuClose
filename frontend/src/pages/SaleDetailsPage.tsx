import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormControl, MenuItem, Select } from "@mui/material";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import DatePickerInput from "../components/DatePickerInput";
import NoticeToast from "../components/NoticeToast";
import SearchableSelect from "../components/SearchableSelect";
import ReferenceImagePreview from "../components/ReferenceImagePreview";
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
  type UploadedReferenceImage,
} from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";
import { parseLegacyOrIsoDate } from "../utils/legacyDate";

type SaleDetailItem = {
  id: number;
  productId: number | null;
  itemType: string;
  productMode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  grossAmount: number;
  discountAmount: number;
  subtotal: number;
  metadata: Record<string, unknown> | null;
  isCancelled?: boolean;
  cancellation?: {
    cancelledAt: string | null;
    reason: string | null;
    resolution: string | null;
    refundAmount: number;
    creditAmount: number;
  } | null;
  productStatus: string | null;
  seamstress: string | null;
  fittingDate: string | null;
};

type SaleReceipt = {
  id: number;
  saleId: number;
  receivableInstallmentId: number | null;
  receiptType: "ENTRY" | "SALE_FULL" | "INSTALLMENT" | "CUSTOMER_CREDIT";
  amount: number;
  paidAt: string;
  referenceCode: string | null;
  accountLabel: string | null;
  paymentType: {
    id: number;
    name: string;
  } | null;
};

type SaleInstallment = {
  deletionAuditId?: number | null;
  waivedAmount?: number;
  id: number;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  openAmount: number;
  status: string;
  paymentType: {
    id: number;
    name: string;
  } | null;
};

type PaymentTypeOption = {
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
};

type CustomerOption = {
  id: number;
  name: string;
};

type CustomersResponse = {
  items?: Array<{
    id: number;
    fullName?: string | null;
    companyName?: string | null;
  }>;
};

type SaleDetailsResponse = {
  id: number;
  status: string;
  doesNotGenerateDebt: boolean;
  internalReason: string | null;
  debtExemptionLabel: string | null;
  customer: {
    id: number;
    name: string;
  } | null;
  user: {
    id: number;
    name: string;
  } | null;
  paymentType: {
    id: number;
    name: string;
  } | null;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  totalAmount: number;
  finalAmount: number;
  dueDate: string | null;
  installmentCount: number;
  createdAt: string;
  updatedAt: string;
  items: SaleDetailItem[];
  receipts: SaleReceipt[];
  measurementsCount: number;
  netReceivedAmount?: number;
  customerCreditAmount?: number;
  customerCredits?: Array<{
    id: number;
    originalAmount: number;
    balanceAmount: number;
    description: string;
    status: string;
    createdAt: string;
  }>;
  receivable: {
    id: number;
    debtorType: string;
    operatorLabel: string | null;
    supplierId: number | null;
    supplierName: string | null;
    originType: "CUSTOMER" | "SUPPLIER" | "CARD_OPERATOR";
    originLabel: string;
    originName: string;
    originalAmount: number;
    waivedAmount: number;
    openAmount: number;
    status: string;
    installments: SaleInstallment[];
  } | null;
  cardTransaction: {
    id: number;
    operatorLabel: string | null;
    cardBrand: string | null;
    authorizationCode: string | null;
    clientInstallmentCount: number;
    grossAmount: number;
    entryAmount: number;
    netReceivableAmount: number;
    feeAmount: number;
    expectedSettlementDate: string | null;
    settlementStatus: string;
  } | null;
};

type ToastState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

type SaleDetailsTab = "items" | "receipts" | "receivable";

const EMPTY_TOAST: ToastState = {
  open: false,
  tone: "success",
  message: "",
};

function getItemReferenceImages(item: SaleDetailItem): UploadedReferenceImage[] {
  const value = item.metadata?.referenceImages;
  if (!Array.isArray(value)) return [];

  return value
    .map((image) => {
      const record = image as Partial<UploadedReferenceImage>;
      const id = Number(record.id);
      if (!Number.isInteger(id) || id <= 0) return null;

      return {
        id,
        originalName: String(record.originalName || "referencia"),
        mimeType: String(record.mimeType || ""),
        sizeBytes: Math.max(0, Number(record.sizeBytes) || 0),
      };
    })
    .filter((image): image is UploadedReferenceImage => Boolean(image));
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = parseLegacyOrIsoDate(value);
  if (!date || Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatItemDiscount(item: SaleDetailItem) {
  if (!item.discountType || !item.discountValue || item.discountAmount <= 0) {
    return item.discountAmount > 0
      ? formatCurrency(item.discountAmount)
      : "Sem desconto";
  }

  if (item.discountType === "PERCENTAGE") {
    return `${item.discountValue.toFixed(2)}% (${formatCurrency(item.discountAmount)})`;
  }

  return formatCurrency(item.discountValue);
}

function formatReceiptType(receiptType: SaleReceipt["receiptType"]) {
  if (receiptType === "ENTRY") return "Entrada";
  if (receiptType === "SALE_FULL") return "Venda a vista";
  if (receiptType === "CUSTOMER_CREDIT") return "Credito da cliente";
  return "Parcela";
}

function formatReceivableStatus(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "OPEN") return "Aberto";
  if (normalized === "PARTIAL") return "Parcial";
  if (normalized === "PAID") return "Pago";
  if (normalized === "OVERDUE") return "Vencido";
  if (normalized === "CANCELLED") return "Cancelado";

  return value || "-";
}

function buildReceiptTitle(
  receipt: SaleReceipt,
  installments: SaleInstallment[],
) {
  if (receipt.receiptType !== "INSTALLMENT") {
    return formatReceiptType(receipt.receiptType);
  }

  const installment = installments.find(
    (item) => item.id === receipt.receivableInstallmentId,
  );

  if (!installment) {
    return formatReceiptType(receipt.receiptType);
  }

  return `Parcela ${installment.installmentNumber}/${installment.totalInstallments}`;
}

function formatSaleStatus(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (normalized === "BUDGET") return "Orçamento";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "CANCELLED") return "Cancelado";
  return value || "-";
}

function getSaleStatusBadgeClassName(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (normalized === "CANCELLED") {
    return "border border-[#d8a2ab] bg-[#f7d9dd] text-[#8a1f2d]";
  }

  if (normalized === "BUDGET") {
    return "border border-[#d7c27a] bg-[#f4ebc7] text-[#6b5600]";
  }

  if (normalized === "COMPLETED") {
    return "border border-[#9cc7ad] bg-[#d9efe0] text-[#1f5f3a]";
  }

  return "border border-outline-variant/40 bg-secondary text-primary";
}

function formatSaleItemType(item?: SaleDetailItem | null) {
  const normalizedProductMode = String(item?.productMode || "")
    .trim()
    .toLowerCase();

  if (normalizedProductMode === "sob medida") return "Sob medida";
  if (normalizedProductMode === "ajuste") return "Ajuste";
  if (normalizedProductMode === "reforma") return "Reforma";

  const normalized = String(item?.itemType || "")
    .trim()
    .toUpperCase();
  if (normalized === "CUSTOM_MADE") return "Sob medida";
  if (normalized === "READY_MADE") return "Pronta";
  if (normalized === "ACCESSORY") return "Acessorio";
  if (normalized === "SERVICE") return "Servico";
  if (normalized === "MISC") return "Diversos";
  return item?.itemType || "-";
}

function isProductionItem(item?: SaleDetailItem | null) {
  if (!item?.productId) return false;
  return item.itemType === "CUSTOM_MADE" || item.itemType === "SERVICE";
}

function mapCustomerOptions(data: CustomersResponse | unknown): CustomerOption[] {
  const items = Array.isArray((data as CustomersResponse)?.items)
    ? ((data as CustomersResponse).items || [])
    : [];

  return items
    .map((item) => {
      const id = Number(item.id);
      const name = String(item.fullName || item.companyName || `Cliente ${item.id}`).trim();

      if (!Number.isInteger(id) || !name) {
        return null;
      }

      return { id, name };
    })
    .filter(Boolean) as CustomerOption[];
}

function ensureCustomerOption(
  options: CustomerOption[],
  value: number | null | undefined,
  name: string | null | undefined,
): CustomerOption[] {
  const normalizedValue = Number(value);
  const normalizedName = String(name || "").trim();

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0 || !normalizedName) {
    return options;
  }

  if (options.some((option) => option.id === normalizedValue)) {
    return options;
  }

  return [{ id: normalizedValue, name: normalizedName }, ...options];
}

function toCustomerSearchableOptions(options: CustomerOption[] = []) {
  return options.map((option) => ({
    value: String(option.id),
    label: option.name,
  }));
}

export default function SaleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sale, setSale] = useState<SaleDetailsResponse | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReferenceImage, setSelectedReferenceImage] =
    useState<UploadedReferenceImage | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [discardLoading, setDiscardLoading] = useState(false);
  const [cancelItemModalOpen, setCancelItemModalOpen] = useState(false);
  const [cancelItemLoading, setCancelItemLoading] = useState(false);
  const [cancelItemReason, setCancelItemReason] = useState("");
  const [cancelItemResolution, setCancelItemResolution] =
    useState("APPLY_REMAINING");
  const [selectedSaleItem, setSelectedSaleItem] =
    useState<SaleDetailItem | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [renegotiateModalOpen, setRenegotiateModalOpen] = useState(false);
  const [renegotiateLoading, setRenegotiateLoading] = useState(false);
  const [renegotiateReason, setRenegotiateReason] = useState("");
  const [renegotiatePaymentTypeId, setRenegotiatePaymentTypeId] = useState("");
  const [renegotiateInstallmentCount, setRenegotiateInstallmentCount] =
    useState("1");
  const [renegotiateIntervalDays, setRenegotiateIntervalDays] = useState("30");
  const [renegotiateDueDate, setRenegotiateDueDate] = useState(() =>
    getTodayIsoDate(),
  );
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);
  const [selectedDetailTab, setSelectedDetailTab] =
    useState<SaleDetailsTab>("items");
  const returnTo = useMemo(
    () => searchParams.get("returnTo") || "/vendas",
    [searchParams],
  );
  const saleDetailsPath = useMemo(
    () => `/venda/${id}?returnTo=${encodeURIComponent(returnTo)}`,
    [id, returnTo],
  );
  const customerSearchableOptions = useMemo(
    () => toCustomerSearchableOptions(customerOptions),
    [customerOptions],
  );

  useEffect(() => {
    const fetchSale = async () => {
      try {
        setLoading(true);
        setError("");
        const data = (await getRequest(`/sales/${id}`)) as SaleDetailsResponse;
        setSale(data);
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { status?: number } };

        if (maybeAxiosError.response?.status === 404) {
          setError("Venda nao encontrada.");
        } else {
          setError(
            getUserFacingApiErrorMessage(
              err,
              "Nao foi possivel carregar a venda.",
            ),
          );
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSale();
  }, [id]);

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const data = (await getRequest(
          "/payment-types",
        )) as PaymentTypeOption[];
        setPaymentTypes(Array.isArray(data) ? data : []);
      } catch {
        setPaymentTypes([]);
      }
    };

    void fetchPaymentTypes();
  }, []);

  useEffect(() => {
    if (!editingCustomer) {
      setCustomerSearchTerm("");
      return;
    }

    const fetchCustomers = async () => {
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "20",
        });

        if (customerSearchTerm.trim()) {
          params.set("search", customerSearchTerm.trim());
        }

        const data = (await getRequest(`/clients?${params.toString()}`)) as CustomersResponse;
        const parsedOptions = mapCustomerOptions(data);

        setCustomerOptions(
          ensureCustomerOption(
            parsedOptions,
            sale?.customer?.id,
            sale?.customer?.name,
          ),
        );
      } catch {
        setCustomerOptions(
          ensureCustomerOption(
            [],
            sale?.customer?.id,
            sale?.customer?.name,
          ),
        );
      }
    };

    void fetchCustomers();
  }, [editingCustomer, customerSearchTerm, sale?.customer?.id, sale?.customer?.name]);

  const totalItemDiscount = useMemo(() => {
    if (!sale) return 0;
    return Number(
      sale.items
        .filter((item) => !item.isCancelled)
        .reduce((acc, item) => acc + item.discountAmount, 0)
        .toFixed(2),
    );
  }, [sale]);
  const saleDiscountAmount = useMemo(() => {
    if (!sale) return 0;
    const activeItemsSubtotal = sale.items
      .filter((item) => !item.isCancelled)
      .reduce((sum, item) => sum + item.subtotal, 0);
    return Number(Math.max(0, activeItemsSubtotal - sale.finalAmount).toFixed(2));
  }, [sale]);

  const totalReceived = useMemo(() => {
    if (!sale) return 0;
    if (typeof sale.netReceivedAmount === "number") {
      return Number(sale.netReceivedAmount.toFixed(2));
    }
    return Number(
      sale.receipts
        .reduce((acc, receipt) => acc + receipt.amount, 0)
        .toFixed(2),
    );
  }, [sale]);

  const firstProductionItem = useMemo(() => {
    if (!sale) return null;
    return sale.items.find((item) => isProductionItem(item)) || null;
  }, [sale]);

  const canCancelSale = sale?.status !== "CANCELLED";
  const productionItemsCount = useMemo(
    () => sale?.items.filter((item) => isProductionItem(item)).length || 0,
    [sale],
  );
  const receivableInstallmentsCount = useMemo(
    () => sale?.receivable?.installments.filter((item) => item.status !== "CANCELLED" && !item.deletionAuditId).length || 0,
    [sale],
  );
  const activeItemsCount = useMemo(
    () => sale?.items.filter((item) => !item.isCancelled).length || 0,
    [sale],
  );
  const projectedFinalAmountAfterItemCancellation = useMemo(() => {
    if (!sale || !selectedSaleItem) return 0;
    return Math.max(
      0,
      Number((sale.finalAmount - selectedSaleItem.subtotal).toFixed(2)),
    );
  }, [sale, selectedSaleItem]);
  const projectedOverpaymentAmount = useMemo(() => {
    if (!selectedSaleItem) return 0;
    return Math.max(
      0,
      Number(
        (totalReceived - projectedFinalAmountAfterItemCancellation).toFixed(2),
      ),
    );
  }, [
    projectedFinalAmountAfterItemCancellation,
    selectedSaleItem,
    totalReceived,
  ]);
  const renegotiationPaymentOptions = useMemo(
    () =>
      paymentTypes.filter((item) => item.financialFlow === "FUTURE_CUSTOMER"),
    [paymentTypes],
  );
  // const canRenegotiatePayment = Boolean(
  //   sale?.receivable &&
  //   sale.receivable.openAmount > 0 &&
  //   sale.receivable.originType === "CUSTOMER" &&
  //   sale.status !== "CANCELLED",
  // );
  const isBudgetSale = sale?.status === "BUDGET";
  const detailTabs: Array<{ value: SaleDetailsTab; label: string }> = [
    {
      value: "items",
      label: isBudgetSale ? "Itens do orçamento" : "Itens da venda",
    },
    { value: "receipts", label: "Recebimentos" },
    { value: "receivable", label: "A receber" },
  ];

  async function refreshSale() {
    const data = (await getRequest(`/sales/${id}`)) as SaleDetailsResponse;
    setSale(data);
  }

  function handleStartCustomerEdit() {
    setSelectedCustomerId(sale?.customer?.id ? String(sale.customer.id) : "");
    setEditingCustomer(true);
  }

  function handleCancelCustomerEdit() {
    setSelectedCustomerId(sale?.customer?.id ? String(sale.customer.id) : "");
    setCustomerSearchTerm("");
    setEditingCustomer(false);
  }

  async function handleSaveCustomer() {
    if (!sale || !selectedCustomerId) return;

    try {
      setSavingCustomer(true);

      const updated = (await updateRequest(`/sales/${sale.id}/customer`, {
        customerId: Number(selectedCustomerId),
      })) as SaleDetailsResponse;

      setSale(updated);
      setEditingCustomer(false);
      setCustomerSearchTerm("");
      setToast({
        open: true,
        tone: "success",
        message: "Cliente da venda atualizado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel salvar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel atualizar a cliente da venda.",
        ),
      });
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCancelSale() {
    if (!sale) return;

    try {
      setCancelLoading(true);
      const response = (await postRequest(`/sales/${sale.id}/cancel`, {
        reason: cancelReason.trim(),
      })) as {
        reversedCashEntries?: number;
        reversedBankEntries?: number;
      };
      await refreshSale();
      setCancelModalOpen(false);
      setCancelReason("");
      setToast({
        open: true,
        tone: "success",
        title: "Venda cancelada",
        message: `A venda foi cancelada, a producao vinculada foi atualizada e foram gerados ${response.reversedCashEntries || 0} estorno(s) no caixa e ${response.reversedBankEntries || 0} no banco.`,
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel cancelar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel cancelar a venda.",
        ),
      });
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleDiscardQuote() {
    if (!sale || sale.status !== "BUDGET") return;

    try {
      setDiscardLoading(true);
      await deleteRequest(`/sales/${sale.id}`, {});
      setDiscardModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Orçamento descartado",
        message: "O orçamento foi descartado com sucesso.",
      });
      navigate("/vendas?tab=budgets");
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel descartar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel descartar o orçamento.",
        ),
      });
    } finally {
      setDiscardLoading(false);
    }
  }

  async function handleCancelSaleItem() {
    if (!sale || !selectedSaleItem) return;

    try {
      setCancelItemLoading(true);
      const response = (await postRequest(
        `/sales/${sale.id}/items/${selectedSaleItem.id}/cancel`,
        {
          reason: cancelItemReason.trim(),
          financialResolution: cancelItemResolution,
        },
      )) as {
        refundAmount?: number;
        creditAmount?: number;
      };

      await refreshSale();
      setCancelItemModalOpen(false);
      setSelectedSaleItem(null);
      setCancelItemReason("");
      setCancelItemResolution("APPLY_REMAINING");
      setToast({
        open: true,
        tone: "success",
        title: "Peca cancelada",
        message:
          response.creditAmount && response.creditAmount > 0
            ? `A peca foi cancelada. O valor de ${formatCurrency(response.creditAmount)} foi registrado como credito da cliente.`
            : response.refundAmount && response.refundAmount > 0
              ? `A peca foi cancelada e foi registrada devolucao de ${formatCurrency(response.refundAmount)}.`
              : "A peca foi cancelada e a venda foi recalculada com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel cancelar a peca",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel cancelar a peca da venda.",
        ),
      });
    } finally {
      setCancelItemLoading(false);
    }
  }

  async function handleRenegotiatePayment() {
    if (!sale) return;

    try {
      setRenegotiateLoading(true);
      await postRequest(`/sales/${sale.id}/renegotiate-payment`, {
        reason: renegotiateReason.trim(),
        paymentTypeId: Number(renegotiatePaymentTypeId),
        installmentCount: Number(renegotiateInstallmentCount),
        installmentIntervalDays: Number(renegotiateIntervalDays),
        dueDate: renegotiateDueDate,
      });

      await refreshSale();
      setRenegotiateModalOpen(false);
      setRenegotiateReason("");
      setToast({
        open: true,
        tone: "success",
        title: "Pagamento renegociado",
        message:
          "O saldo em aberto foi redistribuido nas novas parcelas com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel renegociar",
        message: getUserFacingApiErrorMessage(
          err,
          "Nao foi possivel renegociar o pagamento da venda.",
        ),
      });
    } finally {
      setRenegotiateLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full max-w-7xl bg-white p-5 md:bg-surface-low">
        <div className="rounded-2xl border border-outline-variant/35 bg-white px-6 py-10 text-center text-sm text-neutral-700">
          Carregando detalhes da venda...
        </div>
      </div>
    );
  }

  if (error && !sale) {
    return (
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[#c76767] bg-[#fdecec] px-6 py-8 text-center text-sm text-[#7a1717]">
          <p>{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate(returnTo)}>
              
              Voltar para vendas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!sale) return null;

  return (
    <div className="min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="w-full min-w-0">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="mb-4 text-sm text-neutral-700 underline-offset-2 hover:underline"
            >
              Voltar para vendas
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {isBudgetSale ? (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(`/nova-venda?quoteId=${sale.id}&mode=edit`)
                }
              >
                Editar orçamento
              </Button>
            ) : null}
            {!isBudgetSale && sale.status === "COMPLETED" ? (
              <Button variant="secondary" onClick={handleStartCustomerEdit}>
                Alterar cliente
              </Button>
            ) : null}
            {isBudgetSale ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setDiscardModalOpen(true);
                }}
              >
                Descartar orçamento
              </Button>
            ) : null}
            {!isBudgetSale && canCancelSale ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setCancelReason("");
                  setCancelModalOpen(true);
                }}
              >
                Cancelar venda
              </Button>
            ) : null}
            {isBudgetSale ? (
              <Button
                variant="primary"
                onClick={() =>
                  navigate(`/nova-venda?quoteId=${sale.id}&mode=finalize`)
                }
              >
                Finalizar venda
              </Button>
            ) : null}
            {/* {canRenegotiatePayment ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setRenegotiateReason("");
                  setRenegotiatePaymentTypeId(
                    sale.paymentType?.id
                      ? String(sale.paymentType.id)
                      : String(renegotiationPaymentOptions[0]?.id || ""),
                  );
                  setRenegotiateInstallmentCount(
                    String(
                      sale.receivable?.installments.length ||
                        sale.installmentCount ||
                        1,
                    ),
                  );
                  setRenegotiateIntervalDays("30");
                  setRenegotiateDueDate(
                    sale.receivable?.installments[0]?.dueDate?.slice(0, 10) ||
                      getTodayIsoDate(),
                  );
                  setRenegotiateModalOpen(true);
                }}
              >
                Renegociar pagamento
              </Button>
            ) : null} */}
            {!isBudgetSale && firstProductionItem?.productId ? (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(
                    `/pedido/${firstProductionItem.productId}?returnTo=${encodeURIComponent(
                      saleDetailsPath,
                    )}`,
                  )
                }
              >
                Editar pedido de producao
              </Button>
            ) : null}
          </div>
        </div>

        {sale.customerCreditAmount && sale.customerCreditAmount > 0 ? (
          <div className="mb-4 rounded-xl border border-[#b38a3d] bg-[#fff6df] px-4 py-3 text-sm text-[#6b520f]">
            Esta venda possui credito da cliente no valor de{" "}
            {formatCurrency(sale.customerCreditAmount)}.
          </div>
        ) : null}

        {sale.doesNotGenerateDebt ? (
          <div className="mb-4 rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-3 text-sm text-primary">
            <p className="font-semibold">
              {sale.debtExemptionLabel || "Esta venda não gera débitos"}
            </p>
            {sale.internalReason ? (
              <p className="mt-1 text-neutral-700">
                Motivo interno: {sale.internalReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
            {error}
          </div>
        ) : null}

        {sale.status === "COMPLETED" && editingCustomer ? (
          <section className="mb-6 rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="w-full max-w-xl">
                <label className="mb-2 block text-sm font-medium text-primary">
                  Cliente da venda
                </label>
                <SearchableSelect
                  id="sale-customer"
                  value={selectedCustomerId}
                  options={customerSearchableOptions}
                  onChange={setSelectedCustomerId}
                  onSearchChange={setCustomerSearchTerm}
                  className="relative"
                  inputClassName="w-full rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary"
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
                <p className="mt-2 text-xs text-neutral-600">
                  Esta alteracao atualiza apenas a cliente vinculada a venda,
                  sem editar os dados financeiros desta tela.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleCancelCustomerEdit}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleSaveCustomer()}
                  isLoading={savingCustomer}
                  disabled={!selectedCustomerId}
                >
                  Salvar cliente
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mb-6 w-full overflow-hidden">
          <div className="p-5 md:px-6 md:py-5">
            <h2 className="font-editorial text-3xl text-primary">
              Histórico da Venda
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">
                  Venda
                </p>
                <p className="mt-1 text-sm font-medium text-primary">
                  #{sale.id}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">
                  Cliente atual
                </p>
                <p className="mt-1 text-sm font-medium uppercase text-primary">
                  {sale.customer?.name || "Sem cliente"}
                </p>
              </div>
              <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">
                  Status atual
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getSaleStatusBadgeClassName(sale.status)}`}
                >
                  {formatSaleStatus(sale.status)}
                </span>
              </div>
              <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">
                  Data da venda
                </p>
                <p className="mt-1 text-sm font-medium text-primary">
                  {formatDateTime(sale.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-y border-outline-variant/35  p-4 md:p-5 lg:grid-cols-[1.35fr_1fr]">
            <section className="rounded-xl border border-outline-variant/35 bg-white p-5">
              <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-primary">
                    Composição da venda
                  </h3>
                </div>
              </div>

              <dl className="mt-2 grid gap-x-6">
                {[
                  ["Subtotal bruto", formatCurrency(sale.totalAmount)],
                  ["Desconto dos produtos", formatCurrency(totalItemDiscount)],
                  ["Desconto subtotal", formatCurrency(saleDiscountAmount)],
                  ["Total final", formatCurrency(sale.finalAmount)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 border-b border-outline-variant/20 py-3 last:border-b-0"
                  >
                    <dt className="text-sm text-neutral-700">{label}</dt>
                    <dd
                      className={`whitespace-nowrap text-sm font-semibold ${
                        label === "Total final"
                          ? "text-[#1f7a1f]"
                          : label.startsWith("Desconto")
                            ? "text-[#b42318]"
                            : "text-primary"
                      }`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="overflow-hidden rounded-xl border border-outline-variant/35 bg-white">
              <dl className="divide-y divide-outline-variant/30 px-5">
                <div className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm font-semibold text-neutral-700 ">
                    Total da venda
                  </dt>
                  <dd className="whitespace-nowrap text-lg font-semibold ">
                    {formatCurrency(sale.finalAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm font-semibold text-neutral-700 ">
                    Recebido
                  </dt>
                  <dd className="whitespace-nowrap text-lg font-semibold text-[#1f7a1f]">
                    {formatCurrency(totalReceived)}
                  </dd>
                </div>
                {Number(sale.receivable?.waivedAmount || 0) > 0 ? (
                  <div className="flex items-center justify-between gap-4 py-4">
                    <dt className="text-sm font-semibold text-neutral-700">
                      Abatimento por exclusão
                    </dt>
                    <dd className="whitespace-nowrap text-lg font-semibold text-[#b42318]">
                      {formatCurrency(sale.receivable?.waivedAmount || 0)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 py-4">
                  <dt className="text-sm  font-semibold text-neutral-700">
                    Saldo atual
                  </dt>
                  <dd className="whitespace-nowrap text-lg font-semibold ">
                    {formatCurrency(
                      sale.doesNotGenerateDebt
                        ? 0
                        : sale.receivable?.openAmount || 0,
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </section>

        <div className="mb-4 hidden border-b border-outline-variant/35 md:block">
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Detalhes da venda"
          >
            {detailTabs.map((tab) => (
              <button
                key={tab.value}
                id={`sale-details-${tab.value}-tab`}
                type="button"
                role="tab"
                aria-selected={selectedDetailTab === tab.value}
                aria-controls={`sale-details-${tab.value}-panel`}
                onClick={() => setSelectedDetailTab(tab.value)}
                className={`px-4 py-3 text-sm uppercase tracking-widest transition-colors ${
                  selectedDetailTab === tab.value
                    ? "border-b-2 border-primary font-semibold text-primary"
                    : "text-neutral-700 hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 md:hidden">
          <FormControl fullWidth size="medium">
            <Select
              value={selectedDetailTab}
              onChange={(event) =>
                setSelectedDetailTab(event.target.value as SaleDetailsTab)
              }
              inputProps={{ "aria-label": "Seção dos detalhes da venda" }}
              sx={{
                height: 46,
                backgroundColor: "white",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(112, 105, 106, 0.45)",
                },
              }}
            >
              {detailTabs.map((tab) => (
                <MenuItem key={tab.value} value={tab.value}>
                  {tab.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        <section
          id="sale-details-items-panel"
          role="tabpanel"
          aria-labelledby="sale-details-items-tab"
          hidden={selectedDetailTab !== "items"}
          className="mb-6 bg-white p-5"
        >
          <h2 className="font-editorial text-3xl text-primary">
            {isBudgetSale ? "Itens do Orçamento" : "Itens da Venda"}
          </h2>

          <div className="hidden overflow-auto md:block">
            <table className="w-full min-w-225 table-fixed border-separate border-spacing-y-2 text-sm">
              <thead className="rounded-t-md bg-[#dbd1d1]">
                <tr className="text-left">
                  <th className="w-72.5 rounded-l-lg bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal text-primary">
                    Descrição
                  </th>
                  <th className="w-25 whitespace-nowrap bg-[#dbd1d1] px-3 py-3 font-editorial text-[1.2rem] font-normal text-primary">
                    Tipo
                  </th>
                  <th className="w-12.5 bg-[#dbd1d1] px-2 py-3 text-center font-editorial text-[1.2rem] font-normal text-primary">
                    Qtd.
                  </th>
                  <th className="w-25 whitespace-nowrap bg-[#dbd1d1] px-3 py-3 text-right font-editorial text-[1.2rem] font-normal text-primary">
                    Unitário
                  </th>
                  <th className="w-25 whitespace-nowrap bg-[#dbd1d1] px-3 py-3 text-right font-editorial text-[1.2rem] font-normal text-primary">
                    Bruto
                  </th>
                  <th className="w-32.5 whitespace-nowrap bg-[#dbd1d1] px-3 py-3 text-right font-editorial text-[1.2rem] font-normal text-primary">
                    Desconto
                  </th>
                  <th className="w-25 whitespace-nowrap bg-[#dbd1d1] px-3 py-3 text-right font-editorial text-[1.2rem] font-normal text-primary">
                    Final
                  </th>
                  <th className="whitespace-nowrap bg-[#dbd1d1] px-3 py-3 font-editorial text-[1.2rem] font-normal text-primary">
                    Costureira
                  </th>
                  <th className="whitespace-nowrap rounded-r-lg bg-[#dbd1d1] px-3 py-3 font-editorial text-[1.2rem] font-normal text-primary">
                    Data da prova
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="rounded-lg bg-[#eee7e9] px-4 py-6 text-center text-neutral-700"
                    >
                      Nenhum item encontrado para esta venda.
                    </td>
                  </tr>
                ) : (
                  sale.items.map((item) => (
                    <tr
                      key={item.id}
                      role={
                        isProductionItem(item) && item.productId
                          ? "button"
                          : undefined
                      }
                      tabIndex={
                        isProductionItem(item) && item.productId ? 0 : undefined
                      }
                      onClick={() => {
                        if (!isProductionItem(item) || !item.productId) return;
                        navigate(
                          `/pedido/${item.productId}?returnTo=${encodeURIComponent(saleDetailsPath)}`,
                        );
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (
                          (event.key === "Enter" || event.key === " ") &&
                          isProductionItem(item) &&
                          item.productId
                        ) {
                          event.preventDefault();
                          navigate(
                            `/pedido/${item.productId}?returnTo=${encodeURIComponent(saleDetailsPath)}`,
                          );
                        }
                      }}
                      className={`${
                        item.isCancelled
                          ? "bg-[#f8eeee]"
                          : "bg-[#eee7e9] transition-colors hover:bg-[#e4dadd]"
                      } ${isProductionItem(item) && item.productId ? "cursor-pointer focus:outline-none" : ""}`}
                    >
                      <td className="overflow-hidden rounded-l-lg px-4 py-3 align-middle text-neutral-800">
                        <div className="min-w-0 overflow-hidden flex flex-col gap-1">
                          <span
                            title={item.description}
                            className={`block max-w-full truncate font-medium ${item.isCancelled ? "text-[#7a1717]" : "text-primary"}`}
                          >
                            {item.description}
                          </span>
                          {item.isCancelled ? (
                            <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#7a1717]">
                              Item cancelado
                            </span>
                          ) : null}
                          <span className="text-xs text-neutral-600">
                            {isProductionItem(item)
                              ? `Pedido #${item.productId}`
                              : "Sem produção vinculada"}
                          </span>
                          {item.cancellation?.reason ? (
                            <span className="text-xs text-neutral-600">
                              Motivo: {item.cancellation.reason}
                            </span>
                          ) : null}
                          {item.cancellation?.refundAmount ? (
                            <span className="text-xs text-neutral-600">
                              Devolução:{" "}
                              {formatCurrency(item.cancellation.refundAmount)}
                            </span>
                          ) : null}
                          {item.cancellation?.creditAmount ? (
                            <span className="text-xs text-neutral-600">
                              Crédito:{" "}
                              {formatCurrency(item.cancellation.creditAmount)}
                            </span>
                          ) : null}
                          {getItemReferenceImages(item).length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {getItemReferenceImages(item).map((image) => (
                                <button
                                  key={image.id}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedReferenceImage(image);
                                  }}
                                  className="h-11 w-11 overflow-hidden rounded-md border border-outline-variant/60 bg-white shadow-sm transition hover:border-primary/50 hover:shadow"
                                  aria-label={`Abrir foto de referência ${image.originalName}`}
                                  title={image.originalName}
                                >
                                  <ReferenceImagePreview
                                    imageId={image.id}
                                    alt={image.originalName}
                                  />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-middle text-neutral-800">
                        {formatSaleItemType(item)}
                      </td>
                      <td className="w-15 px-2 py-3 text-center align-middle text-neutral-800">
                        {item.quantity}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-neutral-800">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-neutral-800">
                        {formatCurrency(item.grossAmount)}
                      </td>
                      <td className="px-3 py-3 text-right align-middle text-neutral-800">
                        {formatItemDiscount(item)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right align-middle font-semibold text-primary">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-3 py-3 align-middle text-neutral-800">
                        {item.seamstress || "-"}
                      </td>
                      <td className="whitespace-nowrap rounded-r-lg px-3 py-3 align-middle text-neutral-800">
                        {formatDate(item.fittingDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
            {sale.items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-700">
                Nenhum item encontrado para esta venda.
              </div>
            ) : (
              sale.items.map((item) => (
                <div
                  key={item.id}
                  role={
                    isProductionItem(item) && item.productId
                      ? "button"
                      : undefined
                  }
                  tabIndex={
                    isProductionItem(item) && item.productId ? 0 : undefined
                  }
                  onClick={() => {
                    if (!isProductionItem(item) || !item.productId) return;
                    navigate(
                      `/pedido/${item.productId}?returnTo=${encodeURIComponent(saleDetailsPath)}`,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (
                      (event.key === "Enter" || event.key === " ") &&
                      isProductionItem(item) &&
                      item.productId
                    ) {
                      event.preventDefault();
                      navigate(
                        `/pedido/${item.productId}?returnTo=${encodeURIComponent(saleDetailsPath)}`,
                      );
                    }
                  }}
                  className={`px-4 py-4 ${item.isCancelled ? "bg-[#f8eeee]" : ""} ${isProductionItem(item) && item.productId ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="wrap-break-word font-semibold text-primary">
                        {item.description}
                      </p>
                      <p className="mt-1 text-xs uppercase text-neutral-700">
                        {formatSaleItemType(item)} · Qtd. {item.quantity}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold text-primary">
                      {formatCurrency(item.subtotal)}
                    </p>
                  </div>
                  {item.isCancelled ? (
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-[#7a1717]">
                      Item cancelado
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-700">
                    <p>Unitário: {formatCurrency(item.unitPrice)}</p>
                    <p>Bruto: {formatCurrency(item.grossAmount)}</p>
                    <p>Desconto: {formatItemDiscount(item)}</p>
                    <p>Costureira: {item.seamstress || "-"}</p>
                    <p>Data da prova: {formatDate(item.fittingDate)}</p>
                    <p>
                      {isProductionItem(item)
                        ? `Pedido #${item.productId}`
                        : "Sem produção"}
                    </p>
                  </div>
                  {getItemReferenceImages(item).length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getItemReferenceImages(item).map((image) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedReferenceImage(image);
                          }}
                          className="h-12 w-12 overflow-hidden rounded-md border border-outline-variant/60 bg-white"
                          aria-label={`Abrir foto de referência ${image.originalName}`}
                        >
                          <ReferenceImagePreview
                            imageId={image.id}
                            alt={image.originalName}
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sale.status !== "CANCELLED" &&
                    !item.isCancelled &&
                    activeItemsCount > 1 ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedSaleItem(item);
                          setCancelItemReason("");
                          setCancelItemResolution("APPLY_REMAINING");
                          setCancelItemModalOpen(true);
                        }}
                      >
                        Cancelar peça
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <>
          <section
            id="sale-details-receipts-panel"
            role="tabpanel"
            aria-labelledby="sale-details-receipts-tab"
            hidden={selectedDetailTab !== "receipts"}
            className="mb-6 bg-white p-5"
          >
            <div className="hidden overflow-auto md:block">
              <table className="mt-2 w-full min-w-215 border-separate border-spacing-y-2 text-left text-sm">
                <thead className="rounded-t-md bg-[#dbd1d1]">
                  <tr className="text-primary">
                    <th className="rounded-l-lg bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                      Tipo
                    </th>
                    <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                      Forma
                    </th>
                    <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                      Data
                    </th>
                    <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                      Referência
                    </th>
                    <th className="rounded-r-lg bg-[#dbd1d1] px-4 py-3 text-right font-editorial text-[1.2rem] font-normal">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sale.receipts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="rounded-lg bg-[#eee7e9] px-4 py-6 text-center text-neutral-700"
                      >
                        Nenhum recebimento registrado.
                      </td>
                    </tr>
                  ) : (
                    sale.receipts.map((receipt) => (
                      <tr
                        key={receipt.id}
                        className="bg-[#eee7e9] transition-colors hover:bg-[#e4dadd]"
                      >
                        <td className="rounded-l-lg px-4 py-3 font-medium text-primary">
                          {buildReceiptTitle(
                            receipt,
                            sale.receivable?.installments || [],
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {receipt.paymentType?.name ||
                            "Forma não identificada"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                          {formatDate(receipt.paidAt)}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {receipt.referenceCode || "-"}
                        </td>
                        <td className="whitespace-nowrap rounded-r-lg px-4 py-3 text-right font-semibold text-primary">
                          {formatCurrency(receipt.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
              {sale.receipts.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-neutral-700">
                  Nenhum recebimento registrado.
                </div>
              ) : (
                sale.receipts.map((receipt) => (
                  <div key={receipt.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          {buildReceiptTitle(
                            receipt,
                            sale.receivable?.installments || [],
                          )}
                        </p>
                        <p className="text-xs uppercase text-neutral-700">
                          {receipt.paymentType?.name ||
                            "Forma não identificada"}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-sm font-semibold text-primary">
                        {formatCurrency(receipt.amount)}
                      </p>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-neutral-700">
                      <p>Data: {formatDate(receipt.paidAt)}</p>
                      <p>Recebido em: {receipt.accountLabel || "-"}</p>
                      <p>Referência: {receipt.referenceCode || "-"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {sale.cardTransaction ? (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  Transação de cartão
                </h3>
                <div className="hidden overflow-auto md:block">
                  <table className="mt-2 w-full min-w-215 border-separate border-spacing-y-2 text-left text-sm">
                    <thead className="rounded-t-md bg-[#dbd1d1]">
                      <tr className="text-primary">
                        <th className="rounded-l-lg bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                          Operadora
                        </th>
                        <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                          Bandeira
                        </th>
                        <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                          Autorização
                        </th>
                        <th className="bg-[#dbd1d1] px-4 py-3 text-center font-editorial text-[1.2rem] font-normal">
                          Parcelas
                        </th>
                        <th className="bg-[#dbd1d1] px-4 py-3 text-right font-editorial text-[1.2rem] font-normal">
                          Taxa prevista
                        </th>
                        <th className="rounded-r-lg bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                          Repasse previsto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-[#eee7e9]">
                        <td className="rounded-l-lg px-4 py-3 text-neutral-700">
                          {sale.cardTransaction.operatorLabel || "-"}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {sale.cardTransaction.cardBrand || "-"}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {sale.cardTransaction.authorizationCode || "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-700">
                          {sale.cardTransaction.clientInstallmentCount}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                          {formatCurrency(sale.cardTransaction.feeAmount)}
                        </td>
                        <td className="whitespace-nowrap rounded-r-lg px-4 py-3 text-neutral-700">
                          {formatDate(
                            sale.cardTransaction.expectedSettlementDate,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="space-y-1 px-4 py-4 text-xs text-neutral-700 md:hidden">
                  <p>Operadora: {sale.cardTransaction.operatorLabel || "-"}</p>
                  <p>Bandeira: {sale.cardTransaction.cardBrand || "-"}</p>
                  <p>
                    Autorização: {sale.cardTransaction.authorizationCode || "-"}
                  </p>
                  <p>Parcelas: {sale.cardTransaction.clientInstallmentCount}</p>
                  <p>
                    Taxa prevista:{" "}
                    {formatCurrency(sale.cardTransaction.feeAmount)}
                  </p>
                  <p>
                    Repasse previsto:{" "}
                    {formatDate(sale.cardTransaction.expectedSettlementDate)}
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section
            id="sale-details-receivable-panel"
            role="tabpanel"
            aria-labelledby="sale-details-receivable-tab"
            hidden={selectedDetailTab !== "receivable"}
            className="mb-6 bg-white p-5"
          >
            {!sale.receivable ? (
              <p className="py-5 text-center text-sm text-neutral-700">
                {sale.doesNotGenerateDebt
                  ? sale.debtExemptionLabel || "Esta venda não gera débitos."
                  : "Esta venda não gerou contas a receber."}
              </p>
            ) : (
              <>
                <div className="mt-6">
                  <div className="hidden overflow-auto md:block">
                    <table className="mt-2 w-full min-w-225 border-separate border-spacing-y-2 text-left text-sm">
                      <thead className="rounded-t-md bg-[#dbd1d1]">
                        <tr className="text-primary">
                          <th className="rounded-l-lg bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                            Parcela
                          </th>
                          <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                            Forma
                          </th>
                          <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                            Vencimento
                          </th>
                          <th className="bg-[#dbd1d1] px-4 py-3 font-editorial text-[1.2rem] font-normal">
                            Status
                          </th>
                          <th className="bg-[#dbd1d1] px-4 py-3 text-right font-editorial text-[1.2rem] font-normal">
                            Valor
                          </th>
                          <th className="bg-[#dbd1d1] px-4 py-3 text-right font-editorial text-[1.2rem] font-normal">
                            Pago
                          </th>
                          <th className="bg-[#dbd1d1] px-4 py-3 text-right font-editorial text-[1.2rem] font-normal">
                            Abatimento
                          </th>
                          <th className="rounded-r-lg bg-[#dbd1d1] px-4 py-3 text-right font-editorial text-[1.2rem] font-normal">
                            Em aberto
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.receivable.installments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="rounded-lg bg-[#eee7e9] px-4 py-6 text-center text-neutral-700"
                            >
                              Nenhuma parcela cadastrada.
                            </td>
                          </tr>
                        ) : (
                          sale.receivable.installments.map((installment) => (
                            <tr
                              key={installment.id}
                              className={`bg-[#eee7e9] transition-colors hover:bg-[#e4dadd] `}
                            >
                              <td className="whitespace-nowrap rounded-l-lg px-4 py-3 font-medium text-primary">
                                {installment.installmentNumber}/
                                {installment.totalInstallments}
                              </td>
                              <td className="px-4 py-3 text-neutral-700">
                                {installment.paymentType?.name ||
                                  "Forma não identificada"}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                                {formatDate(installment.dueDate)}
                              </td>
                              <td className="px-4 py-3 text-neutral-700">
                                {installment.deletionAuditId
                                  ? "Excluída"
                                  : formatReceivableStatus(installment.status)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                                {formatCurrency(installment.amount)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                                {formatCurrency(installment.paidAmount)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-neutral-700">
                                {formatCurrency(installment.waivedAmount || 0)}
                              </td>
                              <td className="whitespace-nowrap rounded-r-lg px-4 py-3 text-right font-semibold text-primary">
                                {formatCurrency(installment.openAmount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
                    {sale.receivable.installments.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-neutral-700">
                        Nenhuma parcela cadastrada.
                      </div>
                    ) : (
                      sale.receivable.installments.map((installment) => (
                        <div
                          key={installment.id}
                          className={`px-4 py-4 ${installment.deletionAuditId ? "opacity-45" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-primary">
                                Parcela {installment.installmentNumber}/
                                {installment.totalInstallments}
                              </p>
                              <p className="text-xs uppercase text-neutral-700">
                                {installment.paymentType?.name ||
                                  "Forma não identificada"}
                              </p>
                            </div>
                            <p className="whitespace-nowrap text-sm font-semibold text-primary">
                              {formatCurrency(installment.openAmount)}
                            </p>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-700">
                            <p>Vencimento: {formatDate(installment.dueDate)}</p>
                            <p>
                              Status:{" "}
                              {installment.deletionAuditId
                                ? "Excluída"
                                : formatReceivableStatus(installment.status)}
                            </p>
                            <p>Valor: {formatCurrency(installment.amount)}</p>
                            <p>
                              Pago: {formatCurrency(installment.paidAmount)}
                            </p>
                            <p>
                              Abatimento:{" "}
                              {formatCurrency(installment.waivedAmount || 0)}
                            </p>
                            <p>
                              Em aberto:{" "}
                              {formatCurrency(installment.openAmount)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      </div>

      <CustomerModal
        open={Boolean(selectedReferenceImage)}
        onClose={() => setSelectedReferenceImage(null)}
        title="Foto de modelo ou inspiração"
        subtitle={selectedReferenceImage?.originalName || undefined}
        size="lg"
      >
        {selectedReferenceImage ? (
          <div className="flex max-h-[72vh] justify-center overflow-hidden rounded bg-surface-lowest">
            <ReferenceImagePreview
              imageId={selectedReferenceImage.id}
              alt={selectedReferenceImage.originalName}
              className="max-h-[72vh] max-w-full object-contain"
            />
          </div>
        ) : null}
      </CustomerModal>

      <CustomerModal
        open={discardModalOpen}
        onClose={() => {
          setDiscardModalOpen(false);
        }}
        title="Descartar orçamento"
        subtitle="Confirme a exclusão deste orçamento em aberto."
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Essa acao remove o orçamento e os itens vinculados que ainda nao
            possuem financeiro gerado.
          </p>

          <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
            <p className="font-medium text-primary">Orçamento</p>
            <p className="mt-2">Venda: #{sale.id}</p>
            <p>Cliente: {sale.customer?.name || "Sem cliente"}</p>
            <p>Status: {formatSaleStatus(sale.status)}</p>
            <p>Valor final: {formatCurrency(sale.finalAmount)}</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleDiscardQuote()}
              isLoading={discardLoading}
            >
              Confirmar descarte
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDiscardModalOpen(false);
              }}
            >
              Voltar
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReason("");
        }}
        title="Cancelar venda"
        subtitle="Confirme o cancelamento com o motivo e revise os impactos financeiros e operacionais."
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Ao cancelar a venda, o sistema vai cancelar a venda, marcar a
            producao vinculada como cancelada, cancelar o saldo em aberto no A
            Receber e gerar os estornos financeiros vinculados na data de hoje.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p className="font-medium text-primary">Venda</p>
              <p className="mt-2">Venda: #{sale.id}</p>
              <p>Cliente: {sale.customer?.name || "Sem cliente"}</p>
              <p>Status atual: {formatSaleStatus(sale.status)}</p>
              <p>Valor final: {formatCurrency(sale.finalAmount)}</p>
            </div>

            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p className="font-medium text-primary">Impactos</p>
              <p className="mt-2">
                Producao vinculada: {productionItemsCount} item(ns)
              </p>
              <p>Recebimentos ja registrados: {sale.receipts.length}</p>
              <p>Parcelas cadastradas: {receivableInstallmentsCount}</p>
              <p>Valor ja recebido: {formatCurrency(totalReceived)}</p>
              <p>
                Saldo em aberto:{" "}
                {formatCurrency(sale.receivable?.openAmount || 0)}
              </p>
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-primary"
              htmlFor="cancel-sale-reason"
            >
              Motivo do cancelamento
            </label>
            <textarea
              id="cancel-sale-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-outline-variant/45 px-3 py-2 text-sm text-primary outline-none transition focus:border-primary"
              placeholder="Descreva o motivo do cancelamento e do estorno."
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleCancelSale()}
              isLoading={cancelLoading}
              disabled={!cancelReason.trim()}
            >
              Confirmar cancelamento
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCancelModalOpen(false);
                setCancelReason("");
              }}
            >
              Voltar
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={cancelItemModalOpen}
        onClose={() => {
          setCancelItemModalOpen(false);
          setSelectedSaleItem(null);
          setCancelItemReason("");
          setCancelItemResolution("APPLY_REMAINING");
        }}
        title="Cancelar peca da venda"
        subtitle="Confirme o cancelamento da peca e como o valor ja recebido deve ser tratado."
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Esse fluxo cancela apenas a peca selecionada, recalcula a venda e
            ajusta o A Receber. Vendas com parcelas ja baixadas continuam
            exigindo ajuste financeiro separado.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p className="font-medium text-primary">Peca</p>
              <p className="mt-2">
                Descricao: {selectedSaleItem?.description || "-"}
              </p>
              <p>
                Valor da peca: {formatCurrency(selectedSaleItem?.subtotal || 0)}
              </p>
              <p>Venda atual: {formatCurrency(sale.finalAmount)}</p>
              <p>
                Venda apos cancelamento:{" "}
                {formatCurrency(projectedFinalAmountAfterItemCancellation)}
              </p>
            </div>

            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p className="font-medium text-primary">Impacto financeiro</p>
              <p className="mt-2">
                Recebido ate agora: {formatCurrency(totalReceived)}
              </p>
              <p>
                Possivel sobra: {formatCurrency(projectedOverpaymentAmount)}
              </p>
              <p>
                Saldo atual em aberto:{" "}
                {formatCurrency(sale.receivable?.openAmount || 0)}
              </p>
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-primary"
              htmlFor="cancel-item-reason"
            >
              Motivo do cancelamento
            </label>
            <textarea
              id="cancel-item-reason"
              value={cancelItemReason}
              onChange={(event) => setCancelItemReason(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-outline-variant/45 px-3 py-2 text-sm text-primary outline-none transition focus:border-primary"
              placeholder="Explique por que a peca esta sendo cancelada."
            />
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-primary"
              htmlFor="cancel-item-resolution"
            >
              Tratamento financeiro
            </label>
            <select
              id="cancel-item-resolution"
              value={cancelItemResolution}
              onChange={(event) => setCancelItemResolution(event.target.value)}
              className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-sm text-primary outline-none transition focus:border-primary"
            >
              <option value="APPLY_REMAINING">Abater no saldo restante</option>
              <option value="REFUND">Devolver dinheiro</option>
              <option value="CREDIT">Gerar credito</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleCancelSaleItem()}
              isLoading={cancelItemLoading}
              disabled={!cancelItemReason.trim()}
            >
              Confirmar cancelamento da peca
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCancelItemModalOpen(false);
                setSelectedSaleItem(null);
                setCancelItemReason("");
                setCancelItemResolution("APPLY_REMAINING");
              }}
            >
              Voltar
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={renegotiateModalOpen}
        onClose={() => {
          setRenegotiateModalOpen(false);
          setRenegotiateReason("");
        }}
        title="Renegociar pagamento"
        subtitle="Redistribua apenas o saldo em aberto da venda, preservando o historico ja pago."
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p className="font-medium text-primary">Venda</p>
              <p className="mt-2">Venda: #{sale.id}</p>
              <p>Cliente: {sale.customer?.name || "Sem cliente"}</p>
              <p>Recebido liquido: {formatCurrency(totalReceived)}</p>
              <p>
                Saldo em aberto:{" "}
                {formatCurrency(sale.receivable?.openAmount || 0)}
              </p>
            </div>

            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p className="font-medium text-primary">Regra</p>
              <p className="mt-2">Parcelas ja pagas permanecem no historico.</p>
              <p>Somente o saldo aberto sera redistribuido.</p>
              <p>Cartao/operadora continua fora deste fluxo nesta etapa.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-medium text-primary"
                htmlFor="renegotiate-payment-type"
              >
                Forma de pagamento
              </label>
              <select
                id="renegotiate-payment-type"
                value={renegotiatePaymentTypeId}
                onChange={(event) =>
                  setRenegotiatePaymentTypeId(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-sm text-primary outline-none transition focus:border-primary"
              >
                <option value="">Selecione...</option>
                {renegotiationPaymentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-primary"
                htmlFor="renegotiate-due-date"
              >
                Primeiro vencimento
              </label>
              <DatePickerInput
                id="renegotiate-due-date"
                value={renegotiateDueDate}
                onChange={setRenegotiateDueDate}
                format="iso"
                className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-sm text-primary outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-primary"
                htmlFor="renegotiate-installment-count"
              >
                Parcelas
              </label>
              <input
                id="renegotiate-installment-count"
                type="number"
                min="1"
                value={renegotiateInstallmentCount}
                onChange={(event) =>
                  setRenegotiateInstallmentCount(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-sm text-primary outline-none transition focus:border-primary"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-primary"
                htmlFor="renegotiate-interval"
              >
                Intervalo entre parcelas (dias)
              </label>
              <input
                id="renegotiate-interval"
                type="number"
                min="1"
                value={renegotiateIntervalDays}
                onChange={(event) =>
                  setRenegotiateIntervalDays(event.target.value)
                }
                className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-sm text-primary outline-none transition focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium text-primary"
              htmlFor="renegotiate-reason"
            >
              Motivo da renegociacao
            </label>
            <textarea
              id="renegotiate-reason"
              value={renegotiateReason}
              onChange={(event) => setRenegotiateReason(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-outline-variant/45 px-3 py-2 text-sm text-primary outline-none transition focus:border-primary"
              placeholder="Descreva a mudanca de parcelamento."
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleRenegotiatePayment()}
              isLoading={renegotiateLoading}
              disabled={!renegotiateReason.trim() || !renegotiatePaymentTypeId}
            >
              Confirmar renegociacao
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRenegotiateModalOpen(false);
                setRenegotiateReason("");
              }}
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
