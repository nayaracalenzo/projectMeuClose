import { useCallback, useEffect, useMemo, useState } from "react";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrencyInput, parseCurrencyToNumber } from "../utils/currency";
import { getRequest, postRequest } from "../services/request";
import MeasurementsFields from "./MeasurementsFields";
import CustomerModal from "./CustomerModal";
import NoticeToast from "./NoticeToast";

interface AdminOption {
  desc?: string | null;
}

type QuickCreateResource = "clothings-types" | "fabrics" | "colors";

type QuickCreateNotice = {
  tone: "success" | "error";
  title?: string;
  message: string;
};

interface SeamstressOption {
  id: number;
  shortName: string;
}

export type MeasurementOption = {
  idMeasurementDefinition: number;
  value: string;
  label: string;
};

export type CustomMadeMeasurements = Record<string, string>;

export type MeasurementField = string;

const fallbackMeasurementOptions = [
  { value: "busto", label: "Busto" },
  { value: "alturaBusto", label: "Altura do busto" },
  { value: "braco", label: "Braço" },
  { value: "cintura", label: "Cintura" },
  { value: "cinturaBaixa", label: "Abaixo da cintura" },
  { value: "cos", label: "Cos" },
  { value: "quadril", label: "Quadril" },
  { value: "costas", label: "Costas" },
  { value: "colete", label: "Colete" },
  { value: "gancho", label: "Gancho" },
  { value: "comprimentoSaia", label: "Comprimento saia" },
  { value: "comprimentoBlusa", label: "Comprimento blusa" },
  { value: "comprimentoCalca", label: "Comprimento calça" },
  { value: "comprimentoManga", label: "Comprimento manga" },
  { value: "comprimentoVestido", label: "Comprimento vestido" },
  { value: "comprimentoBermuda", label: "Comprimento bermuda" },
  { value: "perna", label: "Perna" },
  { value: "coice", label: "Coice" },
];

interface CustomMadeProduct {
  id: number;
  type: string;
  fabric: string;
  color: string;
  measurements: CustomMadeMeasurements;
  selectedMeasurements: MeasurementField[];
  description: string;
  price: string;
  discountPercent: string;
  details: string;
  status: string;
  seamstress: string;
  fittingDate: string;
  seamstressCost: string;
}

export interface CustomMadeProductDraft {
  id: number;
  productMode?: string | null;
  type: string;
  fabric: string;
  color: string;
  measurements: CustomMadeMeasurements;
  selectedMeasurements: MeasurementField[];
  description: string;
  price: string;
  discountPercent: string;
  details: string;
  status: string;
  seamstress: string;
  fittingDate: string;
  seamstressCost: string;
}

export interface CustomMadeSummaryItem {
  type: string;
  description: string;
  fittingDate?: string | null;
  quantity: number;
  value: number;
  discountAmount: number;
  finalValue: number;
}

interface CustomMadeClothingProps {
  initialProducts?: CustomMadeProductDraft[];
  onSummaryChange?: (items: CustomMadeSummaryItem[]) => void;
  onProductsChange?: (items: CustomMadeProductDraft[]) => void;
}

const emptyMeasurements = (): CustomMadeMeasurements => ({});

function normalizeAdminOptions(data: unknown) {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => String((item as AdminOption)?.desc || "").trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function normalizeMeasurementOptions(data: unknown): MeasurementOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const record = item as {
        idMeasurementDefinition?: number;
        key?: string | null;
        label?: string | null;
      };

      const key = String(record.key || "").trim();
      const label = String(record.label || "").trim();
      const idMeasurementDefinition = Number(record.idMeasurementDefinition || 0);

      if (!key || !label || !idMeasurementDefinition) {
        return null;
      }

      return {
        idMeasurementDefinition,
        value: key,
        label,
      };
    })
    .filter((item): item is MeasurementOption => Boolean(item));
}

function buildFallbackMeasurementOptions(): MeasurementOption[] {
  return fallbackMeasurementOptions.map((item, index) => ({
    idMeasurementDefinition: index + 1,
    value: item.value,
    label: item.label,
  }));
}

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

