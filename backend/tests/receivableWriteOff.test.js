const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const test = require("node:test");
const vm = require("node:vm");
const balance = require("../src/utils/receivableBalance");

function load(relative, dependencies) {
  const filename = path.resolve(__dirname, relative);
  const localRequire = createRequire(filename);
  const context = { module: { exports: {} }, require: (name) => name in dependencies ? dependencies[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return context.module.exports;
}

function harness({ paid = 300, saleId = 12, second = true, fail = false } = {}) {
  const state = {
    title: { idReceivable: 5, saleId, status: "PARTIAL", openAmount: 1500 - paid },
    items: [{ idReceivableInstallment: 42, receivableId: 5, amount: 1000, paidAmount: paid,
      dueDate: "2026-10-19", installmentNumber: 1, totalInstallments: 2, status: "OPEN", waivedAmount: 0 }],
    audits: [], sale: { finalAmount: 1500, installmentCount: 2 },
    receipts: paid ? [{ amount: paid, idPaymentReceipt: 1 }] : [],
    cashEntries: paid ? [{ amount: paid }] : [],
  };
  if (second) state.items.push({ idReceivableInstallment: 43, receivableId: 5, amount: 500,
    paidAmount: 0, status: "OPEN", dueDate: "2026-11-19", installmentNumber: 2, totalInstallments: 2 });
  const instance = (item) => Object.assign({}, item, { get: () => ({ ...item }) });
  let queue = Promise.resolve();
  const repository = {
    withLockedInstallment: (id, callback) => {
      const run = queue.then(async () => {
        const before = structuredClone(state);
        const item = state.items.find((row) => row.idReceivableInstallment === id);
        const loaded = item ? Object.assign(instance(item), {
          Receivable: { ...state.title, Customer: { fullName: "Cliente teste" } }, PaymentReceipts: state.receipts,
        }) : null;
        try { return await callback(loaded, state.items.map(instance), {}); }
        catch (error) { Object.assign(state, before); throw error; }
      });
      queue = run.catch(() => {});
      return run;
    },
    updateInstallment: async (id, values) => Object.assign(state.items.find((row) => row.idReceivableInstallment === id), values),
    updateReceivable: async (id, values) => { if (fail) throw Error("database failure"); Object.assign(state.title, values); },
    updateSaleFinancialSummary: async (id, values) => { if (id) Object.assign(state.sale, values); },
  };
  const service = load("../src/services/receivablesService.js", {
    "../models": {}, "../repositories/financialAccountsRepository": {},
    "../repositories/paymentTypesRepository": { getPaymentTypeById: async () => ({}) },
    "../repositories/cashRepository": {}, "../repositories/bankRepository": {},
    "../repositories/auditsRepository": { createAudit: async (audit) => {
      state.audits.push({ ...audit, idAudit: 9 }); return state.audits.at(-1);
    } },
    "./financialEntriesService": {}, "../repositories/receivablesRepository": repository,
  });
  const remove = async () => {
    const preview = await service.previewReceivableDeletion(42);
    return service.deleteReceivable(42, { id: 7 }, { reason: "  Lançamento duplicado  ", previewToken: preview.previewToken });
  };
  return { service, state, remove };
}

test("partial installment preserves receipts, other installments and original sale value", async () => {
  const { state, remove } = harness();
  const before = structuredClone(state);
  assert.equal((await remove()).waivedAmount, 700);
  assert.equal(state.title.openAmount, 500);
  assert.equal(state.items[0].status, "CANCELLED");
  assert.equal(state.items[0].deletionAuditId, 9);
  assert.equal(state.items[0].amount, 1000);
  assert.equal(state.items[0].paidAmount, 300);
  assert.deepEqual(state.items[1], before.items[1]);
  assert.deepEqual(state.receipts, before.receipts);
  assert.deepEqual(state.cashEntries, before.cashEntries);
  assert.equal(state.sale.finalAmount, 1500);
  assert.equal(state.sale.installmentCount, 1);
  assert.equal(state.audits[0].reason, "Lançamento duplicado");
  assert.equal(state.audits[0].userId, 7);
  assert.match(state.audits[0].history, /em \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
  assert.match(state.audits[0].history, /vencimento em 19\/10\/2026/);
  assert.match(state.audits[0].history, /Abatimento: 700.00/);
});

test("manual and last sale installment are preserved with zero outstanding balance", async () => {
  for (const saleId of [null, 12]) {
    const { state, remove } = harness({ paid: 0, saleId, second: false });
    await remove();
    assert.equal(state.title.openAmount, 0);
    assert.equal(state.title.status, "CANCELLED");
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0].waivedAmount, 1000);
    if (saleId) assert.equal(state.sale.installmentCount, 0);
  }
});

test("invalid reasons and missing preview block deletion", async () => {
  const { service, state } = harness();
  for (const body of [undefined, null, {}, { reason: "" }, { reason: " \n " }, { reason: 123 }, { reason: {} }, { reason: "teste" }]) {
    await assert.rejects(service.deleteReceivable(42, { id: 7 }, body), { statusCode: 400 });
  }
  assert.equal(state.audits.length, 0);
});

test("paid, cancelled, missing and already excluded installments are blocked", async () => {
  for (const status of ["PAID", "CANCELLED"]) {
    const { state, remove } = harness(); state.items[0].status = status;
    await assert.rejects(remove(), { statusCode: 400 });
  }
  const { remove, state, service } = harness();
  await remove(); await assert.rejects(remove(), { statusCode: 400 });
  assert.equal(state.audits.length, 1);
  await assert.rejects(service.previewReceivableDeletion(999), { statusCode: 404 });
  await assert.rejects(service.reverseLatestReceipt(42, { id: 7 }, { reason: "teste" }), { statusCode: 400 });
  await assert.rejects(service.updateReceivable(42, {}), { statusCode: 400 });
});

test("receipt or sibling change invalidates the preview", async () => {
  for (const index of [0, 1]) {
    const { service, state } = harness();
    const preview = await service.previewReceivableDeletion(42); state.items[index].paidAmount += 100;
    await assert.rejects(service.deleteReceivable(42, { id: 7 }, { reason: "teste", previewToken: preview.previewToken }), { statusCode: 400 });
    assert.equal(state.audits.length, 0);
  }
});

test("serialized concurrent confirmations create one audit and one write-off", async () => {
  const { service, state } = harness();
  const preview = await service.previewReceivableDeletion(42);
  const body = { reason: "teste", previewToken: preview.previewToken };
  const results = await Promise.allSettled([service.deleteReceivable(42, { id: 7 }, body), service.deleteReceivable(42, { id: 7 }, body)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(state.audits.length, 1); assert.equal(state.title.openAmount, 500);
});

test("failure rolls back audit and installment changes in the transaction harness", async () => {
  const { state, remove } = harness({ fail: true }); const before = structuredClone(state);
  await assert.rejects(remove(), /database failure/); assert.deepEqual(state, before);
});

test("controller forwards the preview token and reason", async () => {
  const { service, state } = harness(); const preview = await service.previewReceivableDeletion(42);
  const controller = load("../src/controllers/receivablesController.js", { "../services/receivablesService": service });
  const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { return body; } };
  await controller.deleteReceivableController({ params: { installmentId: "42" }, user: { id: 7 }, body: {
    reason: "teste", previewToken: preview.previewToken,
  } }, res, (error) => { throw error; });
  assert.equal(state.audits.length, 1);
});

test("balance summary excludes waived debt without counting it as payment", () => {
  const items = [{ amount: 1000, paidAmount: 300, status: "CANCELLED", deletionAuditId: 9, waivedAmount: 700 },
    { amount: 500, paidAmount: 500, status: "PAID" }];
  assert.equal(balance.openBalance(items[0]), 0);
  assert.deepEqual(balance.summarize(items), { openAmount: 0, waivedAmount: 700, installmentCount: 1, status: "PAID" });
});
