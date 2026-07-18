import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { getRequest } from "../services/request";
import { getUserFacingApiErrorMessage } from "../utils/apiError";
import { formatCurrency } from "../utils/currency";

type SaleDetailItem = {
  id: number;
  productId: number | null;
  itemType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  grossAmount: number;
  discountAmount: number;
  subtotal: number;
  metadata: Record<string, unknown> | null;
  productStatus: string | null;
  seamstress: string | null;
  fittingDate: string | null;
};

type SaleReceipt = {
  id: number;
  saleId: number;
  receivableInstallmentId: number | null;
  receiptType: "ENTRY" | "SALE_FULL" | "INSTALLMENT";
  amount: number;
  paidAt: string;
  referenceCode: string | null;
  paymentType: {
    id: number;
    name: string;
  } | null;
};

type SaleInstallment = {
  id: number;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  openAmount: number;
  status: string;
  paymentType: {
    id: number;
    name: string;
  } | null;
};

type SaleDetailsResponse = {
  id: number;
  status: string;
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
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  totalAmount: number;
  finalAmount: number;
  dueDate: string | null;
  installmentCount: number;
  createdAt: string;
  updatedAt: string;
  items: SaleDetailItem[];
  receipts: SaleReceipt[];
  measurementsCount: number;
  receivable: {
    id: number;
    debtorType: string;
    operatorLabel: string | null;
    supplierId: number | null;
    supplierName: string | null;
    originType: "CUSTOMER" | "SUPPLIER" | "CARD_OPERATOR";
    originLabel: string;
    originName: string;
    originalAmount: number;
    openAmount: number;
    status: string;
    installments: SaleInstallment[];
  } | null;
  cardTransaction: {
    id: number;
    operatorLabel: string | null;
    cardBrand: string | null;
    authorizationCode: string | null;
    clientInstallmentCount: number;
    grossAmount: number;
    entryAmount: number;
    netReceivableAmount: number;
    feeAmount: number;
    expectedSettlementDate: string | null;
    settlementStatus: string;
  } | null;
};

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/35 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.12em] text-neutral-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-primary">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatItemDiscount(item: SaleDetailItem) {
  if (!item.discountType || !item.discountValue || item.discountAmount <= 0) {
    return item.discountAmount > 0 ? formatCurrency(item.discountAmount) : "Sem desconto";
  }

  if (item.discountType === "PERCENTAGE") {
    return `${item.discountValue.toFixed(2)}% (${formatCurrency(item.discountAmount)})`;
  }

  return formatCurrency(item.discountValue);
}

function formatReceiptType(receiptType: SaleReceipt["receiptType"]) {
  if (receiptType === "ENTRY") return "Entrada";
  if (receiptType === "SALE_FULL") return "Venda à vista";
  return "Parcela";
}

function formatSaleStatus(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BUDGET") return "Orçamento";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "CANCELLED") return "Cancelado";
  return value || "-";
}

function formatSaleItemType(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "CUSTOM_MADE") return "Sob medida";
  if (normalized === "READY_MADE") return "Roupa pronta";
  if (normalized === "ACCESSORY") return "AcessÃ³rio";
  if (normalized === "SERVICE") return "ServiÃ§o";
  if (normalized === "MISC") return "Diversos";
  return value || "-";
}

function isProductionItem(item?: SaleDetailItem | null) {
  if (!item?.productId) return false;
  return item.itemType === "CUSTOM_MADE" || item.itemType === "SERVICE";
}

