module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("cash_entries", {
      idCashEntry: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      scope: {
        type: Sequelize.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
        defaultValue: "LOJA",
      },
      movementType: {
        type: Sequelize.ENUM("IN", "OUT"),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      occurredAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      sourceType: {
        type: Sequelize.ENUM("SALE_RECEIPT", "RECEIVABLE_RECEIPT", "PAYABLE_PAYMENT", "MANUAL"),
        allowNull: false,
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      paymentReceiptId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_receipts",
          key: "idPaymentReceipt",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      payablePaymentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payable_payments",
          key: "idPayablePayment",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      paymentTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      referenceCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
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

    await queryInterface.createTable("bank_entries", {
      idBankEntry: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      scope: {
        type: Sequelize.ENUM("LOJA", "PESSOAL"),
        allowNull: false,
        defaultValue: "LOJA",
      },
      movementType: {
        type: Sequelize.ENUM("IN", "OUT"),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      accountLabel: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      occurredAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      sourceType: {
        type: Sequelize.ENUM("SALE_RECEIPT", "RECEIVABLE_RECEIPT", "PAYABLE_PAYMENT", "MANUAL"),
        allowNull: false,
      },
      saleId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sales",
          key: "idSale",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      paymentReceiptId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_receipts",
          key: "idPaymentReceipt",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      payablePaymentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payable_payments",
          key: "idPayablePayment",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      paymentTypeId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "payment_types",
          key: "idPaymentType",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      referenceCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
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
    await queryInterface.dropTable("bank_entries");
    await queryInterface.dropTable("cash_entries");
  },
};
