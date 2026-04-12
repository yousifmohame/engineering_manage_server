// src/routes/bank.routes.js
const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bank.controller');

// مسار جلب الحسابات مع أرصدتها وحركاتها
router.get('/', bankController.getAccounts);

// مسار إنشاء حساب بنكي جديد
router.post('/', bankController.createAccount);

// مسار إضافة حركة مالية (إيداع/سحب) للحساب
router.post('/transaction', bankController.addTransaction);

// مسار حذف حساب بنكي (سيقوم بحذف الحركات المرتبطة به تلقائياً)
router.delete('/:id', bankController.deleteAccount);

// تصدير المسارات لاستخدامها في الخادم
module.exports = router;