export default function CustomMadeClothing({
  initialProducts,
  onSummaryChange,
  onProductsChange,
}: CustomMadeClothingProps) {
  const [seamstresses, setSeamstresses] = useState<SeamstressOption[]>([]);
  const [measurementOptions, setMeasurementOptions] = useState<MeasurementOption[]>(
    buildFallbackMeasurementOptions(),
  );
  const [clothingTypes, setClothingTypes] = useState<string[]>([]);
  const [fabrics, setFabrics] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateResource, setQuickCreateResource] =
    useState<QuickCreateResource>("clothings-types");
  const [quickCreateProductId, setQuickCreateProductId] = useState<number | null>(null);
  const [quickCreateValue, setQuickCreateValue] = useState("");
  const [quickCreateSubmitting, setQuickCreateSubmitting] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState("");
  const [notice, setNotice] = useState<QuickCreateNotice | null>(null);
  const buildEmptyProduct = (id: number): CustomMadeProduct => ({
    id,
    type: "",
    fabric: "",
    color: "",
    measurements: emptyMeasurements(),
    selectedMeasurements: [],
    description: "",
    price: "",
    discountPercent: "",
    details: "",
    status: "A PRODUZIR",
    seamstress: "",
    fittingDate: "",
    seamstressCost: "",
  });
  const [products, setProducts] = useState<CustomMadeProduct[]>(
    initialProducts?.length
      ? initialProducts.map((product, index) => ({
          ...product,
          id: product.id || index + 1,
          measurements: { ...product.measurements },
          selectedMeasurements: [...product.selectedMeasurements],
        }))
      : [buildEmptyProduct(1)],
  );

  const fieldClassName =
    "h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

  const getDiscountPercent = (value: string) => {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed)) return 0;
    return Math.min(100, Math.max(0, parsed));
  };

  const quickCreateConfig = useMemo(
    () => ({
      "clothings-types": {
        endpoint: "/admin/clothings-types",
        label: "tipo de roupa",
        buttonLabel: "Tipo",
      },
      fabrics: {
        endpoint: "/admin/fabrics",
        label: "tecido",
        buttonLabel: "Tecido",
      },
      colors: {
        endpoint: "/admin/colors",
        label: "cor",
        buttonLabel: "Cor",
      },
    }),
    [],
  );

  const closeQuickCreateModal = useCallback(() => {
    setIsQuickCreateOpen(false);
    setQuickCreateProductId(null);
    setQuickCreateValue("");
    setQuickCreateError("");
    setQuickCreateSubmitting(false);
  }, []);

  const openQuickCreateModal = useCallback((resource: QuickCreateResource, productId: number) => {
    setQuickCreateResource(resource);
    setQuickCreateProductId(productId);
    setQuickCreateValue("");
    setQuickCreateError("");
    setIsQuickCreateOpen(true);
  }, []);

  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [
          employeesData,
          clothingTypesData,
          fabricsData,
          colorsData,
          measurementDefinitionsData,
        ] = await Promise.all([
          getRequest("/admin/employees"),
          getRequest("/admin/clothings-types"),
          getRequest("/admin/fabrics"),
          getRequest("/admin/colors"),
          getRequest("/admin/measurement-definitions"),
        ]);

        const parsedSeamstresses = employeesData
          .filter(
            (employee: {
              idEmployee?: number;
              roleId?: number;
              active?: boolean;
              shortName?: string | null;
            }) =>
              Number(employee.roleId) === 3 &&
              employee.active === true &&
              Boolean(employee.shortName),
          )
          .map((employee: { idEmployee?: number; shortName?: string | null }) => ({
            id: Number(employee.idEmployee),
            shortName: String(employee.shortName).trim(),
          }))
          .sort((left: SeamstressOption, right: SeamstressOption) =>
            left.shortName.localeCompare(right.shortName, "pt-BR"),
          );

        setSeamstresses(parsedSeamstresses);
        setClothingTypes(normalizeAdminOptions(clothingTypesData));
        setFabrics(normalizeAdminOptions(fabricsData));
        setColors(normalizeAdminOptions(colorsData));
        setMeasurementOptions(
          normalizeMeasurementOptions(measurementDefinitionsData).length
            ? normalizeMeasurementOptions(measurementDefinitionsData)
            : buildFallbackMeasurementOptions(),
        );
      } catch (error) {
        console.error("Erro ao buscar dados de referência da roupa sob medida", error);
      }
    };

    fetchReferenceData();
  }, []);

  const updateProduct = (
    productId: number,
    field: keyof Omit<CustomMadeProduct, "id" | "measurements" | "selectedMeasurements">,
    value: string,
  ) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, [field]: value } : product,
      ),
    );
  };

  const updateMeasurement = useCallback(
    (productId: number, field: MeasurementField, value: string) => {
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? { ...product, measurements: { ...product.measurements, [field]: value } }
            : product,
        ),
      );
    },
    [],
  );

  const addMeasurementField = useCallback((productId: number, field: MeasurementField) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== productId || product.selectedMeasurements.includes(field)) {
          return product;
        }

        return {
          ...product,
          selectedMeasurements: [...product.selectedMeasurements, field],
        };
      }),
    );
  }, []);

  const removeMeasurementField = useCallback((productId: number, field: MeasurementField) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== productId) return product;

        return {
          ...product,
          measurements: { ...product.measurements, [field]: "" },
          selectedMeasurements: product.selectedMeasurements.filter((item) => item !== field),
        };
      }),
    );
  }, []);

  const handlePriceChange = (productId: number, value: string) => {
    const formattedPrice = formatCurrencyInput(value);

    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== productId) return product;

        const nextPriceNumber = parseCurrencyToNumber(formattedPrice);
        const seamstressCostNumber = parseCurrencyToNumber(product.seamstressCost);

        return {
          ...product,
          price: formattedPrice,
          seamstressCost:
            seamstressCostNumber > nextPriceNumber ? formattedPrice : product.seamstressCost,
        };
      }),
    );
  };

  const handleSeamstressCostChange = (productId: number, value: string) => {
    const formattedCost = formatCurrencyInput(value);

    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== productId) return product;

        const priceNumber = parseCurrencyToNumber(product.price);
        const seamstressCostNumber = parseCurrencyToNumber(formattedCost);

        return {
          ...product,
          seamstressCost: seamstressCostNumber > priceNumber ? product.price : formattedCost,
        };
      }),
    );
  };

  const removeProduct = (productId: number) => {
    setProducts((prev) => prev.filter((product) => product.id !== productId));
  };

  const syncQuickCreateOptions = useCallback(
    (resource: QuickCreateResource, nextValue: string) => {
      const appendUniqueSorted = (currentItems: string[]) =>
        Array.from(new Set([...currentItems, nextValue])).sort((left, right) =>
          left.localeCompare(right, "pt-BR"),
        );

      if (resource === "clothings-types") {
        setClothingTypes((prev) => appendUniqueSorted(prev));
        return;
      }

      if (resource === "fabrics") {
        setFabrics((prev) => appendUniqueSorted(prev));
        return;
      }

      setColors((prev) => appendUniqueSorted(prev));
    },
    [],
  );

  const handleQuickCreateSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedValue = quickCreateValue.trim();
      if (!normalizedValue) {
        setQuickCreateError("Informe uma descrição para salvar.");
        return;
      }

      try {
        setQuickCreateSubmitting(true);
        setQuickCreateError("");

        await postRequest(quickCreateConfig[quickCreateResource].endpoint, {
          desc: normalizedValue,
        });

        syncQuickCreateOptions(quickCreateResource, normalizedValue);
        setProducts((prev) =>
          prev.map((product) => {
            if (product.id !== quickCreateProductId) {
              return product;
            }

            if (quickCreateResource === "clothings-types") {
              return { ...product, type: normalizedValue };
            }

            if (quickCreateResource === "fabrics") {
              return { ...product, fabric: normalizedValue };
            }

            return { ...product, color: normalizedValue };
          }),
        );

        closeQuickCreateModal();
        setNotice({
          tone: "success",
          title: "Cadastro realizado",
          message: `${quickCreateConfig[quickCreateResource].buttonLabel} adicionado com sucesso.`,
        });
      } catch (error: unknown) {
        console.error("Erro ao cadastrar opção administrativa da roupa sob medida", error);
        const message = getUserFacingApiErrorMessage(error, "Não foi possível salvar o cadastro.");
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
    [
      closeQuickCreateModal,
      quickCreateConfig,
      quickCreateProductId,
      quickCreateResource,
      quickCreateValue,
      syncQuickCreateOptions,
    ],
  );

  useEffect(() => {
    if (!onSummaryChange) return;

    onSummaryChange(
      products.map((product) => {
        const value = parseCurrencyToNumber(product.price);
        const discountPercent = getDiscountPercent(product.discountPercent);
        const discountAmount = Number(((value * discountPercent) / 100).toFixed(2));

        return {
          type: product.type || "Sob-medida",
          description: buildCustomMadeDescription(product),
          fittingDate: product.fittingDate || null,
          quantity: 1,
          value,
          discountAmount,
          finalValue: Number((value - discountAmount).toFixed(2)),
        };
      }),
    );
  }, [onSummaryChange, products]);

  useEffect(() => {
    if (!onProductsChange) return;

    onProductsChange(
      products.map((product) => ({
        ...product,
        measurements: { ...product.measurements },
        selectedMeasurements: [...product.selectedMeasurements],
      })),
    );
  }, [onProductsChange, products]);

  return (
    <div className="bg-white">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700">
          Dados da peça sob medida
        </p>
      </div>

      <div className="flex flex-col">
        {products.map((product, index) => (
          <div
            key={product.id}
            className="rounded border border-outline-variant/50 bg-surface-lowest p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">Produto {index + 1}</p>
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

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[90px_1fr_42px] md:items-center">
              <label htmlFor={`type-${product.id}`} className="text-sm text-primary">
                Tipo
              </label>
              <select
                id={`type-${product.id}`}
                value={product.type}
                onChange={(e) => updateProduct(product.id, "type", e.target.value)}
                className={fieldClassName}
              >
                <option value="">Selecione...</option>
                {clothingTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => openQuickCreateModal("clothings-types", product.id)}
                className="h-10 rounded border border-outline-variant/60 bg-white text-primary"
                aria-label="Cadastrar novo tipo de roupa"
              >
                +
              </button>

              <label htmlFor={`fabric-${product.id}`} className="text-sm text-primary">
                Tecido
              </label>
              <select
                id={`fabric-${product.id}`}
                value={product.fabric}
                onChange={(e) => updateProduct(product.id, "fabric", e.target.value)}
                className={fieldClassName}
              >
                <option value="">Selecione...</option>
                {fabrics.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => openQuickCreateModal("fabrics", product.id)}
                className="h-10 rounded border border-outline-variant/60 bg-white text-primary"
                aria-label="Cadastrar novo tecido"
              >
                +
              </button>

              <label htmlFor={`color-${product.id}`} className="text-sm text-primary">
                Cor
              </label>
              <select
                id={`color-${product.id}`}
                value={product.color}
                onChange={(e) => updateProduct(product.id, "color", e.target.value)}
                className={fieldClassName}
              >
                <option value="">Selecione...</option>
                {colors.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => openQuickCreateModal("colors", product.id)}
                className="h-10 rounded border border-outline-variant/60 bg-white text-primary"
                aria-label="Cadastrar nova cor"
              >
                +
              </button>
            </div>

            <MeasurementsFields
              productId={product.id}
              fieldClassName={fieldClassName}
              selectedMeasurements={product.selectedMeasurements}
              measurements={product.measurements}
              measurementOptions={measurementOptions}
              onAddMeasurementField={(id, field) =>
                addMeasurementField(id, field as MeasurementField)
              }
              onRemoveMeasurementField={(id, field) =>
                removeMeasurementField(id, field as MeasurementField)
              }
              onUpdateMeasurement={(id, field, value) =>
                updateMeasurement(id, field as MeasurementField, value)
              }
            />

            <div className="mt-4 rounded border border-outline-variant/60 bg-white p-3">
              <div className="my-3 grid grid-cols-1 items-center gap-2 md:grid-cols-[110px_1fr] md:items-center">
                <label htmlFor={`details-${product.id}`} className="text-sm text-primary">
                  Detalhes
                </label>
                <input
                  id={`details-${product.id}`}
                  value={product.details}
                  onChange={(e) => updateProduct(product.id, "details", e.target.value)}
                  className={fieldClassName}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[110px_1fr] md:items-center">
                <label htmlFor={`price-${product.id}`} className="text-sm text-primary">
                  Preço R$
                </label>
                <input
                  id={`price-${product.id}`}
                  value={product.price}
                  onChange={(e) => handlePriceChange(product.id, e.target.value)}
                  placeholder="R$ 0,00"
                  className={`${fieldClassName} max-w-55`}
                />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[110px_1fr] md:items-center">
                <label htmlFor={`discount-${product.id}`} className="text-sm text-primary">
                  Desconto %
                </label>
                <input
                  id={`discount-${product.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={product.discountPercent}
                  onChange={(e) => updateProduct(product.id, "discountPercent", e.target.value)}
                  placeholder="0"
                  className={`${fieldClassName} max-w-55`}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label
                    htmlFor={`status-${product.id}`}
                    className="mb-1 block text-sm text-primary"
                  >
                    Situação
                  </label>
                  <select
                    id={`status-${product.id}`}
                    value={product.status}
                    onChange={(e) => updateProduct(product.id, "status", e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="A PRODUZIR">A PRODUZIR</option>
                    <option value="EM PROVA">EM PROVA</option>
                    <option value="EM AJUSTE">EM AJUSTE</option>
                    <option value="FINALIZADA">FINALIZADA</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`fittingDate-${product.id}`}
                    className="mb-1 block text-sm text-primary"
                  >
                    Data Prova
                  </label>
                  <input
                    id={`fittingDate-${product.id}`}
                    type="date"
                    value={product.fittingDate}
                    onChange={(e) => updateProduct(product.id, "fittingDate", e.target.value)}
                    className={fieldClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label
                    htmlFor={`seamstress-${product.id}`}
                    className="mb-1 block text-sm text-primary"
                  >
                    Costureira
                  </label>
                  <select
                    id={`seamstress-${product.id}`}
                    value={product.seamstress}
                    onChange={(e) => updateProduct(product.id, "seamstress", e.target.value)}
                    className={fieldClassName}
                  >
                    <option value="">Selecione...</option>
                    {seamstresses.map((item) => (
                      <option key={item.id} value={item.shortName}>
                        {item.shortName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`seamstressCost-${product.id}`}
                    className="mb-1 block text-sm text-primary"
                  >
                    Custo do material
                  </label>
                  <input
                    id={`seamstressCost-${product.id}`}
                    value={product.seamstressCost}
                    onChange={(e) => handleSeamstressCostChange(product.id, e.target.value)}
                    placeholder="R$ 0,00"
                    className={fieldClassName}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CustomerModal
        open={isQuickCreateOpen}
        onClose={closeQuickCreateModal}
        title={`Novo ${quickCreateConfig[quickCreateResource].label}`}
        subtitle="Cadastre uma nova opção sem sair da venda."
      >
        <div className="mx-auto max-w-xl">
          {quickCreateError ? (
            <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
              {quickCreateError}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleQuickCreateSubmit}>
            <div>
              <label className="mb-1 block text-sm text-primary" htmlFor="quick-create-desc">
                Descrição
              </label>
              <input
                id="quick-create-desc"
                value={quickCreateValue}
                onChange={(event) => setQuickCreateValue(event.target.value)}
                placeholder={`Digite o ${quickCreateConfig[quickCreateResource].label}`}
                className={`${fieldClassName} uppercase`}
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
