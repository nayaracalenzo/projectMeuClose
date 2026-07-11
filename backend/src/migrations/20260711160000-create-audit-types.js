module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_types", {
      idAuditType: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_types");
  },
};
