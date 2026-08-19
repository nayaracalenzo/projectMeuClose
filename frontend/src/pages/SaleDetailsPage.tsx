import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import SearchableSelect from "../components/SearchableSelect";
import { deleteRequest, getRequest, postRequest, updateRequest } from "../services/request";
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

const EMPTY_TOAST: ToastState = {
  open: false,
  tone: "success",
  message: "",
};

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-primary">{value}</p>
    </div>
  );
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
  if (normalized === "COMPLETED") return "Concluido";
  if (normalized === "CANCELLED") return "Cancelado";
  return value || "-";
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
      } catch (_error) {
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
      sale.items.reduce((acc, item) => acc + item.discountAmount, 0).toFixed(2),
    );
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
    () => sale?.receivable?.installments.length || 0,
    [sale],
  );
  const openReceivableInstallments = useMemo(
    () =>
      sale?.receivable?.installments.filter(
        (installment) => installment.openAmount > 0,
      ) || [],
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
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
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
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="mb-4 text-sm text-neutral-700 underline-offset-2 hover:underline"
            >
              Voltar para vendas
            </button>
            <h1 className="font-editorial text-[2rem] text-primary md:text-[1.85rem]">
              {isBudgetSale ? "Detalhes do Orçamento" : "Detalhes da Venda"}
            </h1>
            <p className="mt-2 text-sm text-neutral-700">
              {isBudgetSale
                ? "Visualize os itens e dados vinculados a este orçamento."
                : "Visualize os itens, recebimentos e parcelas vinculadas a esta venda."}
            </p>
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

        <section className="mb-6 rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
          <h2 className="font-editorial text-3xl text-primary">Resumo</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Venda" value={`#${sale.id}`} />
            <InfoCard
              label="Cliente"
              value={sale.customer?.name || "Sem cliente"}
            />
            <InfoCard label="Status" value={formatSaleStatus(sale.status)} />
            <InfoCard
              label="Valor final"
              value={formatCurrency(sale.finalAmount)}
            />
            <InfoCard label="Recebido" value={formatCurrency(totalReceived)} />
            <InfoCard
              label="Subtotal bruto"
              value={formatCurrency(sale.totalAmount)}
            />
            <InfoCard
              label="Desconto dos itens"
              value={formatCurrency(totalItemDiscount)}
            />
            <InfoCard
              label="Saldo em aberto"
              value={formatCurrency(
                sale.doesNotGenerateDebt ? 0 : sale.receivable?.openAmount || 0,
              )}
            />
            <InfoCard
              label="Parcelas previstas"
              value={String(
                sale.doesNotGenerateDebt ? 0 : sale.installmentCount || 1,
              )}
            />
            <InfoCard
              label="Criada em"
              value={formatDateTime(sale.createdAt)}
            />
            <InfoCard
              label="Atualizada em"
              value={formatDateTime(sale.updatedAt)}
            />
            <InfoCard
              label="Vencimento base"
              value={formatDate(sale.dueDate)}
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
          <h2 className="font-editorial text-3xl text-primary">
            {isBudgetSale ? "Itens do Orçamento" : "Itens da Venda"}
          </h2>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead className="bg-[#dbd1d1] rounded-t-md">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold text-primary">
                    Descricao
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary">Tipo</th>
                  <th className="px-4 py-2 font-semibold text-primary">Qtd.</th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">
                    Unitario
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">
                    Bruto
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">
                    Desconto
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">
                    Final
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary">
                    Costureira
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary">
                    Data Prova
                  </th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="bg-surface-lowest px-4 py-6 text-center text-neutral-700"
                    >
                      Nenhum item encontrado para esta venda.
                    </td>
                  </tr>
                ) : (
                  sale.items.map((item) => (
                    <tr
                      key={item.id}
                      className={
                        item.isCancelled ? "bg-[#f8eeee]" : "bg-surface-lowest"
                      }
                    >
                      <td className="px-4 py-3 text-neutral-800">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`font-medium ${item.isCancelled ? "text-[#7a1717]" : "text-primary"}`}
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
                              : "Sem producao vinculada"}
                          </span>
                          {item.cancellation?.reason ? (
                            <span className="text-xs text-neutral-600">
                              Motivo: {item.cancellation.reason}
                            </span>
                          ) : null}
                          {item.cancellation?.refundAmount ? (
                            <span className="text-xs text-neutral-600">
                              Devolucao:{" "}
                              {formatCurrency(item.cancellation.refundAmount)}
                            </span>
                          ) : null}
                          {item.cancellation?.creditAmount ? (
                            <span className="text-xs text-neutral-600">
                              Credito:{" "}
                              {formatCurrency(item.cancellation.creditAmount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-800">
                        {formatSaleItemType(item)}
                      </td>
                      <td className="px-4 py-3 text-neutral-800">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-800">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-800">
                        {formatCurrency(item.grossAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-800">
                        {formatItemDiscount(item)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-neutral-800">
                        {item.seamstress || "-"}
                      </td>
                      <td className="px-4 py-3 text-neutral-800">
                        {formatDate(item.fittingDate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {isProductionItem(item) && item.productId ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/pedido/${item.productId}?returnTo=${encodeURIComponent(
                                    saleDetailsPath,
                                  )}`,
                                )
                              }
                            >
                              Editar producao
                            </Button>
                          ) : null}
                          {sale.status !== "CANCELLED" &&
                          !item.isCancelled &&
                          activeItemsCount > 1 ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedSaleItem(item);
                                setCancelItemReason("");
                                setCancelItemResolution("APPLY_REMAINING");
                                setCancelItemModalOpen(true);
                              }}
                            >
                              Cancelar peca
                            </Button>
                          ) : !isProductionItem(item) || !item.productId ? (
                            <span className="text-xs text-neutral-500">-</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">
              Recebimentos
            </h2>

            <div className="mt-5 space-y-3">
              {sale.receipts.length === 0 ? (
                <div className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
                  Nenhum recebimento registrado.
                </div>
              ) : (
                sale.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-primary">
                          {buildReceiptTitle(
                            receipt,
                            sale.receivable?.installments || [],
                          )}
                        </p>
                        <p className="text-sm text-neutral-700">
                          {receipt.paymentType?.name ||
                            "Forma nao identificada"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        {formatCurrency(receipt.amount)}
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                      <p>Data: {formatDate(receipt.paidAt)}</p>
                      <p>Recebido em: {receipt.accountLabel || "-"}</p>
                      <p>Referencia: {receipt.referenceCode || "-"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {sale.cardTransaction ? (
              <div className="mt-5 rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4">
                <p className="text-sm font-semibold text-primary">
                  Transacao de cartao
                </p>
                <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                  <p>Operadora: {sale.cardTransaction.operatorLabel || "-"}</p>
                  <p>Bandeira: {sale.cardTransaction.cardBrand || "-"}</p>
                  <p>
                    Autorizacao: {sale.cardTransaction.authorizationCode || "-"}
                  </p>
                  <p>
                    Parcelas no cartao:{" "}
                    {sale.cardTransaction.clientInstallmentCount}
                  </p>
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

          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">A Receber</h2>

            {!sale.receivable ? (
              <div className="mt-5 rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
                {sale.doesNotGenerateDebt
                  ? sale.debtExemptionLabel || "Esta venda não gera débitos."
                  : "Esta venda nao gerou contas a receber."}
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <InfoCard
                    label="Perfil"
                    value={sale.receivable.originLabel}
                  />
                  <InfoCard label="Origem" value={sale.receivable.originName} />
                  <InfoCard
                    label="Status"
                    value={formatReceivableStatus(sale.receivable.status)}
                  />
                  <InfoCard
                    label="Valor original"
                    value={formatCurrency(sale.receivable.originalAmount)}
                  />
                  <InfoCard
                    label="Saldo aberto"
                    value={formatCurrency(sale.receivable.openAmount)}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {openReceivableInstallments.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
                      Nenhuma parcela em aberto.
                    </div>
                  ) : (
                    openReceivableInstallments.map((installment) => (
                      <div
                        key={installment.id}
                        className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-primary">
                              Parcela {installment.installmentNumber}/
                              {installment.totalInstallments}
                            </p>
                            <p className="text-sm text-neutral-700">
                              {installment.paymentType?.name ||
                                "Forma nao identificada"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-primary">
                            {formatCurrency(installment.amount)}
                          </p>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                          <p>Vencimento: {formatDate(installment.dueDate)}</p>
                          <p>Status: {formatReceivableStatus(installment.status)}</p>
                          <p>Pago: {formatCurrency(installment.paidAmount)}</p>
                          <p>
                            Em aberto: {formatCurrency(installment.openAmount)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

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
              <input
                id="renegotiate-due-date"
                type="date"
                value={renegotiateDueDate}
                onChange={(event) => setRenegotiateDueDate(event.target.value)}
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
