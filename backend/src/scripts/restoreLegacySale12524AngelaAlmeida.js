require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const {
  Customers,
  PaymentReceipts,
  PaymentTypes,
  Products,
  ReceivableInstallments,
  Receivables,
  SaleItems,
  Sales,
  Users,
  sequelize,
} = require("../models");
const { normalizeLegacyCurrency } = require("../utils/normalizeLegacyCurrency");
const { normalizeLegacyDateTime } = require("../utils/normalizeLegacyDateTime");
const { parseLegacyInstallmentInfo } = require("../utils/parseLegacyInstallmentInfo");
const parseDate = require("../utils/parseDate");

const TARGET_SALE_ID = 12524;
const TARGET_CUSTOMER_ID = 974;

function normalizeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(String(value).trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeLegacyPaymentTypeId(value) {
  const normalized = normalizeInteger(value);
  if (!normalized || normalized <= 0) return null;
  return normalized;
}

function roundCurrency(value) {
  return Number(Number(value).toFixed(2));
}

function resolveMainPaymentTypeId(row, validPaymentTypeIds) {
  const immediateAmount = normalizeLegacyCurrency(row.vlrVis) || 0;
  const futureAmount = normalizeLegacyCurrency(row.vlrPra) || 0;
  const immediatePaymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDocVis);
  const futurePaymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDocPra);

  if (futureAmount > 0 && futurePaymentTypeId && validPaymentTypeIds.has(futurePaymentTypeId)) {
    return futurePaymentTypeId;
  }

  if (immediateAmount > 0 && immediatePaymentTypeId && validPaymentTypeIds.has(immediatePaymentTypeId)) {
    return immediatePaymentTypeId;
  }

  if (futurePaymentTypeId && validPaymentTypeIds.has(futurePaymentTypeId)) {
    return futurePaymentTypeId;
  }

  if (immediatePaymentTypeId && validPaymentTypeIds.has(immediatePaymentTypeId)) {
    return immediatePaymentTypeId;
  }

  return null;
}

function inferItemType(product) {
  const categoryId = Number(product?.categoryId || 0);
  const productTypeId = Number(product?.productTypeId || 0);
  const statusId = Number(product?.statusId || 0);

  if (categoryId === 4) return "ACCESSORY";
  if (categoryId === 3) return "SERVICE";
  if (categoryId === 5) return "MISC";
  if (categoryId === 1 && statusId === 1) return "CUSTOM_MADE";
  if (categoryId === 1 && statusId === 5) return "CUSTOM_MADE";
  if (categoryId === 1 && productTypeId === 4) return "CUSTOM_MADE";
  if (categoryId === 1) return "READY_MADE";
  if (productTypeId === 5) return "SERVICE";
  if (productTypeId === 4) return "CUSTOM_MADE";

  return "MISC";
}

function deriveLegacyReceivableStatus(amount, paidAmount, dueDate) {
  if (paidAmount >= amount && amount > 0) {
    return {
      receivableStatus: "PAID",
      installmentStatus: "PAID",
      openAmount: 0,
    };
  }

  if (paidAmount > 0 && paidAmount < amount) {
    return {
      receivableStatus: "PAID",
      installmentStatus: "PAID",
      openAmount: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizedDueDate = new Date(dueDate);
  normalizedDueDate.setHours(0, 0, 0, 0);

  const overdue = normalizedDueDate.getTime() < today.getTime();

  return {
    receivableStatus: overdue ? "OVERDUE" : "OPEN",
    installmentStatus: overdue ? "OVERDUE" : "OPEN",
    openAmount: roundCurrency(amount),
  };
}

async function readCsvRows(fileName) {
  const filePath = path.join(__dirname, fileName);
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ";" }))
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  return rows;
}

