require("dotenv").config();
const { Op } = require("sequelize");
const {
  PaymentReceipts,
  PaymentTypes,
  ReceivableInstallments,
  Receivables,
  Sales,
  sequelize,
} = require("../models");
const { buildPaymentTypeResponse } = require("../utils/paymentTypeRules");

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

function getDateKey(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function buildGroupKey(customerId, dateKey) {
  return `${Number(customerId || 0)}|${dateKey}`;
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
      "finalAmount",
      "createdAt",
      "status",
    ],
    order: [["idSale", "ASC"]],
    raw: true,
  });
}

async function listUnlinkedReceivablesByCustomers(customerIds = []) {
  if (!customerIds.length) return [];

  return Receivables.findAll({
    where: {
      saleId: null,
      customerId: {
        [Op.in]: customerIds,
      },
    },
    attributes: [
      "idReceivable",
      "customerId",
      "createdAt",
      "originalAmount",
      "status",
    ],
    include: [
      {
        model: ReceivableInstallments,
        attributes: [
          "idReceivableInstallment",
          "paymentTypeId",
          "amount",
          "createdAt",
        ],
        required: false,
        include: [
          {
            model: PaymentTypes,
            attributes: ["idPaymentType", "desc"],
            required: false,
          },
        ],
      },
    ],
    order: [["idReceivable", "ASC"]],
  });
}

function summarizeReceivable(receivable) {
  const installments = Array.isArray(receivable.ReceivableInstallments)
    ? receivable.ReceivableInstallments
    : [];

  const immediateAmount = installments.reduce((acc, installment) => {
    const paymentType = installment.PaymentType || installment.PaymentTypes || null;
    const normalizedPaymentType = paymentType
      ? buildPaymentTypeResponse(paymentType)
      : null;

    if (normalizedPaymentType?.financialFlow === "IMMEDIATE_CASH") {
      return acc + Number(installment.amount || 0);
    }

    return acc;
  }, 0);

  const futureAmount = installments.reduce((acc, installment) => {
    const paymentType = installment.PaymentType || installment.PaymentTypes || null;
    const normalizedPaymentType = paymentType
      ? buildPaymentTypeResponse(paymentType)
      : null;

    if (normalizedPaymentType?.financialFlow === "IMMEDIATE_CASH") {
      return acc;
    }

    return acc + Number(installment.amount || 0);
  }, 0);

  return {
    receivableId: Number(receivable.idReceivable),
    customerId: Number(receivable.customerId || 0) || null,
    dateKey: getDateKey(receivable.createdAt),
    totalAmount: roundCurrency(receivable.originalAmount),
    immediateAmount: roundCurrency(immediateAmount),
    futureAmount: roundCurrency(futureAmount),
  };
}

function buildReceivableGroups(receivables = []) {
  const groups = new Map();

  receivables.forEach((receivable) => {
    const summary = summarizeReceivable(receivable);
    if (!summary.customerId || !summary.dateKey) return;

    const key = buildGroupKey(summary.customerId, summary.dateKey);
    const current = groups.get(key) || {
      customerId: summary.customerId,
      dateKey: summary.dateKey,
      receivableIds: [],
      totalAmount: 0,
      immediateAmount: 0,
      futureAmount: 0,
    };

    current.receivableIds.push(summary.receivableId);
    current.totalAmount = roundCurrency(current.totalAmount + summary.totalAmount);
    current.immediateAmount = roundCurrency(current.immediateAmount + summary.immediateAmount);
    current.futureAmount = roundCurrency(current.futureAmount + summary.futureAmount);
    groups.set(key, current);
  });

  return groups;
}

function buildSaleGroups(sales = []) {
  const groups = new Map();

  sales.forEach((sale) => {
    const customerId = Number(sale.customerId || 0) || null;
    const dateKey = getDateKey(sale.createdAt);
    if (!customerId || !dateKey) return;

    const key = buildGroupKey(customerId, dateKey);
    const current = groups.get(key) || [];
    current.push({
      saleId: Number(sale.idSale),
      customerId,
      dateKey,
      finalAmount: roundCurrency(sale.finalAmount),
      status: sale.status,
    });
    groups.set(key, current);
  });

  return groups;
}

