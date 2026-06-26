const express = require('express');
const router = express.Router();
const controller = require('../controllers/professionsController');

router.get('/', controller.getAllProfessions);

module.exports = router;