async function restoreLegacySale12524AngelaAlmeida() {
  try {
    const [saleRows, saleItemRows, receivableRows, users, paymentTypes, customer, products] =
      await Promise.all([
        readCsvRows("venda.csv"),
        readCsvRows("itensVenda.csv"),
        readCsvRows("contaRec.csv"),
        Users.findAll({ attributes: ["idUser"], raw: true }),
        PaymentTypes.findAll({ attributes: ["idPaymentType"], raw: true }),
        Customers.findByPk(TARGET_CUSTOMER_ID, { raw: true }),
        Products.findAll({
          attributes: ["id", "desc", "categoryId", "productTypeId", "statusId", "createdAt"],
          raw: true,
        }),
      ]);

    if (!customer) {
      throw new Error(`Cliente ${TARGET_CUSTOMER_ID} nao encontrado.`);
    }

    const saleRow = saleRows.find((row) => normalizeInteger(row.id) === TARGET_SALE_ID);
    if (!saleRow) {
      throw new Error(`Venda legado ${TARGET_SALE_ID} nao encontrada em venda.csv.`);
    }

    if (normalizeInteger(saleRow.idCli) !== TARGET_CUSTOMER_ID) {
      throw new Error(`Venda ${TARGET_SALE_ID} nao pertence ao cliente ${TARGET_CUSTOMER_ID}.`);
    }

    const validUserIds = new Set(users.map((item) => Number(item.idUser)));
    const validPaymentTypeIds = new Set(paymentTypes.map((item) => Number(item.idPaymentType)));
    const productsMap = new Map(products.map((product) => [Number(product.id), product]));

    const saleItemCandidates = saleItemRows.filter(
      (row) => normalizeInteger(row.idVen) === TARGET_SALE_ID,
    );

    const receivableCandidates = receivableRows.filter((row) => {
      const history = normalizeText(row.his)?.toUpperCase() || "";
      return history.includes(`VENDA ${TARGET_SALE_ID}`) || history.includes(`VENDA ${TARGET_SALE_ID} - SALDO`);
    });

    const userId = normalizeInteger(saleRow.idUsu);
    const resolvedUserId = userId && validUserIds.has(userId) ? userId : null;
    const createdAt = parseDate(saleRow.dt) || new Date();
    const totalAmountFromLegacy = normalizeLegacyCurrency(saleRow.totVen);
    const immediateAmount = normalizeLegacyCurrency(saleRow.vlrVis) || 0;
    const futureAmount = normalizeLegacyCurrency(saleRow.vlrPra) || 0;
    const derivedFinalAmount = roundCurrency(immediateAmount + futureAmount);
    const finalAmount =
      derivedFinalAmount > 0 ? derivedFinalAmount : roundCurrency(totalAmountFromLegacy || 0);
    const totalAmount =
      totalAmountFromLegacy !== null ? roundCurrency(totalAmountFromLegacy) : finalAmount;
    const hasDiscount = totalAmount > 0 && finalAmount < totalAmount;
    const discountPercent = hasDiscount
      ? roundCurrency(((totalAmount - finalAmount) / totalAmount) * 100)
      : null;

    await sequelize.transaction(async (transaction) => {
      const existingSale = await Sales.findByPk(TARGET_SALE_ID, { transaction });
      if (!existingSale) {
        await Sales.create(
          {
            idSale: TARGET_SALE_ID,
            customerId: TARGET_CUSTOMER_ID,
            userId: resolvedUserId,
            discountType: hasDiscount ? "PERCENTAGE" : null,
            discountValue: discountPercent,
            totalAmount,
            finalAmount,
            status: "COMPLETED",
            dueDate: null,
            paymentTypeId: resolveMainPaymentTypeId(saleRow, validPaymentTypeIds),
            installmentCount: 1,
            createdAt,
            updatedAt: createdAt,
          },
          { transaction },
        );
      }

      for (const row of saleItemCandidates) {
        const saleItemId = normalizeInteger(row.id);
        if (!saleItemId) continue;

        const existingItem = await SaleItems.findByPk(saleItemId, { transaction });
        if (existingItem) continue;

        const productId = normalizeInteger(row.idPro);
        const product = productId ? productsMap.get(productId) : null;
        const quantity = normalizeInteger(row.qtd) || 1;
        const unitPrice = normalizeLegacyCurrency(row.valUni);
        const subtotal = normalizeLegacyCurrency(row.valTot);

        if (unitPrice === null || subtotal === null) {
          continue;
        }

        await SaleItems.create(
          {
            idSaleItem: saleItemId,
            saleId: TARGET_SALE_ID,
            productId: product ? product.id : null,
            itemType: inferItemType(product),
            description: product?.desc || "Item legado",
            metadata: null,
            unitPrice,
            quantity,
            discountType: null,
            discountValue: null,
            subtotal: roundCurrency(subtotal),
            createdAt,
            updatedAt: createdAt,
          },
          { transaction },
        );
      }

      for (const row of receivableCandidates) {
        const legacyId = normalizeInteger(row.id);
        if (!legacyId) continue;

        const amount = normalizeLegacyCurrency(row.vlr);
        if (!amount || amount <= 0) continue;

        const receivableCreatedAt =
          normalizeLegacyDateTime(row.dtEmi) ||
          normalizeLegacyDateTime(row.dtVen, { dateOnly: true }) ||
          createdAt;
        const dueDate =
          normalizeLegacyDateTime(row.dtVen, { dateOnly: true }) || receivableCreatedAt;
        const paidAmount = roundCurrency(normalizeLegacyCurrency(row.vlrRec) || 0);
        const paymentTypeId = normalizeLegacyPaymentTypeId(row.idTipDoc);
        const installmentInfo = parseLegacyInstallmentInfo(row.numDoc, row.his);
        const statusInfo = deriveLegacyReceivableStatus(amount, paidAmount, dueDate);

        const existingReceivable = await Receivables.findByPk(legacyId, { transaction });
        if (!existingReceivable) {
          await Receivables.create(
            {
              idReceivable: legacyId,
              saleId: null,
              customerId: TARGET_CUSTOMER_ID,
              supplierId: null,
              debtorType: "CUSTOMER",
              operatorLabel: null,
              originalAmount: amount,
              openAmount: statusInfo.openAmount,
              status: statusInfo.receivableStatus,
              createdAt: receivableCreatedAt,
              updatedAt: receivableCreatedAt,
            },
            { transaction },
          );
        }

        const existingInstallment = await ReceivableInstallments.findByPk(legacyId, { transaction });
        if (!existingInstallment) {
          await ReceivableInstallments.create(
            {
              idReceivableInstallment: legacyId,
              receivableId: legacyId,
              paymentTypeId:
                paymentTypeId && validPaymentTypeIds.has(paymentTypeId) ? paymentTypeId : null,
              installmentNumber: installmentInfo.installmentNumber,
              totalInstallments: installmentInfo.totalInstallments,
              dueDate,
              amount,
              paidAmount,
              status: statusInfo.installmentStatus,
              createdAt: receivableCreatedAt,
              updatedAt: receivableCreatedAt,
            },
            { transaction },
          );
        }

        const receiptPaidAt = normalizeLegacyDateTime(row.dtRec, { dateOnly: true }) || null;
        if (paidAmount > 0 && receiptPaidAt) {
          const existingReceipt = await PaymentReceipts.findByPk(legacyId, { transaction });
          if (!existingReceipt) {
            await PaymentReceipts.create(
              {
                idPaymentReceipt: legacyId,
                saleId: null,
                receivableInstallmentId: legacyId,
                paymentTypeId:
                  paymentTypeId && validPaymentTypeIds.has(paymentTypeId) ? paymentTypeId : null,
                receiptType: "INSTALLMENT",
                amount: paidAmount,
                paidAt: receiptPaidAt,
                referenceCode: normalizeText(row.numDoc),
                createdAt: receiptPaidAt,
                updatedAt: receiptPaidAt,
              },
              { transaction },
            );
          }
        }
      }
    });

    console.log(`Venda ${TARGET_SALE_ID} restaurada para a cliente ${customer.fullName}.`);
    console.log(`Itens restaurados: ${saleItemCandidates.length}`);
    console.log(`Titulos legados restaurados: ${receivableCandidates.length}`);
  } catch (error) {
    console.error("Erro ao restaurar venda legado da Angela Almeida:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

restoreLegacySale12524AngelaAlmeida();
