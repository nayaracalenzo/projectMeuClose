"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("garment_reference_images", {
      idGarmentReferenceImage: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      saleItemId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "sale_items",
          key: "idSaleItem",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      uploadedByUserId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: "users",
          key: "idUser",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      originalName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mimeType: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      sizeBytes: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      imageData: {
        type: Sequelize.BLOB("long"),
        allowNull: false,
      },
      expiresAt: {
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

    await queryInterface.addIndex("garment_reference_images", ["saleItemId"], {
      name: "garment_reference_images_sale_item_idx",
    });
    await queryInterface.addIndex("garment_reference_images", ["expiresAt"], {
      name: "garment_reference_images_expiration_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "garment_reference_images",
      "garment_reference_images_expiration_idx",
    );
    await queryInterface.removeIndex(
      "garment_reference_images",
      "garment_reference_images_sale_item_idx",
    );
    await queryInterface.dropTable("garment_reference_images");
  },
};
