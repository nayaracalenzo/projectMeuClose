"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("cash_sessions", {
      idCashSession: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("OPEN", "CLOSED"),
        allowNull: false,
        defaultValue: "OPEN",
      },
      openedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      closedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      openingBalance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      expectedBalance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      countedBalance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      differenceAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      openedByUserId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: "users",
          key: "idUser",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      closedByUserId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: "users",
          key: "idUser",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      notes: {
        type: Sequelize.TEXT,
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

    const cashEntriesTable = await queryInterface.describeTable("cash_entries");
    if (!cashEntriesTable.cashSessionId) {
      await queryInterface.addColumn("cash_entries", "cashSessionId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "cash_sessions",
          key: "idCashSession",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },

  async down(queryInterface) {
    const cashEntriesTable = await queryInterface.describeTable("cash_entries");
    if (cashEntriesTable.cashSessionId) {
      await queryInterface.removeColumn("cash_entries", "cashSessionId");
    }

    await queryInterface.dropTable("cash_sessions");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_cash_sessions_status";');
  },
};
