// src/routes/partnership.routes.js
const express = require('express');
const router = express.Router();
const partnershipController = require('../controllers/partnership.controller');

// 1. جلب جميع المصروفات والتسويات
router.get('/', partnershipController.getExpenses);

// 2. إضافة مصروف جديد
router.post('/', partnershipController.addExpense);

// 3. تعديل مصروف موجود باستخدام الـ ID
router.put('/:id', partnershipController.updateExpense);

// 4. حذف مصروف باستخدام الـ ID
router.delete('/:id', partnershipController.deleteExpense);

module.exports = router;