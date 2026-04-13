const express = require('express');
const router = express.Router();
const nazmiController = require('../controllers/nazmi.controller');

router.get('/', nazmiController.getData);
router.put('/settings', nazmiController.updateSettings); // مسار إعدادات الشراكة (الجديد ✨)
router.post('/transaction', nazmiController.addTransaction);
router.put('/transaction/:id', nazmiController.updateTransaction); 
router.delete('/transaction/:id', nazmiController.deleteTransaction);
router.get('/ai-report', nazmiController.generateAIReport);

module.exports = router;