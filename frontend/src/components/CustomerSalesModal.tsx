import { memo, useEffect, useState } from "react";
import CustomerModal from "./CustomerModal";
import CustomerRecordsTable from "./CustomerRecordsTable";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

type SaleRow = {
  cod: string;
  data: string;
  cliente: string;
  usuario: string;
  formaPagto: string;
  valorVista: string;
  valorPrazo: string;
  totalVenda: string;
  descProd: string;
  descSubtotal: string;
};

type SalesApiRow = {
  id: number;
  customerName: string;
  paymentTypeName: string | null;
  finalAmount: number;
  createdAt: string;
  firstItemDescription: string | null;
  itemsCount: number;
};

type SalesResponse = {
  items: SalesApiRow[];
};

type Props = {
  open: boolean;
  clientId: number | null;
  clientName: string;
  onClose: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
};

function CustomerSalesModalComponent({ open, clientId, clientName, onClose }: Props) {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !clientId) return;

    const fetchSales = async () => {
      try {
        setLoading(true);
        setMessage("");

        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
          customerId: String(clientId),
        });

        const data = (await getRequest(`/sales?${params.toString()}`)) as SalesResponse;
        setRows(
          Array.isArray(data.items)
            ? data.items.map((item) => ({
                cod: `#${item.id}`,
                data: formatDate(item.createdAt),
                cliente: item.customerName || "-",
                usuario: "-",
                formaPagto: item.paymentTypeName || "-",
                valorVista: "-",
                valorPrazo: "-",
                totalVenda: formatCurrency(Number(item.finalAmount || 0)),
                descProd:
                  item.itemsCount > 1
                    ? `${item.firstItemDescription || "Sem item"} +${item.itemsCount - 1}`
                    : item.firstItemDescription || "-",
                descSubtotal: String(item.itemsCount || 0),
              }))
            : [],
        );
      } catch (error: unknown) {
        setRows([]);
        setMessage(getUserFacingApiErrorMessage(error, "Nao foi possivel carregar as vendas."));
      } finally {
        setLoading(false);
      }
    };

    void fetchSales();
  }, [clientId, open]);

  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      title="Vendas do Cliente"
      subtitle={`Cliente: ${clientName}`}
    >
      {message ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
          {message}
        </div>
      ) : null}

      <CustomerRecordsTable
        columns={[
          { key: "cod", label: "Cod." },
          { key: "data", label: "Data" },
          { key: "cliente", label: "Cliente" },
          { key: "usuario", label: "Usuario" },
          { key: "formaPagto", label: "Forma pagto" },
          { key: "valorVista", label: "Valor a vista", align: "right" },
          { key: "valorPrazo", label: "Valor a prazo", align: "right" },
          { key: "totalVenda", label: "Total venda", align: "right" },
          { key: "descProd", label: "Desc. prod.", align: "right" },
          { key: "descSubtotal", label: "Qtd. itens", align: "right" },
        ]}
        rows={rows}
        emptyMessage={
          loading ? "Carregando vendas..." : "Nenhuma venda cadastrada para este cliente."
        }
      />
    </CustomerModal>
  );
}

const CustomerSalesModal = memo(CustomerSalesModalComponent);

export default CustomerSalesModal;
