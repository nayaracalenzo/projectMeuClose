import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { getCategoryBadgeClassName } from "../utils/categoryBadge";
import { formatCurrency } from "../utils/currency";

type Scope = "LOJA" | "PESSOAL";

interface BankRow {
  id: number;
  date: string;
  bank: string;
  parcela?: string;
  category: string;
  description: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  amount?: number;
  movement?: string;
}

interface BankListResponse {
  items: BankRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalIn: number;
    totalOut: number;
    balance: number;
  };
}

const PAGE_SIZE = 10;

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(dateString));

const getEntryAmount = (row: BankRow) => {
  if (typeof row.amountIn === "number") return row.amountIn;
  return row.movement === "ENTRADA" ? Number(row.amount || 0) : 0;
};

const getExitAmount = (row: BankRow) => {
  if (typeof row.amountOut === "number") return row.amountOut;
  return row.movement === "SAIDA" ? Number(row.amount || 0) : 0;
};

export default function BankPage() {
  const [scope, setScope] = useState<Scope>("LOJA");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<BankRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [scope, search, startDate, endDate]);

  useEffect(() => {
    if (selectedRowId && !rows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(null);
    }
  }, [rows, selectedRowId]);

  const handleSelectRow = (rowId: number) => {
    setSelectedRowId((current) => (current === rowId ? null : rowId));
  };

  useEffect(() => {
    const fetchRows = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          scope,
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (search.trim()) params.set("search", search.trim());
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const data = (await getRequest(`/bank?${params.toString()}`)) as BankListResponse;
        setRows(Array.isArray(data.items) ? data.items : []);
        setTotalRows(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
        setSummary({
          totalIn: Number(data.summary?.totalIn || 0),
          totalOut: Number(data.summary?.totalOut || 0),
          balance: Number(data.summary?.balance || 0),
        });
      } catch (err: unknown) {
        setRows([]);
        setTotalRows(0);
        setTotalPages(1);
        setSummary({ totalIn: 0, totalOut: 0, balance: 0 });
        setError(getUserFacingApiErrorMessage(err, "Não foi possível carregar o banco."));
      } finally {
        setLoading(false);
      }
    };

    fetchRows();
  }, [endDate, page, scope, search, startDate]);

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <h1 className="mb-5 pb-6 pt-12 text-6xl font-semibold text-primary md:text-4xl">Banco</h1>

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

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Entradas</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(summary.totalIn)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saídas</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(summary.totalOut)}</p>
        </div>
        <div className="bg-surface-lowest p-4">
          <p className="text-xs uppercase text-neutral-700">Saldo</p>
          <p className="text-lg font-semibold text-primary">{formatCurrency(summary.balance)}</p>
        </div>
      </div>

      <p className="mb-3 text-sm text-neutral-700">
        {loading ? "Carregando movimentações..." : `${totalRows} movimentação(ões) encontrada(s).`}
      </p>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="w-12 px-4 pt-2" aria-label="Selecionar registro" />
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Parcela</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Categoria</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Descrição</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Entrada</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Sai­da</th>
              <th className="px-4 pt-2 text-right font-editorial text-[1.6rem] text-primary">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700">
                  Carregando movimentações...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700">
                  Nenhuma movimentação bancária cadastrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => handleSelectRow(row.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedRowId === row.id
                      ? "bg-surface"
                      : "bg-surface-lowest hover:bg-surface"
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedRowId === row.id}
                      onChange={() => handleSelectRow(row.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Selecionar movimentação bancária ${row.description}`}
                      className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60 accent-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.parcela || "-"}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                        row.category,
                      )}`}
                    >
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{row.description}</td>
                  <td className="px-4 py-3 text-right text-[14px] text-[#1f7a1f]">
                    {getEntryAmount(row) ? formatCurrency(getEntryAmount(row)) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] text-[#b42318]">
                    {getExitAmount(row) ? formatCurrency(getExitAmount(row)) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {typeof row.balance === "number" ? formatCurrency(row.balance) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
        {loading ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Carregando movimentações...
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhuma movimentação bancária cadastrada.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="px-4 py-4">
              <p className="text-sm font-semibold text-primary">{formatDate(row.date)}</p>
              <p className="text-xs text-neutral-700">Parcela: {row.parcela || "-"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.08em] ${getCategoryBadgeClassName(
                    row.category,
                  )}`}
                >
                  {row.category}
                </span>
              </div>
              <p className="text-xs text-neutral-700">{row.description}</p>
              <p className="text-xs text-[#1f7a1f]">
                Entrada: {getEntryAmount(row) ? formatCurrency(getEntryAmount(row)) : "-"}
              </p>
              <p className="text-xs text-[#b42318]">
                Sai­da: {getExitAmount(row) ? formatCurrency(getExitAmount(row)) : "-"}
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">
                Saldo: {typeof row.balance === "number" ? formatCurrency(row.balance) : "-"}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          Página {page} de {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || page <= 1}
          >
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || page >= totalPages}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
