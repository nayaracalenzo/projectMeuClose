const service = require("../services/salesService");
const garmentReferenceImagesService = require("../services/garmentReferenceImagesService");

async function createReferenceImageController(req, res, next) {
  try {
    const created = await garmentReferenceImagesService.createReferenceImage(
      {
        imageBase64: req.body?.imageBase64,
        mimeType: req.body?.mimeType,
        originalName: req.body?.originalName,
      },
      req.user,
    );
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function getReferenceImageController(req, res, next) {
  try {
    const image = await garmentReferenceImagesService.getReferenceImage(req.params.imageId);
    const encodedName = encodeURIComponent(image.originalName);

    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Content-Length", image.sizeBytes);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodedName}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(image.imageData);
  } catch (error) {
    return next(error);
  }
}

async function createSaleController(req, res, next) {
  try {
    const created = await service.createSale(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
}

async function updateSaleController(req, res, next) {
  try {
    const updated = await service.updateSale(req.params.id, req.body);
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

async function updateSaleCustomerController(req, res, next) {
  try {
    const updated = await service.updateSaleCustomer(req.params.id, req.body);
    return res.status(200).json(updated);
  } catch (error) {
    return next(error);
  }
}

async function listSalesController(req, res, next) {
  try {
    const data = await service.listSales(req.query);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function finalizeSaleController(req, res, next) {
  try {
    const finalized = await service.finalizeSale(req.params.id, req.body);
    return res.status(200).json(finalized);
  } catch (error) {
    return next(error);
  }
}

async function getSaleByIdController(req, res, next) {
  try {
    const data = await service.getSaleById(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function cancelSaleController(req, res, next) {
  try {
    const data = await service.cancelSale(req.params.id, req.user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function cancelSaleItemController(req, res, next) {
  try {
    const data = await service.cancelSaleItem(req.params.id, req.params.itemId, req.user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function renegotiateSalePaymentController(req, res, next) {
  try {
    const data = await service.renegotiateSalePayment(req.params.id, req.user, req.body);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

async function deleteSaleController(req, res, next) {
  try {
    const data = await service.deleteQuote(req.params.id);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelSaleItemController,
  cancelSaleController,
  createSaleController,
  createReferenceImageController,
  deleteSaleController,
  finalizeSaleController,
  getSaleByIdController,
  getReferenceImageController,
  listSalesController,
  renegotiateSalePaymentController,
  updateSaleCustomerController,
  updateSaleController,
};
