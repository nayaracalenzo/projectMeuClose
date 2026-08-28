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
  const [prefersNativeTouchDateInput, setPrefersNativeTouchDateInput] =
    useState(false);

  const nativeValue = useMemo(() => toIsoDateOnly(value), [value]);

  useEffect(() => {
    setDisplayValue(toDisplayValue(value));
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updatePreference = () =>
      setPrefersNativeTouchDateInput(coarsePointerQuery.matches);

    updatePreference();

    if (typeof coarsePointerQuery.addEventListener === "function") {
      coarsePointerQuery.addEventListener("change", updatePreference);
      return () => {
        coarsePointerQuery.removeEventListener("change", updatePreference);
      };
    }

    coarsePointerQuery.addListener(updatePreference);
    return () => {
      coarsePointerQuery.removeListener(updatePreference);
    };
  }, []);

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

  if (prefersNativeTouchDateInput) {
    return (
      <div className="relative w-full">
        <input
          ref={nativeInputRef}
          id={id}
          name={name}
          type="date"
          value={nativeValue}
          onChange={(event) => handleNativeInputChange(event.target.value)}
          min={toIsoDateOnly(min)}
          max={toIsoDateOnly(max)}
          disabled={disabled}
          required={required}
          readOnly={readOnly}
          className={`w-full appearance-none ${className} pr-11`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-700"
        >
          <CalendarDays size={16} />
        </span>
      </div>
    );
  }

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
        tabIndex={disabled || readOnly ? -1 : 0}
        aria-label="Selecionar data"
        value={nativeValue}
        onChange={(event) => handleNativeInputChange(event.target.value)}
        min={toIsoDateOnly(min)}
        max={toIsoDateOnly(max)}
        disabled={disabled}
        readOnly={readOnly}
        className="absolute inset-0 z-10 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed sm:inset-y-0 sm:right-0 sm:left-auto sm:w-11"
      />
      <button
        type="button"
        onClick={handleOpenPicker}
        disabled={disabled || readOnly}
        aria-label="Abrir calendario"
        className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-11 items-center justify-center text-neutral-700 transition disabled:cursor-not-allowed disabled:opacity-50 sm:pointer-events-auto sm:hover:text-primary"
      >
        <CalendarDays size={16} />
      </button>
    </div>
  );
}
