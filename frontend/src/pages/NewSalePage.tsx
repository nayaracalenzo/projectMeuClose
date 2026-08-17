import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import {
  deleteRequest,
  getRequest,
  postRequest,
  updateRequest,
} from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrencyInput, parseCurrencyToNumber } from "../utils/currency";
import { parseLegacyOrIsoDate } from "../utils/legacyDate";

interface CustomerOption {
  id: number;
  name: string;
}

type SaleCategoryCode = "CLOTHING" | "ACCESSORY" | "SERVICE" | "MISC";
type ClothingSubtype =
  | "READY_MADE"
  | "CUSTOM_MADE"
  | "CUSTOM_ADJUSTMENT"
  | "CUSTOM_REFORM";
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
  id: string | number;
  type: ModalType;
  sourceItemType:
    | "READY_MADE"
    | "CUSTOM_MADE"
    | "ACCESSORY"
    | "SERVICE"
    | "MISC";
  sourceIndex: number;
  description: string;
  fittingDate?: string | null;
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
  financialFlow: "IMMEDIATE_CASH" | "FUTURE_CUSTOMER";
}

type ModalSummaryItem = {
  type: string;
  description?: string;
  fittingDate?: string | null;
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
  lastClosedSession?: CashSessionSummary | null;
  hasOpenSession: boolean;
  pendingPreviousDay: boolean;
}

interface ExistingQuoteItem {
  id: number;
  itemType: "READY_MADE" | "CUSTOM_MADE" | "ACCESSORY" | "SERVICE" | "MISC";
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  grossAmount: number;
  discountAmount: number;
  subtotal: number;
  fittingDate: string | null;
  metadata: Record<string, unknown> | null;
}

interface ExistingQuoteMeasurement {
  idMeasurementDefinition: number | null;
  key: string | null;
  label: string;
  value: number | null;
}

interface CustomerMeasurementResponse {
  measurementDefinitionId: number | null;
  key: string | null;
  label: string;
  value: number | null;
}

interface CustomerDetailsResponse {
  measurements?: CustomerMeasurementResponse[];
}

interface ExistingQuotePaymentDraft {
  paymentTypeId: number | null;
  installmentCount: number | null;
  installmentIntervalDays: number | null;
  dueDate: string | null;
  entryAmount: number | null;
  entryPaymentTypeId: number | null;
  entryReferenceCode: string | null;
  paymentReferenceCode: string | null;
  useCustomerCredit: boolean;
  customerCreditAmount: number | null;
}

interface ExistingQuoteResponse {
  id: number;
  status: string;
  doesNotGenerateDebt: boolean;
  internalReason: string | null;
  customer: {
    id: number;
    name: string;
  } | null;
  finalAmount: number;
  dueDate: string | null;
  installmentCount: number;
  paymentType?: {
    id: number;
    name: string;
  } | null;
  items: ExistingQuoteItem[];
  measurements: ExistingQuoteMeasurement[];
  paymentDraft: ExistingQuotePaymentDraft | null;
}

interface CustomerCreditItem {
  id: number;
  originalAmount: number;
  balanceAmount: number;
  description: string;
  status: string;
  createdAt: string;
}

interface CustomerCreditsResponse {
  customer: {
    id: number;
    name: string;
  };
  totalAvailable: number;
  items: CustomerCreditItem[];
}

type InstallmentPreviewRow = {
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
};

type DraftCollections = {
  readyMade: ReadyMadeProductDraft[];
  customMade: CustomMadeProductDraft[];
  accessory: GeneralCatalogProductDraft[];
  service: GeneralCatalogProductDraft[];
  misc: GeneralCatalogProductDraft[];
};

type EditingItemState = {
  modalType: ModalType;
  sourceItemType: SaleTableItem["sourceItemType"];
  sourceIndex: number;
} | null;

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
  return (
    DEFAULT_CATEGORIES.find((item) => item.code === code)?.label || "Categoria"
  );
}

function isCustomMadeClothingSubtype(subtype: ClothingSubtype | "") {
  return (
    subtype === "CUSTOM_MADE" ||
    subtype === "CUSTOM_ADJUSTMENT" ||
    subtype === "CUSTOM_REFORM"
  );
}

function getCustomProductModeLabel(
  subtype: ClothingSubtype | "" | null | undefined,
) {
  if (subtype === "CUSTOM_ADJUSTMENT") return "Ajuste";
  if (subtype === "CUSTOM_REFORM") return "Reforma";
  return "Sob medida";
}

const paymentFieldClassName =
  "h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

const paymentReadonlyFieldClassName =
  "h-11 w-full rounded-lg border border-outline-variant/60 bg-surface-lowest px-3 text-[15px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-100";

function buildCustomMadeDescription(product: {
  type: string;
  fabric: string;
  color: string;
}) {
  const parts = [product.type, product.fabric, product.color]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(" - ") : "Sob medida";
}

function normalizePaymentTypeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeCustomerDisplayName(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.toUpperCase() : "SEM NOME";
}

function getCurrentDateInputValue() {
  return formatDateInputValue(new Date());
}

function getDueDateInputValue(daysToAdd = 30) {
  return formatDateInputValue(addDays(new Date(), daysToAdd));
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateFromInputValue(value: string) {
  return parseLegacyOrIsoDate(value) || new Date(NaN);
}

function addDays(baseDate: Date, daysToAdd: number) {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + daysToAdd,
    0,
    0,
    0,
    0,
  );
}

function mapSaleItemTypeToModalType(
  itemType: ExistingQuoteItem["itemType"],
): ModalType {
  if (itemType === "READY_MADE") return "Roupa pronta";
  if (itemType === "CUSTOM_MADE") return "Sob medida";
  if (itemType === "ACCESSORY") return "Acessório";
  if (itemType === "SERVICE") return "Serviço";
  return "Diversos";
}

function stringifyMeasurementValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function buildMeasurementsMap(
  measurements:
    | Array<{
        key?: string | null;
        value?: number | string | null;
      }>
    | null
    | undefined,
) {
  if (!Array.isArray(measurements) || !measurements.length) {
    return {
      measurements: {},
      selectedMeasurements: [] as string[],
    };
  }

  const measurementMap: Record<string, string> = {};
  const selectedMeasurements: string[] = [];

  measurements.forEach((measurement) => {
    const key = String(measurement.key || "").trim();
    if (!key) {
      return;
    }

    measurementMap[key] = stringifyMeasurementValue(measurement.value);
    selectedMeasurements.push(key);
  });

  return {
    measurements: measurementMap,
    selectedMeasurements,
  };
}

function buildTableItemsFromDraftCollections(
  drafts: DraftCollections,
  formatCurrencyValue: (value: number) => string,
) {
  const rows: SaleTableItem[] = [];

  drafts.readyMade.forEach((product, index) => {
    const quantity =
      Number(product.quantity) > 0 ? Number(product.quantity) : 1;
    const unitPrice = parseCurrencyToNumber(product.price);
    const discountPercent = Math.min(
      100,
      Math.max(
        0,
        Number(String(product.discountPercent || "").replace(",", ".")) || 0,
      ),
    );
    const grossValue = Number((unitPrice * quantity).toFixed(2));
    const discountAmount = Number(
      ((grossValue * discountPercent) / 100).toFixed(2),
    );

    rows.push({
      id: `READY_MADE-${index}`,
      type: "Roupa pronta",
      sourceItemType: "READY_MADE",
      sourceIndex: index,
      description: product.name.trim() || "Roupa pronta",
      fittingDate: null,
      value: grossValue,
      discountAmount,
      finalValue: Number((grossValue - discountAmount).toFixed(2)),
    });
  });

  drafts.customMade.forEach((product, index) => {
    const unitPrice = parseCurrencyToNumber(product.price);
    const discountPercent = Math.min(
      100,
      Math.max(
        0,
        Number(String(product.discountPercent || "").replace(",", ".")) || 0,
      ),
    );
    const discountAmount = Number(
      ((unitPrice * discountPercent) / 100).toFixed(2),
    );

    rows.push({
      id: `CUSTOM_MADE-${index}`,
      type: "Sob medida",
      sourceItemType: "CUSTOM_MADE",
      sourceIndex: index,
      description: buildCustomMadeDescription(product),
      fittingDate: product.fittingDate || null,
      value: unitPrice,
      discountAmount,
      finalValue: Number((unitPrice - discountAmount).toFixed(2)),
    });
  });

  const appendGenericRows = (
    products: GeneralCatalogProductDraft[],
    sourceItemType: "ACCESSORY" | "SERVICE" | "MISC",
    type: ModalType,
    fallbackLabel: string,
  ) => {
    products.forEach((product, index) => {
      const quantity =
        Number(product.quantity) > 0 ? Number(product.quantity) : 1;
      const unitPrice = parseCurrencyToNumber(product.price);
      const discountPercent = Math.min(
        100,
        Math.max(
          0,
          Number(String(product.discountPercent || "").replace(",", ".")) || 0,
        ),
      );
      const grossValue = Number((unitPrice * quantity).toFixed(2));
      const discountAmount = Number(
        ((grossValue * discountPercent) / 100).toFixed(2),
      );

      rows.push({
        id: `${sourceItemType}-${index}`,
        type,
        sourceItemType,
        sourceIndex: index,
        description: product.name.trim() || fallbackLabel,
        fittingDate: null,
        value: grossValue,
        discountAmount,
        finalValue: Number((grossValue - discountAmount).toFixed(2)),
      });
    });
  };

  appendGenericRows(drafts.accessory, "ACCESSORY", "Acessório", "Acessório");
  appendGenericRows(drafts.service, "SERVICE", "Serviço", "Serviço");
  appendGenericRows(drafts.misc, "MISC", "Diversos", "Diversos");

  return rows.map((item) => ({
    ...item,
    description: item.description || formatCurrencyValue(item.finalValue),
  }));
}

