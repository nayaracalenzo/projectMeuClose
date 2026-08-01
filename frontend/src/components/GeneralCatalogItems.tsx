import { useEffect, useState } from "react";
import { formatCurrencyInput, parseCurrencyToNumber } from "../utils/currency";

interface GeneralCatalogProduct {
  id: number;
  name: string;
  quantity: string;
  price: string;
  materialCost: string;
  discountPercent: string;
}

export interface GeneralCatalogProductDraft {
  id: number;
  name: string;
  quantity: string;
  price: string;
  materialCost: string;
  discountPercent: string;
}

export interface GeneralCatalogSummaryItem {
  type: string;
  quantity: number;
  value: number;
  discountAmount: number;
  finalValue: number;
}

interface GeneralCatalogItemsProps {
  title: string;
  itemLabel: string;
  defaultSummaryLabel: string;
  initialProducts?: GeneralCatalogProductDraft[];
  onSummaryChange?: (items: GeneralCatalogSummaryItem[]) => void;
  onProductsChange?: (items: GeneralCatalogProductDraft[]) => void;
}

export default function GeneralCatalogItems({
  title,
  itemLabel,
  defaultSummaryLabel,
  initialProducts,
  onSummaryChange,
  onProductsChange,
}: GeneralCatalogItemsProps) {
  const buildEmptyProduct = (id: number): GeneralCatalogProduct => ({
    id,
    name: "",
    quantity: "1",
    price: "",
    materialCost: "",
    discountPercent: "",
  });
  const [products, setProducts] = useState<GeneralCatalogProduct[]>(
    initialProducts?.length
      ? initialProducts.map((product, index) => ({ ...product, id: product.id || index + 1 }))
      : [buildEmptyProduct(1)],
  );

  const fieldClassName =
    "h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

  const getDiscountPercent = (value: string) => {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(100, Math.max(0, parsed));
  };

  const updateProduct = (
    productId: number,
    field: keyof Omit<GeneralCatalogProduct, "id">,
    value: string,
  ) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product,
      ),
    );
  };

  const handlePriceChange = (productId: number, value: string) => {
    updateProduct(productId, "price", formatCurrencyInput(value));
  };

  const removeProduct = (productId: number) => {
    setProducts((prev) => prev.filter((product) => product.id !== productId));
  };

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
          type: product.name.trim() || defaultSummaryLabel,
          quantity,
          value,
          discountAmount,
          finalValue: Number((grossValue - discountAmount).toFixed(2)),
        };
      }),
    );
  }, [defaultSummaryLabel, onSummaryChange, products]);

  useEffect(() => {
    if (!onProductsChange) return;
    onProductsChange(products.map((product) => ({ ...product })));
  }, [onProductsChange, products]);

  return (
    <div className="rounded border border-outline-variant/50 bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700">
          {title}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="rounded border border-outline-variant/50 bg-surface-lowest p-4"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-primary">
                {itemLabel} {index + 1}
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

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(120px,0.7fr)_1fr_1fr_1fr]">
              <div>
                <label
                  htmlFor={`general-name-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Descrição
                </label>
                <input
                  id={`general-name-${product.id}`}
                  value={product.name}
                  onChange={(event) => updateProduct(product.id, "name", event.target.value)}
                  placeholder="Digite a descrição do item"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`general-quantity-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Quantidade
                </label>
                <input
                  id={`general-quantity-${product.id}`}
                  type="number"
                  min={1}
                  value={product.quantity}
                  onChange={(event) => updateProduct(product.id, "quantity", event.target.value)}
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`general-price-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Preço
                </label>
                <input
                  id={`general-price-${product.id}`}
                  value={product.price}
                  onChange={(event) => handlePriceChange(product.id, event.target.value)}
                  placeholder="R$ 0,00"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`general-material-cost-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Custo/Material
                </label>
                <input
                  id={`general-material-cost-${product.id}`}
                  value={product.materialCost}
                  onChange={(event) =>
                    updateProduct(
                      product.id,
                      "materialCost",
                      formatCurrencyInput(event.target.value),
                    )
                  }
                  placeholder="R$ 0,00"
                  className={fieldClassName}
                />
              </div>

              <div>
                <label
                  htmlFor={`general-discount-${product.id}`}
                  className="mb-1 block text-sm text-primary"
                >
                  Desconto (%)
                </label>
                <input
                  id={`general-discount-${product.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={product.discountPercent}
                  onChange={(event) =>
                    updateProduct(product.id, "discountPercent", event.target.value)
                  }
                  placeholder="0"
                  className={fieldClassName}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
