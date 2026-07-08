module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "receivables" ALTER COLUMN "customerId" DROP NOT NULL;',
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("receivables", "customerId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "customers",
        key: "idCustomer",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },
};
