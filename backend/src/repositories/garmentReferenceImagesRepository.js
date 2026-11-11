const { GarmentReferenceImages } = require("../models");
const { Op } = require("sequelize");

function createReferenceImage(payload) {
  return GarmentReferenceImages.create(payload);
}

function getReferenceImageById(id) {
  return GarmentReferenceImages.findByPk(id);
}

function deleteExpiredUnlinkedReferenceImages() {
  return GarmentReferenceImages.destroy({
    where: {
      saleItemId: null,
      expiresAt: {
        [Op.lt]: new Date(),
      },
    },
  });
}

module.exports = {
  createReferenceImage,
  deleteExpiredUnlinkedReferenceImages,
  getReferenceImageById,
};
