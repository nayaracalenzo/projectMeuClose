import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Printer } from "lucide-react";
import { Button } from "../components/Button";
import {
  downloadWeeklyOrdersPdf,
  type PrintableOrder,
} from "../utils/ordersWeeklyPdf";

type OrderStatus = "ABERTO" | "EM PRODUCAO" | "FINALIZADO" | "ENTREGUE";
type OrderKind = "ENCOMENDA" | "PECA PRONTA" | "AJUSTE";
type OrderSort = "LAST_CREATED" | "OLDEST_CREATED";

interface OrderRow extends PrintableOrder {
  kind: OrderKind;
  status: OrderStatus;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat("pt-BR").format(new Date(`${dateString}T00:00:00`));

const toIsoDate = (daysFromToday: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
};

const startOfWeek = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diff);
  return normalized;
};

const endOfWeek = (date: Date) => {
  const end = startOfWeek(date);
  end.setDate(end.getDate() + 6);
  return end;
};

const isDateInCurrentWeek = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  const start = startOfWeek(new Date());
  const end = endOfWeek(new Date());
  return date >= start && date <= end;
};

const buildWeekLabel = () => {
  const start = startOfWeek(new Date());
  const end = endOfWeek(new Date());
  const formatter = new Intl.DateTimeFormat("pt-BR");
  return `${formatter.format(start)} a ${formatter.format(end)}`;
};

const isPrintableWeeklyOrder = (order: OrderRow) => {
  if (order.status === "ENTREGUE") {
    return false;
  }

  if (order.status === "FINALIZADO" && order.kind === "PECA PRONTA") {
    return false;
  }

  return true;
};

const mockOrders: OrderRow[] = [
  {
    id: 1024,
    customer: "Ana Paula Santos",
    kind: "ENCOMENDA",
    date: toIsoDate(-4),
    status: "EM PRODUCAO",
    total: 420,
    items: [
      {
        name: "Vestido midi evasê",
        quantity: 1,
        fabric: "Linho misto",
        color: "Terracota",
        size: "M",
        notes: "Decote quadrado e manga bufante",
      },
      {
        name: "Cinto encapado",
        quantity: 1,
        fabric: "Mesmo tecido do vestido",
        color: "Terracota",
        size: "Unico",
        notes: "Fivela dourada",
      },
    ],
  },
  {
    id: 1025,
    customer: "Camila Rocha",
    kind: "AJUSTE",
    date: toIsoDate(-3),
    status: "ABERTO",
    total: 90,
    items: [
      {
        name: "Calca de alfaiataria",
        quantity: 1,
        fabric: "Crepe estruturado",
        color: "Preto",
        size: "40",
        notes: "Ajustar barra e cintura",
      },
    ],
  },
  {
    id: 1026,
    customer: "Boutique Bella",
    kind: "PECA PRONTA",
    date: toIsoDate(-2),
    status: "FINALIZADO",
    total: 180,
    items: [
      {
        name: "Camisa feminina",
        quantity: 2,
        fabric: "Tricoline",
        color: "Off-white",
        size: "P e M",
        notes: "Botoes perolados",
      },
    ],
  },
  {
    id: 1027,
    customer: "Luana M. Souza",
    kind: "ENCOMENDA",
    date: toIsoDate(-1),
    status: "ENTREGUE",
    total: 350,
    items: [
      {
        name: "Conjunto cropped + saia",
        quantity: 1,
        fabric: "Viscolinho",
        color: "Verde sage",
        size: "M",
        notes: "Saia com forro e ziper invisivel",
      },
    ],
  },
  {
    id: 1028,
    customer: "Marta Ferreira",
    kind: "ENCOMENDA",
    date: toIsoDate(1),
    status: "ABERTO",
    total: 510,
    items: [
      {
        name: "Blazer acinturado",
        quantity: 1,
        fabric: "Sarja premium",
        color: "Areia",
        size: "G",
        notes: "Forro interno acetinado",
      },
      {
        name: "Calca reta",
        quantity: 1,
        fabric: "Sarja premium",
        color: "Areia",
        size: "G",
        notes: "Cintura alta",
      },
    ],
  },
  {
    id: 1029,
    customer: "Helena Costa",
    kind: "AJUSTE",
    date: toIsoDate(-10),
    status: "EM PRODUCAO",
    total: 120,
    items: [
      {
        name: "Vestido de festa",
        quantity: 1,
        fabric: "Tule bordado",
        color: "Azul marinho",
        size: "38",
        notes: "Ajustar busto e comprimento",
      },
    ],
  },
];