export default function SaleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sale, setSale] = useState<SaleDetailsResponse | null>(null);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        setLoading(true);
        setError("");
        const data = (await getRequest(`/sales/${id}`)) as SaleDetailsResponse;
        setSale(data);
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { status?: number } };

        if (maybeAxiosError.response?.status === 404) {
          setError("Venda não encontrada.");
        } else {
          setError(getUserFacingApiErrorMessage(err, "Não foi possível carregar a venda."));
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSale();
  }, [id]);

  const totalItemDiscount = useMemo(() => {
    if (!sale) return 0;
    return Number(sale.items.reduce((acc, item) => acc + item.discountAmount, 0).toFixed(2));
  }, [sale]);

  const totalReceived = useMemo(() => {
    if (!sale) return 0;
    return Number(sale.receipts.reduce((acc, receipt) => acc + receipt.amount, 0).toFixed(2));
  }, [sale]);

  const firstProductionItem = useMemo(() => {
    if (!sale) return null;
    return sale.items.find((item) => isProductionItem(item)) || null;
  }, [sale]);

  if (loading) {
    return (
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
        <div className="rounded-2xl border border-outline-variant/35 bg-white px-6 py-10 text-center text-sm text-neutral-700">
          Carregando detalhes da venda...
        </div>
      </div>
    );
  }

  if (error && !sale) {
    return (
      <div className="min-h-full bg-white p-5 md:bg-surface-low">
        <div className="mx-auto max-w-5xl rounded-2xl border border-[#c76767] bg-[#fdecec] px-6 py-8 text-center text-sm text-[#7a1717]">
          <p>{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/vendas")}>
              Voltar para vendas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!sale) return null;

  return (
    <div className="min-h-full bg-white p-3 sm:p-5 md:bg-surface-low">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/vendas")}
              className="mb-4 text-sm text-neutral-700 underline-offset-2 hover:underline"
            >
              Voltar para vendas
            </button>
            <h1 className="font-editorial text-5xl text-primary md:text-4xl">Detalhes da Venda</h1>
            <p className="mt-2 text-sm text-neutral-700">
              Visualize os itens, recebimentos e parcelas vinculadas a esta venda.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {sale.status === "BUDGET" ? (
              <Button
                variant="primary"
                onClick={() => navigate(`/nova-venda?quoteId=${sale.id}`)}
              >
                Finalizar venda
              </Button>
            ) : null}
            {firstProductionItem?.productId ? (
              <Button
                variant="secondary"
                onClick={() => navigate(`/pedido/${firstProductionItem.productId}`)}
              >
                Abrir pedido de produção
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <InfoCard label="Venda" value={`#${sale.id}`} />
          <InfoCard label="Cliente" value={sale.customer?.name || "Sem cliente"} />
          <InfoCard label="Status" value={formatSaleStatus(sale.status)} />
          <InfoCard label="Forma principal" value={sale.paymentType?.name || "-"} />
          <InfoCard label="Valor final" value={formatCurrency(sale.finalAmount)} />
          <InfoCard label="Recebido" value={formatCurrency(totalReceived)} />
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-[#c76767] bg-[#fdecec] px-4 py-3 text-sm text-[#7a1717]">
            {error}
          </div>
        ) : null}

        <section className="mb-6 rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
          <h2 className="font-editorial text-3xl text-primary">Resumo</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="Subtotal bruto" value={formatCurrency(sale.totalAmount)} />
            <InfoCard label="Desconto dos itens" value={formatCurrency(totalItemDiscount)} />
            <InfoCard label="Saldo em aberto" value={formatCurrency(sale.receivable?.openAmount || 0)} />
            <InfoCard label="Parcelas previstas" value={String(sale.installmentCount || 1)} />
            <InfoCard label="Criada em" value={formatDateTime(sale.createdAt)} />
            <InfoCard label="Atualizada em" value={formatDateTime(sale.updatedAt)} />
            <InfoCard label="Vencimento base" value={formatDate(sale.dueDate)} />
            <InfoCard label="Medições" value={String(sale.measurementsCount || 0)} />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
          <h2 className="font-editorial text-3xl text-primary">Itens da Venda</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold text-primary">Descrição</th>
                  <th className="px-4 py-2 font-semibold text-primary">Tipo</th>
                  <th className="px-4 py-2 font-semibold text-primary">Qtd.</th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">Unitário</th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">Bruto</th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">Desconto</th>
                  <th className="px-4 py-2 font-semibold text-primary text-right">Final</th>
                  <th className="px-4 py-2 font-semibold text-primary">Costureira</th>
                  <th className="px-4 py-2 font-semibold text-primary">Data Prova</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="bg-surface-lowest px-4 py-6 text-center text-neutral-700">
                      Nenhum item encontrado para esta venda.
                    </td>
                  </tr>
                ) : (
                  sale.items.map((item) => (
                    <tr key={item.id} className="bg-surface-lowest">
                      <td className="px-4 py-3 text-neutral-800">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-primary">{item.description}</span>
                          <span className="text-xs text-neutral-600">
                            {isProductionItem(item)
                              ? `Pedido #${item.productId}`
                              : "Sem produção vinculada"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-800">{formatSaleItemType(item.itemType)}</td>
                      <td className="px-4 py-3 text-neutral-800">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-neutral-800">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right text-neutral-800">{formatCurrency(item.grossAmount)}</td>
                      <td className="px-4 py-3 text-right text-neutral-800">{formatItemDiscount(item)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">{formatCurrency(item.subtotal)}</td>
                      <td className="px-4 py-3 text-neutral-800">{item.seamstress || "-"}</td>
                      <td className="px-4 py-3 text-neutral-800">{formatDate(item.fittingDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">Recebimentos</h2>

            <div className="mt-5 space-y-3">
              {sale.receipts.length === 0 ? (
                <div className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
                  Nenhum recebimento registrado.
                </div>
              ) : (
                sale.receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-primary">{formatReceiptType(receipt.receiptType)}</p>
                        <p className="text-sm text-neutral-700">
                          {receipt.paymentType?.name || "Forma não identificada"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(receipt.amount)}</p>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                      <p>Data: {formatDateTime(receipt.paidAt)}</p>
                      <p>Referência: {receipt.referenceCode || "-"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {sale.cardTransaction ? (
              <div className="mt-5 rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4">
                <p className="text-sm font-semibold text-primary">Transação de cartão</p>
                <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                  <p>Operadora: {sale.cardTransaction.operatorLabel || "-"}</p>
                  <p>Bandeira: {sale.cardTransaction.cardBrand || "-"}</p>
                  <p>Autorização: {sale.cardTransaction.authorizationCode || "-"}</p>
                  <p>Parcelas no cartão: {sale.cardTransaction.clientInstallmentCount}</p>
                  <p>Taxa prevista: {formatCurrency(sale.cardTransaction.feeAmount)}</p>
                  <p>Repasse previsto: {formatDate(sale.cardTransaction.expectedSettlementDate)}</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-outline-variant/35 bg-white p-5 shadow-sm">
            <h2 className="font-editorial text-3xl text-primary">A Receber</h2>

            {!sale.receivable ? (
              <div className="mt-5 rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
                Esta venda não gerou contas a receber.
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <InfoCard label="Perfil" value={sale.receivable.originLabel} />
                  <InfoCard label="Origem" value={sale.receivable.originName} />
                  <InfoCard label="Status" value={sale.receivable.status} />
                  <InfoCard label="Valor original" value={formatCurrency(sale.receivable.originalAmount)} />
                  <InfoCard label="Saldo aberto" value={formatCurrency(sale.receivable.openAmount)} />
                </div>

                <div className="mt-5 space-y-3">
                  {sale.receivable.installments.length === 0 ? (
                    <div className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4 text-sm text-neutral-700">
                      Nenhuma parcela cadastrada.
                    </div>
                  ) : (
                    sale.receivable.installments.map((installment) => (
                      <div
                        key={installment.id}
                        className="rounded-xl border border-outline-variant/35 bg-surface-lowest px-4 py-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-primary">
                              Parcela {installment.installmentNumber}/{installment.totalInstallments}
                            </p>
                            <p className="text-sm text-neutral-700">
                              {installment.paymentType?.name || "Forma não identificada"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-primary">
                            {formatCurrency(installment.amount)}
                          </p>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-neutral-700 md:grid-cols-2">
                          <p>Vencimento: {formatDate(installment.dueDate)}</p>
                          <p>Status: {installment.status}</p>
                          <p>Pago: {formatCurrency(installment.paidAmount)}</p>
                          <p>Em aberto: {formatCurrency(installment.openAmount)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
