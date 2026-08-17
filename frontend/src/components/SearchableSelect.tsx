import { useEffect, useId, useMemo, useState } from "react";

type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  id?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  emptyMessage?: string;
  promptMessage?: string;
};

function normalizeText(value: string) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  onSearchChange,
  placeholder = "Digite para buscar",
  className,
  inputClassName,
  dropdownClassName,
  optionClassName,
  emptyMessage = "Nenhuma opção encontrada.",
  promptMessage = "Digite para filtrar as opções.",
}: SearchableSelectProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  );
  const [search, setSearch] = useState(selectedOption?.label || "");
  const [isOpen, setIsOpen] = useState(false);
  const [showAllOnOpen, setShowAllOnOpen] = useState(false);

  useEffect(() => {
    setSearch(selectedOption?.label || "");
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (showAllOnOpen) {
      return options;
    }

    const normalizedSearch = normalizeText(search);

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      normalizeText(option.label).includes(normalizedSearch),
    );
  }, [options, search]);

  return (
    <div className={className}>
      <input
        id={inputId}
        type="text"
        value={search}
        onChange={(event) => {
          const nextValue = event.target.value;
          setSearch(nextValue);
          setIsOpen(true);
          setShowAllOnOpen(false);
          onSearchChange?.(nextValue);

          if (!nextValue.trim() && value) {
            onChange("");
          }
        }}
        onFocus={() => {
          setIsOpen(true);
          setShowAllOnOpen(true);
          onSearchChange?.("");
        }}
        onClick={() => {
          setIsOpen(true);
          setShowAllOnOpen(true);
          onSearchChange?.("");
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false);
            setShowAllOnOpen(false);
            setSearch(selectedOption?.label || "");
          }, 120);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full ${inputClassName || ""}`.trim()}
      />

      {isOpen && (
        <div className={dropdownClassName}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setSearch(option.label);
                  setIsOpen(false);
                  setShowAllOnOpen(false);
                }}
                className={optionClassName}
              >
                {option.label}
              </button>
            ))
          ) : search.trim() ? (
            <p className="px-3 py-2 text-sm text-neutral-600">{emptyMessage}</p>
          ) : (
            <p className="px-3 py-2 text-sm text-neutral-600">{promptMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
