const {
  CardTransactions,
  CustomerMeasurements,
  Customers,
  Employees,
  PaymentReceipts,
  PaymentTypes,
  Products,
  ReceivableInstallments,
  Receivables,
  SaleItems,
  Sales,
  Status,
  Suppliers,
  Users,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");
const { createBankEntry, createCashEntry } = require("../services/financialEntriesService");
const productsRepository = require("./productsRepository");
const receivablesRepository = require("./receivablesRepository");

function buildLegacyCompletedSignalSql() {
  return `
    (
      "Sales"."paymentTypeId" IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM "payment_receipts" AS pr
        WHERE pr."saleId" = "Sales"."idSale"
      )
      OR EXISTS (
        SELECT 1
        FROM "receivables" AS r
        WHERE r."saleId" = "Sales"."idSale"
      )
      OR EXISTS (
        SELECT 1
        FROM "card_transactions" AS ct
        WHERE ct."saleId" = "Sales"."idSale"
      )
    )
  `;
}

function buildLegacyCompletedSignal() {
  return sequelize.literal(buildLegacyCompletedSignalSql());
}

function buildStatusWhere(status) {
  if (!status) {
    return {};
  }

  const legacyCompletedSignal = buildLegacyCompletedSignal();

  if (status === "COMPLETED") {
    return {
      [Op.or]: [
        { status: "COMPLETED" },
        {
          [Op.and]: [{ status: "BUDGET" }, legacyCompletedSignal],
        },
      ],
    };
  }

  if (status === "BUDGET") {
    return {
      [Op.and]: [{ status: "BUDGET" }, sequelize.literal(`NOT ${buildLegacyCompletedSignalSql()}`)],
    };
  }

  return { status };
}

function buildSaleFinancialMovementDescription(movement, saleId, customerName) {
  if (movement?.sourceType !== "SALE_RECEIPT" && movement?.category !== "VENDA") {
    return movement?.description;
  }

  const resolvedCustomerName = String(customerName || "").trim() || "Cliente";

  return `Entrada da venda ${saleId} - ${resolvedCustomerName}`;
}

async function createSale({
  sale,
  items,
  customerMeasurements,
  entryReceipt,
  receivable,
  financialMovements,
  createProducts = true,
}) {
  return sequelize.transaction(async (transaction) => {
    const createdSale = await Sales.create(sale, { transaction });
    const customer = createdSale.customerId
      ? await Customers.findByPk(createdSale.customerId, {
          attributes: ["fullName", "companyName"],
          transaction,
        })
      : null;
    const customerName = customer?.fullName || customer?.companyName || null;
    const createdProducts = createProducts
      ? await productsRepository.createProductsFromSale(
          createdSale,
          items,
          transaction,
        )
      : [];

    const createdItems = await SaleItems.bulkCreate(
      items.map((item, index) => ({
        ...item,
        saleId: createdSale.idSale,
        productId: createProducts ? createdProducts[index]?.id || null : null,
      })),
      { transaction }
    );

    let createdMeasurements = [];

    if (customerMeasurements.length) {
      createdMeasurements = await CustomerMeasurements.bulkCreate(
        customerMeasurements.map((measurement) => ({
          ...measurement,
          customerId: createdSale.customerId,
          saleId: createdSale.idSale,
        })),
        { transaction }
      );
    }

    let createdReceivable = null;
    let createdEntryReceipt = null;

    if (entryReceipt) {
      createdEntryReceipt = await receivablesRepository.createStandaloneReceipt(
        {
          saleId: createdSale.idSale,
          receivableInstallmentId: null,
          paymentTypeId: entryReceipt.paymentTypeId,
          receiptType: entryReceipt.receiptType,
          amount: entryReceipt.amount,
          paidAt: entryReceipt.paidAt,
          referenceCode: entryReceipt.referenceCode,
        },
        transaction
      );
    }

    if (Array.isArray(financialMovements) && financialMovements.length) {
      for (const movement of financialMovements) {
        const payload = {
          ...movement,
          description: buildSaleFinancialMovementDescription(
            movement,
            createdSale.idSale,
            customerName,
          ),
          saleId: createdSale.idSale,
          paymentReceiptId: createdEntryReceipt?.idPaymentReceipt || null,
        };

        if (movement.target === "CASH") {
          await createCashEntry(payload, transaction);
          continue;
        }

        await createBankEntry(payload, transaction);
      }
    }

    if (receivable) {
      createdReceivable = await receivablesRepository.createReceivableWithInstallments(
        {
          receivable: {
            saleId: createdSale.idSale,
            customerId: receivable.customerId,
            originalAmount: receivable.originalAmount,
            openAmount: receivable.originalAmount,
            status: "OPEN",
            debtorType: receivable.debtorType,
            operatorLabel: receivable.operatorLabel,
          },
          installments: receivable.installments,
          cardTransaction: receivable.cardTransaction
            ? {
                ...receivable.cardTransaction,
                saleId: createdSale.idSale,
              }
            : null,
        },
        transaction
      );
    }

    return {
      sale: createdSale,
      products: createdProducts,
      items: createdItems,
      measurements: createdMeasurements,
      entryReceipt: createdEntryReceipt,
      receivable: createdReceivable,
    };
  });
}

async function getSaleForFinalization(idSale, transaction) {
  return Sales.findOne({
    where: {
      idSale,
    },
    include: [
      {
        model: SaleItems,
        attributes: [
          "idSaleItem",
          "itemType",
          "description",
          "quantity",
          "unitPrice",
          "discountType",
          "discountValue",
          "subtotal",
          "metadata",
        ],
      },
      {
        model: PaymentReceipts,
        attributes: ["idPaymentReceipt"],
      },
      {
        model: Receivables,
        attributes: ["idReceivable"],
      },
      {
        model: Customers,
        attributes: ["idCustomer", "fullName", "companyName"],
      },
    ],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: Sales,
        }
      : undefined,
  });
}

