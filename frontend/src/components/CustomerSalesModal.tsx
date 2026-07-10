import { memo } from "react";
import CustomerModal from "./CustomerModal";
import CustomerRecordsTable from "./CustomerRecordsTable";

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

type Props = {
  open: boolean;
  clientName: string;
  onClose: () => void;
};

function CustomerSalesModalComponent({ open, clientName, onClose }: Props) {
  const rows: SaleRow[] = [];

  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      title="Vendas do Cliente"
      subtitle={`Cliente: ${clientName}`}
    >
      <CustomerRecordsTable
        columns={[
          { key: "cod", label: "Cod." },
          { key: "data", label: "Data" },
          { key: "cliente", label: "Cliente" },
          { key: "usuario", label: "Usuário" },
          { key: "formaPagto", label: "Forma pagto" },
          { key: "valorVista", label: "Valor à vista", align: "right" },
          { key: "valorPrazo", label: "Valor a prazo", align: "right" },
          { key: "totalVenda", label: "Total venda", align: "right" },
          { key: "descProd", label: "Desc. prod.", align: "right" },
          { key: "descSubtotal", label: "Desc. subtotal", align: "right" },
        ]}
        rows={rows}
        emptyMessage="Nenhuma venda cadastrada para este cliente."
      />
    </CustomerModal>
  );
}

const CustomerSalesModal = memo(CustomerSalesModalComponent);

export default CustomerSalesModal;
