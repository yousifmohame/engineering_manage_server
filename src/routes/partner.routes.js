const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partner.controller');

// مسارات إدارة الشركاء
router.get('/', partnerController.getAllPartners);
router.post('/', partnerController.createPartner);
router.put('/:id', partnerController.updatePartner);
router.delete('/:id', partnerController.deletePartner);

module.exports = router;