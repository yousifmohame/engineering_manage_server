const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

// مسار جلب ملخص الأصول
router.get('/financial-summary', aiController.getFinancialSummary);

// مسار إرسال السؤال للذكاء الاصطناعي
router.post('/ask', aiController.askAi);

// أضف هذا السطر مع باقي المسارات
router.get('/history', aiController.getAnalyticsHistory);

module.exports = router;