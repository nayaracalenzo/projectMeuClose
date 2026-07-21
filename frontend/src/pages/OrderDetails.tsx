import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import NoticeToast from "../components/NoticeToast";
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
  saleItemQuantity: number;
  saleItemUnitPrice: number;
  saleItemDiscountType: "PERCENTAGE" | "FIXED" | null;
  saleItemDiscountValue: number | null;
  saleItemGrossValue: number;
  saleItemDiscountAmount: number;
  saleItemSubtotal: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type SelectOption = {
  id: number;
  label: string;
};

type ProductFormState = {
  details: string;
  employeeId: string;
  testDate: string;
};

type ToastState = {
  open: boolean;
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
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
  if (!value) return "";
  return String(value).slice(0, 10);
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

function toFormState(product: ProductDetails): ProductFormState {
  return {
    details: product.details || "",
    employeeId: product.employeeId ? String(product.employeeId) : "",
    testDate: toDateInputValue(product.testDate),
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

function ReadonlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <div className={`${fieldClassName} mt-2 bg-surface-lowest text-neutral-700`}>{value}</div>
    </div>
  );
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<ToastState>(EMPTY_TOAST);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        setToast(EMPTY_TOAST);

        const [productData, employeesData] = await Promise.all([
          getRequest(`/products/${id}`),
          getRequest("/admin/employees"),
        ]);

        setProduct(productData as ProductDetails);
        setForm(toFormState(productData as ProductDetails));
        setEmployeeOptions(
          mapAdminOptions(employeesData, { idKey: "idEmployee", labelKey: "shortName" }),
        );
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { status?: number } };

        if (maybeAxiosError.response?.status === 404) {
          setError("Pedido não encontrado.");
        } else {
          setError(
            getUserFacingApiErrorMessage(err, "Não foi possível carregar os detalhes do produto."),
          );
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [id]);

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
      setToast(EMPTY_TOAST);

      const updated = (await updateRequest(`/products/${product.id}`, {
        desc: product.desc,
        customerId: product.customerId,
        statusId: product.statusId,
        categoryId: product.categoryId,
        productTypeId: product.productTypeId,
        clothingTypeId: product.clothingTypeId,
        colorId: product.colorId,
        fabricId: product.fabricId,
        sizeId: product.sizeId,
        qtyStock: product.qtyStock,
        finalValue: product.finalValue,
        dressmakerValue: product.dressmakerValue,
        ...form,
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
        message: getUserFacingApiErrorMessage(err, "Não foi possível salvar o pedido."),
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
            <Button variant="secondary" onClick={() => navigate("/producao")}>
              Voltar para produção
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
              onClick={() => navigate("/producao")}
              className="mb-4 text-sm text-neutral-700 underline-offset-2 hover:underline"
            >
              Voltar para produção
            </button>
            <h1 className="font-editorial text-5xl text-primary md:text-4xl">
              Detalhes do Produto
            </h1>
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
          <InfoCard label="Valor da peça" value={formatCurrency(product.finalValue)} />
          <InfoCard label="Lucro da peça" value={formatCurrency(product.remainingValue)} />
        </div>

        <form id="order-details-form" onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">Dados do Produto</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Aqui você pode ajustar apenas os dados operacionais do pedido. Para alterar valores,
              acesse a venda vinculada.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ReadonlyField label="Descrição" value={product.desc || "-"} />
              <ReadonlyField label="Status" value={product.statusName || "-"} />
              <ReadonlyField label="Tipo de Produto" value={product.categoryName || "-"} />
              <ReadonlyField label="Subtipo do Produto" value={product.productTypeName || "-"} />
              <ReadonlyField label="Tipo de Roupa" value={product.clothingTypeName || "-"} />
              <ReadonlyField label="Cor" value={product.colorName || "-"} />
              <ReadonlyField label="Tecido" value={product.fabricName || "-"} />
              <ReadonlyField label="Tamanho" value={product.sizeName || "-"} />
              <ReadonlyField
                label="Quantidade"
                value={String(product.saleItemQuantity || product.qtyStock || 1)}
              />

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
            <h2 className="font-editorial text-3xl text-primary">Informações de Controle</h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard label="Venda vinculada" value={product.saleId ? `#${product.saleId}` : "Sem venda"} />
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
