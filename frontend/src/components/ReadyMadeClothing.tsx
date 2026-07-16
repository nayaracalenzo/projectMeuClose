import { useCallback, useEffect, useState } from "react";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrencyInput, parseCurrencyToNumber } from "../utils/currency";
import { getRequest, postRequest } from "../services/request";
import CustomerModal from "./CustomerModal";
import NoticeToast from "./NoticeToast";

interface AdminOption {
  desc?: string | null;
}

interface ReadyMadeProduct {
  id: number;
  name: string;
  size: string;
  quantity: string;
  price: string;
  materialCost: string;
  discountPercent: string;
}

export interface ReadyMadeProductDraft {
  id: number;
  name: string;
  size: string;
  quantity: string;
  price: string;
  materialCost: string;
  discountPercent: string;
}

export interface ReadyMadeSummaryItem {
  type: string;
  quantity: number;
  value: number;
  discountAmount: number;
  finalValue: number;
}

interface ReadyMadeClothingProps {
  onSummaryChange?: (items: ReadyMadeSummaryItem[]) => void;
  onProductsChange?: (items: ReadyMadeProductDraft[]) => void;
}

type NoticeState = {
  tone: "success" | "error";
  title?: string;
  message: string;
};

export default function ReadyMadeClothing({
  onSummaryChange,
  onProductsChange,
}: ReadyMadeClothingProps) {
  const [sizes, setSizes] = useState<string[]>([]);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateProductId, setQuickCreateProductId] = useState<number | null>(null);
  const [quickCreateValue, setQuickCreateValue] = useState("");
  const [quickCreateError, setQuickCreateError] = useState("");
  const [quickCreateSubmitting, setQuickCreateSubmitting] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [products, setProducts] = useState<ReadyMadeProduct[]>([
    {
      id: 1,
      name: "",
      size: "",
      quantity: "1",
      price: "",
      materialCost: "",
      discountPercent: "",
    },
  ]);

  const fieldClassName =
    "h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

  const getDiscountPercent = (value: string) => {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(100, Math.max(0, parsed));
  };

  useEffect(() => {
    const fetchSizes = async () => {
      try {
        const data = await getRequest("/admin/sizes");

        if (!Array.isArray(data)) {
          setSizes([]);
          return;
        }

        const parsedSizes = data
          .map((item) => String((item as AdminOption)?.desc || "").trim())
          .filter(Boolean)
          .sort((left, right) => left.localeCompare(right, "pt-BR"));

        setSizes(parsedSizes);
      } catch (error) {
        console.error("Erro ao buscar tamanhos da roupa pronta", error);
        setSizes([]);
      }
    };

    fetchSizes();
  }, []);

  const updateProduct = (
    productId: number,
    field: keyof Omit<ReadyMadeProduct, "id">,
    value: string,
  ) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product,
      ),
    );
  };

  const handlePriceChange = (productId: number, value: string) => {
    const formattedValue = formatCurrencyInput(value);
    updateProduct(productId, "price", formattedValue);
  };

  const removeProduct = (productId: number) => {
    setProducts((prev) => prev.filter((product) => product.id !== productId));
  };

  const closeQuickCreateModal = useCallback(() => {
    setIsQuickCreateOpen(false);
    setQuickCreateProductId(null);
    setQuickCreateValue("");
    setQuickCreateError("");
    setQuickCreateSubmitting(false);
  }, []);

  const openQuickCreateModal = useCallback((productId: number) => {
    setQuickCreateProductId(productId);
    setQuickCreateValue("");
    setQuickCreateError("");
    setIsQuickCreateOpen(true);
  }, []);

  const handleQuickCreateSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedValue = quickCreateValue.trim();
      if (!normalizedValue) {
        setQuickCreateError("Informe um tamanho para salvar.");
        return;
      }

      try {
        setQuickCreateSubmitting(true);
        setQuickCreateError("");

        await postRequest("/admin/sizes", {
          desc: normalizedValue,
        });

        setSizes((prev) =>
          Array.from(new Set([...prev, normalizedValue])).sort((left, right) =>
            left.localeCompare(right, "pt-BR"),
          ),
        );

        setProducts((prev) =>
          prev.map((product) =>
            product.id === quickCreateProductId
              ? { ...product, size: normalizedValue }
              : product,
          ),
        );

        closeQuickCreateModal();
        setNotice({
          tone: "success",
          title: "Cadastro realizado",
          message: "Tamanho adicionado com sucesso.",
        });
      } catch (error: unknown) {
        console.error("Erro ao cadastrar tamanho da roupa pronta", error);
        const message = getUserFacingApiErrorMessage(error, "Não foi possível salvar o tamanho.");
        setQuickCreateError(message);
        setNotice({
          tone: "error",
          title: "Erro ao cadastrar",
          message,
        });
      } finally {
        setQuickCreateSubmitting(false);
      }
    },
    [closeQuickCreateModal, quickCreateProductId, quickCreateValue],
  );

  useEffect(() => {
    if (!onSummaryChange) return;

    onSummaryChange(
      products.map((product) => {
        const quantity = Number(product.quantity) > 0 ? Number(product.quantity) : 1;
        const value = parseCurrencyToNumber(product.price);
        const discountPercent = getDiscountPercent(product.discountPercent);
        const grossValue = value * quantity;
        const discountAmount = Number(((grossValue * discountPercent) / 100).toFixed(2));

        return {
          type: product.name.trim() || "Roupa pronta",
          quantity,
          value,
          discountAmount,
          finalValue: Number((grossValue - discountAmount).toFixed(2)),
        };
      }),
    );
  }, [onSummaryChange, products]);

  useEffect(() => {
    if (!onProductsChange) return;

    onProductsChange(products.map((product) => ({ ...product })));
  }, [onProductsChange, products]);

  return (
    <div className="rounded border border-outline-variant/50 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700">
          Dados da roupa pronta
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="rounded border border-outline-variant/50 bg-surface-lowest p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">
                Produto pronto {index + 1}
              </p>
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeProduct(product.id)}
                  className="h-8 rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`ready-name-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Produto
                </label>
                <input
                  id={`ready-name-${product.id}`}
                  value={product.name}
                  onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                  placeholder="Ex: Vestido midi"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`ready-size-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Tamanho
                </label>
                <div className="grid grid-cols-[1fr_42px] gap-3">
                  <select
                    id={`ready-size-${product.id}`}
                    value={product.size}
                    onChange={(e) => updateProduct(product.id, "size", e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Selecione...</option>
                    {sizes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openQuickCreateModal(product.id)}
                    className="h-10 rounded border border-outline-variant/60 bg-white text-primary"
                    aria-label="Cadastrar novo tamanho"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`ready-quantity-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Quantidade
                </label>
                <input
                  id={`ready-quantity-${product.id}`}
                  type="number"
                  min={1}
                  value={product.quantity}
                  onChange={(e) => updateProduct(product.id, "quantity", e.target.value)}
                  className={`${fieldClassName} max-w-28`}
                />
              </div>

              <div>
                <label
                  htmlFor={`ready-price-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Preço
                </label>
                <input
                  id={`ready-price-${product.id}`}
                  value={product.price}
                  onChange={(e) => handlePriceChange(product.id, e.target.value)}
                  placeholder="R$ 0,00"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`ready-material-cost-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Custo/Material
                </label>
                <input
                  id={`ready-material-cost-${product.id}`}
                  value={product.materialCost}
                  onChange={(e) =>
                    updateProduct(
                      product.id,
                      "materialCost",
                      formatCurrencyInput(e.target.value),
                    )
                  }
                  placeholder="R$ 0,00"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`ready-discount-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Desconto (%)
                </label>
                <input
                  id={`ready-discount-${product.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={product.discountPercent}
                  onChange={(e) => updateProduct(product.id, "discountPercent", e.target.value)}
                  placeholder="0"
                  className={fieldClassName}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <CustomerModal
        open={isQuickCreateOpen}
        onClose={closeQuickCreateModal}
        title="Novo tamanho"
        subtitle="Cadastre um novo tamanho sem sair da venda."
      >
        <div className="mx-auto max-w-xl">
          {quickCreateError ? (
            <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
              {quickCreateError}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleQuickCreateSubmit}>
            <div>
              <label className="mb-1 block text-sm text-primary" htmlFor="ready-size-create">
                Descrição
              </label>
              <input
                id="ready-size-create"
                value={quickCreateValue}
                onChange={(event) => setQuickCreateValue(event.target.value)}
                placeholder="Digite o tamanho"
                className={fieldClassName}
                autoFocus
                required
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={quickCreateSubmitting}
                className="rounded border border-primary bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {quickCreateSubmitting ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={closeQuickCreateModal}
                className="rounded border border-outline-variant/60 bg-white px-4 py-2 text-sm text-primary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </CustomerModal>

      <NoticeToast
        open={Boolean(notice)}
        tone={notice?.tone || "success"}
        title={notice?.title}
        message={notice?.message || ""}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}
