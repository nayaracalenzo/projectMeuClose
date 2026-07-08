require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const {
  BankEntries,
  CashEntries,
  CardTransactions,
  PaymentReceipts,
  PaymentTypes,
  ReceivableInstallments,
  Receivables,
  Sales,
  sequelize,
} = require("../models");
const { buildPaymentTypeResponse } = require("../utils/paymentTypeRules");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const parseDate = require("../utils/parseDate");

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function normalizeLegacyPaymentTypeId(value) {
  const normalized = normalizeInteger(value);
  if (!normalized || normalized <= 0) return null;
  return normalized;
}

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function buildImmediateFinancialEntry({ saleId, paymentType, amount, occurredAt }) {
  if (!paymentType || amount <= 0) return null;

  return {
    scope: "LOJA",
    movementType: "IN",
    category: "VENDA",
    description: `Importacao legado venda #${saleId} via ${paymentType.name}`,
    amount,
    occurredAt,
    sourceType: "SALE_RECEIPT",
    saleId,
    paymentTypeId: paymentType.id,
    referenceCode: null,
  };
}

async function importSaleFinancials() {
  const rows = [];
  const filePath = path.join(__dirname, "venda.csv");

  console.log("Iniciando leitura do CSV financeiro de vendas...");

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => {
      rows.push(data);
    })
    .on("end", async () => {
      console.log(`Total encontrados no CSV: ${rows.length}`);

      const [
        sales,
        paymentTypes,
        existingReceipts,
        existingReceivables,
        existingCashEntries,
        existingBankEntries,
        existingCardTransactions,
      ] = await Promise.all([
        Sales.findAll({
          attributes: ["idSale", "customerId", "finalAmount", "createdAt", "paymentTypeId"],
          raw: true,
        }),
        PaymentTypes.findAll({ raw: true }),
        PaymentReceipts.findAll({ attributes: ["saleId"], raw: true }),
        Receivables.findAll({ attributes: ["saleId"], raw: true }),
        CashEntries.findAll({ attributes: ["saleId"], raw: true }),
        BankEntries.findAll({ attributes: ["saleId"], raw: true }),
        CardTransactions.findAll({ attributes: ["saleId"], raw: true }),
      ]);

      const salesMap = new Map(sales.map((sale) => [Number(sale.idSale), sale]));
      const paymentTypeMap = new Map(
        paymentTypes.map((item) => [Number(item.idPaymentType), buildPaymentTypeResponse(item)]),
      );
      const receiptSaleIds = new Set(existingReceipts.map((item) => Number(item.saleId)).filter(Boolean));
      const receivableSaleIds = new Set(existingReceivables.map((item) => Number(item.saleId)).filter(Boolean));
      const cashEntrySaleIds = new Set(existingCashEntries.map((item) => Number(item.saleId)).filter(Boolean));
      const bankEntrySaleIds = new Set(existingBankEntries.map((item) => Number(item.saleId)).filter(Boolean));
      const cardTransactionSaleIds = new Set(existingCardTransactions.map((item) => Number(item.saleId)).filter(Boolean));

      let importedReceipts = 0;
      let importedReceivables = 0;
      let importedInstallments = 0;
      let importedCashEntries = 0;
      let importedBankEntries = 0;
      let importedCardTransactions = 0;
      let skipped = 0;

      for (const row of rows) {
        const saleId = normalizeInteger(row.id);

        try {
          if (!saleId) {
            skipped += 1;
            continue;
          }

          const sale = salesMap.get(saleId);
          if (!sale) {
            skipped += 1;
            continue;
          }

          const immediateAmount = normalizeLegacyCurrency(row.vlrVis) || 0;
          const futureAmount = normalizeLegacyCurrency(row.vlrPra) || 0;
          const immediatePaymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDocVis);
          const futurePaymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDocPra);
          const immediatePaymentType = immediatePaymentTypeId
            ? paymentTypeMap.get(immediatePaymentTypeId) || null
            : null;
          const futurePaymentType = futurePaymentTypeId
            ? paymentTypeMap.get(futurePaymentTypeId) || null
            : null;
          const occurredAt = parseDate(row.dt) || sale.createdAt || new Date();
          const dueDate = parseDate(row.dtVen) || occurredAt;

          await sequelize.transaction(async (transaction) => {
            let createdReceipt = null;

            if (immediateAmount > 0 && !receiptSaleIds.has(saleId) && immediatePaymentType) {
              createdReceipt = await PaymentReceipts.create(
                {
                  saleId,
                  receivableInstallmentId: null,
                  paymentTypeId: immediatePaymentType.id,
                  receiptType: futureAmount > 0 ? "ENTRY" : "SALE_FULL",
                  amount: immediateAmount,
                  paidAt: occurredAt,
                  referenceCode: null,
                },
                { transaction },
              );

              importedReceipts += 1;
              receiptSaleIds.add(saleId);

              const entryPayload = buildImmediateFinancialEntry({
                saleId,
                paymentType: immediatePaymentType,
                amount: immediateAmount,
                occurredAt,
              });

              if (entryPayload) {
                if (
                  immediatePaymentType.kind === "CASH" &&
                  !cashEntrySaleIds.has(saleId)
                ) {
                  await CashEntries.create(
                    {
                      ...entryPayload,
                      paymentReceiptId: createdReceipt.idPaymentReceipt,
                      payablePaymentId: null,
                      cashSessionId: null,
                    },
                    { transaction },
                  );
                  importedCashEntries += 1;
                  cashEntrySaleIds.add(saleId);
                } else if (!bankEntrySaleIds.has(saleId)) {
                  await BankEntries.create(
                    {
                      ...entryPayload,
                      paymentReceiptId: createdReceipt.idPaymentReceipt,
                      payablePaymentId: null,
                      accountLabel: "Banco da Loja",
                    },
                    { transaction },
                  );
                  importedBankEntries += 1;
                  bankEntrySaleIds.add(saleId);
                }
              }
            }

            if (futureAmount > 0 && !receivableSaleIds.has(saleId) && futurePaymentType) {
              const debtorType =
                futurePaymentType.financialFlow === "FUTURE_OPERATOR"
                  ? "CARD_OPERATOR"
                  : "CUSTOMER";

              const receivable = await Receivables.create(
                {
                  saleId,
                  customerId: debtorType === "CUSTOMER" ? sale.customerId : null,
                  debtorType,
                  operatorLabel:
                    debtorType === "CARD_OPERATOR" ? futurePaymentType.name : null,
                  originalAmount: futureAmount,
                  openAmount: futureAmount,
                  status: "OPEN",
                },
                { transaction },
              );

              importedReceivables += 1;
              receivableSaleIds.add(saleId);

              await ReceivableInstallments.create(
                {
                  receivableId: receivable.idReceivable,
                  paymentTypeId: futurePaymentType.id,
                  installmentNumber: 1,
                  totalInstallments: 1,
                  dueDate,
                  amount: futureAmount,
                  paidAmount: 0,
                  status: "OPEN",
                },
                { transaction },
              );

              importedInstallments += 1;

              if (
                futurePaymentType.financialFlow === "FUTURE_OPERATOR" &&
                !cardTransactionSaleIds.has(saleId)
              ) {
                await CardTransactions.create(
                  {
                    saleId,
                    receivableId: receivable.idReceivable,
                    operatorLabel: futurePaymentType.name,
                    cardBrand: null,
                    authorizationCode: null,
                    clientInstallmentCount: 1,
                    grossAmount: roundCurrency(sale.finalAmount || immediateAmount + futureAmount),
                    entryAmount: roundCurrency(immediateAmount),
                    netReceivableAmount: futureAmount,
                    feeAmount: 0,
                    expectedSettlementDate: dueDate,
                    settlementStatus: "PENDING",
                  },
                  { transaction },
                );

                importedCardTransactions += 1;
                cardTransactionSaleIds.add(saleId);
              }
            }
          });
        } catch (error) {
          console.error(
            `Erro ao importar financeiro da venda legado ${saleId || "sem-id"}:`,
            error.message,
          );
          skipped += 1;
        }
      }

      console.log("Importacao financeira das vendas finalizada.");
      console.log(`Recebimentos inseridos: ${importedReceipts}`);
      console.log(`Recebiveis inseridos: ${importedReceivables}`);
      console.log(`Parcelas inseridas: ${importedInstallments}`);
      console.log(`Lancamentos de caixa inseridos: ${importedCashEntries}`);
      console.log(`Lancamentos de banco inseridos: ${importedBankEntries}`);
      console.log(`Transacoes de cartao inseridas: ${importedCardTransactions}`);
      console.log(`Ignorados: ${skipped}`);

      await sequelize.close();
      process.exit();
    })
    .on("error", async (error) => {
      console.error("Erro ao ler o arquivo financeiro de vendas:", error.message);
      await sequelize.close();
      process.exit(1);
    });
}

importSaleFinancials();
