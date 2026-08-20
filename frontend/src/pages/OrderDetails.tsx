import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import MeasurementsFields, {
  type MeasurementOption as MeasurementsFieldOption,
} from "../components/MeasurementsFields";
import DatePickerInput from "../components/DatePickerInput";
import NoticeToast from "../components/NoticeToast";
import SearchableSelect from "../components/SearchableSelect";
import { getRequest, updateRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import {
  formatCurrency,
  formatCurrencyInput,
  formatCurrencyValue,
  parseCurrencyToNumber,
} from "../utils/currency";
import {
  formatLegacyShortDateInput,
} from "../utils/legacyDate";

type ProductDetails = {
  id: number;
  saleId: number | null;
  desc: string;
  details: string;
  customerId: number | null;
  customerName: string | null;
  employeeId: number | null;
  employeeName: string | null;
  statusId: number | null;
  statusName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  productTypeId: number | null;
  productTypeName: string | null;
  clothingTypeId: number | null;
  clothingTypeName: string | null;
  colorId: number | null;
  colorName: string | null;
  fabricId: number | null;
  fabricName: string | null;
  sizeId: number | null;
  sizeName: string | null;
  qtyStock: number;
  testDate: string | null;
  dressmakerValue: number;
  finalValue: number;
  remainingValue: number;
  saleItemQuantity: number;
  saleItemUnitPrice: number;
  saleItemDiscountType: "PERCENTAGE" | "FIXED" | null;
  saleItemDiscountValue: number | null;
  saleItemGrossValue: number;
  saleItemDiscountAmount: number;
  saleItemSubtotal: number;
  createdAt: string | null;
  updatedAt: string | null;
  measurements?: Array<{
    idMeasurementDefinition: number | null;
    key: string | null;
    label: string | null;
    value: number;
  }>;
  measurementsSummary?: string;
};

type SelectOption = {
  id: number;
  label: string;
};

type CustomerOption = {
  id: number;
  name: string;
};

type ProductFormState = {
  desc: string;
  details: string;
  customerId: string;
  categoryId: string;
  productTypeId: string;
  clothingTypeId: string;
  colorId: string;
  fabricId: string;
  sizeId: string;
  qtyStock: string;
  dressmakerValue: string;
  finalValue: string;
  employeeId: string;
  statusId: string;
  testDate: string;
  measurements: Record<string, string>;
};

type ToastState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

type CustomersResponse = {
  items?: Array<{
    id: number;
    fullName?: string | null;
    companyName?: string | null;
  }>;
};

const fieldClassName =
  "w-full rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary";
const labelClassName = "text-sm font-medium text-primary";
const EMPTY_TOAST: ToastState = {
  open: false,
  tone: "success",
  message: "",
};

function toDateInputValue(value?: string | null) {
  return formatLegacyShortDateInput(value);
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

function mapAdminOptions(
  data: unknown,
  config: { idKey?: string; labelKey?: string } = {},
): SelectOption[] {
  if (!Array.isArray(data)) return [];

  const idKey = config.idKey || "id";
  const labelKey = config.labelKey || "desc";

  return data
    .map((item) => {
      const record = item as Record<string, unknown>;
      const id = Number(record[idKey]);
      const label = String(record[labelKey] || "").trim();

      if (!Number.isInteger(id) || !label) return null;

      return { id, label };
    })
    .filter(Boolean) as SelectOption[];
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

function ensureSelectOption(
  options: SelectOption[],
  value: number | null | undefined,
  label: string | null | undefined,
): SelectOption[] {
  const normalizedValue = Number(value);
  const normalizedLabel = String(label || "").trim();

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0 || !normalizedLabel) {
    return options;
  }

  if (options.some((option) => option.id === normalizedValue)) {
    return options;
  }

  return [{ id: normalizedValue, label: normalizedLabel }, ...options];
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

function toFormState(product: ProductDetails): ProductFormState {
  return {
    desc: product.desc || "",
    details: product.details || "",
    customerId: product.customerId ? String(product.customerId) : "",
    categoryId: product.categoryId ? String(product.categoryId) : "",
    productTypeId: product.productTypeId ? String(product.productTypeId) : "",
    clothingTypeId: product.clothingTypeId ? String(product.clothingTypeId) : "",
    colorId: product.colorId ? String(product.colorId) : "",
    fabricId: product.fabricId ? String(product.fabricId) : "",
    sizeId: product.sizeId ? String(product.sizeId) : "",
    qtyStock: String(product.qtyStock || product.saleItemQuantity || 1),
    dressmakerValue: formatCurrencyValue(product.dressmakerValue || 0),
    finalValue: formatCurrencyValue(product.finalValue || 0),
    employeeId: product.employeeId ? String(product.employeeId) : "",
    statusId: product.statusId ? String(product.statusId) : "",
    testDate: toDateInputValue(product.testDate),
    measurements: toMeasurementValueMap(product.measurements),
  };
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-primary">{value}</p>
    </div>
  );
}

function toMeasurementValueMap(
  measurements: ProductDetails["measurements"] = [],
): Record<string, string> {
  return (Array.isArray(measurements) ? measurements : []).reduce<Record<string, string>>(
    (acc, measurement) => {
      const key = String(measurement?.key || "").trim();
      if (!key) return acc;

      acc[key] =
        measurement.value === null || measurement.value === undefined
          ? ""
          : String(measurement.value);
      return acc;
    },
    {},
  );
}

function toMeasurementOptions(
  measurements: ProductDetails["measurements"] = [],
): MeasurementsFieldOption[] {
  return (Array.isArray(measurements) ? measurements : [])
    .map((measurement) => {
      const key = String(measurement?.key || "").trim();
      const label = String(measurement?.label || measurement?.key || "").trim();

      if (!key || !label) return null;

      return {
        value: key,
        label,
      };
    })
    .filter((item): item is MeasurementsFieldOption => Boolean(item));
}

function toSearchableOptions(options: SelectOption[] = []) {
  return options.map((option) => ({
    value: String(option.id),
    label: option.label,
  }));
}

function toCustomerSearchableOptions(options: CustomerOption[] = []) {
  return options.map((option) => ({
    value: String(option.id),
    label: option.name,
  }));
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);
  const [productTypeOptions, setProductTypeOptions] = useState<SelectOption[]>([]);
  const [clothingTypeOptions, setClothingTypeOptions] = useState<SelectOption[]>([]);
  const [colorOptions, setColorOptions] = useState<SelectOption[]>([]);
  const [fabricOptions, setFabricOptions] = useState<SelectOption[]>([]);
  const [sizeOptions, setSizeOptions] = useState<SelectOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);
  const returnTo = useMemo(
    () => searchParams.get("returnTo") || "/producao",
    [searchParams],
  );
  const returnLabel = useMemo(
    () => (returnTo.startsWith("/venda") || returnTo.startsWith("/vendas") ? "vendas" : "producao"),
    [returnTo],
  );
  const measurementValues = form?.measurements || {};
  const measurementOptions = useMemo(
    () => toMeasurementOptions(product?.measurements),
    [product],
  );
  const customerSearchableOptions = useMemo(
    () => toCustomerSearchableOptions(customerOptions),
    [customerOptions],
  );
  const categorySearchableOptions = useMemo(
    () => toSearchableOptions(categoryOptions),
    [categoryOptions],
  );
  const productTypeSearchableOptions = useMemo(
    () => toSearchableOptions(productTypeOptions),
    [productTypeOptions],
  );
  const clothingTypeSearchableOptions = useMemo(
    () => toSearchableOptions(clothingTypeOptions),
    [clothingTypeOptions],
  );
  const colorSearchableOptions = useMemo(
    () => toSearchableOptions(colorOptions),
    [colorOptions],
  );
  const fabricSearchableOptions = useMemo(
    () => toSearchableOptions(fabricOptions),
    [fabricOptions],
  );
  const sizeSearchableOptions = useMemo(
    () => toSearchableOptions(sizeOptions),
    [sizeOptions],
  );
  const employeeSearchableOptions = useMemo(
    () => toSearchableOptions(employeeOptions),
    [employeeOptions],
  );
  const statusSearchableOptions = useMemo(
    () => toSearchableOptions(statusOptions),
    [statusOptions],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        setToast(EMPTY_TOAST);

        const [
          productData,
          categoriesData,
          productsTypesData,
          clothingTypesData,
          colorsData,
          fabricsData,
          sizesData,
          employeesData,
          statusesData,
        ] = await Promise.all([
          getRequest(`/products/${id}`),
          getRequest("/admin/categories"),
          getRequest("/admin/products-types"),
          getRequest("/admin/clothings-types"),
          getRequest("/admin/colors"),
          getRequest("/admin/fabrics"),
          getRequest("/admin/sizes"),
          getRequest("/admin/employees"),
          getRequest("/products/status-options"),
        ]);

        const parsedProduct = productData as ProductDetails;

        setProduct(parsedProduct);
        setForm(toFormState(parsedProduct));
        setCustomerOptions((current) =>
          ensureCustomerOption(
            current,
            parsedProduct.customerId,
            parsedProduct.customerName,
          ),
        );
        setCategoryOptions(
          ensureSelectOption(
            mapAdminOptions(categoriesData, { idKey: "id", labelKey: "desc" }),
            parsedProduct.categoryId,
            parsedProduct.categoryName,
          ),
        );
        setClothingTypeOptions(
          ensureSelectOption(
            mapAdminOptions(clothingTypesData, { idKey: "id", labelKey: "desc" }),
            parsedProduct.clothingTypeId,
            parsedProduct.clothingTypeName,
          ),
        );
        setProductTypeOptions(
          ensureSelectOption(
            mapAdminOptions(productsTypesData, { idKey: "id", labelKey: "desc" }),
            parsedProduct.productTypeId,
            parsedProduct.productTypeName,
          ),
        );
        setColorOptions(
          ensureSelectOption(
            mapAdminOptions(colorsData, { idKey: "id", labelKey: "desc" }),
            parsedProduct.colorId,
            parsedProduct.colorName,
          ),
        );
        setFabricOptions(
          ensureSelectOption(
            mapAdminOptions(fabricsData, { idKey: "id", labelKey: "desc" }),
            parsedProduct.fabricId,
            parsedProduct.fabricName,
          ),
        );
        setSizeOptions(
          ensureSelectOption(
            mapAdminOptions(sizesData, { idKey: "id", labelKey: "desc" }),
            parsedProduct.sizeId,
            parsedProduct.sizeName,
          ),
        );
        setEmployeeOptions(
          ensureSelectOption(
            mapAdminOptions(employeesData, { idKey: "idEmployee", labelKey: "shortName" }),
            parsedProduct.employeeId,
            parsedProduct.employeeName,
          ),
        );
        setStatusOptions(
          ensureSelectOption(
            mapAdminOptions(statusesData),
            parsedProduct.statusId,
            parsedProduct.statusName,
          ),
        );
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { status?: number } };

        if (maybeAxiosError.response?.status === 404) {
          setError("Pedido nao encontrado.");
        } else {
          setError(
            getUserFacingApiErrorMessage(
              err,
              "Nao foi possivel carregar os detalhes do produto.",
            ),
          );
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [id]);

  useEffect(() => {
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
            product?.customerId,
            product?.customerName,
          ),
        );
      } catch {
        setCustomerOptions(
          ensureCustomerOption(
            [],
            product?.customerId,
            product?.customerName,
          ),
        );
      }
    };

    void fetchCustomers();
  }, [customerSearchTerm, product?.customerId, product?.customerName]);

  const handleFieldChange = (field: keyof ProductFormState, value: string) => {
    setForm((current) => {
      if (!current) return current;

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleMeasurementChange = (field: string, value: string) => {
    setForm((current) => {
      if (!current) return current;

      return {
        ...current,
        measurements: {
          ...current.measurements,
          [field]: value,
        },
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form || !product) return;

    if (!form.customerId) {
      setToast({
        open: true,
        tone: "warning",
        title: "Cliente obrigatorio",
        message: "Selecione uma cliente antes de salvar o pedido.",
      });
      return;
    }

    try {
      setSaving(true);
      setToast(EMPTY_TOAST);

      const updated = (await updateRequest(`/products/${product.id}`, {
        desc: form.desc.trim(),
        details: form.details,
        customerId: form.customerId ? Number(form.customerId) : null,
        employeeId: form.employeeId ? Number(form.employeeId) : null,
        statusId: form.statusId ? Number(form.statusId) : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        productTypeId: form.productTypeId ? Number(form.productTypeId) : null,
        clothingTypeId: form.clothingTypeId ? Number(form.clothingTypeId) : null,
        colorId: form.colorId ? Number(form.colorId) : null,
        fabricId: form.fabricId ? Number(form.fabricId) : null,
        sizeId: form.sizeId ? Number(form.sizeId) : null,
        qtyStock: Math.max(1, Number(form.qtyStock) || 1),
        testDate: form.testDate,
        dressmakerValue: parseCurrencyToNumber(form.dressmakerValue),
        finalValue: parseCurrencyToNumber(form.finalValue),
        measurements: measurementOptions.map((measurement) => ({
          key: measurement.value,
          value: form.measurements[measurement.value] || "",
        })),
      })) as ProductDetails;

      setProduct(updated);
      setForm(toFormState(updated));
      setToast({
        open: true,
        tone: "success",
        message: "Pedido atualizado com sucesso.",
      });
    } catch (err: unknown) {
      setToast({
        open: true,
        tone: "error",
        message: getUserFacingApiErrorMessage(err, "Nao foi possivel salvar o pedido."),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
        <div className="rounded-2xl border border-outline-variant/35 bg-white px-6 py-10 text-center text-sm text-neutral-700">
          Carregando detalhes do produto...
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
        <div className="mx-auto max-w-4xl rounded-2xl border border-[#c76767] bg-[#fdecec] px-6 py-8 text-center text-sm text-[#7a1717]">
          <p>{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate(returnTo)}>
              {`Voltar para ${returnLabel}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!product || !form) {
    return null;
  }

  return (
    <div className="min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(returnTo)}
              className="mb-4 text-sm text-neutral-700 underline-offset-2 hover:underline"
            >
              {`Voltar para ${returnLabel}`}
            </button>
            <h1 className="font-editorial text-[2rem] text-primary md:text-[1.85rem]">
              Detalhes do Produto
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            {product.saleId ? (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(
                    `/venda/${product.saleId}?returnTo=${encodeURIComponent(returnTo)}`,
                  )
                }
              >
                Abrir venda vinculada
              </Button>
            ) : null}
            <Button
              variant="primary"
              form="order-details-form"
              type="submit"
              isLoading={saving}
              disabled={!form.customerId}
            >
              Salvar alteracoes
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <InfoCard label="Pedido" value={`#${product.id}`} />
          <InfoCard label="Cliente atual" value={product.customerName || "Sem cliente"} />
          <InfoCard label="Status atual" value={product.statusName || "-"} />
          <InfoCard label="Valor da peca" value={formatCurrency(product.finalValue)} />
          <InfoCard label="Lucro da peca" value={formatCurrency(product.remainingValue)} />
        </div>

        <form id="order-details-form" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">Dados do Produto</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Todos os dados do produto podem ser ajustados aqui.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className={labelClassName} htmlFor="order-desc">
                  Descricao
                </label>
                <input
                  id="order-desc"
                  value={form.desc}
                  onChange={(event) => handleFieldChange("desc", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-customer">
                  Cliente
                </label>
                <SearchableSelect
                  id="order-customer"
                  value={form.customerId}
                  options={customerSearchableOptions}
                  onChange={(value) => handleFieldChange("customerId", value)}
                  onSearchChange={setCustomerSearchTerm}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-category">
                  Tipo de Produto
                </label>
                <SearchableSelect
                  id="order-category"
                  value={form.categoryId}
                  options={categorySearchableOptions}
                  onChange={(value) => handleFieldChange("categoryId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-product-type">
                  Subtipo do Produto
                </label>
                <SearchableSelect
                  id="order-product-type"
                  value={form.productTypeId}
                  options={productTypeSearchableOptions}
                  onChange={(value) => handleFieldChange("productTypeId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-clothing-type">
                  Tipo de Roupa
                </label>
                <SearchableSelect
                  id="order-clothing-type"
                  value={form.clothingTypeId}
                  options={clothingTypeSearchableOptions}
                  onChange={(value) => handleFieldChange("clothingTypeId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-color">
                  Cor
                </label>
                <SearchableSelect
                  id="order-color"
                  value={form.colorId}
                  options={colorSearchableOptions}
                  onChange={(value) => handleFieldChange("colorId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-fabric">
                  Tecido
                </label>
                <SearchableSelect
                  id="order-fabric"
                  value={form.fabricId}
                  options={fabricSearchableOptions}
                  onChange={(value) => handleFieldChange("fabricId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-size">
                  Tamanho
                </label>
                <SearchableSelect
                  id="order-size"
                  value={form.sizeId}
                  options={sizeSearchableOptions}
                  onChange={(value) => handleFieldChange("sizeId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-quantity">
                  Quantidade
                </label>
                <input
                  id="order-quantity"
                  type="number"
                  min={1}
                  value={form.qtyStock}
                  onChange={(event) => handleFieldChange("qtyStock", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-final-value">
                  Valor final
                </label>
                <input
                  id="order-final-value"
                  value={form.finalValue}
                  onChange={(event) =>
                    handleFieldChange("finalValue", formatCurrencyInput(event.target.value))
                  }
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-dressmaker-value">
                  Valor da costureira
                </label>
                <input
                  id="order-dressmaker-value"
                  value={form.dressmakerValue}
                  onChange={(event) =>
                    handleFieldChange(
                      "dressmakerValue",
                      formatCurrencyInput(event.target.value),
                    )
                  }
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div className="md:col-span-2 xl:col-span-3">
                <MeasurementsFields
                  contextKey={`order-${product.id}`}
                  fieldClassName="h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none"
                  measurements={measurementValues}
                  measurementOptions={measurementOptions}
                  onUpdateMeasurement={handleMeasurementChange}
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-status">
                  Status
                </label>
                <SearchableSelect
                  id="order-status"
                  value={form.statusId}
                  options={statusSearchableOptions}
                  onChange={(value) => handleFieldChange("statusId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-seamstress">
                  Costureira
                </label>
                <SearchableSelect
                  id="order-seamstress"
                  value={form.employeeId}
                  options={employeeSearchableOptions}
                  onChange={(value) => handleFieldChange("employeeId", value)}
                  className="relative mt-2"
                  inputClassName={fieldClassName}
                  dropdownClassName="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-outline-variant/45 bg-white shadow-lg"
                  optionClassName="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-low"
                  placeholder="Digite para buscar"
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-test-date">
                  Data da Prova
                </label>
                <DatePickerInput
                  id="order-test-date"
                  value={form.testDate}
                  onChange={(nextValue) =>
                    handleFieldChange("testDate", nextValue)
                  }
                  format="short"
                  placeholder="dd/mm/aa"
                  className={`${fieldClassName} mt-2`}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClassName} htmlFor="order-details">
                Detalhes
              </label>
              <textarea
                id="order-details"
                value={form.details}
                onChange={(event) => handleFieldChange("details", event.target.value)}
                rows={4}
                className={`${fieldClassName} mt-2 resize-none`}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">Informacoes de Controle</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard
                label="Venda vinculada"
                value={product.saleId ? `#${product.saleId}` : "Sem venda"}
              />
              <InfoCard label="Criado em" value={formatDateTime(product.createdAt)} />
              <InfoCard label="Atualizado em" value={formatDateTime(product.updatedAt)} />
            </div>
          </section>
        </form>
      </div>

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
