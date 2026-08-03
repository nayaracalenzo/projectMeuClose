require("dotenv").config();
const { Op } = require("sequelize");
const {
  BankEntries,
  CashEntries,
  PaymentReceipts,
  Receivables,
  ReceivableInstallments,
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

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getLocalDateKey(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
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
        attributes: ["idReceivable"],
        required: false,
      },
      {
        model: PaymentReceipts,
        attributes: [
          "idPaymentReceipt",
          "saleId",
          "receivableInstallmentId",
          "paymentTypeId",
          "receiptType",
          "amount",
          "paidAt",
        ],
        required: false,
      },
    ],
    order: [["idSale", "ASC"]],
  });
}

async function loadInstallmentTotalsBySaleIds(saleIds = []) {
  if (!saleIds.length) {
    return new Map();
  }

  const receivables = await Receivables.findAll({
    where: {
      saleId: {
        [Op.in]: saleIds,
      },
    },
    attributes: ["idReceivable", "saleId"],
    raw: true,
  });

  if (!receivables.length) {
    return new Map();
  }

  const receivableIds = receivables.map((item) => Number(item.idReceivable));
  const installments = await ReceivableInstallments.findAll({
    where: {
      receivableId: {
        [Op.in]: receivableIds,
      },
    },
    attributes: ["receivableId", "amount"],
    raw: true,
  });

  const receivableToSaleId = new Map(
    receivables.map((item) => [Number(item.idReceivable), Number(item.saleId)]),
  );
  const totalsBySaleId = new Map();

  installments.forEach((item) => {
    const saleId = receivableToSaleId.get(Number(item.receivableId));
    if (!saleId) return;

    const current = totalsBySaleId.get(saleId) || 0;
    totalsBySaleId.set(saleId, roundCurrency(current + Number(item.amount || 0)));
  });

  return totalsBySaleId;
}

async function loadOrphanStandaloneReceipts() {
  return PaymentReceipts.findAll({
    where: {
      saleId: null,
      receivableInstallmentId: null,
      receiptType: {
        [Op.in]: ["ENTRY", "SALE_FULL"],
      },
    },
    attributes: [
      "idPaymentReceipt",
      "paymentTypeId",
      "receiptType",
      "amount",
      "paidAt",
      "createdAt",
    ],
    order: [["paidAt", "ASC"], ["idPaymentReceipt", "ASC"]],
    raw: true,
  });
}

function getStandaloneImmediateReceipts(receipts = []) {
  return receipts.filter(
    (item) =>
      item.receivableInstallmentId === null &&
      (item.receiptType === "ENTRY" || item.receiptType === "SALE_FULL"),
  );
}

function groupOrphanReceipts(orphanReceipts = []) {
  const grouped = new Map();

  orphanReceipts.forEach((receipt) => {
    const dateKey = getLocalDateKey(receipt.paidAt || receipt.createdAt);
    const amountKey = roundCurrency(receipt.amount);
    const key = `${dateKey}|${amountKey.toFixed(2)}`;
    const current = grouped.get(key) || [];
    current.push(receipt);
    grouped.set(key, current);
  });

  return grouped;
}

function buildSaleReport(sale, installmentTotalsBySaleId, orphanReceiptsByKey) {
  const receipts = Array.isArray(sale.PaymentReceipts) ? sale.PaymentReceipts : [];
  const standaloneReceipts = getStandaloneImmediateReceipts(receipts);
  const linkedImmediateAmount = roundCurrency(
    standaloneReceipts.reduce((acc, item) => acc + Number(item.amount || 0), 0),
  );
  const totalAmount = roundCurrency(sale.finalAmount);
  const installmentAmount = roundCurrency(
    installmentTotalsBySaleId.get(Number(sale.idSale)) || 0,
  );
  const expectedImmediateAmount = Math.max(
    0,
    roundCurrency(totalAmount - installmentAmount),
  );
  const differenceAmount = roundCurrency(
    totalAmount - linkedImmediateAmount - installmentAmount,
  );
  const orphanKey = `${getLocalDateKey(sale.createdAt)}|${expectedImmediateAmount.toFixed(2)}`;
  const orphanCandidates =
    expectedImmediateAmount > 0 ? orphanReceiptsByKey.get(orphanKey) || [] : [];
  const safeCandidate = orphanCandidates.length === 1 ? orphanCandidates[0] : null;

  return {
    saleId: Number(sale.idSale),
    customerId: Number(sale.customerId || 0) || null,
    totalAmount,
    installmentAmount,
    linkedImmediateAmount,
    expectedImmediateAmount,
    differenceAmount,
    linkedReceiptCount: standaloneReceipts.length,
    orphanCandidateCount: orphanCandidates.length,
    orphanCandidateIds: orphanCandidates.map((item) => Number(item.idPaymentReceipt)),
    safeCandidate,
    canApply:
      Math.abs(differenceAmount) >= 0.01 &&
      expectedImmediateAmount > 0 &&
      linkedImmediateAmount <= 0 &&
      Boolean(safeCandidate),
    nextReceiptType: installmentAmount > 0 ? "ENTRY" : "SALE_FULL",
  };
}