export default function Orders() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<"TODOS" | OrderKind>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<"TODOS" | OrderStatus>("TODOS");
  const [sortBy, setSortBy] = useState<OrderSort>("LAST_CREATED");
  const [currentPage, setCurrentPage] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pageSize = 5;

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = mockOrders.filter((item) => {
      const matchesSearch =
        !term || item.customer.toLowerCase().includes(term) || String(item.id).includes(term);
      const matchesKind = selectedKind === "TODOS" || item.kind === selectedKind;
      const matchesStatus = selectedStatus === "TODOS" || item.status === selectedStatus;
      return matchesSearch && matchesKind && matchesStatus;
    });

    rows.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "LAST_CREATED") return dateDiff;
      return -dateDiff;
    });

    return rows;
  }, [search, selectedKind, selectedStatus, sortBy]);

  const weeklyOrders = useMemo(() => {
    return filteredOrders.filter(
      (order) => isDateInCurrentWeek(order.date) && isPrintableWeeklyOrder(order),
    );
  }, [filteredOrders]);

  const weekLabel = useMemo(() => buildWeekLabel(), []);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

  const handleGenerateWeeklyPdf = async () => {
    if (!weeklyOrders.length) {
      return;
    }

    try {
      setIsGeneratingPdf(true);
      await downloadWeeklyOrdersPdf({
        orders: weeklyOrders,
        logoUrl: "/manequim.png",
        weekLabel,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF semanal de pedidos", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex justify-center gap-4 md:justify-between">
        <div>
          <h1 className="pb-2 pt-12 text-6xl font-semibold text-primary md:text-4xl">
            Pedidos
          </h1>
          <p className="text-sm text-neutral-700">
            {weeklyOrders.length} pedido(s) pendente(s) desta semana em {weekLabel}
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
           <Button
                            variant="primary"
                            size="md"
                            className="px-5"
                            onClick={() => navigate("/nova-venda")}
                          >
                            + Novo Pedido
                          </Button>
          <Button
            variant="secondary"
            size="md"
            className="px-5"
            onClick={handleGenerateWeeklyPdf}
            disabled={!weeklyOrders.length}
            isLoading={isGeneratingPdf}
          >
            <span className="flex items-center gap-2">
              <Printer size={16} />
              PDF da semana
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex md:hidden">
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={handleGenerateWeeklyPdf}
          disabled={!weeklyOrders.length}
          isLoading={isGeneratingPdf}
        >
          <span className="flex items-center justify-center gap-2">
            <Printer size={16} />
            Gerar PDF da semana
          </span>
        </Button>
      </div>

      <div className="mb-5 flex w-full flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">
            Cliente ou no. pedido
          </label>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Ex.: Ana, 1024"
            className="h-11 w-full rounded border border-gray-800 bg-white px-4 text-[15px] text-primary md:border-outline-variant/50"
          />
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">Tipo</label>
          <select
            value={selectedKind}
            onChange={(e) => {
              setSelectedKind(e.target.value as "TODOS" | OrderKind);
              setCurrentPage(1);
            }}
            className="h-11 w-full rounded border border-gray-800 bg-white px-3 text-[15px] text-primary md:border-outline-variant/50"
          >
            <option value="TODOS">Todos</option>
            <option value="ENCOMENDA">Encomenda</option>
            <option value="PECA PRONTA">Peca pronta</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as "TODOS" | OrderStatus);
              setCurrentPage(1);
            }}
            className="h-11 w-full rounded border border-gray-800 bg-white px-3 text-[15px] text-primary md:border-outline-variant/50"
          >
            <option value="TODOS">Todos</option>
            <option value="ABERTO">Aberto</option>
            <option value="EM PRODUCAO">Em producao</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="ENTREGUE">Entregue</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-2 block text-sm font-semibold text-primary">Ordenacao</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as OrderSort);
              setCurrentPage(1);
            }}
            className="h-11 w-full rounded border border-gray-800 bg-white px-3 text-[15px] text-primary md:border-outline-variant/50"
          >
            <option value="LAST_CREATED">Mais recentes</option>
            <option value="OLDEST_CREATED">Mais antigos</option>
          </select>
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Pedido</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Cliente</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Tipo</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Data</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer bg-surface-lowest transition-colors hover:bg-surface"
                onClick={() => navigate(`/pedido/${order.id}`)}
              >
                <td className="px-4 py-3 text-[14px] font-semibold text-primary">#{order.id}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{order.customer}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{order.kind}</td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">
                  {formatDate(order.date)}
                </td>
                <td className="px-4 py-3 text-[14px] text-neutral-700">{order.status}</td>
                <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                  {formatCurrency(order.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 w-full min-w-0 divide-y divide-outline-variant/35 bg-white md:hidden">
        {paginatedOrders.map((order) => (
          <div
            key={order.id}
            className="flex w-full items-center justify-between px-4 py-6"
            onClick={() => navigate(`/pedido/${order.id}`)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">
                #{order.id} - {order.customer}
              </p>
              <p className="text-xs text-neutral-700">
                {order.kind} - {order.status}
              </p>
              <p className="text-xs text-neutral-700">{formatDate(order.date)}</p>
              <p className="mt-2 text-sm font-semibold text-primary">
                {formatCurrency(order.total)}
              </p>
            </div>
            <ChevronRight size={16} className="ml-2 text-neutral-700" />
          </div>
        ))}
      </div>

      <div className="mt-4 hidden items-center justify-between md:flex">
        <p className="text-[13px] tracking-[0.04em] text-neutral-700">
          Exibindo {filteredOrders.length === 0 ? 0 : startIndex + 1}-
          {Math.min(startIndex + pageSize, filteredOrders.length)} de {filteredOrders.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            Anterior
          </Button>
          <span className="px-2 text-sm text-primary">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Proxima
          </Button>
        </div>
      </div>
    </div>
  );
}