function getSaveMessageTone(message: string): ToastState["tone"] {
  const normalized = String(message || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "warning";
  }

  if (
    normalized.includes("sucesso") ||
    normalized.includes("carregado") ||
    normalized.includes("agora voce pode continuar")
  ) {
    return "success";
  }

  if (
    normalized.includes("sera finalizada") ||
    normalized.includes("selecione") ||
    normalized.includes("informe")
  ) {
    return "warning";
  }

  return "error";
}

export default function NewSalePage() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteIdParam = searchParams.get("quoteId");
  const quoteModeParam = searchParams.get("mode");
  const returnToParam = searchParams.get("returnTo") || "/vendas";
  const paymentDraftHydrationRef = useRef(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [selectedCustomerMeasurements, setSelectedCustomerMeasurements] =
    useState<Record<string, string>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [categories, setCategories] =
    useState<SaleCategoryOption[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<
    SaleCategoryCode | ""
  >("");
  const [selectedClothingSubtype, setSelectedClothingSubtype] = useState<
    ClothingSubtype | ""
  >("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>("Roupa pronta");
  const [modalItems, setModalItems] = useState<ModalSummaryItem[]>([]);
  const [modalSessionKey, setModalSessionKey] = useState(0);

  const [tableItems, setTableItems] = useState<SaleTableItem[]>([]);
  const [readyMadeProducts, setReadyMadeProducts] = useState<
    ReadyMadeProductDraft[]
  >([]);
  const [customMadeProducts, setCustomMadeProducts] = useState<
    CustomMadeProductDraft[]
  >([]);
  const [accessoryProducts, setAccessoryProducts] = useState<
    GeneralCatalogProductDraft[]
  >([]);
  const [serviceProducts, setServiceProducts] = useState<
    GeneralCatalogProductDraft[]
  >([]);
  const [miscProducts, setMiscProducts] = useState<
    GeneralCatalogProductDraft[]
  >([]);
  const [modalReadyMadeProducts, setModalReadyMadeProducts] = useState<
    ReadyMadeProductDraft[]
  >([]);
  const [modalCustomMadeProducts, setModalCustomMadeProducts] = useState<
    CustomMadeProductDraft[]
  >([]);
  const [modalGeneralProducts, setModalGeneralProducts] = useState<
    GeneralCatalogProductDraft[]
  >([]);
  const [editingItem, setEditingItem] = useState<EditingItemState>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [draftSaleId, setDraftSaleId] = useState<number | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [installmentIntervalDays, setInstallmentIntervalDays] = useState("30");
  const [dueDate, setDueDate] = useState(() => getDueDateInputValue());
  const [entryAmount, setEntryAmount] = useState("");
  const [entryPaymentTypeId, setEntryPaymentTypeId] = useState("");
  const [entryReferenceCode, setEntryReferenceCode] = useState("");
  const [paymentReferenceCode, setPaymentReferenceCode] = useState("");
  const [cashReceivedAmount, setCashReceivedAmount] = useState("");
  const [cashSessionStatus, setCashSessionStatus] =
    useState<CashSessionStatusResponse | null>(null);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [rolloverCashModalOpen, setRolloverCashModalOpen] = useState(false);
  const [cashSessionNotes, setCashSessionNotes] = useState("");
  const [cashSessionLoading, setCashSessionLoading] = useState(false);
  const [cancelSaleModalOpen, setCancelSaleModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);
  const [loadingExistingQuote, setLoadingExistingQuote] = useState(false);
  const [editingSaleStatus, setEditingSaleStatus] = useState<string | null>(null);
  const [customerCredits, setCustomerCredits] = useState<CustomerCreditItem[]>(
    [],
  );
  const [customerCreditAvailable, setCustomerCreditAvailable] = useState(0);
  const [useCustomerCredit, setUseCustomerCredit] = useState(false);
  const [customerCreditAmountInput, setCustomerCreditAmountInput] =
    useState("");
  const [doesNotGenerateDebt, setDoesNotGenerateDebt] = useState(false);
  const [internalReason, setInternalReason] = useState("");
  const [pendingExitPath, setPendingExitPath] = useState<string | null>(null);

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("pt-BR").format(getDateFromInputValue(dateString));

  const formatDateTime = (dateString: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dateString));
  const currentCashLaunchDateLabel = formatDate(getCurrentDateInputValue());
  const previousCashLaunchDateLabel = cashSessionStatus?.currentSession
    ? formatDate(cashSessionStatus.currentSession.openedAt)
    : "";

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
          name: normalizeCustomerDisplayName(
            customer.fullName || customer.companyName,
          ),
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
    const loadCustomerMeasurements = async () => {
      if (!selectedCustomer?.id) {
        setSelectedCustomerMeasurements({});
        return;
      }

      try {
        const data = (await getRequest(
          `/clients/${selectedCustomer.id}`,
        )) as CustomerDetailsResponse;
        setSelectedCustomerMeasurements(
          buildMeasurementsMap(data.measurements).measurements,
        );
      } catch (error) {
        console.error("Erro ao carregar medidas da(o) cliente", error);
        setSelectedCustomerMeasurements({});
      }
    };

    void loadCustomerMeasurements();
  }, [selectedCustomer?.id]);

  useEffect(() => {
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
                item.maxInstallments === null ||
                item.maxInstallments === undefined
                  ? null
                  : Number(item.maxInstallments),
              defaultInstallments: Number(item.defaultInstallments || 1),
              financialFlow: item.financialFlow,
            }))
            .filter((item) => item.active),
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

        setCategories(
          parsedCategories.length ? parsedCategories : DEFAULT_CATEGORIES,
        );
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

  useEffect(() => {
    if (!saveMessage.trim()) {
      return;
    }

    setToast({
      open: true,
      tone: getSaveMessageTone(saveMessage),
      message: saveMessage,
    });
    setSaveMessage("");
  }, [saveMessage]);

  useEffect(() => {
    const fetchCustomerCredits = async () => {
      if (!selectedCustomer?.id) {
        setCustomerCredits([]);
        setCustomerCreditAvailable(0);
        setUseCustomerCredit(false);
        setCustomerCreditAmountInput("");
        return;
      }

      try {
        const data = (await getRequest(
          `/clients/${selectedCustomer.id}/credits`,
        )) as CustomerCreditsResponse;
        setCustomerCredits(Array.isArray(data.items) ? data.items : []);
        setCustomerCreditAvailable(Number(data.totalAvailable || 0));
      } catch (_error) {
        setCustomerCredits([]);
        setCustomerCreditAvailable(0);
        setUseCustomerCredit(false);
        setCustomerCreditAmountInput("");
      }
    };

    void fetchCustomerCredits();
  }, [selectedCustomer]);

  useEffect(() => {
    const quoteId = Number(quoteIdParam);
    if (!Number.isInteger(quoteId) || quoteId <= 0) {
      setEditingSaleStatus(null);
      return;
    }

    const loadExistingQuote = async () => {
      try {
        setLoadingExistingQuote(true);
        setSaveMessage("");

        const data = (await getRequest(
          `/sales/${quoteId}`,
        )) as ExistingQuoteResponse;

        if (
          data.status !== "BUDGET" &&
          !(quoteModeParam === "edit" && data.status === "COMPLETED")
        ) {
          setSaveMessage(
            "Somente orçamentos em aberto podem ser finalizados por este fluxo.",
          );
          return;
        }

        setEditingSaleStatus(data.status);
        setDraftSaleId(data.id);
        setSelectedCustomer(
          data.customer
            ? {
                id: data.customer.id,
                name: normalizeCustomerDisplayName(data.customer.name),
              }
            : null,
        );
        setSearch(normalizeCustomerDisplayName(data.customer?.name));
        applyDraftCollections(hydrateDraftCollectionsFromQuote(data));
        paymentDraftHydrationRef.current = true;
        setPaymentTypeId(
          data.paymentDraft?.paymentTypeId
            ? String(data.paymentDraft.paymentTypeId)
            : data.paymentType?.id
              ? String(data.paymentType.id)
            : "",
        );
        setInstallmentCount(
          String(
            data.paymentDraft?.installmentCount || data.installmentCount || 1,
          ),
        );
        setInstallmentIntervalDays(
          String(data.paymentDraft?.installmentIntervalDays || 30),
        );
        setDueDate(
          data.paymentDraft?.dueDate
            ? String(data.paymentDraft.dueDate).slice(0, 10)
            : data.dueDate
              ? String(data.dueDate).slice(0, 10)
              : getDueDateInputValue(),
        );
        setEntryAmount(
          data.paymentDraft?.entryAmount !== null &&
            data.paymentDraft?.entryAmount !== undefined
            ? String(data.paymentDraft.entryAmount)
            : "",
        );
        setEntryPaymentTypeId(
          data.paymentDraft?.entryPaymentTypeId
            ? String(data.paymentDraft.entryPaymentTypeId)
            : "",
        );
        setEntryReferenceCode(data.paymentDraft?.entryReferenceCode || "");
        setPaymentReferenceCode(data.paymentDraft?.paymentReferenceCode || "");
        setUseCustomerCredit(Boolean(data.paymentDraft?.useCustomerCredit));
        setCustomerCreditAmountInput(
          data.paymentDraft?.customerCreditAmount
            ? formatCurrency(data.paymentDraft.customerCreditAmount)
            : "",
        );
        setDoesNotGenerateDebt(Boolean(data.doesNotGenerateDebt));
        setInternalReason(data.internalReason || "");
        setStep(quoteModeParam === "edit" ? 3 : 4);
        setSaveMessage(
          data.status === "COMPLETED" && quoteModeParam === "edit"
            ? "Venda carregada para edição. O financeiro existente será preservado."
            : "Orçamento carregado. Informe a forma de pagamento para concluir a venda.",
        );
      } catch (error: unknown) {
        setSaveMessage(
          getUserFacingApiErrorMessage(
            error,
            "Não foi possível carregar o orçamento para finalização.",
          ),
        );
      } finally {
        setLoadingExistingQuote(false);
      }
    };

    void loadExistingQuote();
  }, [quoteIdParam, quoteModeParam]);

  const filteredCustomers = useMemo(() => customers, [customers]);
  const hasOpenSaleDraft = tableItems.length > 0 || draftSaleId !== null;

  useEffect(() => {
    const handleNavigationIntent = (event: Event) => {
      const customEvent = event as CustomEvent<{ path?: string }>;

      if (!hasOpenSaleDraft) {
        return;
      }

      event.preventDefault();
      setPendingExitPath(customEvent.detail?.path || "/vendas");
      setCancelSaleModalOpen(true);
    };

    window.addEventListener(
      "app:navigate-intent",
      handleNavigationIntent as EventListener,
    );
    return () =>
      window.removeEventListener(
        "app:navigate-intent",
        handleNavigationIntent as EventListener,
      );
  }, [hasOpenSaleDraft]);

  const selectedTypesLabel = useMemo(() => {
    const labels = Array.from(new Set(tableItems.map((item) => item.type)));
    return labels.length ? labels.join(" + ") : "Não definido";
  }, [tableItems]);

  const totalValue = useMemo(
    () =>
      Number(tableItems.reduce((acc, item) => acc + item.value, 0).toFixed(2)),
    [tableItems],
  );
  const discountAmount = useMemo(
    () =>
      Number(
        tableItems
          .reduce((acc, item) => acc + item.discountAmount, 0)
          .toFixed(2),
      ),
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
    () =>
      Number(
        tableItems.reduce((acc, item) => acc + item.finalValue, 0).toFixed(2),
      ),
    [tableItems],
  );
  const selectedPaymentType = useMemo(
    () =>
      paymentTypes.find((item) => String(item.id) === paymentTypeId) || null,
    [paymentTypeId, paymentTypes],
  );
  const isCreditPayment = useMemo(
    () => selectedPaymentType?.kind === "CARD",
    [selectedPaymentType],
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
  const isPixPayment = useMemo(
    () => normalizePaymentTypeName(selectedPaymentType?.name) === "PIX",
    [selectedPaymentType],
  );
  const isDebitPayment = useMemo(
    () => normalizePaymentTypeName(selectedPaymentType?.name) === "DEBITO",
    [selectedPaymentType],
  );
  const isPixOrDebitPayment = useMemo(
    () => isPixPayment || isDebitPayment,
    [isDebitPayment, isPixPayment],
  );
  const shouldAllowEntryAmount = useMemo(
    () =>
      Boolean(selectedPaymentType?.allowsEntryAmount) &&
      !isPixOrDebitPayment,
    [isPixOrDebitPayment, selectedPaymentType],
  );
  const shouldShowInstallmentVisualization = useMemo(
    () =>
      !doesNotGenerateDebt &&
      Boolean(selectedPaymentType) &&
      !isImmediateCashPayment &&
      !isPixOrDebitPayment,
    [
      doesNotGenerateDebt,
      isImmediateCashPayment,
      isPixOrDebitPayment,
      selectedPaymentType,
    ],
  );
  const isDebtExemptionActive = doesNotGenerateDebt;
  const entryPaymentTypeOptions = useMemo(
    () =>
      paymentTypes.filter((item) => {
        const normalizedName = String(item.name || "")
          .trim()
          .toUpperCase();
        return normalizedName === "DINHEIRO" || normalizedName === "PIX";
      }),
    [paymentTypes],
  );
  const parsedEntryAmount = useMemo(() => {
    if (!entryAmount.trim()) return 0;
    return parseCurrencyToNumber(entryAmount);
  }, [entryAmount]);
  const parsedCustomerCreditAmount = useMemo(() => {
    if (!customerCreditAmountInput.trim()) return 0;
    return parseCurrencyToNumber(customerCreditAmountInput);
  }, [customerCreditAmountInput]);
  const customerCreditToApply = useMemo(() => {
    if (!useCustomerCredit) return 0;
    return Math.max(
      0,
      Math.min(
        Number(parsedCustomerCreditAmount.toFixed(2)),
        Number(customerCreditAvailable.toFixed(2)),
        Math.max(0, Number((discountedTotalValue - 0.01).toFixed(2))),
      ),
    );
  }, [
    customerCreditAvailable,
    discountedTotalValue,
    parsedCustomerCreditAmount,
    useCustomerCredit,
  ]);
  const parsedInstallmentIntervalDays = useMemo(() => {
    const parsed = Number(installmentIntervalDays);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return 30;
    }

    return parsed;
  }, [installmentIntervalDays]);
  const maxEntryAmount = useMemo(
    () =>
      Math.max(
        0,
        Number((discountedTotalValue - customerCreditToApply).toFixed(2)),
      ),
    [customerCreditToApply, discountedTotalValue],
  );
  const hasEntryAmountError = useMemo(
    () =>
      !doesNotGenerateDebt &&
      shouldAllowEntryAmount &&
      parsedEntryAmount >= maxEntryAmount,
    [
      doesNotGenerateDebt,
      maxEntryAmount,
      parsedEntryAmount,
      shouldAllowEntryAmount,
    ],
  );
  const remainingAmount = useMemo(
    () =>
      Math.max(
        0,
        Number(
          (
            discountedTotalValue -
            customerCreditToApply -
            parsedEntryAmount
          ).toFixed(2),
        ),
      ),
    [customerCreditToApply, discountedTotalValue, parsedEntryAmount],
  );
  const parsedCashReceivedAmount = useMemo(() => {
    return parseCurrencyToNumber(cashReceivedAmount);
  }, [cashReceivedAmount]);
  const changeAmount = useMemo(() => {
    if (!isImmediateCashPayment) return 0;
    return Math.max(
      0,
      Number(
        (
          parsedCashReceivedAmount -
          (discountedTotalValue - customerCreditToApply)
        ).toFixed(2),
      ),
    );
  }, [
    customerCreditToApply,
    discountedTotalValue,
    isImmediateCashPayment,
    parsedCashReceivedAmount,
  ]);
  const requiresCashSessionForCurrentSale = useMemo(
    () => !isDebtExemptionActive && tableItems.length > 0,
    [isDebtExemptionActive, tableItems.length],
  );
  const previewInstallmentCount = useMemo(() => {
    if (!selectedPaymentType) return 1;
    if (selectedPaymentType.allowsInstallments) {
      return Math.max(
        1,
        Number(installmentCount) ||
          selectedPaymentType.defaultInstallments ||
          1,
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
  const paymentInstallmentPreview = useMemo<InstallmentPreviewRow[]>(() => {
    if (!shouldShowInstallmentVisualization || remainingAmount <= 0) {
      return [];
    }

    const baseDate =
      selectedPaymentType?.requiresDueDate && dueDate
        ? getDateFromInputValue(dueDate)
        : getDateFromInputValue(getCurrentDateInputValue());

    return installmentPreview.map((amount, index) => ({
      installmentNumber: index + 1,
      totalInstallments: installmentPreview.length,
      amount,
      dueDate: formatDateInputValue(
        addDays(
          baseDate,
          parsedInstallmentIntervalDays *
            (selectedPaymentType?.requiresDueDate ? index : index + 1),
        ),
      ),
    }));
  }, [
    dueDate,
    installmentPreview,
    parsedInstallmentIntervalDays,
    remainingAmount,
    selectedPaymentType,
    shouldShowInstallmentVisualization,
  ]);
  const canSaveSale =
    !isSaving &&
    !!selectedCustomer &&
    tableItems.length > 0 &&
    (isDebtExemptionActive || !!paymentTypeId) &&
    (isDebtExemptionActive ||
      !selectedPaymentType?.requiresDueDate ||
      !!dueDate) &&
    (isDebtExemptionActive ||
      !shouldAllowEntryAmount ||
      parsedEntryAmount <= 0 ||
      !!entryPaymentTypeId) &&
    (isDebtExemptionActive ||
      !isImmediateCashPayment ||
      parsedCashReceivedAmount >=
        Number((discountedTotalValue - customerCreditToApply).toFixed(2))) &&
    (isDebtExemptionActive ||
      !isImmediateCheckPayment ||
      !!paymentReferenceCode.trim()) &&
    (isDebtExemptionActive ||
      !useCustomerCredit ||
      (customerCreditToApply > 0 &&
        customerCreditToApply < discountedTotalValue)) &&
    (isDebtExemptionActive ||
      parsedEntryAmount + customerCreditToApply < discountedTotalValue);
  const canAttemptCompleteSale =
    canSaveSale ||
    (!isSaving &&
      !!selectedCustomer &&
      tableItems.length > 0 &&
      hasEntryAmountError);
  const canCreateQuote =
    !isSaving && !!selectedCustomer && tableItems.length > 0;
  const hasGeneratedQuote = draftSaleId !== null;
  const isEditingCompletedSale =
    quoteModeParam === "edit" && editingSaleStatus === "COMPLETED";

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const applyDraftCollections = useCallback((drafts: DraftCollections) => {
    setReadyMadeProducts(drafts.readyMade);
    setCustomMadeProducts(drafts.customMade);
    setAccessoryProducts(drafts.accessory);
    setServiceProducts(drafts.service);
    setMiscProducts(drafts.misc);
    setTableItems(buildTableItemsFromDraftCollections(drafts, formatCurrency));
  }, []);

  const buildPaymentDraftPayload = () => ({
    paymentTypeId:
      doesNotGenerateDebt || !paymentTypeId ? null : Number(paymentTypeId),
    installmentCount: previewInstallmentCount,
    installmentIntervalDays: isCreditPayment
      ? parsedInstallmentIntervalDays
      : null,
    dueDate:
      doesNotGenerateDebt || !selectedPaymentType?.requiresDueDate
        ? null
        : dueDate,
    entryAmount:
      !doesNotGenerateDebt &&
      shouldAllowEntryAmount &&
      parsedEntryAmount > 0
        ? parsedEntryAmount
        : null,
    entryPaymentTypeId:
      !doesNotGenerateDebt && entryPaymentTypeId
        ? Number(entryPaymentTypeId)
        : null,
    entryReferenceCode: doesNotGenerateDebt ? null : entryReferenceCode || null,
    paymentReferenceCode: doesNotGenerateDebt
      ? null
      : paymentReferenceCode || null,
    useCustomerCredit: doesNotGenerateDebt ? false : useCustomerCredit,
    customerCreditAmount:
      !doesNotGenerateDebt && customerCreditToApply > 0
        ? customerCreditToApply
        : null,
  });

  const hydrateDraftCollectionsFromQuote = useCallback(
    (data: ExistingQuoteResponse) => {
      const readyMade: ReadyMadeProductDraft[] = [];
      const customMade: CustomMadeProductDraft[] = [];
      const accessory: GeneralCatalogProductDraft[] = [];
      const service: GeneralCatalogProductDraft[] = [];
      const misc: GeneralCatalogProductDraft[] = [];
      (data.items || []).forEach((item, index) => {
        const metadata = item.metadata || {};
        const unitPriceValue = Number(item.unitPrice || 0);
        const materialCostValue = Number(
          (metadata.materialCost as number | null) || 0,
        );
        const discountPercentValue =
          item.discountType === "PERCENTAGE"
            ? Number(item.discountValue || 0)
            : 0;

        if (item.itemType === "READY_MADE") {
          readyMade.push({
            id: item.id || index + 1,
            name: item.description || "",
            size: String(metadata.size || ""),
            quantity: String(item.quantity || 1),
            price: formatCurrency(unitPriceValue),
            materialCost:
              materialCostValue > 0 ? formatCurrency(materialCostValue) : "",
            discountPercent:
              discountPercentValue > 0 ? String(discountPercentValue) : "",
          });
          return;
        }

        if (item.itemType === "CUSTOM_MADE") {
          const measurementData = buildMeasurementsMap(data.measurements);

          customMade.push({
            id: item.id || index + 1,
            productMode: String(metadata.productMode || "Sob medida"),
            type: String(metadata.clothingType || ""),
            fabric: String(metadata.fabric || ""),
            color: String(metadata.color || ""),
            measurements: measurementData.measurements,
            selectedMeasurements: Array.isArray(metadata.selectedMeasurements)
              ? (metadata.selectedMeasurements.map((value) =>
                  String(value),
                ) as CustomMadeProductDraft["selectedMeasurements"])
              : measurementData.selectedMeasurements,
            description: item.description || "",
            price: formatCurrency(unitPriceValue),
            discountPercent:
              discountPercentValue > 0 ? String(discountPercentValue) : "",
            details: String(metadata.details || ""),
            status: String(metadata.status || "A PRODUZIR"),
            seamstress: String(metadata.seamstress || ""),
            fittingDate: String(metadata.fittingDate || item.fittingDate || ""),
            seamstressCost:
              Number((metadata.seamstressCost as number | null) || 0) > 0
                ? formatCurrency(Number(metadata.seamstressCost))
                : "",
          });
          return;
        }

        const genericDraft: GeneralCatalogProductDraft = {
          id: item.id || index + 1,
          name: item.description || "",
          quantity: String(item.quantity || 1),
          price: formatCurrency(unitPriceValue),
          materialCost:
            materialCostValue > 0 ? formatCurrency(materialCostValue) : "",
          discountPercent:
            discountPercentValue > 0 ? String(discountPercentValue) : "",
        };

        if (item.itemType === "ACCESSORY") {
          accessory.push(genericDraft);
        } else if (item.itemType === "SERVICE") {
          service.push(genericDraft);
        } else {
          misc.push(genericDraft);
        }
      });

      return {
        readyMade,
        customMade,
        accessory,
        service,
        misc,
      };
    },
    [],
  );

  const handleModalSummaryChange = useCallback((items: ModalSummaryItem[]) => {
    setModalItems(items);
  }, []);

  const handleModalReadyMadeProductsChange = useCallback(
    (items: ReadyMadeProductDraft[]) => {
      setModalReadyMadeProducts(items);
    },
    [],
  );

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

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setModalItems([]);
    setModalReadyMadeProducts([]);
    setModalCustomMadeProducts([]);
    setModalGeneralProducts([]);
  };

  const openModal = (
    type: ModalType,
    options?: {
      editingItem?: EditingItemState;
      readyMadeProducts?: ReadyMadeProductDraft[];
      customMadeProducts?: CustomMadeProductDraft[];
      generalProducts?: GeneralCatalogProductDraft[];
    },
  ) => {
    setModalType(type);
    setEditingItem(options?.editingItem || null);
    setModalItems([]);
    setModalReadyMadeProducts(options?.readyMadeProducts || []);
    setModalCustomMadeProducts(options?.customMadeProducts || []);
    setModalGeneralProducts(options?.generalProducts || []);
    setModalSessionKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const resolveModalTypeFromSelection = () => {
    if (selectedCategoryCode === "CLOTHING") {
      if (selectedClothingSubtype === "READY_MADE") return "Roupa pronta";
      if (isCustomMadeClothingSubtype(selectedClothingSubtype))
        return "Sob medida";
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
        setRolloverCashModalOpen(true);
        setSaveMessage("");
        return false;
      }

      if (!parsed?.hasOpenSession) {
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

    const nextPaymentType =
      paymentTypes.find((item) => String(item.id) === value) || null;
    const requiresCashSession =
      nextPaymentType?.kind === "CASH" &&
      nextPaymentType.financialFlow === "IMMEDIATE_CASH";

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
    if (paymentDraftHydrationRef.current) {
      paymentDraftHydrationRef.current = false;
      return;
    }

    if (!selectedPaymentType) {
      setInstallmentCount("1");
      setInstallmentIntervalDays("30");
      setEntryAmount("");
      setEntryPaymentTypeId("");
      setEntryReferenceCode("");
      setPaymentReferenceCode("");
      setCashReceivedAmount("");
      return;
    }

    setInstallmentCount(String(selectedPaymentType.defaultInstallments || 1));
    setInstallmentIntervalDays("30");

    if (!selectedPaymentType.requiresDueDate) {
      setDueDate(getDueDateInputValue());
    }

    if (!shouldAllowEntryAmount) {
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
  }, [
    isImmediateCashPayment,
    isImmediateCheckPayment,
    selectedPaymentType,
    shouldAllowEntryAmount,
  ]);

  useEffect(() => {
    if (!doesNotGenerateDebt) {
      return;
    }

    setPaymentTypeId("");
    setInstallmentCount("1");
    setInstallmentIntervalDays("30");
    setDueDate(getDueDateInputValue());
    setEntryAmount("");
    setEntryPaymentTypeId("");
    setEntryReferenceCode("");
    setPaymentReferenceCode("");
    setCashReceivedAmount("");
    setUseCustomerCredit(false);
    setCustomerCreditAmountInput("");
  }, [doesNotGenerateDebt]);

  const addModalItemsToTable = () => {
    handleSaveModalItems();
  };

  const handleSaveModalItems = () => {
    if (!modalItems.length) {
      return;
    }

    const normalizedModalType = String(modalType)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const nextDrafts: DraftCollections = {
      readyMade: [...readyMadeProducts],
      customMade: [...customMadeProducts],
      accessory: [...accessoryProducts],
      service: [...serviceProducts],
      misc: [...miscProducts],
    };

    if (editingItem) {
      if (
        editingItem.sourceItemType === "READY_MADE" &&
        modalReadyMadeProducts[0]
      ) {
        nextDrafts.readyMade[editingItem.sourceIndex] =
          modalReadyMadeProducts[0];
      } else if (
        editingItem.sourceItemType === "CUSTOM_MADE" &&
        modalCustomMadeProducts[0]
      ) {
        nextDrafts.customMade[editingItem.sourceIndex] = {
          ...modalCustomMadeProducts[0],
          productMode:
            modalCustomMadeProducts[0].productMode ||
            nextDrafts.customMade[editingItem.sourceIndex]?.productMode ||
            "Sob medida",
        };
      } else if (
        editingItem.sourceItemType === "ACCESSORY" &&
        modalGeneralProducts[0]
      ) {
        nextDrafts.accessory[editingItem.sourceIndex] = modalGeneralProducts[0];
      } else if (
        editingItem.sourceItemType === "SERVICE" &&
        modalGeneralProducts[0]
      ) {
        nextDrafts.service[editingItem.sourceIndex] = modalGeneralProducts[0];
      } else if (
        editingItem.sourceItemType === "MISC" &&
        modalGeneralProducts[0]
      ) {
        nextDrafts.misc[editingItem.sourceIndex] = modalGeneralProducts[0];
      }
    } else if (modalType === "Roupa pronta") {
      nextDrafts.readyMade = [
        ...nextDrafts.readyMade,
        ...modalReadyMadeProducts,
      ];
    } else if (modalType === "Sob medida") {
      const resolvedModeLabel = getCustomProductModeLabel(
        selectedClothingSubtype,
      );
      nextDrafts.customMade = [
        ...nextDrafts.customMade,
        ...modalCustomMadeProducts.map((product) => ({
          ...product,
          productMode: product.productMode || resolvedModeLabel,
        })),
      ];
    } else if (normalizedModalType.includes("acessor")) {
      nextDrafts.accessory = [...nextDrafts.accessory, ...modalGeneralProducts];
    } else if (normalizedModalType.includes("serv")) {
      nextDrafts.service = [...nextDrafts.service, ...modalGeneralProducts];
    } else {
      nextDrafts.misc = [...nextDrafts.misc, ...modalGeneralProducts];
    }

    applyDraftCollections(nextDrafts);
    closeModal();
    setStep(3);
  };

  const handleEditTableItem = (item: SaleTableItem) => {
    const editingState: EditingItemState = {
      modalType: mapSaleItemTypeToModalType(
        item.sourceItemType as ExistingQuoteItem["itemType"],
      ),
      sourceItemType: item.sourceItemType,
      sourceIndex: item.sourceIndex,
    };

    if (item.sourceItemType === "READY_MADE") {
      const product = readyMadeProducts[item.sourceIndex];
      if (!product) return;
      openModal(item.type, {
        editingItem: editingState,
        readyMadeProducts: [{ ...product }],
      });
      return;
    }

    if (item.sourceItemType === "CUSTOM_MADE") {
      const product = customMadeProducts[item.sourceIndex];
      if (!product) return;
      openModal(item.type, {
        editingItem: editingState,
        customMadeProducts: [
          {
            ...product,
            measurements: { ...product.measurements },
            selectedMeasurements: [...product.selectedMeasurements],
          },
        ],
      });
      return;
    }

    const genericProduct =
      item.sourceItemType === "ACCESSORY"
        ? accessoryProducts[item.sourceIndex]
        : item.sourceItemType === "SERVICE"
          ? serviceProducts[item.sourceIndex]
          : miscProducts[item.sourceIndex];

    if (!genericProduct) return;

    openModal(item.type, {
      editingItem: editingState,
      generalProducts: [{ ...genericProduct }],
    });
  };

  const handleRemoveTableItem = (item: SaleTableItem) => {
    if (isEditingCompletedSale) {
      return;
    }

    const nextDrafts: DraftCollections = {
      readyMade: [...readyMadeProducts],
      customMade: [...customMadeProducts],
      accessory: [...accessoryProducts],
      service: [...serviceProducts],
      misc: [...miscProducts],
    };

    if (item.sourceItemType === "READY_MADE") {
      nextDrafts.readyMade.splice(item.sourceIndex, 1);
    } else if (item.sourceItemType === "CUSTOM_MADE") {
      nextDrafts.customMade.splice(item.sourceIndex, 1);
    } else if (item.sourceItemType === "ACCESSORY") {
      nextDrafts.accessory.splice(item.sourceIndex, 1);
    } else if (item.sourceItemType === "SERVICE") {
      nextDrafts.service.splice(item.sourceIndex, 1);
    } else {
      nextDrafts.misc.splice(item.sourceIndex, 1);
    }

    applyDraftCollections(nextDrafts);
  };

  const buildGenericSaleItems = (
    products: GeneralCatalogProductDraft[],
    itemType: "ACCESSORY" | "SERVICE" | "MISC",
    fallbackLabel: string,
  ) =>
    products.map((product) => {
      const quantity =
        Number(product.quantity) > 0 ? Number(product.quantity) : 1;
      const unitPrice = parseCurrencyToNumber(product.price);
      const materialCost = parseCurrencyToNumber(product.materialCost);
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
        subtotal: Number(
          (unitPrice * quantity * (1 - discountPercent / 100)).toFixed(2),
        ),
        metadata: {
          materialCost: materialCost || null,
        },
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
        const quantity =
          Number(product.quantity) > 0 ? Number(product.quantity) : 1;
        const unitPrice = parseCurrencyToNumber(product.price);
        const materialCost = parseCurrencyToNumber(product.materialCost);
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
          subtotal: Number(
            (unitPrice * quantity * (1 - discountPercent / 100)).toFixed(2),
          ),
          metadata: {
            size: product.size || null,
            materialCost: materialCost || null,
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
          description: buildCustomMadeDescription(product),
          quantity: 1,
          unitPrice,
          discountType: discountPercent > 0 ? "PERCENTAGE" : null,
          discountValue: discountPercent > 0 ? discountPercent : null,
          subtotal: Number(
            (unitPrice * (1 - discountPercent / 100)).toFixed(2),
          ),
          metadata: {
            productMode:
              product.productMode ||
              getCustomProductModeLabel(selectedClothingSubtype),
            clothingType: product.type || null,
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
      const serviceItems = buildGenericSaleItems(
        serviceProducts,
        "SERVICE",
        "Serviço",
      );
      const miscItems = buildGenericSaleItems(miscProducts, "MISC", "Diversos");

      const customerMeasurements = buildCustomerMeasurementsPayload();

      await postRequest("/sales", {
        customerId: selectedCustomer.id,
        totalAmount: totalValue,
        finalAmount: discountedTotalValue,
        discountType: saleDiscountPayload.discountType,
        discountValue: saleDiscountPayload.discountValue,
        paymentTypeId: paymentTypeId ? Number(paymentTypeId) : null,
        installmentCount: previewInstallmentCount,
        installmentIntervalDays: isCreditPayment
          ? parsedInstallmentIntervalDays
          : null,
        dueDate: selectedPaymentType?.requiresDueDate ? dueDate : null,
        entryAmount:
          shouldAllowEntryAmount && parsedEntryAmount > 0
            ? parsedEntryAmount
            : null,
        entryPaymentTypeId: entryPaymentTypeId
          ? Number(entryPaymentTypeId)
          : null,
        entryPaidAt: parsedEntryAmount > 0 ? getCurrentDateInputValue() : null,
        entryReferenceCode: entryReferenceCode || null,
        paymentReferenceCode: paymentReferenceCode || null,
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
      setInstallmentIntervalDays("30");
      setDueDate(getDueDateInputValue());
      setEntryAmount("");
      setEntryPaymentTypeId("");
      setEntryReferenceCode("");
      setPaymentReferenceCode("");
      setCashReceivedAmount("");
      setStep(1);
      const updatedCashSessionStatus = await getRequest("/cash/session-status");
      setCashSessionStatus(
        (updatedCashSessionStatus as CashSessionStatusResponse) || null,
      );
    } catch (error: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível salvar o pedido.",
        ),
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
          "O caixa pendente foi encerrado e o caixa do dia foi aberto. Agora voce pode continuar com o pedido.",
      });
      setSaveMessage("");
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
          "O caixa da loja foi aberto. Agora voce pode continuar com o pedido.",
      });
      setSaveMessage("");
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

  const buildSaleItemsPayload = () => {
    const readyMadeItems = readyMadeProducts.map((product) => {
      const quantity =
        Number(product.quantity) > 0 ? Number(product.quantity) : 1;
      const unitPrice = parseCurrencyToNumber(product.price);
      const materialCost = parseCurrencyToNumber(product.materialCost);
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
        subtotal: Number(
          (unitPrice * quantity * (1 - discountPercent / 100)).toFixed(2),
        ),
        metadata: {
          size: product.size || null,
          materialCost: materialCost || null,
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
        description: buildCustomMadeDescription(product),
        quantity: 1,
        unitPrice,
        discountType: discountPercent > 0 ? "PERCENTAGE" : null,
        discountValue: discountPercent > 0 ? discountPercent : null,
        subtotal: Number((unitPrice * (1 - discountPercent / 100)).toFixed(2)),
        metadata: {
          productMode:
            product.productMode ||
            getCustomProductModeLabel(selectedClothingSubtype),
          clothingType: product.type || null,
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
    const serviceItems = buildGenericSaleItems(
      serviceProducts,
      "SERVICE",
      "Serviço",
    );
    const miscItems = buildGenericSaleItems(miscProducts, "MISC", "Diversos");

    return [
      ...readyMadeItems,
      ...customItems,
      ...accessoryItems,
      ...serviceItems,
      ...miscItems,
    ];
  };

  const buildCustomerMeasurementsPayload = () => {
    const measurementsByKey = new Map<string, { key: string; value: string }>();

    customMadeProducts.forEach((product) => {
      product.selectedMeasurements.forEach((key) => {
        const value = String(product.measurements[key] || "").trim();

        if (!value || measurementsByKey.has(key)) {
          return;
        }

        measurementsByKey.set(key, {
          key,
          value,
        });
      });
    });

    return Array.from(measurementsByKey.values());
  };

  const buildQuotePayload = () => {
    if (!selectedCustomer) {
      return null;
    }

    return {
      customerId: selectedCustomer.id,
      totalAmount: totalValue,
      finalAmount: discountedTotalValue,
      doesNotGenerateDebt,
      internalReason: doesNotGenerateDebt
        ? internalReason.trim() || null
        : null,
      discountType: saleDiscountPayload.discountType,
      discountValue: saleDiscountPayload.discountValue,
      items: buildSaleItemsPayload(),
      customerMeasurements: buildCustomerMeasurementsPayload(),
      ...buildPaymentDraftPayload(),
    };
  };

  const buildFinalizePayload = () => {
    const quotePayload = buildQuotePayload();

    if (!quotePayload) {
      return null;
    }

    return {
      ...quotePayload,
      paymentTypeId:
        doesNotGenerateDebt || !paymentTypeId ? null : Number(paymentTypeId),
      installmentCount: doesNotGenerateDebt ? 1 : previewInstallmentCount,
      installmentIntervalDays: isCreditPayment
        ? parsedInstallmentIntervalDays
        : null,
      dueDate:
        doesNotGenerateDebt || !selectedPaymentType?.requiresDueDate
          ? null
          : dueDate,
      entryAmount:
        !doesNotGenerateDebt &&
        shouldAllowEntryAmount &&
        parsedEntryAmount > 0
          ? parsedEntryAmount
          : null,
      entryPaymentTypeId:
        !doesNotGenerateDebt && entryPaymentTypeId
          ? Number(entryPaymentTypeId)
          : null,
      entryPaidAt:
        !doesNotGenerateDebt && parsedEntryAmount > 0
          ? getCurrentDateInputValue()
          : null,
      entryReferenceCode: doesNotGenerateDebt
        ? null
        : entryReferenceCode || null,
      paymentReferenceCode: doesNotGenerateDebt
        ? null
        : paymentReferenceCode || null,
      useCustomerCredit: doesNotGenerateDebt ? false : useCustomerCredit,
      customerCreditAmount:
        !doesNotGenerateDebt && customerCreditToApply > 0
          ? customerCreditToApply
          : null,
    };
  };

  const resetSaleForm = async () => {
    setDraftSaleId(null);
    setEditingSaleStatus(null);
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
    setInstallmentIntervalDays("30");
    setDueDate(getDueDateInputValue());
    setEntryAmount("");
    setEntryPaymentTypeId("");
    setEntryReferenceCode("");
    setPaymentReferenceCode("");
    setCashReceivedAmount("");
    setCustomerCredits([]);
    setCustomerCreditAvailable(0);
    setUseCustomerCredit(false);
    setCustomerCreditAmountInput("");
    setDoesNotGenerateDebt(false);
    setInternalReason("");
    setStep(1);
    const updatedCashSessionStatus = await getRequest("/cash/session-status");
    setCashSessionStatus(
      (updatedCashSessionStatus as CashSessionStatusResponse) || null,
    );
  };

  const handleBackToStart = () => {
    if (isEditingCompletedSale) {
      navigate(returnToParam);
      return;
    }

    if (hasOpenSaleDraft) {
      setPendingExitPath("/vendas");
      setCancelSaleModalOpen(true);
      return;
    }

    navigate("/vendas");
  };

  const handleContinueOpenSale = () => {
    setCancelSaleModalOpen(false);
    setPendingExitPath(null);
  };

  const handleDiscardOpenSale = async () => {
    setCancelSaleModalOpen(false);

    if (draftSaleId !== null) {
      try {
        setIsSaving(true);
        setSaveMessage("");
        await deleteRequest(`/sales/${draftSaleId}`, {});
      } catch (error: unknown) {
        setSaveMessage(
          getUserFacingApiErrorMessage(
            error,
            "Não foi possível descartar o orçamento.",
          ),
        );
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    await resetSaleForm();
    navigate(pendingExitPath || "/vendas");
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
      const payload = buildQuotePayload();

      if (!payload) {
        return null;
      }

      const created = await postRequest("/sales", payload);

      const nextDraftSaleId = Number((created as { id?: number }).id);
      setDraftSaleId(nextDraftSaleId);
      setSaveMessage(
        "Orçamento gerado com sucesso. Agora informe a forma de pagamento para concluir o pedido.",
      );
      return nextDraftSaleId;
    } catch (error: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível gerar o orçamento.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveOrUpdateDraftSale = async () => {
    if (!selectedCustomer || tableItems.length === 0) {
      return null;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");
      const payload = buildQuotePayload();

      if (!payload) {
        return null;
      }

      if (hasGeneratedQuote && draftSaleId !== null) {
        const updated = await updateRequest(`/sales/${draftSaleId}`, payload);
        const persistedDraftSaleId = Number(
          (updated as { id?: number }).id || draftSaleId,
        );
        setDraftSaleId(persistedDraftSaleId);
        setSaveMessage("Orçamento atualizado com sucesso.");
        return persistedDraftSaleId;
      }

      const created = await postRequest("/sales", payload);
      const nextDraftSaleId = Number((created as { id?: number }).id);
      setDraftSaleId(nextDraftSaleId);
      setSaveMessage("Orçamento gerado com sucesso.");
      return nextDraftSaleId;
    } catch (error: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível salvar o orçamento.",
        ),
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuote = async () => {
    const createdDraftSaleId = await saveOrUpdateDraftSale();

    if (!createdDraftSaleId) {
      return;
    }

    navigate(`/vendas?tab=budgets&highlight=${createdDraftSaleId}`);
  };

  const handleSaveQuoteAndExit = async () => {
    const persistedDraftSaleId = await saveOrUpdateDraftSale();

    if (!persistedDraftSaleId) {
      return;
    }

    setCancelSaleModalOpen(false);
    navigate(
      pendingExitPath ||
        `/vendas?tab=budgets&highlight=${persistedDraftSaleId}`,
    );
  };

  const handleSaveCompletedSale = async () => {
    if (!selectedCustomer || tableItems.length === 0 || !draftSaleId) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("");
      const payload = buildQuotePayload();

      if (!payload) {
        return;
      }

      await updateRequest(`/sales/${draftSaleId}`, payload);
      await resetSaleForm();
      navigate(returnToParam);
    } catch (error: unknown) {
      setSaveMessage(
        getUserFacingApiErrorMessage(
          error,
          "Não foi possível salvar a venda finalizada.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartFinalizeSale = async () => {
    const createdDraftSaleId = await createDraftSale();

    if (!createdDraftSaleId) {
      return;
    }

    setSaveMessage(
      "Orçamento gerado com sucesso. Agora informe a forma de pagamento para concluir o pedido.",
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

      const payload = buildFinalizePayload();
      if (!payload) {
        return;
      }

      await updateRequest(`/sales/${draftSaleId}/finalize`, payload);

      await resetSaleForm();
      navigate("/vendas");
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

  const handleOpenPaymentStep = async () => {
    setSaveMessage("");
    setStep(4);
  };

  const handleCompleteSale = async () => {
    if (!selectedCustomer || tableItems.length === 0) {
      return;
    }

    if (hasEntryAmountError) {
      setSaveMessage("A entrada não pode ser maior que o valor total.");
      return;
    }

    if (requiresCashSessionForCurrentSale) {
      const canContinue = await ensureCashSessionBeforeCashPayment();
      if (!canContinue) {
        setSaveMessage(
          "A venda só será finalizada com o caixa da loja aberto.",
        );
        return;
      }
    }

    try {
      setIsSaving(true);
      setSaveMessage("");
      const payload = buildFinalizePayload();

      if (!payload) {
        return;
      }

      if (draftSaleId !== null) {
        await updateRequest(`/sales/${draftSaleId}/finalize`, payload);
      } else {
        await postRequest("/sales", payload);
      }

      await resetSaleForm();
      navigate("/vendas");
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
  void handleStartFinalizeSale;
  void handleFinalizeQuote;

  const currentModalType = resolveModalTypeFromSelection();

  return (
    <div className="w-full min-w-0 min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5">
        <h1 className="pb-4 pt-8 text-4xl font-semibold text-primary md:text-[2rem]">
          {isEditingCompletedSale ? "Editar Venda Finalizada" : "Nova Venda/Orçamento"}
        </h1>
        <SaleStepper step={step} />

        {loadingExistingQuote ? (
          <div className="mb-4 rounded-lg border border-outline-variant/35 bg-white px-4 py-3 text-sm text-neutral-700">
            {isEditingCompletedSale
              ? "Carregando venda finalizada para edição..."
              : "Carregando orçamento para finalização..."}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="min-w-0 bg-surface-low p-4 shadow-sm sm:p-6">
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <p className="text-md font-semibold text-primary">
                  Passo 1: Escolha o cliente
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
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
                        className={paymentFieldClassName}
                      >
                        <option value="">Selecione...</option>
                        <option value="READY_MADE">Roupa pronta</option>
                        <option value="CUSTOM_MADE">Sob medida</option>
                        <option value="CUSTOM_ADJUSTMENT">Ajuste</option>
                        <option value="CUSTOM_REFORM">Reforma</option>
                      </select>
                    </div>
                  ) : null}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!currentModalType}
                      onClick={() =>
                        currentModalType && openModal(currentModalType)
                      }
                    >
                      + Adicionar item
                    </Button>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
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
                        <option value="CUSTOM_ADJUSTMENT">Ajuste</option>
                        <option value="CUSTOM_REFORM">Reforma</option>
                      </select>
                    </div>
                  ) : null}

                  <div className="flex items-end">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!currentModalType}
                      onClick={() =>
                        currentModalType && openModal(currentModalType)
                      }
                    >
                      + Adicionar item
                    </Button>
                  </div>
                </div>

                {tableItems.length > 0 && (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-outline-variant/45 bg-white">
                      <table className="min-w-180 w-full text-sm">
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
                            <th className="px-3 py-2 text-right font-semibold text-primary">
                              Ações
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
                                <div>{item.description}</div>
                                {item.fittingDate ? (
                                  <div className="text-xs text-neutral-600">
                                    Prova: {formatDate(item.fittingDate)}
                                  </div>
                                ) : null}
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
                              <td className="px-3 py-2">
                                <div className="flex flex-col justify-end gap-2 sm:flex-row">
                                  <Button
                                    type="button"
                                    className="w-full sm:w-auto"
                                    variant="secondary"
                                    onClick={() => handleEditTableItem(item)}
                                  >
                                    Editar
                                  </Button>
                                  {!isEditingCompletedSale ? (
                                    <Button
                                      type="button"
                                      className="w-full sm:w-auto"
                                      variant="tertiary"
                                      onClick={() => handleRemoveTableItem(item)}
                                    >
                                      Remover
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div className="flex w-full">
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant="secondary"
                      onClick={handleBackToStart}
                    >
                      Voltar
                    </Button>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      {isEditingCompletedSale ? (
                        <Button
                          type="button"
                          className="w-full sm:w-auto"
                          onClick={() => void handleSaveCompletedSale()}
                          disabled={!canCreateQuote || isSaving}
                        >
                          {isSaving ? "Salvando..." : "Salvar venda"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="tertiary"
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={handleCreateQuote}
                            disabled={!canCreateQuote}
                          >
                            {isSaving
                              ? hasGeneratedQuote
                                ? "Atualizando..."
                                : "Gerando..."
                              : hasGeneratedQuote
                                ? "Atualizar orçamento"
                                : "Gerar orçamento"}
                          </Button>
                          <Button
                            type="button"
                            className="w-full sm:w-auto"
                            onClick={handleOpenPaymentStep}
                            disabled={!canCreateQuote}
                          >
                            {isSaving ? "Preparando..." : "Finalizar venda"}
                          </Button>
                        </>
                      )}
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

                <div className="rounded-lg border border-outline-variant/45 bg-white p-4">
                  <div className="grid grid-cols-1 gap-4">
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={doesNotGenerateDebt}
                        onChange={(e) =>
                          setDoesNotGenerateDebt(e.target.checked)
                        }
                        className="h-4 w-4 rounded border border-outline-variant/60 accent-primary"
                      />
                      Não gerar conta a receber
                    </label>

                    {doesNotGenerateDebt ? (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary">
                          Motivo (opcional)
                        </label>
                        <input
                          value={internalReason}
                          onChange={(e) => setInternalReason(e.target.value)}
                          className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                          placeholder="Descreva o motivo interno da permuta."
                        />
                      </div>
                    ) : null}

                    {doesNotGenerateDebt ? (
                      <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest px-4 py-3 text-sm text-neutral-700">
                        Esta venda será salva apenas para consulta, sem gerar A
                        Receber, banco ou caixa.
                      </div>
                    ) : null}
                  </div>
                </div>

                {!doesNotGenerateDebt ? (
                  <div className="grid grid-cols-1 gap-3">
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
                  </div>
                ) : null}

                {!doesNotGenerateDebt && customerCreditAvailable > 0 ? (
                  <div className="rounded-lg border border-outline-variant/45 bg-white p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr] md:items-end">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-primary">
                          Credito da cliente
                        </p>
                        <p className="text-sm text-neutral-700">
                          Saldo disponivel:{" "}
                          <span className="font-semibold text-primary">
                            {formatCurrency(customerCreditAvailable)}
                          </span>
                        </p>
                        <label className="flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={useCustomerCredit}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUseCustomerCredit(checked);
                              if (!checked) {
                                setCustomerCreditAmountInput("");
                              }
                            }}
                            className="h-4 w-4 rounded border border-outline-variant/60 accent-primary"
                          />
                          Usar credito nesta venda
                        </label>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary">
                          Valor do credito
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={customerCreditAmountInput}
                          onChange={(e) =>
                            setCustomerCreditAmountInput(
                              formatCurrencyInput(e.target.value),
                            )
                          }
                          disabled={!useCustomerCredit}
                          placeholder="R$ 0,00"
                          className={
                            useCustomerCredit
                              ? paymentFieldClassName
                              : paymentReadonlyFieldClassName
                          }
                        />
                      </div>
                    </div>

                    {customerCredits.length > 0 ? (
                      <p className="mt-3 text-xs text-neutral-600">
                        Creditos ativos: {customerCredits.length} registro(s).
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!doesNotGenerateDebt && isImmediateCheckPayment && (
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
                        value={formatCurrency(
                          discountedTotalValue - customerCreditToApply,
                        )}
                        disabled
                        className={paymentReadonlyFieldClassName}
                      />
                    </div>
                  </div>
                )}

                {!doesNotGenerateDebt && isImmediateCashPayment && (
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
                          setCashReceivedAmount(
                            formatCurrencyInput(e.target.value),
                          )
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
                        value={formatCurrency(
                          discountedTotalValue - customerCreditToApply,
                        )}
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

                {!doesNotGenerateDebt &&
                  shouldAllowEntryAmount && (
                    <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary">
                          Valor de entrada
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={entryAmount}
                          onChange={(e) =>
                            setEntryAmount(formatCurrencyInput(e.target.value))
                          }
                          placeholder="R$ 0,00"
                          className={`${paymentFieldClassName} ${
                            hasEntryAmountError
                              ? "border-[#b42318] text-[#b42318] focus:ring-[#b42318]/30"
                              : ""
                          }`}
                        />
                        {hasEntryAmountError ? (
                          <p className="mt-1 text-xs text-[#b42318]">
                            A entrada não pode ser maior que o valor total.
                          </p>
                        ) : null}
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
                          Referência
                        </label>
                        <input
                          value={entryReferenceCode}
                          onChange={(e) =>
                            setEntryReferenceCode(e.target.value)
                          }
                          className={paymentFieldClassName}
                        />
                      </div>
                    </div>
                  )}

                {!doesNotGenerateDebt && selectedPaymentType ? (
                  isPixOrDebitPayment ? (
                    <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary">
                          Saldo
                        </label>
                        <input
                          value={formatCurrency(remainingAmount)}
                          disabled
                          className={paymentReadonlyFieldClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary">
                          Desconto
                        </label>
                        <input
                          value={formatCurrency(discountAmount)}
                          disabled
                          className={paymentReadonlyFieldClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-primary">
                          Valor final
                        </label>
                        <input
                          value={formatCurrency(discountedTotalValue)}
                          disabled
                          className={paymentReadonlyFieldClassName}
                        />
                      </div>
                    </div>
                  ) : selectedPaymentType.allowsInstallments ||
                    selectedPaymentType.requiresDueDate ||
                    shouldShowInstallmentVisualization ||
                    !isImmediateCashPayment ? (
                    <div
                      className={`grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/45 bg-white p-4 ${
                        selectedPaymentType.requiresDueDate ||
                        shouldShowInstallmentVisualization
                          ? "md:grid-cols-2"
                          : "md:grid-cols-1"
                      }`}
                    >
                      {selectedPaymentType.allowsInstallments ? (
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
                            className={paymentFieldClassName}
                          />
                        </div>
                      ) : !isImmediateCashPayment ? (
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
                      ) : null}

                      {selectedPaymentType.requiresDueDate ? (
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
                      ) : shouldShowInstallmentVisualization ? (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-primary">
                            Intervalo entre parcelas (dias)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={installmentIntervalDays}
                            onChange={(e) =>
                              setInstallmentIntervalDays(e.target.value)
                            }
                            className={paymentFieldClassName}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null
                ) : null}

                {!doesNotGenerateDebt &&
                  shouldShowInstallmentVisualization &&
                  remainingAmount > 0 && (
                    <div className="rounded-lg border border-outline-variant/45 bg-white p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-primary">
                            Saldo a pagar
                          </label>
                          <input
                            value={formatCurrency(remainingAmount)}
                            disabled
                            className={paymentReadonlyFieldClassName}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-primary">
                            Saldo em parcelas
                          </label>
                          <input
                            value={String(previewInstallmentCount)}
                            disabled
                            className={paymentReadonlyFieldClassName}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-primary">
                            {selectedPaymentType?.requiresDueDate
                              ? "Primeiro venc."
                              : "Intervalo (dias)"}
                          </label>
                          <input
                            value={
                              selectedPaymentType?.requiresDueDate
                                ? formatDate(
                                    paymentInstallmentPreview[0]?.dueDate ||
                                      dueDate,
                                  )
                                : String(parsedInstallmentIntervalDays)
                            }
                            disabled
                            className={paymentReadonlyFieldClassName}
                          />
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-105 w-full border-separate border-spacing-y-2 text-sm">
                          <thead className="bg-[#dbd1d1] rounded-t-md">
                            <tr className="text-left">
                              <th className="px-3 py-2 font-semibold text-primary">
                                Doc.
                              </th>
                              <th className="px-3 py-2 font-semibold text-primary text-right">
                                Valor
                              </th>
                              <th className="px-3 py-2 font-semibold text-right text-primary">
                                Data venc.
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentInstallmentPreview.map((installment) => (
                              <tr
                                key={installment.installmentNumber}
                                className="bg-surface-lowest"
                              >
                                <td className="px-3 py-2 text-neutral-800">
                                  {installment.installmentNumber}/
                                  {installment.totalInstallments}
                                </td>
                                <td className="px-3 py-2 text-right text-neutral-800">
                                  {formatCurrency(installment.amount)}
                                </td>
                                <td className="px-3 py-2 text-neutral-800 text-right">
                                  {formatDate(installment.dueDate)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                <div className="flex justify-start">
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant="secondary"
                      onClick={() => setStep(3)}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={handleCompleteSale}
                      disabled={!canAttemptCompleteSale}
                    >
                      {isSaving ? "Concluindo..." : "Concluir venda"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-fit bg-surface-low p-4 shadow-sm sm:p-6 xl:sticky xl:top-4">
            <p className="mb-2 font-semibold text-primary">Resumo</p>
            <p className="text-sm text-neutral-700">
              Cliente: {selectedCustomer?.name ?? "Não selecionado"}
            </p>
            <p className="mb-3 text-sm text-neutral-700">
              Tipo: {selectedTypesLabel}
            </p>
            <p className="text-sm text-neutral-700">
              Forma:{" "}
              {doesNotGenerateDebt
                ? "Permuta"
                : selectedPaymentType?.name || "Não definida"}
            </p>
            <p className="text-sm text-neutral-700">
              Status: {isEditingCompletedSale ? "Venda finalizada" : hasGeneratedQuote ? "Orçamento" : "Em montagem"}
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
              Entrada:{" "}
              {formatCurrency(doesNotGenerateDebt ? 0 : parsedEntryAmount)}
            </p>
            <p className="text-sm text-neutral-700">
              Credito aplicado:{" "}
              {formatCurrency(doesNotGenerateDebt ? 0 : customerCreditToApply)}
            </p>
            <p className="mb-3 text-sm text-neutral-700">
              Saldo: {formatCurrency(doesNotGenerateDebt ? 0 : remainingAmount)}
            </p>
            {doesNotGenerateDebt ? (
              <p className="mb-3 text-sm font-medium text-primary">
                Esta venda não gera débitos
              </p>
            ) : null}
            <p className="mt-4 border-t border-outline-variant/35 pt-3 text-sm font-semibold text-primary">
              Valor total: {formatCurrency(discountedTotalValue)}
            </p>
          </div>
        </div>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4">
          <div
            className={`max-h-[95vh] w-full overflow-y-auto rounded-xl bg-white p-3 shadow-lg sm:w-[92%] ${
              modalType === "Sob medida"
                ? "max-w-368 lg:w-[92%] xl:w-[88%]"
                : "max-w-6xl lg:w-[78%] xl:w-[65%]"
            }`}
          >
            {modalType === "Roupa pronta" ? (
              <ReadyMadeClothing
                key={`ready-${modalSessionKey}`}
                initialProducts={modalReadyMadeProducts}
                onSummaryChange={handleModalSummaryChange}
                onProductsChange={handleModalReadyMadeProductsChange}
              />
            ) : modalType === "Sob medida" ? (
              <CustomMadeClothing
                key={`custom-${modalSessionKey}`}
                initialProducts={modalCustomMadeProducts}
                customerMeasurements={selectedCustomerMeasurements}
                onSummaryChange={handleModalSummaryChange}
                onProductsChange={handleModalCustomMadeProductsChange}
              />
            ) : (
              <GeneralCatalogItems
                key={`general-${modalType}-${modalSessionKey}`}
                title={`Dados de ${modalType.toLowerCase()}`}
                itemLabel={modalType}
                defaultSummaryLabel={modalType}
                initialProducts={modalGeneralProducts}
                onSummaryChange={handleModalSummaryChange}
                onProductsChange={handleModalGeneralProductsChange}
              />
            )}

            <div className="mt-3 flex flex-col justify-end gap-2 sm:flex-row">
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={closeModal}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={addModalItemsToTable}
                disabled={!modalItems.length}
              >
                {editingItem ? "Salvar item" : "Adicionar produto"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CustomerModal
        open={openCashModalOpen}
        onClose={() => setOpenCashModalOpen(false)}
        title="Abrir Caixa da Loja"
        subtitle="Nao existe caixa da loja aberto no dia. A venda so sera finalizada com o caixa aberto."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-outline-variant/35 bg-surface-lowest p-4 text-sm text-neutral-700">
            <p>
              Valor esperado do caixa:{" "}
              <span className="font-semibold text-primary">
                {formatCurrency(
                  cashSessionStatus?.lastClosedSession?.expectedBalance ?? 0,
                )}
              </span>
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleOpenCashSession}
              isLoading={cashSessionLoading}
            >
              Confirmar abertura
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
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
        title="Encerrar e abrir caixa da loja"
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
                Data do lançamento: {currentCashLaunchDateLabel} é maior que a
                data do último lançamento: {previousCashLaunchDateLabel}.
              </p>
              <p className="mt-3">
                Confirma encerramento do(s) caixa\banco(s) anteriores ao dia{" "}
                {currentCashLaunchDateLabel}?
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleRolloverCashSession}
              isLoading={cashSessionLoading}
            >
              Confirmar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={() => setRolloverCashModalOpen(false)}
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
        subtitle="A venda ainda não foi encerrada."
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            Deseja gerar ou atualizar o orçamento antes de sair, ou prefere
            descartar esta venda em andamento?
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant="primary"
              onClick={handleContinueOpenSale}
            >
              Continuar editando
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void handleSaveQuoteAndExit()}
              disabled={!canCreateQuote || isSaving}
            >
              {hasGeneratedQuote ? "Atualizar orçamento" : "Gerar orçamento"}
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={() => void handleDiscardOpenSale()}
              disabled={isSaving}
            >
              Descartar
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
