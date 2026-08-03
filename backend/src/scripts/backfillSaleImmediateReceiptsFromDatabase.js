require("dotenv").config();
const { Op } = require("sequelize");
const {
  BankEntries,
  CashEntries,
  PaymentReceipts,
  Receivables,
  Sales,
  sequelize,
} = require("../models");

function parseIdList(rawValue) {
  if (!rawValue) return [];

  return [
    ...new Set(
      String(rawValue)
        .split(",")
        .map((value) => Number(String(value).trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ];
}

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function readArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    saleIds: [],
    customerId: null,
    apply: false,
  };

  args.forEach((arg) => {
    if (arg === "--apply") {
      parsed.apply = true;
      return;
    }

    if (arg.startsWith("--sale-ids=")) {
      parsed.saleIds = parseIdList(arg.slice("--sale-ids=".length));
      return;
    }

    if (arg.startsWith("--customer-id=")) {
      const value = Number(arg.slice("--customer-id=".length));
      parsed.customerId = Number.isInteger(value) && value > 0 ? value : null;
    }
  });

  return parsed;
}

async function listTargetSales({ saleIds, customerId }) {
  const where = {
    status: {
      [Op.in]: ["COMPLETED", "CANCELLED"],
    },
  };

  if (saleIds.length) {
    where.idSale = {
      [Op.in]: saleIds,
    };
  }

  if (customerId) {
    where.customerId = customerId;
  }

  return Sales.findAll({
    where,
    attributes: [
      "idSale",
      "customerId",
      "paymentTypeId",
      "finalAmount",
      "createdAt",
      "status",
    ],
    include: [
      {
        model: Receivables,
        attributes: ["idReceivable", "originalAmount", "openAmount", "status"],
        required: false,
      },
    ],
    order: [["idSale", "ASC"]],
  });
}

async function loadRelatedDataBySaleIds(saleIds = []) {
  if (!saleIds.length) {
    return {
      receiptsBySaleId: new Map(),
      cashEntriesBySaleId: new Map(),
      bankEntriesBySaleId: new Map(),
    };
  }

  const [receipts, cashEntries, bankEntries] = await Promise.all([
    PaymentReceipts.findAll({
      where: {
        saleId: {
          [Op.in]: saleIds,
        },
      },
      attributes: [
        "idPaymentReceipt",
        "saleId",
        "paymentTypeId",
        "receiptType",
        "amount",
        "paidAt",
      ],
      raw: true,
    }),
    CashEntries.findAll({
      where: {
        saleId: {
          [Op.in]: saleIds,
        },
      },
      attributes: [
        "idCashEntry",
        "saleId",
        "paymentReceiptId",
        "paymentTypeId",
        "movementType",
        "amount",
        "occurredAt",
        "sourceType",
      ],
      raw: true,
    }),
    BankEntries.findAll({
      where: {
        saleId: {
          [Op.in]: saleIds,
        },
      },
      attributes: [
        "idBankEntry",
        "saleId",
        "paymentReceiptId",
        "paymentTypeId",
        "movementType",
        "amount",
        "occurredAt",
        "sourceType",
      ],
      raw: true,
    }),
  ]);

  const groupBySaleId = (items, key) => {
    const map = new Map();

    items.forEach((item) => {
      const saleId = Number(item.saleId || 0);
      if (!saleId) return;

      const current = map.get(saleId) || [];
      current.push(item);
      map.set(saleId, current);
    });

    return map;
  };

  return {
    receiptsBySaleId: groupBySaleId(receipts, "idPaymentReceipt"),
    cashEntriesBySaleId: groupBySaleId(cashEntries, "idCashEntry"),
    bankEntriesBySaleId: groupBySaleId(bankEntries, "idBankEntry"),
  };
}

function getStandaloneImmediateReceipts(receipts = []) {
  return receipts.filter(
    (item) =>
      item.receiptType === "ENTRY" || item.receiptType === "SALE_FULL",
  );
}

function getOrphanImmediateFinancialEntries(entries = []) {
  return entries.filter(
    (item) =>
      item.sourceType === "SALE_RECEIPT" &&
      item.movementType === "IN" &&
      !item.paymentReceiptId,
  );
}

function pickPaymentTypeId(cashEntries = [], bankEntries = []) {
  const entries = [...cashEntries, ...bankEntries];
  const ranked = new Map();

  entries.forEach((entry) => {
    const paymentTypeId = Number(entry.paymentTypeId || 0);
    if (!paymentTypeId) return;

    const current = ranked.get(paymentTypeId) || {
      paymentTypeId,
      count: 0,
      occurredAt: entry.occurredAt || null,
    };

    current.count += 1;
    if (!current.occurredAt || new Date(entry.occurredAt) < new Date(current.occurredAt)) {
      current.occurredAt = entry.occurredAt || current.occurredAt;
    }

    ranked.set(paymentTypeId, current);
  });

  return [...ranked.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return new Date(left.occurredAt || 0).getTime() - new Date(right.occurredAt || 0).getTime();
    })[0]?.paymentTypeId || null;
}

