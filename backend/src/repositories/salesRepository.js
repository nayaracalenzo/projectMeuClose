const { CustomerMeasurements, SaleItems, Sales, sequelize } = require("../models");
const { createBankEntry, createCashEntry } = require("../services/financialEntriesService");
const productsRepository = require("./productsRepository");
const receivablesRepository = require("./receivablesRepository");

async function createSale({
  sale,
  items,
  customerMeasurements,
  entryReceipt,
  receivable,
  financialMovements,
}) {
  return sequelize.transaction(async (transaction) => {
    const createdSale = await Sales.create(sale, { transaction });
    const createdProducts = await productsRepository.createProductsFromSale(
      createdSale,
      items,
      transaction
    );

    const createdItems = await SaleItems.bulkCreate(
      items.map((item, index) => ({
        ...item,
        saleId: createdSale.idSale,
        productId: createdProducts[index]?.id || null,
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

module.exports = {
  createSale,
};
