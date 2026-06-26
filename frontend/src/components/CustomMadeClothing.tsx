import { useCallback, useEffect, useState } from "react";
import { formatCurrencyInput, parseCurrencyToNumber } from "../utils/currency";
import { getRequest } from "../services/request";
import MeasurementsFields from "./MeasurementsFields";

const mockTypes = ["Vestido", "Conjunto", "Blazer", "Calca"];
const mockFabrics = ["Linho", "Viscose", "Crepe", "Alfaiataria"];
const mockColors = ["Preto", "Off-white", "Azul marinho", "Verde"];
interface SeamstressOption {
  id: number;
  shortName: string;
}

interface Measurements {
  costas: string;
  comprimentoSaia: string;
  comprimentoBlusa: string;
  comprimentoCalca: string;
  comprimentoManga: string;
  comprimentoVestido: string;
  comprimentoBermuda: string;
  cos: string;
  colete: string;
  perna: string;
  braco: string;
  alturaBusto: string;
  busto: string;
  cintura: string;
  coice: string;
  cinturaBaixa: string;
  quadril: string;
  gancho: string;
}

export type CustomMadeMeasurements = Measurements;

export type MeasurementField = keyof Measurements;

const measurementOptions: Array<{ value: MeasurementField; label: string }> = [
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
  measurements: Measurements;
  selectedMeasurements: MeasurementField[];
  description: string;
  price: string;
  details: string;
  status: string;
  seamstress: string;
  fittingDate: string;
  seamstressCost: string;
}

export interface CustomMadeProductDraft {
  id: number;
  type: string;
  fabric: string;
  color: string;
  measurements: CustomMadeMeasurements;
  selectedMeasurements: MeasurementField[];
  description: string;
  price: string;
  details: string;
  status: string;
  seamstress: string;
  fittingDate: string;
  seamstressCost: string;
}

export interface CustomMadeSummaryItem {
  type: string;
  quantity: number;
  value: number;
}

interface CustomMadeClothingProps {
  onSummaryChange?: (items: CustomMadeSummaryItem[]) => void;
  onProductsChange?: (items: CustomMadeProductDraft[]) => void;
}

const emptyMeasurements = (): Measurements => ({
  costas: "",
  comprimentoSaia: "",
  comprimentoBlusa: "",
  comprimentoCalca: "",
  comprimentoManga: "",
  comprimentoVestido: "",
  comprimentoBermuda: "",
  cos: "",
  colete: "",
  perna: "",
  braco: "",
  alturaBusto: "",
  busto: "",
  cintura: "",
  coice: "",
  cinturaBaixa: "",
  quadril: "",
  gancho: "",
});

export default function CustomMadeClothing({
  onSummaryChange,
  onProductsChange,
}: CustomMadeClothingProps) {
  const [seamstresses, setSeamstresses] = useState<SeamstressOption[]>([]);
  const [products, setProducts] = useState<CustomMadeProduct[]>([
    {
      id: 1,
      type: "",
      fabric: "",
      color: "",
      measurements: emptyMeasurements(),
      selectedMeasurements: [],
      description: "",
      price: "",
      details: "",
      status: "A PRODUZIR",
      seamstress: "",
      fittingDate: "",
      seamstressCost: "",
    },
  ]);

  const fieldClassName =
    "h-10 w-full rounded border border-outline-variant/60 bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-secondary/70";

  useEffect(() => {
    const fetchSeamstresses = async () => {
      try {
        const data = await getRequest("/admin/employees");
        const parsedSeamstresses = data
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
      } catch (error) {
        console.error("Erro ao buscar costureiras", error);
      }
    };

    fetchSeamstresses();
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

  useEffect(() => {
    if (!onSummaryChange) return;

    onSummaryChange(
      products.map((product) => ({
        type: product.type || "Sob-medida",
        quantity: 1,
        value: parseCurrencyToNumber(product.price),
      })),
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
          Dados da peça sob-medida
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
              <label htmlFor={`type-${product.id}`} className="text-sm text-primary">Tipo</label>
              <select
                id={`type-${product.id}`}
                value={product.type}
                onChange={(e) => updateProduct(product.id, "type", e.target.value)}
                className={fieldClassName}
              >
                <option value="">Selecione...</option>
                {mockTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <button type="button" className="h-10 rounded border border-outline-variant/60 bg-white text-primary">+</button>

              <label htmlFor={`fabric-${product.id}`} className="text-sm text-primary">Tecido</label>
              <select
                id={`fabric-${product.id}`}
                value={product.fabric}
                onChange={(e) => updateProduct(product.id, "fabric", e.target.value)}
                className={fieldClassName}
              >
                <option value="">Selecione...</option>
                {mockFabrics.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <button type="button" className="h-10 rounded border border-outline-variant/60 bg-white text-primary">+</button>

              <label htmlFor={`color-${product.id}`} className="text-sm text-primary">Cor</label>
              <select
                id={`color-${product.id}`}
                value={product.color}
                onChange={(e) => updateProduct(product.id, "color", e.target.value)}
                className={fieldClassName}
              >
                <option value="">Selecione...</option>
                {mockColors.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <button type="button" className="h-10 rounded border border-outline-variant/60 bg-white text-primary">+</button>
            </div>

            <MeasurementsFields
              productId={product.id}
              fieldClassName={fieldClassName}
              selectedMeasurements={product.selectedMeasurements}
              measurements={product.measurements}
              measurementOptions={measurementOptions}
              onAddMeasurementField={(id, field) => addMeasurementField(id, field as MeasurementField)}
              onRemoveMeasurementField={(id, field) => removeMeasurementField(id, field as MeasurementField)}
              onUpdateMeasurement={(id, field, value) => updateMeasurement(id, field as MeasurementField, value)}
            />

            <div className="mt-4 rounded border border-outline-variant/60 bg-white p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[110px_1fr] md:items-center items-center my-3">
                <label htmlFor={`details-${product.id}`} className="text-sm text-primary">Detalhes</label>
                <input
                  id={`details-${product.id}`}
                  value={product.details}
                  onChange={(e) => updateProduct(product.id, "details", e.target.value)}
                  className={fieldClassName}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[110px_1fr] md:items-center">
                <label htmlFor={`price-${product.id}`} className="text-sm text-primary">Preço R$</label>
                <input
                  id={`price-${product.id}`}
                  value={product.price}
                  onChange={(e) => handlePriceChange(product.id, e.target.value)}
                  placeholder="R$ 0,00"
                  className={`${fieldClassName} max-w-55`}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor={`status-${product.id}`} className="mb-1 block text-sm text-primary">Situação</label>
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
                  <label htmlFor={`fittingDate-${product.id}`} className="mb-1 block text-sm text-primary">Data Prova</label>
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
                  <label htmlFor={`seamstress-${product.id}`} className="mb-1 block text-sm text-primary">Costureira</label>
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
                  <label htmlFor={`seamstressCost-${product.id}`} className="mb-1 block text-sm text-primary">R$ Costureira</label>
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
    </div>
  );
}
