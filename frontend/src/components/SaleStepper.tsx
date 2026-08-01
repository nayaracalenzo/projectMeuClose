interface SaleStepperProps {
  step: number;
}

export function SaleStepper({ step }: SaleStepperProps) {
  const steps = ["Cliente", "Tipo", "Produtos", "Pagamento"];

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4 md:gap-6">
      {steps.map((label, index) => {
        const number = index + 1;

        const active = step === number;

        return (
          <div
            key={label}
            className="min-w-0 flex flex-1 flex-col items-center gap-1 rounded-lg border border-outline-variant/35 bg-white px-2 py-2 text-center sm:flex-none sm:flex-row sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-left"
          >
            <div
              className={`
              h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold
              ${active ? "bg-[#70585D] text-white" : "bg-gray-200"}
              `}
            >
              {number}
            </div>

            <span
              className={`
              min-w-0 text-[11px] font-medium leading-tight sm:text-base
              ${active ? "text-[#70585D]" : "text-gray-400"}
              `}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
