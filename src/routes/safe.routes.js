const express = require('express');
const router = express.Router();
const safeController = require('../controllers/safe.controller');

router.get('/transactions', safeController.getTransactions);
router.post('/transaction', safeController.addTransaction);

// مسارات التعديل والحذف
router.put('/transaction/:id', safeController.updateTransaction);
router.delete('/transaction/:id', safeController.deleteTransaction);

module.exports = router;