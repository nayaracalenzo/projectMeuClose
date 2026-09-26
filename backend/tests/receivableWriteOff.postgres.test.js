const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { Sequelize, DataTypes } = require("sequelize");

function load(relative, dependencies) {
  const filename = path.resolve(__dirname, relative);
  const localRequire = createRequire(filename);
  const context = { Date, module: { exports: {} }, require: (name) => name in dependencies ? dependencies[name] : localRequire(name) };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return context.module.exports;
}

test("PostgreSQL: migrations, write-off, concurrency, rollback and preserved receipts", {
  skip: process.env.RUN_DB_TESTS !== "1", timeout: 60000,
}, async (t) => {
  const env = require("dotenv").parse(fs.readFileSync(path.resolve(__dirname, "../.env")));
  const url = new URL(env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Requires local PostgreSQL");
  const schema = `writeoff_test_${process.pid}_${Date.now()}`;
  const sequelize = new Sequelize(env.DATABASE_URL, { logging: false, define: { schema }, pool: { max: 5 } });
  const models = { sequelize, Sequelize };
  for (const name of ["Receivables", "ReceivableInstallments", "PaymentReceipts", "Audits", "Sales"]) {
    models[name] = require(`../src/models/${name}`)(sequelize, DataTypes);
  }
  models.Customers = sequelize.define("Customers", {
    idCustomer: { type: DataTypes.INTEGER, primaryKey: true }, fullName: DataTypes.STRING, companyName: DataTypes.STRING,
  }, { tableName: "customers" });
  models.PaymentTypes = sequelize.define("PaymentTypes", {
    idPaymentType: { type: DataTypes.INTEGER, primaryKey: true }, desc: DataTypes.STRING,
  }, { tableName: "payment_types" });
  models.ReceivableInstallments.belongsTo(models.Receivables, { foreignKey: "receivableId" });
  models.ReceivableInstallments.hasMany(models.PaymentReceipts, { foreignKey: "receivableInstallmentId" });
  models.ReceivableInstallments.belongsTo(models.PaymentTypes, { foreignKey: "paymentTypeId" });
  models.Receivables.belongsTo(models.Customers, { foreignKey: "customerId" });
  models.PaymentReceipts.belongsTo(models.PaymentTypes, { foreignKey: "paymentTypeId" });
  const newAttributes = {};
  for (const key of ["deletionAuditId", "waivedAmount"]) {
    newAttributes[key] = models.ReceivableInstallments.rawAttributes[key];
    delete models.ReceivableInstallments.rawAttributes[key];
  }
  models.ReceivableInstallments.refreshAttributes();
  const qi = sequelize.getQueryInterface();
  const table = (name) => ({ tableName: name, schema });
  const migrationInterface = {
    describeTable: (name) => qi.describeTable(table(name)),
    showIndex: (name) => qi.showIndex(table(name)),
    addIndex: (name, fields, options) => qi.addIndex(table(name), fields, options),
    addColumn: (name, key, options) => qi.addColumn(table(name), key, {
      ...options, ...(options.references ? { references: { ...options.references, model: table(options.references.model) } } : {}),
    }),
    removeColumn: (name, key) => qi.removeColumn(table(name), key),
  };
  const migrations = [require("../src/migrations/20260914100000-add-installment-deletion-audit"),
    require("../src/migrations/20260914101000-add-installment-waived-amount")];
  let createdSchema = false;
  try {
    await sequelize.createSchema(schema); createdSchema = true;
    await sequelize.sync();
    for (const migration of migrations) { await migration.up(migrationInterface, Sequelize); await migration.up(migrationInterface, Sequelize); }
    for (const migration of [...migrations].reverse()) { await migration.down(migrationInterface); await migration.down(migrationInterface); }
    for (const migration of migrations) await migration.up(migrationInterface, Sequelize);
    Object.assign(models.ReceivableInstallments.rawAttributes, newAttributes);
    models.ReceivableInstallments.refreshAttributes();
    const audits = load("../src/repositories/auditsRepository.js", { "../models": models });
    const repository = load("../src/repositories/receivablesRepository.js", {
      "../models": models, "../services/financialEntriesService": {},
    });
    const service = load("../src/services/receivablesService.js", {
      "../models": models, "../repositories/receivablesRepository": repository,
      "../repositories/auditsRepository": audits,
      "../repositories/cashRepository": {}, "../repositories/bankRepository": {},
      "../repositories/financialAccountsRepository": {},
      "../repositories/paymentTypesRepository": { getPaymentTypeById: (key) => models.PaymentTypes.findByPk(key) },
      "./financialEntriesService": {},
    });
    await models.Customers.create({ idCustomer: 1, fullName: "TEST ONLY" });
    await models.PaymentTypes.create({ idPaymentType: 1, desc: "DUPLICATA" });
    const fixture = async () => {
      const sale = await models.Sales.create({ customerId: 1, totalAmount: 1500, finalAmount: 1500, installmentCount: 2, status: "COMPLETED" });
      const title = await models.Receivables.create({ saleId: sale.idSale, customerId: 1, originalAmount: 1500, openAmount: 1200, status: "PARTIAL" });
      const items = await models.ReceivableInstallments.bulkCreate([300, 0].map((paidAmount, index) => ({
        receivableId: title.idReceivable, paymentTypeId: 1, amount: index ? 500 : 1000, paidAmount,
        installmentNumber: index + 1, totalInstallments: 2, dueDate: "2026-10-19", status: index ? "OPEN" : "PARTIAL",
      })), { returning: true });
      await models.PaymentReceipts.create({ saleId: sale.idSale, receivableInstallmentId: items[0].idReceivableInstallment,
        paymentTypeId: 1, receiptType: "INSTALLMENT", amount: 300, paidAt: "2026-09-14" });
      return { sale, title, items, id: items[0].idReceivableInstallment };
    };
    await t.test("concurrent confirmations write off once and preserve payment records", async () => {
      const { id, title, sale, items } = await fixture();
      const preview = await service.previewReceivableDeletion(id);
      const body = { reason: "TEST", previewToken: preview.previewToken };
      const results = await Promise.allSettled([service.deleteReceivable(id, { id: 1 }, body), service.deleteReceivable(id, { id: 1 }, body)]);
      assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
      await items[0].reload(); await title.reload(); await sale.reload();
      assert.equal(Number(title.openAmount), 500); assert.equal(sale.installmentCount, 1);
      assert.equal(Number(sale.finalAmount), 1500); assert.equal(Number(items[0].paidAmount), 300);
      assert.equal(Number(items[0].waivedAmount), 700); assert.equal(items[0].status, "CANCELLED");
      assert.equal(await models.PaymentReceipts.count({ where: { receivableInstallmentId: id } }), 1);
      assert.equal(await models.Audits.count(), 1);
      await assert.rejects(models.Audits.destroy({ where: { idAudit: items[0].deletionAuditId } }), /violates.*foreign key constraint/);
    });
    await t.test("a receipt committed after preview invalidates deletion", async () => {
      const { id } = await fixture();
      const preview = await service.previewReceivableDeletion(id);
      await repository.withLockedInstallment(id, (item, items, transaction) => repository.registerReceipt(id, {
        amount: 100, paymentTypeId: 1, paidAt: new Date(),
      }, transaction));
      await assert.rejects(service.deleteReceivable(id, { id: 1 }, { reason: "TEST", previewToken: preview.previewToken }), { statusCode: 400 });
      assert.equal(Number((await models.ReceivableInstallments.findByPk(id)).paidAmount), 400);
    });
    await t.test("a failed audit rolls back without modifying the installment", async () => {
      const { id } = await fixture(); const preview = await service.previewReceivableDeletion(id);
      const original = audits.createAudit;
      audits.createAudit = async () => { throw Error("audit unavailable"); };
      try { await assert.rejects(service.deleteReceivable(id, { id: 1 }, { reason: "TEST", previewToken: preview.previewToken }), /audit unavailable/); }
      finally { audits.createAudit = original; }
      assert.equal((await models.ReceivableInstallments.findByPk(id)).deletionAuditId, null);
    });
    await t.test("failure after audit creation rolls back all financial writes", async () => {
      const { id, title } = await fixture(); const preview = await service.previewReceivableDeletion(id);
      const before = await models.Audits.count();
      const original = repository.updateReceivable;
      repository.updateReceivable = async () => { throw Error("title update failed"); };
      try { await assert.rejects(service.deleteReceivable(id, { id: 1 }, { reason: "TEST", previewToken: preview.previewToken }), /title update failed/); }
      finally { repository.updateReceivable = original; }
      assert.equal(await models.Audits.count(), before);
      assert.equal((await models.ReceivableInstallments.findByPk(id)).deletionAuditId, null);
      await title.reload(); assert.equal(Number(title.openAmount), 1200);
    });
    await t.test("renegotiation preserves the excluded partial installment and reschedules only active debt", async () => {
      const { id, sale, title } = await fixture();
      const preview = await service.previewReceivableDeletion(id);
      await service.deleteReceivable(id, { id: 1 }, { reason: "TEST", previewToken: preview.previewToken });
      const excludedBefore = (await models.ReceivableInstallments.findByPk(id)).toJSON();
      await models.PaymentTypes.create({ idPaymentType: 5, desc: "DUPLICATA" });
      const salesRepository = load("../src/repositories/salesRepository.js", {
        "../models": models, "./productsRepository": {}, "./receivablesRepository": repository,
        "../services/financialEntriesService": {},
      });
      salesRepository.getSaleById = async (saleId, transaction) => {
        const record = await models.Sales.findByPk(saleId, { transaction });
        record.Receivable = await models.Receivables.findOne({ where: { saleId }, transaction });
        record.Receivable.ReceivableInstallments = await models.ReceivableInstallments.findAll({ where: { receivableId: record.Receivable.idReceivable }, transaction });
        return record;
      };
      const salesService = load("../src/services/salesService.js", {
        "../models": models, "../repositories/salesRepository": salesRepository,
        "../repositories/auditsRepository": audits, "../repositories/bankRepository": {},
        "../repositories/cashRepository": {}, "../repositories/cashSessionsRepository": {},
        "../repositories/customerCreditsRepository": {}, "../repositories/financialAccountsRepository": {},
        "../repositories/paymentTypesRepository": { getPaymentTypeById: (key) => models.PaymentTypes.findByPk(key) },
        "./financialEntriesService": {},
      });
      await salesService.renegotiateSalePayment(sale.idSale, { id: 1 }, {
        reason: "TEST", paymentTypeId: 5, installmentCount: 2, dueDate: "2026-11-19", installmentIntervalDays: 30,
      });
      assert.deepEqual((await models.ReceivableInstallments.findByPk(id)).toJSON(), excludedBefore);
      const active = await models.ReceivableInstallments.findAll({ where: { receivableId: title.idReceivable, status: { [Sequelize.Op.ne]: "CANCELLED" } } });
      assert.equal(active.length, 2);
      assert.equal(active.reduce((sum, item) => sum + Number(item.amount), 0), 500);
      await title.reload(); assert.equal(Number(title.openAmount), 500);
      assert.equal(await models.PaymentReceipts.count({ where: { receivableInstallmentId: id } }), 1);
    });
    await t.test("dashboard retains received amounts after all installments are excluded", async () => {
      const { id, title, items } = await fixture();
      await models.ReceivableInstallments.update({ dueDate: new Date() }, { where: { receivableId: title.idReceivable } });
      const dashboard = load("../src/repositories/dashboardRepository.js", {
        "../models": { sequelize: { query: (sql, options) => sequelize.query(
          sql.replace(/"(receivable_installments|receivables|sales)"/g, (_, name) => `"${schema}"."${name}"`), options,
        ) } },
      });
      const before = await dashboard.summarizeMonthlyReceivables();
      for (const key of [id, items[1].idReceivableInstallment]) {
        const preview = await service.previewReceivableDeletion(key);
        await service.deleteReceivable(key, { id: 1 }, { reason: "TEST", previewToken: preview.previewToken });
      }
      const after = await dashboard.summarizeMonthlyReceivables();
      assert.equal(after.totalReceived, before.totalReceived);
      assert.equal(after.totalOpen, before.totalOpen - 1200);
      assert.equal(after.totalAmount, before.totalAmount - 1200);
    });
    await t.test("editing a remaining manual installment preserves values and the historical write-off", async () => {
      const { id, title, items } = await fixture();
      await title.update({ saleId: null });
      const preview = await service.previewReceivableDeletion(id);
      await service.deleteReceivable(id, { id: 1 }, { reason: "TEST", previewToken: preview.previewToken });
      await service.updateReceivable(items[1].idReceivableInstallment, {
        customerId: 1, paymentTypeId: 1, amount: 450, dueDate: "2026-11-19",
      });
      await title.reload(); await items[0].reload(); await items[1].reload();
      assert.equal(Number(title.openAmount), 500);
      assert.equal(Number(title.originalAmount), 1500);
      assert.equal(Number(items[1].amount), 500);
      assert.equal(items[1].dueDate.toISOString().slice(0, 10), "2026-11-19");
      assert.equal(Number(items[0].waivedAmount), 700);
      assert.equal(items[0].status, "CANCELLED");
      await assert.rejects(service.registerReceipt(id, { paymentTypeId: 1, amount: 100, paidAt: "2026-09-14" }), { statusCode: 400 });
    });
  } finally {
    if (createdSchema) await sequelize.dropSchema(schema, { cascade: true });
    await sequelize.close();
  }
});