function buildSaleReport(sale, relatedData) {
  const receivable = sale.Receivable || sale.Receivables || null;
  const receipts = relatedData.receiptsBySaleId.get(Number(sale.idSale)) || [];
  const cashEntries = getOrphanImmediateFinancialEntries(
    relatedData.cashEntriesBySaleId.get(Number(sale.idSale)) || [],
  );
  const bankEntries = getOrphanImmediateFinancialEntries(
    relatedData.bankEntriesBySaleId.get(Number(sale.idSale)) || [],
  );
  const standaloneReceipts = getStandaloneImmediateReceipts(receipts);

  const finalAmount = roundCurrency(sale.finalAmount);
  const receivableAmount = roundCurrency(receivable?.originalAmount || 0);
  const expectedImmediateAmount = Math.max(
    0,
    roundCurrency(finalAmount - receivableAmount),
  );
  const existingImmediateReceiptAmount = roundCurrency(
    standaloneReceipts.reduce((acc, item) => acc + Number(item.amount || 0), 0),
  );
  const orphanCashAmount = roundCurrency(
    cashEntries.reduce((acc, item) => acc + Number(item.amount || 0), 0),
  );
  const orphanBankAmount = roundCurrency(
    bankEntries.reduce((acc, item) => acc + Number(item.amount || 0), 0),
  );
  const orphanImmediateAmount = roundCurrency(orphanCashAmount + orphanBankAmount);
  const needsBackfill =
    expectedImmediateAmount > 0 &&
    existingImmediateReceiptAmount <= 0 &&
    orphanImmediateAmount > 0;
  const canApply =
    needsBackfill &&
    Math.abs(orphanImmediateAmount - expectedImmediateAmount) < 0.01;

  return {
    saleId: Number(sale.idSale),
    customerId: Number(sale.customerId || 0) || null,
    status: sale.status,
    finalAmount,
    receivableAmount,
    expectedImmediateAmount,
    existingImmediateReceiptAmount,
    orphanImmediateAmount,
    orphanCashAmount,
    orphanBankAmount,
    orphanCashEntryIds: cashEntries.map((item) => Number(item.idCashEntry)),
    orphanBankEntryIds: bankEntries.map((item) => Number(item.idBankEntry)),
    receiptType: receivableAmount > 0 ? "ENTRY" : "SALE_FULL",
    paymentTypeId:
      pickPaymentTypeId(cashEntries, bankEntries) ||
      (expectedImmediateAmount === finalAmount ? sale.paymentTypeId || null : null),
    paidAt:
      [...cashEntries, ...bankEntries]
        .map((item) => item.occurredAt)
        .filter(Boolean)
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ||
      sale.createdAt,
    needsBackfill,
    canApply,
  };
}

async function applyBackfill(report, transaction) {
  const createdReceipt = await PaymentReceipts.create(
    {
      saleId: report.saleId,
      receivableInstallmentId: null,
      paymentTypeId: report.paymentTypeId,
      receiptType: report.receiptType,
      amount: report.expectedImmediateAmount,
      paidAt: report.paidAt,
      referenceCode: null,
    },
    { transaction },
  );

  if (report.orphanCashEntryIds.length) {
    await CashEntries.update(
      {
        paymentReceiptId: createdReceipt.idPaymentReceipt,
        updatedAt: new Date(),
      },
      {
        where: {
          idCashEntry: {
            [Op.in]: report.orphanCashEntryIds,
          },
        },
        transaction,
      },
    );
  }

  if (report.orphanBankEntryIds.length) {
    await BankEntries.update(
      {
        paymentReceiptId: createdReceipt.idPaymentReceipt,
        updatedAt: new Date(),
      },
      {
        where: {
          idBankEntry: {
            [Op.in]: report.orphanBankEntryIds,
          },
        },
        transaction,
      },
    );
  }

  return createdReceipt.idPaymentReceipt;
}

async function main() {
  const args = readArgs();

  try {
    const sales = await listTargetSales(args);
    const relatedData = await loadRelatedDataBySaleIds(
      sales.map((item) => Number(item.idSale)),
    );
    const reports = sales.map((sale) => buildSaleReport(sale, relatedData));
    const candidates = reports.filter((item) => item.needsBackfill);
    const applicable = candidates.filter((item) => item.canApply);

    console.log(`Vendas analisadas: ${reports.length}`);
    console.log(`Candidatas a backfill: ${candidates.length}`);
    console.log(`Prontas para aplicar com seguranca: ${applicable.length}`);

    if (candidates.length) {
      console.table(
        candidates.map((item) => ({
          saleId: item.saleId,
          customerId: item.customerId,
          finalAmount: item.finalAmount,
          receivableAmount: item.receivableAmount,
          expectedImmediateAmount: item.expectedImmediateAmount,
          existingImmediateReceiptAmount: item.existingImmediateReceiptAmount,
          orphanImmediateAmount: item.orphanImmediateAmount,
          canApply: item.canApply ? "SIM" : "NAO",
        })),
      );
    }

    if (!args.apply) {
      console.log("Execucao em dry-run. Nenhuma alteracao foi aplicada.");
      return;
    }

    if (!applicable.length) {
      console.log("Nenhuma venda elegivel para aplicar correcao.");
      return;
    }

    await sequelize.transaction(async (transaction) => {
      for (const report of applicable) {
        const paymentReceiptId = await applyBackfill(report, transaction);
        console.log(
          `Venda ${report.saleId}: receipt ${paymentReceiptId} criado com ${report.expectedImmediateAmount}.`,
        );
      }
    });

    console.log("Backfill de recebimentos imediatos concluido.");
  } catch (error) {
    console.error("Erro ao executar backfill de recebimentos imediatos:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