function buildReconciliationReports(sales = [], receivableGroups, saleGroups) {
  return sales.map((sale) => {
    const customerId = Number(sale.customerId || 0) || null;
    const dateKey = getDateKey(sale.createdAt);
    const groupKey = buildGroupKey(customerId, dateKey);
    const receivableGroup = receivableGroups.get(groupKey) || null;
    const salesInGroup = saleGroups.get(groupKey) || [];
    const finalAmount = roundCurrency(sale.finalAmount);
    const totalGroupAmount = roundCurrency(receivableGroup?.totalAmount || 0);
    const differenceAmount = roundCurrency(finalAmount - totalGroupAmount);
    const canApply =
      Boolean(receivableGroup) &&
      salesInGroup.length === 1 &&
      receivableGroup.receivableIds.length >= 1 &&
      Math.abs(differenceAmount) < 0.01;

    return {
      saleId: Number(sale.idSale),
      customerId,
      dateKey,
      finalAmount,
      receivableGroupAmount: totalGroupAmount,
      immediateAmount: roundCurrency(receivableGroup?.immediateAmount || 0),
      futureAmount: roundCurrency(receivableGroup?.futureAmount || 0),
      differenceAmount,
      receivableIds: receivableGroup?.receivableIds || [],
      salesInGroupCount: salesInGroup.length,
      canApply,
    };
  });
}

async function applyReconciliation(report, transaction) {
  if (!report.receivableIds.length) {
    return 0;
  }

  await Receivables.update(
    {
      saleId: report.saleId,
      updatedAt: new Date(),
    },
    {
      where: {
        idReceivable: {
          [Op.in]: report.receivableIds,
        },
      },
      transaction,
    },
  );

  const installments = await ReceivableInstallments.findAll({
    where: {
      receivableId: {
        [Op.in]: report.receivableIds,
      },
    },
    attributes: ["idReceivableInstallment"],
    transaction,
    raw: true,
  });

  const installmentIds = installments
    .map((item) => Number(item.idReceivableInstallment || 0))
    .filter(Boolean);

  if (installmentIds.length) {
    await PaymentReceipts.update(
      {
        saleId: report.saleId,
        updatedAt: new Date(),
      },
      {
        where: {
          receivableInstallmentId: {
            [Op.in]: installmentIds,
          },
          saleId: null,
        },
        transaction,
      },
    );
  }

  return report.receivableIds.length;
}

async function main() {
  const args = readArgs();

  try {
    const sales = await listTargetSales(args);
    const customerIds = [
      ...new Set(
        sales
          .map((item) => Number(item.customerId || 0))
          .filter((item) => Number.isInteger(item) && item > 0),
      ),
    ];
    const unlinkedReceivables = await listUnlinkedReceivablesByCustomers(customerIds);
    const receivableGroups = buildReceivableGroups(unlinkedReceivables);
    const saleGroups = buildSaleGroups(sales);
    const reports = buildReconciliationReports(sales, receivableGroups, saleGroups);
    const candidates = reports.filter((item) => item.receivableIds.length > 0);
    const applicable = reports.filter((item) => item.canApply);

    console.log(`Vendas analisadas: ${reports.length}`);
    console.log(`Vendas com grupo legado no mesmo dia: ${candidates.length}`);
    console.log(`Vendas seguras para vincular: ${applicable.length}`);

    if (candidates.length) {
      console.table(
        candidates.map((item) => ({
          saleId: item.saleId,
          customerId: item.customerId,
          saleDate: item.dateKey,
          totalVenda: item.finalAmount,
          grupoRecebivel: item.receivableGroupAmount,
          vista: item.immediateAmount,
          prazo: item.futureAmount,
          diferenca: item.differenceAmount,
          receivableCount: item.receivableIds.length,
          salesSameDay: item.salesInGroupCount,
          canApply: item.canApply ? "SIM" : "NAO",
        })),
      );
    }

    if (!args.apply) {
      console.log("Execucao em dry-run. Nenhuma alteracao foi aplicada.");
      return;
    }

    if (!applicable.length) {
      console.log("Nenhuma venda elegivel para vinculacao automatica.");
      return;
    }

    await sequelize.transaction(async (transaction) => {
      for (const report of applicable) {
        const linkedCount = await applyReconciliation(report, transaction);
        console.log(
          `Venda ${report.saleId}: ${linkedCount} recebivel(is) legado(s) vinculado(s).`,
        );
      }
    });

    console.log("Vinculacao automatica de recebiveis legados concluida.");
  } catch (error) {
    console.error("Erro ao vincular recebiveis legados as vendas:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
