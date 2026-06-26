import { useMemo, useState } from "react";
import { formatCurrency } from "../utils/currency";

type Scope = "LOJA" | "PESSOAL";

interface CashRow {
  id: number;
  date: string;
  scope: Scope;
  description: string;
  amountIn?: number;
  amountOut?: number;
}

const mockCash: CashRow[] = [
  { id: 1, date: "2026-05-02", scope: "LOJA", description: "Venda em dinheiro", amountIn: 250 },
  { id: 2, date: "2026-05-02", scope: "LOJA", description: "Troco inicial", amountOut: 50 },
  { id: 3, date: "2026-05-03", scope: "PESSOAL", description: "Mercado", amountOut: 120 },
  { id: 4, date: "2026-05-04", scope: "PESSOAL", description: "Entrada extra", amountIn: 200 },
  { id: 5, date: "2026-05-06", scope: "LOJA", description: "Compra de aviamentos", amountOut: 180 },
  { id: 6, date: "2026-05-07", scope: "LOJA", description: "Ajuste recebido", amountIn: 95 },
];

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

const parseLocalDate = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

export default function Registers() {
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mockCash.filter((row) => {
      const byScope = row.scope === scope;
      const rowDate = parseLocalDate(row.date);
      const byStartDate = !startDate || rowDate >= parseLocalDate(startDate);
      const byEndDate = !endDate || rowDate <= parseLocalDate(endDate, true);
      const bySearch = !term || row.description.toLowerCase().includes(term);
      return byScope && byStartDate && byEndDate && bySearch;
    });
  }, [endDate, scope, search, startDate]);

  const totalIn = filtered.reduce((acc, row) => acc + (row.amountIn || 0), 0);
  const totalOut = filtered.reduce((acc, row) => acc + (row.amountOut || 0), 0);

  let runningBalance = 0;
  const rowsWithBalance = filtered.map((row) => {
    runningBalance += (row.amountIn || 0) - (row.amountOut || 0);
    return { ...row, balance: runningBalance };
  });

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-5 pt-12 pb-6 text-6xl font-semibold text-primary md:text-4xl">Caixa</h1>

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
            Caixa da Loja
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
            Caixa Pessoal
          </button>
        </div>
      </div>

      <div className="mb-5 flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">Buscar historico</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descricao do lancamento"
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
            <label className="mb-2 block text-sm font-semibold text-primary">Ate</label>
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
        <div className="bg-surface-lowest p-4"><p className="text-xs uppercase text-neutral-700">Saidas</p><p className="text-lg font-semibold text-primary">{formatCurrency(totalOut)}</p></div>
        <div className="bg-surface-lowest p-4"><p className="text-xs uppercase text-neutral-700">Saldo</p><p className="text-lg font-semibold text-primary">{formatCurrency(totalIn - totalOut)}</p></div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Historico</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Entrada</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Saida</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithBalance.map((row) => (
              <tr key={row.id} className="bg-surface-lowest transition-colors hover:bg-surface">
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">{formatDate(row.date)}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{row.description}</td>
                <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{row.amountIn ? formatCurrency(row.amountIn) : "-"}</td>
                <td className="px-4 py-3 text-right text-[14px] text-neutral-700">{row.amountOut ? formatCurrency(row.amountOut) : "-"}</td>
                <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">{formatCurrency(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
        {rowsWithBalance.map((row) => (
          <div key={row.id} className="px-4 py-4">
            <p className="text-sm font-semibold text-primary">{formatDate(row.date)}</p>
            <p className="text-xs text-neutral-700">{row.description}</p>
            <p className="text-xs text-neutral-700">Entrada: {row.amountIn ? formatCurrency(row.amountIn) : "-"}</p>
            <p className="text-xs text-neutral-700">Saida: {row.amountOut ? formatCurrency(row.amountOut) : "-"}</p>
            <p className="mt-1 text-sm font-semibold text-primary">Saldo: {formatCurrency(row.balance)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
