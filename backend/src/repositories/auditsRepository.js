const crypto = require("crypto");
const { Audits } = require("../models");

async function createAudit(auditPayload, transaction) {
  return Audits.create(
    {
      auditTypeId: auditPayload.auditTypeId,
      userId: auditPayload.userId,
      occurredAt: auditPayload.occurredAt,
      history: auditPayload.history,
      reason: auditPayload.reason || null,
      legacyFingerprint: crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            auditTypeId: auditPayload.auditTypeId,
            occurredAt: auditPayload.occurredAt.toISOString(),
            history: auditPayload.history,
            userId: auditPayload.userId || null,
          }),
        )
        .digest("hex"),
    },
    { transaction },
  );
}

module.exports = {
  createAudit,
};
