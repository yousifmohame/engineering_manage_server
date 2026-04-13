const express = require('express');
const router = express.Router();
const youssefController = require('../controllers/youssef.controller');

router.get('/', youssefController.getData);
router.put('/settings', youssefController.updateSettings);
router.post('/settlement', youssefController.addSettlement);
router.delete('/settlement/:id', youssefController.deleteSettlement);
router.post('/loan', youssefController.addLoan);
router.delete('/loan/:id', youssefController.deleteLoan);

module.exports = router;