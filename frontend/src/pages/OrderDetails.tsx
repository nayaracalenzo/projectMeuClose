import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { getRequest, updateRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

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
  createdAt: string | null;
  updatedAt: string | null;
};

type SelectOption = {
  id: number;
  label: string;
};

type ProductFormState = {
  desc: string;
  details: string;
  customerId: string;
  employeeId: string;
  statusId: string;
  categoryId: string;
  productTypeId: string;
  clothingTypeId: string;
  colorId: string;
  fabricId: string;
  sizeId: string;
  qtyStock: string;
  testDate: string;
  dressmakerValue: string;
  finalValue: string;
};

const fieldClassName =
  "w-full rounded-md border border-outline-variant/45 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-primary";
const labelClassName = "text-sm font-medium text-primary";

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

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

function mapCustomerOptions(data: unknown): SelectOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const customer = item as {
        id?: number;
        fullName?: string | null;
        companyName?: string | null;
      };

      const id = Number(customer.id);
      const label = String(customer.fullName || customer.companyName || "").trim();

      if (!Number.isInteger(id) || !label) return null;

      return { id, label };
    })
    .filter(Boolean) as SelectOption[];
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

function toFormState(product: ProductDetails): ProductFormState {
  return {
    desc: product.desc || "",
    details: product.details || "",
    customerId: product.customerId ? String(product.customerId) : "",
    employeeId: product.employeeId ? String(product.employeeId) : "",
    statusId: product.statusId ? String(product.statusId) : "",
    categoryId: product.categoryId ? String(product.categoryId) : "",
    productTypeId: product.productTypeId ? String(product.productTypeId) : "",
    clothingTypeId: product.clothingTypeId ? String(product.clothingTypeId) : "",
    colorId: product.colorId ? String(product.colorId) : "",
    fabricId: product.fabricId ? String(product.fabricId) : "",
    sizeId: product.sizeId ? String(product.sizeId) : "",
    qtyStock: String(product.qtyStock || 1),
    testDate: toDateInputValue(product.testDate),
    dressmakerValue: String(product.dressmakerValue ?? 0),
    finalValue: String(product.finalValue ?? 0),
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

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [customerOptions, setCustomerOptions] = useState<SelectOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<SelectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);
  const [productTypeOptions, setProductTypeOptions] = useState<SelectOption[]>([]);
  const [clothingTypeOptions, setClothingTypeOptions] = useState<SelectOption[]>([]);
  const [colorOptions, setColorOptions] = useState<SelectOption[]>([]);
  const [fabricOptions, setFabricOptions] = useState<SelectOption[]>([]);
  const [sizeOptions, setSizeOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const [
          productData,
          customersData,
          employeesData,
          statusesData,
          categoriesData,
          productTypesData,
          clothingTypesData,
          colorsData,
          fabricsData,
          sizesData,
        ] = await Promise.all([
          getRequest(`/products/${id}`),
          getRequest("/clients"),
          getRequest("/admin/employees"),
          getRequest("/products/status-options"),
          getRequest("/admin/categories"),
          getRequest("/admin/products-types"),
          getRequest("/admin/clothings-types"),
          getRequest("/admin/colors"),
          getRequest("/admin/fabrics"),
          getRequest("/admin/sizes"),
        ]);

        setProduct(productData as ProductDetails);
        setForm(toFormState(productData as ProductDetails));
        setCustomerOptions(mapCustomerOptions(customersData));
        setEmployeeOptions(mapAdminOptions(employeesData, { idKey: "idEmployee", labelKey: "shortName" }));
        setStatusOptions(mapAdminOptions(statusesData));
        setCategoryOptions(mapAdminOptions(categoriesData));
        setProductTypeOptions(mapAdminOptions(productTypesData));
        setClothingTypeOptions(mapAdminOptions(clothingTypesData));
        setColorOptions(mapAdminOptions(colorsData));
        setFabricOptions(mapAdminOptions(fabricsData));
        setSizeOptions(mapAdminOptions(sizesData));
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { status?: number } };

        if (maybeAxiosError.response?.status === 404) {
          setError("Pedido não encontrado.");
        } else {
          setError(
            getUserFacingApiErrorMessage(err, "Não foi possível carregar os detalhes do pedido."),
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const remainingValuePreview = useMemo(() => {
    if (!form) return 0;

    const finalValue = Number(form.finalValue || 0);
    const dressmakerValue = Number(form.dressmakerValue || 0);

    if (!Number.isFinite(finalValue) || !Number.isFinite(dressmakerValue)) return 0;

    return Number((finalValue - dressmakerValue).toFixed(2));
  }, [form]);

  const handleFieldChange = (field: keyof ProductFormState, value: string) => {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form || !product) return;

    try {
      setSaving(true);
      setSaveMessage("");
      setError("");

      const updated = (await updateRequest(`/products/${product.id}`, {
        ...form,
        dressmakerValue: form.dressmakerValue || "0",
      })) as ProductDetails;

      setProduct(updated);
      setForm(toFormState(updated));
      setSaveMessage("Pedido atualizado com sucesso.");
    } catch (err: unknown) {
      setSaveMessage("");
      setError(getUserFacingApiErrorMessage(err, "Não foi possível salvar o pedido."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
        <div className="rounded-2xl border border-outline-variant/35 bg-white px-6 py-10 text-center text-sm text-neutral-700">
          Carregando detalhes do pedido...
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
            <Button variant="secondary" onClick={() => navigate("/pedidos")}>
              Voltar para pedidos
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
              onClick={() => navigate("/pedidos")}
              className="mb-4 text-sm text-neutral-700 underline-offset-2 hover:underline"
            >
              Voltar para pedidos
            </button>
            <h1 className="font-editorial text-5xl text-primary md:text-4xl">
              Detalhes do Pedido
            </h1>
            <p className="mt-2 text-sm text-neutral-700">
              Visualize e ajuste os dados do pedido sempre que precisar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {product.saleId ? (
              <Button variant="secondary" onClick={() => navigate(`/venda/${product.saleId}`)}>
                Abrir venda vinculada
              </Button>
            ) : null}
            <Button variant="primary" form="order-details-form" type="submit" isLoading={saving}>
              Salvar alterações
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <InfoCard label="Pedido" value={`#${product.id}`} />
          <InfoCard label="Cliente atual" value={product.customerName || "Sem cliente"} />
          <InfoCard label="Status atual" value={product.statusName || "-"} />
          <InfoCard label="Valor final" value={formatCurrency(product.finalValue)} />
          <InfoCard label="Valor restante" value={formatCurrency(product.remainingValue)} />
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
            {error}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="mb-4 rounded-xl border border-[#7ea17e] bg-[#eef8ee] px-4 py-3 text-sm text-[#205220]">
            {saveMessage}
          </div>
        ) : null}

        <form id="order-details-form" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">Dados do Pedido</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <label className={labelClassName} htmlFor="order-desc">
                  Descrição
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
                <select
                  id="order-customer"
                  value={form.customerId}
                  onChange={(event) => handleFieldChange("customerId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {customerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-status">
                  Status
                </label>
                <select
                  id="order-status"
                  value={form.statusId}
                  onChange={(event) => handleFieldChange("statusId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {statusOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-category">
                  Tipo de Produto
                </label>
                <select
                  id="order-category"
                  value={form.categoryId}
                  onChange={(event) => handleFieldChange("categoryId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-product-type">
                  Subtipo do Produto
                </label>
                <select
                  id="order-product-type"
                  value={form.productTypeId}
                  onChange={(event) => handleFieldChange("productTypeId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {productTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-seamstress">
                  Costureira
                </label>
                <select
                  id="order-seamstress"
                  value={form.employeeId}
                  onChange={(event) => handleFieldChange("employeeId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {employeeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-clothing-type">
                  Tipo de Roupa
                </label>
                <select
                  id="order-clothing-type"
                  value={form.clothingTypeId}
                  onChange={(event) => handleFieldChange("clothingTypeId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {clothingTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-color">
                  Cor
                </label>
                <select
                  id="order-color"
                  value={form.colorId}
                  onChange={(event) => handleFieldChange("colorId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {colorOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-fabric">
                  Tecido
                </label>
                <select
                  id="order-fabric"
                  value={form.fabricId}
                  onChange={(event) => handleFieldChange("fabricId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {fabricOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-size">
                  Tamanho
                </label>
                <select
                  id="order-size"
                  value={form.sizeId}
                  onChange={(event) => handleFieldChange("sizeId", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                >
                  <option value="">Selecione...</option>
                  {sizeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-test-date">
                  Data da Prova
                </label>
                <input
                  id="order-test-date"
                  type="date"
                  value={form.testDate}
                  onChange={(event) => handleFieldChange("testDate", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-qty">
                  Quantidade
                </label>
                <input
                  id="order-qty"
                  type="number"
                  min="1"
                  step="1"
                  value={form.qtyStock}
                  onChange={(event) => handleFieldChange("qtyStock", event.target.value)}
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
            <h2 className="font-editorial text-3xl text-primary">Valores</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelClassName} htmlFor="order-final-value">
                  Valor Final
                </label>
                <input
                  id="order-final-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.finalValue}
                  onChange={(event) => handleFieldChange("finalValue", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div>
                <label className={labelClassName} htmlFor="order-dressmaker-value">
                  Valor da Costureira
                </label>
                <input
                  id="order-dressmaker-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.dressmakerValue}
                  onChange={(event) => handleFieldChange("dressmakerValue", event.target.value)}
                  className={`${fieldClassName} mt-2`}
                />
              </div>

              <div>
                <label className={labelClassName}>Valor Restante</label>
                <div className="mt-2 rounded-md border border-outline-variant/45 bg-surface-lowest px-3 py-2 text-sm font-medium text-primary">
                  {formatCurrency(remainingValuePreview)}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">Informações de Controle</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoCard label="Venda vinculada" value={product.saleId ? `#${product.saleId}` : "Sem venda"} />
              <InfoCard label="Criado em" value={formatDateTime(product.createdAt)} />
              <InfoCard label="Atualizado em" value={formatDateTime(product.updatedAt)} />
              <InfoCard label="Data da prova" value={formatDate(product.testDate)} />
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
