import { useEffect, useState } from "react";
import { formatCurrencyInput, parseCurrencyToNumber } from "../utils/currency";

interface ReadyMadeProduct {
  id: number;
  name: string;
  size: string;
  quantity: string;
  price: string;
}

export interface ReadyMadeProductDraft {
  id: number;
  name: string;
  size: string;
  quantity: string;
  price: string;
}

export interface ReadyMadeSummaryItem {
  type: string;
  quantity: number;
  value: number;
}

interface ReadyMadeClothingProps {
  onSummaryChange?: (items: ReadyMadeSummaryItem[]) => void;
  onProductsChange?: (items: ReadyMadeProductDraft[]) => void;
}

export default function ReadyMadeClothing({
  onSummaryChange,
  onProductsChange,
}: ReadyMadeClothingProps) {
  const [products, setProducts] = useState<ReadyMadeProduct[]>([
    {
      id: 1,
      name: "",
      size: "",
      quantity: "1",
      price: "",
    },
  ]);

  const fieldClassName =
    "h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

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

  const addProduct = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        name: "",
        size: "",
        quantity: "1",
        price: "",
      },
    ]);
  };

  const removeProduct = (productId: number) => {
    setProducts((prev) => prev.filter((product) => product.id !== productId));
  };

  useEffect(() => {
    if (!onSummaryChange) return;

    onSummaryChange(
      products.map((product) => ({
        type: product.name.trim() || "Roupa pronta",
        quantity: Number(product.quantity) > 0 ? Number(product.quantity) : 1,
        value: parseCurrencyToNumber(product.price),
      })),
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
                <input
                  id={`ready-size-${product.id}`}
                  value={product.size}
                  onChange={(e) => updateProduct(product.id, "size", e.target.value)}
                  placeholder="Ex: M"
                  className={fieldClassName}
                />
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
                  className={fieldClassName}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
