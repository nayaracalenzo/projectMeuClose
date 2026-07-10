import { memo, useState } from "react";
import CustomerModal from "./CustomerModal";
import CustomerRecordsTable from "./CustomerRecordsTable";

type ReceivablesFilter =
  | "A_RECEBER"
  | "ATRASADAS"
  | "VENCIDO_HOJE"
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

const filterOptions: Array<{ value: ReceivablesFilter; label: string }> = [
  { value: "A_RECEBER", label: "A Receber" },
  { value: "ATRASADAS", label: "Atrasadas" },
  { value: "VENCIDO_HOJE", label: "Vencido Hoje" },
  { value: "A_VENCER", label: "A Vencer" },
  { value: "RECEBIDAS", label: "Recebidas" },
  { value: "TODAS", label: "Todas" },
];

type Props = {
  open: boolean;
  clientName: string;
  onClose: () => void;
};

function CustomerReceivablesModalComponent({ open, clientName, onClose }: Props) {
  const [filter, setFilter] = useState<ReceivablesFilter>("A_RECEBER");

  const rows: ReceivableRow[] = [];

  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      title="A Receber do Cliente"
      subtitle={`Cliente: ${clientName}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-semibold text-primary">Visão</label>
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
        emptyMessage="Nenhum título a receber cadastrado para este cliente."
      />
    </CustomerModal>
  );
}

const CustomerReceivablesModal = memo(CustomerReceivablesModalComponent);

export default CustomerReceivablesModal;
