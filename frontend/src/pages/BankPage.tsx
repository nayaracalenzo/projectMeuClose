import { useState } from "react";
import { formatCurrency } from "../utils/currency";

type Scope = "LOJA" | "PESSOAL";

interface BankRow {
  id: number;
  date: string;
  bank: string;
  movement: string;
  category: string;
  description: string;
  amount: number;
}

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

export default function BankPage() {
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const rows: BankRow[] = [];
  const totalIn = 0;
  const totalOut = 0;

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-5 pt-12 pb-6 text-6xl font-semibold text-primary md:text-4xl">Banco</h1>

      <div className="mb-5 border-b border-outline-variant/35">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScope("LOJA")}
            className={`px-4 py-2 text-sm uppercase tracking-[0.08em] ${
              scope === "LOJA"
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-neutral-700"
            }`}
          >
            Banco da Loja
          </button>
          <button
            type="button"
            onClick={() => setScope("PESSOAL")}
            className={`px-4 py-2 text-sm uppercase tracking-[0.08em] ${
              scope === "PESSOAL"
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-neutral-700"
            }`}
          >
            Banco Pessoal
          </button>
        </div>
      </div>

      <div className="mb-5 flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">Buscar movimentação</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descrição, categoria ou banco"
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-primary">Até</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-11 min-w-44 rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="bg-surface-lowest p-4"><p className="text-xs uppercase text-neutral-700">Entradas</p><p className="text-lg font-semibold text-primary">{formatCurrency(totalIn)}</p></div>
        <div className="bg-surface-lowest p-4"><p className="text-xs uppercase text-neutral-700">Saídas</p><p className="text-lg font-semibold text-primary">{formatCurrency(totalOut)}</p></div>
        <div className="bg-surface-lowest p-4"><p className="text-xs uppercase text-neutral-700">Saldo</p><p className="text-lg font-semibold text-primary">{formatCurrency(totalIn - totalOut)}</p></div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Banco</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Tipo</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Categoria</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Descrição</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={6}
                className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
              >
                Nenhuma movimentação bancária cadastrada.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
        {rows.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhuma movimentação bancária cadastrada.
          </div>
        )}
        {rows.map((row) => (
          <div key={row.id} className="px-4 py-4">
            <p className="text-sm font-semibold text-primary">{formatDate(row.date)} - {row.bank}</p>
            <p className="text-xs text-neutral-700">{row.category} - {row.movement}</p>
            <p className="text-xs text-neutral-700">{row.description}</p>
            <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(row.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
