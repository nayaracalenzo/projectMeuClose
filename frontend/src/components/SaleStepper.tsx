interface SaleStepperProps {
  step: number;
}

export function SaleStepper({ step }: SaleStepperProps) {
  const steps = ["Cliente", "Tipo", "Produtos", "Resumo"];

  return (
    <div className="flex gap-6">
      {steps.map((label, index) => {
        const number = index + 1;

        const active = step === number;

        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
              ${active ? "bg-[#fd074a] text-white" : "bg-gray-200"}
              `}
            >
              {number}
            </div>

            <span
              className={`
              font-medium
              ${active ? "text-[#fd074a]" : "text-gray-400"}
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