async function finalizeSale(
  idSale,
  {
    sale,
    entryReceipt,
    receivable,
    financialMovements,
  },
) {
  return sequelize.transaction(async (transaction) => {
    const existingSale = await getSaleForFinalization(idSale, transaction);

    if (!existingSale) {
      return null;
    }

    await existingSale.update(sale, { transaction });

    const saleItems = Array.isArray(existingSale.SaleItems) ? existingSale.SaleItems : [];
    const createdProducts = saleItems.length
      ? await productsRepository.createProductsFromSale(existingSale, saleItems, transaction)
      : [];

    for (const [index, saleItem] of saleItems.entries()) {
      await saleItem.update(
        {
          productId: createdProducts[index]?.id || null,
        },
        { transaction },
      );
    }

    let createdReceivable = null;
    let createdEntryReceipt = null;

    if (entryReceipt) {
      createdEntryReceipt = await receivablesRepository.createStandaloneReceipt(
        {
          saleId: existingSale.idSale,
          receivableInstallmentId: null,
          paymentTypeId: entryReceipt.paymentTypeId,
          receiptType: entryReceipt.receiptType,
          amount: entryReceipt.amount,
          paidAt: entryReceipt.paidAt,
          referenceCode: entryReceipt.referenceCode,
        },
        transaction,
      );
    }

    if (Array.isArray(financialMovements) && financialMovements.length) {
      const customerName =
        existingSale.Customer?.fullName || existingSale.Customer?.companyName || null;

      for (const movement of financialMovements) {
        const payload = {
          ...movement,
          description: buildSaleFinancialMovementDescription(
            movement,
            existingSale.idSale,
            customerName,
          ),
          saleId: existingSale.idSale,
          paymentReceiptId: createdEntryReceipt?.idPaymentReceipt || null,
        };

        if (movement.target === "CASH") {
          await createCashEntry(payload, transaction);
          continue;
        }

        await createBankEntry(payload, transaction);
      }
    }

    if (receivable) {
      createdReceivable = await receivablesRepository.createReceivableWithInstallments(
        {
          receivable: {
            saleId: existingSale.idSale,
            customerId: receivable.customerId,
            originalAmount: receivable.originalAmount,
            openAmount: receivable.originalAmount,
            status: "OPEN",
            debtorType: receivable.debtorType,
            operatorLabel: receivable.operatorLabel,
          },
          installments: receivable.installments,
          cardTransaction: receivable.cardTransaction
            ? {
                ...receivable.cardTransaction,
                saleId: existingSale.idSale,
              }
            : null,
        },
        transaction,
      );
    }

    return {
      sale: existingSale,
      products: createdProducts,
      entryReceipt: createdEntryReceipt,
      receivable: createdReceivable,
    };
  });
}

async function getSaleForCancellation(idSale, transaction) {
  return Sales.findOne({
    where: {
      idSale,
    },
    include: [
      {
        model: SaleItems,
        attributes: ["idSaleItem", "productId"],
      },
      {
        model: Receivables,
        attributes: ["idReceivable", "status", "openAmount"],
        required: false,
        include: [
          {
            model: ReceivableInstallments,
            attributes: ["idReceivableInstallment", "status"],
            required: false,
          },
        ],
      },
    ],
    transaction,
    lock: transaction
      ? {
          level: transaction.LOCK.UPDATE,
          of: Sales,
        }
      : undefined,
  });
}

