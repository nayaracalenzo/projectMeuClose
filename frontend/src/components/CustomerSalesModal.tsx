import { memo, useEffect, useMemo, useState } from "react";
import CustomerModal from "./CustomerModal";
import { Button } from "./Button";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

type SaleListRow = {
  id: number;
  customerName: string;
  paymentTypeName: string | null;
  finalAmount: number;
  createdAt: string;
};

type SalesResponse = {
  items: SaleListRow[];
};

type SaleDetailItem = {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
};

type SaleReceipt = {
  id: number;
  receiptType: "ENTRY" | "SALE_FULL" | "INSTALLMENT" | "CUSTOMER_CREDIT";
  amount: number;
};

type SaleDetailsResponse = {
  id: number;
  customer: {
    id: number;
    name: string;
  } | null;
  user: {
    id: number;
    name: string;
  } | null;
  paymentType: {
    id: number;
    name: string;
  } | null;
  discountValue: number | null;
  totalAmount: number;
  finalAmount: number;
  createdAt: string;
  items: SaleDetailItem[];
  receipts: SaleReceipt[];
  receivable: {
    originalAmount: number;
  } | null;
};

type SaleRow = {
  id: number;
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
  details: SaleDetailsResponse;
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

const normalizeText = (value?: string | null, fallback = "-") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const sumImmediateReceipts = (receipts: SaleReceipt[] = []) =>
  receipts.reduce((acc, receipt) => {
    if (receipt.receiptType === "INSTALLMENT") {
      return acc;
    }

    return acc + Number(receipt.amount || 0);
  }, 0);

const sumItemDiscounts = (items: SaleDetailItem[] = []) =>
  items.reduce((acc, item) => acc + Number(item.discountAmount || 0), 0);

function CustomerSalesModalComponent({
  open,
  clientId,
  clientName,
  onClose,
}: Props) {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;

    const fetchSales = async () => {
      try {
        setLoading(true);
        setMessage("");
        setSelectedSaleId(null);
        setShowItems(false);

        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
          customerId: String(clientId),
        });

        const data = (await getRequest(`/sales?${params.toString()}`)) as SalesResponse;
        const items = Array.isArray(data.items) ? data.items : [];
        const detailsList = await Promise.all(
          items.map(async (item) => {
            const details = (await getRequest(
              `/sales/${item.id}`,
            )) as SaleDetailsResponse;

            const valorVista = sumImmediateReceipts(details.receipts || []);
            const valorPrazo = Number(details.receivable?.originalAmount || 0);
            const itemDiscounts = sumItemDiscounts(details.items || []);

            return {
              id: item.id,
              cod: String(item.id),
              data: formatDate(details.createdAt || item.createdAt),
              cliente: normalizeText(
                details.customer?.name || item.customerName,
                "CLIENTE",
              ),
              usuario: normalizeText(details.user?.name, "-"),
              formaPagto: normalizeText(
                details.paymentType?.name || item.paymentTypeName,
                "-",
              ),
              valorVista: formatCurrency(valorVista),
              valorPrazo: formatCurrency(valorPrazo),
              totalVenda: formatCurrency(Number(details.finalAmount || item.finalAmount || 0)),
              descProd: formatCurrency(itemDiscounts),
              descSubtotal: formatCurrency(Number(details.discountValue || 0)),
              details,
            } satisfies SaleRow;
          }),
        );

        setRows(detailsList);
      } catch (error: unknown) {
        setRows([]);
        setMessage(
          getUserFacingApiErrorMessage(
            error,
            "Nao foi possivel carregar as vendas.",
          ),
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchSales();
  }, [clientId, open]);

  const selectedSale = useMemo(
    () => rows.find((row) => row.id === selectedSaleId) || null,
    [rows, selectedSaleId],
  );

  const handleSelectSale = (saleId: number) => {
    setSelectedSaleId((current) => (current === saleId ? null : saleId));
    setShowItems(false);
  };

  return (
    <CustomerModal
      open={open}
      onClose={onClose}
      title="Vendas do Cliente"
      subtitle={`Cliente: ${clientName}`}
      size="lg"
    >
      {message ? (
        <div className="mb-4 rounded border border-[#c76767] bg-[#fdecec] px-3 py-2 text-sm text-[#7a1717]">
          {message}
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="md"
          disabled={!selectedSale}
          onClick={() => setShowItems((current) => !current)}
        >
          {showItems ? "Ocultar itens" : "Ver itens da venda"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-separate border-spacing-y-2">
          <thead className="rounded-t-md bg-[#dbd1d1]">
            <tr className="text-left">
              <th className="px-2 pt-2 text-center text-sm font-semibold text-primary">
                &nbsp;
              </th>
              <th className="px-3 pt-2 text-sm font-semibold text-primary">Cód.</th>
              <th className="px-3 pt-2 text-sm font-semibold text-primary">Data</th>
              <th className="px-3 pt-2 text-sm font-semibold text-primary">Cliente</th>
              <th className="px-3 pt-2 text-sm font-semibold text-primary">Usuário</th>
              <th className="px-3 pt-2 text-sm font-semibold text-primary">Forma pgto</th>
              <th className="px-3 pt-2 text-right text-sm font-semibold text-primary">Valor à vista</th>
              <th className="px-3 pt-2 text-right text-sm font-semibold text-primary">Valor à prazo</th>
              <th className="px-3 pt-2 text-right text-sm font-semibold text-primary">Total venda</th>
              <th className="px-3 pt-2 text-right text-sm font-semibold text-primary">Desc. prod.</th>
              <th className="px-3 pt-2 text-right text-sm font-semibold text-primary">Desc. subtotal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="bg-surface-lowest">
                <td
                  colSpan={11}
                  className="px-3 py-6 text-center text-sm text-neutral-700"
                >
                  {loading
                    ? "Carregando vendas..."
                    : "Nenhuma venda cadastrada para este cliente."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = row.id === selectedSaleId;

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isSelected ? "bg-secondary/35" : "bg-surface-lowest hover:bg-surface"
                    }`}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectSale(row.id)}
                        className="h-4 w-4 cursor-pointer rounded border border-outline-variant/60"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-neutral-700">{row.cod}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700">{row.data}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700">{row.cliente}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700">{row.usuario}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700">{row.formaPagto}</td>
                    <td className="px-3 py-2 text-right text-sm text-neutral-700">{row.valorVista}</td>
                    <td className="px-3 py-2 text-right text-sm text-neutral-700">{row.valorPrazo}</td>
                    <td className="px-3 py-2 text-right text-sm text-neutral-700">{row.totalVenda}</td>
                    <td className="px-3 py-2 text-right text-sm text-neutral-700">{row.descProd}</td>
                    <td className="px-3 py-2 text-right text-sm text-neutral-700">{row.descSubtotal}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showItems && selectedSale ? (
        <div className="mt-5 rounded-xl border border-outline-variant/35 bg-surface-lowest p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-primary">
              Itens da venda {selectedSale.cod}
            </h3>
            <p className="text-sm text-neutral-700">
              Total de itens: {selectedSale.details.items.length}
            </p>
          </div>

          <div className="space-y-3">
            {selectedSale.details.items.length === 0 ? (
              <p className="text-sm text-neutral-700">
                Nenhum item cadastrado nesta venda.
              </p>
            ) : (
              selectedSale.details.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-outline-variant/35 bg-white px-4 py-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-semibold text-primary">
                      {item.description || "Sem descrição"}
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      {formatCurrency(Number(item.subtotal || 0))}
                    </p>
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-4">
                    <p>Qtd.: {Number(item.quantity || 0)}</p>
                    <p>Unitário: {formatCurrency(Number(item.unitPrice || 0))}</p>
                    <p>Desc.: {formatCurrency(Number(item.discountAmount || 0))}</p>
                    <p>Subtotal: {formatCurrency(Number(item.subtotal || 0))}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </CustomerModal>
  );
}

const CustomerSalesModal = memo(CustomerSalesModalComponent);

export default CustomerSalesModal;
