import { memo, type ReactNode } from "react";

type Option = {
  value: string | number;
  label: string;
};

export type CustomerFieldConfig = {
  key: string;
  label: string;
  type?: "text" | "date" | "checkbox" | "select";
  editable?: boolean;
  required?: boolean;
  invalid?: boolean;
  inputClassName?: string;
  labelClassName?: string;
  group?: string;
  containerClassName?: string;
  options?: Option[];
  formatValue?: (value: unknown, allValues: Record<string, unknown>) => string;
};

type CustomerDetailsCardProps = {
  title: string;
  fields: CustomerFieldConfig[];
  values: Record<string, unknown>;
  isEditing: boolean;
  onFieldChange: (key: string, value: unknown) => void;
};

const show = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
};

function CustomerDetailsCardComponent({
  title,
  fields,
  values,
  isEditing,
  onFieldChange,
}: CustomerDetailsCardProps) {
  const focusInputClassName =
    "py-1.5  rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-[#2a2526] shadow-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#8a4d5dcf]";
  const getLabelClassName = (field: CustomerFieldConfig) =>
    `${field.invalid ? "text-red-700" : "text-primary"} ${field.labelClassName || "w-fit"} shrink-0 font-semibold`;

  const renderField = (field: CustomerFieldConfig) => {
    const value = values[field.key];
    const label = `${field.label}${field.required ? " *" : ""}`;
    const labelClassName = getLabelClassName(field);

    if (!isEditing || !field.editable) {
      const text = field.formatValue
        ? field.formatValue(value, values)
        : show(value);

      return (
        <div key={field.key} className={`flex items-center gap-3 ${field.containerClassName || ""}`}>
          <span className={labelClassName}>{label}:</span>
          <span className="min-w-0 flex-1 text-[#2a2526]">{text}</span>
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <div key={field.key} className={`flex w-full items-center gap-3 ${field.containerClassName || ""}`}>
          <span className={labelClassName}>{label}:</span>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onFieldChange(field.key, e.target.checked)}
            className="h-4 w-4 shrink-0 checked:accent-[#8a4d5dcf]"
          />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.key} className={`flex w-full items-center gap-3 ${field.containerClassName || ""}`}>
          <span className={labelClassName}>{label}:</span>
          <select
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onFieldChange(field.key, e.target.value)}
            className={`h-[33.5px] min-w-0 flex-1 ${focusInputClassName} ${field.invalid ? "border-red-500" : ""} ${field.inputClassName || ""}`}
          >
            <option value="">Selecione...</option>
            {(field.options || []).map((option) => (
              <option key={`${field.key}-${option.value}`} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={field.key} className={`flex items-center gap-3 ${field.containerClassName || ""}`}>
        <span className={labelClassName}>{label}:</span>
        <input
          type={field.type === "date" ? "date" : "text"}
          value={
            field.type === "date"
              ? String(value || "").slice(0, 10)
              : String(value || "")
          }
          onChange={(e) => onFieldChange(field.key, e.target.value)}
          className={`min-w-0 flex-1 ${focusInputClassName} ${field.invalid ? "border-red-500" : ""} ${field.inputClassName || ""}`}
        />
      </div>
    );
  };

  const rows: ReactNode[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    if (field.group && i + 1 < fields.length && fields[i + 1].group === field.group) {
      const nextField = fields[i + 1];
      rows.push(
        <div key={`group-${field.group}-${field.key}`} className="flex gap-3 w-full">
          <div className="flex-1">{renderField(field)}</div>
          <div className="">{renderField(nextField)}</div>
        </div>,
      );
      i += 1;
      continue;
    }
    rows.push(<div key={`single-${field.key}`}>{renderField(field)}</div>);
  }

  return (
    <section className="rounded border border-outline-variant/40 bg-[#f1eced] p-4">
      <h2 className="mb-3 font-editorial text-3xl text-primary font-bold">{title}</h2>
      <div className="space-y-2 text-sm text-neutral-700">{rows}</div>
    </section>
  );
}

const CustomerDetailsCard = memo(CustomerDetailsCardComponent);

export default CustomerDetailsCard;
