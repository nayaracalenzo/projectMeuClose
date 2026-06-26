import { useMemo, useState } from "react";
import { formatCurrency } from "../utils/currency";

type Scope = "LOJA" | "PESSOAL";
type Movement = "ENTRADA" | "SAIDA";

interface BankRow {
  id: number;
  date: string;
  scope: Scope;
  bank: string;
  movement: Movement;
  category: string;
  description: string;
  amount: number;
}

const mockBankRows: BankRow[] = [
  { id: 1, date: "2026-05-02", scope: "LOJA", bank: "Nubank PJ", movement: "ENTRADA", category: "Recebimento", description: "Pix cliente #1021", amount: 780 },
  { id: 2, date: "2026-05-03", scope: "LOJA", bank: "Nubank PJ", movement: "SAIDA", category: "Fornecedor", description: "Compra de tecido", amount: 340 },
  { id: 3, date: "2026-05-04", scope: "PESSOAL", bank: "Itau", movement: "SAIDA", category: "Moradia", description: "Aluguel", amount: 1200 },
  { id: 4, date: "2026-05-05", scope: "PESSOAL", bank: "Itau", movement: "ENTRADA", category: "Transferencia", description: "Pro-labore", amount: 2200 },
  { id: 5, date: "2026-05-08", scope: "LOJA", bank: "Nubank PJ", movement: "ENTRADA", category: "Recebimento", description: "Cartao venda balcao", amount: 520 },
  { id: 6, date: "2026-05-09", scope: "PESSOAL", bank: "Inter", movement: "SAIDA", category: "Saude", description: "Farmacia", amount: 180 },
];

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

const parseLocalDate = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split("-").map(Number);
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

export default function BankPage() {
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return mockBankRows.filter((item) => {
      const byScope = item.scope === scope;
      const itemDate = parseLocalDate(item.date);
      const byStartDate = !startDate || itemDate >= parseLocalDate(startDate);
      const byEndDate = !endDate || itemDate <= parseLocalDate(endDate, true);
      const byTerm =
        !term ||
        item.description.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.bank.toLowerCase().includes(term);
      return byScope && byStartDate && byEndDate && byTerm;
    });
  }, [endDate, scope, search, startDate]);

  const totalIn = rows
    .filter((row) => row.movement === "ENTRADA")
    .reduce((acc, row) => acc + row.amount, 0);

  const totalOut = rows
    .filter((row) => row.movement === "SAIDA")
    .reduce((acc, row) => acc + row.amount, 0);

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
          <label className="mb-2 block text-sm font-semibold text-primary">Buscar movimentacao</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Descricao, categoria ou banco"
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
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Banco</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Tipo</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Categoria</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Descricao</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="bg-surface-lowest transition-colors hover:bg-surface">
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">{formatDate(row.date)}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{row.bank}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{row.movement}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{row.category}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{row.description}</td>
                <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
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