async function applyReconciliation(report, transaction) {
  if (!report.safeCandidate) {
    return null;
  }

  await PaymentReceipts.update(
    {
      saleId: report.saleId,
      receiptType: report.nextReceiptType,
      updatedAt: new Date(),
    },
    {
      where: {
        idPaymentReceipt: Number(report.safeCandidate.idPaymentReceipt),
      },
      transaction,
    },
  );

  await CashEntries.update(
    {
      saleId: report.saleId,
      updatedAt: new Date(),
    },
    {
      where: {
        paymentReceiptId: Number(report.safeCandidate.idPaymentReceipt),
        saleId: null,
      },
      transaction,
    },
  );

  await BankEntries.update(
    {
      saleId: report.saleId,
      updatedAt: new Date(),
    },
    {
      where: {
        paymentReceiptId: Number(report.safeCandidate.idPaymentReceipt),
        saleId: null,
      },
      transaction,
    },
  );

  return Number(report.safeCandidate.idPaymentReceipt);
}

async function main() {
  const args = readArgs();

  try {
    const sales = await listTargetSales(args);
    const saleIds = sales.map((item) => Number(item.idSale));
    const [installmentTotalsBySaleId, orphanStandaloneReceipts] = await Promise.all([
      loadInstallmentTotalsBySaleIds(saleIds),
      loadOrphanStandaloneReceipts(),
    ]);

    const orphanReceiptsByKey = groupOrphanReceipts(orphanStandaloneReceipts);
    const reports = sales.map((sale) =>
      buildSaleReport(sale, installmentTotalsBySaleId, orphanReceiptsByKey),
    );
    const mismatches = reports.filter((item) => Math.abs(item.differenceAmount) >= 0.01);
    const applicable = reports.filter((item) => item.canApply);

    console.log(`Vendas analisadas: ${reports.length}`);
    console.log(`Vendas com divergencia: ${mismatches.length}`);
    console.log(`Vendas seguras para reconciliar: ${applicable.length}`);

    if (mismatches.length) {
      console.table(
        mismatches.map((item) => ({
          saleId: item.saleId,
          customerId: item.customerId,
          total: item.totalAmount,
          vistaAtual: item.linkedImmediateAmount,
          vistaEsperada: item.expectedImmediateAmount,
          prazo: item.installmentAmount,
          diferenca: item.differenceAmount,
          linkedReceipts: item.linkedReceiptCount,
          orphanCandidates: item.orphanCandidateCount,
          canApply: item.canApply ? "SIM" : "NAO",
        })),
      );
    }

    if (!args.apply) {
      console.log("Execucao em dry-run. Nenhuma alteracao foi aplicada.");
      return;
    }

    if (!applicable.length) {
      console.log("Nenhuma venda elegivel para reconciliacao automatica.");
      return;
    }

    await sequelize.transaction(async (transaction) => {
      for (const report of applicable) {
        const paymentReceiptId = await applyReconciliation(report, transaction);
        console.log(
          `Venda ${report.saleId}: receipt ${paymentReceiptId} vinculado com sucesso.`,
        );
      }
    });

    console.log("Reconciliacao automatica concluida.");
  } catch (error) {
    console.error("Erro ao reconciliar composicao financeira das vendas:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
