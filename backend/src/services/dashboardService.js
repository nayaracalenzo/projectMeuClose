const { notFoundError, validationError } = require("../errors/AppError");
const repository = require("../repositories/dashboardRepository");

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

async function getDashboardSummary() {
  const [pendingOrders, upcomingFittings, monthlyReceivables, monthlyPayables] = await Promise.all([
    repository.getPendingProductionCount(),
    repository.listUpcomingFittings(5),
    repository.summarizeMonthlyReceivables(),
    repository.summarizeMonthlyPayables(),
  ]);

  const referenceDate = monthlyReceivables.startDate || monthlyPayables.startDate || new Date();
  const referenceMonth = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(referenceDate);

  return {
    pendingOrders,
    upcomingFittings: upcomingFittings.map((item) => ({
      customer: item.customer || "Sem cliente",
      piecesCount: Number(item.piecesCount || 0),
      testDate: item.testDate,
    })),
    monthlyReceivables: {
      totalAmount: Number(monthlyReceivables.totalAmount || 0),
      totalOpen: Number(monthlyReceivables.totalOpen || 0),
      totalReceived: Number(monthlyReceivables.totalReceived || 0),
      totalCardOpen: Number(monthlyReceivables.totalCardOpen || 0),
      totalOverdue: Number(monthlyReceivables.totalOverdue || 0),
      referenceMonth,
      referenceStartDate: monthlyReceivables.startDate,
      referenceEndDate: monthlyReceivables.endDate,
    },
    monthlyPayables: {
      totalAmount: Number(monthlyPayables.totalAmount || 0),
      totalOpen: Number(monthlyPayables.totalOpen || 0),
      totalPaid: Number(monthlyPayables.totalPaid || 0),
      totalCardOpen: Number(monthlyPayables.totalCardOpen || 0),
      totalOverdue: Number(monthlyPayables.totalOverdue || 0),
      referenceMonth,
      referenceStartDate: monthlyPayables.startDate,
      referenceEndDate: monthlyPayables.endDate,
    },
  };
}

async function listPurchasePendings() {
  const records = await repository.listPurchasePendings();

  return records.map((item) => ({
    id: item.id,
    title: item.title,
    done: Boolean(item.done),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

async function createPurchasePending(body = {}) {
  const title = normalizeText(body.title);

  if (!title) {
    throw validationError("Descrição da pendência é obrigatória.");
  }

  const created = await repository.createPurchasePending({
    title,
    done: false,
  });

  return {
    id: created.id,
    title: created.title,
    done: Boolean(created.done),
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

async function updatePurchasePending(id, body = {}) {
  const normalizedId = Number(id);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw validationError("Pendência inválida.");
  }

  const payload = {};

  if ("title" in body) {
    const title = normalizeText(body.title);
    if (!title) {
      throw validationError("Descrição da pendência é obrigatória.");
    }
    payload.title = title;
  }

  if ("done" in body) {
    payload.done = Boolean(body.done);
  }

  if (Object.keys(payload).length === 0) {
    throw validationError("Nenhuma alteração informada.");
  }

  const updated = await repository.updatePurchasePending(normalizedId, payload);
  if (!updated) {
    throw notFoundError("Pendência não encontrada.");
  }

  return {
    id: updated.id,
    title: updated.title,
    done: Boolean(updated.done),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

async function deletePurchasePending(id) {
  const normalizedId = Number(id);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    throw validationError("Pendência inválida.");
  }

  const removed = await repository.deletePurchasePending(normalizedId);
  if (!removed) {
    throw notFoundError("Pendência não encontrada.");
  }

  return {
    message: "Pendência removida com sucesso.",
  };
}

module.exports = {
  getDashboardSummary,
  listPurchasePendings,
  createPurchasePending,
  updatePurchasePending,
  deletePurchasePending,
};
