import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "../components/Button";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

interface ProductOrderRow {
  id: number;
  saleId: number;
  customer: string;
  productType: string | null;
  clothingType: string | null;
  seamstress: string | null;
  status: string | null;
  finalValue: number;
  testDate: string | null;
  createdAt: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
};

const formatType = (row: ProductOrderRow) => {
  return row.clothingType || row.productType || "-";
};

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ProductOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getRequest("/products");
        setOrders(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        setError(getUserFacingApiErrorMessage(err));
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const pendingCount = useMemo(
    () => orders.filter((order) => String(order.status || "").toLowerCase() !== "entregue").length,
    [orders],
  );

  return (
    <div className="w-full min-h-full min-w-0 bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mb-5 flex justify-center gap-4 md:justify-between">
        <div>
          <h1 className="pb-2 pt-12 text-6xl font-semibold text-primary md:text-4xl">
            Pedidos
          </h1>
          <p className="text-sm text-neutral-700">
            {loading
              ? "Carregando pedidos..."
              : `${pendingCount} pedido(s) carregado(s) da base.`}
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
          <Button variant="secondary" size="md" className="px-5" disabled>
            <span className="flex items-center gap-2">
              <Printer size={16} />
              PDF da semana
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex md:hidden">
        <Button variant="secondary" size="md" className="w-full" disabled>
          <span className="flex items-center justify-center gap-2">
            <Printer size={16} />
            Gerar PDF da semana
          </span>
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
          {error}
        </div>
      ) : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-2 w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left">
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Pedido</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Cliente</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Tipo</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Data Prova
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">
                Costureira
              </th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary">Status</th>
              <th className="px-4 pt-2 font-editorial text-[1.6rem] text-primary text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Carregando pedidos...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="bg-surface-lowest px-4 py-6 text-center text-sm text-neutral-700"
                >
                  Nenhum pedido cadastrado
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="bg-surface-lowest transition-colors hover:bg-surface"
                >
                  <td className="px-4 py-3 text-[14px] font-semibold text-primary">
                    #{order.saleId}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{order.customer}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">{formatType(order)}</td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {formatDate(order.testDate)}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {order.seamstress || "-"}
                  </td>
                  <td className="px-4 py-3 text-[14px] text-neutral-700">
                    {order.status || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-[14px] font-semibold text-primary">
                    {formatCurrency(order.finalValue)}
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
            Carregando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-700">
            Nenhum pedido cadastrado
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="px-4 py-4">
              <p className="text-sm font-semibold text-primary">
                #{order.saleId} - {order.customer}
              </p>
              <p className="text-xs text-neutral-700">Tipo: {formatType(order)}</p>
              <p className="text-xs text-neutral-700">
                Data Prova: {formatDate(order.testDate)}
              </p>
              <p className="text-xs text-neutral-700">
                Costureira: {order.seamstress || "-"}
              </p>
              <p className="text-xs text-neutral-700">Status: {order.status || "-"}</p>
              <p className="mt-1 text-sm font-semibold text-primary">
                {formatCurrency(order.finalValue)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
