import { useState } from "react";
import { SaleStepper } from "../components/SaleStepper";

export default function NewSalePage() {
    const [step, setStep] = useState(1);
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-semibold mb-6">Nova Venda/Orçamento</h1>
      <SaleStepper step={step} />
      <div className="grid grid-cols-3 gap-6 mt-5">
        <div className="col-span-2 bg-white p-6 rounded-xl shadow-sm border">
          Conteúdo do passo
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">Resumo</div>
      </div>
    </div>
  );
}
