import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatIsoDateInput,
  formatLegacyShortDateInput,
  maskLegacyShortDateInput,
  parseLegacyOrIsoDate,
} from "../utils/legacyDate";

type DatePickerInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  format?: "short" | "iso";
  min?: string;
  max?: string;
  readOnly?: boolean;
};

function toIsoDateOnly(value?: string | null) {
  return formatIsoDateInput(value);
}

function toDisplayValue(value?: string | null) {
  return formatLegacyShortDateInput(value);
}

export default function DatePickerInput({
  id,
  name,
  value,
  onChange,
  className = "",
  disabled = false,
  required = false,
  placeholder = "dd/mm/aa",
  format = "short",
  min,
  max,
  readOnly = false,
}: DatePickerInputProps) {
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [displayValue, setDisplayValue] = useState(() => toDisplayValue(value));

  const nativeValue = useMemo(() => toIsoDateOnly(value), [value]);

  useEffect(() => {
    setDisplayValue(toDisplayValue(value));
  }, [value]);

  const handleVisibleInputChange = (nextValue: string) => {
    const maskedValue = maskLegacyShortDateInput(nextValue);
    setDisplayValue(maskedValue);

    if (format === "short") {
      onChange(maskedValue);
      return;
    }

    if (!maskedValue) {
      onChange("");
      return;
    }

    if (maskedValue.length !== 8) {
      return;
    }

    const parsedDate = parseLegacyOrIsoDate(maskedValue);
    if (!parsedDate) {
      return;
    }

    onChange(toIsoDateOnly(maskedValue));
  };

  const handleVisibleInputBlur = () => {
    if (format === "iso" && displayValue && displayValue.length < 8) {
      setDisplayValue(toDisplayValue(value));
    }
  };

  const handleNativeInputChange = (nextValue: string) => {
    if (format === "short") {
      onChange(formatLegacyShortDateInput(nextValue));
      return;
    }

    onChange(nextValue);
  };

  const handleOpenPicker = () => {
    if (disabled || readOnly) {
      return;
    }

    const input = nativeInputRef.current;
    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div className="relative w-full">
      <input
        id={id}
        name={name}
        value={displayValue}
        onChange={(event) => handleVisibleInputChange(event.target.value)}
        onBlur={handleVisibleInputBlur}
        inputMode="numeric"
        maxLength={8}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        readOnly={readOnly}
        className={`w-full ${className} pr-11`}
      />
      <input
        ref={nativeInputRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={nativeValue}
        onChange={(event) => handleNativeInputChange(event.target.value)}
        min={toIsoDateOnly(min)}
        max={toIsoDateOnly(max)}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
      <button
        type="button"
        onClick={handleOpenPicker}
        disabled={disabled || readOnly}
        aria-label="Abrir calendario"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-700 transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarDays size={16} />
      </button>
    </div>
  );
}
