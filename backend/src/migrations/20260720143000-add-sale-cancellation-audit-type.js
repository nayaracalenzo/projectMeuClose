module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert("audit_types", [
      {
        idAuditType: 5,
        description: "CANCELAMENTO DE VENDA",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("audit_types", {
      idAuditType: [5],
    });
  },
};
