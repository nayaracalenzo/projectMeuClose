"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("sale_drafts", {
      idSaleDraft: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: "users",
          key: "idUser",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "CONSUMED", "DISCARDED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
      payload: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      lastClientSavedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastServerSavedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("sale_drafts", ["userId"], {
      unique: true,
      name: "sale_drafts_active_user_unique_idx",
      where: {
        status: "ACTIVE",
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "sale_drafts",
      "sale_drafts_active_user_unique_idx",
    );
    await queryInterface.dropTable("sale_drafts");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_sale_drafts_status";',
    );
  },
};
