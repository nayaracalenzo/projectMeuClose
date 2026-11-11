const GarmentReferenceImagesSchema = (sequelize, DataTypes) => {
  const GarmentReferenceImages = sequelize.define(
    "GarmentReferenceImages",
    {
      idGarmentReferenceImage: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      saleItemId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      uploadedByUserId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      originalName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mimeType: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      sizeBytes: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      imageData: {
        type: DataTypes.TEXT("long"),
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "garment_reference_images",
      timestamps: true,
    },
  );

  GarmentReferenceImages.associate = (models) => {
    GarmentReferenceImages.belongsTo(models.SaleItems, {
      foreignKey: "saleItemId",
    });
    GarmentReferenceImages.belongsTo(models.Users, {
      foreignKey: "uploadedByUserId",
    });
  };

  return GarmentReferenceImages;
};

module.exports = GarmentReferenceImagesSchema;
