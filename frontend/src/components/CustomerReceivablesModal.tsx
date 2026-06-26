import { memo, useMemo, useState } from "react";
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

const mockRows: ReceivableRow[] = [
  { parcela: "001/003", vencimento: "10/05/2026", status: "A Receber", forma: "Carnê", valor: "R$ 180,00", recebido: "R$ 0,00", saldo: "R$ 180,00", filter: "A_RECEBER" },
  { parcela: "002/003", vencimento: "18/05/2026", status: "Vencido Hoje", forma: "Carnê", valor: "R$ 180,00", recebido: "R$ 0,00", saldo: "R$ 180,00", filter: "VENCIDO_HOJE" },
  { parcela: "003/003", vencimento: "10/06/2026", status: "A Vencer", forma: "Carnê", valor: "R$ 180,00", recebido: "R$ 0,00", saldo: "R$ 180,00", filter: "A_VENCER" },
  { parcela: "001/001", vencimento: "02/05/2026", status: "Recebida", forma: "Pix", valor: "R$ 220,00", recebido: "R$ 220,00", saldo: "R$ 0,00", filter: "RECEBIDAS" },
  { parcela: "001/002", vencimento: "08/05/2026", status: "Atrasada", forma: "Cartão", valor: "R$ 95,00", recebido: "R$ 0,00", saldo: "R$ 95,00", filter: "ATRASADAS" },
];

type Props = {
  open: boolean;
  clientName: string;
  onClose: () => void;
};

function CustomerReceivablesModalComponent({ open, clientName, onClose }: Props) {
  const [filter, setFilter] = useState<ReceivablesFilter>("A_RECEBER");

  const rows = useMemo(() => {
    if (filter === "TODAS") return mockRows;
    return mockRows.filter((row) => row.filter === filter);
  }, [filter]);

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
      />
    </CustomerModal>
  );
}

const CustomerReceivablesModal = memo(CustomerReceivablesModalComponent);

export default CustomerReceivablesModal;
