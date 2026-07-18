module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("audit_types", [
      {
        idAuditType: 3,
        description: "EXCLUSAO DE CAIXA",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        idAuditType: 4,
        description: "EXCLUSAO DE BANCO",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("audit_types", {
      idAuditType: [3, 4],
    });
  },
};
