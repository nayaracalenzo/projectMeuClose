import { memo, useEffect, useState } from "react";
import CustomerModal from "./CustomerModal";
import CustomerRecordsTable from "./CustomerRecordsTable";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

type ReceivablesFilter =
  | "A_RECEBER"
  | "ATRASADAS"
  | "VENCE_HOJE"
  | "A_VENCER"
  | "RECEBIDAS"
  | "TODAS";

type ReceivableRow = {
  parcela: string;
  vencimento: string;
  status: string;
  forma: string;
  valor: string;
  recebido: string;
  saldo: string;
  filter: ReceivablesFilter;
};

type ReceivableApiRow = {
  parcela: string;
  dueDate: string;
  filter: ReceivablesFilter;
  paymentTypeName: string | null;
  amount: number;
  paidAmount: number;
  openAmount: number;
};

type ReceivablesResponse = {
  items: ReceivableApiRow[];
};

const filterOptions: Array<{ value: ReceivablesFilter; label: string }> = [
  { value: "A_RECEBER", label: "A Receber" },
  { value: "ATRASADAS", label: "Atrasadas" },
  { value: "VENCE_HOJE", label: "Vence Hoje" },
  { value: "A_VENCER", label: "A Vencer" },
  { value: "RECEBIDAS", label: "Recebidas" },
  { value: "TODAS", label: "Todas" },
];

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

const getStatusLabel = (filter: ReceivablesFilter) => {
  if (filter === "RECEBIDAS") return "Recebida";
  if (filter === "ATRASADAS") return "Atrasada";
  if (filter === "VENCE_HOJE") return "Vence hoje";
  if (filter === "A_VENCER") return "A vencer";
  return "A receber";
};

function CustomerReceivablesModalComponent({ open, clientId, clientName, onClose }: Props) {
  const [filter, setFilter] = useState<ReceivablesFilter>("A_RECEBER");
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !clientId) return;

    const fetchReceivables = async () => {
      try {
        setLoading(true);
        setMessage("");

        const params = new URLSearchParams({
          status: filter,
          page: "1",
          pageSize: "100",
          customerId: String(clientId),
        });

        const data = (await getRequest(`/receivables?${params.toString()}`)) as ReceivablesResponse;
        setRows(
          Array.isArray(data.items)
            ? data.items.map((item) => ({
                parcela: item.parcela || "-",
                vencimento: formatDate(item.dueDate),
                status: getStatusLabel(item.filter),
                forma: item.paymentTypeName || "-",
                valor: formatCurrency(Number(item.amount || 0)),
                recebido: formatCurrency(Number(item.paidAmount || 0)),
                saldo: formatCurrency(Number(item.openAmount || 0)),
                filter: item.filter,
              }))
            : [],
        );
      } catch (error: unknown) {
        setRows([]);
        setMessage(
          getUserFacingApiErrorMessage(error, "Nao foi possivel carregar os recebimentos."),
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchReceivables();
  }, [clientId, filter, open]);

  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      title="A Receber do Cliente"
      subtitle={`Cliente: ${clientName}`}
    >
      {message ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
          {message}
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-semibold text-primary">Visao</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ReceivablesFilter)}
          className="h-10 rounded border border-outline-variant/50 bg-white px-3 text-sm text-primary"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <CustomerRecordsTable
        columns={[
          { key: "parcela", label: "Parcela" },
          { key: "vencimento", label: "Vencimento" },
          { key: "status", label: "Status" },
          { key: "forma", label: "Forma pagto" },
          { key: "valor", label: "Valor", align: "right" },
          { key: "recebido", label: "Valor recebido", align: "right" },
          { key: "saldo", label: "Saldo", align: "right" },
        ]}
        rows={rows}
        emptyMessage={
          loading
            ? "Carregando recebimentos..."
            : "Nenhum titulo a receber cadastrado para este cliente."
        }
      />
    </CustomerModal>
  );
}

const CustomerReceivablesModal = memo(CustomerReceivablesModalComponent);

export default CustomerReceivablesModal;