async function getOrCreateCancelledStatus(transaction) {
  const existingStatus = await Status.findOne({
    where: {
      desc: {
        [Op.iLike]: "cancelada",
      },
    },
    transaction,
  });

  if (existingStatus) {
    return existingStatus;
  }

  return Status.create(
    {
      desc: "cancelada",
    },
    { transaction },
  );
}

async function cancelSale(idSale) {
  return sequelize.transaction(async (transaction) => {
    const sale = await getSaleForCancellation(idSale, transaction);

    if (!sale) {
      return null;
    }

    await sale.update(
      {
        status: "CANCELLED",
      },
      { transaction },
    );

    const productIds = Array.isArray(sale.SaleItems)
      ? sale.SaleItems.map((item) => Number(item.productId) || null).filter(Boolean)
      : [];

    if (productIds.length) {
      const cancelledStatus = await getOrCreateCancelledStatus(transaction);

      await Products.update(
        {
          statusId: cancelledStatus.id,
        },
        {
          where: {
            id: productIds,
          },
          transaction,
        },
      );
    }

    if (sale.Receivable) {
      await sale.Receivable.update(
        {
          status: "CANCELLED",
          openAmount: 0,
        },
        { transaction },
      );

      if (Array.isArray(sale.Receivable.ReceivableInstallments) && sale.Receivable.ReceivableInstallments.length) {
        await ReceivableInstallments.update(
          {
            status: "CANCELLED",
          },
          {
            where: {
              receivableId: sale.Receivable.idReceivable,
            },
            transaction,
          },
        );
      }
    }

    return sale;
  });
}

async function getSaleById(idSale) {
  const legacyCompletedSignal = buildLegacyCompletedSignal();

  return Sales.findOne({
    where: {
      idSale,
    },
    attributes: {
      include: [[legacyCompletedSignal, "isLegacyCompleted"]],
    },
    include: [
      {
        model: Customers,
      },
      {
        model: Users,
      },
      {
        model: PaymentTypes,
      },
      {
        model: SaleItems,
        include: [
          {
            model: Products,
            include: [
              {
                model: Employees,
                attributes: ["idEmployee", "shortName", "fullName"],
              },
              {
                model: Status,
                attributes: ["id", "desc"],
              },
            ],
          },
        ],
      },
      {
        model: PaymentReceipts,
        include: [
          {
            model: PaymentTypes,
          },
        ],
      },
      {
        model: Receivables,
        include: [
          {
            model: Suppliers,
            attributes: ["idSupplier", "fullName", "tradeName"],
            required: false,
          },
          {
            model: ReceivableInstallments,
            include: [
              {
                model: PaymentTypes,
              },
            ],
          },
          {
            model: CardTransactions,
          },
        ],
      },
      {
        model: CardTransactions,
      },
      {
        model: CustomerMeasurements,
      },
    ],
    order: [
      [SaleItems, "idSaleItem", "ASC"],
      [PaymentReceipts, "paidAt", "ASC"],
      [Receivables, ReceivableInstallments, "installmentNumber", "ASC"],
      [CustomerMeasurements, "idMeasurement", "ASC"],
    ],
  });
}

async function listSales({ page = 1, pageSize = 10, status, search, customerId } = {}) {
  const where = buildStatusWhere(status);
  const legacyCompletedSignal = buildLegacyCompletedSignal();

  if (customerId && Number(customerId) > 0) {
    where.customerId = Number(customerId);
  }

  return Sales.findAndCountAll({
    where,
    attributes: {
      include: [[legacyCompletedSignal, "isLegacyCompleted"]],
    },
    include: [
      {
        model: Customers,
        attributes: ["idCustomer", "fullName", "companyName"],
        where: search
          ? {
              [Op.or]: [
                { fullName: { [Op.iLike]: `%${search}%` } },
                { companyName: { [Op.iLike]: `%${search}%` } },
              ],
            }
          : undefined,
        required: Boolean(search),
      },
      {
        model: PaymentTypes,
        attributes: ["idPaymentType", "desc"],
        required: false,
      },
      {
        model: PaymentReceipts,
        attributes: ["idPaymentReceipt", "paymentTypeId", "receiptType"],
        required: false,
        include: [
          {
            model: PaymentTypes,
            attributes: ["idPaymentType", "desc"],
            required: false,
          },
        ],
      },
      {
        model: SaleItems,
        attributes: ["idSaleItem", "description", "itemType", "subtotal"],
      },
    ],
    order: [["idSale", "DESC"], ["createdAt", "DESC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });
}

module.exports = {
  createSale,
  cancelSale,
  finalizeSale,
  getSaleById,
  getSaleForCancellation,
  getSaleForFinalization,
  listSales,
};
