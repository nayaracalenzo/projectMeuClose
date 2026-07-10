import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import CustomerModal from "../components/CustomerModal";
import NoticeToast from "../components/NoticeToast";
import CustomMadeClothing, {
  type CustomMadeProductDraft,
} from "../components/CustomMadeClothing";
import GeneralCatalogItems, {
  type GeneralCatalogProductDraft,
} from "../components/GeneralCatalogItems";
import ReadyMadeClothing, {
  type ReadyMadeProductDraft,
} from "../components/ReadyMadeClothing";
import { SaleStepper } from "../components/SaleStepper";
import type { ICustomer } from "../interfaces/ICustomer";
import { getRequest, postRequest, updateRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import {
  formatCurrencyInput,
  parseCurrencyToNumber,
} from "../utils/currency";
import { formatDocument } from "../utils/formatDocument";

interface CustomerOption {
  id: number;
  name: string;
  document: string;
}

type SaleCategoryCode = "CLOTHING" | "ACCESSORY" | "SERVICE" | "MISC";
type ClothingSubtype = "READY_MADE" | "CUSTOM_MADE";
type ModalType =
  | "Roupa pronta"
  | "Sob medida"
  | "Acessório"
  | "Serviço"
  | "Diversos";

interface SaleCategoryOption {
  id: number;
  code: SaleCategoryCode;
  label: string;
}

interface SaleTableItem {
  id: number;
  type: ModalType;
  description: string;
  value: number;
  discountAmount: number;
  finalValue: number;
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
  financialFlow: "IMMEDIATE_CASH" | "FUTURE_CUSTOMER" | "FUTURE_OPERATOR";
}

type ModalSummaryItem = {
  type: string;
  quantity: number;
  value: number;
  discountAmount: number;
  finalValue: number;
};

interface CashSessionSummary {
  id: number;
  openedAt: string;
  expectedBalance: number;
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

const CATEGORY_CODE_BY_ID: Record<number, SaleCategoryCode> = {
  1: "CLOTHING",
  3: "SERVICE",
  4: "ACCESSORY",
  5: "MISC",
};

const DEFAULT_CATEGORIES: SaleCategoryOption[] = [
  { id: 1, code: "CLOTHING", label: "Roupas" },
  { id: 3, code: "SERVICE", label: "Serviços" },
  { id: 4, code: "ACCESSORY", label: "Acessórios" },
  { id: 5, code: "MISC", label: "Diversos" },
];

function getCategoryLabelByCode(code: SaleCategoryCode) {
  return DEFAULT_CATEGORIES.find((item) => item.code === code)?.label || "Categoria";
}

const paymentFieldClassName =
  "h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

const paymentReadonlyFieldClassName =
  "h-11 w-full rounded-lg border border-outline-variant/60 bg-surface-lowest px-3 text-[15px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-100";

export default function NewSalePage() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [categories, setCategories] = useState<SaleCategoryOption[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<SaleCategoryCode | "">("");
  const [selectedClothingSubtype, setSelectedClothingSubtype] = useState<
    ClothingSubtype | ""
  >("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>("Roupa pronta");
  const [modalItems, setModalItems] = useState<ModalSummaryItem[]>([]);
  const [modalSessionKey, setModalSessionKey] = useState(0);

  const [tableItems, setTableItems] = useState<SaleTableItem[]>([]);
  const [readyMadeProducts, setReadyMadeProducts] = useState<ReadyMadeProductDraft[]>([]);
  const [customMadeProducts, setCustomMadeProducts] = useState<CustomMadeProductDraft[]>([]);
  const [accessoryProducts, setAccessoryProducts] = useState<GeneralCatalogProductDraft[]>([]);
  const [serviceProducts, setServiceProducts] = useState<GeneralCatalogProductDraft[]>([]);
  const [miscProducts, setMiscProducts] = useState<GeneralCatalogProductDraft[]>([]);
  const [modalReadyMadeProducts, setModalReadyMadeProducts] = useState<
    ReadyMadeProductDraft[]
  >([]);
  const [modalCustomMadeProducts, setModalCustomMadeProducts] = useState<
    CustomMadeProductDraft[]
  >([]);
  const [modalGeneralProducts, setModalGeneralProducts] = useState<
    GeneralCatalogProductDraft[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [draftSaleId, setDraftSaleId] = useState<number | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryAmount, setEntryAmount] = useState("");
  const [entryPaymentTypeId, setEntryPaymentTypeId] = useState("");
  const [entryPaidAt, setEntryPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryReferenceCode, setEntryReferenceCode] = useState("");
  const [paymentReferenceCode, setPaymentReferenceCode] = useState("");
  const [cashReceivedAmount, setCashReceivedAmount] = useState("");
  const [cardOperatorLabel, setCardOperatorLabel] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [cardAuthorizationCode, setCardAuthorizationCode] = useState("");
  const [cardExpectedSettlementDate, setCardExpectedSettlementDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [cardClientInstallmentCount, setCardClientInstallmentCount] = useState("1");
  const [cardFeeAmount, setCardFeeAmount] = useState("");
  const [cashSessionStatus, setCashSessionStatus] = useState<CashSessionStatusResponse | null>(
    null,
  );
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [closeCashModalOpen, setCloseCashModalOpen] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [countedBalanceInput, setCountedBalanceInput] = useState("");
  const [cashSessionNotes, setCashSessionNotes] = useState("");
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [cancelSaleModalOpen, setCancelSaleModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

  const formatDateTime = (dateString: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dateString));

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const params = new URLSearchParams({
          page: "1",
          pageSize: "20",
          status: "ativo",
        });

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const data = (await getRequest(`/clients?${params.toString()}`)) as {
          items?: ICustomer[];
        };
        const items = Array.isArray(data?.items) ? data.items : [];
        const parsedCustomers = items.map((customer: ICustomer) => ({
          id: Number(customer.id),
          name: customer.fullName || customer.companyName || "Sem nome",
          document: formatDocument(customer.document),
        }));

        setCustomers(parsedCustomers);
      } catch (error) {
        console.error("Erro ao buscar clientes", error);
        setCustomers([]);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [search]);

  useEffect(() => {
    const fetchPaymentTypes = async () => {
      try {
        const data = await getRequest("/payment-types");
        setPaymentTypes(
          data.map((item: PaymentTypeOption) => ({
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
          })),
        );
      } catch (error) {
        console.error("Erro ao buscar formas de pagamento", error);
      }
    };

    fetchPaymentTypes();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getRequest("/admin/categories");
        if (!Array.isArray(data)) {
          setCategories(DEFAULT_CATEGORIES);
          return;
        }

        const parsedCategories = data
          .map((item) => {
            const id = Number((item as { id?: number }).id);
            const code = CATEGORY_CODE_BY_ID[id];
            if (!code) return null;

            const desc = String((item as { desc?: string }).desc || "").trim();
            return {
              id,
              code,
              label: desc || getCategoryLabelByCode(code),
            };
          })
          .filter(Boolean) as SaleCategoryOption[];

        setCategories(parsedCategories.length ? parsedCategories : DEFAULT_CATEGORIES);
      } catch (error) {
        console.error("Erro ao buscar categorias", error);
        setCategories(DEFAULT_CATEGORIES);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchCashSessionStatus = async () => {
      try {
        const data = await getRequest("/cash/session-status");
        const parsed = (data as CashSessionStatusResponse) || null;
        setCashSessionStatus(parsed);
      } catch {
        setCashSessionStatus(null);
      }
    };

    fetchCashSessionStatus();
  }, []);

  const filteredCustomers = useMemo(() => customers, [customers]);

  const selectedTypesLabel = useMemo(() => {
    const labels = Array.from(new Set(tableItems.map((item) => item.type)));
    return labels.length ? labels.join(" + ") : "Não definido";
  }, [tableItems]);

  const totalValue = useMemo(
    () => Number(tableItems.reduce((acc, item) => acc + item.value, 0).toFixed(2)),
    [tableItems],
  );
  const discountAmount = useMemo(
    () => Number(tableItems.reduce((acc, item) => acc + item.discountAmount, 0).toFixed(2)),
    [tableItems],
  );
  const saleDiscountPayload = useMemo(
    () => ({
      discountType: discountAmount > 0 ? ("FIXED" as const) : null,
      discountValue: discountAmount > 0 ? discountAmount : null,
    }),
    [discountAmount],
  );
  const discountedTotalValue = useMemo(
    () => Number(tableItems.reduce((acc, item) => acc + item.finalValue, 0).toFixed(2)),
    [tableItems],
  );
  const selectedPaymentType = useMemo(
    () => paymentTypes.find((item) => String(item.id) === paymentTypeId) || null,
    [paymentTypeId, paymentTypes],
  );
  const isImmediateCashPayment = useMemo(
    () =>
      selectedPaymentType?.kind === "CASH" &&
      selectedPaymentType.financialFlow === "IMMEDIATE_CASH",
    [selectedPaymentType],
  );
  const isImmediateCheckPayment = useMemo(
    () =>
      selectedPaymentType?.kind === "CHECK" &&
      selectedPaymentType.financialFlow === "IMMEDIATE_CASH",
    [selectedPaymentType],
  );
  const entryPaymentTypeOptions = useMemo(
    () => paymentTypes.filter((item) => item.id === 1 || item.id === 2),
    [paymentTypes],
  );
  const parsedEntryAmount = useMemo(() => {
    if (!entryAmount.trim()) return 0;
    const parsed = Number(entryAmount.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [entryAmount]);
  const remainingAmount = useMemo(
    () => Math.max(0, Number((discountedTotalValue - parsedEntryAmount).toFixed(2))),
    [discountedTotalValue, parsedEntryAmount],
  );
  const parsedCashReceivedAmount = useMemo(() => {
    return parseCurrencyToNumber(cashReceivedAmount);
  }, [cashReceivedAmount]);
  const changeAmount = useMemo(() => {
    if (!isImmediateCashPayment) return 0;
    return Math.max(0, Number((parsedCashReceivedAmount - discountedTotalValue).toFixed(2)));
  }, [discountedTotalValue, isImmediateCashPayment, parsedCashReceivedAmount]);
  const previewInstallmentCount = useMemo(() => {
    if (!selectedPaymentType) return 1;
    if (selectedPaymentType.allowsInstallments) {
      return Math.max(
        1,
        Number(installmentCount) || selectedPaymentType.defaultInstallments || 1,
      );
    }
    return 1;
  }, [installmentCount, selectedPaymentType]);
  const installmentPreview = useMemo(() => {
    const count = Math.max(1, previewInstallmentCount);
    const installments: number[] = [];
    let allocated = 0;

    for (let index = 0; index < count; index += 1) {
      const remainingInstallments = count - index;
      const remaining = Number((remainingAmount - allocated).toFixed(2));
      const amount =
        remainingInstallments === 1
          ? remaining
          : Number((remaining / remainingInstallments).toFixed(2));
      allocated = Number((allocated + amount).toFixed(2));
      installments.push(amount);
    }

    return installments;
  }, [previewInstallmentCount, remainingAmount]);
  const canSaveSale =
    draftSaleId !== null &&
    !isSaving &&
    !!selectedCustomer &&
    tableItems.length > 0 &&
    !!paymentTypeId &&
    (!selectedPaymentType?.requiresDueDate || !!dueDate) &&
    (!selectedPaymentType?.allowsEntryAmount ||
      parsedEntryAmount <= 0 ||
      (!!entryPaymentTypeId && !!entryPaidAt)) &&
    (!isImmediateCashPayment || parsedCashReceivedAmount >= discountedTotalValue) &&
    (!isImmediateCheckPayment || !!paymentReferenceCode.trim()) &&
    parsedEntryAmount < discountedTotalValue &&
    (selectedPaymentType?.financialFlow !== "FUTURE_OPERATOR" || !!cardExpectedSettlementDate);
  const canCreateQuote = !isSaving && !!selectedCustomer && tableItems.length > 0;
  const hasGeneratedQuote = draftSaleId !== null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleModalSummaryChange = useCallback((items: ModalSummaryItem[]) => {
    setModalItems(items);
  }, []);

  const handleModalReadyMadeProductsChange = useCallback((items: ReadyMadeProductDraft[]) => {
    setModalReadyMadeProducts(items);
  }, []);

  const handleModalCustomMadeProductsChange = useCallback(
    (items: CustomMadeProductDraft[]) => {
      setModalCustomMadeProducts(items);
    },
    [],
  );

  const handleModalGeneralProductsChange = useCallback(
    (items: GeneralCatalogProductDraft[]) => {
      setModalGeneralProducts(items);
    },
    [],
  );

  const openModal = (type: ModalType) => {
    setModalType(type);
    setModalItems([]);
    setModalReadyMadeProducts([]);
    setModalCustomMadeProducts([]);
    setModalGeneralProducts([]);
    setModalSessionKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const resolveModalTypeFromSelection = () => {
    if (selectedCategoryCode === "CLOTHING") {
      if (selectedClothingSubtype === "READY_MADE") return "Roupa pronta";
      if (selectedClothingSubtype === "CUSTOM_MADE") return "Sob medida";
      return null;
    }

    if (selectedCategoryCode === "ACCESSORY") return "Acessório";
    if (selectedCategoryCode === "SERVICE") return "Serviço";
    if (selectedCategoryCode === "MISC") return "Diversos";
    return null;
  };

  const ensureCashSessionBeforeCashPayment = async () => {
    try {
      const data = await getRequest("/cash/session-status");
      const parsed = (data as CashSessionStatusResponse) || null;
      setCashSessionStatus(parsed);

      if (parsed?.currentSession?.pendingPreviousDay) {
        setCashSessionNotes(parsed.currentSession.notes || "");
        setCountedBalanceInput(formatCurrencyInput("0"));
        setCloseCashModalOpen(true);
        setSaveMessage("");
        return false;
      }

      if (!parsed?.hasOpenSession) {
        setOpeningBalanceInput(formatCurrencyInput("0"));
        setCashSessionNotes("");
        setOpenCashModalOpen(true);
        setSaveMessage("");
        return false;
      }

      setSaveMessage("");
      return true;
    } catch {
      setCashSessionStatus(null);
      return false;
    }
  };

  const handlePaymentTypeChange = async (value: string) => {
    setPaymentTypeId(value);

    if (!value) {
      setSaveMessage("");
      return;
    }

    const nextPaymentType = paymentTypes.find((item) => String(item.id) === value) || null;
    const requiresCashSession =
      nextPaymentType?.kind === "CASH" && nextPaymentType.financialFlow === "IMMEDIATE_CASH";

    if (!requiresCashSession) {
      setSaveMessage("");
      return;
    }

    await ensureCashSessionBeforeCashPayment();
  };

  const handleEntryPaymentTypeChange = async (value: string) => {
    setEntryPaymentTypeId(value);

    if (value !== "1") {
      setSaveMessage("");
      return;
    }

    await ensureCashSessionBeforeCashPayment();
  };

  useEffect(() => {
    if (!selectedPaymentType) {
      setInstallmentCount("1");
      setEntryAmount("");
      setEntryPaymentTypeId("");
      setEntryReferenceCode("");
      setPaymentReferenceCode("");
      setCashReceivedAmount("");
      return;
    }

    setInstallmentCount(String(selectedPaymentType.defaultInstallments || 1));

    if (!selectedPaymentType.requiresDueDate) {
      setDueDate(new Date().toISOString().slice(0, 10));
    }

    if (!selectedPaymentType.allowsEntryAmount) {
      setEntryAmount("");
      setEntryPaymentTypeId("");
      setEntryReferenceCode("");
    }

    if (!isImmediateCheckPayment) {
      setPaymentReferenceCode("");
    }

    if (!isImmediateCashPayment) {
      setCashReceivedAmount("");
    }

    if (selectedPaymentType.financialFlow !== "FUTURE_OPERATOR") {
      setCardOperatorLabel("");
      setCardBrand("");
      setCardAuthorizationCode("");
      setCardFeeAmount("");
      setCardClientInstallmentCount(String(selectedPaymentType.defaultInstallments || 1));
    }
  }, [isImmediateCashPayment, isImmediateCheckPayment, selectedPaymentType]);

  const addModalItemsToTable = () => {
    if (!modalItems.length) {
      return;
    }

    if (modalType === "Roupa pronta") {
      setReadyMadeProducts((prev) => [...prev, ...modalReadyMadeProducts]);
    } else if (modalType === "Sob medida") {
      setCustomMadeProducts((prev) => [...prev, ...modalCustomMadeProducts]);
    } else if (modalType === "Acessório") {
      setAccessoryProducts((prev) => [...prev, ...modalGeneralProducts]);
    } else if (modalType === "Serviço") {
      setServiceProducts((prev) => [...prev, ...modalGeneralProducts]);
    } else {
      setMiscProducts((prev) => [...prev, ...modalGeneralProducts]);
    }

    setTableItems((prev) => {
      const next = [...prev];

      modalItems.forEach((item) => {
        next.push({
          id: Date.now() + next.length,
          type: modalType,
          description: item.type || modalType,
          value: Number((item.value * Math.max(1, item.quantity)).toFixed(2)),
          discountAmount: Number(item.discountAmount.toFixed(2)),
          finalValue: Number(item.finalValue.toFixed(2)),
        });
      });

      return next;
    });

    setIsModalOpen(false);
    setStep(3);
  };

  const buildGenericSaleItems = (
    products: GeneralCatalogProductDraft[],
    itemType: "ACCESSORY" | "SERVICE" | "MISC",
    fallbackLabel: string,
  ) =>
    products.map((product) => {
      const quantity = Number(product.quantity) > 0 ? Number(product.quantity) : 1;
      const unitPrice = parseCurrencyToNumber(product.price);
      const discountPercent = Math.min(
        100,
        Math.max(0, Number(product.discountPercent.replace(",", ".")) || 0),
      );

      return {
        itemType,
        description: product.name.trim() || fallbackLabel,
        quantity,
        unitPrice,
        discountType: discountPercent > 0 ? "PERCENTAGE" : null,
        discountValue: discountPercent > 0 ? discountPercent : null,
        subtotal: Number((unitPrice * quantity * (1 - discountPercent / 100)).toFixed(2)),
        metadata: null,
      };
    });

  const handleSaveSale = async () => {
    if (!selectedCustomer || tableItems.length === 0) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");

      const readyMadeItems = readyMadeProducts.map((product) => {
        const quantity = Number(product.quantity) > 0 ? Number(product.quantity) : 1;
        const unitPrice = parseCurrencyToNumber(product.price);
        const discountPercent = Math.min(
          100,
          Math.max(0, Number(product.discountPercent.replace(",", ".")) || 0),
        );

        return {
          itemType: "READY_MADE",
          description: product.name.trim() || "Roupa pronta",
          quantity,
          unitPrice,
          discountType: discountPercent > 0 ? "PERCENTAGE" : null,
          discountValue: discountPercent > 0 ? discountPercent : null,
          subtotal: Number((unitPrice * quantity * (1 - discountPercent / 100)).toFixed(2)),
          metadata: {
            size: product.size || null,
          },
        };
      });

      const customItems = customMadeProducts.map((product) => {
        const unitPrice = parseCurrencyToNumber(product.price);
        const seamstressCost = parseCurrencyToNumber(product.seamstressCost);
        const discountPercent = Math.min(
          100,
          Math.max(0, Number(product.discountPercent.replace(",", ".")) || 0),
        );

        return {
          itemType: "CUSTOM_MADE",
          description: product.type.trim() || "Sob medida",
          quantity: 1,
          unitPrice,
          discountType: discountPercent > 0 ? "PERCENTAGE" : null,
          discountValue: discountPercent > 0 ? discountPercent : null,
          subtotal: Number((unitPrice * (1 - discountPercent / 100)).toFixed(2)),
          metadata: {
            fabric: product.fabric || null,
            color: product.color || null,
            details: product.details || null,
            status: product.status || null,
            seamstress: product.seamstress || null,
            fittingDate: product.fittingDate || null,
            seamstressCost: seamstressCost || null,
            selectedMeasurements: product.selectedMeasurements,
          },
        };
      });

      const accessoryItems = buildGenericSaleItems(
        accessoryProducts,
        "ACCESSORY",
        "Acessório",
      );
      const serviceItems = buildGenericSaleItems(serviceProducts, "SERVICE", "Serviço");
      const miscItems = buildGenericSaleItems(miscProducts, "MISC", "Diversos");

      const customerMeasurements = customMadeProducts.map((product) => ({
        ...product.measurements,
      }));

      await postRequest("/sales", {
        customerId: selectedCustomer.id,
        totalAmount: totalValue,
        finalAmount: discountedTotalValue,
        discountType: saleDiscountPayload.discountType,
        discountValue: saleDiscountPayload.discountValue,
        paymentTypeId: paymentTypeId ? Number(paymentTypeId) : null,
        installmentCount: previewInstallmentCount,
        dueDate: selectedPaymentType?.requiresDueDate ? dueDate : null,
        entryAmount:
          selectedPaymentType?.allowsEntryAmount && parsedEntryAmount > 0
            ? parsedEntryAmount
            : null,
        entryPaymentTypeId: entryPaymentTypeId ? Number(entryPaymentTypeId) : null,
        entryPaidAt: parsedEntryAmount > 0 ? entryPaidAt : null,
        entryReferenceCode: entryReferenceCode || null,
        paymentReferenceCode: paymentReferenceCode || null,
        cardOperatorLabel:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardOperatorLabel || null
            : null,
        cardBrand:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardBrand || null
            : null,
        cardAuthorizationCode:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardAuthorizationCode || null
            : null,
        cardExpectedSettlementDate:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardExpectedSettlementDate || null
            : null,
        cardClientInstallmentCount:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? Number(cardClientInstallmentCount) || 1
            : null,
        cardFeeAmount:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" && cardFeeAmount
            ? Number(cardFeeAmount.replace(",", "."))
            : null,
        items: [
          ...readyMadeItems,
          ...customItems,
          ...accessoryItems,
          ...serviceItems,
          ...miscItems,
        ],
        customerMeasurements,
      });

      setSaveMessage("Pedido salvo com sucesso.");
      setTableItems([]);
      setReadyMadeProducts([]);
      setCustomMadeProducts([]);
      setAccessoryProducts([]);
      setServiceProducts([]);
      setMiscProducts([]);
      setModalItems([]);
      setSelectedCategoryCode("");
      setSelectedClothingSubtype("");
      setPaymentTypeId("");
      setInstallmentCount("1");
      setDueDate(new Date().toISOString().slice(0, 10));
      setEntryAmount("");
      setEntryPaymentTypeId("");
      setEntryPaidAt(new Date().toISOString().slice(0, 10));
      setEntryReferenceCode("");
      setPaymentReferenceCode("");
      setCashReceivedAmount("");
      setCardOperatorLabel("");
      setCardBrand("");
      setCardAuthorizationCode("");
      setCardExpectedSettlementDate(new Date().toISOString().slice(0, 10));
      setCardClientInstallmentCount("1");
      setCardFeeAmount("");
      setStep(1);
      const updatedCashSessionStatus = await getRequest("/cash/session-status");
      setCashSessionStatus((updatedCashSessionStatus as CashSessionStatusResponse) || null);
    } catch (error: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(error, "Não foi possível salvar o pedido."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setSearch(customer.name);
    setIsDropdownOpen(false);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryCode((value as SaleCategoryCode) || "");
    setSelectedClothingSubtype("");
  };

  const handleClosePreviousCashSession = async () => {
    try {
      setCashSessionLoading(true);
      await postRequest("/cash/sessions/current/close", {
        countedBalance: parseCurrencyToNumber(countedBalanceInput),
        notes: cashSessionNotes.trim() || null,
      });

      const updated = await getRequest("/cash/session-status");
      setCashSessionStatus((updated as CashSessionStatusResponse) || null);
      setCloseCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa fechado",
        message: "O caixa pendente foi fechado. Agora voce pode continuar com o pedido.",
      });
      setSaveMessage("");
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel fechar",
        message: getUserFacingApiErrorMessage(error, "Nao foi possivel fechar o caixa."),
      });
    } finally {
      setCashSessionLoading(false);
    }
  };

  const handleOpenCashSession = async () => {
    try {
      setCashSessionLoading(true);
      await postRequest("/cash/sessions/open", {
        openingBalance: parseCurrencyToNumber(openingBalanceInput),
        notes: cashSessionNotes.trim() || null,
      });

      const updated = await getRequest("/cash/session-status");
      setCashSessionStatus((updated as CashSessionStatusResponse) || null);
      setOpenCashModalOpen(false);
      setToast({
        open: true,
        tone: "success",
        title: "Caixa aberto",
        message: "O caixa da loja foi aberto. Agora voce pode continuar com o pedido.",
      });
      setSaveMessage("");
    } catch (error: unknown) {
      setToast({
        open: true,
        tone: "error",
        title: "Nao foi possivel abrir",
        message: getUserFacingApiErrorMessage(error, "Nao foi possivel abrir o caixa."),
      });
    } finally {
      setCashSessionLoading(false);
    }
  };

  const buildSaleItemsPayload = () => {
    const readyMadeItems = readyMadeProducts.map((product) => {
      const quantity = Number(product.quantity) > 0 ? Number(product.quantity) : 1;
      const unitPrice = parseCurrencyToNumber(product.price);
      const discountPercent = Math.min(
        100,
        Math.max(0, Number(product.discountPercent.replace(",", ".")) || 0),
      );

      return {
        itemType: "READY_MADE",
        description: product.name.trim() || "Roupa pronta",
        quantity,
        unitPrice,
        discountType: discountPercent > 0 ? "PERCENTAGE" : null,
        discountValue: discountPercent > 0 ? discountPercent : null,
        subtotal: Number((unitPrice * quantity * (1 - discountPercent / 100)).toFixed(2)),
        metadata: {
          size: product.size || null,
        },
      };
    });

    const customItems = customMadeProducts.map((product) => {
      const unitPrice = parseCurrencyToNumber(product.price);
      const seamstressCost = parseCurrencyToNumber(product.seamstressCost);
      const discountPercent = Math.min(
        100,
        Math.max(0, Number(product.discountPercent.replace(",", ".")) || 0),
      );

      return {
        itemType: "CUSTOM_MADE",
        description: product.type.trim() || "Sob medida",
        quantity: 1,
        unitPrice,
        discountType: discountPercent > 0 ? "PERCENTAGE" : null,
        discountValue: discountPercent > 0 ? discountPercent : null,
        subtotal: Number((unitPrice * (1 - discountPercent / 100)).toFixed(2)),
        metadata: {
          fabric: product.fabric || null,
          color: product.color || null,
          details: product.details || null,
          status: product.status || null,
          seamstress: product.seamstress || null,
          fittingDate: product.fittingDate || null,
          seamstressCost: seamstressCost || null,
          selectedMeasurements: product.selectedMeasurements,
        },
      };
    });

    const accessoryItems = buildGenericSaleItems(accessoryProducts, "ACCESSORY", "Acessório");
    const serviceItems = buildGenericSaleItems(serviceProducts, "SERVICE", "Serviço");
    const miscItems = buildGenericSaleItems(miscProducts, "MISC", "Diversos");

    return [
      ...readyMadeItems,
      ...customItems,
      ...accessoryItems,
      ...serviceItems,
      ...miscItems,
    ];
  };

  const buildCustomerMeasurementsPayload = () =>
    customMadeProducts.map((product) => ({
      ...product.measurements,
    }));

  const resetSaleForm = async () => {
    setDraftSaleId(null);
    setSelectedCustomer(null);
    setSearch("");
    setSaveMessage("");
    setTableItems([]);
    setReadyMadeProducts([]);
    setCustomMadeProducts([]);
    setAccessoryProducts([]);
    setServiceProducts([]);
    setMiscProducts([]);
    setModalItems([]);
    setSelectedCategoryCode("");
    setSelectedClothingSubtype("");
    setPaymentTypeId("");
    setInstallmentCount("1");
    setDueDate(new Date().toISOString().slice(0, 10));
    setEntryAmount("");
    setEntryPaymentTypeId("");
    setEntryPaidAt(new Date().toISOString().slice(0, 10));
    setEntryReferenceCode("");
    setPaymentReferenceCode("");
    setCashReceivedAmount("");
    setCardOperatorLabel("");
    setCardBrand("");
    setCardAuthorizationCode("");
    setCardExpectedSettlementDate(new Date().toISOString().slice(0, 10));
    setCardClientInstallmentCount("1");
    setCardFeeAmount("");
    setStep(1);
    const updatedCashSessionStatus = await getRequest("/cash/session-status");
    setCashSessionStatus((updatedCashSessionStatus as CashSessionStatusResponse) || null);
  };

  const handleBackToStart = () => {
    if (tableItems.length > 0 || draftSaleId !== null) {
      setCancelSaleModalOpen(true);
      return;
    }

    setStep(1);
  };

  const handleContinueOpenSale = () => {
    setCancelSaleModalOpen(false);
  };

  const handleCancelOpenSale = async () => {
    setCancelSaleModalOpen(false);
    await resetSaleForm();
  };

  const createDraftSale = async () => {
    if (!selectedCustomer || tableItems.length === 0) {
      return null;
    }

    if (hasGeneratedQuote) {
      return draftSaleId;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");

      const created = await postRequest("/sales", {
        customerId: selectedCustomer.id,
        totalAmount: totalValue,
        finalAmount: discountedTotalValue,
        discountType: saleDiscountPayload.discountType,
        discountValue: saleDiscountPayload.discountValue,
        items: buildSaleItemsPayload(),
        customerMeasurements: buildCustomerMeasurementsPayload(),
      });

      const nextDraftSaleId = Number((created as { id?: number }).id);
      setDraftSaleId(nextDraftSaleId);
      setSaveMessage(
        "Orçamento gerado com sucesso. Agora informe a forma de pagamento para concluir o pedido.",
      );
      return nextDraftSaleId;
    } catch (error: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(error, "Não foi possível gerar o orçamento."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuote = async () => {
    const createdDraftSaleId = await createDraftSale();

    if (!createdDraftSaleId) {
      return;
    }

    navigate(`/vendas?tab=budgets&highlight=${createdDraftSaleId}`);
  };

  const handleStartFinalizeSale = async () => {
    const createdDraftSaleId = await createDraftSale();

    if (!createdDraftSaleId) {
      return;
    }

    setSaveMessage(
      "OrÃ§amento gerado com sucesso. Agora informe a forma de pagamento para concluir o pedido.",
    );
    setStep(4);
  };

  const handleFinalizeQuote = async () => {
    if (!selectedCustomer || tableItems.length === 0 || !draftSaleId) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");

      await updateRequest(`/sales/${draftSaleId}/finalize`, {
        paymentTypeId: paymentTypeId ? Number(paymentTypeId) : null,
        installmentCount: previewInstallmentCount,
        dueDate: selectedPaymentType?.requiresDueDate ? dueDate : null,
        entryAmount:
          selectedPaymentType?.allowsEntryAmount && parsedEntryAmount > 0
            ? parsedEntryAmount
            : null,
        entryPaymentTypeId: entryPaymentTypeId ? Number(entryPaymentTypeId) : null,
        entryPaidAt: parsedEntryAmount > 0 ? entryPaidAt : null,
        entryReferenceCode: entryReferenceCode || null,
        paymentReferenceCode: paymentReferenceCode || null,
        cardOperatorLabel:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardOperatorLabel || null
            : null,
        cardBrand:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardBrand || null
            : null,
        cardAuthorizationCode:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardAuthorizationCode || null
            : null,
        cardExpectedSettlementDate:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? cardExpectedSettlementDate || null
            : null,
        cardClientInstallmentCount:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
            ? Number(cardClientInstallmentCount) || 1
            : null,
        cardFeeAmount:
          selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" && cardFeeAmount
            ? Number(cardFeeAmount.replace(",", "."))
            : null,
      });

      await resetSaleForm();
      setSaveMessage("Pedido concluído com sucesso.");
    } catch (error: unknown) {
      const message = getUserFacingApiErrorMessage(
        error,
        "Não foi possível concluir o pedido.",
      );

      if (
        message.includes("Existe um caixa da loja aberto de dia anterior") ||
        message.includes("Feche o caixa antes de continuar") ||
        message.includes("Abra o caixa da loja antes de registrar")
      ) {
        await ensureCashSessionBeforeCashPayment();
      } else {
        setSaveMessage(message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  void handleSaveSale;

  const currentModalType = resolveModalTypeFromSelection();

  return (
    <div className="w-full min-w-0 min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5">
        <h1 className="pb-6 pt-12 text-6xl font-semibold text-primary md:text-4xl">
          Nova Venda/Orçamento
        </h1>
        <SaleStepper step={step} />

        <div className="mt-5 grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-surface-low p-6 shadow-sm">
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <p className="text-md font-semibold text-primary">
                  Passo 1: Escolha o cliente
                </p>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-700">
                    Selecione um cliente para continuar a venda.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate("/novo-cliente")}
                  >
                    + Novo Cliente
                  </Button>
                </div>

                <div className="relative">
                  <label
                    htmlFor="customer-search"
                    className="mb-2 block text-sm font-medium text-primary"
                  >
                    Cliente
                  </label>
                  <input
                    id="customer-search"
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedCustomer(null);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setIsDropdownOpen(false), 120);
                    }}
                    placeholder="Digite o nome ou CPF/CNPJ do cliente"
                    className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                  />

                  {isDropdownOpen && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-outline-variant/60 bg-white shadow-lg">
                      {loadingCustomers ? (
                        <p className="px-3 py-2 text-sm text-neutral-600">
                          Carregando clientes...
                        </p>
                      ) : filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectCustomer(customer)}
                            className="block w-full border-b border-outline-variant/30 px-3 py-2 text-left transition-colors last:border-0 hover:bg-surface-low"
                          >
                            <p className="font-medium text-primary">
                              {customer.name}
                            </p>
                            <p className="text-sm text-neutral-600">
                              {customer.document}
                            </p>
                          </button>
                        ))
                      ) : search.trim() ? (
                        <p className="px-3 py-2 text-sm text-neutral-600">
                          Nenhum cliente encontrado.
                        </p>
                      ) : (
                        <p className="px-3 py-2 text-sm text-neutral-600">
                          Digite o nome ou CPF/CNPJ do cliente.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {selectedCustomer && (
                  <div className="rounded-lg border border-secondary/50 bg-surface-low p-3">
                    <p className="text-sm text-neutral-700">
                      Cliente selecionado
                    </p>
                    <p className="font-semibold text-primary">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-sm text-neutral-700">
                      {selectedCustomer.document}
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!selectedCustomer}
                    onClick={() => setStep(2)}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <p className="text-md font-semibold text-primary">
                  Passo 2: Tipo de venda
                </p>

                <div className="grid grid-cols-1 gap-4 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Tipo de Produto
                    </label>
                    <select
                      value={selectedCategoryCode}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      disabled={hasGeneratedQuote}
                      className={paymentFieldClassName}
                    >
                      <option value="">Selecione...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.code}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCategoryCode === "CLOTHING" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Tipo da roupa
                      </label>
                      <select
                        value={selectedClothingSubtype}
                        onChange={(e) =>
                          setSelectedClothingSubtype(
                            e.target.value as ClothingSubtype | "",
                          )
                        }
                        disabled={hasGeneratedQuote}
                        className={paymentFieldClassName}
                      >
                        <option value="">Selecione...</option>
                        <option value="READY_MADE">Roupa pronta</option>
                        <option value="CUSTOM_MADE">Sob medida</option>
                      </select>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!currentModalType || hasGeneratedQuote}
                      onClick={() =>
                        currentModalType && openModal(currentModalType)
                      }
                    >
                      + Adicionar item
                    </Button>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBackToStart}
                    >
                      Voltar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-5">
                <p className="text-md font-semibold text-primary">
                  Passo 3: Adicione os produtos
                </p>

                <div className="grid grid-cols-1 gap-4 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Tipo de Produto
                    </label>
                    <select
                      value={selectedCategoryCode}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                    >
                      <option value="">Selecione...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.code}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCategoryCode === "CLOTHING" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Tipo da roupa
                      </label>
                      <select
                        value={selectedClothingSubtype}
                        onChange={(e) =>
                          setSelectedClothingSubtype(
                            e.target.value as ClothingSubtype | "",
                          )
                        }
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                      >
                        <option value="">Selecione...</option>
                        <option value="READY_MADE">Roupa pronta</option>
                        <option value="CUSTOM_MADE">Sob medida</option>
                      </select>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!currentModalType || hasGeneratedQuote}
                      onClick={() =>
                        currentModalType && openModal(currentModalType)
                      }
                    >
                      + Adicionar item
                    </Button>
                  </div>
                </div>

                {hasGeneratedQuote ? (
                  <div className="rounded-lg border border-outline-variant/45 bg-white px-4 py-3 text-sm text-neutral-700">
                    Este orçamento já foi gerado. Para manter os dados
                    consistentes, os itens ficaram bloqueados e agora falta
                    apenas concluir o pagamento.
                  </div>
                ) : null}

                {tableItems.length > 0 && (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-outline-variant/45 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-surface-low">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-primary">
                              Tipo
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-primary">
                              Descrição
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-primary">
                              Valor
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-primary">
                              Desconto
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-primary">
                              Valor final
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableItems.map((item, index) => (
                            <tr
                              key={item.id}
                              className={`border-t border-outline-variant/30 ${
                                index % 2 === 1
                                  ? "bg-surface-lowest/50"
                                  : "bg-white"
                              }`}
                            >
                              <td className="px-3 py-2 text-neutral-800">
                                {item.type}
                              </td>
                              <td className="px-3 py-2 text-neutral-800">
                                {item.description}
                              </td>
                              <td className="px-3 py-2 text-right text-neutral-800">
                                {formatCurrency(item.value)}
                              </td>
                              <td className="px-3 py-2 text-right text-neutral-800">
                                {formatCurrency(item.discountAmount)}
                              </td>
                              <td className="px-3 py-2 text-right font-medium text-primary">
                                {formatCurrency(item.finalValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div className="flex w-full">
                  <div className="flex w-full justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBackToStart}
                      disabled={hasGeneratedQuote}
                    >
                      Voltar
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="tertiary"
                        type="button"
                        onClick={handleCreateQuote}
                        disabled={!canCreateQuote || hasGeneratedQuote}
                      >
                        {isSaving
                          ? "Gerando..."
                          : hasGeneratedQuote
                            ? "Ir para pagamento"
                            : "Gerar orçamento"}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleStartFinalizeSale}
                        disabled={!canCreateQuote}
                      >
                        {isSaving ? "Preparando..." : "Finalizar venda"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-5">
                <p className="text-md font-semibold text-primary">
                  Passo 4: Pagamento e conclusão
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Forma de pagamento
                    </label>
                    <select
                      value={paymentTypeId}
                      onChange={(e) =>
                        void handlePaymentTypeChange(e.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                    >
                      <option value="">Selecione...</option>
                      {paymentTypes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPaymentType?.allowsInstallments ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Parcelas
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedPaymentType.maxInstallments || undefined}
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Parcelas previstas
                      </label>
                      <input
                        value={String(previewInstallmentCount)}
                        disabled
                        className={paymentReadonlyFieldClassName}
                      />
                    </div>
                  )}

                  {selectedPaymentType?.requiresDueDate ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Primeiro vencimento
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                  ) : selectedPaymentType?.financialFlow ===
                    "FUTURE_OPERATOR" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Data prevista de repasse
                      </label>
                      <input
                        type="date"
                        value={cardExpectedSettlementDate}
                        onChange={(e) =>
                          setCardExpectedSettlementDate(e.target.value)
                        }
                        className={paymentFieldClassName}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Destino do recebimento
                      </label>
                      <input
                        value="Recebimento imediato no caixa."
                        disabled
                        className={paymentReadonlyFieldClassName}
                      />
                    </div>
                  )}
                </div>

                {isImmediateCheckPayment && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Número do cheque
                      </label>
                      <input
                        value={paymentReferenceCode}
                        onChange={(e) =>
                          setPaymentReferenceCode(e.target.value)
                        }
                        className={paymentFieldClassName}
                        placeholder="Digite o número do cheque"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Total a pagar
                      </label>
                      <input
                        value={formatCurrency(discountedTotalValue)}
                        disabled
                        className={paymentReadonlyFieldClassName}
                      />
                    </div>
                  </div>
                )}

                {isImmediateCashPayment && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Valor recebido
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashReceivedAmount}
                        onChange={(e) =>
                          setCashReceivedAmount(formatCurrencyInput(e.target.value))
                        }
                        className={paymentFieldClassName}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Total a pagar
                      </label>
                      <input
                        value={formatCurrency(discountedTotalValue)}
                        disabled
                        className={paymentReadonlyFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Troco
                      </label>
                      <input
                        value={formatCurrency(changeAmount)}
                        disabled
                        className={paymentReadonlyFieldClassName}
                      />
                    </div>
                  </div>
                )}

                {selectedPaymentType?.allowsEntryAmount && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Valor de entrada
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entryAmount}
                        onChange={(e) => setEntryAmount(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Forma da entrada
                      </label>
                      <select
                        value={entryPaymentTypeId}
                        onChange={(e) =>
                          void handleEntryPaymentTypeChange(e.target.value)
                        }
                        className={paymentFieldClassName}
                      >
                        <option value="">Selecione...</option>
                        {entryPaymentTypeOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Data da entrada
                      </label>
                      <input
                        type="date"
                        value={entryPaidAt}
                        onChange={(e) => setEntryPaidAt(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Referência
                      </label>
                      <input
                        value={entryReferenceCode}
                        onChange={(e) => setEntryReferenceCode(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                  </div>
                )}

                {selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Operadora
                      </label>
                      <input
                        value={cardOperatorLabel}
                        onChange={(e) => setCardOperatorLabel(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Bandeira
                      </label>
                      <input
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Autorização
                      </label>
                      <input
                        value={cardAuthorizationCode}
                        onChange={(e) =>
                          setCardAuthorizationCode(e.target.value)
                        }
                        className={paymentFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Parcelas no cartão
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={cardClientInstallmentCount}
                        onChange={(e) =>
                          setCardClientInstallmentCount(e.target.value)
                        }
                        className={paymentFieldClassName}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Taxa prevista
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={cardFeeAmount}
                        onChange={(e) => setCardFeeAmount(e.target.value)}
                        className={paymentFieldClassName}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Subtotal dos itens
                    </label>
                    <input
                      value={formatCurrency(totalValue)}
                      disabled
                      className={paymentReadonlyFieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Desconto dos itens
                    </label>
                    <input
                      value={formatCurrency(discountAmount)}
                      disabled
                      className={paymentReadonlyFieldClassName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Valor final dos itens
                    </label>
                    <input
                      value={formatCurrency(discountedTotalValue)}
                      disabled
                      className={paymentReadonlyFieldClassName}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/45 bg-white p-4 text-sm text-neutral-700">
                  <p>Subtotal: {formatCurrency(totalValue)}</p>
                  <p>Desconto: {formatCurrency(discountAmount)}</p>
                  <p>Valor final: {formatCurrency(discountedTotalValue)}</p>
                  {isImmediateCashPayment && (
                    <>
                      <p>
                        Valor recebido:{" "}
                        {formatCurrency(parsedCashReceivedAmount)}
                      </p>
                      <p>Troco: {formatCurrency(changeAmount)}</p>
                    </>
                  )}
                  {isImmediateCheckPayment && paymentReferenceCode.trim() && (
                    <p>Cheque: {paymentReferenceCode.trim()}</p>
                  )}
                  <p>Entrada: {formatCurrency(parsedEntryAmount)}</p>
                  <p>Saldo: {formatCurrency(remainingAmount)}</p>
                  <p>
                    Destino do saldo:{" "}
                    {selectedPaymentType?.financialFlow === "FUTURE_OPERATOR"
                      ? "Operadora"
                      : selectedPaymentType?.financialFlow === "FUTURE_CUSTOMER"
                        ? "Cliente"
                        : "Caixa"}
                  </p>
                  <p>Parcelas previstas: {previewInstallmentCount}</p>
                  {installmentPreview.length > 0 && remainingAmount > 0 && (
                    <p>
                      Valor presumido:{" "}
                      {installmentPreview
                        .map((item) => formatCurrency(item))
                        .join(" / ")}
                    </p>
                  )}
                </div>

                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setStep(3)}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleFinalizeQuote}
                      disabled={!canSaveSale}
                    >
                      {isSaving ? "Concluindo..." : "Gerar pedido"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-low p-6 shadow-sm">
            <p className="mb-2 font-semibold text-primary">Resumo</p>
            <p className="text-sm text-neutral-700">
              Cliente: {selectedCustomer?.name ?? "Não selecionado"}
            </p>
            <p className="mb-3 text-sm text-neutral-700">
              Tipo: {selectedTypesLabel}
            </p>
            <p className="text-sm text-neutral-700">
              Forma: {selectedPaymentType?.name || "Não definida"}
            </p>
            <p className="text-sm text-neutral-700">
              Status: {hasGeneratedQuote ? "Orçamento" : "Em montagem"}
            </p>
            <p className="mb-3 text-sm text-neutral-700">
              Parcelas: {previewInstallmentCount}
            </p>
            <p className="text-sm text-neutral-700">
              Subtotal: {formatCurrency(totalValue)}
            </p>
            <p className="text-sm text-neutral-700">
              Desconto aplicado: {formatCurrency(discountAmount)}
            </p>
            <p className="text-sm text-neutral-700">
              Entrada: {formatCurrency(parsedEntryAmount)}
            </p>
            <p className="mb-3 text-sm text-neutral-700">
              Saldo: {formatCurrency(remainingAmount)}
            </p>
            {saveMessage && (
              <p className="mb-3 text-sm text-neutral-700">{saveMessage}</p>
            )}
            <p className="mt-4 border-t border-outline-variant/35 pt-3 text-sm font-semibold text-primary">
              Valor total: {formatCurrency(discountedTotalValue)}
            </p>
          </div>
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[95vh] w-[50%] max-w-6xl overflow-y-auto rounded-xl bg-white p-3 shadow-lg">
            {modalType === "Roupa pronta" ? (
              <ReadyMadeClothing
                key={`ready-${modalSessionKey}`}
                onSummaryChange={handleModalSummaryChange}
                onProductsChange={handleModalReadyMadeProductsChange}
              />
            ) : modalType === "Sob medida" ? (
              <CustomMadeClothing
                key={`custom-${modalSessionKey}`}
                onSummaryChange={handleModalSummaryChange}
                onProductsChange={handleModalCustomMadeProductsChange}
              />
            ) : (
              <GeneralCatalogItems
                key={`general-${modalType}-${modalSessionKey}`}
                title={`Dados de ${modalType.toLowerCase()}`}
                itemLabel={modalType}
                defaultSummaryLabel={modalType}
                onSummaryChange={handleModalSummaryChange}
                onProductsChange={handleModalGeneralProductsChange}
              />
            )}

            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={addModalItemsToTable}
                disabled={!modalItems.length}
              >
                Adicionar Produto
              </Button>
            </div>
          </div>
        </div>
      )}

      <CustomerModal
        open={openCashModalOpen}
        onClose={() => setOpenCashModalOpen(false)}
        title="Abrir Caixa da Loja"
        subtitle="Nao existe caixa da loja aberto no dia. Abra o caixa para continuar."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-primary">
              Saldo inicial
            </label>
            <input
              value={openingBalanceInput}
              onChange={(e) =>
                setOpeningBalanceInput(formatCurrencyInput(e.target.value))
              }
              placeholder="R$ 0,00"
              className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
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
        open={closeCashModalOpen}
        onClose={() => setCloseCashModalOpen(false)}
        title="Fechar Caixa da Loja"
        subtitle={
          cashSessionStatus?.currentSession
            ? `Existe um caixa pendente aberto em ${formatDateTime(
                cashSessionStatus.currentSession.openedAt,
              )}.`
            : "Feche o caixa da loja para continuar."
        }
      >
        <div className="space-y-4">
          {cashSessionStatus?.currentSession ? (
            <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
              <p>
                Data do caixa pendente:{" "}
                {formatDate(cashSessionStatus.currentSession.openedAt)}
              </p>
              <p>
                Saldo esperado:{" "}
                {formatCurrency(
                  cashSessionStatus.currentSession.expectedBalance,
                )}
              </p>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-primary">
              Saldo contado
            </label>
            <input
              value={countedBalanceInput}
              onChange={(e) =>
                setCountedBalanceInput(formatCurrencyInput(e.target.value))
              }
              placeholder="R$ 0,00"
              className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
            />
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
              onClick={handleClosePreviousCashSession}
              isLoading={cashSessionLoading}
            >
              Confirmar fechamento
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCloseCashModalOpen(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      </CustomerModal>

      <CustomerModal
        open={cancelSaleModalOpen}
        onClose={handleContinueOpenSale}
        title="Venda em andamento"
        subtitle="Esta venda ainda esta aberta."
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Tem certeza que deseja voltar? Os produtos adicionados e os dados da
            venda em andamento serão descartados.
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={handleContinueOpenSale}
            >
              Continuar venda
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCancelOpenSale()}
            >
              Cancelar venda
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
