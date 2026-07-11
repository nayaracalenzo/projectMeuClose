module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("employees", "roleId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "roles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("users", "roleId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "roles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("payment_receipts", "paymentTypeId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "payment_types",
        key: "idPaymentType",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("payable_payments", "paymentTypeId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "payment_types",
        key: "idPaymentType",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("employees", "roleId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "roles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("users", "roleId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "roles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("payment_receipts", "paymentTypeId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "payment_types",
        key: "idPaymentType",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.changeColumn("payable_payments", "paymentTypeId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "payment_types",
        key: "idPaymentType",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },
};
