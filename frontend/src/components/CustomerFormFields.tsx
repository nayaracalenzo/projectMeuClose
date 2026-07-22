import { useMemo } from "react";
import { formatDocument } from "../utils/formatDocument";

type ProfessionOption = {
  id: number;
  name: string;
};

export type CustomerFormValues = {
  typeCustomer: "INDIVIDUAL" | "COMPANY";
  document: string;
  rg: string;
  fullName: string;
  birthDate: string;
  companyName: string;
  tradeName: string;
  phone: string;
  email: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  professionId: string | number | null;
  comment: string;
};

type FieldConfig = {
  key: keyof CustomerFormValues;
  label: string;
  type?: "text" | "date" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  section?: "main" | "address";
};

type CustomerFormFieldsProps = {
  form: CustomerFormValues;
  professions: ProfessionOption[];
  onFieldChange: (field: keyof CustomerFormValues, value: string) => void;
  onTypeCustomerChange: (value: "INDIVIDUAL" | "COMPANY") => void;
  zipCodeHelperMessage?: string;
  onCreateProfessionRequest?: () => void;
  readOnly?: boolean;
  showStatusFields?: boolean;
  active?: boolean;
  onActiveChange?: (value: boolean) => void;
};

export default function CustomerFormFields({
  form,
  professions,
  onFieldChange,
  onTypeCustomerChange,
  zipCodeHelperMessage = "",
  onCreateProfessionRequest,
  readOnly = false,
  showStatusFields = false,
  active = false,
  onActiveChange,
}: CustomerFormFieldsProps) {
  const baseClass =
    "h-10 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-[#2a2526] shadow-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#8a4d5dcf]";
  const readOnlyClass =
    "flex min-h-10 w-full items-center rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-[#2a2526]";

  const professionOptions = useMemo(
    () =>
      professions.map((item) => ({ value: String(item.id), label: item.name })),
    [professions],
  );

  const fields: FieldConfig[] = useMemo(
    () => [
      {
        key: "document",
        label: form.typeCustomer === "INDIVIDUAL" ? "CPF" : "CNPJ",
        section: "main",
      },
      {
        key: "fullName",
        label: "Nome Completo",
        required: form.typeCustomer === "INDIVIDUAL",
        section: "main",
      },
      { key: "rg", label: "RG", section: "main" },
      {
        key: "companyName",
        label: "Razão social",
        required: form.typeCustomer === "COMPANY",
        section: "main",
      },
      { key: "tradeName", label: "Nome fantasia", section: "main" },
      { key: "phone", label: "Telefone", section: "main" },
      { key: "email", label: "Email", section: "main" },
      {
        key: "professionId",
        label: "Profissão",
        type: "select",
        section: "main",
        options: [{ value: "", label: "Selecione..." }, ...professionOptions],
      },
      { key: "zipCode", label: "CEP", section: "address" },
      { key: "street", label: "Rua", section: "address" },
      { key: "number", label: "Número", section: "address" },
      { key: "complement", label: "Complemento", section: "address" },
      { key: "neighborhood", label: "Bairro", section: "address" },
      { key: "city", label: "Cidade", section: "address" },
      { key: "state", label: "UF", section: "address" },
    ],
    [form.typeCustomer, professionOptions],
  );

  const mainFields = fields.filter((field) => {
    if (field.section !== "main") return false;
    if (
      form.typeCustomer === "INDIVIDUAL" &&
      (field.key === "companyName" || field.key === "tradeName")
    ) {
      return false;
    }
    return true;
  });

  const addressFields = fields.filter((field) => field.section === "address");

  const professionLabel =
    professions.find(
      (item) => String(item.id) === String(form.professionId ?? ""),
    )?.name || "";

  const getDisplayValue = (field: FieldConfig) => {
    const rawValue = String(form[field.key] ?? "").trim();

    if (!rawValue) return "-";
    if (field.key === "document") return formatDocument(rawValue);
    if (field.key === "professionId") return professionLabel || "-";

    return rawValue;
  };

  const renderField = (field: FieldConfig) => {
    const label = `${field.label}${field.required ? " *" : ""}`;

    if (readOnly) {
      return (
        <div key={field.key}>
          <label className="mb-1 block text-sm text-primary">{label}</label>
          <div className={readOnlyClass}>{getDisplayValue(field)}</div>
        </div>
      );
    }

    if (field.type === "select") {
      const isProfessionField = field.key === "professionId";

      return (
        <div key={field.key}>
          <label className="mb-1 block text-sm text-primary">{label}</label>
          <div
            className={
              isProfessionField && onCreateProfessionRequest
                ? "grid grid-cols-[minmax(0,1fr)_42px] gap-2"
                : ""
            }
          >
            <select
              value={String(form[field.key] ?? "")}
              onChange={(e) => onFieldChange(field.key, e.target.value)}
              className={baseClass}
            >
              {(field.options || []).map((option) => (
                <option
                  key={`${field.key}-${option.value}`}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
            {isProfessionField && onCreateProfessionRequest ? (
              <button
                type="button"
                onClick={onCreateProfessionRequest}
                className="h-10 rounded-lg border border-[#a59797] bg-white text-lg text-primary transition hover:bg-surface-low"
                aria-label="Cadastrar nova profissão"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div key={field.key}>
        <label className="mb-1 block text-sm text-primary">{label}</label>
        <input
          type={field.type === "date" ? "date" : "text"}
          value={String(form[field.key] ?? "")}
          onChange={(e) => onFieldChange(field.key, e.target.value)}
          className={baseClass}
        />
        {field.key === "zipCode" && zipCodeHelperMessage ? (
          <p className="mt-1 text-xs text-neutral-700">
            {zipCodeHelperMessage}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <label className="mb-3 block text-sm text-primary">
              Tipo de cliente *
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="radio"
                  name="typeCustomer"
                  value="INDIVIDUAL"
                  checked={form.typeCustomer === "INDIVIDUAL"}
                  onChange={(e) =>
                    onTypeCustomerChange(e.target.value as "INDIVIDUAL")
                  }
                  className="h-4 w-4 accent-primary"
                  disabled={readOnly}
                />
                Pessoa física
              </label>
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="radio"
                  name="typeCustomer"
                  value="COMPANY"
                  checked={form.typeCustomer === "COMPANY"}
                  onChange={(e) =>
                    onTypeCustomerChange(e.target.value as "COMPANY")
                  }
                  className="h-4 w-4 accent-primary"
                  disabled={readOnly}
                />
                Pessoa jurídica
              </label>
            </div>
          </div>

          {showStatusFields ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto] lg:min-w-[140px] lg:justify-end">
              <label className="flex items-center gap-3 py-3 text-sm text-[#2a2526]">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => onActiveChange?.(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                  disabled={readOnly}
                />
                <span className="font-medium">Ativo</span>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mainFields.map(renderField)}
      </div>

      <div className="rounded border border-outline-variant/40 bg-surface-lowest p-4 my-4">
        <h2 className="mb-3 font-editorial text-2xl text-primary">Endereço</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {addressFields.map(renderField)}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-primary">Observações</label>
        <textarea
          value={form.comment}
          onChange={(e) => onFieldChange("comment", e.target.value)}
          className="min-h-24 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 py-2 text-[#2a2526] shadow-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#8a4d5dcf]"
          readOnly={readOnly}
        />
      </div>
    </>
  );
}
