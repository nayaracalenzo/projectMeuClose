module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("receivable_installments");
    if (!table.deletionAuditId) {
      await queryInterface.addColumn("receivable_installments", "deletionAuditId", {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: "audits", key: "idAudit" },
        onDelete: "RESTRICT", onUpdate: "CASCADE",
      });
    }
    const indexes = await queryInterface.showIndex("receivable_installments");
    if (!indexes.some((index) => index.name === "receivable_installments_deletion_audit_id")) {
      await queryInterface.addIndex("receivable_installments", ["deletionAuditId"], {
        name: "receivable_installments_deletion_audit_id",
      });
    }
  },
  async down(queryInterface) {
    const table = await queryInterface.describeTable("receivable_installments");
    if (table.deletionAuditId) await queryInterface.removeColumn("receivable_installments", "deletionAuditId");
  },
};
