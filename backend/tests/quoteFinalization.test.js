const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function load(relative, dependencies) {
  const filename = path.resolve(__dirname, relative);
  const localRequire = createRequire(filename);
  const context = {
    module: { exports: {} },
    require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : localRequire(name),
  };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return context.module.exports;
}

function item(description, subtotal) {
  return { itemType: "READY_MADE", description, unitPrice: subtotal, subtotal };
}

function setup() {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const sequelize = {
    transaction: (callback) => callback(transaction),
    getQueryInterface: () => ({ describeTable: async () => ({}) }),
  };
  const state = { products: [], movement: null, receipt: null };
  const write = (callback = () => {}) => async (values, options = values) => {
    assert.equal(options.transaction, transaction);
    return callback(values);
  };
  const saleItem = (values, idSaleItem) => ({
    ...values, idSaleItem, update: write(),
  });
  const sale = {
    idSale: 10, customerId: 2, status: "BUDGET", totalAmount: 1000, finalAmount: 1000,
    SaleItems: [saleItem(item("Peça mantida", 800), 1), saleItem(item("Peça retirada", 200), 2)],
    update: write((values) => Object.assign(sale, values)),
  };
  const financialEntries = { createCashEntry: async (entry, receivedTransaction) => {
    assert.equal(receivedTransaction, transaction);
    state.movement = entry;
  } };
  const repository = load("../src/repositories/salesRepository.js", {
    sequelize: { Op: {} },
    "../models": {
      sequelize,
      Sales: {
        findByPk: write(() => sale),
        findOne: write(() => sale),
      },
      GarmentReferenceImages: { update: write() },
      SaleBudgetPaymentDrafts: { destroy: write() },
      SaleItems: {
        destroy: write(() => { state.items = []; }),
        bulkCreate: write((rows) => {
          state.items = Array.from(rows, (row, index) => saleItem(row, index + 10));
          return state.items;
        }),
      },
      CustomerMeasurementValues: { destroy: write() },
    },
    "./productsRepository": { createProductsFromSale: async (_sale, rows, receivedTransaction) => {
      assert.equal(receivedTransaction, transaction);
      state.products = Array.from(rows, (row) => row.description);
      return rows.map((_, index) => ({ id: index + 20 }));
    } },
    "./receivablesRepository": { createStandaloneReceipt: async (receipt, receivedTransaction) => {
      assert.equal(receivedTransaction, transaction);
      state.receipt = receipt;
      return { idPaymentReceipt: 11 };
    }, createReceivableWithInstallments: async (receivable, receivedTransaction) => {
      assert.equal(receivedTransaction, transaction);
      state.receivable = receivable;
      return receivable;
    } },
    "../services/financialEntriesService": financialEntries,
  });
  const dependencies = Object.fromEntries(
    ["audits", "bank", "cash", "customerCredits"].map((name) => [`../repositories/${name}Repository`, {}]),
  );
  const service = load("../src/services/salesService.js", {
    ...dependencies,
    "../models": { sequelize },
    "../repositories/salesRepository": repository,
    "../repositories/cashSessionsRepository": { findOpenStoreSession: async () => ({ openedAt: new Date() }) },
    "../repositories/paymentTypesRepository": {
      getPaymentTypeById: async (id) => ({ idPaymentType: id, desc: id === 1 ? "DINHEIRO" : "CARNÊ" }),
    },
    "../repositories/financialAccountsRepository": { findDefaultByScopeAndTarget: async () => ({ scope: "LOJA", targetType: "CASH" }) },
    "./financialEntriesService": financialEntries,
  });
  return { service, state, sale };
}

test("finaliza o orçamento com os itens editados e recebe o total atualizado", async () => {
  const { service, state, sale } = setup();
  const response = await service.finalizeSale(10, {
    customerId: 2, items: [item("Peça mantida", 800)],
    totalAmount: 800, finalAmount: 800, paymentTypeId: 1,
  });
  assert.equal(sale.status, "COMPLETED");
  assert.equal(response.id, 10);
  assert.equal(response.itemsCount, 1);
  assert.equal(response.finalAmount, 800);
  assert.deepEqual(state.items.map((row) => row.description), ["Peça mantida"]);
  assert.deepEqual(state.products, ["Peça mantida"]);
  assert.equal(state.receipt.amount, 800);
  assert.equal(state.movement.amount, 800);
});

test("aceita a finalização que envia apenas os dados do pagamento", async () => {
  const { service, state } = setup();
  const response = await service.finalizeSale(10, { paymentTypeId: 1 });
  assert.equal(response.itemsCount, 2);
  assert.equal(state.receipt.amount, 1000);
  assert.equal(state.items, undefined);
});

test("calcula as parcelas pelo total do orçamento editado com desconto", async () => {
  const { service, state } = setup();
  const response = await service.finalizeSale(10, {
    customerId: 2, items: [item("Peça mantida", 800)],
    totalAmount: 800, finalAmount: 750, discountType: "FIXED", discountValue: 50,
    paymentTypeId: 4, installmentCount: 2, dueDate: "2026-12-20",
  });
  assert.equal(response.finalAmount, 750);
  assert.equal(state.receivable.receivable.openAmount, 750);
  assert.equal(state.receivable.installments.length, 2);
  assert.equal(state.receivable.installments[0].amount, 375);
  assert.equal(state.receivable.installments[1].amount, 375);
});

test("impede a finalização com a lista de itens vazia", async () => {
  const { service, state, sale } = setup();
  await assert.rejects(service.finalizeSale(10, { items: [], customerId: 2 }), { statusCode: 400 });
  assert.equal(sale.status, "BUDGET");
  assert.equal(state.receipt, null);
});
