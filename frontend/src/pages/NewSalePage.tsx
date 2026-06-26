import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import CustomMadeClothing, {
  type CustomMadeProductDraft,
  type CustomMadeSummaryItem,
} from "../components/CustomMadeClothing";
import ReadyMadeClothing, {
  type ReadyMadeProductDraft,
  type ReadyMadeSummaryItem,
} from "../components/ReadyMadeClothing";
import { SaleStepper } from "../components/SaleStepper";
import type { ICustomer } from "../interfaces/ICustomer";
import { getRequest, postRequest } from "../services/request";
import { parseCurrencyToNumber } from "../utils/currency";
import { formatDocument } from "../utils/formatDocument";

interface CustomerOption {
  id: number;
  name: string;
  document: string;
}

interface SelectedSaleTypes {
  readyMade: boolean;
  customMade: boolean;
}

interface SaleTableItem {
  id: number;
  code: string;
  type: "Roupa pronta" | "Sob-medida";
  description: string;
  value: number;
  discountValue: number;
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

export default function NewSalePage() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerOption | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [selectedSaleTypes, setSelectedSaleTypes] = useState<SelectedSaleTypes>({
    readyMade: false,
    customMade: false,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"Roupa pronta" | "Sob-medida">(
    "Roupa pronta",
  );
  const [modalItems, setModalItems] = useState<
    ReadyMadeSummaryItem[] | CustomMadeSummaryItem[]
  >([]);
  const [modalSessionKey, setModalSessionKey] = useState(0);

  const [tableItems, setTableItems] = useState<SaleTableItem[]>([]);
  const [readyMadeProducts, setReadyMadeProducts] = useState<ReadyMadeProductDraft[]>([]);
  const [customMadeProducts, setCustomMadeProducts] = useState<CustomMadeProductDraft[]>([]);
  const [modalReadyMadeProducts, setModalReadyMadeProducts] = useState<
    ReadyMadeProductDraft[]
  >([]);
  const [modalCustomMadeProducts, setModalCustomMadeProducts] = useState<
    CustomMadeProductDraft[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryAmount, setEntryAmount] = useState("");
  const [entryPaymentTypeId, setEntryPaymentTypeId] = useState("");
  const [entryPaidAt, setEntryPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [entryReferenceCode, setEntryReferenceCode] = useState("");
  const [cardOperatorLabel, setCardOperatorLabel] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [cardAuthorizationCode, setCardAuthorizationCode] = useState("");
  const [cardExpectedSettlementDate, setCardExpectedSettlementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cardClientInstallmentCount, setCardClientInstallmentCount] = useState("1");
  const [cardFeeAmount, setCardFeeAmount] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const data = await getRequest("/clients");
        const parsedCustomers = data.map((customer: ICustomer) => ({
          id: Number(customer.id),
          name: customer.fullName || customer.companyName || "Sem nome",
          document: formatDocument(customer.document),
        }));

        setCustomers(parsedCustomers);
      } catch (error) {
        console.error("Erro ao buscar clientes", error);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, []);

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

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return customers.slice(0, 8);
    }

    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(normalizedSearch) ||
          customer.document.toLowerCase().includes(normalizedSearch),
      )
      .slice(0, 8);
  }, [customers, search]);

  const selectedTypesLabel = useMemo(() => {
    const labels: string[] = [];

    if (selectedSaleTypes.readyMade) labels.push("Roupa pronta");
    if (selectedSaleTypes.customMade) labels.push("Sob-medida");

    return labels.length ? labels.join(" + ") : "Não definido";
  }, [selectedSaleTypes]);

  const totalValue = useMemo(
    () => tableItems.reduce((acc, item) => acc + item.finalValue, 0),
    [tableItems],
  );
  const selectedPaymentType = useMemo(
    () => paymentTypes.find((item) => String(item.id) === paymentTypeId) || null,
    [paymentTypeId, paymentTypes],
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
    () => Math.max(0, Number((totalValue - parsedEntryAmount).toFixed(2))),
    [parsedEntryAmount, totalValue],
  );
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
    !isSaving &&
    !!selectedCustomer &&
    tableItems.length > 0 &&
    !!paymentTypeId &&
    (!selectedPaymentType?.requiresDueDate || !!dueDate) &&
    (!selectedPaymentType?.allowsEntryAmount ||
      parsedEntryAmount <= 0 ||
      (!!entryPaymentTypeId && !!entryPaidAt)) &&
    parsedEntryAmount < totalValue &&
    (selectedPaymentType?.financialFlow !== "FUTURE_OPERATOR" || !!cardExpectedSettlementDate);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const openModal = (type: "Roupa pronta" | "Sob-medida") => {
    setModalType(type);
    setModalItems([]);
    setModalReadyMadeProducts([]);
    setModalCustomMadeProducts([]);
    setModalSessionKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!selectedPaymentType) {
      setInstallmentCount("1");
      setEntryAmount("");
      setEntryPaymentTypeId("");
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

    if (selectedPaymentType.financialFlow !== "FUTURE_OPERATOR") {
      setCardOperatorLabel("");
      setCardBrand("");
      setCardAuthorizationCode("");
      setCardFeeAmount("");
      setCardClientInstallmentCount(String(selectedPaymentType.defaultInstallments || 1));
    }
  }, [selectedPaymentType]);

  const toggleSaleType = (type: keyof SelectedSaleTypes) => {
    setSelectedSaleTypes((prev) => {
      const willSelect = !prev[type];

      if (willSelect) {
        openModal(type === "readyMade" ? "Roupa pronta" : "Sob-medida");
      }

      return {
        ...prev,
        [type]: willSelect,
      };
    });
  };

  const addModalItemsToTable = () => {
    if (!modalItems.length) {
      return;
    }

    if (modalType === "Roupa pronta") {
      setReadyMadeProducts((prev) => [...prev, ...modalReadyMadeProducts]);
    } else {
      setCustomMadeProducts((prev) => [...prev, ...modalCustomMadeProducts]);
    }

    setTableItems((prev) => {
      const next = [...prev];
      const prefix = modalType === "Roupa pronta" ? "RP" : "SM";

      modalItems.forEach((item) => {
        const baseValue = item.value * Math.max(1, item.quantity);
        const code = `${prefix}-${next.length + 1}`;

        next.push({
          id: Date.now() + next.length,
          code,
          type: modalType,
          description: item.type || modalType,
          value: baseValue,
          discountValue: baseValue,
          finalValue: baseValue,
        });
      });

      return next;
    });

    setIsModalOpen(false);
  };

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

        return {
          itemType: "READY_MADE",
          description: product.name.trim() || "Roupa pronta",
          quantity,
          unitPrice,
          subtotal: unitPrice * quantity,
          metadata: {
            size: product.size || null,
          },
        };
      });

      const customItems = customMadeProducts.map((product) => {
        const unitPrice = parseCurrencyToNumber(product.price);
        const seamstressCost = parseCurrencyToNumber(product.seamstressCost);

        return {
          itemType: "CUSTOM_MADE",
          description: product.type.trim() || "Sob-medida",
          quantity: 1,
          unitPrice,
          subtotal: unitPrice,
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

      const customerMeasurements = customMadeProducts.map((product) => ({
        ...product.measurements,
      }));

      await postRequest("/sales", {
        customerId: selectedCustomer.id,
        totalAmount: totalValue,
        finalAmount: totalValue,
        paymentTypeId: paymentTypeId ? Number(paymentTypeId) : null,
        installmentCount: previewInstallmentCount,
        dueDate: selectedPaymentType?.requiresDueDate ? dueDate : null,
        entryAmount: selectedPaymentType?.allowsEntryAmount && parsedEntryAmount > 0 ? parsedEntryAmount : null,
        entryPaymentTypeId: entryPaymentTypeId ? Number(entryPaymentTypeId) : null,
        entryPaidAt: parsedEntryAmount > 0 ? entryPaidAt : null,
        entryReferenceCode: entryReferenceCode || null,
        cardOperatorLabel: selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" ? cardOperatorLabel || null : null,
        cardBrand: selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" ? cardBrand || null : null,
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
        items: [...readyMadeItems, ...customItems],
        customerMeasurements,
      });

      setSaveMessage("Pedido salvo com sucesso.");
      setTableItems([]);
      setReadyMadeProducts([]);
      setCustomMadeProducts([]);
      setModalItems([]);
      setSelectedSaleTypes({
        readyMade: false,
        customMade: false,
      });
      setPaymentTypeId("");
      setInstallmentCount("1");
      setDueDate(new Date().toISOString().slice(0, 10));
      setEntryAmount("");
      setEntryPaymentTypeId("");
      setEntryPaidAt(new Date().toISOString().slice(0, 10));
      setEntryReferenceCode("");
      setCardOperatorLabel("");
      setCardBrand("");
      setCardAuthorizationCode("");
      setCardExpectedSettlementDate(new Date().toISOString().slice(0, 10));
      setCardClientInstallmentCount("1");
      setCardFeeAmount("");
      setStep(1);
    } catch (error: any) {
      setSaveMessage(error?.response?.data?.message || "Nao foi possivel salvar o pedido.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setSearch(customer.name);
    setIsDropdownOpen(false);
  };

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
                            <p className="font-medium text-primary">{customer.name}</p>
                            <p className="text-sm text-neutral-600">{customer.document}</p>
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-neutral-600">
                          Nenhum cliente encontrado.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {selectedCustomer && (
                  <div className="rounded-lg border border-secondary/50 bg-surface-low p-3">
                    <p className="text-sm text-neutral-700">Cliente selecionado</p>
                    <p className="font-semibold text-primary">{selectedCustomer.name}</p>
                    <p className="text-sm text-neutral-700">{selectedCustomer.document}</p>
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => toggleSaleType("readyMade")}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      selectedSaleTypes.readyMade
                        ? "border-primary bg-white"
                        : "border-outline-variant/60 bg-white hover:bg-surface-lowest"
                    }`}
                  >
                    <p className="text-base font-semibold text-primary">
                      Roupa pronta
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      Selecione peças já finalizadas para venda imediata.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleSaleType("customMade")}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      selectedSaleTypes.customMade
                        ? "border-primary bg-white"
                        : "border-outline-variant/60 bg-white hover:bg-surface-lowest"
                    }`}
                  >
                    <p className="text-base font-semibold text-primary">
                      Sob-medida
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      Venda personalizada com medidas e detalhes do cliente.
                    </p>
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-outline-variant/45 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-surface-low">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-primary">
                          Código
                        </th>
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
                          Valor com desconto
                        </th>
                        <th className="px-3 py-2 text-right font-semibold text-primary">
                          Valor final
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-3 text-center text-neutral-600"
                          >
                            Nenhum produto adicionado.
                          </td>
                        </tr>
                      ) : (
                        tableItems.map((item) => (
                          <tr
                            key={item.id}
                            className="border-t border-outline-variant/30"
                          >
                            <td className="px-3 py-2 text-neutral-800">{item.code}</td>
                            <td className="px-3 py-2 text-neutral-800">{item.type}</td>
                            <td className="px-3 py-2 text-neutral-800">{item.description}</td>
                            <td className="px-3 py-2 text-right text-neutral-800">
                              {formatCurrency(item.value)}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-800">
                              {formatCurrency(item.discountValue)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-primary">
                              {formatCurrency(item.finalValue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">
                      Forma de pagamento
                    </label>
                    <select
                      value={paymentTypeId}
                      onChange={(e) => setPaymentTypeId(e.target.value)}
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
                    <div className="rounded-lg border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-700">
                      Parcelas previstas: {previewInstallmentCount}
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
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                      />
                    </div>
                  ) : selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Data prevista de repasse
                      </label>
                      <input
                        type="date"
                        value={cardExpectedSettlementDate}
                        onChange={(e) => setCardExpectedSettlementDate(e.target.value)}
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-700">
                      Recebimento imediato no caixa.
                    </div>
                  )}
                </div>

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
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Forma da entrada
                      </label>
                      <select
                        value={entryPaymentTypeId}
                        onChange={(e) => setEntryPaymentTypeId(e.target.value)}
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
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
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Referencia
                      </label>
                      <input
                        value={entryReferenceCode}
                        onChange={(e) => setEntryReferenceCode(e.target.value)}
                        className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary"
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
                      <input value={cardOperatorLabel} onChange={(e) => setCardOperatorLabel(e.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Bandeira
                      </label>
                      <input value={cardBrand} onChange={(e) => setCardBrand(e.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Autorizacao
                      </label>
                      <input value={cardAuthorizationCode} onChange={(e) => setCardAuthorizationCode(e.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Parcelas no cartao
                      </label>
                      <input type="number" min={1} value={cardClientInstallmentCount} onChange={(e) => setCardClientInstallmentCount(e.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-primary">
                        Taxa prevista
                      </label>
                      <input type="number" min="0" step="0.01" value={cardFeeAmount} onChange={(e) => setCardFeeAmount(e.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/60 bg-white px-3 text-[15px] text-primary" />
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-outline-variant/45 bg-white p-4 text-sm text-neutral-700">
                  <p>Entrada: {formatCurrency(parsedEntryAmount)}</p>
                  <p>Saldo: {formatCurrency(remainingAmount)}</p>
                  <p>Destino do saldo: {selectedPaymentType?.financialFlow === "FUTURE_OPERATOR" ? "Operadora" : selectedPaymentType?.financialFlow === "FUTURE_CUSTOMER" ? "Cliente" : "Caixa"}</p>
                  <p>Parcelas previstas: {previewInstallmentCount}</p>
                  {installmentPreview.length > 0 && remainingAmount > 0 && (
                    <p>
                      Valor presumido: {installmentPreview.map((item) => formatCurrency(item)).join(" / ")}
                    </p>
                  )}
                </div>

                <div className="flex justify-start">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setStep(1)}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveSale}
                      disabled={!canSaveSale}
                    >
                      {isSaving ? "Salvando..." : "Salvar pedido"}
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
            <p className="mb-3 text-sm text-neutral-700">Tipo: {selectedTypesLabel}</p>
            <p className="text-sm text-neutral-700">
              Forma: {selectedPaymentType?.name || "Nao definida"}
            </p>
            <p className="mb-3 text-sm text-neutral-700">
              Parcelas: {previewInstallmentCount}
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
              Valor total: {formatCurrency(totalValue)}
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
                onSummaryChange={(items) => setModalItems(items)}
                onProductsChange={(items) => setModalReadyMadeProducts(items)}
              />
            ) : (
              <CustomMadeClothing
                key={`custom-${modalSessionKey}`}
                onSummaryChange={(items) => setModalItems(items)}
                onProductsChange={(items) => setModalCustomMadeProducts(items)}
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
    </div>
  );
}
