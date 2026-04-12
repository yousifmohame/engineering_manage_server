const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');

// المسارات الأساسية
router.get('/', expenseController.getExpenses);
router.post('/', expenseController.addExpense);

// مسارات التعديل والحذف (نحتاج لتمرير الـ ID في الرابط)
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

// هذا السطر مهم جداً وبدونه سيظهر الخطأ الذي أرسلته لي!
module.exports = router;