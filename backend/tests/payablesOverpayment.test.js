const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function load(relative, dependencies) {
  const filename = path.resolve(__dirname, relative);
  const localRequire = createRequire(filename);
  const context = {
    module: { exports: {} },
    require: (name) =>
      name in dependencies ? dependencies[name] : localRequire(name),
  };

  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return context.module.exports;
}

function createService(repositoryOverrides = {}) {
  return load("../src/services/payablesService.js", {
    "../repositories/financialAccountsRepository": {
      findDefaultByScopeAndTarget: async () => ({
        idFinancialAccount: 2,
        targetType: "BANK",
        scope: "LOJA",
        desc: "BANCO DA LOJA",
      }),
    },
    "../repositories/financialCategoriesRepository": {},
    "../repositories/paymentTypesRepository": {
      getPaymentTypeById: async () => ({ idPaymentType: 8, desc: "PIX" }),
    },
    "../repositories/payablesRepository": repositoryOverrides,
  });
}

function createRepository(payable, onUpdate) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };

  return load("../src/repositories/payablesRepository.js", {
    sequelize: { Op: {}, Sequelize: {} },
    "../models": {
      BankEntries: {},
      CashEntries: {},
      PayablePayments: {
        create: async (payload) => ({ idPayablePayment: 91, ...payload }),
      },
      Payables: {
        findByPk: async () => ({
          ...payable,
          update: async (values) => onUpdate(values),
        }),
      },
      PaymentTypes: {},
      Suppliers: {},
      sequelize: {
        transaction: async (callback) => callback(transaction),
      },
    },
    "../services/financialEntriesService": {
      createBankEntry: async () => {},
      createCashEntry: async () => {},
    },
    "./auditsRepository": {},
  });
}

test("registers a payment above the payable open amount", async () => {
  let receivedPayload = null;
  const service = createService({
    getPayableById: async () => ({
      idPayable: 10,
      amount: 100,
      openAmount: 100,
      status: "OPEN",
      scope: "LOJA",
      category: "FORNECEDOR",
      description: "COMPRA DE TECIDO",
      beneficiary: "FORNECEDOR TESTE",
    }),
    registerPayment: async (_id, payload) => {
      receivedPayload = payload;
      return {
        payable: { openAmount: 0, status: "PAID" },
        payment: { idPayablePayment: 77, amount: payload.amount },
      };
    },
  });

  const result = await service.registerPayment(10, {
    paymentTypeId: 8,
    amount: 120,
    paidAt: "2026-11-17",
  });

  assert.equal(receivedPayload.amount, 120);
  assert.equal(receivedPayload.financialMovement.amount, 120);
  assert.equal(result.paymentId, 77);
});

test("updates the payable amount to the total actually paid", async () => {
  let updatedValues = null;
  const repository = createRepository(
    {
      idPayable: 10,
      amount: 100,
      openAmount: 40,
      status: "PARTIAL",
    },
    (values) => {
      updatedValues = values;
    },
  );

  await repository.registerPayment(10, {
    paymentTypeId: 8,
    amount: 50,
    paidAt: new Date("2026-11-17T00:00:00"),
    referenceCode: null,
  });

  assert.equal(updatedValues.amount, 110);
  assert.equal(updatedValues.openAmount, 0);
  assert.equal(updatedValues.status, "PAID");
});

test("rejects a payment when the payable was closed before the transaction lock", async () => {
  const service = createService({
    getPayableById: async () => ({
      idPayable: 10,
      amount: 100,
      openAmount: 100,
      status: "OPEN",
      scope: "LOJA",
      category: "FORNECEDOR",
      description: "COMPRA DE TECIDO",
      beneficiary: "FORNECEDOR TESTE",
    }),
    registerPayment: async () => ({
      payable: { openAmount: 0, status: "PAID" },
      payment: null,
      alreadyPaid: true,
    }),
  });

  await assert.rejects(
    () =>
      service.registerPayment(10, {
        paymentTypeId: 8,
        amount: 120,
        paidAt: "2026-11-17",
      }),
    /ja esta quitada/i,
  );
});

test("lists the updated real amount and preserves the legacy fallback", async () => {
  const service = createService({
    listPayables: async () => ({
      count: 2,
      rows: [
        {
          idPayable: 1,
          scope: "LOJA",
          description: "CONTA COM EXCEDENTE",
          category: "FORNECEDOR",
          beneficiary: "FORNECEDOR A",
          amount: 120,
          openAmount: 0,
          dueDate: "2026-11-17",
          status: "PAID",
          PayablePayments: [
            { amount: 70, paidAt: "2026-11-17" },
            { amount: 50, paidAt: "2026-11-16" },
          ],
        },
        {
          idPayable: 2,
          scope: "LOJA",
          description: "CONTA LEGADA",
          category: "FORNECEDOR",
          beneficiary: "FORNECEDOR B",
          amount: 100,
          openAmount: 40,
          dueDate: "2026-11-17",
          status: "PARTIAL",
          PayablePayments: [],
        },
      ],
    }),
    summarizePayables: async () => ({ totalAmount: 200, totalOpen: 40 }),
  });

  const result = await service.listPayables();

  assert.equal(result.items[0].amount, 120);
  assert.equal(result.items[0].paidAmount, 120);
  assert.equal(result.items[0].lastPaidAt, "2026-11-17");
  assert.equal(result.items[1].paidAmount, 60);
});
