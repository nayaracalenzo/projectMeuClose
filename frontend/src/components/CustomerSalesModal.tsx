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

const mockSales: SaleRow[] = [
  {
    cod: "8894",
    data: "01/04/2019",
    cliente: "Acelino Ponte",
    usuario: "Lia",
    formaPagto: "Carnê",
    valorVista: "R$ 185,00",
    valorPrazo: "R$ 180,00",
    totalVenda: "R$ 365,00",
    descProd: "R$ 0,00",
    descSubtotal: "R$ 0,00",
  },
  {
    cod: "9120",
    data: "12/05/2026",
    cliente: "Acelino Ponte",
    usuario: "Rosana",
    formaPagto: "Cartão",
    valorVista: "R$ 120,00",
    valorPrazo: "R$ 250,00",
    totalVenda: "R$ 370,00",
    descProd: "R$ 10,00",
    descSubtotal: "R$ 5,00",
  },
];

type Props = {
  open: boolean;
  clientName: string;
  onClose: () => void;
};

function CustomerSalesModalComponent({ open, clientName, onClose }: Props) {
  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      title="Vendas do Cliente"
      subtitle={`Cliente: ${clientName}`}
    >
      <CustomerRecordsTable
        columns={[
          { key: "cod", label: "Cód." },
          { key: "data", label: "Data" },
          { key: "cliente", label: "Cliente" },
          { key: "usuario", label: "Usuário" },
          { key: "formaPagto", label: "Forma pagto" },
          { key: "valorVista", label: "Valor à vista", align: "right" },
          { key: "valorPrazo", label: "Valor à prazo", align: "right" },
          { key: "totalVenda", label: "Total venda", align: "right" },
          { key: "descProd", label: "Desc. prod.", align: "right" },
          { key: "descSubtotal", label: "Desc. subtotal", align: "right" },
        ]}
        rows={mockSales}
      />
    </CustomerModal>
  );
}

const CustomerSalesModal = memo(CustomerSalesModalComponent);

export default CustomerSalesModal;
